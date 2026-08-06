use crate::client::{ApiClient, ClientError};
use crate::collector::MetricsCollector;
use crate::config::AgentConfig;
use crate::registration::{self, RegistrationSource};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::signal;
use tokio::time::{interval, Duration, Instant};

fn jitter_offset(base_secs: u64) -> Duration {
    let jitter_secs = (base_secs / 10).max(1);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;
    let offset = nanos % (jitter_secs * 2);
    Duration::from_secs(offset.min(jitter_secs))
}

pub struct Agent {
    config: AgentConfig,
    client: ApiClient,
    collector: MetricsCollector,
    device_token: String,
    device_id: String,
    last_inventory_hash: u64,
    running: Arc<AtomicBool>,
    consecutive_auth_failures: u32,
    registration_source: RegistrationSource,
}

impl Agent {
    pub async fn new(config: AgentConfig) -> anyhow::Result<Self> {
        let client = ApiClient::new(config.api_url.clone());
        let (device_token, device_id, registration_source) =
            crate::registration::ensure_registered(&config).await?;

        match &registration_source {
            RegistrationSource::Environment => {
                tracing::info!(
                    "Device authenticated via TF_DEVICE_TOKEN (token length: {})",
                    device_token.len()
                );
            }
            RegistrationSource::Disk => {
                tracing::info!(
                    "Device token restored from disk (token length: {})",
                    device_token.len()
                );
            }
            RegistrationSource::FreshRegistration => {
                tracing::info!(
                    "Device registered and authenticated (token length: {})",
                    device_token.len()
                );
            }
        }

        let collector = MetricsCollector::new();

        Ok(Self {
            config,
            client,
            collector,
            device_token,
            device_id,
            last_inventory_hash: 0,
            running: Arc::new(AtomicBool::new(true)),
            consecutive_auth_failures: 0,
            registration_source,
        })
    }

    pub fn registration_source(&self) -> &RegistrationSource {
        &self.registration_source
    }

    pub async fn run(&mut self) -> anyhow::Result<()> {
        let running = self.running.clone();
        let r = running.clone();

        tokio::spawn(async move {
            let _ = signal::ctrl_c().await;
            tracing::info!("Received shutdown signal");
            r.store(false, Ordering::SeqCst);
        });

        #[cfg(unix)]
        {
            let r = running.clone();
            tokio::spawn(async move {
                let mut stream = signal::unix::signal(signal::unix::SignalKind::terminate())
                    .expect("Failed to install SIGTERM handler");
                stream.recv().await;
                tracing::info!("Received SIGTERM");
                r.store(false, Ordering::SeqCst);
            });
        }

        let jitter = jitter_offset(self.config.interval_secs);
        tracing::info!("Telemetry jitter offset: {:?}", jitter);

        let mut telemetry_ticker =
            interval(Duration::from_secs(self.config.interval_secs) + jitter);
        let mut security_ticker = interval(Duration::from_secs(self.config.security_interval_secs));
        let mut inventory_ticker =
            interval(Duration::from_secs(self.config.inventory_interval_secs));
        let mut remote_ticker = interval(Duration::from_secs(
            self.config.remote_polling_interval_secs,
        ));
        let mut command_ticker = interval(Duration::from_secs(15));

        telemetry_ticker.tick().await;
        security_ticker.tick().await;
        inventory_ticker.tick().await;
        remote_ticker.tick().await;
        command_ticker.tick().await;

        tracing::info!(
            "Agent v{} started: telemetry={}s, security={}s, inventory={}s, remote={}s",
            self.config.agent_version,
            self.config.interval_secs,
            self.config.security_interval_secs,
            self.config.inventory_interval_secs,
            self.config.remote_polling_interval_secs,
        );

        loop {
            if !self.running.load(Ordering::SeqCst) {
                tracing::info!("Agent shutting down gracefully...");
                break;
            }

            tokio::select! {
                _ = telemetry_ticker.tick() => {
                    if let Err(e) = self.collect_and_send_metrics().await {
                        tracing::warn!("Metrics cycle error: {}", e);
                    }
                }
                _ = security_ticker.tick() => {
                    if let Err(e) = self.collect_and_send_security().await {
                        tracing::warn!("Security scan error: {}", e);
                    }
                }
                _ = inventory_ticker.tick() => {
                    if let Err(e) = self.collect_and_send_inventory().await {
                        tracing::warn!("Inventory sync error: {}", e);
                    }
                }
                _ = remote_ticker.tick() => {
                    if let Err(e) = self.poll_remote_sessions().await {
                        tracing::warn!("Remote polling error: {}", e);
                    }
                }
                _ = command_ticker.tick() => {
                    if let Err(e) = self.poll_pending_commands().await {
                        tracing::warn!("Command polling error: {}", e);
                    }
                }
                _ = self.shutdown_wait() => {
                    tracing::info!("Agent shutting down gracefully...");
                    break;
                }
            }
        }

        Ok(())
    }

    fn shutdown_wait(&self) -> impl std::future::Future<Output = ()> {
        let running = self.running.clone();
        async move {
            loop {
                if !running.load(Ordering::SeqCst) {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
        }
    }

    async fn collect_and_send_metrics(&mut self) -> anyhow::Result<()> {
        let metrics = self.collector.collect();

        match self.client.send_metrics(&self.device_token, &metrics).await {
            Ok(()) => {
                self.consecutive_auth_failures = 0;
                let temp_str = metrics
                    .temperature_celsius
                    .map(|t| format!(" | Temp: {:.1}°C", t))
                    .unwrap_or_default();
                tracing::info!(
                    "Metrics sent | CPU: {:.1}% | RAM: {:.1}%{}",
                    metrics.cpu_usage_percent,
                    metrics.ram_usage_percent,
                    temp_str,
                );
                Ok(())
            }
            Err(ClientError::Unauthorized) => {
                self.consecutive_auth_failures += 1;
                tracing::warn!(
                    "[DEVICE_AUTH] Stored device credential was rejected (401). \
                     Consecutive failures: {}",
                    self.consecutive_auth_failures
                );
                if self.consecutive_auth_failures > 3 {
                    tracing::error!(
                        "[DEVICE_AUTH] Too many auth failures ({}). \
                         Stopping authenticated telemetry retries.\n\
                         Recovery: generate a fresh enrollment token from Dashboard → Connect Device,\n\
                         then re-run the installer or re-enroll once:\n\
                         \tsudo systemctl restart techfusion-agent\n\
                         \texport TF_ORG_TOKEN=<fresh-token> /usr/local/bin/techfusion-agent --enroll\n\
                         Or clear local identity: rm {}",
                        self.consecutive_auth_failures,
                        self.config.state_dir.join("device_token").display()
                    );
                    return Err(anyhow::anyhow!(
                        "Device token rejected {} times consecutively — giving up. See recovery instructions above.",
                        self.consecutive_auth_failures
                    ));
                }
                self.handle_token_rejection().await
            }
            Err(e) => {
                tracing::warn!("Failed to send metrics: {}", e);
                Err(anyhow::anyhow!("{}", e))
            }
        }
    }

    async fn handle_token_rejection(&mut self) -> anyhow::Result<()> {
        registration::invalidate_token(&self.config.state_dir);

        if self.config.org_token.is_none() {
            tracing::error!(
                "[RECOVERY] No TF_ORG_TOKEN available. Cannot re-register.\n\
                 To fix this:\n\
                 1. Generate a fresh enrollment token from Dashboard → Connect Device\n\
                 2. Restart the agent service, then re-enroll once:\n\
                 \tsudo systemctl restart techfusion-agent\n\
                 \tsudo TF_ORG_TOKEN=<fresh-enrollment-token> /usr/local/bin/techfusion-agent --enroll\n\
                 \n\
                 Or clear local identity:\n\
                 \trm {} {}",
                self.config.state_dir.join("device_token").display(),
                self.config.state_dir.join("device_id").display()
            );
            return Err(anyhow::anyhow!(
                "No enrollment token available for re-registration"
            ));
        }

        tracing::info!("[RECOVERY] Attempting re-registration with TF_ORG_TOKEN...");

        match registration::attempt_reregister(&self.config, &self.client).await {
            Ok((new_token, new_device_id)) => {
                self.device_token = new_token;
                self.device_id = new_device_id;
                self.consecutive_auth_failures = 0;
                tracing::info!(
                    "[RECOVERY] Re-registration successful. Token length: {}. Resuming operations.",
                    self.device_token.len()
                );
                Ok(())
            }
            Err(e) => {
                tracing::error!(
                    "[RECOVERY] Re-registration failed: {}. Will retry on next metrics cycle.",
                    e
                );
                Err(e)
            }
        }
    }

    async fn collect_and_send_security(&mut self) -> anyhow::Result<()> {
        let start = Instant::now();
        let findings = crate::security::collect_security_findings();

        match self
            .client
            .send_security_report(&self.device_token, &findings)
            .await
        {
            Ok(()) => {
                tracing::info!(
                    "Security report sent: {} findings in {:?}",
                    findings.len(),
                    start.elapsed()
                );
                Ok(())
            }
            Err(ClientError::Unauthorized) => {
                self.consecutive_auth_failures += 1;
                tracing::warn!("Security report rejected (401), attempting re-registration");
                self.handle_token_rejection().await
            }
            Err(e) => {
                tracing::warn!("Security report failed: {}", e);
                Err(anyhow::anyhow!("{}", e))
            }
        }
    }

    async fn collect_and_send_inventory(&mut self) -> anyhow::Result<()> {
        let start = Instant::now();
        tracing::info!("[INVENTORY] Collection started");
        let report = crate::inventory::collect_inventory();
        tracing::info!("[INVENTORY] Pending response received");
        tracing::info!("[INVENTORY] Software collected: {}", report.software_count);
        tracing::info!("[INVENTORY] Drivers collected: {}", report.driver_count);

        let hash = crate::security::compute_inventory_hash(&report);
        if hash == self.last_inventory_hash {
            tracing::debug!(
                "[INVENTORY] Inventory unchanged ({} drivers, {} software), skipping upload",
                report.driver_count,
                report.software_count
            );
            return Ok(());
        }

        let org_id = self.config.org_token.clone().unwrap_or_default();

        match self
            .client
            .send_inventory_report(&self.device_token, &org_id, &report)
            .await
        {
            Ok(()) => {
                self.last_inventory_hash = hash;
                tracing::info!(
                    "[INVENTORY] Upload completed: {} drivers, {} software in {:?}",
                    report.driver_count,
                    report.software_count,
                    start.elapsed()
                );
                let _ = self
                    .client
                    .clear_pending_inventory(&self.device_token, &self.device_id)
                    .await;
                Ok(())
            }
            Err(ClientError::Unauthorized) => {
                self.consecutive_auth_failures += 1;
                tracing::warn!(
                    "[INVENTORY] Inventory report rejected (401), attempting re-registration"
                );
                self.handle_token_rejection().await
            }
            Err(e) => {
                tracing::warn!("[INVENTORY] Command failed: {}", e);
                Err(anyhow::anyhow!("{}", e))
            }
        }
    }

    async fn poll_remote_sessions(&self) -> anyhow::Result<()> {
        if self.device_id.is_empty() {
            return Ok(());
        }

        match self
            .client
            .check_pending_remote_sessions(&self.device_token, &self.device_id)
            .await
        {
            Ok(sessions) => {
                for session in &sessions {
                    if let (Some(session_id), Some(technician_id)) = (
                        session.get("id").and_then(|v| v.as_str()),
                        session.get("technicianId").and_then(|v| v.as_str()),
                    ) {
                        tracing::info!(
                            "[REMOTE] Pending session {} from technician {}",
                            session_id,
                            technician_id
                        );

                        tracing::info!("[REMOTE] Consent requested for session {}", session_id);

                        match self
                            .client
                            .send_remote_consent(
                                &self.device_token,
                                session_id,
                                &self.device_id,
                                true,
                            )
                            .await
                        {
                            Ok(()) => {
                                tracing::info!("[REMOTE] Session accepted: {}", session_id);
                                let _ = self
                                    .client
                                    .send_remote_status(
                                        &self.device_token,
                                        session_id,
                                        &self.device_id,
                                        "active",
                                    )
                                    .await;
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "[REMOTE] Session {} consent/accept failed: {}",
                                    session_id,
                                    e
                                );
                                let _ = self
                                    .client
                                    .send_remote_status(
                                        &self.device_token,
                                        session_id,
                                        &self.device_id,
                                        "failed",
                                    )
                                    .await;
                            }
                        }
                    }
                }
                Ok(())
            }
            Err(ClientError::Unauthorized) => {
                tracing::debug!(
                    "[REMOTE] Remote polling auth rejected (401) — will recover with next metrics cycle"
                );
                Ok(())
            }
            Err(e) => {
                tracing::debug!("[REMOTE] Remote polling error: {}", e);
                Ok(())
            }
        }
    }

    async fn poll_pending_commands(&mut self) -> anyhow::Result<()> {
        if self.device_id.is_empty() {
            return Ok(());
        }

        self.poll_pending_security_scans().await;
        if self.config.network_discovery_enabled {
            self.poll_pending_discovery_commands().await;
        }
        self.poll_pending_inventory_commands().await;

        Ok(())
    }

    async fn poll_pending_security_scans(&self) {
        if self.device_id.is_empty() {
            return;
        }

        match self
            .client
            .get_pending_security_scans(&self.device_id)
            .await
        {
            Ok(scans) => {
                for scan in &scans {
                    if let Some(scan_id) = scan.get("id").and_then(|v| v.as_str()) {
                        tracing::info!("Processing pending security scan: {}", scan_id);

                        let start = Instant::now();
                        let findings = crate::security::collect_security_findings();
                        tracing::info!(
                            "Security scan {} collected {} findings in {:?}",
                            scan_id,
                            findings.len(),
                            start.elapsed()
                        );

                        match self.client.complete_security_scan(scan_id, &findings).await {
                            Ok(()) => {
                                tracing::info!("Security scan {} completed successfully", scan_id);
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Failed to complete security scan {}: {}",
                                    scan_id,
                                    e
                                );
                            }
                        }
                    }
                }
            }
            Err(ClientError::Unauthorized) => {
                tracing::debug!("Pending scans auth rejected (401)");
            }
            Err(e) => {
                tracing::debug!("Failed to poll pending security scans: {}", e);
            }
        }
    }

    async fn poll_pending_inventory_commands(&mut self) {
        if self.device_id.is_empty() {
            return;
        }

        match self
            .client
            .check_pending_inventory(&self.device_token, &self.device_id)
            .await
        {
            Ok(true) => {
                tracing::info!("[INVENTORY] Pending response received");
                tracing::info!("[INVENTORY] Command received: {}", &self.device_id);
                if let Err(e) = self.collect_and_send_inventory().await {
                    tracing::warn!("[INVENTORY] Command failed: {}", e);
                }
                let _ = self
                    .client
                    .clear_pending_inventory(&self.device_token, &self.device_id)
                    .await;
            }
            Ok(false) => {}
            Err(ClientError::Unauthorized) => {
                tracing::debug!("[INVENTORY] Pending check auth rejected (401)");
            }
            Err(e) => {
                tracing::debug!("[INVENTORY] Failed to check pending inventory: {}", e);
            }
        }
    }

    async fn poll_pending_discovery_commands(&self) {
        if self.device_id.is_empty() {
            return;
        }

        match self
            .client
            .get_pending_discovery_commands(&self.device_id)
            .await
        {
            Ok(commands) => {
                for cmd in &commands {
                    if let Some(scan_id) = cmd.get("id").and_then(|v| v.as_str()) {
                        tracing::info!(
                            "[DISCOVERY] Processing pending network discovery: {}",
                            scan_id
                        );

                        if let Err(e) = self
                            .client
                            .update_discovery_status(scan_id, "running")
                            .await
                        {
                            tracing::warn!(
                                "[DISCOVERY] Failed to update scan {} to running: {}",
                                scan_id,
                                e
                            );
                        }

                        let scan_id_owned = scan_id.to_string();
                        let discovery_timeout = std::time::Duration::from_secs(60);

                        match tokio::time::timeout(
                            discovery_timeout,
                            tokio::task::spawn_blocking(|| {
                                crate::network_discovery::discover_network()
                            }),
                        )
                        .await
                        {
                            Ok(Ok(result)) => {
                                tracing::info!(
                                    "[DISCOVERY] Scan {} completed: {} devices in {}ms",
                                    scan_id_owned,
                                    result.device_count,
                                    result.scan_duration_ms
                                );

                                match self
                                    .client
                                    .report_discovery_result(&scan_id_owned, &result)
                                    .await
                                {
                                    Ok(()) => {
                                        tracing::info!(
                                            "[DISCOVERY] Scan {} result reported successfully",
                                            scan_id_owned
                                        );
                                    }
                                    Err(e) => {
                                        tracing::warn!(
                                            "[DISCOVERY] Failed to report scan {}: {}",
                                            scan_id_owned,
                                            e
                                        );
                                        let _ = self
                                            .client
                                            .report_discovery_error_with_status(
                                                &scan_id_owned,
                                                &format!("Failed to POST result: {}", e),
                                            )
                                            .await;
                                    }
                                }
                            }
                            Ok(Err(e)) => {
                                let error_msg = format!("Discovery task panicked: {}", e);
                                tracing::error!("[DISCOVERY] {}", error_msg);
                                let _ = self
                                    .client
                                    .report_discovery_error_with_status(&scan_id_owned, &error_msg)
                                    .await;
                            }
                            Err(_timeout) => {
                                let error_msg = format!(
                                    "Discovery timed out after {}s",
                                    discovery_timeout.as_secs()
                                );
                                tracing::warn!("[DISCOVERY] Scan {}: {}", scan_id_owned, error_msg);
                                let _ = self
                                    .client
                                    .report_discovery_error_with_status(&scan_id_owned, &error_msg)
                                    .await;
                            }
                        }
                    }
                }
            }
            Err(ClientError::Unauthorized) => {
                tracing::debug!("Pending discovery auth rejected (401)");
            }
            Err(e) => {
                tracing::debug!("Failed to poll pending discovery commands: {}", e);
            }
        }
    }
}

use crate::collector::SystemMetrics;
use crate::inventory::InventoryReport;
use crate::security::SecurityFinding;
use serde::{Deserialize, Serialize};
use tokio_retry::strategy::ExponentialBackoff;
use tokio_retry::Retry;

#[derive(Debug, Clone, PartialEq)]
pub enum ClientError {
    Unauthorized,
    Network(String),
    Server(String),
    Other(String),
}

impl std::fmt::Display for ClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClientError::Unauthorized => write!(f, "Unauthorized"),
            ClientError::Network(e) => write!(f, "Network error: {}", e),
            ClientError::Server(e) => write!(f, "Server error: {}", e),
            ClientError::Other(e) => write!(f, "{}", e),
        }
    }
}

impl std::error::Error for ClientError {}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisterPublicPayload {
    name: String,
    hostname: String,
    os: String,
    os_version: String,
    cpu_model: String,
    cpu_cores: u32,
    cpu_logical: u32,
    ram_total: u64,
    disk_total: u64,
    is_laptop: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    agent_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    enrollment_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    identity_fingerprint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    identity_version: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    installation_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceRegistrationResponse {
    pub device: DeviceInfo,
    #[serde(rename = "deviceToken")]
    pub device_token: String,
}

#[derive(Debug, Deserialize)]
pub struct CredentialRecoveryResponse {
    pub device_token: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    #[serde(default)]
    pub hostname: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct MetricsPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    pub cpu: CpuMetricsPayload,
    pub memory: MemoryMetricsPayload,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk: Option<DiskMetricsPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperatures: Option<TemperaturesPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<NetworkMetricsPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub battery: Option<BatteryPayload>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processes: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub services: Option<Vec<ServiceCheckPayload>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CpuMetricsPayload {
    pub usage: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cores: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loadAverage1Min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loadAverage5Min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loadAverage15Min: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct MemoryMetricsPayload {
    pub total: f64,
    pub used: f64,
    pub percent: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiskMetricsPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub readBytes: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub writeBytes: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TemperaturesPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct NetworkMetricsPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rxBytes: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub txBytes: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct BatteryPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ServiceCheckPayload {
    pub name: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct SecurityReportPayload {
    pub device_token: String,
    pub findings: Vec<SecurityFinding>,
}

#[derive(Debug, Deserialize)]
pub struct SecurityReportResponse {
    pub scan_id: Option<String>,
    pub security_score: Option<i64>,
    pub risk_level: Option<String>,
    pub total_findings: Option<i64>,
}

pub struct ApiClient {
    client: reqwest::Client,
    api_url: String,
}

impl ApiClient {
    pub fn new(api_url: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
        Self { client, api_url }
    }

    pub async fn register_device_public(
        &self,
        hostname: &str,
        os: &str,
        os_version: &str,
        cpu_model: &str,
        cpu_cores: u32,
        cpu_logical: u32,
        ram_total: u64,
        disk_total: u64,
        enrollment_token: &str,
        identity_fingerprint: &str,
        identity_version: u32,
        installation_id: &str,
        agent_version: &str,
    ) -> anyhow::Result<DeviceRegistrationResponse> {
        let payload = RegisterPublicPayload {
            name: hostname.to_string(),
            hostname: hostname.to_string(),
            os: os.to_string(),
            os_version: os_version.to_string(),
            cpu_model: cpu_model.to_string(),
            cpu_cores,
            cpu_logical,
            ram_total,
            disk_total,
            is_laptop: false,
            agent_version: Some(agent_version.to_string()),
            enrollment_token: Some(enrollment_token.to_string()),
            identity_fingerprint: Some(identity_fingerprint.to_string()),
            identity_version: Some(identity_version),
            installation_id: Some(installation_id.to_string()),
        };

        let url = format!("{}/devices/register-public", self.api_url);
        tracing::debug!("Registering device at {}", url);

        let resp = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Registration request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Registration failed with HTTP {}: {}",
                status,
                body
            ));
        }

        let result: DeviceRegistrationResponse = resp
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse registration response: {}", e))?;

        Ok(result)
    }

    pub async fn recover_credential(
        &self,
        identity_fingerprint: &str,
        installation_id: &str,
        org_token: &str,
    ) -> anyhow::Result<String> {
        let payload = serde_json::json!({
            "identityFingerprint": identity_fingerprint,
            "installationId": installation_id,
        });

        let url = format!("{}/devices/recover-credential", self.api_url);
        tracing::debug!("Recovering credential at {}", url);

        let resp = self
            .client
            .post(&url)
            .header("X-Org-Token", org_token)
            .json(&payload)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Credential recovery request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Credential recovery failed with HTTP {}: {}",
                status,
                body
            ));
        }

        let result: CredentialRecoveryResponse = resp
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse credential recovery response: {}", e))?;

        Ok(result.device_token)
    }

    pub async fn send_metrics(
        &self,
        device_token: &str,
        metrics: &SystemMetrics,
    ) -> Result<(), ClientError> {
        let payload = self.build_metrics_payload(metrics);

        let url = format!("{}/devices/metrics", self.api_url);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", device_token))
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => Ok(()),
            401 => {
                tracing::debug!("Metrics rejected (401 Unauthorized) — token may be stale");
                Err(ClientError::Unauthorized)
            }
            429 => {
                tracing::warn!("Rate limited on metrics, waiting 60s");
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                Err(ClientError::Server("Rate limited".to_string()))
            }
            s if s >= 500 => {
                let _body = resp.text().await.unwrap_or_default();
                let retry_strategy = ExponentialBackoff::from_millis(500)
                    .factor(2)
                    .max_delay(std::time::Duration::from_secs(15));
                let api_url = self.api_url.clone();
                let client = self.client.clone();
                let token = device_token.to_string();
                let retry_action = || {
                    let url = format!("{}/devices/metrics", api_url);
                    let client = client.clone();
                    let token = token.clone();
                    let payload = payload.clone();
                    async move {
                        let r = client
                            .post(&url)
                            .header("Authorization", format!("Bearer {}", token))
                            .json(&payload)
                            .send()
                            .await
                            .map_err(|e| ClientError::Network(e.to_string()))?;
                        let s = r.status().as_u16();
                        if (200..=299).contains(&s) {
                            Ok(())
                        } else if s == 401 {
                            Err(ClientError::Unauthorized)
                        } else {
                            let body = r.text().await.unwrap_or_default();
                            Err(ClientError::Server(format!("HTTP {}: {}", s, body)))
                        }
                    }
                };
                Retry::start(retry_strategy, retry_action).await
            }
            s => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Other(format!("HTTP {}: {}", s, body)))
            }
        }
    }

    pub async fn send_security_report(
        &self,
        device_token: &str,
        findings: &[SecurityFinding],
    ) -> Result<(), ClientError> {
        let payload = serde_json::json!({
            "deviceToken": device_token,
            "findings": findings,
        });

        let url = format!("{}/devices/security-report", self.api_url);
        let resp = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                let body: serde_json::Value = resp.json().await.unwrap_or_default();
                tracing::info!(
                    "Security report sent: score={}, risk={}, findings={}",
                    body["securityScore"].as_i64().unwrap_or(-1),
                    body["riskLevel"].as_str().unwrap_or("unknown"),
                    body["totalFindings"].as_i64().unwrap_or(0),
                );
                Ok(())
            }
            401 => Err(ClientError::Unauthorized),
            s if s >= 500 => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Server(format!("HTTP {}: {}", s, body)))
            }
            s => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Other(format!("HTTP {}: {}", s, body)))
            }
        }
    }

    pub async fn send_inventory_report(
        &self,
        device_token: &str,
        org_id: &str,
        report: &InventoryReport,
    ) -> Result<(), ClientError> {
        let payload = serde_json::json!({
            "deviceToken": device_token,
            "drivers": report.drivers,
            "software": report.software,
        });

        let url = format!("{}/inventory/report", self.api_url);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", device_token))
            .header("X-Org-Id", org_id)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                tracing::info!(
                    "Inventory report sent: {} drivers, {} software",
                    report.driver_count,
                    report.software_count,
                );
                Ok(())
            }
            401 => Err(ClientError::Unauthorized),
            s if s >= 500 => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Server(format!("HTTP {}: {}", s, body)))
            }
            s => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Other(format!("HTTP {}: {}", s, body)))
            }
        }
    }

    pub async fn check_pending_remote_sessions(
        &self,
        device_token: &str,
        device_id: &str,
    ) -> Result<Vec<serde_json::Value>, ClientError> {
        let url = format!(
            "{}/remote-support/agent/pending?deviceId={}",
            self.api_url, device_id
        );
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", device_token))
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                let sessions: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
                Ok(sessions)
            }
            401 => Err(ClientError::Unauthorized),
            _ => Ok(Vec::new()),
        }
    }

    pub async fn get_pending_security_scans(
        &self,
        device_id: &str,
    ) -> Result<Vec<serde_json::Value>, ClientError> {
        let url = format!(
            "{}/security/pending/{}",
            self.api_url, device_id
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                let scans: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
                Ok(scans)
            }
            401 => Err(ClientError::Unauthorized),
            _ => Ok(Vec::new()),
        }
    }

    pub async fn complete_security_scan(
        &self,
        scan_id: &str,
        findings: &[SecurityFinding],
    ) -> Result<(), ClientError> {
        let payload = serde_json::json!({
            "scanId": scan_id,
            "findings": findings,
        });

        let url = format!("{}/security/scan-result", self.api_url);
        let resp = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                tracing::info!("Security scan {} completed and reported", scan_id);
                Ok(())
            }
            401 => Err(ClientError::Unauthorized),
            s if s >= 500 => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Server(format!("HTTP {}: {}", s, body)))
            }
            s => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Other(format!("HTTP {}: {}", s, body)))
            }
        }
    }

    pub async fn get_pending_discovery_commands(
        &self,
        device_id: &str,
    ) -> Result<Vec<serde_json::Value>, ClientError> {
        let url = format!(
            "{}/network/discovery/pending?deviceId={}",
            self.api_url, device_id
        );
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                let commands: Vec<serde_json::Value> = resp.json().await.unwrap_or_default();
                Ok(commands)
            }
            401 => Err(ClientError::Unauthorized),
            _ => Ok(Vec::new()),
        }
    }

    pub async fn report_discovery_result(
        &self,
        scan_id: &str,
        result: &crate::network_discovery::DiscoveryResult,
    ) -> Result<(), ClientError> {
        let payload = serde_json::json!({
            "scanId": scan_id,
            "gateway_ip": result.gateway_ip,
            "gateway_mac": result.gateway_mac,
            "local_ip": result.local_ip,
            "local_mac": result.local_mac,
            "subnet": result.subnet,
            "scan_duration_ms": result.scan_duration_ms,
            "device_count": result.device_count,
            "devices": result.devices,
        });

        let url = format!("{}/network/discovery/result", self.api_url);
        let resp = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                tracing::info!("Network discovery {} completed: {} devices", scan_id, result.device_count);
                Ok(())
            }
            401 => Err(ClientError::Unauthorized),
            s if s >= 500 => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Server(format!("HTTP {}: {}", s, body)))
            }
            s => {
                let body = resp.text().await.unwrap_or_default();
                Err(ClientError::Other(format!("HTTP {}: {}", s, body)))
            }
        }
    }

    pub async fn update_discovery_status(
        &self,
        scan_id: &str,
        status: &str,
    ) -> Result<(), ClientError> {
        let payload = serde_json::json!({
            "scanId": scan_id,
            "status": status,
        });

        let url = format!("{}/network/discovery/status", self.api_url);
        let resp = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let s = resp.status().as_u16();
        match s {
            200..=299 => Ok(()),
            401 => Err(ClientError::Unauthorized),
            _ => {
                let _body = resp.text().await.unwrap_or_default();
                Ok(())
            }
        }
    }

    pub async fn report_discovery_error_with_status(
        &self,
        scan_id: &str,
        error: &str,
    ) -> Result<(), ClientError> {
        let now = chrono::Utc::now().to_rfc3339();
        let payload = serde_json::json!({
            "scanId": scan_id,
            "error": error,
            "status": "failed",
            "completedAt": now,
        });

        let url = format!("{}/network/discovery/result", self.api_url);
        let resp = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let s = resp.status().as_u16();
        match s {
            200..=299 => Ok(()),
            _ => Ok(()),
        }
    }

    pub async fn report_discovery_error(
        &self,
        scan_id: &str,
        error: &str,
    ) -> Result<(), ClientError> {
        self.report_discovery_error_with_status(scan_id, error)
            .await
    }

    pub async fn check_pending_inventory(
        &self,
        device_token: &str,
        device_id: &str,
    ) -> Result<bool, ClientError> {
        let url = format!(
            "{}/inventory/pending/{}",
            self.api_url, device_id
        );
        let resp = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", device_token))
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => {
                let body: serde_json::Value = resp.json().await.unwrap_or_default();
                Ok(body.get("pending").and_then(|v| v.as_bool()).unwrap_or(false))
            }
            401 => Err(ClientError::Unauthorized),
            _ => Ok(false),
        }
    }

    pub async fn clear_pending_inventory(
        &self,
        device_token: &str,
        device_id: &str,
    ) -> Result<(), ClientError> {
        let url = format!(
            "{}/inventory/pending/{}/clear",
            self.api_url, device_id
        );
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", device_token))
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        let status = resp.status();
        match status.as_u16() {
            200..=299 => Ok(()),
            401 => Err(ClientError::Unauthorized),
            _ => Ok(()),
        }
    }

    pub async fn send_remote_consent(
        &self,
        device_token: &str,
        session_id: &str,
        device_id: &str,
        granted: bool,
    ) -> Result<(), ClientError> {
        let payload = serde_json::json!({
            "sessionId": session_id,
            "deviceId": device_id,
            "granted": granted,
            "method": "agent_prompt",
        });

        let url = format!("{}/remote-support/consent", self.api_url);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", device_token))
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(ClientError::Other(format!(
                "Consent failed: HTTP {}",
                resp.status()
            )))
        }
    }

    pub async fn send_remote_status(
        &self,
        device_token: &str,
        session_id: &str,
        device_id: &str,
        status: &str,
    ) -> Result<(), ClientError> {
        let payload = serde_json::json!({
            "sessionId": session_id,
            "status": status,
            "deviceId": device_id,
        });

        let url = format!("{}/remote-support/agent/status", self.api_url);
        let resp = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", device_token))
            .json(&payload)
            .send()
            .await
            .map_err(|e| ClientError::Network(e.to_string()))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(ClientError::Other(format!(
                "Status update failed: HTTP {}",
                resp.status()
            )))
        }
    }

    pub async fn ping(&self) -> anyhow::Result<()> {
        let url = format!("{}/health", self.api_url);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Health check failed: {}", e))?;

        if resp.status().is_success() {
            Ok(())
        } else {
            Err(anyhow::anyhow!(
                "Health check returned HTTP {}",
                resp.status()
            ))
        }
    }

    fn build_metrics_payload(&self, metrics: &SystemMetrics) -> MetricsPayload {
        MetricsPayload {
            timestamp: Some(metrics.timestamp.clone()),
            cpu: CpuMetricsPayload {
                usage: metrics.cpu_usage_percent,
                cores: Some(metrics.cpu_logical),
                model: Some(metrics.cpu_model.clone()),
                loadAverage1Min: None,
                loadAverage5Min: None,
                loadAverage15Min: None,
            },
            memory: MemoryMetricsPayload {
                total: metrics.ram_total_bytes as f64,
                used: metrics.ram_used_bytes as f64,
                percent: metrics.ram_usage_percent,
            },
            disk: Some(DiskMetricsPayload {
                total: Some(metrics.disk_total_bytes as f64),
                used: Some(metrics.disk_used_bytes as f64),
                readBytes: None,
                writeBytes: None,
            }),
            temperatures: Some(TemperaturesPayload {
                cpu: metrics.temperature_celsius,
            }),
            network: Some(NetworkMetricsPayload {
                rxBytes: Some(metrics.network_rx_bytes as f64),
                txBytes: Some(metrics.network_tx_bytes as f64),
            }),
            battery: if metrics.battery_percent.is_some() {
                Some(BatteryPayload {
                    percent: metrics.battery_percent,
                    status: metrics
                        .battery_charging
                        .map(|c| if c { "Charging" } else { "Discharging" })
                        .map(|s| s.to_string()),
                })
            } else {
                None
            },
            processes: Some(metrics.process_count),
            uptime: Some(metrics.uptime_seconds),
            services: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_payload_serializes_cpu_model_camel_case() {
        let payload = RegisterPublicPayload {
            name: "test-host".to_string(),
            hostname: "test-host".to_string(),
            os: "Linux".to_string(),
            os_version: "22.04".to_string(),
            cpu_model: "Intel Core i7-12700K".to_string(),
            cpu_cores: 8,
            cpu_logical: 16,
            ram_total: 17179869184,
            disk_total: 512000000000,
            is_laptop: false,
            agent_version: Some("1.0.0".to_string()),
            enrollment_token: Some("tfenr_test".to_string()),
            identity_fingerprint: None,
            identity_version: None,
            installation_id: None,
        };

        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["cpuModel"], "Intel Core i7-12700K");
        assert_eq!(json["cpuCores"], 8);
        assert_eq!(json["cpuLogical"], 16);
        assert!(json.get("cpu_model").is_none(), "Should not have snake_case cpu_model");
    }

    #[test]
    fn test_register_payload_empty_cpu_model() {
        let payload = RegisterPublicPayload {
            name: "test-host".to_string(),
            hostname: "test-host".to_string(),
            os: "Linux".to_string(),
            os_version: "22.04".to_string(),
            cpu_model: String::new(),
            cpu_cores: 1,
            cpu_logical: 2,
            ram_total: 4294967296,
            disk_total: 256000000000,
            is_laptop: false,
            agent_version: None,
            enrollment_token: None,
            identity_fingerprint: None,
            identity_version: None,
            installation_id: None,
        };

        let json = serde_json::to_value(&payload).unwrap();
        assert_eq!(json["cpuModel"], "");
    }

    #[test]
    fn test_metrics_payload_includes_cpu_model() {
        let metrics = SystemMetrics {
            hostname: "test".to_string(),
            os: "Linux".to_string(),
            os_version: "22.04".to_string(),
            cpu_usage_percent: 50.0,
            cpu_cores: 8,
            cpu_logical: 16,
            cpu_model: "AMD Ryzen 9".to_string(),
            ram_used_bytes: 4000000000,
            ram_total_bytes: 16000000000,
            ram_usage_percent: 25.0,
            disk_used_bytes: 100000000000,
            disk_total_bytes: 500000000000,
            disk_usage_percent: 20.0,
            network_rx_bytes: 1000000,
            network_tx_bytes: 500000,
            uptime_seconds: 86400,
            process_count: 200,
            temperature_celsius: None,
            battery_percent: None,
            battery_charging: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };

        let client = ApiClient::new("http://localhost:3001".to_string());
        let payload = client.build_metrics_payload(&metrics);
        assert_eq!(payload.cpu.model, Some("AMD Ryzen 9".to_string()));
    }
}

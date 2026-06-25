use crate::client::ApiClient;
use crate::collector::MetricsCollector;
use crate::config::AgentConfig;
use tokio::signal;
use tokio::time::{interval, Duration};

pub struct Agent {
    config: AgentConfig,
    client: ApiClient,
    collector: MetricsCollector,
    device_token: String,
}

impl Agent {
    pub async fn new(config: AgentConfig) -> anyhow::Result<Self> {
        let device_token = crate::registration::ensure_registered(&config).await?;
        let client = ApiClient::new(config.api_url.clone());
        let collector = MetricsCollector::new();

        Ok(Self {
            config,
            client,
            collector,
            device_token,
        })
    }

    pub async fn run(&mut self) -> anyhow::Result<()> {
        let mut ticker = interval(Duration::from_secs(self.config.interval_secs));
        ticker.tick().await;

        loop {
            tokio::select! {
                _ = ticker.tick() => {
                    if let Err(e) = self.collect_and_send().await {
                        tracing::warn!("Metrics cycle error: {}", e);
                    }
                }
                _ = Self::shutdown_signal() => {
                    tracing::info!("Agent shutting down gracefully...");
                    return Ok(());
                }
            }
        }
    }

    async fn collect_and_send(&mut self) -> anyhow::Result<()> {
        let metrics = self.collector.collect();

        match self
            .client
            .send_metrics(&self.device_token, &metrics)
            .await
        {
            Ok(()) => {
                let temp_str = metrics
                    .temperature_celsius
                    .map(|t| format!(" | Temp: {:.1}°C", t))
                    .unwrap_or_default();
                tracing::info!(
                    "✓ Metrics sent | CPU: {:.1}% | RAM: {:.1}%{}",
                    metrics.cpu_usage_percent,
                    metrics.ram_usage_percent,
                    temp_str,
                );
                Ok(())
            }
            Err(e) => {
                tracing::warn!("Failed to send metrics: {}", e);
                if e.to_string().contains("Unauthorized") {
                    tracing::warn!("Device token rejected — will retry on next cycle");
                }
                Err(e)
            }
        }
    }

    async fn shutdown_signal() {
        let ctrl_c = async {
            signal::ctrl_c()
                .await
                .expect("Failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            signal::unix::signal(signal::unix::SignalKind::terminate())
                .expect("Failed to install SIGTERM handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
    }
}

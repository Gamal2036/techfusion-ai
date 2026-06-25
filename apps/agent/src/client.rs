use crate::collector::SystemMetrics;
use serde::{Deserialize, Serialize};
use tokio_retry::Retry;
use tokio_retry::strategy::ExponentialBackoff;

#[derive(Debug, Serialize)]
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
}

#[derive(Debug, Deserialize)]
pub struct DeviceRegistrationResponse {
    pub device: DeviceInfo,
    #[serde(rename = "deviceToken")]
    pub device_token: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    #[serde(default)]
    pub hostname: Option<String>,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
pub struct CpuMetricsPayload {
    pub usage: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cores: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loadAverage1Min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loadAverage5Min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loadAverage15Min: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct MemoryMetricsPayload {
    pub total: f64,
    pub used: f64,
    pub percent: f64,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
pub struct TemperaturesPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct NetworkMetricsPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rxBytes: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub txBytes: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct BatteryPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ServiceCheckPayload {
    pub name: String,
    pub status: String,
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
            agent_version: Some("1.0.0".to_string()),
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

    pub async fn send_metrics(
        &self,
        device_token: &str,
        metrics: &SystemMetrics,
    ) -> anyhow::Result<()> {
        let payload = self.build_metrics_payload(metrics);

        let retry_strategy = ExponentialBackoff::from_millis(10)
            .factor(3)
            .max_delay(std::time::Duration::from_secs(30));

        let action = || async {
            let url = format!("{}/devices/metrics", self.api_url);
            let resp = self
                .client
                .post(&url)
                .header("Authorization", format!("Bearer {}", device_token))
                .json(&payload)
                .send()
                .await?;

            let status = resp.status();
            match status.as_u16() {
                200..=299 => Ok(()),
                401 => {
                    tracing::warn!("Device token rejected — re-registration needed");
                    Err(anyhow::anyhow!("Unauthorized: device token rejected"))
                }
                429 => {
                    tracing::warn!("Rate limited, waiting 60s before retry");
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                    Err(anyhow::anyhow!("Rate limited"))
                }
                s if s >= 500 => {
                    let body = resp.text().await.unwrap_or_default();
                    Err(anyhow::anyhow!("Server error HTTP {}: {}", s, body))
                }
                s => {
                    let body = resp.text().await.unwrap_or_default();
                    Err(anyhow::anyhow!("Unexpected HTTP {}: {}", s, body))
                }
            }
        };

        Retry::start(retry_strategy, action).await
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
                cores: Some(metrics.cpu_cores),
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

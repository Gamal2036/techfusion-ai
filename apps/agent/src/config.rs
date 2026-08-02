use clap::Parser;
use std::env;

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub api_url: String,
    pub device_token: String,
    pub device_id: Option<String>,
    pub org_token: Option<String>,
    pub interval_secs: u64,
    pub security_interval_secs: u64,
    pub inventory_interval_secs: u64,
    pub network_discovery_enabled: bool,
    pub remote_polling_interval_secs: u64,
    pub hostname: String,
    pub agent_version: String,
}

#[derive(Parser, Debug, Clone)]
#[command(name = "agent", version = env!("CARGO_PKG_VERSION"), about = "TechFusion AI Device Agent — monitors and reports system telemetry")]
struct CliArgs {
    #[arg(long, env = "TF_API_URL")]
    api_url: Option<String>,

    #[arg(long, env = "TF_DEVICE_TOKEN")]
    device_token: Option<String>,

    #[arg(long, env = "TF_ORG_TOKEN")]
    org_token: Option<String>,

    #[arg(long, env = "TF_DEVICE_ID")]
    device_id: Option<String>,

    #[arg(long, env = "TF_INTERVAL", default_value = "30")]
    interval_secs: u64,

    #[arg(long, env = "TF_SECURITY_INTERVAL", default_value = "3600")]
    security_interval_secs: u64,

    #[arg(long, env = "TF_INVENTORY_INTERVAL", default_value = "7200")]
    inventory_interval_secs: u64,

    #[arg(long, env = "TF_NETWORK_DISCOVERY", default_value = "false")]
    network_discovery_enabled: bool,

    #[arg(long, env = "TF_REMOTE_POLLING_INTERVAL", default_value = "15")]
    remote_polling_interval_secs: u64,
}

impl AgentConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        let args = CliArgs::parse();

        let api_url = args
            .api_url
            .or_else(|| env::var("TF_API_URL").ok())
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "TF_API_URL must be set.\n\n\
                     Quick start:\n\
                     \texport TF_API_URL=http://localhost:3001\n\
                     \texport TF_ORG_TOKEN=tfenr_<your-token>\n\
                     \tcargo run\n\n\
                     Get your enrollment token from the Dashboard → Enrollment page."
                )
            })?;

        if api_url.starts_with("http://") && !api_url.contains("localhost") && !api_url.contains("127.0.0.1") {
            tracing::warn!(
                "API URL uses insecure HTTP: {}. Use HTTPS in production.",
                api_url
            );
        }

        let device_token = args
            .device_token
            .or_else(|| env::var("TF_DEVICE_TOKEN").ok())
            .unwrap_or_default();

        let org_token = args
            .org_token
            .or_else(|| env::var("TF_ORG_TOKEN").ok())
            .filter(|s| !s.is_empty());

        let device_id = args
            .device_id
            .or_else(|| env::var("TF_DEVICE_ID").ok())
            .filter(|s| !s.is_empty());



        let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".to_string());
        let agent_version = env!("CARGO_PKG_VERSION").to_string();

        Ok(Self {
            api_url,
            device_token,
            device_id,
            org_token,
            interval_secs: args.interval_secs,
            security_interval_secs: args.security_interval_secs,
            inventory_interval_secs: args.inventory_interval_secs,
            network_discovery_enabled: args.network_discovery_enabled,
            remote_polling_interval_secs: args.remote_polling_interval_secs,
            hostname,
            agent_version,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_debug() {
        let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".to_string());
        assert!(!hostname.is_empty());
    }
}

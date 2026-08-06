use clap::Parser;
use std::env;
use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub api_url: String,
    pub device_token: String,
    pub device_id: Option<String>,
    pub org_token: Option<String>,
    pub state_dir: PathBuf,
    pub enroll: bool,
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

    /// One-shot enrollment: register with the enrollment token and exit.
    #[arg(long, env = "TF_ENROLL")]
    enroll: bool,

    /// Directory for persistent device state (token/device_id/installation_id).
    #[arg(long, env = "TF_STATE_DIR")]
    state_dir: Option<PathBuf>,

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

pub fn default_state_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    home.join(".techfusion")
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
                     \texport TF_API_URL=https://<your-host>\n\
                     \texport TF_ORG_TOKEN=tfenr_<your-token>\n\
                     \t/usr/local/bin/techfusion-agent --enroll\n\n\
                     Or install with the TechFusion Linux installer:\n\
                     \tcurl -fsSL https://<your-dashboard>/install-linux.sh -o /tmp/tf-install.sh\n\
                     \tsudo bash /tmp/tf-install.sh --api <TF_API_URL> --enroll-token tfenr_<your-token>\n\n\
                     Get your enrollment token from the Dashboard → Connect Device."
                )
            })?;

        if api_url.starts_with("http://")
            && !api_url.contains("localhost")
            && !api_url.contains("127.0.0.1")
        {
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

        let state_dir = args
            .state_dir
            .or_else(|| env::var("TF_STATE_DIR").ok().map(PathBuf::from))
            .unwrap_or_else(default_state_dir);

        let enroll = args.enroll;
        if enroll && org_token.is_none() {
            return Err(anyhow::anyhow!(
                "Enrollment mode requires an enrollment token.\n\
                 Provide it with TF_ORG_TOKEN (env) or --org-token <token>."
            ));
        }

        let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".to_string());
        let agent_version = env!("CARGO_PKG_VERSION").to_string();

        Ok(Self {
            api_url,
            device_token,
            device_id,
            org_token,
            state_dir,
            enroll,
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

    #[test]
    fn test_default_state_dir_uses_techfusion() {
        let dir = default_state_dir();
        assert_eq!(
            dir.file_name().and_then(|n| n.to_str()),
            Some(".techfusion")
        );
    }
}

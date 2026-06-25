use clap::Parser;
use std::env;

#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub api_url: String,
    pub device_token: String,
    pub org_token: Option<String>,
    pub interval_secs: u64,
    pub hostname: String,
}

#[derive(Parser, Debug, Clone)]
#[command(name = "agent", version = "1.0.0")]
struct CliArgs {
    #[arg(long, env = "TF_API_URL")]
    api_url: Option<String>,

    #[arg(long, env = "TF_DEVICE_TOKEN")]
    device_token: Option<String>,

    #[arg(long, env = "TF_ORG_TOKEN")]
    org_token: Option<String>,

    #[arg(long, env = "TF_INTERVAL", default_value = "30")]
    interval_secs: u64,
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
                    "TF_API_URL must be set (e.g. http://localhost:3001 or https://api.techfusion.ai)"
                )
            })?;

        let device_token = args
            .device_token
            .or_else(|| env::var("TF_DEVICE_TOKEN").ok())
            .unwrap_or_default();

        let org_token = args
            .org_token
            .or_else(|| env::var("TF_ORG_TOKEN").ok())
            .filter(|s| !s.is_empty());

        if device_token.is_empty() && org_token.is_none() {
            return Err(anyhow::anyhow!(
                "Either TF_DEVICE_TOKEN (existing device) or TF_ORG_TOKEN (JWT for first-time registration) must be set"
            ));
        }

        let hostname = sysinfo::System::host_name()
            .unwrap_or_else(|| "unknown".to_string());

        Ok(Self {
            api_url,
            device_token,
            org_token,
            interval_secs: args.interval_secs,
            hostname,
        })
    }
}

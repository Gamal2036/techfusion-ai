mod agent;
mod client;
mod collector;
mod config;
mod registration;

use agent::Agent;
use config::AgentConfig;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let config = AgentConfig::from_env()?;

    tracing::info!("Pinging API at {}...", config.api_url);
    {
        let ping_client = crate::client::ApiClient::new(config.api_url.clone());
        if let Err(e) = ping_client.ping().await {
            eprintln!(
                "ERROR: Cannot reach API at {}: {}",
                config.api_url, e
            );
            std::process::exit(1);
        }
    }
    tracing::info!("API is reachable");

    let mut agent = Agent::new(config.clone()).await?;

    let token_preview = if config.device_token.len() > 12 {
        format!("{}...", &config.device_token[..12])
    } else {
        config.device_token.clone()
    };

    println!("TechFusion AI Agent v{}", env!("CARGO_PKG_VERSION"));
    println!("Connected to: {}", config.api_url);
    println!("Device: {}", config.hostname);
    println!("Token: {}", token_preview);
    println!("Sending metrics every {}s", config.interval_secs);

    agent.run().await
}

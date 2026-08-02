mod agent;
mod client;
mod collector;
mod config;
mod identity;
mod inventory;
mod network_discovery;
mod registration;
mod remote;
mod security;

use agent::Agent;
use config::AgentConfig;
use registration::RegistrationSource;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let config = AgentConfig::from_env()?;

    println!();
    println!("  TechFusion AI Agent v{}", config.agent_version);
    println!("  ─────────────────────────────────────────");
    println!("  API URL:     {}", config.api_url);
    println!("  Hostname:    {}", config.hostname);
    println!("  Interval:    {}s telemetry", config.interval_secs);
    println!("  Security:    {}s scan", config.security_interval_secs);
    println!("  Inventory:   {}s sync", config.inventory_interval_secs);
    if config.network_discovery_enabled {
        println!("  Network:     ENABLED");
    }
    println!();

    tracing::info!("Pinging API at {}...", config.api_url);
    {
        let ping_client = crate::client::ApiClient::new(config.api_url.clone());
        if let Err(e) = ping_client.ping().await {
            eprintln!("ERROR: Cannot reach API at {}: {}", config.api_url, e);
            eprintln!();
            eprintln!("  Make sure the API gateway is running:");
            eprintln!("    cd apps/api-gateway && pnpm dev");
            eprintln!();
            std::process::exit(1);
        }
    }
    tracing::info!("API is reachable");

    let mut agent = Agent::new(config.clone()).await?;

    match agent.registration_source() {
        RegistrationSource::Environment => {
            println!("  Device authenticated from environment token");
        }
        RegistrationSource::Disk => {
            println!("  Device restored from saved token (use TF_ORG_TOKEN to re-register)");
        }
        RegistrationSource::FreshRegistration => {
            println!("  Device registered and authenticated successfully");
        }
    }
    println!("  Starting telemetry collection...");
    println!();

    agent.run().await
}

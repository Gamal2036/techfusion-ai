mod agent;
mod client;
mod collector;
mod config;
mod identity;
mod inventory;
mod network_discovery;
mod registration;
mod remote;
mod reset;
mod security;

use agent::Agent;
use config::{AgentCommand, AgentConfig};
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

    if let Some(command) = &config.command {
        match command {
            AgentCommand::ResetIdentity { yes, .. } => {
                return reset::run_reset(&config, *yes).await
            }
            AgentCommand::IdentityStatus { .. } => return reset::run_status(&config).await,
        }
    }

    if config.enroll {
        return enroll_once(&config).await;
    }

    println!();
    println!("  TechFusion AI Agent v{}", config.agent_version);
    println!("  ─────────────────────────────────────────");
    println!("  API URL:     {}", config.api_url);
    println!("  Hostname:    {}", config.hostname);
    println!("  State dir:   {}", config.state_dir.display());
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
            eprintln!("  Make sure the API gateway is reachable, then restart the service:");
            eprintln!("    sudo systemctl restart techfusion-agent");
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
            println!("  Device restored from saved identity (no enrollment token required)");
        }
        RegistrationSource::FreshRegistration => {
            println!("  Device registered and authenticated successfully");
        }
    }
    println!("  Starting telemetry collection...");
    println!();

    agent.run().await
}

/// One-shot enrollment used by the Linux installer. Registers the device,
/// persists the long-term device credential, prints the result, and exits.
/// The enrollment token is consumed by the API and never persisted locally.
async fn enroll_once(config: &AgentConfig) -> anyhow::Result<()> {
    println!();
    println!(
        "  TechFusion AI Agent v{} — one-shot enrollment",
        config.agent_version
    );
    println!("  ─────────────────────────────────────────");
    println!("  API URL:     {}", config.api_url);
    println!("  Hostname:    {}", config.hostname);
    println!("  State dir:   {}", config.state_dir.display());
    println!();

    tracing::info!("Enrollment mode enabled — performing one-shot registration");

    let client = crate::client::ApiClient::new(config.api_url.clone());
    match registration::enroll_and_exit(config, &client).await {
        Ok((_device_token, device_id)) => {
            println!();
            println!("  ✔ Device enrolled successfully");
            println!("    Device ID: {}", device_id);
            println!("    State:     {}", config.state_dir.display());
            println!();
            println!("  The long-term device credential is now stored. Start the service with:");
            println!("    sudo systemctl start techfusion-agent");
            println!();
            Ok(())
        }
        Err(e) => {
            eprintln!();
            eprintln!("ERROR: Enrollment failed: {}", e);
            eprintln!();
            eprintln!("  Possible causes:");
            eprintln!("    - Invalid, expired, or already-used enrollment token");
            eprintln!("    - API unreachable");
            eprintln!("    - Device limit reached for the organization");
            eprintln!();
            eprintln!("  Generate a fresh token from Dashboard → Connect Device and retry.");
            eprintln!();
            Err(anyhow::anyhow!("Enrollment failed: {}", e))
        }
    }
}

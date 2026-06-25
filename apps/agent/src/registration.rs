use crate::client::ApiClient;
use crate::config::AgentConfig;
use std::fs;
use std::path::PathBuf;

const TOKEN_DIR: &str = ".techfusion";
const TOKEN_FILE: &str = "device_token";

fn token_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    home.join(TOKEN_DIR).join(TOKEN_FILE)
}

async fn first_time_register(
    config: &AgentConfig,
    client: &ApiClient,
) -> anyhow::Result<String> {
    config
        .org_token
        .as_ref()
        .ok_or_else(|| {
            anyhow::anyhow!(
                "No device token found and TF_ORG_TOKEN not set. Provide TF_ORG_TOKEN (JWT) for first-time registration."
            )
        })?;

    let sys = sysinfo::System::new_all();
    let cpu_cores = sys.cpus().len() as u32;
    let cpu_model = sys
        .global_cpu_info()
        .brand()
        .to_string();
    let ram_total = sys.total_memory();
    let os = sysinfo::System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = sysinfo::System::os_version()
        .or_else(|| sysinfo::System::kernel_version())
        .unwrap_or_else(|| "Unknown".to_string());

    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk_total: u64 = disks.iter().map(|d| d.total_space()).sum();

    let response = client
        .register_device_public(
            &config.hostname,
            &os,
            &os_version,
            &cpu_model,
            cpu_cores,
            cpu_cores,
            ram_total,
            disk_total,
        )
        .await?;

    tracing::info!("Device registered: {} ({})", response.device.id, config.hostname);

    save_token(&response.device_token)?;

    Ok(response.device_token)
}

fn save_token(token: &str) -> anyhow::Result<()> {
    let path = token_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| anyhow::anyhow!("Failed to create token directory {}: {}", parent.display(), e))?;
    }
    fs::write(&path, token)
        .map_err(|e| anyhow::anyhow!("Failed to write token file {}: {}", path.display(), e))?;
    tracing::info!("Device token saved to {}", path.display());
    Ok(())
}

fn load_token() -> Option<String> {
    let path = token_path();
    if path.exists() {
        fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
    } else {
        None
    }
}

pub async fn ensure_registered(config: &AgentConfig) -> anyhow::Result<String> {
    if !config.device_token.is_empty() {
        return Ok(config.device_token.clone());
    }

    if let Some(token) = load_token() {
        tracing::info!("Loaded existing device token");
        return Ok(token);
    }

    let client = ApiClient::new(config.api_url.clone());
    let token = first_time_register(config, &client).await?;
    Ok(token)
}

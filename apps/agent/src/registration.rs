use crate::client::ApiClient;
use crate::config::AgentConfig;
use crate::identity;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

const TOKEN_DIR: &str = ".techfusion";
const TOKEN_FILE: &str = "device_token";
const DEVICE_ID_FILE: &str = "device_id";
const MAX_REREGISTER_ATTEMPTS: u32 = 3;
const BASE_BACKOFF_SECS: u64 = 5;

fn token_dir() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
    home.join(TOKEN_DIR)
}

fn token_path() -> PathBuf {
    token_dir().join(TOKEN_FILE)
}

fn device_id_path() -> PathBuf {
    token_dir().join(DEVICE_ID_FILE)
}

fn ensure_token_dir() -> anyhow::Result<()> {
    let dir = token_dir();
    fs::create_dir_all(&dir).map_err(|e| {
        anyhow::anyhow!(
            "Failed to create token directory {}: {}",
            dir.display(),
            e
        )
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&dir, fs::Permissions::from_mode(0o700));
    }
    Ok(())
}

async fn first_time_register(
    config: &AgentConfig,
    client: &ApiClient,
) -> anyhow::Result<(String, String)> {
    let org_token = config
        .org_token
        .as_ref()
        .ok_or_else(|| {
            anyhow::anyhow!(
                "No device token found and TF_ORG_TOKEN not set.\n\n\
                 Provide TF_ORG_TOKEN (enrollment token) for first-time registration:\n\
                 \texport TF_ORG_TOKEN=tfenr_<your-token>\n\n\
                 Get your token from the Dashboard → Enrollment page."
            )
        })?;

    tracing::info!("First-time registration with enrollment token...");

    let mut sys = sysinfo::System::new_all();
    sys.refresh_cpu_specifics(sysinfo::CpuRefreshKind::everything());
    let cpu_logical = sys.cpus().len() as u32;
    let cpu_model = crate::collector::cpu_model_name();
    let cpu_cores = crate::collector::detect_physical_cores().unwrap_or(cpu_logical);
    let ram_total = sys.total_memory();
    let os = sysinfo::System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = sysinfo::System::os_version()
        .or_else(|| sysinfo::System::kernel_version())
        .unwrap_or_else(|| "Unknown".to_string());

    let disks = sysinfo::Disks::new_with_refreshed_list();
    let disk_total: u64 = disks.iter().map(|d| d.total_space()).sum();

    let installation_id = identity::get_or_create_installation_id();
    let identity_fingerprint = identity::compute_identity_fingerprint(&installation_id);

    tracing::info!("Identity fingerprint: sha256:{}", &identity_fingerprint[7..23]);
    tracing::info!("Registering device: {} ({} {})", config.hostname, os, os_version);
    tracing::info!("CPU: {} ({} cores) | RAM: {} MB | Disk: {} GB",
        cpu_model, cpu_cores,
        ram_total / 1024 / 1024,
        disk_total / 1024 / 1024 / 1024,
    );

    let response = client
        .register_device_public(
            &config.hostname,
            &os,
            &os_version,
            &cpu_model,
            cpu_cores,
            cpu_logical,
            ram_total,
            disk_total,
            org_token,
            &identity_fingerprint,
            identity::identity_version(),
            &installation_id,
            &config.agent_version,
        )
        .await?;

    tracing::info!(
        "Device registered successfully: {} ({})",
        response.device.id,
        config.hostname
    );

    save_token(&response.device_token)?;
    save_device_id(&response.device.id)?;

    tracing::info!("Device token saved locally for future use");

    Ok((response.device_token, response.device.id))
}

fn save_token(token: &str) -> anyhow::Result<()> {
    ensure_token_dir()?;
    let path = token_path();
    let tmp_path = path.with_extension("tmp");

    fs::write(&tmp_path, token)
        .map_err(|e| anyhow::anyhow!("Failed to write temp token file {}: {}", tmp_path.display(), e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| anyhow::anyhow!("Failed to set token file permissions: {}", e))?;
    }

    fs::rename(&tmp_path, &path)
        .map_err(|e| anyhow::anyhow!("Failed to atomically rename token file {}: {}", path.display(), e))?;

    Ok(())
}

fn save_device_id(id: &str) -> anyhow::Result<()> {
    ensure_token_dir()?;
    let path = device_id_path();
    let tmp_path = path.with_extension("tmp");

    fs::write(&tmp_path, id)
        .map_err(|e| anyhow::anyhow!("Failed to write temp device_id file {}: {}", tmp_path.display(), e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| anyhow::anyhow!("Failed to set device_id file permissions: {}", e))?;
    }

    fs::rename(&tmp_path, &path)
        .map_err(|e| anyhow::anyhow!("Failed to atomically rename device_id file {}: {}", path.display(), e))?;

    Ok(())
}

fn load_token() -> Option<String> {
    let path = token_path();
    if !path.exists() {
        return None;
    }

    let content = fs::read_to_string(&path).ok()?;
    let trimmed = content.trim().to_string();

    if trimmed.is_empty() {
        tracing::warn!("Token file is empty, treating as missing");
        return None;
    }

    if trimmed.len() < 16 {
        tracing::warn!("Token file appears malformed (too short), treating as missing");
        return None;
    }

    Some(trimmed)
}

fn load_device_id() -> Option<String> {
    let path = device_id_path();
    if !path.exists() {
        return None;
    }

    let content = fs::read_to_string(&path).ok()?;
    let trimmed = content.trim().to_string();

    if trimmed.is_empty() {
        return None;
    }

    Some(trimmed)
}

pub enum RegistrationSource {
    Environment,
    Disk,
    FreshRegistration,
}

pub async fn ensure_registered(config: &AgentConfig) -> anyhow::Result<(String, String, RegistrationSource)> {
    if !config.device_token.is_empty() {
        let device_id = config
            .device_id
            .clone()
            .or_else(load_device_id)
            .unwrap_or_default();
        tracing::info!("Using device token from environment variable");
        return Ok((config.device_token.clone(), device_id, RegistrationSource::Environment));
    }

    if config.org_token.is_some() {
        tracing::info!(
            "TF_ORG_TOKEN provided — performing fresh registration (ignoring any stale disk token)"
        );
        let client = ApiClient::new(config.api_url.clone());
        let (token, device_id) = first_time_register(config, &client).await?;
        return Ok((token, device_id, RegistrationSource::FreshRegistration));
    }

    if let Some(token) = load_token() {
        let device_id = load_device_id().unwrap_or_default();
        tracing::info!("Loaded existing device token from disk");
        return Ok((token, device_id, RegistrationSource::Disk));
    }

    Err(anyhow::anyhow!(
        "No credentials found.\n\n\
         For first-time registration:\n\
         \texport TF_ORG_TOKEN=tfenr_<your-enrollment-token>\n\n\
         For existing devices:\n\
         \texport TF_DEVICE_TOKEN=<your-device-token>\n\n\
         Get your enrollment token from the Dashboard → Enrollment page."
    ))
}

pub async fn attempt_reregister(
    config: &AgentConfig,
    client: &ApiClient,
) -> anyhow::Result<(String, String)> {
    tracing::info!("Beginning re-registration with bounded retries");

    let mut last_err = None;

    for attempt in 1..=MAX_REREGISTER_ATTEMPTS {
        let base_delay = BASE_BACKOFF_SECS * 2u64.pow(attempt - 1);
        let jitter = (attempt as u64 * 7) % 3;
        let delay = base_delay + jitter;

        tracing::warn!(
            "Re-registration attempt {}/{} (delay {}s)",
            attempt,
            MAX_REREGISTER_ATTEMPTS,
            delay
        );
        tokio::time::sleep(Duration::from_secs(delay)).await;

        if config.org_token.is_some() {
            match first_time_register(config, client).await {
                Ok((token, device_id)) => {
                    tracing::info!("Re-registration succeeded on attempt {}", attempt);
                    return Ok((token, device_id));
                }
                Err(e) => {
                    tracing::warn!("Re-registration attempt {} failed: {}", attempt, e);
                    last_err = Some(e);
                }
            }
        } else if attempt == 1 {
            tracing::warn!("No enrollment token available, attempting credential recovery");
            match attempt_recover(config, client).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    tracing::warn!("Credential recovery failed: {}", e);
                    last_err = Some(e);
                }
            }
        }
    }

    Err(last_err.unwrap_or_else(|| anyhow::anyhow!("Re-registration failed after all attempts")))
}

async fn attempt_recover(
    config: &AgentConfig,
    client: &ApiClient,
) -> anyhow::Result<(String, String)> {
    let installation_id = identity::get_or_create_installation_id();
    let identity_fingerprint = identity::compute_identity_fingerprint(&installation_id);

    let device_id = load_device_id().unwrap_or_default();

    let org_token = config.org_token.as_deref().unwrap_or("");
    if org_token.is_empty() {
        return Err(anyhow::anyhow!("No org token available for credential recovery"));
    }

    let new_token = client
        .recover_credential(&identity_fingerprint, &installation_id, org_token)
        .await?;

    save_token(&new_token)?;

    Ok((new_token, device_id))
}

pub fn clear_stored_credentials() {
    let _ = fs::remove_file(token_path());
    let _ = fs::remove_file(device_id_path());
}

pub fn invalidate_token() {
    let path = token_path();
    if path.exists() {
        tracing::warn!("Invalidating stored device token");
        let _ = fs::remove_file(&path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_path_deterministic() {
        let p1 = token_path();
        let p2 = token_path();
        assert_eq!(p1, p2);
    }

    #[test]
    fn test_device_id_path_deterministic() {
        let p1 = device_id_path();
        let p2 = device_id_path();
        assert_eq!(p1, p2);
    }

    #[test]
    fn test_load_token_missing_file() {
        let path = token_path();
        let backup = path.with_extension("bak");
        let had_file = path.exists();
        if had_file {
            let _ = fs::rename(&path, &backup);
        }
        let result = load_token();
        assert!(result.is_none());
        if had_file {
            let _ = fs::rename(&backup, &path);
        }
    }

    #[test]
    fn test_identity_version_constant() {
        assert_eq!(identity::identity_version(), 2);
    }

    #[test]
    fn test_installation_id_persistence() {
        let id1 = identity::get_or_create_installation_id();
        let id2 = identity::get_or_create_installation_id();
        assert_eq!(id1, id2);
        assert!(!id1.is_empty());
    }

    #[test]
    fn test_identity_fingerprint_deterministic() {
        let id = identity::get_or_create_installation_id();
        let f1 = identity::compute_identity_fingerprint(&id);
        let f2 = identity::compute_identity_fingerprint(&id);
        assert_eq!(f1, f2);
        assert!(f1.starts_with("sha256:"));
        assert_eq!(f1.len(), 7 + 64);
    }

    #[test]
    fn test_load_token_empty_file() {
        let path = token_path();
        let backup = path.with_extension("bak");
        let had_file = path.exists();
        if had_file {
            let _ = fs::rename(&path, &backup);
        }
        ensure_token_dir().unwrap();
        let _ = fs::write(&path, "");
        let result = load_token();
        assert!(result.is_none());
        let _ = fs::remove_file(&path);
        if had_file {
            let _ = fs::rename(&backup, &path);
        }
    }

    #[test]
    fn test_load_token_valid_hex() {
        let path = token_path();
        let backup = path.with_extension("bak");
        let had_file = path.exists();
        if had_file {
            let _ = fs::rename(&path, &backup);
        }
        ensure_token_dir().unwrap();
        let token = "a".repeat(64);
        let _ = fs::write(&path, &token);
        let result = load_token();
        assert_eq!(result, Some(token));
        let _ = fs::remove_file(&path);
        if had_file {
            let _ = fs::rename(&backup, &path);
        }
    }

    #[test]
    fn test_load_token_too_short() {
        let path = token_path();
        let backup = path.with_extension("bak");
        let had_file = path.exists();
        if had_file {
            let _ = fs::rename(&path, &backup);
        }
        ensure_token_dir().unwrap();
        let _ = fs::write(&path, "short");
        let result = load_token();
        assert!(result.is_none());
        let _ = fs::remove_file(&path);
        if had_file {
            let _ = fs::rename(&backup, &path);
        }
    }

    #[test]
    fn test_registration_source_variants() {
        let env_src = RegistrationSource::Environment;
        let disk_src = RegistrationSource::Disk;
        let fresh_src = RegistrationSource::FreshRegistration;
        assert!(matches!(env_src, RegistrationSource::Environment));
        assert!(matches!(disk_src, RegistrationSource::Disk));
        assert!(matches!(fresh_src, RegistrationSource::FreshRegistration));
    }

    #[test]
    fn test_config_allows_empty_credentials() {
        let result = std::panic::catch_unwind(|| {
            AgentConfig {
                api_url: "http://localhost:3001".to_string(),
                device_token: String::new(),
                device_id: None,
                org_token: None,
                interval_secs: 30,
                security_interval_secs: 3600,
                inventory_interval_secs: 7200,
                network_discovery_enabled: false,
                remote_polling_interval_secs: 15,
                hostname: "test".to_string(),
                agent_version: "1.0.0".to_string(),
            }
        });
        assert!(result.is_ok());
    }
}

use crate::client::ApiClient;
use crate::config::AgentConfig;
use crate::identity;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

const TOKEN_FILE: &str = "device_token";
const DEVICE_ID_FILE: &str = "device_id";
const MAX_REREGISTER_ATTEMPTS: u32 = 3;
const BASE_BACKOFF_SECS: u64 = 5;

fn token_path(state_dir: &Path) -> PathBuf {
    state_dir.join(TOKEN_FILE)
}

fn device_id_path(state_dir: &Path) -> PathBuf {
    state_dir.join(DEVICE_ID_FILE)
}

fn ensure_token_dir(state_dir: &Path) -> anyhow::Result<()> {
    fs::create_dir_all(state_dir).map_err(|e| {
        anyhow::anyhow!(
            "Failed to create token directory {}: {}",
            state_dir.display(),
            e
        )
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(state_dir, fs::Permissions::from_mode(0o700));
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
                 \texport TF_ORG_TOKEN=tfenr_<your-token>\n\
                 \t/usr/local/bin/techfusion-agent --enroll\n\n\
                 Or install with the TechFusion Linux installer:\n\
                 \tcurl -fsSL https://<your-dashboard>/install-linux.sh -o /tmp/tf-install.sh\n\
                 \tsudo bash /tmp/tf-install.sh --api <TF_API_URL> --enroll-token tfenr_<your-token>\n\n\
                 Get your token from the Dashboard → Connect Device."
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

    let state_dir = &config.state_dir;
    let installation_id = identity::get_or_create_installation_id_in(state_dir);
    let identity_fingerprint = identity::compute_identity_fingerprint(&installation_id);

    tracing::info!(
        "Identity fingerprint: sha256:{}",
        &identity_fingerprint[7..23]
    );
    tracing::info!(
        "Registering device: {} ({} {})",
        config.hostname,
        os,
        os_version
    );
    tracing::info!(
        "CPU: {} ({} cores) | RAM: {} MB | Disk: {} GB",
        cpu_model,
        cpu_cores,
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

    save_token(state_dir, &response.device_token)?;
    save_device_id(state_dir, &response.device.id)?;

    tracing::info!("Device token saved locally for future use");

    Ok((response.device_token, response.device.id))
}

/// One-shot enrollment used by the Linux installer:
/// registers with the enrollment token, persists the device credential,
/// and exits. The enrollment token is never written to disk.
pub async fn enroll_and_exit(
    config: &AgentConfig,
    client: &ApiClient,
) -> anyhow::Result<(String, String)> {
    if config.org_token.is_none() {
        return Err(anyhow::anyhow!(
            "Enrollment requires an enrollment token. Provide TF_ORG_TOKEN or --org-token."
        ));
    }
    let (token, device_id) = first_time_register(config, client).await?;
    Ok((token, device_id))
}

fn save_token(state_dir: &Path, token: &str) -> anyhow::Result<()> {
    ensure_token_dir(state_dir)?;
    let path = token_path(state_dir);
    let tmp_path = path.with_extension("tmp");

    fs::write(&tmp_path, token).map_err(|e| {
        anyhow::anyhow!(
            "Failed to write temp token file {}: {}",
            tmp_path.display(),
            e
        )
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| anyhow::anyhow!("Failed to set token file permissions: {}", e))?;
    }

    fs::rename(&tmp_path, &path).map_err(|e| {
        anyhow::anyhow!(
            "Failed to atomically rename token file {}: {}",
            path.display(),
            e
        )
    })?;

    Ok(())
}

fn save_device_id(state_dir: &Path, id: &str) -> anyhow::Result<()> {
    ensure_token_dir(state_dir)?;
    let path = device_id_path(state_dir);
    let tmp_path = path.with_extension("tmp");

    fs::write(&tmp_path, id).map_err(|e| {
        anyhow::anyhow!(
            "Failed to write temp device_id file {}: {}",
            tmp_path.display(),
            e
        )
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&tmp_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| anyhow::anyhow!("Failed to set device_id file permissions: {}", e))?;
    }

    fs::rename(&tmp_path, &path).map_err(|e| {
        anyhow::anyhow!(
            "Failed to atomically rename device_id file {}: {}",
            path.display(),
            e
        )
    })?;

    Ok(())
}

fn load_token(state_dir: &Path) -> Option<String> {
    let path = token_path(state_dir);
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

fn load_device_id(state_dir: &Path) -> Option<String> {
    let path = device_id_path(state_dir);
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

pub async fn ensure_registered(
    config: &AgentConfig,
) -> anyhow::Result<(String, String, RegistrationSource)> {
    let state_dir = &config.state_dir;

    if !config.device_token.is_empty() {
        let device_id = config
            .device_id
            .clone()
            .or_else(|| load_device_id(state_dir))
            .unwrap_or_default();
        tracing::info!("Using device token from environment variable");
        return Ok((
            config.device_token.clone(),
            device_id,
            RegistrationSource::Environment,
        ));
    }

    if config.org_token.is_some() {
        tracing::info!(
            "TF_ORG_TOKEN provided — performing fresh registration (ignoring any stale disk token)"
        );
        let client = ApiClient::new(config.api_url.clone());
        let (token, device_id) = first_time_register(config, &client).await?;
        return Ok((token, device_id, RegistrationSource::FreshRegistration));
    }

    if let Some(token) = load_token(state_dir) {
        let device_id = load_device_id(state_dir).unwrap_or_default();
        tracing::info!("Loaded existing device token from disk");
        return Ok((token, device_id, RegistrationSource::Disk));
    }

    Err(anyhow::anyhow!(
        "No credentials found.\n\n\
         For first-time registration:\n\
         \texport TF_ORG_TOKEN=tfenr_<your-enrollment-token>\n\
         \t/usr/local/bin/techfusion-agent --enroll\n\n\
         For existing devices the credential is restored automatically from:\n\
         \t{}\n\n\
         Get your enrollment token from the Dashboard → Connect Device.",
        state_dir.display()
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
    let state_dir = &config.state_dir;
    let installation_id = identity::get_or_create_installation_id_in(state_dir);
    let identity_fingerprint = identity::compute_identity_fingerprint(&installation_id);

    let device_id = load_device_id(state_dir).unwrap_or_default();

    let org_token = config.org_token.as_deref().unwrap_or("");
    if org_token.is_empty() {
        return Err(anyhow::anyhow!(
            "No org token available for credential recovery"
        ));
    }

    let new_token = client
        .recover_credential(&identity_fingerprint, &installation_id, org_token)
        .await?;

    save_token(state_dir, &new_token)?;

    Ok((new_token, device_id))
}

pub fn clear_stored_credentials(state_dir: &Path) {
    let _ = fs::remove_file(token_path(state_dir));
    let _ = fs::remove_file(device_id_path(state_dir));
}

pub fn invalidate_token(state_dir: &Path) {
    let path = token_path(state_dir);
    if path.exists() {
        tracing::warn!("Invalidating stored device token");
        let _ = fs::remove_file(&path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_state_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "techfusion-agent-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    fn make_config(state_dir: PathBuf) -> AgentConfig {
        AgentConfig {
            api_url: "http://localhost:3001".to_string(),
            device_token: String::new(),
            device_id: None,
            org_token: None,
            state_dir,
            enroll: false,
            interval_secs: 30,
            security_interval_secs: 3600,
            inventory_interval_secs: 7200,
            network_discovery_enabled: false,
            remote_polling_interval_secs: 15,
            hostname: "test".to_string(),
            agent_version: "1.0.0".to_string(),
        }
    }

    #[test]
    fn test_token_path_deterministic() {
        let dir = test_state_dir();
        let p1 = token_path(&dir);
        let p2 = token_path(&dir);
        assert_eq!(p1, p2);
        assert_eq!(p1.parent(), Some(dir.as_path()));
    }

    #[test]
    fn test_device_id_path_deterministic() {
        let dir = test_state_dir();
        let p1 = device_id_path(&dir);
        let p2 = device_id_path(&dir);
        assert_eq!(p1, p2);
    }

    #[test]
    fn test_load_token_missing_file() {
        let dir = test_state_dir();
        let result = load_token(&dir);
        assert!(result.is_none());
    }

    #[test]
    fn test_load_token_empty_file() {
        let dir = test_state_dir();
        ensure_token_dir(&dir).unwrap();
        let path = token_path(&dir);
        let _ = fs::write(&path, "");
        let result = load_token(&dir);
        assert!(result.is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_load_token_valid_hex() {
        let dir = test_state_dir();
        ensure_token_dir(&dir).unwrap();
        let token = "a".repeat(64);
        save_token(&dir, &token).unwrap();
        let result = load_token(&dir);
        assert_eq!(result, Some(token));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_load_token_too_short() {
        let dir = test_state_dir();
        ensure_token_dir(&dir).unwrap();
        let path = token_path(&dir);
        let _ = fs::write(&path, "short");
        let result = load_token(&dir);
        assert!(result.is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_state_dir_permissions_restrictive() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let dir = test_state_dir();
            ensure_token_dir(&dir).unwrap();
            let mode = fs::metadata(&dir).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o700);
            let _ = fs::remove_dir_all(&dir);
        }
    }

    #[test]
    fn test_save_restore_token_roundtrip() {
        let dir = test_state_dir();
        let token = "dev_token_abcdefghijklmnop".to_string();
        save_token(&dir, &token).unwrap();
        save_device_id(&dir, "device-1234").unwrap();
        assert_eq!(load_token(&dir), Some(token.clone()));
        assert_eq!(load_device_id(&dir), Some("device-1234".to_string()));
        clear_stored_credentials(&dir);
        assert_eq!(load_token(&dir), None);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_clear_stored_credentials_removes_token_and_id() {
        let dir = test_state_dir();
        ensure_token_dir(&dir).unwrap();
        save_token(&dir, &"a".repeat(64)).unwrap();
        save_device_id(&dir, "dev-1").unwrap();
        clear_stored_credentials(&dir);
        assert!(!token_path(&dir).exists());
        assert!(!device_id_path(&dir).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_invalidate_token_removes_only_token() {
        let dir = test_state_dir();
        ensure_token_dir(&dir).unwrap();
        save_token(&dir, &"a".repeat(64)).unwrap();
        save_device_id(&dir, "dev-1").unwrap();
        invalidate_token(&dir);
        assert!(!token_path(&dir).exists());
        assert!(device_id_path(&dir).exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_identity_version_constant() {
        assert_eq!(identity::identity_version(), 2);
    }

    #[test]
    fn test_installation_id_persistence_in_state_dir() {
        let dir = test_state_dir();
        let id1 = identity::get_or_create_installation_id_in(&dir);
        let id2 = identity::get_or_create_installation_id_in(&dir);
        assert_eq!(id1, id2);
        assert!(!id1.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_identity_fingerprint_deterministic() {
        let dir = test_state_dir();
        let id = identity::get_or_create_installation_id_in(&dir);
        let f1 = identity::compute_identity_fingerprint(&id);
        let f2 = identity::compute_identity_fingerprint(&id);
        assert_eq!(f1, f2);
        assert!(f1.starts_with("sha256:"));
        assert_eq!(f1.len(), 7 + 64);
        let _ = fs::remove_dir_all(&dir);
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
        let result = std::panic::catch_unwind(|| make_config(test_state_dir()));
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_ensure_registered_requires_credentials() {
        let config = make_config(test_state_dir());
        let err = crate::registration::ensure_registered(&config).await;
        assert!(err.is_err());
        let msg = format!("{:?}", err.err());
        assert!(msg.contains("No credentials found"));
    }
}

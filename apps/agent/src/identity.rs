use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub const IDENTITY_VERSION_V1: u32 = 1;
pub const IDENTITY_VERSION_V2: u32 = 2;
pub const CURRENT_IDENTITY_VERSION: u32 = IDENTITY_VERSION_V2;

const INSTALLATION_ID_FILE: &str = "installation_id";

fn installation_id_path(state_dir: &Path) -> PathBuf {
    state_dir.join(INSTALLATION_ID_FILE)
}

/// Read or create the persistent installation UUID inside `state_dir`.
pub fn get_or_create_installation_id_in(state_dir: &Path) -> String {
    let path = installation_id_path(state_dir);
    if let Ok(id) = fs::read_to_string(&path) {
        let trimmed = id.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }

    let new_id = uuid::Uuid::new_v4().to_string();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, &new_id);

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    new_id
}

pub fn get_machine_id() -> Option<String> {
    if let Ok(id) = fs::read_to_string("/etc/machine-id") {
        let trimmed = id.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    if let Ok(id) = fs::read_to_string("/var/lib/dbus/machine-id") {
        let trimmed = id.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("wmic")
            .args(["csproduct", "get", "UUID"])
            .output()
        {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<&str> = stdout.lines().collect();
            if lines.len() > 1 {
                return Some(lines[1].trim().to_string());
            }
        }
    }

    None
}

pub fn get_system_uuid() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = std::process::Command::new("cat")
            .arg("/sys/class/dmi/id/product_uuid")
            .output()
        {
            if output.status.success() {
                let uuid = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !uuid.is_empty() && uuid != "Not Settable" && uuid != "Not Specified" {
                    return Some(uuid);
                }
            }
        }
    }

    get_machine_id()
}

/// V2 fingerprint (current stable version):
/// Only uses persistent, stable identifiers:
/// - Identity version prefix (`v2`)
/// - Installation UUID (never changes)
/// - Machine ID (/etc/machine-id)
/// - System UUID (SMBIOS product_uuid)
///
/// Mutable values (hostname, OS, CPU, RAM) are excluded;
/// they are sent as metadata and updated separately.
pub fn compute_identity_fingerprint_v2(installation_id: &str) -> String {
    let mut hasher = Sha256::new();

    hasher.update(format!("v{}", IDENTITY_VERSION_V2).as_bytes());
    hasher.update(b"\0");
    hasher.update(installation_id.as_bytes());
    hasher.update(b"\0");

    if let Some(machine_id) = get_machine_id() {
        hasher.update(machine_id.as_bytes());
        hasher.update(b"\0");
    }

    if let Some(sys_uuid) = get_system_uuid() {
        hasher.update(sys_uuid.as_bytes());
        hasher.update(b"\0");
    }

    let result = hasher.finalize();
    format!("sha256:{}", hex::encode(result))
}

/// Legacy V1 fingerprint (backward compatible):
/// Uses installation UUID + machine-id + system UUID + mutable fields.
/// Kept for backward compatibility with existing devices.
#[allow(dead_code)]
pub fn compute_identity_fingerprint_v1(installation_id: &str) -> String {
    let hostname = sysinfo::System::host_name().unwrap_or_else(|| "unknown".to_string());
    let os = sysinfo::System::name().unwrap_or_else(|| "Unknown".to_string());
    let os_version = sysinfo::System::os_version()
        .or_else(|| sysinfo::System::kernel_version())
        .unwrap_or_else(|| "Unknown".to_string());

    let sys = sysinfo::System::new_all();
    let cpu_model = sys.global_cpu_info().brand().to_string();
    let cpu_cores = sys.cpus().len();
    let ram_total = sys.total_memory();

    let mut hasher = Sha256::new();

    hasher.update(format!("v{}", IDENTITY_VERSION_V1).as_bytes());
    hasher.update(b"\0");
    hasher.update(installation_id.as_bytes());
    hasher.update(b"\0");

    if let Some(machine_id) = get_machine_id() {
        hasher.update(machine_id.as_bytes());
        hasher.update(b"\0");
    }

    if let Some(sys_uuid) = get_system_uuid() {
        hasher.update(sys_uuid.as_bytes());
        hasher.update(b"\0");
    }

    hasher.update(hostname.as_bytes());
    hasher.update(b"\0");
    hasher.update(os.as_bytes());
    hasher.update(b"\0");
    hasher.update(os_version.as_bytes());
    hasher.update(b"\0");
    hasher.update(cpu_model.as_bytes());
    hasher.update(b"\0");
    hasher.update(cpu_cores.to_string().as_bytes());
    hasher.update(b"\0");
    hasher.update(ram_total.to_string().as_bytes());

    let result = hasher.finalize();
    format!("sha256:{}", hex::encode(result))
}

/// Compute the current identity fingerprint (v2 - stable only)
pub fn compute_identity_fingerprint(installation_id: &str) -> String {
    compute_identity_fingerprint_v2(installation_id)
}

pub fn identity_version() -> u32 {
    CURRENT_IDENTITY_VERSION
}

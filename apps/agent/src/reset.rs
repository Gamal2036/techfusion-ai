//! Agent identity reset and status lifecycle (V1-STAGE-00B).
//!
//! Two distinct operations, never mixed:
//!
//! RESET IDENTITY — removes ONLY the local device identity/credential files
//! (`device_token`, `device_id`, `installation_id` and their `.tmp` variants),
//! returns the Agent to the UNENROLLED state, and leaves the binary, systemd
//! unit, and non-secret configuration intact.
//!
//! UNINSTALL — handled separately by `scripts/uninstall-linux.sh` and removes
//! the service, binary, and (optionally) all local state.
//!
//! Device tokens and credentials are never printed by this module.

use crate::config::AgentConfig;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::BufRead;
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const DEVICE_TOKEN_FILE: &str = "device_token";
pub const DEVICE_ID_FILE: &str = "device_id";
pub const INSTALLATION_ID_FILE: &str = "installation_id";

const TEMP_SUFFIX: &str = ".tmp";
const SERVICE_NAME: &str = "techfusion-agent";
const SERVICE_UNIT_PATH: &str = "/etc/systemd/system/techfusion-agent.service";
const SERVICE_ENV_FILE: &str = "/etc/techfusion/agent.env";
const INSTALLED_STATE_DIR: &str = "/var/lib/techfusion";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdentityState {
    Enrolled,
    Unenrolled,
    Partial,
}

impl IdentityState {
    pub fn as_str(&self) -> &'static str {
        match self {
            IdentityState::Enrolled => "ENROLLED",
            IdentityState::Unenrolled => "UNENROLLED",
            IdentityState::Partial => "PARTIAL",
        }
    }
}

#[derive(Debug)]
pub struct ResetSummary {
    pub removed: Vec<PathBuf>,
    pub preserved: Vec<PathBuf>,
    pub was_enrolled: bool,
    pub state_dir: PathBuf,
}

/// True when `name` is a known identity/credential artifact (including its
/// crash-recovery `.tmp` variant). Everything else in the state directory is
/// preserved by a reset.
pub fn is_identity_file(name: &str) -> bool {
    let base = name.strip_suffix(TEMP_SUFFIX).unwrap_or(name);
    matches!(
        base,
        DEVICE_TOKEN_FILE | DEVICE_ID_FILE | INSTALLATION_ID_FILE
    )
}

fn device_token_path(state_dir: &Path) -> PathBuf {
    state_dir.join(DEVICE_TOKEN_FILE)
}

fn device_id_path(state_dir: &Path) -> PathBuf {
    state_dir.join(DEVICE_ID_FILE)
}

/// Mirrors `registration::load_token`: a file is a valid credential only when
/// it exists, is non-empty, and is long enough to plausibly be a device token.
pub fn has_valid_token(state_dir: &Path) -> bool {
    let path = device_token_path(state_dir);
    match fs::read_to_string(&path) {
        Ok(content) => {
            let trimmed = content.trim();
            !trimmed.is_empty() && trimmed.len() >= 16
        }
        Err(_) => false,
    }
}

pub fn has_device_id(state_dir: &Path) -> bool {
    match fs::read_to_string(device_id_path(state_dir)) {
        Ok(content) => !content.trim().is_empty(),
        Err(_) => false,
    }
}

pub fn identity_state(state_dir: &Path) -> IdentityState {
    match (has_valid_token(state_dir), has_device_id(state_dir)) {
        (true, true) => IdentityState::Enrolled,
        (false, false) => IdentityState::Unenrolled,
        _ => IdentityState::Partial,
    }
}

/// Narrow, auditable reset. Removes ONLY the known identity/credential files
/// inside `state_dir`. No wildcards are used and nothing outside `state_dir`
/// is ever touched. Idempotent: an already-unenrolled (or absent) state
/// directory is a safe success with an empty removal list.
pub fn reset_identity_files(state_dir: &Path) -> anyhow::Result<ResetSummary> {
    if !state_dir.is_dir() {
        return Ok(ResetSummary {
            removed: Vec::new(),
            preserved: Vec::new(),
            was_enrolled: false,
            state_dir: state_dir.to_path_buf(),
        });
    }

    if state_dir == Path::new("/") {
        anyhow::bail!("Refusing to run a reset against the filesystem root");
    }

    let was_enrolled = identity_state(state_dir) == IdentityState::Enrolled;
    let mut removed = Vec::new();
    let mut preserved = Vec::new();

    for entry in fs::read_dir(state_dir).map_err(|e| {
        anyhow::anyhow!("Cannot read state directory {}: {}", state_dir.display(), e)
    })? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let name = entry.file_name();
        let name_str = name.to_string_lossy().into_owned();

        if is_identity_file(&name_str) {
            if entry.path().is_file() {
                fs::remove_file(entry.path()).map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to remove identity file {}: {}",
                        entry.path().display(),
                        e
                    )
                })?;
                removed.push(entry.path());
            }
        } else {
            preserved.push(entry.path());
        }
    }

    Ok(ResetSummary {
        removed,
        preserved,
        was_enrolled,
        state_dir: state_dir.to_path_buf(),
    })
}

/// Read a systemd EnvironmentFile (`KEY=VALUE` lines) into a map.
pub fn read_env_file(path: &Path) -> std::io::Result<HashMap<String, String>> {
    let file = fs::File::open(path)?;
    let reader = std::io::BufReader::new(file);
    let mut map = HashMap::new();
    for line in reader.lines() {
        let line = line?;
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = line.split_once('=') {
            map.insert(k.trim().to_string(), v.trim().to_string());
        }
    }
    Ok(map)
}

/// Resolve the state directory for the reset/status commands.
///
/// Order:
/// 1. explicit `--state-dir` argument
/// 2. `TF_STATE_DIR` environment variable
/// 3. `TF_STATE_DIR` from the installed service EnvironmentFile
///    (`/etc/techfusion/agent.env`)
/// 4. the installer default `/var/lib/techfusion`
/// 5. the process default state directory
pub fn resolve_state_dir(config: &AgentConfig) -> PathBuf {
    if config.state_dir_explicit {
        return config.state_dir.clone();
    }
    if let Ok(p) = env::var("TF_STATE_DIR") {
        if !p.trim().is_empty() {
            return PathBuf::from(p.trim());
        }
    }
    if let Ok(service_env) = read_env_file(Path::new(SERVICE_ENV_FILE)) {
        if let Some(p) = service_env.get("TF_STATE_DIR") {
            if !p.trim().is_empty() {
                return PathBuf::from(p.trim());
            }
        }
    }
    let installed = PathBuf::from(INSTALLED_STATE_DIR);
    if installed.is_dir() {
        return installed;
    }
    config.state_dir.clone()
}

fn service_api_url() -> Option<String> {
    if let Ok(url) = env::var("TF_API_URL") {
        if !url.trim().is_empty() {
            return Some(url.trim().to_string());
        }
    }
    read_env_file(Path::new(SERVICE_ENV_FILE))
        .ok()
        .and_then(|m| m.get("TF_API_URL").cloned())
}

fn is_root() -> bool {
    std::process::Command::new("id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim() == "0")
        .unwrap_or(false)
}

fn require_root() -> anyhow::Result<()> {
    if is_root() {
        Ok(())
    } else {
        Err(anyhow::anyhow!(
            "reset-identity must run as root.\n\
             Use: sudo techfusion-agent reset-identity"
        ))
    }
}

fn systemd_service_active() -> Option<bool> {
    let out = std::process::Command::new("systemctl")
        .args(["is-active", SERVICE_NAME])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&out.stdout);
    Some(text.trim() == "active")
}

fn stop_agent_service() -> anyhow::Result<bool> {
    if !Path::new(SERVICE_UNIT_PATH).is_file() {
        return Ok(false);
    }

    tracing::info!("Stopping {}.service", SERVICE_NAME);
    let status = std::process::Command::new("systemctl")
        .arg("stop")
        .arg(SERVICE_NAME)
        .status()
        .map_err(|e| anyhow::anyhow!("Failed to run systemctl stop {}: {}", SERVICE_NAME, e))?;

    if !status.success() {
        anyhow::bail!(
            "systemctl stop {} exited with {}",
            SERVICE_NAME,
            status
                .code()
                .map(|c| c.to_string())
                .unwrap_or_else(|| "signal".to_string())
        );
    }

    kill_orphan_agent_processes();
    Ok(true)
}

/// Terminate any standalone `techfusion-agent` process that is not our own
/// PID, so no orphan process can keep using the old credentials.
fn kill_orphan_agent_processes() {
    let self_pid = std::process::id() as i32;

    let list = || -> Vec<i32> {
        std::process::Command::new("pgrep")
            .args(["-x", "techfusion-agent"])
            .output()
            .ok()
            .map(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .filter_map(|l| l.trim().parse::<i32>().ok())
                    .filter(|pid| *pid != self_pid)
                    .collect()
            })
            .unwrap_or_default()
    };

    for pid in list() {
        let _ = std::process::Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status();
    }

    if !list().is_empty() {
        std::thread::sleep(Duration::from_secs(1));
        for pid in list() {
            let _ = std::process::Command::new("kill")
                .args(["-KILL", &pid.to_string()])
                .status();
        }
    }
}

fn confirm_reset(yes: bool) -> anyhow::Result<()> {
    if yes {
        return Ok(());
    }

    eprintln!();
    eprintln!("This will remove this device's local TechFusion identity and credential.");
    eprintln!("The Agent will need to be enrolled again.");
    eprintln!("The binary and systemd service are preserved and left STOPPED.");
    eprintln!();
    eprintln!("Type RESET to continue:");

    let mut line = String::new();
    std::io::stdin()
        .read_line(&mut line)
        .map_err(|e| anyhow::anyhow!("Failed to read confirmation input: {}", e))?;

    confirm_reset_line(&line)
}

fn confirm_reset_line(line: &str) -> anyhow::Result<()> {
    if line.trim() == "RESET" {
        Ok(())
    } else {
        Err(anyhow::anyhow!(
            "Aborted — confirmation did not match 'RESET'. No files were changed."
        ))
    }
}

fn print_status_to(writer: &mut dyn std::io::Write, state_dir: &Path) {
    let state = identity_state(state_dir);

    let device_id = if has_device_id(state_dir) {
        fs::read_to_string(device_id_path(state_dir))
            .ok()
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "n/a".to_string())
    } else {
        "n/a".to_string()
    };

    let api_url = service_api_url().unwrap_or_else(|| "n/a".to_string());

    let service = match systemd_service_active() {
        Some(true) => "active",
        Some(false) => "inactive",
        None => {
            if Path::new(SERVICE_UNIT_PATH).is_file() {
                "failed/unknown"
            } else {
                "not installed"
            }
        }
    };

    let _ = writeln!(writer);
    let _ = writeln!(writer, "  TechFusion Agent — Identity Status");
    let _ = writeln!(writer, "  ───────────────────────────────────────");
    let _ = writeln!(writer, "  State:      {}", state.as_str());
    let _ = writeln!(writer, "  Device ID:  {}", device_id);
    let _ = writeln!(writer, "  API URL:    {}", api_url);
    let _ = writeln!(writer, "  Service:    {}", service);
    let _ = writeln!(writer, "  State dir:  {}", state_dir.display());
    let _ = writeln!(writer);
    let _ = writeln!(writer, "  Device tokens and credentials are never shown.");
    let _ = writeln!(writer);
}

pub async fn run_status(config: &AgentConfig) -> anyhow::Result<()> {
    let state_dir = resolve_state_dir(config);
    print_status_to(&mut std::io::stdout(), &state_dir);
    Ok(())
}

pub async fn run_reset(config: &AgentConfig, yes: bool) -> anyhow::Result<()> {
    let state_dir = resolve_state_dir(config);

    println!();
    println!("  TechFusion Agent — Identity Reset");
    println!("  ───────────────────────────────────────");
    println!("  State dir:  {}", state_dir.display());
    println!();

    if !state_dir.is_dir() {
        println!("  Agent is already unenrolled (no state directory) — nothing to do.");
        println!();
        return Ok(());
    }

    match identity_state(&state_dir) {
        IdentityState::Unenrolled => {
            println!("  Agent is already unenrolled — nothing to do.");
            println!("  Use a fresh enrollment token to re-enroll.");
            println!();
            return Ok(());
        }
        IdentityState::Enrolled => {}
        IdentityState::Partial => {
            println!("  Partial identity state detected — only known identity artifacts will be removed.");
        }
    }

    require_root()?;
    confirm_reset(yes)?;

    println!("  Stopping the agent service...");
    let stopped_service = stop_agent_service()?;
    if stopped_service {
        println!("  Service stopped.");
    } else {
        println!("  No {} unit found — skipping service stop.", SERVICE_NAME);
    }

    let summary = reset_identity_files(&state_dir)?;

    println!();
    if summary.was_enrolled {
        println!("  Previous state: ENROLLED — identity cleared.");
    }
    if summary.removed.is_empty() {
        println!("  No identity files were present.");
    } else {
        for path in &summary.removed {
            println!("  Removed: {}", path.display());
        }
    }
    if !summary.preserved.is_empty() {
        println!(
            "  Preserved {} non-identity file(s) in {}.",
            summary.preserved.len(),
            summary.state_dir.display()
        );
    }
    println!();

    let final_state = identity_state(&state_dir);
    if final_state != IdentityState::Unenrolled {
        anyhow::bail!(
            "Reset did not fully clear identity state (remaining state: {}). \
             No secret was printed; inspect {} manually.",
            final_state.as_str(),
            state_dir.display()
        );
    }

    println!("  ✔ Identity reset complete.");
    println!("    Agent is now UNENROLLED.");
    println!("    The service is installed but STOPPED.");
    println!("    To re-enroll with a fresh enrollment token, run:");
    println!("      sudo bash install-linux.sh --api <TF_API_URL> --enroll-token tfenr_<token>");
    println!();
    println!("  The old server-side Device record is preserved and will go OFFLINE");
    println!("  as presence monitoring expires it. Nothing was deleted server-side.");
    println!();

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_state_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "techfusion-reset-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ))
    }

    fn write_file(dir: &Path, name: &str, content: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(dir.join(name), content).unwrap();
    }

    #[test]
    fn test_identity_file_names_recognized() {
        assert!(is_identity_file("device_token"));
        assert!(is_identity_file("device_id"));
        assert!(is_identity_file("installation_id"));
        assert!(is_identity_file("device_token.tmp"));
        assert!(is_identity_file("device_id.tmp"));
        assert!(is_identity_file("installation_id.tmp"));
        assert!(!is_identity_file("device_token.backup"));
        assert!(!is_identity_file("agent.log"));
        assert!(!is_identity_file("lock"));
        assert!(!is_identity_file("metrics_cache"));
    }

    #[test]
    fn test_unenrolled_when_no_files() {
        let dir = test_state_dir();
        assert_eq!(identity_state(&dir), IdentityState::Unenrolled);
    }

    #[test]
    fn test_enrolled_identity_detected() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", &"a".repeat(64));
        write_file(&dir, "device_id", "dev-123");
        assert_eq!(identity_state(&dir), IdentityState::Enrolled);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_partial_state_detected() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", &"a".repeat(64));
        assert_eq!(identity_state(&dir), IdentityState::Partial);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_malformed_short_token_treated_as_unenrolled() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", "short");
        assert!(!has_valid_token(&dir));
        assert_eq!(identity_state(&dir), IdentityState::Unenrolled);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_malformed_empty_token_treated_as_missing() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", "   ");
        assert!(!has_valid_token(&dir));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_reset_removes_identity_and_keeps_other_files() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", &"a".repeat(64));
        write_file(&dir, "device_id", "dev-123");
        write_file(&dir, "installation_id", "uuid-456");
        write_file(&dir, "device_token.tmp", "stale");
        write_file(&dir, "agent.log", "not identity");
        write_file(&dir, "metrics_cache", "runtime state");
        write_file(&dir, "config.json", r#"{"keep":true}"#);

        let summary = reset_identity_files(&dir).unwrap();
        assert!(summary.was_enrolled);
        assert_eq!(summary.removed.len(), 4);
        assert_eq!(summary.preserved.len(), 3);

        assert_eq!(identity_state(&dir), IdentityState::Unenrolled);
        assert!(!dir.join("device_token").exists());
        assert!(!dir.join("device_id").exists());
        assert!(!dir.join("installation_id").exists());
        assert!(!dir.join("device_token.tmp").exists());
        assert!(dir.join("agent.log").exists());
        assert!(dir.join("metrics_cache").exists());
        assert!(dir.join("config.json").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_reset_already_unenrolled_is_idempotent() {
        let dir = test_state_dir();
        write_file(&dir, "agent.log", "only runtime state");

        let first = reset_identity_files(&dir).unwrap();
        assert!(!first.was_enrolled);
        assert!(first.removed.is_empty());
        assert_eq!(first.preserved.len(), 1);

        let second = reset_identity_files(&dir).unwrap();
        assert!(second.removed.is_empty());
        assert_eq!(identity_state(&dir), IdentityState::Unenrolled);
        assert!(dir.join("agent.log").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_reset_missing_state_dir_is_safe() {
        let dir = test_state_dir();
        let summary = reset_identity_files(&dir).unwrap();
        assert!(summary.removed.is_empty());
        assert!(!summary.was_enrolled);
    }

    #[test]
    fn test_reset_partial_state_cleans_known_artifacts() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", &"a".repeat(64));
        write_file(&dir, "keep.txt", "preserve me");

        let summary = reset_identity_files(&dir).unwrap();
        assert!(!summary.was_enrolled);
        assert_eq!(summary.removed.len(), 1);
        assert_eq!(summary.preserved.len(), 1);
        assert_eq!(identity_state(&dir), IdentityState::Unenrolled);
        assert!(dir.join("keep.txt").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_reset_never_touches_files_outside_state_dir() {
        let dir = test_state_dir();
        let outside = dir.with_file_name(format!("outside-{}", std::process::id()));
        write_file(&outside, "device_token", &"a".repeat(64));

        let summary = reset_identity_files(&dir).unwrap();
        assert!(summary.removed.is_empty());
        assert!(outside.join("device_token").exists());
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn test_reset_refuses_filesystem_root() {
        if cfg!(unix) {
            let err = reset_identity_files(Path::new("/"));
            assert!(err.is_err());
        }
    }

    #[test]
    fn test_status_output_never_contains_token() {
        let dir = test_state_dir();
        let token = "secret_device_token_abcdef1234567890";
        write_file(&dir, "device_token", token);
        write_file(&dir, "device_id", "dev-123");

        let mut buf = Vec::new();
        print_status_to(&mut buf, &dir);
        let output = String::from_utf8(buf).unwrap();
        assert!(
            !output.contains(token),
            "status must never print the device token"
        );
        assert!(output.contains("ENROLLED"));
        assert!(output.contains("dev-123"));
        assert!(output.contains("never shown"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_reset_summary_removed_paths_are_identity_files() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", &"a".repeat(64));
        write_file(&dir, "device_id", "dev-1");
        write_file(&dir, "installation_id", "uuid-1");
        let summary = reset_identity_files(&dir).unwrap();
        assert_eq!(summary.removed.len(), 3);
        for p in &summary.removed {
            let name = p.file_name().unwrap().to_string_lossy();
            assert!(is_identity_file(&name));
        }
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_confirm_reset_with_yes_flag_skips_prompt() {
        assert!(confirm_reset(true).is_ok());
    }

    #[test]
    fn test_confirm_reset_accepts_exact_token() {
        assert!(confirm_reset_line("RESET\n").is_ok());
        assert!(confirm_reset_line("  RESET  \n").is_ok());
    }

    #[test]
    fn test_confirm_reset_rejects_non_matching_input() {
        assert!(confirm_reset_line("reset\n").is_err());
        assert!(confirm_reset_line("yes\n").is_err());
        assert!(confirm_reset_line("").is_err());
    }

    #[test]
    fn test_reenrollment_persists_new_identity_after_reset() {
        let dir = test_state_dir();
        write_file(&dir, "device_token", &"a".repeat(64));
        write_file(&dir, "device_id", "old-device");
        write_file(&dir, "installation_id", "old-install");

        reset_identity_files(&dir).unwrap();
        assert_eq!(identity_state(&dir), IdentityState::Unenrolled);

        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("device_token"), &"b".repeat(64)).unwrap();
        fs::write(dir.join("device_id"), "new-device").unwrap();
        fs::write(dir.join("installation_id"), "new-install").unwrap();

        assert_eq!(identity_state(&dir), IdentityState::Enrolled);
        assert_eq!(
            fs::read_to_string(dir.join("device_id")).unwrap(),
            "new-device"
        );
        assert_ne!(
            fs::read_to_string(dir.join("device_token")).unwrap(),
            "a".repeat(64)
        );
        let _ = fs::remove_dir_all(&dir);
    }
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use reqwest::blocking::Client;

pub static ACTIVE_INDICATOR_PATH: &str = "/tmp/techfusion_remote_active";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionRequest {
    pub session_id: String,
    pub device_id: String,
    pub technician_id: String,
    pub turn_server: Option<String>,
    pub turn_credential: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SessionStatus {
    pub session_id: String,
    pub status: String,
    pub device_id: String,
}

#[derive(Serialize)]
pub struct ConsentDecision {
    pub session_id: String,
    pub device_id: String,
    pub granted: bool,
    pub method: String,
}

#[derive(Serialize)]
pub struct ScreenCapture {
    pub session_id: String,
    pub data: String,
    pub timestamp: String,
}

#[derive(Serialize)]
pub struct InputEvent {
    pub session_id: String,
    pub event_type: String,
    pub data: serde_json::Value,
    pub timestamp: String,
}

pub fn check_active_sessions(client: &Client, api_url: &str, token: &str) -> Vec<SessionRequest> {
    let url = format!("{}/remote-support/agent/pending", api_url);
    match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
    {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<Vec<SessionRequest>>().unwrap_or_default()
            } else {
                Vec::new()
            }
        }
        Err(_) => Vec::new(),
    }
}

pub fn confirm_consent(session: &SessionRequest, granted: bool) -> bool {
    if !granted {
        println!(
            "[Remote] Session {} consent denied by user",
            session.session_id
        );
        return false;
    }

    println!(
        "[Remote] ===== REMOTE ACCESS REQUEST ====="
    );
    println!(
        "[Remote] Technician {} wants to connect",
        session.technician_id
    );
    println!("[Remote] Session: {}", session.session_id);
    println!("[Remote] Allow? (y/N): ");

    let mut input = String::new();
    std::io::stdin().read_line(&mut input).ok();
    let granted = input.trim().eq_ignore_ascii_case("y");

    if granted {
        println!("[Remote] Consent granted for session {}", session.session_id);
    } else {
        println!("[Remote] Consent denied for session {}", session.session_id);
    }

    granted
}

pub fn send_consent(client: &Client, api_url: &str, token: &str, decision: &ConsentDecision) -> bool {
    let url = format!("{}/remote-support/consent", api_url);
    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(decision)
        .send()
    {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

pub fn update_session_status(client: &Client, api_url: &str, token: &str, status: &SessionStatus) -> bool {
    let url = format!("{}/remote-support/agent/status", api_url);
    match client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .json(status)
        .send()
    {
        Ok(resp) => resp.status().is_success(),
        Err(e) => {
            eprintln!("[Remote] Status update failed: {}", e);
            false
        }
    }
}

pub fn create_active_indicator() -> Arc<AtomicBool> {
    let active = Arc::new(AtomicBool::new(false));
    let active_clone = active.clone();

    thread::spawn(move || {
        let indicator_path = PathBuf::from(ACTIVE_INDICATOR_PATH);
        loop {
            if active_clone.load(Ordering::Relaxed) {
                fs::write(&indicator_path, "ACTIVE").ok();
                thread::sleep(Duration::from_secs(5));
            } else {
                fs::remove_file(&indicator_path).ok();
                thread::sleep(Duration::from_secs(10));
            }
        }
    });

    active
}

pub fn simulate_screen_capture() -> String {
    let output = Command::new("sh")
        .args([
            "-c",
            "import -window root -quality 30 png:- 2>/dev/null | base64 -w0 2>/dev/null || echo ''",
        ])
        .output()
        .ok();

    match output {
        Some(out) if !out.stdout.is_empty() => {
            let b64 = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if b64.is_empty() {
                placeholder_frame()
            } else {
                format!("data:image/png;base64,{}", b64)
            }
        }
        _ => placeholder_frame(),
    }
}

fn placeholder_frame() -> String {
    let term_output = Command::new("sh")
        .args(["-c", "tmux capture-pane -t $(tmux list-sessions -F '#S' 2>/dev/null | head -1) -p 2>/dev/null | head -20 || echo 'Terminal unavailable'"])
        .output()
        .ok();

    let text = match term_output {
        Some(out) => String::from_utf8_lossy(&out.stdout).trim().to_string(),
        None => "TechFusion Remote Agent\nNo display server available".to_string(),
    };

    let b64 = base64_encode(text.as_bytes());
    format!("data:text/plain;base64,{}", b64)
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

pub fn report_input(session_id: &str, event_type: &str, event_data: serde_json::Value) {
    let _event = InputEvent {
        session_id: session_id.to_string(),
        event_type: event_type.to_string(),
        data: event_data,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    match event_type {
        "keyboard" => {
            let key = event_data.get("key").and_then(|k| k.as_str()).unwrap_or("");
            println!("[Remote Input] key: {}", key);
            Command::new("sh")
                .args([
                    "-c",
                    &format!(
                        "ydotool key '{}' 2>/dev/null || xdotool key '{}' 2>/dev/null || true",
                        key, key
                    ),
                ])
                .output()
                .ok();
        }
        "mouse_move" => {
            let x = event_data.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let y = event_data.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
            Command::new("sh")
                .args([
                    "-c",
                    &format!(
                        "ydotool mousemove --absolute {} {} 2>/dev/null || xdotool mousemove {} {} 2>/dev/null || true",
                        x as i32, y as i32, x as i32, y as i32
                    ),
                ])
                .output()
                .ok();
        }
        "mouse_click" => {
            let button = event_data.get("button").and_then(|v| v.as_u64()).unwrap_or(1);
            Command::new("sh")
                .args([
                    "-c",
                    &format!(
                        "ydotool click {} 2>/dev/null || xdotool click {} 2>/dev/null || true",
                        button, button
                    ),
                ])
                .output()
                .ok();
        }
        "mouse_scroll" => {
            let dy = event_data.get("deltaY").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let amount = dy.abs().round() as i32;
            let direction = if dy > 0.0 { "down" } else { "up" };
            Command::new("sh")
                .args([
                    "-c",
                    &format!(
                        "ydotool scroll {} {} 2>/dev/null || xdotool click 4 2>/dev/null || true",
                        direction, if direction == "down" { amount } else { amount }
                    ),
                ])
                .output()
                .ok();
        }
        _ => {}
    }
}

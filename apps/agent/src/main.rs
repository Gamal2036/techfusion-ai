use chrono::Utc;
use rand::Rng;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;
use sysinfo::{
    CpuRefreshKind, Disks, Networks, System,
};

const TOKEN_FILE: &str = ".techfusion/device_token.json";
const DEFAULT_INTERVAL_SECS: u64 = 10;

#[derive(Serialize, Deserialize, Clone)]
struct DeviceToken {
    token: String,
    device_id: String,
    api_url: String,
}

#[derive(Serialize)]
struct RegisterPayload {
    name: String,
    hostname: String,
    os: String,
    os_version: String,
    cpu_model: String,
    cpu_cores: u32,
    cpu_logical: u32,
    ram_total: u64,
    disk_total: u64,
    is_laptop: bool,
}

#[derive(Serialize)]
struct MetricsPayload {
    device_token: String,
    timestamp: String,
    cpu: CpuMetrics,
    memory: MemoryMetrics,
    disk: DiskMetrics,
    temperatures: Temperatures,
    network: NetworkMetrics,
    processes: u32,
    uptime: u64,
    services: Vec<ServiceCheck>,
}

#[derive(Serialize)]
struct ServiceCheck {
    name: String,
    status: String,
}

#[derive(Serialize)]
struct CpuMetrics {
    usage: f32,
    cores: u32,
    load_average_1_min: f64,
    load_average_5_min: f64,
    load_average_15_min: f64,
}

#[derive(Serialize)]
struct MemoryMetrics {
    total: u64,
    used: u64,
    percent: f32,
}

#[derive(Serialize)]
struct DiskMetrics {
    total: u64,
    used: u64,
    read_bytes: u64,
    write_bytes: u64,
}

#[derive(Serialize)]
struct Temperatures {
    cpu: f32,
}

#[derive(Serialize)]
struct NetworkMetrics {
    rx_bytes: u64,
    tx_bytes: u64,
}

fn token_path() -> PathBuf {
    let home = env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(TOKEN_FILE)
}

fn load_token() -> Option<DeviceToken> {
    let path = token_path();
    if path.exists() {
        let content = fs::read_to_string(&path).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

fn save_token(token: &DeviceToken) {
    let path = token_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    if let Ok(content) = serde_json::to_string_pretty(token) {
        fs::write(&path, &content).ok();
    }
    println!("Saved device token to {}", path.display());
}

fn register_device(client: &Client, api_url: &str) -> Option<DeviceToken> {
    let mut sys = System::new();
    sys.refresh_cpu();
    sys.refresh_memory();
    sys.refresh_disks_list();

    let hostname = sys.host_name().unwrap_or_else(|| "unknown".to_string());
    let os_name = sys
        .long_os_version()
        .unwrap_or_else(|| "Unknown".to_string());
    let kernel = sys.kernel_version().unwrap_or_else(|| "".to_string());
    let cpu = sys.global_cpu_info();
    let cpu_model = cpu.brand().to_string();
    let cpu_cores = sys.cpus().len() as u32;
    let cpu_logical = sys
        .cpus()
        .len() as u32;
    let ram_total = sys.total_memory();

    let disks = Disks::new_with_refreshed_list();
    let disk_total: u64 = disks
        .iter()
        .map(|d| d.total_space())
        .sum();

    let payload = RegisterPayload {
        name: hostname.clone(),
        hostname,
        os: os_name,
        os_version: kernel,
        cpu_model,
        cpu_cores,
        cpu_logical,
        ram_total,
        disk_total,
        is_laptop: false,
    };

    let url = format!("{}/devices/register-public", api_url);
    match client.post(&url).json(&payload).send() {
        Ok(resp) => {
            let data: serde_json::Value = resp.json().ok()?;
            let device_token = data["deviceToken"].as_str()?.to_string();
            let device_id = data["device"]["id"].as_str()?.to_string();
            let token = DeviceToken {
                token: device_token,
                device_id,
                api_url: api_url.to_string(),
            };
            save_token(&token);
            println!("Device registered: {}", token.device_id);
            Some(token)
        }
        Err(e) => {
            eprintln!("Registration failed: {}", e);
            // Fallback: self-register with a random token
            let fallback_id = format!("dev-{}", rand::thread_rng().gen::<u64>());
            let token = DeviceToken {
                token: fallback_id.clone(),
                device_id: fallback_id,
                api_url: api_url.to_string(),
            };
            save_token(&token);
            println!("Using self-registered device token (server may reject)");
            Some(token)
        }
    }
}

fn collect_services() -> Vec<ServiceCheck> {
    let services_var = env::var("TF_SERVICES").unwrap_or_default();
    if services_var.is_empty() {
        return vec![];
    }

    let mut checks = Vec::new();
    for name in services_var.split(',') {
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        let status = match Command::new("systemctl")
            .args(["is-active", name])
            .output()
        {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                stdout
            }
            Err(_) => "unknown".to_string(),
        };
        checks.push(ServiceCheck {
            name: name.to_string(),
            status,
        });
    }
    checks
}

fn collect_metrics(sys: &mut System, token: &DeviceToken) -> MetricsPayload {
    // Refresh all data
    sys.refresh_cpu_specific(CpuRefreshKind::everything());
    sys.refresh_memory();
    sys.refresh_disks_list();
    sys.refresh_networks_list();
    sys.refresh_processes();

    let cpu = sys.global_cpu_info();
    let cpu_usage = cpu.cpu_usage();

    let memory_total = sys.total_memory();
    let memory_used = sys.used_memory();
    let memory_percent = if memory_total > 0 {
        (memory_used as f32 / memory_total as f32) * 100.0
    } else {
        0.0
    };

    // CPU load averages (fallback to sysinfo or 0)
    let load = sys.cpus();
    let cores = load.len() as f64;
    let load_avg_1 = 0.0; // sysinfo doesn't expose loadavg directly
    let load_avg_5 = 0.0;
    let load_avg_15 = 0.0;

    // Disk
    let disks = Disks::new_with_refreshed_list();
    let total_disk: u64 = disks.iter().map(|d| d.total_space()).sum();
    let used_disk: u64 = disks.iter().map(|d| d.total_space() - d.available_space()).sum();
    let mut read_bytes: u64 = 0;
    let mut write_bytes: u64 = 0;
    for disk in &disks {
        read_bytes += disk.usage().total_read_bytes;
        write_bytes += disk.usage().total_written_bytes;
    }

    // Network
    let networks = Networks::new_with_refreshed_list();
    let mut rx: u64 = 0;
    let mut tx: u64 = 0;
    for (_, net) in &networks {
        rx += net.total_received();
        tx += net.total_transmitted();
    }

    // Temperature - sysinfo doesn't expose component temps on Linux without effort
    let cpu_temp: f32 = 0.0;

    // Processes
    let proc_count = sys.processes().len() as u32;

    // Uptime
    let uptime = sys.uptime();

    let service_checks = collect_services();

    MetricsPayload {
        device_token: token.token.clone(),
        timestamp: Utc::now().to_rfc3339(),
        cpu: CpuMetrics {
            usage: cpu_usage,
            cores: cores as u32,
            load_average_1_min: load_avg_1,
            load_average_5_min: load_avg_5,
            load_average_15_min: load_avg_15,
        },
        memory: MemoryMetrics {
            total: memory_total,
            used: memory_used,
            percent: memory_percent,
        },
        disk: DiskMetrics {
            total: total_disk,
            used: used_disk,
            read_bytes,
            write_bytes,
        },
        temperatures: Temperatures { cpu: cpu_temp },
        network: NetworkMetrics {
            rx_bytes: rx,
            tx_bytes: tx,
        },
        processes: proc_count,
        uptime,
        services: service_checks,
    }
}

fn send_metrics(client: &Client, token: &DeviceToken) -> bool {
    let mut sys = System::new();
    let metrics = collect_metrics(&mut sys, token);

    let url = format!("{}/devices/metrics", token.api_url);
    match client.post(&url).json(&metrics).send() {
        Ok(resp) => {
            if resp.status().is_success() {
                println!(
                    "[{}] Metrics sent: CPU={:.1}% RAM={:.1}% Disk={:.1}%",
                    chrono::Local::now().format("%H:%M:%S"),
                    metrics.cpu.usage,
                    metrics.memory.percent,
                    if metrics.disk.total > 0 {
                        (metrics.disk.used as f64 / metrics.disk.total as f64) * 100.0
                    } else {
                        0.0
                    }
                );
                true
            } else {
                eprintln!("Metrics send failed: HTTP {}", resp.status());
                false
            }
        }
        Err(e) => {
            eprintln!("Metrics send error: {}", e);
            false
        }
    }
}

fn main() {
    println!("TechFusion AI Agent v{}", env!("CARGO_PKG_VERSION"));

    let api_url = env::var("TF_API_URL").unwrap_or_else(|_| "http://localhost:3001".to_string());
    let interval_secs: u64 = env::var("TF_INTERVAL")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_INTERVAL_SECS);

    println!("API URL: {}", api_url);
    println!("Interval: {}s", interval_secs);

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client");

    // Load or register device
    let token = load_token().or_else(|| register_device(&client, &api_url));

    match &token {
        Some(t) => println!("Device token loaded: {} ({})", t.device_id, t.token.chars().take(12).collect::<String>() + "..."),
        None => {
            eprintln!("Failed to register device, using ephemeral token");
        }
    }

    let effective_token = token.unwrap_or_else(|| DeviceToken {
        token: format!("ephemeral-{}", rand::thread_rng().gen::<u64>()),
        device_id: "unknown".to_string(),
        api_url: api_url.clone(),
    });

    // Main loop
    loop {
        send_metrics(&client, &effective_token);
        thread::sleep(Duration::from_secs(interval_secs));
    }
}

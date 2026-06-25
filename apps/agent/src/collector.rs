use chrono::Utc;
use serde::Serialize;
use sysinfo::{
    CpuRefreshKind, Disks, Networks, System,
};

#[derive(Debug, Clone, Serialize)]
pub struct SystemMetrics {
    pub hostname: String,
    pub os: String,
    pub os_version: String,
    pub cpu_usage_percent: f64,
    pub cpu_cores: u32,
    pub ram_used_bytes: u64,
    pub ram_total_bytes: u64,
    pub ram_usage_percent: f64,
    pub disk_used_bytes: u64,
    pub disk_total_bytes: u64,
    pub disk_usage_percent: f64,
    pub network_rx_bytes: u64,
    pub network_tx_bytes: u64,
    pub uptime_seconds: u64,
    pub process_count: u32,
    pub temperature_celsius: Option<f64>,
    pub battery_percent: Option<f64>,
    pub battery_charging: Option<bool>,
    pub timestamp: String,
}

pub struct MetricsCollector {
    system: System,
}

impl MetricsCollector {
    pub fn new() -> Self {
        Self {
            system: System::new_all(),
        }
    }

    pub fn collect(&mut self) -> SystemMetrics {
        self.system.refresh_cpu_specifics(CpuRefreshKind::everything());
        self.system.refresh_memory();
        self.system.refresh_processes();

        let hostname = System::host_name().unwrap_or_else(|| "unknown".to_string());
        let os = System::name().unwrap_or_else(|| "Unknown".to_string());
        let os_version = System::os_version()
            .or_else(|| System::kernel_version())
            .unwrap_or_else(|| "Unknown".to_string());

        let cpu_cores = self.system.cpus().len() as u32;
        let cpu_usage = self.system.global_cpu_info().cpu_usage() as f64;

        let ram_total = self.system.total_memory();
        let ram_used = self.system.used_memory();
        let ram_percent = if ram_total > 0 {
            (ram_used as f64 / ram_total as f64) * 100.0
        } else {
            0.0
        };

        let disks = Disks::new_with_refreshed_list();
        let disk_total: u64 = disks.iter().map(|d| d.total_space()).sum();
        let disk_used: u64 = disks
            .iter()
            .map(|d| d.total_space() - d.available_space())
            .sum();
        let disk_percent = if disk_total > 0 {
            (disk_used as f64 / disk_total as f64) * 100.0
        } else {
            0.0
        };

        let networks = Networks::new_with_refreshed_list();
        let mut rx: u64 = 0;
        let mut tx: u64 = 0;
        for (_, net) in &networks {
            rx += net.total_received();
            tx += net.total_transmitted();
        }

        let temperature = None;
        let battery_percent = None;
        let battery_charging = None;

        let proc_count = self.system.processes().len() as u32;
        let uptime = System::uptime();

        SystemMetrics {
            hostname,
            os,
            os_version,
            cpu_usage_percent: cpu_usage,
            cpu_cores,
            ram_used_bytes: ram_used,
            ram_total_bytes: ram_total,
            ram_usage_percent: ram_percent,
            disk_used_bytes: disk_used,
            disk_total_bytes: disk_total,
            disk_usage_percent: disk_percent,
            network_rx_bytes: rx,
            network_tx_bytes: tx,
            uptime_seconds: uptime,
            process_count: proc_count,
            temperature_celsius: temperature,
            battery_percent,
            battery_charging,
            timestamp: Utc::now().to_rfc3339(),
        }
    }
}

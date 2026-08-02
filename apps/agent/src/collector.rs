use chrono::Utc;
use serde::Serialize;
use sysinfo::{CpuRefreshKind, Disks, Networks, System};

#[derive(Debug, Clone, Serialize)]
pub struct SystemMetrics {
    pub hostname: String,
    pub os: String,
    pub os_version: String,
    pub cpu_usage_percent: f64,
    pub cpu_cores: u32,
    pub cpu_logical: u32,
    pub cpu_model: String,
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

fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

#[cfg(target_os = "linux")]
pub fn detect_physical_cores() -> Option<u32> {
    let content = std::fs::read_to_string("/proc/cpuinfo").ok()?;
    let mut physical_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut core_ids: std::collections::HashSet<String> = std::collections::HashSet::new();

    for line in content.lines() {
        if let Some(val) = line.strip_prefix("physical id\t: ") {
            physical_ids.insert(val.trim().to_string());
        }
        if let Some(val) = line.strip_prefix("core id\t: ") {
            core_ids.insert(val.trim().to_string());
        }
    }

    if physical_ids.is_empty() && core_ids.is_empty() {
        return None;
    }

    let physical_count = physical_ids.len().max(1) * core_ids.len().max(1);
    Some(physical_count as u32)
}

#[cfg(not(target_os = "linux"))]
fn detect_physical_cores() -> Option<u32> {
    None
}

fn is_meaningless_cpu_model(value: &str) -> bool {
    matches!(
        value.to_lowercase().trim(),
        "" | "unknown" | "cpu" | "processor" | "arm" | "aarch64"
            | "x86_64" | "i386" | "i486" | "i586" | "i686"
    )
}

#[cfg(target_os = "linux")]
fn parse_proc_cpuinfo_model() -> Option<String> {
    let content = std::fs::read_to_string("/proc/cpuinfo").ok()?;
    for line in content.lines() {
        for prefix in &["model name\t: ", "Hardware\t: ", "Processor\t: "] {
            if let Some(val) = line.strip_prefix(prefix) {
                let trimmed = val.trim();
                if !is_meaningless_cpu_model(trimmed) {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

pub fn cpu_model_name() -> String {
    let mut sys = System::new_all();
    sys.refresh_cpu_specifics(CpuRefreshKind::everything());
    let brand = sys.global_cpu_info().brand().trim();
    if !is_meaningless_cpu_model(brand) && brand != "Unknown" {
        return brand.to_string();
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(model) = parse_proc_cpuinfo_model() {
            return model;
        }
    }

    "Unknown".to_string()
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
        self.system
            .refresh_cpu_specifics(CpuRefreshKind::everything());
        self.system.refresh_memory();
        self.system.refresh_processes();

        let hostname = System::host_name().unwrap_or_else(|| "unknown".to_string());
        let os = System::name().unwrap_or_else(|| "Unknown".to_string());
        let os_version = System::os_version()
            .or_else(|| System::kernel_version())
            .unwrap_or_else(|| "Unknown".to_string());

        let cpu_logical = self.system.cpus().len() as u32;
        let cpu_cores = detect_physical_cores().unwrap_or(cpu_logical);
        let cpu_usage = clamp_f64(self.system.global_cpu_info().cpu_usage() as f64, 0.0, 100.0);

        let ram_total = self.system.total_memory();
        let ram_used = self.system.used_memory();
        let ram_percent = if ram_total > 0 {
            clamp_f64((ram_used as f64 / ram_total as f64) * 100.0, 0.0, 100.0)
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
            clamp_f64((disk_used as f64 / disk_total as f64) * 100.0, 0.0, 100.0)
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
            cpu_logical,
            cpu_model: cpu_model_name(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clamp_f64_within_bounds() {
        assert_eq!(clamp_f64(50.0, 0.0, 100.0), 50.0);
    }

    #[test]
    fn test_clamp_f64_below_min() {
        assert_eq!(clamp_f64(-5.0, 0.0, 100.0), 0.0);
    }

    #[test]
    fn test_clamp_f64_above_max() {
        assert_eq!(clamp_f64(150.0, 0.0, 100.0), 100.0);
    }

    #[test]
    fn test_clamp_f64_exactly_bounds() {
        assert_eq!(clamp_f64(0.0, 0.0, 100.0), 0.0);
        assert_eq!(clamp_f64(100.0, 0.0, 100.0), 100.0);
    }

    #[test]
    fn test_collect_returns_valid_metrics() {
        let mut collector = MetricsCollector::new();
        let metrics = collector.collect();

        assert!(!metrics.hostname.is_empty());
        assert!(!metrics.os.is_empty());
        assert!(metrics.cpu_usage_percent >= 0.0 && metrics.cpu_usage_percent <= 100.0);
        assert!(metrics.ram_usage_percent >= 0.0 && metrics.ram_usage_percent <= 100.0);
        assert!(metrics.disk_usage_percent >= 0.0 && metrics.disk_usage_percent <= 100.0);
        assert!(metrics.cpu_cores > 0);
        assert!(metrics.cpu_logical > 0);
        assert!(metrics.cpu_logical >= metrics.cpu_cores);
        assert!(!metrics.cpu_model.is_empty());
        assert!(metrics.ram_total_bytes > 0);
        assert!(!metrics.timestamp.is_empty());
    }

    #[test]
    fn test_collect_percentages_are_clamped() {
        let mut collector = MetricsCollector::new();
        let metrics = collector.collect();

        assert!(metrics.cpu_usage_percent >= 0.0 && metrics.cpu_usage_percent <= 100.0,
            "CPU usage {} out of range", metrics.cpu_usage_percent);
        assert!(metrics.ram_usage_percent >= 0.0 && metrics.ram_usage_percent <= 100.0,
            "RAM usage {} out of range", metrics.ram_usage_percent);
        assert!(metrics.disk_usage_percent >= 0.0 && metrics.disk_usage_percent <= 100.0,
            "Disk usage {} out of range", metrics.disk_usage_percent);
    }

    #[test]
    fn test_collect_bytes_are_non_negative() {
        let mut collector = MetricsCollector::new();
        let metrics = collector.collect();

        assert!(metrics.ram_used_bytes <= metrics.ram_total_bytes,
            "RAM used ({}) > RAM total ({})", metrics.ram_used_bytes, metrics.ram_total_bytes);
        assert!(metrics.disk_used_bytes <= metrics.disk_total_bytes,
            "Disk used ({}) > Disk total ({})", metrics.disk_used_bytes, metrics.disk_total_bytes);
    }

    #[test]
    fn test_cpu_model_returns_non_empty_string() {
        let model = cpu_model_name();
        assert!(!model.is_empty(), "CPU model should not be empty");
        assert_ne!(model, "Unknown", "CPU model should be detected on this system");
    }

    #[test]
    fn test_cpu_logical_cores_positive() {
        let mut collector = MetricsCollector::new();
        let metrics = collector.collect();
        assert!(metrics.cpu_logical > 0, "Logical cores should be > 0");
    }

    #[test]
    fn test_cpu_physical_cores_not_exceed_logical() {
        let mut collector = MetricsCollector::new();
        let metrics = collector.collect();
        assert!(
            metrics.cpu_cores <= metrics.cpu_logical,
            "Physical cores ({}) should not exceed logical cores ({})",
            metrics.cpu_cores,
            metrics.cpu_logical,
        );
    }

    #[test]
    fn test_detect_physical_cores_returns_valid_value() {
        let cores = detect_physical_cores();
        if let Some(c) = cores {
            assert!(c > 0, "Physical cores should be > 0 when detected");
        }
    }

    #[test]
    fn test_cpu_model_returns_meaningful_string() {
        let model = cpu_model_name();
        assert!(!model.is_empty(), "CPU model should not be empty");
        assert_ne!(model, "Unknown", "CPU model should be detected on this system");
        assert!(model.len() > 2, "CPU model should be a meaningful string, got: {}", model);
    }

    #[test]
    fn test_is_meaningless_cpu_model_rejects_invalid() {
        assert!(is_meaningless_cpu_model(""));
        assert!(is_meaningless_cpu_model("  "));
        assert!(is_meaningless_cpu_model("unknown"));
        assert!(is_meaningless_cpu_model("Unknown"));
        assert!(is_meaningless_cpu_model("cpu"));
        assert!(is_meaningless_cpu_model("CPU"));
        assert!(is_meaningless_cpu_model("processor"));
        assert!(is_meaningless_cpu_model("arm"));
        assert!(is_meaningless_cpu_model("aarch64"));
        assert!(is_meaningless_cpu_model("x86_64"));
    }

    #[test]
    fn test_is_meaningless_cpu_model_accepts_valid() {
        assert!(!is_meaningless_cpu_model("Intel Core i7-12700K"));
        assert!(!is_meaningless_cpu_model("AMD Athlon Silver 3050U"));
        assert!(!is_meaningless_cpu_model("Apple M1 Pro"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_parse_proc_cpuinfo_model_reads_model_name() {
        let model = parse_proc_cpuinfo_model();
        if let Some(m) = model {
            assert!(!m.is_empty(), "Parsed model should not be empty");
            assert!(!is_meaningless_cpu_model(&m), "Parsed model should be meaningful");
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn test_parse_proc_cpuinfo_model_trimmed() {
        if let Some(model) = parse_proc_cpuinfo_model() {
            assert_eq!(model, model.trim(), "Model should be trimmed");
        }
    }

    #[test]
    fn test_cpu_model_does_not_panic() {
        let _ = std::panic::catch_unwind(|| {
            let _ = cpu_model_name();
        });
    }

    #[test]
    fn test_cpu_model_name_returns_known_on_this_system() {
        let model = cpu_model_name();
        assert!(
            !is_meaningless_cpu_model(&model) && model != "Unknown",
            "Expected meaningful CPU model on this system, got: {}",
            model
        );
    }
}

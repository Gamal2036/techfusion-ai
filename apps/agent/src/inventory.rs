use serde::Serialize;
use std::process::Command;

#[derive(Serialize, Clone, Debug)]
pub struct DriverEntry {
    pub name: String,
    pub vendor: Option<String>,
    pub version: Option<String>,
    pub module_path: Option<String>,
    pub used_by: Option<String>,
    pub source: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct SoftwareEntry {
    pub name: String,
    pub version: Option<String>,
    pub vendor: Option<String>,
    pub install_date: Option<String>,
    pub description: Option<String>,
    pub source: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct InventoryReport {
    pub drivers: Vec<DriverEntry>,
    pub software: Vec<SoftwareEntry>,
    pub driver_count: usize,
    pub software_count: usize,
}

fn run_cmd(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn run_cmd_no_check(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn enumerate_loaded_modules() -> Vec<DriverEntry> {
    let mut drivers = Vec::new();
    let output = run_cmd("lsmod", &[]);
    if let Some(out) = output {
        for line in out.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }
            let name = parts[0].to_string();
            let used_by = if parts.len() > 2 {
                Some(parts[2..].join(" "))
            } else {
                None
            };

            let version = run_cmd("modinfo", &["-F", "version", &name]);
            let description = run_cmd("modinfo", &["-F", "description", &name]);
            let module_path = run_cmd("modinfo", &["-n", &name]);
            let author = run_cmd("modinfo", &["-F", "author", &name]);

            drivers.push(DriverEntry {
                vendor: author,
                version,
                name,
                module_path,
                used_by,
                source: "kernel_module".to_string(),
            });
        }
    }
    drivers
}

fn enumerate_pci_usb_devices() -> Vec<DriverEntry> {
    let mut drivers = Vec::new();
    if let Some(out) = run_cmd("lspci", &["-k"]) {
        let mut current_device: Option<String> = None;
        let mut current_vendor: Option<String> = None;
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if !trimmed.starts_with("Kernel ") {
                let parts: Vec<&str> = trimmed.splitn(2, ' ').collect();
                if parts.len() >= 2 {
                    let rest = parts[1].to_string();
                    let vendor_info: Option<String> = rest.split(':').next().map(|s| s.trim().to_string());
                    current_device = Some(rest.clone());
                    current_vendor = vendor_info;
                }
            } else if trimmed.starts_with("Kernel driver in use:") {
                let name = trimmed.trim_start_matches("Kernel driver in use:").trim().to_string();
                drivers.push(DriverEntry {
                    vendor: current_vendor.clone(),
                    version: None,
                    name: name.clone(),
                    module_path: current_device.clone(),
                    used_by: current_device.clone(),
                    source: "pci".to_string(),
                });
            } else if trimmed.starts_with("Kernel modules:") {
                let modules_str = trimmed.trim_start_matches("Kernel modules:").trim();
                for mod_name in modules_str.split(',') {
                    let name = mod_name.trim().to_string();
                    if name.is_empty() {
                        continue;
                    }
                    let version = run_cmd("modinfo", &["-F", "version", &name]);
                    drivers.push(DriverEntry {
                        vendor: current_vendor.clone(),
                        version,
                        name,
                        module_path: current_device.clone(),
                        used_by: current_device.clone(),
                        source: "pci_module".to_string(),
                    });
                }
            }
        }
    }

    if let Some(out) = run_cmd("lsusb", &[]) {
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.contains("Driver=") {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                for part in &parts {
                    if part.starts_with("Driver=") {
                        let name = part.trim_start_matches("Driver=").to_string();
                        if !name.is_empty() && !drivers.iter().any(|d| d.name == name && d.source == "usb") {
                            drivers.push(DriverEntry {
                                vendor: None,
                                version: None,
                                name,
                                module_path: Some(trimmed.to_string()),
                                used_by: Some(trimmed.to_string()),
                                source: "usb".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    drivers
}

fn enumerate_dkms_drivers() -> Vec<DriverEntry> {
    let mut drivers = Vec::new();
    if let Some(out) = run_cmd_no_check("dkms", &["status"]) {
        for line in out.lines() {
            let parts: Vec<&str> = line.split('/').collect();
            if parts.len() >= 2 {
                let name = parts[0].trim().to_string();
                let rest = parts[1];
                let version_parts: Vec<&str> = rest.split_whitespace().collect();
                let version = version_parts.first().map(|s| s.to_string());
                drivers.push(DriverEntry {
                    vendor: None,
                    version,
                    name,
                    module_path: None,
                    used_by: None,
                    source: "dkms".to_string(),
                });
            }
        }
    }
    drivers
}

fn enumerate_deb_packages() -> Vec<SoftwareEntry> {
    let mut software = Vec::new();
    if let Some(out) = run_cmd("dpkg-query", &["-W", "-f=${Package}\t${Version}\t${Maintainer}\t${Installed-Size}\t${Description}\n"]) {
        for line in out.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() < 2 {
                continue;
            }
            let name = parts[0].to_string();
            let version = Some(parts[1].to_string());
            let vendor = if parts.len() > 2 {
                let m = parts[2].to_string();
                m.split('<').next().map(|s| s.trim().to_string())
            } else {
                None
            };
            let description = if parts.len() > 4 {
                Some(parts[4].to_string())
            } else {
                None
            };
            let install_date = run_cmd_no_check("stat", &["-c", "%y", &format!("/var/lib/dpkg/info/{}.list", name)]);

            software.push(SoftwareEntry {
                name,
                version,
                vendor,
                install_date,
                description,
                source: "deb".to_string(),
            });
        }
    }
    software
}

fn enumerate_apt_packages() -> Vec<SoftwareEntry> {
    let mut software = Vec::new();
    if let Some(out) = run_cmd("apt", &["list", "--installed", "2>/dev/null"]) {
        for line in out.lines() {
            if !line.contains('/') {
                continue;
            }
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.is_empty() {
                continue;
            }
            let pkg_part = parts[0];
            let mut name = pkg_part.to_string();
            let mut version: Option<String> = None;

            if let Some(slash_pos) = pkg_part.find('/') {
                name = pkg_part[..slash_pos].to_string();
                if let Some(ver_part) = parts.get(1) {
                    version = Some(ver_part.to_string());
                }
            }

            if !software.iter().any(|s: &SoftwareEntry| s.name == name) {
                software.push(SoftwareEntry {
                    vendor: None,
                    version,
                    name,
                    install_date: None,
                    description: None,
                    source: "apt".to_string(),
                });
            }
        }
    }
    software
}

fn enumerate_snap_packages() -> Vec<SoftwareEntry> {
    let mut software = Vec::new();
    if let Some(out) = run_cmd_no_check("snap", &["list"]) {
        for line in out.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let version = Some(parts[1].to_string());
                let vendor = if parts.len() > 4 {
                    Some(parts[4].trim_matches('*').to_string())
                } else {
                    None
                };
                if !software.iter().any(|s: &SoftwareEntry| s.name == name && s.source == "snap") {
                    software.push(SoftwareEntry {
                        vendor,
                        version,
                        name,
                        install_date: None,
                        description: None,
                        source: "snap".to_string(),
                    });
                }
            }
        }
    }
    software
}

fn enumerate_flatpak_packages() -> Vec<SoftwareEntry> {
    let mut software = Vec::new();
    if let Some(out) = run_cmd_no_check("flatpak", &["list", "--columns=application,version,origin,installation"]) {
        for line in out.lines().skip(1) {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let parts: Vec<&str> = trimmed.split('\t').collect();
            if parts.is_empty() {
                continue;
            }
            let name = parts[0].trim().to_string();
            let version = parts.get(1).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
            let vendor = parts.get(2).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
            if !software.iter().any(|s: &SoftwareEntry| s.name == name && s.source == "flatpak") {
                software.push(SoftwareEntry {
                    vendor,
                    version,
                    name,
                    install_date: None,
                    description: None,
                    source: "flatpak".to_string(),
                });
            }
        }
    }
    software
}

fn enumerate_pip_packages() -> Vec<SoftwareEntry> {
    let mut software = Vec::new();
    if let Some(out) = run_cmd_no_check("pip3", &["list", "--format=freeze"]) {
        for line in out.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.contains("==") {
                let eq_pos = trimmed.find("==");
                if let Some(pos) = eq_pos {
                    let name = trimmed[..pos].to_string();
                    let version = Some(trimmed[pos + 2..].to_string());
                    if !software.iter().any(|s: &SoftwareEntry| s.name == name && s.source == "pip") {
                        software.push(SoftwareEntry {
                            vendor: None,
                            version,
                            name,
                            install_date: None,
                            description: None,
                            source: "pip".to_string(),
                        });
                    }
                }
            }
        }
    }
    software
}

pub fn collect_inventory() -> InventoryReport {
    let mut all_drivers: Vec<DriverEntry> = Vec::new();
    let mut all_software: Vec<SoftwareEntry> = Vec::new();

    all_drivers.extend(enumerate_loaded_modules());
    all_drivers.extend(enumerate_pci_usb_devices());
    all_drivers.extend(enumerate_dkms_drivers());

    let mut seen_drivers = std::collections::HashSet::new();
    all_drivers.retain(|d| seen_drivers.insert(d.name.clone()));

    all_software.extend(enumerate_deb_packages());
    all_software.extend(enumerate_apt_packages());
    all_software.extend(enumerate_snap_packages());
    all_software.extend(enumerate_flatpak_packages());
    all_software.extend(enumerate_pip_packages());

    let mut seen_software = std::collections::HashSet::new();
    all_software.retain(|s| seen_software.insert(s.name.clone()));

    all_drivers.sort_by(|a, b| a.name.cmp(&b.name));
    all_software.sort_by(|a, b| a.name.cmp(&b.name));

    let driver_count = all_drivers.len();
    let software_count = all_software.len();

    InventoryReport {
        drivers: all_drivers,
        software: all_software,
        driver_count,
        software_count,
    }
}

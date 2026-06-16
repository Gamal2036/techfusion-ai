use serde::Serialize;
use std::net::IpAddr;
use std::process::Command;
use std::time::{Duration, Instant};

#[derive(Serialize, Clone, Debug)]
pub struct DiscoveredDevice {
    pub ip: String,
    pub mac: String,
    pub hostname: Option<String>,
    pub vendor: Option<String>,
    pub interface: String,
    pub source: String,
    pub reachable: bool,
    pub latency_ms: Option<f64>,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiscoveryResult {
    pub gateway_ip: Option<String>,
    pub gateway_mac: Option<String>,
    pub local_ip: Option<String>,
    pub local_mac: Option<String>,
    pub subnet: Option<String>,
    pub devices: Vec<DiscoveredDevice>,
    pub scan_duration_ms: u64,
    pub device_count: usize,
}

fn run_cmd(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn get_local_ip_and_subnet() -> Option<(String, String, String)> {
    let output = run_cmd("ip", &["-4", "addr", "show", "scope", "global"])?;
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("inet ") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                let cidr = parts[1];
                if let Some(ip) = cidr.split('/').next() {
                    return Some((ip.to_string(), cidr.to_string(), parts.last().unwrap_or(&"").to_string()));
                }
            }
        }
    }
    None
}

fn get_local_mac(interface: &str) -> Option<String> {
    let path = format!("/sys/class/net/{}/address", interface);
    std::fs::read_to_string(&path).ok().map(|s| s.trim().to_string())
}

fn get_gateway() -> Option<(String, String)> {
    let output = run_cmd("ip", &["route", "show", "default"])?;
    for line in output.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[0] == "default" {
            let gw_ip = parts[2].to_string();
            let iface = if parts.len() > 4 { parts[4].to_string() } else { String::new() };
            return Some((gw_ip, iface));
        }
    }
    None
}

fn arp_table_lookup(ip: &str) -> Option<String> {
    let content = std::fs::read_to_string("/proc/net/arp").ok()?;
    for line in content.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 && parts[0] == ip {
            let mac = parts[3].to_uppercase();
            if mac != "00:00:00:00:00:00" {
                return Some(mac);
            }
        }
    }
    None
}

fn read_arp_table() -> Vec<(String, String)> {
    let mut entries = Vec::new();
    if let Ok(content) = std::fs::read_to_string("/proc/net/arp") {
        for line in content.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let ip = parts[0].to_string();
                let mac = parts[3].to_uppercase();
                if mac != "00:00:00:00:00:00" && !mac.is_empty() {
                    entries.push((ip, mac));
                }
            }
        }
    }
    entries
}

fn resolve_hostname(ip: &str) -> Option<String> {
    run_cmd("host", &[ip]).or_else(|| run_cmd("nslookup", &[ip]))
}

fn resolve_vendor(mac: &str) -> Option<String> {
    let oui = mac.replace(':', "").to_uppercase();
    if oui.len() < 6 {
        return None;
    }
    let prefix = &oui[..6];
    let vendors = [
        ("00037F", "Cisco"),
        ("000C29", "VMware"),
        ("005056", "VMware"),
        ("000569", "VMware"),
        ("001C42", "Parallels"),
        ("00163E", "Xen"),
        ("000000", "Broadcast"),
        ("00037F", "Cisco Systems"),
        ("000FF3", "Cisco Systems"),
        ("001B54", "Cisco Systems"),
        ("00215A", "Cisco Systems"),
        ("00137A", "Hewlett-Packard"),
        ("0024BE", "Hewlett-Packard"),
        ("0030C1", "Hewlett-Packard"),
        ("08002B", "DEC/Intel/Xerox"),
        ("080009", "Xerox"),
        ("0001E6", "Dell"),
        ("00188B", "Dell"),
        ("0021F7", "Dell"),
        ("F8BC12", "Dell"),
        ("F04DA2", "Dell"),
        ("000C6E", "NetApp"),
        ("001517", "Apple"),
        ("00236C", "Apple"),
        ("047591", "Apple"),
        ("14726B", "Apple"),
        ("58723A", "Apple"),
        ("848506", "Apple"),
        ("A8BA31", "Apple"),
        ("B0B448", "Apple"),
        ("C81EE7", "Apple"),
        ("F0C1F1", "Apple"),
        ("5CF5DA", "Samsung"),
        ("001D4F", "Samsung"),
        ("A47733", "Samsung"),
        ("BCD9C1", "Samsung"),
        ("000F3D", "Intel"),
        ("0023AE", "Intel"),
        ("0050B6", "Intel"),
        ("080020", "Intel"),
        ("001111", "Intel"),
        ("001B21", "Intel"),
        ("00237D", "Intel"),
        ("5404A6", "Intel"),
        ("100000", "Intel"),
        ("001348", "ASUS"),
        ("0022B0", "ASUS"),
        ("080046", "Mitsubishi"),
        ("0000A6", "Netgear"),
        ("0022B0", "ASUS"),
        ("080002", "3Com"),
        ("0002B3", "3Com"),
        ("00904C", "TP-Link"),
        ("14CF92", "TP-Link"),
        ("50C7BF", "TP-Link"),
        ("54E43A", "TP-Link"),
        ("94D9B3", "TP-Link"),
        ("A8FB70", "TP-Link"),
        ("D0154A", "TP-Link"),
        ("F81A67", "TP-Link"),
        ("FC75E4", "TP-Link"),
        ("AC84C6", "TP-Link"),
        ("001E52", "Huawei"),
        ("00259E", "Huawei"),
        ("0C9D92", "Huawei"),
        ("18A9E0", "Huawei"),
        ("1C59C0", "Huawei"),
        ("6C92BF", "Huawei"),
        ("70B3D5", "Huawei"),
        ("78A2A0", "Huawei"),
        ("E88DF5", "Huawei"),
        ("E0ED1E", "Huawei"),
        ("001A2F", "Microsoft"),
        ("002248", "Microsoft"),
        ("0050F2", "Microsoft"),
        ("1820A8", "Microsoft"),
        ("207BF4", "Xbox"),
        ("48D539", "Synology"),
        ("001132", "Synology"),
        ("90B1E0", "Raspberry Pi"),
        ("B827EB", "Raspberry Pi"),
        ("28B2BD", "Aruba"),
        ("0C8DDB", "Aruba"),
        ("DCA632", "Aruba"),
        ("0021D8", "Ubiquiti"),
        ("04A151", "Ubiquiti"),
        ("18E829", "Ubiquiti"),
        ("24A43C", "Ubiquiti"),
        ("44D9E7", "Ubiquiti"),
        ("68D247", "Ubiquiti"),
        ("78F2E4", "Ubiquiti"),
        ("DEB53E", "Ubiquiti"),
        ("E063DA", "Ubiquiti"),
        ("F0911B", "Ubiquiti"),
        ("000423", "Juniper"),
        ("001D4B", "Juniper"),
    ];
    for (oui_prefix, vendor_name) in vendors {
        if prefix.starts_with(oui_prefix) || oui_prefix.starts_with(prefix) {
            return Some(vendor_name.to_string());
        }
    }
    None
}

fn ping_host(ip: &str) -> Option<f64> {
    let start = Instant::now();
    let output = Command::new("ping")
        .args(["-c", "1", "-W", "1", ip])
        .output()
        .ok()?;
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;
    if output.status.success() {
        Some(elapsed)
    } else {
        None
    }
}

fn icmp_sweep(subnet_cidr: &str) -> Vec<(String, f64)> {
    let mut reachable = Vec::new();
    let parts: Vec<&str> = subnet_cidr.split('/').collect();
    if parts.len() != 2 {
        return reachable;
    }
    let ip_str = parts[0];
    let prefix_len: u32 = match parts[1].parse() {
        Ok(n) => n,
        Err(_) => return reachable,
    };
    if prefix_len >= 32 || prefix_len < 16 {
        return reachable;
    }

    let ip_parts: Vec<&str> = ip_str.split('.').collect();
    if ip_parts.len() != 4 {
        return reachable;
    }
    let base: Vec<u32> = ip_parts.iter().filter_map(|p| p.parse().ok()).collect();
    if base.len() != 4 {
        return reachable;
    }

    let host_count = 1u32 << (32 - prefix_len);
    if host_count > 512 {
        return reachable;
    }

    let hosts: Vec<String> = (1..host_count.saturating_sub(1))
        .map(|i| {
            let ip_num = (base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3];
            let host_num = (ip_num & !(host_count - 1)) | i;
            format!(
                "{}.{}.{}.{}",
                (host_num >> 24) & 0xFF,
                (host_num >> 16) & 0xFF,
                (host_num >> 8) & 0xFF,
                host_num & 0xFF
            )
        })
        .collect();

    for ip in hosts {
        if let Some(latency) = ping_host(&ip) {
            reachable.push((ip, latency));
        }
    }
    reachable
}

fn get_local_device_info() -> (Option<String>, Option<String>) {
    let hostname = run_cmd("hostname", &[]);
    let mac = run_cmd("cat", &["/sys/class/net/$(ip route show default | awk '{print $5}')/address"])
        .or_else(|| {
            std::fs::read_dir("/sys/class/net").ok().and_then(|entries| {
                for entry in entries.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if name != "lo" {
                            if let Ok(content) = std::fs::read_to_string(format!("/sys/class/net/{}/address", name)) {
                                let mac = content.trim().to_uppercase();
                                if !mac.is_empty() {
                                    return Some(mac);
                                }
                            }
                        }
                    }
                }
                None
            })
        });
    (hostname, mac)
}

pub fn discover_network() -> DiscoveryResult {
    let start = Instant::now();

    let (local_ip, subnet, iface_name) = get_local_ip_and_subnet().unwrap_or_default();
    let local_mac = if !iface_name.is_empty() {
        get_local_mac(&iface_name)
    } else {
        None
    };
    let (gateway_ip, gateway_iface) = get_gateway().unwrap_or_default();
    let gateway_mac = if !gateway_ip.is_empty() {
        arp_table_lookup(&gateway_ip)
    } else {
        None
    };

    let (local_hostname, local_mac_fallback) = get_local_device_info();
    let local_mac = local_mac.or(local_mac_fallback);

    let mut devices: Vec<DiscoveredDevice> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    let arp_entries = read_arp_table();
    for (ip, mac) in &arp_entries {
        if seen.contains(ip) {
            continue;
        }
        seen.insert(ip.clone());
        let hostname = resolve_hostname(ip);
        let vendor = resolve_vendor(mac);
        let latency = ping_host(ip);
        devices.push(DiscoveredDevice {
            ip: ip.clone(),
            mac: mac.clone(),
            hostname,
            vendor,
            interface: iface_name.clone(),
            source: "arp".to_string(),
            reachable: latency.is_some(),
            latency_ms: latency,
        });
    }

    if !subnet.is_empty() {
        let sweep_results = icmp_sweep(&subnet);
        for (ip, latency) in &sweep_results {
            if seen.contains(ip) {
                continue;
            }
            seen.insert(ip.clone());
            let mac = arp_table_lookup(ip).unwrap_or_else(|| "00:00:00:00:00:00".to_string());
            let hostname = resolve_hostname(ip);
            let vendor = if mac != "00:00:00:00:00:00" {
                resolve_vendor(&mac)
            } else {
                None
            };
            devices.push(DiscoveredDevice {
                ip: ip.clone(),
                mac,
                hostname,
                vendor,
                interface: iface_name.clone(),
                source: "icmp".to_string(),
                reachable: true,
                latency_ms: Some(*latency),
            });
        }
    }

    devices.sort_by(|a, b| {
        let a_parts: Vec<u32> = a.ip.split('.').filter_map(|p| p.parse().ok()).collect();
        let b_parts: Vec<u32> = b.ip.split('.').filter_map(|p| p.parse().ok()).collect();
        a_parts.cmp(&b_parts)
    });

    let elapsed = start.elapsed().as_millis() as u64;

    DiscoveryResult {
        gateway_ip: Some(gateway_ip),
        gateway_mac,
        local_ip: Some(local_ip),
        local_mac,
        subnet: Some(subnet),
        device_count: devices.len(),
        devices,
        scan_duration_ms: elapsed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_vendor_known_ouis() {
        assert_eq!(resolve_vendor("B8:27:EB:12:34:56"), Some("Raspberry Pi".to_string()));
    }

    #[test]
    fn test_resolve_vendor_unknown_oui() {
        assert_eq!(resolve_vendor("AA:BB:CC:DD:EE:FF"), None);
    }

    #[test]
    fn test_resolve_vendor_vmware_ouis() {
        assert_eq!(resolve_vendor("00:0C:29:AB:CD:EF"), Some("VMware".to_string()));
        assert_eq!(resolve_vendor("00:50:56:AB:CD:EF"), Some("VMware".to_string()));
    }

    #[test]
    fn test_resolve_vendor_apple() {
        assert_eq!(resolve_vendor("00:23:6C:AB:CD:EF"), Some("Apple".to_string()));
    }

    #[test]
    fn test_resolve_vendor_cisco() {
        assert_eq!(resolve_vendor("00:03:7F:AB:CD:EF"), Some("Cisco Systems".to_string()));
    }
}

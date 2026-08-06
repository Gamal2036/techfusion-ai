use serde::Serialize;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};
use tracing::{debug, info, warn};

const PER_HOST_PING_TIMEOUT: Duration = Duration::from_millis(800);
const DNS_TIMEOUT: Duration = Duration::from_secs(2);
const CMD_TIMEOUT: Duration = Duration::from_secs(3);
const OVERALL_TIMEOUT: Duration = Duration::from_secs(55);
const MAX_HOSTS: usize = 254;
const MAX_CONCURRENT_PING: usize = 16;

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

fn run_cmd(cmd: &str, args: &[&str], timeout: Duration) -> Option<String> {
    let mut child = match Command::new(cmd)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            debug!("[CMD] Failed to spawn {} {:?}: {}", cmd, args, e);
            return None;
        }
    };

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                let output = match child.wait_with_output() {
                    Ok(o) => o,
                    Err(_) => return None,
                };
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !stdout.is_empty() {
                        return Some(stdout);
                    }
                }
                return None;
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    debug!("[CMD] Timed out after {:?}: {} {:?}", timeout, cmd, args);
                    return None;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                debug!("[CMD] Error waiting for {} {:?}: {}", cmd, args, e);
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
}

fn is_private_subnet(ip_str: &str, prefix_len: u32) -> bool {
    let parts: Vec<&str> = ip_str.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    let octets: Vec<u32> = parts.iter().filter_map(|p| p.parse().ok()).collect();
    if octets.len() != 4 {
        return false;
    }
    let a = octets[0];
    let b = octets[1];

    if prefix_len >= 32 {
        return false;
    }

    if a == 10 {
        return true;
    }
    if a == 172 && b >= 16 && b <= 31 {
        return true;
    }
    if a == 192 && b == 168 {
        return true;
    }
    false
}

fn get_local_ip_and_subnet() -> Option<(String, String, String)> {
    let output = run_cmd(
        "ip",
        &["-4", "addr", "show", "scope", "global"],
        CMD_TIMEOUT,
    )?;
    let mut last_ip = None;
    let mut last_cidr = None;
    let mut last_iface = None;

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("inet ") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() >= 2 {
                let cidr = parts[1];
                if let Some(ip) = cidr.split('/').next() {
                    let prefix: u32 = cidr
                        .split('/')
                        .nth(1)
                        .and_then(|p| p.parse().ok())
                        .unwrap_or(32);

                    if is_private_subnet(ip, prefix) {
                        last_ip = Some(ip.to_string());
                        last_cidr = Some(cidr.to_string());
                        last_iface = Some(parts.last().unwrap_or(&"").to_string());
                    }
                }
            }
        }
    }

    if let (Some(ip), Some(cidr), Some(iface)) = (last_ip, last_cidr, last_iface) {
        Some((ip, cidr, iface))
    } else {
        None
    }
}

fn get_local_mac(interface: &str) -> Option<String> {
    let path = format!("/sys/class/net/{}/address", interface);
    std::fs::read_to_string(&path)
        .ok()
        .map(|s| s.trim().to_string())
}

fn get_gateway() -> Option<(String, String)> {
    let output = run_cmd("ip", &["route", "show", "default"], CMD_TIMEOUT)?;
    for line in output.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 && parts[0] == "default" {
            let gw_ip = parts[2].to_string();
            let iface = if parts.len() > 4 {
                parts[4].to_string()
            } else {
                String::new()
            };
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
    run_cmd("host", &[ip], DNS_TIMEOUT).or_else(|| run_cmd("nslookup", &[ip], DNS_TIMEOUT))
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
    let child = Command::new("ping")
        .args(["-c", "1", "-W", "1", "-q", "--", ip])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;

    let mut child = child;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let elapsed = start.elapsed().as_secs_f64() * 1000.0;
                if status.success() {
                    return Some(elapsed);
                }
                return None;
            }
            Ok(None) => {
                if start.elapsed() > PER_HOST_PING_TIMEOUT {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                std::thread::sleep(Duration::from_millis(30));
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
}

fn generate_subnet_hosts(subnet_cidr: &str) -> Option<Vec<String>> {
    let parts: Vec<&str> = subnet_cidr.split('/').collect();
    if parts.len() != 2 {
        return None;
    }
    let ip_str = parts[0];
    let prefix_len: u32 = parts[1].parse().ok()?;

    if prefix_len >= 32 || prefix_len < 24 {
        return None;
    }

    let ip_parts: Vec<&str> = ip_str.split('.').collect();
    if ip_parts.len() != 4 {
        return None;
    }
    let base: Vec<u32> = ip_parts.iter().filter_map(|p| p.parse().ok()).collect();
    if base.len() != 4 {
        return None;
    }

    let host_count = 1u32 << (32 - prefix_len);
    if host_count == 0 || (host_count as usize) > MAX_HOSTS + 2 {
        warn!(
            "[DISCOVERY] Subnet {} has {} hosts, exceeding max {}. Skipping ICMP sweep.",
            subnet_cidr,
            host_count.saturating_sub(2),
            MAX_HOSTS
        );
        return None;
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

    Some(hosts)
}

fn concurrent_icmp_sweep(hosts: Vec<String>, deadline: Instant) -> Vec<(String, f64)> {
    let reachable: std::sync::Mutex<Vec<(String, f64)>> = std::sync::Mutex::new(Vec::new());
    let active_count = AtomicUsize::new(0);
    let _total = hosts.len();

    for chunk in hosts.chunks(MAX_CONCURRENT_PING) {
        if deadline.elapsed() > OVERALL_TIMEOUT {
            warn!("[DISCOVERY] ICMP sweep deadline exceeded, stopping early");
            break;
        }

        std::thread::scope(|s| {
            for ip in chunk {
                if deadline.elapsed() > OVERALL_TIMEOUT {
                    break;
                }

                while active_count.load(Ordering::Relaxed) >= MAX_CONCURRENT_PING {
                    std::thread::sleep(Duration::from_millis(5));
                    if deadline.elapsed() > OVERALL_TIMEOUT {
                        break;
                    }
                }

                if deadline.elapsed() > OVERALL_TIMEOUT {
                    break;
                }

                active_count.fetch_add(1, Ordering::Relaxed);
                let ip = ip.clone();
                let active_ref = &active_count;
                let reachable_ref = &reachable;

                s.spawn(move || {
                    let result = ping_host(&ip);
                    active_ref.fetch_sub(1, Ordering::Relaxed);
                    if let Some(latency) = result {
                        reachable_ref.lock().unwrap().push((ip, latency));
                    }
                });
            }
        });
    }

    let scanned = active_count.load(Ordering::Relaxed);
    if scanned > 0 {
        debug!(
            "[DISCOVERY] Waiting for {} active pings to finish...",
            scanned
        );
    }

    reachable.into_inner().unwrap()
}

fn get_local_device_info() -> (Option<String>, Option<String>) {
    let hostname = run_cmd("hostname", &[], CMD_TIMEOUT);
    let mac = run_cmd(
        "cat",
        &["/sys/class/net/$(ip route show default | awk '{print $5}')/address"],
        CMD_TIMEOUT,
    )
    .or_else(|| {
        std::fs::read_dir("/sys/class/net")
            .ok()
            .and_then(|entries| {
                for entry in entries.flatten() {
                    if let Ok(name) = entry.file_name().into_string() {
                        if name != "lo" {
                            if let Ok(content) =
                                std::fs::read_to_string(format!("/sys/class/net/{}/address", name))
                            {
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
    let deadline = start + OVERALL_TIMEOUT;

    info!("[DISCOVERY] Discovery started");

    info!("[DISCOVERY] Detecting local interfaces...");
    let local_ip_info = get_local_ip_and_subnet();
    let (local_ip, subnet, iface_name) = match local_ip_info {
        Some(info) => {
            info!(
                "[DISCOVERY] Local IP detected: ip={}, subnet={}, interface={}",
                info.0, info.1, info.2
            );
            info
        }
        None => {
            warn!("[DISCOVERY] No private local IP detected. Discovery will use ARP table only.");
            (String::new(), String::new(), String::new())
        }
    };

    if !subnet.is_empty() {
        if let Some(cidr) = subnet.split('/').nth(1) {
            if let Ok(prefix) = cidr.parse::<u32>() {
                if !is_private_subnet(&local_ip, prefix) {
                    warn!(
                        "[DISCOVERY] Subnet {} is not a private network. Refusing to scan.",
                        subnet
                    );
                    return DiscoveryResult {
                        gateway_ip: None,
                        gateway_mac: None,
                        local_ip: Some(local_ip),
                        local_mac: None,
                        subnet: Some(subnet),
                        devices: Vec::new(),
                        scan_duration_ms: start.elapsed().as_millis() as u64,
                        device_count: 0,
                    };
                }
            }
        }
    }

    let local_mac = if !iface_name.is_empty() {
        let mac = get_local_mac(&iface_name);
        debug!("[DISCOVERY] Local MAC: {:?}", mac);
        mac
    } else {
        None
    };

    info!("[DISCOVERY] Detecting gateway...");
    let (gateway_ip, _gateway_iface) = match get_gateway() {
        Some(gw) => {
            info!(
                "[DISCOVERY] Gateway detected: ip={}, interface={}",
                gw.0, gw.1
            );
            gw
        }
        None => {
            warn!("[DISCOVERY] No default gateway found");
            (String::new(), String::new())
        }
    };

    let gateway_mac = if !gateway_ip.is_empty() {
        arp_table_lookup(&gateway_ip)
    } else {
        None
    };

    let (_local_hostname, local_mac_fallback) = get_local_device_info();
    let local_mac = local_mac.or(local_mac_fallback);

    let mut devices: Vec<DiscoveredDevice> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

    info!("[DISCOVERY] Reading ARP/neighbour table...");
    let arp_entries = read_arp_table();
    info!(
        "[DISCOVERY] ARP table contains {} entries with valid MACs",
        arp_entries.len()
    );

    for (ip, mac) in &arp_entries {
        if deadline.elapsed() > OVERALL_TIMEOUT {
            warn!("[DISCOVERY] Deadline exceeded during ARP entry processing");
            break;
        }

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
        if let Some(hosts) = generate_subnet_hosts(&subnet) {
            let host_count = hosts.len();
            info!(
                "[DISCOVERY] Ping scan started: {} hosts on {}, max {} concurrent",
                host_count, subnet, MAX_CONCURRENT_PING
            );

            if deadline.elapsed() > OVERALL_TIMEOUT {
                warn!("[DISCOVERY] Deadline exceeded before ping sweep");
            } else {
                let sweep_results = concurrent_icmp_sweep(hosts, deadline);
                info!(
                    "[DISCOVERY] Ping scan completed: {} reachable hosts found",
                    sweep_results.len()
                );

                for (ip, latency) in &sweep_results {
                    if seen.contains(ip) {
                        continue;
                    }
                    seen.insert(ip.clone());
                    let mac =
                        arp_table_lookup(ip).unwrap_or_else(|| "00:00:00:00:00:00".to_string());
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
        } else {
            warn!(
                "[DISCOVERY] Could not generate host list from subnet {}. Skipping ping sweep.",
                subnet
            );
        }
    }

    if !local_ip.is_empty() && !seen.contains(&local_ip) && local_ip.split('.').count() == 4 {
        let hostname = run_cmd("hostname", &[], CMD_TIMEOUT);
        let local_mac_str = local_mac
            .clone()
            .unwrap_or_else(|| "00:00:00:00:00:00".to_string());
        let vendor = if local_mac_str != "00:00:00:00:00:00" {
            resolve_vendor(&local_mac_str)
        } else {
            None
        };
        info!(
            "[DISCOVERY] Adding local machine as discovered node: ip={}",
            local_ip
        );
        devices.push(DiscoveredDevice {
            ip: local_ip.clone(),
            mac: local_mac_str,
            hostname,
            vendor,
            interface: iface_name.clone(),
            source: "local".to_string(),
            reachable: true,
            latency_ms: Some(0.0),
        });
    }

    devices.sort_by(|a, b| {
        let a_parts: Vec<u32> = a.ip.split('.').filter_map(|p| p.parse().ok()).collect();
        let b_parts: Vec<u32> = b.ip.split('.').filter_map(|p| p.parse().ok()).collect();
        a_parts.cmp(&b_parts)
    });

    let elapsed = start.elapsed().as_millis() as u64;

    info!(
        "[DISCOVERY] Discovery completed: {} devices in {}ms (subnet={}, gateway={})",
        devices.len(),
        elapsed,
        if subnet.is_empty() { "none" } else { &subnet },
        if gateway_ip.is_empty() {
            "none"
        } else {
            &gateway_ip
        }
    );

    DiscoveryResult {
        gateway_ip: if gateway_ip.is_empty() {
            None
        } else {
            Some(gateway_ip)
        },
        gateway_mac,
        local_ip: if local_ip.is_empty() {
            None
        } else {
            Some(local_ip)
        },
        local_mac,
        subnet: if subnet.is_empty() {
            None
        } else {
            Some(subnet)
        },
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
        assert_eq!(
            resolve_vendor("B8:27:EB:12:34:56"),
            Some("Raspberry Pi".to_string())
        );
    }

    #[test]
    fn test_resolve_vendor_unknown_oui() {
        assert_eq!(resolve_vendor("AA:BB:CC:DD:EE:FF"), None);
    }

    #[test]
    fn test_resolve_vendor_vmware_ouis() {
        assert_eq!(
            resolve_vendor("00:0C:29:AB:CD:EF"),
            Some("VMware".to_string())
        );
        assert_eq!(
            resolve_vendor("00:50:56:AB:CD:EF"),
            Some("VMware".to_string())
        );
    }

    #[test]
    fn test_resolve_vendor_apple() {
        assert_eq!(
            resolve_vendor("00:23:6C:AB:CD:EF"),
            Some("Apple".to_string())
        );
    }

    #[test]
    fn test_resolve_vendor_cisco() {
        assert_eq!(
            resolve_vendor("00:03:7F:AB:CD:EF"),
            Some("Cisco".to_string())
        );
    }

    #[test]
    fn test_is_private_subnet_10() {
        assert!(is_private_subnet("10.0.0.0", 24));
        assert!(is_private_subnet("10.1.2.3", 8));
        assert!(!is_private_subnet("11.0.0.0", 24));
    }

    #[test]
    fn test_is_private_subnet_172() {
        assert!(is_private_subnet("172.16.0.0", 16));
        assert!(is_private_subnet("172.31.255.255", 16));
        assert!(!is_private_subnet("172.32.0.0", 16));
        assert!(!is_private_subnet("172.15.0.0", 16));
    }

    #[test]
    fn test_is_private_subnet_192_168() {
        assert!(is_private_subnet("192.168.1.0", 24));
        assert!(is_private_subnet("192.168.0.1", 16));
    }

    #[test]
    fn test_is_private_subnet_public() {
        assert!(!is_private_subnet("8.8.8.8", 32));
        assert!(!is_private_subnet("1.1.1.1", 24));
        assert!(!is_private_subnet("203.0.113.0", 24));
    }

    #[test]
    fn test_is_private_subnet_invalid_prefix() {
        assert!(!is_private_subnet("10.0.0.0", 32));
        assert!(is_private_subnet("10.0.0.0", 8));
        assert!(is_private_subnet("10.0.0.0", 12));
        assert!(!is_private_subnet("not-an-ip", 24));
    }

    #[test]
    fn test_generate_subnet_hosts_valid() {
        let hosts = generate_subnet_hosts("192.168.1.0/24").unwrap();
        assert_eq!(hosts.len(), 254);
        assert_eq!(hosts[0], "192.168.1.1");
        assert_eq!(hosts[253], "192.168.1.254");
    }

    #[test]
    fn test_generate_subnet_hosts_25() {
        let hosts = generate_subnet_hosts("10.0.0.0/25").unwrap();
        assert_eq!(hosts.len(), 126);
        assert_eq!(hosts[0], "10.0.0.1");
        assert_eq!(hosts[125], "10.0.0.126");
    }

    #[test]
    fn test_generate_subnet_hosts_too_large() {
        assert!(generate_subnet_hosts("10.0.0.0/16").is_none());
    }

    #[test]
    fn test_generate_subnet_hosts_invalid() {
        assert!(generate_subnet_hosts("not-a-cidr").is_none());
        assert!(generate_subnet_hosts("192.168.1.0/abc").is_none());
        assert!(generate_subnet_hosts("192.168.1.0/32").is_none());
        assert!(generate_subnet_hosts("192.168.1.0/23").is_none());
    }

    #[test]
    fn test_read_arp_table_does_not_panic() {
        let _entries = read_arp_table();
    }

    #[test]
    fn test_discover_network_does_not_panic() {
        let result = discover_network();
        assert!(result.scan_duration_ms > 0);
    }
}

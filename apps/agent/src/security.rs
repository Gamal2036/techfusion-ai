use serde::Serialize;
use std::process::Command;

#[derive(Serialize)]
pub struct SecurityFinding {
    pub category: String,
    pub finding: String,
    pub severity: String,
    pub remediation: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Serialize)]
pub struct SecurityReport {
    pub findings: Vec<SecurityFinding>,
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

fn check_pending_updates() -> Vec<SecurityFinding> {
    let mut findings = Vec::new();
    if let Some(output) = run_cmd("apt", &["list", "--upgradable", "2>/dev/null"]) {
        let count = output.lines().filter(|l| l.contains("upgradable")).count();
        if count > 0 {
            let severity = if count > 10 { "high" } else if count > 5 { "medium" } else { "low" };
            findings.push(SecurityFinding {
                category: "updates".to_string(),
                finding: format!("{} pending package update{}", count, if count == 1 { "" } else { "s" }),
                severity: severity.to_string(),
                remediation: "Run `sudo apt update && sudo apt upgrade` to apply pending updates".to_string(),
                details: Some(serde_json::json!({"pending_updates": count})),
            });
        } else {
            findings.push(SecurityFinding {
                category: "updates".to_string(),
                finding: "System is up to date".to_string(),
                severity: "low".to_string(),
                remediation: "No action needed".to_string(),
                details: None,
            });
        }
    } else {
        findings.push(SecurityFinding {
            category: "updates".to_string(),
            finding: "Unable to check for updates (apt not available or permission denied)".to_string(),
            severity: "low".to_string(),
            remediation: "Ensure apt is installed and the agent has sufficient permissions".to_string(),
            details: None,
        });
    }
    findings
}

fn check_firewall() -> Vec<SecurityFinding> {
    let mut findings = Vec::new();

    if let Some(output) = run_cmd_no_check("ufw", &["status"]) {
        let trimmed = output.trim().to_lowercase();
        if trimmed.contains("inactive") || trimmed.contains("disabled") {
            findings.push(SecurityFinding {
                category: "firewall".to_string(),
                finding: "UFW firewall is inactive".to_string(),
                severity: "high".to_string(),
                remediation: "Enable UFW: `sudo ufw enable` and configure rules: `sudo ufw default deny incoming`".to_string(),
                details: Some(serde_json::json!({"firewall_status": "inactive"})),
            });
        } else if trimmed.contains("active") || trimmed.contains("enabled") {
            findings.push(SecurityFinding {
                category: "firewall".to_string(),
                finding: "UFW firewall is active".to_string(),
                severity: "low".to_string(),
                remediation: "No action needed".to_string(),
                details: Some(serde_json::json!({"firewall_status": "active"})),
            });
        }
    } else {
        // Check iptables as fallback
        if let Some(iptables) = run_cmd_no_check("iptables", &["-L", "-n", "--line-numbers"]) {
            let has_rules = iptables.lines().count() > 2;
            if !has_rules {
                findings.push(SecurityFinding {
                    category: "firewall".to_string(),
                    finding: "No iptables firewall rules detected".to_string(),
                    severity: "medium".to_string(),
                    remediation: "Consider enabling a firewall (UFW, firewalld, or iptables rules)".to_string(),
                    details: Some(serde_json::json!({"firewall_type": "iptables", "has_rules": false})),
                });
            } else {
                findings.push(SecurityFinding {
                    category: "firewall".to_string(),
                    finding: "iptables firewall rules are present".to_string(),
                    severity: "low".to_string(),
                    remediation: "No action needed".to_string(),
                    details: Some(serde_json::json!({"firewall_type": "iptables", "has_rules": true})),
                });
            }
        } else {
            findings.push(SecurityFinding {
                category: "firewall".to_string(),
                finding: "Unable to determine firewall status".to_string(),
                severity: "low".to_string(),
                remediation: "Install ufw or ensure agent has permission to check firewall status".to_string(),
                details: None,
            });
        }
    }

    findings
}

fn check_open_ports() -> Vec<SecurityFinding> {
    let mut findings = Vec::new();

    // Try ss first, fall back to /proc/net/tcp
    let port_data = run_cmd_no_check("ss", &["-tlnp"]);

    if let Some(output) = port_data {
        let listening: Vec<&str> = output.lines().filter(|l| l.contains("LISTEN")).collect();
        let port_count = listening.len();

        if port_count > 0 {
            let high_ports: Vec<&str> = listening.iter()
                .filter(|l| {
                    l.split_whitespace().nth(3).map_or(false, |addr| {
                        addr.rsplit(':').next().map_or(false, |p| {
                            p.parse::<u16>().map_or(false, |port| port < 1024)
                        })
                    })
                })
                .copied()
                .collect();

            let exposed_services: Vec<String> = high_ports.iter()
                .filter_map(|l| {
                    let parts: Vec<&str> = l.split_whitespace().collect();
                    if parts.len() >= 5 {
                        Some(parts[5].to_string())
                    } else {
                        None
                    }
                })
                .collect();

            if port_count > 20 {
                findings.push(SecurityFinding {
                    category: "open_ports".to_string(),
                    finding: format!("{} listening ports detected (high port count increases attack surface)", port_count),
                    severity: "medium".to_string(),
                    remediation: "Review and close unnecessary listening services. Use `ss -tlnp` to identify services.".to_string(),
                    details: Some(serde_json::json!({"open_ports": port_count, "privileged_ports": high_ports.len()})),
                });
            }

            if !exposed_services.is_empty() {
                findings.push(SecurityFinding {
                    category: "open_ports".to_string(),
                    finding: format!("{} privileged port service{} listening", exposed_services.len(), if exposed_services.len() == 1 { " is" else { "s are" } }),
                    severity: "low".to_string(),
                    remediation: "Ensure each service is necessary and properly secured".to_string(),
                    details: Some(serde_json::json!({"services": exposed_services})),
                });
            }

            // Check for RDP (3389) or SMB (445) listening
            let has_rdp = listening.iter().any(|l| l.contains(":3389"));
            let has_smb = listening.iter().any(|l| l.contains(":445"));
            let has_ssh = listening.iter().any(|l| l.contains(":22"));
            let has_http = listening.iter().any(|l| l.contains(":80") || l.contains(":443"));

            if has_rdp {
                findings.push(SecurityFinding {
                    category: "weak_config".to_string(),
                    finding: "RDP port (3389) is exposed".to_string(),
                    severity: "high".to_string(),
                    remediation: "Restrict RDP access with firewall rules or disable if not needed. Enable Network Level Authentication (NLA).".to_string(),
                    details: Some(serde_json::json!({"port": 3389, "service": "RDP"})),
                });
            }
        } else {
            findings.push(SecurityFinding {
                category: "open_ports".to_string(),
                finding: "No listening TCP ports detected".to_string(),
                severity: "low".to_string(),
                remediation: "No action needed".to_string(),
                details: None,
            });
        }
    } else {
        findings.push(SecurityFinding {
            category: "open_ports".to_string(),
            finding: "Unable to scan listening ports".to_string(),
            severity: "low".to_string(),
            remediation: "Ensure ss (iproute2) is installed".to_string(),
            details: None,
        });
    }

    findings
}

fn check_weak_configs() -> Vec<SecurityFinding> {
    let mut findings = Vec::new();

    // Check for users with empty passwords
    if let Some(shadow) = run_cmd("getent", &["shadow"]) {
        let empty_pw_users: Vec<&str> = shadow
            .lines()
            .filter(|l| {
                let parts: Vec<&str> = l.split(':').collect();
                parts.len() >= 2 && (parts[1].is_empty() || parts[1] == "")
            })
            .collect();

        if !empty_pw_users.is_empty() {
            let user_list = empty_pw_users.join(", ");
            findings.push(SecurityFinding {
                category: "weak_config".to_string(),
                finding: format!("{} account{} with no password set: {}", empty_pw_users.len(), if empty_pw_users.len() == 1 { " has" else { "s have" } }, user_list),
                severity: "critical".to_string(),
                remediation: "Set passwords for all accounts using `sudo passwd <username>`. Remove unused accounts.".to_string(),
                details: Some(serde_json::json!({"affected_users": empty_pw_users})),
            });
        }
    }

    // Check for SSH password authentication enabled
    if let Some(ssh_config) = run_cmd("grep", &["-E", "^PasswordAuthentication\\s+yes", "/etc/ssh/sshd_config"]) {
        if !ssh_config.is_empty() {
            findings.push(SecurityFinding {
                category: "weak_config".to_string(),
                finding: "SSH password authentication is enabled".to_string(),
                severity: "medium".to_string(),
                remediation: "Disable password authentication in /etc/ssh/sshd_config: set `PasswordAuthentication no` and use SSH keys".to_string(),
                details: Some(serde_json::json!({"ssh_password_auth": true})),
            });
        }
    }

    // Check for root SSH login enabled
    if let Some(ssh_root) = run_cmd("grep", &["-E", "^PermitRootLogin\\s+yes", "/etc/ssh/sshd_config"]) {
        if !ssh_root.is_empty() {
            findings.push(SecurityFinding {
                category: "weak_config".to_string(),
                finding: "SSH root login is permitted".to_string(),
                severity: "high".to_string(),
                remediation: "Disable root SSH login in /etc/ssh/sshd_config: set `PermitRootLogin no`".to_string(),
                details: Some(serde_json::json!({"ssh_root_login": true})),
            });
        }
    }

    findings
}

fn check_password_policy() -> Vec<SecurityFinding> {
    let mut findings = Vec::new();

    if let Some(login_defs) = run_cmd("grep", &["-E", "^(PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_MIN_LEN|PASS_WARN_AGE)", "/etc/login.defs"]) {
        let mut max_days: Option<u32> = None;
        let mut min_len: Option<u32> = None;

        for line in login_defs.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                match parts[0] {
                    "PASS_MAX_DAYS" => max_days = parts[1].parse().ok(),
                    "PASS_MIN_LEN" => min_len = parts[1].parse().ok(),
                    _ => {}
                }
            }
        }

        if let Some(days) = max_days {
            if days > 90 {
                findings.push(SecurityFinding {
                    category: "password_policy".to_string(),
                    finding: format!("Password expiration set to {} days (recommended: <= 90)", days),
                    severity: "medium".to_string(),
                    remediation: "Set PASS_MAX_DAYS to 90 or less in /etc/login.defs".to_string(),
                    details: Some(serde_json::json!({"pass_max_days": days})),
                });
            } else {
                findings.push(SecurityFinding {
                    category: "password_policy".to_string(),
                    finding: format!("Password expiration is {} days (within policy)", days),
                    severity: "low".to_string(),
                    remediation: "No action needed".to_string(),
                    details: Some(serde_json::json!({"pass_max_days": days})),
                });
            }
        }

        if let Some(len) = min_len {
            if len < 8 {
                findings.push(SecurityFinding {
                    category: "password_policy".to_string(),
                    finding: format!("Minimum password length is {} characters (recommended: >= 8)", len),
                    severity: "medium".to_string(),
                    remediation: "Set PASS_MIN_LEN to 8 or more in /etc/login.defs".to_string(),
                    details: Some(serde_json::json!({"pass_min_len": len})),
                });
            } else {
                findings.push(SecurityFinding {
                    category: "password_policy".to_string(),
                    finding: format!("Minimum password length is {} characters (meets policy)", len),
                    severity: "low".to_string(),
                    remediation: "No action needed".to_string(),
                    details: Some(serde_json::json!({"pass_min_len": len})),
                });
            }
        }
    } else {
        findings.push(SecurityFinding {
            category: "password_policy".to_string(),
            finding: "Unable to read password policy settings".to_string(),
            severity: "low".to_string(),
            remediation: "Check /etc/login.defs permissions and content".to_string(),
            details: None,
        });
    }

    findings
}

pub fn collect_security_findings() -> Vec<SecurityFinding> {
    let mut all = Vec::new();
    all.extend(check_pending_updates());
    all.extend(check_firewall());
    all.extend(check_weak_configs());
    all.extend(check_open_ports());
    all.extend(check_password_policy());
    all
}

pub fn send_security_report(client: &reqwest::blocking::Client, token: &str, api_url: &str) -> bool {
    let findings = collect_security_findings();

    let report = SecurityReport { findings };
    let url = format!("{}/devices/security-report", api_url);

    let payload = serde_json::json!({
        "deviceToken": token,
        "findings": report.findings,
    });

    match client.post(&url).json(&payload).send() {
        Ok(resp) => {
            if resp.status().is_success() {
                let body: serde_json::Value = resp.json().unwrap_or(serde_json::json!({}));
                println!(
                    "Security report sent: score={}, risk={}, findings={}",
                    body["securityScore"].as_i64().unwrap_or(-1),
                    body["riskLevel"].as_str().unwrap_or("unknown"),
                    body["totalFindings"].as_i64().unwrap_or(0),
                );
                true
            } else {
                eprintln!("Security report failed: HTTP {}", resp.status());
                false
            }
        }
        Err(e) => {
            eprintln!("Security report error: {}", e);
            false
        }
    }
}

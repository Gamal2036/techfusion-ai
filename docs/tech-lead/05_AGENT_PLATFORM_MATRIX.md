# 05 — Agent Platform Matrix

Status: 2026-08-15. Rust agent `apps/agent`, version `1.0.0-beta.5`, toolchain 1.96.0. All 17 agent→gateway call-sites verified against gateway controllers (`VERIFIED_THIS_RUN`).

## 1. Capability Matrix

| Capability | Status | Evidence |
|------------|--------|----------|
| Enrollment | IMPLEMENTED | `registration.rs` one-shot (`TF_ENROLL`), `POST /devices/register-public` (enrollment token, single-use, SHA-256 server-side) |
| Persistent identity | IMPLEMENTED | `identity.rs`: `installation_id`, fingerprint v2 (`sha256:{"v2"\0 …}`) from machine-id + DMI UUID; files 0600, dir 0700 (unix) |
| Credential storage | IMPLEMENTED (plaintext file, unix 0600; rotation is server-side) | `registration.rs` writes `device_token` plaintext; server hashes + rotates (`CredentialRotationEvent`). No client-side encryption |
| Reconnect behavior | IMPLEMENTED | `client.rs`: 5xx exp backoff 500 ms→15 s; 429 → 60 s pause; 401 → invalidate + re-register (≤3 attempts, backoff+jitter); systemd `Restart=on-failure` |
| Heartbeat | IMPLEMENTED (no dedicated heartbeat — presence rides on 30 s metrics POST) | `agent.rs` telemetry ticker 30 s + jitter 0-3 s; server updates `lastSeenAt` per ingest |
| Metrics collection | PARTIAL | CPU/RAM/disk/network/process/uptime OK; **temperature & battery hardcoded `None`**; load/services always `None` |
| System information | IMPLEMENTED | hostname, OS, OS version, CPU model/cores, RAM/disk totals (registration payload) |
| Network functionality | IMPLEMENTED (Linux-only, server-commanded, private-subnet-only) | `network_discovery.rs`: `ip`/`/proc/net/arp`/`/sys/class/net`/ping/host; `/24`-`/25` cap, MAX_HOSTS 254, 55 s deadline; `TF_NETWORK_DISCOVERY` opt-in |
| Remote operations | STUB (safe-only; screen capture / input injection / active indicator disabled) | `remote.rs` = 3 structs only; `agent.rs` **auto-grants consent** (`granted:true`) with no user prompt |
| Jobs/commands | IMPLEMENTED (poll-based, no WebSocket) | 15 s command ticker: security scans, network discovery (opt-in), inventory; inventory also 2 h timer with change-detection hash |
| Security capabilities | IMPLEMENTED (Linux-only) | `security.rs`: apt upgrades, firewall (ufw/iptables), sshd config, open ports, password policy; 5 findings families |
| Software/inventory | IMPLEMENTED (Linux-only listing; no update actions) | `inventory.rs`: lsmod/modinfo/lspci/lsusb/dkms, dpkg/apt/snap/flatpak/pip3 |
| Update mechanism | NOT IMPLEMENTED in agent (installer re-run only) | no self-update; `install-linux.sh` re-download + sha256 verify |
| Service installation | IMPLEMENTED (Linux systemd only) | `install-linux.sh` v1.3.0: hardened unit (NoNewPrivileges, ProtectSystem=strict, PrivateTmp, …), `/etc/techfusion/agent.env` 0600, `/var/lib/techfusion` 0700, identity migration, capability gate, arch x86_64/aarch64 |
| Logging | IMPLEMENTED | `tracing` → stdout → journald; `RUST_LOG` env |
| Failure recovery | IMPLEMENTED | `reset-identity` (requires root + RESET confirm), re-enroll on 401, credential recovery (`POST /devices/recover-credential`), systemd restart, SIGTERM/ctrl-c graceful stop (SIGTERM `#[cfg(unix)]`) |
| Windows support | NOT IMPLEMENTED | §3 below |

## 2. Linux Readiness: STRONG / PRODUCTION-SHAPED

Certified real-device path exists (`docs/v1/V1-STAGE-00B-R2_*`, `V1-AGENT-E2E-02A_*`). Linux gaps: temperature/battery never collected; no service-check payload; physical-reboot recovery certified at container level only; CPU `model` field stripped server-side by DTO whitelist.

## 3. Windows Gap Analysis (read-only — nothing to implement this mission)

| Area | Current state | Windows requirement |
|------|---------------|---------------------|
| Service lifecycle | None | Windows Service (SCM) integration via `windows-service` crate; SERVICE_CONTROL_STOP handler (SIGTERM is unix-only) |
| Installer | bash installer only | MSI (WiX/Advanced Installer) or signed exe bootstrapper; arch detect x64/arm64; env config; service registration |
| Secure credential storage | plaintext file, unix 0600 only | DPAPI (`CryptProtectData`) or Windows Credential Manager; no ACL on Windows today |
| System metrics | sysinfo cross-platform ✅; temp/battery never collected | physical cores (`detect_physical_cores` linux `/proc`), CPU model fallback |
| Network information | Linux-only tooling (`ip`, `/proc/net/arp`, `/sys/class/net`) | `GetAdaptersAddresses`, `Get-NetNeighbor`/`arp -a`, `ping -n`, WMI |
| Software inventory | Linux CLIs only | Registry Uninstall keys (HKLM 32/64 views), `driverquery`, `Get-Package`/WMI |
| Command execution | none by design (remote.rs safe-only) | any future remote-ops: PowerShell/WinRM/SSH |
| Remote support | consent/status only | desktop capture/input injection via Win32/desktop-duplication |
| Updates | none self-managed | MSI-based update or updater service |
| Uninstall | `uninstall-linux.sh` only | uninstaller entry, service removal, `sc delete`, state cleanup |
| Code signing | none (Linux unsigned) | Authenticode (EV) signing required |
| Architecture | x86_64/aarch64 linux only | add `x86_64-pc-windows-msvc` (+ optionally arm64) targets to release matrix |
| Recovery after reboot | systemd enable/restart | SCM auto-start; start-on-boot |
| Identity/Machine ID | `/etc/machine-id` + DMI; `wmic` stub (deprecated) | `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` |
| Paths/lifecycle | `/etc/techfusion`, `/var/lib/techfusion`, systemctl/pgrep/kill in `reset.rs` | OS-specific state dirs; SCM-aware reset |

## 4. Cross-Platform vs OS-Specific Modules

- **Cross-platform (portable)**: `client.rs` (pure HTTP), `remote.rs` (structs), core `config.rs`/`agent.rs` (minus signal handling), sysinfo metrics core.
- **OS-specific adapters required**: identity/machine-id + credential protection (identity.rs, registration.rs permission bits), metrics internals (collector.rs), inventory.rs (Linux CLIs → registry/WMI), security.rs (Linux config files → Windows equivalents), network_discovery.rs (full rewrite), reset.rs (paths + SCM), signal/service lifecycle in main.rs/agent.rs.
- **Recommendation**: keep command orchestration + HTTP client + payload schemas shared; introduce a trait-based `platform` module with Linux/Windows implementations for identity, credential store, inventory, security, network, and service lifecycle.

## 5. Version Reporting

- `agent_version = env!("CARGO_PKG_VERSION")` → `1.0.0-beta.5`; sent only at registration (`Device.agentVersion`). No `/agent-version` endpoint and no version in headers/metrics — server never learns of upgrades after enrollment.

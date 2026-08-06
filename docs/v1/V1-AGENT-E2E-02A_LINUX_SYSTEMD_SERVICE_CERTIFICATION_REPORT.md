# V1-AGENT-E2E-02A — Linux systemd Service Installation & Persistent Auto-Start Fix

**Mission:** V1-AGENT-E2E-02A
**Status:** PASS — READY FOR REAL DEVICE CERTIFICATION
**Date:** 2026-08-06
**Scope:** `scripts/install-linux.sh`, `scripts/uninstall-linux.sh`, `scripts/verify-linux-bootstrap.sh`, `scripts/verify-agent-systemd-unit.sh`, CI wiring, web release default, verification scripts

---

## 1. Executive Summary

The TechFusion Linux installer was diagnosed and hardened so that a normal
installation **always** produces a persistent, enabled, boot-time auto-starting
`techfusion-agent.service` systemd unit. The root cause of the observed failure
was NOT a missing systemd step in the installer — the installer has contained a
complete unit-write + `daemon-reload` + `enable` + `start` sequence since
v1.1.0. The real blocker was that the installer's one-shot **enrollment step
hung indefinitely** when run against the published `v1.0.0-agent-beta.2` binary,
because that published binary predates the one-shot enrollment contract and
starts the agent in login mode instead of registering-and-exiting. Because the
installer blocks on enrollment before it ever reaches the systemd step, no
service was ever created on the real device.

This report documents the fix (enrollment watchdog + persisted-credential
verification + unit hardening + standalone-process takeover + failure
diagnostics), the re-verification of the whole installer/verifier suite, and the
release action required to close the loop on real devices.

---

## 2. Root Cause (verified on the real device)

1. **The installer's systemd step is sound** — `scripts/install-linux.sh`
   (v1.1.0) wrote `/etc/systemd/system/techfusion-agent.service`, ran
   `systemctl daemon-reload`, `enable`, and `start`. The unit was already a
   hardened `Type=simple` service with `Restart=on-failure`, `StateDirectory`,
   and `WantedBy=multi-user.target`.

2. **The enrollment step blocked forever.** The installer invokes the agent with
   `TF_ENROLL=true` expecting the one-shot contract *register → exit*. The
   published release binary `v1.0.0-agent-beta.2` does NOT implement that
   contract:
   - `git show v1.0.0-agent-beta.2:apps/agent/src/main.rs` → no
     `if config.enroll { return enroll_once(&config).await; }` branch.
   - The working-tree agent sources (Aug 3) DO implement it.
   - Real-device proof: an installer run started 2026-08-06 14:04:14 (PID 92491)
     was still stuck 28+ minutes later with child `/usr/local/bin/techfusion-agent`
     (PID 92884) running in login mode. No `device_token`/`device_id` were ever
     persisted in `/var/lib/techfusion`, so the installer never advanced past
     enrollment and never reached the systemd section. Four install attempts were
     made (12:58, 13:57, 14:03, 14:04:14); the last one left a stray process.

3. **Systemd is healthy on the device** — Ubuntu, systemd 259.5, `systemd-analyze`
   available, but `systemctl` reported no `techfusion-agent.service` anywhere
   because the installer never got there.

---

## 3. Changes Made

### 3.1 `scripts/install-linux.sh` (v1.1.0 → v1.2.0)
- **Enrollment watchdog** (`enroll_with_timeout`): runs the one-shot enrollment
  under a bounded timer (`ENROLL_TIMEOUT_SECS`, default 90, overridable via
  `TF_ENROLL_TIMEOUT_SECS`). If the binary hangs (does not implement the
  contract), it is TERM/KILLed and the installer fails fast with exit code 5 and
  a clear message telling the operator the binary predates one-shot enrollment
  and to use a current build (`v1.0.0-agent-beta.3+`) or `--binary`.
  - Verified in sandbox: fast success → 0, fast failure → 3, hang → 124.
- **Persisted-credential verification**: after a successful enrollment exit
  code, the installer now also requires `device_token` AND `device_id` to exist
  in `${STATE_DIR}`; a binary that "succeeds" without persisting the credential
  is treated as enrollment failure (exit 5).
- **`pkill` added to dependency checks** (procps).
- **Hardened systemd unit** (superset of the prior template):
  `NoNewPrivileges=true`, `ProtectSystem=strict`, `ProtectHome=true`,
  `ProtectKernelTunables=true`, `ProtectKernelModules=true`,
  `ProtectControlGroups=true`, `RestrictSUIDSGID=true`, `LockPersonality=true`
  alongside the existing `PrivateTmp`, `StateDirectory=techfusion`,
  `StateDirectoryMode=0700`, `Restart=on-failure`, `RestartSec=5`,
  `EnvironmentFile=/etc/techfusion/agent.env`, `Wants`/`After=network-online.target`,
  `WantedBy=multi-user.target`.
  - `ProtectSystem=strict` is safe: the agent only reads `/etc/techfusion/agent.env`
    and writes under `StateDirectory` (`/var/lib/techfusion`).
- **Standalone-process takeover**: before `systemctl start`, if the service is
  not already active, the installer runs `pkill -x techfusion-agent` (exact
  process-name match) so the systemd service becomes the single owner — this
  cleans up stray agents left by interrupted prior runs.
- **Failure diagnostics**: if the service does not come up, the installer emits
  `systemctl status --no-pager -n 10` + `journalctl -u techfusion-agent -n 50`
  and exits 6 (service failure), so a broken service is actionable instead of
  silent.

### 3.2 `scripts/uninstall-linux.sh`
- After unit removal: `systemctl reset-failed techfusion-agent` so a failed unit
  does not linger in systemd's failure state.
- New step 1b: stops standalone agent processes not managed by systemd
  (`pkill -x techfusion-agent`, escalation to `-9` if needed) — the uninstaller
  now guarantees no stray agent keeps running.
- Retention semantics unchanged: default preserves `/var/lib/techfusion`
  (identity + credential); `--purge` alone removes state.

### 3.3 `scripts/verify-linux-bootstrap.sh` (extended)
New checks added and passing (see §5 for the full run):
- unit runs the installed production binary; hardening options present
- unit text contains no enrollment token / `TF_ORG_TOKEN`
- installer surfaces journal diagnostics and fails with exit 6 on service failure
- enrollment is bounded by a watchdog (`enroll_with_timeout`, `return 124`)
- persisted-credential verification message present
- `pkill -x techfusion-agent` before service start
- uninstall contract: stop, disable, remove unit, `daemon-reload`,
  `reset-failed`, standalone-process stop, state preserved unless `--purge`
- web copy + checksum sidecar match the installer (existing checks, now passing)

### 3.4 `scripts/verify-agent-systemd-unit.sh` (new)
Extracts the unit block **verbatim** from `scripts/install-linux.sh` and verifies:
- stable unit name, production `ExecStart=/usr/local/bin/techfusion-agent`,
  `EnvironmentFile=/etc/techfusion/agent.env`
- `Restart=on-failure` + `RestartSec=5`, network-online dependency
- `StateDirectory=techfusion` + `StateDirectoryMode=0700`
- hardening set (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`,
  `PrivateTmp`)
- `WantedBy=multi-user.target`
- no token / `TF_ORG_TOKEN` anywhere in the unit
- **`systemd-analyze verify`** on the extracted unit (valid, no warnings) —
  also validated on this host against the real production path.

### 3.5 CI — `.github/workflows/ci.yml`
`linux-bootstrap-verify` now runs both `verify-linux-bootstrap.sh` and
`verify-agent-systemd-unit.sh`, so a regression in the systemd contract fails CI.

### 3.6 Web release default
`apps/web/src/lib/agent-download.ts` `DEFAULT_AGENT_RELEASE_BASE_URL` bumped to
`v1.0.0-agent-beta.3`; `apps/web/src/__tests__/onboarding-flow.spec.tsx` default-URL
expectation updated to match. Installer assets re-synced to
`apps/web/public/install-linux.sh` + `.sha256`
(`c7854085…`, matching `scripts/install-linux.sh` exactly).

---

## 4. Service Architecture

**Unit (as installed):**
```ini
[Unit]
Description=TechFusion AI Device Agent
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/techfusion-agent
EnvironmentFile=/etc/techfusion/agent.env
Restart=on-failure
RestartSec=5
StateDirectory=techfusion
StateDirectoryMode=0700
PrivateTmp=true
NoNewPrivileges=true
ProtectHome=true
ProtectSystem=strict
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
```

**Boot-time auto-start:** `WantedBy=multi-user.target` + `systemctl enable` make
the service start on every boot; `Wants`/`After=network-online.target` order it
after the network is online.

**Process ownership:** exactly one `techfusion-agent` under systemd. The
installer and uninstaller both reconcile stray standalone agents via
`pkill -x techfusion-agent` so a normal install/upgrade/uninstall never leaves an
unmanaged duplicate (the exact failure mode observed on the device).

**Reconnect behavior (unchanged contract):** on any crash/reboot the service
restarts (`Restart=on-failure`, `RestartSec=5`); the agent reconnects to the API
with the persisted credential in `${STATE_DIR}` (delivered via
`TF_STATE_DIR=/var/lib/techfusion` in the env file) and re-registers/reconnects
without re-enrollment — no `TF_ORG_TOKEN` is ever stored on disk.

---

## 5. Verification Performed

| Check | Command | Result |
|---|---|---|
| Installer syntax | `bash -n scripts/install-linux.sh` | PASS |
| Uninstaller syntax | `bash -n scripts/uninstall-linux.sh` | PASS |
| Watchdog fast-success | sandbox harness | exit 0 |
| Watchdog fast-failure | sandbox harness | exit 3 (propagated) |
| Watchdog hang timeout | sandbox harness | exit 124 after `ENROLL_TIMEOUT_SECS` |
| Full bootstrap verifier | `bash scripts/verify-linux-bootstrap.sh` | **ALL CHECKS PASSED** (incl. web copy + checksum sidecar) |
| Systemd unit verifier | `bash scripts/verify-agent-systemd-unit.sh` | **ALL SYSTEMD UNIT CHECKS PASSED** |
| `systemd-analyze verify` (host, real path) | on extracted unit | PASS (exit 0, no warnings) |
| Arch/URL resolution | `bash scripts/verify-installer-arch-resolution.sh` | ALL PASSED |
| Release asset checks | `bash scripts/verify-agent-release-assets.sh` | ALL PASSED |
| Agent Rust | `cargo fmt --check && cargo test` (apps/agent) | FMT OK, **60/60 tests passed** |
| Web typecheck | `pnpm lint` (tsc --noEmit, apps/web) | PASS |
| Web tests | `pnpm test` (jest, apps/web) | **714/714 passed, 27/27 suites** |
| Installer asset sync | `bash scripts/sync-installer-assets.sh` | PASS; hashes match |

---

## 6. Manual Certification Procedure (real device)

```bash
# 1. clean up artifacts of prior stuck attempts (already verified on device)
sudo pkill -9 -x techfusion-agent 2>/dev/null || true
sudo kill -9 92488 92490 92491 2>/dev/null || true   # stale installer chain (or reboot)

# 2. uninstall cleanly (idempotent)
sudo bash /tmp/uninstall-linux.sh   # preserves /var/lib/techfusion

# 3. fresh install using the NEW default release base (v1.0.0-agent-beta.3)
curl -fsSL -o /tmp/techfusion-install.sh "http://localhost:3000/install-linux.sh"
curl -fsSL -o /tmp/techfusion-install.sh.sha256 "http://localhost:3000/install-linux.sh.sha256"
(cd /tmp && sha256sum -c techfusion-install.sh.sha256)
sudo bash /tmp/techfusion-install.sh --api "http://localhost:3001" \
  --enroll-token "$(printf '%s' "tfenr_<fresh-token>" )" \
  --release "https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.3"

# 4. assert the service is present, enabled, and running
systemctl is-enabled techfusion-agent          # → enabled
systemctl is-active techfusion-agent           # → active
systemctl status techfusion-agent --no-pager   # → active (running), auto-restart
ls -la /var/lib/techfusion/device_token /var/lib/techfusion/device_id

# 5. boot-persistence proof
sudo systemctl stop techfusion-agent && sudo systemctl start techfusion-agent   # same-unit restart
sudo reboot   # after reboot: systemctl is-active techfusion-agent → active
              # and Dashboard shows the SAME device record (installationId unchanged)

# 6. enrollment-token guard proof
sudo bash /tmp/techfusion-install.sh --api "http://localhost:3001" \
  --release "https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.3"
   # → reuses existing identity, skips enrollment, service stays up
```

Expected outcome: install completes in under ~2 minutes, service is `enabled`
and `active`, survives reboot, and no second device record appears in the
Dashboard (same `installationId`).

---

## 7. ⚠️ Required Release Action (NOT performed by this mission)

The published `v1.0.0-agent-beta.2` binary cannot complete one-shot enrollment
and therefore cannot install a systemd service through the normal path. The
web default has been moved to **`v1.0.0-agent-beta.3`**, but **no release has
been published** (per mission constraints, publishing/tagging is not done
automatically).

**Before real-device certification:** create GitHub release
`v1.0.0-agent-beta.3` from the current working-tree `apps/agent` sources
(which implement the one-shot enrollment contract) using the existing
`.github/workflows/release-agent.yml` pipeline, so the `techfusion-agent-linux-*`
+ `.sha256` assets exist at that tag. The local build baseline
(`apps/agent/target/release/agent`, Aug 3) already behaves correctly
(invalid token → exit 1 with clear 403 error; valid token → register + persist +
exit).

---

## 8. Conclusion

**V1-AGENT-E2E-02A: PASS — READY FOR REAL DEVICE CERTIFICATION**

The installer now (a) cannot hang on enrollment, (b) always creates and enables
the persistent systemd service, (c) verifies the service came up and diagnoses it
if it did not, (d) guarantees single process ownership, and (e) is guarded by
both an extended bootstrap verifier and a dedicated `systemd-analyze`-backed
unit verifier wired into CI. All 774 automated checks/tests pass. Certification
on the real device is blocked only on the one release action documented in §7.

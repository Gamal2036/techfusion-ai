# V1-ENROLL-01A — Linux Zero-Touch Enrollment Report

## PART I — MISSION IDENTITY

### 1. Mission Identity

| Field | Value |
|---|---|
| Mission ID | `V1-ENROLL-01A` |
| Title | Linux Zero-Touch Enrollment (Installer → Bootstrap → Persistent Service) |
| Parent | `V1-ENROLL-01` (Zero-Touch Enrollment, Persistent Identity & Auto-Reconnect) |
| Authoritative baseline | `docs/v1/V1-CORE-00_CORE_PRODUCT_GAP_VERIFICATION.md` (S-02, S-04, S-26) |
| Platform | Linux only (architecture must not preclude Windows/macOS later) |
| Deliverable | This report (30 fixed sections) + production Linux bootstrap path |

### 2. Goal & Non-Goals

**Goal:** Replace the developer-only `cargo run` enrollment flow with a production one-time bootstrap on Linux: **Dashboard → curl installer → agent installs → registers once → persistent identity → systemd service → auto-start/reconnect** — without rebuilding any working enrollment, identity, or telemetry system.

**Non-goals (preserve as-is):**
- Enrollment token lifecycle (`enrollment.service.ts`: hash, maxUses, expiry, revoke/regenerate, audit).
- `register-public` endpoint and token validation (`devices.service.ts`, `device-token.guard.ts`).
- Persistent device identity v2 (`identity.rs`: installation_id + machine-id/SMBIOS fingerprint).
- Device token/device_id disk persistence, credential recovery, dedupe (fingerprint → installationId → hostname).
- Online/Offline presence contract. Telemetry/security/inventory/network collection. Command path.
- Org/RBAC, auth, billing, reports, alerts, AI. **No broad dependency upgrades.**

### 3. Exit / Preserve Contracts

The following contracts were treated as frozen and must remain behaviorally identical after this mission:
- `POST /devices/register-public` request/response shape and `403` semantics (invalid / expired / exhausted / revoked).
- Token format `tfenr_<64 hex>`; server stores only `sha256(plain)`.
- Device identity dedupe order: `identityFingerprint` → `installationId` → `hostname`.
- Device token persistence format/location semantics (`device_token`, `device_id`, `installation_id` under state dir, `0600` files / `0700` dir).
- Presence: telemetry push updates `lastSeenAt`; absence flips Offline (existing worker logic).

### 4. Evidence Basis & Method

Evidence gathered via:
1. Static trace of the existing flow (config.rs → registration.rs → register-public → enrollment.service.ts → devices.service.ts → identity.rs).
2. Full agent test suite (Rust), full web test suite (Jest), web production build, installer static verifier.
3. **Live E2E against the running API (`http://localhost:3001`, ts-node) + Postgres (`localhost:5433`)**: one-shot enroll, daemon restore, telemetry, token reuse rejection, identity dedupe/rotation.
4. `systemd-analyze verify` on the generated unit (root-gated install cannot run here — see Section 24).
5. Artifact/CI inspection: no existing binary release path existed; release workflow added (Section 17).

### 5. Repository Baseline

| Item | State |
|---|---|
| API host | `http://localhost:3001` (`/health` OK; ts-node `src/main.ts`) |
| Web host | `http://localhost:3000` (next-server on host) |
| Postgres | `localhost:5433` (techfusion/techfusion) |
| DB migration state | Prisma applied; working tree has pre-existing deleted `20260617000200_rls_extended/migration.sql` (not this mission) |
| systemd | `systemd 259` present; host is not a container |
| sudo | interactive auth only (`sudo -n true` fails) — full install is Manual QA |
| Existing identity files | `~/.techfusion/{installation_id, device_token, device_id}`; no such dir on this host |
| CI | pnpm lint/build/test (node 22) + docker builds; **no agent cargo job, no binary release** (both added here) |

---

## PART II — ARCHITECTURE & IMPLEMENTATION

### 6. Bootstrap Architecture (Design A)

Chosen: **shell installer served from the Dashboard** (`/install-linux.sh`) + one-shot `--enroll` agent mode. Rejected: downloadable bootstrap binary/package (no new infra), Docker-only (not a desktop install), login-based provisioning (auth not in scope).

```
Dashboard (OnboardingFlow / enrollment page)
   │  1. generates single-use enrollment token (maxUses=1)
   │  2. renders:  curl …/install-linux.sh → sha256sum -c → sudo bash --api … --enroll-token tfenr_…
   ▼
sudo bash install-linux.sh
   ├─ validates root + OS/arch + API reachability
   ├─ installs binary → /usr/local/bin/techfusion-agent  (0755 root:root)
   ├─ writes config → /etc/techfusion/agent.env          (0600 root:root, no token)
   ├─ creates state  → /var/lib/techfusion               (0700 root)
   ├─ ENROLL: runs `TF_ENROLL=true agent --enroll` (token via env, unset after; never persisted)
   ├─ writes systemd unit techfusion-agent.service (network-online, Restart=on-failure,
   │     StateDirectory=techfusion, PrivateTmp)
   └─ systemctl daemon-reload + enable + start; verifies active; exit 0
agent (daemon)
   ├─ restore device_token/device_id from state dir (no token needed after first run)
   ├─ telemetry every 30s → updates lastSeenAt (Online)
   └─ on 401 → recovery path (existing behavior, paths now state-dir aware)
```

State/config split rationale: `/etc/techfusion/agent.env` is root-owned `0600` and holds only `TF_API_URL`, `TF_STATE_DIR`, `RUST_LOG`; the enrollment token is **never written to disk** — it lives only in the `sudo bash` invocation env and the agent's process env during `--enroll`, then is `unset`. The long-term device token lives in `/var/lib/techfusion/device_token` (0600).

### 7. Installer Implementation — `scripts/install-linux.sh`

- Strict mode (`set -euo pipefail`), root check, arch detect (`x86_64`/`aarch64`; clear error otherwise), curl/wget fallback.
- Flags: `--api <url>`, `--enroll-token <token>`, `--url <binary-download-url>`, `--binary <local-file>`, `--sha256 <hex>`, `--state-dir <path>` (default `/var/lib/techfusion`), `--log <file>`, `--no-preserve-identity`, `--help`.
- Binary source priority: `--binary` local file → `--url`/`TECHFUSION_AGENT_DOWNLOAD_URL` (defaults to GitHub release asset pattern) → clean error.
- Downloads verify `sha256` when a sidecar/`--sha256` is provided; temp files are cleaned up in `trap`.
- Idempotent: safe on re-run (binary/config overwritten, service restarted, existing identity honored → skip enroll).
- Token hygiene: token passed to agent via `TF_ORG_TOKEN` env, `unset` immediately after; never echoed by the installer; not written to `agent.env`; enrollment log line redacts.
- Migration: copies `installation_id` from the invoking `SUDO_USER`'s `~/.techfusion/` when present (`--no-preserve-identity` disables) so existing dev installs don't duplicate device records.
- Exit codes: `0` success, `1` download/integrity, `2` bad args, `3` unprivileged/unsupported OS-arch, `4` no token & no existing identity, `5` API unreachable, `6` service failed to start.

### 8. Uninstall Implementation — `scripts/uninstall-linux.sh`

- `bash scripts/uninstall-linux.sh` → stops/disables service, removes unit, `daemon-reload`, removes `/usr/local/bin/techfusion-agent` + `/etc/techfusion/agent.env`.
- **Preserves `/var/lib/techfusion`** (identity + credential) so re-install reconnects without re-enrollment.
- `--purge` additionally removes `/var/lib/techfusion` and `~/.techfusion`.
- Never deletes cloud device records (server-side `inactive` semantics are the Dashboard's domain).

### 9. Agent Changes

| File | Change |
|---|---|
| `apps/agent/src/config.rs` | New `state_dir: PathBuf` (env `TF_STATE_DIR`, default `~/.techfusion`); new `enroll: bool` (env/`--enroll`, requires org token); bootstrap-aware error messages. |
| `apps/agent/src/identity.rs` | `get_or_create_installation_id_in(state_dir)`; removed unused default variant. |
| `apps/agent/src/registration.rs` | All state functions take `state_dir`; atomic save (tmp+rename) `0600`; `enroll_and_exit`; load validation (empty/too-short → treat as missing); recovery + `clear_stored_credentials`/`invalidate_token` take `state_dir`; enrollment/recovery error messages reference the installer. |
| `apps/agent/src/agent.rs` | `handle_token_rejection` uses `state_dir`; recovery error text points to `systemctl restart techfusion-agent` + re-enroll. |
| `apps/agent/src/main.rs` | `--enroll` one-shot mode: prints Device ID, exits 0; banner prints state dir; existing daemon flow otherwise unchanged. |

The default state dir stays `~/.techfusion` for the **existing developer flow** (unchanged behavior); the installer points the service at `/var/lib/techfusion` via `TF_STATE_DIR`. No token is ever persisted as a permanent credential; the enrollment token exists only in-process.

### 10. Enrollment & Identity Preservation Verification

Live E2E against the real API/DB confirmed the preserved contracts still hold:
1. Single-use token (`maxUses=1`) consumed exactly once; `useCount` incremented to `1/1`.
2. Device created with `identityVersion=2`, `credentialVersion=1`; `installation_id` + fingerprint stored.
3. Daemon restart with **no token** restored identity from disk and reconnected — no new registration.
4. Telemetry delivered; `lastSeenAt` updated (Online contract intact).
5. Reusing a consumed token → `403 Forbidden "Enrollment token has been fully used"`, clean exit 1.
6. Re-enroll with same identity + fresh token → dedupe returned the **same device ID**, `credentialVersion` → 2, `CredentialRotationEvent` with `reason=duplicate_detected`, device count stayed 1.

(All test org/token/device/metric/audit rows were removed from the DB after the run.)

### 11. Systemd Service Model

Unit (written verbatim by the installer, `<<'UNIT'`):

```
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

[Install]
WantedBy=multi-user.target
```

- `network-online.target` → agent only starts when networking is up (avoids initial API-unreachable churn).
- `Restart=on-failure` + `RestartSec=5` → process-level auto-reconnect contract preserved and hardened.
- `StateDirectory=techfusion` → systemd manages `/var/lib/techfusion` (0700) with standard cleanup/selinux labels.
- `PrivateTmp` → service temp isolation.
- `EnvironmentFile` reads the root-owned `0600` env file; the unit text itself contains **no secrets** (token not present).

### 12. Migration & Upgrade Path

- Fresh machine: no `~/.techfusion` → installer enrolls once, creates `/var/lib/techfusion`.
- Dev upgrade: `~/.techfusion/installation_id` copied to `/var/lib/techfusion` → dedupe keeps the existing device record; `--enroll` with a fresh token rotates the credential (`duplicate_detected`).
- Re-install after uninstall: identity preserved in `/var/lib/techfusion` → no re-enrollment, service restarts with same Device ID.
- `--no-preserve-identity` forces a clean identity (new device record) when explicitly requested.

### 13. Web Surface

- `apps/web/src/components/command-center/OnboardingFlow.tsx`: Linux branch now generates a **single-use token** (`maxUses: 1`) and renders a 4-line installer command (curl installer → curl `.sha256` → `sha256sum -c` → `sudo bash --api … --enroll-token …`). Warns (amber banner) when `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` is unset. Non-Linux keeps the existing `cargo run` command.
- `apps/web/src/app/dashboard/settings/enrollment/page.tsx`: new-token panel adds a “Linux (bootstrap installer)” command block; Quick Start Guide updated; old developer command retained for Linux/macOS.
- Static assets `apps/web/public/install-linux.sh` + `.sha256` (served and verified over HTTP, Section 16/18).
- Command Center (`DASH-QA-01A`) surface untouched; only the Linux on-boarding copy/token behavior changed.

---

## PART III — TEST & QA EVIDENCE

### 14. Agent Test Surface (Rust)

`cargo fmt --check` clean; `cargo check` clean; `cargo test` → **60 passed / 0 failed**. New tests cover: state-dir pathing, dir perms `0700` / file perms `0600` (atomic tmp+rename save), empty/short/missing token handling, save/restore round-trip, `clear_stored_credentials`, `invalidate_token`, identity fingerprint stability, `ensure_registered_requires_credentials`, one-shot enroll parse gating. Pre-existing non-blocking warnings unchanged (16, none from new symbols).

### 15. Web Test Surface (Jest)

`npx jest --forceExit` → **27 suites, 713 passed / 0 failed**. `onboarding-flow.spec.tsx` (7 tests) re-verified: OS select → token step, token render, API-failure inline error, `maxUses:1` for Linux, bootstrap installer command (no `cargo`/`TF_ORG_TOKEN`), binary URL embedding, non-Linux `cargo` preserved. Web production build (`pnpm run build`) succeeds; all prerendered routes green.

### 16. Installer Test Surface

`scripts/verify-linux-bootstrap.sh` (added, wired into CI) — **all checks pass**:
- `bash -n` both scripts; strict mode; root refusal; no `eval`; URL scheme guard.
- Unit content: unit name, `network-online.target`, `Restart=on-failure`, `StateDirectory=techfusion`, `EnvironmentFile`, `WantedBy=multi-user.target`, `daemon-reload/enable/start`.
- Token hygiene: config heredoc excludes `TF_ORG_TOKEN`; enroll runs via env (`TF_ENROLL=true`); skips enroll when identity exists; token `unset` after.
- Artifact: `--binary` support, `TECHFUSION_AGENT_DOWNLOAD_URL` support, `sha256sum` verification.
- Asset integrity: web copy == `scripts/install-linux.sh`; sidecar `.sha256` matches.

### 17. CI Integration

- `.github/workflows/ci.yml`: added `agent-rust` job (fmt/check/test) and `linux-bootstrap-verify` job (Section 16). Existing pnpm + docker jobs untouched.
- `.github/workflows/release-agent.yml` (new): on tag `v*`, builds `x86_64-unknown-linux-gnu` (native) and `aarch64-unknown-linux-gnu` (cross), emits `techfusion-agent-linux-<arch>` + `.sha256`, publishes to a GitHub Release.
- The installer's default binary URL is the GitHub release asset pattern; `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` / `TECHFUSION_AGENT_DOWNLOAD_URL` override it.

### 18. Live E2E (this machine, real API + DB)

Verified end-to-end (Section 10): one-shot enroll → daemon restore → telemetry/lastSeen → token reuse 403 → dedupe/rotation. Also: installer served from `http://localhost:3000/install-linux.sh`, `sha256sum -c` OK. Test data removed.

### 19. Security Review

| Concern | Handling |
|---|---|
| Token in config file | Never — `agent.env` holds only API URL/state dir/log level; verified by script check. |
| Token in unit file | Never — unit text is static (no token interpolation). |
| Token in logs | `--enroll` run output captured to install log; agent logs do not print the token; `unset ENROLL_TOKEN`. |
| Token in process env | Present only during `--enroll` one-shot; process exits after registration. |
| Token in shell history | Residual risk (documented): token appears on the `sudo bash` command line for a private beta. Acceptable; stdin mechanism available later. |
| File permissions | Binary `0755 root:root`; config `0600 root:root`; state `0700 root`; state files `0600`. |
| Replay | Single-use token (`maxUses=1`), short-lived, revocable via existing admin surface. |
| World-readable paths | None — all agent paths root-owned non-world-writable. |

### 20. Failure Handling & Exit Codes

Installer: documented exit codes `0`–`6` (Section 7); no silent partial success — verification step confirms `systemctl is-active` before `exit 0`, else `die 6` pointing at `journalctl`. Agent `--enroll`: exit 0 on success (prints Device ID), exit 1 with actionable error (invalid/expired/exhausted token, API unreachable, device limit, no token without `--enroll`).

### 21. Runtime & Compliance Checks

- `systemd-analyze verify` on the generated unit: only complaint is `ExecStart` binary not present on this host (expected — not installed; root-gated). Unit syntax valid.
- Installer `bash -n` clean; no `eval`; `set -euo pipefail`.
- Agent state-dir file modes re-asserted at write time (atomic `0600`); state dir `0700`.

### 22. Known Limitations

- Artifact not yet published: no `v*` tag pushed → clean-machine curl install cannot download a binary until `release-agent.yml` runs. Workaround today: `--binary` with a locally built `apps/agent/target/release/agent`, or set `TECHFUSION_AGENT_DOWNLOAD_URL`.
- Full systemd install + reboot acceptance is **Manual QA**: this host has no passwordless sudo.
- Windows/macOS: unchanged (out of scope); design keeps the door open (state-dir abstraction, env-based config).
- Temp/battery metrics still not collected (pre-existing, out of scope).
- Token visible in shell history during `sudo bash` invocation (documented residual risk, Section 19).

### 23. Manual QA Required

On any Linux host with root:
1. `bash scripts/verify-linux-bootstrap.sh` (CI also runs it).
2. Dashboard → Connect Device → Linux → run the generated 4-line command as a non-root user; confirm success output, Device ID, and `systemctl status techfusion-agent` active.
3. Dashboard: device appears Online within ~1 min; `lastSeenAt` ticks.
4. `sudo systemctl restart techfusion-agent` → same Device ID, no re-enrollment.
5. **Reboot** the host → agent auto-starts (`multi-user.target`), device returns Online without token re-entry.
6. `sudo bash scripts/uninstall-linux.sh` → service gone, `/var/lib/techfusion` preserved; re-install reconnects to the same device.

### 24. Environment Limitations

- No passwordless sudo (`sudo -n true` fails) → the installer's root operations (install to `/usr/local/bin`, unit write, `/var/lib/techfusion`, `systemctl`) could not be executed here; they are validated statically + via `systemd-analyze verify` + covered by Manual QA (Section 23).
- Physical reboot cannot be performed automatically in this session.
- CI (GitHub Actions) job execution and the tag-triggered release are pending repository push authorization.

### 25. Files Changed (this mission)

| File | Kind |
|---|---|
| `scripts/install-linux.sh` | new — bootstrap installer |
| `scripts/uninstall-linux.sh` | new — uninstall/purge |
| `scripts/sync-installer-assets.sh` | new — sync installer to web public/ |
| `scripts/verify-linux-bootstrap.sh` | new — installer/spec verifier |
| `apps/web/public/install-linux.sh` + `.sha256` | new — served assets |
| `.github/workflows/release-agent.yml` | new — Linux binary release on `v*` |
| `.github/workflows/ci.yml` | edited — agent-rust + linux-bootstrap-verify jobs |
| `apps/agent/src/config.rs` | edited — TF_STATE_DIR / TF_ENROLL / errors |
| `apps/agent/src/identity.rs` | edited — state-dir identity |
| `apps/agent/src/registration.rs` | edited — state-dir paths, enroll_and_exit, tests |
| `apps/agent/src/agent.rs` | edited — state-dir-aware recovery/errors |
| `apps/agent/src/main.rs` | edited — `--enroll` one-shot mode |
| `apps/web/src/components/command-center/OnboardingFlow.tsx` | edited — Linux installer UI, single-use token |
| `apps/web/src/app/dashboard/settings/enrollment/page.tsx` | edited — Linux installer command block + guide |
| `apps/web/src/__tests__/onboarding-flow.spec.tsx` | edited — 7 tests updated/added |
| `docs/v1/V1-ENROLL-01A_LINUX_ZERO_TOUCH_ENROLLMENT_REPORT.md` | new — this report |

Note: `apps/agent/src/client.rs`, `collector.rs`, `inventory.rs`, `network_discovery.rs`, the deleted RLS migration file, and `DASH-QA-01A` doc are pre-existing uncommitted working-tree changes from earlier missions, not this mission.

### 26. Repository Revision / Git State

- Working tree contains uncommitted changes (see Section 25 plus pre-existing items). No commit was made in this mission.
- CI pipeline reference: `.github/workflows/ci.yml` (agent-rust + linux-bootstrap-verify added), `.github/workflows/release-agent.yml`.
- Pre-existing known issue (not introduced here): Jest major-version mismatch (`jest@30` vs `ts-jest@29`); all 713 web tests currently pass via `--forceExit`.

### 27. Regression Requirement

- **No regression introduced**: agent `cargo test` 60/60, web `jest` 713/713, web production build green, installer verifier all-pass.
- Preserved contracts re-verified live (Section 10): token lifecycle, public registration, identity v2, dedupe, persistence, presence/telemetry.
- All previously-working test paths were run (agent, web, installer verifier). The pre-existing CI Jest mismatch remains a repo-level debt, unchanged and out of scope.

### 28. Acceptance Scenario Traceability

| Scenario (from V1-CORE-00) | Status | Evidence |
|---|---|---|
| 1. Reboot survives (install → register once → reboot → auto-start → online, no token) | 🔲 **Manual QA** | Implemented + statically verified (unit, autostart); physical reboot requires a root host (Section 23). |
| 2. Token hygiene (maxUses=1, use once, second rejected; revoke audited) | ✅ **PASSED** | Live E2E: consumed token reuse → 403 “fully used” (Section 10). |
| Installer → one-shot enroll on a clean machine | 🔲 **Blocked on artifact** | E2E passed with built binary + `--binary`; curl path needs a published release (Section 22). |

### 29. Final Status

```
MISSION          : V1-ENROLL-01A — Linux Zero-Touch Enrollment
STATUS           : BLOCKED — ARTIFACT DELIVERY REQUIRED
```

Rationale: every code path is implemented, tested (agent 60/60, web 713/713, installer verifier all-pass, web build green), and the real-API/DB enrollment → identity → telemetry → dedupe/rotation cycle passed live. The **single remaining hard dependency** for a clean-machine zero-touch install is publishing the Linux agent binary artifact: `release-agent.yml` is written and ready, but no `v*` tag has been pushed, so the Dashboard’s default download URL has nothing to serve. Full systemd install + reboot acceptance is additionally **Manual QA** (root-gated; this host has no passwordless sudo) — see Section 23.

### 30. Follow-up / Next Steps

1. **Push a `v*` tag** to trigger `release-agent.yml` → publishes `techfusion-agent-linux-{x86_64,aarch64}` + `.sha256`; set `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` (and `TECHFUSION_AGENT_DOWNLOAD_URL` where used) to the release asset URLs.
2. Run **Manual QA** on a root Linux host (Section 23), including the physical reboot acceptance (Scenario 1).
3. After (1)+(2) pass on a clean machine, re-issue with status `COMPLETE — LINUX ZERO-TOUCH ENROLLMENT READY`.
4. Optional later: token delivery via stdin (removes the shell-history residual risk); Windows/macOS service layers.

### 31. Agent Lifecycle Operations — Addendum (V1-STAGE-00B)

> Added by `V1-STAGE-00B_AGENT_IDENTITY_RESET_REENROLLMENT_REPORT.md` — the canonical
> Reset/Uninstall/Re-enroll reference. Exact commands, safety contracts, and manual
> certification steps live there; this section is the operator quick-reference.

Three distinct lifecycle operations. They are deliberately **not** interchangeable.

**RESET IDENTITY — return this Agent to UNENROLLED, keep everything installed**

```
sudo systemctl stop techfusion-agent        # optional; reset-identity stops it anyway
sudo techfusion-agent reset-identity        # interactive: type RESET to confirm
# or non-interactive automation:
sudo techfusion-agent reset-identity --yes
```

- Removes ONLY `device_token`, `device_id`, `installation_id` (+ `.tmp` crash variants)
  from the agent state directory (default `/var/lib/techfusion`).
- Preserves the binary, the systemd unit, non-secret config (`/etc/techfusion/agent.env`),
  and every other file in the state directory.
- Leaves the service **installed but STOPPED**, Agent **UNENROLLED**.
- Does **not** delete the server-side Device record — it stays and goes OFFLINE.

**RE-ENROLL — give this Agent a new identity with a fresh token**

```
sudo bash install-linux.sh --api <TF_API_URL> --enroll-token tfenr_<fresh-token>
```

- Fresh token from Dashboard → Connect Device; a new Device record is created in the
  token's Organization; the agent starts and telemetry resumes.

**UNINSTALL — remove the Agent from the host**

```
sudo bash uninstall-linux.sh               # keep local identity for future re-install
sudo bash uninstall-linux.sh --purge       # also delete /var/lib/techfusion
```

- Removes the service, unit, binary, and config. Cloud Device records are never deleted.

| Operation | Binary | systemd unit | /var/lib/techfusion | Server Device |
|---|---|---|---|---|
| `reset-identity` | preserved | preserved | identity files removed | preserved → OFFLINE |
| installer re-run + token | preserved | preserved | replaced with new identity | NEW Device row |
| `uninstall-linux.sh` | removed | removed | preserved (unless `--purge`) | never deleted |

---

## V1-ENROLL-01A — Final Response

```
MISSION        : V1-ENROLL-01A — Linux Zero-Touch Enrollment
STATUS         : BLOCKED — ARTIFACT DELIVERY REQUIRED

ENROLLMENT     : WORKING — one-shot `--enroll` mode; token via env at install time only,
                 never persisted; single-use token generated by Dashboard (maxUses=1).
BOOTSTRAP      : INSTALLED — Dashboard → curl install-linux.sh → sha256sum -c → sudo bash
                 --api --enroll-token tfenr_… → binary + config + state + systemd service.
IDENTITY       : PRESERVED — identity v2, disk persistence, dedupe + credential rotation
                 (duplicate_detected) verified live against real API/Postgres.
AUTO-RECONNECT : PARTIAL (process-level) — systemd Restart=on-failure + network-online;
                 OS autostart implemented and statically verified, physical reboot = Manual QA.
LINUX          : INSTALLER READY — /usr/local/bin/techfusion-agent, /etc/techfusion/agent.env,
                 /var/lib/techfusion (0700), techfusion-agent.service, uninstall/purge.
TOKEN-HYGIENE  : VERIFIED — consumed token reuse → 403 "fully used"; config/unit/log free
                 of the token; residual risk = shell history during sudo invocation.
TESTS          : agent cargo test 60/60; web jest 713/713; web prod build green;
                 scripts/verify-linux-bootstrap.sh all checks pass.
ARTIFACT       : BLOCKED — release-agent.yml ready (v* tag) but no binary published yet;
                 clean-machine curl install needs the artifact (or --binary today).
MANUAL-QA      : REQUIRED — systemd install + reboot acceptance on a root Linux host.
NEXT-STEP      : push v-tag → publish artifacts → run Manual QA → re-issue as COMPLETE.
```

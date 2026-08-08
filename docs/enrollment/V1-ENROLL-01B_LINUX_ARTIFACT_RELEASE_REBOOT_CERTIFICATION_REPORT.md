# V1-ENROLL-01B — Linux Artifact Release & Reboot Certification Report

## PART I — MISSION IDENTITY

### 1. Mission Identity

| Field | Value |
|---|---|
| Mission ID | `V1-ENROLL-01B` |
| Title | Linux Artifact Release & Reboot Certification |
| Parent | `V1-ENROLL-01` (Zero-Touch Enrollment, Persistent Identity & Auto-Reconnect) |
| Predecessor | `V1-ENROLL-01A` (Installer → Bootstrap → Persistent Service) — this mission closes its artifact/reboot gaps |
| Authoritative baseline | `docs/v1/V1-CORE-00_CORE_PRODUCT_GAP_VERIFICATION.md` (S-02, S-04, S-26) |
| Platform | Linux only (x86_64 certified; aarch64 covered by the release pipeline) |
| Deliverable | This report (30 fixed sections) + certified artifact path (build → sha256 → serve → curl install → systemd → reboot reconnect) |

### 2. Goal & Non-Goals

**Goal:** Deliver and certify the Linux agent **release path** end-to-end:
- Build a release binary (`cargo build --release`) and package it under the `techfusion-agent-linux-x86_64` + `.sha256` convention already defined by `.github/workflows/release-agent.yml`.
- Certify the **curl download path** (`--url <artifact>` → download → `sha256sum -c` → install) against the real API/DB, on systemd hosts.
- Certify **persistence after reboot**: systemd autostart, token restored from disk, same Device ID, no re-enrollment, no duplicate device, telemetry resume.
- Certify **online/offline truthfulness** against the presence contract (`lastSeenAt` within `DEVICE_ONLINE_THRESHOLD_MS`).
- Re-verify checksum **fail-closed** behavior (tampered artifact is rejected, nothing installed).
- Re-run the full regression surface (agent cargo tests, web jest/tsc/build, installer static verifier).

**Non-goals (preserve as-is):**
- Enrollment token lifecycle (`enrollment.service.ts`: hash, maxUses, expiry, revoke/regenerate, audit).
- `register-public` endpoint, token validation, dedupe order, credential rotation (`devices.service.ts`).
- Persistent device identity v2 (`identity.rs`), disk persistence format, presence/telemetry/command paths.
- Org/RBAC, auth, billing, reports, alerts, AI. **No broad dependency upgrades. No DB resets.**

### 3. Exit / Preserve Contracts

The following contracts were treated as frozen and must remain behaviorally identical:
- `POST /devices/register-public` request/response shape and `403` semantics (invalid / expired / exhausted / revoked).
- Token format `tfenr_<64 hex>`; server stores only `sha256(plain)`; single-use `maxUses=1`.
- Device identity dedupe order: `identityFingerprint` → `installationId` → `hostname`.
- Device token/device_id/installation_id persistence under the state dir; `0600` files / `0700` dir.
- Artifact naming + sibling checksum: `techfusion-agent-linux-<abi>` with `<name>.sha256` (installer fetches `${URL}.sha256`).
- Presence: telemetry push updates `lastSeenAt`; absence → Offline (5-minute threshold).
- Web install command contract: `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` (when set) appends `--url "<url>"`; installer requires a URL or `--binary` (fail-closed if neither).

### 4. Evidence Basis & Method

Evidence gathered via:
1. Static trace of the artifact contract (installer → `scripts/sync-installer-assets.sh` → web `public/` → OnboardingFlow/enrollment page → `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` → `release-agent.yml`).
2. Real release build: `cargo build --release` in `apps/agent`; binary inspected (`file`, `ldd`, `--version`); packaged with sha256 sidecar.
3. **Live installs via the curl download path** on two **systemd-enabled docker containers** (`jrei/systemd-ubuntu:24.04`) against the real API (`http://localhost:3001`) + Postgres (`localhost:5433`).
4. **Container reboot certification**: `docker restart` on both machines; service active, token restored, telemetry resumed, device count unchanged.
5. **Online/offline truth test**: stop → lastSeenAt frozen + zero metrics; start → telemetry resumes.
6. **Tamper/fail-closed test**: tampered binary + valid checksum sidecar → installer exits 3, nothing installed.
7. Full regression: agent `cargo test`, web `tsc --noEmit` + `jest --forceExit` + `next build`, `scripts/verify-linux-bootstrap.sh`.

### 5. Repository Baseline

| Item | State |
|---|---|
| API host | `http://localhost:3001` (`/health` OK; ts-node `src/main.ts`) |
| Web host | `http://localhost:3000` (next dev on host) |
| Postgres | `localhost:5433` (techfusion/techfusion) |
| DB migration state | Prisma applied; pre-existing deleted `20260617000200_rls_extended/migration.sql` in working tree (not this mission) |
| Host systemd | `systemd 259` present; host is not a container |
| sudo | interactive auth only (`sudo -n true` fails) — real-host install/reboot is Manual QA (Section 23) |
| Docker | available; used for two systemd certification hosts |
| Release pipeline | `.github/workflows/release-agent.yml` exists (tag `v*`); **no tag published yet** (Section 29) |
| Artifact server (dev) | `python3 -m http.server 8888` serving `/tmp/opencode/tf-release` (dev-only; prod = GitHub release asset) |

---

## PART II — ARCHITECTURE & IMPLEMENTATION

### 6. Artifact Pipeline (Design A)

```
cargo build --release  ──►  techfusion-agent-linux-x86_64  ──►  .sha256 sidecar
        apps/agent/target/release/agent                              sha256sum
              │                                                          │
              ▼                                                          ▼
 release-agent.yml (tag v*)  ──►  dist/techfusion-agent-linux-<abi> + <abi>.sha256
              │                                                          │
              ▼                                                          ▼
  GitHub Release assets (sibling names)  ──►  NEXT_PUBLIC_AGENT_DOWNLOAD_URL points here
                                                          │
                                                          ▼
 enrollment page / OnboardingFlow  ──►  curl install-linux.sh (+.sha256) → sudo bash --url <url>
                                                          │
                                                          ▼
 install-linux.sh: download <url> + <url>.sha256 → sha256sum -c → install → enroll → systemd
```

This mission certified the local leg of the pipeline end-to-end (build → package → serve → curl → install → systemd → reboot). The GitHub-release leg is fully implemented but requires a `v*` tag (USER ACTION, Section 29).

### 7. Release Binary (Build & Package)

| Item | Value |
|---|---|
| Build command | `cargo build --release` in `apps/agent` |
| Artifact | `apps/agent/target/release/agent` → packaged as `techfusion-agent-linux-x86_64` |
| Size | 8,011,192 bytes |
| Format | ELF 64-bit x86-64, PIE |
| Version | `agent 1.0.0` |
| Runtime deps (`ldd`) | `libgcc_s.so.1`, `libm.so.6`, `libc.so.6` only |
| SHA-256 | `179804dd6e618e996604bad235dd8f5ab2ae5f8eab42bc732d0838f07d4d7c8a` |
| Dev artifact server | `http://localhost:8888` (bound `0.0.0.0` for container access) |

The release pipeline (`release-agent.yml`) rebuilds per-architecture and re-derives the checksum from **its own** binary; the certified checksum here is for the locally built artifact used in all in-session E2E installs.

### 8. Download URL Contract (Verified)

- Installer: `--url <download-url>` or `TECHFUSION_AGENT_DOWNLOAD_URL`; fetches `${url}` and `${url}.sha256`; `sha256sum -c` must pass or installer dies (exit 3). No silent fallback — a missing URL fails closed with an actionable message.
- Web: `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` (when set) is appended as `--url "<url>"` by both `OnboardingFlow.tsx` and the enrollment page install command. Public web assets `install-linux.sh` + `install-linux.sh.sha256` are served at `:3000` (verified 200) and match `scripts/` (verifier check).
- Release assets are published as **siblings** (`techfusion-agent-linux-x86_64` + `.sha256`), so the installer's `${URL}.sha256` fetch resolves when `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` points at the release asset.

### 9. Installer Behavior (unchanged, re-certified)

`scripts/install-linux.sh` v1.0.0: root pre-check → platform check → download + checksum verify → install binary (`0755 root:root`) → write `/etc/techfusion/agent.env` (`0600`, no token) → one-shot enroll (`--enroll` via env, token never persisted, `unset` after) → write static unit → `systemctl daemon-reload/enable/start` → confirm active. Exit codes `0`–`6`; fail-closed everywhere.

### 10. Identity & Dedupe (re-certified on real API)

- Machine A (`tf-enroll01b-cert`, hostname `eg-pc`, machine-id `3c4b4d66…`): install merged into the existing device `df23852f` (dedupe matched on the shared `eg-pc` hostname). QA org keeps exactly **1** device; credential rotated via `duplicate_detected` (credentialVersion → 3).
- Machine B (`tf-enroll01b-m2`, hostname `tf-enroll01b-m2`, distinct machine-id): created a genuinely separate device `f266c7cc`, credentialVersion 1.
- Net result: 1 device per test org — no duplicates after restart, reinstall, or reboot.

### 11. Systemd Service Model (re-certified live)

Unit: `ExecStart=/usr/local/bin/techfusion-agent`, `Restart=on-failure`, `RestartSec=5`, `After=network-online.target`, `Wants=network-online.target`, `StateDirectory=techfusion`, `EnvironmentFile=/etc/techfusion/agent.env`, `WantedBy=multi-user.target`. `systemctl enable` + `start` at install; autostart on container boot verified.

### 12. Persistence & Recovery

After reboot, the agent reads `device_id` + `device_token` + `installation_id` from the state dir → **no enrollment token required** → resumes telemetry. Log lines verified verbatim on both machines.

### 13. Web Surface

Enrollment page + OnboardingFlow render the 4-line Linux install command (download installer → verify its checksum → run as sudo with `--api --enroll-token [--url]`). `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` unset in dev → no `--url` arg → installer fail-closed unless `--binary`/URL provided (by design).

---

## PART III — TEST & QA EVIDENCE

### 14. Agent Test Surface (Rust)

`cargo test --quiet` in `apps/agent`: **60 passed, 0 failed** (~49.5s). Pre-existing style warnings in `client.rs` (field naming) — unchanged, not this mission.

### 15. Web Test Surface (Jest)

- `npx tsc --noEmit` in `apps/web`: clean, exit 0.
- `npx jest --forceExit --silent`: **27 suites / 713 tests passed**.
- `src/__tests__/onboarding-flow.spec.tsx` (install-command UI): **7/7 passed**.
- `next build` (with `NEXT_PUBLIC_API_URL=http://localhost:3001`): **success**, exit 0, enrollment route included.
- Pre-existing known issue (not introduced here): Jest major-version mismatch (`jest@30` vs `ts-jest@29`) — 713 tests pass via `--forceExit`.

### 16. Installer Test Surface

`bash scripts/verify-linux-bootstrap.sh`: **ALL CHECKS PASSED** (exit 0), including: no `eval`, URL scheme validation, checksum verify when provided, `--binary` support, `TECHFUSION_AGENT_DOWNLOAD_URL` support, unit stability, network-online, `Restart=on-failure`, StateDirectory, EnvironmentFile, enable-at-boot, token excluded from config, token unset after enroll, web copy matches `scripts/`.

### 17. CI Integration

- `.github/workflows/ci.yml`: agent-rust + linux-bootstrap-verify jobs (modified, pre-existing in working tree).
- `.github/workflows/release-agent.yml`: exists and verified correct — tag `v*` → x86_64 native + aarch64 cross (`cross`) → `dist/techfusion-agent-linux-<abi>` + `.sha256` → upload both as release assets, `contents: write`, `softprops/action-gh-release`. **Not yet triggered** (no `v*` tag).

### 18. Live E2E (real API + DB, curl download path, systemd hosts)

Two systemd hosts via docker (`--privileged --security-opt seccomp=unconfined --cgroupns=host --tmpfs /tmp --tmpfs /run --tmpfs /run/lock -v /sys/fs/cgroup:/sys/fs/cgroup:rw`, entry `/sbin/init`):

| Host | Container | Hostname | Enrolled via | Resulting Device |
|---|---|---|---|---|
| A | `tf-enroll01b-cert` | `eg-pc` | installer `--url http://172.17.0.1:8888/...` + real token (QA org) | `df23852f-19b3-4489-a2dc-a5e4976228c8` (merged, dedup) |
| B | `tf-enroll01b-m2` | `tf-enroll01b-m2` | installer `--url http://172.17.0.1:8888/...` + real token (M2 org) | `f266c7cc-9ba7-4e74-b1b8-574b49ec3558` (fresh) |

Each install: download → checksum verified against `179804dd…` → binary/unit/state installed → enroll → `systemctl` active. Restart → token restored → telemetry resumed.

### 19. Security Review

| Concern | Handling |
|---|---|
| Token in config/state/unit | Never — `agent.env` holds only `TF_API_URL`/`TF_STATE_DIR`/`RUST_LOG`; `grep -r tfenr_` over `/etc/techfusion`, `/var/lib/techfusion`, unit → 0 hits (both hosts). |
| Token in logs | `journalctl -u techfusion-agent` → 0 `tfenr_` hits (both hosts). |
| Token in process env | Present only during one-shot `--enroll`; process exits; `unset ENROLL_TOKEN` in installer. |
| Token in shell history | Residual risk (documented, unchanged from 01A): token appears on the `sudo bash` command line for a private beta. stdin-delivery mechanism is the later hardening. |
| Tamper / integrity | **Fail-closed verified**: tampered binary served with a valid checksum sidecar → installer exit 3 `Checksum mismatch: expected 179804dd…, got 717bfc03…`; no binary, no unit, no state written. |
| File permissions | Binary `0755 root:root`; config `0600 root:root`; state dir `0700 root`; state files `0600`; unit `0644 root:root`. |
| Replay | Single-use token (`maxUses=1`); reuse → 403 "fully used" (verified). |
| World-readable paths | None — all agent paths root-owned, non-world-writable. |
| Secrets in repo | None added; `.env.example` untouched; no production credentials introduced. |

### 20. Failure Handling & Exit Codes

- Installer: documented exit codes `0`–`6`; tamper test produced **exit 3** with the expected checksum-mismatch message; no silent partial success.
- Missing dependency (no curl/wget) → exit 2 with actionable message (observed; curl installed before re-test).
- Agent `--enroll`: exit 0 on success (prints Device ID); exit 1 with actionable error.
- Missing URL (no `--url`/`TECHFUSION_AGENT_DOWNLOAD_URL`/`--binary`) → installer fails closed with guidance.

### 21. Runtime & Compliance Checks

- Installer `bash -n` clean; `set -euo pipefail`; no `eval`.
- `systemd` on both container hosts: install-time `daemon-reload/enable/start`, `is-active` active, `is-enabled` enabled.
- Agent state files re-asserted `0600` at write time; state dir `0700`.
- Presence truth: service stopped → `lastSeenAt` frozen (age grew to 99s+, 0 metrics in 75s window); service started → telemetry resumed (`lastSeenAt` age 7s). Classification flips Offline once age exceeds `DEVICE_ONLINE_THRESHOLD_MS` (5 min).

### 22. Known Limitations

- **Release artifact not published**: no `v*` tag → `release-agent.yml` has not run → `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` cannot point at a real release asset. In-session installs used the dev artifact server (`http://localhost:8888`) which is not a production URL.
- **Physical reboot not performed**: the real host is the active dev machine with no passwordless sudo. Reboot certification was performed at **container level** (two full `docker restart` cycles on systemd hosts) — the strongest in-session evidence possible. A physical reboot on a root host remains Manual QA (Section 23).
- Windows/macOS: unchanged (out of scope).
- Temp/battery metrics not collected (pre-existing, out of scope).
- Token visible in shell history during `sudo bash` invocation (documented residual risk, Section 19).

### 23. Manual QA Required (on a real Linux host with root)

1. `bash scripts/verify-linux-bootstrap.sh` (CI also runs it).
2. Push a `v*` tag; confirm `release-agent.yml` publishes `techfusion-agent-linux-{x86_64,aarch64}` + `.sha256`; set `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` to the release asset URL and rebuild the web app.
3. Dashboard → Device Enrollment → Generate Token → copy the Linux install command → run as non-root; confirm success output, Device ID, `systemctl status techfusion-agent` active.
4. Dashboard: device Online within ~1 min; `lastSeenAt` ticks.
5. `sudo systemctl restart techfusion-agent` → same Device ID, no re-enrollment.
6. **Reboot the host** → agent auto-starts (`multi-user.target`), device returns Online without token re-entry, device count unchanged. *(This is the single remaining certification item.)*
7. `sudo bash scripts/uninstall-linux.sh` → service gone, `/var/lib/techfusion` preserved; re-install reconnects to the same device.

### 24. Environment Limitations

- No passwordless sudo on the host → root install + physical reboot could not run on the real machine; performed in systemd containers instead.
- Physical reboot cannot be automated in-session; container reboot is the certified proxy.
- GitHub Actions release run pending a `v*` tag push (repo authorization).
- Dev artifact server over HTTP (`localhost:8888`) is acceptable for E2E; production contract is HTTPS via the GitHub release asset.

### 25. Files Changed (this mission)

| File | Kind |
|---|---|
| `docs/v1/V1-ENROLL-01B_LINUX_ARTIFACT_RELEASE_REBOOT_CERTIFICATION_REPORT.md` | new — this report |
| (artifact) `apps/agent/target/release/agent` → `techfusion-agent-linux-x86_64` + `.sha256` | build output, not committed |

No source files were modified by this mission. Working tree changes from earlier missions (01A and prior) remain uncommitted: `release-agent.yml`, `scripts/{install,uninstall,sync,verify}-*.sh`, `apps/web/public/`, `onboarding-flow.spec.tsx`, agent/web source edits, `.github/workflows/ci.yml`, plus pre-existing items (deleted RLS migration file, `DASH-QA-01A`, etc.).

### 26. Repository Revision / Git State

- No commit made in this mission. Working tree carries uncommitted 01A changes (see Section 25).
- CI pipeline reference: `.github/workflows/ci.yml` (agent-rust + linux-bootstrap-verify), `.github/workflows/release-agent.yml` (artifact release, ready).

### 27. Regression Requirement

- **No regression introduced**: agent `cargo test` 60/60; web `tsc` clean; web `jest` 713/713 (incl. onboarding-flow 7/7); web `next build` green; installer verifier all-pass; HTTP checks green (`/login`, `/dashboard`, `/dashboard/settings/enrollment`, `/dashboard/device-health`, `/dashboard/team`, `/install-linux.sh`, `/install-linux.sh.sha256` all 200; API `/health` 200).
- Preserved contracts re-verified live: token lifecycle, public registration, identity v2, dedupe/rotation, persistence, presence/telemetry, artifact checksum contract.
- Pre-existing Jest mismatch and the deleted RLS migration file are repo-level debt, unchanged and out of scope.

### 28. Acceptance Scenario Traceability

| Scenario | Status | Evidence |
|---|---|---|
| 1. Install via curl download path on a clean machine | ✅ **PASSED** | Machine B (`tf-enroll01b-m2`): `--url` download → sha256 verify → install → enroll → active (Section 18). |
| 2. Reboot survives (auto-start, no token, same Device, online) | ✅ **PASSED (container)** / 🔲 physical | Two `docker restart` cycles: systemd autostart, token restored from disk, same Device ID, 1 device/org, telemetry resumed (Section 18). Physical reboot = Manual QA (Section 23). |
| 3. Token hygiene (maxUses=1, use once, second rejected) | ✅ **PASSED** | All 4 mission tokens `useCount=1/1`; reuse → 403 "fully used". |
| 4. Checksum integrity fail-closed | ✅ **PASSED** | Tampered binary + valid sidecar → exit 3, nothing installed (Section 19). |
| 5. Online/offline truthfulness | ✅ **PASSED** | stop → frozen lastSeenAt + 0 metrics; start → resume (Section 21). |
| 6. Release artifact published | 🔲 **USER ACTION** | `release-agent.yml` ready; no `v*` tag pushed (Section 29). |

### 29. Final Status

```
MISSION          : V1-ENROLL-01B — Linux Artifact Release & Reboot Certification
STATUS           : PARTIAL — RELEASE ACTION REQUIRED  (+ PARTIAL — REBOOT CERTIFICATION REQUIRED)
```

Rationale: the full artifact path (build → package → sha256 → curl download → checksum verify → install → systemd → restart/reboot reconnect → dedup → telemetry resume → online/offline truth) is implemented and was certified **live** on two systemd hosts against the real API/Postgres, including a fail-closed tamper test and full regression (agent 60/60, web 713/713, build green, verifier all-pass). Two USER ACTION items remain:

1. **RELEASE ACTION REQUIRED** — push a `v*` tag to run `release-agent.yml` and publish `techfusion-agent-linux-{x86_64,aarch64}` + `.sha256` to GitHub Releases, then set `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` to the release asset URL. Until then the certified artifact exists only locally (`http://localhost:8888`, dev).
2. **REBOOT CERTIFICATION REQUIRED** — perform the physical reboot acceptance on a root Linux host (Section 23 step 6). Container-level reboot is certified; the real-machine reboot needs a human at the console.

### 30. Follow-up / Next Steps

1. Push a `v*` tag → verify release assets appear → set `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` → rebuild web.
2. Run Manual QA on a root host, including the physical reboot (Section 23).
3. After (1)+(2): re-issue with status `COMPLETE — LINUX ARTIFACT RELEASE & REBOOT CERTIFIED`.
4. Optional hardening (later): token delivery via stdin to remove shell-history residual risk.

---

## V1-ENROLL-01B — Final Response

```
MISSION        : V1-ENROLL-01B — Linux Artifact Release & Reboot Certification
STATUS         : PARTIAL — RELEASE ACTION REQUIRED (+ REBOOT CERTIFICATION REQUIRED)

ARTIFACT       : CERTIFIED — cargo build --release → techfusion-agent-linux-x86_64
                 (8,011,192 B, ELF x86-64 PIE, agent 1.0.0)
                 sha256 179804dd6e618e996604bad235dd8f5ab2ae5f8eab42bc732d0838f07d4d7c8a
DOWNLOAD       : CERTIFIED — installer --url path: download → sha256sum -c → install
INTEGRITY      : FAIL-CLOSED — tampered binary rejected (exit 3, checksum mismatch),
                 nothing installed
SYSTEMD        : CERTIFIED (container) — install enable/start, restart restore, autostart
REBOOT         : CERTIFIED at container level (2 hosts, 2 docker-restart cycles):
                 token restored from disk, same Device ID, no re-enrollment, telemetry resumed
DEDUP          : VERIFIED — 1 device per test org; second machine = separate device;
                 same-machine reinstall/reboot merges, credential rotates (duplicate_detected)
PRESENCE       : TRUTHFUL — stop → lastSeenAt frozen / 0 metrics; start → resume
TOKEN-HYGIENE  : VERIFIED — 4/4 tokens useCount=1/1; reuse → 403; 0 tfenr_ in config,
                 state, unit, or journalctl
TESTS          : agent cargo test 60/60; web jest 713/713; tsc clean; next build green;
                 verify-linux-bootstrap.sh ALL CHECKS PASSED
RELEASE        : USER ACTION — push v* tag to publish GitHub release assets +
                 NEXT_PUBLIC_AGENT_DOWNLOAD_URL
REBOOT-QA      : USER ACTION — physical reboot acceptance on a root Linux host (Sec 23)
NEXT-STEP      : publish artifacts → run Manual QA reboot → re-issue as COMPLETE
```

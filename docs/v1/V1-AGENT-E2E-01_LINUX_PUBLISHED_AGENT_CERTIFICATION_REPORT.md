# V1-AGENT-E2E-01 — Published Linux Agent Zero-Touch Enrollment Certification Report

## PART I — MISSION IDENTITY

### 1. Mission Identity

| Field | Value |
|---|---|
| Mission ID | `V1-AGENT-E2E-01` |
| Title | Published Linux Agent Zero-Touch Enrollment Certification |
| Parent | `V1-ENROLL-01` (Zero-Touch Enrollment, Persistent Identity & Auto-Reconnect) |
| Predecessors | `V1-ENROLL-01A` (Installer → Bootstrap → Persistent Service), `V1-ENROLL-01B` (Artifact Release & Reboot Certification) |
| Authoritative baseline | `docs/v1/V1-CORE-00_CORE_PRODUCT_GAP_VERIFICATION.md` (S-02, S-04, S-26) |
| Platform | Linux only (x86_64 + aarch64 published artifacts) |
| Deliverable | This report (fixed sections) + published-release zero-touch install path (Dashboard → curl installer → verified binary → one-shot enroll → persistent identity → systemd service) |

### 2. Goal & Non-Goals

**Goal:** Close the gap left open by `V1-ENROLL-01B` — the Linux agent binary release (`v1.0.0-agent-beta.2`) is now published on GitHub Releases. This mission wires the entire published-release path together and certifies it:
- Installer resolves the correct **per-architecture published asset** from a release base URL (`--release` / `TECHFUSION_AGENT_RELEASE_URL`).
- Checksum verification is **mandatory and fail-closed** (sibling `.sha256` sidecar fetched and verified; no sidecar / mismatch → install refused).
- Web Dashboard default points at the published release so the enrollment page works **out of the box** (no `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` required), while the env override is retained for self-hosted mirrors.
- Enrollment token → durable-device-identity contract, systemd autostart, and reconnect are re-verified statically and via tests.

**Non-goals (preserve as-is):**
- No redesign of enrollment architecture, Dashboard visual direction, or unrelated frontend.
- No Windows/macOS/GUI installer work (out of scope; Windows/macOS keep the developer `cargo run` command).
- No auth weakening; no fake telemetry/device status; no DB resets; no migration deletion; no broad dependency upgrades; no unrelated refactors.
- No new tag/release created by this mission (the `v1.0.0-agent-beta.2` release already exists and is used as-is).

### 3. Exit / Preserve Contracts

The following contracts were treated as frozen and remain behaviorally identical:
- `POST /devices/register-public` request/response shape and `403` semantics (invalid / expired / exhausted / revoked).
- Token format `tfenr_<64 hex>`; server stores only `sha256(plain)`; **single-use `maxUses=1` for Linux onboarding**.
- Device identity dedupe order: `identityFingerprint` → `installationId` → `hostname`.
- Device token/device_id/installation_id persistence under the state dir; `0600` files / `0700` dir.
- Artifact naming + sibling checksum: `techfusion-agent-linux-<abi>` with `<name>.sha256`.
- Presence: telemetry push updates `lastSeenAt`; absence → Offline (`DEVICE_ONLINE_THRESHOLD_MS = 5 min`).
- Web env surface: `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` **retained by name**, reinterpreted as a release **base URL** (documented below).

### 4. Evidence Basis & Method

Evidence gathered via:
1. Static trace of the published-artifact contract: installer → `scripts/sync-installer-assets.sh` → web `public/` → `lib/agent-download.ts` → OnboardingFlow/enrollment page → `release-agent.yml`.
2. **Live verification of the published GitHub Release** `v1.0.0-agent-beta.2` assets (download, sibling `.sha256`, sha256 match, ELF arch, native `--version`).
3. Dynamic execution of the **actual installer arch/resolution block** with mocked `uname` (x86_64/amd64/aarch64/arm64 → correct asset; unsupported → exit 2; non-http(s) → exit 3).
4. Full regression: agent `cargo test`, web `tsc`, web `jest`, installer static verifier, web asset checksum match.
5. Static verification of the token → durable-identity contract and systemd/reconnect implementation (root-gated live install cannot run here — see Section 24).

### 5. Repository Baseline

| Item | State |
|---|---|
| Release | `v1.0.0-agent-beta.2` published at `https://github.com/Gamal2036/techfusion-ai/releases` (assets below) |
| API host | `http://localhost:3001` |
| Web host | `http://localhost:3000` |
| sudo | interactive auth only (`sudo -n true` fails) — root install/reboot is Manual QA |
| systemd | present on host; agent not installed (`techfusion-agent` inactive) |
| CI | `ci.yml` (agent-rust + linux-bootstrap-verify jobs), `release-agent.yml` (published the release) |
| Working tree | uncommitted changes from prior missions remain (ENROLL-01A/01B source edits, scripts, web public/, deleted RLS migration file — pre-existing, not this mission) |

## PART II — ARCHITECTURE & IMPLEMENTATION

### 6. Published Release Asset Contract

Verified live from GitHub Releases:

| Asset | SHA-256 | ELF arch | Native exec |
|---|---|---|---|
| `techfusion-agent-linux-x86_64` | `7f2dd1567f10ea1ba7804e746cf5c72905e7325f0142b37439110ede7d5fd6f1` | x86-64 | ✅ `--version` runs on this host |
| `techfusion-agent-linux-aarch64` | `2b0d88c61b71111f3fbcbef6f3f50ba9911d4b3115ff9d810bf3074d67f30cdd` | aarch64 | n/a (host is x86_64) |

Sibling `techfusion-agent-linux-<abi>.sha256` sidecars are published and **match** the binaries. Asset base URL:
`https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.2`

This is the contract `scripts/install-linux.sh` relies on.

### 7. Installer Changes (`scripts/install-linux.sh` v1.1.0)

| Change | Detail |
|---|---|
| `--release <base>` | New binary-source flag; also `TECHFUSION_AGENT_RELEASE_URL` env |
| Per-arch resolution | `x86_64/amd64 → techfusion-agent-linux-x86_64`; `aarch64/arm64 → techfusion-agent-linux-aarch64` (install-linux.sh:140-157) |
| Unsupported arch | `die 2 "Unsupported CPU architecture"` (install-linux.sh:143) |
| Release scheme validation | only `http://` / `https://`, else `die 3` (install-linux.sh:151-154) |
| Mutual exclusivity | `--release` and `--url` together → `die 1`; neither/binary → fail-closed guidance (install-linux.sh:116-129) |
| **Mandatory checksum (fail-closed)** | fetch sibling `${BINARY_URL}.sha256` (curl or wget); if unavailable → `die 3 "refusing to install an unverified binary"`; mismatch → `die 3` (install-linux.sh:220-235) |
| Backwards compatible | `--url` / `--binary` / `--sha256` paths unchanged |

### 8. Web Changes

- `apps/web/src/lib/agent-download.ts` (new):
  - `DEFAULT_AGENT_RELEASE_BASE_URL = https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.2`
  - `resolveAgentReleaseBaseUrl()`: `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` (trimmed) when set, else the published default.
- `apps/web/src/components/command-center/OnboardingFlow.tsx`:
  - Linux command renders: download installer + `.sha256` sidecar → `sha256sum -c` → `sudo bash ... --api <api> --enroll-token <token> --release "<base>"`.
  - Linux token `maxUses=1` (single-use); other OS remain `maxUses=5`.
  - The old **blocker warning banner is removed**; an informational note (shown only when the env is unset) explains the published default and the env override for mirrors.
  - Linux-specific step titles/instructions ("Install the Agent", "One-time install that registers your device").
- `apps/web/src/app/dashboard/settings/enrollment/page.tsx`: Linux install-command block with `--release`, copy button, updated step text.
- `apps/web/public/install-linux.sh` + `.sha256` regenerated via `scripts/sync-installer-assets.sh`; byte-identical to `scripts/install-linux.sh` (sha256 `9ca6b250e8bb285e3af255fe9cae0375f29f12206ca6fcb4ba9435c5f766140f`).

### 9. Semantics Note (documented change)

`NEXT_PUBLIC_AGENT_DOWNLOAD_URL` was previously treated as a **single asset URL** (`--url`). It is now a **release base URL** (`--release`). The env name is unchanged to preserve the deployment surface; the dashboard now works with zero configuration via the built-in published-release default. This is the intended fix for the ENROLL-01B "RELEASE ACTION REQUIRED" gap.

### 10. Verification Tooling

| Script | Purpose |
|---|---|
| `scripts/verify-agent-release-assets.sh` (new) | Live published-artifact check: download, sidecar, sha256, ELF arch, native `--version` |
| `scripts/verify-installer-arch-resolution.sh` (new) | Executes the installer's real arch/resolution block with mocked `uname`; asserts per-arch URLs + exit 2/3 fail-closed |
| `scripts/verify-linux-bootstrap.sh` | Static installer/security verifier — extended with `--release`, `TECHFUSION_AGENT_RELEASE_URL`, per-arch asset, mandatory-checksum, and sidecar-fetch checks |

### 11. Security Handling

| Concern | Handling |
|---|---|
| Integrity | **Mandatory fail-closed**: no sibling checksum → exit 3; mismatch → exit 3; nothing installed. Verified by static verifier + live sidecar match. |
| Scheme | Downloads only over `http(s)`; non-http release/URL → exit 3 (dynamic test). |
| Token hygiene | Single-use token (`maxUses=1`) for Linux; used once via one-shot `--enroll`; `unset ENROLL_TOKEN` after; config file contains no token (verifier + grep). |
| Durable identity | Device token/device_id/installation_id persisted under `0700` state dir as `0600` files; no enrollment token persisted. |
| Per-arch correctness | Unsupported arch fails clearly with exit 2 (dynamic test). |
| Secrets in repo | None added; `.env.test` contains only placeholder test credentials and is explicitly un-ignored (`!.env.test`) — pre-existing, not this mission. |

### 12. Files Changed (this mission)

| File | Kind |
|---|---|
| `scripts/install-linux.sh` | modified — v1.1.0 `--release` + mandatory checksum |
| `apps/web/src/lib/agent-download.ts` | new — release base URL resolution + default |
| `apps/web/src/components/command-center/OnboardingFlow.tsx` | modified — `--release` command, single-use token, banner |
| `apps/web/src/app/dashboard/settings/enrollment/page.tsx` | modified — Linux install command + copy |
| `apps/web/src/__tests__/onboarding-flow.spec.tsx` | modified — `--release` expectations |
| `apps/web/public/install-linux.sh` (+ `.sha256`) | regenerated (matches `scripts/`) |
| `scripts/verify-agent-release-assets.sh` | new |
| `scripts/verify-installer-arch-resolution.sh` | new |
| `scripts/verify-linux-bootstrap.sh` | modified — new installer-contract checks |

## PART III — TEST & QA EVIDENCE

### 13. Agent Test Surface (Rust)

`cargo test` in `apps/agent`: **60 passed, 0 failed**. Relevant contract tests all green: state-dir permissions `0700`, token-file `0600`, `invalidate_token` removes only the token, `clear_stored_credentials` removes token+id, `save/restore token` roundtrip, credential-recovery path, deterministic identity fingerprint, `installation_id` persistence, `ensure_registered` requires credentials.

### 14. Web Test Surface (Jest + tsc)

- `npm test` (`jest --forceExit`): **27 suites / 714 tests passed**.
- `onboarding-flow.spec.tsx`: **8/8 passed**, including the two Linux cases updated for `--release` (env override + published default; asserts no `--url` on the default path).
- `npm run lint` (`tsc --noEmit`): **clean, exit 0**.

### 15. Installer / Bootstrap Verifier

`bash scripts/verify-linux-bootstrap.sh`: **ALL CHECKS PASSED** (exit 0), including the new assertions: `--release` supported, `TECHFUSION_AGENT_RELEASE_URL` supported, per-arch asset selection, mandatory-checksum fail-closed string present, sibling `.sha256` fetched with the selected fetcher, web copy matches `scripts/`, checksum sidecar matches installer. Pre-existing checks (no `eval`, URL scheme validation, unit stability/network-online/Restart/StateDirectory/enable-at-boot, token excluded from config, token unset after enroll) all pass.

### 16. Published Release Asset Verification (live)

`bash scripts/verify-agent-release-assets.sh`: **ALL RELEASE ASSET CHECKS PASSED** — both `x86_64` and `aarch64` assets download (HTTP 200), sibling checksums obtainable and **matching** (hashes in Section 6), ELF architecture confirmed, and the native `x86_64` binary executes `--version` on this host.

### 17. Architecture / URL Resolution Verification (dynamic, real installer block)

`bash scripts/verify-installer-arch-resolution.sh`: **ALL CHECKS PASSED** — `x86_64`/`amd64` → `.../techfusion-agent-linux-x86_64`; `aarch64`/`arm64` → `.../techfusion-agent-linux-aarch64`; `riscv64` → **exit 2**; non-http(s) release base → **exit 3**. The block under test is extracted verbatim from `scripts/install-linux.sh`.

### 18. Enrollment → Durable-Identity Contract

| Layer | Evidence |
|---|---|
| Token creation | Linux onboarding requests `maxUses=1`; server stores `sha256(plain)` only (frozen contract). |
| One-shot enroll | Installer runs `TF_ORG_TOKEN=… TF_ENROLL=true` once, then `unset ENROLL_TOKEN` (install-linux.sh:283-294). |
| No token on disk | `agent.env` holds only `TF_API_URL`/`TF_STATE_DIR`/`RUST_LOG`; verifier asserts config excludes the token. |
| Durable credential | Agent persists `device_token`/`device_id`/`installation_id` (0700 dir, 0600 files); re-runs skip enrollment when identity exists (install-linux.sh:281-282). |
| Recovery | On restart, agent recovers the credential via `identity_fingerprint` + `installation_id` (registration.rs); tests green. |
| Dedupe | fingerprint → installationId → hostname (frozen contract, certified in ENROLL-01B). |

### 19. systemd / Autostart / Reconnect (static)

- Unit: `network-online.target` wait, `Restart=on-failure` + `RestartSec=5`, `StateDirectory=techfusion` (mode 0700), `EnvironmentFile=/etc/techfusion/agent.env`, `PrivateTmp=true`, `WantedBy=multi-user.target` (install-linux.sh:303-321).
- Installer performs `daemon-reload` → `enable` → `start/restart`; verifies `is-active` (install-linux.sh:325-353).
- Reconnect: agent exponential backoff on 5xx (`client.rs`), 60s pause on 429, credential recovery on restart, systemd auto-restart. (Live reboot/resume already certified in ENROLL-01B at container level.)

### 20. Failure Handling & Exit Codes

| Case | Result |
|---|---|
| Unsupported arch | exit 2, clear message (dynamic test) |
| Non-http(s) release/URL scheme | exit 3 (dynamic test) |
| No checksum sidecar | exit 3 "refusing to install an unverified binary" (static verifier) |
| Checksum mismatch | exit 3 (logic + ENROLL-01B live tamper test) |
| `--release` + `--url` together | exit 1 |
| No binary source | exit 1 with guidance |
| Missing dep / non-Linux / non-root / no systemd | exit 2/1 with actionable message |

### 21. Regression

- Agent `cargo test` 60/60; web `tsc` clean; web `jest` 714/714 (onboarding-flow 8/8); installer verifier all-pass; live release asset + arch resolution verifiers all-pass.
- No source changes to API, auth, presence, or device-persistence contracts.
- Pre-existing repo debt unchanged (deleted RLS migration file, Jest `--forceExit` requirement, odd-named pre-existing files).

### 22. Known Limitations

- **Root-gated live install not run on this host**: no passwordless sudo; full `sudo bash install-linux.sh --release …` with a real single-use token is the one remaining certification item (Manual QA, Section 23).
- Physical reboot remains a human-at-console item (container-level reboot certified in ENROLL-01B).
- `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` semantics changed from asset URL → release base URL; any operator that previously set it to a single asset URL must now point it at a release base URL (Section 9).

### 23. Manual QA Required (on a real Linux host with root)

1. `bash scripts/verify-linux-bootstrap.sh` (CI also runs it).
2. Dashboard → Device Enrollment → select Linux → Generate Token → copy the install command (or run the equivalent below):
   ```bash
   curl -fsSL -o /tmp/techfusion-install.sh "http://localhost:3000/install-linux.sh"
   curl -fsSL -o /tmp/techfusion-install.sh.sha256 "http://localhost:3000/install-linux.sh.sha256"
   (cd /tmp && sha256sum -c techfusion-install.sh.sha256)
   sudo bash /tmp/techfusion-install.sh \
     --api "http://localhost:3001" \
     --enroll-token "tfenr_<your-single-use-token>" \
     --release "https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.2"
   ```
   **Expected:** `Resolved per-architecture asset: …/techfusion-agent-linux-x86_64`, checksum verified, `TechFusion Agent is RUNNING`, a Device ID printed; `systemctl status techfusion-agent` → active; re-running the same token → 403.
3. Dashboard: device appears **Online** within ~1 min; `lastSeenAt` ticks.
4. `sudo systemctl restart techfusion-agent` → same Device ID, no re-enrollment.
5. `sudo reboot` → agent auto-starts, device returns Online with no token entry, device count unchanged.
6. `sudo bash scripts/uninstall-linux.sh` → service removed, `/var/lib/techfusion` preserved; re-install reconnects to the same device.

### 24. Environment Limitations

- No passwordless sudo → root install + physical reboot are human actions (deferred to Section 23).
- A real enrollment token cannot be consumed automatically (single-use; would burn a device record).
- GitHub Actions already ran: the release artifacts exist and were verified live — no new tag needed.

### 25. Repository Revision / Git State

- No commit made in this mission. Working tree carries uncommitted prior-mission changes (ENROLL-01A/01B source edits, scripts, web public/, `.env.test`, deleted RLS migration file) plus this mission's files in Section 12. No unrelated/destructive modifications introduced (verified via `git status`/`git diff` review).

## PART IV — FINAL

### 26. Acceptance Scenario Traceability

| Scenario | Status | Evidence |
|---|---|---|
| 1. Published release assets downloadable + checksums match | ✅ **PASSED (live)** | GitHub v1.0.0-agent-beta.2; Section 6, 16 |
| 2. Installer resolves per-arch published asset | ✅ **PASSED** | Dynamic arch verifier; Section 17 |
| 3. Checksum mandatory / fail-closed | ✅ **PASSED** | Static verifier + logic; ENROLL-01B live tamper test |
| 4. Dashboard works with zero env config (published default) | ✅ **PASSED** | `agent-download.ts` + jest 8/8 + tsc clean |
| 5. Env override still supported | ✅ **PASSED** | jest env-override case |
| 6. Single-use token → durable identity → systemd autostart → reconnect | ✅ **PASSED (tests + static)** | cargo 60/60; verifier; Sections 18-19. Live root install = Manual QA (Section 23). |
| 7. Full live install on a root host + reboot | 🔲 **MANUAL QA** | Section 23 |

### 27. Final Status

```
MISSION          : V1-AGENT-E2E-01 — Published Linux Agent Zero-Touch Enrollment Certification
STATUS           : PARTIAL — MANUAL E2E REQUIRED
```

Rationale: every automated certification item **passed** — published artifacts verified live (both arches, checksums match, ELF, native exec), installer arch/URL resolution and mandatory-checksum fail-closed behavior verified dynamically against the real installer, Dashboard zero-config published-release path verified by tests/tsc, token → durable-identity and systemd/reconnect contracts re-verified (agent 60/60, web 714/714). The **single remaining item** is the root-gated live install with a real single-use token and the physical reboot, which cannot be executed non-interactively here and must be run by a developer (exact commands in Section 23).

### 28. Follow-up / Next Steps

1. Developer runs Section 23 Manual QA on a real Linux host with root.
2. After step 1 passes, re-issue this mission with status `COMPLETE — CERTIFIED`.
3. Recommended next mission: `V1-ENROLL-02` (token delivery via stdin to eliminate the shell-history residual risk), or a web deployment/CI-release mission to publish a fresh production build now that the release default is embedded.

---

## V1-AGENT-E2E-01 — Final Response

```
MISSION        : V1-AGENT-E2E-01 — Published Linux Agent Zero-Touch Enrollment Certification
STATUS         : PARTIAL — MANUAL E2E REQUIRED

CHANGES        : installer --release base URL + TECHFUSION_AGENT_RELEASE_URL,
                 per-arch asset resolution, mandatory fail-closed checksum,
                 web published-release default (lib/agent-download.ts), single-use
                 Linux token (maxUses=1), informational banner replacing blocker,
                 live asset verifier + dynamic arch verifier scripts.

TESTS          : agent cargo 60/60 ; web jest 714/714 (onboarding 8/8) ; tsc clean
                 installer verifier ALL PASS ; release assets ALL PASS (live)
                 arch/URL resolution ALL PASS (dynamic)

ARTIFACTS      : x86_64  sha256 7f2dd1567f10ea1ba7804e746cf5c72905e7325f0142b37439110ede7d5fd6f1
                 aarch64 sha256 2b0d88c61b71111f3fbcbef6f3f50ba9911d4b3115ff9d810bf3074d67f30cdd
                 base https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.2

INTEGRITY      : FAIL-CLOSED — no sidecar → exit 3 ; mismatch → exit 3 ; scheme → exit 3
IDENTITY       : single-use token → durable device credential (0700 dir / 0600 files),
                 no token persisted, credential recovery, dedupe fingerprint→id→hostname

MANUAL E2E     : run the Section 23 command with a fresh single-use token on a root
                 Linux host; verify Online device, restart (same Device ID),
                 reboot (auto-start), uninstall/reinstall.

NEXT MISSION   : V1-ENROLL-02 (stdin token delivery) or web deploy/CI release with the
                 embedded published-release default.
```

Report written to `docs/v1/V1-AGENT-E2E-01_LINUX_PUBLISHED_AGENT_CERTIFICATION_REPORT.md`.

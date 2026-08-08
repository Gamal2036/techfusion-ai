# V1-STAGE-00B — Agent Identity Reset & Re-Enrollment

> **Date:** 2026-08-08
> **Scope:** Local Agent identity lifecycle — safe, explicit RESET IDENTITY for the
> Linux Agent. No backend changes. No migrations. No remote reset surface.
> **Companion docs:** `V1-ENROLL-01A_LINUX_ZERO_TOUCH_ENROLLMENT_REPORT.md` (Section 31 addendum),
> `V1-ENROLL-01B_LINUX_ARTIFACT_RELEASE_REBOOT_CERTIFICATION_REPORT.md`.

---

## 1. Executive Summary

The Linux Agent persists its enrollment identity locally
(`/var/lib/techfusion`: `device_token`, `device_id`, `installation_id`). Today the only
official path to return a test device to an unenrolled state is manually deleting those
files — an undocumented, operator-error-prone procedure that sits dangerously close to
"delete everything under `/var/lib`".

V1-STAGE-00B adds a **single canonical, narrow, root-gated, confirmation-protected**
lifecycle operation:

```
sudo techfusion-agent reset-identity
```

and a read-only companion:

```
techfusion-agent identity-status
```

RESET IDENTITY removes **only** the three known identity/credential files (plus their
atomic-save `.tmp` crash variants), preserves the binary, systemd unit, non-secret
configuration, and every other file in the state directory, leaves the service
installed-but-stopped, and never touches the server-side Device record.

Outcome of the primary scenario: Device A (Org A) → reset → fresh token from Org B →
**new** Device B registers in Org B, Device A remains in Org A and goes OFFLINE via
existing presence monitoring. No cross-org mutation, no device transfer, no server-side
deletion.

---

## 2. Existing Agent Identity Audit

### 2.1 Components inspected

| Component | Location | Findings |
|---|---|---|
| Agent binary | `apps/agent/src/{main,config,agent,client,registration,identity}.rs` | CLI is clap 4, flag-based, no subcommands; identity state fully centralized in `registration.rs` + `identity.rs`. |
| Installer | `scripts/install-linux.sh` | Idempotent; existing identity → skip enrollment. |
| Uninstaller | `scripts/uninstall-linux.sh` | `--purge` semantics; never deletes cloud records. |
| systemd unit | written by installer to `/etc/systemd/system/techfusion-agent.service` | `StateDirectory=techfusion`, `ProtectSystem=strict`, `Restart=on-failure`. |
| API server | `apps/api-gateway/src/devices/devices.service.ts`, `devices.controller.ts` | `register-public`, `recover-credential`, credential rotation, org-scoped dedupe. |

### 2.2 Startup flow (exact locations)

1. `main.rs:25` — `AgentConfig::from_env()`.
2. `main.rs:61` — `Agent::new(config)`.
3. `agent.rs:36` — `registration::ensure_registered(&config)`.
4. `registration.rs:249` `ensure_registered`:
   - `TF_DEVICE_TOKEN` set → `RegistrationSource::Environment` (`registration.rs:254`).
   - `TF_ORG_TOKEN` set → fresh registration (`registration.rs:268`, `first_time_register`).
   - disk identity present → `RegistrationSource::Disk` (`registration.rs:277`, `load_token`).
   - none → hard error "No credentials found" (`registration.rs:283`).
5. `registration.rs:37` `first_time_register` → `register_device_public` (`client.rs:185`)
   → persists via `save_token`/`save_device_id` (`registration.rs:119-120`, atomic tmp+rename, 0600).
6. `agent.rs:78` `run()` → telemetry/security/inventory/remote loops using
   `self.device_token` for authenticated calls.
7. 401 path: `agent.rs:200` → `handle_token_rejection` → `invalidate_token` (`registration.rs:373`)
   then bounded re-registration (`attempt_reregister`, `registration.rs:295`).

### 2.3 Enrollment token lifecycle

- Token (`tfenr_…`) is accepted via `TF_ORG_TOKEN` env only; consumed by the API
  (`maxUses`), never written to disk (`main.rs:78-80`, `install-linux.sh` `unset ENROLL_TOKEN`).
- Installer passes it in-process; `agent.env` contains no token.

---

## 3. Persistent Files Map

`/var/lib/techfusion` (or `TF_STATE_DIR`):

| File | Purpose | Secret? | REMOVE ON RESET? | REMOVE ON UNINSTALL (default)? | REMOVE ON UNINSTALL `--purge`? |
|---|---|---|---|---|---|
| `device_token` | long-term device credential used for API auth | **YES** | **YES** | no | yes |
| `device_id` | server Device UUID | no | **YES** (identity) | no | yes |
| `installation_id` | persistent installation UUID; anchor of identity fingerprint v2 | no (but identity) | **YES** | no | yes |
| `device_token.tmp` | atomic-save crash residue | **YES** | **YES** | no | yes |
| `device_id.tmp` | atomic-save crash residue | no | **YES** | no | yes |
| `installation_id.tmp` | atomic-save crash residue | no | **YES** | no | yes |
| any other file (logs, caches, runtime state, config) | agent runtime | varies | **NO — preserved** | no | yes |

No other identity files exist. The agent writes only the three named files plus their
`.tmp` variants (`grep state_dir` over `apps/agent/src`). The identity fingerprint v2
(`identity.rs:100`) hashes `installation_id` + `/etc/machine-id` + SMBIOS `product_uuid`;
the latter two are system-wide and are **never** touched by a reset.

---

## 4. Startup Identity Flow (traced)

```
agent start (main.rs:61 Agent::new)
  └─ ensure_registered (registration.rs:249)
       ├─ TF_DEVICE_TOKEN ?        → Environment  (env-auth, no disk write)
       ├─ TF_ORG_TOKEN ?           → FreshRegistration (registration.rs:268)
       │    └─ register-public → save device_token + device_id + installation_id
       ├─ disk identity ?          → Disk  (registration.rs:277, load_token/load_device_id)
       └─ none                     → error "No credentials found" (registration.rs:283)
  └─ run() (agent.rs:78) telemetry loops (device_token used for API auth)
```

Decision point for this mission: an existing local identity means the service runs from
`Disk` source and never re-enrolls, which is the safe behavior the installer depends on.
The reset command converts an `ENROLLED` host back to the `no disk identity` branch so a
fresh token can drive `FreshRegistration`.

---

## 5. Reset Contract (implemented)

Command shape chosen: **CLI subcommands** (clap already present — smallest consistent
architecture; no script layer needed for the primary flow).

```
sudo techfusion-agent reset-identity          # interactive confirmation (type RESET)
sudo techfusion-agent reset-identity --yes    # non-interactive automation
techfusion-agent identity-status              # safe read-only metadata
techfusion-agent identity-status --state-dir /path   # explicit state dir
```

Behavior sequence (`reset.rs::run_reset`):

1. Resolve state dir (`--state-dir` → `TF_STATE_DIR` → `/etc/techfusion/agent.env`
   → `/var/lib/techfusion` → process default). `reset.rs::resolve_state_dir`.
2. Idempotent fast path: missing dir or already `UNENROLLED` → success, nothing to do,
   **no root, no confirmation**.
3. **Root check** (`reset.rs::require_root`): effective UID must be 0, else
   `reset-identity must run as root. Use: sudo techfusion-agent reset-identity`.
4. **Confirmation** (`reset.rs::confirm_reset`): prints the destructive warning and
   requires the literal input `RESET`; `--yes` skips. Non-matching input aborts with
   "No files were changed".
5. **Stop service** (`reset.rs::stop_agent_service`): `systemctl stop techfusion-agent`
   when the unit exists, then `kill_orphan_agent_processes` terminates any standalone
   `techfusion-agent` process other than our own PID (exact-name match, TERM→KILL).
6. **Narrow removal** (`reset.rs::reset_identity_files`): iterates the state dir and
   removes **only** files matching `is_identity_file` (the three names + `.tmp`
   variants). No wildcards. Nothing outside the state dir. Refuses the filesystem root.
7. **Verify**: recompute `identity_state`; any non-`UNENROLLED` residue is an error
   (no secret printed).
8. Report removed vs preserved counts; print re-enroll instructions.

Post-reset contract: service **installed but STOPPED**, Agent **UNENROLLED**.
This avoids an un-enrolled service auto-restarting and spamming 401 loops.

---

## 6. Reset vs Uninstall

| | RESET IDENTITY | UNINSTALL |
|---|---|---|
| Command | `sudo techfusion-agent reset-identity` | `sudo bash uninstall-linux.sh` / `--purge` |
| Agent binary | preserved | removed |
| systemd unit | preserved | removed |
| `/etc/techfusion/agent.env` | preserved | removed |
| device token/credential | removed | preserved (purge: removed) |
| device identity | removed | preserved (purge: removed) |
| state dir contents | only identity files removed | preserved (purge: whole dir removed) |
| server Device record | preserved → OFFLINE | never deleted |
| Result | UNENROLLED, ready to re-enroll | host no longer has the agent |

The two operations never overlap: the reset command cannot uninstall, and the
uninstaller does not perform identity resets.

---

## 7. Confirmation / Safety

- Destructive-to-identity operations require explicit confirmation: interactive
  `Type RESET to continue`, or `--yes` for dev automation (consistent with the
  installer's non-interactive contract).
- Already-unenrolled hosts short-circuit **before** any prompt/root requirement, so a
  stray invocation can never destroy anything.
- Root-gated before confirmation, so an unprivileged run never reaches the prompt.
- No destructive shell wildcards anywhere in the implementation.

---

## 8. Secret Cleanup

- `device_token` (and `device_token.tmp`) are removed with the same `fs::remove_file`
  the agent already uses for token invalidation (`registration.rs:373`).
- Post-reset verification asserts the credential file is absent and `identity_state`
  is `UNENROLLED`; the Agent cannot authenticate with old local state (the token file is
  gone; the server would 401 any residual use).
- Tokens are never printed: `identity-status` output and all reset output are
  token-free (enforced by test `test_status_output_never_contains_token`).
- No forensic SSD erase is claimed; normal filesystem deletion satisfies V1.

---

## 9. Systemd Behavior

- Handles `active` / `inactive` / `failed` uniformly: `systemctl stop` then orphan kill.
- Unit absence → service stop step skipped gracefully (`stop_agent_service` → false).
- Post-reset `systemctl is-active techfusion-agent` → **inactive** (stopped, not failed;
  unit preserved). No orphan process can keep using old credentials.
- Re-enrollment via the installer starts the service fresh.

---

## 10. Server Device Policy — LOCAL RESET ONLY

**Decision: V1-STAGE-00B performs local reset only. The old server Device is preserved
and becomes OFFLINE through existing presence monitoring.**

- `findExistingDevice` and `recoverCredential` are **org-scoped** (`devices.service.ts:182`,
  `devices.controller.ts:89`), so a local reset never mutates another org and never
  transfers a Device.
- No Device row is deleted, no `inactive` flag is toggled, no Organization membership
  changes — zero backend calls are made by the reset command.
- Device removal/revoke belongs to **V1-DEVICE-01**.

---

## 11. Re-enrollment Flow

```
1. sudo techfusion-agent reset-identity          (or --yes)
2. Dashboard → Connect Device → generate fresh token for target Org
3. sudo bash install-linux.sh --api <TF_API_URL> --enroll-token tfenr_<fresh>
```

- No `"Existing persistent identity found — reusing it"` path (identity files are gone).
- `install-linux.sh` enroll step (`install-linux.sh` `TF_ENROLL=true`) → `register-public`
  → new Device ID + Device Token persisted → service starts → telemetry resumes →
  Dashboard shows the new Device Online under the token's Organization.

---

## 12. Cross-Org Behavior (tenant safety)

Because `installation_id` is removed on reset, a fresh fingerprint v2 is generated on
re-enrollment. Server-side dedupe is org-scoped, so:

- **Org B re-enroll**: no match in Org B → new Device B. Device A (Org A) untouched.
- **No cross-org mutation**: no Device row ever changes org.
- **Same-org re-enroll** (documented, §10): also produces a **new** Device row because the
  fingerprint is fresh. The existing org-scoped reconciliation mechanism
  (`duplicate_detected` credential rotation) remains fully intact for **non-reset**
  re-installs that preserve `installation_id`. Duplicate-lifecycle cleanup is deferred
  to V1-DEVICE-01.

---

## 13. Installer Guidance

`scripts/install-linux.sh` preserves its default security behavior (existing identity →
skip enrollment; never auto-overwrites). It now additionally prints:

```
! This Agent is already enrolled. The installer never overwrites an
! existing device identity (security protection).
! To intentionally remove its local identity and return it to the
! UNENROLLED state, run:
!   sudo techfusion-agent reset-identity
! Then re-run this installer with a fresh --enroll-token.
```

No auto-reset is ever performed.

---

## 14. Automated Tests

Baseline 60/60 → **78/78 PASS** (agent `cargo test`). New coverage in
`apps/agent/src/reset.rs` (18 new tests):

| Requirement | Test |
|---|---|
| enrolled identity detected | `test_enrolled_identity_detected` |
| reset removes identity | `test_reset_removes_identity_and_keeps_other_files` |
| reset preserves non-identity config | same + `test_reset_partial_state_cleans_known_artifacts` |
| already-unenrolled reset idempotent | `test_reset_already_unenrolled_is_idempotent` |
| malformed state handled safely | `test_malformed_short_token_treated_as_unenrolled`, `test_malformed_empty_token_treated_as_missing` |
| credentials never printed | `test_status_output_never_contains_token` |
| re-enrollment persists new identity | `test_reenrollment_persists_new_identity_after_reset` |
| narrow file scope (no wildcards) | `test_identity_file_names_recognized`, `test_reset_never_touches_files_outside_state_dir` |
| root refusal | `test_reset_refuses_filesystem_root` |
| confirmation | `test_confirm_reset_with_yes_flag_skips_prompt`, `test_confirm_reset_accepts_exact_token`, `test_confirm_reset_rejects_non_matching_input` |

No root/systemd required by unit tests.

---

## 15. Regression

- Agent Rust suite: **78/78 PASS** (60 prior + 18 new).
- Agent debug and `--release` builds: **PASS**.
- Backend contracts untouched: no API file changed by this mission; `register-public`,
  `recover-credential`, token guard, metrics, inventory, network, security, presence
  monitoring are unchanged. API regression: **NOT TOUCHED**.
- Web/worker untouched.
- No lint/format config changes.

---

## 16. Files Changed

| File | Change |
|---|---|
| `apps/agent/src/config.rs` | clap subcommands `reset-identity` / `identity-status`; subcommand `--state-dir`; `state_dir_explicit`; relaxed `TF_API_URL` requirement for subcommand mode |
| `apps/agent/src/main.rs` | `mod reset;`; command routing; command name `techfusion-agent` |
| `apps/agent/src/reset.rs` | **new** — identity-state detection, narrow reset, root/confirmation/service-stop, status command, 18 unit tests |
| `apps/agent/src/registration.rs` | test helper updated for new `AgentConfig` fields |
| `scripts/install-linux.sh` | existing-identity guidance block (§13) |
| `docs/v1/V1-ENROLL-01A_LINUX_ZERO_TOUCH_ENROLLMENT_REPORT.md` | Section 31 — Agent Lifecycle Operations addendum |
| `docs/v1/V1-STAGE-00B_AGENT_IDENTITY_RESET_REENROLLMENT_REPORT.md` | this report |

Pre-existing unrelated working-tree changes (earlier missions) were not committed and
not reverted: includes `apps/agent/src/{agent,client}.rs` and the entire uncommitted
`apps/api-gateway`, `apps/web`, `apps/worker`, `apps/agent` surface listed by
`git status --short`.

---

## 17. Migrations

**NONE.** This is purely local Agent lifecycle behavior. No DB schema change was
required (org-scoped dedupe and presence already handle the offline/new-device cases).

---

## 18. Known Limitations

- Reset requires root (by design). No passwordless sudo was available on the dev host,
  so the root-gated service-stop path was validated by code review + unit tests only;
  real-device execution is the manual certification below.
- Interactive confirmation requires a TTY-less stdin to contain `RESET`; automation
  must pass `--yes`.
- No forensic secure erase; normal filesystem deletion only.
- Same-org re-enrollment creates a new Device row (documented). Duplicate-lifecycle
  cleanup is deferred (V1-DEVICE-01).
- Old Device goes OFFLINE per existing presence thresholds; thresholds were not changed.

---

## 19. Deferred to V1-DEVICE-01

- Server-side Device deletion / revoke.
- Duplicate Device cleanup after same-org re-enrollment.
- Remote (dashboard) reset/control of an Agent — explicitly out of scope for security
  reasons (§24 of the mission).
- Presence-threshold tuning.

---

## 20. Manual Certification Plan

Exact commands. **Not executed automatically** — run by an operator on a real host.

**TEST A — Identity reset**
1. `systemctl is-active techfusion-agent` → active.
2. `techfusion-agent identity-status` → record Device ID (safe).
3. `sudo techfusion-agent reset-identity`
4. type `RESET` at the prompt.
5. `systemctl is-active techfusion-agent` → inactive.
6. `ls /var/lib/techfusion` → `device_token`/`device_id`/`installation_id` absent;
   other files present.
7. `techfusion-agent identity-status` → `State: UNENROLLED`.

**TEST B — Fresh same-org enrollment**
1. Dashboard → generate new token (Org A).
2. `sudo bash install-linux.sh --api <TF_API_URL> --enroll-token tfenr_<token>`
3. Installer must **not** print "Existing persistent identity found".
4. `ls /var/lib/techfusion/device_token` present; new Device ID in
   `identity-status`.
5. `systemctl is-active techfusion-agent` → active.
6. Dashboard: new Device Online under Org A.

**TEST C — Cross-org re-enrollment**
1. `sudo techfusion-agent reset-identity --yes`
2. Generate token from **Org B**.
3. Enroll as in TEST B.
4. Dashboard: new Device appears **only** under Org B; Device A remains under Org A
   and becomes OFFLINE (existing presence monitoring).
5. Confirm Device A was **not** moved to Org B.

---

## 21. Rollback Notes

- Reset is idempotent and safe to re-run; there is nothing to roll back beyond
  re-enrolling.
- To restore a previous identity after an accidental reset: re-run the installer with a
  fresh token (new Device row). The old Device row is not affected.
- No git operation was performed; the working tree retains all unrelated in-progress
  work. See §30 of the mission.

---

## 22. Final Status

```
V1-STAGE-00B — Agent Identity Reset & Re-Enrollment

STATUS: V1-STAGE-00B COMPLETE — AGENT RESET & RE-ENROLLMENT READY
```

All code, tests (78/78), build (debug + release), installer guidance, and documentation
are in place. Real-device execution of the root-gated paths remains an operator-run
certification (TEST A/B/C above); the implementation is complete and the manual
certification is prepared and ready to run.

---

## 23. Manual-Certification Addendum — V1-STAGE-00B-R1

> **Date:** 2026-08-08 · **Priority:** P0
> **Scope:** Linux Agent release artifact + installer version consistency.
> **Companion doc:** `V1-STAGE-00B-R1_AGENT_RELEASE_ARTIFACT_CONSISTENCY_REPORT.md`.

### REAL DEVICE DISCOVERY

During manual certification the locally built release binary
(`apps/agent/target/release/agent`) contained `reset-identity` and
`identity-status` and passed the identity reset test. After a fresh enrollment via the
official TechFusion Linux installer, `/usr/local/bin/techfusion-agent` was silently
**overwritten by an older artifact** (`agent 1.0.0`) that reports
`error: unexpected argument 'identity-status' found`.

Both the old and new binaries reported `1.0.0`, so the version string alone could not
detect the mismatch.

### ROOT CAUSE

```
local source  (reset-identity + identity-status)   SHA256 1db5388e…  NOT PUBLISHED
installed     (/usr/local/bin/techfusion-agent)    SHA256 9147ae9b…  == published beta.3
published     (v1.0.0-agent-beta.3 GitHub Release) SHA256 9147ae9b…  STALE (predates the commands)
```

- The `reset-identity` / `identity-status` lifecycle commands were added to the agent
  source **after** release `v1.0.0-agent-beta.3` was published (2026-08-06).
- `apps/web/src/lib/agent-download.ts` hard-coded
  `DEFAULT_AGENT_RELEASE_BASE_URL = …/v1.0.0-agent-beta.3`; the web-served installer
  built its `--release` argument from that URL, so a fresh install downloaded the
  stale beta.3 binary and overwrote the newer local build.
- Both artifacts reported version `1.0.0`, hiding the mismatch from `--version`.

This is **not** an Agent runtime bug and it is **not** a checksum bug — the installer
verified the beta.3 checksum correctly. It is a **release/versioning staleness**
problem: the installer's only source of truth pointed at an old release, and there was
no post-install check that the artifact actually provides the certified commands.

### FIX

1. **Versioning:** `apps/agent/Cargo.toml` → `1.0.0-beta.4`. The new binary reports
   `techfusion-agent 1.0.0-beta.4` (distinct from every earlier `1.0.0` build).
2. **Single source of truth:** new `scripts/agent-release-config.sh` defines
   `AGENT_RELEASE_TAG` / `AGENT_RELEASE_VERSION` / `AGENT_RELEASE_BASE_URL` /
   `AGENT_REQUIRED_CAPABILITIES`. All release tooling and the installer regression
   test resolve through it.
3. **Web default:** `apps/web/src/lib/agent-download.ts` now points at
   `v1.0.0-agent-beta.4`; `verify-linux-bootstrap.sh` asserts it matches the
   source-of-truth tag and required capabilities (CI fails on drift).
4. **Installer capability gate:** `scripts/install-linux.sh` now verifies the
   candidate binary exposes every required capability **before** install and
   re-verifies the installed path **after** install. A stale artifact fails closed
   (exit 3): *"Installed Agent artifact is older than the required TechFusion Agent
   lifecycle build — Installation aborted."* A stale binary can never be installed or
   presented as a successful current install.
5. **Release workflow hardening:** `.github/workflows/release-agent.yml` verifies
   `--version` reports the Cargo version and `--help` exposes both lifecycle commands
   **before** packaging; the `.sha256` is always regenerated from the exact packaged
   binary.
6. **Regression test:** new `scripts/test-installer-artifact-regression.sh` simulates
   published artifact → installer → installed binary and asserts
   `reset-identity`/`identity-status` — it fails against beta.3 (the exact
   real-device regression) and passes against the beta.4 build.
7. **CI:** `linux-bootstrap-verify` job now also runs arch-resolution and the
   published-artifact regression test on main pushes.

### ARTIFACT CONSISTENCY

```
LOCAL_BUILD_SHA256  (apps/agent/target/release/agent)        1db5388e… → 41f271d1… (beta.4 build)
INSTALLED_BINARY_SHA256  (/usr/local/bin/techfusion-agent)   9147ae9b… (stale beta.3)
PUBLISHED_ARTIFACT_SHA256 (v1.0.0-agent-beta.3 GitHub)       9147ae9b… (stale beta.3)
```

**Result: PASS** for the beta.4 build — the packaged artifact (`dist/`) equals the
release build, and its sidecar checksum is regenerated from the exact binary. The
previously installed/published beta.3 artifacts are provably stale.

### INSTALLER CONSISTENCY

The web-served installer assets were re-synced (`sync-installer-assets.sh`);
`apps/web/public/install-linux.sh` now byte-identically matches
`scripts/install-linux.sh` and its `.sha256` sidecar matches
(`verify-linux-bootstrap.sh` → ALL CHECKS PASSED).

**Result: PASS**

### VERSION DISPLAY NORMALIZATION

Old binaries print `agent 1.0.0` (clap default name). The current source sets the
clap command name explicitly to `techfusion-agent` (`config.rs`), so the certified
build prints `techfusion-agent 1.0.0-beta.4`. No crate rename was performed (not
necessary); the user-facing output is now consistent.

### NEXT ACTION (operator)

Publish release tag `v1.0.0-agent-beta.4` from the current source, then re-run
`bash scripts/verify-agent-release-assets.sh` (no args) and the installer regression
test against the live release, then re-run the real-device install to confirm the
stale artifact can no longer be installed.

---

## 24. R2 Addendum — beta.4 Release Publication & Real-Device Certification

> **Date:** 2026-08-08 · **Priority:** P0
> **Canonical record:** `V1-STAGE-00B-R2_BETA4_RELEASE_REAL_DEVICE_CERTIFICATION_REPORT.md`.
> This section is the abbreviated outcome appended to the parent report.

### RESULT

The beta.4 release was fully prepared, isolated, and verified locally, but **publication
is BLOCKED by missing GitHub push authentication** in this environment.

| Item | Value |
|---|---|
| Release commit | `71c6bb1` `release(agent): prepare v1.0.0-agent-beta.4` (21 files; local, **not pushed**) |
| Release tag | `v1.0.0-agent-beta.4` (local, lightweight → `71c6bb1`; **not pushed**) |
| Agent version | `techfusion-agent 1.0.0-beta.4` |
| Agent tests | **78/78 PASS** (working tree and release commit, isolated worktree) |
| Release build | **PASS** (working tree and release commit) |
| `reset-identity` / `identity-status` | **PASS** |
| Working-tree build SHA256 | `41f271d1…ba64ea1` (= R1 expected; dist + sidecar identical) |
| Release-commit build SHA256 (local reference) | `7172c5a2…2465dc` (CI regenerates its own sidecar) |
| Verify scripts | bootstrap / arch-resolution / systemd-unit **ALL PASS**; local installer regression **PASS** |
| Web installer contract | source-level **PASS** (`DEFAULT_AGENT_RELEASE_BASE_URL` = beta.4; no beta.3 anywhere) |
| Push `main` | **BLOCKED** — `could not read Username for 'https://github.com'` |
| Push tag | **BLOCKED** — same auth failure |
| Release workflow | **NOT TRIGGERED** (tag not pushed) |
| Post-publish verification | **PENDING** (release not published; scripts fail closed by design) |
| Real-device installer test (TEST R2-A) | **PENDING HUMAN TEST** |

### EXACT BLOCKER

No GitHub push authentication is available in this environment: no `credential.helper`,
no `gh` CLI, no SSH key (`ssh -T git@github.com` → `Permission denied (publickey)`),
no token env vars; `origin` is the HTTPS URL
`https://github.com/Gamal2036/techfusion-ai.git`. Per mission rule, authentication
security settings were **not** modified to bypass it.

### OPERATOR NEXT ACTIONS

1. Authenticate git (e.g. `gh auth login`, PAT, or SSH key) using normal platform
   mechanisms.
2. `git push origin main` → pushes `71c6bb1` (+ docs commit).
3. `git push origin v1.0.0-agent-beta.4` → triggers `release-agent` (builds/verifies/
   publishes x86_64 + aarch64 + sidecars).
4. `bash scripts/verify-agent-release-assets.sh` and
   `bash scripts/test-installer-artifact-regression.sh` → must PASS against the
   published beta.4.
5. Run manual TEST R2-A (Section 11 of the R2 report) on the real device; mark
   REAL-DEVICE INSTALLER certification PASS only after it is actually run.

**STATUS: V1-STAGE-00B-R2 BLOCKED — GitHub push authentication unavailable.**

---

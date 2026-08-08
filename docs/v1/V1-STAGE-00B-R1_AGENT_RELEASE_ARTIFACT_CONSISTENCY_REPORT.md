# V1-STAGE-00B-R1 — Agent Release Artifact & Installer Consistency

> **Date:** 2026-08-08
> **Priority:** P0
> **Scope:** Linux Agent release artifact + installer version consistency only.
> **Parent:** `V1-STAGE-00B_AGENT_IDENTITY_RESET_REENROLLMENT_REPORT.md` (Section 23 addendum).

---

## 1. Executive Summary

A real-device certification of `reset-identity` / `identity-status` passed against
the locally built release binary, but a subsequent normal install via the official
Linux installer silently replaced `/usr/local/bin/techfusion-agent` with an **older
published artifact** that does not contain those commands. Both binaries reported
`1.0.0`, so the version string could not detect the mismatch.

This report documents the root cause, the exact evidence, and the consistency
restoration: versioned prerelease build `1.0.0-beta.4`, a single release source of
truth, an installer capability gate (fail closed), release-workflow capability/version
verification, a real-installer regression test, and re-synced web installer assets.

---

## 2. Real-Device Discovery (evidence)

| Item | Value |
|---|---|
| Local source build | `apps/agent/target/release/agent` |
| Local build `--version` | `techfusion-agent 1.0.0` → now `techfusion-agent 1.0.0-beta.4` |
| Local build `--help` | contains `reset-identity`, `identity-status` |
| Installed binary | `/usr/local/bin/techfusion-agent` |
| Installed `--version` | `agent 1.0.0` (stale) |
| Installed `identity-status` | `error: unexpected argument 'identity-status' found` |
| Published release used by installer | `v1.0.0-agent-beta.3` GitHub Release |

---

## 3. Root Cause

```
apps/agent source ──(+ reset-identity/identity-status, uncommitted)──► 1db5388e… (new)
                                 │
                                 │ NOT PUBLISHED at the time of the regression
                                 ▼
apps/web/src/lib/agent-download.ts
  DEFAULT_AGENT_RELEASE_BASE_URL = …/releases/download/v1.0.0-agent-beta.3
                                 │
                                 ▼ web-served install-linux.sh --release <beta.3 URL>
installer downloads v1.0.0-agent-beta.3/techfusion-agent-linux-x86_64
  9147ae9b…  (same bytes as the installed stale binary)
                                 │
                                 ▼
/usr/local/bin/techfusion-agent  OVERWRITTEN by stale beta.3
```

- The lifecycle commands were added to source **after** `v1.0.0-agent-beta.3`
  (published 2026-08-06) and never released.
- The installer's release URL was pinned to beta.3, so it downloaded the stale
  artifact (checksum **correctly** verified — the stale binary matched its sidecar).
- Both builds reported `1.0.0`; there was no version/capability signal to catch it.

**This is a release/versioning staleness problem, not an Agent runtime or checksum bug.**

---

## 4. Artifact Consistency — proven

| Artifact | SHA256 (was) | SHA256 (certified build) |
|---|---|---|
| Local source build `apps/agent/target/release/agent` | `1db5388e0369dca2226fa0c2456331d300bd70d883d0895386872908e726aee4` | `41f271d13ebba3acb2b5569c7b5e45a0a3c39be497218df26412db09bab64ea1` |
| Installed `/usr/local/bin/techfusion-agent` | `9147ae9b7cabfcbb5e3000e7a51bfb2d7edaa1b88fb9597a141548d165e52f3e` (stale) | — (not overwritten; gate now prevents it) |
| Published `v1.0.0-agent-beta.3` x86_64 | `9147ae9b7cabfcbb5e3000e7a51bfb2d7edaa1b88fb9597a141548d165e52f3e` (stale) | — |
| Packaged artifact `dist/techfusion-agent-linux-x86_64` | — | `41f271d13ebba3acb2b5569c7b5e45a0a3c39be497218df26412db09bab64ea1` |
| Packaged sidecar `dist/…x86_64.sha256` | — | `41f271d13ebba3acb2b5569c7b5e45a0a3c39be497218df26412db09bab64ea1` |

`dist/techfusion-agent-linux-x86_64` == `apps/agent/target/release/agent`
(byte-identical SHA256), and the sidecar is regenerated from the exact packaged
binary (never reused from an older build).

`file`/`size`: certified build is an x86-64 ELF PIE, 8 074 328 bytes. The stale
beta.3 artifact is 8 301 120 bytes.

---

## 5. Versioning

| Item | Before | After |
|---|---|---|
| `apps/agent/Cargo.toml` version | `1.0.0` | `1.0.0-beta.4` |
| `apps/agent/Cargo.lock` version | `1.0.0` | `1.0.0-beta.4` |
| `--version` output | `agent 1.0.0` (old) / `techfusion-agent 1.0.0` (new) | `techfusion-agent 1.0.0-beta.4` |
| Release tag (recommended) | `v1.0.0-agent-beta.3` | `v1.0.0-agent-beta.4` |

`1.0.0-beta.4` follows the repository's existing beta prerelease convention
(`v1.0.0-agent-beta.N` tags) and makes this lifecycle build distinguishable from every
prior `1.0.0` artifact. No crate rename was performed — the clap command name is set
explicitly to `techfusion-agent` in `config.rs`, normalizing user-facing output.

---

## 6. Single Source of Truth

| Layer | Mechanism |
|---|---|
| Canonical definition | `scripts/agent-release-config.sh` — `AGENT_RELEASE_TAG`, `AGENT_RELEASE_VERSION`, `AGENT_RELEASE_BASE_URL`, `AGENT_REQUIRED_CAPABILITIES`, `AGENT_RELEASE_ARCHS` |
| Installer | `scripts/install-linux.sh` — **no** default URL; requires `--release`/`--url`/`--binary` (already fail-closed, unchanged) |
| Web dashboard default | `apps/web/src/lib/agent-download.ts` → `DEFAULT_AGENT_RELEASE_BASE_URL` = beta.4 base; `AGENT_REQUIRED_CAPABILITIES` mirrors the source of truth |
| CI drift guard | `verify-linux-bootstrap.sh` greps the web default + capability list against `agent-release-config.sh` (fails on drift) |
| Verification tools | `verify-agent-release-assets.sh`, `test-installer-artifact-regression.sh` default to the source-of-truth base URL |

No stale fallback exists in the installer (it has no baked-in URL), and the
`verify-agent-release-assets.sh` default was updated from the stale beta.2 URL to the
source of truth.

---

## 7. Installer Post-Install Capability Gate

`scripts/install-linux.sh` (v1.3.0) now:

1. Verifies the candidate binary exposes every required capability
   (`reset-identity`, `identity-status`; overridable via
   `TF_REQUIRED_AGENT_CAPABILITIES`) **before** installing — a stale artifact can
   never overwrite a working binary.
2. Installs to `/usr/local/bin/techfusion-agent`.
3. Re-verifies the installed path against `--help` **after** install.
4. On any missing capability → `die 3`:

```
Installed Agent artifact is older than the required TechFusion Agent
lifecycle build — it is missing the '<cap>' command.
…
Installation aborted; no stale artifact was installed and no service was started.
```

A stale binary can never be presented as a successful current install. Existing
behavior is preserved: checksum verification, enrollment-token single-use,
DeviceTokenGuard/org binding, existing-identity skip, and all systemd security
settings are untouched (verified by `verify-linux-bootstrap.sh`).

---

## 8. Release Workflow Hardening

`.github/workflows/release-agent.yml` now, for the native x86_64 build, verifies
**before packaging/publishing** that:

- `--version` reports `techfusion-agent <Cargo.toml version>`
- `--help` exposes `reset-identity` and `identity-status`

The `.sha256` sidecar is always regenerated from the exact packaged binary in the same
step, so "artifact changed but checksum did not" is structurally impossible; the new
gate additionally stops a stale/incorrect **build** from being published.

---

## 9. Real-Installer Regression Test

New `scripts/test-installer-artifact-regression.sh`. It simulates
`published artifact → installer → installed binary`:

- default source = certified release base (source of truth), also supports
  `--release <base>` / `--url <url>` / `--binary <path>`
- downloads the per-arch artifact + sibling `.sha256` (sha256 mandatory, fail closed)
- asserts the artifact executes, reports `techfusion-agent 1.0.0-beta.4`, and
  `--help` contains `reset-identity` + `identity-status`
- executes the installer's **own** post-install capability gate verbatim against the
  artifact

Results observed on this host:

| Target | Result |
|---|---|
| Fresh beta.4 build (`--binary`) | **PASS** |
| Simulated published beta.4 (local HTTP) | **PASS** (download → sidecar → sha256 → version → capabilities → gate) |
| Stale beta.3 installed binary (`--binary`) | **FAIL** — catches exactly the real-device regression |
| Stale beta.3 (local HTTP) | **FAIL** — fails closed |

CI: the `linux-bootstrap-verify` job runs it on main pushes; `verify-agent-release-assets.sh`
against the certified URL fails 404 until the release is published (fail-closed, by design).

---

## 10. Automated Verification Results

| Check | Result |
|---|---|
| `cargo test` (apps/agent) | **78/78 PASS** |
| `cargo build --release` (apps/agent) | **PASS** (`techfusion-agent 1.0.0-beta.4`) |
| `cargo check` | PASS (16 pre-existing warnings, none new) |
| `cargo fmt --check` | pre-existing diff only in `src/agent.rs` (earlier uncommitted work; untouched by R1) |
| `scripts/verify-linux-bootstrap.sh` | **ALL CHECKS PASSED** |
| `scripts/verify-installer-arch-resolution.sh` | **ALL CHECKS PASSED** |
| `scripts/verify-agent-systemd-unit.sh` | **ALL CHECKS PASSED** |
| `scripts/sync-installer-assets.sh` | re-synced web copy + checksum |
| `scripts/test-installer-artifact-regression.sh --binary` (beta.4) | PASS |
| `scripts/test-installer-artifact-regression.sh --binary` (beta.3) | FAIL (regression caught — expected) |
| `scripts/verify-agent-release-assets.sh` (beta.4 URL) | FAIL 404 — release not yet published (expected; re-run after publish) |
| `scripts/verify-agent-release-assets.sh` (beta.3 URL) | FAIL — stale artifact detected (expected) |
| Web test `onboarding-flow.spec.tsx` | **8/8 PASS** (default URL now asserted against `DEFAULT_AGENT_RELEASE_BASE_URL`) |

---

## 11. Release Action Required (operator)

| Item | Value |
|---|---|
| Recommended tag | `v1.0.0-agent-beta.4` |
| Cargo version | `1.0.0-beta.4` |
| Artifact name | `techfusion-agent-linux-x86_64` (and `…-linux-aarch64`) |
| Artifact SHA256 (x86_64) | `41f271d13ebba3acb2b5569c7b5e45a0a3c39be497218df26412db09bab64ea1` |
| Publish step | `git tag v1.0.0-agent-beta.4` → push → `release-agent` workflow builds/verifies/publishes both arches |
| After publish | `bash scripts/verify-agent-release-assets.sh` (no args) → **must pass**; re-run installer regression test with no args; re-run real-device install |

No GitHub Release was pushed or published by this mission; the local `dist/` artifact
and checksum are prepared for the release workflow.

---

## 12. Git Safety

Per mission constraints, no `git add` / `commit` / `push` / `reset` / `clean` was run.
The working tree retains all prior unrelated in-progress work.

---

## 13. Final Status

```
V1-STAGE-00B-R1 — Agent Release Artifact & Installer Consistency

ROOT CAUSE: installer/ web dashboard pointed at v1.0.0-agent-beta.3 (published
before reset-identity/identity-status existed); both artifacts reported 1.0.0.

STATUS: V1-STAGE-00B-R1 COMPLETE — INSTALLER ARTIFACT CONSISTENCY RESTORED
(awaits operator tag v1.0.0-agent-beta.4 + post-publish re-certification)
```

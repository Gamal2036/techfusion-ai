# V1-AGENT-REL-02 — Linux Agent GitHub Release Artifact Report

| Field | Value |
|---|---|
| Mission ID | `V1-AGENT-REL-02` |
| Session | `V1-AGENT-REL-02-R1` (resume of an interrupted session) |
| Title | Linux Agent Build & GitHub Release Artifact |
| Parent | `V1-ENROLL-01A` (Linux Zero-Touch Enrollment — installer consumes release binaries) |
| Scope | BUILD · PACKAGE · CHECKSUM · RELEASE WORKFLOW · RELEASE URL |
| Deliverable | This report + `dist/` staging artifacts + validated `release-agent.yml` |

---

## 1. Executive Summary

The repository is **ready** for the user to publish a new tag so GitHub Actions
builds and publishes the Linux agent release artifacts. Confirmed root cause of
the earlier failure: `.github/workflows/release-agent.yml` was **untracked**
(never committed), and tag `v1.0.0-agent-beta.1` **does not contain it** — so
GitHub Actions could never run the release workflow for that tag.

Fix strategy (no tag rewriting): commit the workflow → push `main` → create
**`v1.0.0-agent-beta.2`** → push the tag → GitHub Actions publishes
`techfusion-agent-linux-x86_64` and `techfusion-agent-linux-x86_64.sha256` as
GitHub Release assets.

All local validation passed for Linux x86_64. aarch64 is implemented in the
workflow but its **local** validation is deferred (host disk exhausted); it will
build in CI via `cross`.

## 2. Recovery State

Recovered from the previous session's working tree without discarding work.
No `git reset --hard`, `git clean`, `git checkout .`, `git restore .`, or
force-push was used. Nothing was committed, pushed, or tagged.

Interruption point recovered: the previous execution was mid-way through an
aarch64 `cross` build when disk space was exhausted. The x86_64 path had already
fully completed and all artifacts/checksums remained valid.

## 3. Previous Session Work Recovered

- Confirmed `.github/workflows/release-agent.yml` exists on disk but is
  **untracked**.
- Confirmed tag `v1.0.0-agent-beta.1` **does not contain** the workflow
  (`git show v1.0.0-agent-beta.1:.github/workflows/release-agent.yml` → fatal,
  path absent).
- Verified the workflow content is code-complete and matches the real build
  contract (see Sections 7–12).
- Verified installer assets (`scripts/install-linux.sh` ↔
  `apps/web/public/install-linux.sh` + `.sha256`) are in sync and all verifier
  checks pass.
- No pre-existing `V1-AGENT-REL-02` report existed; this is the single report.

## 4. Existing beta.1 State

- Git tag `v1.0.0-agent-beta.1` exists (only tag in the repo).
- Tag points at commit `6c441ea` ("feat: establish TechFusion V1 foundation and
  command center").
- **No GitHub Release object exists for the tag** (GitHub API returns 404).
- The tag does **not** contain `.github/workflows/release-agent.yml`.

## 5. Confirmed Root Cause

`release-agent.yml` is untracked and absent at `v1.0.0-agent-beta.1`. GitHub
Actions resolves the workflow for a pushed tag from the repository state
**associated with that tag**. Because the workflow file was never committed, the
beta.1 tag could never execute the release workflow, and no release artifacts
were ever published. This is a confirmed root cause.

## 6. release-agent.yml State

- **Status:** code-complete, syntactically valid YAML (parsed), no actionlint
  available locally.
- **Tracking:** UNTRACKED.
- Contains: `v*` tag trigger, `permissions: contents: write`, checkout,
  `dtolnay/rust-toolchain@stable`, native x86_64 build, aarch64 cross build,
  artifact packaging + SHA256, artifact upload, `softprops/action-gh-release@v2`
  release upload of all four release assets.

## 7. Agent Build Contract

Source of truth: `apps/agent/Cargo.toml`.

- Package name: `agent`
- Binary name: `agent` (`[[bin]] name = "agent"`, path `src/main.rs`)
- Edition: 2021; version `1.0.0`
- Not part of a Cargo workspace (no root `Cargo.toml`); crate builds standalone.
- Real build command: `cargo build --release --target x86_64-unknown-linux-gnu`
  run from `apps/agent`.

## 8. Binary Output

- CI output path: `apps/agent/target/x86_64-unknown-linux-gnu/release/agent`
- Local verified build: `apps/agent/target/x86_64-unknown-linux-gnu/release/agent`
  — `ELF 64-bit LSB pie executable, x86-64`, `agent 1.0.0` on `--version`.
- Staged release artifact: `dist/techfusion-agent-linux-x86_64` (8,013,584 bytes).

## 9. Artifact Naming Contract

- `techfusion-agent-linux-x86_64`
- `techfusion-agent-linux-x86_64.sha256`
- (aarch64, CI only): `techfusion-agent-linux-aarch64` + `.sha256`
- Both matrix artifacts are uploaded to the GitHub Release via
  `softprops/action-gh-release@v2` `files:` (Section 12).

## 10. SHA256 Contract

- Workflow generates bare-hex checksum:
  `sha256sum dist/<name> | awk '{print $1}' > dist/<name>.sha256`
- Local value: `8629391e04922ca6e0d8b8d1b25472129d985d3168b76274083c79d2ef9802db`
- Verified with installer semantics (`sha256sum | awk '{print $1}'` comparison):
  **PASS**.

## 11. Installer Compatibility

`scripts/install-linux.sh`:

- Downloads the binary from `--url` / `TECHFUSION_AGENT_DOWNLOAD_URL`.
- Fetches the sibling checksum at `${BINARY_URL}.sha256` and parses with
  `awk '{print $1}'`, which accepts both bare-hex and `sha256sum -c` formats.
  The workflow's bare-hex sidecar is therefore **compatible** — no installer
  change required.
- `bash scripts/verify-linux-bootstrap.sh` → **ALL CHECKS PASSED** (installer
  syntax, strict mode, root gate, no eval, scheme validation, systemd unit,
  enrollment hygiene, web asset sync + checksum sidecar).

## 12. GitHub Release Workflow

`.github/workflows/release-agent.yml` (85 lines):

- `on.push.tags: 'v*'` — triggers only on tag pushes.
- `permissions: contents: write` — required for release asset upload.
- `build-linux` matrix: `x86_64-unknown-linux-gnu` (native) and
  `aarch64-unknown-linux-gnu` (`taiki-e/install-action@cross` → `cross build`).
- `Package artifact + checksum` step copies the built binary to
  `dist/techfusion-agent-linux-<abi>` and writes the `.sha256` sibling.
- `actions/upload-artifact@v4` stores per-target `dist/*`.
- `publish` job: `actions/download-artifact@v4` with `merge-multiple: true`, then
  `softprops/action-gh-release@v2` uploads all four files to the tag-triggered
  release and generates release notes.
- Verified against the real build contract: working directory `apps/agent`,
  output `apps/agent/target/<triple>/release/agent`, canonical rename, SHA256,
  upload. No local machine paths, no hardcoded secrets.

## 13. x86_64 Validation

| Check | Result |
|---|---|
| `cargo fmt --check` | PASS |
| `cargo check --all-targets` | PASS (16 pre-existing non-fatal warnings) |
| `cargo test` | PASS — 60 passed, 0 failed |
| `cargo build --release --target x86_64-unknown-linux-gnu` | PASS |
| Binary exists + executes | PASS (`agent 1.0.0`) |
| `bash scripts/verify-linux-bootstrap.sh` | PASS (all checks) |

## 14. aarch64 Status

- **AARCH64: DEFERRED** (local validation only).
- The workflow already implements the aarch64 leg via `cross build` (a
  maintained, standard approach) and will build in GitHub Actions where runners
  have ample disk and Docker.
- Local `cross` validation could not complete: the host root filesystem is at
  100% usage (`/` full, ~95 MB free), so the cross toolchain install and the
  ~500 MB cross Docker image cannot fit. This is an environment limitation, not
  a code deficiency, and does **not** block the x86_64 beta release.

## 15. Local Tests

- `cargo fmt --check` → clean
- `cargo check --all-targets` → ok (warnings only)
- `cargo test` → 60/60 pass
- `cargo build --release --target x86_64-unknown-linux-gnu` → ok
- `bash scripts/verify-linux-bootstrap.sh` → all checks passed
- `dist/techfusion-agent-linux-x86_64.sha256` re-verified against binary → PASS
- Note: the interrupted aarch64 attempt upgraded the local `stable` toolchain
  (now rustc 1.97.1 / cargo 1.97.1); the already-built x86_64 artifact is
  unaffected (standalone ELF).

## 16. Git Tag Strategy

- **Recommended next tag: `v1.0.0-agent-beta.2`** (created by the USER).
- Do **not** move, delete, rewrite, or force-push `v1.0.0-agent-beta.1`.
- Tag `v1.0.0-agent-beta.2` must be pushed **after** the workflow is committed
  to `main` so the tag's tree contains the workflow.

## 17. Expected Release Assets

```
techfusion-agent-linux-x86_64
techfusion-agent-linux-x86_64.sha256
techfusion-agent-linux-aarch64
techfusion-agent-linux-aarch64.sha256
Source code (zip)
Source code (tar.gz)
```

## 18. Expected Release URLs

Owner/repo derived from `git remote -v`:
`origin https://github.com/Gamal2036/techfusion-ai.git` →
owner `Gamal2036`, repo `techfusion-ai`.

For tag `v1.0.0-agent-beta.2`:

- Binary:
  `https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.2/techfusion-agent-linux-x86_64`
- Checksum:
  `https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.2/techfusion-agent-linux-x86_64.sha256`

## 19. NEXT_PUBLIC_AGENT_DOWNLOAD_URL

Public (non-secret) web configuration. Value to set once beta.2 is published:

```
NEXT_PUBLIC_AGENT_DOWNLOAD_URL=https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.2/techfusion-agent-linux-x86_64
```

It must point directly at the `techfusion-agent-linux-x86_64` release asset (not
the tag page, not the release HTML page, not source archives). When set, both
`OnboardingFlow.tsx` and the enrollment page append `--url "<url>"` to the Linux
install command; the installer then resolves the `.sha256` sibling automatically.
Not modified during this mission (deployment-time configuration).

## 20. Files Changed By This Mission

- `.github/workflows/release-agent.yml` — created (untracked), code-complete.
- `docs/v1/V1-AGENT-REL-02_LINUX_AGENT_GITHUB_RELEASE_REPORT.md` — created now.
- `dist/` — staging artifacts (gitignored, NOT for commit):
  `techfusion-agent-linux-x86_64`, `techfusion-agent-linux-x86_64.sha256`.

## 21. Pre-existing Unrelated Changes

Present before this mission; do **not** commit with this mission unless desired:

- Modified: `.github/workflows/ci.yml` (agent-rust + linux-bootstrap-verify jobs)
- Modified: `apps/agent/src/{agent,client,collector,config,identity,inventory,main,network_discovery,registration}.rs` (V1-ENROLL-01A state-dir / one-shot enrollment work)
- Modified: `apps/web/src/app/dashboard/settings/enrollment/page.tsx`,
  `apps/web/src/components/command-center/OnboardingFlow.tsx` (Linux install command UI)
- Deleted: `apps/api-gateway/prisma/migrations/20260617000200_rls_extended/migration.sql`
- Untracked: `apps/api-gateway/.env.test`, `apps/web/public/`,
  `apps/web/src/__tests__/onboarding-flow.spec.tsx`,
  `docs/dashboard/DASH-QA-01A_COMMAND_CENTER_BROWSER_CERTIFICATION_REPORT.md`,
  `docs/enrollment/`, `docs/v1/V1-CORE-00_*`, `docs/v1/V1-ENROLL-01A_*`,
  `scripts/{install-linux,uninstall-linux,sync-installer-assets,verify-linux-bootstrap}.sh`,
  and a stray `"tablish TechFusion V1 foundation and command center\"` file.

## 22. Required User Commands

```
git status

git add .github/workflows/release-agent.yml
# optional: git add docs/v1/V1-AGENT-REL-02_LINUX_AGENT_GITHUB_RELEASE_REPORT.md

git commit -m "ci(agent): publish Linux agent release artifacts"

git push origin main

git tag v1.0.0-agent-beta.2

git push origin v1.0.0-agent-beta.2
```

Do **not** run `git add .` (working tree contains unrelated changes).

## 23. Next Manual Verification

After pushing `v1.0.0-agent-beta.2`, open GitHub Actions
(`https://github.com/Gamal2036/techfusion-ai/actions`) and confirm the
`release-agent` workflow completes, then check the release at
`https://github.com/Gamal2036/techfusion-ai/releases/tag/v1.0.0-agent-beta.2`
contains `techfusion-agent-linux-x86_64` and
`techfusion-agent-linux-x86_64.sha256` under Assets.

## 24. Final Status

**V1-AGENT-REL-02 COMPLETE — READY FOR USER TAG**

Repository is ready: pushing `v1.0.0-agent-beta.2` after committing the workflow
causes GitHub Actions to publish the Linux agent binary and checksum as
downloadable GitHub Release assets. aarch64 is implemented (CI) with local
validation deferred due to host disk exhaustion.

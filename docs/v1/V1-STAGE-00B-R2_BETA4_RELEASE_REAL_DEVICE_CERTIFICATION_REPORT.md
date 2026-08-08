# V1-STAGE-00B-R2 — beta.4 Release Publication & Real-Device Certification

> **Date:** 2026-08-08
> **Priority:** P0
> **Mode:** Git Safety → Publish → Verify → Prepare Real-Device Test
> **Scope:** Publish the prepared TechFusion Linux Agent `v1.0.0-agent-beta.4` and
> certify the official installer installs the same current Agent build (with
> `reset-identity` + `identity-status`). No Agent redesign, no enrollment redesign.
> **Parent:** `V1-STAGE-00B_AGENT_IDENTITY_RESET_REENROLLMENT_REPORT.md` (R2 addendum,
> appended below as Section 24).
> **Companion:** `V1-STAGE-00B-R1_AGENT_RELEASE_ARTIFACT_CONSISTENCY_REPORT.md`.

---

## 1. Executive Summary

R1 established the root cause (installer/web dashboard pinned to stale
`v1.0.0-agent-beta.3`) and prepared the `1.0.0-beta.4` release source of truth,
installer capability gate, workflow verification, and regression tooling. R2 was
tasked with **publishing** that release and certifying the installer path.

**Outcome:** the beta.4 release **was fully prepared, isolated, and verified
locally** (release commit `71c6bb1`, local tag `v1.0.0-agent-beta.4`, 78/78 tests,
release build PASS, capability/version gates PASS, all verification scripts PASS),
**but the publication could not be pushed** because this environment has **no
GitHub push authentication** (no credential helper, no `gh` CLI, no SSH key, no
token; the `origin` remote is HTTPS). Per mission rules, authentication security
settings were **not** altered to bypass it.

**Final status: `V1-STAGE-00B-R2 BLOCKED — push authentication unavailable`.**
The operator must push `main` (release commit `71c6bb1`) and the local tag
`v1.0.0-agent-beta.4`, then the `release-agent` workflow publishes the artifacts.

---

## 2. Pre-Release Git Safety

Executed before any mutation (results at the time):

| Check | Result |
|---|---|
| `git status --short` | large pre-existing dirty tree: `apps/api-gateway`, `apps/web`, `apps/worker`, `apps/agent/src/{agent,client}.rs`, migrations, docs, etc. (unrelated in-progress work) |
| `git branch --show-current` | `main` |
| `git log -1 --oneline` | `8fe109f fix(ci): stabilize V1 CI gate` |
| `git diff --stat` | 107 files, ~2912 insertions / ~1334 deletions (unrelated work) |
| `git diff --cached --stat` | empty (nothing staged) |

**Safety rules honored:** no `git add .`, no `git commit -a`, no `reset --hard`,
no `clean -fd`, no force push, no history rewrite, unrelated dirty files left
untouched and uncommitted.

### Release-scope determination

The beta.4 release files were identified precisely from the R1/identity-reset
deliverables (their "Files Changed" tables). `apps/agent/src/{agent,client}.rs`
(device-token bearer-auth on security/discovery calls) were confirmed **unrelated
pre-existing work** — explicitly documented as such in the R1 report §16 — and were
**excluded** from the release commit.

**Separation proof:** an isolated worktree at the release commit builds clean and
passes 78/78 tests **without** `agent.rs`/`client.rs`, so they are *not* required
indirectly and the release commit is safely isolated (mission rule: otherwise
BLOCKED).

---

## 3. Release Content Verification (current source, pre-commit)

| Check | Result |
|---|---|
| `cargo test` (apps/agent) | **78/78 PASS** |
| `cargo build --release` | **PASS** |
| `./target/release/agent --version` | `techfusion-agent 1.0.0-beta.4` |
| `--help` → `reset-identity` | present |
| `--help` → `identity-status` | present |
| `sha256sum target/release/agent` | `41f271d13ebba3acb2b5569c7b5e45a0a3c39be497218df26412db09bab64ea1` |
| `dist/techfusion-agent-linux-x86_64` | identical SHA256 (byte-consistent) |
| sidecar `dist/…x86_64.sha256` | identical SHA256 (regenerated from exact packaged binary) |

All current x86_64 hashes byte-consistent: **PASS**. (Matches the R1-expected hash —
R1's certified build was the full working tree.)

---

## 4. Release Configuration Audit

| Item | Expected | Actual | Result |
|---|---|---|---|
| `scripts/agent-release-config.sh` | `v1.0.0-agent-beta.4` / `1.0.0-beta.4` | `AGENT_RELEASE_TAG="v1.0.0-agent-beta.4"`, `AGENT_RELEASE_VERSION="1.0.0-beta.4"` | PASS |
| `apps/web/src/lib/agent-download.ts` | beta.4 default | `DEFAULT_AGENT_RELEASE_BASE_URL = …/download/v1.0.0-agent-beta.4`; `AGENT_REQUIRED_CAPABILITIES = [reset-identity, identity-status]` | PASS |
| `scripts/install-linux.sh` | capability gate | v1.3.0; pre+post-install `verify_agent_capabilities`, fail-closed `die 3` | PASS |
| `.github/workflows/release-agent.yml` | verify-before-publish | `--version` vs Cargo version + both commands, pre-packaging; `.sha256` regenerated from exact packaged binary | PASS |
| Stale beta.3 in distribution flow | none | **no** `beta.3` reference in `.github/`, `scripts/`, `apps/web/src/`, `apps/web/public/`, `apps/agent/src/` | PASS |

### Verification scripts

| Script | Result |
|---|---|
| `bash scripts/verify-linux-bootstrap.sh` | **ALL CHECKS PASSED** |
| `bash scripts/verify-installer-arch-resolution.sh` | **ALL CHECKS PASSED** |
| `bash scripts/verify-agent-systemd-unit.sh` | **ALL CHECKS PASSED** |
| `bash scripts/test-installer-artifact-regression.sh --binary apps/agent/target/release/agent` | **PASSED** (version + both capabilities + installer gate verbatim) |

---

## 5. Release Commit

Staged **explicitly** (21 files — never `git add .`):

```
.github/workflows/release-agent.yml
.github/workflows/ci.yml
apps/agent/Cargo.lock
apps/agent/Cargo.toml
apps/agent/src/config.rs
apps/agent/src/main.rs
apps/agent/src/registration.rs
apps/agent/src/reset.rs
apps/web/public/install-linux.sh
apps/web/public/install-linux.sh.sha256
apps/web/src/__tests__/onboarding-flow.spec.tsx
apps/web/src/lib/agent-download.ts
docs/v1/V1-ENROLL-01A_LINUX_ZERO_TOUCH_ENROLLMENT_REPORT.md
docs/v1/V1-STAGE-00B-R1_AGENT_RELEASE_ARTIFACT_CONSISTENCY_REPORT.md
docs/v1/V1-STAGE-00B_AGENT_IDENTITY_RESET_REENROLLMENT_REPORT.md
scripts/agent-release-config.sh
scripts/install-linux.sh
scripts/test-installer-artifact-regression.sh
scripts/verify-agent-release-assets.sh
scripts/verify-installer-arch-resolution.sh
scripts/verify-linux-bootstrap.sh
```

Staged diff contains (mission checklist): agent identity reset feature ✔, version
bump to `1.0.0-beta.4` ✔, installer capability gate ✔, release config/source of
truth ✔, release workflow verification ✔, installer/web asset sync ✔, required
tests/docs ✔. **No unrelated product-development changes** (no `api-gateway` /
`web` / `worker` / `agent.rs` / `client.rs`). **No secrets** (secret-pattern scan of
all staged files: none; `apps/api-gateway/.env.test` and all `.env` files excluded).

> **Note:** the committed `agent.rs`/`client.rs` remain at the `8fe109f` baseline;
> the working-tree auth changes stay uncommitted (documented unrelated work).

**Commit:** `71c6bb1da1209c775c812eae4613956c07ecec8a release(agent): prepare v1.0.0-agent-beta.4`

A follow-up pre-push QA pass found `cargo fmt --check` violations in the beta.4
feature files (`main.rs`, `reset.rs`). These were rustfmt-formatted (cosmetic only)
and the commit amended before push. **Amended commit verified in an isolated
worktree:** `cargo fmt --check` PASS, `cargo test` **78/78 PASS**, `cargo build
--release` PASS, `--version` → `techfusion-agent 1.0.0-beta.4`, both capabilities
present, isolated-build hash `7172c5a22a0a3d31be38326eeca63331ddb90fb725bc2ce5861300afbe6245dc`.

---

## 6. Push — BLOCKED (authentication)

```
$ git push origin main
fatal: could not read Username for 'https://github.com': No such device or address
```

`origin` = `https://github.com/Gamal2036/techfusion-ai.git` (HTTPS, matches
`AGENT_RELEASE_OWNER/REPO`). Environment probe found **no** auth path:
- no `credential.helper`, no URL `insteadOf` rewrites (repo or global)
- no `gh` CLI
- no SSH key (`ssh -T git@github.com` → `Permission denied (publickey)`)
- no `GITHUB_TOKEN` / `GH_TOKEN` / git token env vars

Per mission rule ("Do not alter authentication security settings to bypass it"),
**no bypass was attempted**.

Read-only confirmation of remote state (`git ls-remote` + GitHub API):
`origin/main` = `8fe109f`; remote tags `v1.0.0-agent-beta.{1,2,3}` exist;
**`v1.0.0-agent-beta.4` does not exist on the remote** (no tag, no release).

---

## 7. Release Tag

| Item | Value |
|---|---|
| Tag | `v1.0.0-agent-beta.4` (local, lightweight) |
| Tag → commit | `71c6bb1da1209c775c812eae4613956c07ecec8a` |
| Pre-existing? | No (did not exist before) |
| `git show --no-patch --oneline v1.0.0-agent-beta.4` | `71c6bb1 release(agent): prepare v1.0.0-agent-beta.4` |
| Tag push | **BLOCKED** — same auth failure as §6 |

No force, no rewrite. The tag is ready for the operator to push.

---

## 8. Release Workflow Status

**NOT TRIGGERED.** The `release-agent` workflow triggers on pushed `v*` tags
(`on: push.tags: ['v*']`). The tag was not pushed (§7), so no workflow run was
started. Local tooling cannot observe any run because none exists.

---

## 9. Post-Publish Verification

**NOT RUN / PENDING.** `bash scripts/verify-agent-release-assets.sh` (default
source = `AGENT_RELEASE_BASE_URL`) and
`bash scripts/test-installer-artifact-regression.sh` (default published source)
both **fail closed** against the unpublished beta.4 URL (404) by design. They are
prepared and ready to run immediately after publication:

```
bash scripts/verify-agent-release-assets.sh        # after publish → must PASS
bash scripts/test-installer-artifact-regression.sh # after publish → must PASS
```

Post-publish checks to confirm: published binary `--version` →
`techfusion-agent 1.0.0-beta.4`; `--help` → `reset-identity` + `identity-status`;
published `.sha256` sidecar exactly matches the downloaded binary (the workflow
regenerates the sidecar from the exact packaged binary, so this is structurally
guaranteed).

---

## 10. Web Installer Contract

**Source-level verification: PASS.**

- Dashboard flow: `apps/web/src/components/command-center/OnboardingFlow.tsx:130`
  and `apps/web/src/app/dashboard/settings/enrollment/page.tsx:171` resolve the
  installer release via `resolveAgentReleaseBaseUrl()` →
  `DEFAULT_AGENT_RELEASE_BASE_URL` =
  `…/releases/download/v1.0.0-agent-beta.4`.
- The dashboard-generated installer command asserts `--release`
  `…/v1.0.0-agent-beta.4` (web test `onboarding-flow.spec.tsx`).
- No `beta.3` reference anywhere in the current distribution flow (grep: `.github/`,
  `scripts/`, `apps/web/src/`, `apps/web/public/`, `apps/agent/src/`).

**Runtime verification: PENDING** (requires the published release, §9).

---

## 11. Real-Device Certification — Manual Instructions (NOT executed)

> Do **not** execute automatically. The current real device may still have stale
> beta.3 installed. `reset-identity` is **not** to be run as part of R2 unless the
> operator explicitly chooses to repeat the destructive reset test (it already
> passed in the earlier real-device RESET certification).

**TEST R2-A — normal installer must no longer downgrade the Agent:**

1. `systemctl is-active techfusion-agent` → note current state (may be active with
   stale beta.3).
2. Use the normal TechFusion Dashboard enrollment/install path with the official
   **beta.4** release (Dashboard → Linux enrollment → generated install command;
   the installer now carries the capability gate and refuses a stale artifact).
3. After installation:
   ```
   techfusion-agent --version     # expected: techfusion-agent 1.0.0-beta.4
   techfusion-agent --help        # expected: reset-identity, identity-status present
   techfusion-agent identity-status   # expected: State: ENROLLED
   ```
4. `systemctl is-active techfusion-agent` → **active**.
5. Confirm the device remains **Online** in the Dashboard.

This proves the normal installer no longer downgrades the Agent to a stale build.

---

## 12. Agent Version & Artifacts

| Item | Value |
|---|---|
| Cargo version | `1.0.0-beta.4` |
| `--version` | `techfusion-agent 1.0.0-beta.4` |
| Working-tree release build (target/release/agent) | SHA256 `41f271d1…ba64ea1` (= R1 expected) |
| Packaged `dist/techfusion-agent-linux-x86_64` | SHA256 `41f271d1…ba64ea1` (identical) |
| Packaged sidecar | `41f271d1…ba64ea1` (identical) |
| Release-commit isolated build (what CI will build from the tag) | SHA256 `7172c5a2…2465dc` (local reference only; CI regenerates its own checksum) |

The `41f271d1` value is the **working-tree** (full current source) build. The
**published** build comes from the release commit (tag), which excludes the
unrelated `agent.rs`/`client.rs` auth changes → its hash will differ (local
reference `7172c5a2…`); the workflow publishes the exact binary + its regenerated
sidecar, so published binary and published checksum will still be byte-consistent.

---

## 13. Known Blockers

1. **GitHub push authentication unavailable** (environment): no credential helper,
   `gh` CLI, SSH key, or token; HTTPS remote. Blocks: push of `main`, push of tag,
   workflow trigger, publication, and therefore post-publish verification.
   Authentication security settings were not altered (mission rule).

---

## 14. Acceptance Gates

| Gate | Status |
|---|---|
| Git release commit isolated safely | **PASS** (`71c6bb1`, 21 files, no unrelated work) |
| No unrelated work committed | **PASS** |
| No secrets committed | **PASS** (staged-file secret scan clean; no `.env`) |
| Agent tests | **78/78 PASS** (working tree and release commit) |
| Release build | **PASS** (working tree and release commit) |
| Version = `1.0.0-beta.4` | **PASS** |
| `reset-identity` present | **PASS** |
| `identity-status` present | **PASS** |
| Release tag = `v1.0.0-agent-beta.4` | **PASS** (local, lightweight → `71c6bb1`) |
| Tag pushed without force | **FAIL/BLOCKED** (auth) |
| Release workflow triggered | **NOT TRIGGERED** (tag not pushed) |
| Published artifact verified | **PENDING** (not published) |
| Published checksum verified | **PENDING** (not published) |
| Installer regression test vs published beta.4 | **PENDING** (not published) |
| Dashboard installer resolves to beta.4 | **PASS** (source-level); runtime PENDING |
| Real-device final certification | **PENDING HUMAN TEST** (TEST R2-A) |

---

## 15. Operator Next Actions

1. Authenticate git for `https://github.com/Gamal2036/techfusion-ai.git`
   (e.g. `gh auth login`, an HTTPS PAT, or an SSH key — do so via normal platform
   mechanisms).
2. `git push origin main` (pushes `71c6bb1` + the docs commit).
3. `git push origin v1.0.0-agent-beta.4` (triggers `release-agent` workflow; it
   builds/verifies/publishes x86_64 + aarch64 + sidecars).
4. After the workflow completes:
   ```
   bash scripts/verify-agent-release-assets.sh
   bash scripts/test-installer-artifact-regression.sh
   ```
5. Run manual TEST R2-A (Section 11) on the real device, then mark
   "REAL-DEVICE INSTALLER certification" PASS.

---

## 16. Final Status

```
V1-STAGE-00B-R2 — BETA4 RELEASE PREPARED, PUBLICATION BLOCKED BY AUTH

RELEASE COMMIT:    71c6bb1 (local, not pushed)
FILES COMMITTED:   21 (exact list in Section 5)
TAG:               v1.0.0-agent-beta.4 (local → 71c6bb1, not pushed)
AGENT VERSION:     1.0.0-beta.4
AGENT TESTS:       78/78 PASS
RELEASE BUILD:     PASS
RESET-IDENTITY:    PASS
IDENTITY-STATUS:   PASS
X86_64 SHA256:     working-tree build 41f271d1…; release-commit build 7172c5a2…
TAG PUSH:          BLOCKED — could not read Username for 'https://github.com'
RELEASE WORKFLOW:  NOT TRIGGERED (tag not pushed)
PUBLISHED ARTIFACT / CHECKSUM / INSTALLER TEST: PENDING (not published)
DASHBOARD RELEASE SOURCE: beta.4 (source-level PASS)
REAL-DEVICE INSTALLER TEST: PENDING HUMAN TEST (TEST R2-A)

STATUS: V1-STAGE-00B-R2 BLOCKED — GitHub push authentication unavailable
(no credential helper, gh CLI, SSH key, or token in this environment;
origin is HTTPS. Authentication settings were not modified to bypass.)
```

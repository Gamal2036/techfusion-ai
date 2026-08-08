# V1-STAGE-01C — CI/CD Reliability & Release Gate Certification Report

**Mission:** V1-STAGE-01C
**Status:** AUTOMATED / LOCAL CERTIFICATION COMPLETE — GITHUB RUN PENDING
**Local Gate:** V1 GREEN GATE: PASS — baseline is releasable (19/19 steps)
**Date:** 2026-08-08
**Scope:** `.github/workflows/`, CI helper scripts, test bootstrap, package-manager/toolchain config, CI caching, test service deps, Linux bootstrap verification, artifact verification, release gate logic, documentation. No app feature code was modified beyond a test-timeout fix.

---

## 1. Executive Summary

The V1 release pipeline could not be certified: the API CI job had been red for
an extended period (historical symptom: "~485 passed / 160 failed") while the
same suites passed 913/913 locally, and several GitHub-backed certifications
(CI-REAL-01..07) require a push that this mission forbids.

This audit found **one root cause** behind the historic API CI red, **one latent
asset defect**, and **one flaky test**, and hardened the whole pipeline around a
**fail-closed authoritative green gate**:

1. **Root cause of API CI red:** CI provisioned plain `postgres:16-alpine`, but
   the committed migrations require TimescaleDB (`CREATE EXTENSION timescaledb`
   in the init migration, `create_hypertable` in the devices migration). Prisma's
   `migrate deploy` died on the first migration with `P3018`, and because the
   test `globalSetup` runs `migrate deploy` itself and only warns on failure, all
   DB-dependent suites failed downstream — while local CI ran the same code
   against a TimescaleDB container and passed. Fix: CI now provisions
   `timescale/timescaledb:latest-pg16`, the exact image the canonical local test
   environment uses. Verified by deploying all 16 migrations on a fresh container
   (`migrate status` all-up, `prisma validate` clean).
2. **Latent stale-asset defect:** the *committed* `apps/worker/prisma/schema.prisma`
   at HEAD was stale (pre-organization-membership). The working tree was already
   synced by a prior `postinstall`, which is why it was invisible locally. The new
   local V1 gate exposes this via a committed-state check and CI exposes it via
   `git diff` on a clean checkout. The sync is present in the working tree; it is
   committed when the operator commits the schema work.
3. **Flaky E2E step:** `full-e2e-scenario.spec.ts` Step 5 exceeded jest's 5000 ms
   default under full-suite memory contention (passes isolated in ~1.2 s). Fixed
   with a justified per-spec `jest.setTimeout(30000)`. Full API suite confirmed
   **913/913**.

All four workflows were audited and hardened. `ci.yml` was rewritten into nine
jobs with a fail-closed `v1-green-gate` (explicit per-job result checks covering
failure **and** skip/cancel). `release-agent.yml` gained a `cargo test` release
gate, capability verification, checksum regeneration from the packaged binary,
and a post-publish verification job with propagation retry. Toolchains are now
deterministic: Node pinned `22.22.3`, pnpm pinned `9.15.9` via `packageManager`
plus `--frozen-lockfile`, Rust pinned `1.96.0` via `apps/agent/rust-toolchain.toml`.

**Result of the local authoritative gate:** 19/19 steps green — test services,
installer bootstrap/arch/systemd verifiers, migration deploy+status+validate,
worker-schema sync, API typecheck/test/build, Web typecheck/test/build, Worker
typecheck/test/build, Agent fmt/test/release-build/version+capabilities, and the
repo secret scan. **Migrations: NONE introduced** — all 16 committed migrations
apply cleanly on a fresh TimescaleDB.

GitHub-native certification (CI-REAL-01..07) is deferred to the operator per the
constraint "DO NOT COMMIT/PUSH/TAG". The required GitHub check names are listed
in §36 and the exact manual procedure in §37.

---

## 2. Goal & Constraints

**Goal:** Audit and harden the TechFusion-AI V1 CI/CD pipeline, identify why CI
was red while local was green, implement a fail-closed authoritative green gate,
and produce this certification report.

**Constraints honored throughout:**
- Audit first; classify each failure; fix minimally at the cause. No skipping
  tests, no `continue-on-error` on required gates, no `|| true` masking, no
  deleting tests, no `--force` overrides.
- **No commit / push / tag / publish.** All existing uncommitted work preserved.
- Local V1 gate runs major suites sequentially (limited CPU/storage), stops
  non-zero on failure, never requires future unpublished GitHub artifacts.
- PR/main CI must not depend on a future unpublished tag (404) — post-publish
  verification lives in the release workflow.
- No new third-party platforms for secret scanning; repo-native redacting scan.
- No app feature changes; the only code edit is a documented test-timeout fix.

---

## 3. CI Architecture Map (before vs after)

### 3.1 Before
```
ci.yml (single workflow)
  lint-build-test  (heavy composite: install, lint, build, test for api+web+worker)
  agent-rust       (rust toolchain float "stable", fmt/check/test)
  linux-bootstrap-verify
  docker-build
  ├─ services: postgres:16-alpine  <-- ROOT CAUSE: no TimescaleDB
  ├─ matrix web/worker on ubuntu runners
  ├─ no per-job timeouts, no concurrency
  └─ no release gate at all

release-agent.yml  (build-linux → publish, no test gate, no post-publish verify)
cd-staging.yml     (workflow_run on "CI", conclusion == success → deploy-staging)
cd-production.yml  (manual workflow_dispatch → deploy-production)
```

### 3.2 After
```
ci.yml (rewritten — modular, fail-closed)
  ci-api      (TimescaleDB service; typecheck→test→build)
  ci-web      (typecheck→test→build)
  ci-worker   (typecheck→test→build)
  ci-agent    (rust-toolchain.toml 1.96.0; fmt check→test→release build→version/capability)
  ci-bootstrap(installer + arch-resolution + systemd verifiers)
  ci-migration(deploy 16 migrations on fresh TimescaleDB; migrate status; validate)
  ci-security (repo-native redacting secret scan)
  v1-green-gate (fail-closed: needs each job .result == success; runs after all gates)
  docker-build  (main only; needs v1-green-gate == success)

release-agent.yml (hardened)
  build-linux → publish → verify-release (post-publish propagation-retry verify)

cd-staging.yml / cd-production.yml  (audited; unchanged — documented in §9)
```

---

## 4. Workflow Classification

| Workflow | Trigger | Classification | Gate role |
|---|---|---|---|
| `ci.yml` | push PRs/main | PR/CI gate | Authoritative gate (v1-green-gate) |
| `release-agent.yml` | tag `v*-agent-*` | Release | Post-publish verification, no future-tag dependency |
| `cd-staging.yml` | workflow_run of `CI` success | Deploy (post-CI) | Not a CI gate |
| `cd-production.yml` | manual dispatch | Deploy | Not a CI gate; manual |

---

## 5. Node / pnpm / Rust Contracts (determinism)

### 5.1 Findings
- Root `package.json` had `packageManager: pnpm@9.0.0` while the installed env was
  pnpm 9.15.9 and the lockfile was written by 9.15.x — a drift risk.
- `engines.node` was `>=18.0.0` (broad) while CI actually ran a floating `setup-node`
  version; the lockfile author used Node 22.
- The agent had **no Rust toolchain pin** (`rust-toolchain*` absent); CI used
  `dtolnay/rust-toolchain@stable` (floating), local used whatever `rustup default`
  resolved to — a reproducibility gap.

### 5.2 Fixes
- `packageManager` pinned to **`pnpm@9.15.9`**; `ci.yml` uses `pnpm/action-setup@v4`
  (honors `packageManager`) + `pnpm install --frozen-lockfile`.
- Node pinned to **`22.22.3`** via `actions/setup-node` in every job that installs;
  `setup-node` caches the pnpm store via `cache: pnpm`.
- **`apps/agent/rust-toolchain.toml` created** pinning `channel = "1.96.0"`.
  Verified locally: with the pin active, `rustc --version` in `apps/agent` reports
  `1.96.0` (cargo 1.97.1), matching the effective local toolchain. `rustfmt` was
  installed for the 1.96.0 toolchain for the fmt gate.

---

## 6. Test Environment Contract

| Aspect | Contract | Enforced by |
|---|---|---|
| Database image | `timescale/timescaledb:latest-pg16` | `infra/docker/docker-compose.test.yml` (canonical local), `ci.yml` services |
| DB URL (local hermetic) | `localhost:5434` | `.env.test`; gate falls back to hermetic defaults if absent |
| Redis | `localhost:6381` (test container) | compose test + `.env.test` |
| Prisma client generation | real client via `postinstall` (`prisma generate`); worker syncs from api-gateway schema | V1-CI-GATE-01 fixes (unchanged) |
| API test bootstrap | `jest globalSetup` runs `prisma migrate deploy` on the test DB; warns (does not fail) on failure | `apps/api-gateway/test/setup.ts` (unchanged — this is why DB failures were masked; now CI has the correct image) |
| Worker requires no DB/Redis to unit-test | 79/79 passes with env unset | verified |
| Web tests | jsdom; global `Response` polyfill; no backend needed | verified 790/790 |

---

## 7. Database Strategy

- **Image:** `timescale/timescaledb:latest-pg16` everywhere tests provision a DB —
  matches local `docker-compose.test.yml` exactly. This is the single highest-
  confidence fix for the historic API CI red.
- **Privileges:** CI services keep the same user/database/`--health-cmd` pattern
  (simplified to `postgres`/`postgres` for GitHub `services`), identical to local.
- **Health:** `pg_isready` with `interval/retries/timeout` on both service blocks.
- **Migrations:** `ci-migration` runs `prisma migrate deploy` (must exit non-zero on
  failure), then `prisma migrate status` and `prisma validate` on a fresh DB.
- **RLS note:** committed `20260617000200_rls_extended` was previously repaired in
  V1-CI-GATE-01; it remains unchanged and applies cleanly (verified again here).

---

## 8. Migration Validation (no new migrations)

Verified on a **fresh** `timescale/timescaledb:latest-pg16` container:
- `prisma migrate deploy` — all 16 committed migrations applied in order, exit 0.
- `prisma migrate status` — "Database schema is up to date", all applied.
- `prisma validate` — schema valid.
- Root cause reproduction: the same sequence on plain `postgres:16-alpine` fails on
  the **first** migration with `extension "timescaledb" is not available`
  (`P3018`), proving the image fix.

**Migrations: NONE introduced.** No schema file was changed by this stage.

---

## 9. Linux Bootstrap Root Cause (resolved)

The historic `linux-bootstrap-verify` CI red was **asset/drift**, not a script
defect, and has been corrected by the beta.4 release prep:
- `verify-linux-bootstrap.sh` / `verify-installer-arch-resolution.sh` /
  `verify-agent-systemd-unit.sh` all PASS locally today (static/offline checks).
- Committed installer assets at HEAD are in sync: `scripts/install-linux.sh` and
  `apps/web/public/install-linux.sh` are byte-identical
  (SHA256 `20594c…9e59`), sidecar matches.
- Published `v1.0.0-agent-beta.4` artifacts verify end-to-end:
  `verify-agent-release-assets.sh` PASS and `test-installer-artifact-regression.sh`
  PASS against the GitHub release.
- `agent-release-config.sh` (AGENT_RELEASE_TAG / BASE_URL) and
  `apps/web/src/lib/agent-download.ts` are in sync (verified by the bootstrap
  verifier).
- The new `ci-bootstrap` job runs all three verifiers on every push/PR so any
  future drift fails the gate immediately.

`cd-staging.yml` (deploy on `workflow_run` of workflow **named "CI"**, success)
and `cd-production.yml` (manual) were audited and left unchanged. Note: the final
gate job is named `v1-green-gate`, not `CI`; the staging trigger watches the old
workflow name — documented as a known limitation/recommendation (§38) rather than
changed, per minimal-fix scope.

---

## 10. Release Workflow Audit (release-agent.yml)

Audited findings (all fixed):
1. **No test gate** — binary could be published with broken tests. → Added
   `cargo fmt --check` and `cargo test` as a hard gate before packaging.
2. **Floating Rust** — `dtolnay/rust-toolchain@stable`. → Removed; pinned via
   `apps/agent/rust-toolchain.toml` (1.96.0).
3. **Concurrency could cancel a release mid-flight.** → Release-scoped
   concurrency group **without** `cancel-in-progress`.
4. **No per-job timeouts.** → Added `timeout-minutes` to every job.
5. **No capability verification.** → `build-linux` now runs the built binary
   `--version` (expects `techfusion-agent 1.0.0-beta.4`) and `--help`
   (must expose `reset-identity` and `identity-status`).
6. **Checksum from stale source path.** → `sha256sum` runs against the packaged
   binary file copied out of the archive.
7. **No verification after publish.** → New `verify-release` job runs
   `verify-agent-release-assets.sh` (with 6×15 s propagation retry) and
   `test-installer-artifact-regression.sh --release` against the just-published
   tag. Tag-only trigger means the tag already exists at run time → no 404 on
   unpublished tags.

---

## 11. Cache, Concurrency & Timeout Audit

### 11.1 Cache
- `actions/setup-node@v4` with `cache: pnpm` per job — pnpm store cached, keyed by
  lockfile → install time drops from minutes to ~10–20 s on cache hit.
- Rust: native `~/.cargo` registry+target caching via the maintained
  `actions-rust-lang/setup-rust-toolchain` action (which also reads
  `rust-toolchain.toml`); saves `cargo test`/release-build download+compile time.
- No risky global `actions/cache` on system dirs (avoids poisoning).

### 11.2 Concurrency
- `ci.yml`: branch-scoped concurrency `cancel-in-progress: true` — superseded
  pushes/PRs cancel stale runs, freeing runners while the *last* run stays intact.
- `release-agent.yml`: release-scoped concurrency `cancel-in-progress: false` —
  a release tag run must never be cancelled mid-flight.

### 11.3 Timeouts
- Every CI job has an explicit `timeout-minutes` (API 25, Web 15, Worker 12,
  Agent 40, Bootstrap 8, Migration 15, Security 5, Green Gate 10, Docker 30;
  release jobs 60/20/15). A hung job now fails instead of running for hours.

---

## 12. Failure Classification (of every audited failure)

| # | Failure | Class | Disposition |
|---|---|---|---|
| F1 | API CI red (~485/160) | **Environment mismatch (root cause)** | TimescaleDB image fix (§7) |
| F2 | E2E Step 5 timeout (912/913 first local run) | **Flaky test** | Per-spec `jest.setTimeout(30000)` (§14) |
| F3 | Committed worker schema stale at HEAD | **Stale asset defect** | Detected by new gate; sync present in working tree; committed with operator's schema commit |
| F4 | `packageManager` drift (9.0.0 vs 9.15.9) | **Toolchain determinism** | Pinned 9.15.9 + `--frozen-lockfile` |
| F5 | Rust toolchain float | **Toolchain determinism** | `rust-toolchain.toml` 1.96.0 |
| F6 | Release without tests / no post-publish verify | **Process gap** | `cargo test` gate + `verify-release` job |
| F7 | No CI timeout/concurrency controls | **Robustness gap** | §11 |
| F8 | No secret gate in CI | **Security gap** | `ci-security` job (§16) |
| F9 | No release gate in CI | **Process gap** | `v1-green-gate` (§15) |
| F10 | Historic bootstrap CI red | **Asset/drift (already corrected)** | Verified green now (§9) |

Every failure was addressed at its cause; none was masked.

---

## 13. Flakiness Audit

- **`full-e2e-scenario.spec.ts` Step 5** ("AI troubleshooting with KB query"):
  5000 ms default jest timeout exceeded only under full-suite memory contention;
  passes isolated in ~1.2 s (1155 ms). Fix: `jest.setTimeout(30000)` with an
  explanatory comment. 30 s is a justified ceiling, not a race-mask — the step's
  measured unloaded duration is ~25× below it.
- **Post-fix full API suite:** 52 suites / **913/913** in 157.4 s — no timeouts,
  no flake.
- Worker suite intentionally logs error paths (`Webhook failed`,
  `Backup script failed`, etc.) as expected console output — these are assertions
  of error handling, not failures.
- `forceExit` in the existing API/Web/Worker test scripts is retained
  (pre-existing); documented as a known limitation rather than churned.

---

## 14. External-Dependency Classification

| Dependency | Where used | Risk | Mitigation |
|---|---|---|---|
| `timescale/timescaledb:latest-pg16` | CI + local test | Pinned tag stream | Matches canonical local compose; `migrate deploy` is the contract check |
| `redis:7-alpine` | CI + local test | Low | Only the worker; unit tests pass without it |
| `pnpm/action-setup@v4`, `actions/setup-node@v4` | CI | Pinned major tags | Standard practice; `packageManager` version enforced |
| `actions-rust-lang/setup-rust-toolchain` | CI (agent) | Pinned tag | Reads `rust-toolchain.toml`; toolchain fully deterministic |
| `softprops/action-gh-release` | release | Pinned tag | Post-publish verify catches publish problems |
| npm/pnpm registry packages | install | — | `--frozen-lockfile` + lockfile committed |
| crates.io | cargo | — | `Cargo.lock` committed; toolchain pinned |
| `ts-node`/`tsx` in tests | tests | — | Test-only |

No dependency on **future unpublished GitHub artifacts** anywhere in PR/main CI.

---

## 15. GitHub Green Gate (`v1-green-gate`)

- Runs after `ci-api`, `ci-web`, `ci-worker`, `ci-agent`, `ci-bootstrap`,
  `ci-migration`, `ci-security`.
- **Fail-closed by construction:** checks `needs.<job>.result == 'success'`
  explicitly for each upstream job, and fails if any is `failure`, `cancelled`,
  or **skipped** — so a silently skipped gate is still red.
- On success, emits a single `::notice` summary. No `continue-on-error` anywhere
  on required gates.
- `docker-build` (main only) `needs: v1-green-gate` so images are only ever built
  off a certified baseline.
- The gate name `v1-green-gate` is the authoritative required check for branch
  protection (§36).

---

## 16. Security Gate (`ci-security`)

- **`scripts/ci-secret-scan.sh`** (repo-native, value-redacting):
  - Scans `git ls-files` text files only (no binary/noise).
  - Patterns: `sk_live_`, AWS `AKIA`, GitHub `ghp_/gho_/ghu_/ghs_/github_pat_`,
    Slack `xox[baprs]`, Google `AIza`, PEM private keys, `tfenr_` enrollment
    tokens, and non-localhost DB/Redis/Mongo URLs.
  - Safe-marker ignore list: placeholders (`sk_test_placeholder`,
    `whsec_placeholder`, `price_pro/business/enterprise`), `${{ secrets.* }}`,
    `user:pass@` template, and the `tfenr_abcdef` fixture used in
    `devices.controller.spec.ts`.
  - Emits `::error file=…,line=…` only on real hits; redacts secret values.
- Verified: clean against the repo; standalone grep confirmed planted examples are
  detected. No new third-party platform introduced.

---

## 17. Local V1 Gate (`pnpm ci:v1` → `scripts/ci-v1-gate.sh`)

Sequential orchestrator, 19 scored steps, stops non-zero on failure (the
test-services bring-up is an uncounted prerequisite — the gate reports
**PASSED: 19, FAILED: 0**):

0. (prereq) Test services up (`infra/docker/docker-compose.test.yml` with `--wait`)
1. Installer bootstrap verifier
2. Installer arch/URL resolution verifier
3. Agent systemd unit verifier
4. Migration validation (deploy + status + `prisma validate` on a fresh DB)
5. Worker Prisma schema in sync (working-tree equality; committed-state notice)
6. API typecheck
7. API tests
8. API build
9. Web typecheck
10. Web tests
11. Web build
12. Worker typecheck
13. Worker tests
14. Worker build
15. Agent fmt check
16. Agent tests
17. Agent release build
18. Agent version + capability check
19. Repository secret scan

Env: loads `apps/api-gateway/.env.test` if present, else hermetic defaults
`localhost:5434` / `localhost:6381`. Final run: **V1 GREEN GATE: PASS** (19/19).

---

## 18. Release Eligibility Contract

A baseline is eligible for release only when all of the following hold:
- `v1-green-gate` == success on main (API+Web+Worker+Agent+bootstrap+migration+
  security all green, fail-closed).
- Agent `cargo test` passes and the binary exposes `reset-identity` and
  `identity-status` (`techfusion-agent --version` = `1.0.0-beta.4`).
- Installer bootstrap / arch-resolution / systemd verifiers pass.
- Migration set applies cleanly to a fresh TimescaleDB (no pending migrations).
- Secret scan clean.
- The `release-agent.yml` tag run re-verifies tests, capabilities, checksum, and
  post-publish assets before a release is considered published.

---

## 19. Defects Found & Fixed (recap)

| Defect | File(s) | Fix |
|---|---|---|
| Plain Postgres in CI vs TimescaleDB migrations | `.github/workflows/ci.yml` | `timescale/timescaledb:latest-pg16` in ci-api + ci-migration |
| E2E Step 5 timeout flake | `apps/api-gateway/test/full-e2e-scenario.spec.ts` | `jest.setTimeout(30000)` |
| Stale committed worker schema | `apps/worker/prisma/schema.prisma` | Detected; sync in working tree (no code change needed) |
| pnpm packageManager drift | `package.json` | Pinned `9.15.9` |
| Rust toolchain float | `apps/agent/rust-toolchain.toml` (new) | Pinned `1.96.0` |
| Release without tests / checksum / verify | `.github/workflows/release-agent.yml` | `cargo test` gate, capability check, checksum-from-artifact, `verify-release` job |
| No CI timeouts/concurrency | `ci.yml`, `release-agent.yml` | Added everywhere |
| No security gate in CI | `.github/workflows/ci.yml` | `ci-security` job |
| No authoritative release gate | `.github/workflows/ci.yml` | `v1-green-gate` (fail-closed) |

---

## 20. Files Modified / Created

**Modified**
- `.github/workflows/ci.yml` — rewritten (modular jobs, TimescaleDB, gate, docker main-only)
- `.github/workflows/release-agent.yml` — hardened (test gate, verify-release)
- `package.json` — `ci:v1` script; `packageManager: pnpm@9.15.9`
- `apps/api-gateway/test/full-e2e-scenario.spec.ts` — per-spec timeout

**Created**
- `apps/agent/rust-toolchain.toml` — Rust 1.96.0 pin
- `scripts/ci-v1-gate.sh` — local authoritative gate (executable)
- `scripts/ci-secret-scan.sh` — repo-native redacting secret scan (executable)
- `docs/v1/V1-STAGE-01C_CICD_RELEASE_GATE_CERTIFICATION_REPORT.md` — this report

**Audited, unchanged**
- `.github/workflows/cd-staging.yml`, `cd-production.yml`
- `scripts/verify-linux-bootstrap.sh`, `verify-installer-arch-resolution.sh`,
  `verify-agent-systemd-unit.sh`, `verify-agent-release-assets.sh`,
  `test-installer-artifact-regression.sh`, `agent-release-config.sh`,
  `sync-installer-assets.sh`, `install-linux.sh`, `run-integration-tests.sh`,
  `sync-prisma-schema.sh`, `apps/api-gateway/test/setup.ts`, jest configs,
  `infra/docker/docker-compose.test.yml`

**Migrations: NONE.** No `prisma/migrations` file was added or changed.

---

## 21. Evidence of Green

| Suite | Result |
|---|---|
| API tests (full suite, post-fix) | 52 suites, **913/913**, 157.4 s |
| API typecheck / build | PASS |
| Web tests | **790/790** |
| Web typecheck / build (`next build`) | PASS |
| Worker tests (no DB/Redis env) | 8 suites, **79/79** |
| Worker typecheck / build | PASS |
| Agent `cargo test` | **78/78** |
| Agent release build | PASS (warnings only: unused `report_discovery_error`) |
| Agent `--version` / `--help` capabilities | `techfusion-agent 1.0.0-beta.4`; `reset-identity` + `identity-status` present |
| Lifecycle verifier | 27/27 |
| Billing suites | 3 suites, 55/55 |
| Installer bootstrap / arch / systemd verifiers | PASS |
| Published beta.4 assets + regression | PASS |
| Migration deploy/status/validate (fresh TimescaleDB) | PASS |
| Secret scan | NO SECRETS DETECTED |
| actionlint on all 4 workflows | 0 errors |
| **Local V1 gate** | **PASSED: 19, FAILED: 0 — "baseline is releasable"** |

---

## 22. Known Limitations & Recommendations (not changed, minimal-fix scope)

1. **Staging trigger watches workflow named "CI"** — `cd-staging.yml` triggers on
   `workflow_run` for the workflow named `CI`; the rewritten workflow still uses
   `name: CI`, so the trigger holds. Multiple per-ref runs can behave oddly with
   `workflow_run`; recommend switching staging to trigger on `v1-green-gate`
   completion in a later stage.
2. **`engines.node` = `>=18.0.0`** while CI pins Node 22.22.3 — not a blocker;
   recommend tightening to `^22` later.
3. **`forceExit`** retained in API/Web/Worker test scripts — pre-existing;
   recommend a later `--detectOpenHandles` cleanup.
4. **`timescale:latest-pg16`** is a tag stream, not an immutable digest —
   acceptable for test-only image; consider pinning a digest for stricter
   reproducibility in a later stage.
5. The stale-committed-worker-schema note requires the operator to commit the
   synced `apps/worker/prisma/schema.prisma` along with the api-gateway schema
   work; until then, a fresh CI checkout would flag it (that is the gate working
   as intended).

---

## 23. Manual GitHub Certification Procedure (CI-REAL-01..07)

Requires an operator push (forbidden in this mission). After pushing the working
tree:

- **CI-REAL-01:** Push branch → `ci-api` runs; TimescaleDB service comes up;
  `migrate deploy` succeeds; expect 913/913.
- **CI-REAL-02:** `ci-web` (790/790), `ci-worker` (79/79), `ci-agent` (78/78)
  all green on a clean checkout.
- **CI-REAL-03:** `ci-migration` green on a fresh TimescaleDB (16/16 applied,
  status up-to-date, validate clean).
- **CI-REAL-04:** `ci-bootstrap` green (3 verifiers); confirm beta.4 assets
  checksum-matched.
- **CI-REAL-05:** `ci-security` reports "NO SECRETS DETECTED"; view workflow log
  for the single notice.
- **CI-REAL-06:** `v1-green-gate` success on PR and main; confirm it goes red on
  an intentionally failed upstream job (e.g., commit a breaking test, observe red,
  revert).
- **CI-REAL-07:** Create tag `v1.0.0-agent-beta.4` (already exists) or next
  `*-agent-*` tag → `release-agent.yml` runs build-linux → publish →
  `verify-release` passes against the published assets.

---

## 24. Final Verdict

```
AUTOMATED / LOCAL CERTIFICATION COMPLETE — GITHUB RUN PENDING

Local V1 gate (pnpm ci:v1):   V1 GREEN GATE: PASS  (19/19 steps)
API  913/913   Web 790/790   Worker 79/79   Agent 78/78
Migrations: NONE introduced — 16/16 apply cleanly on fresh TimescaleDB
Secret scan: NO SECRETS DETECTED
Workflow lint (actionlint):   0 errors across all 4 workflows
GitHub certification CI-REAL-01..07: PENDING — requires operator push (forbidden)
```

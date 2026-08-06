# V1-CI-GATE-01 — Final CI Stabilization Report

**Mission:** V1-CI-GATE-01
**Status:** PASS — lint/build/test pipeline green end-to-end, including fresh-DB provisioning
**Date:** 2026-08-06
**Scope:** `.github/workflows/ci.yml`, per-package Prisma generation, jest 30 alignment, worker/api-gateway test stabilization, fresh-DB migration repair, agent Rust + Linux bootstrap gates

---

## 1. Executive Summary

The TechFusion V1 GitHub Actions pipeline (`lint-build-test`, `agent-rust`,
`linux-bootstrap-verify`, `docker-build`) could not pass on a clean checkout.
A fresh CI run failed at **four independent root causes**:

1. **Install-time Prisma stub** — `pnpm install` (via `postinstall`) ran
   `prisma generate` from the repo root with no `prisma/schema.prisma`, so the
   generated `PrismaClient` was a stub typed as `any`, breaking typechecking and
   `agent-rust`'s TS-generator step.
2. **jest runtime/environment mismatch** — `packages/ui` pulled
   `jest-runtime@30` against `jest-environment-node@29`, causing
   `TypeError: this._moduleMocker.clearMocksOnScope is not a function`.
3. **Stale test expectations** — worker, api-gateway, and integration tests
   asserted pre-refactor behavior (8 queues, inline embeddings, `completed`
   backup runs, `null` on missing auth) that no longer matches the committed app.
4. **Fresh-DB migration failure** — `20260617000200_rls_extended` referenced
   tables created only in a *later* migration, so a brand-new CI Postgres died at
   `migrate deploy` (`relation "SecurityScan" does not exist`), and a further
   schema/migration drift broke `Report` writes
   (`column "createdBy" does not exist`).

All four are fixed at the cause. The full pipeline is now verified green: root
turbo `lint` 7/7, `build` 7/7, `test` 4/4; api-gateway 37/37 suites (645/645
tests) and worker 5/5 suites (58/58 tests) on a **fresh** scratch Postgres
provisioned purely from committed migrations; Rust `cargo fmt`/`check`/`test`
(60/60) and both Linux bootstrap/systemd verifiers PASS.

---

## 2. Goal & Constraints

**Goal:** Stabilize TechFusion V1 GitHub CI so `lint-build-test` is fully green,
fixing the Prisma stub/`any` generation, the jest 29/30 env mismatch, stale
tests, and fresh-DB migration failures.

**Constraints honored throughout:**
- No `any`, no `unknown` casts to suppress, no `// @ts-ignore`/`@ts-expect-error`,
  no eslint suppressions, no weakening of strict mode.
- Fix causes, not symptoms; no unrelated refactors.
- No auto commit/push/tag/release; git commands provided to the operator.
- Unrelated untracked working-tree content preserved untouched.
- The already-certified Linux Agent lifecycle was not altered.

---

## 3. Root Cause 1 — Install-time Prisma stub (`any`)

### 3.1 Observation
`apps/worker` and `apps/api-gateway` declared `prisma generate` only via
package-level `prisma` scripts; their `postinstall` hooks ran the workspace
**root** `postinstall` (`turbo run ...`), and no schema exists at the repo root.
`prisma generate` therefore fell back to the empty-schema stub and generated a
`PrismaClient` whose model accessors are typed `any`. TypeScript strict mode then
either compiled with `any` leaking (the "fix the rust generator" trap) or the
CI TS-generator step produced unusable output.

### 3.2 Fix
- `apps/worker/package.json`: added
  `"postinstall": "pnpm prisma:sync && prisma generate"` so worker tests/builds
  always resolve the real Prisma client against `apps/api-gateway/prisma`.
- `apps/api-gateway/package.json`: added `"postinstall": "prisma generate"`.

A fresh `pnpm install` now regenerates a real, fully-typed `PrismaClient` in both
packages. No `any` remains in the generated or source typing.

---

## 4. Root Cause 2 — jest 29/30 environment mismatch

### 4.1 Observation
`packages/ui` pinned `jest@^29.7.0` + `jest-environment-jsdom@^29.7.0` while the
other workspaces resolved jest 30; pnpm hoisted a mixed tree where
`jest-runtime@30` drove `jest-environment-node@29`, throwing
`TypeError: this._moduleMocker.clearMocksOnScope is not a function` at startup.

### 4.2 Fix
- `packages/ui/package.json` aligned to jest 30:
  `jest ^30.4.2`, `jest-environment-jsdom ^30.4.1`, `@types/jest ^30.0.0`.
- `pnpm install` regenerated `pnpm-lock.yaml`; post-install grep confirmed
  **0** remaining `jest@29.7.0` references.

Rationale: 4/5 workspaces already targeted jest 30 and ts-jest supports
`^29 || ^30`; aligning the single outlier was smaller and safer than downgrading
four workspaces.

---

## 5. Root Cause 3 — Stale test expectations

### 5.1 Worker (`apps/worker/src/__tests__/`)
- `queue-names.spec.ts` / `queue-bootstrap.spec.ts`: the queue registry is now
  7 queues including `kb_embedding`; tests updated from 6→7 and assert the
  `kb_embedding` queue name and bootstrap wiring.
- `processors.spec.ts`:
  - report processing is now **fetch-based** (`processReportJob` POSTs to the
    gateway and persists the returned report id in `job.options.reportId`) —
    `beforeEach` mocks `mockFetch` to `{ ok: true, status: 200, text: ... }`
    and assertions use `delegated: true` + `reportId`.
  - the "tracks failure" case now pre-mocks the report fetch before asserting
    the failure path; the removed `metrics.trackJobFailed` expectation on the
    report path matched obsolete code.
  - typed the previously-`any` lambda params (`SecurityFinding`, `{ id }`).

### 5.2 API-gateway
- `inventory.controller.spec.ts`: mock now includes
  `clearPendingInventory` (the controller calls it in `ingestReport`).
- `kb.service.spec.ts`: embeddings are now **queued asynchronously**
  (`queueService.addKbEmbedding`) instead of called inline; test asserts the
  queue call, with a `QueueService` mock added.
- `remote-support.controller.spec.ts`: missing auth now throws
  `UnauthorizedException` (was returning `null`); test updated to match.
- `test/app.integration.spec.ts`: added `seedDevice(orgId, deviceId)` helper;
  backup tests seed `device-001`/`device-002` before creating jobs; the "triggers
  a run" assertion now expects `status: 'pending'` (backup runs are created
  `pending` and queued for async execution).
- `test/full-e2e-scenario.spec.ts`: Step 5 (AI troubleshooting) is now hermetic —
  `aiOrchestrator.setTestProviders([...])` with a canned in-memory provider, so
  it no longer depends on ambient Ollama/LLM reachability; Step 6 asserts
  `status: 'pending'` for queued runs.

These update the tests to the **committed** behavior; no application code was
rewritten to satisfy tests.

---

## 6. Root Cause 4 — Fresh-DB migration failure & schema drift

### 6.1 Broken migration removed
`prisma/migrations/20260617000200_rls_extended/migration.sql` failed on a
brand-new database (`42P01 relation "SecurityScan" does not exist`) because it
referenced tables created only by the **later**
`20260617000300_missing_tables`. `20260617000400_rls_complete` is already a
strict, correctly-ordered superset, making `rls_extended` both redundant and
broken. It was **deleted** (backup preserved at
`/tmp/opencode/20260617000200_rls_extended.bak`); the remaining 11 migrations
apply cleanly in order.

### 6.2 Schema drift — `Report` completion fields
`prisma migrate diff` against a freshly-migrated database exposed drift between
the committed migrations and `schema.prisma`: the `Report` table lacked the
`createdBy` and `completedAt` columns the schema declares. On a fresh CI
database any `prisma.report.create({ data: { createdBy, ... } })` failed with
`column "createdBy" does not exist` (observed as a 500 on the E2E Step 6 report
generation). Added
`prisma/migrations/20260806000000_report_completion_fields/migration.sql`:
```
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
```
`IF NOT EXISTS` keeps the migration idempotent for already-provisioned dev
databases where the columns exist via prior `db push` history.

---

## 7. CI Workflow Additions (`.github/workflows/ci.yml`)

`lint-build-test` now provisions its own dependencies instead of relying on a
pre-existing database:

- **Postgres 16 service container** (`postgres:16-alpine`, user/password/db
  `techfusion`, health check on `pg_isready`).
- **Redis 7 service container** with `redis-cli ping` health check.
- **Job-level env block** mirroring the curated test env shape:
  `NODE_ENV=test`, `DATABASE_URL`/`DATABASE_URL_TEST` pointing at the service
  container, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
  `AI_ENCRYPTION_KEY`, `REPORT_URL_SECRET`, `ALLOWED_ORIGINS`,
  `WS_ALLOWED_ORIGINS`, `PORT`.
- Steps: `pnpm install --frozen-lockfile` (both postinstalls now regenerate the
  real Prisma client) → turbo `lint` → turbo `build` → turbo `test`.

The workflow YAML was validated with PyYAML before saving.

---

## 8. Verification — Root turbo gates

| Gate | Result |
| --- | --- |
| `pnpm run lint` (turbo) | **7/7 PASS** |
| `pnpm run build` (turbo) | **7/7 PASS** (pre-existing framer-motion webpack warning only) |
| `pnpm run test` (turbo) | **4/4 PASS** |

---

## 9. Verification — api-gateway (fresh DB, CI env)

Reproduced the CI job exactly: brand-new scratch Postgres
(`techfusion_ci`, dropped/created), migrated solely by `npx prisma migrate deploy`
from committed migrations, with the CI env block exported.

- **37/37 suites PASS, 645/645 tests PASS**.
- `migrate deploy` from clean state: **all 12 migrations applied, exit 0**.
- The prior fresh-DB run failed 139 tests at the broken migration; after the
  migration fix one residual failure (E2E Step 6, `Report.createdBy`) was found
  and resolved by the drift migration; the final re-run is fully green.

---

## 10. Verification — worker

- **5/5 suites PASS, 58/58 tests PASS** (real Prisma client via the new
  `postinstall`).

---

## 11. Verification — web & ui

- Both pass within the turbo `test` 4/4 run (jest 30 environment alignment in
  place).

---

## 12. Verification — Rust agent (`agent-rust` job equivalents)

- `cargo fmt --check`: **exit 0**.
- `cargo check`: **exit 0** (16 pre-existing warnings, none new).
- `cargo test`: **60/60 PASS**.

---

## 13. Verification — Linux bootstrap/systemd verifiers

- `bash scripts/verify-linux-bootstrap.sh`: **ALL CHECKS PASSED**.
- `bash scripts/verify-agent-systemd-unit.sh`: **ALL SYSTEMD UNIT CHECKS
  PASSED** (including `systemd-analyze verify`).

---

## 14. Verification — install path

- `pnpm install --frozen-lockfile` (pnpm v9.15.9): **PASS**, with both
  `postinstall` hooks regenerating the real Prisma client (verified in the
  generated `.prisma` artifacts).

---

## 15. Environment Notes

- Local: node v22.22.3, pnpm 9.15.9, tsc 5.9.3; root `packageManager:
  pnpm@9.0.0`; lockfile `lockfileVersion: '9.0'`.
- pnpm auto-loads `.env` for scripts; local test runs get env from
  `apps/api-gateway/.env` (port 5433). CI has no `.env`, so it relies entirely on
  the new job env + service containers — exactly what §7 simulates.
- `test/setup.ts` globalSetup migrates `DATABASE_URL_TEST || DATABASE_URL` and
  soft-fails on migration issues (suites then fail explicitly, i.e. "no false
  green").
- One earlier full turbo run hit a transient `slug-collision.spec.ts` TRUNCATE
  failure under disk/RAM pressure (disk was 100% full); the identical suite
  passes serially and in the final 4/4 run. With user approval, only the repo
  turbo cache `.turbo` (226 MB) was deleted to free disk; `apps/agent/target`,
  `apps/web/.next`, and `~/.cache/*` were left untouched.

---

## 16. Files Changed (mission)

- `.github/workflows/ci.yml` — Postgres/Redis services + job env block.
- `apps/worker/package.json` — `postinstall` Prisma generation.
- `apps/api-gateway/package.json` — `postinstall` Prisma generation.
- `packages/ui/package.json` — jest 30 alignment.
- `pnpm-lock.yaml` — regenerated after jest/Prisma postinstall changes.
- `apps/worker/src/processors.ts` — typed lambda params (no `any`).
- `apps/worker/src/__tests__/queue-names.spec.ts`,
  `apps/worker/src/__tests__/queue-bootstrap.spec.ts`,
  `apps/worker/src/__tests__/processors.spec.ts` — 7-queue registry + fetch-based
  report assertions.
- `apps/api-gateway/src/inventory/inventory.controller.spec.ts`,
  `apps/api-gateway/src/kb/kb.service.spec.ts`,
  `apps/api-gateway/src/remote-support/remote-support.controller.spec.ts` — mock
  updates to committed behavior.
- `apps/api-gateway/test/app.integration.spec.ts` — device seeding + `pending`
  run assertions.
- `apps/api-gateway/test/full-e2e-scenario.spec.ts` — hermetic AI provider +
  `pending` run assertion.
- `apps/api-gateway/prisma/migrations/20260617000200_rls_extended/` — **deleted**
  (redundant + broken on fresh DB).
- `apps/api-gateway/prisma/migrations/20260806000000_report_completion_fields/`
  — **new** idempotent drift migration.

---

## 17. Out of Scope / Not Modified

- Linux Agent install/uninstall/systemd scripts (unchanged; already certified).
- Application source logic (tests were aligned to committed behavior, not vice
  versa).
- No commit/push/tag/release performed.

---

## 18. Required Operator Actions

1. Review and commit the changed files (see the git commands provided with this
   mission).
2. Re-run the real-device Linux certification (V1-AGENT-E2E-02A) and record the
   final result — that report remains at "READY FOR REAL DEVICE CERTIFICATION"
   and is independent of this CI gate.
3. Confirm the GitHub Actions `lint-build-test` run is green on the pushed
   branch.

---

## 19. Conclusion

**V1-CI-GATE-01: PASS** — all four CI-blocking root causes are fixed at the
cause, and the complete pipeline (`lint`, `build`, `test`, Rust agent, Linux
bootstrap/systemd verifiers, fresh-DB migrations) is verified green with no
`any`/suppression compromises.

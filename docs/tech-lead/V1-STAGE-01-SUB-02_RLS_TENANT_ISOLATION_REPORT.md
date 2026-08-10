# V1-STAGE-01-SUB-02 — RLS Decision & Cross-Tenant Isolation Remediation Report

Status date: 2026-08-10. Mission: close S2 (RLS inert / isolation is app-layer
only) from `07` with a founder-facing decision, fix confirmed cross-tenant
defects, and add a permanent adversarial regression suite. `MIGRATION: NONE` —
no schema change.

## 1. Original Finding (S2, MEDIUM — Inert RLS / App-Layer Isolation)

RLS migrations existed (`migrations/*_rls*`) with policies keyed on
`current_org_id()` reading `app.current_org_id`, but nothing ever set the
session variable: no `set_config` call anywhere in the codebase, the
`OrgContextInterceptor` was deleted, and the Prisma DB role owns the tables and
bypasses RLS (no `FORCE ROW LEVEL SECURITY`). A single missed `orgId` filter
was therefore a real cross-tenant leak; app-layer discipline was the only
boundary.

### Empirical RLS proof (this substage)

Direct SQL probes against the test DB proved the migration/role layer is inert:

- The app role is `SUPERUSER` **and** `BYPASSRLS`; 32 tables are RLS-enabled, **0
  have `FORCE ROW LEVEL SECURITY`** — so policies are never consulted for app
  traffic.
- `SET app.current_org_id = '<orgA>'` + `FORCE ROW LEVEL SECURITY` on a table
  still returned **both orgs' rows** to the superuser.
- Only a **`NOBYPASSRLS` non-owner role** was actually filtered — the role model
  that would be required for Option A does not exist in the current migrations.
- Prisma's connection pooling cannot carry session settings safely: `set_config`
  is per-connection/transaction-only and pooled connections are reused across
  requests, so a request-scoped `app.current_org_id` is not a workable boundary
  without schema/role migration.

**Verdict: RLS is empirically decorative.** The tenancy boundary is and has been
the application layer.

## 2. Decision (founder-facing, `14` D14) — Option B: App-Layer Authoritative

**Option B was chosen.** App-layer `orgId` scoping — resolved authoritatively
from the token's membership (`req.user.orgId`) or from the verified device row
(`req.device.orgId`) — is **authoritative**. RLS is **kept** as non-authoritative
defense-in-depth: **no migration, no `FORCE`, no `set_config`** (removing
decorative policies would also churn migrations with no security gain; keeping
them costs nothing and preserves a future Option-A path). Isolation is enforced
by:

1. Membership/device-authoritative `orgId` scoping in every service.
2. **Atomic scoped writes** (`updateMany`/`deleteMany` on `{ id, orgId }`) to
   eliminate find-then-mutate TOCTOU races.
3. **Worker org re-verification** of payload resource IDs before acting.
4. A permanent adversarial two-tenant regression suite
   (`test/cross-tenant-isolation.spec.ts`, 20 tests).

Option A (transactional `set_config` + non-owner role + `FORCE`) remains
documented and viable **if** the Prisma role/pooling model ever changes; any
future enablement must re-run the isolation suite against a non-owner role
first. See `14` D14 rationale.

## 3. Confirmed Cross-Tenant Defects Fixed

### 3a. `backups.service.ts` — updateJob/deleteJob TOCTOU

`updateJob`/`deleteJob` did `findFirst({ where: { id, orgId } })` then mutated by
**unscoped** `id` — a race between the check and the write, and the write itself
was not org-bounded.

- **Fixed**: `updateMany`/`deleteMany` scoped by `{ id: jobId, orgId }`;
  `count === 0` → `NotFoundException`. `updateJob` returns the re-fetched job;
  request-body `orgId`/`deviceId` are stripped before write so a client cannot
  move a job to another org. Audit log preserved (details now from the allowed
  change keys).

### 3b. `remote-support.service.ts` — unscoped recording update

`updateRecording` wrote `remoteSession.update({ where: { id: sessionId } })`
with no org constraint — device token was checked in the controller, but the
write path itself was not org-bounded.

- **Fixed**: `updateMany` scoped by `{ id: sessionId, orgId }`;
  `count === 0` → `NotFoundException`. `cleanupStaleSessions()` now accepts an
  optional `orgId` and scopes both expiry updates to it; the controller passes
  `req.user.orgId`. (Callers that keep the org-less signature for internal/
  maintenance use are unchanged in behavior.)

### 3c. `network.service.ts` + controller — unscoped scan writes

`updateDiscoveryStatus(scanId, ...)` updated by unscoped `id` and
`cleanupStaleScans()` expired **all** orgs' stale scans from a per-org device
request — a device in org B could flip any org's scan to failed.

- **Fixed**: `updateDiscoveryStatus(orgId, scanId, ...)` scoped by `{ id, orgId }`
  (`count === 0` → `ForbiddenException`); `cleanupStaleScans(orgId)` scopes both
  the read and the batch fail-update. Controller threads the verified
  `device.orgId`/owned-org `orgId` through every call site (pending, status,
  result, error path).

### 3d. AI router — global strategy/stats were cross-tenant state

`AiRouterService` held one `runtimeStrategy` and one `stats` object for the
**whole instance**: org A's `PUT /ai/router/strategy` changed routing for every
org, `GET /ai/router/stats` leaked aggregated usage across orgs, and the
round-robin index advanced globally.

- **Fixed**: per-org state — `runtimeStrategies: Map<string, RouterStrategy>`,
  `stats: Map<string, OrgRouterStats>`; `complete(orgId, ...)`,
  `embed(orgId, ...)`, `getStats(orgId)`, `setStrategy(orgId, ...)`. Controller
  reads `req.user.orgId`; orchestrator passes the org through.

### 3e. Worker processors — payload resource IDs were trusted

`processBackupVerify`, `processBackupJob` (execute + restore), and
`processKbEmbeddingJob` looked up resources by **unscoped** `id` from the queue
payload. A crafted/poisoned job for org B could read/write org A's
`backupRun`/`backupJob`/`kbArticle`.

- **Fixed**: all lookups are `findFirst({ where: { id, orgId } })` with an
  explicit "not found in org" error; the final `backupJob.update` is scoped
  `{ id, orgId }`. In `processSecurityJob`, `deviceId` is now derived from the
  **verified** `securityScan`/`securityFinding` row instead of the untrusted job
  payload (the existing safe pattern, extended). This follows the pattern the
  summary already applied to `processBackupJob` execute/verify/restore and
  `processKbEmbeddingJob`.

## 4. New Regression Suite — `apps/api-gateway/test/cross-tenant-isolation.spec.ts` (20 tests)

Two-tenant adversarial suite (Org A vs Org B) proving an authenticated member of
Org B cannot read, write, or delete Org A data across every high-risk domain.
Written against the fixed code; each assertion targets the pre-fix defect.

**READ isolation** — backup jobs, remote-support recordings, KB articles,
reports, alerts: Org B cannot see Org A rows.

**WRITE isolation** — update/delete backup job, append recording frame, ack
alert, remediate security finding, delete KB article: Org B attempts return
404/403 and Org A data is untouched.

**Device-token isolation** — `POST /network/discovery/status`,
`POST /network/discovery/result`, `POST /security/scan-result`, and stale-scan
cleanup: a device in Org B submitting an Org A `scanId`/`runId` is rejected
(`ForbiddenException` / org-scoped no-op); cleanup no longer touches Org A scans.

**Token/header authority** — `X-Org-Id` header forgery cannot re-scope a request;
JWT-claim org vs membership authority is honored (membership is authoritative).

**AI router per-org state** — Org A sets `cost-first`; Org B's strategy and
stats are unaffected (and vice-versa), so strategy/usage cannot cross tenants.

**RBAC + org-switch context** — a `Viewer` is denied `ORGANIZATION_SETTINGS`;
switching org context scopes subsequent requests to the new org.

### Results

- New suite: **20/20 pass** (run from `apps/api-gateway` against the hermetic
  test DB).
- Full api-gateway suite: **54 suites / 943 tests pass** (was 53/923; +20
  isolation tests).
- Worker suite: **8 suites / 80 tests pass** (was 8/79; +1
  "rejects a backup run that does not belong to the org").
- `pnpm lint` (= `tsc --noEmit`) and `pnpm build`: pass.
- `scripts/ci-v1-gate.sh`: **19/19 PASS** (first run 18/19 was the known-flaky
  `troubleshooting.controller.spec.ts` "Provider timeout" mock; re-run green).
- Secret scan clean. No web/agent code touched.

## 5. Security Boundary Check (Phase 5)

Re-reviewed every mutation found in the SUB-02 audit for org-bound writes:

| Path / processor | Before | After | Verdict |
|------------------|--------|-------|---------|
| `backups.updateJob` / `deleteJob` | find-then-unscoped-write (TOCTOU) | `updateMany`/`deleteMany` `{ id, orgId }` | ✅ FIXED |
| `remote-support.updateRecording` | unscoped `update` | `updateMany` `{ id, orgId }` | ✅ FIXED |
| `remote-support.cleanupStaleSessions` | all-orgs | org-scoped (`orgId?` optional for internal use) | ✅ FIXED |
| `network.updateDiscoveryStatus` | unscoped `update` | `updateMany` `{ id, orgId }` | ✅ FIXED |
| `network.cleanupStaleScans` | all-orgs | org-scoped | ✅ FIXED |
| AI router strategy/stats | global instance state | per-org maps | ✅ FIXED |
| worker backup verify/execute/restore | unscoped `findUnique`/`update` | org-scoped `findFirst`/`update` | ✅ FIXED |
| worker KB embedding | unscoped article lookup | org-scoped lookup | ✅ FIXED |
| worker security scan/finding | trusted payload `deviceId` | `deviceId` from verified row | ✅ FIXED |
| `admin.service.ts` role change | Owner self-demotion / other-Owner demotion | already prevented | ✅ safe (no change) |

No new cross-org read/write path found. Worker `allOrgs` maintenance processors
(`retention`, `cleanupStaleScans`/`cleanupStaleSessions` invoked from
permissioned API routes) remain documented residual risk — queue payloads are
not cryptographically signed (architectural; deferred, not a P0 within this
substage). No blocker raised.

## 6. Residual Risk

- **RLS is inert by decision** (not "broken"): app-layer is authoritative and
  regression-tested; RLS is defense-in-depth only. If Option A is ever wanted,
  it requires the non-owner role + `FORCE` migration + isolation-suite re-run —
  see `14` D14.
- **Worker queue payload signing** — processors org-verify resource IDs, but
  an attacker who can enqueue arbitrary jobs could still target `allOrgs`
  maintenance work; mitigated by `allOrgs` being Owner/permissioned-gated.
  Deferred (architectural).
- Non-isolation findings remain open for later substages: S3 plaintext
  device-token fallback (`SUB-03`), S4 register-public, S5 metrics token auth.

## 7. Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/backups/backups.service.ts` | atomic org-scoped update/delete; strip body `orgId`/`deviceId` |
| `apps/api-gateway/src/remote-support/remote-support.service.ts` | org-scoped `updateRecording` + `cleanupStaleSessions` |
| `apps/api-gateway/src/remote-support/remote-support.controller.ts` | passes `req.user.orgId` to cleanup |
| `apps/api-gateway/src/network/network.service.ts` | org-scoped `updateDiscoveryStatus`/`cleanupStaleScans` |
| `apps/api-gateway/src/network/network.controller.ts` | threads `device.orgId` through all call sites |
| `apps/api-gateway/src/ai/router/ai-router.service.ts` | per-org strategy/stats/round-robin |
| `apps/api-gateway/src/ai/controllers/ai-router.controller.ts` | strategy/stats from `req.user.orgId` |
| `apps/api-gateway/src/ai/ai-orchestrator.service.ts` | passes `orgId` to `complete`/`embed` |
| `apps/worker/src/processors.ts` | org re-verification for backup verify/restore/execute + KB; security `deviceId` from verified row |
| `apps/worker/src/__tests__/processors.spec.ts` | updated mocks + "run not in org" test |
| `apps/api-gateway/test/cross-tenant-isolation.spec.ts` | **new** 20-test adversarial isolation suite |
| `docs/tech-lead/00_CURRENT_STATE.md` | S2/R0 status + test counts updated |
| `docs/tech-lead/01_PRODUCT_ARCHITECTURE.md` | tenancy row updated |
| `docs/tech-lead/07_SECURITY_TENANCY_REVIEW.md` | S2 closed, §3-4 updated |
| `docs/tech-lead/08_FEATURE_READINESS_MATRIX.md` | RLS row → INERT/app-layer |
| `docs/tech-lead/12_MASTER_ROADMAP.md` | Stage-01 scope/acceptance/SUB-02 completed |
| `docs/tech-lead/14_DECISION_LOG.md` | D14-D15 added |

## 8. Rollback Notes

- Code + tests only, `MIGRATION: NONE`; no data change. `git revert` restores
  the pre-change code and its (non-org-scoped) behavior — do not re-merge
  without the isolation suite.
- Do **not** later "fix" RLS by adding `FORCE`/`set_config` without the
  non-owner role and an isolation-suite re-run; with the current SUPERUSER+
  BYPASSRLS role it would be a no-op that still passes (as proven in §1).

## 9. Next Recommended Substage

**V1-STAGE-01-SUB-03 — plaintext `Device.deviceToken` fallback removal (S3).**
Remove the equality fallback in `device-token.guard.ts:38-47` /
`devices.service.ts:249-260` after confirming all devices carry
`deviceTokenHash` (backfill at rotation), add rotation-sweep regression tests.
See `12` V1-STAGE-01.

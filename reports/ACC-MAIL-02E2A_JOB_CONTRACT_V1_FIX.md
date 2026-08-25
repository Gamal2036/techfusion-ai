# ACC-MAIL-02E2A Job Contract V1 Fix

## Mission

Repair transactional-email BullMQ job contract version mismatch.

## Root Cause

The `QueueService.addTransactionalEmail()` producer in `apps/api-gateway/src/queue/queue.service.ts` never included a `version` field in the job payload. The Worker's `mail-processor.ts` validated `data.version !== 1` and rejected the job with `Unsupported job version: undefined` before SMTP delivery could occur.

**Evidence chain:**
1. Worker `mail-processor.ts:10` defined `TransactionalEmailJobData` with `version: number` (required).
2. Worker `mail-processor.ts:49` checked `data.version !== 1` and threw on `undefined`.
3. API Gateway `queue.service.ts:250-281` `addTransactionalEmail()` parameter type did not include `version`.
4. API Gateway `queue.service.ts:258` built `jobData` from `...data` (no version) plus `_correlation`.
5. Password-reset service `password-reset.service.ts:113` called `addTransactionalEmail()` without `version`.
6. The `TransactionalEmailJob` type in `mail.types.ts:43` declared `version: 1` but was never enforced by the producer.

**Result:** Every transactional email job arrived at the Worker with `version: undefined`, causing immediate rejection on line 49. After 5 retries, the job failed permanently.

## Supported Contract Version

**V1** — `TRANSACTIONAL_EMAIL_CONTRACT_VERSION = 1` (defined in `packages/types/transactional-email-job.ts`).

## Legacy Job Handling Decision

**Decision A: Reject legacy unversioned jobs.**

Rationale: No evidence of production queue backlog requiring backward compatibility. The queue has 5 retry attempts with exponential backoff; all legacy unversioned jobs will fail permanently and be cleaned by `removeOnFail: { count: 100 }`. Rejecting with a controlled error (`Unsupported job version: undefined`) is safer than silently accepting potentially malformed payloads.

## Producer/Consumer Mismatch

| Side | Before | After |
|------|--------|-------|
| Producer (`QueueService.addTransactionalEmail`) | No `version` in parameter type or payload | `version: 1` required in parameter type; `TRANSACTIONAL_EMAIL_CONTRACT_VERSION` embedded in payload |
| Consumer (`mail-processor.ts`) | Local `TransactionalEmailJobData` interface with `version: number` | Imports `TransactionalEmailJobWithCorrelation` from `@techfusion/types` |
| Shared contract | None — duplicated incompatible interfaces | `packages/types/transactional-email-job.ts` — single source of truth |

## Files Changed

### New files
- `packages/types/transactional-email-job.ts` — Shared V1 contract: `TRANSACTIONAL_EMAIL_CONTRACT_VERSION`, `TransactionalEmailJob`, `TransactionalEmailJobWithCorrelation`, `isValidContractVersion()`
- `apps/worker/src/__tests__/transactional-email-contract.spec.ts` — 23 regression tests
- `apps/api-gateway/src/mail/__tests__/transactional-email-contract.spec.ts` — 14 regression tests

### Modified files
- `packages/types/index.ts` — Re-exports contract types and constants
- `apps/api-gateway/package.json` — Added `@techfusion/types: workspace:*`
- `apps/worker/package.json` — Added `@techfusion/types: workspace:*`
- `apps/api-gateway/src/queue/queue.service.ts` — Imports `TRANSACTIONAL_EMAIL_CONTRACT_VERSION`; adds `version: 1` to `IQueueService.addTransactionalEmail` interface and implementation
- `apps/api-gateway/src/queue/queue.service.mock.ts` — Adds `version: 1` to `MockQueueService.addTransactionalEmail` parameter
- `apps/api-gateway/src/auth/password-reset.service.ts` — Imports `TRANSACTIONAL_EMAIL_CONTRACT_VERSION`; passes `version` in `addTransactionalEmail()` call
- `apps/api-gateway/src/mail/contracts/mail.types.ts` — `TransactionalEmailJob` now re-exports from `@techfusion/types` instead of local definition
- `apps/worker/src/mail/mail-processor.ts` — Imports `TransactionalEmailJobWithCorrelation` and `TRANSACTIONAL_EMAIL_CONTRACT_VERSION` from `@techfusion/types`; removes local interface; validates against shared constant

### Not changed
- No frontend changes
- No database schema changes
- No migrations
- No Redis infrastructure changes
- No Railway changes
- No Brevo configuration changes
- No `.env` edits
- No production deployment
- No secrets in logs, tests, fixtures, reports, or commits

## Test Evidence

### Focused contract tests
- **Worker contract tests:** 23/23 passed
- **API Gateway contract tests:** 14/14 passed
- **Total contract regression tests:** 37/37 passed

### Full test suites
- **Worker full suite:** 131/131 passed (10 test suites)
- **API Gateway mail tests:** 62/62 passed (2 test suites)
- **API Gateway queue tests:** 4/4 passed
- **API Gateway auth tests:** passed

### Lint / Typecheck / Builds
- `@techfusion/types` lint: passed
- `@techfusion/worker` lint: passed
- `@techfusion/api-gateway` lint: passed
- `@techfusion/types` build: passed
- `@techfusion/worker` build: passed
- `@techfusion/api-gateway` build: passed
- `git diff --check`: clean (no whitespace errors)
- Secret scan: no secrets found in changed files

## Operational Cleanup Instructions

After deployment, legacy unversioned jobs already in the Redis `transactional-email` queue will fail permanently with `Unsupported job version: undefined`. These will be auto-cleaned by BullMQ's `removeOnFail: { count: 100 }` configuration. No manual Redis intervention is required.

If manual cleanup is desired:
```bash
# List failed transactional-email jobs
redis-cli LRANGE "bull:transactional-email:failed" 0 -1

# Or use BullMQ's dashboard if available
```

## Remaining Risks

1. **Legacy jobs in Redis:** Any unversioned jobs already queued before deployment will fail permanently. This is by design (Decision A). The queue will self-clean via `removeOnFail`.

2. **No shared queue constants:** `QUEUE_NAMES` and `JOB_NAMES` are duplicated between `apps/api-gateway/src/queue/queue.constants.ts` and `apps/worker/src/queue-names.ts`. This is pre-existing technical debt (not introduced by this fix).

3. **Template duplication:** Mail templates are duplicated between api-gateway and worker. Pre-existing debt.

4. **Future contract versions:** When V2 is needed, add a new constant (`TRANSACTIONAL_EMAIL_CONTRACT_VERSION_V2 = 2`), a new job interface (`TransactionalEmailJobV2`), update `isValidContractVersion()` to accept both, and add worker routing by version.

## Local Integration Certification

To run a real local Brevo test after deployment:

1. Ensure `MAIL_ENABLED=true` and `MAIL_TRANSPORT=smtp` in your `.env`
2. Ensure SMTP credentials (Brevo) are configured
3. Start Redis locally
4. Start the API Gateway and Worker
5. `curl -X POST http://localhost:3000/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"your-verified-email@example.com"}'`
6. Check Worker logs for `Transactional email sent successfully`
7. Check your Brevo inbox for the password-reset email

No credentials are read, logged, or modified during this test.

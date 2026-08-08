# V1-STAGE-01A-R1 — Billing Regression Cleanup

Status: V1-STAGE-01A-R1 COMPLETE — BILLING REGRESSION CLOSED
Date: 2026-08-08
Mode: Audit → Minimal Fix → Targeted Test → Full Regression → Certify
Priority: P0 — CI / Regression Cleanup

---

## 1. Executive Summary

V1-STAGE-01A's full api-gateway regression left exactly two failing tests, both in
`src/billing/billing.integration.spec.ts`. An audit proved the application billing logic is
correct and the failures were a **test fixture / test-env drift defect**: the webhook mocks hard-coded
Stripe price IDs (`price_pro`, `price_business`) while production resolves its plan mapping from the
configured environment (`STRIPE_PRO_PRICE_ID=price_test_pro`, `STRIPE_BUSINESS_PRICE_ID=price_test_business`
in `.env.test`). The stale fixture IDs matched nothing, so `mapStripePriceToPlan` fell through to
`Free`.

Fix was minimal and test-only: the mock webhook price IDs now derive from the **same config source
production compares against** (`PLAN_CONFIGS[PlanTier.Pro|Business].stripePriceId`), eliminating the
duplicated hard-coded values so they cannot drift again. No production code changed, no assertion was
weakened, no migration was introduced.

Result: **879/879 full api-gateway tests PASS**, **27/27 lifecycle integrity PASS**, typecheck PASS,
build PASS.

## 2. Reproduced Failures

Command (env from `.env.test`):

```bash
cd apps/api-gateway
set -a; source .env.test; set +a
npx jest src/billing/billing.integration.spec.ts --forceExit --runInBand
```

Result before fix — **21 tests: 19 passed / 2 failed**:

| Test | Assertion | Received | Status |
|---|---|---|---|
| `handleStripeWebhook › processes checkout.session.completed event` | `organization.update` with `plan: 'Pro'` | `plan: 'Free'` | FAIL |
| `handleStripeWebhook › processes customer.subscription.updated event` | `organization.update` with `plan: 'Business'` | `plan: 'Free'` | FAIL |

Exact assertion output: `Expected ... {"data": ... {"plan": "Pro"}} ... Received: {"data": {"plan": "Free", ...}}`.
Both failures reproduce in isolation and are fully deterministic — they depend only on module-load-time
env resolution and the mocked webhook payload.

## 3. Root Cause

Mapping contract (single source of truth):

- `PLAN_CONFIGS[Pro].stripePriceId = process.env.STRIPE_PRO_PRICE_ID || 'price_pro'` (`src/billing/plan-features.ts:82`)
- `PLAN_CONFIGS[Business].stripePriceId = process.env.STRIPE_BUSINESS_PRICE_ID || 'price_business'` (`src/billing/plan-features.ts:103`)
- `PLAN_CONFIGS[Enterprise].stripePriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise'` (`src/billing/plan-features.ts:124`)
- `mapStripePriceToPlan(priceId)` iterates `PLAN_CONFIGS`, matches `config.stripePriceId === priceId`, else returns `PlanTier.Free` (`src/billing/billing.service.ts:420-425`)

Test environment (`.env.test`):

- `STRIPE_PRO_PRICE_ID=price_test_pro`
- `STRIPE_BUSINESS_PRICE_ID=price_test_business`
- `STRIPE_ENTERPRISE_PRICE_ID=price_test_enterprise`

Under the test env, module-load evaluation makes the production mapping targets `price_test_pro` /
`price_test_business`. The mocked webhook payloads sent `price_pro` / `price_business`, which match
nothing and therefore resolved to `plan: Free`.

**Verdict: A — application logic is correct, mocks are stale.** The env price IDs were renamed to
`price_test_*` (test) without updating the fixture webhook payloads, and the two hard-coded fixture
values drifted from the config source. Production's "compare against configured Stripe price IDs,
unknown → Free" behavior is the intended design.

## 4. Production Logic Assessment

- `mapStripePriceToPlan` — **correct, UNCHANGED**. It compares webhook price IDs against the configured
  env-driven `PLAN_CONFIGS` and defaults unknown IDs to `Free` (safe behavior).
- `handleCheckoutCompleted` / `handleSubscriptionUpdated` — **correct, UNCHANGED**. Both derive the plan
  via `mapStripePriceToPlan` and persist it to the subscription and organization.
- `PLAN_CONFIGS` fallback defaults (`'price_pro'` etc. when env vars are absent) — **correct, UNCHANGED**.
  Production should continue comparing against configured Stripe price IDs; no fallback mapping such as
  `price_pro OR price_test_pro` was added.

## 5. Minimal Fix

Single test fixture file changed: `apps/api-gateway/src/billing/billing.integration.spec.ts`.

The two webhook price IDs (plus the `beforeEach` default `subscriptions.retrieve` mock) were changed
from hard-coded literals to values derived from the same config source production compares against:

```ts
import { PLAN_CONFIGS, PlanTier } from './plan-features';

const PRO_PRICE_ID = PLAN_CONFIGS[PlanTier.Pro].stripePriceId;
const BUSINESS_PRICE_ID = PLAN_CONFIGS[PlanTier.Business].stripePriceId;
```

`PLAN_CONFIGS[PlanTier.Pro].stripePriceId` is the exact value `mapStripePriceToPlan` matches against,
so the mocked `checkout.session.completed` (Pro) and `customer.subscription.updated` (Business) payloads
now resolve to the asserted tiers regardless of which price IDs the environment configures
(`price_test_*` in tests, `price_*` in dev fallback, or any future rename). No duplicated hard-coded
values remain that can drift again.

No assertions were changed or weakened. The `plan: 'Pro'` / `plan: 'Business'` assertions are exactly
as before.

## 6. Test Fixture/Environment Contract

| Plan | Env var | `.env.test` value | Fixture source | Production match target |
|---|---|---|---|---|
| Pro | `STRIPE_PRO_PRICE_ID` | `price_test_pro` | `PLAN_CONFIGS[PlanTier.Pro].stripePriceId` | same `PLAN_CONFIGS` entry |
| Business | `STRIPE_BUSINESS_PRICE_ID` | `price_test_business` | `PLAN_CONFIGS[PlanTier.Business].stripePriceId` | same `PLAN_CONFIGS` entry |
| Enterprise | `STRIPE_ENTERPRISE_PRICE_ID` | `price_test_enterprise` | (no webhook fixture) | `PLAN_CONFIGS[PlanTier.Enterprise].stripePriceId` |

Because the fixtures read the same `PLAN_CONFIGS` table that `mapStripePriceToPlan` iterates, the
test can never drift from the environment again: any change to `STRIPE_*_PRICE_ID` is automatically
reflected on both sides of the assertion. Unknown-price handling is unchanged: `mapStripePriceToPlan`
returns `PlanTier.Free` for any unmatched ID (existing safe/default behavior, asserted via the
`customer.subscription.deleted` reset-to-Free path and untouched by this fix).

## 7. Billing Targeted Test Results

```bash
cd apps/api-gateway
set -a; source .env.test; set +a
npx jest src/billing/ --forceExit --runInBand
```

**3 suites / 55 tests — all PASS.**

- `src/billing/billing.integration.spec.ts` — **21/21 PASS** (was 19/21)
- `src/billing/plan-features.spec.ts` — PASS
- `src/billing/plan-guard.spec.ts` — PASS

## 8. Full API Regression

```bash
cd apps/api-gateway
set -a; source .env.test; set +a
npx jest --forceExit --runInBand
```

**49 suites / 879 tests — all PASS (879/879).**

Baseline before R1: 877 passed / 2 failed = 879 total. Required result achieved with **ZERO new
failures** and no change in test count (the two previously-failing tests now pass).

## 9. V1-STAGE-01A Regression

```bash
npx jest test/lifecycle-data-integrity.spec.ts --forceExit --runInBand
```

**27/27 PASS.** The enrollment-token TOCTOU fix remains intact; no assertion in that suite was modified.

## 10. Typecheck

```bash
cd apps/api-gateway && npx tsc --noEmit
```

**PASS** (clean).

## 11. Build

```bash
cd apps/api-gateway && npm run build   # tsc
```

**PASS** (clean). Repository standard: `npm run build` in `apps/api-gateway` (build = `tsc`).

## 12. Files Changed

Only **one** file was modified by R1:

| File | Change |
|---|---|
| `apps/api-gateway/src/billing/billing.integration.spec.ts` | Fixture-only fix — mock webhook price IDs derived from `PLAN_CONFIGS` instead of hard-coded `price_pro`/`price_business` (+4 import/const lines, 3 literal replacements) |

No production files, no test-env files, no docs beyond this report, and no unrelated working-tree state
was touched. All other `git status` entries are pre-existing beta.4-era working-tree state (present
before R1 began).

## 13. Migrations

**NONE.** No schema change, no migration added or removed.

## 14. Remaining CI Issues

- **Billing (2 failures)**: PRE-EXISTING TEST ENV/FIXTURE DRIFT → **FIXED** by R1. The full local
  regression that previously failed these two tests now passes 879/879.
- **Linux bootstrap / Agent CI (beta.4 push)**: unrelated to Billing. These concern the Rust agent
  build/publish pipeline (`release-agent.yml` etc.), are not caused by this billing fixture change, and
  were intentionally NOT modified per the R1 scope boundary. They remain open as separate work.

## 15. Final Verdict

| Gate | Result |
|---|---|
| Billing root cause proven | PASS (test fixture/env drift; production logic correct) |
| Production billing logic unchanged | PASS |
| No assertion weakening | PASS |
| Billing integration suite | 21/21 PASS |
| Full API suite | 879/879 PASS |
| Lifecycle integrity | 27/27 PASS |
| TypeScript | PASS |
| Build | PASS |
| No migration | PASS |
| No unrelated files modified | PASS |

**V1-STAGE-01A-R1 COMPLETE — BILLING REGRESSION CLOSED.**

# 09 — Commercial Entitlements Architecture

Design recommendation. No final prices are hard-coded here; the previous internal "GM1" name is explicitly **not** the commercial name — the highest tier is `PREMIUM_TIER_PLACEHOLDER` pending founder naming.

## 1. Current State (evidence-based)

- Plan model exists: `PlanTier { Free, Pro, Business, Enterprise }` + `PLAN_CONFIGS` in `src/billing/plan-features.ts` with `limits { maxDevices, maxReportsPerMonth, maxAiQueriesPerMonth, maxTeamMembers, maxAlertRules }` and `features { analyticsExport, customBranding, remoteSupport, sso, apiAccess, prioritySupport }`. Stripe price IDs mapped via `mapStripePriceToPlan` (env-driven, fallback constants).
- Dual storage: `Organization.plan` (denormalized) + `Subscription` (Stripe canonical). `V1-STAGE-01A` lifecycle integrity work keeps them consistent.
- **Server-side enforced today**: `maxDevices` (`devices.service.ts`), `maxReportsPerMonth` (`reporting.service.ts:71`), `maxAiQueriesPerMonth` (`ai-orchestrator.service.ts:186`), feature gates via `PlanGuard`+`RequireFeature` (`sso`, `customBranding`, `remoteSupport` on admin/branding/billing paths), graceful downgrade (excess devices → inactive, oldest first).
- **NOT enforced**: `maxTeamMembers` (invitations create freely) and `maxAlertRules` (rules create freely). Grep shows zero call sites outside `plan-features.ts`.
- No `Plan`/`Subscription`/`Entitlement`/`Limit` tables as separate entities — it's a code-level config + two DB fields.

## 2. Recommended Tier Architecture

Three commercial tiers (rename `PREMIUM_TIER_PLACEHOLDER` later):

```
Plan (code config: PLAN_CONFIGS)          — tier, label, price, stripePriceId
  → Subscription (DB, Stripe canonical)   — status, periods, cancelAtPeriodEnd
  → Entitlements (derived: features)      — boolean capability flags
  → Limits (derived: numeric quotas)      — enforced SERVER-SIDE at write time
  → Usage counters (derived/measured)     — devices, reports/mo, AI/mo, members, rules
  → Server authorization                  — PlanGuard/RequireFeature at route level
  → UI capability state                   — lib/permissions.ts-style flags only (display)
```

Rules:
- **Entitlement source of truth = `Subscription.plan`** (Stripe) → resolved to `PLAN_CONFIGS` via `mapStripePriceToPlan`; `Organization.plan` is a denormalized cache kept consistent by webhook handling.
- **UI hiding is never an authorization boundary.** All limits enforced in the API layer (device registration, invitation create, alert-rule create, report generate, AI complete).
- A single `UsageService` (`getUsage(orgId)`, `assertLimit(orgId, limitKey)`) centralizes quota checks; today these are scattered (devices.service, reporting.service, ai-orchestrator) — consolidate for consistent error types (`entitlement.limit_reached`).

## 3. Tier Mapping (capability → tier, aligned with existing PLAN_CONFIGS)

| Capability | FREE | PRO | PREMIUM_TIER_PLACEHOLDER |
|-----------|:----:|:---:|:--:|
| Devices (limit) | small (e.g. 3) | mid (e.g. 25) | high/large |
| Team members (limit) | 1 | mid (e.g. 5) | large |
| Organizations | 1 | 1 | 1 (multi-org later = P2) |
| Alert rules (limit) | small (e.g. 5) | mid (e.g. 20) | large |
| Monitoring retention | default (90 d) | default | extended |
| Remote support | ❌ | ✅ | ✅ |
| Network discovery/diagnostics | ❌ | ✅ | ✅ |
| Security scans | ✅ (basic) | ✅ (full) | ✅ (full) |
| Software/driver inventory | ❌ | ✅ | ✅ |
| Reports | small quota | quota + custom branding | quota + branding + advanced |
| Audit retention | short | default | extended |
| AI (troubleshoot/chat quota) | small quota | mid quota | high quota |
| KB | ✅ | ✅ | ✅ |
| SSO | ❌ | ❌ | ✅ |
| Analytics export | ❌ | ✅ | ✅ |
| API access | ❌ | ✅ | ✅ |
| Support level | community | priority | priority/dedicated |

Notes: mappings are **recommendations**; the existing `PLAN_CONFIGS` already encodes most of this and should be re-tuned only with founder sign-off. Free tier currently ships `remoteSupport:false` and `network`/`inventory`/`security` are *not* feature-gated — decide explicitly whether Free includes them (see Decisions, `14`).

## 4. Missing Pieces To Build (for V1 billing correctness)

1. Enforce `maxTeamMembers` on invitation create + member add.
2. Enforce `maxAlertRules` on alert-rule create.
3. Consolidate quota checks into `UsageService` + `assertLimit` (consistent 402/403 error contract).
4. Server-side usage counters for retention-based limits (monitoring/audit retention) — currently only data-retention policies exist, not plan-tiered retention enforcement.
5. Plan-change UX: self-serve upgrade in `/dashboard/billing` (today Stripe-hosted checkout/portal) + entitlement refresh on subscription.updated.
6. Test suite for every limit + downgrade path (`billing.integration` exists; extend for members/rules).
7. Decide Free-tier feature surface (see `14`).

## 5. Not-In-Scope (this mission)

Prices are explicitly not finalized; the tier is named `PREMIUM_TIER_PLACEHOLDER` pending commercial naming. No entitlement code changes were made.

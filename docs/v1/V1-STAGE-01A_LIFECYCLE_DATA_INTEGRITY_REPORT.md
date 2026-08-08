# V1-STAGE-01A — Lifecycle Data Integrity (Enrollment TOCTOU Fix + Certification)

Status: V1-STAGE-01A COMPLETE — LIFECYCLE DATA INTEGRITY CERTIFIED; ONE TOCTOU DEFECT FIXED
Date: 2026-08-08
Mode: Audit-first certification of account/organization/device/enrollment-token lifecycle data
integrity on top of the ORG-01A1/A2/A3 + ORG-01B/01C + V1-STAGE-00A foundation. One proven defect
(enrollment-token consume TOCTOU race) fixed with a single atomic conditional UPDATE. No migration,
no schema change, no global cascade, no destructive DB reset, no commits or pushes.

---

## 1. Certification Summary

| Area | Verdict |
|---|---|
| Account deletion vs organization deletion distinctness | CERTIFIED |
| Owner-invariant (no active org ever reaches owners = 0) | CERTIFIED |
| Device ownership authoritative model (`Device.orgId`) | CERTIFIED |
| Enrollment-token lifecycle (single-use, expiry, revocation) | DEFECT FIXED (TOCTOU) + CERTIFIED |
| Tenant isolation (token/JWT/org-header scoping) | CERTIFIED |
| Orphan data (FK-protected relations) | 0 orphans across every FK relation in dev DB |
| Full api-gateway regression | 877 passed / 2 failed (both UNRELATED PRE-EXISTING billing mock mismatch) |
| Typecheck + build | Clean |

**Rules honoured**: all audits completed clean before any code change; the single code change is the
proven integrity defect; account deletion never destroys org/device data the user touched;
`reset-identity` stays local-only (server record preserved, goes OFFLINE via presence sweep).

## 2. Scope & Constraints

- Fixed: `EnrollmentService.validateToken` TOCTOU (read-then-increment → atomic conditional UPDATE).
- Added: 27-test integration suite `apps/api-gateway/test/lifecycle-data-integrity.spec.ts`.
- Explicitly NOT changed: account-deletion policy, org-deletion policy, ownership-transfer, billing,
  invitations, auth, devices, agents, schema, migrations. No wipe of dev/test DBs.

## 3. New Test Suite — `test/lifecycle-data-integrity.spec.ts`

27 tests, all passing. Groups:

| Group | Tests | Asserted invariant |
|---|---|---|
| A. Account deletion | A1-A4 | deleting a user deletes only the account + provably-empty personal orgs; orgs/devices/other members always survive; stored refresh sessions revoked; sole-Owner of a surviving org blocks with `SOLE_OWNER` 409 |
| O. Org deletion policy | O1-O3 | no standalone org-delete endpoint (404); empty org removed only under the account-deletion policy; shared non-empty org survives a member's deletion |
| ORG. Ownership/membership | ORG1a-3b | sole Owner cannot be downgraded (409); cannot leave last org (409); removing a member revokes access immediately (membership is authority); invitation to a deleted-account email → `REVOKED`; invitation created by a deleted user → preserved (`PENDING`) |
| D. Device & token lifecycle | D1-D6 | org comes from the token, never the client; duplicate identity → same device + rotated credential; only SHA-256 hash persisted (raw token never stored); single-use token non-reusable; no server reset-identity endpoint (404); credential recovery requires org token + matching identity |
| T. Tenant isolation | T1,T2,T3,T5 | tampered JWT claims rejected; orgA token cannot enroll orgB; mismatched `x-org-id` rejected (403); org switch re-mints tokens bound to the new org |
| X. Cross-cutting | X1,X2,X3,X3b,X5 | concurrent single-use consume admits exactly one consumer (201 + 403, `useCount=1`, one device); org-scoped token keeps an otherwise-empty org from silent deletion; deletion preview toggles with lifecycle state; audit rows (`enrollment_token_used`, `account_deleted`) present |

### 3.1 Concurrency proof (X1)

Two `register-public` requests race on the same single-use token via `Promise.all`. Result is
deterministic: exactly one `201`, exactly one `403 "Enrollment token has been fully used"`,
`useCount=1`, exactly one device created. Before the fix this test failed (both requests could pass
the `useCount < maxUses` read and both `update`; the losing write silently increments past `maxUses`
with no rejection — a consume over-sell).

## 4. Orphan Audit (executed against dev DB)

Read-only audit against `postgresql://techfusion:techfusion@localhost:5433/techfusion`
(`apps/api-gateway/.env` line 1).

### 4.1 FK-protected relations — all 0 orphans

| Relation | Orphans |
|---|---|
| `OrganizationMember` → User / Organization | 0 / 0 |
| `Device` → Organization | 0 |
| `EnrollmentToken` → Organization | 0 |
| `OrganizationInvitation` → Organization | 0 |
| `RefreshToken` → User | 0 |
| `DeviceMetric` → Device / Organization | 0 / 0 |
| `Subscription` → Organization | 0 |
| `Invoice` → Subscription | 0 |
| `Alert` → Device / AlertRule | 0 / 0 |
| `DeviceHealthScore` → Device | 0 |
| `SecurityScan` → Organization | 0 |
| `SecurityFinding` / `SecurityScore` → SecurityScan | 0 / 0 |
| `AiConversation` / `AiMessage` → Organization / AiConversation | 0 / 0 |
| `CredentialRotationEvent` → Organization | 0 |
| `BackupRun` → Job | 0 |
| `KbEmbedding` → KbEntry | 0 |

### 4.2 Non-FK dangling references — benign by design

| Column (no FK) | Value | Interpretation |
|---|---|---|
| `AuditLog.actorId` | `1` | the `account_deleted` event of a since-removed account — actor ids are preserved intentionally (compliance), never cascade-deleted |
| `SecurityScan.triggeredBy` | `6` | literal source labels (`agent` ×5, `user` ×1), not user ids |

No cleanup required; no orphan scans scheduled. Row counts for users/orgs/devices/enrollment
tokens/invitations/memberships were truncated by output limits and are not relied on for the
verdict.

## 5. Deletion-Policy Matrix (why each relation behaves as it does)

| Relation | Policy | Why |
|---|---|---|
| `User` ← `OrganizationMember` | CASCADE | membership dies with the account |
| `User` ← `RefreshToken` | CASCADE | sessions die with the account |
| `User` ← `OrganizationMember`-only orgs | APPLICATION-MANAGED | only provably-empty, solely-owned orgs are removed; verified at runtime + RESTRICT backup |
| `Organization` ← `Device`/`DeviceMetric`/`Alert`/`Ai*`/`Security*`/`Network*`/`DriverRecord`/`InstalledSoftware`/`Backup`/`Report*`/`RemoteSession`/`SsoConfiguration`/`RetentionPolicy`/`KnowledgeBaseEntry`/`EnrollmentToken`/`CredentialRotationLog` | RESTRICT (survive) | org data outlives any one member; deletion requires provable emptiness |
| `User` ← `Organization` (`User.orgId` active-org pointer) | RESTRICT | an org referenced as a user's active org cannot be deleted |
| `Organization` ← `AuditLog` | PRESERVE (plain `organizationId` column, no FK) | compliance history must never cascade-delete |
| `OrganizationInvitation` → invitee | APPLICATION-MANAGED | addressed-to-deleted-account invitations are `REVOKED`; created-by-deleted-user invitations are preserved (no FK, bound to invitee email) |
| `EnrollmentToken.createdByUserId` | PRESERVE (plain column, no FK) | token survives its creator |
| `Subscription`/`Invoice` | RESTRICT (survive) | billing state outlives a member; org deletion only when empty |

## 6. The Defect: Enrollment-Token Consume TOCTOU

**File**: `apps/api-gateway/src/enrollment/enrollment.service.ts` (only code file changed).

### 6.1 Before (defective)

```ts
const record = await this.prisma.enrollmentToken.findUnique({ where: { tokenHash } });
// ...checks: revokedAt, expiresAt, useCount >= maxUses -> throw...
await this.prisma.enrollmentToken.update({
  where: { id: record.id },
  data: { useCount: { increment: 1 } },
});
```

Read-then-write: two concurrent consumers both pass the `useCount < maxUses` check on the same
snapshot, then both increment. A single-use token admits two devices; a maxUses=1 token ends at
`useCount=2` with neither request rejected.

### 6.2 After (fixed)

The lifecycle guards are re-asserted inside the increment itself — one atomic conditional UPDATE:

```ts
const consumed = await this.prisma.enrollmentToken.updateMany({
  where: {
    tokenHash,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    useCount: { lt: record.maxUses },
  },
  data: { useCount: { increment: 1 } },
});
if (consumed.count !== 1) {
  const current = await this.prisma.enrollmentToken.findUnique({
    where: { tokenHash },
    select: { revokedAt: true, expiresAt: true },
  });
  if (current?.revokedAt) throw new ForbiddenException('Enrollment token has been revoked');
  if (current?.expiresAt && current.expiresAt < new Date())
    throw new ForbiddenException('Enrollment token has expired');
  throw new ForbiddenException('Enrollment token has been fully used');
}
```

`count === 1` ⇔ this transaction won the row lock and is the unique legitimate consumer; the loser
matches zero rows and is rejected with a precise error. Pre-check errors are preserved for the
normal path (revoked/expired/fully-used still reported correctly on the first, non-racing request).

## 7. Full Regression

`npx jest --forceExit --runInBand` in `apps/api-gateway` (env from `.env.test`):

**877 passed, 2 failed (49 suites: 48 pass / 1 fail)**.

The only failing suite is `src/billing/billing.integration.spec.ts`, classified **UNRELATED
PRE-EXISTING FAILURE**:

| Test | Assertion | Received | Root cause |
|---|---|---|---|
| `processes checkout.session.completed event` | `organization.update` with `plan: 'Pro'` | `plan: 'Free'` | mock uses `price_pro`/`price_business`; `mapStripePriceToPlan` compares against env `STRIPE_PRO_PRICE_ID=price_test_pro` / `STRIPE_BUSINESS_PRICE_ID=price_test_business` |
| `processes customer.subscription.updated event` | `plan: 'Business'` | `plan: 'Free'` | same price-id mismatch |

`billing.service.ts` and `billing.integration.spec.ts` are **unmodified** in the working tree
(`git status`), and the failure reproduces in isolation without any of this stage's changes — the
two test price ids were not updated when the env price ids were renamed. No test was weakened to
mask it; it is reported for a separate owner.

## 8. Environment / Test Commands

Test DB: `postgresql://techfusion_test:test_password_123@localhost:5434/techfusion_test`
Redis: `redis://localhost:6381`. Prisma migrations applied by jest globalSetup (`test/setup.ts`).

```bash
cd apps/api-gateway
export DATABASE_URL="postgresql://techfusion_test:test_password_123@localhost:5434/techfusion_test"
export DATABASE_URL_TEST="$DATABASE_URL" REDIS_URL="redis://localhost:6381" NODE_ENV=test
export JWT_SECRET="test-jwt-secret-00000000000000000000000000000000000000000000000000000000"
export JWT_REFRESH_SECRET="test-refresh-secret-0000000000000000000000000000000000000000000000"
export AI_ENCRYPTION_KEY="test-encryption-key-0000000000000000000000000000000000000000000000"
export REPORT_URL_SECRET="test-report-secret-0000000000000000000000000000000000000000000000"
export PORT=3001 ALLOWED_ORIGINS="http://localhost:3000"
export WS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
export STRIPE_SECRET_KEY="sk_test_placeholder" STRIPE_WEBHOOK_SECRET="whsec_placeholder"
export STRIPE_PRO_PRICE_ID="price_test_pro" STRIPE_BUSINESS_PRICE_ID="price_test_business"
export STRIPE_ENTERPRISE_PRICE_ID="price_test_enterprise"

npx jest test/lifecycle-data-integrity.spec.ts --forceExit --runInBand   # 27/27
npx jest --forceExit --runInBand                                          # 877 pass / 2 pre-existing
npx tsc --noEmit                                                          # clean
npm run build                                                             # clean
```

## 9. Files Changed

| File | Change |
|---|---|
| `apps/api-gateway/src/enrollment/enrollment.service.ts` | THE code fix — atomic conditional `updateMany` consume in `validateToken` (+26/-2) |
| `apps/api-gateway/test/lifecycle-data-integrity.spec.ts` | NEW — 27-test V1-STAGE-01A suite |

Everything else in `git status` is pre-existing beta.4-era working-tree state (including the
pre-existing deletion of `src/common/org-context.interceptor.ts`). No commits, no pushes, no tags.

## 10. Known Follow-Ups (out of scope for this stage)

- Documented V1 behavior worth surfacing to product: creating an enrollment token (or any
  org-scoped artifact) in a provably-empty personal org writes an `enrollment_token_created` audit
  row; that audit history keeps the org out of the empty-org auto-deletion policy even after the
  token is revoked — conservative by design, requires support-assisted deletion. Pinned by test
  X3b.

---

## R1 Addendum (2026-08-08) — Billing Regression Closed

The two unrelated pre-existing Billing failures reported in §7 are now **CLOSED** by
`V1-STAGE-01A-R1` (see `docs/v1/V1-STAGE-01A-R1_BILLING_REGRESSION_CLEANUP_REPORT.md`).

- Root cause confirmed as **test fixture/env drift** (`price_pro`/`price_business` mocks vs
  `STRIPE_PRO_PRICE_ID=price_test_pro` / `STRIPE_BUSINESS_PRICE_ID=price_test_business`); production
  billing logic was correct and is unchanged.
- Fix was fixture-only in `src/billing/billing.integration.spec.ts`: webhook price IDs now derive from
  `PLAN_CONFIGS[PlanTier.Pro|Business].stripePriceId` (the same config source `mapStripePriceToPlan`
  compares against), so fixtures can no longer drift from the env.
- Certification: billing integration **21/21**; full api-gateway regression **879/879** (was
  877/2-failed); lifecycle integrity **27/27**; typecheck PASS; build PASS; no migration; no assertions
  weakened.

This stage's verdict is unaffected: the enrollment-token TOCTOU fix and all lifecycle-integrity
assertions remain intact and green.

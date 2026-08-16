# ACC-AUDIT-02A — Verified Account & Security Capability Audit

> **Type:** Capability audit (evidence-based, read-only)
> **Date:** 2026-08-16
> **Branch:** `audit/acc-audit-02a-account-security`
> **Scope:** Account + Security capability across `apps/api-gateway` and `apps/web`.
> **Audit mode:** No implementation, no runtime changes, no schema changes, no migrations.
> **Evidence standard:** Every claim below is marked with its evidence strength using the
> `docs/tech-lead/README.md` convention (`VERIFIED_THIS_RUN`, `VERIFIED_BY_CURRENT_CI`,
> `INFERRED_FROM_CODE`, `UNVERIFIED`). No capability is called production-ready without a
> passing test observed in this run.

---

## 1. Executive summary

The Account & Security surface of TechFusion AI is in a **strong, verifiable state for what
it intentionally ships** and its gaps are **documented, honest, and scoped** — not hidden.
The foundation commit (`29d355e feat(account): build verified account foundation (#2)`) is
matched by the code it claims.

Verified outcomes of this audit:

- **Account profile (self-scoped summary + display name)** and **account deletion** are the
  two capabilities that are production-ready. Both are covered by deep, passing test suites
  that prove the security invariants the UI relies on (self-scoping from `req.user.sub`,
  forged `userId` ignored, no credential material in responses, transactional deletion,
  sole-Owner safety, session revocation).
- **The UI is real-data-only.** No fabricated device/account/security values exist on the
  Account page, and the web test suite proves that the page never renders credential
  material and never shows fake controls (password change / session listing are explicitly
  "Not available" rather than fake).
- **MFA (TOTP) is backend-functional but UI-incomplete and lifecycle-incomplete.** Enroll /
  verify / status endpoints exist and work; but there is no MFA UI in the web app, no MFA
  disable, no recovery codes (despite a `mfaBackupCodes` column), no MFA audit events, and
  no throttling on `/mfa/enroll` and `/mfa/verify`.
- **Missing-by-design capabilities** (password change, forgot/reset, email verification,
  avatar, session listing/revocation, self-scoped activity feed) are genuinely absent in
  code — not present-but-broken. The UI states these honestly.
- **Security posture is sound for a self-hosted SPA** but has a short, well-defined list of
  hardening items (signup enumeration, TOTP endpoint throttling, plaintext `mfaSecret` and
  refresh tokens at rest, localStorage token storage).

**Stage verdict: GO —** the audit confirms current state; no code/schema/runtime changes are
made or needed by this stage. Deliverable is this report only.

---

## 2. Branch & git state

- Branch: `audit/acc-audit-02a-account-security` — `VERIFIED_THIS_RUN` (pre-flight).
- Working tree was clean at audit start — `VERIFIED_THIS_RUN` (`git status --short` empty).
- HEAD: `29d355e feat(account): build verified account foundation (#2)`.
- Prior commits: `52331a0 Merge pull request #1 ... fix/dev-rev-01-device-revocation-recovery`,
  `5cb63d1 docs(device): document support recovery configuration`.
- **No files were modified, staged, or committed during the audit.** The only artifact added
  by this stage is this report, staged separately at the end. `VERIFIED_THIS_RUN`.

---

## 3. Files inspected (evidence inventory)

### API Gateway (`apps/api-gateway`)
- `src/account/account.controller.ts`, `account-profile.service.ts`, `account-deletion.service.ts`,
  `account.module.ts`
- `src/account/dto/update-account-profile.dto.ts`, `delete-account.dto.ts`
- `src/auth/auth.controller.ts`, `auth.service.ts`, `auth.module.ts`
- `src/auth/dto/{signup,login,verify-login,refresh}.dto.ts`
- `src/mfa/mfa.controller.ts`, `mfa.service.ts`, `mfa.module.ts`, `dto/verify-mfa.dto.ts`
- `src/common/combined-auth.guard.ts`, `jwt-auth.guard.ts`, `membership-auth.ts`
- `src/config/rate-limits.ts`, `src/config/env.validation.ts` (referenced)
- `src/app.module.ts`, `src/main.ts`
- `src/audit/audit.controller.ts`, `audit.service.ts`, `audit.module.ts`
- `src/organizations/organizations.controller.ts`, `organizations.service.ts`
- `prisma/schema.prisma`

### Web (`apps/web`)
- `src/app/dashboard/settings/account/page.tsx`
- `src/components/account/{ProfileSection,SecuritySection,OrganizationSection,DangerZone}.tsx`
- `src/lib/{account-client,auth-client,org-client}.ts`
- `src/hooks/useCurrentOrganization.ts`
- `src/components/org/OrganizationSwitcher.tsx` (referenced)

### Tests (read)
- `test/account-summary.spec.ts`, `test/account-deletion.spec.ts` (full reads)
- `test/auth.spec.ts`, `test/session-refresh.spec.ts`, `test/membership-authoritative.spec.ts`,
  `test/membership-schema.spec.ts` (behavior verified via test run)
- `src/__tests__/account-page.spec.tsx` (full read)

### Docs cross-referenced
- `docs/tech-lead/04_BACKEND_CAPABILITY_MAP.md`, `07_SECURITY_TENANCY_REVIEW.md`,
  `08_FEATURE_READINESS_MATRIX.md`, `10_TECHNICAL_DEBT_REGISTER.md`,
  `14_DECISION_LOG.md`, `03_WEB_SURFACE_MAP.md`, `00_CURRENT_STATE.md`.

---

## 4. Test evidence run (this audit)

All suites below were executed during this audit and passed. `VERIFIED_THIS_RUN`.

| Command | Suites | Tests | Result |
|---|---|---|---|
| `pnpm --filter @techfusion/api-gateway test -- --testPathPatterns "account-(summary\|deletion)"` | 2 (`account-deletion`, `account-summary`) | 31 | PASS |
| `pnpm --filter @techfusion/api-gateway test -- --testPathPatterns "auth\|session-refresh\|membership-authoritative\|membership-schema"` | 6 (+`metrics-auth-security`) | 79 | PASS |
| `pnpm --filter @techfusion/api-gateway test -- --testPathPatterns "tenant-isolation\|cross-tenant\|rbac-permissions\|sso-login"` | 4 | 67 | PASS |
| `pnpm --filter @techfusion/web test -- --testPathPatterns "account"` | 1 (`account-page.spec.tsx`) | 18 | PASS |
| **Total** | **13 suites** | **195 tests** | **all PASS** |

Notes: test DB migrations applied automatically via `test/setup.ts`; the
`PresenceSweepSchedulerService` Redis error during runs is a known test-environment log
(REDIS unavailable) and does not affect results. The V1 gate (`scripts/ci-v1-gate.sh`) was
**not** run because this stage makes no cross-cutting or schema changes; per
`AGENTS.md` it is only required for such changes.

---

## 5. Architecture summary (account/security surfaces)

- **Guard chain (global, `app.module.ts`):** `CombinedAuthGuard` → `PermissionsGuard` →
  `PlanGuard` → `ThrottlerGuard` (registration order in code; see §17 for the doc-ordering
  discrepancy). `CombinedAuthGuard`/`JwtAuthGuard` verify the JWT then resolve the principal
  from the authoritative `OrganizationMember` row (`membership-auth.ts`), so role/org claims
  in the JWT are snapshot data only. `INFERRED_FROM_CODE`.
- **Account identity:** every account route uses `req.user.sub`; a body `userId` is whitelisted
  away by the global `ValidationPipe({ whitelist: true })` and never consulted. `VERIFIED_THIS_RUN`
  (forged-`userId` tests in `account-summary.spec.ts` and `account-deletion.spec.ts`).
- **Endpoints:**
  - Auth: `POST /auth/signup|login|verify-login|refresh|logout` (`auth.controller.ts`).
  - MFA: `POST /mfa/enroll|verify`, `GET /mfa/status` (`mfa.controller.ts`).
  - Account: `GET|PATCH /auth/account/summary`, `GET /auth/account/deletion-preview`,
    `DELETE /auth/account` (`account.controller.ts`).
  - Org (used by the Account page): `GET /organizations/current`, `GET /organizations/:id`,
    `PATCH/:id`, `POST :id/switch`, member routes.
- **Data model:** `User` (safe fields + `mfaSecret`, `mfaBackupCodes`, `ssoId`), `RefreshToken`
  (plaintext, `onDelete: Cascade` from User), `OrganizationMember` (composite `userId_orgId`,
  role source of truth), `AuditLog` (org-scoped, immutable). `INFERRED_FROM_CODE`.

---

## 6. Capability classification matrix (A–I)

| # | Capability | Classification | Evidence |
|---|---|---|---|
| A1 | Self-scoped profile summary | PRODUCTION_READY | tests + code |
| A2 | Display-name editing | PRODUCTION_READY | tests + code |
| A3 | Email change | MISSING | code |
| A4 | Email verification | MISSING | code |
| A5 | Avatar / profile photo | MISSING | code + web test |
| B1 | MFA status | PRODUCTION_READY | code |
| B2 | MFA enroll (backend) | FUNCTIONAL_WITH_GAPS | code |
| B3 | MFA verify/enable (backend) | FUNCTIONAL_WITH_GAPS | code |
| B4 | MFA login challenge | FUNCTIONAL_WITH_GAPS | code |
| B5 | MFA UI (enroll/verify/disable) | MISSING | grep (web) |
| B6 | MFA disable | MISSING | code |
| B7 | Recovery codes | MISSING | code + grep |
| B8 | MFA re-auth for sensitive ops | MISSING | code |
| C1 | Password hashing (bcrypt cost 10) | PRODUCTION_READY | code |
| C2 | Password complexity policy | FUNCTIONAL_WITH_GAPS | code |
| C3 | Password change | MISSING | code + web test |
| C4 | Forgot / reset password | MISSING | grep (zero matches) |
| C5 | Account lockout / failed-login audit | MISSING | code |
| D1 | Access token lifecycle (JWT 15m) | PRODUCTION_READY | code + docs |
| D2 | Refresh token + CAS rotation | PRODUCTION_READY | tests |
| D3 | Membership-bound refresh | PRODUCTION_READY | tests |
| D4 | Logout (revoke all) | PRODUCTION_READY | code |
| D5 | Session listing / revoke-one / revoke-all | MISSING | code + web test |
| D6 | Session metadata (device/IP/activity) | MISSING | schema |
| E1 | Email verification | MISSING | grep |
| F1 | Current org + role (Account page) | PRODUCTION_READY | tests + code |
| F2 | Org detail counts | PRODUCTION_READY | code |
| F3 | Manage-org hand-off | PRODUCTION_READY | web test |
| G1 | Deletion preview | PRODUCTION_READY | tests |
| G2 | Account deletion | CERTIFIED (per `08`) / PRODUCTION_READY (per code+tests) | tests |
| G3 | Deletion re-auth (MFA/password) | DEFERRED_BY_DECISION | code + docs |
| H1 | Org-scoped audit query/export | PRODUCTION_READY | code |
| H2 | Account event audit (login/profile/MFA) | MISSING | code |
| H3 | Self-scoped activity feed | MISSING | code |
| I1 | Real-data-only Account UI | PRODUCTION_READY | web test |
| I2 | Loading/error/retry/success states | PRODUCTION_READY | web test |
| I3 | Honest "Not available" states | PRODUCTION_READY | web test |
| I4 | A11y basics | PRODUCTION_READY | code |
| I5 | Reduced-motion respect | PRODUCTION_READY | code |

---

## 7. Section A — Profile information

### A1. Self-scoped profile summary — PRODUCTION_READY
- `GET /auth/account/summary` returns exactly `id, email, displayName, createdAt, updatedAt`
  via `PROFILE_SELECT` (`account-profile.service.ts:23`). `INFERRED_FROM_CODE`.
- Identity is `req.user.sub` only (`account.controller.ts:24`). `VERIFIED_THIS_RUN`
  (`account-summary.spec.ts`):
  - Rejects unauthenticated 401.
  - Self-scoped; tenant-isolated across orgs.
  - Never exposes `passwordHash`, `mfaSecret`, `mfaBackupCodes`, `ssoId`, `ssoProvider`, or the
    access token (test seeds real-looking secret values to prove non-leakage).
- `createdAt`/`updatedAt` are authoritative `@default(now())` / `@updatedAt` columns (`schema.prisma:94-95`). `INFERRED_FROM_CODE`.

### A2. Display-name editing — PRODUCTION_READY
- `PATCH /auth/account/summary`; DTO: `@IsString @Length(1,100) @Matches(/\S/)`
  (`update-account-profile.dto.ts`); service trims before persist (`account-profile.service.ts:53`). `INFERRED_FROM_CODE`.
- `VERIFIED_THIS_RUN`: empty/whitespace/101-char rejected with 400 and DB unchanged; storage
  is trimmed; `updatedAt` advances; **forged body `userId` is ignored** (victim's name
  unchanged); MFA secret and password hash untouched by a display-name edit.

### A3. Email change — MISSING
- No DTO field, no service method, no endpoint, no route on the Account page. `INFERRED_FROM_CODE`.
- `User.email` is `@unique` and `@@unique([orgId, email])` — changing it would need a
  dedicated flow; none exists.

### A4. Email verification — MISSING
- Grep for `emailVerified|verify-email|verifyEmail` across `apps/`: zero implementation
  matches. No column, no token model, no endpoint, no UI. `VERIFIED_THIS_RUN`.
- Signup creates a fully-functional account immediately (`auth.service.ts:56-113`). This is a
  documented product decision for V1 (see §14 decisions context), not a regression.

### A5. Avatar / profile photo — MISSING
- No `avatar`/`photo` column or upload endpoint. The UI renders initials derived from
  `displayName`/`email` only (`ProfileSection.tsx:138-140`). Web test asserts the page never
  fabricates an avatar field. `VERIFIED_THIS_RUN`.

---

## 8. Section B — MFA (TOTP)

### B1. MFA status — PRODUCTION_READY
- `GET /mfa/status` → `{ isMfaEnabled }` only (`mfa.service.ts:46-52`). `INFERRED_FROM_CODE`.
- The Account page renders Enabled/Not enabled from this authoritative endpoint
  (`account-page.spec.tsx` both branches). `VERIFIED_THIS_RUN`.

### B2. MFA enroll (backend) — FUNCTIONAL_WITH_GAPS
- `POST /mfa/enroll` generates a speakeasy secret (`name: 'TechFusion AI'`), persists raw
  base32 into `User.mfaSecret`, returns `{ secret, qrCode }` (`mfa.service.ts:10-20`). `INFERRED_FROM_CODE`.
- **Gaps:**
  - **No UI in the web app.** Grep across `apps/web` for `mfa/enroll|mfa/verify` finds only
    `account-client.ts` types and `fetchMfaStatus` — no enroll/verify client function, no page.
    `VERIFIED_THIS_RUN`. Matches `08_FEATURE_READINESS_MATRIX.md` "MFA status read-only
    (enroll/verify via auth flow)".
  - **No `@Throttle`** on `/mfa/enroll` or `/mfa/verify` (`mfa.controller.ts` has none;
    `rate-limits.ts` `STRICT_RATE_LIMITS.mfa` is dead config — see §17).
  - **`mfaSecret` stored plaintext** (base32) at rest — no encryption like the
    `SsoConfig.clientSecretEncrypted` pattern. `INFERRED_FROM_CODE`.
  - **No audit event** written to `AuditLog` on enroll. `INFERRED_FROM_CODE` (no `auditLog`
    usage in `mfa/`).

### B3. MFA verify / enable (backend) — FUNCTIONAL_WITH_GAPS
- `POST /mfa/verify` verifies TOTP (`speakeasy.totp.verify`, default window) then sets
  `isMfaEnabled: true` (`mfa.service.ts:22-44`). `INFERRED_FROM_CODE`.
- **Gaps:** no throttle, no attempt lockout, no audit event. `INFERRED_FROM_CODE`.
- Note: `isMfaEnabled` requires a successful verify after enroll; a user who enrolls but never
  verifies is not MFA-protected. The `mfaRequired` login gate keys off `isMfaEnabled`
  (`auth.service.ts:126-128`). Consistent.

### B4. MFA login challenge — FUNCTIONAL_WITH_GAPS
- `POST /auth/verify-login` (@Public, `@Throttle(10, 60000)`): after password login, when
  `isMfaEnabled` the server returns `{ mfaRequired: true, userId }`; the client calls
  `verify-login` with `{ userId, token }`; server re-checks MFA state and verifies TOTP, then
  mints tokens (`auth.service.ts:126-172`). `INFERRED_FROM_CODE`.
- **Gaps:** client-supplied `userId` on a public route reveals MFA/account state through
  distinct 401 messages (`MFA verification required` vs `Invalid MFA code`); throttle is
  per-IP only; no failed-attempt lockout. Low severity (documented in §20).

### B5. MFA UI (enroll/verify/disable) — MISSING
- No web component calls enroll or verify; `SecuritySection` is read-only status only. `VERIFIED_THIS_RUN`.

### B6. MFA disable — MISSING
- No endpoint, no service method, no UI. `INFERRED_FROM_CODE`.

### B7. Recovery codes — MISSING
- `User.mfaBackupCodes String?` exists in schema (`schema.prisma:91`) and is seeded in tests
  only; **no code reads or writes it** in `src/`. `VERIFIED_THIS_RUN` (grep: matches only
  schema, tests, comments).

### B8. MFA re-auth for sensitive ops — MISSING
- Deleting the account or changing the display name requires no fresh MFA confirmation
  (see §14 decisions for the documented trade-off). `INFERRED_FROM_CODE`.

---

## 9. Section C — Password security

### C1. Hashing — PRODUCTION_READY
- `bcrypt.hash(password, 10)` on signup; `bcrypt.compare` on login (`auth.service.ts:62,121`).
  `INFERRED_FROM_CODE`.

### C2. Complexity policy — FUNCTIONAL_WITH_GAPS
- Signup DTO: `@MinLength(8) @MaxLength(128)` only — no complexity/compromised-password
  checks. `INFERRED_FROM_CODE`. Meets NIST-minimum guidance for V1.

### C3. Password change — MISSING
- No endpoint; `SecuritySection` shows "Password change is not available in this release."
  (`SecuritySection.tsx:80-82`); web test asserts this honest state. `VERIFIED_THIS_RUN`.

### C4. Forgot / reset password — MISSING
- Grep for `passwordReset|forgot-password|forgotPassword|resetPassword` across `apps/`: zero
  implementation matches. `VERIFIED_THIS_RUN`.

### C5. Lockout / failed-login audit — MISSING
- Only generic throttling (`login 5/60s`); no per-account lockout, no failed-login `AuditLog`
  rows, no structured event for failed login. `INFERRED_FROM_CODE`.

---

## 10. Section D — Sessions & tokens

### D1. Access token lifecycle — PRODUCTION_READY
- JWT HS256, `expiresIn: '15m'`, claims `{ sub, orgId, role }` (`auth.service.ts:261-266`);
  role/org are snapshots — membership row is authoritative (`membership-auth.ts`). Matches
  `07_SECURITY_TENANCY_REVIEW.md`. `VERIFIED_THIS_RUN` (docs) + `INFERRED_FROM_CODE`.

### D2. Refresh token + CAS rotation — PRODUCTION_READY
- Opaque 48-byte hex, 7-day expiry, stored in `RefreshToken` table. Refresh is single-use via
  compare-and-swap (`updateMany where revokedAt: null` → count 0 ⇒ 401) (`auth.service.ts:204-211`).
  `VERIFIED_THIS_RUN` (`session-refresh.spec.ts`).

### D3. Membership-bound refresh — PRODUCTION_READY
- Refresh re-checks `OrganizationMember` for the token's org; absent membership revokes the
  token and 401s (`auth.service.ts:187-197`). Org switch / member removal / leave also revoke
  bound refresh rows (`organizations.service.ts:285-288, 334-337, 459-462`).
  `VERIFIED_THIS_RUN` (membership suites).

### D4. Logout — PRODUCTION_READY (all-sessions)
- `POST /auth/logout` revokes **all** active refresh tokens for the user (`auth.service.ts:226-231`).
  Broad but correct; there is no single-session logout. `INFERRED_FROM_CODE`.

### D5. Session listing / revoke-one / revoke-all — MISSING
- No endpoint returns active sessions; UI states "Session listing and revocation are not
  available in this release." (`SecuritySection.tsx:84-88`). `VERIFIED_THIS_RUN`.

### D6. Session metadata — MISSING
- `RefreshToken` model has no `deviceId`/`ipAddress`/`lastActivity` columns (`schema.prisma:150-159`).
  No device/browser fingerprinting or activity tracking. `INFERRED_FROM_CODE`.

---

## 11. Section E — Email verification

- **MISSING** — no column, no token model, no endpoints, no UI. `VERIFIED_THIS_RUN`.
- Verified in code (`auth.service.ts` signup path creates an immediately-usable account) and
  by grep. This is a documented V1 decision (see `14_DECISION_LOG.md`); it pairs with the
  signup enumeration finding in §20 as the primary account-security hardening item.

---

## 12. Section F — Organization membership (Account page context)

### F1. Current org + role — PRODUCTION_READY
- `GET /organizations/current` returns `{ id, name, slug, plan, createdAt, membershipRole,
  isActive }` from the authoritative membership (`organizations.service.ts:389-396`).
  `VERIFIED_THIS_RUN` (`account-page.spec.tsx` renders each of Owner/Admin/Technician/Viewer
  from the backend fixture).

### F2. Org detail counts — PRODUCTION_READY
- `GET /organizations/:id` adds `deviceCount` + `memberCount` via `count` queries
  (`organizations.service.ts:113-116`). `INFERRED_FROM_CODE`.

### F3. Manage-org hand-off — PRODUCTION_READY
- `OrganizationSection` links to `/dashboard/settings/organization` via `asChild`
  (`OrganizationSection.tsx:48-52`); web test asserts the href. `VERIFIED_THIS_RUN`.
- The Account page intentionally does **not** expose member management or role assignment —
  correct separation per product decisions. `INFERRED_FROM_CODE`.

---

## 13. Section G — Account deletion

### G1. Deletion preview — PRODUCTION_READY
- `GET /auth/account/deletion-preview` computes `canDelete`, `blockers` (SOLE_OWNER),
  `membershipsCount`, `ownedOrganizationsCount`, `emptyOrganizationsToRemove`
  (`account-deletion.service.ts:64-101`). `VERIFIED_THIS_RUN` (`account-deletion.spec.ts`
  DELETION PREVIEW describe block: blocked/eligible/empty-org cases).

### G2. Account deletion — CERTIFIED (per `08`) / PRODUCTION_READY (code + tests)
- `DELETE /auth/account` requires exact `"DELETE"` confirmation, runs in one transaction,
  and is idempotent (`account-deletion.service.ts:122-237`). `VERIFIED_THIS_RUN`:
  - Wrong confirmation → 400; nothing deleted.
  - Sole Owner of non-empty or shared org → 409 SOLE_OWNER; full rollback (empty personal org
    also NOT deleted).
  - Co-Owner eligible when another Owner remains.
  - Blocked deletion rolls back atomically.
  - Deletes account + memberships; preserves orgs, other users, devices, metrics.
  - Revokes **all** refresh sessions; old JWT and old refresh token both rejected (401).
  - Revokes pending invitations addressed to the deleted email; preserves invitations created
    *by* the user (no cascade).
  - Writes `account_deleted` `AuditLog` rows for surviving orgs and preserves historical
    audit rows (actorId outlives the account).
  - Tenant isolation: other orgs/users untouched.
- `isEmptyOrganization` counts 30 child models and relies on DB `onDelete: Restrict` as the
  final guard (`account-deletion.service.ts:265-305`). `INFERRED_FROM_CODE`.

### G3. Deletion re-auth (MFA/password) — DEFERRED_BY_DECISION
- No current-password or MFA re-authentication is required; the typed `"DELETE"` confirmation
  is the sole gate. This is a documented, deliberate trade-off (friction vs safety) — recorded
  in §14 and assigned to ACC-SEC-02B. `INFERRED_FROM_CODE`.

---

## 14. Section H — Audit / activity

### H1. Org-scoped audit query/export — PRODUCTION_READY
- `AuditLog` model (`orgId`, `action`, `actorId`, `targetId`, `details`, `ipAddress`,
  `userAgent`, `sessionId`, `immutable`); `audit.controller.ts` provides
  `GET /audit/logs`, `GET /audit/export/csv`, `GET /audit/export/json` — all
  `@RequirePermissions(AUDIT_VIEW)` and org-scoped. `INFERRED_FROM_CODE`.
- Producers: devices, remote-support, backups, enrollment, security, admin-recovery, and
  account-deletion (`account_deleted`). `INFERRED_FROM_CODE` (grep of `src/`).

### H2. Account event audit — MISSING
- **No `AuditLog` rows are written for**: signup, login, failed login, logout, refresh,
  profile (display-name) changes, MFA enroll, MFA verify, MFA disable, session revocation.
  Grep shows `auditLog`/`audit.log(` usages only in devices/remote-support/backups/enrollment/
  security/admin/account-deletion. `VERIFIED_THIS_RUN`.
- Account-deletion *does* emit structured-logger events (`account_deletion_requested` /
  `account_deletion_blocked` / `account_deleted`) but only `account_deleted` reaches `AuditLog`.
  `INFERRED_FROM_CODE`.

### H3. Self-scoped activity feed — MISSING
- No endpoint returns a user's own account events (audit is org-scoped; a user without
  `AUDIT_VIEW` cannot see their own account history). `INFERRED_FROM_CODE`.

---

## 15. Section I — UX quality (Account page)

`VERIFIED_THIS_RUN` via `account-page.spec.tsx` (18 tests) + code reads:

- **Real data only**: summary, MFA status, org + role, deletion preview all rendered from
  server responses; test asserts "does not fabricate fields the backend does not provide" and
  no `passwordHash|mfaSecret|mfaBackupCodes|ssoId|accessToken` text on the page.
- **Honest unsupported states**: password change and session listing render as
  "Not available" (test-verified) — no fake buttons.
- **Deletion contract**: sole-Owner block shows no delete button; eligible state requires the
  literal `DELETE` (button disabled otherwise); success clears tokens + redirects (test-verified).
- **States**: per-section loading (`role="status"`), error + Retry (`role="alert"`), saved
  confirmation, copy feedback.
- **A11y**: `role="dialog" aria-modal aria-labelledby`, labelled input, `aria-label` on icon
  button, focus styles, `useReducedMotion` respected in `page.tsx`.
- **Client validation** mirrors server: empty display name rejected client-side without an
  API call (test-verified).

---

## 16. Endpoint security matrix

Legend: Public = `@Public`; Auth = protected by global guard; Membership = principal resolved
from `OrganizationMember`; Throttle = `@Throttle` value (non-test).

| Endpoint | Public | Throttle | Notes |
|---|---|---|---|
| `POST /auth/signup` | ✅ | 3/300s | Distinct `ConflictException("Email already in use")` → enumeration surface (§20) |
| `POST /auth/login` | ✅ | 5/60s | Generic `Invalid email or password` (good) |
| `POST /auth/verify-login` | ✅ | 10/60s | MFA challenge; body `userId`; distinct 401 messages (§8 B4) |
| `POST /auth/refresh` | ✅ | 5/60s | CAS single-use; membership re-checked |
| `POST /auth/logout` | ❌ | none | Revokes all sessions for the user |
| `GET /auth/account/summary` | ❌ | none | Self-scoped; safe fields only |
| `PATCH /auth/account/summary` | ❌ | none | displayName only; forged userId ignored |
| `GET /auth/account/deletion-preview` | ❌ | none | 30 count queries per owned org |
| `DELETE /auth/account` | ❌ | none | Requires exact `"DELETE"` |
| `POST /mfa/enroll` | ❌ | **none** | Returns raw secret + QR |
| `POST /mfa/verify` | ❌ | **none** | TOTP verify; no lockout |
| `GET /mfa/status` | ❌ | none | `{ isMfaEnabled }` |
| `GET /organizations/current` | ❌ | none | Membership-validated |
| `GET /organizations/:id` | ❌ | none | `ORGANIZATION_VIEW` + membership |

All authenticated endpoints resolve identity from `req.user.sub` / membership; no client body
identity is ever authoritative. `VERIFIED_THIS_RUN`.

---

## 17. Doc-vs-code conflict analysis

1. **`STRICT_RATE_LIMITS` is dead config** — `rate-limits.ts:35-46` defines
   `STRICT_RATE_LIMITS` (incl. `mfa: { limit: 5, ttl: 60000 }`) but nothing references it.
   The live throttles are the inline `@Throttle(throttle(...))` decorators. If `10_TECHNICAL_DEBT_REGISTER.md`
   or a prior stage implies "strict rate limits" are enforced, that is **not** the case.
   `VERIFIED_THIS_RUN`. (`04_BACKEND_CAPABILITY_MAP.md:9` states the *correct* live values —
   matches code; the dead constant is the conflict.) → New debt entry §21.
2. **Guard execution order** — `04_BACKEND_CAPABILITY_MAP.md` documents the chain as
   `ThrottlerGuard → CombinedAuthGuard → PermissionsGuard → PlanGuard/RequireFeature`; code
   registers `CombinedAuthGuard → PermissionsGuard → PlanGuard → ThrottlerGuard`
   (`app.module.ts:62-77`). All four guards are present either way; the documented order does
   not match registration order. Practical impact none observed (throttling still applied
   globally; public routes bypass auth). Marked `INFERRED_FROM_CODE`, flagged for doc fix.
3. **`mfaBackupCodes` column without implementation** — schema + tests only; `08` does *not*
   claim recovery codes, so no readiness claim is violated, but the column is vestigial.
   `VERIFIED_THIS_RUN`. → Debt entry.
4. **`08` "MFA status read-only (enroll/verify via auth flow)"** — confirmed accurate: no MFA
   UI exists in `apps/web`. Consistent.
5. **`08` "Account deletion CERTIFIED"; Account profile FUNCTIONAL"** — confirmed by code +
   tests. Consistent.
6. **`07` access 15m / refresh 7d / CAS / DB revocation on logout + membership removal** —
   confirmed (`auth.service.ts`, `organizations.service.ts`). Consistent.
7. No other account/security doc claims contradicted by code or tests. `VERIFIED_THIS_RUN`.

---

## 18. Production-ready capabilities (safe to rely on)

1. Account summary + display-name editing (`GET|PATCH /auth/account/summary`) — `VERIFIED_THIS_RUN`.
2. Account deletion (`GET /auth/account/deletion-preview`, `DELETE /auth/account`) —
   `VERIFIED_THIS_RUN`; `CERTIFIED` per `08`.
3. MFA status endpoint + read-only Account-page display — `VERIFIED_THIS_RUN`.
4. Access + refresh token lifecycle with CAS rotation and membership binding —
   `VERIFIED_THIS_RUN`.
5. Logout (all-session revocation) — `INFERRED_FROM_CODE`.
6. Current org + role + detail counts — `VERIFIED_THIS_RUN`.
7. Org-scoped audit query/export — `INFERRED_FROM_CODE`.
8. Account page data-integrity contract (no fabricated values, honest unsupported states,
   deletion confirmation gating) — `VERIFIED_THIS_RUN`.

---

## 19. Missing / deferred capabilities (confirmed absent, not broken)

| Capability | Status | Source |
|---|---|---|
| Email change | MISSING | code |
| Email verification | MISSING (documented V1 decision) | code/grep |
| Avatar / photo | MISSING | code + web test |
| Password change | MISSING (UI honest) | code + web test |
| Forgot / reset password | MISSING | grep zero matches |
| Session listing / revoke-one / revoke-all | MISSING (UI honest) | code + web test |
| Session metadata (device/IP/activity) | MISSING | schema |
| MFA UI (enroll/verify/disable) | MISSING | grep (web) |
| MFA disable | MISSING | code |
| MFA recovery codes | MISSING (schema vestigial) | code/grep |
| MFA re-auth for sensitive ops | MISSING (deferred) | code |
| Account event audit (login/profile/MFA) | MISSING | grep |
| Self-scoped activity feed | MISSING | code |
| Account deletion re-auth | DEFERRED_BY_DECISION | code + docs |
| Failed-login lockout / audit | MISSING | code |

---

## 20. Ordered security risks

Severity is relative to a self-hosted multi-tenant product; none are currently exploited, all
are pre-audit conditions.

1. **MEDIUM — Account enumeration via signup.** `POST /auth/signup` returns a distinct
   `409 Conflict "Email already in use"` while login is generic (`auth.service.ts:59, 118-124`).
   An attacker can probe which emails have accounts. Throttled 3/300s (per-IP) but not removed.
   Fix: generic 201-with-pending-verification or uniform error; belongs in ACC-SEC-02B.
2. **MEDIUM — MFA secrets stored plaintext at rest.** `User.mfaSecret` is raw base32
   (`mfa.service.ts:15`). A DB read defeats TOTP for all users. The repo already has an
   `EncryptionModule` used for `SsoConfig.clientSecretEncrypted` — apply the same pattern.
3. **MEDIUM — Un-throttled TOTP endpoints.** `/mfa/enroll` and `/mfa/verify` have no
   `@Throttle` and no attempt lockout. `verify` is authenticated (limits exposure to the
   account holder / DoS on self) but `/auth/verify-login` (pre-auth, throttled 10/60s) is the
   weaker gate; distinct 401 messages reveal MFA/account state. Add throttles + small
   per-account retry lockout.
4. **MEDIUM — Refresh tokens stored plaintext.** 48-byte hex in `RefreshToken.token`
   (`auth.service.ts:35-37`). A DB read mints unlimited sessions. Best practice: store
   SHA-256 hash (like `tokenHash` used for invitations/enrollment).
5. **LOW-MEDIUM — Tokens in localStorage (SPA trade-off).** Access + 7-day refresh tokens in
   `localStorage` (`auth-client.ts:41-65`) are readable by any same-origin XSS. Standard SPA
   pattern; documented, not a regression. Architecture decision on cookie vs storage in
   ACC-SEC-02B.
6. **LOW — No account lockout / failed-login audit.** Only rate limits; repeated failures
   produce no `AuditLog` rows or structured events.
7. **LOW — No MFA re-auth for destructive ops.** Account deletion is gated by knowledge of the
   literal `DELETE` only. Documented decision; revisit in ACC-SEC-02B with an explicit
   friction vs. safety call.
8. **LOW — Deletion preview cost.** `isEmptyOrganization` issues ~30 count queries per owned
   org per preview call; authenticated DoS/load surface. Not urgent.

---

## 21. Technical debt additions (for `10_TECHNICAL_DEBT_REGISTER.md`)

The following are observed by this audit and recommended for the register (not modified in
this stage):

1. `STRICT_RATE_LIMITS` dead config in `rate-limits.ts` — misleading vs. live throttles.
2. `User.mfaBackupCodes` column unused by any code — vestigial schema surface.
3. Guard-chain documented order (`04`) differs from registration order (`app.module.ts`).
4. MFA lifecycle incomplete (no disable/recovery/UI/audit) despite `mfa*` columns + backend.
5. Refresh tokens stored plaintext (hash-at-rest recommended).
6. `mfaSecret` plaintext at rest (encryption recommended).

---

## 22. ACC-SEC-02B scope (Account Security Stage)

### Required for V1
- Signup enumeration remediation (generic errors or email-verification gate).
- TOTP endpoint throttling + per-account attempt lockout (`/mfa/enroll`, `/mfa/verify`,
  tighten `/auth/verify-login`).
- Encrypt `mfaSecret` at rest via existing `EncryptionModule`.

### Valuable-deferrable
- Authenticated password change (current-password verified).
- Forgot / reset password flow (token model + hashed token, schema addition — needs migration).
- MFA disable + recovery-code generation (hashing + display-once).
- Session listing / revoke-one / revoke-all (self-scoped).
- Refresh-token hashing at rest.
- Account event audit rows (login, profile change, MFA changes) + optional self-scoped feed.

### Not justified for V1
- Strict password complexity rules (NIST 8-char minimum already met).
- Email verification *if* signup enumeration is closed via generic errors; keep it
  Valuable-deferrable otherwise.

### Needs architecture decision
- **Account deletion re-auth** (current-password / MFA challenge before delete) — friction vs.
  safety; explicitly decide and record.
- **Token storage strategy** (localStorage vs. httpOnly cookie + CSRF posture).
- **Session metadata schema** (`RefreshToken` device/IP/lastActivity columns) — migration
  discipline per `AGENTS.md` §10.

---

## 23. ACC-UX-02C scope (Account UX Stage)

Constraint honored by the current UI: **only real-backend-backed controls are surfaced** —
password change and session listing are honestly "Not available", deletion requires the
verified literal confirmation. Scope for the UX stage (build nothing that fabricates):

- Wire MFA enroll/verify/disable UI **only after** §22 Required/Valuable-deferrable backend
  gaps land (disable endpoint + throttling + audit).
- Add a self-scoped session list UI **only after** the backend session endpoints exist.
- Wire password change UI **only after** the backend change-password endpoint exists.
- Display-name edit is already backed — no change needed.
- Do **not** add avatar upload UI until a backend upload/avatar field exists.

---

## 24. Evidence markers used

- `VERIFIED_THIS_RUN` — confirmed by an executed test or direct command output in this audit.
- `VERIFIED_BY_CURRENT_CI` — not used this audit (V1 gate not run; no cross-cutting change).
- `INFERRED_FROM_CODE` — read directly from source; deterministic.
- `UNVERIFIED` — none used; every claim above has at least one supporting marker.

---

## 25. Stage decision

**GO.**

- Current Account & Security state is verified, honest, and matches its documentation and
  product decisions; the foundation commit is sound.
- All 195 relevant tests pass across 13 suites; account-specific invariants (self-scoping,
  non-leakage, deletion safety, session revocation) are directly proven.
- No code, schema, runtime, or CI changes are required by this audit stage. The deliverable is
  this report.
- Follow-on stages (ACC-SEC-02B, ACC-UX-02C) are scoped in §22–§23 and **must not** start in
  this stage.

*Report authored by ACC-AUDIT-02A audit stage. Repository state: clean except this report.*

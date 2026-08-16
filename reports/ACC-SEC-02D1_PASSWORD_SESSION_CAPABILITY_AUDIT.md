# ACC-SEC-02D1 — Password & Active Sessions Capability Audit

> **Type:** Capability + security audit (evidence-based, read-only)
> **Date:** 2026-08-16
> **Branch:** `audit/acc-sec-02d1-password-sessions`
> **Scope:** Secure password change, password reset/recovery readiness, active
> session listing, single-session revocation, sign out all other sessions,
> sensitive-operation re-authentication.
> **Audit mode:** No implementation, no runtime changes, no schema changes, no
> migrations, no dependencies, no env changes, no push, no production access.
> **Evidence standard:** `docs/tech-lead/README.md` markers (`VERIFIED_THIS_RUN`,
> `VERIFIED_BY_CURRENT_CI`, `INFERRED_FROM_CODE`, `UNVERIFIED`). No capability is
> called production-ready without a passing test observed in this run. No claim
> is stronger than the evidence cited.

---

## 1. Executive summary

The password and session surface of TechFusion AI is **honest and safe by
omission, but almost entirely unimplemented** — and the building blocks needed to
implement it are already in place and test-verified.

Verified outcomes of this audit:

- **Password hashing and re-authentication are production-ready and directly
  reusable.** Passwords are bcrypt (cost 10) hashed at rest (`auth.service.ts:74`)
  and verified by `ReauthenticationService.verifyPassword` — server-authoritative
  (`req.user.sub` only), deterministic 401, no account enumeration, structured
  `reauthentication_failed` event, already enforced on MFA disable and
  recovery-code generation/regeneration (`mfa.service.ts:150,234`).
- **Password change and forgot/reset password are genuinely absent** — not
  present-but-broken. Grep across the repo finds zero implementation and one
  *negative* test asserting the login page shows no "forgot password" link
  (`login-page.spec.tsx:765`). The UI states this honestly
  (`SecuritySection.tsx:233-243`, asserted in `account-page.spec.tsx:272-273`).
- **The session model is a `RefreshToken` row — authoritative in the database but
  metadata-poor and client-blind.** Access tokens are stateless 15 m JWTs with no
  `jti`/session binding; refresh tokens are opaque 7 d values stored **plaintext**
  at rest, single-use via CAS rotation, revoked on logout (all sessions) and
  membership loss. There is **no way today** to list, identify, or revoke one
  session versus another.
- **Revocation is not immediate.** Refresh-token revocation is enforced on the
  next refresh, but an already-issued access token remains valid up to 15 m
  (stateless JWT, membership re-checked per request but no per-session
  revocation list).
- **Re-authentication for sensitive operations is GO** — the mechanism exists,
  is tested (22-test MFA recovery suite + reauth-driven flows), and is the
  correct gate for password change and account deletion.
- **Migration decision: MIGRATION REQUIRED** for the session-management half of
  ACC-SEC-02D2 (additive `RefreshToken` metadata columns). Password change and
  refresh-token hashing-at-rest require **no** schema change.

**Stage verdict: GO — audit confirms current state; deliverable is this report
only. ACC-SEC-02D2 scope is defined in §15–§17 and must not start in this
stage.**

---

## 2. Repository and commit audited

- Repository: `/home/ge/techfusion-ai` (monorepo, git). Branch at audit start:
  `main` — clean working tree (`git status --short` empty).
- **Audited commit:** `cfba97750c48db621947eaf665687053e76eb14f`
  `feat(account): build interactive security experience (#6)` (ACC-UX-02C).
- Audit branch created: `audit/acc-sec-02d1-password-sessions`.
- Prior context commits: `0deb9c3` (ACC-SEC-02B2), `168650c` (ACC-SEC-02B1).
- **PUSHED: NO; PRODUCTION DEPLOYED: NO.** No runtime code, schema, migration,
  dependency, or environment file was touched by this stage.
- The only artifact added by this stage is this report, staged explicitly at the
  end and committed with exactly `docs(account): audit password and session
  lifecycle`.

---

## 3. Files and modules inspected

### Governance / canonical docs (read)
- `AGENTS.md`, `docs/PRD.md`, `docs/tech-lead/00_CURRENT_STATE.md`,
  `03_WEB_SURFACE_MAP.md`, `04_BACKEND_CAPABILITY_MAP.md`,
  `07_SECURITY_TENANCY_REVIEW.md`, `08_FEATURE_READINESS_MATRIX.md`,
  `10_TECHNICAL_DEBT_REGISTER.md`, `14_DECISION_LOG.md`
  (T25 password/session deferral; D28–D30 MFA/recovery/UX decisions).
- `reports/ACC-AUDIT-02A_ACCOUNT_SECURITY_CAPABILITY_AUDIT.md`,
  `reports/ACC-UX-02C_INTERACTIVE_ACCOUNT_SECURITY_EXPERIENCE.md`.

### Backend (`apps/api-gateway`) — read
- `src/auth/auth.service.ts` (signup/login/verify-login/refresh/logout/
  generateTokens), `src/auth/auth.controller.ts`, `src/auth/dto/{signup,login,
  refresh}.dto.ts`
- `src/reauthentication/reauthentication.service.ts`
- `src/mfa/mfa.controller.ts`, `src/mfa/mfa.service.ts`
- `src/account/account.controller.ts`, `src/account/account-profile.service.ts`
- `src/common/{jwt-auth.guard,membership-auth,structured-logger,
  request-logging.interceptor}.ts`
- `src/config/rate-limits.ts`, `src/config/env.validation.ts` (referenced)
- `src/app.module.ts` (guard order, throttler config), `src/main.ts`
  (helmet, CORS, body parsing, secret redaction)
- `prisma/schema.prisma` (full read: `User`, `RefreshToken`,
  `OrganizationMember`, `AuditLog`, `OrganizationInvitation`)

### Frontend (`apps/web`) — read
- `src/lib/auth-client.ts`, `src/lib/account-client.ts`
- `src/components/account/SecuritySection.tsx`
- `src/hooks/useSessionGuard.ts`, `src/app/dashboard/layout.tsx`
- `src/app/dashboard/settings/account/page.tsx` (referenced via specs)

### Tests (run this audit; counts below in §11)
- API: `auth.spec`, `ws-auth.spec`, `session-refresh.spec`,
  `account-summary.spec`, `account-deletion.spec`, `membership-authoritative.spec`,
  `membership-schema.spec`, `cross-tenant-isolation.spec`,
  `tenant-isolation-security.spec`, `rbac-permissions.spec`,
  `mfa-security.spec`, `mfa-recovery.spec`
- Web: `account-page.spec.tsx`, `security-section.spec.tsx`, `mfa-client.spec.ts`,
  `mfa-errors.spec.ts`, `auth-client.spec.ts`, `use-session-guard.spec.tsx`

---

## 4. Existing password capabilities

| # | Capability | Classification | Evidence |
|---|------------|----------------|----------|
| P1 | bcrypt hashing (cost 10) at rest | PRODUCTION_READY | `auth.service.ts:74`; tests (`auth.spec`, `mfa-recovery.spec`) |
| P2 | bcrypt verification for login | PRODUCTION_READY | `auth.service.ts:133` |
| P3 | Server-authoritative current-password re-authentication | PRODUCTION_READY | `reauthentication.service.ts:33-49`; enforced on MFA disable + recovery codes (`mfa.service.ts:150,234`) |
| P4 | Password complexity policy | FUNCTIONAL_WITH_GAPS | `signup.dto.ts:8-12` `@MinLength(8) @MaxLength(128)` only — no complexity/breached-password checks |
| P5 | Authenticated password change | **MISSING** | grep: zero matches across `apps/`; UI honest "not available" (`SecuritySection.tsx:235`) |
| P6 | Forgot / reset password | **MISSING** | grep zero matches; negative test `login-page.spec.tsx:765` |
| P7 | Reused-password protection | MISSING | no history table, no check |
| P8 | Per-account lockout / failed-login audit | MISSING | only IP throttling; no lockout, no failed-login `AuditLog` rows |
| P9 | Password-change session revocation | N/A (no endpoint) | building block exists (`auth.service.ts:297-302` logout revokes all refresh rows) |
| P10 | Password audit events | PARTIAL | structured `reauthentication_failed` exists; **no `password_changed`/`password_reset` events** |
| P11 | Secret/password logging safety | PRODUCTION_READY | `structured-logger.ts:61-108` key redaction; `main.ts:101` query-string redaction; request-logging interceptor logs method/url/status only (no body) |

Key detail — **P3 is the foundation for everything in this mission.** It is
already wired into the MFA lifecycle with route-level throttling
(`mfaThrottle()` = 5/60 s, provable in test mode, `rate-limits.ts:16-18`) and
writes `reauthentication_failed` on every failure. Password change should reuse
it verbatim (see §16).

Password policy gap note: `@MinLength(8)` meets the documented NIST-minimum
guidance for V1 (ACC-AUDIT-02A §20, `10` T25); the audit does not recommend
adding complexity rules in ACC-SEC-02D2 (see §18).

---

## 5. Existing session/token capabilities

| # | Capability | Classification | Evidence |
|---|------------|----------------|----------|
| S1 | Access token: HS256 JWT, 15 m, claims `{sub, orgId, role}` | PRODUCTION_READY | `auth.service.ts:333-337`; `session-refresh.spec.ts` |
| S2 | Membership-authoritative request auth (per-request) | PRODUCTION_READY | `membership-auth.ts:50-67`; `cross-tenant-isolation.spec.ts`, `membership-authoritative.spec.ts` |
| S3 | Refresh token: opaque 48-byte hex, 7 d | PRODUCTION_READY | `auth.service.ts:40-42,339-347` |
| S4 | Single-use CAS rotation (concurrency-safe) | PRODUCTION_READY | `auth.service.ts:275-282`; race test `session-refresh.spec.ts:285-301` |
| S5 | Refresh revoked on logout (all sessions) | PRODUCTION_READY | `auth.service.ts:297-302`; test `session-refresh.spec.ts:267-281` |
| S6 | Refresh revoked on membership loss / org switch / leave | PRODUCTION_READY | `auth.service.ts:262-267`; `organizations.service.ts` (per ACC-AUDIT-02A D3); tests |
| S7 | Authoritative DB session representation | PRODUCTION_READY | `RefreshToken` row (schema `150-159`) |
| S8 | Refresh token **plaintext at rest** | **RISK (MEDIUM)** | `RefreshToken.token` stores raw 48-byte hex; lookup is equality (`auth.service.ts:246-249`) |
| S9 | Session listing / revoke-one / revoke-all-others | **MISSING** | no endpoints; UI honest "not available" (`SecuritySection.tsx:240-243`) |
| S10 | Session metadata (lastUsedAt / IP / UA / device) | MISSING | schema has only id/token/userId/orgId/expiresAt/createdAt/revokedAt |
| S11 | Current-session identification | NOT RELIABLE | no `jti`/`sid` in access token; client cannot correlate to a refresh row |
| S12 | Immediate revocation of access tokens | **NOT SUPPORTED** | stateless JWTs valid until expiry; revocation list / `jti` absent (15 m residual window) |
| S13 | Logout semantics | PRODUCTION_READY (broad) | `logout()` revokes all refresh rows then web clears tokens + sockets + redirects (`auth-client.ts:231-255`) |
| S14 | Tenant isolation / cross-account access | PRODUCTION_READY | membership-authoritative everywhere; isolation suites green this run |

Session metadata inventory (`RefreshToken`): `id`, `token` (secret), `userId`,
`orgId`, `expiresAt`, `createdAt`, `revokedAt`. Missing: `lastUsedAt`,
`ipAddress`, `userAgent`, `deviceName`, client-facing `sessionId` (the DB `id`
uuid could be safely exposed as a non-secret session identifier; no new column
strictly required for identification, but metadata is).

Current-session identification detail: the server can identify a session **only**
when the client presents the refresh token (i.e. during refresh or if we add a
revocation route that accepts the raw token). The access JWT alone cannot be
mapped to a specific `RefreshToken` row. "Revoke current session only" and "sign
out all other sessions" therefore require an additive `sid`/`jti` binding in the
access token and/or exposing the `RefreshToken.id` as a session identifier.

---

## 6. Existing frontend capabilities

- **Account page** (`/dashboard/settings/account`) is fully interactive for MFA
  via `SecuritySection.tsx` — a self-contained state machine that fetches
  authoritative `/mfa/status` + `/mfa/recovery-codes/status`, refetches after
  every mutation, and renders per-row loading/error/retry. Password and Active
  sessions rows render honest **"Not available in this release."** badges
  (`SecuritySection.tsx:233-243`); the account-page spec asserts those strings
  (`account-page.spec.tsx:272-273`).
- **`auth-client.ts`** — `apiFetch` with single-flight refresh + retry
  (`refreshSession`), definitive-invalid handling (`invalidateSession`), explicit
  `logout()`. Tokens live in `localStorage` (access + refresh) — the documented
  SPA trade-off (ACC-AUDIT-02A §20 #5; `auth-client.ts:41-65`).
- **Route protection** — no Next.js `middleware.ts`; the dashboard shell uses
  `useSessionGuard` (30 s tick) that transparently renews access tokens and only
  redirects to `/login` when the refresh session is definitively invalid
  (`useSessionGuard.ts:29-62`; `dashboard/layout.tsx:34`).
- **Error handling** — typed error-mapping pattern exists and is test-verified
  (`mfa-errors.ts`: backend copy only for 400/401/403/404/409, calm copy for
  429/5xx/network/unknown, AbortError → cancelled). `account-client.ts` exposes
  `readError`. A password/session client should reuse this pattern.
- **Org context** — membership/role rendered from `/organizations/current`; no
  fabricated identity.

**What UI can be implemented truthfully now:**
- Password change UI — buildable immediately against the ACC-SEC-02D2 backend
  (current-password + new-password form; the reauth contract and error mapping
  are already proven).
- Re-authentication for sensitive ops — already live (MFA flows); no new UI
  needed beyond what exists.

**What must remain unavailable until ACC-SEC-02D2 backend exists:**
- Session listing, single-session revocation, sign-out-others. There is no
  endpoint, no session identifier, and no metadata — any UI would fabricate.
  Keep the honest "Not available" rows (current behavior, test-asserted).

---

## 7. Production-ready capabilities

1. Password hashing + verification (bcrypt, cost 10) — `VERIFIED_THIS_RUN`.
2. Server-authoritative current-password re-authentication
   (`ReauthenticationService`, deterministic 401, no enumeration, structured
   event) — `VERIFIED_THIS_RUN` (mfa suites).
3. Access token lifecycle (15 m JWT, membership-revalidated per request) —
   `VERIFIED_THIS_RUN`.
4. Refresh token lifecycle (7 d, single-use CAS rotation, membership-bound,
   revoked on logout) — `VERIFIED_THIS_RUN` (`session-refresh.spec.ts`).
5. All-session logout (backend revoke-all + web local cleanup + socket
   disconnect) — `VERIFIED_THIS_RUN`.
6. Tenant isolation and self-scoping of account operations (`req.user.sub`) —
   `VERIFIED_THIS_RUN`.
7. Secret logging hygiene (redaction in structured logger, request logging has
   no body, boot error redaction) — `INFERRED_FROM_CODE`.
8. Honest unsupported-state UI (password/session rows) — `VERIFIED_THIS_RUN`
   (web suite).

---

## 8. Partial capabilities

| Capability | What exists | What is missing |
|------------|-------------|-----------------|
| Re-authentication for sensitive operations | Server-authoritative password verification; wired into MFA disable + recovery codes; throttled 5/60 s | Not yet applied to password change or account deletion; no "recently re-authenticated" session state (deliberate — stateless per call) |
| Password policy | 8–128 char enforced at signup | No complexity, breached-password, or reuse checks (intentionally minimal per NIST guidance) |
| Logout semantics | Revokes all sessions | No single-session or "all other sessions" variant |
| Audit / security events | Structured events `reauthentication_failed`, `mfa_*`; `AuditLog` org-scoped write path | No login/logout/refresh/password-change/session-revocation events; no account-level audit rows |
| Security audit history | `AuditLog` model + org-scoped query/export (`GET /audit/logs`) | No account/security self-service view; no account events written |

---

## 9. Missing capabilities

- Authenticated password change (endpoint, service, DTO, UI, tests).
- Forgot / reset password (token model, hashed token, expiry, email delivery —
  requires an email provider decision).
- Session listing endpoint with truthful metadata.
- Single-session revocation.
- Sign out all other sessions (keep current).
- Revoke current session only (logout is all-or-nothing).
- Immediate access-token revocation (`jti`/`sid` binding or denylist).
- Session metadata capture (IP, user-agent, device, lastUsedAt) at login/refresh.
- Refresh-token hashing at rest.
- Reused-password protection.
- Failed-login lockout and failed-login audit rows.
- Account-level audit history (login, logout, password changes, session
  revocations) for self-service display.
- `@Throttle` on `/auth/logout`.

---

## 10. Ordered security risks with severity

Severity calibrated to the repo's existing convention (a DB leak vs. a stale
window vs. enumeration vs. SPA storage) and consistent with ACC-AUDIT-02A where
the same finding persists.

| # | Severity | Risk | Evidence | Status |
|---|----------|------|----------|--------|
| 1 | **MEDIUM (HIGH impact)** | **Refresh tokens stored plaintext at rest.** A DB read yields live 7-day session credentials that can mint unlimited access tokens. | `auth.service.ts:339-347`, `schema.prisma:150-159`; equality lookup `auth.service.ts:246` | Open (also ACC-AUDIT-02A #4) |
| 2 | **MEDIUM** | **Account enumeration via signup.** `409 "Email already in use"` vs generic login 401 reveals registered emails. Throttled 3/300 s per-IP but not removed. | `auth.service.ts:69-72` vs `130,136` | Open (also ACC-AUDIT-02A #1) |
| 3 | **MEDIUM** | **Revocation is not immediate.** A revoked/logged-out session's access token stays valid up to 15 m; no `jti`/`sid` binding, no denylist. Password change (when added) must account for this. | stateless JWT `auth.service.ts:333-337`; no revocation list | Open (by design; must be documented for 02D2) |
| 4 | **LOW-MEDIUM** | **Access + refresh tokens in `localStorage`** — any same-origin XSS reads a 7-day session credential. Documented SPA trade-off. | `auth-client.ts:41-65` | Open (architecture decision, ACC-AUDIT-02A §22) |
| 5 | **LOW** | **No password-rotation path exists** — a compromised password cannot be changed; and no session visibility means rogue sessions are undetectable. | grep zero matches; UI honest-not-available | Open (02D2 scope) |
| 6 | **LOW** | **Un-throttled `/auth/logout`; no failed-login lockout; no login/logout audit rows.** Credential-stuffing relies on IP throttle only; no evidence trail. | `auth.controller.ts:43-47`; no `AuditLog` producers in auth | Open |
| 7 | **LOW** | **No re-authentication on account deletion** (literal `"DELETE"` only) — documented trade-off (ACC-AUDIT-02A §20 #7), revisit now that reauth exists. | `account-deletion.service.ts` | Open (decision) |

Not raised: no CSRF exposure beyond the SPA baseline (Bearer header model + CORS
origin allowlist, no cookies — `main.ts:56-64`); refresh rotation race is
handled (CAS, tested); cross-tenant session access is closed (membership-
authoritative, suites green).

---

## 11. Test evidence (exact commands and results)

All suites were executed during this audit on branch
`audit/acc-sec-02d1-password-sessions` against the local test PostgreSQL
container (`techfusion-test-postgres`, up/healthy). All PASS — `VERIFIED_THIS_RUN`.

| # | Command | Suites | Tests | Result |
|---|---------|--------|-------|--------|
| 1 | `pnpm --filter @techfusion/api-gateway test -- --testPathPatterns "auth.spec\|session-refresh\|account-summary\|account-deletion\|membership-authoritative\|membership-schema"` | 7 (`auth.spec`, `ws-auth.spec`, `session-refresh`, `account-summary`, `account-deletion`, `membership-authoritative`, `membership-schema`) | 102 | PASS |
| 2 | `pnpm --filter @techfusion/api-gateway test -- --testPathPatterns "cross-tenant-isolation\|tenant-isolation-security\|rbac-permissions\|mfa-security\|mfa-recovery"` | 5 | 103 | PASS |
| 3 | `pnpm --filter @techfusion/web test -- --testPathPatterns "account-page\|security-section\|auth-client\|use-session-guard\|mfa"` | 6 (`account-page`, `security-section`, `auth-client`, `use-session-guard`, `mfa-client`, `mfa-errors`) | 116 | PASS |
| 4 | `pnpm --filter @techfusion/api-gateway lint` (`tsc --noEmit`) | — | — | PASS |
| 5 | `pnpm --filter @techfusion/web lint` (`tsc --noEmit`) | — | — | PASS |
| 6 | `git diff --check` | — | — | clean |
| **Total** | **18 suites / 321 tests** | | | **all PASS** |

Notes:
- Test DB migrations applied automatically via `test/setup.ts`; the
  `PresenceSweepSchedulerService` Redis log lines and `ws-auth` gateway warnings
  are known test-environment noise and do not affect results.
- Coverage observed directly relevant to this audit: session rotation chain +
  race (`session-refresh.spec.ts`), logout revocation, membership-removal
  revocation, org-switch binding, reauth-driven MFA flows (`mfa-recovery.spec.ts`),
  tenant isolation (`cross-tenant-isolation.spec.ts`, `tenant-isolation-security.spec.ts`),
  honest unsupported-state UI (`account-page.spec.tsx:272-273`).
- **Missing coverage (feature absent, so no tests exist):** password change,
  password reset, session listing, single-session revocation, sign-out-others,
  revoke-current, refresh-token hashing at rest, account-level audit events,
  failed-login lockout.
- The V1 gate (`scripts/ci-v1-gate.sh`) was **not** run — no cross-cutting or
  schema change is made by this audit-only stage (per `AGENTS.md` work-loop rule
  12). Production build not run (no code changed).

---

## 12. Capability matrix

| Capability | Backend | Database | API | UI | Tests | Verdict |
|------------|:-------:|:--------:|:---:|:--:|:-----:|---------|
| bcrypt password hashing | ✅ | ✅ | ✅ | — | ✅ | PRODUCTION_READY |
| Current-password re-authentication | ✅ | ✅ | ✅ | ✅ | ✅ | PRODUCTION_READY |
| Authenticated password change | ❌ | ✅ (col exists) | ❌ | ❌ (honest off) | ❌ | MISSING → 02D2 |
| Forgot / reset password | ❌ | ❌ (no token model) | ❌ | ❌ | ❌ | MISSING → DEFER |
| Password policy (8–128) | ✅ | ✅ | ✅ | ✅ | ✅ | FUNCTIONAL |
| Reused/breached-password check | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING → DEFER |
| Access token lifecycle (15 m JWT) | ✅ | — | ✅ | ✅ | ✅ | PRODUCTION_READY |
| Refresh token + CAS rotation | ✅ | ✅ | ✅ | ✅ | ✅ | PRODUCTION_READY |
| Refresh token hashed at rest | ❌ | ⚠️ (hash fits existing column) | ❌ | — | ❌ | MISSING → 02D2 |
| Authoritative session row | ✅ | ✅ | — | — | ✅ | PRODUCTION_READY |
| Session metadata (IP/UA/device/lastUsed) | ❌ | ❌ | ❌ | ❌ | ❌ | MISSING → 02D2 (migration) |
| List active sessions | ❌ | ⚠️ | ❌ | ❌ (honest off) | ❌ | MISSING → 02D2 |
| Revoke one session | ❌ | ⚠️ | ❌ | ❌ | ❌ | MISSING → 02D2 |
| Sign out all other sessions | ❌ | ⚠️ | ❌ | ❌ | ❌ | MISSING → 02D2 |
| Revoke current session | ⚠️ (logout = all) | ✅ | ❌ | ❌ | ❌ | PARTIAL → 02D2 |
| Immediate access-token revocation | ❌ | ⚠️ | ❌ | ❌ | ❌ | MISSING → DEFER (decision) |
| All-session logout | ✅ | ✅ | ✅ | ✅ | ✅ | PRODUCTION_READY |
| Re-auth for sensitive ops (MFA) | ✅ | ✅ | ✅ | ✅ | ✅ | PRODUCTION_READY |
| Account-level audit history | ❌ | ✅ (AuditLog) | ⚠️ | ❌ | ❌ | PARTIAL → 02D2 |
| Tenant isolation | ✅ | ✅ | ✅ | — | ✅ | PRODUCTION_READY |

Legend: ✅ present/working · ⚠️ partial · ❌ missing · — not applicable.

---

## 13. Feature verdicts

| Proposed feature | Verdict | Rationale |
|------------------|---------|-----------|
| Change password | **GO (into 02D2)** | All backend blocks exist and are tested: bcrypt, server-authoritative reauth, throttling pattern, structured events. Additive work only: endpoint + DTO + revocation semantics + tests. UI can be truthful immediately. |
| Forgot / reset password | **DEFER** | Requires a new token model + expiry + email-delivery infrastructure + a founder decision on the email provider; no email subsystem exists anywhere. Not a 02D2 item. |
| List active sessions | **GO (into 02D2)** | Backend foundation feasible now: expose `RefreshToken` rows (id/sessionId, createdAt, expiresAt, revokedAt) with current-session flag; truthful metadata (lastUsedAt/IP/UA) needs the additive migration. |
| Revoke one session | **GO (into 02D2)** | Feasible with the existing CAS/`revokedAt` machinery once a session identifier is exposed. |
| Sign out all other sessions | **GO (into 02D2)** | One `updateMany where userId, revokedAt null, id != current` — small; requires current-session binding (access-token `sid` claim). |
| Revoke current session | **PARTIAL → GO (into 02D2)** | Logout revokes *all*; current-only revocation needs the `sid` binding. Implement as `DELETE /auth/sessions/current` (or a `current` flag). |
| Re-authentication for sensitive operations | **GO** | Already implemented and test-verified for MFA; extend to password change (02D2) and optionally account deletion (decision D6 note). |
| Security audit history | **GO (backend, into 02D2)** | `AuditLog` infra exists; add account/security events (password_changed, session_revoked, login/logout) as producers; self-service viewer is a follow-on UI item. |

---

## 14. Recommended ACC-SEC-02D2 scope — Password & Active Sessions Backend Foundation

### In scope (backend, additive, no runtime UI fabrication)

1. **`POST /auth/change-password`** — authenticated; `currentPassword` verified
   via `ReauthenticationService.verifyPassword` (server-authoritative,
   deterministic 401 `'Current password is incorrect'`, no enumeration);
   `newPassword` validated `@MinLength(8) @MaxLength(128)`; update
   `User.passwordHash` (bcrypt cost 10). **Revocation semantics (decision
   needed, default = revoke all sessions including current, forcing re-login —
   the safest for a password rotation):** revoke all active `RefreshToken` rows
   for the user and issue a fresh token pair in the same transaction (client
   stays signed in) OR revoke all and force login (simple, truthful). Audit:
   structured `password_changed` + `AuditLog` row.
2. **`GET /auth/sessions`** — list active (self, `revokedAt null` +
   `expiresAt > now`) sessions: `[{ sessionId, createdAt, expiresAt, lastUsedAt?,
   ipAddress?, userAgent?, deviceName?, current }]`. **Never returns `token`
   material.** `current` derived from the requesting session's `sid`.
3. **`DELETE /auth/sessions/:sessionId`** — revoke one (self only; 404 if not
   owned/not found; 409 if already revoked; 400 if `current` and revocation
   would kill the live session — or allow with forced logout, decide). CAS on
   `{id, revokedAt null}`. Audit `session_revoked`.
4. **`DELETE /auth/sessions`** (or `POST /auth/sessions/revoke-others`) —
   revoke all **except** the current session. CAS `updateMany where { userId,
   revokedAt null, id != current }`. Audit `sessions_revoked_others`.
5. **Current-session binding** — add an additive `sid` (session id = the
   `RefreshToken.id`) claim to the access JWT and return `sessionId` in the
   login/refresh/change-password responses. Additive JWT claim is backward
   compatible (old tokens simply lack it → `current` unknown until next
   refresh).
6. **Refresh-token hashing at rest (no migration)** — store SHA-256 of the
   opaque value in the existing `token` column (same verifier-only pattern as
   `deviceTokenHash`/`tokenHash` used for invitations/enrollment, decisions D16
   lineage); lookup becomes `findUnique({ token: sha256(raw) })`; raw value
   returned to the client once. All refresh/lookup/rotation/revocation paths
   switch together; historical plaintext rows readable + upgraded on next
   successful refresh (mirror of the MFA legacy-upgrade pattern, D28).
7. **Account security audit events** — add `AuditLog` producers (or structured
   events where no org scope applies) for: password change, session revoked,
   sessions revoked, login success/failure, logout. Self-service viewer is NOT
   in 02D2.
8. **Re-authentication extension** — require current password (reuse P3) for
   change-password; optionally add to account deletion as a separate decision.
9. **Throttles** — change-password and session-mutation routes use a strict
   throttle (5/60 s pattern via a strict helper like `mfaThrottle()`); session
   listing 30/60 s; add `@Throttle` to `/auth/logout`.
10. **Tests** — new failing-then-passing suites: `password-change.spec.ts`
    (policy, wrong current password 401/no-enumeration, forged `userId` ignored,
    token revocation semantics, audit event), `sessions.spec.ts` (list shape +
    no-token-material, revoke-one 404/409/self-only, revoke-others keeps
    current, revoke-current, cross-tenant isolation, concurrency), refresh-hash
    migration-adjacent tests (legacy plaintext upgrade).

### Out of scope (documented, not built)
- Forgot/reset password (DEFER — §18), email verification, avatar,
  breached-password check, account lockout, immediate access-token denylist,
  session viewer UI page (follow-on), password history.

---

## 15. Database decision

**MIGRATION REQUIRED** (for the full 02D2 session-management scope).

Components split:
- Password change — **NO MIGRATION** (`User.passwordHash` already exists).
- Refresh-token hashing at rest — **NO MIGRATION** (SHA-256 fits the existing
  `token` column).
- Session listing with truthful metadata + current-session binding — **MIGRATION
  REQUIRED** (additive columns below).

Proposed additive fields and indexes (documentation only — **no migration
created**):

```prisma
model RefreshToken {
  // ...existing fields...
  lastUsedAt  DateTime?   // updated on every successful refresh
  ipAddress   String?
  userAgent   String?
  deviceName  String?     // client-declared, optional, length-bounded
  // @@index([userId, revokedAt])  // session list lookups
}
```

Optional (document, decide): a `User.passwordChangedAt DateTime?` for
audit/history semantics; a `PasswordResetToken` model is NOT recommended now
(02D2 does not include reset). All additions are nullable/additive and backward
compatible with shipped refresh-token rows (per AGENTS.md principle 9).

---

## 16. Recommended API contract (ACC-SEC-02D2)

### `POST /auth/change-password`
- **Auth:** authenticated (JWT + membership). Identity from `req.user.sub` only; body `userId` forbidden (whitelist strips it).
- **Throttle:** strict 5/60 s (per-IP, like `mfaThrottle()`).
- **Request DTO:** `{ currentPassword: string, newPassword: string }` — `newPassword` `@IsString @MinLength(8) @MaxLength(128)`; `currentPassword` `@IsNotEmpty`.
- **Response 200:** `{ message: string, accessToken?, refreshToken? }` if reissue-on-change chosen; else `{ message: string }`.
- **Deterministic errors:**
  - `401 Unauthorized { message: 'Current password is incorrect' }` — wrong/absent current password; identical for unknown user (no enumeration).
  - `400 Bad Request { message: 'New password must be 8-128 characters' }` — policy violation.
  - `429 Too Many Requests` — throttle.
- **Reuse:** `ReauthenticationService.verifyPassword(userId, currentPassword)`.
- **Invalidation:** default = revoke ALL refresh rows for the user in the same transaction as the hash update, then (option A) issue a fresh pair, or (option B) force re-login. Access tokens remain valid ≤15 m (documented residual; a denylist is out of scope).
- **Audit:** structured `password_changed`; `AuditLog` row `{ orgId, action: 'password_changed', actorId }`.

### `GET /auth/sessions`
- **Auth:** authenticated. **Throttle:** 30/60 s.
- **Response 200:** `{ sessions: [{ sessionId, createdAt, expiresAt, lastUsedAt?, ipAddress?, userAgent?, deviceName?, current }] }` — active only (`revokedAt null`, `expiresAt > now`); **no token material.**
- **Errors:** `401` unauthenticated.

### `DELETE /auth/sessions/:sessionId`
- **Auth:** authenticated. **Throttle:** strict 10/60 s.
- **Response 200:** `{ message: 'Session revoked' }`.
- **Deterministic errors:** `404 SESSION_NOT_FOUND` (not owned/unknown — no enumeration of other users' sessions), `409 SESSION_ALREADY_REVOKED`, `400` if target is the current session and self-revocation is disallowed (decide), `401` unauthenticated.
- **Invariant:** CAS `updateMany where { id, userId, revokedAt: null }` → count 0 ⇒ 404/409.

### `DELETE /auth/sessions` — sign out all other sessions
- **Auth:** authenticated. **Throttle:** strict 5/60 s.
- **Response 200:** `{ message: 'All other sessions signed out', revokedCount }`.
- **Invariant:** `updateMany where { userId, revokedAt null, id != currentSessionId }`; current session untouched. Access tokens of revoked sessions die ≤15 m (documented).

### `DELETE /auth/sessions/current` (optional but recommended)
- Revokes only the current session; response forces the client to clear tokens and redirect to `/login`.
- **Audit events:** `session_revoked`, `sessions_revoked_others`, `session_revoked_current`.

Rate-limit constants: add a strict `sessions` limit set next to `STRICT_RATE_LIMITS.mfa` (same provable-in-test pattern).

---

## 17. Recommended frontend contract (ACC-SEC-02D2 follow-on)

Build **only after** the 02D2 backend lands (no fabricated UI):
- **`lib/password-client.ts`** — `changePassword(currentPassword, newPassword)` → `POST /auth/change-password`; error mapping mirrors `mfa-errors.ts` (backend copy only for 400/401, calm copy for 429/5xx/network).
- **`lib/sessions-client.ts`** — `fetchActiveSessions()`, `revokeSession(sessionId)`, `signOutOtherSessions()`, `revokeCurrentSession()`; typed `ActiveSession { sessionId, createdAt, expiresAt, lastUsedAt?, ipAddress?, userAgent?, deviceName?, current }`.
- **`SecuritySection.tsx`** — replace the two honest "Not available" rows with:
  - *Password*: dialog (current + new + confirm), server-authoritative result, post-change token refresh/relogin per backend contract, never local validation of current password.
  - *Active sessions*: list rows with device/IP/last-used, `current` badge, per-row revoke, "Sign out all other devices", honest loading/error/retry; **no optimistic status** — refetch after every mutation (existing SecuritySection pattern).
- Keep `useSessionGuard`/`apiFetch` refresh flow unchanged; handle the new `sid` claim tolerantly when absent (backward compatible).

---

## 18. Deferred capabilities

- Forgot / reset password — needs token model + email provider; **founder decision** on email infrastructure first (new dependency + schema + external provider).
- Immediate access-token revocation (denylist / short-lived+`jti`) — architectural decision; the 15 m residual window is acceptable for V1 if documented.
- Password complexity/breached-password policy — NIST 8-char minimum already met; defer unless product requires it.
- Per-account lockout — coordinate with throttle design; defer.
- Account deletion re-authentication — decision recorded; now feasible via existing reauth (recommend GO in a later stage).
- Account security audit **viewer** UI — backend events (02D2) first, viewer is a follow-on.
- Token storage strategy (localStorage vs httpOnly cookie) — architecture decision, unchanged by this audit (ACC-AUDIT-02A §22).

---

## 19. Production risks (if ACC-SEC-02D2 ships)

1. **Changing revocation semantics mid-flight** — shipping change-password with all-session revocation will log out the operator's own active sessions; must be handled with the reissue-or-relogin decision and clear UI copy.
2. **Exposing session IDs** — `sessionId` is a non-secret row identifier; ensure no endpoint ever accepts/returns `token`; keep lookup by id + ownership, never by raw token from the client.
3. **Refresh-token hashing migration window** — must keep legacy plaintext rows readable until the next successful refresh upgrades them (mirror D28); a hard switch would lock out every active session.
4. **15 m stale access window** — password change/session revocation must state explicitly that access tokens live up to 15 m; document as an accepted residual (denylist deferred).
5. **Enumeration via session endpoints** — `DELETE /auth/sessions/:sessionId` must return identical 404 for not-owned/unknown to avoid leaking other users' session IDs.
6. **Reauth throttling bypass** — change-password must use a strict (non-test-neutered) throttle so the reauth oracle is not brute-forceable; same proof pattern as `mfaThrottle()`.
7. **Log/audit hygiene** — new events must never include the raw refresh token, new password, or `newPassword` (redaction already covers key names; do not log values).

---

## 20. Final recommendation and implementation order

1. **ACC-SEC-02D2 — Password & Active Sessions Backend Foundation** (per §14–§16): change-password (with reauth + revocation + audit), session list/revoke-one/revoke-others/revoke-current, additive `sid` binding, refresh-token hashing at rest, account security audit events, strict throttles, new test suites. Migration: additive `RefreshToken` metadata columns only (§15).
2. **ACC-UX-02D3 — Password & Sessions UX** (after 02D2): wire SecuritySection password + sessions UI per §17.
3. **Deferred (decision required):** forgot/reset password + email provider; immediate access-token revocation; account-deletion re-authentication; session viewer page.
4. **Independent hardening (any stage):** signup enumeration (generic errors), `/auth/logout` throttle, failed-login audit events — low-cost, reduce the §10 top risks.

Order respects the evidence: everything in step 1 reuses already-tested blocks
(P3 reauth, CAS rotation, membership authority, structured events), so it is
incremental rather than new architecture.

---

## Evidence markers used

- `VERIFIED_THIS_RUN` — confirmed by an executed test or direct command output in this audit (all §11 results, honest-UI assertions, git state).
- `VERIFIED_BY_CURRENT_CI` — not used (V1 gate not run; audit-only, no cross-cutting change).
- `INFERRED_FROM_CODE` — source reads (redaction behavior, guard order, token construction, schema).
- `UNVERIFIED` — none; every claim carries at least one supporting marker.

---

## Stage decision

**GO.** The password/session surface is verified, honest, and free of fabricated
capabilities. All 321 tests across 18 suites pass; lint is clean; no runtime,
schema, migration, dependency, env, push, or production change was made. The
deliverable is this report; ACC-SEC-02D2 scope is defined and must not start in
this stage.

*Report authored by ACC-SEC-02D1 audit stage. Repository state: clean except
this report.*

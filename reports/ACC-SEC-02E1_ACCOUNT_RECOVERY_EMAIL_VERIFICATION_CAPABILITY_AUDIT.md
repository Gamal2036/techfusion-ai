# ACC-SEC-02E1 — Account Recovery & Email Verification Capability Audit

> **Mission type:** SECURITY AND CAPABILITY AUDIT ONLY  
> **Scope:** Password reset, email verification, email change, account recovery across backend, frontend, database schema, tests, infrastructure and documentation.  
> **Date:** 2026-08-18  
> **Branch:** `audit/acc-sec-02e1-account-recovery-email-verification`  
> **Base commit:** `76c5877` (main, origin/main synchronized)

---

## 1. Executive Summary

**Account recovery (forgot/reset password) and email verification are entirely absent from the TechFusion AI codebase.** No backend endpoints, no database models, no migrations, no email sending infrastructure, no frontend pages, and no test coverage exist for any of these capabilities. This is a documented, intentional V1 product decision — every audit report, capability matrix, and decision log consistently marks these as MISSING/DEFERRED.

The existing codebase provides: (1) authenticated password *change* (requires current password), (2) MFA with TOTP and one-time recovery codes, (3) session listing and revocation, and (4) account deletion. None of these constitute account recovery for locked-out users.

**There is no email provider integration anywhere in the repository.** The only email-related code is a log-only stub in the alert notification worker (`[EMAIL] To: admin@techfusion.ai`). No SMTP, SendGrid, Resend, Postmark, SES, Nodemailer, or any mail library exists.

**No security vulnerabilities were found related to password reset or email verification because these features do not exist.** The primary security concern is that a user who forgets their password has **no self-service recovery path** — the only option is direct database intervention or account recreation.

---

## 2. Mission and Non-Goals

**Mission:** Establish the exact real state of account recovery, password reset, email verification, and email-change capabilities.

**Non-Goals:**
- Implementing any missing capability (ACC-SEC-02E2 scope)
- Creating UI controls or frontend pages
- Creating database migrations
- Modifying production data
- Pushing, merging or deploying

---

## 3. Base Commit and Branch

| Item | Value |
|------|-------|
| Branch | `audit/acc-sec-02e1-account-recovery-email-verification` |
| Base commit | `76c58774ae372bb0092ec571b1ddecfd4d17a2be` |
| Base branch | `main` |
| HEAD | `76c5877` (matches origin/main) |
| Working tree | Clean at mission start |

---

## 4. Sources Reviewed

| Source | Path | Relevance |
|--------|------|-----------|
| Engineering constitution | `AGENTS.md` | Mandatory reading, principles, working rules |
| Product requirements | `docs/PRD.md` | Product scope |
| Current state | `docs/tech-lead/00_CURRENT_STATE.md` | Verified baseline, git state, capabilities |
| Web surface map | `docs/tech-lead/03_WEB_SURFACE_MAP.md` | Frontend route inventory |
| Backend capability map | `docs/tech-lead/04_BACKEND_CAPABILITY_MAP.md` | Endpoint and service inventory |
| Security & tenancy review | `docs/tech-lead/07_SECURITY_TENANCY_REVIEW.md` | Security findings and boundaries |
| Feature readiness matrix | `docs/tech-lead/08_FEATURE_READINESS_MATRIX.md` | Feature status classifications |
| Technical debt register | `docs/tech-lead/10_TECHNICAL_DEBT_REGISTER.md` | Known debt items |
| Decision log | `docs/tech-lead/14_DECISION_LOG.md` | Architectural decisions |
| Prior audit reports | `reports/ACC-SEC-02D1*`, `reports/ACC-AUDIT-02A*`, `reports/ACC-SEC-02D2B*`, `reports/ACC-UX-02D3*` | Previous audit findings |
| Auth controller | `apps/api-gateway/src/auth/auth.controller.ts` | Route inventory |
| Auth service | `apps/api-gateway/src/auth/auth.service.ts` | Service implementation |
| Prisma schema | `apps/api-gateway/prisma/schema.prisma` | Database model |
| Rate limits | `apps/api-gateway/src/config/rate-limits.ts` | Throttle configuration |
| Account controller | `apps/api-gateway/src/account/account.controller.ts` | Account profile routes |
| Login form | `apps/web/src/components/login/LoginForm.tsx` | Login UI |
| Security section | `apps/web/src/components/account/SecuritySection.tsx` | Account security UI |
| Notification service | `apps/api-gateway/src/alerts/notification.service.ts` | Email/notification infrastructure |

---

## 5. Repository Discovery Method

Four parallel search agents scanned the entire repository for:
- Password reset / forgot password / reset token / recovery token
- Email verification / verify email / resend verification / email change / pending email
- Mail providers / SMTP / SendGrid / Resend / Postmark / SES / email queue / notification worker
- Auth events / audit events / rate limiting / token hashing / token expiry / enumeration

Each search returned **zero implementation matches** across all directories (`apps/api-gateway`, `apps/web`, `apps/worker`, `apps/agent`, `packages`, `docs`, `scripts`, `infra`). All hits were either negative test assertions, documentation references confirming absence, or unrelated features (device recovery, MFA recovery codes).

---

## 6. Current Architecture

### 6.1 Auth Architecture (Implemented)

```
Frontend (Next.js)
  ├── /login → POST /auth/login → POST /auth/verify-login (MFA)
  ├── /signup → POST /auth/signup
  ├── /dashboard/settings/account → SecuritySection
  │     ├── PasswordChangeDialog → POST /auth/change-password
  │     ├── ActiveSessions → GET /auth/sessions
  │     └── MFA dialogs → POST /mfa/enroll|verify|disable|recovery-codes
  └── auth-client.ts (JWT + refresh rotation)

Backend (NestJS)
  ├── AuthController: 10 routes (4 public, 6 authenticated)
  ├── AuthService: signup, login, verifyLoginMfa, refresh, logout, changePassword, listSessions, revokeSession(s)
  ├── ReauthenticationService: server-authoritative password recheck
  ├── MFA: TOTP enrollment/verify/disable, recovery codes (SHA-256 hashed)
  └── AuditService: structured event logging + AuditLog rows

Database (PostgreSQL/Prisma)
  ├── User (email, passwordHash, isMfaEnabled, mfaSecret, mfaBackupCodes)
  ├── RefreshToken (SHA-256 verifier, sessionId, metadata)
  ├── AuditLog (org-scoped, immutable)
  └── NO reset tokens, NO verification tokens, NO pending email fields

Worker (BullMQ)
  └── Alert notification processor: log-only [EMAIL] stub (no real sending)
```

### 6.2 What Is Missing

```
MISSING — Account Recovery
  ├── No POST /auth/forgot-password
  ├── No POST /auth/reset-password
  ├── No reset token model or generation
  ├── No email sending for reset links
  ├── No frontend /forgot-password page
  └── No frontend /reset-password page

MISSING — Email Verification
  ├── No POST /auth/verify-email
  ├── No POST /auth/resend-verification
  ├── No verification token model or generation
  ├── No emailVerified / emailVerifiedAt field on User
  ├── No email sending for verification
  ├── No frontend /verify-email page
  └── No frontend /resend-verification page

MISSING — Email Change
  ├── No POST /auth/change-email
  ├── No pendingEmail / newEmail field on User
  ├── No confirmation email to old/new address
  └── No frontend change-email UI

MISSING — Email Infrastructure
  ├── No mail provider (SMTP, SendGrid, Resend, Postmark, SES)
  ├── No email sending library (Nodemailer, etc.)
  ├── No email templates
  ├── No email queue
  ├── No notification worker for email
  └── No environment variables for mail configuration
```

---

## 7. Backend Route Inventory

### Auth Controller (`apps/api-gateway/src/auth/auth.controller.ts`)

| Line | Method | Route | Public | Throttle | Purpose |
|------|--------|-------|--------|----------|---------|
| 57-62 | POST | `/auth/signup` | Yes | 3/5min | User registration |
| 64-69 | POST | `/auth/login` | Yes | 5/min | Email+password login |
| 71-76 | POST | `/auth/verify-login` | Yes | 10/min | MFA challenge |
| 78-83 | POST | `/auth/refresh` | Yes | 5/min | Token refresh |
| 85-90 | POST | `/auth/logout` | No | 10/min | Revoke all sessions |
| 94-106 | POST | `/auth/change-password` | No | 20/min | Password change (reauth) |
| 108-113 | GET | `/auth/sessions` | No | 30/min | List sessions |
| 115-123 | DELETE | `/auth/sessions/current` | No | 10/min | Revoke current session |
| 125-133 | DELETE | `/auth/sessions` | No | 10/min | Revoke other sessions |
| 135-139 | DELETE | `/auth/sessions/:sessionId` | No | 10/min | Revoke specific session |

### Account Controller (`apps/api-gateway/src/account/account.controller.ts`)

| Line | Method | Route | Purpose |
|------|--------|-------|---------|
| 22-25 | GET | `/auth/account/summary` | Self-scoped profile |
| 27-30 | PATCH | `/auth/account/summary` | Update display name |
| 32-35 | GET | `/auth/account/deletion-preview` | Preview deletion |
| 37-40 | DELETE | `/auth/account` | Delete account |

**No forgot-password, reset-password, verify-email, resend-verification, or change-email routes exist.**

---

## 8. Service and Module Inventory

| Service | File | Auth Recovery | Email Verification | Email Change |
|---------|------|:---:|:---:|:---:|
| AuthService | `auth.service.ts` | ❌ No forgot/reset methods | ❌ No verification methods | ❌ No email change methods |
| ReauthenticationService | `reauthentication.service.ts` | N/A (reauth for sensitive ops) | N/A | N/A |
| AccountProfileService | `account-profile.service.ts` | ❌ No email verification status | ❌ No email change | ❌ |
| NotificationService | `notification.service.ts` | ❌ No email sending | ❌ No email sending | ❌ |
| MfaService | `mfa.service.ts` | N/A | N/A | N/A |
| RecoveryCodesService | `recovery-codes.service.ts` | N/A (MFA recovery codes only) | N/A | N/A |

---

## 9. Database Model and Migration Inventory

### Prisma Schema (`apps/api-gateway/prisma/schema.prisma`)

**User model (lines 84-105):**
```prisma
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  passwordHash   String
  displayName    String
  isMfaEnabled   Boolean  @default(false)
  mfaSecret      String?
  mfaBackupCodes String?
  ssoId          String?
  ssoProvider    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  orgId          String
  org            Organization @relation(fields: [orgId], references: [id])
  role           Role     @default(Viewer)
  refreshTokens  RefreshToken[]
  memberships    OrganizationMember[]
  @@unique([orgId, email])
}
```

**Missing fields for recovery/verification:**
- `emailVerified` / `emailVerifiedAt` — absent
- `pendingEmail` / `newEmail` — absent
- `emailVerificationToken` — absent
- `passwordResetToken` / `passwordResetAt` — absent

**No dedicated token models exist for:**
- Password reset tokens
- Email verification tokens
- Email change confirmation tokens

**All 21 migration files reviewed:** None contain email verification or password reset schema changes.

### Token Lifecycle Assessment

| Token Type | Model | Hashed | High Entropy | Expiry | Single-Use | Atomic | Tested |
|-----------|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Password reset | **N/A — DOES NOT EXIST** | — | — | — | — | — | — |
| Email verification | **N/A — DOES NOT EXIST** | — | — | — | — | — | — |
| Email change confirmation | **N/A — DOES NOT EXIST** | — | — | — | — | — | — |
| Refresh token | `RefreshToken` | SHA-256 verifier | Yes (96-hex) | 7d enforced | Yes (CAS) | Yes | Yes |
| Enrollment token | `EnrollmentToken` | SHA-256 | Yes | Configurable | Yes | Yes | Yes |
| Invitation token | `OrganizationInvitation` | SHA-256 (`tokenHash`) | Yes | Configurable | Yes | Yes | Yes |
| MFA recovery code | `User.mfaBackupCodes` | SHA-256 hashed | 80 bits/code | None (infinite) | Yes (atomic) | Yes | Yes |

---

## 10. Frontend Route and Component Inventory

### Existing Auth-Related Routes

| Route | Component | Purpose | Password Reset | Email Verification |
|-------|-----------|---------|:---:|:---:|
| `/login` | `LoginForm.tsx` | Sign in | **No forgot-password link** | N/A |
| `/signup` | Signup page | Register | N/A | **No email verification step** |
| `/dashboard/settings/account` | `SecuritySection.tsx` | Profile + security | **No reset-password link** | **No email verification status** |

### Login Form Analysis (`apps/web/src/components/login/LoginForm.tsx`)

- **Lines 361-369:** After the password field and submit button, the only link is "Don't have an account? Sign up"
- **No "Forgot password?" link exists** — confirmed by negative test at `login-page.spec.tsx:765-768`
- **No email verification banner or prompt exists** — confirmed by negative assertion at `account-page.spec.tsx:296`

### SecuritySection Analysis (`apps/web/src/components/account/SecuritySection.tsx`)

- MFA enrollment/disable/recovery codes: **fully interactive** (ACC-UX-02C)
- Password change dialog: **fully interactive** (ACC-UX-02D3)
- Active sessions: **fully interactive** (ACC-UX-02D3)
- Email verification status: **absent** (no UI element, no backend field)
- Forgot password link: **absent**
- Email change UI: **absent**

---

## 11. Mail-Provider and Worker Inventory

### Mail Provider Status

| Provider | Dependency | Import | Usage | Status |
|----------|:---:|:---:|:---:|:---:|
| Nodemailer | ❌ | ❌ | ❌ | NOT INSTALLED |
| SendGrid | ❌ | ❌ | ❌ | NOT INSTALLED |
| Resend | ❌ | ❌ | ❌ | NOT INSTALLED |
| Postmark | ❌ | ❌ | ❌ | NOT INSTALLED |
| AWS SES | ❌ | ❌ | ❌ | NOT INSTALLED |
| Mailgun | ❌ | ❌ | ❌ | NOT INSTALLED |

### Environment Variables for Mail

**No mail-related environment variables exist.** `env.validation.ts` validates JWT, refresh, encryption, and AI keys only.

### Worker Email Infrastructure

| File | Line | Content | Status |
|------|------|---------|:---:|
| `apps/worker/src/processors.ts` | 64 | `log.log('[EMAIL] To: admin@techfusion.ai Subject: Alert - ${rule.name}')` | LOG-ONLY STUB |
| `apps/api-gateway/src/alerts/notification.service.ts` | 1-34 | Webhook-only notification service, no email logic | NO EMAIL |

---

## 12. Forgot-Password Capability

**Classification: MISSING**

| Property | Status | Evidence |
|----------|:---:|---------|
| Backend endpoint | ❌ | Zero matches for `forgot-password`, `forgotPassword`, `resetPassword` across all source |
| Token model | ❌ | No `PasswordResetToken` in schema; no migration |
| Token generation | ❌ | No token generation code |
| Token hashing | ❌ | No implementation |
| Token expiry | ❌ | No implementation |
| Single-use consumption | ❌ | No implementation |
| Enumeration protection | ❌ | Not needed (feature absent) |
| Rate limiting | ❌ | Not needed (feature absent) |
| Email delivery | ❌ | No mail infrastructure |
| Frontend page | ❌ | No `/forgot-password` route; negative test confirms absence |
| Test coverage | ❌ | Only negative test: `login-page.spec.tsx:765` asserts link does NOT exist |

---

## 13. Password-Reset Capability

**Classification: MISSING**

| Property | Status | Evidence |
|----------|:---:|---------|
| Backend endpoint | ❌ | Zero matches for `reset-password`, `resetPassword` |
| Token validation | ❌ | No implementation |
| Password update | ❌ | No implementation (only `changePassword` exists, which requires auth) |
| Session revocation on reset | ❌ | Not needed (feature absent) |
| Audit event | ❌ | No `password_reset` event |
| Security notification | ❌ | No notification infrastructure |
| Frontend page | ❌ | No `/reset-password` route |
| Test coverage | ❌ | No tests |

---

## 14. Reset-Token Lifecycle

**Classification: NOT_APPLICABLE (feature absent)**

No reset tokens exist. When implemented, the following properties should be enforced (per this audit's recommendations):

| Property | Current | Required |
|----------|:---:|:---:|
| Token format | N/A | High-entropy random (≥32 bytes) |
| Storage | N/A | SHA-256 hashed only (verifier pattern, like refresh tokens D16/D29) |
| Expiry | N/A | 15-60 minutes, server-enforced |
| Single use | N/A | Atomic consumption (CAS or SELECT FOR UPDATE) |
| User binding | N/A | Token linked to specific user |
| Purpose binding | N/A | Token purpose-tagged (reset vs verification) |
| Old token invalidation | N/A | Invalidate prior tokens on new request |
| Multi-token coexistence | N/A | Either reject or invalidate on new request |

---

## 15. Email-Verification Capability

**Classification: MISSING**

| Property | Status | Evidence |
|----------|:---:|---------|
| Verification token model | ❌ | No `EmailVerificationToken` in schema |
| Token generation | ❌ | No implementation |
| Token validation endpoint | ❌ | No `POST /auth/verify-email` route |
| Resend endpoint | ❌ | No `POST /auth/resend-verification` route |
| User.emailVerified field | ❌ | `User` model has no such field |
| Signup enumeration protection via verification gate | ❌ | Signup issues tokens immediately, no verification gate |
| Frontend page | ❌ | No `/verify-email` route |
| Test coverage | ❌ | Only negative test: `account-page.spec.tsx:296` asserts "email verified" text does NOT appear |

---

## 16. Verification-Resend Capability

**Classification: MISSING**

No resend endpoint exists. No verification flow exists to resend to.

---

## 17. Email-Change Capability

**Classification: MISSING**

| Property | Status | Evidence |
|----------|:---:|---------|
| Change-email endpoint | ❌ | No `POST /auth/change-email` or similar |
| Current-password reauthentication for email change | ❌ | Not implemented (reauthentication service exists but is not wired to email change) |
| Pending email state | ❌ | `User` model has no `pendingEmail` field |
| New-address verification | ❌ | Not implemented |
| Old-address notification | ❌ | Not implemented |
| Uniqueness conflict handling | ❌ | Not implemented |
| Audit event | ❌ | No `email_changed` event |

---

## 18. Reauthentication Capability

**Classification: PRODUCTION_READY (for password change; not wired to email change)**

| Property | Status | Evidence |
|----------|:---:|---------|
| Service exists | ✅ | `ReauthenticationService.verifyPassword()` — `reauthentication.service.ts:39-48` |
| Server-authoritative | ✅ | Identity from JWT `req.user.sub`, not body |
| Enumeration protected | ✅ | Deterministic 401 `'Current password is incorrect'` for both wrong-user and wrong-password |
| Audit event | ✅ | `reauthentication_failed` with reason |
| Wired to password change | ✅ | `auth.service.ts:373` |
| Wired to email change | ❌ | Email change not implemented |
| Wired to MFA disable | ✅ | `mfa.service.ts` uses `reauth.verifyPassword()` |

---

## 19. Session-Revocation Behavior

**Classification: PRODUCTION_READY (for password change and user-initiated revoke)**

| Property | Status | Evidence |
|----------|:---:|---------|
| Revoke all on password change | ✅ | `auth.service.ts:387-390` — atomic `updateMany` in `$transaction` |
| Revoke one session | ✅ | `DELETE /auth/sessions/:sessionId` — CAS updateMany, idempotent |
| Revoke other sessions | ✅ | `DELETE /auth/sessions` — CAS updateMany |
| Revoke current session | ✅ | `DELETE /auth/sessions/current` — CAS updateMany + client `clearTokens()` + redirect |
| Revoke all on logout | ✅ | `auth.service.ts:353-356` |
| Audit events | ✅ | `session_revoked`, `sessions_revoked_others`, `session_revoked_current` |
| Revocation on password reset | ❌ | Password reset not implemented |
| Revocation on email change | ❌ | Email change not implemented |

---

## 20. MFA and Recovery Interaction

**Classification: PRODUCTION_READY**

| Property | Status | Evidence |
|----------|:---:|---------|
| TOTP enrollment/verify/disable | ✅ | `mfa.service.ts` — encrypted at rest (`enc:v1:`), throttled 5/60s |
| Recovery codes (one-time, hashed) | ✅ | `recovery-codes.service.ts` — SHA-256, atomic consumption |
| Recovery login challenge | ✅ | `POST /auth/verify-login` accepts `recoveryCode` |
| MFA bypass during password reset | N/A | Password reset not implemented |
| MFA interaction with email verification | N/A | Email verification not implemented |

---

## 21. Enumeration Analysis

### Login — PROTECTED
- `auth.service.ts:148-157`: Both "user not found" and "wrong password" return identical `'Invalid email or password'`
- Same response time for both paths (bcrypt compare runs on non-existent user hash fallback? No — short-circuit on user-not-found. **Finding: timing difference possible** — see §27)

### Reauthentication — PROTECTED
- `reauthentication.service.ts:39-48`: Both cases return identical `'Current password is incorrect'`

### Signup — INTENTIONALLY ENUMERATING
- `auth.service.ts:90-93`: `409 Conflict 'Email already in use'` — intentional for signup

### Forgot Password — NOT APPLICABLE (feature absent)
- When implemented, must return identical response for existing and unknown emails

### Email Verification — NOT APPLICABLE (feature absent)
- When implemented, must not reveal whether an email is registered

---

## 22. Rate-Limit Analysis

| Route | Throttle | Test-Neutered | Status |
|-------|----------|:---:|:---:|
| `POST /auth/signup` | 3/5min | Yes (999999) | Present |
| `POST /auth/login` | 5/min | Yes (999999) | Present |
| `POST /auth/verify-login` | 10/min | Yes (999999) | Present |
| `POST /auth/refresh` | 5/min | Yes (999999) | Present |
| `POST /auth/logout` | 10/min | Yes (999999) | Present |
| `POST /auth/change-password` | 20/min | **No** | Present, enforced in tests |
| `GET /auth/sessions` | 30/min | **No** | Present, enforced in tests |
| `DELETE /auth/sessions/*` | 10/min | **No** | Present, enforced in tests |
| `POST /mfa/*` | 5/min | **No** | Present, enforced in tests |
| `POST /auth/forgot-password` | N/A | — | **MISSING (feature absent)** |
| `POST /auth/reset-password` | N/A | — | **MISSING (feature absent)** |
| `POST /auth/verify-email` | N/A | — | **MISSING (feature absent)** |
| `POST /auth/resend-verification` | N/A | — | **MISSING (feature absent)** |

---

## 23. Error and Logging Safety

### Log Redaction
- `apps/api-gateway/src/main.ts:100-103`: Boot error log sanitization replaces `password|passwd|token|secret=` values
- `apps/worker/src/structured-logger.ts:20,29`: General secret redaction for `password|secret|token|authorization|bearer|api_key`
- `apps/api-gateway/src/common/structured-logger.ts:61-108`: Comprehensive key+value redaction

### Internal Error Disclosure
- MFA decryption failure: `throw new InternalServerErrorException('MFA verification unavailable')` — generic message, no leak (`auth.service.ts:238`)
- Login failures: Deterministic `UnauthorizedException` with safe messages
- No stack traces returned to clients in production

### Assessment
**Logging is safe.** No secret material is logged in auth paths. The log-only `[EMAIL]` stub in the worker contains no sensitive data.

---

## 24. Audit Events and Notifications

### Existing Auth Audit Events

| Event | Structured Log | AuditLog Row | Source |
|-------|:---:|:---:|---------|
| `password_changed` | ✅ | ✅ | `auth.service.ts:412-418` |
| `session_revoked` | ✅ | ✅ | `auth.service.ts:492-503` |
| `sessions_revoked_others` | ✅ | ✅ | `auth.service.ts:522-533` |
| `session_revoked_current` | ✅ | ✅ | `auth.service.ts:558-569` |
| `reauthentication_failed` | ✅ (warn) | ❌ | `reauthentication.service.ts:40,46` |
| `mfa_enrollment_started` | ✅ | ❌ | `mfa.service.ts` |
| `mfa_enabled` | ✅ | ❌ | `mfa.service.ts` |
| `mfa_disabled` | ✅ | ❌ | `mfa.service.ts` |
| `mfa_verification_failed` | ✅ (warn) | ❌ | `auth.service.ts`, `mfa.service.ts` |
| `mfa_recovery_codes_generated` | ✅ | ❌ | `recovery-codes.service.ts` |
| `mfa_recovery_code_used` | ✅ | ❌ | `auth.service.ts`, `mfa.service.ts` |

### Missing Events (for future implementation)

| Event | Status |
|-------|:---:|
| `password_reset_requested` | ❌ MISSING |
| `password_reset_completed` | ❌ MISSING |
| `email_verification_sent` | ❌ MISSING |
| `email_verified` | ❌ MISSING |
| `email_change_requested` | ❌ MISSING |
| `email_change_confirmed` | ❌ MISSING |
| `login_success` | ❌ MISSING (only structured log, no AuditLog row) |
| `login_failure` | ❌ MISSING (only structured warn, no AuditLog row) |
| `logout` | ❌ MISSING (only structured log, no AuditLog row) |

---

## 25. Automated-Test Evidence

### Tests Executed

| Suite | File | Tests | Status | Evidence |
|-------|------|:---:|:---:|---------|
| Login page | `apps/web/src/__tests__/login-page.spec.tsx` | 35 | ✅ PASS | Includes negative test: no "Forgot password" link (line 765) |
| Account page | `apps/web/src/__tests__/account-page.spec.tsx` | 27 | ✅ PASS | Includes negative assertion: no "email verified" text (line 296) |
| Security section | `apps/web/src/__tests__/security-section.spec.tsx` | 34 | ✅ PASS | MFA, password change, sessions covered |

### Tests NOT Executed (require database)
- `apps/api-gateway` auth/MFA suites (6 suites / ~108 tests) — timeout in local environment without DB
- Prior certified baselines: api-gateway 64 suites / 1129 tests, web 44 suites / 966 tests, worker 8 suites / 80 tests

### Quality Checks

| Check | Status |
|-------|:---:|
| `pnpm lint` | ✅ 7/7 tasks successful |
| `git diff --check` | ✅ Clean |
| `ci-secret-scan.sh` | ✅ NO SECRETS DETECTED |

---

## 26. Capability Readiness Matrix

| Capability | Classification | Evidence |
|-----------|:---:|---------|
| Forgot-password request | **MISSING** | No endpoint, no token model, no email infrastructure |
| Password-reset completion | **MISSING** | No endpoint, no token validation, no password update path |
| Reset-token storage | **MISSING** | No model in schema, no migration |
| Reset-token expiration | **MISSING** | No implementation |
| Reset-token single use | **MISSING** | No implementation |
| Enumeration protection (forgot-password) | **NOT_APPLICABLE** | Feature absent |
| Request throttling (forgot-password) | **NOT_APPLICABLE** | Feature absent |
| Email delivery | **MISSING** | No mail provider, no sending library, no templates |
| Email verification | **MISSING** | No token model, no endpoint, no User field, no email sending |
| Verification resend | **MISSING** | No verification flow to resend |
| Verification-token lifecycle | **MISSING** | No token model or generation |
| Email change | **MISSING** | No endpoint, no pending state, no confirmation |
| Sensitive-operation reauthentication | **PRODUCTION_READY** | `ReauthenticationService` wired to password change + MFA disable |
| Session revocation after reset | **NOT_APPLICABLE** | Password reset absent |
| MFA recovery interaction | **PRODUCTION_READY** | Recovery codes + recovery login challenge tested |
| Security notifications | **MISSING** | No notification infrastructure for auth events |
| Audit events (account recovery) | **MISSING** | No reset/verification events |
| Frontend recovery experience | **MISSING** | No forgot-password or reset-password pages |
| Frontend verification experience | **MISSING** | No verify-email or resend-verification pages |
| Frontend email-change experience | **MISSING** | No change-email UI |

---

## 27. Security-Risk Register

| # | Severity | Finding | Evidence | Exploit Condition | User Impact | Current Mitigation | Missing Mitigation | Recommended Stage | Blocks V1? |
|---|----------|---------|----------|-------------------|-------------|-------------------|-------------------|:---:|:---:|
| R1 | **HIGH** | **No self-service account recovery.** A user who forgets their password has no recovery path — they must contact support for direct database intervention or account recreation. | Zero matches for forgot/reset password across all source files; all 6+ audit reports confirm MISSING | User forgets password | Complete account lockout; potential data loss if user creates a new account | None | Implement forgot-password + email delivery | ACC-SEC-02E2 | **YES** |
| R2 | **HIGH** | **No email verification.** Accounts are activated immediately at signup with no email ownership verification. Any email address can be registered without proof of ownership. | `auth.service.ts:89-146` — signup creates active account immediately; no verification gate; `User` has no `emailVerified` field | Attacker registers victim's email | Victim cannot use their own email; impersonation risk; org invitation email mismatch | None | Implement email verification at signup | ACC-SEC-02E2 | **YES** |
| R3 | **MEDIUM** | **No email-change capability.** Users cannot change their registered email address, so compromised or outdated emails cannot be corrected. | No `POST /auth/change-email` or similar endpoint; no `pendingEmail` field on `User` | User needs to change email | Stale email persists; if email account is compromised, no way to update contact info | None | Implement email change with verification | ACC-SEC-02E2 | No |
| R4 | **MEDIUM** | **No security notifications for auth events.** Users are not notified of password changes, new sessions, or MFA changes via email. A compromised account could be silently taken over. | `password_changed` event logged to `AuditLog` but no email notification sent; no `NotificationService` integration for auth events | Attacker changes password or enrolls MFA | Victim unaware of account compromise; cannot detect unauthorized access | AuditLog records events (admin can review) | Implement email notifications for sensitive auth events | ACC-SEC-02E2 | No |
| R5 | **MEDIUM** | **Signup enumeration possible via 409 Conflict.** `POST /auth/signup` returns `409 'Email already in use'` for existing emails (`auth.service.ts:90-93`). This reveals whether an email is registered. | `auth.service.ts:90-93` | Attacker submits known email to signup | Reveals which emails have accounts in the system | Intentional for signup UX | Consider rate-limiting signup or using generic response | ACC-SEC-02E2 | No |
| R6 | **LOW** | **Login timing side-channel.** When a user does not exist, `auth.service.ts:150` returns immediately without running `bcrypt.compare`. When the user exists but the password is wrong, `bcrypt.compare` runs (100ms+). This timing difference could reveal whether an email is registered. | `auth.service.ts:148-157` — short-circuit on user-not-found vs bcrypt compare on wrong-password | Attacker measures response time difference | Enumeration of registered emails via timing analysis | Rate limiting (5/min login) limits brute-force | Run dummy bcrypt compare even when user not found | ACC-SEC-02E2 | No |
| R7 | **LOW** | **No account lockout mechanism.** Only rate limiting (5/min) protects against brute-force login. No progressive delay, failed-attempt counter, or account lockout after repeated failures. | No lockout code found; `rate-limits.ts` only defines throttle limits | Attacker distributes login attempts across IPs | Theoretical brute-force risk, mitigated by rate limiting + bcrypt cost 10 | Rate limiting, bcrypt cost 10 | Implement account lockout or progressive delay | Deferred | No |
| R8 | **INFORMATIONAL** | **Billing `returnUrl` not validated server-side.** The Stripe portal `returnUrl` is passed from client to server to Stripe without server-side origin validation (`billing.controller.ts:31-35`). Stripe may enforce its own URL restrictions. | `billing.controller.ts:31-35`, `billing.service.ts:59-66` | Attacker crafts malicious returnUrl | Potential redirect after Stripe portal session (Stripe may block) | Stripe's own URL validation; client always sends `window.location.origin` | Add server-side origin allowlist | Deferred | No |
| R9 | **INFORMATIONAL** | **Test-neutered rate limits for login/signup/refresh.** The `throttle()` function returns 999999 limit in test mode (`rate-limits.ts:4`), meaning rate limiting is not enforced in the test environment. Only `strictThrottle()` and `mfaThrottle()` are enforced in tests. | `rate-limits.ts:3-5` | N/A (test environment only) | Tests cannot prove rate-limit enforcement for login/signup | Only affects test environment | Consider using `mfaThrottle()` pattern for all auth routes | Deferred | No |

---

## 28. Documentation vs. Code Conflicts

| Document | Claim | Code Reality | Conflict? |
|----------|-------|-------------|:---:|
| `00_CURRENT_STATE.md` | "avatar, email verification, last-login deferred (no backend fields)" | ✅ Confirmed: `User` has no such fields | No |
| `08_FEATURE_READINESS_MATRIX.md` | "avatar, email verification, last-login deferred" | ✅ Confirmed | No |
| `10_TECHNICAL_DEBT_REGISTER.md` T25 | "Email verification status, avatar/profile photo, last-login... are all absent" | ✅ Confirmed | No |
| `14_DECISION_LOG.md` D26 | "Deferred (no backend, recorded, never faked): email verification status, avatar, last login, password change, session listing/revocation, MFA enrollment UI" | ⚠️ Password change and session listing/revocation are now IMPLEMENTED (ACC-SEC-02D2B + ACC-UX-02D3), but the D26 text pre-dates those stages | Stale (password change + sessions now exist) |
| `07_SECURITY_TENANCY_REVIEW.md` §12 | "identity; account linking must never be based solely on an unverified email" | ✅ Consistent — email verification absent, so SSO linking is moot | No |
| `TF_AUTH01_REGISTER_PAGE_ANALYSIS.md` | "No email verification step — signup immediately issues session tokens" | ✅ Confirmed | No |
| Prior audit reports (ACC-AUDIT-02A, ACC-SEC-02D1, ACC-SEC-02D2B, ACC-UX-02D3) | "Forgot/reset password DEFERRED/MISSING" | ✅ Confirmed | No |

**One stale reference found:** D26 in the decision log lists "password change, session listing/revocation" as deferred, but these have since been implemented in ACC-SEC-02D2B and ACC-UX-02D3. This is not a conflict — it is a timestamped snapshot that subsequent stages superseded. No correction needed.

---

## 29. V1 Blockers

| # | Item | Severity | Rationale |
|---|------|----------|-----------|
| V1-B1 | **No password reset flow** | HIGH | Users locked out of their accounts have no self-service recovery. For a production SaaS this is a critical usability gap. Must be implemented before paying customers. |
| V1-B2 | **No email verification** | HIGH | Any email can be registered without proof of ownership. This enables impersonation and undermines org invitation flows. Must be implemented before paying customers. |
| V1-B3 | **No email sending infrastructure** | HIGH | Both password reset and email verification require email delivery. No mail provider is installed or configured. This is a prerequisite for V1-B1 and V1-B2. |

---

## 30. Valuable But Deferrable Work

| # | Item | Rationale | Recommended Stage |
|---|------|-----------|:---:|
| D1 | Email change with verification | Nice-to-have for account management; not a security blocker if email verification exists | ACC-SEC-02E2 (P2) |
| D2 | Security notification emails (password changed, new session, MFA change) | Enhances security posture; audit events already exist | ACC-SEC-02E2 (P2) |
| D3 | Account lockout / progressive delay | Rate limiting provides adequate protection for V1; lockout adds defense-in-depth | Deferred beyond V1 |
| D4 | Login timing side-channel fix | Low risk, rate-limited; can be addressed later | Deferred beyond V1 |
| D5 | Server-side billing returnUrl validation | Stripe enforces its own restrictions; low practical risk | Deferred beyond V1 |

---

## 31. Recommended ACC-SEC-02E2 Scope

### P0 — Security Blockers

**P0-1: Email sending infrastructure**
- Install Nodemailer (or Resend/SendGrid)
- Create `MailModule` / `MailService` with template support
- Add env variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `MAIL_FROM_NAME`
- Create email templates: password-reset, email-verification, email-change-confirm, security-notification
- File scope: `apps/api-gateway/src/mail/` (new module), `apps/api-gateway/src/config/env.validation.ts` (extend)
- Migration required: No (infrastructure only)
- Test strategy: Unit tests for MailService; integration tests for template rendering

**P0-2: Password reset — token backend**
- Create `PasswordResetToken` model (SHA-256 hashed, 15-min expiry, user-bound, purpose-tagged)
- Create `POST /auth/forgot-password` (accepts email, same response for existing/unknown, throttled, generates hashed token, queues email)
- Create `POST /auth/reset-password` (accepts token + new password, validates token, updates passwordHash, revokes all sessions, issues new tokens)
- Enumeration protection: identical response for existing and unknown emails
- Rate limit: `forgotPassword` 3/10min (strict), `resetPassword` 5/10min (strict)
- File scope: `apps/api-gateway/src/auth/` (extend), `apps/api-gateway/prisma/schema.prisma` (new model)
- Migration required: YES — add `PasswordResetToken` model
- Test strategy: 15-20 proofs covering token lifecycle, enumeration, expiry, replay, session revocation

**P0-3: Email verification — token backend**
- Add `emailVerified` (Boolean, default false) and `emailVerifiedAt` (DateTime?) to `User` model
- Create `EmailVerificationToken` model (SHA-256 hashed, 24h expiry, user-bound)
- Modify `POST /auth/signup` to generate verification token and send email
- Create `POST /auth/verify-email` (accepts token, marks user verified)
- Create `POST /auth/resend-verification` (throttled, generates new token, sends email)
- Enumeration protection: identical response for all inputs on verify/resend
- File scope: `apps/api-gateway/src/auth/` (extend), `apps/api-gateway/prisma/schema.prisma` (extend User, add model)
- Migration required: YES — add `EmailVerificationToken` model + alter `User`
- Test strategy: 10-15 proofs covering token lifecycle, expiry, resend throttling, enumeration

### P1 — Required End-to-End Capabilities

**P1-1: Forgot-password frontend**
- Create `/forgot-password` page with email input
- Create `/reset-password` page with new password + confirm fields
- Create `/reset-password/expired` or `/reset-password/invalid` error states
- File scope: `apps/web/src/app/forgot-password/`, `apps/web/src/app/reset-password/` (new pages)
- Test strategy: Component tests for form validation, error states, success states

**P1-2: Email verification frontend**
- Modify `/signup` to show "Check your email" success state
- Create `/verify-email` page (auto-verify from link, or manual token entry)
- Add verification status banner to `/dashboard/settings/account` when unverified
- Add resend button in the verification banner
- File scope: `apps/web/src/app/verify-email/`, `apps/web/src/components/account/` (extend)
- Test strategy: Component tests for verification flow, expired token, resend

**P1-3: Auth audit events**
- Add `login_success` / `login_failure` / `logout` events to AuditLog
- Add `password_reset_requested` / `password_reset_completed` events
- Add `email_verification_sent` / `email_verified` events
- File scope: `apps/api-gateway/src/auth/auth.service.ts`, `apps/api-gateway/src/audit/audit.service.ts`
- Test strategy: Verify AuditLog rows are created for each event

### P2 — Valuable Extensions

**P2-1: Email change with verification**
- Create `POST /auth/request-email-change` (requires reauthentication, generates token for new email, sets `pendingEmail`)
- Create `POST /auth/confirm-email-change` (accepts token, updates email, notifies old address)
- File scope: `apps/api-gateway/src/auth/`, `apps/api-gateway/prisma/schema.prisma` (extend User)
- Migration required: YES — add `pendingEmail` to User

**P2-2: Security notification emails**
- Create `NotificationModule` that sends emails for: password changed, new session, MFA enabled/disabled, email changed
- Wire to existing audit events
- File scope: `apps/api-gateway/src/notification/` (new module)
- Test strategy: Unit tests for notification dispatch, integration tests for event wiring

---

## 32. Recommended ACC-UX-02E3 Scope

### Forgot-Password UX
- `/forgot-password` — email input form, loading/success/error states
- `/reset-password` — token validation, new password form, expired/invalid link handling
- Login page: add "Forgot password?" link below password field

### Email-Verification UX
- Signup success: "Check your email" state with resend button
- `/verify-email` — auto-verify from URL token, success state
- Account page: verification status badge (verified/unverified)
- Unverified state: persistent banner with resend option

### Email-Change UX
- Account page: "Change email" button → modal with current-password reauthentication → new email input → "Check your new email" state
- Confirmation sent to both old and new email

---

## 33. Explicitly Deferred Capabilities

| Capability | Rationale |
|-----------|-----------|
| Account lockout / progressive delay | Rate limiting provides adequate V1 protection |
| Breached-password checking (HaveIBeenPwned API) | Not a V1 requirement; can be added later |
| Password history (prevent reuse) | Not a V1 requirement |
| Login history / activity log UI | AuditLog exists; UI is deferred |
| Email digest of security events | Requires email infrastructure first |

---

## 34. Final Verdict

**Account recovery and email verification are entirely absent from the TechFusion AI codebase.** This is a documented, consistent, intentional V1 product decision — not an oversight. Every audit report, capability matrix, technical debt register, and decision log marks these as MISSING/DEFERRED.

The existing auth infrastructure (JWT+refresh, MFA, password change, session management) is production-ready and well-tested. The gaps are specifically:

1. **No email sending infrastructure** — the fundamental prerequisite
2. **No password reset flow** — users locked out have no self-service recovery
3. **No email verification** — accounts are activated without proof of email ownership
4. **No email change** — users cannot update their registered email
5. **No auth security notifications** — users are not informed of sensitive account changes

All of these are implementable within the existing architecture (NestJS modules, Prisma models, Next.js pages) using established patterns from the codebase (SHA-256 hashed tokens, CAS atomic consumption, strict throttling, AuditLog events).

---

**ACC-SEC-02E2 RECOMMENDED SCOPE:** P0 email infrastructure + password reset backend + email verification backend; P1 frontend journeys; P2 email change + security notifications.

**ACC-UX-02E3 RECOMMENDED SCOPE:** Forgot-password UX, email-verification UX, email-change UX, login page forgot-password link, account page verification status.

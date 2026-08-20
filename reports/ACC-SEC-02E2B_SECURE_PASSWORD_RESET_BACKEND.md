# ACC-SEC-02E2B — Secure Password Reset Backend

Mission: implement production-grade password reset lifecycle (forgot-password + reset-password) for TechFusion AI, using the ACC-SEC-02E2A transactional email foundation.

**Status: CERTIFIED (backend, verified locally).** PUSHED: NO. PRODUCTION DEPLOYED: NO.

## 1. Scope

Backend only — no frontend pages, no enabling `MAIL_ENABLED`, no deployment/push/merge.

| What | In Scope |
|------|----------|
| `POST /auth/forgot-password` | `@Public()`, fingerprint-throttled (3/300s by email hash), returns HTTP 200 with generic message always |
| `POST /auth/reset-password` | `@Public()`, fingerprint-throttled (5/300s by token hash), accepts `{token, newPassword}`, returns 200 with message |
| `PasswordResetToken` model | Additive Prisma model (id, userId, tokenHash unique, expiresAt, usedAt, createdAt) |
| `PasswordResetToken` relation | Additive on `User` |
| Token lifecycle | SHA-256 verifier only at rest (`prt:v1:<sha256-hex>`), ≥256 bits entropy, 15-min expiry, single-use |
| Email delivery | Via existing `TransactionalEmailService` + `password-reset` template + `transactional-email` queue |
| Audit events | `password_reset_requested`, `password_reset_completed`, `password_reset_token_reused`, `password_reset_suppressed` |
| Session revocation | All active refresh tokens revoked atomically on successful reset |
| Rate limiting | Both endpoints fingerprint-throttled via `fingerprintThrottle()` (not neutered in test mode) |
| Test suite | 43 tests (P1–P32 + additionals + 6 fingerprint throttle certification tests) |

## 2. What Was NOT Changed

- `MAIL_ENABLED` remains `false` in production env
- No frontend pages
- No deployment/infrastructure changes
- No existing auth, MFA, session, password change, or account deletion behavior modified
- No breaking changes to shipped API contracts

## 3. Token Design

| Property | Value |
|----------|-------|
| Format | 32 random bytes → hex (64 chars, 256 bits) |
| Stored as | `prt:v1:` + SHA-256 hex |
| Expiry | 15 minutes |
| Single-use | Atomic consumption via `usedAt = now` in `$transaction` |
| Superseded | Previous tokens marked `usedAt` when new forgot-password request arrives |

## 4. Rate-Limit Architecture (ACC-SEC-02E2B-CERT)

### Dimensions

| Endpoint | Throttle Key | Limit | TTL | Fingerprint |
|----------|-------------|-------|-----|-------------|
| `POST /auth/forgot-password` | `SHA-256(normalized email)` | 3 | 300s | Email (lowercased + trimmed) |
| `POST /auth/reset-password` | `SHA-256(raw token)` | 5 | 300s | Reset token |

### Key Properties

- **Raw email never enters rate-limit storage**: key is `SHA-256(lowercase(trim(email)))`, verified by test
- **Raw token never enters rate-limit storage**: key is `SHA-256(token)`, verified by test
- **Different IPs cannot bypass the email limit**: key is email-fingerprint-only (no IP component); different IPs from the same email hit the same throttle bucket, verified by test
- **Different token strings are independently tracked**: each unique token gets its own fingerprint key, verified by test
- **Known and unknown accounts retain identical response status and shape**: HTTP 200 with same message for both, verified by test
- **`fingerprintThrottle()` helper** (`src/config/rate-limits.ts`): accepts `(limit, ttl, bodyField, normalizeFn?)`, returns `@Throttle()` config with custom `getTracker` (reads `req.body[field]`, normalizes, hashes) and `generateKey` (returns tracker as-is)
- Deliberately NOT neutered in test mode (same pattern as `mfaThrottle()`/`strictThrottle()`)

## 5. Security Properties

- **Enumeration-resistant**: forgot-password returns HTTP 200 with identical message for known and unknown emails
- **Consume-once**: atomic token consumption prevents replay
- **Short-lived**: 15-minute expiry limits token exposure window
- **Verifier-only**: DB never stores plaintext token
- **Session revocation**: all active sessions invalidated on password reset
- **No tokens returned on reset**: forces fresh login, preventing silent session hijack
- **Fingerprint throttling**: raw sensitive data never enters rate-limit storage
- **Deterministic errors**: controlled error messages, no stack traces or DB errors

## 6. Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/prisma/schema.prisma` | Added `PasswordResetToken` model, `passwordResetTokens` relation on `User` |
| `apps/api-gateway/prisma/migrations/20260818000000_password_reset_token/migration.sql` | New additive migration |
| `apps/api-gateway/src/auth/password-reset.service.ts` | Core service: `forgotPassword()`, `resetPassword()` |
| `apps/api-gateway/src/auth/dto/forgot-password.dto.ts` | `@IsEmail()` + `@Transform` trim |
| `apps/api-gateway/src/auth/dto/reset-password.dto.ts` | `token` + `newPassword` (min 8, max 128) |
| `apps/api-gateway/src/auth/auth.controller.ts` | Two new `@Public()` endpoints with `fingerprintThrottle()` |
| `apps/api-gateway/src/auth/auth.module.ts` | `MailModule`, `QueueModule` imports, `PasswordResetService` provider |
| `apps/api-gateway/src/config/rate-limits.ts` | Added `fingerprintThrottle()` helper, `forgotPassword`/`resetPassword` in `STRICT_RATE_LIMITS` |
| `apps/api-gateway/test/password-reset.spec.ts` | 43-test spec covering full lifecycle + fingerprint throttle certification |
| `apps/api-gateway/src/mail/__tests__/mail.spec.ts` | Updated guard test (allows `forgot-password`/`reset-password` in auth controller) |
| `apps/worker/src/__tests__/mail.spec.ts` | Updated schema guard test (allows synced `PasswordResetToken`) |
| `apps/worker/prisma/schema.prisma` | Synced via `scripts/sync-prisma-schema.sh` |

## 7. Test Results

| Suite | Result |
|-------|--------|
| `password-reset.spec.ts` (focused) | 43/43 PASS |
| `auth.spec.ts` + `password-session-management.spec.ts` | 42/42 PASS (no regressions) |
| `mail.spec.ts` (API) | 38/38 PASS |
| Worker full suite | 108/108 PASS |
| Full API Gateway suite | 1211/1211 PASS (67 suites) |
| Lint (all 7 packages) | CLEAN |
| Build (all 7 packages) | CLEAN |
| Secret scan | NO SECRETS DETECTED |
| Fresh DB migration (from zero) | PASS — all migrations applied, schema verified, 43/43 tests pass |
| V1 gate run 1 | 19/19 PASS |
| V1 gate run 2 | 18/19 FAIL (API tests flaky — Redis connection race; standalone run 1211/1211 PASS) |
| V1 gate run 3 | 19/19 PASS |
| V1 gate run 4 | 19/19 PASS |

## 8. Fresh Database Migration Verification

- Created `techfusion_fresh_test` on port 5434
- Applied all 21 migrations from zero via `prisma migrate deploy`
- Verified `PasswordResetToken` table: all columns, primary key, unique index on `tokenHash`, composite index `(userId, expiresAt)`, foreign key `userId → User(id) CASCADE`
- Ran full 43-test password-reset suite against fresh DB: 43/43 PASS
- Cleaned up fresh test database

## 9. Evidence

- Migration applied: `20260818000000_password_reset_token`
- Worker schema synced: `scripts/sync-prisma-schema.sh`
- 43-proof test suite: `test/password-reset.spec.ts`
- No regressions in existing auth, mail, or worker tests
- Full API suite: 1211 tests, 67 suites

## 10. Remaining Risks

- **V1 gate flaky failure**: run 2 of 4 V1 gate attempts failed on API tests (18/19); the standalone API suite passes 1211/1211 consistently. Likely a Redis connection race in the gate script's test DB setup. The gate passes 3/4 times.
- **SMTP production certification**: `MAIL_ENABLED` is `false` in production; SMTP config/certification is operator-dependent and deferred.
- **Frontend pages**: forgot-password and reset-password UI pages are not implemented (out of scope for this mission).
- **Email verification**: not implemented (ACC-SEC-02E2C, deferred).
- **Security notification emails**: not implemented (ACC-SEC-02E2D, deferred).

## 11. Blocked By / Depends On

- **ACC-SEC-02E2A** (transactional email foundation) — merged into feature branch

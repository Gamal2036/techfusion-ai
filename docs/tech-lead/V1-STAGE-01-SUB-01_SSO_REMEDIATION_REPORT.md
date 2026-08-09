# V1-STAGE-01-SUB-01 — SSO Authentication Remediation Report

Status date: 2026-08-09. Mission: single surgical P0 security remediation.
Scope: fail-closed disablement of the incomplete SSO login path. No SAML/OIDC
implementation was attempted (founder decision, `14` D11).

## 1. Original Vulnerability (S1, CRITICAL — Authentication Bypass)

`POST /auth/sso/login` was `@Public()` and, with no real IdP integration,
authenticated entirely on **client-supplied identity**:

- `attributes { email, ssoId, displayName }` were taken from the request body
  and trusted without any cryptographic verification.
- The `idpToken` was validated **only by `length >= 10`** — no SAML assertion
  signature check, no OIDC id_token signature/JWKS/issuer/audience/exp check.
- On success the service JIT-provisioned a `Viewer` user + `OrganizationMember`
  for any email, or overwrote an existing user's `ssoId`/`ssoProvider` (account
  linking by arbitrary email), then issued a **valid 15m JWT access token and a
  7-day refresh token** bound to the membership.

Any attacker knowing an org slug with SSO configured could authenticate as any
email in that org (including the Owner/Admin email), obtaining a real session
and full org access. Verified live in this mission: a request with a fake
unsigned token (`not-a-real-assertion`, 19 chars) against an SSO-enabled org
returned **201 Created with `accessToken` + `refreshToken`** before remediation.

### Root Cause

The SSO domain was scaffolded (config storage + login stub) ahead of a real
SAML/OIDC provider integration. The login stub substituted "token is present
and looks long enough" for the required server-side assertion verification, and
performed identity provision/linking/token-issuance on that unverified basis.
Code: `apps/api-gateway/src/sso/sso.service.ts` (pre-change `ssoLogin`), route
`apps/api-gateway/src/sso/sso.controller.ts:12-21`.

## 2. Security Decision (founder, `14` D11)

For Production V1: **do not implement full SAML/OIDC yet; disable the unsafe
path FAIL-CLOSED.** The existing insecure SSO login must never issue a valid
session based only on client-supplied identity attributes. The SSO
domain/database architecture is preserved for a future real implementation.

## 3. Remediation Implemented

- `SsoService.ssoLogin(...)` is replaced by a fail-closed stub that throws
  `NotImplementedException` (**HTTP 501 Not Implemented**) with a deterministic
  message **before touching any data** (no org lookup, no `SsoConfig` read, no
  user lookup/write, no token issuance).
- The route stays registered at `POST /auth/sso/login` (still `@Public()`,
  public-by-design login surface) and still routes to the same method, so the
  future IdP implementation has an intact contract; it simply rejects now.
- Removed the dead insecure code paths (`generateRefreshToken`, `ensureMembership`,
  unused imports) so the exploit cannot be re-triggered by any caller.
- **Preserved**: `SsoConfig` model, SSO admin config routes
  (`GET/POST /admin/sso/config`, `POST /admin/sso/disable` — permission +
  `RequireFeature('sso')` gated, config storage only, never issue sessions),
  `User.ssoId`/`User.ssoProvider` columns, and the `SsoModule`.

### Error contract choice

**501 Not Implemented** was chosen over 401/403/404 because:
- It is deterministic and cannot be confused with an authentication failure or
  with "route does not exist" — the route exists, the mechanism is genuinely not
  implemented.
- It leaks nothing: org existence, SSO-enabled state, provider config, and user
  existence are all indistinguishable (the handler never reads them).
- It is a standard NestJS exception (`NotImplementedException`), consistent with
  the existing TechFusion API error architecture (400/401/403/404/409 + standard
  Nest exceptions).

The route was **not** removed: keeping it fail-closed preserves the exact
contract a future SAML/OIDC substage must fill, and returning a clear 501 is a
better client contract than a 404. Attack surface is minimal (globally
throttled, zero DB work, deterministic response).

## 4. Tests

### New regression suite — `apps/api-gateway/test/sso-login.spec.ts` (10 tests)

Proves an attacker cannot authenticate by supplying arbitrary email / ssoId /
displayName / fake token / org slug. Written red against the vulnerable code
(all 10 failed: 201 with tokens, JIT users created, ssoId overwritten), now
green against the fix. Coverage maps to the mission checklist:

1. Existing-user email spoof — 501, no tokens, `ssoId`/`ssoProvider` stay `null`.
2. New/JIT user spoof — 501, no user/membership/refresh token created.
3. Privileged-user email spoof — 501, no tokens, role unchanged, no link.
4. Fake/unsigned token — 501, no tokens, no rows.
5. Random/unknown organization — 501, no tokens, no rows (deterministic).
6. SSO-enabled organization — 501, no tokens, no user created.
7. No refresh token created — `RefreshToken.count() === 0` after attempts.
8. No access token returned — `accessToken` undefined on every attempt.
9. No user unexpectedly created — `User.count() === 0` for JIT cases.
10. No existing user SSO identity modified — pre-existing `ssoId` untouched.

### Updated legacy suites (were asserting the insecure behavior)

- `test/enterprise.integration.spec.ts` — SSO block rewritten to assert
  fail-closed: 501 on login (config present or absent), no JIT provisioning, no
  account linking, no extra refresh tokens. Admin config + disable routes
  unchanged and still tested.
- `test/full-e2e-scenario.spec.ts` — "Step 11" rewritten to assert SSO login
  fails closed (501, no tokens, no JIT user); removed dependence on a
  now-impossible SSO-issued token.

### Results

- New suite: **10/10 pass**. SSO-related suites: **42/42 pass**.
- Full api-gateway suite: **53 suites, 923 tests pass** (baseline was 52/913;
  +10 new SSO tests). Existing auth tests untouched and green.
- Lint/typecheck (`pnpm lint` = `tsc --noEmit`): pass. `pnpm build`: pass.
- No web/worker code references SSO login; web/worker suites unaffected.

## 5. Security Boundary Check (Phase 5)

Every public route re-reviewed for "trusts client identity / issues tokens /
links accounts by email":

| Public route | Verification | Verdict |
|--------------|--------------|---------|
| `POST /auth/sso/login` | now 501 before any data access | ✅ FIXED |
| `POST /auth/signup/login/verify-login/refresh` | password/MFA verified; membership-authoritative | ✅ safe |
| Network discovery, inventory report, security pending/scan-result, remote-support agent routes | `DeviceTokenGuard` (SHA-256 device token) | ✅ safe |
| `POST /devices/security-report` | body token hashed/verified server-side | ✅ safe |
| `POST /devices/register-public` | single-use hashed enrollment token (S4 MEDIUM, known, out of scope) | ✅ safe |
| `POST /devices/recover-credential` | org token required; no session issued | ✅ safe |
| `GET /metrics` | token-in-query optional auth (S5 LOW, known, out of scope) | ✅ known |
| `GET /health` | no identity | ✅ safe |
| `POST /invitations/:token/accept` | authenticated; email-match enforced | ✅ safe |
| `GET /reporting/download` | HMAC-signed URL (expires + sig) | ✅ safe |
| `POST /billing/webhook` | Stripe signature verified | ✅ safe |
| Admin SSO config/disable | permission + `RequireFeature('sso')`; config-only | ✅ safe |

Only `jwt.sign` call site remaining is the legitimate `AuthService.generateTokens`
(`src/auth/auth.service.ts:262`). Only `user.create` site is password-verified
signup. **No second equivalent auth bypass found.** No blocker raised.

## 6. Residual Risk

- **SSO is DISABLED_SAFE, not certified.** Real SAML/OIDC remains unimplemented
  and requires a future substage (below).
- Admin SSO config can still be created but is dormant: no customer can log in
  via SSO. No data migration or cleanup performed (per scope protection).
- Non-SSO findings (S2 RLS inert, S3 plaintext device token fallback, S4
  register-public, S5 metrics token) remain open for later substages.

## 7. Future SSO Contract (required for re-enablement; NOT implemented here)

Re-enabling SSO requires server-side verification in `SsoService.ssoLogin`:

**OIDC** — verify all of: issuer; audience/client_id; signature via JWKS;
`exp`; `nonce`/`state`; use the authorization-code flow with PKCE where
applicable (never an implicit/unsolicited token).

**SAML** — verify all of: assertion signature (IdP cert); issuer; audience;
destination; validity window (`NotBefore`/`NotOnOrAfter`); replay protection
(one-time assertion ID storage).

**Provisioning rules** — JIT provisioning may occur **only after** verified
identity; account linking must never be based solely on an unverified email;
`User.ssoId` may only be written from a verified IdP subject claim; membership
granting follows existing `OrganizationMember` authority rules.

The current fail-closed stub is the exact insertion point; the route, config
storage, and `SsoConfig` schema are ready for this work.

## 8. Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/sso/sso.service.ts` | `ssoLogin` fail-closed (501); removed insecure code + dead helpers/imports |
| `apps/api-gateway/test/sso-login.spec.ts` | **new** 10-test spoof-proof regression suite |
| `apps/api-gateway/test/enterprise.integration.spec.ts` | SSO block updated to fail-closed assertions |
| `apps/api-gateway/test/full-e2e-scenario.spec.ts` | Step 11 updated to fail-closed assertions |
| `docs/tech-lead/00_CURRENT_STATE.md` | S1 status + test counts updated |
| `docs/tech-lead/07_SECURITY_TENANCY_REVIEW.md` | S1 marked DISABLED_SAFE; S6 resolved |
| `docs/tech-lead/08_FEATURE_READINESS_MATRIX.md` | SSO rows updated to DISABLED_SAFE |
| `docs/tech-lead/12_MASTER_ROADMAP.md` | Stage-01 scope/acceptance updated |
| `docs/tech-lead/14_DECISION_LOG.md` | D11-D13 added |

## 9. Rollback Notes

- Code-only change, no migration, no data change. `git revert` of the SSO code +
  test commits cleanly restores behavior (both tests would re-assert the old
  insecure behavior, which must not be re-merged).
- Do **not** re-enable SSO login by merely reverting this change: the pre-change
  code is the vulnerability. Re-enable only via the Phase-7 contract with real
  IdP verification and its own tests.

## 10. Next Recommended Substage

**V1-STAGE-01-SUB-02 — RLS decision & cross-tenant isolation regression suite**
(S2, P0): either implement transactional `set_config` + non-owner role + `FORCE
ROW LEVEL SECURITY`, or remove decorative RLS policies and add a controller-wide
orgId-scoping isolation test suite. See `12` V1-STAGE-01.

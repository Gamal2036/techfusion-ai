# 07 — Security & Tenancy Review

Status: 2026-08-09. Read-only review; no destructive testing performed. Findings verified from source (`VERIFIED_THIS_RUN` for SSO; others `INFERRED_FROM_CODE` with file refs).

## 1. Verified Boundaries (positive)

- **Auth**: JWT access (15 m) + opaque refresh (7 d) with CAS rotation on refresh and DB revocation on logout/membership-loss (`src/auth/auth.service.ts`). Session invalidation on membership change is the documented mechanism (`V1-STAGE-01B-R1`).
- **Org isolation**: `CombinedAuthGuard` resolves JWT → `OrganizationMember` (authoritative). Services consistently scope queries with `orgId` (verified across organizations, admin, devices, alerts, security, network, inventory, account, backups, audit, retention, kb, reporting, remote-support). No cross-org read path found in reviewed controllers.
- **Device ownership**: ingest endpoints bind org+device from the device token and reject `X-Org-Id`/body org mismatches (`inventory.controller.ts:34-43`, `network` discovery, remote-support device endpoints).
- **RBAC**: ~40 `domain:action` permissions; membership-authoritative role checks; role-transition rules (Owner-only promotion, last-owner protection) covered by `membership-authoritative.spec.ts` / `rbac-permissions.spec.ts`.
- **Billing authz**: `BILLING_VIEW/MANAGE`; Stripe webhook signature verification (public route).
- **Secrets**: no real secrets in source; `.env.example` documents required vars; env validation rejects placeholders; AI provider keys and SSO client secrets AES-256-GCM encrypted at rest; `getConfig` strips `clientSecretEncrypted`; TOTP secrets stored standard base32.

## 2. Findings

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| S1 | **CRITICAL** | **SSO login = authentication bypass.** `POST /auth/sso/login` is `@Public()`, trusts client-supplied `attributes { email, ssoId, displayName }`, and validates the IdP token only by `length >= 10`. No SAML assertion or OIDC id_token verification/signature check. Anyone knowing an org slug with SSO enabled can authenticate as any email (JIT-provisioned Viewer, or hijack of an existing email by overwriting `ssoId` at `sso.service.ts:142-145`), obtaining a valid JWT + refresh token. | `sso.controller.ts:12-21`, `sso.service.ts:85-176` |
| S2 | MEDIUM | **RLS is inert — isolation is app-layer only.** 29+ tables have RLS policies keyed on `current_org_id()` reading `app.current_org_id`, but nothing ever sets it (no `set_config` anywhere; `OrgContextInterceptor` deleted). The Prisma role owns the tables and bypasses RLS (no `FORCE ROW LEVEL SECURITY`). A single missed `orgId` filter = real cross-tenant leak; app-layer discipline is the only boundary. | migrations `*_rls*`; `docs/v1/ORG-01B:194-195,407`; `V1-ORG-AUDIT-00:406-417` |
| S3 | MEDIUM | **Plaintext `Device.deviceToken` retained + fallback lookup.** Guard hashes bearer → `deviceTokenHash`, then falls back to equality vs the plaintext unique column (`device-token.guard.ts:38-47`; `devices.service.ts:249-260`). A DB leak exposes live device credentials. | `schema.prisma` (`Device.deviceToken`), guard + service |
| S4 | MEDIUM | **Public device-creation endpoint.** `POST /devices/register-public` (Public, throttled 10/60 s) gated only by a single-use hashed enrollment token; duplicate registration auto-rotates credentials. Brute-force/replay of a token allows registering devices under an org (Free cap 3 mitigates). | `devices.controller.ts`, `devices.service.ts:88-141` |
| S5 | LOW | **Metrics token in query string + optional auth.** `GET /metrics?token=` (log/proxy leakage); unauthenticated when `METRICS_AUTH_TOKEN` unset. | `metrics.controller.ts:6,15-20` |
| S6 | LOW | **SSO account linking by email.** `ssoLogin` looks up by email only; replaying another user's email re-links `ssoId` (S1 consequence chain). | `sso.service.ts:111,114-116` |
| S7 | LOW | **Agent 401 auto-re-enrollment cadence.** After 3 consecutive auth failures the agent stops telemetry; re-registration is bounded (3 attempts) — acceptable, but token hygiene depends on server rotation. | `agent.rs:200-276` |

## 3. Theoretically Reachable Cross-Org Paths

None found among reviewed controllers. The realistic risk is S2 (single missed `orgId` filter = leak) and S1 (org takeover via SSO). Both must be closed before paid V1.

## 4. What Security Work Remains Before Paid V1 (non-exhaustive)

1. Replace/verify SSO: server-side SAML/OIDC assertion verification (or disable the login route until an IdP integration exists) — **P0 blocker**.
2. Decide RLS: implement transactional `set_config` + non-owner role + `FORCE ROW LEVEL SECURITY`, or remove the decorative migrations and rely on tested app-layer isolation with an orgId-audit test. — P0/P1.
3. Remove plaintext `deviceToken` fallback once all devices carry hashes (backfill + rotation sweep) — P1.
4. Move metrics auth out of query string — P2.
5. Add a cross-tenant isolation regression test suite covering every controller's orgId scoping — P0 test.

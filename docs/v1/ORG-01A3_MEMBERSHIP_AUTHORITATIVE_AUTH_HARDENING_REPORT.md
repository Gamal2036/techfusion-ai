# ORG-01A3 — Membership-Authoritative AuthN/Z Hardening

Status: ORG-01A3 COMPLETE — ORGANIZATIONMEMBER IS THE AUTHORITATIVE SOURCE OF ORG ACCESS AND PER-ORG ROLE
Date: 2026-08-07
Mode: Hardening of the ORG-01A1/ORG-01A2 membership foundation. No new migrations,
no `User.orgId`/`User.role` removal, no auth redesign, no second membership model,
no device/machine-auth changes, no frontend/billing/WS redesign, nothing committed
or pushed.

---

## 1. Executive Summary

ORG-01A3 closes the P0 gap where a JWT's `role`/`orgId` claims were trusted as
authorization inputs. Now every human-facing authentication path — REST guards,
WebSocket middleware, login/MFA token minting, refresh, SSO, and admin
user-management — resolves the caller against the `OrganizationMember` row of the
organization in the JWT. The membership is the sole source of:

- **Access**: does the user belong to this org at all? (else 401)
- **Role**: which `Role` does the user hold *in this org*? (used for `@Roles` gates)

The JWT `role`/`orgId` claims are demoted to *snapshot transport*; after
verification the guard overwrites `req.user.role`/`req.user.orgId` from the live
membership. A stale, downgraded, or inflated claim is therefore irrelevant to
every decision — the membership is re-read on every request.

Machine/device auth (`DeviceTokenGuard`) is untouched and remains fully
independent of `OrganizationMember` (proven by test).

## 2. The Vulnerability Being Closed

Before ORG-01A3, the global `CombinedAuthGuard` verified the JWT signature and
expiry but passed the token's `role`/`orgId` claims straight into `req.user`.
Consequences closed by this change:

| # | Threat | Before | After |
|---|---|---|---|
| A | Role downgrade ignored until token expiry | revoked role kept access | role re-read from membership per request → immediately 403 |
| C | Role promotion needs new token | promoted user stuck until re-login | membership re-read per request → immediately 200 |
| B/D | Membership removed / forged `orgId` claim | valid-signed JWT = access | 401 at the guard, no controller runs |
| F | Removed member re-logs-in and is auto-repaired | `AuthService` re-created membership | hard 401; no silent repair |
| E | Stale `User.role` snapshot mints wrong-role JWTs | JWT role came from `User.role` | JWT role comes from membership role |
| G | Refresh after revocation | refresh reissued tokens | 401 + session revocation |
| H | Machine/device token coupling | — | device auth stays independent of membership |
| I | Switch token role | switch bound role from membership | unchanged, now also covered by the guard |
| J | Inflated `role` claim in a valid token | trusted by `@Roles` | guard overwrites from membership → 403 |

## 3. Architecture

### 3.1 Single choke point: `CombinedAuthGuard` (global `APP_GUARD`)

`apps/api-gateway/src/common/combined-auth.guard.ts` is now:

- `async` (Nest supports async guards) and DI-injects `PrismaService`.
- Flow: extract bearer → `verifyAndValidateJwt()` (signature + shape + expiry) →
  `resolveMembershipUser(prisma, payload)` → sets `request.user = { sub, orgId, role }`.
- Role gates downstream (`RolesGuard`) read `req.user.role`, which is now the
  membership role. `PlanGuard`/`OrgContextInterceptor` read `req.user.orgId`,
  which is now the membership orgId — same benefit, zero rewiring.

### 3.2 Shared helper: `src/common/membership-auth.ts` (NEW)

```ts
export interface AuthenticatedUser { sub: string; orgId: string; role: Role; }

getJwtSecret(): string
verifyAndValidateJwt(token: string): JwtPayload   // signature + {sub, orgId, role} shape + expiry
resolveMembershipUser(prisma, payload): Promise<AuthenticatedUser>
```

`resolveMembershipUser` fetches `OrganizationMember` by `userId_orgId`; when
absent it throws `UnauthorizedException('No active membership for this
organization')`. 401 (not 403) deliberately — missing membership is treated as an
authentication failure, since it means the principal does not exist for that org.

### 3.3 Guard hardening

- `combined-auth.guard.ts` — global guard rewritten as above. Async + PrismaService DI.
- `jwt-auth.guard.ts` (KB controller) — same membership resolution; async + DI.

### 3.4 WebSocket auth

`src/common/ws-auth.middleware.ts` is now a factory
`createWsAuthMiddleware(prisma: PrismaService)`:

- Verifies JWT via `verifyAndValidateJwt`, then awaits
  `resolveMembershipUser`; attaches `socket.data.user = { userId, orgId, role }`
  from the membership.
- Missing membership → socket rejected with
  `'No active membership for this organization'`.
- Wired through the three human-WS gateways, which now inject `PrismaService`
  and pass it to the factory:
  - `src/devices/devices.gateway.ts`
  - `src/network/network.gateway.ts`
  - `src/remote-support/remote-support.gateway.ts`

Every new human socket connection gets a live membership check.

### 3.5 Login / MFA / refresh (`AuthService`)

- New private `requireMembership(user)` — hard-fails (401) when the user has no
  active `OrganizationMember` for their org.
- `login` and `verifyLoginMfa` mint tokens from `membership.orgId` /
  `membership.role`, and return the membership role/org in the user payload —
  a stale `User.role` snapshot can no longer mint an inflated JWT.
- The ORG-01A2 login-time *auto-repair* of a missing membership was **removed**:
  revocation is no longer silently undone by logging in again (test Case F).

### 3.6 SSO (`AuthService` / `sso.service.ts`)

- JIT provisioning now creates the `OrganizationMember(... role: 'Viewer')` row
  in addition to the `User`.
- The link-existing-user / existing-membership paths call a new
  `ensureMembership(user, orgId)` helper that repairs a *missing* membership as a
  one-time convenience (using `user.role` only when `user.orgId === orgId`, else
  `Viewer`) — distinct from the password-auth path, which hard-fails.
- Tokens are minted from the found/created membership role, falling back to
  `Viewer`.

### 3.7 Admin user management (`AdminService`)

`updateUserRole` / `removeUser` now operate through `OrganizationMember`:

- Target lookup is `organizationMember.findUnique` (include user).
- Owner protection and self-deletion checks use the *membership* role.
- `updateUserRole` writes the new role to the membership, then syncs the
  `User.role` snapshot **only** when the user's active org
  (`user.orgId === orgId`) matches — preserving the compatibility pointer without
  letting it become authoritative.
- `removeUser` deletes the membership then the User (memberships cascade).

### 3.8 Target-org routes (unchanged by design)

`PATCH /organizations/:id`, `POST /organizations/:id/switch` keep the ORG-01A2
`requireMembership` / `requireMembershipRole` checks reading the *target* org's
membership — this is the correct, complementary rule for target-org operations
and is preserved and re-verified.

## 4. JWT Contract

Shape unchanged: `{ sub, orgId, role }`. Semantics changed:

| Claim | Before ORG-01A3 | After ORG-01A3 |
|---|---|---|
| `sub` | user id | user id (unchanged) |
| `orgId` | trusted as request org | snapshot only; guard re-resolves membership by `sub`+`orgId` |
| `role` | trusted as the user's role | snapshot only; overwritten from the membership |

`req.user.orgId`/`req.user.role` set by the guard are always the membership
values, so every downstream service/controller keeps working unchanged.

## 5. Migration Status

**NONE.** `OrganizationMember` already exists from ORG-01A1 (backfill complete,
verified by `test/membership-schema.spec.ts`). `User.orgId` remains REQUIRED and
`User.role` is retained as the active-org compatibility snapshot. No
`User.orgId`/`User.role` removal — per constraints.

## 6. Tests

### 6.1 New suite: `test/membership-authoritative.spec.ts` (13 tests, all PASS)

Covers the Cases A–J table plus MFA and machine-auth:

- **Login role resolution (2):** login mints JWT from membership role (not stale
  `User.role`); MFA login completes with the membership role.
- **Live role enforcement (3):** immediate downgrade (403 without new token) with
  continued authenticated access to non-admin routes; immediate promotion
  (200 without new token); inflated JWT `role` claim cannot bypass a Viewer
  membership (403).
- **Revocation (3):** membership removal → 401 at the guard on subsequent requests
  with the *same* token; re-login is also 401 (no auto-repair); refresh after
  removal → 401.
- **Cross-org forgery (1):** a validly-signed JWT claiming an org the user has no
  membership in → 401.
- **Switch (1):** `/switch` binds the new token to the target membership role
  (Owner in A → Viewer in B; B token denied on Owner-only routes).
- **Admin member-management (2):** role change requires the target to hold a
  membership in the org (404 for cross-org target); role change updates the
  membership and is immediately reflected at the guard.
- **Machine/device independence (1):** device-token metrics POST succeeds with no
  `OrganizationMember` row at all.

### 6.2 Existing suites updated for the new guard contract

- `test/ws-auth.spec.ts` — rewritten to pass a mocked `PrismaService` to
  `createWsAuthMiddleware`; added 2 tests (valid JWT without membership → rejected;
  membership role authoritative over the JWT role claim). Now 10 tests.
- `test/app.integration.spec.ts` — the "API rejects cross-tenant access attempts"
  test previously *expected the tampered-org request to succeed* (200); it now
  asserts the membership-authoritative guard rejects it with **401**.
- `src/dashboard/dashboard.controller.spec.ts` — added the `OrganizationMember`
  prisma mock provider required by the DI guard.
- `src/admin/admin.service.spec.ts` — rewritten for membership-based logic.
- `src/network/network.gateway.spec.ts` — added the `PrismaService` mock provider.
- Seed helpers in `test/auth.spec.ts`, `test/security.spec.ts`,
  `test/enterprise.integration.spec.ts`, `test/full-e2e-scenario.spec.ts` now
  create the `OrganizationMember` rows that production guarantees (the ORG-01A1
  backfill contract), so suite seeds match the hardened runtime.

## 7. Verification Results

| Suite | Result |
|---|---|
| `test/membership-authoritative.spec.ts` (new) | 13/13 PASS |
| `test/ws-auth.spec.ts` (rewritten) | 10/10 PASS |
| api-gateway full suite (`jest --forceExit --runInBand`) | **721/721 PASS (42 suites)** |
| worker suite | **79/79 PASS (8 suites)** |
| web suite | **742/742 PASS (31 suites)** |
| api-gateway `tsc --noEmit` | PASS |
| api-gateway `npm run build` | PASS |
| worker `tsc --noEmit` | PASS |
| web `tsc --noEmit` | PASS |

Regression coverage that stayed green: auth (12), organizations (29, A2
regression bar), security (59), membership-schema (6), app.integration (38),
enterprise.integration, full-e2e-scenario, admin/dashboard units, alert/device/
backups/remote-support controllers. The only changes to previously-passing suites
were the ones required by the hardened contract (401-for-forged-org,
seed memberships), all updated and green.

## 8. Files Changed (this hardening)

New:
- `apps/api-gateway/src/common/membership-auth.ts` — shared JWT verify + membership resolution.
- `apps/api-gateway/test/membership-authoritative.spec.ts` — the ORG-01A3 security suite.

Modified:
- `apps/api-gateway/src/common/combined-auth.guard.ts` — async, DI PrismaService, membership resolution.
- `apps/api-gateway/src/common/jwt-auth.guard.ts` — same for the KB controller.
- `apps/api-gateway/src/common/ws-auth.middleware.ts` — `createWsAuthMiddleware(prisma)`, live membership check.
- `apps/api-gateway/src/devices/devices.gateway.ts` — inject PrismaService, pass to middleware.
- `apps/api-gateway/src/network/network.gateway.ts` — inject PrismaService, pass to middleware.
- `apps/api-gateway/src/remote-support/remote-support.gateway.ts` — pass PrismaService to middleware.
- `apps/api-gateway/src/auth/auth.service.ts` — membership-authoritative login/MFA; `requireMembership`; removed auto-repair.
- `apps/api-gateway/src/sso/sso.service.ts` — JIT provisioning creates membership; tokens from membership role.
- `apps/api-gateway/src/admin/admin.service.ts` — membership-first role/remove; `User.role` snapshot sync only for active org.
- `apps/api-gateway/src/dashboard/dashboard.controller.spec.ts`
- `apps/api-gateway/src/admin/admin.service.spec.ts`
- `apps/api-gateway/src/network/network.gateway.spec.ts`
- `apps/api-gateway/test/ws-auth.spec.ts`
- `apps/api-gateway/test/auth.spec.ts`
- `apps/api-gateway/test/security.spec.ts`
- `apps/api-gateway/test/app.integration.spec.ts`
- `apps/api-gateway/test/enterprise.integration.spec.ts`
- `apps/api-gateway/test/full-e2e-scenario.spec.ts`

Unchanged: `src/organizations/*` (A2 target-org rules preserved), `role-hierarchy.ts`,
`RolesGuard`, `DeviceTokenGuard`, `app.module.ts` guard registration order, all
controllers/services reading `req.user.orgId`, all worker and web source, all
Agent (Rust) code.

## 9. Security Notes

- No auth weakening: signature verification, `@Roles` hierarchy, plan guard,
  throttling, WS handshake all unchanged.
- Missing membership → **401** at the guard/middleware/login/refresh, before any
  controller logic runs.
- The password-auth path no longer auto-repairs membership (removal is
  permanent until an admin/org flow re-adds it). The SSO link path keeps a
  one-time repair as a documented convenience.
- Machine/device auth stays independent of `OrganizationMember` (metrics POST
  proven without a membership row).
- No secrets/JWTs logged; no `any`/TS-suppression introduced.
- F1/F2 (`X-Org-Id` trust + RLS on `OrganizationMember`) remain deferred to
  ORG-01B as decided.

## 10. Deferred / Out of Scope

- `User.orgId` nullable / `User.role` drop → still deferred (explicit constraint).
- RLS + `X-Org-Id` ingestion trust removal → ORG-01B.
- Invites, member-management UI, org switcher UI → ORG-01C.
- Frontend/WS reconnect redesign → ORG-01C.
- Billing redesign, org delete, device transfer → out of scope.

## 11. Rollback Notes

- No migration applied → rollback is code-only: revert the files in §8 to the
  ORG-01A2 state (guard becomes sync JWT-only again; middleware reverts to a
  no-arg factory). `OrganizationMember` schema/backfill stays (harmless, still
  used by the organizations module).
- No data was modified destructively during development or certification.
- Nothing was committed, staged, or pushed; pre-existing working-tree changes
  from other workstreams were left untouched.

## 12. Final Status

**ORG-01A3 COMPLETE — MEMBERSHIP-AUTHORITATIVE AUTHN/Z HARDENED**

| Gate | Result |
|---|---|
| Guard resolves membership on every request | PASS |
| JWT role claim cannot elevate (Case J) | PASS |
| JWT org claim cannot forge access (Case D) | PASS |
| Downgrade/promotion reflected immediately (A/C) | PASS |
| Revocation is immediate at guard (B) | PASS |
| No auto-repair on re-login (F) | PASS |
| Refresh denied after revocation (G) | PASS |
| Login/MFA mint from membership role (E) | PASS |
| SSO tokens from membership role | PASS |
| Admin role/remove via membership | PASS |
| Target-org switch/rename rules preserved | PASS |
| WS live membership check | PASS |
| Machine/device auth independent (H) | PASS |
| No migration | PASS |
| No auth redesign / second membership model | PASS |
| api-gateway 721/721, worker 79/79, web 742/742 | PASS |
| Typecheck + build (api-gateway) | PASS |

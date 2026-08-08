# ORG-01A2 — Organization CRUD + List + Active Organization Switch API

Status: ORG-01A2 COMPLETE — MULTI-ORG BACKEND READY
Date: 2026-08-07
Mode: Backend API contract on top of the certified ORG-01A1 membership foundation.
No frontend switcher, no invites, no full RBAC, no JWT redesign, no destructive
migration, nothing committed or pushed.

---

## 1. Executive Summary

ORG-01A2 turns the ORG-01A1 membership schema into a working multi-organization
backend contract. An authenticated user can now list every organization they are
a member of, create a new organization (receiving an OWNER membership), rename an
organization they own, and switch their active organization. Switching re-syncs
the legacy compatibility pointer (`User.orgId`/`User.role`) from the authoritative
`OrganizationMember`, issues a fresh JWT for the selected org, and keeps the
refresh-token session bound to the selected org — a refresh can never silently
revert a user to a previous organization.

All existing org-scoped services (dashboard, devices, alerts, enrollment,
security, reports, monitoring, remote support) are untouched and operate on
`req.user.orgId`, which now follows the switched JWT. No schema change, no new
migration, no `User.orgId` nullability change, no `User.role` removal.

## 2. ORG-01A1 Baseline

- `OrganizationMember` model exists with `@@unique([userId, orgId])` and CASCADE FKs.
- Existing users backfilled (one membership per user, mirroring `User.orgId` + `User.role`).
- `User.orgId` REQUIRED, `User.role` preserved; JWT shape `{ sub, orgId, role }`.
- All services built around `req.user.orgId`.
- Enrollment org binding is server-trusted (token → org).

## 3. Architecture Decision

- **No schema change.** `OrganizationMember` is the authority for access to
  non-legacy organizations. The legacy `User.orgId`/`User.role` columns are kept
  as the single "currently active org" compatibility pointer for this phase.
- **Active org is derived from the JWT orgId**, which is always in sync with
  `User.orgId` (login, switch, and refresh all write/read the same pointer).
- **Membership roles, not JWT roles, authorize target-org operations.** The
  `organizations` controller uses no `@Roles` metadata (the global guard only
  authenticates); every target-org route calls `requireMembership` /
  `requireMembershipRole` which reads the role from the `OrganizationMember` of
  the target org.
- **Switch issues fresh auth state** (new access + refresh token pair) bound to
  the selected org; refresh derives the org from the live `User.orgId` pointer
  and additionally validates the membership before reissuing.

## 4. Organization Module

`apps/api-gateway/src/organizations/`

- `organizations.module.ts` — imports `AuthModule`, exports `OrganizationsService`.
- `organizations.controller.ts` — routes:
  - `GET    /organizations`
  - `POST   /organizations`
  - `GET    /organizations/current`
  - `GET    /organizations/:id`
  - `PATCH  /organizations/:id`
  - `POST   /organizations/:id/switch`
- `organizations.service.ts` — all logic, incl. the centralized membership helpers.
- `dto/create-organization.dto.ts`, `dto/update-organization.dto.ts` —
  class-validator DTOs (name required, trimmed, 1–100 chars).
- Wired into `AppModule` (one import). No new migration, no `Prisma` model change.

## 5. Membership Authorization

Centralized, no raw Prisma membership checks in controllers:

- `requireMembership(userId, orgId)` — returns the `OrganizationMember` or throws
  `ForbiddenException` (`organization_access_denied` event logged).
- `requireMembershipRole(userId, orgId, minimumRole)` — requires membership **and**
  a minimum role using the existing hierarchy `Owner(4) > Admin(3) > Technician(2) > Viewer(1)`
  (`src/common/role-hierarchy.ts`, shared `hasMinimumRole`).
- Used for: `GET/:id`, `PATCH/:id` (Owner), `POST/:id/switch`.
- Roles for target-org operations always come from the target org's membership,
  never from `req.user.role`. Tested: JWT Owner in org A cannot rename/switch
  org B where membership is Viewer.
- AuthService refresh independently validates the membership of the active org
  before reissuing tokens (denies and revokes the session if gone).

## 6. List API

`GET /organizations` queries `OrganizationMember`, not `User.orgId`:

- Finds memberships by `userId` (indexed), includes the organization, returns
  exactly the orgs the user belongs to. No cross-user org leakage.
- Response per org: `id`, `name`, `slug`, `plan`, `createdAt`,
  `membershipRole`, `isActive` (`orgId === req.user.orgId`).
- Deterministic ordering: active org first, then `createdAt` ascending.

## 7. Create API

`POST /organizations` `{ name }`:

- Authenticates the user (identity from `req.user.sub`).
- Validates/trims name (DTO) and derives slug with the existing `normalizeSlug`.
- Slug collisions handled with the signup-style retry loop (`-2`, `-3`, …).
- Single transaction: `create Organization` + `create OrganizationMember(userId, orgId, role: Owner)`.
- Does **not** auto-switch the active org — the client calls `/switch` explicitly.
- New org is empty: no device/alert/report/subscription data is cloned.
- `ownerId`/`userId`/`plan`/`stripeCustomerId`/`subscription`/`role` from the body
  are ignored (DTO whitelist + server-derived fields only).

## 8. Rename API

`PATCH /organizations/:id` `{ name }`:

- Requires membership **and** `Owner` role in the target org (`requireMembershipRole`).
  Conservative: Admin is NOT granted rename in this phase (full RBAC deferred).
- **Slug is preserved.** Slug is stable identity — SSO JIT provisioning
  (`sso.service.ts`) looks up organizations by slug, so regenerating it on rename
  would break org identity. Name-only update.
- Target-org-only: authorization is derived from the target org's membership.

## 9. Switch API

`POST /organizations/:id/switch` — the core capability:

1. Authenticate user.
2. `requireMembership(userId, targetOrgId)` — reject 403 if no membership.
3. Role taken from the membership.
4. Sync the compatibility pointer:
   - `User.orgId  = targetOrgId`
   - `User.role   = membership.role`
5. Update all non-revoked refresh tokens of the user to `orgId = targetOrgId`
   (refresh-session metadata hygiene; the refresh flow itself re-reads the live
   pointer, so no stale org can be silently restored).
6. Issue fresh auth state: `JWT { sub, orgId: targetOrgId, role: membership.role }`
   plus a fresh refresh token.
7. Returns `{ user, accessToken, refreshToken }` matching the login/signup shape.
8. `organization_switched` structured event logged.

## 10. Legacy Pointer Synchronization

Invariant maintained by switch and refresh:

| Field | Meaning | Source |
|---|---|---|
| `User.orgId` | Currently active/default org | `membership.orgId` on switch |
| `User.role` | Role in the active org | `membership.role` on switch |
| `OrganizationMember` | Authoritative membership + role | never mutated by switch |

Switching only updates `User` and the refresh-session org column — it never
mutates unrelated membership rows (explicitly tested).

## 11. JWT Contract

Shape unchanged: `{ sub, orgId, role }`. After switch the JWT carries the target
org and the membership role. `req.user.orgId` therefore flows through every
existing controller/service unchanged, so dashboard/devices/alerts/enrollment/
security/reports operate on the selected org with zero rewiring. WebSocket auth
uses the same JWT `orgId`, so a new socket connection with a switched token joins
`org:{targetOrgId}`.

## 12. Refresh Token Contract

Mechanism chosen: **Option C — derive the org from the live `User.orgId` pointer
at refresh time AND validate membership**, plus refresh-session org-column sync
on switch for hygiene.

- `refresh()` re-issues from `stored.user` using the membership of the active org.
- If the membership for the active org is gone (removed/revoked), refresh revokes
  the token and returns 401 — it never silently restores a previous org.
- Tests prove: switch A→B → refresh → still B; switch back B→A → refresh → still A;
  removed membership → switch and refresh denied.

## 13. Signup Compatibility

`AuthService.signup` transaction now atomically creates:

```
Organization
User (orgId, role: Owner)        <- unchanged legacy contract
OrganizationMember (userId, orgId, role: Owner)   <- NEW
```

Response shape and JWT behavior preserved. The ORG-01A1 backfill only covered
pre-existing users; future users are covered at signup time (acceptance gate,
tested). Login/MFA additionally repair a missing membership for the user's own
legacy org using the exact ORG-01A1 backfill mapping (idempotent, never an
arbitrary org) so pre-ORG-01A1 code paths cannot wedge logins; normal users
already have their membership.

## 14. Enrollment Regression

Server-trusted enrollment binding is unchanged. Tested end-to-end:

- Token issued while active in org A binds to A; after switching to B, a new
  token binds to B.
- A device registered with the A token lands in org A — never in B, even while
  the user is active in B.
- Agent reconnect stays bound to the original device/org (device-token hash
  lookup, untouched).

## 15. Cross-Org Isolation

Malicious-case coverage (all tested):

- User belongs only to org A: `GET /organizations/B`, `PATCH /organizations/B`,
  `POST /organizations/B/switch` → 403.
- User belongs to A + B: switch to B allowed.
- User is Viewer in B: rename B denied (JWT role Owner from A does not help).
- No orgs exposed outside membership in the list endpoint.
- `body.orgId` / `query.orgId` / header orgId are never accepted as authority for
  organization management; identity always comes from `req.user.sub` and the
  target from the route param.

## 16. WebSocket Compatibility

`createWsAuthMiddleware` reads `orgId` from the JWT and sockets join
`org:{orgId}` (devices/network/remote-support gateways). After a switch the new
access token carries the target org, so new WS connections automatically join
the selected org. No backend change required. Frontend reconnect-on-switch is
deferred to ORG-01C (documented in §22).

## 17. Tests Added

`apps/api-gateway/test/organizations.spec.ts` — 29 focused tests, all PASS:

- **LIST (5):** one membership → one org; two memberships → two orgs with correct
  per-membership roles + active flag; no cross-user org leak; useful fields;
  auth required.
- **CREATE (7):** org + OWNER membership; no fleet clone; no auto-switch; slug
  collision → `-2`; name validation; forbidden fields (`plan`, `ownerId`) ignored;
  auth required.
- **GET/CURRENT (3):** current returns active org; single org for member;
  non-member denied (403).
- **RENAME (4):** Owner allowed (slug preserved); Viewer denied despite JWT Owner
  from another org; non-member denied; target-org-only rename.
- **SWITCH (7):** member switch + fresh JWT org/role; non-member denied; `User.orgId`
  synced; `User.role` synced from membership; unrelated memberships untouched;
  refresh stays on B after A→B; refresh stays on A after switching back;
  removed membership → switch + refresh denied.
- **SIGNUP (1):** new signup creates default OWNER membership.
- **CROSS-ORG E2E (1):** A→B→A with dashboard device visibility, Viewer role in B,
  Owner-only action denied in B, refresh preserved after each switch.
- **ENROLLMENT REGRESSION (1):** token org binding through switches; A token cannot
  place a device in B.

## 18. Verification Results

| Suite | Result |
|---|---|
| `test/organizations.spec.ts` (new) | 29/29 PASS |
| api-gateway full suite (`jest --forceExit --runInBand`) | **705/705 PASS (41 suites)** |
| worker suite | **79/79 PASS (8 suites)** |
| web suite | **742/742 PASS (31 suites)** |
| `pnpm lint` (turbo, 7 tasks) | PASS |
| `pnpm build` (turbo, 7 tasks incl. `next build`) | PASS |

No pre-existing billing flake observed in this run (705/705, better than the
672/676 ORG-01A1 baseline). Auth, admin, enrollment, devices, dashboard, alerts,
monitoring, security, ws-auth, membership-schema, and slug-collision regression
suites all green. Worker schema remains byte-identical to api-gateway
(`diff` empty), so worker tests are unaffected by the app changes.

## 19. Files Changed

New:
- `apps/api-gateway/src/organizations/organizations.module.ts`
- `apps/api-gateway/src/organizations/organizations.controller.ts`
- `apps/api-gateway/src/organizations/organizations.service.ts`
- `apps/api-gateway/src/organizations/dto/create-organization.dto.ts`
- `apps/api-gateway/src/organizations/dto/update-organization.dto.ts`
- `apps/api-gateway/src/common/role-hierarchy.ts`
- `apps/api-gateway/test/organizations.spec.ts`
- `docs/v1/ORG-01A2_ORGANIZATION_API_ACTIVE_SWITCH_REPORT.md` (this report)

Modified:
- `apps/api-gateway/src/auth/auth.service.ts` — signup membership creation;
  login/MFA membership repair; refresh membership validation; `issueTokensForOrg`.
- `apps/api-gateway/src/app.module.ts` — register `OrganizationsModule`.

No schema, no migration, no worker source, no frontend, no Agent code changed.

## 20. Migrations

**NONE.** `OrganizationMember` already exists from ORG-01A1. `User.orgId` remains
REQUIRED, `User.role` untouched, no `ActiveOrganization` table introduced. The
`User.orgId` compatibility pointer is the active-org source for this phase.

## 21. Security Findings

- No auth weakening: JWT guard, roles guard, plan guard, throttling all unchanged.
- Membership is mandatory for every non-legacy org operation; JWT role alone is
  never sufficient for cross-org operations.
- Refresh cannot revert to a previous org and rejects when membership is removed.
- No org exposure outside membership; target orgs come only from route params.
- Forbidden DTO fields are whitelisted away; `plan`, `ownerId`, `userId`, `role`,
  `stripeCustomerId`, `subscription` cannot be assigned through create/rename.
- Structured observability events added (`organization_created`,
  `organization_switched`, `organization_access_denied`) via `StructuredLogger`;
  no JWTs, refresh tokens, enrollment tokens, or secrets are logged.
- No `any`/TS-suppression introduced (only the repo-wide `req: any` controller
  convention, matching all existing controllers).

## 22. Deferred to ORG-01A3 / ORG-01C

- Frontend organization switcher + organization settings UI → ORG-01C (requires
  the client to call `/switch`, persist the new token pair, and reconnect
  WebSockets with the new JWT; the backend contract is ready).
- Invites / pending membership / member-management UI → ORG-01C.
- Full RBAC (per-membership role as the sole source of truth everywhere) → ORG-01A3.
- Membership-specific removal APIs; `AdminService.removeUser` still deletes the
  User (memberships cascade) by design → ORG-01C.
- Making `User.orgId` nullable / dropping `User.role` → ORG-01A3.
- RLS hardening for `OrganizationMember` + `X-Org-Id` ingestion trust removal →
  ORG-01B (pre-existing F1/F2 decision, unchanged).
- Billing redesign, org delete, device transfer → out of scope.

## 23. Rollback Notes

- No migration was applied, so rollback = revert the code changes only:
  1. Remove `OrganizationsModule` from `AppModule`.
  2. Revert `auth.service.ts` to the ORG-01A1 version (signup/refresh changes gone;
     the schema/backfill remains, harmless — refresh simply stops validating
     membership and signup stops creating memberships, relying on backfill again).
- Deleting the new files (`src/organizations/`, `role-hierarchy.ts`,
  `test/organizations.spec.ts`) restores the exact ORG-01A1 runtime.
- No data was modified destructively during development or certification.

## 24. Final Status

**ORG-01A2 COMPLETE — MULTI-ORG BACKEND READY**

| Gate | Result |
|---|---|
| Organization list works | PASS |
| Organization creation works | PASS |
| OWNER membership created | PASS |
| Rename authorization works | PASS |
| Switch validates membership | PASS |
| `User.orgId` syncs to active org | PASS |
| `User.role` syncs from membership | PASS |
| JWT switches org | PASS |
| Refresh does not revert org | PASS |
| Signup creates membership | PASS |
| Cross-org access denied | PASS |
| Existing org-scoped services compatible | PASS |
| Enrollment org binding preserved | PASS |
| No frontend required for backend test | PASS |
| No Agent regression | PASS (worker suite 79/79) |
| No Monitoring regression | PASS |
| No secrets exposed | PASS |
| No migration required | PASS (zero migrations) |

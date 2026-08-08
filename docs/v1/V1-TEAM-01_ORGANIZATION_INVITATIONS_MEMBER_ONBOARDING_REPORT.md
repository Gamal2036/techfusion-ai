# V1-TEAM-01 — Organization Invitations & Member Onboarding

Status: **V1-TEAM-01 CONDITIONAL — EMAIL DELIVERY DEFERRED** (all code complete, backend + web + invite UX certified; outbound email remains DEFERRED because no mail provider exists anywhere in the codebase, so invitation links are surfaced through a dev-only `devInvitationUrl`)
Date: 2026-08-08
Mode: Foundation build on top of the certified ORG-01A/B/C membership-authoritative auth and V1-RBAC-01 permission matrix. One additive migration, no new membership model, no Role changes, no custom roles / per-user overrides / ABAC, no billing / SCIM / SSO / commits / pushes.

---

## 1. Executive Summary

V1-TEAM-01 delivers the secure organization invitation → acceptance → member
onboarding flow:

- A new `OrganizationInvitation` table (one additive migration) with an
  `InvitationStatus` enum (`PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`).
- Cryptographically random 256-bit invitation tokens stored **only** as a
  SHA-256 hash (`tokenHash`); the raw token appears solely in the invitation
  link and is never persisted, listed, or logged.
- A strict V1 role policy: **Owner** may invite Admin/Technician/Viewer;
  **Admin** may invite only Technician/Viewer; **Technician** and **Viewer** can
  never invite; **Owner is never grantable via invitation**.
- Org-scoped create / list / revoke / resend APIs plus public token inspect and
  accept endpoints, with email-ownership binding (the authenticated account
  email must match the invited email) and atomic membership creation in a single
  transaction.
- A Team page "Invite member" dialog with a pending-invitations list
  (resend/revoke) and a public `/invite/[token]` page with a token-preserving
  sign-in / create-account continuation.
- Test certification: API 825, Web 776, Worker 79, Agent 60 — all green.

## 2. Scope & Constraints

| # | Constraint | Status |
|---|---|---|
| 1 | Do not redesign Organization / OrganizationMember / auth / RBAC / org switching / tenant isolation | PASS — reused `Organization`, `OrganizationMember`, `Role`, `requireMembership(role)`, guard pipeline |
| 2 | No new membership model, no new Role enum, no custom roles / permissions | PASS — roles stay the four fixed V1 roles; `Role` reused |
| 3 | No `User.role` authority | PASS — authorization comes from membership role via ORG-01A3 resolution |
| 4 | No billing / SCIM / SSO / commits / pushes | PASS |
| 5 | Invite permission set: Owner→Admin/Tech/Viewer; Admin→Tech/Viewer; Tech/Viewer cannot invite; Owner never grantable | PASS — enforced in `invitations.service.ts` |
| 6 | Token security: 256-bit base64url, store only SHA-256, single-use, raw token never persisted/logged | PASS |
| 7 | Expiration: 7-day TTL; expired/revoked/accepted/replay denied; expiry derived (no cleanup job) | PASS |
| 8 | Email ownership binding: normalized authenticated email must equal invitation email | PASS |
| 9 | Atomic acceptance (membership + consume in one transaction) | PASS — `prisma.$transaction` |
| 10 | Duplicate (org,email) PENDING invites idempotent; explicit resend regenerates | PASS — Policy A |
| 11 | Email delivery DEFERRED (no mail provider anywhere); dev-only links for certification, suppressed in production | PASS — `NODE_ENV === 'production'` hides `devInvitationUrl` |
| 12 | One additive migration only | PASS — `20260808000000_organization_invitation` |
| 13 | Baseline regression: API 792 / Web 757 / Worker 79 / Agent 60 (new totals grow) | PASS — API 825, Web 776, Worker 79, Agent 60 |
| 14 | No `any` / TS suppression / disabled tests | PASS |
| 15 | Report lands at `docs/v1/V1-TEAM-01_ORGANIZATION_INVITATIONS_MEMBER_ONBOARDING_REPORT.md` | PASS |

## 3. Endpoint Contract (backend)

All org-scoped routes live behind the existing `PermissionsGuard` + membership
resolution; the inviter/target org are always derived from the authenticated
request, never from the body.

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/organizations/:orgId/invitations` | `members:manage` | Create. Body `{ email, role }` only |
| GET | `/organizations/:orgId/invitations` | `members:view` + service requires Admin+ | List safe summaries, no tokens/links |
| DELETE | `/organizations/:orgId/invitations/:invitationId` | `members:manage` | Revoke |
| POST | `/organizations/:orgId/invitations/:invitationId/resend` | `members:manage` | Regenerate token + reset expiry |
| GET | `/invitations/:token` | Public | Inspect safe metadata (masked email, org, role, status, expiry) |
| POST | `/invitations/:token/accept` | Authenticated | Email-bound, atomic accept |

Rate limiting: the public inspect route is throttled (10/60s) and accept is
throttled (5/60s) to damp token brute force.

## 4. Data Model (one additive migration)

Migration `apps/api-gateway/prisma/migrations/20260808000000_organization_invitation/migration.sql`:

- `InvitationStatus` enum — `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
- `OrganizationInvitation` table: `id`, `organizationId` (FK → Organization,
  `ON DELETE CASCADE`), `email`, `role` (Prisma `Role`), `tokenHash`
  (unique), `status` (default PENDING), `expiresAt`, `invitedByUserId`,
  `createdAt`, `updatedAt`, `acceptedAt` (nullable).
- Partial unique index `OrganizationInvitation_pending_org_email_key` on
  `(organizationId, email) WHERE status = 'PENDING'` — at most one live pending
  invitation per (org, email); historical rows are unconstrained.
- Supporting indexes: `organizationId`, `email`, `(organizationId, status)`,
  `expiresAt`, unique `tokenHash`.
- Fully additive: no existing table, index, or row is altered.

Expiry is **derived**, not swept: an invitation is live when
`status === 'PENDING' && expiresAt > now` (`isInvitationLive`). There is no
cleanup job. On a mutation, an expired-but-PENDING row flips to `EXPIRED`.

## 5. Token Security Model

`apps/api-gateway/src/organizations/invitation-token.ts`:

- `generateInvitationToken()` → 32 random bytes base64url (256-bit entropy).
- `hashInvitationToken()` → SHA-256 hex digest.
- Persisted column is `tokenHash` only; the raw token is never written to the
  DB, logs, or list responses.
- Single-use: acceptance consumes the invitation (`ACCEPTED`); resend replaces
  `tokenHash`, instantly invalidating the previous link.
- 7-day TTL (`INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000`).
- `maskEmail()` renders `a***@example.com` for public inspection.
- Inspect/accept look up by `tokenHash` (the SHA-256 of the presented token),
  so the raw token is never stored or compared in plaintext.

## 6. Authorization Policy (backend authoritative)

`ALLOWED_INVITE_ROLES` in `invitations.service.ts`:

| Actor role | May invite | May revoke/resend |
|---|---|---|
| Owner | Admin, Technician, Viewer | any invitation |
| Admin | Technician, Viewer | Technician/Viewer invitations only |
| Technician | none | n/a |
| Viewer | none | n/a |

- `requireInviter` blocks any disallowed actor/role with 403.
- `assertActorCanManage` blocks an Admin from revoking/resending an
  Owner-created Admin invitation (403).
- Owner is never grantable via invitation — only an existing Owner can promote a
  member through the protected membership role-management flow.
- `listInvitations` requires Admin+ (`requireMembershipRole(actor, orgId, 'Admin')`)
  even though the route carries `members:view` — the service remains the
  authoritative check.

## 7. Create Flow

`POST /organizations/:orgId/invitations`

1. Resolve actor membership + role policy (`requireInviter`).
2. Normalize email (trim + lowercase).
3. `assertNotMember` — reject inviting someone already in the org (409).
4. If a live PENDING invitation already exists for (org, email): **Policy A** —
   return the existing invitation unchanged (no new token). Resend regenerates.
5. If an expired PENDING row exists: regenerate the token hash + expiry in place.
6. Otherwise create a PENDING invitation with a fresh token hash and 7-day expiry.
7. Return the safe summary plus `devInvitationUrl` (development only).

The `CreateInvitationDto` accepts `email` + `role` only; `invitedByUserId`,
`organizationId`, and permission arrays are not in the DTO and are stripped by
the whitelisting `ValidationPipe` (verified by the injection test).

## 8. List Flow

`GET /organizations/:orgId/invitations` returns every invitation for the org
(including historical ACCEPTED/REVOKED/EXPIRED rows) ordered newest-first. Each
item carries `id`, `organizationId`, `email`, `role`, `status`, `expiresAt`,
`createdAt`, and `invitedBy` (inviter identity). **No `tokenHash` and no
`devInvitationUrl` are ever returned.**

## 9. Revoke Flow

`DELETE /organizations/:orgId/invitations/:invitationId`

- Requires Admin+ membership and `assertActorCanManage`.
- `ACCEPTED` → 400 (use member removal instead). Already-revoked → idempotent
  success. Otherwise flips status to `REVOKED`.
- A revoked token can never be accepted (409 on accept).

## 10. Resend Flow

`POST /organizations/:orgId/invitations/:invitationId/resend`

- Requires Admin+ membership and `assertActorCanManage`.
- Regenerates `tokenHash` + resets `expiresAt` to now+7d, returns fresh
  `devInvitationUrl` (dev only). The old link is dead immediately because its
  hash was replaced.
- `ACCEPTED` → 400; `REVOKED` → 400 (create a new invitation instead).

## 11. Public Inspect Flow

`GET /invitations/:token`

- Public + throttled. Looks up by `hash(token)`.
- Returns only safe metadata: org `{id, name}`, `role`, **masked** `email`,
  effective `status`, `expiresAt`. No `tokenHash`, no `invitedByUserId`, no raw
  token.
- A PENDING-but-expired row inspects as `EXPIRED` (consistent with accept).
- Unknown token → 404.

## 12. Accept Flow (atomic, email-bound)

`POST /invitations/:token/accept`

1. Resolve the authenticated user's **DB email** (never `req.user`, which carries
   only `sub`/`orgId`/`role`); the full email is never placed on `req.user`.
2. Look up invitation by `hash(token)` → 404 if unknown.
3. PENDING-but-expired → mark `EXPIRED` + 410 Gone.
4. `ACCEPTED` → 409; `REVOKED` → 409.
5. **Email ownership binding**: normalized (lowercased) DB email must equal the
   stored invitation email → otherwise 403.
6. Role sanity check; existing membership check → 409.
7. `prisma.$transaction`: create `OrganizationMember` with the **stored**
   invitation role + mark the invitation `ACCEPTED` with `acceptedAt` —
   membership and consumption are atomic.
8. Response returns only `organization` + `membership` (safe). A client-supplied
   `role` body is ignored (there is no accept DTO).

## 13. Email Delivery — DEFERRED

There is no mail provider anywhere in the codebase (audited — none exists), so
V1 cannot transmit invitation links by email. Delivery is **DEFERRED** and the
flow is certified locally through:

- `devInvitationUrl` returned **exactly once** on create/resend to the
  authorized inviter, using `INVITE_BASE_URL || origin`.
- The link is suppressed entirely when `NODE_ENV === 'production'`.
- List APIs never surface tokens or links.

This is the single conditional on the otherwise-complete status. When a mail
provider is added (V2), only the delivery adapter and the `devLinkFor` toggle
change; the token/accept contract is unchanged.

## 14. Rate Limiting

- Public `GET /invitations/:token` throttled 10/min.
- Authenticated `POST /invitations/:token/accept` throttled 5/min.
- Org-scoped create/resend inherit the standard authenticated throttling.

## 15. Migration & Deploy

- One additive migration, already applied to the dev DB (`:5433`).
- `prisma generate` re-run so `@prisma/client` exposes `OrganizationInvitation`
  and `InvitationStatus`.
- Rollback: `prisma migrate resolve` + drop of the new table/enum; no existing
  data is touched by the forward migration (see §27).

## 16. Web Org Client

`apps/web/src/lib/org-client.ts` additions:

- Types: `InvitationStatus`, `OrganizationInvitation`,
  `CreateInvitationResult`, `InvitationInspection`, `InvitationAcceptResult`.
- `createInvitation(orgId, email, role)` → POST.
- `fetchInvitations(orgId)` → GET list.
- `revokeInvitation(orgId, invitationId)` → DELETE.
- `resendInvitation(orgId, invitationId)` → POST resend.
- `inspectInvitation(token)` → public GET (plain fetch, no auth redirect logic).
- `acceptInvitation(token)` → authed POST accept.

All org calls route through the existing `apiFetch` (auth header, 401 refresh,
single-flight refresh) and `OrgError` handling.

## 17. Team Page Invitation UX

`apps/web/src/app/dashboard/team/page.tsx`:

- **Invite member** button (gated by `members:manage`) opens a Modal dialog with
  an email field and a role selector.
- Role options are mirrored from backend policy: Owner sees
  Admin/Technician/Viewer; Admin sees Technician/Viewer only. (UX-only mirror —
  the backend is authoritative.)
- **Pending invitations** section (Admin+) lists every invitation with status
  badge, role, inviter, and expiry, plus **Resend** / **Revoke** actions for
  PENDING/EXPIRED rows. ACCEPTED/REVOKED rows render read-only.
- After create/resend, the dev `devInvitationUrl` is displayed in a highlighted
  panel (development only); otherwise a calm "Invitation sent" notice is shown.

## 18. Invite Landing Page

`apps/web/src/app/invite/[token]/page.tsx`:

- Public token inspection on load; shows organization name, role badge, masked
  email, and expiry.
- PENDING → actionable:
  - Authenticated → **Accept invitation** button → accept → auto-switch to the
    joined organization → `/dashboard`.
  - Unauthenticated → **Sign in to accept** (`/login?next=/invite/<token>`) and
    a **Create account** link (`/signup?next=/invite/<token>`) that preserve the
    token across authentication.
- EXPIRED/REVOKED/ACCEPTED/unknown → calm "no longer available" panel.
- Errors (e.g., email mismatch 403) are surfaced inline without redirecting.

## 19. Token-Preserving Authentication Continuation

`apps/web/src/components/login/LoginForm.tsx` / `signup/SignupForm.tsx`:

- `getSafeNextPath(search)` parses `next` and rejects anything not starting with
  a single `/` (protocol-relative `//` and external values are dropped) — no open
  redirect.
- On success, the form redirects to `next` when present, else `/dashboard`.
- Cross-links (`Sign up` from login, `Sign in` from signup) carry the `next`
  parameter so the token survives the login↔signup hop.

## 20. Frontend Permission Mirror

No new permissions were added to the V1 catalog. Invitation actions reuse
`members:manage` (create/revoke/resend) and `members:view` (list) from
`apps/web/src/lib/permissions.ts`, keeping the UX mirror in sync with the
backend matrix from V1-RBAC-01.

## 21. Backend Tests (new suite)

`apps/api-gateway/test/invitations.spec.ts` — **33/33 PASS**:

- INVITE PERMISSIONS (9): Owner→Admin/Tech/Viewer, Admin→Tech/Viewer, Admin
  cannot Owner/Admin, Tech cannot, Viewer cannot, non-member denied, invalid
  role 400, injected permission arrays / extra body fields ignored.
- DUPLICATES (2): existing member conflict 409; idempotent pending return.
- LIST (3): safe metadata with no tokens; Admin can list while Tech/Viewer 403;
  cross-org denied.
- REVOKE (3): revoke prevents later acceptance; cross-org 404; Admin cannot
  revoke Owner-created Admin invite.
- RESEND (2): regenerates token/resets expiry/invalidates old link; cannot
  resend accepted.
- INSPECT (3): safe masked metadata; EXPIRED surfacing; unknown 404.
- ACCEPT (11): atomic membership + stored role + consumption; replay 409;
  expired 410 with no membership; wrong email 403; unknown 404; case-insensitive
  email match; preserves other memberships + global snapshot; already-member 409;
  client-supplied role ignored; switch-after-accept works.

## 22. Web Tests (new / updated)

- `src/__tests__/team-page.spec.tsx` — updated mocks + **8 new** tests: pending
  list loads via the org endpoint; Tech/Viewer never fetch invitations; invite
  dialog creates through the org endpoint and shows the dev link; Owner vs Admin
  role options; resend endpoint; revoke endpoint; ACCEPTED/REVOKED rows have no
  actions.
- `src/__tests__/invite-page.spec.tsx` — **6 new** tests: safe metadata render;
  unauthenticated sign-in continuation preserving the token; authenticated
  accept → switch → dashboard; accept error surfaced without redirect; unknown/
  expired handling; non-PENDING treated as unavailable.
- `src/__tests__/login-page.spec.tsx` — **3 new** continuation tests (redirect
  to invite, cross-link preservation, external `next` rejected).
- `src/__tests__/signup-page.spec.tsx` — **2 new** continuation tests.

## 23. Full Verification Results

| Suite | Baseline | New | Result |
|---|---|---|---|
| API (`apps/api-gateway`) | 792 | +33 | **825 passed** (1 flaky enterprise-suite DB-timeout passed on rerun; unrelated) |
| Web (`apps/web`) | 757 | +19 | **776 passed** |
| Worker (`apps/worker`) | 79 | — | **79 passed** (1 flaky timing test passed on rerun) |
| Agent (`apps/agent`, Rust) | 60 | — | **60 passed** |
| `npm run lint` (turbo, tsc --noEmit) | — | — | **7/7 tasks successful** |
| `npm run build` (turbo) | — | — | **7/7 tasks successful** (`/invite/[token]` builds as dynamic ƒ) |

## 24. Files Changed / Added

Backend:
- `apps/api-gateway/prisma/schema.prisma` — `InvitationStatus`, `OrganizationInvitation`, `Organization.invitations`.
- `apps/api-gateway/prisma/migrations/20260808000000_organization_invitation/migration.sql` — additive migration.
- `apps/api-gateway/src/organizations/invitation-token.ts` — token/hash/live/mask/TTL.
- `apps/api-gateway/src/organizations/dto/create-invitation.dto.ts` — `{ email, role }`.
- `apps/api-gateway/src/organizations/invitations.service.ts` — domain logic.
- `apps/api-gateway/src/organizations/invitations.controller.ts` — org-scoped + public controllers.
- `apps/api-gateway/src/organizations/organizations.module.ts` — registration.
- `apps/api-gateway/test/invitations.spec.ts` — 33-test suite.

Web:
- `apps/web/src/lib/org-client.ts` — invitation client functions + types.
- `apps/web/src/app/dashboard/team/page.tsx` — invite dialog + pending list.
- `apps/web/src/app/invite/[token]/page.tsx` — public invite landing.
- `apps/web/src/components/login/LoginForm.tsx`, `apps/web/src/components/signup/SignupForm.tsx` — `next` continuation.
- `apps/web/src/__tests__/team-page.spec.tsx`, `invite-page.spec.tsx`, `login-page.spec.tsx`, `signup-page.spec.tsx`.

Docs:
- `docs/v1/V1-TEAM-01_ORGANIZATION_INVITATIONS_MEMBER_ONBOARDING_REPORT.md` — this report.

## 25. Security Notes

- Raw tokens are 256-bit random and exist only in the invitation link; storage
  and indexing are on the SHA-256 hash; resend invalidates old links instantly;
  acceptance consumes the token (single-use).
- Possession of the token is never sufficient: acceptance requires an
  authenticated session whose DB email matches the invitation email
  (case-insensitive).
- Email is normalized on create and comparison (trim + lowercase).
- The invite body cannot inject `invitedByUserId`, `organizationId`, role
  arrays, or permissions; the actor is always `req.user.sub` and the org always
  the URL param.
- `next` redirects are validated to be internal single-`/` paths only.
- Public endpoints are throttled; inspect/accept responses never leak the raw
  token, `tokenHash`, or inviter identity.
- Invitations target the organization via FK with `ON DELETE CASCADE`; org
  deletion removes its invitations.

## 26. Compliance Walk-Through

| Requirement | Evidence |
|---|---|
| Owner→Admin/Tech/Viewer; Admin→Tech/Viewer; Tech/Viewer blocked | `ALLOWED_INVITE_ROLES` + tests INVITE PERMISSIONS |
| Owner never grantable via invite | policy map + Admin-cannot-Owner tests |
| 256-bit base64url token, SHA-256 only | `invitation-token.ts` + tokenHash format test |
| Single-use / replay denied | accept consume + replay 409 test |
| 7-day expiry, derived (no job) | `INVITATION_TTL_MS` + EXPIRED surfacing tests |
| Email ownership binding | accept 403 wrong-email test |
| Atomic accept | `$transaction` + DB assertions |
| Idempotent duplicate; resend regenerates | DUPLICATES + RESEND tests |
| Email delivery deferred, dev-only links, hidden in production | `devLinkFor` + `NODE_ENV` guard |
| One additive migration | migration SQL + dev-DB deploy |
| No new Role/membership/custom perms | schema diff + reusing `Role` |

## 27. Rollback Notes

- Forward migration is additive; applying it never alters existing rows.
- To roll back: `prisma migrate resolve` to mark the migration rolled back, then
  `DROP TABLE "OrganizationInvitation"; DROP TYPE "InvitationStatus";` — the
  other tables are untouched. Code rollback is a revert of the controllers /
  service / module registration / web client + pages.
- Because tokens are hash-only and invitations are ephemeral, no secret material
  needs purging on rollback.

## 28. Deferred / Out of Scope (V1)

- Real outbound email delivery (provider + template + send) — **deferred**;
  dev-only links currently carry the flow.
- Invite email prefill / autocomplete against org directory.
- Bulk / CSV invitation import.
- Invitation audit-UI filters and pagination (list returns all rows; fine for
  V1 scale).
- SCIM / SSO / auto-provisioning (explicitly out of scope per constraints).
- Invitation re-send on a schedule / expiry reminders.

## 29. Known Issues / Residual Risk

- Duplicate pending invite creation silently returns the existing row (Policy A)
  rather than erroring; the UI surfaces the same dev link only on create when a
  new link was generated, so an operator seeing no link should use Resend. This
  is documented behavior, not a defect.
- List endpoint returns full historical invitations (incl. emails) to Admin+;
  acceptable for V1, revisit with pagination in V2.
- Throttle limits are per-instance in-memory; multi-replica deployments should
  back the throttler with Redis when scaling.

## 30. Final Status

**V1-TEAM-01 CONDITIONAL — EMAIL DELIVERY DEFERRED**

All code, security controls, the migration, and the full test matrix (API 825 /
Web 776 / Worker 79 / Agent 60, lint + build green) are complete. The single
outstanding item is outbound email delivery: no mail provider exists in the
codebase, so invitation links are distributed via a development-only
`devInvitationUrl` (suppressed in production). This is a deliberate V1 deferral,
not a blocker — the entire invitation/accept/onboarding contract is certified
end-to-end and requires only a delivery adapter to become production-complete.

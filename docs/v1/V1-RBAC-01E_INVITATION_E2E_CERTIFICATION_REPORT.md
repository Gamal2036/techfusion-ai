# V1-RBAC-01E — Invitation E2E Completion

Status: **IMPLEMENTATION: PASS — AUTOMATED TESTS: PASS — REAL-DEVICE E2E: PENDING**
Date: 2026-08-08
Mode: Audit → Fix → Test → Certify on top of the certified ORG-01A/B/C membership-authoritative auth, V1-TEAM-01 invitation foundation, and V1-RBAC-01 permission matrix. No schema change, no membership/RBAC redesign, no new roles, no email provider integration, no commits, no pushes.

---

## 1. Executive Summary

V1-TEAM-01 delivered invitation creation, token hashing, list/revoke/resend, a
Team-page UI, and a public `/invite/[token]` page. The single E2E blocker was:

```
404
Not Found
Cannot GET /invite/<token>
```

This report documents the root cause, the fix (invitation URL ownership), the
verification performed (backend + web automated suites), the security properties
that remain intact, and the manual real-device test contract that is still
PENDING.

---

## 2. Root Cause of the 404

**The generated development invitation URL pointed at the API gateway origin
instead of the web application.**

Trace:

1. The Team page calls `POST /organizations/:orgId/invitations` on the API
   gateway (`http://localhost:3001`).
2. The controller built the invitation base URL from the *API request's own
   origin*:

   ```ts
   // invitations.controller.ts (before)
   function originOf(req) {
     const proto = req.headers?.['x-forwarded-proto'] || req.protocol || 'http';
     const host  = req.headers?.host || 'localhost:3000';
     return `${proto}://${host}`;
   }
   ```

   Because the browser calls the API directly, `req.headers.host` is
   `localhost:3001`, so `originOf` returned `http://localhost:3001`.
3. `devLinkFor` produced `http://localhost:3001/invite/<token>`.
4. The web application (Next.js on `http://localhost:3000`) owns the
   `/invite/[token]` page — but the link never pointed there.
5. The API gateway (NestJS/Express on port 3001) has no route at
   `/invite/:token` (its public route is `GET /invitations/:token`), so opening
   the link returned Express's default 404:

   ```
   Cannot GET /invite/<token>
   ```

**The invite page itself already existed and was correct.** The failure was
purely URL ownership: a human-facing link was built on an API-only origin.

---

## 3. Architecture Before / After

| Aspect | Before | After |
|---|---|---|
| Invitation link base URL | `originOf(req)` → API request Host header (`http://localhost:3001`) | `WEB_APP_URL` env (dev default `http://localhost:3000`); API request origin never used |
| Dev link shape | `http://localhost:3001/invite/<token>` (404) | `http://localhost:3000/invite/<token>` (resolves to Next.js page) |
| Config | `INVITE_BASE_URL` legacy fallback only, never documented | `WEB_APP_URL` documented in `.env.example`, REQUIRED in production via startup validation |
| Production | — | `WEB_APP_URL` must be set (validated at boot) so future email links are configurable without code changes |

The invitation token remains the only secret inside the link; it is the raw
base64url token, never persisted (only its SHA-256 hash is stored).

---

## 4. Route Architecture

| Route | Owner | Auth | Purpose |
|---|---|---|---|
| `POST /organizations/:orgId/invitations` | API (NestJS) | `members:manage` | Create invitation |
| `GET /organizations/:orgId/invitations` | API | `members:view` (+Admin+ in service) | List invitations (no tokens) |
| `DELETE /organizations/:orgId/invitations/:invitationId` | API | `members:manage` | Revoke |
| `POST /organizations/:orgId/invitations/:invitationId/resend` | API | `members:manage` | Regenerate token + expiry |
| `GET /invitations/:token` | API | Public (throttled 10/60s) | Inspect safe metadata |
| `POST /invitations/:token/accept` | API | Authenticated (throttled 5/60s) | Email-bound atomic accept |
| `GET /invite/[token]` | Web (Next.js page) | Public page; CTA depends on auth | Human-facing invitation page |
| `/login?next=/invite/<token>` / `/signup?next=/invite/<token>` | Web | — | Unauthenticated continuation preserving the token |

The web page already implemented all required states (verified, not rebuilt):

- **A** Valid + authenticated matching user → org/role card + **Accept invitation**.
- **B** Valid + unauthenticated → **Sign in to accept** / **Create account** with `next=/invite/<token>` (token preserved through auth; `LoginForm`/`SignupForm` honor only same-origin `next` paths).
- **C** Valid + authenticated wrong email → accept returns 403, surfaced inline; no switch, no redirect.
- **D** Expired → inspection reports `EXPIRED` → "This invitation is no longer available".
- **E** Revoked → inspection reports `REVOKED` → unavailable state.
- **F** Accepted → inspection reports `ACCEPTED` → unavailable state.
- **G** Invalid/nonexistent token → 404 from inspect → unavailable state.

---

## 5. Invitation Lifecycle

| State | Inspect (`GET /invitations/:token`) | Accept (`POST /invitations/:token/accept`) |
|---|---|---|
| `PENDING` (within 7-day TTL) | org name, role, masked email, `PENDING`, expiry | Allowed |
| `PENDING` (past TTL) | reported as `EXPIRED` | 410 Gone, row flipped to `EXPIRED` |
| `ACCEPTED` | reported as `ACCEPTED` | 409 Conflict (single-use, no replay) |
| `REVOKED` | reported as `REVOKED` | 409 Conflict |
| Unknown token | 404 | 404 |

- **Resend** regenerates the token hash (old link invalid immediately) and
  resets the 7-day expiry; cannot resend ACCEPTED or REVOKED.
- **Revoke** flips to `REVOKED` and invalidates future acceptance immediately;
  an ACCEPTED invitation cannot be revoked (remove the member instead).
- No schema change; the existing `InvitationStatus` enum names are preserved.

---

## 6. Email-Binding Security (Security Critical)

`acceptInvitation`:

1. Looks the invitation up by `tokenHash` (raw token never stored).
2. Enforces state/expiry checks.
3. Compares `normalizeEmail(authenticatedUser.email)` (trim + lowercase) against
   the stored invitation `email`.
4. Mismatch → 403 `ForbiddenException`; the invitation stays `PENDING` and no
   membership is created.
5. Creates the `OrganizationMember` and consumes the invitation **in a single
   `prisma.$transaction`** — double-click/retry cannot duplicate the membership
   (`@@unique([userId, orgId])` + single-use consume). A replay returns 409 and
   the membership count stays unchanged.
6. The role is taken from the invitation row (`INVITEABLE_ROLES` subset), never
   from client input; **Owner is never grantable via invitation**.

---

## 7. Role Activation & Owner Protection

- Invited user is provisioned with exactly the invitation `role`
  (`ADMIN`/`TECHNICIAN`/`VIEWER`) as a member of the invited org.
- They are **never** OWNER.
- After acceptance the web page calls `switchToOrganization(orgId)` (token-pair
  replaced atomically, org-scoped sockets disconnected, `ORG_SWITCH_EVENT`
  fired) and redirects to `/dashboard`, so the new member immediately operates
  under the assigned role.
- Backend authorization is authoritative: the permissions guard resolves the
  role from the *membership row of the target org* (ORG-01A3), never from the
  JWT. Frontend hiding is not authorization.
- Owner-only operations (`organization:update`, `members:remove`,
  `billing:manage`, …) require the `Owner` membership role; `rbac-permissions.spec.ts`
  proves ADMIN is denied these and Viewer is read-only.

---

## 8. Tenant-Isolation Verification

Invitation acceptance adds membership **only** to the invited org. Verified by:

- Cross-org list/revoke/accept denial (existing suites).
- New test: an accepted ADMIN member of the invited org cannot read
  `/organizations/<unrelated>/` or `/organizations/<unrelated>/invitations`
  (403).
- New test: the raw token is org-bound — it provisions membership in the invited
  org only.
- `tenant-isolation-security.spec.ts` (device/network/security inventory
  ingestion, cross-tenant reads/writes, enrollment binding) — all green.

---

## 9. Files Modified

Implementation (V1-RBAC-01E):

| File | Change |
|---|---|
| `apps/api-gateway/src/organizations/invitation-token.ts` | Added `getWebAppBaseUrl()` (precedence: `WEB_APP_URL` > `INVITE_BASE_URL` legacy > fallback > dev default `http://localhost:3000`) |
| `apps/api-gateway/src/organizations/invitations.service.ts` | `devLinkFor()` builds the link from `getWebAppBaseUrl()`; dev-only link still suppressed in production |
| `apps/api-gateway/src/organizations/invitations.controller.ts` | `originOf()` now returns `getWebAppBaseUrl()`; the API request origin (Host header) is never used for link generation |
| `apps/api-gateway/src/config/env.validation.ts` | `WEB_APP_URL` is required in production (startup validation) |
| `apps/api-gateway/.env.example` | Documented `WEB_APP_URL` under a new "Web application" section |

Tests:

| File | Change |
|---|---|
| `apps/api-gateway/test/invitations.spec.ts` | Added `DEV INVITATION URL OWNERSHIP` (2 tests) and `ADMIN INVITATION E2E` (4 tests: ADMIN acceptance / not-OWNER, org-list + switch with ADMIN JWT, org-bound token, cross-org isolation for accepted ADMIN) |

No web source files were modified — the `/invite/[token]` page, login/signup
`next` continuation, and Team page dev-link surface were already correct.

**Migrations: none** (schema unchanged).

---

## 10. Tests Added (targeted matrix)

| # | Requirement | Where | Result |
|---|---|---|---|
| 1 | Owner creates ADMIN invitation | `invitations.spec.ts` | PASS |
| 2 | Correct email accepts | `invitations.spec.ts` | PASS |
| 3 | Membership created with ADMIN | `invitations.spec.ts` | PASS |
| 4 | User is NOT OWNER | `invitations.spec.ts` | PASS |
| 5 | Organization appears for accepted member | `invitations.spec.ts` (org list + switch) | PASS |
| 6 | Wrong email denied (403) | `invitations.spec.ts` | PASS |
| 7 | Invalid token denied (404) | `invitations.spec.ts` | PASS |
| 8 | Expired invitation denied (410) | `invitations.spec.ts` | PASS |
| 9 | Revoked invitation denied (409) | `invitations.spec.ts` | PASS |
| 10 | Accepted token cannot be replayed (409) | `invitations.spec.ts` | PASS |
| 11 | Duplicate acceptance → no duplicate membership | `invitations.spec.ts` | PASS |
| 12 | Unauthenticated flow preserves token through login | `web/__tests__/invite-page.spec.tsx` | PASS |
| 13 | Organization isolation intact | `tenant-isolation-security.spec.ts`, `invitations.spec.ts` | PASS |
| 14 | ADMIN cannot execute OWNER-only action | `rbac-permissions.spec.ts` | PASS |
| 15 | VIEWER cannot execute higher-permission mutation | `rbac-permissions.spec.ts` | PASS |
| + | Dev invite URL resolves to the web app base | `invitations.spec.ts` | PASS |
| + | `WEB_APP_URL` honored when configured | `invitations.spec.ts` | PASS |

---

## 11. Commands Executed & Results

| Command | Result |
|---|---|
| `pnpm --filter @techfusion/api-gateway lint` (`tsc --noEmit`) | PASS |
| `pnpm --filter @techfusion/api-gateway build` (`tsc`) | PASS |
| `pnpm --filter @techfusion/api-gateway test -- invitations` | **39/39 PASS** |
| `pnpm --filter @techfusion/api-gateway test -- organizations membership-authoritative membership-schema rbac-permissions tenant-isolation-security organization-lifecycle` | **105/105 PASS** |
| `pnpm --filter @techfusion/api-gateway test -- auth.spec app.integration security.spec` | **137/137 PASS** (includes ws-auth, full-e2e-scenario) |
| `pnpm --filter @techfusion/web lint` (`tsc --noEmit`) | PASS |
| `pnpm --filter @techfusion/web test` (full suite) | **34 suites / 776 tests PASS** |
| `pnpm --filter @techfusion/web test -- invite-page team-page` | **24/24 PASS** |

No NEW regressions. The only non-fatal stderr output observed was a
`PresenceSweepSchedulerService` Redis lock log during API test runs and a
`[AlertsGateway] Server not initialized` console warning inside an expected
`toThrow` test — both pre-existing / environmental, unrelated to this change.

---

## 12. Known Limitations

- **Email delivery remains deferred.** There is no mail provider in the
  codebase. The development invitation link (`devInvitationUrl`) is returned
  once to an authorized inviter and is suppressed when
  `NODE_ENV=production`. Production will rely on a future email provider
  consuming the same `WEB_APP_URL/invite/<token>` URL — no membership/RBAC
  changes will be required.
- The invite page shows the invited email masked (`a***@example.com`); the
  invitee confirms their own email via the link they received.
- `WEB_APP_URL` should be set explicitly in non-default development setups
  (e.g. a web app not on port 3000). The default is `http://localhost:3000`.

---

## 13. Manual Real-Device Test Instructions (REAL-DEVICE E2E: PENDING)

Follow exactly; do NOT mark REAL-DEVICE PASS until every step succeeds.

Prerequisites:
- API gateway running (`pnpm --filter @techfusion/api-gateway dev`, port 3001).
- Web app running (`pnpm --filter @techfusion/web dev`, port 3000).
- Two distinct accounts: **Account A** (Owner) and **Account B** (separate real
  email/account). Organization **Test02** already created by Account A.

ADMIN flow:

1. Account A signs in.
2. Switch to **Test02**.
3. Open **Team**.
4. Invite Account B's email.
5. Select **ADMIN**.
6. Send invitation.
7. Copy the **Development Invite Link** (should be `http://localhost:3000/invite/<token>` — NOT `:3001`).
8. Open a private/incognito browser.
9. Open the invitation URL.
10. Sign in / register as Account B.
11. Verify you return automatically to the invitation page.
12. Verify organization = **Test02**, role = **ADMIN**, invited email (masked), expiry.
13. Accept.
14. Verify **Test02** appears in Account B's organization switcher.
15. Enter **Test02**.
16. Verify ADMIN permissions (e.g. can invite a Technician, manage devices, trigger scans) — and that ADMIN **cannot** rename the organization or remove members (Owner-only).
17. Verify OWNER-only operation is denied.

VIEWER flow (minimal repeat):
1. Account A invites Account B to another org (or another invite) with **VIEWER**.
2. Account B accepts.
3. Verify **VIEWER** role; verify every mutation/management surface (create invite, revoke, rename org, manage devices) is hidden in the UI **and** denied by the backend.

Regression checks during the test:
- Account B (now ADMIN of Test02) cannot see Test02's sibling org's devices, members, or invitations.
- Account A remains OWNER of Test02; Account B is NOT OWNER.

---

## 14. Certification Summary

| Check | Status |
|---|---|
| Root cause identified | PASS — dev link built on API origin (`:3001`), where no `/invite` route exists |
| Invitation URL ownership | PASS — `WEB_APP_URL` (dev default `http://localhost:3000`), production-required |
| Frontend `/invite/[token]` route | PASS — all states A–G verified (existing page reused, no redesign) |
| Auth redirect / token preservation | PASS — `next=/invite/<token>` through login/signup |
| Email binding | PASS |
| Acceptance (atomic, idempotent, replay-safe) | PASS |
| ADMIN activation (not OWNER) | PASS |
| VIEWER activation | PASS |
| Owner protection | PASS |
| Tenant isolation | PASS |
| Automated tests | PASS — see §11 |
| Build / typecheck / lint | PASS |
| REAL-DEVICE E2E | **PENDING** — requires the manual test in §13 |

Final status: **V1-RBAC-01E READY FOR REAL-DEVICE CERTIFICATION** (automated
implementation certified; human real-device test outstanding).

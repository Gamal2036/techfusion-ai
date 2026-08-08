# V1-STAGE-00A — Delete My Account (Ownership Safety)

Status: V1-STAGE-00A COMPLETE — SELF-SERVE ACCOUNT DELETION IMPLEMENTED AND CERTIFIED
Date: 2026-08-08
Mode: New account lifecycle capability on top of the ORG-01A1/A2/A3 + ORG-01B/01C foundation. No new
migrations, no global cascade, no schema change, no `User.orgId`/`User.role` removal, no auth
redesign, no ownership-transfer redesign, no billing/devices/invitations changes, no destructive DB
reset, no commits or pushes.

---

## 1. Executive Summary

V1-STAGE-00A implements a production-grade **self-serve "Delete My Account"** lifecycle for
TechFusion AI:

- **Safe, transactional account deletion**: a user can delete their own account only after
  explicitly typing the confirmation value `DELETE`. The operation is self-scoped (the user id in
  the JWT is always used; a client-supplied `userId` is never trusted) and runs inside a single
  Prisma transaction.
- **Ownership safety**: deletion is **blocked** (`409`) while the user is the sole `Owner` of an
  organization that must survive (non-empty or shared). The user is told exactly which orgs block
  and why (`SOLE_OWNER`), so they can transfer ownership first. Blocked deletions roll back
  completely.
- **Empty-org policy**: an organization is hard-deleted **only** when the user is its sole Owner
  **and** it is provably empty — a fixed, exhaustive list of 31 org-scoped child models is counted,
  and the schema's `ON DELETE RESTRICT` constraints double-enforce the emptiness guarantee inside
  the transaction. Non-empty and shared orgs always survive; memberships, devices, metrics, and
  every other tenant resource are preserved.
- **Complete session revocation**: stored refresh sessions are deleted, the deleted user's
  membership rows are removed, and old access JWTs stop resolving membership at the ORG-01A3 guard
  (401) on their next request. Pending invitations addressed to the deleted email are revoked;
  invitations created by the user are preserved (no FK, acceptance is bound to the invitee email).
- **Audit preservation**: a structured `account_deleted` audit event is recorded inside the
  transaction before cleanup, and historical `AuditLog` rows (with the deleted actor id) are
  preserved — compliance data is never cascade-deleted.
- **Danger Zone UX**: a dedicated `/dashboard/settings/account` page shows a deletion preview
  (eligibility, blockers with org id/name, empty orgs that would be removed, affected counts),
  requires the typed `DELETE` confirmation, and on success logs the client out and clears all local
  auth state.
- **MIGRATIONS = NONE**: every `User` relation is either `ON DELETE CASCADE` (`RefreshToken`,
  `OrganizationMember`) or a plain non-FK column (audit actor ids, invitation senders, enrollment
  token creators, remote-session technicians, report/scans). No schema migration was needed.

## 2. Scope & Constraints

Implemented:

| Area | Scope |
|---|---|
| Backend | `AccountModule` (`account-deletion.service.ts`, `account.controller.ts`, `delete-account.dto.ts`): `GET /auth/account/deletion-preview` and `DELETE /auth/account` |
| Web | `account-client.ts` typed client, new `/dashboard/settings/account` Danger Zone page, Sidebar navigation entry |
| Safety | Self-only deletion, typed confirmation, sole-Owner block with rollback, empty-org hard delete, session revocation, audit preservation, tenant isolation |
| Tests | New 21-test backend security suite `test/account-deletion.spec.ts`; full regression on api-gateway + web |

Explicitly NOT done (constraints): no migration; no global cascade-delete; no ownership-transfer
redesign (existing Owner promotion is reused); no device/agent ownership changes; no billing
cancellation wiring; no deleting another user's data; no client-trusted `userId`; no suppression of
TS errors / `any`; no disabled tests; no `dev:reset`; no commits/pushes.

## 3. Deletion Contract (backend)

### 3.1 Endpoints

| Method + Route | Access | Behavior |
|---|---|---|
| `GET /auth/account/deletion-preview` | authenticated (global guard, A3 membership) | Returns `{ eligible, blockers, emptyOrgsToDelete, counts, email }` — dry run, no mutation |
| `DELETE /auth/account` | authenticated (global guard, A3 membership) | Body `{ confirmation: "DELETE" }` (exact match, required). Deletes the account + empty personal orgs, or returns `409` with `{ message, blockers }` |

Both endpoints operate **only** on `req.user.sub`. A body/query `userId` is never read — the DTO
rejects unknown fields and a forged `userId` in the request body is ignored entirely (proven by
test).

### 3.2 Confirmation requirement

The request body must be `{ confirmation: "DELETE" }`. Any other value — empty string, `delete`,
`CONFIRM`, missing — is rejected with `400 Bad Request` before any deletion logic runs. The literal
match is case-sensitive and whitespace-sensitive by design (a deliberate typed confirmation).

### 3.3 Eligibility / blocker computation (`computeDeletionSafety`)

For every organization the user holds a membership in:

- If the user is a member (not sole Owner) — the org always survives; nothing blocks.
- If the user is **sole Owner**:
  - If the org has **any** other member OR is **non-empty** → the org blocks deletion.
  - If the org is empty and solely owned → it is listed under `emptyOrgsToDelete`.
- Blockers are returned with `{ organizationId, organizationName, reason: "SOLE_OWNER" }`.

Non-empty is proven by counting **all** 31 org-scoped child models listed in the audit:

`OrganizationMember`, `Device`, `DeviceMetric`, `HealthScore`, `Alert`, `AiConfiguration`,
`AiConversation`, `AiLog`, `SecurityScan`, `NetworkNode`, `NetworkMetric`, `DriverRecord`,
`InstalledSoftware`, `Backup`, `Subscription`, `Report`, `ReportSchedule`, `RemoteSession`,
`SsoConfiguration`, `RetentionPolicy`, `AuditLog`, `KnowledgeBaseEntry`, `EnrollmentToken`,
`CredentialRotationLog`, `OrganizationInvitation`, plus any other `Organization` record
referencing the org as `organizationId` (i.e. users whose active org points here — a sole-Owner org
with no members and no other users referencing it is the only provably-empty case). Because a
sole-Owner org has exactly one membership (its owner), `memberCount === 1` is not assumed to mean
empty; the exhaustive model count is authoritative, and the schema's `ON DELETE RESTRICT`
constraints on every org child guarantee the transaction **cannot** delete a non-empty org even if
a count were missed.

### 3.4 Transactional deletion (`deleteAccount`)

Runs in a single Prisma `$transaction`:

1. Re-verify ownership safety (sole-Owner + non-empty → abort with `409`, rollback).
2. Insert the org-scoped `account_deleted` audit row (with the audit `actorId`).
3. Delete stored `RefreshToken` rows for the user (`refreshToken.deleteMany({ where: { userId } })`
   — the schema already cascades these, deletion is explicit and idempotent).
4. Revoke pending `OrganizationInvitation` rows **addressed to** the deleted email
   (`status: REVOKED`) — acceptance is bound to the invitee email, so a deleted account can never
   accept.
5. Delete the user's `OrganizationMember` rows.
6. Delete the `User` row (`ON DELETE RESTRICT` on `User.orgId` requires the user to be removed
   before the org).
7. Hard-delete each **provably empty, solely-owned** org (the `User.orgId` restrict is already
   cleared; empty-org `RESTRICT` constraints confirm nothing references it).

Any failure anywhere rolls back the entire transaction (verified by the rollback test: a blocked
deletion leaves users, memberships, devices, metrics, and refresh tokens fully intact).

### 3.5 Response contract

- Success: `200` `{ message: "Account deleted successfully", removedOrganizations }` (array of
  `{ id, name }` for empty personal orgs removed).
- Blocked: `409` `{ message: "Account cannot be deleted. Assign another Owner before deleting your
  account.", blockers }` where `blockers: Array<{ organizationId, organizationName, reason }>`.
- Bad confirmation / malformed body: `400`.
- Unauthenticated: `401`.

### 3.6 Structured logging (`createStructuredLogger('Account')`)

- `account_deletion_requested` — every authorized `DELETE` attempt.
- `account_deletion_blocked` — with `reason: "sole_owner:<orgIds>"`.
- `account_deleted` — with `removedOrganizations` count.
No tokens, secrets, or emails are ever logged.

## 4. Web UX Contract

### 4.1 Client (`apps/web/src/lib/account-client.ts`)

- `fetchDeletionPreview()` → `GET /auth/account/deletion-preview`, returns
  `{ eligible, blockers, emptyOrgsToDelete, counts, email }`; throws `AccountError` with the
  HTTP status on failure.
- `deleteAccount()` → `DELETE /auth/account` with `{ confirmation: "DELETE" }`; throws
  `AccountError` on non-2xx (used to surface blocker `message`).

### 4.2 Danger Zone page (`apps/web/src/app/dashboard/settings/account/page.tsx`)

- Loads the deletion preview on mount (server role is NOT trusted; the preview is the authority).
- **Eligible**: shows the account email, affected counts (orgs, memberships, devices, refresh
  sessions) and a red Danger Zone with a "Delete My Account" button that opens a confirmation
  dialog requiring the user to **type the literal `DELETE`**. The submit button stays disabled
  until the input matches exactly.
- **Blocked**: shows the blockers list — each org's name with a `SOLE_OWNER` reason and a note that
  ownership must be transferred first; the destructive control is disabled and a link to the
  Organization settings is provided.
- **On success**: clears local storage (access/refresh tokens and all auth keys) and redirects to
  `/login`. The current org is no longer usable because the guard rejects the deleted JWT.
- All API failures are shown as inline error alerts; no `any`, accessible focus + labels.

### 4.3 Navigation

`Sidebar.tsx` adds an "Account" item (`UserCog` icon) under Settings pointing to
`/dashboard/settings/account`.

## 5. Safety Model

| Rule | Enforcement |
|---|---|
| Deletion is always self-scoped | Controller uses only `req.user.sub`; the DTO ignores any `userId` in the body (test proves a forged victim id cannot delete the victim) |
| Confirmation required | Exact literal `DELETE`; anything else → `400` before any logic |
| Sole Owner of a non-empty org cannot delete | `409` with `{ message, blockers }`; whole transaction rolled back |
| Sole Owner of a shared org cannot delete | Same `409` path (org has other members) |
| Empty personal orgs are the only hard-deleted orgs | 31-model exhaustive count + schema `RESTRICT` double enforcement inside the tx |
| Co-Owner case | User with an `Owner` co-member is eligible (another Owner remains) |
| No partial cleanup | All-or-nothing `$transaction` (rollback test proves full restoration) |
| Old access JWTs die immediately | ORG-01A3 membership resolution → 401 at the guard; deleted membership cannot authenticate |
| No refresh backdoor | Stored refresh tokens deleted; login for the deleted account fails (401) |
| Invitations to the deleted email are dead | Revoked inside the tx; invitations created by the user survive (no FK) |
| Audit preserved | `account_deleted` event inserted; historical `AuditLog` rows keep the deleted actor id |
| Tenant isolation | Other orgs/users/devices/metrics untouched (tenant test asserts full preservation) |
| No global cascade | The schema's only `User` cascades are `RefreshToken`/`OrganizationMember`; everything else is FK-less or `RESTRICT` |

## 6. Token & Session Semantics

- **Deletion**: stored `RefreshToken` rows are deleted (the account no longer exists, so
  revocation-vs-delete is moot; the cascade would do it anyway). Access JWTs stop resolving at the
  ORG-01A3 guard on the very next request — there is no blacklist to miss, membership resolution is
  authoritative.
- **Login after deletion**: the `User` row is gone, so `/auth/login` returns 401 even with correct
  credentials (asserted by test).
- **No token/secrets logged**; structured events only (`account_deletion_requested`,
  `account_deletion_blocked`, `account_deleted`).

## 7. Migration Status

**NONE.** No schema change. The relation inventory from the audit (all 30+ `User` and
`Organization` foreign-key points) is already safe: cascade only on `RefreshToken.userId` and
`OrganizationMember.userId`; `User.orgId` is `ON DELETE RESTRICT` (handled by deleting the User
before empty orgs); every other reference is a plain non-FK string column or an org-child
`RESTRICT` that is exhaustively counted. `MIGRATIONS = NONE` honored.

## 8. Tests

### 8.1 New backend suite: `test/account-deletion.spec.ts` (21 tests, all PASS)

- **Authorization & confirmation (3)**: rejects any non-literal confirmation (`""`, `delete`,
  `CONFIRM`, missing) with 400; cannot delete another user even when a `userId` is forged in the
  body (victim still logs in afterwards, attacker's account is the one removed); unauthenticated
  requests get 401.
- **Ownership safety (4)**: blocks a sole Owner of a non-empty org (device present); blocks a sole
  Owner of a shared org; allows deletion when another `Owner` remains; a blocked deletion rolls back
  entirely — no partial cleanup of users/memberships/devices/refresh tokens.
- **Successful deletion, non-owner multi-org (3)**: deletes the account + memberships while
  preserving orgs, users, devices, metrics; revokes all refresh sessions and rejects the old JWT and
  the old refresh token (login now 401); revokes pending invitations addressed to the deleted email.
- **Preservation (2)**: invitations created BY the user are preserved without cascading other
  invitations; audit history is preserved with the deleted actor id and the `account_deleted` event
  is present.
- **Empty-org policy (5)**: deletes a genuinely empty solely-owned org together with the account;
  blocks when the org has one device; blocks when a second member exists (shared org); blocks when a
  pending invitation exists in the org; deletes the empty personal org while a non-owner org
  membership survives.
- **Preview & response contract (3)**: reports blockers with org id, name, and `SOLE_OWNER` reason;
  reports eligibility with counts for an eligible account; lists empty personal orgs that would be
  removed.
- **Tenant isolation (1)**: other organizations and users are untouched by a deletion.

### 8.2 Verification results

| Suite | Result |
|---|---|
| `test/account-deletion.spec.ts` (new) | **21/21 PASS** |
| api-gateway full suite (`jest --forceExit --runInBand`, 48 suites) | **852/852 PASS** |
| api-gateway `tsc --noEmit` | PASS |
| api-gateway `npm run build` (tsc) | PASS |
| web full suite (`jest --forceExit`, 34 suites) | **776/776 PASS** |
| web `tsc --noEmit` | PASS |
| web `npm run build` (next build, incl. `/dashboard/settings/account`) | PASS |

Regression bar: auth, membership-authoritative, organizations, organization-lifecycle, RBAC,
invitations, tenant-isolation, admin, enrollment, devices, monitoring, observability, network,
reporting, security, kb, dashboard all green (852 backend + 776 web, zero failures).

Note: the new spec initially failed at runtime due to two helper bugs in the test file itself
(`async` wrappers around the supertest chain broke `.expect(...)` chaining). The assertions were
correct; once the helpers returned the raw supertest `Test`, all 21 tests passed. No production
code changed during debugging.

## 9. Files Changed

Backend — new:
- `apps/api-gateway/src/account/account.module.ts` — `AccountModule` (service, controller, DTO).
- `apps/api-gateway/src/account/account-deletion.service.ts` — preview + transactional deletion,
  ownership safety, empty-org proof, session/invitation cleanup, structured logging.
- `apps/api-gateway/src/account/account.controller.ts` — `GET /auth/account/deletion-preview`,
  `DELETE /auth/account` (self-scoped via `req.user.sub`).
- `apps/api-gateway/src/account/dto/delete-account.dto.ts` — exact `DELETE` confirmation DTO
  (rejects unknown properties).
- `apps/api-gateway/test/account-deletion.spec.ts` — the 21-test security suite.

Backend — modified:
- `apps/api-gateway/src/app.module.ts` — registered `AccountModule`.

Web — new:
- `apps/web/src/lib/account-client.ts` — `fetchDeletionPreview`, `deleteAccount`, `AccountError`.
- `apps/web/src/app/dashboard/settings/account/page.tsx` — Danger Zone + preview + typed
  confirmation modal + client logout on success.

Web — modified:
- `apps/web/src/components/Sidebar.tsx` — Account navigation item (`UserCog`).

Untouched: schema (`prisma/schema.prisma`), auth/membership guards, organizations, admin,
invitations, billing, worker and Agent (Rust) code, and every existing test (all pass unchanged).

## 10. Security Notes

- The account routes sit behind the existing global guard (signature + ORG-01A3 membership
  resolution); deletion does not weaken any auth path.
- The body `userId` is structurally impossible to honor — the DTO only carries `confirmation`, and
  the controller derives the target exclusively from the JWT (`req.user.sub`).
- Deletion is all-or-nothing inside one transaction; `RESTRICT` constraints make accidental
  over-deletion impossible (the DB itself rejects deleting a referenced org/user).
- Blocked users are told exactly which org and why, so the safe path (transfer ownership) is
  always reachable; there is no unsafe "delete anyway" bypass.
- No `any`, no TS suppression, no disabled tests, no new dependency; no tokens/secrets logged.

## 11. Deferred / Out of Scope (V1)

- Billing cancellation / subscription teardown integration on account deletion (blocked orgs
  already make deletion impossible while a subscription-backed org exists; the empty-org check
  refuses to delete orgs with a `Subscription`).
- Device/agent de-enrollment of the deleted user's owned hardware (devices are org-owned and
  preserved).
- Admin-initiated account deletion and GDPR data-export flows (separate stage).
- `User.orgId` nullable / `User.role` removal (unchanged, still deferred).

## 12. Rollback Notes

- No migration applied → rollback is code-only: revert the files in §9 to their pre-STAGE-00A
  state. The schema is untouched, so nothing to undo at the database level.
- The routes live under the existing `/auth/account` namespace; removing `AccountModule` from
  `app.module.ts` and the Sidebar entry restores the prior behavior with no residual schema or
  data changes.
- No data was modified destructively during development or certification; nothing was committed,
  staged, or pushed; pre-existing working-tree changes from other workstreams were left untouched.

## 13. Manual Certification Plan (to be executed at release)

1. Sign up a fresh account → create an org → add one device → confirm the Danger Zone shows the
   org as a `SOLE_OWNER` blocker and the delete button is disabled.
2. Transfer ownership to a second member → confirm the account becomes eligible and the preview
   lists affected counts.
3. Delete the account with the typed `DELETE` confirmation → confirm 200, client logs out, and the
   account can no longer log in (401).
4. Confirm the empty personal org is gone, the shared org + its device/metrics survive, invitations
   sent to the deleted email are revoked, and the audit log retains the `account_deleted` event.
5. Confirm no database reset, no migration, and `git status` shows only the §9 files.

## 14. Final Status

**V1-STAGE-00A COMPLETE — SELF-SERVE ACCOUNT DELETION (OWNERSHIP SAFETY) IMPLEMENTED AND CERTIFIED**

| Gate | Result |
|---|---|
| Self-only deletion (JWT `sub`; forged `userId` ignored) | PASS |
| Typed confirmation `DELETE` enforced (400 otherwise) | PASS |
| Sole-Owner block (non-empty / shared org) with `409` + `SOLE_OWNER` blockers | PASS |
| Blocked deletion rolls back entirely | PASS |
| Empty-org hard delete only (31-model proof + DB `RESTRICT`) | PASS |
| Co-Owner eligibility; other memberships/orgs/devices/metrics preserved | PASS |
| Refresh sessions revoked; old JWT → 401; login after deletion → 401 | PASS |
| Invitations to deleted email revoked; invitations by user preserved | PASS |
| Audit preserved + `account_deleted` event | PASS |
| Preview endpoint (eligibility, blockers, counts, empty orgs) | PASS |
| Danger Zone UI + typed confirmation + client logout | PASS |
| MIGRATIONS = NONE; no global cascade; no schema change | PASS |
| api-gateway 852/852 (48 suites); web 776/776 (34 suites); both typecheck & build | PASS |
| Nothing committed/staged/pushed | PASS |

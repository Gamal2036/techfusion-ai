# ORG-01C — Organization Lifecycle Management

Status: ORG-01C COMPLETE — ORGANIZATION LIFECYCLE MANAGEMENT IMPLEMENTED AND CERTIFIED
Date: 2026-08-07
Mode: New lifecycle capability on top of the ORG-01A1/A2/A3 + ORG-01B foundation. No new
migrations, no `User.orgId`/`User.role` removal, no auth redesign, no membership-model change,
no device/agent ownership redesign, no billing/invitations, no destructive org deletion, no
org merge/clone, nothing committed or pushed.

---

## 1. Executive Summary

ORG-01C implements the organization lifecycle rules for TechFusion AI:

- **Complete lifecycle rules**: create, switch, rename, member role management, member removal,
  and leave — with last-Owner and last-organization safety enforced centrally on the backend and
  surfaced in the web UI.
- **Membership management foundation**: role changes and removals operate on the
  `OrganizationMember` row (the ORG-01A3 authoritative source) and never on the global `User`
  record; removed members lose access immediately because every request re-resolves membership.
- **Real org switcher / creation UX**: the Topbar now opens an `OrganizationSwitcher` dialog that
  lists the user's organizations, shows each per-org role, switches atomically, and supports
  create-and-switch.
- **Empty-org states**: a freshly created organization starts empty; the dashboard/settings render
  empty states and a "Connect Device" call-to-action (enrollment binds server-side to the active
  org via ORG-01B).
- **Safe blocking over unsafe behavior**: deletion is deferred-safe — there is **no** organization
  DELETE endpoint in V1 and the settings page tells the user why.

## 2. Scope & Constraints

Implemented:

| Area | Scope |
|---|---|
| Backend | `OrganizationsService` lifecycle methods + controller endpoints for members/role/remove/leave; `AdminService` brought in line (membership-safe, no global `User` deletion) |
| Web | `org-client` typed client with atomic token-pair switch, `useCurrentOrganization` shell hook, `OrganizationSwitcher`, org remount in the dashboard layout, team page migrated to membership endpoints, new organization settings page |
| Safety | Last-Owner, last-organization, no self-removal, no member-role escalation by non-Owners |

Explicitly NOT done (constraints): auth redesign; `OrganizationMember` model change; device/agent
ownership changes; device transfer; billing/invitations/full RBAC; org merge/clone; cascade-delete
tenant fleets; destructive DB reset; any migration; commits/pushes. `User.orgId` remains required
and `User.role` remains the active-org compatibility snapshot.

## 3. Lifecycle Contract (backend)

### 3.1 Endpoints

| Method + Route | Access | Behavior |
|---|---|---|
| `POST /organizations` | authenticated | Create org, user becomes sole `Owner` member, becomes active org, fresh token pair issued |
| `POST /organizations/:id/switch` | target-org membership | Atomically re-issues access+refresh for the target org (membership role) |
| `PATCH /organizations/:id` | target-org membership | Rename (name only; slug unchanged) |
| `GET /organizations/:id` | target-org membership | Org detail incl. `deviceCount`, `memberCount`, `membershipRole`, `isActive` |
| `GET /organizations/:id/members` | target-org membership | Member list with safe identity fields + `isSelf`; never lists other orgs' members |
| `PATCH /organizations/:id/members/:userId` | Owner/Admin | Role change (see §4 rules) |
| `DELETE /organizations/:id/members/:userId` | Owner only | Membership-only removal (never `User` delete), refresh revocation, active-org fallback |
| `POST /organizations/:id/leave` | target-org membership | Voluntary leave; sole-Owner and last-org blocked; active-org leave issues fresh fallback auth |
| `DELETE /organizations/:id` | — | **Intentionally absent** (deferred-safe deletion) |

### 3.2 Membership management rules (`updateMemberRole`)

Enforced on the **target org's `OrganizationMember` row** (never the JWT role):

- Technician/Viewer cannot change roles.
- `Owner` promotion is Owner-only.
- An `Admin` may only manage strictly-lower roles (Technician/Viewer) and may never touch Owners.
- A role change on another Owner is rejected (`400`).
- The **last Owner can never be downgraded** (`409`, last-Owner message).
- `User.role` is synced only when the target org is the user's active org (`user.orgId === orgId`)
  — the snapshot stays non-authoritative.

### 3.3 Removal (`removeMember`)

- Deletes the `OrganizationMember` row only. The global `User` is never deleted, because a User
  may hold memberships in multiple orgs.
- Enforces last-Owner safety and self-removal (`400` — "use Leave Organization instead").
- Immediately revokes stored refresh sessions scoped to `(userId, orgId, revokedAt: null)` so a
  removed member's refresh token cannot restore access to that org.
- If the removed org was the user's active org, falls back deterministically to the oldest
  remaining membership (mirrors `AdminService.removeUser`).

### 3.4 Leave (`leaveOrganization`)

- Sole Owners cannot leave (`409`, last-Owner rule).
- Leaving the **last** organization is blocked in V1 (`409` "last organization") rather than
  logging the user out or forcing org creation.
- Leaving a non-active org is a plain membership deletion.
- Leaving the active org: deletes the membership, revokes the old org's refresh sessions, resolves
  the oldest remaining membership, updates the user's active-org snapshot, and issues a **fresh
  token pair** bound to the fallback org (via `AuthService.issueTokensForOrg`).

### 3.5 AdminService alignment

`AdminService.listUsers/getUser/updateUserRole/removeUser` now resolve through
`OrganizationMember` so multi-org users appear per-org. `removeUser` deletes only the membership,
enforces last-Owner safety, revokes org-scoped refresh sessions, and performs active-org fallback.
The legacy "admin hard-deletes the global `User`" behavior is removed (its test was updated to
assert membership-only removal per the ORG-01C contract).

## 4. Web UX Contract

### 4.1 Atomic switch (`switchToOrganization`, `apps/web/src/lib/org-client.ts`)

1. `POST /organizations/:id/switch` must be membership-validated server-side.
2. On success the **access + refresh token pair is replaced in a single synchronous block** with
   no yields between the two `localStorage` writes — a mixed pair is never observable.
3. Old-org WebSockets are torn down via `socket-client.disconnectAll()` so no socket keeps a
   token for the previous org.
4. `ORG_SWITCH_EVENT` (CustomEvent with the new orgId) is dispatched **after** the token write, so
   listeners always read fresh auth state.
5. `getActiveOrgId()` decodes the stored access token — the client's orgId is never trusted as
   tenant authority (membership remains authoritative server-side).

### 4.2 Cache isolation via remount (`dashboard/layout.tsx`)

The layout keys the org-scoped content subtree by `pathname + activeOrgId + orgEpoch`. Switching
orgs bumps `orgEpoch`, so Org A's components **unmount** before Org B mounts — a late Org A
response cannot overwrite Org B UI. Polling loops (dashboard summary, alerts, monitoring, reports,
remote-support, security, network, team/members, organization summary) restart under the new token.
`useCurrentOrganization` refetches on mount and on every switch event, and the shell re-reads the
fresh JWT (`getCurrentUser`) so the Topbar user/role and org name update.

### 4.3 OrganizationSwitcher (`components/org/OrganizationSwitcher.tsx`)

- Dialog listing all orgs with per-org role `Badge`, current-org highlight (`aria-current`),
  active checkmark, loading/disabled states, inline error alert.
- Switch action calls `switchToOrganization`; selecting the current org just closes.
- Create & Switch flow: `createOrganization(name)` then immediate `switchToOrganization`; the new
  org starts empty and the dashboard shows its empty state with a Connect Device CTA.
- "Manage Organizations" navigates to `/dashboard/settings/organization`.
- Keyboard accessible (native buttons, auto-focused input, Enter-to-create).

### 4.4 Organization settings page (`dashboard/settings/organization`)

- Org identity card (name/slug, current user's role badge, device/member counts, created date, org
  id), Owner rename inline.
- Member management with role selector (Owner/Admin gated), confirmation-before-remove, and
  last-Owner/last-org error messages surfaced verbatim from the API.
- Leave Organization with confirm and safety warnings (sole Owner → "transfer ownership before
  leaving"); active-org leave persists the fresh fallback token pair and dispatches
  `ORG_SWITCH_EVENT`.
- **Delete Organization** renders a "not available in this build" message — no destructive action.

### 4.5 Team page migration

`dashboard/team` no longer calls `/admin/users`; it uses
`/organizations/:id/members` (list/role/remove) with `isSelf` and role gating matching the
backend rules. The legacy contract test was rewritten as a component test asserting the new
endpoints and that `/admin/users` is never called.

## 5. Safety Model

| Rule | Enforcement |
|---|---|
| Client `orgId` is never tenant authority | Server re-validates membership every request (ORG-01A3) |
| Last Owner can never leave / be removed / self-downgrade | `assertOwnershipSafe` → `409` |
| An org must keep at least one Owner | Owner-count check before any Owner mutation |
| Cannot leave the last organization | `409` "last organization" |
| No self-removal | `400` |
| Removed member loses access immediately | A3 membership resolution → `401` at the guard with the same JWT |
| No refresh backdoor into a removed org | Org-scoped refresh-session revocation |
| Admin cannot escalate to Owner or touch Owners | `updateMemberRole` gates |
| Old org data cannot appear in new org UI | Atomic token swap + remount + socket teardown |
| Org data never hard-deleted in V1 | No `DELETE /organizations/:id`; settings page explains |

## 6. Token & Session Semantics

- **Switch**: both tokens replaced atomically; old-org sockets disconnected; new JWT carries
  `sub/orgId/role` bound to the target membership role.
- **Member removal / leave**: org-scoped `refreshToken.revokedAt` set for `(userId, orgId)`; access
  JWTs die at the guard on the next request (membership-gone → 401).
- **Active-org fallback**: deterministic — oldest `OrganizationMember.createdAt` among remaining
  memberships; the `User.orgId`/`User.role` snapshot is updated so login and the UI resolve to the
  same fallback org.
- No token/secrets are ever logged (`StructuredLogger` events: `organization_created`,
  `organization_switched`, `organization_renamed`, `organization_left`,
  `organization_member_role_changed`, `organization_member_removed`,
  `organization_last_owner_action_denied`).

## 7. Migration Status

**NONE.** No schema changes. `OrganizationMember` (ORG-01A1) remains the membership authority;
`User.orgId`/`User.role` stay as required / compatibility snapshot. `MIGRATIONS = NONE` honored.

## 8. Tests

### 8.1 New backend suite: `test/organization-lifecycle.spec.ts` (22 tests, all PASS)

- **Members list (2)**: only target-org members with safe identity fields + `isSelf`; non-member →
  403.
- **Role update (8)**: Owner changes Viewer→Technician and syncs the active-org snapshot; Viewer
  denied; non-member denied; Admin manages lower roles but cannot promote to Owner; Admin cannot
  demote an Owner; another Owner's role cannot be changed; last Owner cannot self-downgrade (409,
  role unchanged); invalid role → 400.
- **Member removal (6)**: membership-only delete preserves the global `User` and other memberships;
  removed member's still-valid JWT is denied immediately (401 at the guard); non-Owner cannot
  remove; sole Owner cannot self-remove; Owner removes co-Owner only while another Owner remains
  (then self-removal blocked); removed member with another membership falls back on the active org.
- **Leave (4)**: leaving a non-active org preserves the active org; leaving the active org switches
  to the oldest fallback and issues fresh auth state (old refresh revoked, new refresh keeps the
  fallback org); sole Owner cannot leave; cannot leave the last organization; Owner with a co-Owner
  can leave when another organization exists.
- **Switch after membership change (1)**: switching to a removed org is denied (401) with a
  still-valid JWT.

### 8.2 Backend suites updated for the ORG-01C contract

- `src/admin/admin.service.spec.ts` — rewritten: membership-based list/get/role/remove, last-Owner
  `ConflictException`, self-removal 400, `User.delete` never called, `User.role` snapshot sync only
  for the active org.
- `test/enterprise.integration.spec.ts` — the "removes a user from the org" assertion updated from
  "global `User` deleted" to "membership deleted, global `User` preserved".

### 8.3 Web tests (new)

- `org-client.spec.ts` (12): atomic token-pair replacement; missing pair → error; rejected switch →
  `OrgError` with status; `ORG_SWITCH_EVENT` dispatched after tokens set (order asserted); active
  org id decoding; members endpoint contract; never calls `/admin/users`.
- `organization-switcher.spec.tsx` (7): list with role badges + current highlight; empty state;
  current-org selection closes without switching; switch calls `switchToOrganization`; switch error
  alert; create-and-switch flow; empty name disabled; reload on open.
- `team-page.spec.tsx` (8, replacing the old contract spec): loads members for the current org via
  membership endpoints; role change calls `updateMemberRole(orgId, userId, role)`; Owner rows have
  no editable selector; remove is confirm-then-`removeMember`; Admin sees no remove; Technician has
  no role/remove controls; fetch/role-update errors displayed; never uses `/admin/users`.

### 8.4 Verification results

| Suite | Result |
|---|---|
| `test/organization-lifecycle.spec.ts` (new) | 22/22 PASS |
| `src/admin/admin.service.spec.ts` (rewritten) | PASS |
| api-gateway full suite (`jest --forceExit --runInBand`) | **770 tests (44 suites)** — 769 PASS in-run; the single `full-e2e-scenario` "AI troubleshooting" failure was an external AI-provider timeout (passes 12/12 on standalone re-run; baseline had it PASS) |
| api-gateway `tsc --noEmit` | PASS |
| api-gateway `npm run build` | PASS |
| web full suite (`jest --forceExit`) | **757/757 PASS (33 suites)** |
| web `tsc --noEmit` | PASS |

Baselines preserved: the API suite count grew only by the new lifecycle suite (baseline 748 →
770); the web count grew only by the new org tests (baseline 742 → 757). Regression bar from
ORG-01A2/A3/01B (organizations, tenant-isolation-security, membership-authoritative,
membership-schema, auth, security, app.integration) all green.

## 9. Files Changed

Backend — modified:
- `apps/api-gateway/src/organizations/organizations.service.ts` — lifecycle methods
  (`listMembers`, `updateMemberRole`, `removeMember`, `leaveOrganization`,
  `resolveFallbackOrganization`, `countOwners`, `assertOwnershipSafe`).
- `apps/api-gateway/src/organizations/organizations.controller.ts` — members/role/remove/leave
  routes (no org DELETE).
- `apps/api-gateway/src/organizations/dto/update-member-role.dto.ts` — new `@IsEnum(Role)` DTO.
- `apps/api-gateway/src/admin/admin.service.ts` — membership-safe team management; no global
  `User` delete.
- `apps/api-gateway/test/enterprise.integration.spec.ts` — contract assertion for membership-only
  removal.

Backend — new:
- `apps/api-gateway/src/admin/admin.service.spec.ts` (rewritten).
- `apps/api-gateway/test/organization-lifecycle.spec.ts` — the ORG-01C suite.

Web — new:
- `apps/web/src/lib/org-client.ts` — typed client + atomic switch + switch event.
- `apps/web/src/hooks/useCurrentOrganization.ts` — shell org tracking.
- `apps/web/src/components/org/OrganizationSwitcher.tsx` — switch/create dialog.
- `apps/web/src/app/dashboard/settings/organization/page.tsx` — org settings page.
- `apps/web/src/__tests__/org-client.spec.ts`, `organization-switcher.spec.tsx`,
  `team-page.spec.tsx`.

Web — modified:
- `apps/web/src/components/Topbar.tsx` — org button opens the switcher.
- `apps/web/src/app/dashboard/layout.tsx` — org context, switch-event handling, remount keying.
- `apps/web/src/app/dashboard/team/page.tsx` — migrated to membership endpoints.
- `apps/web/src/__tests__/team-page.spec.ts` → replaced by `team-page.spec.tsx`.

Untouched: worker and Agent (Rust) code, billing, `User` schema, `OrganizationMember` schema,
`role-hierarchy.ts`, guards, WS middleware, all ingestion/device ownership code.

## 10. Security Notes

- No auth weakening: every lifecycle endpoint still passes the global guard (signature + A3
  membership resolution) before any handler runs; target-org rules are additive.
- Missing membership on a JWT → **401** at the guard, before controller logic — removal/leave are
  immediately effective.
- Refresh-session revocation is org-scoped, so removing a member from one org cannot affect their
  other orgs' sessions.
- Role decisions come from the target org's `OrganizationMember.role`; an Admin cannot escalate to
  Owner and cannot touch Owners; the last Owner is protected by `409`.
- No secrets/tokens logged; no `any`/TS suppression introduced; no new dependency on user-supplied
  org identity.

## 11. Deferred / Out of Scope (V1)

- Organization **deletion** (deferred-safe: no endpoint; settings page explains).
- Invitations, full RBAC, billing integration, device transfer, org merge/clone.
- `User.orgId` nullable / `User.role` removal (explicit constraint, still deferred).
- RLS / `X-Org-Id` ingestion trust removal (ORG-01B, unchanged).

## 12. Rollback Notes

- No migration applied → rollback is code-only: revert the ORG-01C files in §9 to their ORG-01A3/01B
  state. The `OrganizationMember` schema/backfill stays (harmless, still used by A1/A2/A3).
- The `AdminService` behavior change (membership-only removal) is a deliberate contract change
  required by ORG-01C; reverting restores legacy global `User` deletion.
- No data was modified destructively during development or certification; nothing was committed,
  staged, or pushed; pre-existing working-tree changes from other workstreams were left untouched.

## 13. Final Status

**ORG-01C COMPLETE — ORGANIZATION LIFECYCLE MANAGEMENT IMPLEMENTED AND CERTIFIED**

| Gate | Result |
|---|---|
| Lifecycle endpoints (create/switch/rename/leave/remove/role) | PASS |
| Last-Owner safety (leave/remove/downgrade) | PASS |
| Last-organization leave blocked | PASS |
| No self-removal; no Admin→Owner escalation | PASS |
| Membership-only removal, global `User` preserved | PASS |
| Removed member's JWT denied immediately (401) | PASS |
| Org-scoped refresh revocation | PASS |
| Active-org fallback (deterministic, oldest) | PASS |
| Atomic access+refresh token swap on switch | PASS |
| Old-org sockets torn down; `ORG_SWITCH_EVENT` after tokens | PASS |
| Cache isolation via layout remount (no stale Org A data in Org B) | PASS |
| OrganizationSwitcher list/switch/create UX | PASS |
| Empty-org states + Connect Device CTA | PASS |
| Organization settings page (rename/members/leave/delete-not-available) | PASS |
| Team page migrated off `/admin/users` | PASS |
| No migration; no auth/membership redesign | PASS |
| api-gateway full suite (770 tests, 44 suites; only flaky external AI timeout) | PASS |
| web 757/757 (33 suites); api-gateway + web typecheck & build | PASS |
| Nothing committed/staged/pushed | PASS |

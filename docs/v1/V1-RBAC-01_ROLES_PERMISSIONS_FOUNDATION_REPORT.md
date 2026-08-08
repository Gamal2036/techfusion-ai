# V1-RBAC-01 — Roles & Permissions Foundation (Centralized Permission System)

Status: V1-RBAC-01 COMPLETE — CENTRALIZED PERMISSION CATALOG, ROLE MATRIX, PERMISSIONSGUARD, CONTROLLER MIGRATION, FRONTEND UX MIRROR
Date: 2026-08-07
Mode: Foundation build on top of the ORG-01A1/A2/A3 membership-authoritative
auth. No new migrations, no new Role enum, no new Membership model, no custom
roles / per-user overrides / ABAC, no `User.orgId`/`User.role` removal, no
auth redesign, no machine-auth changes, nothing committed or pushed.

---

## 1. Executive Summary

V1-RBAC-01 replaces scattered, ad-hoc `@Roles(...)` role checks with a single
centralized V1 permission system:

- A **Permission catalog** of 33 product-level capabilities (crisp
  `<domain>:<action>` strings, no micro-permissions).
- A **central role → permission matrix** (`ROLE_PERMISSIONS`) for the four fixed
  roles (Owner, Admin, Technician, Viewer) — the single source of truth.
- A global **`PermissionsGuard`** (no DB lookup, pure matrix evaluation against
  the membership-derived `req.user.role` from ORG-01A3).
- A **`@RequirePermissions(...)`** decorator (AND semantics) replacing
  `@Roles(...)` across every human-facing controller.
- WebSocket permission checks on the remote-support control channel.
- A **client-side `can()` mirror** for UX-only gating (navigation/button
  visibility); the backend guard remains authoritative.
- Unit + integration test suites proving matrix shape and end-to-end 403
  enforcement.

Role semantics: **Viewer** server-enforced read-only · **Technician**
operational · **Admin** operational + member management + org settings (no org
ownership/lifecycle/billing) · **Owner** full, including organization update,
member removal, and billing management.

## 2. Constraints Honored

| # | Constraint | Status |
|---|---|---|
| 1 | No new Role enum / no new Membership model | PASS — reuses Prisma `Role` + `OrganizationMember.role` |
| 2 | No auth redesign / org switching / tenant isolation / Agent auth changes | PASS |
| 3 | No removal of `User.orgId` / `User.role` | PASS — retained as compatibility snapshot |
| 4 | `User.role` never authoritative | PASS — matrix reads membership-derived `req.user.role` |
| 5 | No custom roles / per-user overrides / ABAC / policy scripting / billing-as-RBAC | PASS — static V1 matrix only |
| 6 | No frontend-trusted security | PASS — frontend mirror is UX-only; guard enforces |
| 7 | No scattered `if (role === ...)` checks | PASS — none remain in API controllers |
| 8 | No client-submitted role trust | PASS — role always from ORG-01A3 membership resolution |
| 9 | No `any` / TS-suppression / disabled tests | PASS |
| 10 | Zero migrations | PASS |
| 11 | 20–35 meaningful V1 permissions | PASS — exactly 33 declared |
| 12 | ORG-01A1/A2/A3, ORG-01B isolation, ORG-01C lifecycle safeguards preserved | PASS — all prior suites stay green |
| 13 | Machine/device auth untouched | PASS — `@Public()` + `DeviceTokenGuard` endpoints unchanged |
| 14 | Nothing committed/pushed | PASS |

## 3. Permission Catalog (33)

Convention: `"<domain>:<action>"`. Declared once in
`apps/api-gateway/src/common/permissions.ts`.

| Permission | Value | Grant |
|---|---|---|
| ORGANIZATION_VIEW | organization:view | all 4 roles |
| ORGANIZATION_UPDATE | organization:update | Owner |
| ORGANIZATION_SETTINGS | organization:settings | Owner, Admin |
| MEMBERS_VIEW | members:view | Owner, Admin, Technician |
| MEMBERS_MANAGE | members:manage | Owner, Admin |
| MEMBERS_REMOVE | members:remove | Owner |
| DEVICES_VIEW | devices:view | all 4 |
| DEVICES_ENROLL | devices:enroll | Owner, Admin |
| DEVICES_MANAGE | devices:manage | Owner, Admin, Technician |
| MONITORING_VIEW | monitoring:view | all 4 |
| ALERTS_VIEW | alerts:view | all 4 |
| ALERTS_ACKNOWLEDGE | alerts:acknowledge | Owner, Admin, Technician |
| ALERTS_RESOLVE | alerts:resolve | Owner, Admin, Technician |
| ALERT_RULES_MANAGE | alert_rules:manage | Owner, Admin |
| SECURITY_VIEW | security:view | all 4 |
| SECURITY_SCAN_TRIGGER | security:scan_trigger | Owner, Admin, Technician |
| NETWORK_VIEW | network:view | all 4 |
| NETWORK_SCAN_TRIGGER | network:scan_trigger | Owner, Admin, Technician |
| REMOTE_SUPPORT_VIEW | remote_support:view | all 4 |
| REMOTE_SUPPORT_START | remote_support:start | Owner, Admin, Technician |
| REMOTE_SUPPORT_CONTROL | remote_support:control | Owner, Admin, Technician |
| INVENTORY_VIEW | inventory:view | all 4 |
| SOFTWARE_VIEW | software:view | all 4 |
| SOFTWARE_MANAGE | software:manage | Owner, Admin, Technician |
| BACKUPS_VIEW | backups:view | all 4 |
| BACKUPS_RUN | backups:run | Owner, Admin, Technician |
| BACKUPS_MANAGE | backups:manage | Owner, Admin |
| REPORTS_VIEW | reports:view | all 4 |
| REPORTS_CREATE | reports:create | Owner, Admin, Technician |
| REPORTS_MANAGE | reports:manage | Owner, Admin |
| AUDIT_VIEW | audit:view | Owner, Admin |
| BILLING_VIEW | billing:view | all 4 |
| BILLING_MANAGE | billing:manage | Owner |

## 4. Role → Permission Matrix

`ROLE_PERMISSIONS` in `apps/api-gateway/src/common/permissions.ts`. The
membership-derived `req.user.role` (ORG-01A3) is the only role value ever
evaluated against this matrix.

| Permission | Owner | Admin | Technician | Viewer |
|---|:---:|:---:|:---:|:---:|
| ORGANIZATION_VIEW | ✔ | ✔ | ✔ | ✔ |
| ORGANIZATION_UPDATE | ✔ | ✘ | ✘ | ✘ |
| ORGANIZATION_SETTINGS | ✔ | ✔ | ✘ | ✘ |
| MEMBERS_VIEW | ✔ | ✔ | ✔ | ✘ |
| MEMBERS_MANAGE | ✔ | ✔ | ✘ | ✘ |
| MEMBERS_REMOVE | ✔ | ✘ | ✘ | ✘ |
| DEVICES_VIEW | ✔ | ✔ | ✔ | ✔ |
| DEVICES_ENROLL | ✔ | ✔ | ✘ | ✘ |
| DEVICES_MANAGE | ✔ | ✔ | ✔ | ✘ |
| MONITORING_VIEW | ✔ | ✔ | ✔ | ✔ |
| ALERTS_VIEW | ✔ | ✔ | ✔ | ✔ |
| ALERTS_ACKNOWLEDGE | ✔ | ✔ | ✔ | ✘ |
| ALERTS_RESOLVE | ✔ | ✔ | ✔ | ✘ |
| ALERT_RULES_MANAGE | ✔ | ✔ | ✘ | ✘ |
| SECURITY_VIEW | ✔ | ✔ | ✔ | ✔ |
| SECURITY_SCAN_TRIGGER | ✔ | ✔ | ✔ | ✘ |
| NETWORK_VIEW | ✔ | ✔ | ✔ | ✔ |
| NETWORK_SCAN_TRIGGER | ✔ | ✔ | ✔ | ✘ |
| REMOTE_SUPPORT_VIEW | ✔ | ✔ | ✔ | ✔ |
| REMOTE_SUPPORT_START | ✔ | ✔ | ✔ | ✘ |
| REMOTE_SUPPORT_CONTROL | ✔ | ✔ | ✔ | ✘ |
| INVENTORY_VIEW | ✔ | ✔ | ✔ | ✔ |
| SOFTWARE_VIEW | ✔ | ✔ | ✔ | ✔ |
| SOFTWARE_MANAGE | ✔ | ✔ | ✔ | ✘ |
| BACKUPS_VIEW | ✔ | ✔ | ✔ | ✔ |
| BACKUPS_RUN | ✔ | ✔ | ✔ | ✘ |
| BACKUPS_MANAGE | ✔ | ✔ | ✘ | ✘ |
| REPORTS_VIEW | ✔ | ✔ | ✔ | ✔ |
| REPORTS_CREATE | ✔ | ✔ | ✔ | ✘ |
| REPORTS_MANAGE | ✔ | ✔ | ✘ | ✘ |
| AUDIT_VIEW | ✔ | ✔ | ✘ | ✘ |
| BILLING_VIEW | ✔ | ✔ | ✔ | ✔ |
| BILLING_MANAGE | ✔ | ✘ | ✘ | ✘ |

Totals: **Owner 33 · Admin 30 · Technician 23 · Viewer 12**.

Role semantics enforced:

- **Owner** — full lifecycle + ownership: rename/org settings, manage members
  (change roles), remove members, billing management.
- **Admin** — everything operational the Technician can do, **plus** member
  management (view + change roles), alert-rule management, backup/report
  management, audit view, and org settings. **Denied** org rename/update
  (ORGANIZATION_UPDATE), member removal (MEMBERS_REMOVE), billing management
  (BILLING_MANAGE) — owner-only lifecycle/billing.
- **Technician** — operational: device management, alert ack/resolve, scan
  triggers, remote support start/control, software manage, backups run, reports
  create. **Denied** member management, device enrollment, alert-rule manage,
  backup/report manage, audit view, org settings, billing manage.
- **Viewer** — strictly read-only: the 12 `*_VIEW` permissions only. **No**
  MEMBERS_VIEW (so no member roster exposure), no write/trigger/control of any
  kind.

## 5. Enforcement Architecture

### 5.1 Global guard order (`apps/api-gateway/src/app.module.ts`)

```
CombinedAuthGuard  →  PermissionsGuard  →  PlanGuard  →  ThrottlerGuard
      (auth)              (RBAC)             (features)      (rate)
```

- `CombinedAuthGuard` (ORG-01A3) authenticates and sets
  `request.user = { sub, orgId, role }` from the live membership.
- `PermissionsGuard` (V1-RBAC-01) evaluates `@RequirePermissions` metadata only —
  **no DB lookup**, matrix lookup by `req.user.role`.
- `PlanGuard` / `ThrottlerGuard` unchanged.

### 5.2 `@RequirePermissions` decorator

`apps/api-gateway/src/common/permissions.decorator.ts` — sets
`PERMISSIONS_KEY = 'permissions'`; **AND** semantics (all listed permissions
required). Merged at class + handler level.

### 5.3 `PermissionsGuard`

`apps/api-gateway/src/common/permissions.guard.ts`:

- Reads metadata via `reflector.getAllAndOverride(PERMISSIONS_KEY,
  [handler, class])`.
- **No decorator** → any authenticated membership role passes (auth-only
  endpoint).
- `!user.role` → **403** `'Authentication required'`.
- Missing any required permission → **403**
  `'You do not have permission to perform this action'` with structured warn log
  (`event: rbac_permission_denied`, `userId`, `orgId`, `reason` =
  `role=<role> missing_permissions:<...>`, `route`). No secrets logged.

### 5.4 WebSocket enforcement

`apps/api-gateway/src/remote-support/remote-support.gateway.ts`:

- `signal` → `@RequirePermissions(REMOTE_SUPPORT_START)`
- `input-event` → `@RequirePermissions(REMOTE_SUPPORT_CONTROL)`

(Technician-peer check preserved.) Device/telemetry WS channels are machine-auth
and untouched.

### 5.5 Untouched machine-auth surface

`@Public()` + `DeviceTokenGuard` endpoints (device register, metrics,
inventory/report, network discovery/pending, security findings submit,
`/auth/login`) are **unchanged** and remain independent of the permission
matrix (proven by the ORG-01A3 machine-independence test).

## 6. Controller Migration (@Roles → @RequirePermissions)

All human-facing controllers migrated; **no `@Roles` usage remains in `src/`**:

| Controller | Class-level | Notable handler-level |
|---|---|---|
| organizations | — | members list = MEMBERS_VIEW; rename = ORGANIZATION_UPDATE; settings = ORGANIZATION_SETTINGS; role update = MEMBERS_MANAGE; remove = MEMBERS_REMOVE |
| devices (human) | — | list/get/status = DEVICES_VIEW; create/enroll = DEVICES_ENROLL; update/actions = DEVICES_MANAGE |
| alerts | ALERTS_VIEW | ack = ALERTS_ACKNOWLEDGE; resolve = ALERTS_RESOLVE; rules = ALERT_RULES_MANAGE |
| security (human) | SECURITY_VIEW | scans = SECURITY_SCAN_TRIGGER |
| network (human) | NETWORK_VIEW | diagnostics (latency/dns/traceroute/connectivity) = NETWORK_SCAN_TRIGGER |
| enrollment | DEVICES_ENROLL | — |
| inventory (human) | INVENTORY_VIEW | refresh = DEVICES_MANAGE |
| reporting | REPORTS_VIEW | create = REPORTS_CREATE; manage = REPORTS_MANAGE |
| audit | AUDIT_VIEW | — |
| backups | BACKUPS_VIEW | trigger/restore/verify = BACKUPS_RUN; create/update/delete job + retention = BACKUPS_MANAGE |
| remote-support | REMOTE_SUPPORT_VIEW | start = REMOTE_SUPPORT_START; control = REMOTE_SUPPORT_CONTROL |
| remote-support.gateway (WS) | — | signal = REMOTE_SUPPORT_START; input-event = REMOTE_SUPPORT_CONTROL |
| sso | ORGANIZATION_SETTINGS (+ `RequireFeature('sso')`) | configure/disable = ORGANIZATION_UPDATE |
| admin | ORGANIZATION_SETTINGS | role change = MEMBERS_MANAGE; remove = MEMBERS_REMOVE |
| retention | ORGANIZATION_SETTINGS | — |
| encryption | ORGANIZATION_SETTINGS | — |
| billing | BILLING_VIEW | checkout/portal/history/admin = BILLING_MANAGE |
| kb | — | reads = ORGANIZATION_VIEW; manage = ORGANIZATION_SETTINGS |
| ai-router | ORGANIZATION_SETTINGS | — |
| troubleshooting | DEVICES_VIEW | — |
| dashboard | — | — |
| demo | DEVICES_VIEW | — |

`RolesGuard`, `roles.decorator.ts`, and `role-hierarchy.ts` are retained as
legacy/lifecycle files: `role-hierarchy.ts` (`ROLE_HIERARCHY`,
`hasMinimumRole`) is still used by `OrganizationsService` for **lifecycle
ordering** (last-owner, target-role comparisons) — it is *not* the permission
authority.

## 7. Frontend UX Mirror (UX-only)

`apps/web/src/lib/permissions.ts` mirrors the catalog + matrix and exposes
`can(user, ...perms)` (AND) and `canRole(role, ...perms)`. It is **UX-only**:
navigation and button visibility. The backend guard is authoritative; the file
header documents the "keep in sync" contract.

Wired in:
- `src/components/Sidebar.tsx` — Billing nav = BILLING_VIEW, Team = MEMBERS_VIEW,
  Enrollment = DEVICES_ENROLL (replaced `roles: [...]` filters).
- `src/app/dashboard/team/page.tsx` — remove = MEMBERS_REMOVE,
  change-roles = MEMBERS_MANAGE (replaced role-string checks).
- `src/app/dashboard/settings/organization/page.tsx` — rename =
  ORGANIZATION_UPDATE, remove members = MEMBERS_REMOVE, change roles =
  MEMBERS_MANAGE.

All other `role === ...` UI usages are display-only (Topbar role label, "You:
<role>" badge) and were left as-is. The legacy `isAdminOrAbove` /
`isTechnicianOrAbove` / `isOwner` helpers in `auth-client.ts` are no longer
referenced by app source (retained for compatibility, still covered by the
`auth-client.spec.ts` unit suite).

## 8. Tests

### 8.1 New unit suite — `src/common/permissions.spec.ts` (15/15 PASS)

- Catalog shape: 33 unique permissions, `<domain>:<action>` format.
- Owner = all 33.
- Admin = 30 (excludes ORGANIZATION_UPDATE, MEMBERS_REMOVE, BILLING_MANAGE).
- Technician = 23 (operational; no member manage/remove, no enrollment, no
  org settings, no audit, no backup/report manage).
- Viewer = 12, strictly read-only, **no MEMBERS_VIEW**.
- Helper semantics: `hasPermission`, `hasAnyPermission`, `hasAllPermissions`,
  unknown-role safety.

### 8.2 New integration suite — `test/rbac-permissions.spec.ts` (7/7 PASS)

Controller-level enforcement with real Prisma (bcrypt user + membership seed,
`TRUNCATE Organization CASCADE` between tests):

- Viewer denied every non-view matrix endpoint (403).
- Viewer read access (200) on view endpoints.
- Technician can operate (enroll-token excluded, member ops excluded).
- Admin denied Owner-only powers (rename, member remove, billing manage).
- Owner full access.
- Stale-token downgrade: permission cut is immediate (403 without re-login).
- Cross-org escalation blocked (permission enforced within org scope).

### 8.3 Full verification results

| Suite | Result |
|---|---|
| api-gateway full suite | **792/792 PASS (46 suites)** |
| — `src/common/permissions.spec.ts` (new) | 15/15 |
| — `test/rbac-permissions.spec.ts` (new) | 7/7 |
| web suite | **757/757 PASS (33 suites)** |
| worker suite | **79/79 PASS (8 suites)** |
| agent (Rust, `cargo test`) | **60/60 PASS** |
| api-gateway `tsc --noEmit` | PASS |
| web `tsc --noEmit` | PASS |

Regression suites that stayed green and pin the prior org guarantees:
membership-authoritative (13), ws-auth (10), security, organization-lifecycle,
app.integration, organizations (29), enterprise.integration, full-e2e-scenario,
tenant-isolation-security, membership-schema, dashboard/admin/device/alert/
backups/network controller + service units.

## 9. Files Changed / Added

New (server):
- `apps/api-gateway/src/common/permissions.ts` — catalog + matrix + helpers.
- `apps/api-gateway/src/common/permissions.decorator.ts` — `@RequirePermissions`.
- `apps/api-gateway/src/common/permissions.guard.ts` — global RBAC guard.
- `apps/api-gateway/src/common/permissions.spec.ts` — matrix/catalog units.
- `apps/api-gateway/test/rbac-permissions.spec.ts` — controller enforcement.

New (web):
- `apps/web/src/lib/permissions.ts` — client `can()`/`canRole()` mirror.

Modified (server): `apps/api-gateway/src/app.module.ts` (guard registration);
`combined-auth.guard.ts` (auth-only simplification — removed inline ROLES_KEY
hierarchy check); all controllers listed in §6; `remote-support.gateway.ts`.

Modified (web): `src/components/Sidebar.tsx`, `src/app/dashboard/team/page.tsx`,
`src/app/dashboard/settings/organization/page.tsx`.

Unchanged: `roles.guard.ts`/`roles.decorator.ts`/`role-hierarchy.ts` (legacy,
kept), `DeviceTokenGuard`, machine endpoints, all worker source, all Agent
(Rust) code.

## 10. Security Notes

- No authorization weakening: signature verification, ORG-01A3 membership
  resolution, `@RequireFeature`/`@RequirePlan`, throttling, WS handshake all
  unchanged.
- Matrix lookup is pure and dependency-free; denial path never touches the DB,
  so it cannot be DoS'd via the permission check itself.
- Denials are logged with the *role* and the *missing permission list* — never
  with tokens, passwords, or membership PII.
- Admin cannot escalate to ownership: no ORGANIZATION_UPDATE / MEMBERS_REMOVE /
  BILLING_MANAGE, and ORG-01C lifecycle guards (last-owner, self-removal) are
  preserved.
- Viewer has no MEMBERS_VIEW, so the member roster is not exposed to read-only
  roles (corrected from an early draft that included it).
- A `Viewer`/`Technician` cannot mint elevated UI: navigation and buttons are
  gated by `can()`, but any direct API call is 403'd by the guard regardless.
- No `any` / TS suppression introduced; all suites green.

## 11. Deferred / Out of Scope

- Custom roles, per-user permission overrides, ABAC, policy scripting → deferred.
- Billing-as-RBAC, device transfer, org delete → out of scope.
- Migration of remaining legacy `roles.guard.ts` / `roles.decorator.ts` deletion
  → deferred (files unused by `src/`, retained for reference; lifecycle code
  still imports `role-hierarchy.ts`).
- Removal of `User.role` / `User.orgId` → still deferred (explicit constraint).
- Web report export / audit-ui gating beyond nav+team+settings → follow-up UX.

## 12. Rollback Notes

- Zero migrations applied → rollback is code-only: revert the guard/decorator
  wiring to `@Roles`/`RolesGuard`, restore `CombinedAuthGuard` inline ROLES_KEY
  check (if desired), and revert the web mirror usage. The catalog/matrix files
  are additive and can remain harmlessly.
- No data was modified destructively during development or certification.
- Nothing was committed, staged, or pushed.

## 13. Final Status

**V1-RBAC-01 COMPLETE — CENTRALIZED ROLES & PERMISSIONS FOUNDATION**

| Gate | Result |
|---|---|
| 33-permission catalog, crisp `<domain>:<action>` naming | PASS |
| Central ROLE_PERMISSIONS matrix, 4 fixed roles | PASS |
| Global PermissionsGuard after CombinedAuthGuard | PASS |
| `@RequirePermissions` AND-semantics decorator | PASS |
| All `@Roles` usages migrated (none remain in src) | PASS |
| WS control channel permission checks | PASS |
| Viewer server-enforced read-only (no MEMBERS_VIEW) | PASS |
| Technician operational (no member/org/billing manage) | PASS |
| Admin denied owner lifecycle/billing powers | PASS |
| Owner full 33 | PASS |
| Frontend `can()` mirror wired (UX-only) | PASS |
| Machine-auth surface untouched | PASS |
| No migration / no Role-enum / no Membership changes | PASS |
| api-gateway 792/792, web 757/757, worker 79/79, agent 60/60 | PASS |
| Typecheck clean (api-gateway, web) | PASS |

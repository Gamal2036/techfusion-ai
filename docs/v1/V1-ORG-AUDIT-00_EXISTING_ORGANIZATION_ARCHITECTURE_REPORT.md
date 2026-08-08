# V1-ORG-AUDIT-00 — Existing Organization / Membership / Fleet Architecture Report

Status: AUDIT COMPLETE — READY FOR V1-ORG-01 DESIGN
Date: 2026-08-07
Mode: Audit only. No application code modified. No migrations created. No data changed.

---

## 1. Executive Summary

TechFusion-AI is a **single-organization-per-user product end-to-end**. The database schema,
signup flow, JWT contract, API surface, and web UI are all built on the assumption that
ONE USER = ONE ORGANIZATION. There is **no OrganizationMember / membership model**, there is
**no organizations controller** (no create/list/switch/rename/delete endpoints), and the
"Switch Organization" dropdown in the web top bar is a **single static, non-interactive menu
item** with a hardcoded fallback label.

The feature is not "mostly missing in the UI" — it is absent at every layer. However, the
data model is **multi-device-ready**: one Organization can already hold many Devices, and the
plan limits (Free=3, Pro=25, Business=100, Enterprise=999999) confirm this is intended. The
current "1 device" situation is simply because only one physical device has been enrolled.

Tenant isolation is enforced today by **application-level `where: { orgId }` clauses driven by
the JWT `orgId` claim**, not by RLS. RLS policies are declared for every tenant-scoped table
but are almost certainly **inert** (see §13 and §14): the app role owns the tables (no
`FORCE ROW LEVEL SECURITY`) and the `OrgContextInterceptor` sets the session variable with
`is_local = true` outside a transaction, so it does not propagate to subsequent pooled Prisma
queries. Two agent-ingestion endpoints (`inventory/report`, `network/discovery`) trust a
client-supplied `X-Org-Id` header when no device token is presented — a cross-tenant write
vector.

No implementation was performed. This report documents the exact current state and proposes a
phased architecture for V1-ORG-01.

---

## 2. Current Database Model

Source: `apps/api-gateway/prisma/schema.prisma` (identical in `apps/worker/prisma/schema.prisma`).

### 2.1 Organization model — EXISTS

```prisma
model Organization {
  id               String  @id @default(uuid())
  name             String
  slug             String  @unique
  plan             Plan    @default(Free)   // enum: Free | Pro | Business | Enterprise
  stripeCustomerId String? @unique
  subscription     Subscription?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  // ~27 relation arrays (users, devices, alerts, reports, ...)
}
```

Fields: `id`, `name`, `slug` (unique), `plan`, `stripeCustomerId` (unique), `createdAt`,
`updatedAt`. One-to-one singles: `reportTemplate`, `ssoConfig`, `retentionPolicy`, `subscription`.

### 2.2 User model — single-org hard-wired

```prisma
model User {
  id          String  @id @default(uuid())
  email       String  @unique
  passwordHash String
  displayName String
  // ... MFA, SSO fields ...
  orgId String            // REQUIRED, NOT nullable
  org   Organization @relation(fields: [orgId], references: [id])
  role  Role @default(Viewer)   // enum: Owner | Admin | Technician | Viewer
  refreshTokens RefreshToken[]
  @@unique([orgId, email])
}
```

Key answers:

| Question | Answer |
|---|---|
| Does Organization model exist? | **YES** |
| What fields does it have? | id, name, slug, plan, stripeCustomerId, subscription, timestamps |
| Does User directly reference Organization? | **YES — `User.orgId` is a required non-null FK** |
| Is there a many-to-many membership model? | **NO — no OrganizationMember / Membership model anywhere** |
| Can one user belong to multiple organizations? | **NO — schema-enforced single `orgId` column** |
| Can one organization contain multiple users? | **YES — `Organization.users` is an array** |
| Are roles stored in membership? | **NO — role is stored on `User.role` itself** |
| What role values exist? | **`Owner`, `Admin`, `Technician`, `Viewer`** (enum `Role`) |

### 2.3 Device model — multi-device per org supported

```prisma
model Device {
  id       String @id @default(uuid())
  orgId    String            // REQUIRED
  // ... identity/credential fields ...
  @@unique([orgId, identityFingerprint])  // unique_identity_per_org
  @@unique([orgId, installationId])       // unique_installation_per_org
  @@index([orgId])
}
```

| Question | Answer |
|---|---|
| Does Device contain orgId? | **YES — required** |
| Can many Devices belong to one Organization? | **YES — no unique constraint on `orgId`** |
| Unique constraints | Per-org identity/installation fingerprint uniqueness (one physical machine = one Device per org) |

### 2.4 Org-scoping of every domain table

| Domain | Model(s) | orgId | Indexed by org |
|---|---|---|---|
| Alerts | `AlertRule`, `Alert` | YES (required) | `[orgId]`, `[orgId, createdAt]`, `[orgId, status]` |
| Metrics | `DeviceMetric`, `DeviceHealthScore` | YES | `[orgId, recordedAt]`, `[orgId, calculatedAt]` |
| Reports | `Report`, `ReportSchedule`, `ReportTemplate` | YES | `[orgId, createdAt]`, `[orgId, type]`, `[orgId, nextRunAt]` |
| Remote support | `RemoteSession` | YES | `[orgId, status]`, `[orgId, deviceId, status]` |
| Enrollment | `EnrollmentToken` | YES (+ `createdByUserId`) | `[orgId]` |
| Security | `SecurityScan/`Finding/`Score` | YES | org-severity/device indexes |
| Network | `NetworkDevice`, `NetworkScan` | YES | `[orgId, ip]` unique, `[orgId]` |
| Inventory | `Driver`, `SoftwareInventory` | YES | `[orgId, name]` unique |
| Backups | `BackupJob`, `BackupRun` | YES | `[orgId]`, `[orgId, deviceId]` |
| AI | `AiProviderConfig`, `AiUsageLog`, `AiConversation` | YES | org composite indexes |
| Billing | `Subscription`, `Invoice` | YES | `[orgId]`, `[orgId, createdAt]` |
| Audit/KB/SSO/Retention | `AuditLog`, `KbArticle`, `SsoConfig`, `DataRetentionPolicy` | YES | org indexes |
| **Membership** | — | — | **MISSING (no model)** |

### 2.5 RLS policies — present but likely inert (see §13)

`20260616190200_rls` + `20260617000400_rls_complete` enable RLS and create `*_isolation` FOR ALL
policies on every tenant-scoped table, filtered by `current_org_id()` (reads the session setting
`app.current_org_id`). Two catalog tables (`DriverCatalogItem`, `SoftwareCatalogItem`) are
intentionally global (no RLS). No `FORCE ROW LEVEL SECURITY` anywhere.

---

## 3. Signup Organization Flow

Trace: `POST /auth/signup` → `AuthController.signup` (`apps/api-gateway/src/auth/auth.controller.ts:17`)
→ `AuthService.signup` (`apps/api-gateway/src/auth/auth.service.ts:62-113`).

```
signup { email, password, displayName, orgName }
  → check user.email not exists                     (auth.service.ts:63)
  → hash password                                    (auth.service.ts:68)
  → normalizeSlug(orgName) → slug with 10 retries    (auth.service.ts:69-73, normalizeSlug:47)
  → $transaction:
      tx.organization.create({ name, slug })         (auth.service.ts:78-80)
      tx.user.create({ ..., orgId: org.id, role: 'Owner' })  (auth.service.ts:82-90)
  → generateTokens(userId, org.id, 'Owner')          (auth.service.ts:96)
      accessToken JWT { sub, orgId, role } 15m       (auth.service.ts:196-200)
      refreshToken row with orgId                    (auth.service.ts:202-210)
  → response { user: { ..., orgId }, accessToken, refreshToken }
```

Deterministic answers:

- **Is "My Organization" automatically created during signup?** YES — the org the user typed
  in the signup form (`orgName`, `SignupForm.tsx:100-113`) is created in the same transaction.
- **Is it hardcoded?** The org is user-supplied (signup form), but the *one-org-per-user* wiring
  is hardcoded: `user.orgId = org.id` and `role: 'Owner'`.
- **Created only once?** YES — email uniqueness (`auth.service.ts:63`) blocks a second signup;
  there is no endpoint to create another org later.
- **Does the creator receive OWNER membership?** YES — `role: 'Owner'` on the User row.
- **Can the database already support another organization for the same user?** NO — `User.orgId`
  is a single required FK; no join table.
- **Is there a unique constraint preventing it?** The schema shape itself prevents it (one column),
  plus `@@unique([orgId, email])`. There is no constraint to remove per se; a migration is required.
- **Does signup store only one orgId on the User?** YES — `user.orgId`.

**Exact code responsible for the default organization:** `AuthService.signup` transaction at
`apps/api-gateway/src/auth/auth.service.ts:77-93`.

---

## 4. Auth / JWT Organization Contract

Token creation: `AuthService.generateTokens(userId, orgId, role)` (`auth.service.ts:195-213`).

**Access token payload:** `{ sub: userId, orgId, role }`, 15-minute expiry, HS256 (`auth.service.ts:196-200`).
**Refresh token:** opaque 48-byte hex, stored in `RefreshToken` with `orgId`, 7-day expiry (`auth.service.ts:202-210`).

The JWT contains:
- `orgId` — the user's single organization.
- `role` — single global role (`Owner`/`Admin`/`Technician`/`Viewer`).

It does **NOT** contain: `membershipId`, `currentOrg`, `organizationId` alias, an org array, or any
per-org role set.

**Architecture verdict: ONE USER = ONE ORG, hard-wired.** There is no "many orgs + one active" model.
Every authenticated request is scoped by `req.user.orgId` (JWT claim) — guards, the RLS interceptor,
WebSocket auth (`ws-auth.middleware.ts` requires `payload.orgId`), and every controller.

`CombinedAuthGuard` (`common/combined-auth.guard.ts:46-57`) enforces a role hierarchy
Owner=4 > Admin=3 > Technician=2 > Viewer=1 from the **JWT role claim without re-checking the DB**
on each request.

---

## 5. Existing Organization APIs

**There is NO organizations controller.** Grep for `@Controller('organization')`,
`organizations`, `OrganizationController` returns nothing in `apps/api-gateway/src` (only a test
string about WS broadcast isolation). `AppModule` imports no `OrganizationModule`.

The only org-adjacent endpoints are admin-scoped:

| Endpoint | Exists | Works | Notes |
|---|---|---|---|
| `GET /admin/org` | YES | WORKS | `admin.service.ts:98-121` — org info + `_count` (users, devices, auditLogs, remoteSessions, securityScans, backupJobs). Owner/Admin only. |
| `GET /admin/users` | YES | WORKS | Single-org user list (`admin.service.ts:12-28`). |
| `GET /admin/users/:userId` | YES | WORKS | `admin.service.ts:30-47` (org-scoped findFirst). |
| `POST /admin/users/:userId/role` | YES | WORKS | Owner-only role change (`admin.service.ts:49-78`). |
| `POST /admin/users/:userId/remove` | YES | WORKS | Owner-only remove, protects Owner/self (`admin.service.ts:80-94`). |
| `GET /organizations` | NO | — | Missing. |
| `GET /organizations/:id` | NO | — | Missing (only admin/org with own JWT org). |
| `POST /organizations` | NO | — | **Create-org API MISSING.** |
| `PATCH /organizations/:id` | NO | — | Missing (no rename). |
| `DELETE /organizations/:id` | NO | — | Missing. |
| `POST /organizations/:id/members` | NO | — | Missing (no invites/join). |

Deterministic answers:
- **Is create organization API already present?** NO.
- **Does frontend call it?** N/A — it does not exist.
- **Does it create membership?** N/A.
- **Does it enforce ownership?** N/A.
- **Can user list all organizations they belong to?** NO — impossible; a user belongs to exactly one
  org by schema, and no list endpoint exists.

---

## 6. Current Web Organization UI

### 6.1 The "My Organization" / "Switch Organization" selector

`apps/web/src/components/Topbar.tsx:46-59`:

```tsx
<DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
<DropdownMenuItem>
  <Building2 className="h-4 w-4 mr-2" />
  {orgName || 'My Organization'}
</DropdownMenuItem>
```

Deterministic answers:
- **Where does the org list come from?** Nowhere. It is a single static `DropdownMenuItem` with
  no `onClick`, no fetch, no state change.
- **Real API data or hardcoded?** Hardcoded. `orgName` is a prop that is **never passed** —
  `apps/web/src/app/dashboard/layout.tsx:83-88` passes only `userName` and `userRole`, so the label
  always falls back to the literal `'My Organization'`.
- **Does the dropdown support multiple organizations?** NO — one item.
- **Is Create Organization intentionally absent?** Absent entirely (no UI, no API).
- **Is there an Organization settings page?** NO. `/dashboard/settings` is the **AI router
  settings** page (providers/stats/strategy), not org settings. Enrollment lives at
  `/dashboard/settings/enrollment`.
- **Is there a Team page that duplicates part of org management?** YES — `/dashboard/team`
  (`team/page.tsx`) is the single-org member list via `/admin/users` (role change/remove only).
  Its empty-state text says "Add team members through your organization settings", a flow that
  does not exist (`team/page.tsx:136-140`).
- **What happens internally when selecting an organization?** Nothing — the item is non-interactive.
- **Does selection update only React state?** There is no selection.
- **Does it change backend request context?** No mechanism exists (see §7).
- **Is the selection persisted after refresh?** N/A — nothing to persist. The active org is always
  the JWT `orgId`, which only changes on login.

Sidebar (`components/Sidebar.tsx:34-50`) has no Organization nav item (only Team/Enrollment/Settings).

---

## 7. Active Organization Mechanism

**There is no active/current/selected-organization concept.** Searches for `activeOrg`,
`currentOrg`, `selectedOrg`, `x-org-id` usage from the web produce nothing (the only
`app.current_org_id` reference is the RLS interceptor; `X-Org-Id` is a CORS-allowed header and is
used by the Rust agent for ingestion, never by the web app).

Trace of one real Dashboard request:

```
Browser
  → apiFetch('/dashboard/summary')            auth-client.ts:107  (Authorization: Bearer only)
  → Next fetch to API gateway
  → CombinedAuthGuard: jwt.verify → request.user = { sub, orgId, role }   combined-auth.guard.ts:32-33
  → DashboardController.getSummary(req.user.orgId)                        dashboard.controller.ts:10
  → DashboardService.getSummary(orgId)                                    dashboard.service.ts:22
      → every Prisma query: where { orgId }  (devices, alerts, findings, scores, reports, ...)
```

**How does the backend know which organization is active?** From the `orgId` JWT claim only. There is
no header-based org override, no `x-org-id` on dashboard/read endpoints, no org context provider/store
in the web app, and no persistence of a user-selected org beyond the token.

---

## 8. Device Ownership Audit

### 8.1 Capability
- `Device.orgId` is required; no uniqueness on `orgId` → **an org can hold many devices**.
- `Device.findByOrg` uses `findMany({ where: { orgId } })` (`devices.service.ts:262-267`).
- `Device.findById` uses `findFirst({ where: { id, orgId } })` (`devices.service.ts:269-275`) — a
  user **cannot query another org's device by ID** (returns 404). SAFE.
- Registration dedupes per org (`findExistingDevice`, `devices.service.ts:182-206`) → a device cannot
  be re-registered into a different org under the same identity.

### 8.2 Single-device assumptions found (classified)

| Location | Pattern | Verdict |
|---|---|---|
| `dashboard.service.ts:51-55` | `device.findMany` + iterate fleet | SAFE — multi-device aware |
| `reporting.service.ts:409-420` `collectDeviceHealthData` | `findFirst` w/ optional `deviceId`, orders by `lastSeenAt desc` | PARTIAL — when no `deviceId`, a device-health report picks **one** device (most recent); multi-device via `ReportSchedule.deviceIds` JSON list elsewhere |
| `reporting.service.ts:450-455` `collectSecurityData` | `findFirst` per scan/device | SAFE — takes explicit IDs |
| `ai troubleshooting.controller.ts:60-69` | `findFirst({ where: { id, orgId } })` | SAFE — org-scoped, per requested device |
| `remote-support.service.ts:30,351` | `findFirst` device by id+org | SAFE — org-scoped |
| worker `monitoring-sweep.ts:115-145` | `findFirst` latest metric/score per device | SAFE — per-device, system scope |
| Web device-health `[id]` route, AI chat device dropdown | deviceId-driven | SAFE — explicit device selection |

No `devices[0]` / `currentDevice` / `firstDevice` product-limiting assumptions found. The dashboard
and Command Center are fleet-iteration based.

**Conclusion:** there is **no hidden single-device limitation**. The user sees one device because one
physical machine has been enrolled (Free plan allows 3, Pro 25, Business 100, Enterprise 999999 —
`billing/plan-features.ts:44-110`).

---

## 9. Enrollment Organization Binding

Certified Linux path: Dashboard enrollment page → token → agent install → registration → reconnect.

- **Token generation** — `POST /enrollment/tokens` (Owner/Admin), `enrollment.controller.ts:10-21` →
  `createToken(req.user.orgId, ...)` (`enrollment.service.ts:16-66`). orgId comes from the JWT, not the
  client. Audit-logged. **SAFE.**
- **Token record** — `EnrollmentToken { orgId, tokenHash (unique), createdByUserId, maxUses/useCount,
  expiresAt, revokedAt }`. Org is bound at creation.
- **Agent registration** — `POST /devices/register-public` (`devices.controller.ts:37-58`) requires
  `enrollmentToken`; `orgId = validateToken(token)` returns `record.orgId` from **server DB state**
  (`enrollment.service.ts:68-115`). The DTO (`register-public.dto.ts`) has **no orgId field** —
  arbitrary orgId cannot be injected. **SAFE.**
- **Device creation** — `DevicesService.registerPublic(orgId, dto)` writes `Device.orgId` from the
  token-derived orgId; dedup + plan limits enforced (`devices.service.ts:74-141`).
- **Persistent reconnect** — `DeviceTokenGuard` resolves the device token → Device row → `orgId`
  (`device-token.guard.ts:34-69`). `rotateCredential` keeps the device's orgId (`devices.service.ts:208-247`).
  The Rust agent persists `device_token` + `device_id` locally (`agent/src/registration.rs:143-203`) and
  only ever re-enrolls with the same org enrollment token.

Deterministic answers:
- **Is enrollment token tied to orgId?** YES.
- **How is orgId chosen?** Server-side: JWT at creation, DB record at redemption.
- **Can frontend send arbitrary orgId?** NO for device enrollment.
- **Does backend validate membership before issuing token?** Role-gated (Owner/Admin) — adequate given
  one-org-per-user; there is no cross-org membership to validate.
- **Does Device get orgId from trusted token/server state?** YES.
- **Could a token from Org A enroll into Org B?** NO — the token record carries Org A's orgId.
- **Could reconnect change Device org?** NO — device token → device row is org-fixed.

**Enrollment org binding: SAFE** (for device enrollment). Caveat: the sibling agent-ingestion paths
(`inventory/report`, `network/discovery`) trust `X-Org-Id` when no device token is sent — see §14.

---

## 10. Dashboard / Monitoring Scoping Audit

- **Dashboard summary** (`dashboard.service.ts:22-253`): every query is `where: { orgId }`. SAFE.
- **Command Center / operational state** (`dashboard.controller.ts` → `operational-state.ts`): derives
  from the org-scoped summary. SAFE.
- **Device Health** (`GET /devices/:id`, `/metrics`, `/scores`, `/latest`): all take `req.user.orgId`
  (`devices.controller.ts:194-227`). SAFE.
- **Monitoring presence sweep** (`worker/src/monitoring-sweep.ts`): runs globally in the worker
  (system context, `allOrgs: true` from `presence-sweep-scheduler.service.ts:93-96`) but operates per
  device using the device's own `orgId`; alerts written with the device's orgId. SAFE — no user context.
- **Alerts** (`alerts.controller.ts` / `alerts.service.ts`): all endpoints org-scoped
  (`findFirst({ where: { id, orgId } })`, `findAlertsByOrg`). SAFE.
- **Cybersecurity** (`security.service.ts`): org-scoped where clauses on scans/findings/scores. SAFE.
- **Reports** (`reporting.service.ts`): `list` org-scoped; `deleteReport`/`getDownloadInfo` verify
  `report.orgId !== orgId` after fetch. SAFE.
- **Remote Support** (`remote-support.service.ts` + gateway): sessions scoped by `{ id, orgId }`;
  WS joins `org:{orgId}` and `session:{sessionId}` rooms. SAFE.
- **Web frontend filtering**: the web app never downloads cross-org data — every hook sends only the
  Bearer token and the server filters by JWT `orgId`. **No P0 browser-side tenant leak.**

---

## 11. Team / Membership Audit

- **"Team" is the single-org User list** — there is no separate Team model, no TeamMember model, no
  invitations table, no pending state. `Organization.users → User[]` is the entire membership concept.
- Team page (`apps/web/src/app/dashboard/team/page.tsx`) calls `GET /admin/users` and posts
  `/admin/users/:id/role` and `/admin/users/:id/remove` (Owner-only). Roles are stored on `User.role`.
- **RBAC foundation that exists** (for future V1-ORG-01): `enum Role { Owner, Admin, Technician,
  Viewer }`, `RolesGuard`/`CombinedAuthGuard` hierarchy (Owner=4, Admin=3, Technician=2, Viewer=1),
  `@Roles()` decorators on billing/enrollment/admin/report-schedule/troubleshoot endpoints, and
  client-side role checks (`isOwner`, `isAdminOrAbove`, `isTechnicianOrAbove` in `auth-client.ts:162-178`).
- **Missing:** membership model, invites, join-by-email, per-org roles for a user in multiple orgs,
  org transfer.

---

## 12. Tenant Isolation Audit

Current controls and their real effect:

| Control | Mechanism | Effective? |
|---|---|---|
| JWT `orgId` claim | All controllers/services read `req.user.orgId` | YES — primary control |
| Manual `where: { orgId }` clauses | Dashboard, devices, alerts, reports, admin, enrollment, billing, security, network (reads), backups, retention | YES — the actual isolation layer |
| `OrgContextInterceptor` → `set_config('app.current_org_id', ..., is_local=true)` | `org-context.interceptor.ts:13` | **LIKELY INERT** — see below |
| RLS policies (`*_isolation`, `current_org_id()`) | 2 migrations, ~29 tables | **LIKELY INERT** — owner role bypasses (no `FORCE ROW LEVEL SECURITY`); and the interceptor's setting does not survive across pooled connections / implicit transactions |
| WebSocket rooms `org:{orgId}` | `devices.gateway.ts:42`, remote gateway | YES |
| Global guards | `CombinedAuthGuard` (JWT+roles), `PlanGuard`, `ThrottlerGuard` | YES |

### RLS effectiveness analysis (NEEDS_REVIEW)
1. Prisma connects as `techfusion` / `techfusion_test` (from `.env`, `.env.test`), which created the
   tables via `prisma migrate`. PostgreSQL table owners **bypass RLS by default**; none of the
   migrations issue `FORCE ROW LEVEL SECURITY`, so the app connection is exempt.
2. Even if RLS applied, `OrgContextInterceptor` calls `$executeRawUnsafe('SELECT set_config(...)',
   is_local=true)` as a standalone statement (its own implicit transaction) and never joins it with the
   route handler's queries. On a pooled client the setting does not propagate, so `current_org_id()`
   would be NULL for the actual queries — RLS would block everything rather than scope it.

**Net:** tenant isolation today = application-level `where` clauses on a JWT-derived orgId. It is real
for reads, with two write-vector exceptions (§14). The V1-CORE-00 "RLS-protected" characterization
should be corrected to "app-clause-protected".

---

## 13. Security Findings

| # | Severity | Finding | Location | Class |
|---|---|---|---|---|
| F1 | MEDIUM | Client-supplied `orgId` trusted on a public write path — `orgId = req.headers['x-org-id'] \|\| body?.orgId`, only overridden if a valid device Bearer token is present; falls back to a null-UUID org otherwise | `inventory/inventory.controller.ts:23-38` | VULNERABLE (cross-tenant write / data pollution) |
| F2 | MEDIUM | Same pattern on network discovery ingest | `network/network.controller.ts:86-98` | VULNERABLE (cross-tenant write / data pollution) |
| F3 | MEDIUM | RLS declared but likely inert (owner-bypass + broken session-variable propagation) | migrations `..._rls`, `..._rls_complete`; `org-context.interceptor.ts:13` | NEEDS_REVIEW |
| F4 | LOW | Role in JWT trusted without per-request DB re-validation (stale-role until re-login; harmless under single-org but must be revisited for membership) | `combined-auth.guard.ts:46-57` | NEEDS_REVIEW |
| F5 | LOW | `inventory` orphan rows written under hardcoded null UUID when unauthenticated agent reports arrive | `inventory.controller.ts:37` | NEEDS_REVIEW |
| F6 | INFO | No org CRUD/switch — missing feature, not a leak | §5, §6 | MISSING |
| F7 | INFO | WebSocket session/room scoping is org-correct | gateways | SAFE |
| F8 | INFO | All dashboard/read endpoints org-scoped by JWT; no browser-side cross-org filtering | §10, §12 | SAFE |

No exploit was performed; findings are from static inspection only.

---

## 14. Root Cause — Why Only One Organization

**Root cause: the entire stack is intentionally single-org. Multiple proven causes, not one:**

- **A. Database only supports one org/user** — `User.orgId` is a required single FK with
  `@@unique([orgId, email])`; **no membership table** (`schema.prisma:75-95`).
- **B. Signup/auth assumes one** — signup atomically creates org + user + Owner role
  (`auth.service.ts:77-93`); JWT embeds a single `orgId` (`auth.service.ts:196-200`).
- **D. Create-Organization API is missing** — no `organizations` controller exists
  (`app.module.ts:40-45` imports no org module; grep confirms zero org routes).
- **F. Switching UI is UI-only** — `Topbar.tsx:46-59` renders one static, non-interactive item;
  `orgName` is never passed from `layout.tsx:83-88`, so the label is the hardcoded literal
  `'My Organization'`.
- **H. Membership model is missing** (implied by A).

So **G (JWT hard-locks to one org)** is also true, but it is a *consequence* of A/B rather than a
separate decision: there is nothing else the JWT could reference.

> The user cannot create/use additional organizations because: (1) the schema forbids it (A/H),
> (2) the only org-creation path is the signup transaction (B), (3) there is no org API (D), and
> (4) the switcher is a decorative single item (F). Evidence: `apps/api-gateway/src/auth/auth.service.ts:77-93`,
> `apps/api-gateway/prisma/schema.prisma:75-95`, `apps/web/src/components/Topbar.tsx:46-59`,
> `apps/web/src/app/dashboard/layout.tsx:83-88`.

---

## 15. Gap Matrix

Legend: E = EXISTS_AND_WORKS, I = EXISTS_BUT_INCOMPLETE, B = BROKEN, M = MISSING, D = DANGEROUS

| Capability | Current State | Evidence | Risk | Needed for V1-ORG-01 |
|---|---|---|---|---|
| Default organization | E | Signup txn `auth.service.ts:77-93` | None | Reuse as-is |
| Create organization | M | No `organizations` controller | High (feature) | Build API + UI |
| List organizations | M | No list endpoint; switcher is static | High (feature) | Build (via membership) |
| Switch organization | I (UI-only shell) | `Topbar.tsx:46-59`, no onClick | Medium | Real endpoint + state + JWT refresh |
| Membership | M | No OrganizationMember model | High (blocker) | Add model + migration |
| Ownership | I (role-on-user) | `User.role='Owner'` at signup | Medium | Move to membership row |
| Roles foundation | E | `enum Role`, hierarchy guard `combined-auth.guard.ts:46-57` | Low | Reuse; store per-membership |
| Multiple devices / org | E | `Device.orgId` no unique; plan limits 3/25/100/∞ | Low | Reuse, no change |
| Enrollment org binding | E (SAFE) | token→DB orgId; DTO has no orgId | Low | Preserve; add cross-org checks |
| Dashboard org scoping | E (SAFE) | `dashboard.service.ts` all `where: {orgId}` | Low | Keep JWT-driven |
| Monitoring org scoping | E (SAFE) | per-device orgId in sweep | Low | Keep |
| Alerts org scoping | E (SAFE) | `alerts.service.ts` org-scoped | Low | Keep |
| Reports org scoping | E (SAFE) | `reporting.service.ts` org-verified | Low | Keep |
| Remote support org scoping | E (SAFE) | sessions + WS rooms org-scoped | Low | Keep |
| Team/member UI | I | `/admin/users` + team page (no invites) | Medium | Extend to membership |
| Tenant isolation | I (app-clause, RLS inert) | §12; F1/F2 | Medium | Harden F1/F2; decide on RLS |
| RLS | B (declared, inert) | §12/F3 | Medium | Repair or consciously drop |
| Active org persistence | M | org is always JWT orgId | Medium | Persist selection server-side |
| Empty organization state | I | Dashboard NO_DATA path exists | Low | Reuse |
| Organization management UI | M | No org settings page | High (feature) | Build |

---

## 16. Existing Components Worth Reusing

1. **Roles + guards** — `enum Role`, `RolesGuard`/`CombinedAuthGuard` hierarchy, `@Roles()` decorators.
2. **JWT + refresh token infra** — `AuthService.generateTokens`, `RefreshToken` table (orgId column
   exists), `auth-client.ts` token/refresh helpers, `decodeJwt`.
3. **RLS scaffolding** — policies + `current_org_id()` helper (once the propagation bug is fixed, if RLS
   is kept).
4. **Org-scoped data layer** — every domain service already takes `orgId` as its first parameter; a new
   org context can be threaded through unchanged.
5. **Admin member management** — `AdminService.listUsers/updateUserRole/removeUser` becomes the seed of
   membership management.
6. **OrgInfo endpoint** — `GET /admin/org` (`admin.service.ts:98-121`) can become `GET /organizations/current`.
7. **Enrollment binding** — token→orgId server-state derivation must be preserved for multi-org.
8. **Dashboard empty-state (NO_DATA)** — ready for new-org onboarding.
9. **`normalizeSlug`** (`auth.service.ts:47-54`) — reuse for org slug creation.
10. **Team page + Enrollment page UI patterns** — cards/tables/role selects that a members UI can mirror.

## 17. Components That Must NOT Be Rebuilt

- Device registration, identity dedupe (`unique_identity_per_org`), credential rotation/recovery.
- Alert/metrics/report/remote-support org-scoped queries.
- Auth token lifecycle (access+refresh) and web `apiFetch` retry/refresh logic.
- WS room scoping (`org:{orgId}`).
- Presence sweep and monitoring evaluation.
- The certified Linux agent enrollment/reconnect contract (`agent/src/registration.rs`).
- `Role` enum values and the guard hierarchy.

## 18. Recommended V1-ORG-01 Architecture

Objective: introduce ONE USER = MANY ORGS + ONE ACTIVE ORG with minimal migration surface, keeping
every existing org-scoped service contract intact.

**Core design (proposed, not implemented):**

- **Add `OrganizationMember`** as the membership row:
  `{ id, userId, orgId, role (Role), createdAt, updatedAt }`, `@@unique([userId, orgId])`, indexes on
  userId and orgId. Backfill `OrganizationMember` from `User` (user.orgId → OWNER for the creator;
  keep existing roles on the existing row).
- **Decouple `User.orgId`** → make it optional/nullable as a *"default/active org"* pointer
  (`currentOrgId`), while `OrganizationMember` becomes the source of truth for access. This avoids a
  full rewrite: existing `where: { orgId }` services keep receiving the active orgId from the request.
- **JWT**: keep `{ sub, orgId (active), role }` so zero services change; issue a new token when the
  active org switches (refresh flow already re-issues from `stored.user.orgId` → needs to read the
  active membership instead).
- **New endpoints** (org module): `GET /organizations` (memberships of user), `POST /organizations`
  (create + OWNER membership + optional empty state), `PATCH /organizations/:id` (rename), 
  `POST /organizations/:id/switch` (select active → reissue JWT + refresh row), `POST /organizations/:id/members`
  (invite), `PATCH /organizations/:id/members/:userId/role`, `DELETE /organizations/:id/members/:userId`.
- **Backend active-org context**: a per-request resolver that derives orgId from membership + JWT
  (defense-in-depth), not from a client header for read paths.
- **RLS**: either repair (transactional `set_config` + non-owner role + `FORCE ROW LEVEL SECURITY`)
  or explicitly drop the pretense and rely on app clauses plus membership validation. Decide in ORG-01B.
- **UI**: real org switcher (list memberships, switch calls API, refresh token on 200), org settings
  page (rename/create), team page extended with invites (pending membership rows), empty-org onboarding.

## 19. Proposed Implementation Phases

| Phase | Scope | Migrations | Notes |
|---|---|---|---|
| **ORG-01A** | Membership model + backfill + `User.orgId`→optional active pointer; org controller (list/create/rename/switch); JWT re-issue on switch; membership-check guard | 1 schema migration + 1 backfill migration | Smallest viable multi-org. Preserves all existing queries. |
| **ORG-01B** | Tenant hardening: F1/F2 orgId trust removal (device-token or membership-validated only), RLS decision (repair or drop), `current_org_id` propagation fix if RLS kept | possibly 0 (or FORCE RLS) | Security phase, independent of org features. |
| **ORG-01C** | Members UI (invites/pending/role management on team page), org settings UI, empty-org onboarding, active-org persistence in refresh/WS flow | 0–1 (pending invites) | Product completeness. |
| **ORG-01D** (later, optional) | Cross-org device visibility, org transfer/delete, per-org plan/billing | separate | Out of V1-ORG-01 scope. |

Every phase reuses the existing org-scoped services, `Role` enum/guards, token lifecycle, and
enrollment binding. Device/enrollment behavior is untouched.

## 20. Risks

1. **`User.orgId` decoupling touches the hottest code path** — every controller reads
   `req.user.orgId`. Mitigation: keep JWT shape identical; only the value source changes (membership
   active org). Verified by existing dashboard/devices/alerts/report tests.
2. **Refresh-token orgId** — refresh must re-issue from the *active membership*, not the stored
   `RefreshToken.orgId` (which is frozen at issue time). Must be updated in ORG-01A.
3. **RLS is inert but still deployed** — leaving it unaddressed is a false sense of security; either
   fix (transactional `set_config` + forced RLS + non-owner role) or document it as non-enforcing.
4. **F1/F2 orgId injection** — public ingestion endpoints can already write to arbitrary orgs;
   fix before inviting additional orgs (data integrity across tenants).
5. **Slug/plan coupling** — `Organization.plan` and `Subscription` are per-org; multi-org users will
   see per-org plans. Keep plan lookup by active org.
6. **Stale JWT role** — after membership role changes, tokens keep the old role until refresh; add a
   refresh-time membership check or short access-token TTL.
7. **Two Prisma schemas** (api-gateway + worker) must stay in sync for any new model.

## 21. Final Audit Verdict

TechFusion-AI today is a correct, RLS-declared, app-clause-enforced **single-tenant-per-user**
system with a **fully multi-device-ready** fleet model. Multi-organization support is missing at every
layer (schema, auth, API, UI), not merely hidden. The path to V1-ORG-01 is additive and low-risk:
introduce `OrganizationMember`, keep the JWT contract and all org-scoped services, add an org CRUD
+ switch API, and build the membership-aware UI — while fixing the two ingestion orgId-injection
points and deciding the fate of the inert RLS layer.

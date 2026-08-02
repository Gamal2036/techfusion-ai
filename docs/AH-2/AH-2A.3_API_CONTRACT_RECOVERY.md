# AH-2A.3 — API Contract Recovery

## Summary

Repaired two verified API contract mismatches between Frontend and Backend:

1. **Team Management**: Frontend called non-existent `/team/members` routes. Rewired to real backend `/admin/users` routes with proper role enforcement and permission-aware UI.
2. **Report Generation**: Frontend called `POST /reports` with incomplete body. Rewired to `POST /reports/generate` matching the backend `GenerateReportDto` exactly, with proper error handling and format selection.

## Verified Contract Mismatches

| Area | Frontend Was Calling | Backend Exposes | Fixed To |
|------|---------------------|-----------------|----------|
| Team list | `GET /team/members` | `GET /admin/users` | `GET /admin/users` |
| Team remove | `DELETE /team/members/:id` | `POST /admin/users/:id/remove` | `POST /admin/users/:id/remove` |
| Team invite | `POST /team/members` | (no equivalent) | Disabled with explanation |
| Report generate | `POST /reports` with `{ title, type }` | `POST /reports/generate` with `GenerateReportDto` | `POST /reports/generate` with full DTO |

## Files Modified

| File | Change |
|------|--------|
| `packages/types/index.ts` | Added `TeamRole`, `TeamMember`, `ReportType`, `ReportFormat`, `GenerateReportRequest`, `ReportRecord` types |
| `apps/web/src/app/dashboard/team/page.tsx` | Rewired to `/admin/users`, `/admin/users/:id/remove`, `/admin/users/:id/role`. Disabled invite. Added permission-aware UI with role dropdowns, self-removal guard, error handling |
| `apps/web/src/hooks/useReports.ts` | Changed to `POST /reports/generate` with full DTO. Added error state with status codes. Updated `ReportRecord` type to match backend |
| `apps/web/src/app/dashboard/reports/page.tsx` | Fixed report types to backend enum values, added format selection, AI summary toggle, uses `signedUrl` for downloads, visible error display |
| `apps/web/package.json` | Added `@techfusion/types` dependency |

## Team Contract Implementation

### Routes Used

| Method | Route | Purpose | Role Gate |
|--------|-------|---------|-----------|
| `GET` | `/admin/users` | List org members | Owner, Admin |
| `POST` | `/admin/users/:userId/role` | Change user role | Owner |
| `POST` | `/admin/users/:userId/remove` | Remove user | Owner |

### Frontend Behavior

- **List**: Loads users from `GET /admin/users`. Shows 403 error if not Owner/Admin.
- **Role Change**: Owner can change any user's role via dropdown. Cannot change another Owner's role (backend enforces).
- **Remove**: Owner can remove non-Owner, non-self users. Backend prevents self-removal and Owner removal.
- **Invite**: Invite button removed. Non-admin users see "Invite members through your organization admin" message.
- **Viewer/Technician**: Cannot see action buttons (permission checked via `isAdminOrAbove()` and `isOwner()`).
- **Self-identification**: Current user shows "(you)" label. Remove button hidden for self.

### Backend Protections Preserved

- `@Roles('Owner', 'Admin')` on list users
- `@Roles('Owner')` on role change and remove
- Org isolation via `req.user.orgId` in all queries
- Cannot change role of another Owner
- Cannot remove the Owner
- Cannot remove yourself
- Invalid role values rejected

## Report Contract Implementation

### Routes Used

| Method | Route | Purpose | Role Gate |
|--------|-------|---------|-----------|
| `POST` | `/reports/generate` | Generate new report | Admin, Owner |
| `GET` | `/reports` | List reports | Any authenticated |
| `GET` | `/reports/download/:id/:format` | Download report file | Any authenticated |

### Request Body Match

```typescript
{
  type: 'device_health' | 'security_executive' | 'fleet_summary',  // ReportType enum
  format: 'pdf' | 'docx' | 'html',                                 // ReportFormat enum
  title?: string,
  description?: string,
  deviceIds?: string[],
  scanId?: string,
  generateAiSummary?: boolean,
}
```

### Response Handling

- `GET /reports` returns array of `ReportRecord` objects
- `POST /reports/generate` returns created report with `signedUrl`
- Download uses `signedUrl` prepended with `getApiUrl()` (no hardcoded localhost)

### Error Handling

| Status | Handling |
|--------|----------|
| 400 | Display validation error message from backend |
| 401 | Redirected to login via `apiFetch` refresh flow |
| 403 | Display plan restriction / permission denied message |
| 404 | Display "not found" message |
| 500 | Display "server error" message |

### Plan Restrictions

- Backend enforces `maxReportsPerMonth` per plan tier via `getPlanConfig()`
- Free: 5/month, Pro: 50/month, Business: 200/month, Enterprise: unlimited
- 403 ForbiddenException thrown when limit reached

## Shared Types

Added to `packages/types/index.ts`:

- `TeamRole` — `'Owner' | 'Admin' | 'Technician' | 'Viewer'`
- `TeamMember` — Full user record from admin endpoint
- `ReportType` — String union: `'device_health' | 'security_executive' | 'fleet_summary'`
- `ReportFormat` — String union: `'pdf' | 'docx' | 'html'`
- `GenerateReportRequest` — Request body for report generation
- `ReportRecord` — Full report record from backend

Used `as const` objects + derived types (not TypeScript enums) for frontend compatibility.

## Permission and Error Handling

### Team Page

- Owner/Admin can view team list (backend enforced)
- Only Owner can change roles and remove members (backend enforced)
- Viewer/Technician see no action buttons (frontend enforced)
- Self-removal blocked (backend + frontend)
- Owner cannot be removed (backend enforced)
- Backend returns 400/403/404/500 with descriptive messages

### Reports Page

- Admin/Owner can generate reports (backend enforced)
- All authenticated users can list reports
- Plan limits enforced server-side
- AI summary generation uses existing AI orchestrator with fallback on failure
- Download URLs use signed URLs with HMAC validation

## Tests Added or Updated

### Backend (`apps/api-gateway/src/admin/admin.service.spec.ts`) — 13 tests

- Owner/Admin can list current organization users
- Cross-organization access is rejected (NotFoundException)
- Allowed role changes work
- Invalid roles rejected (BadRequestException)
- Cannot change role of another Owner (BadRequestException)
- Self-role-change allowed for Owner
- Owner can remove users
- Cannot remove Owner (BadRequestException)
- Cannot remove yourself (BadRequestException)
- Nonexistent user returns NotFoundException

### Backend (`apps/api-gateway/src/reporting/reporting.service.spec.ts`) — 12 tests

- Report generation accepts correct DTO
- Uses default title when omitted
- Unknown report type rejected
- Unsupported format rejected
- Monthly plan limit enforced (ForbiddenException)
- Generation within plan limit succeeds
- List reports for org
- List filters by type
- Delete schedule for correct org
- Delete schedule returns false for wrong org
- Delete schedule returns false for nonexistent

### Frontend (`apps/web/src/__tests__/team-page.spec.ts`) — 11 tests

- Team list uses `GET /admin/users`
- Remove uses `POST /admin/users/:id/remove`
- Role change uses `POST /admin/users/:id/role`
- Invite does not call `POST /team/members`
- Viewer/Technician cannot perform admin actions
- Admin can manage but not change roles
- Owner can perform all admin actions
- 403/401/500 error handling verified

### Frontend (`apps/web/src/__tests__/useReports.spec.ts`) — 7 tests

- Generate calls `POST /reports/generate` with correct body
- Old `POST /reports` endpoint not used
- 403 plan restriction sets error state
- 500 server error sets error state
- Network failure sets error state
- All authenticated calls use `apiFetch()`
- List uses `GET /reports`

**Total: 43 new tests, all passing**

## Validation Results

| Check | Result |
|-------|--------|
| `pnpm run lint` (web) | PASS |
| `pnpm run lint` (api-gateway) | PASS |
| `pnpm run build` (web) | PASS |
| `pnpm run build` (api-gateway) | PASS |
| Web tests | 39 passed, 0 failed |
| Backend unit tests | 59 passed, 0 failed |
| Total tests | 98 passed, 0 failed |

### No stale references to removed endpoints

- `/team/members` — Only referenced in tests asserting it is NOT used
- `POST /reports` (without `/generate`) — No references remain

## Regression Results

| Area | Status |
|------|--------|
| Login | INTACT — `POST /auth/login`, MFA flow, token storage |
| Token refresh | INTACT — 401 interception, refresh deduplication, retry |
| Logout | INTACT — Backend call, local cleanup, redirect |
| Dashboard navigation | INTACT — Auth guard, sidebar, command palette |
| Admin user management | INTACT — All `/admin/*` routes unchanged |
| Report listing and downloading | INTACT — `GET /reports`, `GET /reports/download/:id/:format` |
| Billing plan restrictions | INTACT — `PlanGuard` enforces per-plan limits |
| Organization isolation | INTACT — All queries scoped by `orgId` |
| Auth guards and PlanGuard | INTACT — `RolesGuard`, `JwtAuthGuard`, `PlanGuard` unchanged |

## Remaining Contract Gaps

1. **Team Invite**: No backend invitation system exists. Invite action disabled with informational message. Full email invitation flow would require new backend endpoints, email service integration, and token-based invitation system — out of scope for this task.
2. **TeamMember.status**: Backend does not return a `status` field for users. All listed users are implicitly active. If user suspension/deactivation is needed, a new backend field and endpoint would be required.
3. **Report format selection**: Frontend now offers PDF/DOCX/HTML selection, matching the backend's three generators. The backend previously didn't receive `format` from the frontend — this is now fixed.
4. **Cross-organization report isolation**: Backend already enforces org scoping on all report queries via `req.user.orgId`. No additional work needed.

## Completion Decision

AH-2A.3 COMPLETE

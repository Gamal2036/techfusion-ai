# 03 — Web Product Surface Map

All pages under `apps/web/src/app` use `'use client'` hooks that call the gateway through `apps/web/src/lib/*-client.ts` (`apiFetch` = authenticated REST with refresh/retry) and subscribe to socket.io `/metrics` for live events. No page uses static mock datasets (`VERIFIED_THIS_RUN` — hook/page inspection). Polling: dashboard summary 15 s; devices 15 s (3 s fast, 10 s degraded when socket down); network 30 s; backups 5 s while active; session guard 30 s.

## 1. Route Table

| Route | Purpose | Data source | Key API | Auth/Org/RBAC | States | Status | Evidence |
|-------|---------|-------------|---------|---------------|--------|--------|----------|
| `/` | Landing/marketing page + hero3d | Static marketing (no API) | none | public | n/a | FUNCTIONAL (marketing) | `app/page.tsx`, `components/landing/hero3d` |
| `/login` | Sign in | real | `POST /auth/login`, `/auth/verify-login` (MFA TOTP **or** recovery code) | public | loading/error | FUNCTIONAL | `auth-client.ts`, tests `login-page.spec.tsx` (38, incl. recovery mode + Forgot Password link) |
| `/forgot-password` | Request password reset email | real | `POST /auth/forgot-password` (via `recovery-client.ts`) | public | loading/error/success | FUNCTIONAL | `forgot-password-page.spec.tsx` (26), `recovery-client.spec.ts` (11) |
| `/reset-password` | Set new password from reset link | real | `POST /auth/reset-password` (via `recovery-client.ts`) | public (token) | loading/ready/success/invalid_token/missing_token/error | FUNCTIONAL | `reset-password-page.spec.tsx` (35), `recovery-client.spec.ts` (11) |
| `/signup` | Register | real | `POST /auth/signup` | public | loading/error/validation | FUNCTIONAL | tests `signup-page.spec.tsx` |
| `/invite/[token]` | Accept org invitation | real | `GET/POST /invitations/:token` | public token | loading/error/success | FUNCTIONAL | `invite-page.spec.tsx` |
| `/dashboard` | Command center | real | `GET /dashboard/summary`, WS `/metrics` alerts, `GET /backups/runs` | session + `MONITORING_VIEW` | loading/error/empty/stale | FUNCTIONAL | `components/command-center/CommandCenterPage`, `useCommandCenterData` |
| `/dashboard/device-health` | Fleet health list | real | `GET /devices`, WS presence/metrics | session + devices view | loading/error/empty | FUNCTIONAL | `useDevices` |
| `/dashboard/device-health/[id]` | Device detail | real | `GET /devices/:id/latest`, `/devices/:id/metrics`, `/devices/:id/scores` | session + devices view | loading/error/empty | FUNCTIONAL | `useDevice`, tests `device-detail-page.spec.tsx` |
| `/dashboard/monitoring` | Monitoring + alert rules | real | alerts rules CRUD + alerts list, WS | session + `ALERTS_*`/`ALERT_RULES_MANAGE` | loading/error/empty | FUNCTIONAL | `useAlerts`, tests `monitoring-page.spec.tsx` |
| `/dashboard/network` | Network view + diagnostics | real | `GET /network/...`, WS network, diagnostics endpoints | session + `NETWORK_VIEW`/`NETWORK_SCAN_TRIGGER` | loading/error/empty | FUNCTIONAL | `useNetwork`, tests `useNetworkWebSocket.spec.ts` |
| `/dashboard/cybersecurity` | Security dashboard | real | `GET /security/...`, device list | session + security view | loading/error/empty | FUNCTIONAL | `useSecurity` |
| `/dashboard/remote-support` | Remote sessions + recordings | real | remote-support sessions/recordings CRUD, WS | session + `REMOTE_SUPPORT_*` | loading/error/empty | PARTIAL (agent auto-consents; no real control — see `05`) | `useRemoteSupport`, tests `useRemoteWebSocket.spec.ts` |
| `/dashboard/knowledge-base` | KB articles | real | `GET /kb/articles` | session + `SOFTWARE_VIEW/MANAGE` | loading/error/empty | FUNCTIONAL | `useKb` |
| `/dashboard/drivers` | Drivers/software inventory | real | `GET /inventory/drivers`, `/inventory/software`, refresh | session + `INVENTORY_VIEW`/`DEVICES_MANAGE` | loading/error/empty | FUNCTIONAL | `useInventory` |
| `/dashboard/backup` | Backup jobs/runs/restore | real | backups CRUD + runs + restore points | session + backups perms | loading/error/empty | FUNCTIONAL | `useBackups`, tests `ScheduledReportsSection.spec.tsx` (backup-adjacent) |
| `/dashboard/billing` | Plan + usage + history | real | billing plan/usage/history | session + `BILLING_VIEW` | loading/error/empty | PARTIAL (no self-serve upgrade UI beyond Stripe checkout redirect; usage shown) | `useBilling` |
| `/dashboard/ai-chat` | AI chat + troubleshooting | real | `POST /ai/troubleshoot` (SSE), `/ai/chat` | session + AI quota | loading/error/streaming | FUNCTIONAL | `useAiChat` |
| `/dashboard/reports` | Reports + schedules | real | reports generate/list/download, schedules CRUD | session + `REPORTS_*` | loading/error/empty | FUNCTIONAL | `useReports`, tests `useReportSchedules.spec.ts`, `report-schedule-status.spec.ts` |
| `/dashboard/settings` | Settings home | real | account/org mix | session | n/a | FUNCTIONAL | |
| `/dashboard/settings/account` | Profile + security + org + deletion | real | `account-client` (summary `GET/PATCH /auth/account/summary`, deletion preview/confirm), `security-client` (changePassword, listSessions, revokeSession, revokeOtherSessions, revokeCurrentSession), `mfa-client` (status/enroll/verify/disable/recovery-codes), `org-client` (`/organizations/current`), `auth-client` (session) | session | loading/error/retry per section | FUNCTIONAL | `account-page.spec.tsx` (27), `security-section.spec.tsx` (34), `password-sessions-ux.spec.tsx` (43) |
| `/dashboard/settings/organization` | Org settings + roles | real | org-client (update org, manage members/roles) | session + org perms | loading/error | FUNCTIONAL | `organization-switcher.spec.tsx`, `org-client.spec.ts` |
| `/dashboard/settings/enrollment` | Enrollment tokens + agent download | real | enrollment tokens CRUD, `GET /devices/enrollment-tokens`, agent-download | session + `DEVICES_ENROLL` | loading/error/empty | FUNCTIONAL | |
| `/dashboard/team` | Team/invitations/members | real | org-client invitations/members | session + org perms | loading/error/empty | FUNCTIONAL | tests `team-page.spec.tsx`, `invitations.spec.ts` |
| `/dashboard/design-system` | UI kit showcase | Static components | none | session | n/a | UI_ONLY (dev tool, not a product surface) | `app/dashboard/design-system/page.tsx` |

## 2. Product Surfaces Referenced in the Mission That Do NOT Have Pages

| Surface | Status |
|---------|--------|
| Audit Logs (viewer) | Backend exists (`audit.controller.ts`), no dedicated web page found (`INFERRED_FROM_CODE`) |
| Recordings/Viewer | Recordings exist in remote-support page + backend; no standalone recording player/viewer page (`PARTIAL`) |
| Alerts dedicated page | Handled inside `/dashboard/monitoring`; no separate Alerts page (`N/A`) |
| Notifications (in-app) | Live alerts feed on dashboard only; no notification center page (`MISSING`) |
| Admin console | Backend admin endpoints exist; no web admin page found (`MISSING`) |
| Software catalog page | Drivers page only; `SoftwareCatalogItem` global model exists server-side (`PARTIAL`) |
| Backup retention settings | `DataRetentionPolicy` server-side; no web settings surface found (`MISSING`) |
| SSO admin config | Backend `admin/sso/config` exists; no web UI (`MISSING`) |
| Enrollment UI | Only token list + agent download; no guided multi-step enrollment wizard page (`PARTIAL`; installer + `enroll-device.sh` handle enrollment) |

## 3. Client Contract Surface (`apps/web/src/lib`)

- `auth-client.ts` — `apiFetch` wrapper (JWT + refresh rotation + retry), login/signup/logout/session.
- `org-client.ts` — organizations CRUD/switch, members (update role/remove), invitations (create/list/revoke/resend/accept).
- `account-client.ts` — account summary (self-scoped `GET/PATCH /auth/account/summary`), deletion preview/confirm (`GET /auth/account/deletion-preview`, `DELETE /auth/account`).
- `security-client.ts` — password change (`POST /auth/change-password` with `setTokens()` for fresh pair), session list (`GET /auth/sessions`), revoke one/other/current (`DELETE /auth/sessions/:sessionId`, `DELETE /auth/sessions`, `DELETE /auth/sessions/current` with `clearTokens()` + redirect to `/login`).
- `recovery-client.ts` — password recovery API client: `requestPasswordReset(email)` → `POST /auth/forgot-password` (returns generic success for enumeration resistance); `resetPassword(token, newPassword)` → `POST /auth/reset-password` (returns success or typed `RecoveryError` with `kind: 'invalid_token' | 'rate_limited' | 'network' | 'server'`).
- `mfa-client.ts` — typed MFA + recovery client: `GET /mfa/status`, `POST /mfa/enroll`, `POST /mfa/verify`, `POST /mfa/disable`, `POST /mfa/recovery-codes/generate|regenerate`, `GET /mfa/recovery-codes/status`; recovery/TOTP normalization + validation helpers mirroring the backend alphabet (A-Z2-7, `XXXX-XXXX-XXXX-XXXX`). `mfa-errors.ts` maps errors to calm copy (backend text only for 400/401/403/404/409).
- `clipboard.ts` — `copyText` helper (silent degradation in non-secure contexts), used by the MFA dialogs and Profile Account-ID copy.
- `socket-client.ts` — socket.io `/metrics` subscription with connection-state fallback to polling.
- `permissions.ts` — frontend permission/role helpers.
- `device-presence.ts` / `device-presence-state.ts` — presence thresholds + derivation (mirrored with backend; tests enforce parity).
- `command-state.ts`, `report-schedule-status.ts`, `observability.ts` — domain helpers.

## 4. Hooks Inventory

`useSessionGuard` (30 s), `useDashboardSummary` (15 s poll, backoff), `useCommandCenterData` (composite: summary + WS alerts + conditional backup-runs poller), `useDevices` (list 15 s + detail + fast-polling), `useAlerts` (+ rules + WS), `useNetwork` (+ diagnostics + WS), `useSecurity` (conditional polling), `useRemoteSupport` (+ recordings + WS), `useKb`, `useInventory` (drivers/software/refresh), `useBackups`, `useBilling`, `useAiChat` (SSE), `useReports`, `useReportSchedules`, `useCurrentOrganization`, `useAccountSecurity` (sessions loading/error/ready), `useWebSocket`/`useSocketConnectionState`/`useNetworkWebSocket`/`useRemoteWebSocket`, `useFocusTrap`, `useReducedMotion`, `useMousePosition`.

## 5. Authentication / RBAC Model in Web

- `useSessionGuard` checks session at 30 s cadence; `auth-client` auto-refreshes with CAS rotation.
- Organization context via `useCurrentOrganization` + org switcher (post `POST /organizations/:id/switch`, refresh rebind).
- RBAC enforced server-side; web uses `lib/permissions.ts` for UI capability state only. UI hiding is NOT an authorization boundary (`09`).

## 6. Notable Findings

1. All product pages are genuinely API-wired — no mock pages discovered (`VERIFIED_THIS_RUN`).
2. Missing product surfaces: audit viewer, admin console, notification center, retention settings, SSO config UI, software catalog page, recording player.
3. `/dashboard/remote-support` is functional as a *session management* UI but the agent side is auto-consent + status only — no real remote desktop/control yet (`PARTIAL`, `05`).
4. `/dashboard/billing` shows plan/usage/history but no self-serve plan-change form beyond Stripe-hosted checkout/portal links (`PARTIAL`).

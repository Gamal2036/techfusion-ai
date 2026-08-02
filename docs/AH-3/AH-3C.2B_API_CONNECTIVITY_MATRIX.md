# AH-3C.2B — API Connectivity Matrix

**Project:** Tech Fusion AI
**Phase:** AH-3C.2B
**Date:** 2026-07-21

---

## API Endpoint → Frontend Consumer Map

| Method | Path | Controller | Frontend Consumer | Auth | Status |
|--------|------|-----------|-------------------|------|--------|
| GET | `/health` | HealthController | None (monitoring) | Public | READY |
| GET | `/health/live` | HealthController | None | Public | READY |
| GET | `/health/ready` | HealthController | None | Public | READY |
| GET | `/metrics` | MetricsController | None (Prometheus) | Public | READY |
| POST | `/auth/signup` | AuthController | Signup page | Public | READY |
| POST | `/auth/login` | AuthController | Login page | Public | READY |
| POST | `/auth/verify-login` | AuthController | Login page (MFA) | Public | READY |
| POST | `/auth/refresh` | AuthController | auth-client (auto) | Public | READY |
| POST | `/auth/logout` | AuthController | auth-client (logout) | JWT | READY |
| POST | `/mfa/enroll` | MfaController | None (no MFA UI) | JWT | NO_FRONTEND |
| POST | `/mfa/verify` | MfaController | Login page (indirect) | JWT | PARTIAL |
| GET | `/mfa/status` | MfaController | None (no MFA UI) | JWT | NO_FRONTEND |
| POST | `/auth/sso/login` | SsoController | None | Public | NO_FRONTEND |
| GET | `/admin/sso/config` | SsoController | None | JWT (Owner/Admin) | NO_FRONTEND |
| POST | `/admin/sso/config` | SsoController | None | JWT (Owner) | NO_FRONTEND |
| POST | `/admin/sso/disable` | SsoController | None | JWT (Owner) | NO_FRONTEND |
| POST | `/devices/register` | DevicesController | Agent only | DeviceToken | READY |
| POST | `/devices/register-public` | DevicesController | Agent only | Public | READY |
| POST | `/devices/recover-credential` | DevicesController | Agent only | Public | READY |
| POST | `/devices/metrics` | DevicesController | Agent only | DeviceToken | READY |
| GET | `/devices` | DevicesController | Dashboard, DeviceHealth, Monitoring, Cybersecurity | JWT | READY |
| GET | `/devices/:id` | DevicesController | None (use :id/latest) | JWT | READY |
| GET | `/devices/:id/metrics` | DevicesController | Device Detail | JWT | READY |
| GET | `/devices/:id/scores` | DevicesController | Device Health list | JWT | READY |
| GET | `/devices/:id/latest` | DevicesController | Device Detail, Monitoring | JWT | READY |
| GET | `/alerts/rules` | AlertsController | Monitoring | JWT | READY |
| POST | `/alerts/rules` | AlertsController | Monitoring | JWT (Admin/Owner) | READY |
| PATCH | `/alerts/rules/:id` | AlertsController | Monitoring | JWT (Admin/Owner) | READY |
| DELETE | `/alerts/rules/:id` | AlertsController | Monitoring | JWT (Admin/Owner) | READY |
| GET | `/alerts` | AlertsController | None (use /alerts/latest) | JWT | READY |
| GET | `/alerts/latest` | AlertsController | Dashboard, Monitoring | JWT | READY |
| PATCH | `/alerts/:id/acknowledge` | AlertsController | Monitoring | JWT | READY |
| GET | `/ai/providers/status` | AiRouterController | Settings | JWT (Owner/Admin) | READY |
| GET | `/ai/router/stats` | AiRouterController | Settings | JWT (Owner/Admin) | READY |
| PUT | `/ai/router/strategy` | AiRouterController | Settings | JWT (Owner/Admin) | READY |
| POST | `/ai/troubleshoot` | TroubleshootingController | AI Chat | JWT | CONFIG_REQUIRED |
| POST | `/devices/security-report` | SecurityController | Agent only | Public | READY |
| POST | `/security/scans/:deviceId/trigger` | SecurityController | Cybersecurity | JWT | READY |
| GET | `/security/latest/:deviceId` | SecurityController | Cybersecurity | JWT | READY |
| GET | `/security/scans/:deviceId` | SecurityController | Cybersecurity | JWT | READY |
| GET | `/security/scans/detail/:scanId` | SecurityController | Cybersecurity | JWT | READY |
| POST | `/security/findings/:findingId/remediate` | SecurityController | Cybersecurity | JWT | READY |
| GET | `/security/executive-summary/:deviceId` | SecurityController | Cybersecurity | JWT | READY |
| GET | `/security/export-pdf/:deviceId` | SecurityController | Cybersecurity | JWT | PARTIAL (no auth) |
| POST | `/remote-support/sessions` | RemoteSupportController | Remote Support | JWT | READY |
| GET | `/remote-support/sessions` | RemoteSupportController | Remote Support | JWT | READY |
| GET | `/remote-support/sessions/:id` | RemoteSupportController | Remote Support | JWT | READY |
| POST | `/remote-support/sessions/:id/end` | RemoteSupportController | Remote Support | JWT | READY |
| GET | `/remote-support/recordings` | RemoteSupportController | Remote Support | JWT | READY |
| GET | `/remote-support/recordings/:sessionId` | RemoteSupportController | Remote Support | JWT | READY |
| GET | `/remote-support/audit-logs` | RemoteSupportController | Remote Support | JWT | READY |
| POST | `/remote-support/audit-logs` | RemoteSupportController | None | JWT | NO_FRONTEND |
| POST | `/remote-support/recordings/:sessionId` | RemoteSupportController | None | JWT | NO_FRONTEND |
| POST | `/remote-support/recordings/:sessionId/frames` | RemoteSupportController | Agent only | Public | READY |
| GET | `/remote-support/agent/pending` | RemoteSupportController | Agent only | Public | READY |
| POST | `/remote-support/consent` | RemoteSupportController | Agent only | Public | READY |
| POST | `/remote-support/agent/status` | RemoteSupportController | Agent only | Public | READY |
| POST | `/network/discovery` | NetworkController | Agent only | Public | DEAD_CODE |
| GET | `/network/devices` | NetworkController | Network | JWT | READY |
| GET | `/network/devices/:ip` | NetworkController | None (inline) | JWT | READY |
| GET | `/network/scans` | NetworkController | Network | JWT | READY |
| GET | `/network/scans/latest` | NetworkController | None | JWT | READY |
| GET | `/network/topology` | NetworkController | Network | JWT | READY |
| POST | `/network/diagnostics/latency` | NetworkController | Network | JWT | READY |
| POST | `/network/diagnostics/dns` | NetworkController | Network | JWT | READY |
| POST | `/network/diagnostics/traceroute` | NetworkController | Network | JWT | READY |
| POST | `/network/diagnostics/connectivity` | NetworkController | Network | JWT | READY |
| POST | `/inventory/report` | InventoryController | Agent only | Public | READY |
| GET | `/inventory/drivers` | InventoryController | Drivers | JWT | READY |
| GET | `/inventory/software` | InventoryController | Drivers | JWT | READY |
| GET | `/inventory/catalog` | InventoryController | None | JWT | NO_FRONTEND |
| POST | `/reports/generate` | ReportingController | Reports | JWT (Admin/Owner) | PARTIAL (stub) |
| GET | `/reports` | ReportingController | Reports | JWT | READY |
| GET | `/reports/download/:id/:format` | ReportingController | Reports | JWT | PARTIAL (404) |
| GET | `/reports/branding` | ReportingController | None | JWT | NO_FRONTEND |
| POST | `/reports/branding` | ReportingController | None | JWT (Admin/Owner) | NO_FRONTEND |
| GET | `/reports/schedules` | ReportingController | None | JWT | NO_FRONTEND |
| POST | `/reports/schedules` | ReportingController | None | JWT (Admin/Owner) | NO_FRONTEND |
| DELETE | `/reports/schedules/:id` | ReportingController | None | JWT (Admin/Owner) | NO_FRONTEND |
| POST | `/billing/checkout` | BillingController | Billing | JWT (Owner) | READY |
| POST | `/billing/portal` | BillingController | Billing | JWT (Owner) | READY |
| GET | `/billing/plan` | BillingController | Billing | JWT | READY |
| GET | `/billing/usage` | BillingController | None (use /plan) | JWT | NO_FRONTEND |
| GET | `/billing/history` | BillingController | Billing | JWT (Owner) | READY |
| GET | `/billing/admin` | BillingController | None | JWT (Owner) | NO_FRONTEND |
| POST | `/billing/webhook` | BillingController | None (Stripe) | Public | READY |
| POST | `/backups/jobs` | BackupsController | Backup | JWT | READY |
| GET | `/backups/jobs` | BackupsController | Backup | JWT | READY |
| GET | `/backups/jobs/:id` | BackupsController | Backup | JWT | READY |
| PATCH | `/backups/jobs/:id` | BackupsController | Backup | JWT | READY |
| DELETE | `/backups/jobs/:id` | BackupsController | Backup | JWT | READY |
| POST | `/backups/jobs/:id/trigger` | BackupsController | Backup | JWT | READY |
| GET | `/backups/runs` | BackupsController | Backup | JWT | READY |
| GET | `/backups/runs/:id` | BackupsController | Backup | JWT | READY |
| GET | `/backups/restore-points/:deviceId` | BackupsController | Backup (wizard) | JWT | READY |
| POST | `/backups/runs/:id/restore` | BackupsController | Backup | JWT | PARTIAL |
| POST | `/kb/articles` | KbController | Knowledge Base | JWT | READY |
| GET | `/kb/articles` | KbController | Knowledge Base | JWT | READY |
| GET | `/kb/articles/:id` | KbController | Knowledge Base | JWT | READY |
| PUT | `/kb/articles/:id` | KbController | Knowledge Base | JWT | READY |
| DELETE | `/kb/articles/:id` | KbController | Knowledge Base | JWT | READY |
| POST | `/kb/query` | KbController | None (unused) | JWT | NO_FRONTEND |
| GET | `/audit/logs` | AuditController | None | JWT (Owner/Admin) | NO_FRONTEND |
| GET | `/audit/export/csv` | AuditController | None | JWT (Owner/Admin) | NO_FRONTEND |
| GET | `/audit/export/json` | AuditController | None | JWT (Owner/Admin) | NO_FRONTEND |
| POST | `/admin/encryption/verify` | EncryptionController | None | JWT (Owner) | NO_FRONTEND |
| GET | `/admin/retention` | RetentionController | None | JWT (Owner/Admin) | NO_FRONTEND |
| POST | `/admin/retention` | RetentionController | None | JWT (Owner/Admin) | NO_FRONTEND |
| POST | `/admin/retention/enforce` | RetentionController | None | JWT (Owner/Admin) | NO_FRONTEND |
| POST | `/admin/retention/enforce-all` | RetentionController | None | JWT (Owner) | NO_FRONTEND |
| GET | `/admin/dashboard` | AdminController | Dashboard | JWT (Owner/Admin) | READY |
| GET | `/admin/org` | AdminController | None | JWT (Owner/Admin) | NO_FRONTEND |
| GET | `/admin/users` | AdminController | Team | JWT (Owner/Admin) | READY |
| GET | `/admin/users/:userId` | AdminController | None | JWT (Owner/Admin) | NO_FRONTEND |
| POST | `/admin/users/:userId/role` | AdminController | Team | JWT (Owner) | READY |
| POST | `/admin/users/:userId/remove` | AdminController | Team | JWT (Owner) | READY |
| POST | `/enrollment/tokens` | EnrollmentController | None | JWT (Owner/Admin) | NO_FRONTEND |
| GET | `/enrollment/tokens` | EnrollmentController | None | JWT (Owner/Admin) | NO_FRONTEND |
| DELETE | `/enrollment/tokens/:id` | EnrollmentController | None | JWT (Owner/Admin) | NO_FRONTEND |

---

## Summary

| Status | Count |
|--------|-------|
| READY | 63 |
| PARTIAL | 4 |
| CONFIG_REQUIRED | 1 |
| DEAD_CODE | 1 |
| NO_FRONTEND | 22 |
| **Total** | **91** |

### Endpoints With Frontend Consumers: 69
### Endpoints Without Frontend: 22 (backend-only features)

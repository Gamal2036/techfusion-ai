# 04 — Backend Capability Map

Status: 2026-08-16. All ratings `VERIFIED_THIS_RUN` (source read) unless noted. Readiness scale: CERTIFIED / FUNCTIONAL / PARTIAL / SCAFFOLD / MOCKED / BROKEN / MISSING.

## 1. Guard & Cross-Cutting Stack (`src/common`, `src/config`)

- Guard order: `ThrottlerGuard` → `CombinedAuthGuard` (JWT → membership-authoritative) → `PermissionsGuard` (≈40 `domain:action` keys) → `PlanGuard`/`RequireFeature`.
- `Public()` decorator exempts routes; `DeviceTokenGuard` authenticates agents (SHA-256 vs `deviceTokenHash`, legacy plaintext fallback).
- Rate limits (`src/config/rate-limits.ts`): signup 3/300 s, login 5/60 s, verify-login 10/60 s, refresh 5/60 s, MFA enroll/verify/disable/recovery-codes-generate/recovery-codes-regenerate 5/60 s, forgot-password 3/300 s (fingerprint-throttled by email hash), reset-password 5/300 s (fingerprint-throttled by token hash), metrics 120/60 s, security-report 20/60 s, inventory-report 20/60 s, discovery 10+30+30/60 s, register-public 10/60 s, recover-credential 5/60 s.
- Env validation (`src/config/env.validation.ts`): rejects placeholders, requires ≥32-char secrets in prod, `requireSecret` for JWT_SECRET/REFRESH in all envs, AI_ENCRYPTION_KEY/REPORT_URL_SECRET in prod.

## 2. Domain Matrix

| Domain | Endpoints exist | Service | DB models | Authorization | Org isolation | Validation | Tests | Web consumer | Production readiness |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Auth (signup/login/logout/refresh) | ✅ | ✅ | User, RefreshToken, OrganizationMember, PasswordResetToken | JWT, membership gate, throttles | ✅ | DTOs | ✅ `auth.spec.ts`, `session-refresh.spec.ts`, `slug-collision.spec.ts`, `refresh-token-hardening.spec.ts` (20 proofs), `password-session-management.spec.ts` (30 proofs), `password-reset.spec.ts` (37 proofs) | ✅ login/signup | CERTIFIED | `ACC-SEC-02D2A`: SHA-256 verifiers with legacy-plaintext atomic upgrade; stable `sessionId` + `sid` claim + server-observed metadata; `ACC-SEC-02D2B`: password change (`POST /auth/change-password` — reauth + revocation + reissue), session list + revoke one/other/current, strict throttling, structured audit events; `ACC-SEC-02E2B`: password reset lifecycle (`POST /auth/forgot-password` + `POST /auth/reset-password`, SHA-256 token verifiers, 15-min expiry, single-use, email queue integration, session revocation) |
| MFA (TOTP) | ✅ | ✅ | User.mfa* | JWT | ✅ | ✅ | `auth.spec.ts`, `mfa-security.spec.ts` (24 tests), `mfa-recovery.spec.ts` (22 tests) | ✅ settings/account | CERTIFIED |
| SSO | ✅ | ✅ | SsoConfig, User.sso* | `RequireFeature('sso')` for config; **login route is Public** | ✅ (slug→org) | ❌ none on login body | ❌ none | ❌ no UI | **CRITICAL FLAW** (see `07`) |
| Account deletion | ✅ | ✅ | User, RefreshToken, org, invitations | JWT, `DELETE` confirm, SOLE_OWNER guard | ✅ | ✅ | ✅ `account-deletion.spec.ts` | ✅ settings/account | CERTIFIED |
| Account profile (self-scoped) | ✅ | ✅ | User (safe fields only) | JWT, membership-authoritative; forged body `userId` ignored | ✅ (self only) | ✅ | ✅ `account-summary.spec.ts` | ✅ settings/account | FUNCTIONAL |
| Organizations | ✅ | ✅ | Organization, OrganizationMember | JWT + perms + role rules | ✅ | ✅ | ✅ `organizations.spec.ts`, `organization-lifecycle.spec.ts` | ✅ | CERTIFIED |
| Memberships/roles | ✅ | ✅ | OrganizationMember | role rules (Owner/Admin/Technician/Viewer) | ✅ | ✅ | ✅ `membership-authoritative.spec.ts`, `rbac-permissions.spec.ts` | ✅ team | CERTIFIED |
| Invitations | ✅ | ✅ | OrganizationInvitation | role allowlist, token hash | ✅ | ✅ | ✅ `invitations.spec.ts` | ✅ team/invite | CERTIFIED |
| Devices (CRUD/view) | ✅ | ✅ | Device | `DEVICES_VIEW`/`DEVICES_MANAGE` | ✅ (org-scoped) | ✅ | ✅ | ✅ device-health | CERTIFIED |
| Device metrics ingest | ✅ | ✅ | DeviceMetric, DeviceHealthScore, Device | DeviceTokenGuard + throttles | ✅ (token→org) | ✅ | ✅ `presence-telemetry.spec.ts` | ✅ (WS live) | CERTIFIED |
| Enrollment | ✅ | ✅ | EnrollmentToken, CredentialRotationEvent | enrollment token (hashed, single-use) | ✅ | ✅ | ✅ | ✅ settings/enrollment | CERTIFIED |
| Monitoring/presence | ✅ (via worker) | ✅ | Device.lastSeenAt, Alert | internal | ✅ | ✅ | ✅ `monitoring-*` worker specs, `presence-telemetry.spec.ts` | ✅ | CERTIFIED |
| Alerts | ✅ | ✅ | AlertRule, Alert | `ALERTS_VIEW`, `ALERTS_ACKNOWLEDGE/RESOLVE`, `ALERT_RULES_MANAGE` | ✅ | ✅ | ✅ | ✅ monitoring | CERTIFIED |
| Network | ✅ | ✅ | NetworkDevice, NetworkScan | `NETWORK_VIEW`, `NETWORK_SCAN_TRIGGER`; ingest via DeviceTokenGuard + X-Org-Id | ✅ (token/org + body org checks) | ✅ | ✅ | ✅ network | CERTIFIED |
| Remote support | ✅ | ✅ | RemoteSession (+recordings) | `REMOTE_SUPPORT_*`; device endpoints via token+deviceId | ✅ | ✅ | ✅ | ✅ remote-support | PARTIAL (agent side = auto-consent stub; no real control) |
| Inventory | ✅ | ✅ | SoftwareInventory, Driver, + global catalogs | `INVENTORY_VIEW`, `DEVICES_MANAGE`; ingest via token | ✅ | ✅ | ✅ | ✅ drivers | CERTIFIED |
| Security | ✅ | ✅ | SecurityScan/Finding/Score | `SECURITY_*`; scan ingest via token | ✅ | ✅ | ✅ `security.spec.ts` | ✅ cybersecurity | CERTIFIED |
| Knowledge Base | ✅ | ✅ | KbArticle, KbEmbedding | `SOFTWARE_VIEW/MANAGE` | ✅ | ✅ | ✅ | ✅ knowledge-base | FUNCTIONAL (embeddings pipeline produces mock vectors — `06`) |
| Audit logs | ✅ | ✅ | AuditLog (immutable) | `AUDIT_VIEW` | ✅ | ✅ | ✅ | ❌ no page | FUNCTIONAL |
| Billing | ✅ | ✅ | Subscription, Invoice, Organization.plan | `BILLING_VIEW/MANAGE`; webhook public (Stripe sig) | ✅ | ✅ | ✅ `billing.integration` (in lifecycle suite) | ✅ billing | FUNCTIONAL → CERTIFY after entitlement gap closure (`09`) |
| Admin | ✅ | ✅ | User/org + Device | admin guard/role + `SupportAdminGuard` (hash-only internal boundary for device recovery) | ✅ | ✅ | ✅ `device-revocation-recovery.spec.ts` | ❌ no page | FUNCTIONAL |
| AI (chat/troubleshoot/embed) | ✅ | ✅ | AiProviderConfig, AiUsageLog, AiConversation/Message | JWT + org settings + AI quota | ✅ | ✅ | ✅ | ✅ ai-chat | FUNCTIONAL (embed endpoint missing — `06`) |
| Reporting | ✅ | ✅ | Report/Template/Schedule | `REPORTS_*`, `RequireFeature('customBranding')`; download HMAC-signed public | ✅ | ✅ | ✅ | ✅ reports | CERTIFIED (report queue dead — `06`) |
| Retention | ✅ | ✅ | DataRetentionPolicy | `retention_*` perms | ✅ | ✅ | partial | ❌ no UI | FUNCTIONAL |
| Backups | ✅ | ✅ | BackupJob, BackupRun | `BACKUPS_*` | ✅ | ✅ | ✅ | ✅ backup | FUNCTIONAL |
| Encryption | ✅ | ✅ | — | JWT | n/a | ✅ | ✅ | ❌ | FUNCTIONAL (AES-256-GCM envelope for provider keys) |
| Dashboard summary | ✅ | ✅ | (aggregate) | `MONITORING_VIEW` | ✅ | ✅ | ✅ | ✅ dashboard | CERTIFIED |
| Health/metrics | ✅ | ✅ | — | public live/ready; metrics token (optional) | n/a | n/a | ✅ | — | CERTIFIED (token-in-query LOW finding `07`) |
| Transactional email | ❌ | ✅ | — | — | — | provider abstraction, templates, queue, processor | 67+ tests | — | INFRASTRUCTURE (disabled-by-default; `ACC-SEC-02E2A`; manual SMTP cert PENDING) |
| Demo (RBAC demo) | ✅ | — | — | — | — | — | ❌ | ❌ | SCAFFOLD / dead (`10`) |

## 3. Endpoint Inventory (representative; full route set in source)

- **Auth**: `POST /auth/signup|login|verify-login|refresh|logout|change-password|forgot-password|reset-password`; `GET /auth/sessions`; `DELETE /auth/sessions|current|:sessionId`; `POST /mfa/enroll|verify`, `GET /mfa/status`; `POST /auth/sso/login` (Public).
- **Account**: `GET|PATCH /auth/account/summary` (self-scoped safe profile), `GET /auth/account/deletion-preview`, `DELETE /auth/account`.
- **Orgs**: `GET|POST /organizations`; `GET|PATCH /organizations/:id`; `POST /organizations/:id/switch`; `GET /organizations/:id/members`; `PATCH|DELETE /organizations/:id/members/:userId`; `POST /organizations/:id/leave`; `POST|GET /organizations/:orgId/invitations`; `PATCH|DELETE|POST /organizations/:orgId/invitations/:id(/:resend)`; `GET|POST /invitations/:token`.
- **Devices**: `POST /devices/register-public` (Public, enrollment token); `POST /devices/recover-credential` (Public, X-Org-Token); `POST /devices/metrics` (device token); `GET /devices`, `GET /devices/:id/latest|metrics|scores`.
- **Enrollment**: `GET|POST /devices/enrollment-tokens`; `PATCH|DELETE /devices/enrollment-tokens/:id`; `GET /devices/enrollment-tokens/:id/audit`.
- **Alerts**: `GET|POST /alerts/rules`; `PATCH|DELETE /alerts/rules/:id`; `GET /alerts`, `GET /alerts/latest`; `PATCH /alerts/:id/acknowledge|resolve`; WS `alerts` events on `/metrics`.
- **Network**: `POST /network/discovery/trigger`; `GET /network/discovery/pending|status|result`; `POST /network/discovery/status|result` (device token); `GET /network/devices/:ip/scans/latest|topology`; `POST /network/diagnostics/:latency|dns|traceroute|connectivity`.
- **Inventory**: `POST /inventory/report` (device token + X-Org-Id); `GET /inventory/drivers|software|catalog`; `POST /inventory/refresh`; `GET|POST /inventory/pending/:deviceId(/:clear)`.
- **Security**: `POST /security/trigger`; `GET /security/pending/:deviceId`; `POST /security/scan-result`; `POST /devices/security-report` (body token); `GET /security/scans|scans/:id|executive-summary`; `POST /security/findings/:id/remediate`.
- **KB**: `GET|POST /kb/articles`; `PATCH|DELETE /kb/articles/:id`; `POST /kb/articles/:id/reindex`; `GET /kb/search`; `POST /kb/query`.
- **Billing**: `POST /billing/checkout|portal`; `GET /billing/plan|usage|history`; `POST /billing/webhook` (Public, Stripe sig).
- **AI**: `POST /ai/chat`; `POST /ai/troubleshoot` (SSE); `GET /ai/providers/status`; `GET /ai/router/stats`; `PUT /ai/router/strategy`.
- **Ops**: audit, retention, backups, reports, remote-support, admin, health, metrics, encryption verify.

## 4. Notable Backend Findings

1. **SSO login = CRITICAL auth bypass** (`07`).
2. **`maxTeamMembers` / `maxAlertRules` defined but never enforced** (grep: no call sites outside `plan-features.ts`). `maxDevices`, `maxReportsPerMonth`, `maxAiQueriesPerMonth`, and feature gates (`sso`, `customBranding`, `remoteSupport`) ARE enforced server-side (`09`).
3. **`demo.controller.ts`** = dead RBAC demo (SCAFFOLD). **`RolesGuard`/`@Roles`** = dead legacy guard (zero usages).
4. **Report generation path**: gateway `POST /reports/generate` works synchronously; the `REPORT` queue has **no producer** and the worker's `processReportJob` delegates to a non-existent `POST /reports` route (`06`).
5. **KB embeddings**: worker calls `POST /ai/embed` which does not exist; silently falls back to deterministic mock vectors (`06`).
6. **Metrics token accepted in query string**; Prometheus endpoint optional-auth (LOW).
7. **Plaintext `Device.deviceToken` retained** alongside hash; legacy equality fallback in `findByToken`/guard (MEDIUM).
8. **RLS inert** — app-layer isolation only (MEDIUM, `07`).
9. **MFA secrets were stored as plaintext base32 — FIXED `ACC-SEC-02B1`**: now encrypted at rest (`enc:v1:` envelope, key `MASTER_KEY || AI_ENCRYPTION_KEY`); legacy plaintext rows readable + upgraded only after successful possession-proven verification; decryption fails closed; enroll/verify throttled 5/60 s (was: an unused `STRICT_RATE_LIMITS.mfa` constant); lifecycle deterministic (409 enroll/verify while enabled, 400 not-enrolled, pending re-enrollment allowed); events `mfa_enrollment_started`/`mfa_enabled`/`mfa_verification_failed`; 24-test suite (`10` T27, `14` D28).
10. **Refresh tokens were stored as plaintext — FIXED `ACC-SEC-02D2A`**: only a SHA-256 verifier (`rt:v1:<sha256-hex>`, via `src/auth/refresh-token.util.ts`) is persisted; the raw 96-hex token returns exactly once and never lands at rest. Refresh resolves by verifier first; a single exact raw-token lookup is the controlled legacy-plaintext compatibility path that atomically upgrades the row to verifier-only storage inside the same CAS rotation (`updateMany {id, revokedAt:null} → {revokedAt, token:verifier}`). CAS rotation, membership binding, tenant isolation, logout unchanged. New: stable `RefreshToken.sessionId` (server UUID, non-secret, deliberately not unique — one per rotation chain) + additive non-authoritative `sid` access-JWT claim + server-observed metadata (`lastUsedAt`/`ipAddress`/`userAgent`; `deviceName` reserved; IP from `x-forwarded-for` first entry ≤45 chars else direct peer; no trust-all-proxy, Railway/proxy spoofing residual T31). Additive migration `20260816210000_refresh_session_identity` (backfill + indexes, scratch-DB validated). 20-proof suite `test/refresh-token-hardening.spec.ts` (failing-then-passing) (`10` T29/T30, `14` D31).
10. **MFA had no recovery/disable path — FIXED `ACC-SEC-02B2`**: operation-scoped re-authentication (`src/reauthentication/reauthentication.service.ts`, bcrypt vs `passwordHash`, identity from verified JWT only, deterministic 401 `'Current password is incorrect'`, no enumeration, event `reauthentication_failed`); recovery codes stored **hashed only** (`User.mfaBackupCodes` TEXT = JSON array of SHA-256, prefix `techfusion:mfa-recovery:v1:`, 10 × 16-char base32 grouped `XXXX-XXXX-XXXX-XXXX`, plaintext returned exactly once, `GET /mfa/recovery-codes/status` = `{generated, availableCount}` only); single-use enforced by atomic `SELECT … FOR UPDATE` consumption; `POST /mfa/disable` (throttled 5/60 s) requires password + valid TOTP or unused recovery code; `POST /auth/verify-login` accepts `recoveryCode` (mints tokens only after in-transaction consumption, rollback on failure); no schema change; 22-test suite (`14` D29).
11. **Password change and session management — FIXED `ACC-SEC-02D2B`**: `POST /auth/change-password` (authenticated, `ChangePasswordDto` validated, reauthentication via `ReauthenticationService.verifyPassword`, same-password rejection, bcrypt cost 10, atomic revocation of ALL active refresh tokens + `passwordHash` update in `$transaction`, fresh token pair issued, structured event `password_changed` + `AuditLog`); `GET /auth/sessions` (deduplicates `RefreshToken` rows by `sessionId`, returns safe metadata only — `sessionId`, `createdAt`, `expiresAt`, `lastUsedAt`, `ipAddress`, `userAgent`, `deviceName`, `current`; no token material); `DELETE /auth/sessions/:sessionId` (CAS `updateMany {userId, sessionId, revokedAt: null}`, 404 if not found, idempotent, structured event `session_revoked` + `AuditLog`); `DELETE /auth/sessions` (revoke other sessions, returns `revokedCount`); `DELETE /auth/sessions/current` (revoke current, event `session_revoked_current`). Strict throttling: `changePassword` 20/60 s, `sessions` 30/60 s, `sessionMutation` 10/60 s (none test-neutered); `/auth/logout` now also throttled 10/60 s. Pre-stage token handling: `sid` absent → `listSessions` marks all `current: false` (honest), revoke-other/revoke-current reject 400 (fail-closed). `AuthModule` imports `ReauthenticationModule` + `AuditModule`. 30-proof test suite (`14` D33).

# AH-3C.2B — Action Functionality Matrix

**Project:** Tech Fusion AI
**Phase:** AH-3C.2B
**Date:** 2026-07-21

---

## Login & Signup Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Signup | Create account | `handleSubmit` | `POST /auth/signup` | Yes | Yes (DB) | Redirects to /dashboard |
| Login | Login | `handleSubmit` | `POST /auth/login` | Yes | Yes (tokens) | Supports MFA flow |
| Login | Verify MFA | `handleSubmit` | `POST /auth/verify-login` | Yes | Yes (tokens) | 6-digit TOTP |
| Any | Logout | `logout()` | `POST /auth/logout` | Yes | Clears tokens | Disconnects sockets |

## Dashboard Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Dashboard | View stats | On mount | `GET /devices`, `GET /alerts/latest`, `GET /admin/dashboard` | Yes | Read-only | Real data |
| Dashboard | Click Quick Action | **No handler** | — | No | — | Decorative buttons |
| Dashboard | Click onboarding download | `href` | Placeholder URL | No | — | Fake links |

## Device Health Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Device Health | View device list | On mount | `GET /devices` | Yes | Read-only | 15s polling |
| Device Health | View device scores | Per device | `GET /devices/:id/scores` | Yes | Read-only | N+1 pattern |
| Device Health | Click device | Navigation | `/dashboard/device-health/[id]` | Yes | — | Client-side nav |
| Device Detail | View metrics chart | On mount | `GET /devices/:id/metrics` | Yes | Read-only | Historical data |
| Device Detail | Live metrics | WebSocket | `/metrics` namespace | Yes | — | Real-time updates |

## Monitoring Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Monitoring | View devices | On mount | `GET /devices` | Yes | Read-only | Live via WS |
| Monitoring | View alerts | On mount | `GET /alerts/latest` | Yes | Read-only | |
| Monitoring | View rules | Tab switch | `GET /alerts/rules` | Yes | Read-only | |
| Monitoring | Create rule | Dialog submit | `POST /alerts/rules` | Yes | Yes (DB) | Admin/Owner only |
| Monitoring | Edit rule | Dialog submit | `PATCH /alerts/rules/:id` | Yes | Yes (DB) | |
| Monitoring | Delete rule | Confirm dialog | `DELETE /alerts/rules/:id` | Yes | Yes (DB) | |
| Monitoring | Acknowledge alert | Button click | `PATCH /alerts/:id/acknowledge` | Yes | Yes (DB) | |

## Cybersecurity Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Cybersecurity | Select device | Dropdown | — | Yes | — | Filters views |
| Cybersecurity | View security score | On mount | `GET /security/latest/:deviceId` | Yes | Read-only | |
| Cybersecurity | View findings | On mount | `GET /security/latest/:deviceId` | Yes | Read-only | |
| Cybersecurity | View executive summary | Tab | `GET /security/executive-summary/:deviceId` | Yes | Read-only | |
| Cybersecurity | Trigger scan | Button click | `POST /security/scans/:deviceId/trigger` | Yes | Yes (DB) | |
| Cybersecurity | Remediate finding | Button click | `POST /security/findings/:id/remediate` | Yes | Yes (DB) | |
| Cybersecurity | Export PDF | Button click | `window.open(export-url)` | **No** | — | Missing auth header |

## Network Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Network | View topology | On mount | `GET /network/topology` | Yes | Read-only | 30s polling + WS |
| Network | View devices | Tab | `GET /network/devices` | Yes | Read-only | 30s polling |
| Network | View scan history | Tab | `GET /network/scans` | Yes | Read-only | |
| Network | Run latency check | Form submit | `POST /network/diagnostics/latency` | Yes | Read-only | |
| Network | Run DNS resolution | Form submit | `POST /network/diagnostics/dns` | Yes | Read-only | |
| Network | Run traceroute | Form submit | `POST /network/diagnostics/traceroute` | Yes | Read-only | |
| Network | Run connectivity check | Button click | `POST /network/diagnostics/connectivity` | Yes | Read-only | |

## Remote Support Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Remote Support | View sessions | On mount | `GET /remote-support/sessions` | Yes | Read-only | |
| Remote Support | Create session | Button click | `POST /remote-support/sessions` | Yes | Yes (DB) | |
| Remote Support | End session | Button click | `POST /remote-support/sessions/:id/end` | Yes | Yes (DB) | |
| Remote Support | View screen | WebSocket | `/remote` namespace | Yes | — | Live frames |
| Remote Support | Mouse control | Button click | **No handler** | No | — | Decorative |
| Remote Support | Keyboard control | Button click | **No handler** | No | — | Decorative |
| Remote Support | View recordings | Tab | `GET /remote-support/recordings` | Yes | Read-only | |
| Remote Support | Play recording | Button click | **No handler** | No | — | Not implemented |
| Remote Support | View audit logs | Tab | `GET /remote-support/audit-logs` | Yes | Read-only | |

## Drivers Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Drivers | View drivers | On mount | `GET /inventory/drivers` | Yes | Read-only | |
| Drivers | View software | Tab | `GET /inventory/software` | Yes | Read-only | |
| Drivers | Search/filter | Input | Client-side filter | Yes | — | |

## Backup Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Backup | View jobs | On mount | `GET /backups/jobs` | Yes | Read-only | |
| Backup | View runs | Tab | `GET /backups/runs` | Yes | Read-only | |
| Backup | Create job | Form submit | `POST /backups/jobs` | Yes | Yes (DB) | |
| Backup | Trigger job | Button click | `POST /backups/jobs/:id/trigger` | Yes | Yes (DB) | |
| Backup | Delete job | Confirm | `DELETE /backups/jobs/:id` | Yes | Yes (DB) | |
| Backup | Start recovery | Wizard | `GET /backups/restore-points/:deviceId` | Yes | Read-only | |
| Backup | Execute restore | Wizard step | `POST /backups/runs/:id/restore` | **Partial** | Yes | Fake progress bar |

## AI Chat Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| AI Chat | Send message | `sendMessage` | `POST /ai/troubleshoot` (SSE) | **No** | No | No provider configured |
| AI Chat | Cancel stream | `cancelStream` | AbortController | Yes | — | |
| AI Chat | Clear chat | `clearChat` | Client-side | Yes | — | |
| AI Chat | Select device | Dropdown | `GET /devices` | Yes | — | |

## Knowledge Base Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| KB | View articles | On mount | `GET /kb/articles` | Yes | Read-only | |
| KB | Create article | Form submit | `POST /kb/articles` | Yes | Yes (DB) | |
| KB | Edit article | Form submit | `PUT /kb/articles/:id` | Yes | Yes (DB) | |
| KB | Delete article | Confirm | `DELETE /kb/articles/:id` | Yes | Yes (DB) | |
| KB | Search articles | Input | Client-side filter | Yes | — | |
| KB | Semantic search | **Hook exists, not wired** | `POST /kb/query` | No | — | useKbQuery unused |

## Reports Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Reports | View reports | On mount | `GET /reports` | Yes | Read-only | |
| Reports | Generate report | Form submit | `POST /reports/generate` | **Partial** | Yes (record) | Worker stub, no file |
| Reports | Download report | Link click | `GET /reports/download/:id/:format` | **No** | — | 404 (no file) |

## Billing Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Billing | View plan | On mount | `GET /billing/plan` | Yes | Read-only | |
| Billing | View usage | On mount | `GET /billing/plan` | Yes | Read-only | |
| Billing | View history | On mount | `GET /billing/history` | Yes | Read-only | |
| Billing | Upgrade plan | Button click | `POST /billing/checkout` | **Partial** | — | Placeholder price IDs |
| Billing | Manage billing | Button click | `POST /billing/portal` | **Partial** | — | Needs real Stripe |

## Team Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Team | View members | On mount | `GET /admin/users` | Yes | Read-only | |
| Team | Change role | Dropdown | `POST /admin/users/:id/role` | Yes | Yes (DB) | Owner only |
| Team | Remove member | Confirm | `POST /admin/users/:id/remove` | Yes | Yes (DB) | Owner only |
| Team | Invite member | **No handler** | — | No | — | Not implemented |

## Settings Actions

| Page | Action | Handler | API Endpoint | Working | Persistence | Notes |
|------|--------|---------|-------------|---------|-------------|-------|
| Settings | View AI providers | On mount (60s poll) | `GET /ai/providers/status` | Yes | Read-only | |
| Settings | View router stats | On mount | `GET /ai/router/stats` | Yes | Read-only | |
| Settings | Change strategy | Dropdown | `PUT /ai/router/strategy` | Yes | Yes (config) | |

---

## Action Summary

| Status | Count | Percentage |
|--------|-------|------------|
| Working | 56 | 78.9% |
| Partial | 4 | 5.6% |
| Not Working | 11 | 15.5% |
| **Total** | **71** | |

### Non-Functional Actions
1. Dashboard Quick Actions (decorative)
2. Dashboard onboarding download links
3. Cybersecurity PDF export (no auth)
4. Remote Support mouse/keyboard control
5. Remote Support recording playback
6. AI Chat send message (no provider)
7. KB semantic search (not wired)
8. Reports generate (worker stub)
9. Reports download (404)
10. Billing upgrade (placeholder IDs)
11. Team invite (not implemented)

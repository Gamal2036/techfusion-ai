# 08 — Feature Readiness Matrix

Master matrix. Statuses: CERTIFIED / FUNCTIONAL / PARTIAL / SCAFFOLD / MOCKED / BROKEN / MISSING / NOT_APPLICABLE / UNKNOWN / DISABLED_SAFE. `CERTIFIED` only where tests + certification reports support it. `DISABLED_SAFE` = shipped but intentionally disabled (fail-closed) pending a required security verification — NOT customer-ready. Commercial plan = intended tier per `09` (FREE / PRO / PREMIUM_TIER_PLACEHOLDER).

## 1. Matrix

| Feature | WEB | API | DB | WORKER | AGENT | AUTH | RBAC | TESTS | LINUX | WIN | PLAN | STATUS | Blockers / Dependencies |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Authentication (JWT+refresh) | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |
| MFA (TOTP) | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | PRO | FUNCTIONAL | enrollment UI polish |
| SSO | ❌ UI | ⚠️ login | ✅ | — | — | ⚠️ | ✅ | ✅ | — | — | PREMIUM | **DISABLED_SAFE** | fail-closed (501) until real IdP verification (`V1-STAGE-01-SUB-01`) |
| Organizations | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |
| Membership + roles | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |
| Invitations | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |
| Account deletion | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |
| Device enrollment (Linux) | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | FREE | CERTIFIED (Linux) | Windows agent (`05`); E1-E8 lifecycle suite (`V1-STAGE-02-SUB-01`) |
| Device list/health | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |
| Device metrics + scoring | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ⚠️ temp/batt | ⚠️ | FREE | FUNCTIONAL | collector gaps (`05`) |
| Presence (5/15 min) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | FREE | CERTIFIED | 15-min latency by design (`00`, `06`); **UNKNOWN for never-heartbeat devices verified (`V1-STAGE-02-SUB-01`)** |
| Presence alerts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | FREE | CERTIFIED | — |
| Metric alert rules | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — | PRO | CERTIFIED | — |
| Alert webhooks | ❌ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — | PRO | FUNCTIONAL | no webhook management UI |
| Monitoring dashboard | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |
| Network discovery + view | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | PRO | FUNCTIONAL (Linux) | Windows network module (`05`); Cybersecurity/device real-device integration certified `V1-STAGE-02-SUB-01A` (CYBER-01 CLOSED); **Network real-device evidence deferred to `NET-00`**; org-wide `NetworkDevice` pool, unassigned scans claimable by org agents, diagnostics from API host — documented gaps |
| Network diagnostics | ✅ | ✅ | — | — | — | ✅ | ✅ | ✅ | — | — | PRO | FUNCTIONAL | — |
| Remote support sessions | ✅ | ✅ | ✅ | — | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ❌ | PRO | **PARTIAL** | agent auto-consent stub, no control; Windows (`05`) |
| Recordings | ⚠️ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | PRO | PARTIAL | no player/Viewer UI (`03`) |
| Software inventory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | PRO | FUNCTIONAL (Linux) | Windows inventory (`05`) |
| Drivers | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | PRO | FUNCTIONAL (Linux) | — |
| Security scans + scoring | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | PRO | FUNCTIONAL (Linux) | Windows security module (`05`); push-path ingestion made fail-closed 401 (`V1-STAGE-02-SUB-01A` SEC-1); on-demand path Bearer-authenticated (CYBER-01 — agent regression test + **manual certification PASS on the rebuilt real-device binary**); Web flow has complete terminal-state machine (idle/triggering/running/completed/failed/timeout — CYB-1); `GET /security/latest` exposes failed terminal scans (CYB-2); **MANUAL CERTIFICATION: PASS — CYBER-01 CLOSED for V1 (real-device, 2026-08-11); Cybersecurity is the V1 stable baseline**; body-token transport on `/devices/security-report` documented for future DeviceTokenGuard alignment |
| Knowledge Base | ✅ | ✅ | ✅ | ⚠️ | — | ✅ | ✅ | ✅ | — | — | FREE | FUNCTIONAL | KB embeddings = mock vectors (`06`) |
| AI chat | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | FUNCTIONAL | quota enforced |
| AI troubleshooting (SSE) | ✅ | ✅ | — | — | — | ✅ | ✅ | ✅ | — | — | PRO | FUNCTIONAL | depends on fresh metrics |
| AI provider config | ❌ | ✅ | ✅ | — | — | ✅ | ✅ | partial | — | — | PRO | PARTIAL | no admin UI |
| Reports (6 formats) | ✅ | ✅ | ✅ | ⚠️ | — | ✅ | ✅ | ✅ | — | — | PRO | FUNCTIONAL | REPORT queue dead (`06`); generate works sync |
| Report schedules | ✅ | ✅ | ✅ | ⚠️ | — | ✅ | ✅ | ✅ | — | — | PRO | PARTIAL | queue path dead |
| Backups | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — | PRO | FUNCTIONAL | local-disk only |
| Retention policies | ❌ UI | ✅ | ✅ | ✅ | — | ✅ | ✅ | partial | — | — | PRO | PARTIAL | no UI |
| Audit logs | ❌ UI | ✅ | ✅ | — | — | ✅ | ✅ | partial | — | — | PRO | PARTIAL | no viewer page |
| Billing checkout/portal | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | — | — | FREE | FUNCTIONAL | entitlement gaps (`09`) |
| Entitlement enforcement | — | partial | — | — | — | — | — | partial | — | — | — | **PARTIAL** | `maxTeamMembers`/`maxAlertRules` unenforced (`09`) |
| Admin console | ❌ UI | ✅ | ✅ | — | — | ✅ | ✅ | partial | — | — | PREMIUM | PARTIAL | no web admin page |
| Encryption (provider keys) | — | ✅ | — | — | — | ✅ | ✅ | ✅ | — | — | — | FUNCTIONAL | — |
| Demo/RBAC scaffold | ❌ | ⚠️ | — | — | — | — | — | ❌ | — | — | — | SCAFFOLD / dead | remove (`10`) |
| Agent enrollment/identity | — | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | FREE | CERTIFIED (Linux) | Windows (`05`); strong-identity recovery + no-hostname-relink verified (`V1-STAGE-02-SUB-01`) |
| Agent updates | — | — | — | — | ❌ | — | — | ⚠️ | ⚠️ | ❌ | — | **MISSING** | self-update mechanism (`05`) |
| Windows agent | — | — | — | — | ❌ | — | — | ❌ | — | ❌ | — | **MISSING** | full gap list (`05`) |
| RLS tenancy | — | — | ⚠️ | — | — | — | — | ⚠️ | — | — | — | **INERT / app-layer** | Option B decided: app-layer authoritative + regression-tested isolation (`V1-STAGE-01-SUB-02`, S2 `07`) |
| SSO tenant authz | ❌ | ⚠️ | ✅ | — | — | ⚠️ | ✅ | ✅ | — | — | PREMIUM | **DISABLED_SAFE** | fail-closed (501) until real IdP verification (`V1-STAGE-01-SUB-01`) |
| WebSocket live alerts | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | ✅ | — | — | FREE | CERTIFIED | — |

Legend: ✅ present/working · ⚠️ partial/flawed · ❌ missing/blocked · — not applicable.

## 2. Key Takeaways

1. **CERTIFIED core**: auth, orgs/membership/RBAC/invitations, account deletion, device enrollment (Linux), device list/health, presence + presence alerts, monitoring dashboard, WS live alerts, reports (sync path).
2. **BROKEN before V1**: KB embeddings (mock vectors), REPORT async queue, Windows support (absent), agent self-update (absent). **RLS is no longer BROKEN — it is INERT and non-authoritative by decision (Option B, `V1-STAGE-01-SUB-02`): isolation is app-layer authoritative and regression-tested** (`test/cross-tenant-isolation.spec.ts`, 20 tests). **SSO is no longer BROKEN — it is DISABLED_SAFE** (S1 closed by `V1-STAGE-01-SUB-01`: fail-closed 501, tests green) and remains unimplemented for customers until a real IdP verification substage lands.
3. **PARTIAL**: remote support (agent stub), recordings viewer, retention UI, audit UI, admin UI, entitlement enforcement, AI provider config, report schedules.
4. Every Windows column is ❌ — Windows is a single hard dependency for "Linux AND Windows production support" (`11`, `12`).
5. **Device-backed data truthfulness certified (`V1-STAGE-02-SUB-01A`)**: Dashboard, Cybersecurity, and Network surfaces render REAL_AGENT_DATA/SERVER_DERIVED values only — no demo/mock/hardcoded device data, org/device identity always server-derived, UNKNOWN preferred over fabricated. Security push-path now fail-closed 401; Network page no longer queries a dead endpoint; unknown MACs render as UNKNOWN. **Manual real-device Cybersecurity certification PASS (2026-08-11) — CYBER-01 CLOSED for V1; Cybersecurity is the V1 stable baseline; Network real-device evidence deferred to `NET-00`**.

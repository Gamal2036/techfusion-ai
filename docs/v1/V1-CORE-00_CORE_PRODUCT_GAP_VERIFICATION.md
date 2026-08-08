# V1-CORE-00 — Core Product Gap Verification

> READ-FIRST architectural audit of the TechFusion AI product core.
> **Scope:** verification against real source code only. No implementation, no schema changes, no migrations, no destructive git operations.
> **Basis commit:** `6c441ea` (`feat: establish TechFusion V1 foundation and command center`)

---

## PART I — AUDIT BASIS

### 1. Mission & Constraints

- Verify every core capability in real code; a label, route, table, or TODO is **not** proof of functionality.
- Trace each capability end-to-end (UI → API → service → worker/agent → storage → response) before classifying.
- Online/Offline is **not** treated as a defect; heartbeats are audited for understanding only and preserved.
- Frozen baselines that are not reopened: `DASH-IMPL-01` (Command Center), `DASH-QA-01A` (browser certification), Authentication (`AUTH-02X-R2-H1`).
- No changes were made to the repository during this audit.

### 2. Evidence Basis & Method

Evidence = direct reads of source. Key evidence files:

| Area | Primary sources |
|---|---|
| Schema / tenancy | `apps/api-gateway/prisma/schema.prisma` (797 lines, 36 models) |
| Enrollment | `src/enrollment/enrollment.service.ts`, `src/enrollment/enrollment.controller.ts`, `src/devices/devices.controller.ts` |
| Agent | `apps/agent/src/{main,config,identity,registration,agent,client,collector,security,inventory,network_discovery,remote}.rs` |
| Alerts | `src/alerts/alert-evaluation.service.ts`, `notification.service.ts`, `alerts.gateway.ts` |
| Presence | `src/devices/device-presence.ts` + `apps/web/src/lib/device-presence.ts` (mirrored contract) |
| Worker | `apps/worker/src/{main.ts,processors.ts,backup-runner.ts}` |
| AI | `src/ai/controllers/troubleshooting.controller.ts`, `src/ai/ai-orchestrator.service.ts`, `src/kb/kb.service.ts` |
| Reports | `src/reporting/reporting.{controller,service}.ts`, `reporting/services/*` |
| Remote | `src/remote-support/remote-support.service.ts`, `apps/agent/src/remote.rs` |
| UI | `apps/web/src/app/dashboard/**`, `components/{Topbar,Sidebar,command-center/CommandCenterPage,command-center/OnboardingFlow}.tsx` |
| Baselines | `docs/PROJECT_CONTEXT.md`, `docs/certifications/AUTH-CERT-01_*`, `docs/dashboard/DASH-QA-01A_*`, `TECHFUSION_V1_READINESS_AUDIT.md` |

**Read-first verification note:** `docs/PROJECT_CONTEXT.md` (2026-06-18) is partially stale vs. the current agent (`TF_INTERVAL` says 10s default; code default is 30s) — where doc and code disagree, **code wins** and is recorded below.

### 3. Repository Baseline

- Monorepo (pnpm workspaces): `apps/{agent,api-gateway,web,worker}`, `packages/{config,types,ui,utils}`, `infra/{docker,k8s}`, `scripts`, `docs`, `test`.
- Git status at audit time: dirty tree —
  - Deleted: `apps/api-gateway/prisma/migrations/20260617000200_rls_extended/migration.sql` (RLS migration file absent locally; RLS policies are still referenced by `PROJECT_CONTEXT.md` and `OrgContextInterceptor`).
  - Modified: `apps/web/src/components/command-center/OnboardingFlow.tsx` (DASH-01 preservation edit).
  - Untracked: `apps/api-gateway/.env.test`, `apps/web/src/__tests__/onboarding-flow.spec.tsx`, `docs/dashboard/DASH-QA-01A_COMMAND_CENTER_BROWSER_CERTIFICATION_REPORT.md`, and a corrupted-named file at repo root (starts with a literal tab/space + `tablish TechFusion V1 foundation and command center"`). Cleanup is out of scope but flagged.
- Test/CERTIFICATION baselines: `AUTH-CERT-01` = CERTIFIED; `DASH-QA-01A` = COMPLETE—CERTIFIED (basis `6c441ea`); `TECHFUSION_V1_READINESS_AUDIT.md` (2026-07-25) ≈75% ready with blockers recorded (see Section 37).

---

## PART II — CORE ARCHITECTURE

### 4. Architecture Map

```
┌────────────────────────────────────────────────────────────────────────────┐
│ apps/web  Next.js 14 (port 3000)  — App Router, certified Command Center   │
│  Sidebar/Topbar, CommandPalette, AiChatDrawer, hooks, device-presence      │
└───────────────┬────────────────────────────────────────────────────────────┘
                │ REST (JWT Bearer) + Socket.IO client (/metrics /network /remote)
                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ apps/api-gateway  NestJS 10 (port 3001)                                     │
│  APP_INTERCEPTORS: CorrelationId, Metrics, OrgContext(RLS set_config),      │
│                    BigIntSerializer   APP_GUARDS: CombinedAuth, Plan, Throttle│
│  Feature modules: auth, mfa, devices, alerts, ai, security, network,        │
│  inventory, reporting, backups, billing, remote-support, kb, sso, audit,    │
│  encryption, retention, admin, queue, enrollment, dashboard                 │
│  Socket.IO gateways: /metrics, /network, /remote                            │
└───────────────┬──────────────────────────────────────┬──────────────────────┘
                │ Prisma/PostgreSQL                    │ BullMQ (add* methods, unwired for reports)
                ▼                                      ▼
        PostgreSQL 16 + TimescaleDB           apps/worker  BullMQ processors
        Redis 7 (queues + WS pub/sub)         alert(webhook+log), report(delegates to
                                              /reports — MISSING route), backup(scripts),
                                              inventory, security, retention, kb_embedding
                                              (calls /ai/embed — MISSING route)
        ▲
        │ HTTPS POST (device-token Bearer) + long-poll commands
┌───────┴────────────────────────────────────────────────────────────────────┐
│ apps/agent  Rust binary (no packaged installer — cargo/Docker only)        │
│  telemetry 30s · security 1h · inventory 2h · remote poll 15s · cmds 15s   │
│  identity v2 + disk-persisted token/device_id in ~/.techfusion/            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5. Tech Stack & Run Model

- **web:** Next.js 14 App Router, Tailwind, `@techfusion/ui`, socket.io-client, recharts, sonner, cmdk.
- **api-gateway:** NestJS 10, Prisma 6.19.3, JWT access(15m)/refresh(7d) + bcrypt, speakeasy TOTP MFA, Stripe, pdfkit/docx, prom-client, OTEL.
- **worker:** BullMQ 5 on Redis, ioredis, Prisma client, prometheus + OTEL; health on 9465.
- **agent:** Rust (tokio, reqwest rustls-tls, sysinfo, clap, tokio-retry). Runs as a foreground binary or Docker/K8s; **no OS-native service story**.
- **DB:** PostgreSQL 16 + TimescaleDB (hypertable on `DeviceMetric`), Redis 7.
- **Stack decision impact:** the agent push model is the ONLY metrics path; there is no server-side pull/cron collector.

### 6. Database Schema & Tenant Isolation

- 36 models (`schema.prisma`); enums `Role` (Owner/Admin/Technician/Viewer), `Plan` (Free/Pro/Business/Enterprise), `SubscriptionStatus`.
- **RLS:** `OrgContextInterceptor` runs `set_config('app.current_org_id', …)` per request; tenant-scoped tables carry RLS policies. ⚠️ The RLS migration file is **deleted locally** (`git status` shows `D …/20260617000200_rls_extended/migration.sql`) — needs restoration before a clean `prisma migrate deploy`/CI run.
- **Identity-ready schema:** `Device` has `identityFingerprint`, `installationId`, `identityVersion`, `credentialVersion`, `deviceTokenHash`, plus `@@unique([orgId, identityFingerprint])` and `@@unique([orgId, installationId])`; `CredentialRotationEvent` records rotations. Enrollment tokens are hash-only (`EnrollmentToken.tokenHash @unique`).

### 7. API Surface Inventory

Endpoints verified (see also `docs/PROJECT_CONTEXT.md` §4, largely accurate):
- **Public, token-gated:** `POST /devices/register-public` (enrollment token), `POST /devices/recover-credential` (`X-Org-Token`), `POST /devices/metrics` (device-token Bearer), security-report/inventory ingestion, `GET /remote-support/agent/pending`, `POST /remote-support/consent`, `POST /remote-support/agent/status`.
- **JWT role-gated:** full CRUD across devices/alerts/ai/reports/network/backups/kb/inventory/security/billing/remote-support + admin (users, roles, retention, audit, sso, encryption).
- **Global guards:** `CombinedAuthGuard` (JWT), `RolesGuard` (hierarchy), `PlanGuard`, `ThrottlerGuard`; `@Public()` marks unauthenticated routes; `org-context.interceptor.ts` enables RLS.
- **Not present:** any `organization` controller (no org CRUD/rename/switch/invite), no `/ai/embed` route (worker calls it — Section 21), no `POST /reports` route (worker calls it — Section 31).

### 8. Background Job System

- Queues: `alert`, `report`, `backup`, `inventory`, `security`, `retention`, `kb_embedding` (default retries 3, backoff 2s).
- Gateway side (`src/queue/queue.service.ts`) exposes `addAlertNotification` (wired at `devices.service.ts:363`) and `addReportGeneration` (**no callers**).
- Worker processors (`apps/worker/src/processors.ts`): alert (log + webhook, email is a placeholder log line), report (delegates to a **non-existent** `POST /reports`), backup (real allow-listed bash scripts + checksum verification + restore), inventory (upserts drivers/software), security (scan-complete/finding alerts), retention (bulk deletes per policy), kb_embedding (calls **non-existent** `/ai/embed` → deterministic mock fallback).
- Integration failures flagged: **report queue unwired**, **KB worker embedding non-functional**, **alert email placeholder**.

### 9. WebSocket / Real-Time Layer

- `/metrics` namespace: devices gateway + alerts gateway broadcast metrics/score/lastSeen/alerts into `org:{orgId}` rooms; WS auth middleware.
- `/network`: topology + diagnostics; `/remote`: session signaling + screen-frame/input events (subscribed by web, **no agent producer** — Section 19).
- Web hooks: `useDevices`, `useAlerts`, `useRemoteSupport`, `useNetwork*`, `useCommandCenterData`, `useSocketConnectionState`.

---

## PART III — PRODUCT-CORE SECTIONS (S-01 … S-26)

### S-01 — Enrollment Token Lifecycle — **WORKING**
- `POST /enrollment/tokens` (Owner/Admin) → 32-byte random hex prefixed `tfenr_`; only the SHA-256 hash is stored (`enrollment.service.ts:24-39,264-266`); `maxUses` default 1, optional expiry; audit on create/use/revoke/regenerate.
- `validateToken` (`enrollment.service.ts:68-115`) enforces prefix/length, revocation, expiry, use-limit (increments `useCount`).
- Revoke, regenerate (revokes old + creates new), list w/ status derivation, audit log query — all present.
- UI: `dashboard/settings/enrollment/page.tsx` — generate/copy/revoke/regenerate/audit + quick-start; role-gated in sidebar (Owner/Admin).
- **Verdict: complete at the API/UI level.** Token exposure is one-time (shown once in UI).

### S-02 — Agent Registration & First-Run Flow — **FUNCTIONAL-DEVELOPER-FLOW**
- Agent first-time path: `registration::ensure_registered` (`registration.rs:205-239`). Priority: env `TF_DEVICE_TOKEN` → `TF_ORG_TOKEN` (fresh registration via `register_device_public`, `client.rs:185-246`) → disk restore → hard error with recovery text.
- `POST /devices/register-public` (`devices.controller.ts:36-57`) validates the enrollment token and calls `devicesService.registerPublic` (org+hostname dedupe, plan limits, `deviceToken` return).
- **The manual-token root cause (below) is the only gap in this flow; the flow itself is real and tested.**

### S-03 — Persistent Device Identity — **WORKING**
- `identity.rs`: `installation_id` UUID persisted in `~/.techfusion/installation_id` (0600, unix); machine-id from `/etc/machine-id`, `/var/lib/dbus/machine-id`, Windows `wmic csproduct get UUID`; SMBIOS `product_uuid` on Linux; fingerprint **v2** = sha256(v2 + installation UUID + machine-id + system UUID) — stable, excludes mutable fields; `identity_version()==2` (tested).
- `registration.rs`: `device_token` + `device_id` written atomically (tmp→rename, 0600) under `~/.techfusion/` (0700), validated on load (non-empty, ≥16 chars).
- DB uniqueness: `unique_identity_per_org`, `unique_installation_per_org`.
- **Verdict: identity is already durable and restore-able across restarts.** No rebuild needed; only installer bootstrap + recovery ergonomics are missing.

### S-04 — Auto-Reconnect & Credential Recovery — **PARTIAL (process-level complete; OS-level missing)**
- On restart, agent restores token from disk (`RegistrationSource::Disk`) — no re-enrollment needed.
- On 401 (`agent.rs:199-221,229-269`): increments consecutive failures; after >3 logs recovery instructions and stops; else `invalidate_token()` then `attempt_reregister` (with `TF_ORG_TOKEN`, up to 3 attempts, backoff) or `attempt_recover` (`recover_credential` via `X-Org-Token`, rotates credential server-side → `CredentialRotationEvent`).
- HTTP-level retry: exponential backoff on 5xx metrics; 429 → 60s sleep; tokio-retry wired (`client.rs:307-357`).
- **Gap:** no OS service autostart → after reboot the process does not restart, so “reconnect” only applies while the process lives. P0.

### S-05 — Agent Metrics Collection (24-7 monitoring) — **WORKING (agent-push)**
- `collector.rs` (`MetricsCollector::collect`): CPU usage/cores/model, RAM, summed disks (total/used/%), network rx/tx totals, process count, uptime, hostname/os/version — cross-platform via `sysinfo`; Linux enhancements: physical cores + CPU model from `/proc/cpuinfo`.
- **Temperature and battery are hardcoded `None`** (`collector.rs:159-161`) — schema supports them (`tempCpu`, `batteryPercent`) and alert rules support `tempCpu`, but no data ever arrives.
- Push cadence: telemetry 30s (default `TF_INTERVAL`), jittered; API updates `lastSeenAt` on ingest and evaluates alerts inline (`devices.service.ts:344`).
- **Verdict: 24-7 monitoring works while the agent runs, via push. No server-side pull and no “no-data/heartbeat-loss” alert.** Offline detection is purely lastSeen-derived (Section 22).

### S-06 — Agent Security Scanning — **WORKING on Linux only**
- `security.rs` checks: pending apt upgrades (count→severity), firewall (ufw/iptables), open ports (`ss -tlnp`), weak config (sshd PermitRootLogin, login.defs password policy).
- Commands are Linux utilities; on non-Linux these degrade to “unable to check / low” findings.
- Triggered on interval (1h default) and on-demand via `get_pending_security_scans` → `complete_security_scan` round-trip (Section 27).
- Worker `processSecurityJob` creates alerts for critical/high findings with webhook support.

### S-07 — Agent Inventory (drivers/software) — **WORKING on Linux only**
- `inventory.rs`: kernel modules (`lsmod`/`modinfo`), PCI (`lspci -k`), USB (`lsusb`), Debian packages (`apt list --installed`).
- Hash-deduped upload; worker `processInventoryJob` upserts `Driver`/`SoftwareInventory` with catalog-version comparison (`current/outdated/missing`).
- **Windows/macOS inventory unsupported** (tools absent) — Section 35.

### S-08 — Agent Network Discovery — **WORKING on Linux only**
- `network_discovery.rs`: gateway/subnet from `ip -4 addr` + `ip route`, ICMP sweep via `ping`, DNS via `host`/`nslookup`, MAC via `arp`/`ip neigh` (vendor OUI table compile-time hardcoded).
- Command-driven (server requests scan → agent runs → reports result/error/timeout, 60s cap).
- Windows/macOS unsupported.

### S-09 — Remote Support & Command Path — **SCAFFOLDED / PARTIAL**
- Backend is complete: session create/list/get/end, consent, status, audit, recordings + frame upload (`remote-support.service.ts`), WS `/remote` signaling events, cleanup of stale sessions.
- Agent polls pending sessions and **auto-grants consent** (`agent.rs:360-440`), reporting status active/failed.
- **Agent-side live control is a stub:** `remote.rs` is 27 lines of data structures only (“Screen capture, input injection, and active indicator are disabled”). No screen capture, no input injection, no frame/stream producer, no TURN server provisioning (`PROJECT_CONTEXT.md` §8 confirms). The `/remote-support/recordings/:id/frames` endpoint stores frames that nothing sends.
- **Verdict: session orchestration works; actual remote control does not.** Classify as scaffolded — scope decision required (implement control or explicitly disable UI).

### S-10 — Alert Engine — **WORKING with durability gaps**
- `AlertEvaluationService.evaluateMetrics` (`alert-evaluation.service.ts:23-64`): enabled rules per org; metric extraction (cpuUsage/ramPercent/diskPercent/tempCpu/loadAverage1Min/processes); operators gt/lt/gte/lte/eq; debounce via **in-memory `lastAlertedTimestamps` Map** — resets on API restart → duplicate alerts after restart.
- Persists `Alert` rows; WS broadcast on create; ack/resolve endpoints; alert CRUD (Admin/Owner).
- No alert on offline/no-data; no auto-resolve when condition clears (manual resolve only).

### S-11 — Alert Notifications — **LOG + WEBHOOK ONLY**
- `notification.service.ts`: log + optional `rule.webhookUrl`.
- Worker `processAlertJob` (`processors.ts:46-49`): `[EMAIL] To: admin@techfusion.ai` is a **placeholder log line**, no SMTP/email dependency.
- **Verdict:** the “03:00 alert visible at 08:00” scenario is satisfied only via DB + in-app WS while a browser is open. No durable out-of-band channel. P0 for operators.

### S-12 — Device Presence / Online-Offline — **WORKING — PRESERVE**
- Mirrored contract: `DEVICE_ONLINE_THRESHOLD_MS = 5*60*1000`, `TELEMETRY_INTERVAL_MS = 30*1000` (`device-presence.ts` backend + web, plus spec tests). `isDeviceOnline`/`classifyFreshness`(live/recent/stale/unavailable)/`metricAge`.
- `lastSeenAt` updated only by metrics ingest (`devices.service.ts:316`, tested in `device-presence.spec.ts`), not by registration/rotation. WS pushes `lastSeenAt` to clients.
- **Verdict: healthy and unchanged by this audit. Do not rework presence during enrollment work.**

### S-13 — Multi-Device Support — **WORKING**
- Org-scoped registry, hostname/identity dedupe, per-device metrics/scores/security/inventory/remote sessions/backup restore points; device dropdown in AI chat; device detail page + per-device score fetch.

### S-14 — Organization Model & Tenancy — **SINGLE-ORG, RLS-protected**
- Signup transaction creates `Organization` (slug-unique w/ retry) + `Owner` user (`auth.service.ts:62-113`).
- **No org CRUD, rename, switch, or invite anywhere** (no organizations controller; `Topbar.tsx:46-59` “Switch Organization” shows only the current org). Team page text says invites are done “through organization settings” but no such flow exists.
- RLS isolation is backend-real (`OrgContextInterceptor` → `set_config`), gated by the deleted migration file (Section 3).
- **Verdict: multi-tenant data isolation exists; org management is a gap (decide: build or scope single-org for beta).**

### S-15 — RBAC & Roles Enforcement — **WORKING**
- `Role` enum, `RolesGuard` hierarchy (Owner=4 > Admin=3 > Technician=2 > Viewer=1), `CombinedAuthGuard` JWT, role-gated endpoints (billing/enrollment/admin/ai-router/reports schedules are Owner/Admin; troubleshoot is all roles).
- UI: `Sidebar.tsx` hides Owner/Admin-only nav items; `TeamPage` role change (Owner-only) + remove; `Topbar` shows role.
- **Gap: no member invites/join (only role change/remove).**

### S-16 — User & Team Management — **PARTIAL**
- `/admin/users` list, `:id/role` (Owner), `:id/remove` (Owner); Team page fully wired.
- **No invite mechanism** (email/pending state absent from schema — `User.orgId` is required at creation).

### S-17 — Command Execution Path (UI → API → Worker → Agent → exec → result) — **PARTIAL**
- Working round-trips: security scan (trigger → `get_pending_security_scans` → run → `complete_security_scan`), network discovery (trigger → `get_pending_discovery_commands` → run → `report_discovery_result`), inventory refresh (`check_pending_inventory` → collect → `clear_pending_inventory`), remote session consent/status.
- Not working: any real remote-control exec (S-09); agent has no generic shell-command executor (by design — remote module explicitly safe-only).
- **Verdict: command path exists for security/network/inventory; remote control is the missing exec half.**

### S-18 — AI Context Routing — **ROOT CAUSE CONFIRMED (gap)**
- `troubleshooting.controller.ts:60-107`: whenever `dto.deviceId` is provided, a `[DEVICE CONTEXT]` block (spec + latest score + latest metric + freshness band) is **always** injected into the prompt — there is **no intent gating**.
- AI chat page always has a device dropdown; suggested prompts (“Check my CPU issue”, “Run security scan”, “Generate health report”, “Explain this error”) bias toward diagnostics.
- **Effect:** asking “Hi” with a device selected produces a device-info flavored answer instead of a greeting. Fix = intent classification before context injection (P1 — must not regress the diagnostic flow).
- Anti-fabrication guardrails, prompt-injection notes, and “Insufficient information” fallback are genuinely implemented (`troubleshooting.controller.ts:10-33`).

### S-19 — AI Orchestrator & Provider Abstraction — **WORKING**
- 6 providers (Anthropic, OpenAI, Ollama, Gemini, Groq, OpenRouter) with real SDK streaming; circuit breaker (threshold 3, reset 10m); strategies (smart/cost-first/speed-first/round-robin); usage/cost logging; monthly caps via plan config; SSE stream (`status`, `citations`, `token`, `done`, `error`).
- Admin surfaces: `/ai/providers/status`, `/ai/router/stats`, `/ai/router/strategy` (Owner/Admin) + settings page.

### S-20 — Knowledge Base & RAG — **PARTIAL**
- Gateway path works in-process: `kb.service.queryKb` chunk → `aiOrchestrator.getEmbedding` (OpenAI if key present, else deterministic local fallback) → cosine similarity in app code; troubleshooting injects top-3 chunks w/ similarity > 0.5 as citations.
- **Worker path broken:** `processKbEmbeddingJob` → `embedViaApi` POSTs to `/ai/embed`, **which does not exist** → always deterministic mock embeddings. Seed data is 64-dim character hashes. Semantic quality therefore depends entirely on a configured OpenAI key in the gateway.
- **Verdict: RAG is functional-but-degraded; worker embedding pipeline is effectively non-functional (mock).** P1.

### S-21 — Reporting System — **WORKING (synchronous); queue path broken**
- 6 report types (`device_health`, `security_executive`, `fleet_summary`, `network`, `inventory`, `remote_support`), 5 formats (pdf/docx/html/csv/json) via real generators (pdfkit, docx, manual csv/json/html).
- Branding, cron schedules (`@nestjs/schedule` + Redis distributed lock), signed public download URLs (HMAC `expires`+`sig`, MIME map), org-scoped.
- **Gaps:** `queueService.addReportGeneration` has **no callers** (generation is synchronous in the request path); worker `processReportJob` delegates to `POST /reports` (route is `/reports/generate`) → **scheduled/async generation via the queue is broken end-to-end.** P0 for scheduled-report trust.

### S-22 — Backups — **WORKING (server-side)**
- Jobs/runs/restore points CRUD; worker executes allow-listed scripts (`scripts/backup/*.sh`: backup-all/postgres/redis/files/config, verify, restore) with 300s timeout, sha256 checksums, idempotent runs, verification pass/fail recorded.
- **Note:** these back up the TechFusion server stack (postgres/redis/files), not endpoint user devices; the device backup UI’s “restore points” semantics should be clarified as server/device-agnostic. Minor doc/UX gap.

### S-23 — Billing & Plans — **WORKING**
- Stripe checkout/portal/webhook/plan/usage/history; `PlanGuard`; plan-config limits (AI queries/month, device caps) enforced in registration (`devices.service.ts`) and AI caps.
- Env uses placeholders (`sk_test_placeholder`, `whsec_placeholder`) — production secret replacement required (Section 36).

### S-24 — Audit, Retention, Encryption, SSO — **PARTIAL**
- Audit: rich (enrollment, remote sessions, retention, role changes); query + CSV/JSON export (Owner/Admin). RLS-scoped.
- Retention: worker enforces per-org policies (metrics/health scores/recordings/audit/security scans/backups) with batching; admin endpoints (Owner/Admin).
- Encryption: envelope-verify endpoint only.
- SSO: SAML/OIDC config endpoints + JIT provisioning (feature-flag `sso`); no UI page observed; unverified beyond config.

### S-25 — Frontend / Command Center & 4DX — **CERTIFIED (command center); green**
- `DASH-QA-01A` browser certification COMPLETE at basis `6c441ea`; web **18/18 suites, 609/609 tests pass** (readiness audit).
- All 14 dashboard routes use real hooks + `apiFetch` + WebSockets (device-health, monitoring, cybersecurity, network, remote-support, drivers, backup, kb, reports, ai-chat, billing, team, enrollment, settings) — no static/mock data found.
- `OnboardingFlow.tsx` (DASH-01) preserved, currently modified (debug `onboarding-{os}` label), has a matching new test `onboarding-flow.spec.tsx` (untracked).
- **4DX:** command-center scope is green at basis commit; pages added after certification (team, enrollment, settings, scheduled reports) carry equivalent quality but are outside the certified baseline — re-certification recommended after next mission.

### S-26 — Installers, Service Model & OS Coverage Matrix — **MISSING (P0)**

| OS | Telemetry | Security | Inventory | Network disc. | Identity | Service/installer |
|---|---|---|---|---|---|---|
| Linux | ✅ sysinfo + /proc | ✅ apt/ufw/iptables/ss/ssh | ✅ lsmod/lspci/lsusb/apt | ✅ ip/ping/host/arp | ✅ machine-id + SMBIOS | ❌ (Docker/K8s only) |
| Windows | ⚠️ sysinfo generic | ❌ (tools absent) | ❌ | ❌ | ⚠️ wmic (deprecated) | ❌ |
| macOS | ⚠️ sysinfo generic | ❌ | ❌ | ❌ | ❌ (no machine-id path) | ❌ |

- No `.deb/.rpm/.msi/.pkg/.exe`, no systemd unit / launchd plist, no CI artifact job for binaries; `Dockerfile` (multi-stage rust→bookworm-slim) is the only packaging; `infra/k8s` deploys the agent as a container.
- `scripts/enroll-device.sh` merely `cd apps/agent && cargo run` with env vars — **requires Rust toolchain + source checkout**. Enrollment page “Linux / macOS” command is the same `cargo run` snippet.
- Temperature/battery metrics are never collected (S-05) across all OSes.
- **Verdict: the product cannot be installed by a non-developer today. This is the single biggest blocker for a public beta.**

---

## PART IV — SYNTHESIS & ROADMAP

### 36. Maturity Matrix, Dependencies, Priorities

**Maturity matrix (capability → status → evidence):**

| # | Capability | Status | Key evidence |
|---|---|---|---|
| 1 | Enrollment token lifecycle | ✅ WORKING | `enrollment.service.ts` (hash, maxUses, expiry, revoke/regenerate, audit) |
| 2 | Agent first-run registration | 🟡 FUNCTIONAL-DEVELOPER-FLOW | `registration.rs` + `register-public` (real, but token via terminal only) |
| 3 | Persistent device identity | ✅ WORKING | `identity.rs` v2 + `registration.rs` disk persistence + DB uniqueness |
| 4 | Auto-reconnect | 🟡 PARTIAL | disk restore + 401 re-register/recover; no OS autostart |
| 5 | 24-7 monitoring | ✅ WORKING (push) | 30s telemetry; inline alert eval; no heartbeat-loss alert |
| 6 | Alert engine | ✅ WORKING / 🟡 in-memory debounce | `alert-evaluation.service.ts:19` |
| 7 | Alert notifications | ❌ LOG+WEBHOOK ONLY | `processors.ts:46` placeholder email |
| 8 | Online/Offline | ✅ WORKING — PRESERVE | `device-presence.ts` mirrored contract |
| 9 | Multi-device | ✅ WORKING | org-scoped registry, identity dedupe, per-device streams |
| 10 | Org/tenancy | 🟡 SINGLE-ORG | RLS real; no org CRUD/switch/invites |
| 11 | RBAC | ✅ WORKING | Role enum, RolesGuard hierarchy, PlanGuard |
| 12 | Team management | 🟡 PARTIAL | role change/remove only; no invites |
| 13 | Commands | 🟡 PARTIAL | security/network/inventory round-trips real; remote control stub |
| 14 | AI context routing | ❌ ROOT CAUSE CONFIRMED | unconditional `[DEVICE CONTEXT]` on any selected device |
| 15 | AI orchestrator | ✅ WORKING | 6 providers, circuit breaker, strategies, caps, SSE |
| 16 | KB RAG | 🟡 PARTIAL | gateway in-process OK; worker `/ai/embed` missing → mock |
| 17 | Reports | 🟡 WORKING sync / queue broken | `addReportGeneration` no callers; worker → `/reports` (404) |
| 18 | Backups | ✅ WORKING | allow-listed scripts, checksums, verification |
| 19 | Billing | ✅ WORKING | Stripe + PlanGuard (placeholders in env) |
| 20 | Audit/Retention/Encryption/SSO | 🟡 PARTIAL | audit+retention real; SSO config-only |
| 21 | Command Center UI | ✅ CERTIFIED | DASH-QA-01A; web 609/609 |
| 22 | Installers/service model | ❌ MISSING | no packaging; `cargo run` only |
| 23 | OS coverage | ❌ Linux-only beyond telemetry | Section 35 matrix |
| 24 | Test/CI health | ❌ RED (gateway+worker) | jest30/ts-jest29 mismatch; `clearMocksOnScope` |

**Dependency graph (what next work depends on):**

```
V1-ENROLL-01 (Zero-Touch Enrollment + Auto-Reconnect)
   ├─ depends-on (DONE)  Enrollment token lifecycle, register-public, identity v2,
   │                     disk persistence, presence contract (preserve, not rework)
   ├─ depends-on (NEW P0) Installer/service packaging (systemd/launchd/msi/pkg) + CI artifact
   ├─ depends-on (NEW P0) Test/CI green (jest mismatch) — everything lands cleaner on green CI
   ├─ depends-on (GATE)   RLS migration file restore (currently deleted in working tree)
   └─ must-NOT-block-on  Org/team invites, remote control, report queue
```

**P0 (blockers for a trustworthy product):**
1. Restore green CI: fix api-gateway + worker Jest failures (jest 30.4.2 vs ts-jest 29.4.11; `clearMocksOnScope`), re-run all suites (gateway currently red, web green, agent `cargo check` passes).
2. Installers & OS service autostart (systemd/launchd/Windows service) + binary CI artifacts — closes the manual-token/reboot-reconnect gap (S-04/S-26).
3. Restore the deleted RLS migration file so tenancy stays deployable.
4. Real out-of-band notifications (email/push) or an explicit webhook-first + in-app design (replace the `[EMAIL]` placeholder).
5. Fix report queue wiring: route worker to `POST /reports/generate` **and** call `addReportGeneration` from the gateway for async/scheduled generation (or scope-down scheduled generation to synchronous).
6. Fix KB worker embedding: expose the missing embed path (or call the gateway’s in-process orchestrator) — remove the silent mock fallback.
7. AI context routing intent gating (stop injecting device context on non-diagnostic intents).
8. Scope decision on remote support: implement live control (screen/input/TURN) **or** disable the remote-support surface until then.

**P1 (high-value, not blocking):**
- Durable alert debounce/dedupe (persist last-alerted state) + offline/no-data alerts + auto-resolve on recovery.
- Temperature/battery metric collection (schema + rules already exist).
- Windows/macOS security + inventory + network collection; replace `wmic`.
- Org management decision (multi-org build vs. explicit single-org beta scope).
- Team invites (email/pending state) for RBAC completeness.
- Secret/CORS hardening (JWT/AI encryption/Stripe placeholders; `app.enableCors({origin:'*'})`), pgvector migration at scale, agent auto-update, TURN provisioning.

**Scope buckets (recommended):**
- **Private Beta gate:** P0-1, P0-2 (Linux installer + autostart only), P0-3, P0-4 (webhook-first), P0-7, P0-8 (scope decision).
- **Public V1 gate:** P0-5, P0-6, P1 (org decision, team invites, durable alerts, temp/battery, hardening), Windows service installer.
- **Post-V1:** macOS full parity, live remote control + TURN, multi-region, pgvector, agent auto-update.

**Acceptance scenarios (top 6, traceable to evidence):**
1. **Reboot survives:** install agent via native service on Linux → register once with enrollment token → reboot → agent auto-starts, restores disk identity, telemetry resumes, device returns to online within ~5 min without re-entering a token. (Blocks on P0-2.)
2. **Token hygiene:** create token maxUses=1 + expiry → use once → second use rejected; revoke/regenerate audited. (Passes today; re-verify post-mission.)
3. **Alert to inbox:** CPU > 90% for > 5 min at 03:00 → alert persisted + delivered out-of-band, ack/resolve reflected in dashboard. (Blocks on P0-4; alert creation passes today.)
4. **Scheduled report:** cron schedule fires → PDF generated + downloadable via signed URL without user action. (Blocks on P0-5.)
5. **AI grounding:** “Hi” with device selected returns a greeting, not device specs; “Why is my CPU high?” returns device context + KB citations + confidence. (Blocks on P0-7.)
6. **Tenant isolation:** Owner A cannot read Owner B devices/alerts/reports via API or WS even with a forged JWT (RLS + org-context). (Gate on P0-3.)

### 37. Recommended Next Mission — `V1-ENROLL-01` (Zero-Touch Enrollment, Persistent Identity & Auto-Reconnect)

Dependency-verified: every prerequisite that exists today (token lifecycle, public registration, identity v2, disk persistence, presence contract) is complete and must be **preserved**, and nothing in org/team/report/AI work blocks it. The mission adds the two true gaps: **native installer + service autostart** and **first-run bootstrap ergonomics** (token via install-time input/deep-link, not terminal env vars), then proves acceptance scenarios 1 and 2. It must ship the OS-service layer for Linux first (P0-2), keep `DASH-QA-01A` intact, and land on green CI (P0-1).

---

## V1-CORE-00 — Final Response

```
MISSION        : V1-CORE-00 — Core Product Gap Verification
ENROLLMENT     : FUNCTIONAL-DEVELOPER-FLOW (real token lifecycle + public registration,
                 but first-run requires terminal `TF_ORG_TOKEN` + `cargo run`)
MANUAL-TOKEN-ROOT-CAUSE:
                 No install-time bootstrap. First run requires: (1) generate token in
                 Dashboard → Enrollment, (2) copy env vars, (3) run the agent from source.
                 There is no installer, no OS service, and no zero-touch provisioning path,
                 so manual token entry is the ONLY path.
IDENTITY       : WORKING — installation_id + machine-id/SMBIOS fingerprint v2, token+device_id
                 persisted atomically in ~/.techfusion (0600), unique per org (DB enforced).
AUTO-RECONNECT : PARTIAL — disk restore + 401 re-register/credential-recovery work at process
                 level; missing OS service autostart (agent does not survive reboot).
LINUX          : WORKING (primary) — full telemetry/security/inventory/network; temp+battery not collected.
WINDOWS        : PARTIAL — generic telemetry only; no security/inventory/network; wmic-based identity;
                 no installer/service.
MACOS          : PARTIAL — generic telemetry only; no security/inventory/network; no machine-id path;
                 no launchd/installer.
24-7-MONITORING: WORKING — agent push every 30s; alert rules evaluated inline on ingest; no server pull,
                 no heartbeat-loss/offline alert.
ALERT-ENGINE   : WORKING with gaps — threshold rules, debounce (in-memory, lost on API restart),
                 no offline alerts, no auto-resolve.
NOTIFICATIONS  : LOG + WEBHOOK ONLY — email is a placeholder log line; no push/SMS.
MULTI-DEVICE   : WORKING — org-scoped registry, identity dedupe, per-device streams.
ORG            : SINGLE-ORG — RLS tenant isolation real; no org CRUD/switch/invites.
RBAC           : WORKING — Owner/Admin/Technician/Viewer hierarchy + guards + PlanGuard; invites missing.
COMMANDS       : PARTIAL — security/network/inventory command round-trips real; remote-support control is a
                 stub (remote.rs 27 lines; no screen/input/TURN).
AI-CONTEXT     : ROOT CAUSE CONFIRMED — device context injected unconditionally when a device is selected
                 (no intent gating); suggested prompts bias toward diagnostics.
REPORTS        : WORKING synchronous — 6 types/5 formats/schedules/signed URLs; queue path broken
                 (addReportGeneration unused; worker posts to missing /reports).
ONLINE-OFFLINE : WORKING — lastSeen-based (5-min threshold, 30s telemetry), mirrored contract; PRESERVE.
P0-COUNT       : 8 (CI red; installers/autostart; RLS migration restore; notifications; report queue;
                 KB worker embed; AI intent gating; remote-support scope decision)
P1-COUNT       : 10
NEXT-MISSION   : V1-ENROLL-01 — Zero-Touch Enrollment, Persistent Identity & Auto-Reconnect
                 (dependency-verified; prerequisites complete; preserves presence & identity)
REPORT-PATH    : docs/v1/V1-CORE-00_CORE_PRODUCT_GAP_VERIFICATION.md
STATUS         : V1-CORE-00 COMPLETE — EXECUTION ROADMAP VERIFIED
```

> **Note on premise vs. evidence:** the audit’s opening presumed identity persistence and auto-reconnect were missing. Evidence shows they exist at the process level (disk-restored tokens, 401 re-registration, credential recovery) and the true gaps are **installer/service autostart**, **first-run bootstrap ergonomics**, and the integration defects catalogued in P0. The roadmap above corrects for this so `V1-ENROLL-01` focuses on what is actually missing.

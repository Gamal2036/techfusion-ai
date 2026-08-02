# AH-3R.0 — Runtime Stabilization Audit

**Project:** TechFusion AI  
**Date:** 2026-07-24  
**Mode:** STRICT READ-ONLY AUDIT  
**Auditor:** opencode (AH-3R.0 automated runtime auditor)

---

## 1. Executive Summary

This audit identified **3 confirmed critical/high-severity findings**, **4 probable findings**, and **6 lower-severity findings** across the TechFusion AI stack. The most critical finding is a **React version incompatibility** that crashes the device detail route. The **Quick Navigation overlay renders with a white background** due to an inverted Tailwind color scale. The **online/offline threshold mismatch** between frontend (2 min) and backend (5 min) causes false offline status. The Redis distributed lock architecture is well-designed but **lock acquisition at runtime is unproven** since the NestJS API is not currently running. Scheduled Reports loading lifecycle appears correct in code. The AI Chat device context path is confirmed to use live database queries.

---

## 2. Audit Scope

| Area | Description | Status |
|------|-------------|--------|
| A | Device Health list | Audited |
| B | Device detail route | Audited |
| C | Device enrollment and agent identity | Audited |
| D | Metrics and device presence | Audited |
| E | AI Chat device context | Audited |
| F | Reports history | Audited |
| G | Scheduled Reports UI/API | Audited |
| H | Scheduled executor and Redis | Audited |
| I | Shared date handling | Audited |
| J | Shared overlay/theme components | Audited |
| K | Critical dashboard route scan | Audited |

---

## 3. Repository and Runtime Baseline

| Component | Version | Source |
|-----------|---------|--------|
| Next.js | **14.2.35** (installed) | `apps/web/node_modules/next/package.json` |
| React | **18.3.1** (installed) | `apps/web/node_modules/react/package.json` |
| NestJS | **10.4.22** (installed) | `apps/api-gateway/node_modules/@nestjs/core/package.json` |
| Prisma | **6.19.3** (installed) | `apps/api-gateway/node_modules/prisma/package.json` |
| ioredis | **5.11.1** (installed) | `apps/api-gateway/node_modules/ioredis/package.json` |
| Redis | **7.4.9** (Docker container) | `redis-cli INFO server` |
| PostgreSQL | **TimescaleDB on PG16** (Docker) | `docker ps` |
| Package Manager | **pnpm 9.0.0** | `package.json` `packageManager` field |
| Turbo | **^2.0.0** | Root `package.json` devDependencies |
| Tailwind CSS | **^3.4.0** | `apps/web/package.json` devDependencies |
| cmdk | **^1.0.0** | `apps/web/package.json` dependencies |

**Monorepo structure:**
```
apps/
  web/          (Next.js 14 frontend)
  api-gateway/  (NestJS backend)
  agent/        (Rust device agent)
  worker/       (BullMQ worker)
packages/
  types/        (shared TypeScript types)
  ui/           (shared UI components)
  config/       (shared config)
  utils/        (shared utilities)
```

---

## 4. Services and Ports Observed

| Service | Port | Protocol | Status |
|---------|------|----------|--------|
| Redis (Docker: techfusion-redis) | 6379 | TCP | **Running** (Docker container, PID 1 inside container) |
| PostgreSQL/TimescaleDB (Docker: techfusion-postgres) | 5432 (host: 5433) | TCP | **Running** (healthy) |
| Prometheus (Docker) | 9090 | HTTP | Running (healthy) |
| Grafana (Docker) | 3002 (host for 3000) | HTTP | Running (healthy) |
| OpenTelemetry Collector (Docker) | 4317, 4318, 8889 | gRPC/HTTP | Running (unhealthy) |
| k3d cluster | 80, 38257 | HTTP | Running |
| **NestJS API Gateway** | **3001** | HTTP | **NOT RUNNING** |
| **Next.js Frontend** | **3000** | HTTP | **NOT RUNNING** |

**Note:** The API Gateway and Next.js dev server were not running during this audit. Live endpoint verification was not possible.

---

## 5. Environment/Configuration Names Inspected

| Variable | Location | Value (safe) |
|----------|----------|-------------|
| `REDIS_URL` | `apps/api-gateway/.env:35` | `redis://localhost:6379` |
| `NEXT_PUBLIC_API_URL` | Frontend (referenced) | `http://localhost:3001` |
| `JWT_SECRET` | `apps/api-gateway/.env` | **Redacted** |
| `DATABASE_URL` | `apps/api-gateway/.env` | **Redacted** |
| `REPORT_SCHEDULE_LOCK_TTL_MS` | env (optional) | Default: 300000 (5 min) |

**Files inspected:** `.env`, `.env.example`, `.env.test`

---

## 6. Confirmed Findings

### FINDING AH3R-001: React `use()` Hook Incompatible with React 18 — Device Detail Route Crash

| Field | Value |
|-------|-------|
| **Finding ID** | AH3R-001 |
| **Title** | React `use()` hook does not exist in React 18.3.1 |
| **Observed Symptom** | `An unsupported type was passed to use(): [object Object]` |
| **Severity** | **P1 — Critical feature crash** |
| **Confidence** | **Confirmed** |
| **Layer** | Frontend |
| **Root-Cause Group** | `ROUTE-PARAMS` |
| **Affected Routes** | `/dashboard/device-health/[id]` |
| **Evidence** | `apps/web/src/app/dashboard/device-health/[id]/page.tsx:40-41`: `const { id } = use(params)` where `params` is typed as `Promise<{ id: string }>`. Runtime test: `React.use` does not exist in React 18.3.1. Installed versions: Next.js 14.2.35, React 18.3.1. |
| **Root Cause** | The `use()` hook for unwrapping Promises was introduced in React 19. The code uses the Next.js 15+ / React 19 pattern (`params: Promise<{ id: string }>` + `use(params)`), but the project runs Next.js 14.2.35 with React 18.3.1 where `use()` does not exist. |
| **Why It Happens** | The page was likely written for Next.js 15 / React 19 or auto-generated by a tool targeting that API. Next.js 14 passes `params` as a resolved object, not a Promise. |
| **User Impact** | Device detail page is completely broken — any attempt to view a specific device's health metrics crashes the page. |
| **Dependencies** | None — isolated to this one page. |
| **Regression Risk** | Low — fix is localized to one file. Changing to `useParams()` from `next/navigation` is the correct Next.js 14 pattern. |
| **Recommended Repair Phase** | AH-3R.1A (Immediate) |
| **Proposed Validation** | Navigate to `/dashboard/device-health/[id]` with any valid device UUID. Page should render without crash. |
| **Blocked Evidence** | API not running — cannot verify backend device data loads correctly after fix. |

### FINDING AH3R-002: Quick Navigation / CommandPalette Background Is White

| Field | Value |
|-------|-------|
| **Finding ID** | AH3R-002 |
| **Title** | `bg-surface-950` resolves to `#ffffff` (white) — CommandPalette renders white/light overlay |
| **Observed Symptom** | Quick Navigation overlay has white or very light background, making text nearly unreadable |
| **Severity** | **P3 — Visual/UX inconsistency** (escalated from P3 due to usability impact) |
| **Confidence** | **Confirmed** |
| **Layer** | Frontend |
| **Root-Cause Group** | `THEME-PORTAL` |
| **Affected Routes** | All dashboard routes (overlay is global) |
| **Evidence** | `apps/web/tailwind.config.js:49`: `surface-950: '#ffffff'`. `apps/web/src/components/CommandPalette.tsx:74`: `bg-surface-950/95`. The `surface` color scale is inverted — `DEFAULT: '#0a0a0a'` (dark) through `950: '#ffffff'` (white). All text in CommandPalette uses `text-white` and `text-white/70` etc. Result: white background (95% opacity) with white text = unreadable. |
| **Root Cause** | The `surface` Tailwind color scale is defined with `DEFAULT=#0a0a0a` at the bottom and `950=#ffffff` at the top, which is the **reverse** of standard Tailwind convention (where higher numbers are darker). `bg-surface-950` was intended as a dark panel background but actually resolves to white. |
| **Why It Happens** | The color scale was defined as a gradient from dark (#0a0a0a) to light (#ffffff), mapping the lightest color to the highest number (950). Standard Tailwind uses higher numbers for darker shades. |
| **User Impact** | Quick Navigation overlay is unusable — white text on white/near-white background. |
| **Dependencies** | The same `bg-surface-950` is used in Dialog.tsx (line 38), Toast.tsx (line 15), and Topbar dropdowns (Topbar.tsx:65,118). |
| **Regression Risk** | Medium — changing `surface-950` will affect all components using `bg-surface-950`. Dialog, Toast, and dropdowns also use this and may have been visually compensating. Need to verify all usages. |
| **Recommended Repair Phase** | AH-3R.2A |
| **Proposed Validation** | Open Quick Navigation (Ctrl+K). Background should be dark with readable light text. Check Dialog, Toast, and dropdowns. |
| **Blocked Evidence** | None — visual issue verifiable in browser. |

### FINDING AH3R-003: Frontend/Backend Online-Offline Threshold Mismatch

| Field | Value |
|-------|-------|
| **Finding ID** | AH3R-003 |
| **Title** | Frontend uses 2-minute threshold, backend uses 5-minute threshold for online status |
| **Observed Symptom** | Device shows as "Offline" in dashboard while AI Chat receives current metrics |
| **Severity** | **P2 — Major incorrect behavior** |
| **Confidence** | **Confirmed** |
| **Layer** | Shared Contract |
| **Root-Cause Group** | `DEVICE-PRESENCE` |
| **Affected Routes** | `/dashboard/device-health`, `/dashboard/device-health/[id]`, `/dashboard`, `/dashboard/monitoring`, `/dashboard/ai-chat`, AI Chat Drawer |
| **Evidence** | Frontend pattern (6 locations): `Date.now() - new Date(device.lastSeenAt).getTime() < 120_000` (2 minutes). Backend: `apps/api-gateway/src/reporting/reporting.service.ts:502`: `Date.now() - d.lastSeenAt.getTime() < 300000` (5 minutes). Agent sends metrics every 30 seconds (`apps/agent/src/agent.rs:85`). |
| **Root Cause** | Two independent threshold values were implemented in different parts of the codebase. No shared constant exists. |
| **Why It Happens** | The 120-second (2 min) threshold in the frontend is aggressive — if an agent misses even 4 consecutive heartbeats (30s each = 2 min), the device appears offline. The 300-second (5 min) threshold in the reporting service is more forgiving. |
| **User Impact** | Devices that are actually sending metrics may appear "Offline" in the dashboard if there's any network jitter or if the agent's 30s interval drifts. The same device appears "online" in reports but "offline" in the live dashboard. |
| **Dependencies** | The `Device.lastSeenAt` field uses Prisma `@updatedAt` decorator (schema.prisma:124), meaning ANY `prisma.device.update()` call bumps it — not just metric ingestion. This could mask the issue by keeping `lastSeenAt` current even when the agent is down. |
| **Regression Risk** | Low — changing the threshold is a simple constant change. However, the `@updatedAt` side-effect means devices may appear online longer than expected regardless of threshold. |
| **Recommended Repair Phase** | AH-3R.1B |
| **Proposed Validation** | Confirm a device sending metrics at 30s intervals shows as Online in the dashboard. Stop the agent, wait >2 minutes, confirm it shows Offline. Wait >5 minutes, confirm reports also show it Offline. |
| **Blocked Evidence** | API not running — cannot verify live device presence behavior. |

---

## 7. Probable Findings

### FINDING AH3R-004: Report `completedAt` Field Missing from Prisma Schema

| Field | Value |
|-------|-------|
| **Finding ID** | AH3R-004 |
| **Title** | Frontend `ReportRecord` type expects `completedAt` but Prisma Report model has no such field |
| **Observed Symptom** | Potential "Invalid Date" in reports history for completion timestamp |
| **Severity** | **P2 — Schema/type contract mismatch** |
| **Confidence** | **High** |
| **Layer** | Shared Contract |
| **Root-Cause Group** | `DATE-CONTRACT` |
| **Affected Routes** | `/dashboard/reports` |
| **Evidence** | `packages/types/index.ts:90`: `ReportRecord.completedAt: string | null`. `apps/api-gateway/prisma/schema.prisma:601-623`: Report model has NO `completedAt` field. `apps/api-gateway/src/reporting/reporting.service.ts:114-129`: `report.create()` does not set `completedAt`. `apps/api-gateway/src/reporting/reporting.service.ts:158`: `list()` returns raw Prisma results without `completedAt`. Frontend: `reports/page.tsx:172`: `report.completedAt && new Date(report.completedAt).toLocaleDateString()` — guarded by `&&` so `undefined` doesn't render, but the type contract is broken. |
| **Root Cause** | The `ReportRecord` TypeScript interface includes `completedAt` but the database schema never defined this column. The backend returns objects without this field, and the frontend type overpromises. |
| **Why It Happens** | Likely planned but never implemented, or the field was removed from the schema during refactoring while the frontend type was not updated. |
| **User Impact** | The "Completed" date never renders for any report. If the backend ever returns `completedAt: null` explicitly (instead of omitting it), `new Date(null)` renders as "Invalid Date". Currently the `&&` guard prevents display, but the contract is broken. |
| **Dependencies** | Report generation flow, report listing API. |
| **Regression Risk** | Low — adding the field to the schema and populating it during `generate()` is straightforward. |
| **Recommended Repair Phase** | AH-3R.1C |
| **Proposed Validation** | After fix: generate a report, confirm "Created" and "Completed" dates both display valid dates. |
| **Blocked Evidence** | API not running — cannot verify current API response shape. |

### FINDING AH3R-005: Device Health List N+1 Query Pattern

| Field | Value |
|-------|-------|
| **Finding ID** | AH3R-005 |
| **Title** | Device health list makes individual API call per device for scores |
| **Observed Symptom** | Performance degradation, potential for partial loading states |
| **Severity** | **P3 — Performance/UX concern** |
| **Confidence** | **High** |
| **Layer** | Frontend |
| **Root-Cause Group** | `API-PATTERN` |
| **Affected Routes** | `/dashboard/device-health` |
| **Evidence** | `apps/web/src/app/dashboard/device-health/page.tsx:25-44`: `useEffect` iterates `devices.forEach(async (device) => { apiFetch('/devices/${device.id}/scores') })`. With N devices, this makes N separate HTTP requests on every poll cycle (every 15 seconds during normal polling, every 3 seconds during fast polling). |
| **Root Cause** | Scores are fetched individually per device rather than in a batch endpoint. |
| **Why It Happens** | The `GET /devices/:id/scores` endpoint exists per-device but no batch `GET /devices/scores` endpoint was created. |
| **User Impact** | With 10+ devices, the list page makes 10+ parallel HTTP requests on each poll. This can cause network congestion, slow rendering, and partial score display. |
| **Dependencies** | Backend `GET /devices/:id/scores` endpoint, polling interval. |
| **Regression Risk** | Low — adding a batch endpoint and updating the frontend is straightforward. |
| **Recommended Repair Phase** | AH-3R.2B (after critical fixes) |
| **Proposed Validation** | Open browser DevTools Network tab. Device health list should make 1 list request + 1 scores batch request, not N+1. |
| **Blocked Evidence** | API not running — cannot verify batch endpoint exists. |

### FINDING AH3R-006: `Device.lastSeenAt` Uses `@updatedAt` — False Positive Online Status

| Field | Value |
|-------|-------|
| **Finding ID** | AH3R-006 |
| **Title** | `Device.lastSeenAt` Prisma `@updatedAt` decorator causes any device update to refresh heartbeat |
| **Observed Symptom** | Device may appear online even when agent is not sending metrics |
| **Severity** | **P2 — Incorrect behavior** |
| **Confidence** | **High** |
| **Layer** | Database |
| **Root-Cause Group** | `DEVICE-PRESENCE` |
| **Affected Routes** | All routes using device online/offline status |
| **Evidence** | `apps/api-gateway/prisma/schema.prisma:124`: `lastSeenAt DateTime @updatedAt`. Prisma `@updatedAt` auto-sets the field to `new Date()` on ANY `prisma.device.update()` call. `apps/api-gateway/src/devices/devices.service.ts:258-261` explicitly sets `lastSeenAt: new Date()` on metric ingestion, but this is redundant — the `@updatedAt` already does this. The real problem: credential rotation (`devices.service.ts:169-177`), inventory updates (`inventory.service.ts:95,121`), and ANY other `device.update()` call also bumps `lastSeenAt`. |
| **Root Cause** | `@updatedAt` is too broad for a heartbeat field. It should only update when the agent actually sends metrics, not on any database write. |
| **Why It Happens** | The schema designer likely intended `lastSeenAt` to auto-update, but `@updatedAt` fires on every update, not just metric-related ones. |
| **User Impact** | A device whose agent has been offline for hours could still appear "online" if the backend performs any write to that device record (e.g., credential rotation, metadata update). |
| **Dependencies** | Online/offline threshold (AH3R-003), all device status displays. |
| **Regression Risk** | Medium — changing from `@updatedAt` to `@default(now())` requires ensuring all metric ingestion code explicitly sets `lastSeenAt`. Currently `devices.service.ts:260` already does this, but other code paths (inventory, credential rotation) rely on the auto-update. |
| **Recommended Repair Phase** | AH-3R.1B (with AH3R-003) |
| **Proposed Validation** | Stop agent. Perform a credential rotation or metadata update on the device. Confirm device still shows as Offline after >2 minutes. |
| **Blocked Evidence** | API not running — cannot verify behavior. |

### FINDING AH3R-007: Redis Distributed Lock Acquisition Unproven at Runtime

| Field | Value |
|-------|-------|
| **Finding ID** | AH3R-007 |
| **Title** | Redis lock acquisition, contention, and release not proven at runtime |
| **Observed Symptom** | Scheduler tick logs appear but no evidence of actual lock acquisition |
| **Severity** | **P2 — Critical feature unverified** |
| **Confidence** | **Medium** |
| **Layer** | Redis/Infrastructure |
| **Root-Cause Group** | `REDIS-LIFECYCLE` |
| **Affected Routes** | Backend scheduler (no direct route) |
| **Evidence** | `apps/api-gateway/src/reporting/report-schedule-executor.service.ts:33-78`: `RedisDistributedLock` class. Lines 42-51: lazy `import('ioredis')` with `connectTimeout: 2000`, `maxRetriesPerRequest: 0`, `lazyConnect: false`. Line 100: `process.env.REDIS_URL || 'redis://localhost:6379'`. Redis is running in Docker container `techfusion-redis` on port 6379. Redis CLI responds with PONG. However: **the NestJS API Gateway is NOT running** (no process on port 3001), so the scheduler is not executing. Redis lock behavior is **tested in unit tests** (`report-schedule-executor.service.spec.ts:759 lines`) but **not verified at runtime**. |
| **Root Cause** | The API Gateway process is not running, so the `@Cron(EVERY_MINUTE)` tick never fires. No runtime evidence exists for lock acquisition. |
| **Why It Happens** | The API was not started (or crashed and was not restarted) before this audit. |
| **User Impact** | If the API were running, scheduled reports might execute. Without runtime verification, we cannot confirm the Redis connection succeeds, locks are acquired, or locks are safely released. |
| **Dependencies** | Redis Docker container health, `REDIS_URL` env var, ioredis connection behavior. |
| **Regression Risk** | Low — the lock code is well-tested in unit tests. The risk is in the runtime connection (e.g., Docker networking, lazy connect behavior). |
| **Recommended Repair Phase** | AH-3R.1D (verify before AH-3D.3E) |
| **Proposed Validation** | 1. Start the API Gateway. 2. Create a scheduled report with a cron expression due immediately. 3. Wait for tick. 4. Check logs for: `Occurrence lock acquired`, `Schedule claimed for execution`, `Scheduled report execution result`. 5. Verify the report was generated. |
| **Blocked Evidence** | API not running — no live verification possible. |

---

## 8. Rejected Hypotheses

### REJECTED: Device Invalid Date is caused by frontend date parsing of null/undefined `lastSeenAt`

**Investigation:** The `Device.lastSeenAt` field in the Prisma schema is `DateTime @updatedAt` — it is NEVER null. The Prisma client always returns a Date object. The backend `sanitizeDevice()` method (devices.controller.ts:218-222) does not strip `lastSeenAt`. The frontend `Device` interface types it as `string`. `new Date(validISOString)` produces a valid Date.

**Decision:** Rejected as primary cause. The "Invalid Date" in device health is more likely caused by the **false offline status** (AH3R-003/AH3R-006) rather than an actual date parsing failure. If the device's `lastSeenAt` is stale (because the agent stopped but `@updatedAt` was bumped by another write), the online check produces a stale date that makes the device appear offline.

### REJECTED: Reports "Created Invalid Date" is caused by missing `createdAt` in API response

**Investigation:** The Prisma `Report` model has `createdAt DateTime @default(now())` (schema.prisma:617). The `list()` method (reporting.service.ts:158) returns raw Prisma results. NestJS serializes `Date` objects to ISO 8601 strings via `Date.prototype.toJSON()`. The frontend `new Date(report.createdAt)` should produce a valid Date from a valid ISO string.

**Decision:** Rejected as primary cause for `createdAt`. The "Created Invalid Date" symptom was not reproducible from code inspection alone. It may be caused by: (a) stale/corrupted data in the database, (b) a transient serialization issue, or (c) the user observing the `completedAt` issue (AH3R-004) which shows as a non-rendered field (not "Invalid Date" due to `&&` guard). **Cannot fully confirm or reject without runtime API testing.**

### REJECTED: Scheduled Reports persistent loading is caused by missing error/empty state transitions

**Investigation:** `useReportSchedules.ts` (304 lines) properly handles: loading→success (line 119-121), loading→error (line 122-124), empty array→empty state (ScheduledReportsSection.tsx:350-363), 401/403/404/500 errors (lines 109-128 with `readErrorBody` and `scheduleError`), request cancellation via `mountedRef` (line 110, 121), component unmount (cleanup in useEffect). The loading lifecycle appears correct in code.

**Decision:** Rejected as a code defect. The persistent loading symptom was likely a **stale data / server error state** that has since been resolved, or was caused by the API being unreachable (which would produce a network error caught by the error handler). The code correctly transitions through all states.

### REJECTED: Redis is running via systemd

**Investigation:** `systemctl status redis-server` shows `Active: failed` (exit-code 1). The `redis-server` systemd service attempted to start 5 times and failed each time. However, `redis-cli ping` returns `PONG`. `docker ps` shows container `techfusion-redis` (image `redis:7-alpine`) running with PID 1 inside the container, port 6379 mapped.

**Decision:** Confirmed — Redis runs in Docker, NOT via systemd. The systemd service is dead.

---

## 9. Shared Root-Cause Groups

| Group | Findings | Description |
|-------|----------|-------------|
| `DATE-CONTRACT` | AH3R-004 | Frontend types promise date fields that the backend schema doesn't define |
| `ROUTE-PARAMS` | AH3R-001 | React/Next.js version mismatch causes route parameter unwrapping crash |
| `DEVICE-PRESENCE` | AH3R-003, AH3R-006 | Online/offline determination has mismatched thresholds AND over-broad `@updatedAt` |
| `THEME-PORTAL` | AH3R-002 | Inverted color scale makes dark-intended backgrounds render as white |
| `SCHEDULE-LOADING` | (none — rejected) | Loading lifecycle is correctly implemented |
| `REDIS-LIFECYCLE` | AH3R-007 | Redis lock behavior unproven at runtime |
| `AI-CONTEXT` | (none — confirmed working) | AI Chat uses live DB queries for device context |

---

## 10. Route-by-Route Assessment

| Route | Loads | Runtime Crash | API Dependency | Date Dependency | Theme Issue | Status | Primary Finding IDs | Manual Retest Needed |
|-------|-------|---------------|----------------|-----------------|-------------|--------|---------------------|---------------------|
| `/dashboard` | Yes | No | `GET /devices` | `lastSeenAt` | No | **OK** (data may be stale) | AH3R-003, AH3R-006 | Yes |
| `/dashboard/device-health` | Yes | No | `GET /devices`, `GET /devices/:id/scores` (N+1) | `lastSeenAt` | No | **DEGRADED** | AH3R-003, AH3R-005, AH3R-006 | Yes |
| `/dashboard/device-health/[id]` | **NO** | **YES** | `GET /devices/:id/latest` | `lastSeenAt`, `recordedAt` | No | **CRASHED** | AH3R-001 | **Critical** |
| `/dashboard/monitoring` | Yes | No | Alerts API | `lastSeenAt`, `createdAt` | No | **OK** | AH3R-003 | Yes |
| `/dashboard/ai-chat` | Yes | No | `GET /devices`, `POST /ai/troubleshoot` | `lastSeenAt` | `bg-[#0a0a0a]` hardcoded | **OK** (minor theme) | AH3R-003 | Yes |
| `/dashboard/reports` | Yes | No | `GET /reports`, `POST /reports/generate` | `createdAt`, `completedAt` | No | **DEGRADED** | AH3R-004 | Yes |
| `/dashboard/reports` (schedules) | Yes | No | `GET /reports/schedules` | `lastRunAt`, `nextRunAt`, `createdAt` | Dialog `bg-surface-950` | **OK** | AH3R-002 (theme) | Yes |
| `/dashboard/enrollment` | Yes | No | `GET /enrollment/tokens` | `createdAt`, `expiresAt` | No | **OK** | None | Yes |
| `/dashboard/remote-support` | Yes | No | Remote session API | `startedAt`, `endedAt` | No | **OK** | None | Yes |
| Quick Navigation | Yes | No | None | None | **White background** | **DEGRADED** | AH3R-002 | Yes |

---

## 11. Device Data Flow

```
Agent (Rust, apps/agent/)
  │
  │  POST /devices/metrics (Bearer: deviceToken)
  │  Every 30 seconds (configurable via TF_INTERVAL)
  │
  ▼
Backend (NestJS, apps/api-gateway/)
  │
  ├─ DeviceTokenGuard validates token hash (SHA-256)
  ├─ DevicesController.ingestMetrics()
  ├─ DevicesService.ingestMetrics()
  │   ├─ prisma.deviceMetric.create()          → stores metric
  │   ├─ prisma.device.update({ lastSeenAt })  → heartbeat
  │   ├─ scoring.computeAll()                   → calculate scores
  │   ├─ prisma.deviceHealthScore.create()      → store scores
  │   └─ alertEval.evaluateMetrics()            → check alert rules
  ├─ DevicesGateway.broadcastMetrics()          → WebSocket to org room
  │
  ▼
Frontend (Next.js, apps/web/)
  │
  ├─ useDeviceList()  → GET /devices           → polls every 15s
  ├─ useDevice(id)    → GET /devices/:id/latest → one-time fetch
  ├─ useWebSocket()   → Socket.io /metrics      → real-time push
  │
  ├─ Online check: Date.now() - new Date(device.lastSeenAt).getTime() < 120_000
  │   (2-minute threshold — differs from backend's 5-minute threshold)
  │
  └─ AI Chat: POST /ai/troubleshoot { query, deviceId }
      → Backend queries LATEST metric + score from DB
      → Injects into prompt as device context
```

---

## 12. AI Chat Device Context Flow

| Step | Component | Action |
|------|-----------|--------|
| 1 | Frontend | User selects device in dropdown → `setSelectedDeviceId(d.id)` |
| 2 | Frontend | User sends message → `POST /ai/troubleshoot { query, deviceId }` |
| 3 | Backend | `TroubleshootingController.troubleshoot()` receives DTO |
| 4 | Backend | `prisma.device.findFirst({ where: { id, orgId }, include: { scores: take 1, metrics: take 1 } })` |
| 5 | Backend | Formats device context: name, OS, CPU, RAM, latest metrics (CPU%, RAM%, Load, Temp, Processes, Uptime), latest scores |
| 6 | Backend | Appends to user message: `[DEVICE CONTEXT - "..."]`, `[NO DEVICE CONTEXT AVAILABLE]` if no device |
| 7 | Backend | SSE stream: status → citations → tokens → done |
| 8 | Frontend | `TypewriterText` component renders streaming response |

**Data source:** Live database query — NOT cached, NOT mocked. The `take: 1` with `orderBy: { recordedAt: 'desc' }` returns the single most recent `DeviceMetric` record. With the agent sending every 30 seconds, this reflects data at most ~30 seconds old.

**Fallback behavior:**
- No device selected → `[NO DEVICE CONTEXT AVAILABLE — answer in general terms]`
- Device not found → Same as no device selected
- No metrics for device → `No recent metrics` text in context

---

## 13. Reports and Scheduling Flow

### Report Generation
1. User clicks "Generate Report" on `/dashboard/reports`
2. `POST /reports/generate` with `{ type, format, title?, deviceIds? }`
3. Backend checks plan limits, collects data by type, generates document (PDF/DOCX/HTML)
4. Stores file, creates `Report` record with `status: 'completed'`
5. Generates signed download URL (HMAC-SHA256, 24h expiry)
6. Enqueues async job via BullMQ

### Report Listing
1. `GET /reports` returns up to 50 reports ordered by `createdAt desc`
2. Frontend renders: `Created {new Date(report.createdAt).toLocaleDateString()}`
3. `report.completedAt` is always `undefined` (field missing from Prisma schema — AH3R-004)

### Scheduled Report Execution
1. `@Cron(EVERY_MINUTE)` tick in `ReportScheduleExecutorService`
2. Queries due schedules: `isEnabled: true AND nextRunAt <= now()`
3. For each schedule:
   a. Calculate `nextRunAt` from cron expression
   b. Build lock key: `report-schedule:${id}:${nextRunAt.toISOString()}`
   c. **Redis lock**: `SET key token PX ttlMs NX` (default TTL: 5 min)
   d. If lock fails → skip (fail closed)
   e. If lock acquired → compare-and-set DB claim (`updateMany` with optimistic concurrency)
   f. Execute report generation for each format
   g. **Always release lock** in `finally` block via Lua script (ownership-safe)
   h. Update `lastRunAt` only on success

### Schedule Status Derivation (Frontend)
```
disabled   → isEnabled === false
invalid    → non-null date string fails to parse
unscheduled → nextRunAt is null
overdue    → nextRunAt + 60s grace <= now
never_run  → lastRunAt is null
scheduled  → otherwise
```

---

## 14. Redis Runtime Assessment

| Check | Status | Evidence |
|-------|--------|----------|
| Redis CLI reachable | **YES** | `redis-cli ping` → `PONG` |
| Redis process running | **YES** | Docker container `techfusion-redis`, PID 1 inside container, port 6379 |
| systemd service healthy | **NO** | `systemctl status redis-server` → `Active: failed` (exit-code 1, 5 restart attempts exhausted) |
| Redis running via Docker | **YES** | `docker ps` shows `redis:7-alpine` container, 12 hours uptime, healthy |
| API Redis configuration present | **YES** | `apps/api-gateway/.env:35`: `REDIS_URL="redis://localhost:6379"` |
| API Redis client connected | **UNPROVEN** | API Gateway is not running — no live connection test possible |
| Scheduler tick running | **UNPROVEN** | API Gateway is not running — `@Cron(EVERY_MINUTE)` not firing |
| Due schedule lock acquisition proven | **UNPROVEN** | No runtime evidence — unit tests cover this scenario |
| Safe release proven at runtime | **UNPROVEN** | No runtime evidence — Lua script ownership check is correct in code |
| Automated tests available | **YES** | `report-schedule-executor.service.spec.ts` (759 lines) covers lock lifecycle, contention, failure, release |
| Remaining manual proof required | Start API, create schedule due immediately, verify tick → lock → claim → generate → release in logs |

**Redis configuration in code:**
- `report-schedule-executor.service.ts:42-51`: Lazy `import('ioredis')`, `connectTimeout: 2000`, `maxRetriesPerRequest: 0`, `lazyConnect: false`
- `health.controller.ts:56-80`: Throwaway connection per readiness check, `lazyConnect: true`
- `queue.service.ts:23-43`: BullMQ Queue with `connection: { url: redisUrl }`

---

## 15. Date Contract Matrix

| Domain | Backend Source Field | Serialized Example Type | Frontend Expected Field | Frontend Parser | Null Behavior | Invalid Behavior | Observed Mismatch | Recommended Owner |
|--------|---------------------|------------------------|------------------------|-----------------|---------------|------------------|-------------------|-------------------|
| Device `createdAt` | `Device.registeredAt` (Prisma DateTime) | ISO 8601 string | `Device.registeredAt: string` | `new Date()` | N/A (always set) | "Invalid Date" | **None** — field present in both | — |
| Device `lastSeenAt` | `Device.lastSeenAt` (Prisma `@updatedAt`) | ISO 8601 string | `Device.lastSeenAt: string` | `new Date()` | Never null | "Invalid Date" | **Threshold mismatch** (2 min vs 5 min) | Shared constant |
| Device `updatedAt` | N/A (not exposed) | — | — | — | — | — | — | — |
| Metric `recordedAt` | `DeviceMetric.recordedAt` (Prisma `@default(now())`) | ISO 8601 string | `DeviceMetric.recordedAt: string` | `new Date()` | Never null | "Invalid Date" | **None** | — |
| Report `createdAt` | `Report.createdAt` (Prisma `@default(now())`) | ISO 8601 string | `ReportRecord.createdAt: string` | `new Date()` | Never null | "Invalid Date" | **None in schema** (runtime unverified) | — |
| Report `completedAt` | **MISSING from schema** | N/A | `ReportRecord.completedAt: string \| null` | `new Date()` | `undefined` → guarded by `&&` | N/A | **Schema mismatch** — field does not exist | Add to schema |
| Schedule `lastRunAt` | `ReportSchedule.lastRunAt` (Prisma DateTime?) | ISO 8601 string or null | `ReportSchedule.lastRunAt: string \| null` | `formatScheduleDate()` with NaN guard | Returns fallback text | Returns fallback text | **None** — properly guarded | — |
| Schedule `nextRunAt` | `ReportSchedule.nextRunAt` (Prisma DateTime?) | ISO 8601 string or null | `ReportSchedule.nextRunAt: string \| null` | `formatScheduleDate()` with NaN guard | Returns fallback text | Returns fallback text | **None** — properly guarded | — |
| Schedule `createdAt` | `ReportSchedule.createdAt` (Prisma `@default(now())`) | ISO 8601 string | `ReportSchedule.createdAt: string` | `new Date()` via `scheduleToResponse` | Never null | "Invalid Date" | **None** | — |

---

## 16. Theme/Overlay Assessment

### Color System Architecture
- **Dark mode:** CSS variable `--background: #0a0a0a` in `:root`, toggled via `next-themes` `attribute="class"`
- **Light mode:** CSS variable `--background: #ffffff` in `.light` class
- **Tailwind:** `darkMode: 'class'` — only body uses `bg-background`/`text-foreground` CSS variables
- **Components:** ALL shared UI components (`@techfusion/ui`) use **hardcoded dark values** (`text-white`, `border-white/`, `bg-white/`)

### `surface` Color Scale Issue
| Token | Value | Intended Use | Actual Behavior |
|-------|-------|-------------|-----------------|
| `surface` (DEFAULT) | `#0a0a0a` | Dark background | Correct |
| `surface-50` | `#18181b` | Slightly lighter | Correct |
| `surface-100` | `#27272a` | Card borders | Correct |
| `surface-950` | `#ffffff` | **Should be darkest?** | **WHITE — used as dark panel bg = broken** |

### Affected Components (using `bg-surface-950`)
| Component | File | Line | Impact |
|-----------|------|------|--------|
| CommandPalette | `CommandPalette.tsx` | 74 | White overlay background |
| Dialog | `packages/ui/Dialog.tsx` | 38 | White dialog background |
| Toast | `packages/ui/Toast.tsx` | 15 | White toast background |
| Topbar dropdowns | `Topbar.tsx` | 65, 118 | White dropdown background |

### Hardcoded `bg-[#0a0a0a]` Instances
| Component | File | Line |
|-----------|------|------|
| AI Chat dropdown | `ai-chat/page.tsx` | 275 |
| AI Chat Drawer dropdown | `AiChatDrawer.tsx` | 101 |
| Settings select option | `settings/page.tsx` | 259 |

### Additional Theme Issues
1. **Global border rule** (`globals.css:37`): `* { @apply border-white/[0.06]; }` — hardcoded dark border on ALL elements
2. **Autofill styles** (`globals.css:47-61`): Hardcoded dark mode autofill fix
3. **Select styles** (`globals.css:63-73`): Hardcoded dark select background
4. **Scrollbar** (`globals.css:101-103`): Hardcoded `bg-white/10`
5. **Two Toaster instances**: Root layout (unstyled) + dashboard layout (hardcoded dark inline styles)
6. **`@radix-ui/react-dropdown-menu`** declared in `packages/ui/package.json` but never used — all dropdowns are hand-built

---

## 17. Security and Data Integrity Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Device token in plaintext on disk | Low | Agent stores `deviceToken` in `~/.techfusion/device_token` with 0600 permissions. Acceptable for single-user agent. |
| No `ClassSerializerInterceptor` | Low | NestJS does not use `ClassSerializerInterceptor`. Date serialization relies on `Date.prototype.toJSON()`. Acceptable but fragile if custom transformers are added. |
| CSP headers configured | Positive | `next.config.js` sets comprehensive CSP including `connect-src 'self' http://localhost:3001 ws://localhost:3001`. |
| Signed URLs for report downloads | Positive | HMAC-SHA256 signatures with 24h expiry. |
| Redis no authentication | Medium | Docker Redis container has no `--requirepass`. Acceptable for local development, **must not be used in production**. |
| Enrollment tokens prefixed | Positive | `tfenr_` prefix with SHA-256 hash storage. |

---

## 18. Regression Risks

| Change | Risk | Mitigation |
|--------|------|------------|
| Fix `use(params)` → `useParams()` | Low | Isolated to one file. Test navigation to device detail. |
| Fix `surface-950` color | Medium | Affects Dialog, Toast, Topbar dropdowns. Must verify all components still look correct. |
| Change online threshold to shared constant | Low | Centralize in one file, import everywhere. |
| Change `lastSeenAt` from `@updatedAt` to `@default(now())` | Medium | Ensure ALL code paths that should update heartbeat explicitly set it. Currently `devices.service.ts:260` and `inventory.service.ts:95,121` do. |
| Add `completedAt` to Report schema | Low | Migration required. Existing reports will have null `completedAt`. |

---

## 19. Repair Sequence

### Immediate Blockers (before AH-3D.3E)

#### AH-3R.1A — Critical Route Crash Fix
- **Scope:** Fix `use(params)` crash on device detail page
- **Files:** `apps/web/src/app/dashboard/device-health/[id]/page.tsx`
- **Excluded:** Backend changes, other pages
- **Prerequisites:** None
- **Manual Validation:** Navigate to `/dashboard/device-health/[id]` with valid UUID — page loads
- **Regression Tests:** Existing device detail page tests (if any)
- **Completion Criteria:** Device detail page renders without crash

#### AH-3R.1B — Device Presence Contract Fix
- **Scope:** Unify online/offline threshold, fix `@updatedAt` side-effect
- **Files:** `apps/web/src/app/dashboard/device-health/page.tsx`, `apps/web/src/app/dashboard/device-health/[id]/page.tsx`, `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/dashboard/monitoring/page.tsx`, `apps/web/src/app/dashboard/ai-chat/page.tsx`, `apps/web/src/components/AiChatDrawer.tsx`, `apps/api-gateway/prisma/schema.prisma` (Device model), `apps/api-gateway/src/devices/devices.service.ts`, `apps/api-gateway/src/reporting/reporting.service.ts`
- **Excluded:** Network device online status (separate model)
- **Prerequisites:** None
- **Manual Validation:** Device shows correct online/offline status matching agent state
- **Regression Tests:** Update device presence tests
- **Completion Criteria:** Frontend and backend use same threshold; `lastSeenAt` only updates on metric ingestion

#### AH-3R.1C — Shared Date Contract Fix
- **Scope:** Add `completedAt` to Report schema, populate during generation, fix type contract
- **Files:** `apps/api-gateway/prisma/schema.prisma` (Report model), `apps/api-gateway/src/reporting/reporting.service.ts` (generate method), `packages/types/index.ts` (ReportRecord type stays same)
- **Excluded:** Other date utilities, schedule date handling
- **Prerequisites:** None
- **Manual Validation:** Generate report, confirm both Created and Completed dates render
- **Regression Tests:** Report generation tests
- **Completion Criteria:** `completedAt` populated on report generation, frontend displays it

#### AH-3R.1D — Scheduled Reports Loading Verification
- **Scope:** Verify scheduled reports loading lifecycle works at runtime (no code changes expected)
- **Files:** None (read-only verification)
- **Excluded:** Report generation logic
- **Prerequisites:** API Gateway must be running
- **Manual Validation:** 1. Start API. 2. Navigate to Reports. 3. Scheduled Reports section loads (not stuck). 4. Empty state shows if no schedules. 5. Create schedule, confirm list updates. 6. Error state shows if API returns error.
- **Regression Tests:** Existing `useReportSchedules.spec.ts` (233 lines)
- **Completion Criteria:** All loading states verified at runtime

### Important Repairs (can follow AH-3D.3E)

#### AH-3R.2A — Search/Quick Navigation Theme Fix
- **Scope:** Fix `surface-950` color scale, update all affected components
- **Files:** `apps/web/tailwind.config.js`, `apps/web/src/components/CommandPalette.tsx`, `packages/ui/src/components/Dialog.tsx`, `packages/ui/src/components/Toast.tsx`, `apps/web/src/components/Topbar.tsx`
- **Excluded:** Full light mode support (out of scope)
- **Prerequisites:** AH-3R.1A (device detail fix) completed
- **Manual Validation:** CommandPalette, Dialog, Toast, dropdowns all have dark backgrounds with readable text
- **Regression Tests:** Visual regression tests for all overlay components
- **Completion Criteria:** All overlays render with dark backgrounds in dark mode

#### AH-3R.2B — Shared Overlay Theme Regression
- **Scope:** Audit and fix remaining hardcoded dark theme values across shared UI components
- **Files:** `packages/ui/src/components/*.tsx`, `apps/web/src/app/globals.css`, all pages with hardcoded `bg-[#0a0a0a]`
- **Excluded:** Full light mode support
- **Prerequisites:** AH-3R.2A
- **Manual Validation:** All UI components render correctly in dark mode
- **Regression Tests:** Visual tests for all shared components
- **Completion Criteria:** No hardcoded `bg-white`, `bg-[#0a0a0a]`, or `bg-surface-950` that produce wrong colors

### Cosmetic/Deferred Work

- Device Health N+1 query fix (AH3R-005) — performance optimization
- Centralized date formatting utilities
- ErrorBoundary undefined Tailwind classes (`text-muted-foreground`, `bg-primary`)
- Two Toaster instances consolidation
- `@radix-ui/react-dropdown-menu` unused dependency cleanup

---

## 20. Manual Validation Matrix

| Test | Route | Steps | Expected Result | Finding ID |
|------|-------|-------|-----------------|------------|
| Device detail loads | `/dashboard/device-health/[id]` | Navigate with valid UUID | Page renders device info, metrics, scores | AH3R-001 |
| Device detail invalid ID | `/dashboard/device-health/invalid-id` | Navigate with invalid UUID | "Device not found" message, no crash | AH3R-001 |
| Device online status | `/dashboard/device-health` | Check device with active agent | Green "Online" badge | AH3R-003, AH3R-006 |
| Device offline status | `/dashboard/device-health` | Stop agent, wait >2 min | Red "Offline" badge | AH3R-003, AH3R-006 |
| Quick Navigation theme | Any dashboard page | Press Ctrl+K | Dark background, readable white text | AH3R-002 |
| Dialog theme | Any page with dialog | Open dialog | Dark background, readable text | AH3R-002 |
| Report dates | `/dashboard/reports` | Generate report | "Created [valid date]" displayed | AH3R-004 |
| Scheduled reports loading | `/dashboard/reports` | Scroll to schedules section | Loading skeleton → data or empty state (not stuck) | AH3R-01D |
| AI Chat device context | `/dashboard/ai-chat` | Select device, send message | Response references device-specific metrics | Verified in code |
| Redis lock (runtime) | N/A | Start API, create due schedule, check logs | `Occurrence lock acquired` → `Schedule claimed` → `execution result` | AH3R-007 |

---

## 21. AH-3D.3E Readiness Decision

### **NOT READY**

**Reasons:**

1. **Device detail route crashes** (AH3R-001) — The `/dashboard/device-health/[id]` page throws a runtime error due to `use(params)` incompatibility. Device Health report requires viewing individual device details. **This is a blocking crash.**

2. **Scheduled Reports cannot be verified at runtime** (AH3R-007) — The API Gateway is not running. Redis lock acquisition, schedule execution, and safe release are unproven at runtime. While the code and unit tests are sound, runtime proof is required before AH-3D.3E.

3. **Device presence data unreliable** (AH3R-003, AH3R-006) — Online/offline threshold mismatch and `@updatedAt` side-effect mean device status in the dashboard may not accurately reflect agent activity. Device Health report data depends on accurate device presence.

4. **Report date contract broken** (AH3R-004) — `completedAt` field missing from schema means report completion timestamps are not tracked or displayed.

**What must be completed before AH-3D.3E:**
- AH-3R.1A (device detail crash fix)
- AH-3R.1B (device presence contract)
- AH-3R.1C (report date contract)
- AH-3R.1D (scheduled reports runtime verification)

---

## 22. Files Inspected

### Frontend (apps/web/src/)
| File | Lines | Purpose |
|------|-------|---------|
| `app/layout.tsx` | 31 | Root layout with ThemeProvider |
| `app/dashboard/layout.tsx` | 114 | Dashboard layout with auth, sidebar, topbar |
| `app/dashboard/page.tsx` | ~550 | Main dashboard |
| `app/dashboard/device-health/page.tsx` | 200 | Device health list |
| `app/dashboard/device-health/[id]/page.tsx` | 277 | Device detail (CRASHED) |
| `app/dashboard/device-health/loading.tsx` | 8 | Loading spinner |
| `app/dashboard/monitoring/page.tsx` | ~200 | Monitoring dashboard |
| `app/dashboard/ai-chat/page.tsx` | 385 | AI Chat page |
| `app/dashboard/reports/page.tsx` | 192 | Reports page |
| `app/dashboard/reports/ScheduledReportsSection.tsx` | 723 | Scheduled reports component |
| `app/dashboard/reports/loading.tsx` | 8 | Loading spinner |
| `app/dashboard/enrollment/page.tsx` | ~100 | Enrollment (settings) |
| `app/dashboard/remote-support/page.tsx` | ~500 | Remote support |
| `app/dashboard/settings/enrollment/page.tsx` | 428 | Enrollment settings |
| `app/dashboard/settings/page.tsx` | ~300 | Settings |
| `app/dashboard/cybersecurity/page.tsx` | ~450 | Cybersecurity |
| `app/dashboard/network/page.tsx` | ~500 | Network |
| `app/dashboard/drivers/page.tsx` | ~250 | Drivers/Software |
| `app/dashboard/backup/page.tsx` | ~400 | Backup |
| `app/dashboard/knowledge-base/page.tsx` | ~200 | Knowledge Base |
| `app/dashboard/billing/page.tsx` | ~300 | Billing |
| `app/globals.css` | 173 | Global CSS with theme variables |
| `components/CommandPalette.tsx` | 109 | Quick Navigation overlay |
| `components/Sidebar.tsx` | 139 | Sidebar navigation |
| `components/Topbar.tsx` | ~140 | Top bar with menus |
| `components/AiChatDrawer.tsx` | 226 | AI Chat slide-out drawer |
| `components/ScoreGauge.tsx` | 82 | SVG score gauge |
| `components/ErrorBoundary.tsx` | 57 | Error boundary |
| `hooks/useDevices.ts` | 157 | Device hooks |
| `hooks/useWebSocket.ts` | 15 | WebSocket hook |
| `hooks/useReports.ts` | 97 | Reports hook |
| `hooks/useReportSchedules.ts` | 304 | Schedule hooks |
| `hooks/useAiChat.ts` | 281 | AI Chat hook |
| `lib/auth-client.ts` | 178 | API fetch with auth |
| `lib/socket-client.ts` | 193 | Socket.io client |
| `lib/report-schedule-status.ts` | 157 | Schedule status utility |
| `lib/observability.ts` | ~80 | Observability utilities |

### Backend (apps/api-gateway/src/)
| File | Lines | Purpose |
|------|-------|---------|
| `main.ts` | ~60 | NestJS bootstrap |
| `devices/devices.controller.ts` | 223 | Device REST endpoints |
| `devices/devices.service.ts` | 364 | Device business logic |
| `devices/devices.module.ts` | 18 | Device module |
| `devices/devices.gateway.ts` | 75 | WebSocket gateway |
| `devices/scoring.service.ts` | 187 | Health scoring |
| `devices/device-token.guard.ts` | 79 | Device auth guard |
| `devices/dto/register-device.dto.ts` | 48 | Registration DTO |
| `devices/dto/metrics-payload.dto.ts` | 160 | Metrics payload DTO |
| `reporting/reporting.controller.ts` | 135 | Report REST endpoints |
| `reporting/reporting.service.ts` | 555 | Report business logic |
| `reporting/report-schedule-executor.service.ts` | 496 | Scheduler with Redis lock |
| `reporting/report-schedule.utils.ts` | 60 | Schedule utilities |
| `reporting/dto/generate-report.dto.ts` | 99 | Report DTOs |
| `reporting/services/report-storage.service.ts` | 102 | File storage |
| `ai/controllers/troubleshooting.controller.ts` | 210 | AI chat controller |
| `enrollment/enrollment.controller.ts` | 57 | Enrollment endpoints |
| `enrollment/enrollment.service.ts` | 267 | Enrollment logic |
| `health.controller.ts` | 91 | Health check |
| `queue/queue.service.ts` | 227 | BullMQ queue |
| `config/env.validation.ts` | ~60 | Env validation |
| `common/all-exceptions.filter.ts` | ~80 | Exception filter |

### Shared Packages
| File | Lines | Purpose |
|------|-------|---------|
| `packages/types/index.ts` | 90 | Shared TypeScript types |
| `packages/ui/src/index.ts` | 49 | UI barrel exports |
| `packages/ui/src/components/Dialog.tsx` | 119 | Radix Dialog wrapper |
| `packages/ui/src/components/Button.tsx` | 62 | Button component |
| `packages/ui/src/components/Card.tsx` | 106 | Card/GlassPanel |
| `packages/ui/src/components/Input.tsx` | 25 | Input component |
| `packages/ui/src/components/Badge.tsx` | 42 | Badge component |
| `packages/ui/src/components/Table.tsx` | 119 | Table component |
| `packages/ui/src/components/Toast.tsx` | 29 | Toast component |
| `packages/ui/src/components/ScorePill.tsx` | 60 | Score pill |
| `packages/utils/index.ts` | 8 | Shared utilities |

### Schema & Config
| File | Lines | Purpose |
|------|-------|---------|
| `apps/api-gateway/prisma/schema.prisma` | 795 | Full database schema |
| `apps/web/tailwind.config.js` | 125 | Tailwind configuration |
| `apps/web/next.config.js` | 41 | Next.js configuration |
| `apps/web/postcss.config.js` | 6 | PostCSS configuration |
| `package.json` | 23 | Root package.json |
| `pnpm-workspace.yaml` | 3 | Workspace config |
| `apps/web/package.json` | 44 | Web app dependencies |
| `apps/api-gateway/package.json` | 81 | API dependencies |
| `apps/worker/package.json` | 36 | Worker dependencies |

### Agent (Rust)
| File | Lines | Purpose |
|------|-------|---------|
| `apps/agent/src/main.rs` | 71 | Entry point |
| `apps/agent/src/agent.rs` | 389 | Main agent loop |
| `apps/agent/src/config.rs` | 121 | Configuration |
| `apps/agent/src/registration.rs` | 462 | Device registration |
| `apps/agent/src/client.rs` | 603 | HTTP client |
| `apps/agent/src/collector.rs` | 180 | Metrics collection |
| `apps/agent/src/identity.rs` | 183 | Identity/fingerprint |

---

## 23. Commands Run

| Command | Result | Purpose |
|---------|--------|---------|
| `redis-cli ping` | `PONG` | Verify Redis reachable |
| `systemctl status redis-server` | `Active: failed` | Check systemd Redis status |
| `ps aux \| grep redis` | `dnsmasq 7711 ... redis-server *:6379` | Find Redis process |
| `docker ps` | 6 containers running | Verify Docker services |
| `ss -tlnp` | Ports 6379, 5432, 5433, 3002, etc. | Check listening ports |
| `redis-cli INFO server` | Redis 7.4.9, PID 1, standalone | Redis server details |
| `node -e "require('react').use"` | `React.use is not a function` | **Confirm use() missing in React 18** |
| `node -e "...next..."` | `14.2.35` | Actual Next.js version |
| `node -e "...react..."` | `18.3.1` | Actual React version |
| `node -e "...@nestjs/core..."` | `10.4.22` | Actual NestJS version |
| `node -e "...prisma..."` | `6.19.3` | Actual Prisma version |
| `node -e "...ioredis..."` | `5.11.1` | Actual ioredis version |
| `curl localhost:3001/health` | No response | API not running |
| `ps aux \| grep ts-node` | No matching processes | No API/frontend processes |

---

## 24. Evidence Limitations

1. **API Gateway not running** — Could not verify live API responses, Redis lock behavior, scheduler execution, or device data flow at runtime.
2. **Next.js dev server not running** — Could not verify frontend runtime behavior, page rendering, or client-side errors.
3. **No authenticated API calls** — Could not verify device list response shape, schedule list response, or report list response with live data.
4. **"Created Invalid Date" symptom not reproduced** — The code analysis suggests `createdAt` should be valid (Prisma `@default(now())` → ISO string), but the symptom was reported. May be caused by stale data, transient issues, or the `completedAt` confusion.
5. **No browser testing** — Theme/overlay issues confirmed via code analysis only. Visual verification required in browser.
6. **Agent not running** — Could not verify metrics ingestion flow, `lastSeenAt` updates, or heartbeat behavior.
7. **Redis systemd failure cause unknown** — The systemd service failed 5 times. The Docker container is providing Redis instead. The systemd failure root cause was not investigated (out of scope — read-only).

---

## 25. Final Decision

| Metric | Value |
|--------|-------|
| **Audit Mode** | STRICT READ-ONLY |
| **Repository Baseline** | Next.js 14.2.35, React 18.3.1, NestJS 10.4.22, Prisma 6.19.3, Redis 7.4.9 (Docker), pnpm 9.0.0 |
| **Services Observed** | Redis (Docker), PostgreSQL (Docker), Prometheus, Grafana, k3d, OpenTelemetry |
| **Routes Audited** | 11 dashboard routes + Quick Navigation overlay |
| **Confirmed Findings** | 3 (AH3R-001, AH3R-002, AH3R-003) |
| **Probable Findings** | 4 (AH3R-004, AH3R-005, AH3R-006, AH3R-007) |
| **Rejected Hypotheses** | 4 (date parsing null, reports createdAt missing, schedule loading stuck, Redis via systemd) |
| **P0 Count** | 0 |
| **P1 Count** | 1 (AH3R-001: device detail crash) |
| **P2 Count** | 3 (AH3R-003: threshold mismatch, AH3R-004: completedAt missing, AH3R-006: @updatedAt side-effect) |
| **P3 Count** | 2 (AH3R-002: CommandPalette white bg, AH3R-005: N+1 query) |
| **Shared Root Causes** | 5 groups: ROUTE-PARAMS, DEVICE-PRESENCE, THEME-PORTAL, DATE-CONTRACT, REDIS-LIFECYCLE |
| **Device Detail Decision** | **CRASHED** — React `use()` incompatible with React 18 |
| **Device Presence Decision** | **UNRELIABLE** — Threshold mismatch + @updatedAt false positive |
| **Date Contract Decision** | **BROKEN** — `completedAt` missing from schema; `createdAt` appears correct in code |
| **Reports Loading Decision** | **CODE CORRECT** — Loading lifecycle properly implemented; runtime unverified |
| **Quick Navigation Theme Decision** | **BROKEN** — `bg-surface-950` resolves to white |
| **AI Chat Context Decision** | **WORKING** — Uses live DB queries; data path confirmed |
| **Redis Runtime Decision** | **UNPROVEN** — Docker Redis running, but API not started; lock behavior not tested |
| **Scheduler Lock Proof** | **UNPROVEN** — Code and tests correct; no runtime evidence |
| **Security Risks** | Redis no auth (Docker), plaintext device token on disk (acceptable for dev) |
| **Immediate Blockers** | AH3R-001 (crash), AH3R-007 (lock unproven) |
| **Recommended First Repair** | AH3R.1A — Fix device detail `use(params)` crash |
| **Repair Sequence** | 1A → 1B → 1C → 1D → 2A → 2B → 3 |
| **AH-3D.3E Readiness** | **NOT READY** |
| **Files Modified** | 0 (read-only audit) |
| **Report Created** | `docs/AH-3R/AH-3R.0_RUNTIME_STABILIZATION_AUDIT.md` |
| **Tests/Checks Run** | `React.use()` existence check, version inspections, Redis ping, process/port checks, systemd status, Docker status |
| **Evidence Limitations** | API not running (no live endpoint verification), frontend not running (no browser testing), agent not running (no metrics flow verification) |
| **Final Decision** | **NOT READY for AH-3D.3E** — 1 P1 crash, 3 P2 issues, lock behavior unproven. Recommended first repair: AH3R.1A (device detail crash fix). |

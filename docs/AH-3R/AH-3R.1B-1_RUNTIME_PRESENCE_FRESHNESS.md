# AH-3R.1B-1 — Runtime Presence & Metrics Freshness Verification

## Summary

Verified and fixed the full runtime device presence and metrics freshness path.
Added an explicit freshness model, fixed WebSocket-driven presence updates, and
ensured AI Chat correctly distinguishes live data from stale data.

## Runtime Path (Verified)

```
Agent (30s interval)
  → POST /devices/metrics (Bearer device_token)
    → DeviceTokenGuard resolves device by token hash
      → ingestMetrics: DeviceMetric.create + Device.update(lastSeenAt)
        → broadcastMetrics via WebSocket (/metrics namespace)
          → GET /devices returns updated lastSeenAt
            → Frontend isDeviceOnline(lastSeenAt) → Online/Offline
              → AI Chat includes freshness metadata in context
```

## What Changed

### 1. Freshness Model (backend + frontend)

**Files:**
- `apps/api-gateway/src/devices/device-presence.ts`
- `apps/web/src/lib/device-presence.ts`

Added:
- `TELEMETRY_INTERVAL_MS = 30,000` (30 seconds, matches agent default)
- `MetricFreshness` type: `'live' | 'recent' | 'stale' | 'unavailable'`
- `classifyFreshness(recordedAt, now)` — classifies metric timestamp
- `metricAge(recordedAt, now)` — human-readable age string

Classification rules:
- **live**: age ≤ 2 × telemetry interval (≤ 60s)
- **recent**: age ≤ online threshold (≤ 5 min)
- **stale**: age > online threshold (> 5 min)
- **unavailable**: no valid timestamp

### 2. Frontend `useDevice` WebSocket Fix

**File:** `apps/web/src/hooks/useDevices.ts`

Fixed `addLiveMetric` to update `device.lastSeenAt` when a live metric arrives
via WebSocket. Previously, only metrics and scores were updated — the device
object (and thus `lastSeenAt`) remained stale until the next API refetch.

### 3. Monitoring Page WebSocket Fix

**File:** `apps/web/src/app/dashboard/monitoring/page.tsx`

Added `refetchDevices()` call in `onMetrics` callback so the device list
(and `lastSeenAt`) refreshes on each WebSocket metric event.

### 4. AI Chat Freshness Metadata

**File:** `apps/api-gateway/src/ai/controllers/troubleshooting.controller.ts`

- Device context now includes `- Data Freshness: LIVE/RECENT/STALE/UNKNOWN (metric age: Xm ago)`
- Device context now includes `- Last Seen: <ISO timestamp>`
- System prompt includes new rule #8 (DATA FRESHNESS RULES) instructing the AI:
  - LIVE/RECENT: describe metrics as current
  - STALE: clearly state data is stale, use "last known" phrasing
  - UNKNOWN: state no recent data available
  - Never describe stale values as current/live

### 5. Backend Trace Logging

**File:** `apps/api-gateway/src/devices/devices.controller.ts`

Added `[DEV_METRIC_INGEST]` structured log in non-production environments:
- `deviceId`, `orgId`, `hostname`
- `metricRecordedAt`, `previousLastSeenAt`, `updatedLastSeenAt`

No secrets, tokens, or full payloads are logged.

## What Was NOT Changed

- Agent code (Rust) — no changes needed
- UI design — no redesign
- Reports — not modified
- Scheduler — not modified
- Enrollment UX — not modified
- Remote Support — not modified

## Tests Added/Updated

### Backend (`apps/api-gateway/src/devices/device-presence.spec.ts`)
- `TELEMETRY_INTERVAL_MS` constant validation
- `classifyFreshness`: live/recent/stale/unavailable/boundary cases
- `metricAge`: seconds/minutes/hours/days formatting
- `ingestMetrics stores metric with recordedAt`
- `GET /devices response returns lastSeenAt`
- `GET /devices/:id/latest returns device, metrics, scores`

### Frontend (`apps/web/src/__tests__/device-presence.spec.ts`)
- `TELEMETRY_INTERVAL_MS` constant validation
- `classifyFreshness`: live/recent/stale/unavailable/boundary cases
- `metricAge`: seconds/minutes/hours/days formatting

### AI Controller (`apps/api-gateway/src/ai/controllers/troubleshooting.controller.spec.ts`)
- `includes freshness metadata in device context`
- `marks stale data as STALE in device context`
- `includes freshness rules in system prompt`

## Validation Results

| Check | Result |
|-------|--------|
| Backend device-presence tests | 37/37 passed |
| Frontend device-presence tests | 52/52 passed |
| AI troubleshooting controller tests | 17/17 passed |
| Devices controller tests | 7/7 passed |
| Frontend device-detail-page tests | 15/15 passed |
| API typecheck | Clean |
| API build | Clean |
| Web typecheck | Clean (pre-existing report errors only) |

## Manual Validation Steps

1. Start backend (`pnpm dev` in `apps/api-gateway`), frontend (`pnpm dev` in `apps/web`), and agent
2. Confirm POST /devices/metrics appears every ~30 seconds in backend logs
3. Confirm `[DEV_METRIC_INGEST]` log shows `previousLastSeenAt` advancing
4. Confirm Device Health displays **Online** (green badge)
5. Confirm "Last seen" shows valid date/time
6. Open AI Chat, select device, ask "What is the CPU usage?"
7. Confirm AI reports recent/live metrics
8. Stop the agent (Ctrl+C)
9. Confirm no new POST /devices/metrics in logs
10. Confirm last metric remains visible in Device Health
11. Wait >5 minutes past last metric
12. Confirm Device Health displays **Offline** (gray badge)
13. Ask AI Chat "What is the CPU usage?"
14. Confirm AI says values are **last known/stale**, not current
15. Restart the agent
16. Confirm new metric arrives, Device Health returns **Online**
17. Confirm AI Chat reports fresh data again

## Files Changed

| File | Change |
|------|--------|
| `apps/api-gateway/src/devices/device-presence.ts` | Added freshness model |
| `apps/web/src/lib/device-presence.ts` | Added freshness model (mirrors backend) |
| `apps/web/src/hooks/useDevices.ts` | Fix addLiveMetric to update lastSeenAt |
| `apps/api-gateway/src/ai/controllers/troubleshooting.controller.ts` | Freshness metadata + stale data rules |
| `apps/api-gateway/src/devices/devices.controller.ts` | Dev trace logging |
| `apps/web/src/app/dashboard/monitoring/page.tsx` | Refetch devices on WebSocket |
| `apps/api-gateway/src/devices/device-presence.spec.ts` | Freshness + response tests |
| `apps/web/src/__tests__/device-presence.spec.ts` | Freshness tests |
| `apps/api-gateway/src/ai/controllers/troubleshooting.controller.spec.ts` | Freshness context tests |
| `docs/AH-3R/AH-3R.1B-1_RUNTIME_PRESENCE_FRESHNESS.md` | This document |

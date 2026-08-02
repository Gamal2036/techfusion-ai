# AH-3C.2D — Device Runtime Integration

**Project:** Tech Fusion AI
**Phase:** AH-3C.2D — Device Runtime Integration & AI Multi-Provider Orchestration
**Date:** 2026-07-22

---

## Device Registration Flow (Verified End-to-End)

```
Rust Agent
  → ensure_registered()
    → POST /devices/register-public (enrollment token)
    → DeviceTokenGuard validates token
    → DevicesService.registerPublic()
      → Duplicate detection (identityFingerprint > installationId > hostname)
      → Creates Device with deviceToken (SHA-256 hashed)
      → Returns device + token
  → Agent saves token to ~/.techfusion/
  → Agent loop: POST /devices/metrics (every 30s)
    → DevicesService.ingestMetrics()
      → Updates lastSeenAt
      → Computes health/performance/risk scores via ScoringService
      → Broadcasts via WebSocket to org:{orgId} room
      → Queues alert notifications
```

---

## Device Status Tracking

**No explicit online/offline field** — status derived from `lastSeenAt`:

| Metric | Value |
|--------|-------|
| Agent telemetry interval | 30 seconds |
| Online threshold | 120 seconds (2 minutes) |
| Derived status | Online if `Date.now() - lastSeenAt < 120_000` |

---

## Issues Found & Fixed

### DEFECT-001: Onboarding "Detecting your device..." Was a No-Op
- **File:** `apps/web/src/app/dashboard/page.tsx`
- **Issue:** Step 4 of onboarding had no real detection mechanism — purely cosmetic spinner
- **Fix:** Added 3-second polling loop that checks `devices.length` and auto-advances when a device appears
- **States:** Searching → Connected (green checkmark) → Auto-redirect to dashboard

### DEFECT-002: Fleet Scores Always Showed "No Data Yet"
- **File:** `apps/web/src/app/dashboard/page.tsx`
- **Issue:** `fleetScores` computation returned null for all scores even when devices existed
- **Fix:** Compute `deviceHealth` from online device ratio (`onlineDevices.length / devices.length * 100`)

### DEFECT-003: No Error State in Device Hook
- **File:** `apps/web/src/hooks/useDevices.ts`
- **Issue:** `useDeviceList()` silently swallowed errors
- **Fix:** Added `error` state that captures network errors and HTTP status codes

---

## Device API Endpoints (Verified)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /devices/register-public` | Enrollment token | First-time registration |
| `POST /devices/register` | DeviceTokenGuard | Re-registration |
| `POST /devices/recover-credential` | X-Org-Token | Token recovery |
| `POST /devices/metrics` | DeviceTokenGuard | Metric ingestion |
| `GET /devices` | JWT (user) | List org devices |
| `GET /devices/:id` | JWT (user) | Get single device |
| `GET /devices/:id/metrics` | JWT (user) | Get metrics history |
| `GET /devices/:id/scores` | JWT (user) | Get latest scores |
| `GET /devices/:id/latest` | JWT (user) | Device + metrics + scores |

---

## Frontend Polling

| Component | Polling | Interval |
|-----------|---------|----------|
| `useDeviceList()` | HTTP GET /devices | 15 seconds |
| Dashboard online count | Derived from lastSeenAt | Real-time |
| Onboarding detection | Polls devices.length | 3 seconds |
| WebSocket | Socket.IO /metrics namespace | Real-time push |

---

## Report Path

`docs/AH-3/AH-3C.2D_DEVICE_RUNTIME_INTEGRATION.md`

---

## Status

**DEVICE RUNTIME: INTEGRATED** — Registration, heartbeat, online detection, and frontend synchronization verified and fixed.

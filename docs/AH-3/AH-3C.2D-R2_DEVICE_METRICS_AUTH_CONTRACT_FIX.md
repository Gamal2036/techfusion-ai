# AH-3C.2D-R2 Device Metrics Auth Contract Fix

**Status:** COMPLETE  
**Date:** 2026-07-23  
**Scope:** Fix Rust Agent → Backend device authentication contract so POST /devices/metrics returns 200, devices appear in Dashboard, and real telemetry flows end-to-end

---

## Executive Summary

Root cause identified and fixed: Agent loaded stale orphan device token from `~/.techfusion/device_token` even when `TF_ORG_TOKEN` was provided, causing 401 errors on every metrics POST. Fixed `ensure_registered()` to always perform fresh registration when `TF_ORG_TOKEN` is present. Also fixed `config.rs` which rejected startup when no env vars were set (preventing stored token recovery on restart). Full end-to-end flow verified: enrollment → registration → metrics → Dashboard visibility.

---

## Root Cause

1. **`config.rs` early-exit:** When neither `TF_DEVICE_TOKEN` nor `TF_ORG_TOKEN` was set, `AgentConfig::from_env()` returned an error immediately — before `ensure_registered()` could load the stored disk token
2. **`registration.rs` stale token priority:** When `TF_ORG_TOKEN` was set, `ensure_registered()` still tried to load the stale disk token first (from a previous registration that left no matching DB record), causing the agent to use a token with no corresponding device in the database
3. **`client.rs` 401 retry loop:** `send_metrics()` retried 401 errors with exponential backoff, wasting time on a token that would never work

---

## Fixes Applied

### 1. `apps/agent/src/config.rs` — Removed early-exit credential check
- **Before:** `if device_token.is_empty() && org_token.is_none() { return Err(...); }` — prevented startup with only disk-stored credentials
- **After:** Empty credentials allowed; `ensure_registered()` handles the logic

### 2. `apps/agent/src/registration.rs` — TF_ORG_TOKEN always triggers fresh registration
- **Added `RegistrationSource` enum:** `Environment`, `Disk`, `FreshRegistration`
- **`ensure_registered()` flow:**
  1. `TF_DEVICE_TOKEN` set → use it (Environment)
  2. `TF_ORG_TOKEN` set → always do fresh registration, ignoring disk token (FreshRegistration)
  3. Disk token exists → load from disk (Disk)
  4. Nothing → clear error with recovery instructions
- **Added tests:** `test_load_token_valid_hex`, `test_load_token_too_short`, `test_registration_source_variants`, `test_config_allows_empty_credentials`

### 3. `apps/agent/src/client.rs` — 401 is non-retryable
- **Before:** 401 retried with exponential backoff (same as 5xx)
- **After:** 401 immediately returns `ClientError::Unauthorized` without retry
- 5xx errors still retried with exponential backoff

### 4. `apps/agent/src/agent.rs` — Bounded 401 recovery
- Max 3 consecutive auth failures before stopping
- Clear recovery instructions logged (including exact `export TF_ORG_TOKEN=...` command)
- `poll_remote_sessions()` 401 logged as debug (non-fatal)

### 5. `apps/api-gateway/src/devices/device-token.guard.ts` — Dev diagnostics
- Logs token length/prefix, lookup result, device count, device hostname/orgId on success
- Gated by `NODE_ENV !== 'production'`

---

## Runtime Evidence

### First-time Registration (with TF_ORG_TOKEN)
```
[agent::registration] TF_ORG_TOKEN provided — performing fresh registration (ignoring any stale disk token)
[agent::registration] First-time registration with enrollment token...
[agent::registration] Device registered successfully: 2f6d3e68-7e27-4bae-a117-c55523c5415c (eg-pc)
[agent::agent] Device registered and authenticated (token length: 64)
[agent::agent] Metrics sent | CPU: 60.7% | RAM: 40.7%
```

### Stored Token Recovery (without TF_ORG_TOKEN)
```
[agent::registration] Loaded existing device token from disk
[agent::agent] Device token restored from disk (token length: 64)
[agent::agent] Metrics sent | CPU: 60.4% | RAM: 41.0%
```

### API Gateway Dev Diagnostics
```
[DeviceTokenGuard] [DEV_DEVICE_AUTH] Token received: length=64 prefix=5cff...
[DeviceTokenGuard] [DEV_DEVICE_AUTH] Authenticated: deviceId=2f6d3e68-... hostname=eg-pc orgId=31f22ce6-...
[DevicesController] [DEV] POST /devices/metrics deviceId=2f6d3e68-... cpuUsage=60.73 ramPercent=40.70
[HTTP] POST /devices/metrics 201 44ms
```

### API Endpoints Verified
| Endpoint | Method | Status | Evidence |
|----------|--------|--------|----------|
| `POST /devices/register-public` | Agent → API | 201 | Device created in DB |
| `POST /devices/metrics` | Agent → API | 201 | Metrics stored every 30s |
| `GET /devices` | Dashboard → API | 200 | Returns 1 device for gamal org |
| `GET /devices/:id/metrics` | Dashboard → API | 200 | Returns latest metrics |

### Device in Database
- **Device ID:** `2f6d3e68-7e27-4bae-a117-c55523c5415c`
- **Hostname:** `eg-pc`
- **Org:** `31f22ce6-c0e8-4783-82fe-b705befb73ea` (gamal)
- **Last metrics:** CPU 64.9%, RAM 40.9%, 1541 processes, 7750s uptime

---

## Test Results

| Suite | Result |
|-------|--------|
| Rust agent tests | 29/29 PASS |
| API Gateway `tsc` | PASS |

New tests added:
- `test_load_token_valid_hex` — 64-char hex token loaded correctly
- `test_load_token_too_short` — Short token rejected
- `test_registration_source_variants` — Enum variants match
- `test_config_allows_empty_credentials` — Config accepts empty credentials

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/agent/src/config.rs` | Removed early-exit credential check |
| `apps/agent/src/registration.rs` | `RegistrationSource` enum, TF_ORG_TOKEN always triggers fresh registration |
| `apps/agent/src/agent.rs` | Bounded 401 recovery, source-specific status messages |
| `apps/agent/src/client.rs` | 401 non-retryable, only 5xx retried |
| `apps/api-gateway/src/devices/device-token.guard.ts` | Dev diagnostics logging |
| `apps/api-gateway/src/devices/devices.controller.ts` | Dev logging for metrics and list endpoints |

---

## Terminal Status Block

```
╔══════════════════════════════════════════════════════════════╗
║  AH-3C.2D-R2  DEVICE METRICS AUTH CONTRACT FIX              ║
╠══════════════════════════════════════════════════════════════╣
║  Status: COMPLETE                                            ║
║  Root Cause: stale disk token used when TF_ORG_TOKEN set    ║
║  Fix: ensure_registered() prioritizes TF_ORG_TOKEN          ║
║  Agent Registration: PASS (enrollment → device created)      ║
║  Metrics Flow: PASS (POST /devices/metrics 201)             ║
║  Device Visible: PASS (GET /devices returns 1 device)        ║
║  Stored Token Recovery: PASS (restart without TF_ORG_TOKEN)  ║
║  Rust Tests: 29/29 PASS                                      ║
║  API Typecheck: PASS                                         ║
╠══════════════════════════════════════════════════════════════╣
║  NOT STARTING AH-3D UNTIL EXPLICITLY REQUESTED              ║
╚══════════════════════════════════════════════════════════════╝
```

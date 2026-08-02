# AH-3R.1C-1B — CPU Model Collection

## Project: TechFusion AI

## Root Cause

In `apps/agent/src/registration.rs:62-64`, the agent created a `sysinfo::System::new_all()` but **never called `refresh_cpu_specifics(CpuRefreshKind::everything())`** before reading `global_cpu_info().brand()`. In sysinfo 0.30, `System::new_all()` performs a default refresh that does NOT include CPU brand/model information. The `brand()` method returned an empty string `""`, which was sent as `cpuModel: ""` in the registration payload.

Meanwhile, `apps/agent/src/collector.rs:cpu_model_name()` correctly called `refresh_cpu_specifics(CpuRefreshKind::everything())` and worked properly, but was never used during registration.

The backend stored the empty string as `""` (not `null`) because `dto.cpuModel ?? null` only catches `undefined`, not empty strings. The frontend correctly treats `""` as falsy and shows "CPU information unavailable".

## CPU Model Source

1. **Primary**: sysinfo 0.30 `global_cpu_info().brand()` after `refresh_cpu_specifics(CpuRefreshKind::everything())`
2. **Fallback**: `/proc/cpuinfo` parsing for keys: `model name`, `Hardware`, `Processor`
3. **Rejection**: Empty strings, whitespace-only, and meaningless values ("unknown", "cpu", "processor", "arm", "aarch64", "x86_64", etc.)

## Fallback Behavior

- If sysinfo returns a meaningful brand string → use it
- If sysinfo returns empty/meaningless → parse `/proc/cpuinfo` for known keys
- If all sources fail → return `"Unknown"` (displayed as "CPU information unavailable" by frontend)

## Canonical Field Mapping

```
Agent:  cpu_model_name() → SystemMetrics.cpu_model → RegisterPublicPayload.cpuModel
Serde:  #[serde(rename_all = "camelCase")] → JSON key "cpuModel"
Backend: RegisterPublicDto.cpuModel → Device.cpuModel (Prisma)
Frontend: Device.cpuModel → "AMD Athlon Silver 3050U with Radeon Graphics"
```

## Existing Device Enrichment

When a duplicate device is detected (via identity fingerprint, installation ID, or hostname):
- `enrichDeviceFromRegistration()` updates `cpuModel` only if incoming value is non-null AND non-empty (after trim)
- Empty/null incoming values do NOT erase existing `cpuModel`
- `lastSeenAt` is NOT updated through the enrichment path
- Device count remains unchanged

## Duplicate Prevention

`findExistingDevice()` checks in order:
1. `identityFingerprint` match
2. `installationId` match
3. `hostname` match

If any match → enrichment path (no new device created)

## lastSeenAt Impact

None. The enrichment path only updates hardware fields (cpuModel, cpuCores, cpuLogical, os, hostname, etc.). `lastSeenAt` is only updated through the metrics ingestion path.

## API Response

Both endpoints return `cpuModel`:
- `GET /devices` → `cpuModel` field on each device
- `GET /devices/:id/latest` → `device.cpuModel` in response

`sanitizeDevice()` only strips `deviceToken`, `deviceTokenHash`, and `metadata`.

## Frontend Display

- Detail page: `device.cpuModel || 'CPU information unavailable'`
- List page: `device.cpuModel && <span>{device.cpuModel.split(' ').slice(0, 2).join(' ')}</span>`

## Files Changed

| File | Change |
|------|--------|
| `apps/agent/src/collector.rs` | Added `is_meaningless_cpu_model()`, `parse_proc_cpuinfo_model()`, enhanced `cpu_model_name()` with better validation and fallback. Added 8 new tests. |
| `apps/agent/src/registration.rs` | Replaced inline sysinfo code with `crate::collector::cpu_model_name()` and added `refresh_cpu_specifics()` call. |
| `apps/api-gateway/src/devices/devices.service.ts` | Changed `dto.cpuModel ?? null` to `dto.cpuModel?.trim() || null` in `register()` and `registerPublic()`. Added trim to `enrichDeviceFromRegistration()`. |
| `apps/api-gateway/src/devices/devices.controller.spec.ts` | Added 4 new tests for empty/whitespace cpuModel handling and enrichment trimming. |
| `apps/web/src/__tests__/device-detail-page.spec.tsx` | Added 3 new tests for CPU model display, fallback, and cores alongside model. |

## Tests

### Agent Tests (43 passed)
- `test_cpu_model_returns_meaningful_string` — sysinfo returns valid brand
- `test_is_meaningless_cpu_model_rejects_invalid` — rejects empty, "unknown", "cpu", etc.
- `test_is_meaningless_cpu_model_accepts_valid` — accepts real CPU names
- `test_parse_proc_cpuinfo_model_reads_model_name` — /proc/cpuinfo parsing works
- `test_parse_proc_cpuinfo_model_trimmed` — whitespace trimmed
- `test_cpu_model_does_not_panic` — no panics
- `test_cpu_model_name_returns_known_on_this_system` — real CPU detected
- `test_register_payload_serializes_cpu_model_camel_case` — JSON uses camelCase
- `test_register_payload_empty_cpu_model` — empty string serializes correctly
- `test_metrics_payload_includes_cpu_model` — metrics include CPU model

### Backend Tests (17 passed)
- `empty cpuModel string is stored as null on new device`
- `whitespace-only cpuModel string is stored as null on new device`
- `empty incoming cpuModel does not erase existing value on enrichment`
- `cpuModel with surrounding whitespace is trimmed on enrichment`
- Plus 13 existing tests (unchanged)

### Frontend Tests (18 passed)
- `renders real cpuModel when present`
- `renders fallback when cpuModel is null`
- `renders cores correctly alongside CPU model`
- Plus 15 existing tests (unchanged)

## Build Results

| Component | Typecheck | Build | Tests |
|-----------|-----------|-------|-------|
| Agent (Rust) | — | ✅ | 43/43 |
| API (NestJS) | ✅ | ✅ | 17/17 |
| Web (Next.js) | ✅ (device files) | ✅ | 18/18 |

## Manual Validation Steps

1. Start backend and frontend
2. Stop the agent
3. Start the agent using the current enrollment flow (`TF_ORG_TOKEN=tfenr_...`)
4. Confirm backend logs show `[DEV_REGISTER_ENRICH]` with non-null cpuModel
5. Open Device Health
6. Open the real device
7. Confirm CPU displays the real model name (e.g., "AMD Athlon Silver 3050U with Radeon Graphics")
8. Confirm Cores still display correctly (e.g., "1 physical / 2 logical")
9. Confirm RAM still displays
10. Confirm device remains Online
11. Confirm Last Seen remains valid
12. Refresh the page directly — CPU model persists
13. Restart the agent — device count remains unchanged
14. Confirm `cpuModel` in GET /devices and GET /devices/:id/latest responses

## Remaining Work for AH-3R.1C-2

- Agent hardware inventory enrichment (GPU, disk detailed info)
- Backend enrichment for all hardware fields
- Security findings correlation with device hardware
- Performance baseline based on hardware capabilities

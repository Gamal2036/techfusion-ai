# AH-3R.1C-1 — Device System Information Contract

## Confirmed Root Cause

When an agent re-registers an existing device (detected as duplicate via identity fingerprint, installation ID, or hostname), `DevicesService.registerPublic()` calls `rotateCredential()` which only updates token/credential fields. The incoming CPU model, cpuCores, and cpuLogical values from the registration payload were never written to the existing device record. The device retained whatever (possibly null) CPU fields it had at original creation.

## CPU Data Source

**Primary**: Agent registration via `POST /devices/register-public` (public enrollment flow)
**Secondary**: The agent can re-register with updated hardware info, which now enriches existing fields.

The agent collects:
- CPU model: `sysinfo::System::global_cpu_info().brand()` with `/proc/cpuinfo` fallback on Linux
- Physical cores: parsed from `/proc/cpuinfo` (unique physical_id + core_id combinations)
- Logical cores: `sysinfo::System::cpus().len()`

## Canonical Field Contract

```
cpuModel:   string | null   — CPU brand/model name (e.g., "Intel(R) Core(TM) i5-8250U")
cpuCores:   number | null   — Physical core count
cpuLogical: number | null   — Logical (thread) count
```

Backend storage: Prisma Device model (`cpuModel String?`, `cpuCores Int?`, `cpuLogical Int?`)
No schema migration required — fields already existed.

## Registration Behavior

- Registration initializes all available CPU fields from the agent payload.
- If an existing device is found (duplicate detection), the new hardware data enriches the existing record without creating a duplicate.
- Missing incoming fields (null/undefined) do not erase known existing values.
- `lastSeenAt` is NOT updated by the enrichment path.

## Inventory Behavior

Inventory reports (drivers/software) are separate from system information. CPU fields are authoritative at registration time.

## Existing Device Enrichment

When `registerPublic()` finds an existing device via `findExistingDevice()`:

1. `enrichDeviceFromRegistration()` is called with the incoming DTO.
2. Non-null, non-empty CPU fields (and other hardware fields) are written to the existing device.
3. `rotateCredential()` is called for token rotation.
4. The enriched device is fetched and returned.

This ensures agents that re-register (e.g., after credential recovery or normal restart with `TF_ORG_TOKEN`) populate missing CPU fields on the existing device.

## Backend Storage

- Prisma schema: `Device.cpuModel`, `Device.cpuCores`, `Device.cpuLogical` (all nullable)
- No migration required
- `sanitizeDevice()` preserves all CPU fields (only strips `deviceToken`, `deviceTokenHash`, `metadata`)

## API Response

`GET /devices` and `GET /devices/:id/latest` both return:

```json
{
  "cpuModel": "Intel(R) Core(TM) i5-8250U",
  "cpuCores": 4,
  "cpuLogical": 8,
  ...
}
```

## Frontend Display

System Information panel:

- **CPU**: Shows `cpuModel` when present; falls back to "CPU information unavailable" when missing.
- **Cores**: Shows `"X physical / Y logical"` when both present and different; `"Y logical"` when only logical; `"Core information unavailable"` when neither present.
- No N/A, undefined, null, or 0/0 misleading values.

## Fallback Behavior

- CPU model: `"CPU information unavailable"` when `cpuModel` is null/empty
- Core counts: `"Core information unavailable"` when both are null
- Never displays: N/A, undefined, null, or "0 physical / 0 logical"

## Duplicate Prevention

- `findExistingDevice()` checks identity fingerprint, installation ID, and hostname.
- Existing device is enriched and credential-rotated, not duplicated.

## lastSeenAt Impact

- Registration enrichment does NOT update `lastSeenAt`.
- Only `ingestMetrics()` and credential rotation update timestamp-related fields.

## Files Changed

| File | Change |
|---|---|
| `apps/agent/src/collector.rs` | Added `cpu_model`, `cpu_logical` fields to `SystemMetrics`; added `detect_physical_cores()` and `cpu_model_name()` helpers with `/proc/cpuinfo` fallback |
| `apps/agent/src/registration.rs` | Use physical vs logical core distinction; pass correct values to `register_device_public()` |
| `apps/agent/src/client.rs` | Added `model` field to `CpuMetricsPayload`; send CPU model in metrics payloads |
| `apps/api-gateway/src/devices/devices.service.ts` | Added `enrichDeviceFromRegistration()` method; enrich existing device hardware fields during re-registration; added `Logger` |
| `apps/web/src/app/dashboard/device-health/[id]/page.tsx` | Updated CPU/Cores display with proper fallback messages and physical/logical formatting |

## Tests

### Agent tests (33 total, all pass):
- `test_cpu_model_returns_non_empty_string` — CPU model extraction returns non-empty string
- `test_cpu_logical_cores_positive` — Logical cores > 0
- `test_cpu_physical_cores_not_exceed_logical` — Physical <= logical
- `test_detect_physical_cores_returns_valid_value` — Physical detection returns valid value
- Existing metrics tests updated to verify new fields

### Backend tests (13 total, all pass):
- `registration maps cpuModel/cpuCores/cpuLogical on new device`
- `enriches existing device CPU fields without creating duplicate`
- `missing incoming CPU fields do not erase existing data`
- `sanitizeDevice preserves CPU fields`
- `listDevices includes CPU fields`
- `lastSeenAt is not changed by duplicate registration enrichment`

## Build Results

| Check | Result |
|---|---|
| API Typecheck (`tsc --noEmit`) | Pass |
| API Build (`tsc`) | Pass |
| Agent Build (`cargo build`) | Pass (pre-existing warnings only) |
| Agent Tests (`cargo test`) | 33/33 pass |
| Backend Tests (controller spec) | 13/13 pass |
| Web Typecheck | Pre-existing errors only (unrelated `ReportScheduleStatus`) |

## Manual Validation

1. Start backend and frontend.
2. Start or restart the agent.
3. Confirm the agent registers or sends inventory without creating a duplicate device.
4. Open Device Health.
5. Open the real device.
6. Confirm CPU model displays instead of N/A.
7. Confirm core counts display correctly (e.g., "4 physical / 8 logical").
8. Refresh the page directly.
9. Confirm CPU information remains stored.
10. Restart the agent and confirm no duplicate device appears.
11. Confirm Online/Offline and Last Seen behavior remain unchanged.
12. Check backend logs for safe CPU mapping evidence (DEV_REGISTER_ENRICH log line).

## Remaining Work for AH-3R.1C-2

- GPU information enrichment (if collected by agent)
- Disk model/SKU enrichment
- Agent inventory upload path for hardware field updates
- Potential agent-side heartbeat with hardware info refresh

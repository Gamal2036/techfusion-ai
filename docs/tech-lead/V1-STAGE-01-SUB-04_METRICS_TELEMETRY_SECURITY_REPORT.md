# V1-STAGE-01-SUB-04 — Metrics / Telemetry Authentication & Secret Boundary Report

Status date: 2026-08-10. Mission: certify the authentication and trust boundary
for `POST /devices/metrics` (and the directly shared device-telemetry ingestion
boundary) — authenticated-device-authoritative identity, fail-closed
credentials, deterministic malformed-input handling, and raw-secret hygiene.
`MIGRATION: NONE`. No schema change was required.

## 1. Route / Auth Architecture (traced)

- **Route**: `POST /devices/metrics` — `devices.controller.ts:122-154`
  (`@Public()` + `@Throttle(120/60s)` + `@UseGuards(DeviceTokenGuard)`).
- **Guard**: `device-token.guard.ts` — SHA-256 of the `Authorization: Bearer`
  value is compared against `Device.deviceTokenHash` (sole verifier, no
  plaintext fallback per SUB-03). On success it sets `request.device = <full DB
  Device row>` and `request.orgId = device.orgId`.
- **Authority source**: the verified DB `Device` row only.
  `deviceId = req.device.id`, `orgId = req.device.orgId`
  (`devices.controller.ts:127` → `ingestMetrics(device.id, device.orgId, dto)`).
- **Client-controlled fields**: `MetricsPayloadDto` carries telemetry DATA only
  (cpu/memory/disk/gpu/battery/temperatures/fans/network/processes/uptime/
  services/timestamp). There is no `deviceId`/`orgId` member; the global
  `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: false`,
  `enableImplicitConversion: true`) strips any unknown property silently. The
  inert body `deviceToken` field (unused since the guard authenticates by
  header) was **removed** — see §3.
- **Write target**: `DeviceMetric` + `DeviceHealthScore` created with the
  authenticated `deviceId`/`orgId`; `Device.lastSeenAt` updated;
  alert evaluation → `DevicesGateway.broadcastMetrics/broadcastAlert` + queue
  (fire-and-forget).
- **Shared boundary**: the same `DeviceTokenGuard` protects the other device
  ingestion routes (`security/pending/:deviceId`, `security/scan-result`,
  network discovery, inventory) which independently re-bind to `req.device`
  (SUB-02 pattern). `security-report` authenticates by body credential hashed
  via `findByToken` (unchanged, SUB-03).

## 2. Defects Found

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| M1 | MEDIUM | **Uncontrolled 500 on fractional byte/counter telemetry.** `ingestMetrics` passes `disk.readBytes`, `disk.writeBytes`, `gpu.memoryUsed`, `network.rxBytes`, `network.txBytes`, `uptime` straight to `BigInt(...)` (no rounding, unlike the `Math.round`-guarded fields). `BigInt(1.5)` throws `RangeError` → `AllExceptionsFilter` → 500. The DTO only required `@IsNumber() @Min(0)`, which admits non-integers. | `devices.service.ts:285-305`; empirically confirmed `BigInt(1.5)` → RangeError |
| M2 | MEDIUM | **Unvalidated `fans.rpm` → Prisma 500.** `fans?: { rpm?: number }` had no validators; a string/object `rpm` reached the Float column and raised `PrismaClientValidationError` → 500. | `metrics-payload.dto.ts` (old) + `devices.service.ts:298` |
| M3 | LOW | **Raw-token material in DEV-only auth logs.** The guard logged the first 4 chars of the presented token (`prefix=${token.slice(0, 4)}...`), the first 12 chars of the Authorization header, and an 8-char hash prefix — no established redaction policy. Full tokens were never logged. | `device-token.guard.ts:18,28,46` |
| M4 | LOW | **Inert body `deviceToken` credential surface.** `MetricsPayloadDto.deviceToken` was unused by the route (guard authenticates by header) but advertised a client-supplied credential field on the telemetry DTO. Validation errors do NOT echo raw values (`flattenValidationErrors` → constraint strings only), so it was not a leak — but it is a needless surface and conflicts with the "payload is data, not auth" contract. | `metrics-payload.dto.ts` (old) |

## 3. Fixes (targeted; no route/architecture rewrite)

1. **`metrics-payload.dto.ts`** — add `@IsInt()` to every `BigInt`-bound field
   (`disk.readBytes`, `disk.writeBytes`, `gpu.memoryUsed`, `network.rxBytes`,
   `network.txBytes`, `uptime`): fractional/`NaN`/`Infinity` input now fails
   deterministically with 400 before reaching Prisma. Add a validated nested
   `FansDto` (`@ValidateNested() @Type(() => FansDto)`, `rpm` `@IsNumber()
   @Min(0)`). Remove the inert `deviceToken` member (unknown props are still
   whitelist-stripped, so no client breaks).
2. **`device-token.guard.ts`** — DEV-only logs now report presence, token
   length, and counts only; all token/hash prefixes removed. Full secrets were
   never logged and still never are.

Agent compatibility (Phase 6): the Linux Agent sends `Authorization: Bearer`
only, RFC3339 `timestamp`, and integer-valued byte counters (`as f64` of u64
counters is always integer-valued → `@IsInt()` passes); it never sends body
`deviceToken` or `fans`. No Agent change needed.

## 4. Identity Authority Contract (certified)

```
Authenticated device (DeviceTokenGuard, SHA-256 verifier)
        ↓
req.device.id / req.device.orgId        ← server-authoritative
        ↓
DeviceMetric / DeviceHealthScore stored under device.id + device.orgId
```

Client payload is telemetry DATA only. It is never authoritative for device
identity, organization identity, or authentication. Foreign `deviceId`/`orgId`
in the body is silently stripped (never trusted); the body has no credential
field anymore.

## 5. Adversarial Suite — `test/device-metrics-security.spec.ts` (15 tests)

| # | Scenario | Result |
|---|----------|--------|
| 01 | Valid hashed device credential → accepted | 201 |
| 02 | Invalid credential | 401 |
| 03 | Plaintext-only legacy credential (hash-only, no fallback) | 401 |
| 04 | Missing hash / null verifier → fail-closed | 401 |
| 05 | Old credential after rotation | 401 (new works) |
| 06 | Valid Device B token + Device A id in body → cannot write as A | 201 bound to B; A untouched |
| 07 | Forged orgId → cannot re-scope to another org | stored under real org only |
| 08 | Malformed timestamps (`not-a-date`, `2026-13-01...`, numeric) | 400, never 500 |
| 09 | Fractional bytes (`disk/network/gpu/uptime = 1.5`) | 400, never 500 |
| 10 | Non-numeric/negative `fans.rpm` | 400 (valid `rpm` → 201) |
| 11 | Out-of-range values (`cpu.usage=150`, `memory.percent=150`) | 400 |
| 12 | Valid telemetry stored under authenticated device/org | row assertions pass |
| 13 | Cross-tenant (Device B cannot write as Device A across orgs) | only B's org has rows |
| 14 | Raw credential absent from 401 error and 201 response | not present |
| 15 | Client-supplied body `deviceToken` ignored, never echoed/stored | 201, token absent |

## 6. Verification Evidence

- **api-gateway**: 56 suites / 971 tests PASS (includes new 15-test suite +
  SUB-03 13-test + SUB-02 20-test suites).
- `tsc --noEmit` + `tsc` (build) green.
- No Worker/Web/Agent source changed; `MIGRATION: NONE`.
- `scripts/ci-v1-gate.sh` — **19/19 PASS** (includes api/web/worker/agent
  typecheck+test+build, migration validation, and repository secret scan →
  NO SECRETS DETECTED).

## 7. Residual Risks

- **`metrics/` Prometheus scrape endpoint (`GET /metrics?token=`, S5) is
  untouched** — out of scope for this substage (documented P2 in `07`).
- **`security-report` authenticates by body credential** (a different, certified
  SUB-03 pattern) — intentionally not converged here.
- **Missing optional sections silently default** (e.g. absent `memory` → zeros):
  pre-existing behavior, not a security defect; not changed to avoid agent breakage.
- **Very large integer counters** (≥ 2^53) lose precision through `as f64` in the
  agent before reaching the API — cosmetic, not security-relevant.

## 8. Files Changed

- `apps/api-gateway/src/devices/dto/metrics-payload.dto.ts` (IsInt on BigInt fields, FansDto, removed inert deviceToken)
- `apps/api-gateway/src/devices/device-token.guard.ts` (DEV logs: no token/hash prefixes)
- `apps/api-gateway/test/device-metrics-security.spec.ts` (new, 15 tests)
- `docs/tech-lead/07_SECURITY_TENANCY_REVIEW.md`, `12_MASTER_ROADMAP.md`, `14_DECISION_LOG.md` (SUB-04 status)

## 9. Next Recommended Work

`V1-STAGE-01-SUB-05` — **secrets hygiene review** (final Stage-01 remaining item),
followed by `V1-STAGE-01` close. S5 (metrics token auth out of query string /
require `METRICS_AUTH_TOKEN`) is a P2 follow-up.

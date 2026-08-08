# V1-STAGE-01B — Presence, Telemetry & Online/Offline Reliability

Status: AUTOMATED CERTIFICATION COMPLETE — REAL-DEVICE TEST PENDING
Date: 2026-08-08
Mode: Audit-first certification of the device presence / telemetry / online-offline reliability
path (Agent → DeviceTokenGuard → telemetry ingestion → `Device.lastSeenAt` freshness → presence
sweep scheduler → worker sweep → dashboard & frontend state). Two production defects reproduced,
fixed, and covered by automated tests; two cross-page presence-state inconsistencies fixed. No
schema change, no migration, no destructive DB reset, no commits or pushes. Baseline certification
counts preserved and exceeded (API 879 → 902, Lifecycle 27, Billing 55).

---

## 1. Overview

V1-STAGE-01B audits the presence, telemetry, and online/offline reliability surface of
TechFusion-AI. A device is considered present/online when the server has recent, authentic,
authoritative heartbeat data. The mission was to map the complete runtime path, reproduce any
reliability defects, fix only proven inconsistencies, lock the behavior down with automated tests,
and certify that no previously certified subsystem (tenant isolation, lifecycle, billing)
regressed. Real-device certification remains a manual, follow-on procedure (Section 35).

## 2. Executive Summary

- **The authoritative presence model is sound and single-sourced**: `Device.lastSeenAt`, updated
  with **server receive time** on every authenticated metrics ingest, is the only source of truth.
  Presence is *derived at read time* from that timestamp by a shared 4-state derivation
  (`ONLINE / DEGRADED / OFFLINE / UNKNOWN`) mirrored consistently across the API, worker, and web.
- **Two production defects were found, reproduced, and fixed**:
  1. **Presence-sweep enqueue always failed.** `addPresenceSweep` built a BullMQ custom jobId from
     an ISO-minute key (`2026-08-08T06:15`) containing `:`, which BullMQ rejects with
     `Custom Id cannot contain :`. Every scheduled sweep tick logged `Failed to enqueue presence
     sweep` and no sweep job ever reached the worker. Fixed by sanitizing the jobId separator;
     verified against real BullMQ + Redis.
  2. **Malformed telemetry timestamps caused HTTP 500.** The `timestamp` field had no format
     validation, so `new Date("not-a-date")` = `Invalid Date` reached Prisma and blew up with a 500.
     Fixed with `@IsString() + @IsISO8601()` on the DTO; the endpoint now returns 400.
- **Two cross-page presence-state inconsistencies were found and fixed**:
  3. Device detail page showed a DEGRADED device as **"Offline"** (binary `isDeviceOnline`) while
     every other surface showed **"Degraded"** — conflicting state sources for the same device.
     Aligned to the shared `derivePresenceState` + design tokens.
  4. Remote-support page inlined its own **30-minute** online window (`30 * 60 * 1000`), so the
     same device could be "online" there while OFFLINE/DEGRADED everywhere else. Removed the local
     copy and used the shared 5-minute `isDeviceOnline`.
- **Timing targets**: the aspirational `ONLINE ≤ 10s` / `OFFLINE ≤ 60s` are intentionally not met;
  the shipped contract (agent 30 s tick + 3 s jitter; 5 min ONLINE / 15 min OFFLINE bands) is the
  safe, documented tradeoff. See Section 29.
- **Regression**: API 902/902 (was 879), Lifecycle 27/27, Billing 55/55, Web 777/777, Worker 79/79,
  Agent 78/78. All typechecks and builds clean.

## 3. Audit Scope — Inclusions & Exclusions

**In scope (audited line-by-line):**

- `apps/agent` — `agent.rs` (tick loop, shutdown), `client.rs` (`send_metrics` retry/backoff,
  payload builder), `config.rs` (interval defaults), `collector.rs` (telemetry fields).
- `apps/api-gateway` — `devices/device-token.guard.ts`, `devices.controller.ts` (`POST /devices/metrics`,
  `GET /devices`), `devices.service.ts` (`ingestMetrics`, `findByOrg`), `dto/metrics-payload.dto.ts`,
  `devices/device-presence.ts` + `device-presence-state.ts`, `monitoring/presence-sweep-scheduler.service.ts`,
  `queue/queue.service.ts` (`addPresenceSweep`), `dashboard/dashboard.service.ts` + `dashboard.controller.ts`,
  `app.module.ts` (module wiring), `common/all-exceptions.filter.ts`.
- `apps/worker` — `presence-state.ts`, `monitoring-sweep.ts`, `processors.ts`, `queue-names.ts`.
- `apps/web` — `lib/device-presence.ts`, `lib/device-presence-state.ts`, `hooks/useDashboardSummary.ts`,
  `hooks/useCommandCenterData.ts`, `hooks/useDevices.ts`, `app/dashboard/device-health/[id]/page.tsx`,
  `app/dashboard/remote-support/page.tsx`, `components/command-center/*`.

**Excluded (audit confirmed out of scope, no changes):**

- Organizations, memberships, RBAC, invitations, account deletion, ownership transfer, billing,
  enrollment-token lifecycle, identity reset, remote-support session protocol internals.

## 4. Authoritative Presence Model

`Device.lastSeenAt` (server time) is the single authoritative freshness signal. Every authenticated
`POST /devices/metrics`:

1. Authenticates the agent via `DeviceTokenGuard` (SHA-256 hash lookup, raw-token fallback for
   legacy rows) — `device-token.guard.ts:32-47`.
2. Writes a `DeviceMetric` row (`devices.service.ts:278-312`).
3. Sets `lastSeenAt: new Date()` — **server receive time, never the client clock**
   (`devices.service.ts:314-317`). This is the guarantee that a client timestamp cannot fake or
   stall presence (proven by test T6).
4. Computes a real health/performance/risk score and persists `DeviceHealthScore`.

Presence state is *derived* at read time from `lastSeenAt` by `derivePresenceState`; it is never
stored. There is exactly one source of truth and no second persistence to keep in sync.

## 5. Presence State Derivation

Shared thresholds (identical copies in the API, worker, and web — kept in sync by tests):

| Constant | Value | Meaning |
|---|---|---|
| `DEVICE_ONLINE_THRESHOLD_MS` | 300 000 ms (5 min) | lastSeenAt age ≤ 5 min ⇒ **ONLINE** |
| `DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS` | 900 000 ms (15 min) | age ≤ 15 min ⇒ **DEGRADED**; age > 15 min ⇒ **OFFLINE** |
| `TELEMETRY_INTERVAL_MS` | 30 000 ms | agent's nominal telemetry period; `live` freshness = 2 × interval (≤ 60 s) |

`derivePresenceState(lastSeenAt, now)` returns `ONLINE`, `DEGRADED`, `OFFLINE`, or `UNKNOWN`
(no/invalid/future timestamp). The 5-minute online window tolerates up to ~10 missed heartbeats,
plus sleep/wake and transient network blips, before a device leaves ONLINE — the documented
rationale in `device-presence.ts:9-15`.

## 6. Telemetry Ingestion Flow

1. Agent `POST /devices/metrics` with `Authorization: Bearer <deviceToken>` and a **nested**
   payload (`{ timestamp, cpu:{usage,cores}, memory:{...}, disk, temperatures, network, battery,
   processes, uptime }`) — `client.rs:826-870`.
2. `DeviceTokenGuard` resolves the device from the token; `req.device` + `req.orgId` are set from
   the **token**, never from body fields (forged `deviceId`/`orgId`/`X-Org-Id` in the body are
   stripped or ignored — proven by tests T3/T4).
3. `MetricsPayloadDto` validation (whitelist + transform): CPU 0–100, memory/disk ≥ 0, battery
   0–100, timestamp ISO-8601. Malformed input → 400 (defect D2 fixed here).
4. `ingestMetrics` persists the metric, bumps `lastSeenAt` (server now), computes scores.
5. WebSocket broadcast of `{ metric, score, lastSeenAt }` to the org channel for live UI updates;
   presence alert broadcasts when triggered.
6. Read path: `GET /devices` and `GET /dashboard/summary` derive presence/freshness per device.

## 7. Metric Freshness Classification

Independent of presence bands, `classifyFreshness(recordedAt)` classifies the **latest metric**
(`device-presence.ts:47-61`): `live` (≤ 60 s), `recent` (≤ 5 min), `stale` (> 5 min), `unavailable`
(invalid/future). Used by the dashboard `freshness` counts. Presence (`ONLINE/DEGRADED/OFFLINE`) and
metric freshness (`live/recent/stale`) are deliberately distinct axes and do not conflict: a device
with a stale *metric* may still be DEGRADED *presence* (≤ 15 min) with no contradictory labels.

## 8. Timing Contract (agent → API → dashboard)

| Layer | Value | Source |
|---|---|---|
| Agent telemetry tick | 30 s default (`TF_INTERVAL`) + up to 3 s jitter | `config.rs:71-72`, `agent.rs:100-104` |
| Agent 5xx retry | infinite exponential backoff 500 ms → 2× → 15 s cap | `client.rs:318-351` |
| Agent 429 handling | warn + sleep 60 s | `client.rs:313-317` |
| Agent 401 handling | consecutive-auth-failure counter → credential recovery / re-register | `agent.rs:200-270` |
| Network error | non-fatal; retried on next tick (loop never exits) | `agent.rs:135-139`, `client.rs:304` |
| Security report | 3600 s (`TF_SECURITY_INTERVAL`) | `config.rs:74` |
| Inventory report | 7200 s (`TF_INVENTORY_INTERVAL`) | `config.rs:77` |
| Remote / command polling | 15 s each | `config.rs:83`, `agent.rs:111` |
| ONLINE threshold | 5 min | `device-presence.ts:21` |
| OFFLINE threshold | 15 min | `device-presence-state.ts:25` |
| Presence sweep scheduler | every minute, Redis lock, TTL 55 s | `presence-sweep-scheduler.service.ts:73,57` |
| Dashboard summary poll | ~15 s, backoff 2× → 120 s cap, pauses when hidden | `useDashboardSummary.ts:63-65` |
| Device list poll | 15 s normal / 3 s fast / 10 s disconnected | `useDevices.ts` |
| Device detail presence tick | 30 s re-render | `device-health/[id]/page.tsx:56-61` |
| Onboarding device detection | 3 s poll | `OnboardingFlow.tsx` |

## 9. Presence Sweep Scheduler

`PresenceSweepSchedulerService` (`presence-sweep-scheduler.service.ts`) fires on `CronExpression.EVERY_MINUTE`:

1. Acquires a Redis distributed lock (`techfusion:presence-sweep:lock`, TTL 55 s) with a compare-and-delete
   Lua release, so only one instance enqueues per minute.
2. On lock success, calls `QueueService.addPresenceSweep({ allOrgs: true, scheduledAt })`.
3. Releases the lock in `finally` even on enqueue failure; lock-acquisition failure is caught and
   logged without crashing the tick.

Registered via `MonitoringModule` + `ScheduleModule` in `app.module.ts`. This is the surface where
**defect D1** lived (see Section 17).

## 10. Presence Sweep Worker Execution

`processMonitoringJob` (`worker/src/processors.ts`) routes `JOB_NAMES.MONITORING.PRESENCE_SWEEP`
to `runMonitoringSweep` (`worker/src/monitoring-sweep.ts`). The sweep:

- Loads enabled `kind: 'presence'` alert rules, groups by org.
- Derives presence per device from `lastSeenAt` using the worker's mirrored `derivePresenceState`
  (`presence-state.ts`).
- For `OFFLINE` devices, opens a **deduplicated** alert per `(ruleId, deviceId)` via the unique
  `activeKey` (DB-level one-open-alert invariant), refreshing `metricValue`/`lastDetectedAt` while
  open; promotes legacy NULL-`activeKey` duplicates into the single active alert.
- Auto-resolves OPEN/ACKNOWLEDGED alerts when the device becomes reachable again (DEGRADED/ONLINE),
  and auto-resolves metric alerts whose condition cleared.
- Queues webhook notifications for newly-created/promoted alerts.

## 11. Device Token Authentication

`DeviceTokenGuard` (`device-token.guard.ts`) is the sole gate on telemetry ingestion:

- Requires `Authorization: Bearer <token>` (else 401).
- Looks up the device by SHA-256 **hash** of the token (`deviceTokenHash`); falls back to the raw
  `deviceToken` lookup for legacy rows that predate hashing. Raw tokens are never persisted.
- Rejects unknown tokens (401) and `inactive` devices (401 "Device is disabled").
- Sets `request.device` and `request.orgId` from the resolved device — org/device identity can
  never be forged via request body or headers.

## 12. Dashboard Summary Computations

`GET /dashboard/summary` (requires `MONITORING_VIEW`; Owners/Admins have it) computes the fleet
totals in a single pass over the org's devices (`dashboard.service.ts:123-141`): `fleet.total`,
`fleet.online`, `fleet.degraded`, `fleet.offline`, `fleet.unknown`, plus per-band `freshness`
(live/recent/stale/unavailable) and `recentDevices` (top 8 by lastSeenAt). All counts derive from
`Device.lastSeenAt` via the shared `derivePresenceState`/`classifyFreshness` — the same derivation
the device list uses, so counts and per-device badges cannot disagree.

## 13. Frontend Polling & State Consumption

- **Command Center** uses exactly one surface poller, `/dashboard/summary`, through
  `useDashboardSummary` (poll-after-complete ~15 s, exponential backoff 2× to 120 s, paused when the
  document is hidden and refreshed immediately on return, no overlapping requests — the
  `useCommandCenterData` contract at `useCommandCenterData.ts:21-29`). Live alerts ride the WebSocket;
  the `/backups/runs` poller only runs while a backup is active.
- **Device Health Center** polls `GET /devices` (15 s normal / 3 s fast / 10 s disconnected) and
  renders 4-state badges via `derivePresenceState`.
- **Device detail** keeps a 30 s presence tick and live WebSocket metric pushes (`addLiveMetric`).
- **Onboarding** polls device detection every 3 s with correct `clearInterval` cleanup on
  unmount/completion.

## 14. Org Switch & Refresh Behavior

Membership-authoritative role resolution re-mints JWTs bound to the switched org (ORG-01A3/01C,
certified). Because `apiFetch` sends the current org token and the summary poller refetches on
mount/visibility, a switch to another org surfaces that org's fleet (isolation proven in test D3:
org A's summary never lists org B's devices). No `X-Org-Id` is trusted from the client on the
dashboard or telemetry paths.

## 15. Conflicting State Sources — Cross-Page Consistency Audit

Audited every surface that renders device presence:

| Surface | State model | Verdict |
|---|---|---|
| Command Center (`CommandCenterPage`, `FleetPresenceSummary`, recent-devices table) | 4-state `derivePresenceState` | Consistent |
| Device Health Center list | 4-state `derivePresenceState` | Consistent |
| Device detail page (`[id]/page.tsx`) | **binary `isDeviceOnline`** | **DEFECT D3 — DEGRADED shown as "Offline"** |
| Remote support device list | **local 30-minute literal** | **DEFECT D4 — 30 min vs 5 min window** |
| AI chat drawer dots | binary `isDeviceOnline` (dot only) | Acceptable (online/not-online dot, no text conflict) |

Defects D3/D4 were the only proven conflicting-state-source instances; both fixed (Sections 19-20).
The worker sweep and dashboard use the identical mirrored thresholds; `device-presence-state.spec.ts`
(API + web) guards against threshold drift.

## 16. Defects Found — Summary

| ID | Severity | Symptom | Root cause | Fix | Covered by |
|---|---|---|---|---|---|
| D1 | High | `Failed to enqueue presence sweep: Custom Id cannot contain :` every minute; presence sweep jobs never reached the worker | BullMQ custom jobId built from ISO minute key containing `:` | `replace(':', '-')` in `addPresenceSweep` | `src/queue/queue.service.spec.ts` + real BullMQ/Redis check |
| D2 | Medium | Malformed telemetry `timestamp` ⇒ HTTP 500 | no format validation; `Invalid Date` reached Prisma | `@IsString() @IsISO8601()` on `timestamp` | `test/presence-telemetry.spec.ts` T5b |
| D3 | Low | Same device labeled "Offline" (detail) vs "Degraded" (list) | binary vs 4-state derivation | detail page uses shared `derivePresenceState` + design tokens | `web` `device-detail-page.spec.tsx` (new DEGRADED case) |
| D4 | Low | Same device "online" in remote support while OFFLINE elsewhere | local `30 * 60 * 1000` literal | use shared `isDeviceOnline` (5 min) | web typecheck/build |

## 17. D1 — Presence Sweep jobId Colon Defect

**Reproduction** (real BullMQ, no mock):

```
jobId: presence-sweep-2026-08-08T14:46
THROWS: Custom Id cannot contain :
```

BullMQ rejects custom job ids containing `:` unless they match the repeatable 3-part format
(`node_modules/bullmq/dist/cjs/classes/job.js:1041-1050`). `addPresenceSweep` used
`presence-sweep-${new Date().toISOString().slice(0, 16)}` → `...T06:15`, which always throws. The
scheduler's `catch` logged the failure and released the lock, so the **sweep never ran**.

**Fix** (`queue.service.ts:237`): `minuteKey = ...slice(0, 16).replace(':', '-')` → valid,
per-minute deduplicated jobId (`presence-sweep-2026-08-08T14-47`). Verified end-to-end against
real BullMQ + Redis 6381: enqueue OK, job fetched back, removed after the check.

## 18. D2 — Malformed Telemetry Timestamp 500

**Reproduction**: `POST /devices/metrics` with `timestamp: "not-a-date"` returned **500**. The DTO
had `@IsOptional() timestamp?: string` with no format check; `new Date("not-a-date")` = `Invalid
Date` and Prisma threw `Provided Date object is invalid`.

**Fix**: `@IsString() + @IsISO8601()` on `timestamp` (`metrics-payload.dto.ts:102-105`). The agent
sends RFC 3339 (`Utc::now().to_rfc3339()`), which passes; malformed values now yield a 400
(proven by test T5b). Client-supplied timestamps still cannot affect presence because
`lastSeenAt` is server time (T6).

## 19. D3 — Device Detail Page DEGRADED/Offline Label Inconsistency

`device-health/[id]/page.tsx` used `isDeviceOnline` (binary), so a device quiet for 5–15 min showed
**"Offline"** while the Health Center list and Command Center showed **"Degraded"** — two state
sources producing contradictory labels for one device. Fix: derive `presence` via the shared
`derivePresenceState` and render `PRESENCE_BADGE_VARIANT[presence]` / `PRESENCE_STATE_LABELS[presence]`
(detail page now shows Online/Degraded/Offline/Unknown identically to other surfaces). A new
test asserts a 10-min-quiet device renders "Degraded" and **not** "Offline".

## 20. D4 — Remote-Support 30-Minute Literal

`remote-support/page.tsx` defined a local `isDeviceOnline` with `30 * 60 * 1000`, silently
diverging from the shared 5-minute `DEVICE_ONLINE_THRESHOLD_MS`. A device last seen 20 minutes ago
was therefore "online" for remote support while OFFLINE/DEGRADED everywhere else. Fix: deleted the
local copy and imported the shared `isDeviceOnline` from `@/lib/device-presence`, eliminating the
duplicated state source (this also removes a future drift hazard: the local literal could have
diverged again independently of the shared constant).

## 21. Test Matrix — Presence (P1–P4)

Suite: `test/presence-telemetry.spec.ts`. All PASS.

| ID | Assertion |
|---|---|
| P1 | Authenticated telemetry freshens the device; `GET /devices` shows `presence: ONLINE` |
| P2 | Unauthenticated telemetry → 401 and `lastSeenAt` unchanged |
| P3 | Device A's credential cannot alter Device B's `lastSeenAt` |
| P4 | Org A activity cannot alter a device in Org B |

## 22. Test Matrix — Online/Offline (O1–O4)

| ID | Assertion |
|---|---|
| O1 | `lastSeenAt` older than 15 min + 1 min ⇒ `presence: OFFLINE` |
| O2 | An OFFLINE device remains listed (record not deleted) |
| O3 | Historical metrics survive a transition to OFFLINE |
| O4 | Fresh telemetry returns the same device to ONLINE (same device id, list flips) |

## 23. Test Matrix — Telemetry Safety (T1–T6)

| ID | Assertion |
|---|---|
| T1 | Valid nested telemetry → 201; metric persisted with correct values/org |
| T2 | Unknown credential → 401 |
| T3 | Forged `deviceId`/`orgId` in the body cannot redirect attribution (metric always on the authenticated device) |
| T4 | Org A device metrics never land in Org B |
| T5a | CPU usage 150 → 4xx (out of range) |
| T5b | Malformed `timestamp` → 4xx, **never 500** (D2 fix) |
| T5c | Non-numeric CPU usage → 4xx |
| T6 | Future/past client timestamps cannot move `lastSeenAt` (server receive time is authoritative) |

## 24. Test Matrix — Dashboard (D1–D3)

| ID | Assertion |
|---|---|
| D1 | Summary `online/degraded/offline` counts match per-device derivation (2 devices: 1 online, 1 offline) |
| D2 | Summary recovers (offline 1→0, online 1→2) after fresh telemetry from a previously offline device |
| D3 | Org A summary excludes Org B devices entirely |

## 25. Test Matrix — Scheduler & Enqueue (S1–S4)

| ID | Assertion | Source |
|---|---|---|
| S1 | Tick with lock acquired enqueues one all-org sweep and releases the lock | `presence-sweep-scheduler.service.spec.ts` |
| S2 | Tick while lock held by another instance enqueues nothing | `presence-sweep-scheduler.service.spec.ts` |
| S3 | Enqueue failure is logged and the lock is still released | `presence-sweep-scheduler.service.spec.ts` |
| S4 | Lock-acquisition failure does not throw; no enqueue | `presence-sweep-scheduler.service.spec.ts` |
| S1b | `addPresenceSweep` enqueues `presence_sweep` on the monitoring queue with `allOrgs: true` | `queue.service.spec.ts` |
| S2b | The jobId contains **no colon** (BullMQ-valid) — the D1 regression guard | `queue.service.spec.ts` |
| S3b | Per-minute jobId dedup is stable across calls within the minute | `queue.service.spec.ts` |
| S4b | `removeOnComplete`/`removeOnFail` retention options are preserved | `queue.service.spec.ts` |

## 26. Test Matrix — Reconnect & Recovery (R1–R3)

| ID | Assertion | Evidence |
|---|---|---|
| R1 | Agent resumes after a network outage and re-establishes presence on the next tick (server side returns ONLINE) | `agent.rs` loop never exits on `ClientError::Network`; integration tests P1/O4 exercise the server half |
| R2 | Stale/rotated token triggers recovery flow (401 → re-register / credential recovery) without manual intervention | `agent.rs:200-270`; lifecycle D-series certifies rotation semantics |
| R3 | Scheduler survives API restarts / multi-instance via the Redis distributed lock | `presence-sweep-scheduler.service.spec.ts` S1–S4 |

Real-device end-to-end reconnection timing is deferred to the manual certification plan (Section 35).

## 27. Regression Verification

| Gate | Command | Result |
|---|---|---|
| API full suite (incl. integration) | `jest --forceExit --runInBand` | **902/902** (baseline 879 + 23 new) |
| Lifecycle data integrity | `test/lifecycle-data-integrity.spec.ts` | **27/27** |
| Billing regression | `src/billing` | **55/55** |
| Web suite | `jest --forceExit` | **777/777** (includes new DEGRADED case) |
| Worker suite | `jest --forceExit --runInBand` | **79/79** |
| Agent | `cargo test` | **78/78** |
| API typecheck | `tsc --noEmit` | Clean |
| Web typecheck | `tsc --noEmit` | Clean |
| Web build | `next build` | Success |
| Worker typecheck | `tsc --noEmit` | Clean |

## 28. Baseline Certification Counts

- API regression baseline: **879/879** → **902/902** (+4 `queue.service.spec.ts`, +19
  `presence-telemetry.spec.ts`).
- Lifecycle: **27/27** (unchanged, re-verified).
- Billing: **55/55** (unchanged, re-verified).
- No previously certified subsystem regressed.

## 29. Timing Targets Analysis

Targets from the brief: `ONLINE ≤ ~10 s after agent resumes`; `OFFLINE ≤ ~60 s after disappearance`,
"only if achieved safely; document tradeoffs; keep intervals configurable where supported."

- **ONLINE**: the authoritative heartbeat is the telemetry tick (30 s default + ≤ 3 s jitter). Worst
  case for the server to see fresh data after an agent resumes is ≈ 33–40 s (tick + jitter + HTTP +
  ingest), comfortably inside the 5-minute ONLINE band. Reaching ≤ 10 s would require either
  shortening `TF_INTERVAL` to ≤ 5–8 s globally (≈ 4–6× the metric-write volume and scoring work) or a
  dedicated lightweight heartbeat endpoint — both rejected: over-tuning per the guardrails, new
  surface area for no correctness benefit. **Documented tradeoff: ONLINE detection is tick-bound at
  ≈ 40 s worst case, not 10 s.**
- **OFFLINE**: by design, OFFLINE is derived at read time only after the 15-minute threshold; the
  5/15-minute bands exist precisely to avoid false OFFLINE on transient blips (10 missed-heartbeat
  tolerance + sleep/wake). `OFFLINE ≤ 60 s` cannot be achieved without collapsing those bands into a
  ~1-minute window, which would produce false OFFLINE on any 60 s+ network hiccup. **Documented
  tradeoff: OFFLINE detection is threshold-bound at 15 min, not 60 s.** The per-device label always
  reflects the *current* derivation instantly (no poll delay beyond the UI's 3–30 s poll), and the
  presence sweep converts OFFLINE into alerts within the next minute tick.

## 30. Interval Configurability

All agent intervals are env/flag-configurable: `TF_INTERVAL` (30 s), `TF_SECURITY_INTERVAL` (3600 s),
`TF_INVENTORY_INTERVAL` (7200 s), `TF_REMOTE_POLLING_INTERVAL` (15 s). Operators who require faster
ONLINE detection can lower `TF_INTERVAL` to 10–15 s without code changes (at increased write/score
volume); thresholds are shared constants with a documented path for change. No interval was changed
in this stage.

## 31. Risk & Tradeoff Register

| Risk | Mitigation / decision |
|---|---|
| Faster ONLINE detection requires more writes | Interval kept at 30 s; configurable per operator (Section 30) |
| Shorter OFFLINE threshold would cause false alarms | 15-minute band kept; alerts fire only at OFFLINE (not DEGRADED) |
| Scheduler enqueue failure was silent | D1 fixed; S2b test guards the jobId; scheduler logs failures distinctly from lock-skips |
| Client clock skew vs telemetry timestamps | `lastSeenAt` is server time (T6); `recordedAt` from a skewed client affects only metric history freshness (`unavailable` for future), never presence |
| Threshold drift across 4 mirrored modules | Mirrored constants guarded by `device-presence-state.spec.ts` in API and web; worker has its own mirror spec |
| DB growth from per-minute sweep jobIds | Job dedup per minute + `removeOnComplete { count: 50 }` / `removeOnFail { count: 20 }` retention |

## 32. False-Positive / False-Negative Analysis

- **False OFFLINE** (device online but labeled OFFLINE): requires `lastSeenAt` > 15 min. With a
  30 s tick this means ≥ 30 consecutive failed cycles (or genuine sleep/disconnect). The 5-minute
  ONLINE window keeps short blips from even reaching DEGRADED. Residual: a device that sleeps for
  > 15 min legitimately reads OFFLINE until its next tick wakes it (≤ 40 s later).
- **False ONLINE** (device offline but labeled ONLINE): requires a forged/rotated token or a
  malicious replay. Guarded by `DeviceTokenGuard` (hash lookup, inactive rejection), server-time
  `lastSeenAt`, and T6 (client timestamps cannot move it). Within-window replay of a captured token
  is a general auth limitation, not a presence-model defect.
- **Stale dashboard counts**: summary is derived at query time; UI poll staleness is bounded by the
  15 s poller and refreshed on visibility return.

## 33. Presence Alert Integration

Presence alerts are `kind: 'presence'` rules evaluated by the worker sweep (Section 10). A device
reaching `OFFLINE` opens a deduped alert (unique `activeKey`) with `source: 'presence'`; the alert
auto-resolves when the device is reachable again (DEGRADED/ONLINE) on a subsequent sweep. The
`presence_sweep` job that drives this is the job fixed in D1 — before the fix these alerts could not
be created by the scheduler. Webhook notifications are queued for new/promoted OFFLINE alerts.

## 34. Scope Boundary Confirmations

- No changes to org/membership/RBAC/invitations/account-deletion/billing/enrollment-token/reset-identity.
- No schema change, no migration added; `prisma migrate deploy` in `test/setup.ts` applies the
  existing schema to the test DB only.
- No new infrastructure (no WebSockets/Redis/Kafka additions; Redis/BullMQ already present and used).
- Agent source unchanged (interval values, retry/backoff, payload shape, recovery) — verified, not
  modified.
- `reset-identity` was not invoked anywhere in this stage; real-device reconnect tests will not use
  it (per Rule Zero).

## 35. Real-Device Certification Plan (manual, follow-on)

Status will remain `AUTOMATED CERTIFICATION COMPLETE — REAL-DEVICE TEST PENDING` until executed.

- **RD-01** Install/enroll a real Linux device against a staging API (install-linux.sh) and confirm
  ONLINE within 1 min in the Health Center.
- **RD-02** Confirm `/devices/metrics` appears in API request logs; verify the metric payload shape.
- **RD-03** Stop the agent (systemctl stop) for 6 min → verify DEGRADED label everywhere (Health
  Center, Command Center, device detail).
- **RD-04** Stop for 16 min → verify OFFLINE label and a `source: presence` alert appears within one
  sweep tick; confirm the scheduler log no longer contains the D1 error.
- **RD-05** Start the agent → verify ONLINE returns within ~40 s on all surfaces (no
  `reset-identity`, no service auto-start).
- **RD-06** Restart the API gateway and worker mid-test → verify the sweep resumes via the lock with
  no duplicate enqueues.
- **RD-07** Rotate the device token via credential recovery → verify presence continues after the
  next tick (no manual re-registration).
- **RD-08** Let the device sleep > 15 min then wake → verify OFFLINE → ONLINE recovery within ~40 s.
- **RD-09** Confirm the dashboard summary counts track the device list badges for the real device.

## 36. Open Questions & Follow-ups

- Optional future: a lightweight presence heartbeat to reach the aspirational `ONLINE ≤ 10 s` target
  (deliberately not implemented — Section 29).
- The AI chat drawer and AI chat page still use binary `isDeviceOnline` for a status *dot*; this is
  acceptable today but could adopt the 4-state text/dot tokens for full uniformity.
- None blocking certification.

## 37. Files Modified

| File | Change |
|---|---|
| `apps/api-gateway/src/queue/queue.service.ts` | D1 fix: sanitize presence-sweep jobId (`replace(':', '-')`) |
| `apps/api-gateway/src/queue/queue.service.spec.ts` | **New** — 4 tests incl. no-colon regression guard |
| `apps/api-gateway/src/devices/dto/metrics-payload.dto.ts` | D2 fix: `@IsString() @IsISO8601()` on `timestamp` |
| `apps/api-gateway/test/presence-telemetry.spec.ts` | **New** — 19-test P/O/T/D suite |
| `apps/web/src/app/dashboard/device-health/[id]/page.tsx` | D3 fix: 4-state presence badge |
| `apps/web/src/__tests__/device-detail-page.spec.tsx` | D3 regression test (DEGRADED ≠ "Offline") |
| `apps/web/src/app/dashboard/remote-support/page.tsx` | D4 fix: shared `isDeviceOnline`, drop 30-min literal |
| `docs/v1/V1-STAGE-01B_PRESENCE_TELEMETRY_RELIABILITY_REPORT.md` | This report |

## 38. Final Status

```
AUTOMATED CERTIFICATION COMPLETE — REAL-DEVICE TEST PENDING
```

Status ladder: PENDING → AUTOMATED CERTIFICATION COMPLETE — REAL-DEVICE TEST PENDING (current) →
REAL-DEVICE CERTIFICATION COMPLETE (after Section 35) → FULLY CERTIFIED.

## 39. Certification Evidence

| Evidence | Location |
|---|---|
| D1 real-BullMQ reproduction + fix verification | Section 17; `queue.service.spec.ts` |
| D2 500 → 400 reproduction + fix | `test/presence-telemetry.spec.ts` T5b |
| Presence/telemetry/dashboard suite | `test/presence-telemetry.spec.ts` (P1–P4, O1–O4, T1–T6, D1–D3) |
| Scheduler behavior | `presence-sweep-scheduler.service.spec.ts` (S1–S4) |
| Agent contract (intervals/retry/payload) | `config.rs`, `agent.rs`, `client.rs` (audit) |
| Worker sweep + presence alerts | `monitoring-sweep.ts`, `monitoring-sweep.spec.ts` (pre-existing, re-verified) |
| Threshold mirror guards | `device-presence-state.spec.ts` (API + web) |

## 40. Rules Honoured

- Audit-first: full path mapped and both defects reproduced (D1 against real BullMQ; D2 as a failing
  integration test) before any code change.
- Only proven inconsistencies fixed (D1, D2, D3, D4); nothing redesigned.
- No `reset-identity` usage; no systemd service stop/start/reboot performed; no host network changes
  — real-device steps are manual-only instructions.
- No wipe/reset/drop of any real database; only isolated test records on the test DB (5434).
- Dirty worktree preserved; no `git reset --hard`, `git clean`, `git checkout .`, or `git restore .`.
- No commits, pushes, tags, or releases made.

## 41. Scheduler Resilience Notes

The distributed lock uses `ioredis` with `connectTimeout: 2000` / `maxRetriesPerRequest: 0` and a
lock TTL of 55 s against a 60 s cron — a full sweep tick has time to complete and release before the
lock expires. If Redis is briefly down at tick time, the acquire failure is caught, logged, and the
next minute retries; the agent's metric path (which does not depend on the scheduler) keeps presence
fresh regardless. The D1 fix restored the scheduler's end-to-end function: the job now actually
reaches the monitoring queue and the worker sweep runs.

## 42. Telemetry Payload Contract (agent ↔ DTO)

The agent serializes a **nested** payload (`cpu.usage`, `memory.total`, `disk.used`, …); the DTO
mirrors this nesting exactly (`CpuMetricsDto`, `MemoryMetricsDto`, …). Extra fields (e.g. `cpu.model`)
are stripped by the whitelist rather than rejected, which is safe. Flat-field payloads (used by one
pre-existing e2e fixture) are tolerated but degrade to zeroed metrics — noted so new fixtures use
the nested shape.

## 43. Freshness vs Presence Cross-Check

Dashboard `fleet.freshness` (live/recent/stale/unavailable) and `fleet.online/degraded/offline/unknown`
are computed from the same `lastSeenAt` in the same loop (`dashboard.service.ts:128-141`), so the two
views can never disagree on an input. A DEGRADED device is necessarily `stale` (its last metric is
> 5 min old) — the labels "Degraded" (presence) and "stale" (metric) are consistent, not contradictory.

## 44. Glossary

| Term | Definition |
|---|---|
| `lastSeenAt` | Server-receive timestamp updated on every authenticated metrics ingest; the sole presence source of truth |
| ONLINE / DEGRADED / OFFLINE / UNKNOWN | 4-state presence derived from `lastSeenAt` age (≤5 min / ≤15 min / >15 min / invalid) |
| live / recent / stale / unavailable | Metric freshness bands (≤60 s / ≤5 min / >5 min / invalid) |
| Presence sweep | Per-minute scheduled job that evaluates presence alert rules in the worker |
| `activeKey` | Unique `(alertRuleId:deviceId)` key enforcing one open alert per rule/device |
| `deviceTokenHash` | SHA-256 hash of the device token; the persisted credential lookup key |

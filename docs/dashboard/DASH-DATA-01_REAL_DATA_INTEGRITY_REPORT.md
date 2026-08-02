# DASH-DATA-01 — REAL DATA INTEGRITY REPORT

> **Document ID:** DASH-DATA-01
> **Phase:** Product Execution — Dashboard
> **Type:** Mission Report / Data-Integrity Verification
> **Priority:** P0
> **Date:** 2026-08-02
> **Mode:** Implement ONE authoritative org-scoped dashboard aggregation endpoint; truth-patch the web dashboard (P0 defects D01–D04); no authentication baseline changes.

---

## 1. Mission Identity

| Field | Value |
|-------|-------|
| Mission ID | **DASH-DATA-01** |
| Mission name | Real Data Integrity |
| Preceding missions | DASH-01 (analysis), DASH-02 (blueprint), AUTH-CERT-01 (auth baseline certified & frozen) |
| Reference docs | `docs/dashboard/DASH-01_CURRENT_DASHBOARD_ANALYSIS.md`, `docs/dashboard/DASH-02_COMMAND_CENTER_BLUEPRINT.md`, `docs/TG-CORE/TG-CORE_V1_EXECUTION_CONSTITUTION.md`, `docs/TG-3/TG-3_V1_DESIGN_QUALITY_FRAMEWORK.md`, `docs/certifications/AUTH-CERT-01_AUTHENTICATION_CERTIFICATION.md` |
| Decision | **DELIVERED — real data everywhere; zero fabricated values** |

---

## 2. Mission Objective

Replace the fabricated/fragmented dashboard data path with ONE authoritative, org-scoped, read-only aggregation endpoint (`GET /dashboard/summary`) that all four roles (Owner / Admin / Technician / Viewer) can call, and wire the web dashboard to it so every tile shows **real** data or an **honest** null/zero/unavailable state — never a placeholder pretending to be a fact.

The endpoint is read-only aggregation only. Specialist business-logic ownership (security / backups / reports / devices / alerts) is preserved in their existing modules; the dashboard aggregates their persisted, org-scoped state.

---

## 3. Scope & Constraints

**In scope:**
- One new backend module `src/dashboard/` (module, controller, service, types, pure helpers).
- `GET /dashboard/summary` available to Owner / Admin / Technician / Viewer (no `@Roles()`); unauthenticated requests stay rejected by the global `CombinedAuthGuard`.
- Truth-patch of `apps/web/src/app/dashboard/page.tsx` plus a new typed hook `useDashboardSummary`.
- Tests for both backend and web; `tsc --noEmit` on both apps.

**Out of scope / frozen (per mission contract):**
- **Authentication is CERTIFIED & FROZEN (AUTH-CERT-01).** No changes to `apps/web/src/lib/auth-client.ts`, `socket-client.ts`, `components/auth/**`, `components/login/**`, `components/signup/**`, auth routes, MFA, auth backend, tokens, redirects, or auth tests. **Authentication files modified: NONE.**
- **`apps/api-gateway/src/devices/device-presence.ts` and `apps/web/src/lib/device-presence.ts` were NOT modified** (reused read-only). **device-presence modified: NO.**
- No Prisma schema / migration changes (schema untouched).
- No visual redesign, no dashboard tech-debt fixes. D05–D12 out of scope (D05 = "SEPARATE SECURITY FEATURE MISSION", D06 = "DASH-SEC-01").
- No dependency version changes to make tests run; no destructive git commands.

---

## 4. P0 Defects Context (from DASH-01)

| ID | Defect | Root cause | Resolution in this mission |
|----|--------|-----------|----------------------------|
| D01 | **Fabricated Fleet Score** | Inline IIFE averaged arbitrary per-card values (Devices+Alerts+Team+…) and defaulted `score ?? 0`; `reporting.service` `collectFleetSummaryData` defaults missing health/security scores to `0`/`100`. | Removed the IIFE. `Device Health` now = average of the latest `DeviceHealthScore` per device (real), `null` when none. |
| D02 | **Fake deltas / trends** | CountCard change/trend badges invented `+N`/`-N%` from nothing. | Removed trend/change badges entirely. No trend is shown unless a real dataset exists. |
| D03 | **"No Data Yet" fabrication** | Dashboard blocked real data behind a fake empty state, and backend would emit placeholder-as-fact. | Backend emits only real counts or `null`/true zeros/omitted; UI renders "—", "No scans yet", "No health scores yet", "No backups yet", "Status unavailable" as honest states. No "No Data Yet" anywhere. |
| D04 | **Wrong data sources** | Page called `/alerts/latest` (take:10 — not an aggregation) and `/admin/dashboard` (Owner/Admin-only; Viewer/Technician broken). | Single org-scoped `GET /dashboard/summary` for all roles; page reads only the hook. |

---

## 5. Deliverables

1. **Backend** — `src/dashboard/` module + `GET /dashboard/summary` + 5 test suites (65 tests).
2. **Web** — `useDashboardSummary` hook + dashboard page truth patch + 2 test suites (6 tests).
3. **Registration** — `DashboardModule` imported in `src/app.module.ts`.
4. **This report** — `docs/dashboard/DASH-DATA-01_REAL_DATA_INTEGRITY_REPORT.md`.

---

## 6. Architecture Overview

```
web page (apps/web/src/app/dashboard/page.tsx)
   └─ useDashboardSummary (new hook, 15s poll, typed contract)
        └─ apiFetch('/dashboard/summary')            // auth token, global guard
             └─ DashboardController.getSummary        // no @Roles → all 4 roles
                  └─ DashboardService.getSummary(orgId)  // org-scoped, read-only
                       ├─ PrismaService (org-scoped queries)
                       ├─ device-presence (reused: classifyFreshness / isDeviceOnline)
                       ├─ severity-normalization.ts   // pure
                       ├─ worst-risk-level.ts         // pure
                       └─ operational-state.ts        // pure (R0–R4)
```

The controller is a thin pass-through; `req.user.orgId` comes from the JWT (existing guard pipeline — untouched). All aggregation is one `Promise.all` over org-scoped queries executed in parallel.

---

## 7. Endpoint Contract

**Route:** `GET /dashboard/summary` (mounted under global `/api` prefix via the gateway)

**Auth:** JWT required (global `CombinedAuthGuard`). No `@Roles()` decorator → Owner, Admin, Technician, Viewer all receive `200`. Unauthenticated/invalid token → `401`.

**Request:** none (org derived from token).

**Response:** `DashboardSummaryResponse` (see `src/dashboard/dashboard.types.ts`):

| Section | Fields |
|---------|--------|
| `generatedAt` | ISO timestamp of aggregation |
| `fleet` | `total`, `online`, `offline`, `freshness{live,recent,stale,unavailable}`, `deviceHealth (number\|null)`, `recentDevices` (≤ 8, ordered by lastSeenAt desc) |
| `alerts` | `unacknowledged`, `bySeverity{critical,high,medium,low,warning,unknown}` |
| `security` | `openFindings{critical,high,medium,low,total}`, `worstRiskLevel (critical\|high\|medium\|low\|null)`, `scanCoverage{scannedDevices,onlineDevices,coveragePercent(number\|null),lastScanAt}`, `unscannedOnlineDevices`, `latestScanAgesDays (number\|null)` |
| `operations.backups` | `running`, `pending`, `failedLast24h`, `completedLast24h`, `lastCompletedAt`, `lastCompletedJobName`, `nextScheduledAt` |
| `operations.scans` | `running`, `pending`, `failedLast24h`, `completedLast24h` |
| `operations.reports` | `generating`, `failed`, `completed`, `generatedLast30d` |
| `team` | `total` |

---

## 8. Field-by-Field Data Provenance (No Fabrication)

Every field maps to a persisted, org-scoped Prisma query. No value is invented, averaged-from-unrelated-data, or defaulted to a fake positive.

| Field | Authoritative source | Fabrication rules |
|-------|----------------------|-------------------|
| `fleet.total` | `Device.findMany({where:{orgId}}).length` | real count |
| `fleet.online` | count of devices where `isDeviceOnline(lastSeenAt, now)` (threshold `DEVICE_ONLINE_THRESHOLD_MS` from device-presence) | real count |
| `fleet.offline` | `total - online` | derived from two real counts |
| `fleet.freshness` | `classifyFreshness(lastSeenAt, now)` per device (device-presence bands) | real counts |
| `fleet.deviceHealth` | mean of latest `DeviceHealthScore` per device (distinct deviceId, desc `calculatedAt`), rounded | `null` when no scores — never derived from online-count |
| `recentDevices` | devices ordered by `lastSeenAt desc`, slice 8 | real records; `null` field when DB null |
| `alerts.unacknowledged` | `Alert.groupBy(severity)` where `acknowledgedAt: null`, sum | real count; true zero when none |
| `alerts.bySeverity` | same groupBy bucketed via `normalizeSeverity` | unknown strings → `unknown` bucket (no escalation) |
| `security.openFindings.*` | `SecurityFinding.groupBy(severity)` where `status:'open'` | only critical/high/medium/low counted; `total` = sum |
| `security.worstRiskLevel` | `worstRiskLevel()` over latest `SecurityScore.riskLevel` per device (distinct deviceId) | `null` when no legitimate latest score — no averaged/fake security |
| `security.scanCoverage.coveragePercent` | `scannedOnline / online * 100`, rounded | `null` ONLY when `onlineCount === 0` (invalid denominator); truthful `0` when online devices exist but none scanned |
| `security.unscannedOnlineDevices` | `onlineCount - scannedOnlineCount` | real difference |
| `security.latestScanAgesDays` | `floor((now - lastCompletedScan.completedAt)/day)` | `null` when no completed scan |
| `operations.backups.*` | `BackupRun.count`/`findFirst` by real status + 24h `startedAt` window; `BackupJob` next scheduled (isEnabled, nextRunAt not null) | truthful zeros; `null` timestamps when absent |
| `operations.scans.*` | `SecurityScan.count` by real status + 24h window | truthful zeros |
| `operations.reports.*` | `Report.count` by real status; `generatedLast30d` = completed in 30d `createdAt` window | truthful zeros |
| `team.total` | `User.count({where:{orgId}})` | real count; UI shows "—" (null) when summary unavailable — **no `\|\| 1` fallback** |

---

## 9. Severity Normalization

`normalizeSeverity(value)` (`src/dashboard/severity-normalization.ts`):
- Canonical set: `critical | high | medium | low | warning`; anything else (null, empty, whitespace, case-variant unknown) → `unknown`.
- `Alert.severity` is a free-form String in Prisma; this is why normalization is mandatory.
- **No escalation:** unrecognized values bucket to `unknown`, never counted as critical/high/medium/low — so they cannot falsely degrade the operational state.

---

## 10. Worst-Risk Derivation

`worstRiskLevel(riskLevels)` (`src/dashboard/worst-risk-level.ts`):
- Ordering `critical > high > medium > low` (rank map).
- Input = `riskLevel` of the latest `SecurityScore` per device (`distinct: ['deviceId']`, desc `calculatedAt`).
- Unknown/blank values are skipped; returns `null` when there is no legitimate latest score.
- `riskLevelOrder()` is exported for future UI use. **No averaged/fake security score** is ever returned.

---

## 11. Operational State Machine (R0–R4)

`deriveOperationalState(input)` (`src/dashboard/operational-state.ts`) — pure, unit-tested, derived strictly from real aggregation outputs (per DASH-02 R0–R4):

| State | Rule (in evaluation order) |
|-------|----------------------------|
| `NO_DATA` | `fleetTotal === 0` |
| `CRITICAL` | critical alert > 0, or critical open finding > 0, or all devices offline |
| `DEGRADED` | high alert > 0, or high open finding > 0, or failed backup (24h) > 0, or failed scan (24h) > 0, or offline > 50% |
| `ATTENTION` | any alert/finding, or any offline device, or backup running/pending |
| `OPERATIONAL` | none of the above |

The state is part of the derivation toolchain and unit-tested; the current payload does not emit it, avoiding any ambiguity about who owns security posture judgment.

---

## 12. Fleet Health Derivation

- `fleet.deviceHealth` = average of the **latest per-device** `DeviceHealthScore.healthScore` (distinct deviceId, ordered by `calculatedAt desc`), rounded to integer.
- `null` when no health scores exist.
- **Deliberately NOT** derived from online count, alert count, or any other proxy. This kills D01: the fabricated per-card average is gone; the number is a real mean of persisted health scores.

---

## 13. Scan Coverage & Age Derivation

- `scannedDevices` = distinct devices with a completed `SecurityScan`.
- `coveragePercent = round(scannedOnline / online * 100)`.
  - `null` **only** when `onlineCount === 0` (denominator invalid — no fabricated 0% or 100%).
  - Truthful `0` when online devices exist but none have a completed scan.
- `unscannedOnlineDevices = onlineCount - scannedOnlineCount`.
- `latestScanAgesDays = max(0, floor((now - lastCompletedScan.completedAt)/day))`; `null` when no completed scan. Uses `completedAt ?? startedAt` for the timestamp.

---

## 14. Backup Operations Derivation

- `running` / `pending` = `BackupRun.count` by status (org-scoped).
- `failedLast24h` / `completedLast24h` = counts by status with `startedAt >= now - 24h`.
- `lastCompletedAt` / `lastCompletedJobName` = most recent completed `BackupRun` (with its `BackupJob.name`).
- `nextScheduledAt` = earliest `BackupJob.nextRunAt` among enabled jobs with a scheduled time.
- All real counts; truthful zeros; `null` timestamps when absent.

---

## 15. Alert Aggregation

- Unacknowledged only: `Alert.groupBy({by:['severity'], where:{orgId, acknowledgedAt:null}})`.
- `unacknowledged` = sum across severity groups; `bySeverity` = per-bucket counts via `normalizeSeverity`.
- True zeros preserved — an org with zero open alerts sees `unacknowledged: 0`, not a fabricated count and not a suppressed tile.

---

## 16. Team Count

- `team.total = User.count({where:{orgId}})`.
- Web UI renders the real value; when the summary is unavailable the card shows "—" (null) instead of a fabricated `1`.

---

## 17. Recency / Recent Devices

- Devices ordered `lastSeenAt desc`; `recentDevices` capped at **8** (DASH-02 OD-3).
- `freshness` bands from reused `classifyFreshness`; online/offline from reused `isDeviceOnline`. Thresholds are **not duplicated** — both come from the single source `device-presence` (`DEVICE_ONLINE_THRESHOLD_MS`).

---

## 18. Org Isolation

- Every aggregation query carries `where.orgId = req.user.orgId` from the JWT.
- Enforced by tests: `dashboard.service.spec.ts` `expectOrgIsolated` asserts every Prisma call's `where.orgId` equals the requested org. Controller spec verifies a `org-42` token yields `org-42` data.
- Cross-org leakage is impossible at the query layer; the endpoint cannot be called unauthenticated.

---

## 19. Authorization & Roles Matrix

| Role | `GET /dashboard/summary` | Unauthenticated |
|------|--------------------------|-----------------|
| Owner | **200** | — |
| Admin | **200** | — |
| Technician | **200** (previously broken on `/admin/dashboard`) | — |
| Viewer | **200** (previously broken on `/admin/dashboard`) | — |
| No token / invalid token | — | **401** (global `CombinedAuthGuard`) |

`@Roles()` is deliberately **omitted** on the summary route; the global JWT guard keeps unauthenticated access protected. No plan gating is applied (`billing/plan.guard.ts` untouched).

---

## 20. Truth Patch: Web Dashboard Page (`apps/web/src/app/dashboard/page.tsx`)

- **Removed:** fabricated `fleetScores` IIFE; `fetchStats` calling `/alerts/latest` (take:10); `/admin/dashboard` misuse; CountCard `ArrowUpRight`/`ArrowDownRight` change badges (D02) and `Badge` import.
- **Wired to `useDashboardSummary`:** Active Alerts, Team Members, Device Health, Risk Assessment, Security Posture, Backup Status, and the "View Alerts" unresolved count.
- **Honest null states:** Team Members → "—" when summary unavailable (no `|| 1`); Device Health → "No health scores yet"; Risk Assessment → "No scans yet"; Security Posture → "No scans yet"; Backup Status → "Status unavailable" / "No backups yet"; real `0` renders as `0`.
- **Backup status precedence:** running > pending > failed(24h) > last-completed ("Last backup X ago" via reused `metricAge`) > "No backups yet".
- Device section (Total Devices / Online Agents / table / presence) unchanged, still driven by `useDeviceList` + reused presence helpers.

---

## 21. Truth Patch: `useDashboardSummary` Hook (`apps/web/src/hooks/useDashboardSummary.ts`)

- Typed `DashboardSummary` contract mirroring the backend response.
- `apiFetch('/dashboard/summary')` (reused auth client — frozen file untouched).
- 15s poll + manual `refetch`; exposes `{summary, loading, error, refetch}`.
- Non-OK responses set an error string; network failures set a network error. No value coercion or fallback fabrication.

---

## 22. D01–D04 Resolution Status

| ID | Defect | Status |
|----|--------|--------|
| D01 | Fabricated Fleet Score | **FIXED** — real `DeviceHealthScore` mean or `null` |
| D02 | Fake deltas / trends | **FIXED** — badges removed |
| D03 | "No Data Yet" fabrication | **FIXED** — real zeros / honest nulls only |
| D04 | Wrong data sources (`/alerts/latest`, `/admin/dashboard`) | **FIXED** — single org-scoped `/dashboard/summary`, all roles |

---

## 23. Backend Files

**New (`apps/api-gateway/src/dashboard/`):**
| File | Purpose |
|------|---------|
| `dashboard.module.ts` | Module wiring (controller + service + Prisma) |
| `dashboard.controller.ts` | `GET summary` → `dashboardService.getSummary(req.user.orgId)` |
| `dashboard.service.ts` | Org-scoped aggregation (single `Promise.all` of 22 queries) |
| `dashboard.types.ts` | `DashboardSummaryResponse`, `SeverityCounts`, `FreshnessCounts`, `RiskLevel`, buckets + empty helpers |
| `severity-normalization.ts` | Pure severity bucket normalization |
| `worst-risk-level.ts` | Pure worst-risk derivation + `riskLevelOrder()` |
| `operational-state.ts` | Pure R0–R4 state machine |

**New tests (same dir):** `dashboard.controller.spec.ts`, `dashboard.service.spec.ts`, `severity-normalization.spec.ts`, `worst-risk-level.spec.ts`, `operational-state.spec.ts`.

**Modified:** `apps/api-gateway/src/app.module.ts` (import + register `DashboardModule`).

**Untouched:** auth module/files, `device-presence.ts`, Prisma schema & migrations, `reporting/*`, `backups/*`, `alerts/*`, `security/*`, `billing/*`.

---

## 24. Web Files

| File | Change |
|------|--------|
| `apps/web/src/hooks/useDashboardSummary.ts` | **New** — typed hook with 15s poll + refetch |
| `apps/web/src/app/dashboard/page.tsx` | **Patched** — real data wiring, no fabrication |
| `apps/web/src/__tests__/use-dashboard-summary.spec.tsx` | **New** — success payload / HTTP error / network failure |
| `apps/web/src/__tests__/dashboard-page-truth.spec.tsx` | **New** — real counts, honest empty states, no-fallback assertions |

**Untouched:** `lib/auth-client.ts`, `lib/socket-client.ts`, `lib/device-presence.ts`, all auth/login/signup components and tests.

---

## 25. Backend Test Coverage

Run with the env30-pinned config (`/tmp/opencode/jest.env.test.js`) — see Section 29.

| Suite | Cases covered | Result |
|-------|---------------|--------|
| `dashboard.controller.spec.ts` | 401 no/invalid token; 200 for Owner/Admin/Technician/Viewer; org scoping `org-42` | **PASS** |
| `dashboard.service.spec.ts` | org isolation (every query `where.orgId` = requested org), empty org → truthful zeros + nulls, freshness bands, >10 alerts, unknown severity → `unknown`, worst risk, coverage 67%, null coverage when no online devices, scan age 3d, backup running + 24h failure, next scheduled backup, report/team counts, health average 85 | **PASS** |
| `severity-normalization.spec.ts` | canonical + unknown/null/whitespace/case handling | **PASS** |
| `worst-risk-level.spec.ts` | ordering, null when empty, unknown skipped | **PASS** |
| `operational-state.spec.ts` | R0–R4 transitions (NO_DATA, CRITICAL, DEGRADED, ATTENTION, OPERATIONAL) | **PASS** |

**5 suites / 65 tests PASS.**

---

## 26. Web Test Coverage

| Suite | Cases covered | Result |
|-------|---------------|--------|
| `use-dashboard-summary.spec.tsx` | success payload parse; HTTP error → null + error; network failure → null + error | **PASS** (3) |
| `dashboard-page-truth.spec.tsx` | authoritative counts with no `+` deltas; honest empty states ("No scans yet" / "No backups yet" / real zeros, no "No Data Yet"); summary-unavailable → "—" and "Status unavailable", no team-of-one fallback | **PASS** (3) |

**Full web suite: 22 suites / 649 tests PASS** (includes pre-existing device-presence, auth-adjacent, and UI suites — no regressions).

---

## 27. Build & Typecheck Results

| Gate | Command | Result |
|------|---------|--------|
| api-gateway typecheck | `npx tsc --noEmit` (in `apps/api-gateway`) | **PASS** (0 errors) |
| web typecheck | `npx tsc --noEmit` (in `apps/web`) | **PASS** (0 errors) |
| api-gateway dashboard tests | env30 config, `src/dashboard` | **5 suites / 65 tests PASS** |
| web Jest | `npx jest --forceExit --runInBand` | **22 suites / 649 tests PASS** |

---

## 28. No-Fabrication Audit

Confirmed absent across the entire change set:

- ❌ No fake deltas / `+N` / `-N%` / trend badges (D02).
- ❌ No "No Data Yet" placeholder-as-fact (D03) — backend never emits it; UI never renders it.
- ❌ No `|| 1` team fallback; no `score ?? 0` / `?? 100` health defaults.
- ❌ No averaged/fake security score; no Fleet Score / Fleet Health average derived from unrelated tiles.
- ❌ No invented `GET /dashboard/activity` or other non-contract endpoints.
- ✅ Every numeric field is a real org-scoped count/mean or an explicit `null`; every `null` has a defined meaning and an honest UI rendering; `coveragePercent` is `null` only when its denominator is invalid, truthful `0` otherwise.

---

## 29. Test & Infrastructure Skew (Environment Limitation)

This section is mandated by the mission contract. The dashboard deliverables are fully verified; the following environment-level skew is **documented, not caused by, and not fixed by** this mission (no dependency version changes were made):

1. **Backend Jest version skew (pre-existing).** Plain `npx jest` in `apps/api-gateway` fails with `TypeError: this._moduleMocker.clearMocksOnScope is not a function` — a known mismatch among `jest-runtime@30.4.2`, `jest-mock@30.4.1`, and `jest-environment-node@29.7.0` resolution. Workaround used (not a repo change): env30-pinned config `/tmp/opencode/jest.env.test.js` with `ENV30_DIR` pointing at `jest-environment-node@30.4.1`. All 65 dashboard tests pass under this config; api-gateway `tsc --noEmit` is clean.
2. **Test database is DOWN / dev database is UP (pre-existing).** `DATABASE_URL_TEST` only exists in `.env.test`, which Jest does not load; `PrismaClient` auto-loads `.env` from cwd → `postgresql://techfusion:techfusion@localhost:5433/techfusion` (the dev DB). Consequently `test/setup.ts` globalSetup prints "Test database migrations applied successfully" while actually running against the dev DB on `localhost:5433`; the intended test DB on `localhost:5434` is down. **DB-dependent integration suites are NOT safely runnable in this environment.** The dashboard module is intentionally pure/unit-tested with mocked Prisma + a supertest controller spec, so it does not depend on a live DB. No migrations were run; Prisma schema is untouched.
3. **Pre-existing unrelated failures.** Full `src` backend suites contain failures unrelated to this mission (e.g., `KbService` missing `QueueService` provider, `RemoteSupportController` `UnauthorizedException` in a unit spec, `InventoryController.clearPendingInventory` mock gap, `BackupsController` "arg is not iterable"). These were not touched and are not part of the DASH-DATA-01 surface.
4. **Heavily pre-modified working tree.** `git status` shows many unrelated unstaged modifications across the repo. Only the files listed in Sections 23–24 were changed by this mission; no destructive git commands were run (read-only `git status/diff/log` only).

---

## 30. Mission Final Response

**Mission DASH-DATA-01 — REAL DATA INTEGRITY — DELIVERED.**

- **New backend module** `apps/api-gateway/src/dashboard/` with `GET /dashboard/summary` (org-scoped, read-only, single `Promise.all` aggregation) registered in `app.module.ts`.
- **Authorization:** no `@Roles()` → Owner / Admin / Technician / Viewer all get `200`; unauthenticated stays protected by the global `CombinedAuthGuard` (401). Verified by supertest.
- **Contract highlights:** `fleet{total,online,offline,freshness,deviceHealth,recentDevices≤8}`, `alerts{unacknowledged,bySeverity}`, `security{openFindings,worstRiskLevel,scanCoverage,unscannedOnlineDevices,latestScanAgesDays}`, `operations{backups,scans,reports}`, `team{total}`.
- **No fabrication:** every field is a real org-scoped count/mean or an explicit `null`; `coveragePercent` is `null` only when the denominator is invalid; true zeros preserved; no fake deltas, no "No Data Yet", no `|| 1` team fallback, no averaged/fake security, no Fleet Score / Fleet Health average.
- **Reused, not duplicated:** `classifyFreshness` / `isDeviceOnline` / `DEVICE_ONLINE_THRESHOLD_MS` from `device-presence`; `apiFetch` / `metricAge` untouched.
- **Web truth patch:** dashboard page now reads `useDashboardSummary` only; fake `fleetScores` IIFE removed; `/alerts/latest` and `/admin/dashboard` calls removed; trend badges removed; honest null states rendered ("—", "No scans yet", "No backups yet", "Status unavailable").
- **P0 status:** D01 **FIXED**, D02 **FIXED**, D03 **FIXED**, D04 **FIXED**.
- **Authentication files modified: NONE.**
- **device-presence modified: NO.**
- **Build/tests:** api-gateway `tsc --noEmit` PASS; web `tsc --noEmit` PASS; dashboard backend 5 suites / 65 tests PASS (env30-pinned config); full web Jest 22 suites / 649 tests PASS. DB integration suites remain blocked by pre-existing infra skew (Section 29).
- **Files:** backend new `src/dashboard/{module,controller,service,types,severity-normalization,worst-risk-level,operational-state}.ts` + 5 specs; modified `src/app.module.ts`; web new `hooks/useDashboardSummary.ts` + 2 specs; modified `src/app/dashboard/page.tsx`.
- **Out of scope, untouched:** auth (frozen), Prisma schema/migrations, security/backups/reports/devices business logic, D05–D12.

**Status: `DELIVERED` — real data everywhere; zero fabricated values; auth baseline untouched.**

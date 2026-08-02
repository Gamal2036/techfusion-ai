# TechFusion-AI — Command Center Architecture & Redesign Blueprint (DASH-02)

> **Document ID:** DASH-02
> **Type:** Product Architecture / Information Architecture / Experience Blueprint
> **Phase:** PRODUCT EXECUTION
> **Mode:** DOCUMENTATION ONLY — no production code was modified
> **Status:** BLUEPRINT COMPLETE — READY FOR EXECUTION PLANNING
> **Date:** 2026-08-02
> **Owner:** Engineering Execution Governance
> **Baseline:** DASH-01 (2026-08-01), AUTH-CERT-01 (frozen), TG-1A / TG-2A / TG-2X / TG-3 / TG-CORE

---

## 1. Executive Vision

The TechFusion-AI Dashboard evolves from **"Fleet Overview"** into the **TECHFUSION COMMAND CENTER** — the operational entry surface of the entire product.

The Command Center is **not a collection of navigation cards**. It is an **operational decision surface** that answers, in under one screen:

1. **What is the current state of my environment?**
2. **Is anything requiring attention?**
3. **Which devices / agents are active?**
4. **Are there security issues?**
5. **Are important jobs running or failing?**
6. **What changed recently?**
7. **What should I do next?**

It is **operational** (status, not decoration), **data-driven** (real contracts only), **spatial** (the fleet is a field, not a flat list), **intelligent** (aggregated truth, not scatter), **calm** (stillness is default), **dense but readable**, **enterprise-grade**, **responsive**, **accessible**, **state-aware**, and **actionable**.

**The governing law — the Command Center must never lie.** If TechFusion does not know something, it says *unknown*. If no data exists, it shows *no data*. If something is stale, it shows *stale*. If something needs attention, it is actionable. Visual sophistication comes after operational truth. This document is the contract that enforces that law.

---

## 2. DASH-01 Findings Adopted

DASH-02 inherits DASH-01's truth baseline without contradiction. Adopted findings:

1. **Dashboard is substantially data-backed.** ~72 HTTP endpoints across 13 feature areas, 4 Socket.IO namespaces (used: `/metrics`, `/network`, `/remote`), 1 SSE AI stream, mapping to 37 Prisma models. Command Center is a **redesign**, not a greenfield build.
2. **All 17 dashboard routes are `'use client'`, client-rendered.** No server-side route protection (`middleware.ts` absent) → D06.
3. **Home-page truth matrix stands** (DASH-01 §6): Total Devices / Online Agents / Active Alerts / Recently Active Devices are `REAL_API` or `DERIVED_REAL_DATA`; the change badges are **fabricated** (D02); Team Members fallback `|| 1` is **misleading** (D03); Risk Assessment / Security Posture are **not wired** (D01); Backup Status quick action is a **stub** (D04); Device Health `round(online/total*100)` is real but computed client-side, not from `/scores`.
4. **`GET /admin/dashboard` is Owner/Admin-only** (`@Roles('Owner','Admin')`), yet the current home page calls it for every role → 403 for Technician/Viewer → contributes directly to D03. **Any fleet-level data Command Center needs must be available to all four authenticated roles** or handled explicitly.
5. **`GET /alerts/latest` returns `take: 10`** — the current "Active Alerts" count is silently capped at 10. Truthful counts require the real unacknowledged count, not a slice.
6. **No fleet aggregation HTTP endpoint exists.** The only org-wide aggregation logic is private `ReportingService.collectFleetSummaryData()` (feeds the `fleet_summary` report type), not exposed via REST.
7. **A real cross-domain activity trail exists:** `AuditLog` (`[orgId, createdAt]` index) served by `GET /audit/logs` (Owner/Admin) and `GET /admin/dashboard` → `recentActivity` (last 10 audit rows). A truthful activity timeline is therefore *possible* — permission-scoped, not fabricated.
8. **Authentication is CERTIFIED & FROZEN** (AUTH-CERT-01). Dashboard consumes `lib/auth-client.ts`, `lib/socket-client.ts`, and `components/auth/*` unchanged. `lib/device-presence.ts` (5-minute online contract) is preserved unmodified.
9. **D01–D12 are carried forward** and each is placed in the execution roadmap (§27). Nothing is dropped.
10. **Preservation contract (DASH-01 §22) governs:** no git reset/clean/stash/rebase of the sacred uncommitted working tree; no modification of auth surfaces, `device-presence`, `apiFetch`/`socket-client` behavior, Prisma/guards/gateways/controllers without explicit change order.

---

## 3. Command Center Product Definition

**Definition.** The Command Center is the single operational surface that aggregates fleet, security, operations, and attention state into a truthful decision environment, and routes the user into specialist surfaces where work is performed.

**What it is:**
- An **operational decision surface** — status, attention, action routing.
- A **state-aware aggregation** — it summarizes real data owned by specialist pages.
- A **trust instrument** — calibrated labels, exact numbers, honest empty/unknown states.

**What it is NOT:**
- Not a gallery of navigation cards (current Quick Actions are a start, not the model).
- Not a full feature page (no job editor, no scan runner, no session console).
- Not a scoreboard of invented percentages or synthetic deltas.
- Not a realtime theater — stillness is default; motion only reports state.

**Interaction contract.** Every data element on the surface either:
1. reports state, and/or
2. routes to the owning specialist surface, and/or
3. performs one real, supported action (e.g., acknowledge alert).

**Trust contract.** Every metric carries provenance: source (endpoint), derivation (pure function or aggregation), freshness timestamp, and an explicit stale/empty/error presentation. No metric is displayed without a defined source contract.

---

## 4. Information Architecture

Six hierarchy levels. Every module earns its position; empty space is not filled.

| Level | Purpose | Content | Evidence / rationale |
|---|---|---|---|
| **L1 — Immediate operational state** | "Is my environment healthy right now?" | Operational state banner + primary fleet counts (total/online/offline) + last-refresh stamp | Highest-frequency decision; the DASH-01 home already leads with counts; state banner is the aggregation of real signals (D01 resolution) |
| **L2 — Attention / risk** | "What needs me now?" | Attention rail: unresolved alerts, open critical/high security findings, failed operations, offline devices | Question #2 of the mission; must be immediately scannable; feeds D05-free alerting via `/metrics` `alerts` WS + REST |
| **L3 — Fleet / infrastructure** | "Which devices/agents are active?" | Fleet panel: total/online/offline, freshness bands, recently active list | Real `/devices` + `device-presence`; DASH-01 home's strongest real module |
| **L4 — Security posture** | "Are there security issues?" | Security panel: open findings by severity, scan coverage, worst risk level | Replaces D01 placeholder; no fake fleet score — truthful counts + coverage |
| **L5 — Operations / jobs** | "Are important jobs running or failing?" | Operations panel: backups running/failed/recent, scan/report status summary | Summarizes real job states (BackupRun, SecurityScan, Report statuses); home never edits jobs |
| **L6 — Activity / intelligence** | "What changed recently?" | Activity timeline from real `AuditLog` (Owner/Admin) | Real cross-domain trail exists (`/audit/logs`, `admin/dashboard.recentActivity`); role-gated, honest about scope |
| **L7 — Commands / navigation** | "What should I do next?" | Quick Commands: real actions + routing | Every command performs work or routes to a workflow |

**Level policy.** L1–L5 are the minimum operational surface. L6 (activity) is included because real audit data exists — but it is **role-gated** and presented as "system activity", never fabricated. L7 is a routing rail, not decoration.

---

## 5. Command Center Zones

The final V1 zone structure (evidence-derived, avoiding information overload). This is the DASH-01 "evaluate this structure" answer — trimmed to what real data supports.

```
COMMAND CENTER (client island, composed data hook)
├── 1. COMMAND HEADER        L1/L7   — title, org, role, clock, last-refresh, primary commands
├── 2. OPERATIONAL STATE     L1      — state banner (derived; see §7) + primary fleet counts
├── 3. ATTENTION RAIL        L2      — unified attention items (§11)
├── 4. FLEET INTELLIGENCE    L3      — online/offline/freshness + recently active devices
├── 5. SECURITY INTELLIGENCE L4      — findings by severity, coverage, worst risk (§9)
├── 6. OPERATIONS            L5      — backups running/failed/last + scans + reports (§10)
├── 7. ACTIVITY              L6      — audit timeline (Owner/Admin) (§12)
└── 8. QUICK COMMANDS        L7      — real commands (§13)
```

**Explicitly excluded from the home surface** (DASH-01 evidence: would overload or lack data):
- **Network topology map** — belongs on Network; heavy (three/canvas), mobile-UNKNOWN. Only a one-line connectivity readout appears (SHOULD HAVE).
- **Remote support live session console** — belongs on Remote Support; session control is specialist work.
- **Billing meters** — billing is Owner/Admin; not an operational surface concern.
- **AI chat** — remains a dedicated surface + drawer.
- **Full device metrics charts** — device-health/monitoring own them.
- **Knowledge base, drivers/software inventory** — specialist; surfaced only via navigation.

**Zero-device state.** When `totalDevices === 0`, the Command Center renders the **existing real onboarding flow** (enrollment token generation + agent command + detection polling) as the dominant state — preserved from DASH-01 home. No operational modules are fabricated against an empty fleet.

---

## 6. Real Data Contract

Every V1 module contract. **BACKEND AGGREGATION REQUIRED** is flagged where a new endpoint is needed. Derivation marked `CLIENT_DERIVED` is allowed only where mathematically valid and defined. No metric may be shown without a defined contract.

> **Naming:** the required aggregation endpoint is referred to throughout as `GET /dashboard/summary`. Final route name is decided in DASH-DATA-01; the contract below defines its shape. It MUST be available to **all four roles** (Owner/Admin/Technician/Viewer) with org scoping via `CombinedAuthGuard`.

### 6.1 Command Header

| Field | Value |
|---|---|
| **Module** | CommandHeader |
| **Purpose** | Identify environment, session context, and refresh truth |
| **Data shown** | Org display name, user role, plan (owner/admin), current time, "Last refreshed HH:MM" |
| **Source endpoint(s)** | `GET /auth/me`-style session (JWT `orgId`/`sub`/`role` via `lib/auth-client`); `GET /billing/plan` (Owner/Admin only) for plan tag — optional |
| **Derived calculation** | None |
| **Refresh mechanism** | STATIC SESSION DATA; clock = client interval (1 min) |
| **Loading state** | Skeleton header block |
| **Empty state** | Header always renders from session; no empty state |
| **Error state** | Session always available post-auth; failure → dashboard `error.tsx` boundary |
| **Stale state** | "Last refreshed" text advances; no metric staleness here |
| **Interaction** | Org switcher (existing Topbar), primary commands (→ §13) |
| **Destination** | — |
| **Permission requirement** | Authenticated (all roles) |

### 6.2 Operational State Banner

| Field | Value |
|---|---|
| **Module** | OperationalState |
| **Purpose** | Answer "is my environment healthy right now?" in one glance |
| **Data shown** | State: `OPERATIONAL` / `ATTENTION` / `DEGRADED` / `CRITICAL` / `NO DATA`; reason line (e.g., "2 critical alerts, 1 failed backup"); primary counts (total / online / offline) |
| **Source endpoint(s)** | `GET /dashboard/summary` → `{ state, reasons[], fleet: { total, online, offline }, alerts: { unacknowledged, bySeverity }, findings: { open, critical, high, medium, low }, backups: { running, failedLast24h, lastCompletedAt }, scans: { running, failedLast24h } }` — **BACKEND AGGREGATION REQUIRED** |
| **Derived calculation** | Deterministic state machine (pure function, §7). Inputs come from the endpoint — the client derives **state only**, never invents numbers |
| **Refresh mechanism** | NEAR-REALTIME: on mount, on tab focus, on WS `alerts` event, manual refresh; 30 s background poll while tab visible; **paused when hidden** (D10) |
| **Loading state** | Skeleton banner + count skeletons |
| **Empty state** | No devices → onboarding flow dominates; banner shows `NO DATA` with "Connect a device to begin" |
| **Error state** | Endpoint failure → banner shows `UNKNOWN` with retry; never a fake "healthy" |
| **Stale state** | Data older than refresh budget → banner shows "Data may be stale — last updated Xm ago", state text preserved (not rewritten as healthy) |
| **Interaction** | Click reason items → route to owning specialist page; manual refresh button |
| **Destination** | `/dashboard/monitoring`, `/dashboard/cybersecurity`, `/dashboard/backup` per reason type |
| **Permission requirement** | All authenticated roles |

### 6.3 Attention Rail

| Field | Value |
|---|---|
| **Module** | AttentionList |
| **Purpose** | Unified, deduplicated, actionable attention feed |
| **Data shown** | Unacknowledged alerts (severity, device, message, age); open critical/high findings; failed backup runs (last 24 h); offline devices (when fleet > 0); failed scans; max 8–12 items |
| **Source endpoint(s)** | `GET /alerts/latest` (live push via `/metrics` `alerts` WS); `GET /dashboard/summary` for findings/backup/scan failures; `GET /devices` for offline derivation |
| **Derived calculation** | Client merges WS events into REST snapshot; dedupe by `(kind, sourceId)`; ordering by severity then age (§11) |
| **Refresh mechanism** | REALTIME for new alerts (WS); NEAR-REALTIME snapshot via summary refetch |
| **Loading state** | Skeleton rows |
| **Empty state** | "All clear — no items require attention" (text + icon; never silent emptiness) |
| **Error state** | Snapshot failed → "Attention status unavailable" + retry; WS failure → fall back to REST poll (existing socket-client semantics) |
| **Stale state** | Items show explicit age ("12m ago"); >30 min unrefreshed → stale note |
| **Interaction** | Acknowledge alert (`POST /alerts/:id/acknowledge`); row click → owning page; dismiss-failed handled via navigation |
| **Destination** | Alerts → `/dashboard/monitoring`; findings → `/dashboard/cybersecurity`; backups → `/dashboard/backup`; offline → `/dashboard/device-health` |
| **Permission requirement** | Authenticated (all roles) for view; acknowledge requires org role verified at impl (alerts routes are org-scoped via `CombinedAuthGuard`) |

### 6.4 Fleet Intelligence Panel

| Field | Value |
|---|---|
| **Module** | FleetPanel |
| **Purpose** | Represent total/online/offline, freshness, recently active, attention devices |
| **Data shown** | Total devices, online (5-min contract), offline, live (≤60 s)/recent (≤5 min)/stale (>5 min) band counts, top-8 recently active (device, status, OS, last seen) |
| **Source endpoint(s)** | `GET /devices` (REST, real); optional live `metrics` WS to nudge `lastSeenAt` |
| **Derived calculation** | `isDeviceOnline(lastSeenAt)` and `classifyFreshness` **from `lib/device-presence.ts` (unchanged)**; recently active = sort by `lastSeenAt` desc, slice 8 |
| **Refresh mechanism** | NEAR-REALTIME: 15–30 s poll while visible; paused on hidden tab (D10); WS `metrics` event can update `lastSeenAt` |
| **Loading state** | Skeleton table |
| **Empty state** | "No devices connected" + Connect Device command (→ onboarding) |
| **Error state** | "Unable to load fleet" + retry; never fabricated online/offline |
| **Stale state** | Devices with `lastSeenAt` beyond 5 min are labeled `offline` and shown as stale (contract); last-refresh stamp per panel |
| **Interaction** | Row → `/dashboard/device-health/[id]`; counts → `/dashboard/device-health`; Connect → onboarding |
| **Destination** | `/dashboard/device-health` and `/dashboard/device-health/[id]` |
| **Permission requirement** | All authenticated roles (`GET /devices` is org-scoped) |

### 6.5 Security Intelligence Panel

| Field | Value |
|---|---|
| **Module** | SecurityPanel |
| **Purpose** | Truthful fleet security status — no fake score |
| **Data shown** | Open findings by severity (critical/high/medium/low counts); scan coverage (`scannedOnlineDevices / onlineDevices`, and "last scan date"); worst risk level present; devices with no completed scan |
| **Source endpoint(s)** | `GET /dashboard/summary` → security block — **BACKEND AGGREGATION REQUIRED** (per-device `GET /security/executive-summary/:deviceId` is NOT used on home — it would be N requests and is per-device) |
| **Derived calculation** | Coverage = `devicesWithCompletedScan / totalOnlineDevices` (computed server-side in summary). **No averaged security score.** Severity counts are sums of real `SecurityFinding` rows (`status: open`) |
| **Refresh mechanism** | ON-DEMAND + NEAR-REALTIME: refetch on focus, on `alerts` WS (security findings produce alerts), manual refresh; no background storm |
| **Loading state** | Skeleton panel |
| **Empty state** | No scans → "No security scans have run" + route to Cybersecurity to trigger one |
| **Error state** | "Security data unavailable" + retry |
| **Stale state** | Show scan age: "Last scan: Xh ago" — beyond threshold (configurable, e.g., 7 days) labeled `STALE — rescan recommended` |
| **Interaction** | Severity counts → `/dashboard/cybersecurity`; trigger scan is **owned by Cybersecurity page** (Command Center routes, does not run scans) |
| **Destination** | `/dashboard/cybersecurity` |
| **Permission requirement** | All authenticated roles |

### 6.6 Operations Panel

| Field | Value |
|---|---|
| **Module** | OperationsPanel |
| **Purpose** | Summarize job/operation state; home never edits jobs |
| **Data shown** | Backups: running count, failed (last 24 h), last completed (time + job name), next scheduled; Scans: running, failed (last 24 h); Reports: generating/failed counts |
| **Source endpoint(s)** | `GET /dashboard/summary` → operations block — **BACKEND AGGREGATION REQUIRED**; on-demand fallback `GET /backups/runs?limit=20`, `GET /reports?limit=50` |
| **Derived calculation** | Counts by `status` from real `BackupRun` / `SecurityScan` / `Report` rows (server-side in summary) |
| **Refresh mechanism** | NEAR-REALTIME while a run is active (5 s, mirroring `useBackupRuns` behavior); otherwise ON-DEMAND + focus refresh; paused on hidden tab |
| **Loading state** | Skeleton rows |
| **Empty state** | "No backup jobs configured" + route to Backup; "No reports yet" |
| **Error state** | "Operations status unavailable" + retry |
| **Stale state** | Job ages shown; "last run X ago" |
| **Interaction** | Row → owning page; "New Backup Job" → `/dashboard/backup`; "Generate Report" → `/dashboard/reports` |
| **Destination** | `/dashboard/backup`, `/dashboard/cybersecurity`, `/dashboard/reports` |
| **Permission requirement** | All authenticated roles |

### 6.7 Activity Timeline

| Field | Value |
|---|---|
| **Module** | ActivityTimeline |
| **Purpose** | Truthful recent-change history across domains |
| **Data shown** | Latest audit actions: action label (mapped from `action`), actor, target hint, timestamp; max 10 |
| **Source endpoint(s)** | `GET /audit/logs?limit=10` (Owner/Admin); fallback `GET /admin/dashboard` → `recentActivity` |
| **Derived calculation** | Action label map (e.g., `security_scan → "Security scan"`); **no client-side construction of events** — every row is a real `AuditLog` row |
| **Refresh mechanism** | ON-DEMAND + focus refresh; optional refresh after major actions |
| **Loading state** | Skeleton rows |
| **Empty state** | "No system activity recorded yet" |
| **Error state** | "Activity unavailable" + retry (403 for non-owner/admin → module hidden, not error) |
| **Stale state** | Timestamps shown; header "as of X" |
| **Interaction** | Row → relevant specialist page when target resolvable (e.g., session → remote-support) |
| **Destination** | Contextual (remote support, enrollment, security) |
| **Permission requirement** | **Owner / Admin** (`GET /audit/logs` is `@Roles('Owner','Admin')`). Technician/Viewer: module omitted entirely — honest role-based scope, never a degraded fake |

### 6.8 Quick Commands

| Field | Value |
|---|---|
| **Module** | CommandActions |
| **Purpose** | Useful work or direct routing; no decorative shortcuts |
| **Data shown** | Command tiles (§13) with live badge where real (e.g., unresolved alerts count) |
| **Source endpoint(s)** | None new; badges from summary/alerts already fetched |
| **Derived calculation** | None |
| **Refresh mechanism** | Inherits from 6.2/6.3 |
| **Loading state** | Skeleton tiles |
| **Empty state** | Commands always render (they are navigation/actions) |
| **Error state** | n/a (navigation) |
| **Stale state** | Badges inherit parent freshness |
| **Interaction** | Per command table §13 |
| **Destination** | Specialist surfaces or onboarding |
| **Permission requirement** | Per command (most: all roles; Team/Enrollment: Owner/Admin) |

---

## 7. Operational State Model

**Verdict: SUPPORTED — but only with the aggregation endpoint, and only as a deterministic state machine over real inputs. No invented score.**

The blueprint does **not** invent a composite "system health score." It defines a **state lattice** with explicit, falsifiable derivation rules. The state answers "should I act now?" — it never produces a number pretending to be a health grade.

**States:** `NO DATA` < `OPERATIONAL` < `ATTENTION` < `DEGRADED` < `CRITICAL`.

**Inputs (all from `GET /dashboard/summary`, computed from real rows):**
- `fleet.total`, `fleet.online` (from `Device.lastSeenAt`, 5-min contract)
- `alerts.unacknowledged`, `alerts.bySeverity` (real unresolved `Alert` rows)
- `findings.open` + severity distribution (real open `SecurityFinding` rows)
- `backups.running`, `backups.failedLast24h` (real `BackupRun.status`)
- `scans.running`, `scans.failedLast24h` (real `SecurityScan.status`)

**Derivation (pure function, evaluated to the worst state present):**

| Rule | Condition | State |
|---|---|---|
| R0 | `fleet.total === 0` | `NO DATA` |
| R1 | any unresolved alert with `severity: 'critical'` OR any open finding `critical` OR all enrolled devices offline (`total>0, online===0`) | `CRITICAL` |
| R2 | any unresolved alert `severity: 'high'` OR any open finding `high` OR any failed backup run in last 24 h OR >50% of devices offline OR any failed scan in last 24 h | `DEGRADED` |
| R3 | any unresolved alert OR any open finding OR any device offline OR any backup run `running`/`pending` | `ATTENTION` |
| R4 | no rule R1–R3 fires | `OPERATIONAL` |

> Severity strings on `Alert` are free-form (default `"warning"`). The derivation treats unknown values as *not critical/high* (conservative, non-alarming) — documented in DASH-DATA-01 so `AlertRule.severity` is normalized where feasible without schema change.

**Honesty rules:**
- `UNKNOWN` is a render state, not a derivation output: if the summary endpoint fails, the banner shows `UNKNOWN` + retry — it must never show `OPERATIONAL` on missing data.
- Stale summary data > refresh budget renders the banner with a stale note and **freezes the last confirmed state** rather than re-deriving on empty inputs.
- The state text is always accompanied by the **reason list** ("2 critical alerts · 1 failed backup"), so the state is auditable, not magical.

**V1 dependency:** if DASH-DATA-01 cannot deliver the endpoint, the banner is replaced by the "unresolved alerts" count only (§11), and the full state model is deferred — it is **not** approximated client-side.

---

## 8. Fleet Intelligence

Consumes the existing real device infrastructure. Respects `lib/device-presence.ts` **without redefinition** (5-minute online contract, freshness bands `live ≤60s / recent ≤5min / stale / unavailable`).

| Aspect | Design |
|---|---|
| Total devices | `GET /devices` length (real) — also mirrored in summary |
| Online devices | `isDeviceOnline(lastSeenAt)` (contract, unchanged) |
| Offline devices | `total − online`; devices with missing/expired `lastSeenAt` are offline by contract |
| Freshness | `classifyFreshness` bands shown as a small distribution (live/recent/stale counts) — truthful, since stale means ">5 min" |
| Health | **Not** derived client-side as `round(online/total*100)` on home. Fleet health belongs to `/dashboard/device-health` (real per-device scores). Command Center shows online/offline/freshness; a fleet "health average" is only permitted from a real aggregation (see §9 coverage note) and is **deferred** |
| Recently active | `GET /devices` sorted by `lastSeenAt` desc, top 8 (device, online status via contract, OS, last-seen) |
| Device attention | Offline devices (when fleet exists) surface in the Attention Rail as informational items — click → device-health — never as fabricated "risk" |
| Live nudges | `/metrics` `alerts`/`metrics` WS events may update `lastSeenAt`/online state without a full REST refetch |

**Contract preserved:** no change to `lib/device-presence.ts`, the backend mirror (`apps/api-gateway/src/devices/device-presence.ts`), or the syncing test.

---

## 9. Security Intelligence

**Architectural resolution of D01.** DASH-01 proved the home "Risk Assessment" and "Security Posture" bars were unfilled placeholders. The correct future architecture is a **fleet security aggregation endpoint** — not N per-device calls, not a client-side average.

**Why this architecture:**
- Per-device `GET /security/executive-summary/:deviceId` is designed for the Cybersecurity detail surface; calling it N times on home is a request storm and couples home to per-device business logic.
- A client-side "average of unrelated values" is explicitly forbidden (zero-fake rule; would average across devices with different scan ages and no scans at all).
- The backend already computes org-wide security counts for `GET /admin/dashboard` (`openSecurityFindings`) and the private `collectFleetSummaryData` — the aggregation belongs server-side where org scoping, RLS, and counts are authoritative.

**`GET /dashboard/summary` security block (BACKEND AGGREGATION REQUIRED):**
```
security: {
  openFindings: { critical, high, medium, low, total },   // real SecurityFinding rows, status 'open'
  worstRiskLevel: 'critical'|'high'|'medium'|'low'|null,   // worst of latest SecurityScore.riskLevel per device with a scan
  scanCoverage: { scannedDevices, onlineDevices, lastScanAt },  // coverage = scanned/online
  unscannedOnlineDevices: number,
  latestScanAgesDays: number | null
}
```
- **No averaged security score.** The surface shows severity counts, worst risk present, and coverage.
- "Risk Assessment" (D01) becomes **worst-risk + open-finding counts**. "Security Posture" (D01) becomes **scan coverage + scan age** — truthful, actionable ("3 online devices have never been scanned → route to Cybersecurity").
- If a metric is unavailable (no scans), the panel shows the legitimate empty state + action — never "No Data Yet" pretending to be a metric.

---

## 10. Operations / Jobs Intelligence

Which operational jobs belong on home (summary only), per evidence:

| Job family | On home? | What is shown | Real source | Why / boundary |
|---|---|---|---|---|
| **Backups** | Yes | Running count, failed last 24 h, last completed (name+time), next scheduled | `BackupRun.status` (`pending/running/completed/failed/cancelled`), `BackupJob.nextRunAt` | Highest-value operational status; editing/trigger/verify/restore stays on Backup page |
| **Security scans** | Yes (minimal) | Running count, failed last 24 h | `SecurityScan.status` (`pending/running/completed/failed`) | Trigger/remediate stays on Cybersecurity |
| **Reports** | Yes (minimal) | Generating/failed count, reports this month | `Report.status` (`generating/completed/failed`), `GET /reports` | Generation/CRUD stays on Reports |
| **Network discovery** | No (deferred) | — | `NetworkScan`, WS `scan-status` | Discovery control + topology belong to Network; a connectivity one-liner is SHOULD HAVE (§29) |
| **Remote sessions** | No (deferred) | — | `RemoteSession.status` | Live session control is specialist; `activeRemoteSessions` is admin-gated — omitted to avoid the D03-class permission trap |

**Rule:** home summarizes job state and routes to the owning page. It **never** creates, triggers, restores, verifies, or edits a job.

---

## 11. Attention Model

A unified Attention model over states currently supported by real contracts. No invented severities.

**Inputs (all real):**

| Kind | Source | Contract field | Supported states |
|---|---|---|---|
| Alert | `GET /alerts/latest` + WS `alerts` | `Alert.severity`, `acknowledgedAt`, `resolvedAt`, `createdAt`, `device` | unacknowledged = attention; acknowledge via `POST /alerts/:id/acknowledge` |
| Security finding | `GET /dashboard/summary` | `SecurityFinding.severity` (`low/medium/high/critical`), `status: 'open'` | critical/high = attention (medium/low shown as counts only) |
| Failed backup | summary | `BackupRun.status: 'failed'`, `startedAt` | failed in last 24 h |
| Offline device | `GET /devices` | `lastSeenAt` via `isDeviceOnline` | offline when `fleet.total > 0` |
| Failed scan | summary | `SecurityScan.status: 'failed'` | failed in last 24 h |

**Severity ordering:** critical > high > medium > low, then age (oldest first). A fixed, documented priority across kinds: `CRITICAL_ALERT = finding critical = offline-all` → `HIGH_ALERT = finding high = failed-backup-24h` → … → informational (offline single device, low alerts).

**Deduplication:** key = `(kind, sourceId)`; the WS merge into the REST snapshot upserts, never duplicates. Rule-level dedupe (same alert rule firing repeatedly) is left to the backend queue (`addSecurityFindingAlert` dedupe) and documented in DASH-DATA-01.

**CTA destination:** every item maps to exactly one owning page (§6.3 / §14).

**Acknowledged behavior:** acknowledging an alert (`POST /alerts/:id/acknowledge`) removes it from the rail immediately (existing hook contract); findings/backup failures resolve via the owning workflow and disappear on next summary refresh.

**Empty state:** "All clear — no items require attention." Text + icon; the empty state is **always** rendered as a positive confirmation, never as blank space.

---

## 12. Activity Model

**Verdict: a truthful timeline is possible using the real `AuditLog` contract — no fabrication needed.**

- `GET /audit/logs` (Owner/Admin) returns org-scoped, `[orgId, createdAt]`-indexed audit rows: `{ id, action, actorId, targetId, details, ipAddress, userAgent, createdAt }`, ordered `createdAt desc`, paginated. Actions span `security_scan`, `billing_change`, `settings_change`, `role_change`, `user_*`, `retention_policy_change`, `sso_config_change`, `session_*`, `enrollment_token_*`, and remote-support actions (`session_start/end`, `consent_*`, `input_sent`, `screen_shared`, `recording_*`).
- This **is** a reliable cross-domain activity contract: a single immutable, org-scoped trail.
- Fallback snapshot: `GET /admin/dashboard` → `recentActivity` (last 10 audit rows).

**Design:**
- **V1 timeline** = last 10 `AuditLog` rows mapped to human labels. Every row is real; nothing is synthesized.
- **Permission:** Owner/Admin only (endpoint contract). For Technician/Viewer the module is **omitted** (clean role-based scope) — never shown as an empty error.
- **Backend aggregation contract (documented, not fabricated):** if a role-inclusive feed is desired later, a new `GET /dashboard/activity` (all four roles) is the required contract — note as BACKEND AGGREGATION REQUIRED for a future mission, **not** for V1.
- **Client-side prohibition:** no fake timestamps, no "activity" synthesized from unrelated lists, no mixing of device list changes into a universal feed.

---

## 13. Quick Commands

Every command performs real work or routes directly to a useful workflow. No decorative shortcuts.

| Command | Action | Destination | Permission | Destructive | Confirmation | Type |
|---|---|---|---|---|---|---|
| **Connect Device** | Opens onboarding (real enrollment-token flow) | `/dashboard` (onboarding state) | All roles | No | No | Navigation + action |
| **View Alerts** | Route to monitoring (badge = unresolved count) | `/dashboard/monitoring` | All roles | No | No | Navigation |
| **Open Cybersecurity** | Route to scan/findings workflow | `/dashboard/cybersecurity` | All roles | No | No | Navigation |
| **New Backup Job** | Route to job creation | `/dashboard/backup` | All roles | No | No | Navigation |
| **Run Network Discovery** | Route to discovery control (owned by Network) | `/dashboard/network` | All roles | No | No | Navigation |
| **Generate Report** | Route to report creation | `/dashboard/reports` | All roles | No | No | Navigation |
| **Ask AI Assistant** | Open AI surface | `/dashboard/ai-chat` | All roles | No | No | Navigation |
| **Invite Teammate** | Route to team management | `/dashboard/team` | Owner/Admin | No | No | Navigation |
| **Acknowledge alert** | `POST /alerts/:id/acknowledge` | stays on home | All roles (org-scoped) | No | No | API action |

**Policy:** no destructive command (delete, restore overwrite, revoke, end-session) on the home surface. Home routes to the specialist page where destructive actions carry their own confirmation. Commands are role-filtered (Team/Enrollment-style Owner/Admin entries hidden for lower roles).

---

## 14. Feature Ownership Boundaries

Command Center **aggregates**; specialist pages **own**. Explicit ownership map:

| Domain | Command Center role | Owner (business logic) |
|---|---|---|
| Fleet status | Summarize counts/online/freshness; route | Device Health (`/dashboard/device-health`) |
| Real-time telemetry | Show only "online" truth; no charts | Monitoring (`/dashboard/monitoring`) |
| Security | Severity counts + coverage + worst risk; route | Cybersecurity (`/dashboard/cybersecurity`) — scans, findings, remediate, export |
| Network | (SHOULD HAVE) one-line connectivity readout | Network (`/dashboard/network`) — topology, discovery, diagnostics |
| Remote support | None on home (deferred) | Remote Support (`/dashboard/remote-support`) — sessions, recordings, audit |
| Drivers/software | Navigation only | Drivers (`/dashboard/drivers`) |
| Backup | Running/failed/last-summary; route | Backup (`/dashboard/backup`) — jobs, runs, verify, restore, artifacts |
| AI | Navigation only (drawer/surface remain) | AI Chat (`/dashboard/ai-chat`) |
| Knowledge base | Navigation only | Knowledge Base (`/dashboard/knowledge-base`) |
| Reports | Generating/failed summary; route | Reports (`/dashboard/reports`) |
| Billing | Not on home | Billing (`/dashboard/billing`) |
| Team | Navigation only (Owner/Admin) | Team (`/dashboard/team`) |
| Settings/Enrollment | Navigation only | Settings (`/dashboard/settings`) |
| System audit | Timeline (Owner/Admin) | Audit (gateway `/audit`; Settings/enrollment audit mirrors) |

**Rule:** the home page must not absorb specialist business logic. If a future requirement wants a feature on home (e.g., quick scan trigger), it must be added as a routed interaction to the owning page, not re-implemented.

---

## 15. Visual Architecture

The Command Center inherits the TechFusion DNA from Authentication — **Luminous Instrument** (matte environment where only truth shines), **Calibration Edge** (machined exactness), **Command Horizon**, **Quiet Signal Flow** (the watcher's scan / quiet confirmation), and the **Command Core** heritage — but becomes a **data-first operational environment**. Per the visual bible: *the information layer takes command; the environment recedes to its hum* (bible :471 transition arc).

**Five planes** (reuse the bible's layer discipline; decoration never sits above data):

| Plane | Role | Content |
|---|---|---|
| **Background plane** (atmosphere) | Ambient depth; felt, rarely looked at | Deep matte surface, restrained radial light washes (existing `--surface*`/glass tokens), no texture noise |
| **Infrastructure plane** | The environment's "machinery" | Receding grid + calibration tick line at the horizon (Command Horizon heritage), subtle reactive routes — CSS/SVG, ~2–3 layers, `aria-hidden`, never animated in reduced-motion |
| **Data plane** | Where truth lives; the most legible layer | Panels, tables, exact numbers, status text. Highest contrast, crisp calibration edges (`glass-card` + calibration border treatment) |
| **Interaction plane** | Controls one step nearer than data | Buttons, commands, ack actions; micro-3D hover only on primary actions (console behavior) |
| **Attention plane** | The only bright layer | Alert rail, critical state, reason pills — a bounded, localized illumination when attention exists; quiet when clear |

**Laws carried from the bible:**
- *Data is the deepest citizen* — data plane stays above the infrastructure plane in legibility.
- *One focal depth per moment* — attention or data, never both competing.
- *Depth from layering, not glow* — panel separation via edge/translucency, not drop-shadow glow.
- *Color reserved for meaning* — severity colors mean severity; nothing decorative uses `--success`/`--warning`/`--danger`.
- *Redundancy always* — light never carries meaning alone; text/icon confirm (bible :316).
- *Calibration = believed* — exact real numbers, precise labels, real refresh stamps (bible :188).
- *Stillness is the default* — no idle animation loops on the surface.

---

## 16. Spatial Architecture

Restrained, evidence-safe spatial system — no WebGL by default, no Three.js dependency for the surface.

| Technique | Use on Command Center | Constraint |
|---|---|---|
| CSS depth / perspective | One subtle 3D scene behind the header/horizon (perspective ~1500px, rotation ≤ ±0.7°, parallax ≤ ±6px), mirroring auth R2 | Decorative layer `aria-hidden`, `pointer-events-none`, killed under reduced-motion |
| Layered SVG | Infrastructure plane: dotted grid, calibration baseline, 2–3 receding routes, node anchors ("network of instruments" motif) | Low-count paths only; no per-frame JS |
| Environmental topology | A sparse "fleet constellation" motif where nodes = real devices (only devices that exist) | Never fabricate nodes; empty fleet → no constellation |
| Depth-separated modules | Panels separated by edge + surface tint (`surface-subtle` → `surface-muted`), not by heavy shadow | Reuse existing glass/`elevated`/`card` tokens |
| Reactive infrastructure routes | A route line brightens only when a real event occurs (new alert on a device, job start) — the "quiet signal flow" generalization | Bounded animation, removed under reduced-motion |
| Localized illumination | Attention rail/critical state gets a localized light pool (existing `hsl(var(--primary)/0.05–0.13)` pattern) | Attention is the only brightness |
| State-responsive geometry | The state banner edge / rail width reacts to derived state | CSS `:has()`-style, DOM-state-driven, no JS animation frames |

**Rule:** every spatial element either *reports state* or *is decorative-and-isolated*. Decorative planes are hidden entirely under `prefers-reduced-motion` and never intercept pointer/keyboard. The surface must remain legible at 100% with effects disabled (graceful degradation — nothing critical lives in the visual plane).

---

## 17. Command Center Signature Candidates

Three candidate signatures. Each is evaluated against: brand recognition, operational usefulness, performance, accessibility, scalability. All inherit Luminous Instrument + Calibration Edge + Quiet Signal Flow; they differ in the *organizing motif*.

### Candidate A — "THE COMMAND HORIZON CONSOLE"
Carry the auth Command Horizon ground line across the dashboard as a persistent calibration baseline; modules sit on it like instruments on a console rail.

- Brand recognition: High continuity with Authentication (same ground line).
- Operational usefulness: Medium — a horizon communicates "instrument surface" but carries no operational meaning by itself.
- Performance: Excellent (one static line + ticks).
- Accessibility: Neutral (decorative, isolatable).
- Scalability: Good — works at all widths.
- **Weakness:** it risks reading as "Authentication with more cards" — not a distinct identity; the horizon is a *setting*, not a *story*.

### Candidate B — "THE SIGNAL FIELD" (distributed fleet constellation)
A quiet infrastructure field behind the data plane in which each node is a **real device** (or job/alert). The fleet itself is the composition: nodes brighten only when they report truth (new metric, new alert, state change); attention is the only strong light. The one-luminous-core of Authentication (Command Core) becomes a **distributed network of instruments** — the vision doc's "network of instruments" made literal.

- Brand recognition: High and *distinct* — related to auth (same material, same light discipline) but unmistakably a fleet/operations identity.
- Operational usefulness: High — nodes are real fleet members; a bright node is a true signal; state changes are visible in peripheral vision.
- Performance: High — CSS/SVG, ~a few dozen nodes max (real device count), zero WebGL, no Three.js.
- Accessibility: Strong — decorative layer isolated; all meaning duplicated in the data plane (redundancy law); reduced-motion kills all movement and the layer reads as a static composition.
- Scalability: Good — node count = real fleet size (capped render at e.g. 48, remaining aggregated); never fabricates devices.
- **Weakness:** must be disciplined not to drift into "dashboard-of-dashboards" visuals or fake topology.

### Candidate C — "THE ATTENTION SPINE"
A persistent left/north attention rail as the architectural spine; the whole surface is organized around the flow of attention ("what needs me" always present).

- Brand recognition: Medium — memorable interaction, weaker visual identity.
- Operational usefulness: High — attention-first matches the mission's question priority.
- Performance: Excellent — minimal visuals.
- Accessibility: Good.
- Scalability: Medium — a spine is a *layout* more than a *signature*; at mobile widths it collapses into the header, losing identity.
- **Weakness:** it solves layout, not brand; it can be combined with A or B rather than chosen alone.

---

## 18. Selected Signature

### Recommended: **THE SIGNAL FIELD** (Candidate B)

**Rationale (evidence-based):**
1. **Operational meaning first.** Authentication's Command Core is one luminous operational core; a fleet platform's truth is *distributed*. The Signal Field makes the fleet itself the composition — every node is a real device/event, so the visual *is* the data story ("the network of instruments", vision :146). This matches the DASH-01 fact base (real `/devices`, real alerts, real WS `metrics`/`alerts` events) and satisfies the zero-fake rule structurally: **a node only exists if a device exists, and only shines when real state changed.**
2. **Brand continuity without copying.** Same material grammar (matte, Luminous Instrument), same calibration edges, same quiet-signal discipline — but the one-core geometry becomes a field. It extends the spatial report's own next-phase note (spatial report :241: "extend Command Core + Calibration Edge + Command Horizon to the dashboard shell for cross-surface continuity") — continuity by *generalization*, not duplication.
3. **Performance.** CSS + one layered SVG; no WebGL, no Three.js requirement (Three.js stays feature-specific to NetworkMap). Node count is bounded by real fleet size and capped for render.
4. **Accessibility.** The entire field is decorative-isolated (`aria-hidden`, `pointer-events-none`, `focusable="false"`); every meaning is duplicated as text in the data plane (bible redundancy law); reduced-motion renders it as a static composition and removes all movement.
5. **Scalability.** Works from 320px (collapsed to a horizon line) to 1920+ (full constellation); state-driven via DOM state, not JS rAF.

**Identity statement (to be carried into DASH-VIS-01):** *The Command Center is a quiet field of instruments. Nothing glows unless something is true — and when something is true, it is actionable.*

---

## 19. Motion Architecture

Motion communicates state only. No constant animation "to look alive." Grammar: *motion answers or it is removed* (bible :344-348).

| State | Behavior | Duration/easing | Reduced-motion equivalent |
|---|---|---|---|
| Normal / idle | **Stillness is default**; zero ambient loop on the surface (Infrastructure plane static) | — | — |
| New alert (WS) | Attention rail item enters with a single fade/slide; a bounded pulse on the rail edge (max 2–3 iterations); localized light pool on the Signal Field node | 200–300 ms; `cubic-bezier(0.23,1,0.32,1)`; pulse ≤ 3 iterations | Item fades in once; no pulse, no light |
| Critical attention | Rail glows (localized illumination) + text redundancy; state banner edge brightens; **no red alarm**, no screen flash | 400 ms ease; held quietly | Static highlight only |
| Device state change | The affected row/node updates with 200–300 ms opacity/translate; other rows untouched | 200 ms | Instant swap |
| Job running | Indeterminate progress on the specific item only (e.g., run row); no global spinner | — | Static "Running…" label |
| Job completed | One settled gesture (check + brief highlight), then stillness — the "quiet confirmation" (bible :415) | 300 ms, single pass | Static check icon |
| Job failed | Row marked (attention color + text) + routed to attention rail; no celebratory motion | 200 ms | Static label |
| Data refresh | Only *changed* cells fade 300 ms; "Last refreshed HH:MM" updates; no table re-animation | 300 ms | Instant |
| Navigation | Reuse existing layout transition (0.2 s fade/slide, `AnimatePresence`) | 200 ms | Reduced-motion prefers fade-only or none (existing pattern) |
| Onboarding detection | Existing flow preserved; success is a quiet confirmation | — | Static |

**Enforcement:**
- `prefers-reduced-motion: reduce` → all ambient/decorative animation disabled (CSS `animation: none`), parallax zeroed, transitions become opacity-only or instant; `useReducedMotion()` gates any JS-driven motion (existing hook).
- No trails, no custom cursor, no spotlight, no magnetic elements (spatial report restraint rules).
- Motion count on the surface must never exceed the bible's restraint budget (idle = 0–1 slow ambient; attention = bounded).

---

## 20. Component Architecture

Proposed client-side tree for `apps/web/src/app/dashboard/page.tsx` (future), evidence-derived. Every component defines ownership, data contract, client/server role, states, reusability.

```
CommandCenterPage                     (client island; composed data hook)
├── CommandHeader                     (§6.1)
├── OperationalStateBanner            (§6.2, §7)
├── AttentionRail                     (§6.3, §11)
├── FleetIntelligence                 (§6.4, §8)
│     └── RecentlyActiveTable
├── SecurityIntelligence              (§6.5, §9)
│     └── SeverityBreakdown
├── OperationsPanel                   (§6.6, §10)
├── ActivityTimeline                  (§6.7, §12; Owner/Admin only)
├── CommandActions                    (§6.8, §13)
└── OnboardingFlow                    (preserved real flow; replaces content when fleet.total === 0)
```

| Component | Ownership | Data contract | Client/server | States | Reusability |
|---|---|---|---|---|---|
| **CommandCenterPage** | Home surface | Composes `useCommandCenterData()`; owns routing of module props | Client island | loading → ready → error/unknown | n/a (entry) |
| **CommandHeader** | Shell | Session (JWT), org, clock, refresh stamp | Client (session) | always-ready | Reusable across dashboard (shared) |
| **OperationalStateBanner** | Home | Summary block + pure `deriveState()` | Client (derives from server-computed summary) | loading / NO DATA / OPERATIONAL / ATTENTION / DEGRADED / CRITICAL / UNKNOWN | Reusable (used on monitoring if needed later) |
| **AttentionRail** | Home | Alerts WS+REST, summary attention kinds | Client | loading / clear / items / unavailable | Reusable (monitoring, topbar badge) |
| **FleetIntelligence** | Home | `GET /devices` + `device-presence` | Client | loading / empty / list | Reusable (ai-chat already uses device list) |
| **SecurityIntelligence** | Home | Summary security block | Client | loading / empty / data / stale | Reusable (cybersecurity summary) |
| **OperationsPanel** | Home | Summary operations block | Client | loading / empty / data | Reusable (backup/reports headers) |
| **ActivityTimeline** | Home | `GET /audit/logs` (Owner/Admin) | Client | loading / empty / rows / hidden(403) | Reusable (admin surfaces) |
| **CommandActions** | Home | Command registry (role-filtered) | Client | always-ready | Reusable (command palette supplement) |
| **OnboardingFlow** | Home | `POST /enrollment/tokens`, `useDeviceList` | Client | steps / detecting / detected | Preserved from DASH-01; also used when `total === 0` |

**Client/server responsibility:** the page remains a client island under the existing Next 14 `'use client'` model for V1 (§26). `deriveState()` is a **pure, unit-tested module** (`lib/command-state.ts`) — no React inside, so it can be reused server-side later without change.

---

## 21. Data Orchestration

**Recommendation: HYBRID — one backend aggregation endpoint + one composed Command Center hook + existing WS, replacing the current independent-hook pileup.**

Current state (DASH-01 §9/§16): no global store; home calls `useDeviceList` (15 s poll) + ad-hoc `Promise.all([/alerts/latest, /admin/dashboard])` + counts. This duplicates requests across pages and creates the polling/rerender issues D10/D11 document.

**Target architecture:**

1. **`useCommandCenterData()`** — a single composed hook owned by the Command Center (new, dashboard-owned):
   - **Snapshot:** `GET /dashboard/summary` (one request, server-computed fleet/security/operations truth) — ON-DEMAND + focus-refresh + 30 s visible poll (paused when hidden).
   - **Live:** one `subscribe('/metrics', 'alerts', …)` for new alerts (real-time attention) and optional `metrics` events to nudge `lastSeenAt`.
   - **Fallback/auxiliary:** `GET /devices` only for the Recently Active list *if* the summary does not include it (decision: include `recentDevices` in summary to avoid a second poller); `GET /audit/logs` for activity (Owner/Admin).
   - **Backup live-status:** a dedicated, minimal `useActiveBackupRuns()` that 5 s-polls **only while** a run is `running`/`pending` (mirrors `useBackupRuns`, reused if acceptable) — no perpetual backup polling on home.
2. **Existing hooks reused where aggregation doesn't cover:** `useAlerts`-style ack action, `useDeviceList` refetch on demand. The composed hook **reuses** hooks internally rather than re-implementing fetching.
3. **No polling storms:** exactly one background poller on the surface (summary) + one conditional backup poller + one WS subscription. Device polling (15 s `useDeviceList`) is **not** mounted on home if summary provides fleet counts + recent devices — eliminating a duplicate request source.
4. **Rerender hygiene:** stable `useCallback` refs, module memoization, derived state via `useMemo` keyed on immutable snapshot objects; WS merges immutable arrays (existing pattern in hooks).

**Rule:** Command Center **owns no feature business logic**. All counting/aggregation lives server-side in `GET /dashboard/summary`; the client only derives presentation (state machine, labels, freshness).

---

## 22. Real-Time Strategy

Not everything is realtime. Classification per data family (evidence: 4 WS namespaces, polling intervals, SSE AI stream):

| Data family | Class | Mechanism | Justification |
|---|---|---|---|
| New alerts / attention | **REALTIME** | WS `/metrics` `alerts` (+ REST fallback) | Alerts are the #2 mission question; WS already exists and is cheap; REST fallback per socket-client contract |
| Device online/offline pulse | **NEAR-REALTIME** | 15–30 s poll visible-only; WS `metrics` nudges `lastSeenAt` | 5-min presence contract doesn't need sub-second; WS is opportunistic, not required |
| Fleet/security/operations summary | **NEAR-REALTIME** | 30 s visible poll + focus refresh + manual refresh | Aggregation is cheap to recompute but should not run in hidden tabs (D10) |
| Active backup run status | **NEAR-REALTIME** | 5 s poll only while a run is active | Mirrors existing `useBackupRuns` contract; dormant otherwise |
| Audit activity | **ON-DEMAND** | Focus refresh + after-action refresh | Immutable log; freshness not operationally critical |
| Network connectivity readout (SHOULD HAVE) | **ON-DEMAND** | Focus + manual; `GET /network/devices?reachable=true` | Topology WS stays on Network page |
| Billing plan tag | **STATIC SESSION DATA** | JWT + one `GET /billing/plan` (Owner/Admin) on mount | Plan doesn't change mid-session |
| Org/role/name | **STATIC SESSION DATA** | JWT via `lib/auth-client` | Session contract |

**Explicit non-goals:** no WebSocket for fleet list, no SSE on home, no always-on backup polling, no "real-time everything." The `/ai/troubleshoot` SSE stream remains exclusive to AI surfaces.

**Hidden-tab policy (D10):** all pollers pause on `document.hidden` (visibilitychange) and resume+refresh on visibility return; failed requests use exponential backoff up to a cap, resetting on success. This is implemented in the composed hook and the shared polling hooks (coordinated, tested).

---

## 23. Responsive Architecture

Desktop is operationally dense; mobile prioritizes Attention → System status → Essential fleet state → Primary commands. The desktop dashboard is **not** squeezed onto mobile.

| Breakpoint | Layout | Notes |
|---|---|---|
| **1920+** | Full grid: header (1 row) / state banner (1) / attention rail (left column, fixed-ish 320px) / main data column (fleet+security+operations stacked) / commands rail (right) | Dense but readable; calibration edges keep scanning fast; Signal Field full constellation |
| **1440** | Same grid, slightly narrower gutters | Default design target |
| **1280** | Two-column main: attention rail collapses to a top strip under the banner; fleet | security | operations stack in 2 columns | Main zone becomes 2-column |
| **1024** | Single-column stack of modules; attention strip stays above the fold | Table → row/card list for devices |
| **768** | Full single-column; Quick Commands collapse to a horizontal scroll row; activity timeline (if shown) moves to "View all activity" | Header condensed (org name only) |
| **390** | Attention + Operational state at top; essential fleet counts; primary commands (Connect Device, View Alerts); **security/operations/activity deferred** behind "View all" links to their specialist pages | Mobile must never fake the desktop density |
| **320** | Same as 390 but tighter; state banner reasons truncated with "View" routing | Touch targets ≥ 44px |

**Collapse/defer policy:**
- Attention rail → top strip (<1280px) → pinned under header (<768px).
- Security/Operations/Activity panels → stacked below the fold with "View all" routing on mobile; never hidden entirely, never replaced by fabricated summaries.
- Signal Field → reduced to a horizon line (<1024px); zero node rendering (performance + clarity).
- Recently-active table → card list with sticky-adjacent row layout (<1024px); `overflow-x-auto` removed in favor of cards.

---

## 24. Accessibility Contract

Non-negotiable (D07 addressed explicitly):

| Requirement | Contract |
|---|---|
| Keyboard navigation | Every interactive element reachable by Tab; no keyboard traps; Escape closes overlays; ⌘K palette unchanged |
| Visible focus | Global `*:focus-visible { ring-2 ring-ring }` (exists); new components must not remove it; calibration-edge focus styling on panels/rails |
| ARIA for state controls | `aria-pressed` on onboarding OS picker (fixes D07), `aria-expanded` on collapsibles, `aria-current` on nav, `role="status"`/`aria-live="polite"` for state banner, `aria-live="assertive"` reserved for CRITICAL changes only |
| No color-only status | Every status has text/icon + color (bible redundancy law); severity never color-only; attention items carry severity text |
| Reduced motion | `prefers-reduced-motion` honored completely: ambient/decorative animation removed, parallax zeroed, transitions opacity-only, `useReducedMotion()` gates JS motion |
| Semantic sections | `header`, `main`, `section`, `nav`, `aside` landmarks; single `h1`; logical DOM order |
| Accessible charts | Any future chart (none in V1 core) must provide data table/alt representation; SVG decorative layers `aria-hidden`, `focusable="false"` |
| Accessible realtime updates | WS-driven additions announced politely; existing rows updated without re-announcement; dedupe to avoid announcement storms |
| Drawer/dialog focus management | Command palette + AI drawer already close on Escape; add focus trap + initial focus + restore focus on close (fixes DASH-01 §13 gap) |
| Touch targets | ≥ 44×44 px on interactive controls at all breakpoints |
| Screen-reader meaningful state | State banner reads "Environment: Attention Required — 2 critical alerts, 1 failed backup"; count values are numbers with labeled text, not bare glyphs |

**D07 execution:** fixed in DASH-IMPL-01 (focus-visible, `aria-pressed` OS picker, drawer focus management, reduced-motion guard on `AnimatedNumber`), and new components ship D07-compliant from the start.

---

## 25. Performance Budget

The Command Center must feel fast before it feels impressive (rule).

| Constraint | Budget | Notes |
|---|---|---|
| Client bundle (dashboard entry) | ≤ ~300 KB gzip initial JS | Lean toward shared chunks; do not add new heavy deps |
| `three` (Three.js) | **Not part of Command Center V1** | Feature-specific to NetworkMap only; if any 3D ever enters, lazy-load via `next/dynamic` |
| `recharts` | **Not part of Command Center V1 core** | Charts live on specialist pages (device-health, monitoring); if a home sparkline is approved later, lazy-load the component |
| `framer-motion` | Scoped to state transitions; no entrance-choreography on data modules | Entrance used only for module mount (single pass); reduce per-render animation work |
| Polling | Exactly 1 surface poller (summary, visible-only) + 1 conditional backup poller + 1 WS sub | No 15 s device poller on home if summary carries fleet data (eliminates duplicate) |
| WebSocket | 1 subscription on `/metrics` (`alerts`); no additional namespaces on home | Topology/remote WS stay on their pages |
| Rerenders | Summary snapshot immutability + `useMemo`/`useCallback`; WS merges immutable arrays; derived state memoized | Avoid re-deriving the state machine on every render |
| Animation | Ambient: 0; attention pulse ≤ 3 iterations; single-pass transitions | rAF only for count-up on 4 headline numbers max (existing `AnimatedNumber`, reduced-motion-gated) |
| Heavy visualization | Lazy-load anything above SVG/Canvas-light | `next/dynamic` + `ssr:false` for the Signal Field SVG is acceptable (static), but no 3D |
| Request count | First meaningful paint: 2–3 requests (summary, session, audit-if-owner) | Single aggregation replaces 4+ independent home requests |

**Lazy-loading rule:** nothing heavy is required for the V1 surface; therefore nothing heavy ships in the V1 entry. Any approved visualization is code-split.

---

## 26. Server / Client Strategy

Current: all dashboard pages `'use client'`; client-side data fetching; no RSC streaming for dashboard data (DASH-01 §16).

**V1 recommendation:** keep the Command Center as a **client island** under the existing Next 14 model. Rationale:
- The surface is interaction-dense (WS, ack actions, polling, onboarding) — client execution is the honest model for it.
- Converting the whole dashboard to Server Components would be a large architectural change with no V1 data benefit (all data is client-auth-scoped via `apiFetch`).
- **No change to certified Authentication:** auth remains client-guarded by the existing layout effects; `lib/auth-client.ts` behavior is untouched.

**Evolution (documented, not executed):** future missions may move **static shell chrome** (CommandHeader frame, page titles, non-conditional sections) into Server Components while keeping interactive modules as client islands — but this is only worth doing when it removes real client work; it is not a V1 goal.

**D06 routing (important):** server-side route protection for `/dashboard` is a **security-architecture matter**, not a Command Center visual matter. A `middleware.ts` route guard is the correct fix, but:
- It must **not** modify certified auth contracts (guard-only, no auth changes).
- It requires its own approved scope and QA.
→ D06 is classified **SEPARATE MISSION** (DASH-SEC-01, route protection) in §27 and §31, sequenced so it can land before Production regardless of Command Center impl.

---

## 27. DASH-01 Defect Execution Map

Every D01–D12 is placed. No defect disappears.

| ID | Defect | Classification | Why |
|---|---|---|---|
| **D01** | Risk Assessment / Security Posture not wired | **FIX BEFORE IMPLEMENTATION** (DASH-DATA-01) | Command Center Security Intelligence and Operational State depend on real fleet security data; the aggregation endpoint must land first. P0. |
| **D02** | Fabricated count-card deltas | **FIX BEFORE IMPLEMENTATION** (DASH-DATA-01) | Zero-fake law: fabricated deltas must be removed (or replaced by real comparisons) before the new surface ships. P0. |
| **D03** | Team Members fallback = 1 | **FIX BEFORE IMPLEMENTATION** (DASH-DATA-01) | Remove `\|\| 1`; graceful "—"; also fixes the role-gating trap (home must not depend on Owner/Admin-only `/admin/dashboard` for non-admin sessions). P0. |
| **D04** | Backup Status static placeholder | **FIX BEFORE IMPLEMENTATION** (DASH-DATA-01) | Wire to real backup run/job status via the summary endpoint (or omit). P0. |
| **D05** | Security export returns HTML, not PDF | **SEPARATE FEATURE MISSION** (Security export repair) | A security-domain defect, not a Command Center defect; Command Center security module routes to Cybersecurity and is not blocked by it. P1. |
| **D06** | No server-side route protection | **SEPARATE MISSION** (DASH-SEC-01 route protection) | Security-architecture mission; must not modify certified auth contracts; guard-only middleware + its own QA. P1. |
| **D07** | Accessibility gaps | **FIX DURING COMMAND CENTER IMPLEMENTATION** (DASH-IMPL-01) | Accessibility contract §24 is implemented with the new surface; legacy gaps (OS picker `aria-pressed`, focus-visible, drawer focus trap, reduced-motion) are fixed in the foundation mission. P1. |
| **D08** | Alerts gateway is a bridge onto `/metrics` | **ACCEPTED DEBT** (+ verify in DASH-QA-01) | The bridge currently emits `alerts` correctly on `/metrics` (verified in code); Command Center consumes it as-is. Promoting to a first-class gateway is a low-priority architecture debt; runtime verification during DASH-QA-01 keeps it observable. P2. |
| **D09** | Missing `loading.tsx` on monitoring/design-system | **FIX DURING COMMAND CENTER IMPLEMENTATION** (DASH-IMPL-01) | Trivial route-level skeleton additions; grouped with foundation. P2. |
| **D10** | Hidden-tab polling / no backoff | **FIX DURING COMMAND CENTER IMPLEMENTATION** (DASH-IMPL-01) | Required by the performance budget (§25) and real-time strategy (§22); implemented in the composed hook + shared polling hooks as a coordinated change. P2. |
| **D11** | Onboarding polling effect churn | **FIX DURING COMMAND CENTER IMPLEMENTATION** (DASH-IMPL-01) | OnboardingFlow is preserved into the new home; its detection effect is stabilized in the foundation mission. P2. |
| **D12** | Billing checkout/portal UNKNOWN | **NEEDS RUNTIME VERIFICATION** (DASH-QA-01) | Runtime behavior unverified; not a Command Center dependency (billing is not on home). Verified during QA, not assumed. P2. |

---

## 28. Implementation Boundaries

**Allowed to modify (Dashboard scope):**
- `apps/web/src/app/dashboard/page.tsx` (Command Center rebuild) and new Command Center components (components under `apps/web/src/components/` or page-local).
- New composed hook `useCommandCenterData` + pure `lib/command-state.ts` (+ unit tests).
- Dashboard-owned shared components that are part of the shell (consistent with existing dashboard ownership): `Sidebar`/`Topbar` labels only if required by IA; **not** `lib/auth-client`, `lib/socket-client`.
- `apps/web/src/app/dashboard/loading.tsx` / `error.tsx` / per-route `loading.tsx` (D09).
- `apps/web/src/__tests__/*` — Command Center tests; existing tests must keep passing.

**Forbidden surfaces (cannot be modified by DASH implementation):**
- **Authentication (frozen, AUTH-CERT-01):** `lib/auth-client.ts`, `lib/socket-client.ts`, `components/auth/*`, login/signup/MFA pages + components, `__tests__/{login,signup,landing}-page.spec.tsx`, auth hooks/behavior, auth visual system.
- `lib/device-presence.ts` and its backend mirror + syncing test (contract).
- **Backend (`apps/api-gateway`, `apps/agent`, `apps/worker`):** no modification without a separate approved scope. The new `GET /dashboard/summary` endpoint is executed in **DASH-DATA-01 under its own approved backend scope** — the visual mission does not silently change backend architecture.
- Prisma schema, guards, gateways, controllers (outside approved scope), migrations.
- The sacred uncommitted working tree (no reset/clean/stash/rebase/merge/commit/unlink — DASH-01 §22).

**Shared-component change rules:** changes to hooks/components consumed by multiple pages (e.g., polling hygiene in `useDevices`) must be coordinated within DASH-IMPL-01 and covered by the existing test suites so no specialist page regresses.

**Testing requirements:** `deriveState()` unit tests; presence behavior tests (unchanged contract); Command Center component tests; accessibility (axe) checks on the rebuilt surface; manual QA mission (DASH-QA-01) before certification.

---

## 29. Command Center V1 Scope

**MUST HAVE** (V1 truth floor):
1. CommandHeader (session truth, refresh stamp)
2. OperationalStateBanner (state machine §7 + primary counts) — requires the summary endpoint (DASH-DATA-01 prerequisite)
3. AttentionRail (alerts + critical/high findings + failed backups/offline devices; ack action)
4. FleetIntelligence (total/online/offline/freshness + recently active; `device-presence` contract)
5. SecurityIntelligence (severity counts + coverage + worst risk — no fake score)
6. OperationsPanel (backups running/failed/last + scans + reports summary)
7. Quick Commands (real actions/routing; role-filtered)
8. OnboardingFlow preserved (zero-fleet state)
9. Zero-fake enforcement: D01–D04 remediated; all metrics carry source+freshness
10. Performance budget (§25), real-time strategy (§22), accessibility contract (§24)

**SHOULD HAVE** (included if effort/scope allows without risking MUST):
- ActivityTimeline (Owner/Admin; real `AuditLog`)
- Network connectivity one-liner (reachable devices, ON-DEMAND)
- Signal Field motif in the visual direction (DASH-VIS-01 defines; DASH-IMPL-02 implements if approved)
- D10 polling hygiene + D11 onboarding stabilization + D09 loading states

**LATER** (not in V1; no fake contracts):
- Full fleet health average / fleet scoring (needs real aggregation + agreement on math)
- Home topology map, home charts, home job editors
- Role-inclusive activity endpoint (`GET /dashboard/activity`)
- AI operational brief, predictive risk, anomaly detection, command automation (§30)

**V1 priority order:** Truth → operational awareness → navigation → actionability → performance → visual polish. Feature creep is rejected; every SHOULD HAVE is gated on not endangering the MUST list.

---

## 30. Future Evolution

Only after V1 is defined; none of these enter V1 without real contracts:

| Concept | Real contract needed | Status |
|---|---|---|
| Cross-domain unified activity stream | Role-inclusive `GET /dashboard/activity` (backend aggregation) or V1 Owner/Admin-only feed generalized | Future (V1 uses `AuditLog` already) |
| Predictive risk | Historical scoring + alerting models + agreed math; currently per-device only | Future |
| AI-generated operational brief | A `POST /ai/operational-brief` (SSE) over real summary inputs; grounded, citable | Future (AI plumbing exists for `/ai/troubleshoot`) |
| Anomaly detection | Metric baselining + backend detection + alert integration | Future |
| Fleet intelligence (predictive fleet state) | Aggregated device-health trend + policy model | Future |
| Command automation | Action registry + audit + confirmation policy (destructive ops governance) | Future |
| Home topology view | Reuse `/network/topology` behind lazy-load; mobile evidence required | Future |
| Quick scan trigger on home | Routed interaction to Cybersecurity (ownership rule) | Future, low value |

**Gate:** every future concept must name its endpoint(s), derive from real rows, define empty/error/stale states, and pass the zero-fake law before appearing on the surface.

---

## 31. Implementation Roadmap

Evidence-driven sequence. **Data precedes visuals** (truth before spectacle; D01–D04 are P0 and block the V1 truth floor).

```
1. DASH-DATA-01 — Real Data Integrity Recovery          [BACKEND SCOPE]
   • New GET /dashboard/summary aggregation (fleet/security/operations; all 4 roles)
   • Remediate D01 (wire security), D02 (remove fake deltas), D03 (remove ||1 + role gate), D04 (real backup status)
   • Normalize alert severity read path; dedupe rules; keep /admin/* for Owner/Admin
   • Tests: aggregation + derivation + role matrix
   → Prerequisite for Command Center truth floor (MUST have #2, #3, #5, #6)

2. DASH-VIS-01 — Command Center Visual Direction        [DOCS + TOKENS]
   • Define THE SIGNAL FIELD signature, planes, spatial system, motion grammar, tokens
   • Extends auth DNA (bible; spatial report :241 motif generalization); NO implementation
   → Can be authored in parallel with DASH-DATA-01 (docs only)

3. DASH-IMPL-01 — Command Center Foundation            [FRONTEND]
   • Rebuild home shell: CommandHeader, OperationalStateBanner, composed useCommandCenterData
   • Accessibility contract (§24) incl. D07 fixes; D09 loading states; D10 polling hygiene; D11 onboarding stabilization
   • Pure deriveState + tests; performance budget baseline

4. DASH-IMPL-02 — Operational Intelligence Modules     [FRONTEND]
   • FleetIntelligence, SecurityIntelligence, OperationsPanel, AttentionRail, ActivityTimeline (Owner/Admin), QuickCommands
   • Signal Field visual layer (from DASH-VIS-01) behind reduced-motion/decoration isolation

5. DASH-QA-01 — Manual + Runtime QA                    [QA]
   • D12 runtime verification (billing); D08 gateway observation; responsive matrix (320–1920)
   • a11y audit, polling behavior under hidden tabs, error/empty/stale states
   • Route protection verification once DASH-SEC-01 lands (or handoff note)

6. DASH-SEC-01 — Server-Side Route Protection          [SEPARATE SECURITY MISSION]
   • middleware.ts route guard for /dashboard (guard-only; no auth contract changes)
   • May run in parallel with DASH-IMPL-*; must land before Production

7. DASH-CERT-01 — Command Center Certification & Freeze [CERTIFICATION]
   • TG-3 quality gate: no fabricated metrics, D01–D12 closed/classified, a11y + perf verified
   • Command Center certification record mirrors AUTH-CERT-01 pattern
```

**Grouping rationale:** DASH-DATA-01 and DASH-VIS-01 are independent (backend + docs) and can overlap; DASH-IMPL-01 must wait on DATA (state banner needs the endpoint) and can consume VIS; DASH-IMPL-02 waits on IMPL-01; QA waits on IMPL-02; SEC-01 is parallel and independent; CERT closes. This keeps missions small and compatible — no unnecessary bureaucracy.

---

## 32. Risks

| Risk | Mitigation |
|---|---|
| **DASH-DATA-01 blocked** (summary endpoint not approved) | OperationalState banner downgrades to "unresolved alerts count" only; Security/Operations panels fall back to existing REST with explicit loading/empty; no approximation |
| Backend aggregation changes semantics of counts (alert cap at take:10, active-session admin gating) | DASH-DATA-01 defines exact row filters + tests; home depends only on the documented contract |
| Role gate mistakes (Technician/Viewer 403 on admin endpoints) | Summary endpoint is all-roles; admin-only data never required by home; per-module permission table (§6) |
| Reusing/altering shared hooks regresses specialist pages | Coordinated change in DASH-IMPL-01; existing test suites gate it; DASH-QA-01 verifies all pages |
| Visual scope creep (Signal Field → heavy 3D) | Visual direction caps at CSS/SVG; Three.js forbidden for home (perf budget §25) |
| Hidden-tab polling fix touches frozen `apiFetch`/socket semantics | Polling hygiene implemented in dashboard-owned hooks only; `apiFetch`/`socket-client` untouched |
| D05/D06/D12 not owned by dashboard missions → perceived as dropped | Defect map (§27) + roadmap (§31) make ownership explicit; D05/D06 separate missions; D12 QA-verified |
| Mobile surface drift (desktop density crammed onto phone) | Responsive contract §23: mobile defers modules behind "View all"; never fabricates |
| Onboarding regressions during rebuild | OnboardingFlow preserved as a component; D11 stabilization covered by foundation + tests |

---

## 33. Open Decisions

| # | Decision | Owners | When |
|---|---|---|---|
| OD-1 | Final route name + exact shape of `GET /dashboard/summary` (naming, includes `recentDevices`?) | DASH-DATA-01 | Before DASH-IMPL-01 |
| OD-2 | Alert severity normalization strategy (free-string severity → canonical mapping) without schema change | DASH-DATA-01 | Before state machine lands |
| OD-3 | Whether `recentDevices` ships in summary or home keeps `useDeviceList` (single-poller goal) | DASH-DATA-01 | Before DASH-IMPL-01 |
| OD-4 | Fleet "health average" math — currently deferred; requires an agreed real aggregation formula | Post-CERT / future | Before any fleet score |
| OD-5 | Stale threshold for security scan coverage (proposed 7 days; configurable?) | DASH-DATA-01 / product | Before DASH-IMPL-02 |
| OD-6 | Acknowledge permissions exact role set for Technician vs Viewer on alerts | Security/Product | Before DASH-IMPL-02 |
| OD-7 | DASH-SEC-01 sequencing vs DASH-IMPL-* (parallel approved?) | Governance | Roadmap kickoff |
| OD-8 | V1 shows ActivityTimeline only for Owner/Admin — confirm product acceptance of role-scoped omission | Product | Before DASH-IMPL-02 |

---

## 34. Final Recommendation

**Adopt the TechFusion Command Center as the rebuild of `/dashboard`** — an operational decision surface built on the DASH-01 real-data baseline, consuming one new all-roles aggregation endpoint (`GET /dashboard/summary`) plus the existing WS/REST contracts, with a deterministic, auditable state model and zero fabricated metrics.

- **Architecture:** Hybrid — backend aggregation + one composed Command Center hook + WS for alerts. Specialist pages keep all business logic (§14).
- **Signature:** **The Signal Field** — a quiet field of real fleet instruments where nothing shines unless it is true (§18).
- **V1 operational modules:** **8** — Command Header, Operational State Banner, Attention Rail, Fleet Intelligence, Security Intelligence, Operations, Activity Timeline (Owner/Admin), Quick Commands (onboarding preserved as the zero-fleet state).
- **Backend aggregation requirements:** **1 endpoint** (`GET /dashboard/summary`) in DASH-DATA-01; activity generalization (`GET /dashboard/activity`) explicitly deferred; fleet health-average math deferred pending agreed formula.
- **DASH-01 P0 remediation (D01–D04):** executed in DASH-DATA-01 before any implementation; D05/D06 → separate missions; D07–D11 → fixed during implementation; D12 → runtime verification (§27).
- **Authentication files modified: NONE.** **Production files modified: NONE.**
- **Documentation created:** `docs/dashboard/DASH-02_COMMAND_CENTER_BLUEPRINT.md`.

**Status: BLUEPRINT COMPLETE — READY FOR EXECUTION PLANNING.**

**Recommended next mission:** **DASH-DATA-01 — Real Data Integrity Recovery** (the prerequisite). It produces the aggregation endpoint and closes D01–D04, without which the Command Center's truth floor cannot be built. DASH-VIS-01 (Visual Direction, documentation only) may be authored in parallel.

---

### FINAL RESPONSE

- **Selected Command Center architecture:** Hybrid — one all-roles `GET /dashboard/summary` aggregation endpoint + one composed `useCommandCenterData()` hook + WS `/metrics` alerts subscription; specialist pages own all business logic.
- **Selected visual signature:** **The Signal Field** — a quiet, depth-layered field of real fleet instruments; nothing shines unless it is true (CSS/SVG; no WebGL/Three.js on home).
- **Number of V1 operational modules:** **8** (Command Header, Operational State Banner, Attention Rail, Fleet Intelligence, Security Intelligence, Operations, Activity Timeline [Owner/Admin], Quick Commands).
- **Backend aggregation requirements:** `GET /dashboard/summary` (fleet/security/operations counts, coverage, state inputs) — required before DASH-IMPL-01; `GET /dashboard/activity` deferred; fleet health-average deferred.
- **DASH-01 P0 remediation strategy:** D01–D04 fixed in DASH-DATA-01 (wire security aggregation, remove fabricated deltas, remove `\|\|1` + fix role gating, wire real backup status); D05/D06 separate missions; D07–D11 during implementation; D12 runtime-verified in DASH-QA-01.
- **Authentication files modified:** NONE.
- **Production files modified:** NONE.
- **Documentation created:** `docs/dashboard/DASH-02_COMMAND_CENTER_BLUEPRINT.md`.
- **Recommended next mission:** DASH-DATA-01 — Real Data Integrity Recovery (DASH-VIS-01 may run in parallel, docs only).

*End of DASH-02. Documentation-only mission — verified no tracked production or Authentication files were modified.*

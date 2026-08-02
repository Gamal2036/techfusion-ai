# TechFusion-AI — Current Dashboard Analysis (DASH-01)

> **Document ID:** DASH-01
> **Type:** Current-State Analysis (read-only baseline)
> **Phase:** Pre-Command-Center Planning
> **Status:** ANALYSIS COMPLETE — READY FOR DASHBOARD PLANNING
> **Date:** 2026-08-01
> **Mode:** READ-ONLY — no code, UI, API, backend, database, route, dependency, test, or auth surfaces were modified
> **Owner:** Engineering Execution Governance

---

## 1. Executive Summary

The TechFusion-AI Dashboard lives at `/dashboard` in `apps/web` (Next.js 14.2, React 18). It is a **fully client-rendered** application shell with **17 page routes** and a shared `layout.tsx` that enforces client-side authentication, renders the Sidebar/Topbar/Command Palette/AI Chat Drawer, and polls a NestJS API Gateway (`apps/api-gateway`, port 3001).

The dashboard is **substantially data-backed**: ~72 HTTP endpoints across 13 feature areas, 4 Socket.IO namespaces, and 1 SSE AI stream, mapping to 37 Prisma models. However, the **dashboard home page** (`page.tsx`) contains **fabricated/placeholder metrics** (Device Fleet Scores "Risk Assessment" and "Security Posture" always render "No Data Yet"; count-card deltas are synthetic; "Backup Status" is hardcoded to "No Data Yet"), and **1 real defect** is confirmed in the security export pipeline (`export-pdf` returns HTML, not PDF).

**Bottom line:** Command Center planning can proceed — the data plumbing is real and rich. The redesign must (P0) replace fabricated home-page metrics with real fleet/security aggregation endpoints, and (P1) decide on server-side route protection.

---

## 2. Scope and Method

**Scope.** Read-only inventory and analysis of the current `/dashboard` surface, its dependencies, and its backend contracts. No design decisions were made beyond flagging readiness.

**Method.**
1. Full read of `apps/web/src/app/dashboard/{page,layout,loading,error}.tsx` and all 16 sub-pages.
2. Full read of shared components: `Sidebar.tsx`, `Topbar.tsx`, `CommandPalette.tsx`, `AiChatDrawer.tsx`, `ErrorBoundary.tsx`, `NetworkMap.tsx`, `ScoreGauge.tsx`.
3. Read of all data hooks in `apps/web/src/hooks/` and libs `auth-client.ts`, `socket-client.ts`, `device-presence.ts`.
4. Grep of every `apiFetch(` / `subscribe(` / `fetch(` call across `apps/web/src` to build the authoritative API map (269 matches; deduped to 72 endpoints).
5. Backend verification: route decorators in `apps/api-gateway/src` controllers/gateways, `CombinedAuthGuard`, `PlanGuard`, `app.module.ts`, Prisma schema.
6. Cross-reference of governance documents: TG-1A, TG-2A, TG-2X, TG-3, TG-CORE, AUTH-CERT-01.
7. `git status` / `git diff` verification that no tracked files were modified (see §22).

**Trust rule.** Current code is the source of truth. Old docs are contracts, not proof. Every metric source is classified: `REAL_API` / `DERIVED_REAL_DATA` / `HARDCODED_VALUE` / `STATIC_COPY` / `MOCK` / `PLACEHOLDER` / `UNKNOWN`.

---

## 3. Route Inventory

| Route | File (apps/web/src/app/dashboard/) | Lines | Loading | Purpose |
|---|---|---|---|---|
| `/dashboard` | `page.tsx` | 551 | loading.tsx | Fleet Overview + onboarding |
| `/dashboard/device-health` | `device-health/page.tsx` | 218 | loading.tsx | Device health scores |
| `/dashboard/device-health/[id]` | `device-health/[id]/page.tsx` | 317 | loading.tsx | Per-device detail |
| `/dashboard/monitoring` | `monitoring/page.tsx` | 567 | — | Real-time metrics + alerts |
| `/dashboard/cybersecurity` | `cybersecurity/page.tsx` | 463 | loading.tsx | Scans, findings, posture |
| `/dashboard/network` | `network/page.tsx` | 604 | loading.tsx | Topology + diagnostics |
| `/dashboard/remote-support` | `remote-support/page.tsx` | 585 | loading.tsx | Sessions, recordings, audit |
| `/dashboard/drivers` | `drivers/page.tsx` | 242 | loading.tsx | Driver/software inventory |
| `/dashboard/backup` | `backup/page.tsx` | 784 | loading.tsx | Jobs, runs, restore wizard |
| `/dashboard/ai-chat` | `ai-chat/page.tsx` | 411 | loading.tsx | Full-page AI chat |
| `/dashboard/knowledge-base` | `knowledge-base/page.tsx` | 211 | loading.tsx | KB articles |
| `/dashboard/reports` | `reports/page.tsx` | 206 | loading.tsx | Reports + `ScheduledReportsSection` (723) |
| `/dashboard/billing` | `billing/page.tsx` | 320 | loading.tsx | Plan, usage, invoices |
| `/dashboard/team` | `team/page.tsx` | 206 | loading.tsx | User management |
| `/dashboard/settings` | `settings/page.tsx` | 257 | loading.tsx | AI providers, router |
| `/dashboard/settings/enrollment` | `settings/enrollment/page.tsx` | — | loading.tsx | Enrollment tokens |
| `/dashboard/design-system` | `design-system/page.tsx` | 618 | — | Component showcase |

**Counts:** 17 page routes (16 sub-pages + home). Missing `loading.tsx`: `monitoring`, `design-system`.

Also relevant: `/` is the marketing landing (Hero + placeholder sections), `/login` and `/signup` are the authenticated entry points.

---

## 4. Page-by-Page Screen Inventory

### 4.1 Dashboard Home (`page.tsx`)
- `Fleet Overview` header + subtitle.
- 4 `CountCard`s: Total Devices, Online Agents, Active Alerts, Team Members (with `AnimatedNumber` 800 ms count-up).
- `Device Fleet Scores` panel: Device Health / Risk Assessment / Security Posture bars.
- `Quick Actions` panel: Connect Device, View Alerts, Network Map, Backup Status.
- `Recently Active Devices` table (Device, Status, OS, Last Seen; top 8).
- **Onboarding Flow** (zero-device state): 3-step wizard — OS picker (Linux/macOS/Windows), generate enrollment token, run agent command; polling every 3 s for device detection.

### 4.2 Device Health (`device-health/`, `device-health/[id]/`)
- Fleet health score list per device; detail page with metrics history, health breakdown, last-seen freshness.

### 4.3 Monitoring (`monitoring/page.tsx`)
- Real-time telemetry panels, alert feed, WS-pushed metrics, severity filtering.

### 4.4 Cybersecurity (`cybersecurity/page.tsx`)
- "Cybersecurity Center" header + subtitle; Trigger Scan + Export Report buttons; device selector; empty/loading/scan-in-progress/no-data states; `ScoreGauge` score card; finding summary with severity.

### 4.5 Network (`network/page.tsx`)
- Interactive `NetworkMap` (canvas) from `/network/topology`; scan controls; on-demand diagnostics (latency/ping, DNS, traceroute, connectivity); WS topology updates.

### 4.6 Remote Support (`remote-support/page.tsx`)
- Sessions list, create/end session, live WebRTC/Socket signal + screen frames, recordings, audit log.

### 4.7 Drivers/Software (`drivers/page.tsx`)
- `StatCard` summary, driver/software lists, `SearchInput` filtering, inventory refresh.

### 4.8 Backup (`backup/page.tsx`)
- "Backup & Recovery Center"; header + New Job button; tabs Jobs / Run History / Recovery Wizard; 5 s polling; verify/restore/artifact actions.

### 4.9 AI Chat (`ai-chat/page.tsx`)
- Streaming conversation, device-context picker, KB citations, stop/clear controls.

### 4.10 Knowledge Base (`knowledge-base/page.tsx`)
- Article list, create/edit, semantic query (`/kb/query`).

### 4.11 Reports (`reports/page.tsx`)
- New report form; report card grid; generate/download/delete; embedded `ScheduledReportsSection` (CRON schedules CRUD).

### 4.12 Billing (`billing/page.tsx`)
- Plan display, usage meters, invoice history; checkout/portal buttons.

### 4.13 Team (`team/page.tsx`)
- User list via `/admin/users`; role change; remove user.

### 4.14 Settings (`settings/`)
- AI provider status, router stats, router strategy; enrollment token management + audit.

### 4.15 Design System (`design-system/page.tsx`)
- Static showcase of `@techfusion/ui` primitives (non-shipping).

---

## 5. Component Inventory

**App-level (dashboard shell):** `Sidebar.tsx`, `Topbar.tsx` (org switcher, theme toggle, chat trigger, command palette, logout), `CommandPalette.tsx` (⌘K, 15-page index), `AiChatDrawer.tsx` (420px right drawer), `ErrorBoundary.tsx`, `NetworkMap.tsx` (canvas topology), `ScoreGauge.tsx` (gauge visualization).

**Page-local components:** `CountCard`, `AnimatedNumber`, `EnrollmentStep`, `OnboardingFlow` (dashboard home); `ScheduledReportsSection` (reports).

**`@techfusion/ui` primitives consumed by dashboard:** `GlassPanel` (`intensity="light|medium"`), `Badge`, `StatusBadge`, `Skeleton`, `Button`, `Input`, `SearchInput`, `Dialog` (+Header/Content/Title/Description), `Select`, `Switch`, `Textarea`, `StatCard`, `EmptyState`, `Label`, `Checkbox`, `ScorePill`, `LoadingSpinner`, `Alert`, `Toaster`/`toast`, `cn`.

**Auth/landing components (frozen surface, referenced not owned):** `AuthEnvironment`, `AuthBrandPanel`, `AuthLogo` (+ login/signup experience wrappers).

**Rough total:** ~20 dashboard-owned/consumed components plus ~15 UI-package primitives.

---

## 6. Data Source Audit — Fact Matrix

Dashboard home (`page.tsx`) metric truth:

| Metric | Source | Classification | Verdict |
|---|---|---|---|
| Total Devices | `useDeviceList` → `GET /devices` | REAL_API | Real |
| Online Agents | derived from `/devices` + `isDeviceOnline(lastSeenAt)` (5 min threshold) | DERIVED_REAL_DATA | Real |
| Active Alerts | `GET /alerts/latest` (unacknowledged filter) | REAL_API | Real |
| Team Members | `GET /admin/dashboard` (`.teamMembers`) | REAL_API | Real |
| Total Devices change badge | `+${min(devices.length,10)}` | HARDCODED_VALUE | **Fabricated** |
| Online Agents change badge | `+${onlineCount}` | HARDCODED_VALUE | **Fabricated** |
| Active Alerts badge/trend | count, forced `down` when >0 | HARDCODED_VALUE | **Misleading** |
| Team Members fallback | `|| 1` when undefined | PLACEHOLDER | **Misleading** |
| Device Health score | `round(online/total*100)` | DERIVED_REAL_DATA | Real (not from `/scores`) |
| Risk Assessment | always `null` → "No Data Yet" | PLACEHOLDER | **Not implemented** |
| Security Posture | always `null` → "No Data Yet" | PLACEHOLDER | **Not implemented** |
| Backup Status quick action | literal "No Data Yet" | STATIC_COPY | **Stub** |
| Recently Active Devices | `/devices` slice(0,8) | REAL_API | Real |
| Onboarding token | `POST /enrollment/tokens` | REAL_API | Real |

All other pages read their dedicated hooks (all REAL_API; see §7). No `MOCK` data sources were found in the dashboard surface.

---

## 7. API Dependency Map (Dashboard → Gateway)

**Devices (3):** `GET /devices`, `GET /devices/:id/latest`, `GET /devices/:id/metrics`
**Alerts (6):** `GET /alerts/rules`, `POST /alerts/rules`, `PUT|DELETE /alerts/rules/:id`, `GET /alerts/latest`, `POST /alerts/:id/acknowledge`
**Security (6):** `GET /security/latest/:deviceId`, `GET /security/scans/:deviceId`, `GET /security/executive-summary/:deviceId`, `POST /security/scans/:deviceId/trigger`, `POST /security/findings/:findingId/remediate`, `GET /security/export-pdf/:deviceId`
**Network (9):** `GET /network/devices`, `GET /network/topology`, `GET /network/scans`, `POST /network/discovery/trigger`, `POST /network/diagnostics/{latency,dns,traceroute,connectivity}`
**Remote Support (6):** `GET /remote-support/devices`, `GET|POST /remote-support/sessions`, `POST /remote-support/sessions/:id/end`, `GET /remote-support/recordings`, `GET /remote-support/audit-logs`
**Inventory (3):** `GET /inventory/drivers`, `GET /inventory/software`, `POST /inventory/refresh`
**Backups (9):** `GET|POST /backups/jobs`, `POST /backups/jobs/:id/trigger`, `DELETE /backups/jobs/:id`, `GET /backups/runs`, `POST /backups/runs/:id/verify`, `GET /backups/artifacts/:runId`, `POST /backups/runs/:id/restore`, `GET /backups/restore-points/:deviceId`
**Reports (7):** `GET /reports`, `POST /reports/generate`, `DELETE /reports/:id`, `GET|POST /reports/schedules`, `PATCH|DELETE /reports/schedules/:id`
**Knowledge Base (5):** `GET|POST /kb/articles`, `PUT|DELETE /kb/articles/:id`, `POST /kb/query`
**AI (4):** `POST /ai/troubleshoot` (SSE stream), `GET /ai/providers/status`, `GET /ai/router/stats`, `POST /ai/router/strategy`
**Billing (5):** `GET /billing/plan`, `GET /billing/usage`, `GET /billing/history`, `POST /billing/checkout`, `POST /billing/portal`
**Admin/Team (4):** `GET /admin/dashboard`, `GET /admin/users`, `PATCH /admin/users/:id/role`, `POST /admin/users/:id/remove`
**Enrollment (5):** `GET|POST /enrollment/tokens`, `DELETE /enrollment/tokens/:id`, `PATCH /enrollment/tokens/:id/regenerate`, `GET /enrollment/audit`

**Total: 72 HTTP endpoints across 13 feature areas.**

---

## 8. WebSocket / Realtime Architecture

`lib/socket-client.ts` provides a namespace-keyed Socket.IO wrapper (auth via stored token, 10 reconnection attempts, `autoConnect: false`).

| Namespace | Emits consumed | Backed by |
|---|---|---|
| `/metrics` | `metrics`, `alerts` | devices.gateway; alerts.gateway (bridge) |
| `/network` | `topology`, `diagnostics`, `scan-status` | network.gateway |
| `/remote` | `session-update`, `session-ended`, `signal`, `screen-frame` | remote-support.gateway |

**Polling fallbacks:** devices 15 s (3 s fast / 10 s disconnected), backups 5 s, alerts REST pull in addition to push. One SSE stream: `/ai/troubleshoot`.

Note: `AlertsGateway` is a bridge rather than a first-class WS gateway — alert events are consumed off the `/metrics` namespace.

---

## 9. State Management

- **No global state library** (no Redux/Zustand/Jotai). All state is React-local (`useState`/`useRef`) inside hooks and pages.
- Hooks own remote data + loading/error and expose refetch/actions. Cross-component sharing happens only through shared hooks (`useDeviceList` used by home, ai-chat, network, cybersecurity, backup, remote-support).
- `layout.tsx` holds a 30 s interval auth re-check (getCurrentUser/isAuthenticated) and redirects to `/login` on failure.
- Theme state via `next-themes` (default dark), managed in root layout.

---

## 10. Access Control & Role Gating

- **Client:** `layout.tsx` guards render via `getCurrentUser()`/`isAuthenticated()`; `Sidebar` hides admin items with `isAdminOrAbove` over a role array. Roles: `Owner`(4) > `Admin`(3) > `Technician`(2) > `Viewer`(1).
- **Server:** `CombinedAuthGuard` (global) verifies JWT (`JWT_SECRET`), enforces `@Roles`, scopes to `orgId`; `PlanGuard` gates billing features by `org.plan`.
- **Gap (P1):** No `middleware.ts` exists → **no server-side route protection**. Unauthenticated users can receive the dashboard HTML; enforcement is purely client-side effects. Auth contract itself is certified/frozen — this is an architectural observation, not an auth change.
- Device-facing endpoints use `DeviceTokenGuard`/`@Public` (`/devices/register`, `/devices/metrics`, `/security/scan-result`, etc.) — agent channel, not user channel.

---

## 11. Layout & Navigation

- Root layout: `ThemeProvider` (dark default) + `ErrorBoundary` + dashboard pages' content.
- Dashboard layout: fixed sidebar (desktop), topbar with org switcher, theme toggle, AI chat trigger, ⌘K command palette, logout.
- Sidebar nav (role-gated): Dashboard, Device Health, Monitoring, Cybersecurity, Network, Remote Support, Drivers/Software, Backup, AI Chat, Knowledge Base, Reports, Billing, Team, Settings.
- CommandPalette indexes 15 dashboard destinations.
- `AiChatDrawer` renders as fixed right-side overlay inside the layout.

---

## 12. Theming & Visual Language

- `globals.css` (407 lines): HSL CSS variables (`background`/`foreground`), `Inter` typeface, dark default, glass tokens (`.glass-card`, `.glass-card-hover`, `.glass-surface`).
- `packages/config/theme.ts`: primary blue, accent cyan, score colors, radii, shadows (`glass`, `glassLg`, `elevated`, `card`, `dialog`), blur, animation.
- `framer-motion` for entrance animations; `lucide-react` icons; `recharts` + `three` available for charting/3D.
- Consistent glassmorphism panels via `GlassPanel`; status via `StatusBadge`; severity via `ScorePill`/score colors.

---

## 13. Accessibility

**Observed gaps (P1/P2):**
- OS picker in onboarding uses `button` without `aria-pressed`/`aria-label`; no focus-visible styling on several custom buttons.
- Status conveyed by color-only dots/`StatusBadge` without always-visible text (partially mitigated by labels in tables).
- Command palette and drawer close on Escape (good); drawer lacks focus trap + initial focus.
- Onboarding "Skip" link is a `button` styled as text (ok) but lacks accessible name semantics in some branches.
- No reduced-motion guard on `AnimatedNumber`/count-up on dashboard home (`useReducedMotion` exists in the codebase but is used only by PasswordStrength).

---

## 14. Responsive Behavior

- Count cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
- Two-column panels collapse to single column below `lg`.
- Device table wrapped in `overflow-x-auto` (functional but no sticky header).
- `AiChatDrawer` fixed width `max-w-[420px]` full-height — no dedicated mobile sheet behavior.
- NetworkMap canvas + remote-support screens assumed desktop; mobile behavior unverified (`UNKNOWN`).

---

## 15. Brand / Design Contract Compliance (TG family)

- **TG-1A** (Brand Identity): dashboard shell (dark, precision-instrument, trustworthy) aligns with brand voice; landing marketing hero is branded. Full compliance not audited line-by-line in this pass.
- **TG-2A / TG-2X** (Design Language): theme tokens consumed from `packages/config/theme.ts`; `@techfusion/ui` primitives match documented tokens. Consistent glass surface usage.
- **TG-3** (Design Quality Framework): command center quality bar. Home-page fabricated metrics (§6) and HTML-as-PDF (§21) are quality violations requiring remediation before Production.
- **TG-CORE** (Execution Constitution): read-only mission respected; no conflicting edits.

---

## 16. Performance Characteristics

- **Bundle risk:** dashboard is a single client app bundle; `three` (NetworkMap), `recharts`, `framer-motion` are heavy. No route-level code splitting confirmed beyond Next route chunks.
- **Polling load:** devices 15 s (3 s/10 s variants) + backups 5 s + alerts push + admin/dashboard pull on home. No visibility-based pause (hidden-tab polling continues) — P2.
- **SSR:** all dashboard pages are `'use client'` → client-side data fetching; no RSC streaming for dashboard data.
- `AnimatedNumber` uses rAF count-up per card — fine at 4 cards.
- No image-heavy surfaces; icons are lucide (tree-shaken).

---

## 17. Loading & Error States

- Per-route `loading.tsx` (Skeletons) for 15 of 17 routes; `error.tsx` at dashboard level + root `ErrorBoundary`.
- In-page skeletons for home counts/scores; per-page empty states (cybersecurity, reports, home device table, backup).
- `toast` (sonner) for action feedback (token copied, jobs triggered, etc.).
- Gap: no global error-reporting integration; network failures log to console and show local states (P2).

---

## 18. Authentication Dependencies (FROZEN SURFACE — document only)

Dashboard depends on these **certified, frozen** artifacts (AUTH-CERT-01, baseline AUTH-02X-R2-H1, 2026-08-01). They may be *referenced*, never modified:

- `lib/auth-client.ts` — `setTokens`, `getApiUrl`, `apiFetch` (401 → refresh → redirect), `getCurrentUser`, `logout`, JWT payload (`sub`, `orgId`, role).
- `lib/socket-client.ts` — token-based Socket.IO auth.
- `components/auth/*` (`AuthEnvironment`, `AuthBrandPanel`, `AuthLogo`) and login/signup experiences/pages.
- `__tests__/{login,signup,landing}-page.spec.tsx`.

Any Command Center redesign must consume these contracts unchanged. Authentication files modified: **NONE**.

---

## 19. Defect & Inconsistency Inventory

| ID | Severity | Location | Finding |
|---|---|---|---|
| D01 | **P0** | dashboard/page.tsx:342-365 | Fleet "Risk Assessment" and "Security Posture" are always `null` ("No Data Yet") despite labels claiming scan data — feature not wired |
| D02 | **P0** | dashboard/page.tsx:427-430 | Count-card `change` badges are fabricated (`+min(len,10)`, `+onlineCount`, forced trend) — not real deltas |
| D03 | **P0** | dashboard/page.tsx:430 | Team Members falls back to `1` — misleading when `/admin/dashboard` lacks `teamMembers` |
| D04 | **P0** | dashboard/page.tsx:475 | Quick Action "Backup Status" is static "No Data Yet" despite real `/backups/jobs` |
| D05 | **P1** | api-gateway/security.controller.ts:160-172 | `GET /security/export-pdf/:id` returns `text/html`, not PDF — violates UI "Export Report" expectation |
| D06 | **P1** | apps/web/src (no middleware.ts) | No server-side route protection for `/dashboard`; client-effect-only gating → content flash for unauthenticated users |
| D07 | **P1** | dashboard/page.tsx OS picker; custom buttons | Missing `aria-pressed`/focus-visible in several custom interactive elements |
| D08 | **P2** | api-gateway alerts.gateway | `AlertsGateway` is a bridge onto `/metrics`, not a first-class WS gateway |
| D09 | **P2** | dashboard/monitoring, /design-system | Missing `loading.tsx` (route-level skeleton) |
| D10 | **P2** | hooks/useDevices, useBackups | Polling does not pause on hidden tab; no exponential backoff on repeated failure |
| D11 | **P2** | dashboard/page.tsx:103-117 | `OnboardingFlow` detection effect depends on `onComplete`/`devices` → interval churn on parent re-render |
| D12 | **P2** | billing page | Checkout/portal (`/billing/checkout`, `/billing/portal`) subscription integration not runtime-verified → **UNKNOWN** |

---

## 20. Existing Documentation Cross-Reference

- `docs/README.md` — index; lists `dashboard/` visual-architecture slot as "future per-surface document" → DASH series now fills it.
- `docs/PROJECT_CONTEXT.md` — dashboard listed as "14 sub-routes" (outdated; actual = 16 sub-pages + home). Endpoint tables consistent with §7.
- `docs/TG-1A`, `docs/TG-2A`, `docs/TG-2X`, `docs/TG-3`, `docs/TG-CORE` — governance/brand/quality contracts (§15).
- `docs/AH-3F/*` — frontend foundation reports (theme tokens, primitives, data/AI components, library consolidation).
- `docs/AH-3*`, `docs/AH-3R/*` — feature completion/runtime stabilization series corroborate backend surface.
- `docs/certifications/AUTH-CERT-01` — authentication certification (frozen).

---

## 21. Certification / Lock Status

- **Authentication:** CERTIFIED & FROZEN — AUTH-CERT-01, baseline AUTH-02X-R2-H1, certified 2026-08-01. Do not touch (documented in §18).
- **Dashboard:** NO certification exists. TG-3 prohibits Production entry while D01–D04 (fabricated metrics) and D05 (HTML-as-PDF) remain open.

---

## 22. Preservation Contract

The following must NOT be modified, deleted, reset, or refactored during Command Center planning/execution without explicit approval:

1. **All auth surfaces** (§18) — certified baseline.
2. `lib/device-presence.ts` — online threshold (5 min) and freshness contract (live ≤60 s / recent ≤5 min / stale / unavailable) consumed across home, ai-chat, device-health.
3. `apiFetch` / `socket-client` behavior — 401 refresh+redirect, reconnection semantics.
4. `git status` state — uncommitted auth-baseline working-tree changes in `apps/web`, `apps/api-gateway`, `apps/agent` are sacred. No reset/clean/checkout/restore/stash/rebase/merge/commit/unlink of tracked files.
5. Prisma schema, guards, gateways, controllers — backend is contract, not surface.

---

## 23. Command Center Readiness Assessment

| Area | Status | Evidence |
|---|---|---|
| Fleet Overview (home) | **PARTIAL** | Real `/devices` + `/alerts/latest` + `/admin/dashboard`; D01–D04 fabrications |
| Device Health | READY | Real scores/metrics endpoints |
| Monitoring | READY | Real telemetry + WS push |
| Cybersecurity | **PARTIAL** | Real scans/findings; D05 export defect |
| Network | READY | Real topology + on-demand diagnostics + WS |
| Remote Support | READY | Real sessions + WS signal/screen-frame |
| Drivers/Software | READY | Real inventory + refresh |
| Backup | READY | Real jobs/runs/restore; 5 s poll |
| AI Chat | READY | Real SSE troubleshooting + KB citations |
| Knowledge Base | READY | Real CRUD + semantic query |
| Reports | READY | Real reports + schedules |
| Billing | PARTIAL | Plan/usage/history real; checkout/portal UNKNOWN (D12) |
| Team | READY | Real admin APIs |
| Settings | READY | Real provider/router APIs |
| **Command Center overall** | **READY — with P0 data-integrity remediation required before Production** | 72 real endpoints, 4 WS namespaces |

---

## 24. Recommendations

**P0 — must fix before Command Center builds on home page:**
1. Wire fleet "Risk Assessment" and "Security Posture" to real aggregation (new `GET /devices/summary` or reuse security exec-summary across fleet) — remove "No Data Yet" fake labels.
2. Replace fabricated count-card deltas with real comparisons or remove badges.
3. Remove `|| 1` Team Members fallback; render graceful "—".
4. Replace static "Backup Status" quick action with `useBackups` summary (or drop until real).

**P1 — high value for redesign:**
5. Fix `export-pdf` to return a real PDF (or rename surface expectation to HTML report).
6. Decide server-side protection: add `middleware.ts` route guard (must not alter frozen auth contracts — guard only, no auth changes).
7. Accessibility: focus-visible, `aria-pressed` on OS picker, drawer focus trap, reduced-motion for `AnimatedNumber`.

**P2 — polish/architecture:**
8. Promote alerts to a first-class gateway or document the bridge.
9. Add `loading.tsx` to monitoring + design-system.
10. Pause polling on hidden tabs; backoff on failures.
11. Stabilize `OnboardingFlow` polling effect.
12. Verify billing checkout/portal at runtime; mark READY or document stub.

---

## 25. Risks and Unknowns

- **UNKNOWN:** Billing checkout/portal runtime behavior (D12).
- **UNKNOWN:** Mobile behavior of NetworkMap / remote-support (no responsive evidence).
- **UNKNOWN:** Actual production-verifiable uptime/performance — dashboard is client-rendered; runtime inspection was intentionally avoided to preserve the dirty auth baseline. Static evidence is comprehensive.
- **Risk:** Redesign touching shared hooks/layout could perturb frozen auth flow — mitigate via the preservation contract (§22).

---

## 26. Evidence Log

- Reads: 17 dashboard pages, layout/loading/error, 4 shell components, 2 map/gauge components, 14 hooks, 3 lib files, root layout, landing page, `next.config.js`, `package.json`, `globals.css`, `theme.ts`.
- Greps: `apiFetch(`/`subscribe(`/`fetch(` across `apps/web/src` (269 matches → 72 endpoints), route decorators across `apps/api-gateway/src`, `docs/` references.
- Backend verification: `combined-auth.guard.ts`, `plan.guard.ts`, `app.module.ts`, 4 gateways, `schema.prisma` (37 models), security/devices controllers.
- Governance: TG-1A, TG-3 headers, AUTH-CERT-01, docs/README.md.

---

## 27. Final Assessment

**Status: ANALYSIS COMPLETE — READY FOR DASHBOARD PLANNING.**

The current dashboard is a genuinely data-backed surface (72 endpoints, 4 WS namespaces, 37 models) rather than a mock. Command Center can be planned as a **redesign** with high confidence. Non-negotiables for the planning phase: preserve the certified auth surface and `device-presence` contracts, remediate P0 data-integrity items (D01–D04) and the PDF defect (D05) before Production, and treat every §22 file as read-only until an explicit change order exists.

**Next mission:** DASH-02 — Command Center Visual Architecture + Redesign Blueprint (surface vision, information architecture, component plan), built directly on this baseline.

---

*End of DASH-01. Read-only compliance verified — no tracked files modified.*

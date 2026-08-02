# DASH-IMPL-01 — COMMAND CENTER FOUNDATION REPORT

> **Document ID:** DASH-IMPL-01
> **Phase:** Product Execution — Dashboard
> **Type:** Mission Report / Foundation Implementation
> **Priority:** P0
> **Date:** 2026-08-02
> **Mode:** Implement the production Command Center foundation on `/dashboard` (structural shell, data orchestration, 4DX spatial foundation, accessibility, responsive, reduced-motion) consuming only real data from `GET /dashboard/summary`; Authentication stays frozen; the DASH-DATA contract is not modified.

---

## 1. Mission Identity

| Field | Value |
|-------|-------|
| Mission ID | **DASH-IMPL-01** |
| Mission name | Command Center Foundation |
| Preceding missions | DASH-01 (analysis), DASH-02 (blueprint), DASH-VIS-01 (4DX visual direction), DASH-DATA-01 (real data integrity) |
| Reference docs | `docs/dashboard/DASH-02_COMMAND_CENTER_BLUEPRINT.md`, `docs/dashboard/DASH-VIS-01_4DX_VISUAL_DIRECTION.md`, `docs/dashboard/DASH-DATA-01_REAL_DATA_INTEGRITY_REPORT.md`, `docs/certifications/AUTH-CERT-01_AUTHENTICATION_CERTIFICATION.md` |
| Decision | **PARTIAL — BROWSER QA REQUIRED** (foundation is code-complete; mandatory browser QA is pending) |

---

## 2. Mission Objective

Deliver the production structural foundation for the TechFusion-AI Command Center on `/dashboard`:

1. **Structural shell** — page becomes a thin wrapper around a new `CommandCenterPage` composition with semantic `main`/`header`/`section` regions and a single page-level `h1`.
2. **Data orchestration** — one composed data source (`useCommandCenterData`) that reads `GET /dashboard/summary` plus one live WebSocket alert subscription and one conditional backup-run poller, with full polling hygiene.
3. **Operational State** — a client-side mirror of the backend derivation (so the UI and API can never disagree), including a web-only `UNKNOWN` fetch-failure status; never invents a state or score.
4. **4DX spatial foundation** — L0 Atmosphere + L1 Signal Field container + L2 Infrastructure plane, plus a decorative Command Horizon, exactly per DASH-VIS-01.
5. **Accessibility / responsive / reduced-motion** hardening per D07 and DASH-VIS-01.

The full Signal Field constellation and the final Attention / Fleet / Security / Operations modules are **NOT** built in this mission — only honest foundation slots are left for the operational missions to fill.

---

## 3. Scope & Constraints

**In scope:**
- `apps/web/src/app/dashboard/page.tsx` (thin wrapper), `loading.tsx`, `error.tsx`.
- New `apps/web/src/components/command-center/**` (11 components + scoped CSS).
- New `apps/web/src/lib/command-state.ts` (shared operational-state mirror + labels + stale rules).
- New `apps/web/src/hooks/useCommandCenterData.ts`; evolved `useDashboardSummary.ts` (polling hygiene).
- New `apps/web/src/hooks/useFocusTrap.ts`, wired into `AiChatDrawer`/`CommandPalette` (D07 narrow scope).
- Tests: new `command-state`, `useCommandCenterData`, `operational-state`, `use-focus-trap`; extended `dashboard-page-truth`, `use-dashboard-summary`.

**Out of scope / frozen:**
- **Authentication is CERTIFIED & FROZEN.** No changes to `apps/web/src/lib/auth-client.ts`, `socket-client.ts`, `components/auth/**`, `components/login/**`, `components/signup/**`, auth routes, MFA, auth backend, tokens, redirects, auth tests. **Authentication files modified: NONE.**
- **Backend modified: NONE.** No `apps/api-gateway/**` file was touched in this mission.
- **DASH-DATA contract modified: NO.** `GET /dashboard/summary` response shape, backend aggregation, Prisma, and the security/backup/team contracts are untouched; future needs are documented for DASH-IMPL-02.
- No Three.js / WebGL / Recharts / new animation libraries / continuous JS animation loops.
- No global token redesign; dashboard-scoped CSS/components only.
- No specialist business logic in the Command Center (it is an aggregator, not an operator).

---

## 4. Frozen / Foreign Surfaces — Verification

| Surface | Status |
|---------|--------|
| `apps/web/src/lib/auth-client.ts` | NOT modified (unchanged from baseline) |
| `apps/web/src/lib/socket-client.ts` | NOT modified (read-only consumer via `subscribe`) |
| `apps/web/src/components/auth/**` | NOT modified |
| `apps/web/src/app/{login,signup}/**` | NOT modified |
| Backend `apps/api-gateway/**` (incl. `src/dashboard/**`) | NOT modified |
| `GET /dashboard/summary` contract | NOT modified |
| Prisma schema / migrations | NOT modified |
| `device-presence` (both twins) | NOT modified (reused read-only) |
| Destructive git operations | NONE (read-only inspection only) |

---

## 5. Architecture Overview

```
page.tsx (thin wrapper, app route)
   └─ CommandCenterPage (client, command-center/CommandCenterPage.tsx)
        ├─ Atmosphere            (L0, aria-hidden, static radial glows)
        ├─ InfrastructurePlane   (L2, aria-hidden, static perspective grid, <lg hidden)
        ├─ CommandHorizon        (decorative SVG line + ticks + cmd-sweep dash, aria-hidden)
        ├─ CommandHeader         (single h1 "Command Center", as-of + stale note)
        ├─ SignalField           (L1 semantic section)
        │    ├─ OperationalState (role=status aria-live=polite; badge+dot+label+reasons)
        │    └─ FleetCountCard x4 (Total / Online / Active Alerts / Team — "—" on null)
        ├─ Fleet & Security + Quick Actions panels (real data only)
        ├─ Recently Active Devices table (summary.recentDevices, real presence)
        ├─ ModuleSlot x3          (honest frames: Attention / Fleet / Operations)
        └─ OnboardingFlow         (only when fleet.total === 0; owns its device poller)
   data: useCommandCenterData
        ├─ useDashboardSummary   (15s poll, visibility-pause, backoff 15s→120s, no-overlap)
        ├─ subscribe('/metrics','alerts')   (live alert events, dedupe, cap 50)
        └─ conditional poller GET /backups/runs?limit=20 (5s, only while backups active)
```

---

## 6. Operational State

- `apps/web/src/lib/command-state.ts` mirrors `apps/api-gateway/src/dashboard/operational-state.ts` **exactly**: rule order `NO_DATA → CRITICAL → DEGRADED → ATTENTION → OPERATIONAL`, same severities, same thresholds (`offline === fleetTotal`, `offline*2 > fleetTotal`, any alert/finding/offline/backups-running-or-pending).
- State and reasons derive from ONE function (`deriveOperationalStateDetailed`) so they can never disagree.
- `OperationalStatus = OperationalState | 'UNKNOWN'` — `UNKNOWN` is **web-only** (client fetch failure), never produced by the backend mirror.
- Staleness via `isSummaryStale` (5-minute threshold on `generatedAt`). On stale, the **last confirmed state is kept** and a `stale` note is shown; never re-derived from empty/null, never looks fresh.
- `operational-state.spec.ts` (38 tests) mirrors the backend spec case-by-case; `operational-state.spec.tsx` (4 tests) covers the component (labels, reasons, stale, UNKNOWN, no color-only state).

**Operational State status: COMPLETE** (mirror + reasons + stale + UNKNOWN + component + tests).

---

## 7. `useCommandCenterData`

- Exactly one surface poller (`/dashboard/summary`), one WS subscription (`/metrics` `alerts`), one conditional poller (`/backups/runs?limit=20` active only while `running > 0 || pending > 0`).
- Exposes `{ summary, summaryLoading, summaryError, refetchSummary, status, reasons, stale, liveAlerts, activeBackupRuns }`.
- Live alerts deduped by id, newest-first, capped at 50.
- **`useDeviceList` is NOT mounted** on the Command Center surface (DASH-02 §22 single-poller contract); fleet counts come from the summary, and onboarding owns its own device poller.

**`useCommandCenterData` status: COMPLETE** (7 tests).

---

## 8. Polling Hygiene (D10)

`useDashboardSummary` (evolved from a bare 15s `setInterval`):
- **Pauses when `document.visibilityState === 'hidden'`**; resumes with an immediate refresh on visibility return.
- **Exponential backoff** `15s * 2^min(failures,3)`, capped at `120s`; resets to base on success.
- **No overlapping requests** (`inFlightRef` guard, incl. manual `refetch` mid-flight).
- **Single timer** (`clearTimer`/`scheduleNext`), cleaned up on unmount.
- Conditional backup poller applies the same visibility-pause and no-overlap rules, and is dormant when no backup is active.

Tests: `use-dashboard-summary.spec.tsx` (6 — 3 original preserved + hidden-pause/resume, backoff-cap-reset, no-overlap), `useCommandCenterData.spec.ts` (7 — dedupe/cap, OPERATIONAL, UNKNOWN on failure, CRITICAL + reasons, stale, conditional poller dormant/active/pause-resume).

**Polling hygiene status: COMPLETE.**

---

## 9. 4DX Visual Implementation

- **L0 Atmosphere** (`Atmosphere.tsx` + `.cmd-atmosphere`): matte dark base + three **static** radial glows (top primary/0.16, accent/0.09, bottom primary/0.07; blur 120px). **No** animated gradients, random texture, fake stars, or particles.
- **L1 Signal Field** (`SignalField.tsx`): the interactive semantic layer (`<section aria-label="Live operational state">`); content z-index above L0/L2.
- **L2 Infrastructure** (`InfrastructurePlane.tsx` + `.cmd-infrastructure__grid`): one static repeating 1px grid (56px), `perspective(1500px) rotateX(16deg) scale(1.5)`, opacity-faded, **hidden below `lg`**, setting-only (no topology/labels).
- Depth/materials use existing tokens (`GlassPanel` `light`/`medium`, `surface-*`, `border-*`, `glass-card-hover`) — no global token redesign, no heavy blur.
- No parallax, no continuous infrastructure movement, no count-up, no attention pulse.

**4DX status: COMPLETE (L0/L1 container/L2).**

---

## 10. Command Horizon

`CommandHorizon.tsx`: decorative, `aria-hidden`, `pointer-events-none`. Static SVG line + 14 ticks (`focusable="false"`) plus exactly one subtle dash animation (`.cmd-horizon__sweep`, `@keyframes cmd-sweep`, 9s linear infinite) gated behind `prefers-reduced-motion: no-preference`.

**Command Horizon status: COMPLETE.**

---

## 11. Accessibility (D07)

- Single page-level `h1` ("Command Center") in `CommandHeader`; semantic `header`/`section`/`main` structure; `SignalField` labeled section.
- Visible focus ring utility `.cmd-focus-ring` applied to interactive elements (`focus-visible`).
- `role="status"` + `aria-live="polite"` on the Operational State banner only (not on nested badges); dot/color are decorative (`aria-hidden`), the text label is always present.
- 4DX layers (`Atmosphere`, `InfrastructurePlane`, `CommandHorizon`) are `aria-hidden`; the horizon SVG is `focusable="false"`.
- Onboarding OS selector uses `aria-pressed` on each option.
- `useFocusTrap` added and wired into `AiChatDrawer` and `CommandPalette`: focus is trapped while open, wrapped at both boundaries, and restored to the trigger on close (3 tests).
- Touch targets ≥ 44px for primary onboarding/action controls.

**Accessibility status: COMPLETE (code); visual keyboard/screen-reader pass remains part of browser QA.**

---

## 12. Reduced Motion

- No count-up (the page's `AnimatedNumber` framer-motion count-up was **removed**); values render statically.
- No entrance/transition animations on the page (framer-motion removed from the page entirely).
- The single allowed animation (`cmd-sweep`) runs only under `prefers-reduced-motion: no-preference`; the `Skeleton` uses its `static` variant automatically under reduced motion.
- L0/L2 planes are static final states (no movement).

**Reduced motion status: COMPLETE (code).**

---

## 13. Responsive Behavior

- L2 Infrastructure hidden below `lg`; glows clipped to viewport.
- Count cards: `grid-cols-1 → sm:grid-cols-2 → lg:grid-cols-4`.
- Panels stack single-column below `lg`.
- Recent-devices table wrapped in `overflow-x-auto` (no horizontal page overflow).
- Module slots: `md:grid-cols-3`.
- Command header wraps (`flex-wrap`); Operational State banner stacks on mobile.

**Responsive status: COMPLETE (code); visual verification at all breakpoints is part of browser QA.**

---

## 14. Hydration & Server/Client Boundary

- `dashboard/layout.tsx` renders children only after client `mounted`, so the server never renders `CommandCenterPage` — the client-only page has no SSR-vs-client mismatch risk (prior auth hydration defect avoided).
- `loading.tsx` is a server-safe structural skeleton (`Skeleton` uses the `typeof window` guard internally), `error.tsx` is a client component with `'use client'`.
- No large inline `<style>` RAWTEXT; no `window`/`matchMedia`-dependent initial render in page content.
- Headless smoke: built server returned `HTTP 200` for `/dashboard` and rendered the `command-center` shell without errors.

**Hydration/browser status: code-side COMPLETE; full hydration/console/network pass is browser QA.**

---

## 15. Onboarding Flow (preserved from DASH-01)

`OnboardingFlow.tsx` preserves the real enrollment flow: OS selector (`aria-pressed`), enrollment-token generation (`POST /enrollment/tokens`), agent command, and detection polling. It is shown only when `summary.fleet.total === 0`. The detection effect is stabilized against churn (D11) and owns its own device poller so the Command Center surface never mounts `useDeviceList`.

---

## 16. Module Slots (honest foundation)

`ModuleSlot.tsx` renders only an overline/title/description/link — **no fabricated numbers, no fake content**. Three slots placed for the future modules: **Attention** (→ `/dashboard/monitoring`), **Fleet Intelligence** (→ `/dashboard/device-health`), **Operations** (→ `/dashboard/backup`). The real modules replace these frames in later missions.

---

## 17. Data Truth (STRICT DATA LAW)

- Only real data from `GET /dashboard/summary` + approved existing APIs (alerts WS, backups runs). No fabricated counts/alerts/security state/trends/deltas/nodes.
- Honest states: `—` for null counts, `No health scores yet`, `No scans yet`, `No backups yet`, `Status unavailable`, `No devices connected` — never a placeholder pretending to be a fact. No "No Data Yet" anywhere; no `+N`/`-N%` deltas.
- `dashboard-page-truth.spec.tsx` keeps the three core truth assertions and adds two cases (empty-fleet onboarding; recent devices rendered from the summary contract with real presence).

---

## 18. Backend Contract Integrity

- `GET /dashboard/summary`, `DashboardSummaryResponse`, the backend `deriveOperationalState`, Prisma, and all specialist contracts are **untouched**.
- The web mirrors the derivation client-side (see §6) purely to render reasons/state without a backend change; the two files carry an explicit "MUST stay in sync" note plus mirror tests.

---

## 19. Authentication — Modified Files

**Authentication files modified: NONE.**

---

## 20. Backend — Modified Files

**Backend modified: NONE.**

---

## 21. Focus Trap (D07 narrow scope)

`useFocusTrap.ts`: wraps focus at both Tab boundaries while active, pulls focus in when tabbing from outside, restores focus to the trigger on close. Wired into `AiChatDrawer` and `CommandPalette` (both already handled Escape). Three tests in `use-focus-trap.spec.tsx`.

---

## 22. Tests — Web

| Area | Suites | Tests | Result |
|------|--------|-------|--------|
| Baseline web (DASH-DATA-01) | 22 | 649 | PASS |
| New: `command-state.spec.ts` | 1 | 38 | PASS |
| New: `useCommandCenterData.spec.ts` | 1 | 7 | PASS |
| New: `operational-state.spec.tsx` | 1 | 4 | PASS |
| New: `use-focus-trap.spec.tsx` | 1 | 3 | PASS |
| Extended: `use-dashboard-summary.spec.tsx` | 1 | 6 (+3) | PASS |
| Extended: `dashboard-page-truth.spec.tsx` | 1 | 5 (+2) | PASS |
| **Total web** | **26** | **706** | **ALL PASS** |

No existing test was weakened or removed; the three original truth assertions are preserved.

---

## 23. Tests — Backend (environmental note)

Backend suites (incl. `src/dashboard/**`, 5 suites / 65 tests) are the **unmodified** DASH-DATA-01 baseline — no backend file was changed in this mission. A pre-existing environment issue prevents running any backend spec in this checkout: api-gateway's dependency tree mixes **jest 29 and jest 30** (`jest-mock@29.7.0` coexists with `jest-runtime@30.4.2`), so jest-runtime fails at `Runtime.resetModules` with `TypeError: this._moduleMocker.clearMocksOnScope is not a function` for every suite (`--runInBand`, `--no-cache`, single-file runs all reproduced). This is independent of DASH-IMPL-01; web's tree is consistent (jest 30 only) and fully green. **Recommended follow-up:** align api-gateway to a single jest major (e.g. pin `jest@^30` + matching `jest-mock` resolution) in a separate infra task.

---

## 24. TypeScript

`npx tsc --noEmit` in `apps/web`: **PASS** (no errors).

---

## 25. Production Build

`npx next build` in `apps/web` (after a clean `.next`): **PASS** — 22 static/dynamic routes compiled, `/dashboard` 12.1 kB page / 205 kB first load. The page no longer imports framer-motion (the `AnimatedNumber` count-up removed); no new dependencies added.

---

## 26. Server-Side Smoke

Built server (`next start`) served `/dashboard` with **HTTP 200** and rendered the `command-center` structural shell server-side without an error boundary — confirming the route loads cleanly at the network/shell level.

---

## 27. Browser QA Checklist (PENDING — required for COMPLETE)

- [ ] `/dashboard` on desktop / laptop / tablet / mobile; hard refresh.
- [ ] Nav in and out of `/dashboard` (sidebar, palette, quick actions).
- [ ] Console: no errors, no `console.error` from the page.
- [ ] Network: only expected calls (`/dashboard/summary` poll cadence, WS `/metrics` alert subscription, conditional `/backups/runs` only while backups active); no duplicate intervals.
- [ ] Hydration: no hydration mismatch / server-client variant warnings.
- [ ] Reduced motion: `prefers-reduced-motion` stops `cmd-sweep`; no other motion on page.
- [ ] Keyboard: tab through Command Center in logical order; focus ring visible; command palette / AI drawer trap focus and restore on close.
- [ ] Operational State banner changes with real data; `stale` note appears after 5 minutes; `Status unavailable` (UNKNOWN) shows on API failure without showing a fake state.
- [ ] No horizontal overflow at any breakpoint.

---

## 28. Defects Addressed / Deferred

**Addressed in this mission:**
- D10 polling hygiene (pause/backoff/no-overlap/visibility) on the dashboard surface.
- D07 keyboard containment (`useFocusTrap`), focus rings, `aria-pressed`, non-color-only status.
- Removed framer-motion `AnimatedNumber` count-up from the dashboard (reduced-motion + performance budget).
- Removed per-page `useDeviceList` polling from the dashboard surface (single-poller contract).

**Deferred to DASH-IMPL-02 / specialist missions (documented, not fabricated):**
- Full Signal Field constellation (freshness nodes) and final Attention / Fleet / Security / Operations modules.
- Security-scan / backup-edit / report-create / network-diagnostics / remote-support business logic (stays in specialist modules).
- Acknowledge-action wiring (`POST /alerts/:id/acknowledge`) and the full Quick-Commands set from DASH-02 §13.
- Aligning api-gateway's mixed jest major versions (infra task, see §23).

---

## 29. Final Status & Recommended Next Mission

**FINAL STATUS: PARTIAL — BROWSER QA REQUIRED**

The Command Center foundation is code-complete and verified (web typecheck, 706 web tests, production build, server-side smoke), but the mandatory browser QA (console/network/hydration/reduced-motion/keyboard/responsive) has not been performed in a real browser. Run the §27 checklist; on a clean pass, status becomes **COMPLETE — FOUNDATION READY FOR OPERATIONAL MODULES**.

**Recommended next mission:** **DASH-IMPL-02 — Attention Module** (real alert rail on `/dashboard/monitoring` data + acknowledge actions), which fills the first foundation slot and is the highest-value operational module. Follow with Fleet Intelligence (spatial freshness grouping) then Operations.

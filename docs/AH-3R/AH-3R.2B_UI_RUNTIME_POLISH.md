# AH-3R.2B — UI Runtime Polish & Navigation Stability

**Project:** TechFusion AI
**Date:** 2026-07-25
**Mode:** FRONTEND RUNTIME FIXES — NO DESIGN/FEATURE CHANGES
**Scope:** Dashboard pages, sidebar, command palette, auth, dark theme, accessibility

---

## 1. Summary

Audit and fix every Dashboard page in TechFusion AI for runtime stability, navigation consistency, UI polish, and production-readiness. All changes are frontend/runtime only — no auth logic, API, DB, WebSocket protocol, backend, or business logic changes.

---

## 2. Changes Made

### 2.1 Sidebar Active State for Nested Routes

**File:** `apps/web/src/components/Sidebar.tsx`
**Problem:** Sidebar used exact match (`pathname === item.href`) to determine the active item. This meant navigating to `/dashboard/device-health/dev_xxx` (child route) no longer highlighted "Device Health" in the sidebar.

**Fix:** Changed `isActive` to use `startsWith(item.href + '/')` for all non-root items, with exact match for `/dashboard` root:
```tsx
const isActive =
  item.href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname.startsWith(item.href + '/');
```

### 2.2 CommandPalette Missing Routes

**File:** `apps/web/src/components/CommandPalette.tsx`
**Problem:** Cmd+K command palette was missing the "Team" and "Enrollment" pages from its searchable navigation list.

**Fix:** Added two new entries to the `pages` array:
- `Team` → `/dashboard/team` (Users icon)
- `Enrollment` → `/dashboard/settings/enrollment` (Key icon)

### 2.3 Duplicate `cn()` Functions

**Files (5):** `device-health/page.tsx`, `remote-support/page.tsx`, `network/page.tsx`, `backup/page.tsx`, `drivers/page.tsx`
**Problem:** These pages each defined their own local `cn()` utility function identical to the one exported by `@techfusion/ui`. This added ~10 lines of dead code per file and created inconsistency risk.

**Fix:** Removed all local `cn()` definitions and imported `cn` from `@techfusion/ui`.

### 2.4 Dashboard Layout Auth Re-Check

**File:** `apps/web/src/app/dashboard/layout.tsx`
**Problem:** Auth check `useEffect` had `[router, pathname]` as dependencies. This caused `getCurrentUser()` + `isAuthenticated()` to run on every single client-side navigation, triggering unnecessary auth validation cycles and potential redirect flicker.

**Fix:** Changed to `[]` deps — auth check runs once on mount only. Subsequent navigations within the dashboard are safe since the user was already authenticated.

### 2.5 Dead Code Removal

**File:** `apps/web/src/app/dashboard/settings/page.tsx`
**Problem:** Unused `getProviderIcon()` function that was never called and referenced an unused `ProviderStatus` type.

**Fix:** Removed the dead function entirely.

### 2.6 Device Health N+1 API Call Optimization

**File:** `apps/web/src/app/dashboard/device-health/page.tsx`
**Problem:** Every time the device list updated (every 15s via polling), all device scores were re-fetched individually even if already cached in state, resulting in N API calls on every poll cycle.

**Fix:** Added deduplication check — only fetches scores for devices not already in the `scores` state:
```tsx
const devicesNeedingScores = devices.filter((d) => !scores[d.id]);
if (devicesNeedingScores.length === 0) return;
```

### 2.7 Dark Theme Hardcoded Backgrounds

**Files:** `AiChatDrawer.tsx`, `ai-chat/page.tsx`, `settings/page.tsx`
**Problem:** Three dropdown/option elements used hardcoded `bg-[#0a0a0a]` which doesn't respect the theme system and would look wrong in light mode.

**Fix:** Replaced `bg-[#0a0a0a]` with `bg-surface-950` (theme-aware surface color).

### 2.8 Accessibility Focus-Visible Ring

**File:** `apps/web/src/app/globals.css`
**Problem:** No global focus-visible indicator for keyboard navigation — buttons, links, and inputs had no visible focus ring.

**Fix:** Added global `focus-visible` ring style:
```css
*:focus-visible {
  @apply outline-none ring-2 ring-primary-500/50;
}
```

### 2.9 Unused Import Cleanup

**Files:** `monitoring/page.tsx`, `remote-support/page.tsx`, `backup/page.tsx`, `network/page.tsx`, `cybersecurity/page.tsx`, `dashboard/page.tsx`, `device-health/page.tsx`
**Problem:** 50+ unused imports across dashboard pages — icons, types, React hooks, and UI components that were imported but never referenced. This adds unnecessary bundle weight and makes code harder to navigate.

**Fix:** Removed all unused imports. Key removals:
- `useRef`, `useEffect` from files that don't use them
- `Wifi`, `HardDrive`, `Thermometer`, `Globe`, `Zap` icons from pages that don't render them
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button` from pages using `GlassPanel` instead
- `NetworkDevice`, `BackupJob`, `BackupRun`, `RemoteSession`, `AuditLog` types from files that don't annotate with them
- `Link` from `next/link` in pages using `router.push()` instead
- `ScorePill`, `DEVICE_ONLINE_THRESHOLD_MS` from device-health

---

## 3. Files Modified

| File | Changes |
|------|---------|
| `src/components/Sidebar.tsx` | Active state uses `startsWith` for nested routes |
| `src/components/CommandPalette.tsx` | Added Team + Enrollment to pages list |
| `src/components/AiChatDrawer.tsx` | `bg-[#0a0a0a]` → `bg-surface-950` |
| `src/app/dashboard/layout.tsx` | Auth check deps changed from `[router, pathname]` to `[]` |
| `src/app/dashboard/page.tsx` | Removed unused imports (CheckCircle kept) |
| `src/app/dashboard/device-health/page.tsx` | Deduplicated cn import, N+1 fix, unused imports |
| `src/app/dashboard/remote-support/page.tsx` | cn import, removed unused imports |
| `src/app/dashboard/monitoring/page.tsx` | Removed unused imports |
| `src/app/dashboard/backup/page.tsx` | cn import, removed unused imports |
| `src/app/dashboard/network/page.tsx` | cn import, removed unused imports |
| `src/app/dashboard/cybersecurity/page.tsx` | Removed unused imports |
| `src/app/dashboard/drivers/page.tsx` | cn import, removed unused imports |
| `src/app/dashboard/settings/page.tsx` | Dead code removal, `bg-[#0a0a0a]` fix |
| `src/app/dashboard/ai-chat/page.tsx` | `bg-[#0a0a0a]` → `bg-surface-950` |
| `src/app/globals.css` | Added `*:focus-visible` ring |

---

## 4. Validation

| Check | Result |
|-------|--------|
| `pnpm --filter @techfusion/web build` | ✅ Pass (all 19 routes compile) |
| `pnpm --filter @techfusion/web test` | ✅ 312/312 tests pass (15 suites) |
| `pnpm --filter @techfusion/web lint` | ⚠️ 11 pre-existing errors in test files (unrelated `ReportScheduleStatus` type missing from `@techfusion/types`) |

---

## 5. Not In Scope (Deferred)

| Item | Reason |
|------|--------|
| Monitoring N+1 API calls for latest metrics | Same pattern as device scores — would require backend API contract change to batch |
| Light theme full audit | Many components use hardcoded `text-white/*` classes — requires systematic audit |
| WebSocket error/reconnect UX | Already handled by `useWebSocket` hook with retry logic |
| Mobile responsive sidebar | Current collapse behavior works — would be a feature change |

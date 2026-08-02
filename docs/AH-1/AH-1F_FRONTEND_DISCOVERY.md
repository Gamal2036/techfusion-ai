# AH-1F — Frontend Discovery Report

> **Scope:** `apps/web/`, `packages/ui/`, `packages/config/`
> **Framework:** Next.js 14 App Router, React 18, TypeScript 5, Tailwind CSS 3
> **Date:** 2026-07-16

---

## Frontend Overview

| Property | Value |
|---|---|
| App | `apps/web/` (Next.js 14, App Router) |
| UI Package | `packages/ui/` (8 components + `cn` utility) |
| Config Package | `packages/config/theme.ts` (exported but unused in web app) |
| Types Package | `packages/types/index.ts` (minimal, unused in web app) |
| Utils Package | `packages/utils/index.ts` (minimal, unused in web app) |
| State Management | None (local `useState` per page/hook) |
| Auth | JWT in `localStorage` (accessToken + refreshToken) |
| Data Fetching | `fetch()` in custom hooks, `socket.io-client` for WS, manual SSE parsing |
| Styling | Tailwind CSS + CSS custom properties, glass morphism design language |
| Animation | Framer Motion (dynamically imported, SSR disabled) |
| Charts | Recharts |
| Toast | Sonner |
| Command Palette | cmdk |
| Theme | next-themes (dark/light, dark default) |

---

## Route and Page Map

### Top-Level Routes

| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Static landing page (no redirect to login) |
| `/login` | `src/app/login/page.tsx` | Login form |
| `/signup` | `src/app/signup/page.tsx` | Signup form |

### Dashboard Routes

| Route | File | Lines |
|---|---|---|
| `/dashboard` | `src/app/dashboard/page.tsx` | 352 |
| `/dashboard/device-health` | `src/app/dashboard/device-health/page.tsx` | 221 |
| `/dashboard/device-health/[id]` | `src/app/dashboard/device-health/[id]/page.tsx` | 287 |
| `/dashboard/monitoring` | `src/app/dashboard/monitoring/page.tsx` | 559 |
| `/dashboard/cybersecurity` | `src/app/dashboard/cybersecurity/page.tsx` | 442 |
| `/dashboard/network` | `src/app/dashboard/network/page.tsx` | 530 |
| `/dashboard/remote-support` | `src/app/dashboard/remote-support/page.tsx` | 489 |
| `/dashboard/drivers` | `src/app/dashboard/drivers/page.tsx` | 227 |
| `/dashboard/backup` | `src/app/dashboard/backup/page.tsx` | 505 |
| `/dashboard/ai-chat` | `src/app/dashboard/ai-chat/page.tsx` | 343 |
| `/dashboard/knowledge-base` | `src/app/dashboard/knowledge-base/page.tsx` | 211 |
| `/dashboard/reports` | `src/app/dashboard/reports/page.tsx` | 133 |
| `/dashboard/billing` | `src/app/dashboard/billing/page.tsx` | 320 |
| `/dashboard/settings` | `src/app/dashboard/settings/page.tsx` | 288 |
| `/dashboard/team` | `src/app/dashboard/team/page.tsx` | 174 |

**Total routes:** 18 (3 top-level + 15 dashboard)

---

## Layout Architecture

### Root Layout (`src/app/layout.tsx`)
- Wraps entire app in `ThemeProvider` (next-themes, dark default)
- Includes global `<Toaster>` from `@techfusion/ui`
- Sets `suppressHydrationWarning` on `<html>`

### Dashboard Layout (`src/app/dashboard/layout.tsx`)
- `'use client'` — entire dashboard is client-rendered
- **Auth guard:** Checks `localStorage.getItem('accessToken')`, parses JWT payload via `atob()`, redirects to `/login` if missing/invalid
- Renders: `<Sidebar>` + `<Topbar>` + `<CommandPalette>` + `<AiChatDrawer>` + children
- Page transitions via `framer-motion` `AnimatePresence` (SSR disabled via `next/dynamic`)
- Keyboard shortcuts: Cmd/Ctrl+K for command palette, Escape to close chat drawer
- Displays a second `<Toaster>` inside dashboard with custom dark styling (duplicate of root)

### Sidebar (`src/components/Sidebar.tsx`)
- 13 navigation items matching all dashboard routes
- Collapsible (auto-collapses below 1024px viewport width)
- Active route highlighting via `usePathname()`
- No role-based item filtering

### Topbar (`src/components/Topbar.tsx`)
- Organization menu (single item, no real org switching)
- Quick navigation trigger (Cmd+K)
- Theme toggle (dark/light)
- AI chat toggle
- User menu with profile, settings link, and logout
- **Logout:** Hardcoded `http://localhost:3001/auth/logout` (does not use `API_URL` env var)

---

## Authentication and Session Flow

### Login (`src/app/login/page.tsx`)
- **API call:** `POST ${API_URL}/auth/login` with `{ email, password }`
- **On success:** Stores `data.accessToken` and `data.refreshToken` in `localStorage`, redirects to `/dashboard`
- **On failure:** Displays error message in inline red alert

### Signup (`src/app/signup/page.tsx`)
- **API call:** `POST ${API_URL}/auth/signup` with `{ email, password, displayName, orgName }`
- **On success:** Same as login — stores both tokens, redirects to `/dashboard`
- **On failure:** Displays error message inline

### JWT Storage
- `localStorage.setItem('accessToken', data.accessToken)`
- `localStorage.setItem('refreshToken', data.refreshToken)`

### Session Validation
- Dashboard layout reads `accessToken` from `localStorage`
- Parses JWT payload: `JSON.parse(atob(token.split('.')[1]))`
- Extracts `user.displayName`, `user.sub`, `user.role`, `user.orgName` for Topbar display
- Redirects to `/login` if token missing or parsing fails

### Refresh Token Behavior
- `refreshToken` is stored but **never used** anywhere in the frontend
- No automatic token refresh logic exists
- No 401 interceptor to refresh and retry

### Route Protection
- **Only client-side** in dashboard layout (`src/app/dashboard/layout.tsx:32-42`)
- No Next.js middleware for route protection
- Landing page `/` has no auth check — accessible to unauthenticated users
- All dashboard routes rely solely on the dashboard layout auth guard

### Role and Plan Handling
- `user.role` is read from JWT payload and displayed in Topbar dropdown
- No role-based access control enforced on any page or component
- Plan info is fetched via `usePlan()` hook and displayed on billing page only

### Logout (`src/components/Topbar.tsx:46-55`)
- Calls `POST http://localhost:3001/auth/logout` with Bearer token
- Clears `accessToken` and `refreshToken` from `localStorage`
- Redirects to `/login`
- **Hardcoded URL** — does not use `NEXT_PUBLIC_API_URL`

---

## API Integration Map

### Environment Variables
| Variable | Default | Usage |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | REST API base URL |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3001` | WebSocket base URL |

### Auth Header Pattern
Every hook and page component defines a local `getAuthHeaders()` function that reads `localStorage.getItem('accessToken')`. There are **17 independent copies** of this function across the codebase — not centralized.

### REST API Endpoints

| Domain | Method | Endpoint | Used By |
|---|---|---|---|
| **Auth** | POST | `/auth/login` | `login/page.tsx` |
| | POST | `/auth/signup` | `signup/page.tsx` |
| | POST | `/auth/logout` | `Topbar.tsx` (hardcoded URL) |
| **Devices** | GET | `/devices` | `useDevices.ts` (15s polling) |
| | GET | `/devices/:id/latest` | `useDevices.ts` |
| | GET | `/devices/:id/metrics` | `useDevices.ts` |
| **Alerts** | GET | `/alerts/latest` | `dashboard/page.tsx`, `useAlerts.ts` |
| | GET | `/alerts/rules` | `useAlerts.ts` |
| | POST | `/alerts/rules` | `useAlerts.ts` |
| | PATCH | `/alerts/rules/:id` | `useAlerts.ts` |
| | DELETE | `/alerts/rules/:id` | `useAlerts.ts` |
| | PATCH | `/alerts/:id/acknowledge` | `useAlerts.ts` |
| **Backups** | GET | `/backups/jobs` | `useBackups.ts` |
| | GET | `/backups/runs` | `useBackups.ts` |
| | GET | `/backups/restore-points/:deviceId` | `useBackups.ts` |
| **Billing** | GET | `/billing/plan` | `useBilling.ts` |
| | GET | `/billing/usage` | `useBilling.ts` |
| | GET | `/billing/history` | `useBilling.ts` |
| | POST | `/billing/checkout` | `useBilling.ts` |
| | POST | `/billing/portal` | `useBilling.ts` |
| **Security** | GET | `/security/latest/:deviceId` | `useSecurity.ts` |
| | GET | `/security/scans/:deviceId` | `useSecurity.ts` |
| | GET | `/security/executive-summary/:deviceId` | `useSecurity.ts` |
| | POST | `/security/scans/:deviceId/trigger` | `useSecurity.ts` |
| | POST | `/security/findings/:findingId/remediate` | `useSecurity.ts` |
| | GET | `/security/export-pdf/:deviceId` | `cybersecurity/page.tsx` |
| **Inventory** | GET | `/inventory/drivers` | `useInventory.ts` |
| | GET | `/inventory/software` | `useInventory.ts` |
| **Knowledge Base** | GET | `/kb/articles` | `useKb.ts` |
| | POST | `/kb/articles` | `useKb.ts` |
| | PUT | `/kb/articles/:id` | `useKb.ts` |
| | DELETE | `/kb/articles/:id` | `useKb.ts` |
| | POST | `/kb/query` | `useKb.ts` (unused) |
| **Network** | GET | `/network/devices` | `useNetwork.ts` (30s polling) |
| | GET | `/network/topology` | `useNetwork.ts` (30s polling) |
| | GET | `/network/scans` | `useNetwork.ts` |
| | POST | `/network/diagnostics/latency` | `useNetwork.ts` |
| | POST | `/network/diagnostics/dns` | `useNetwork.ts` |
| | POST | `/network/diagnostics/traceroute` | `useNetwork.ts` |
| | POST | `/network/diagnostics/connectivity` | `useNetwork.ts` |
| **Remote Support** | GET | `/remote-support/sessions` | `useRemoteSupport.ts` |
| | POST | `/remote-support/sessions` | `useRemoteSupport.ts` |
| | POST | `/remote-support/sessions/:id/end` | `useRemoteSupport.ts` |
| | GET | `/remote-support/recordings` | `useRemoteSupport.ts` |
| | GET | `/remote-support/audit-logs` | `useRemoteSupport.ts` |
| **Reports** | GET | `/reports` | `useReports.ts` |
| | POST | `/reports` | `useReports.ts` |
| **AI** | POST | `/ai/troubleshoot` | `useAiChat.ts` (SSE) |
| | GET | `/ai/providers/status` | `settings/page.tsx` |
| | GET | `/ai/router/stats` | `settings/page.tsx` |
| | PUT | `/ai/router/strategy` | `settings/page.tsx` |
| **Team** | GET | `/team/members` | `team/page.tsx` |
| | POST | `/team/members` | `team/page.tsx` |
| | DELETE | `/team/members/:id` | `team/page.tsx` |
| **Dashboard** | GET | `/admin/dashboard` | `dashboard/page.tsx` |

---

## SSE and WebSocket Integration

### SSE (Server-Sent Events)

| Consumer | Endpoint | Events | Implementation |
|---|---|---|---|
| `useAiChat.ts` | `POST /ai/troubleshoot` | `token`, `done`, `citations`, `error` | Custom `parseSSEChunk()` function, manual `ReadableStream` reader, `AbortController` for cancellation |

The SSE implementation is hand-rolled: it reads chunks from `response.body.getReader()`, accumulates a text buffer, and parses `event:` / `data:` lines manually. Supports streaming token-by-token display, citation attachment, and graceful abort.

### WebSocket (Socket.IO)

| Consumer | Namespace | Events | Implementation |
|---|---|---|---|
| `useWebSocket.ts` | `/metrics` | `metrics` | Socket.IO client, joins with `orgId` query param |
| `useAlerts.ts` (`useAlertWebSocket`) | `/metrics` | `alerts` | Socket.IO client, joins with `orgId` query param |
| `remote-support/page.tsx` | `/remote` | `screen-frame` | Native WebSocket (not Socket.IO), joins with `orgId`, `sessionId`, `role` |

**Issues identified:**
- `useWebSocket` and `useAlertWebSocket` both connect to the same `/metrics` namespace independently — potential duplicate connections
- Remote support uses raw WebSocket while others use Socket.IO — inconsistent transport
- Remote support hardcodes `orgId = 'demo'` (`remote-support/page.tsx:104`) instead of reading from JWT
- `useWebSocket` `onMetrics` callback creates potential stale closure issues (no `useCallback` wrapping in consumers)

---

## Page Connection Matrix

| Page | Classification | API Endpoints | WebSocket | SSE | Evidence |
|---|---|---|---|---|---|
| `/` (Landing) | **Visual only** | None | No | No | Static HTML, no API calls |
| `/login` | **Fully connected** | `POST /auth/login` | No | No | Real API call, stores JWT |
| `/signup` | **Fully connected** | `POST /auth/signup` | No | No | Real API call, stores JWT |
| `/dashboard` | **Fully connected** | `GET /devices`, `GET /alerts/latest`, `GET /admin/dashboard` | No | No | Real API calls with loading states |
| `/dashboard/device-health` | **Fully connected** | `GET /devices`, `GET /devices/:id/scores` | Yes (metrics) | No | Real API + live metrics |
| `/dashboard/device-health/[id]` | **Fully connected** | `GET /devices/:id/latest`, `GET /devices/:id/metrics` | Yes (metrics) | No | Real API + live metrics + chart |
| `/dashboard/monitoring` | **Fully connected** | `GET /devices`, `GET /alerts/rules`, `POST/DELETE` rules, `PATCH` acknowledge | Yes (metrics + alerts) | No | Full CRUD + live data |
| `/dashboard/cybersecurity` | **Fully connected** | `GET /security/latest/:id`, `GET /security/scans/:id`, `GET /security/executive-summary/:id`, `POST trigger`, `POST remediate`, `GET export-pdf` | No | No | Real API, trigger scan, PDF export |
| `/dashboard/network` | **Fully connected** | `GET /network/devices`, `GET /network/topology`, `GET /network/scans`, 4x `POST /network/diagnostics/*` | No | No | Real API, topology map, diagnostics |
| `/dashboard/remote-support` | **Partially connected** | `GET/POST /remote-support/sessions`, `POST /end`, `GET /recordings`, `GET /audit-logs` | Yes (raw WS, hardcoded `orgId='demo'`) | No | API connected, WS has hardcoded demo value |
| `/dashboard/drivers` | **Fully connected** | `GET /inventory/drivers`, `GET /inventory/software` | No | No | Real API with search/filter |
| `/dashboard/backup` | **Fully connected** | `GET /backups/jobs`, `GET /backups/runs`, `GET /backups/restore-points/:id` | No | No | Real API, create/trigger/restore/delete |
| `/dashboard/ai-chat` | **Fully connected** | `POST /ai/troubleshoot` | No | Yes (SSE streaming) | Real SSE streaming with device context |
| `/dashboard/knowledge-base` | **Fully connected** | `GET/POST/PUT/DELETE /kb/articles` | No | No | Full CRUD on real API |
| `/dashboard/reports` | **Fully connected** | `GET /reports`, `POST /reports` | No | No | Real API, generate + download |
| `/dashboard/billing` | **Partially connected** | `GET /billing/plan`, `GET /billing/usage`, `GET /billing/history`, `POST /billing/checkout`, `POST /billing/portal` | No | No | API connected, plan cards have hardcoded tier details |
| `/dashboard/settings` | **Fully connected** | `GET /ai/providers/status`, `GET /ai/router/stats`, `PUT /ai/router/strategy` | No | No | Real API, auto-refresh 60s |
| `/dashboard/team` | **Fully connected** | `GET /team/members`, `POST /team/members`, `DELETE /team/members/:id` | No | No | Real API, invite/remove |

### Classification Summary

| Classification | Count | Pages |
|---|---|---|
| **Fully connected** | 14 | login, signup, dashboard, device-health, device-health/[id], monitoring, cybersecurity, network, drivers, backup, ai-chat, knowledge-base, reports, settings, team |
| **Partially connected** | 2 | remote-support (hardcoded orgId), billing (hardcoded plan tiers) |
| **Visual only** | 1 | `/` landing page |
| **Mock or hardcoded** | 0 | — |
| **Broken or unused** | 0 | — |

---

## Shared Components and Design System

### `@techfusion/ui` Package (8 components)

| Component | File | Base | Variants |
|---|---|---|---|
| `Button` | `Button.tsx` | CVA + Radix Slot | 7 variants (default, destructive, outline, secondary, ghost, link, glass), 4 sizes |
| `Card` / `GlassPanel` | `Card.tsx` | Native div | GlassPanel has 3 intensity levels (light, medium, heavy) |
| `Input` | `Input.tsx` | Native input | Standard with focus ring |
| `Dialog` | `Dialog.tsx` | Radix Dialog | Full Dialog system (Portal, Overlay, Content, Header, Footer, Title, Description, Close) |
| `Table` | `Table.tsx` | Native table | Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption |
| `Badge` | `Badge.tsx` | CVA | 7 variants (default, primary, secondary, destructive, success, warning, outline) |
| `ScorePill` | `ScorePill.tsx` | Native div | 3 variants (health, risk, security) with progress bar |
| `Toaster` | `Toast.tsx` | Sonner | Custom dark-themed toast styling |
| `cn` | `lib/utils.ts` | clsx + tailwind-merge | Utility function |

### App-Level Components (6 components)

| Component | File | Description |
|---|---|---|
| `Sidebar` | `components/Sidebar.tsx` | Collapsible nav with 13 items, auto-collapse <1024px |
| `Topbar` | `components/Topbar.tsx` | Org menu, user menu, theme toggle, palette trigger, chat toggle, logout |
| `CommandPalette` | `components/CommandPalette.tsx` | Cmd+K fuzzy page navigation (cmdk) |
| `AiChatDrawer` | `components/AiChatDrawer.tsx` | Slide-out AI chat panel with device context picker |
| `NetworkMap` | `components/NetworkMap.tsx` | SVG force-directed graph for network topology |
| `ScoreGauge` | `components/ScoreGauge.tsx` | SVG circular gauge (health/performance/risk, 3 sizes) |

### Theme System

**`packages/config/theme.ts`** defines a comprehensive theme object (colors, radii, shadows, blur, animation) but is **never imported** by the web app. The web app duplicates this configuration in `tailwind.config.js` and `globals.css` instead.

**`tailwind.config.js`** extends:
- Full color palette (primary, accent, surface) matching `theme.ts` values
- Custom border radii, box shadows (glass, glassLg, elevated, card, dialog)
- Custom backdrop blur scale
- 6 named animations (fade-in/out, slide-in-from-*, zoom-in/out)

**`globals.css`** defines:
- CSS custom properties for dark (`:root`) and light (`.light`) themes
- Custom scrollbar styling
- Keyframe animations (pulse-dot, count-up, slide-up)
- Utility classes (gradient-border, text-gradient, glass-card, glass-card-hover)

### Responsive Behavior
- Sidebar auto-collapses below 1024px
- Topbar hides text labels on small screens (`hidden sm:inline`, `hidden sm:block`)
- Pages use `p-4 md:p-6` for padding
- No mobile-specific layouts or hamburger menu
- No responsive grid breakpoints beyond standard Tailwind

### Accessibility
- `sr-only` class used on Dialog close button
- `aria-selected` used in CommandPalette items
- Focus-visible rings on Button and Input
- No ARIA landmarks beyond semantic HTML
- No skip navigation link
- No reduced-motion media query handling
- No color-contrast verification for glass morphism elements

---

## Loading and Error Handling

### Loading States

| Pattern | Used By |
|---|---|
| `loading` boolean in hooks | All 12 hooks set `loading` state |
| `Loader2` spinner | billing, reports, settings, cybersecurity, dashboard |
| Skeleton components | dashboard (local `Skeleton`), reports, team, settings |
| Inline `animate-pulse` divs | dashboard page skeleton |

### Error Handling

| Pattern | Used By |
|---|---|
| `console.error()` + silent failure | All hooks (catch blocks log and continue) |
| Inline error alert (red box) | login, signup, billing |
| Error message in chat | useAiChat (displays error in message bubble) |
| `ChatErrorBoundary` class component | ai-chat page only |
| No global error boundary | — |
| No 401/403 interceptor | — |
| No retry logic | — |
| No exponential backoff | — |
| No token refresh on 401 | — |

### Empty States

| Page | Empty State |
|---|---|
| `/dashboard/team` | "Invite your first team member" CTA |
| `/dashboard/knowledge-base` | No articles shown, implied empty |
| `/dashboard/backup` | Empty table when no jobs |
| All other pages | No explicit empty state handling |

---

## Mock and Hardcoded Data

### Verified Hardcoded Values

| Location | Hardcoded Value | Impact |
|---|---|---|
| `Topbar.tsx:50` | `http://localhost:3001/auth/logout` | Logout URL ignores env var |
| `remote-support/page.tsx:104` | `const orgId = 'demo'` | WebSocket connects with demo orgId |
| `billing/page.tsx:9-47` | `PLAN_DETAILS` array with prices, features | Plan display is static (but API data is also fetched) |
| `ai-chat/page.tsx:26-35` | `suggestedPrompts` array | Static suggested prompts for chat |
| `dashboard/page.tsx:103-107` | OS options with emojis | Onboarding download options |
| All hooks/pages | `http://localhost:3001` as default fallback | 25 occurrences across codebase |

### Inline `getAuthHeaders()` Duplication
The following 17 files each define their own `getAuthHeaders()` function:
- `src/app/login/page.tsx` (inline)
- `src/app/signup/page.tsx` (inline)
- `src/app/dashboard/page.tsx` (inline)
- `src/app/dashboard/settings/page.tsx` (inline)
- `src/app/dashboard/monitoring/page.tsx` (inline)
- `src/app/dashboard/cybersecurity/page.tsx` (inline)
- `src/app/dashboard/device-health/page.tsx` (inline)
- `src/app/dashboard/backup/page.tsx` (inline)
- `src/app/dashboard/remote-support/page.tsx` (inline)
- `src/app/dashboard/team/page.tsx` (inline)
- `src/hooks/useAiChat.ts`
- `src/hooks/useAlerts.ts`
- `src/hooks/useBackups.ts`
- `src/hooks/useBilling.ts`
- `src/hooks/useDevices.ts`
- `src/hooks/useInventory.ts`
- `src/hooks/useKb.ts`
- `src/hooks/useNetwork.ts`
- `src/hooks/useRemoteSupport.ts`
- `src/hooks/useReports.ts`
- `src/hooks/useSecurity.ts`

No centralized auth utility exists.

---

## Dead or Unused Code

### Unused Exports

| Item | File | Status |
|---|---|---|
| `useKbQuery` | `hooks/useKb.ts:97` | Exported but never imported by any page or component |
| `useKbQuery.results` | `hooks/useKb.ts` | Semantic search results never displayed |
| `packages/config/theme.ts` | `packages/config/theme.ts` | Full theme object exported but never imported in web app |
| `packages/types/index.ts` | `packages/types/index.ts` | `HealthCheckResponse` and `WorkspaceName` never imported in web app |
| `packages/utils/index.ts` | `packages/utils/index.ts` | `delay`, `isDefined`, `formatTimestamp` never imported in web app |
| `packages/ui/index.ts` | `packages/ui/index.ts` | Root `index.ts` exports only `placeholder` string — real exports are in `src/index.ts` |
| `buttonVariants` | `packages/ui/src/components/Button.tsx` | Exported but never imported externally |
| `badgeVariants` | `packages/ui/src/components/Badge.tsx` | Exported but never imported externally |

### Unused Packages (from web app perspective)
- `@techfusion/config` — listed in `next.config.js` `transpilePackages` but never imported
- `@techfusion/types` — not imported anywhere in web app
- `@techfusion/utils` — not imported anywhere in web app

### Duplicate Toaster
- Root layout (`src/app/layout.tsx:25`) renders `<Toaster position="bottom-right" />`
- Dashboard layout (`src/app/dashboard/layout.tsx:93-104`) renders another `<Toaster>` with custom styling
- Both are active simultaneously in dashboard routes

---

## Production Readiness

### Authentication
- **JWT storage:** localStorage (vulnerable to XSS)
- **Token refresh:** Not implemented (refreshToken stored but unused)
- **Route protection:** Client-side only (dashboard layout), no middleware
- **Token expiry:** No handling — expired tokens cause silent redirect to login
- **Role enforcement:** No frontend RBAC — roles displayed but not enforced
- **CSRF:** Not implemented (API calls use JSON with Bearer token)

### API Layer
- **Base URL:** Configured via env var with hardcoded fallback
- **Error handling:** `console.error()` only — no user-facing retry mechanisms
- **Retry behavior:** None
- **Request deduplication:** None (15s polling for devices, 30s for network)
- **Response validation:** `res.ok` checks only — no schema validation
- **Type safety:** TypeScript interfaces defined in hooks but no runtime validation

### Real-Time
- **WebSocket:** Socket.IO for metrics/alerts, raw WS for remote support — inconsistent
- **SSE:** Hand-rolled parser for AI chat streaming — functional but fragile
- **Connection management:** No reconnection logic for WebSocket disconnects
- **Duplicate connections:** `useWebSocket` + `useAlertWebSocket` both connect to `/metrics`

### Performance
- **Code splitting:** Next.js App Router provides route-level splitting
- **Dynamic imports:** Framer Motion loaded via `next/dynamic` with SSR disabled
- **Polling:** Device list (15s), network (30s) — no adaptive polling or backoff
- **Bundle:** No analysis done — no visible lazy loading for heavy components (Recharts, NetworkMap)

### Security
- **XSS surface:** localStorage JWT, `dangerouslySetInnerHTML` not used, but no CSP headers configured
- **Sensitive data:** No secrets in frontend code, but `console.log('[WS] Connected...')` in production
- **HTTPS:** Remote support WS URL adapts protocol, but no HSTS or secure cookie configuration

---

## Verified Gaps

### Critical
1. **No token refresh mechanism** — `refreshToken` stored but never used; users must re-login on token expiry (`hooks/useBilling.ts`, `hooks/useDevices.ts`, all hooks)
2. **No 401 interceptor** — Expired tokens cause silent failures or redirects without refresh attempt
3. **Hardcoded `orgId = 'demo'` in remote support WebSocket** (`remote-support/page.tsx:104`) — breaks multi-tenant functionality
4. **Hardcoded `http://localhost:3001/auth/logout` in Topbar** (`Topbar.tsx:50`) — logout fails when API is on different host

### High
5. **No centralized auth utility** — 17 independent copies of `getAuthHeaders()` across hooks and pages
6. **No client-side middleware** — Route protection is layout-dependent; direct URL access to `/dashboard/*` before layout mounts briefly exposes content
7. **Duplicate Toaster instances** — Root and dashboard layouts both render `<Toaster>`, causing duplicate toast notifications in dashboard routes
8. **No global error boundary** — Only AI chat has `ChatErrorBoundary`; uncaught errors crash the entire React tree

### Medium
9. **`useKbQuery` exported but never used** — Semantic search hook is dead code
10. **`@techfusion/config`, `@techfusion/types`, `@techfusion/utils` imported nowhere** — Three workspace packages unused by web app
11. **Duplicate WebSocket connections** — `useWebSocket` and `useAlertWebSocket` both connect to `/metrics` namespace independently
12. **No responsive mobile layout** — Sidebar collapses but no hamburger menu; pages not optimized for mobile viewports
13. **No accessibility landmarks, skip-nav, or reduced-motion support**
14. **Billing plan tiers hardcoded** (`billing/page.tsx:9-47`) — Display doesn't reflect actual API plan data for pricing/features

---

## Summary Statistics

| Metric | Value |
|---|---|
| Total routes | 18 |
| Fully connected pages | 15 |
| Partially connected pages | 2 (remote-support, billing) |
| Visual-only pages | 1 (`/` landing) |
| Mock or hardcoded pages | 0 |
| Shared UI components | 8 (Button, Card/GlassPanel, Input, Dialog, Table, Badge, ScorePill, Toaster) |
| App-level components | 6 (Sidebar, Topbar, CommandPalette, AiChatDrawer, NetworkMap, ScoreGauge) |
| Custom hooks | 12 files, 22 exported hooks/functions |
| REST API endpoints consumed | 42 unique endpoints |
| WebSocket namespaces | 2 (`/metrics`, `/remote`) |
| SSE endpoints | 1 (`/ai/troubleshoot`) |
| Hardcoded localhost references | 25 occurrences |
| Duplicate `getAuthHeaders()` copies | 17 |
| Unused hooks | 1 (`useKbQuery`) |
| Unused workspace packages | 3 (`config`, `types`, `utils`) |
| Total frontend source lines | ~5,200 (pages) + ~1,900 (hooks) + ~960 (components) = ~8,060 lines |

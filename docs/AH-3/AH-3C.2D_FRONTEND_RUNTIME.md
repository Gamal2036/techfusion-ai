# AH-3C.2D — Frontend Runtime

**Project:** Tech Fusion AI
**Phase:** AH-3C.2D — Device Runtime Integration & AI Multi-Provider Orchestration
**Date:** 2026-07-22

---

## Frontend Runtime Issues Fixed

### 1. Onboarding Device Detection (DEFECT-001)
- **File:** `apps/web/src/app/dashboard/page.tsx`
- **Before:** Step 4 "Detecting your device..." was a no-op spinner with no detection
- **After:** 3-second polling loop checks `devices.length`, auto-advances when device appears
- **States:** Searching (spinner) → Connected (green checkmark) → Auto-redirect

### 2. Fleet Scores Always Null (DEFECT-002)
- **File:** `apps/web/src/app/dashboard/page.tsx`
- **Before:** `fleetScores` returned null for all values even with devices
- **After:** Computes `deviceHealth` from online device ratio

### 3. No Error State in Device Hook (DEFECT-003)
- **File:** `apps/web/src/hooks/useDevices.ts`
- **Before:** `useDeviceList()` silently swallowed errors
- **After:** Added `error` state for network and HTTP errors

### 4. AI Chat Device Dropdown (DEFECT-004)
- **File:** `apps/web/src/app/dashboard/ai-chat/page.tsx`
- **Before:** No online/offline indicator, no empty state
- **After:** Green dot for online devices, hostname display, empty state with instructions

### 5. AI Chat Auto-Select Device (DEFECT-005)
- **File:** `apps/web/src/hooks/useAiChat.ts`
- **Before:** No device auto-selection
- **After:** Auto-selects when exactly one device exists

### 6. Gemini Embedding Model (DEFECT-006)
- **File:** `apps/api-gateway/src/ai/providers/router/gemini-router.provider.ts`
- **Before:** `embedding-001` → 404 error
- **After:** `text-embedding-004` → working

---

## Component Status

| Component | Loading | Empty | Error | Status |
|-----------|---------|-------|-------|--------|
| Dashboard | Skeleton cards | "Connect your first device" | Error boundary | ✅ |
| Device Health | Spinner | "No devices registered" | Inline error | ✅ |
| Device Detail | Spinner | "Device not found" | Back link | ✅ |
| AI Chat | Mounted check | "No devices registered" | ErrorBoundary | ✅ |
| Monitoring | Spinner | "No devices registered" | Inline error | ✅ |
| Cybersecurity | Loading text | "Select a device" | Inline error | ✅ |
| Network | Loading text | "No topology data" | Retry button | ✅ |
| Remote Support | Spinner | "No remote sessions" | Inline error | ✅ |
| Drivers | Spinner | "No drivers found" | Inline error | ✅ |
| Backup | Spinner | "No backup jobs" | Inline error | ✅ |
| Knowledge Base | Spinner | "No articles yet" | Inline error | ✅ |
| Reports | Skeleton cards | "No reports yet" | Retry button | ✅ |
| Billing | Spinner | (none) | Error banner | ✅ |
| Team | Skeleton cards | "No team members" | Error bar | ✅ |
| Settings | Skeleton rows | "No statistics" | Inline error | ✅ |

---

## White Screen Prevention

| Protection | Coverage |
|------------|----------|
| `error.tsx` | Dashboard, all sub-routes |
| `not-found.tsx` | Global |
| `loading.tsx` | All 12 dashboard routes |
| `ChatErrorBoundary` | AI Chat page |
| `ErrorBoundary` | Generic wrapper |
| `Suspense` | Next.js automatic |

---

## Build Status

| Check | Result |
|-------|--------|
| TypeScript typecheck (API) | ✅ PASS |
| TypeScript typecheck (Web) | ✅ PASS |
| Next.js build | ✅ PASS |
| Unit tests (AI) | ✅ 25/25 PASS |
| Unit tests (Devices) | ✅ 17/17 PASS |

---

## Report Path

`docs/AH-3/AH-3C.2D_FRONTEND_RUNTIME.md`

---

## Status

**FRONTEND RUNTIME: FIXED** — Onboarding detection, fleet scores, device dropdown, error states, and loading states all verified and corrected.

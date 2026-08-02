# AH-3R.1A — Device Detail Route Crash Fix

## Confirmed Root Cause

The Device Detail page at `/dashboard/device-health/[id]` used `React.use()` to unwrap a `Promise<{ id: string }>` params prop:

```tsx
export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
```

`React.use()` is a **React 19 API**. The project runs **React 18.3.1** with **Next.js 14.2.x**. Passing a plain object (the actual runtime value of `params` in React 18) to `React.use()` causes the runtime error:

> An unsupported type was passed to use(): [object Object]

## Chosen Compatible Approach

**Option A — `useParams()` from `next/navigation`.**

This is the correct pattern for reading dynamic route segments in a `'use client'` component under Next.js 14 / React 18.

## Why React.use() Was Invalid

- `React.use()` was introduced in React 19 to unwrap promises in server components and client components.
- React 18 does not export `use` from the `react` package.
- Next.js 14 with React 18 passes `params` as a plain object `{ id: string }`, not a Promise.
- Calling `React.use()` on a plain object in React 18 throws the observed runtime error.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/app/dashboard/device-health/[id]/page.tsx` | Replaced `use(params)` with `useParams()` from `next/navigation`; removed `use` from React imports; added safe ID extraction |
| `apps/web/src/__tests__/device-detail-page.spec.tsx` | New test file — 15 focused tests covering route param handling, loading/not-found/content states, WebSocket integration, and contract preservation |

## Page Signature Change

**Before:**
```tsx
import { use, useCallback, useState } from 'react';
export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
```

**After:**
```tsx
import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
```

## Route ID Handling

- `useParams()` returns `{ id: string } | undefined` depending on route context.
- `typeof params?.id === 'string'` guards against `undefined`, `null`, `number`, or any non-string param.
- Falls back to empty string `''`, which `useDevice('')` handles gracefully (returns early with `loading: true, device: null`).
- No silent redirects. Existing not-found UI renders when `device` is null and `loading` is false.

## useDevice Integration

`useDevice(id: string | undefined)` accepts the string ID directly. No changes to the hook were required. The hook already guards against empty/falsy IDs internally.

## Invalid ID Behavior

| Scenario | Params Value | ID Extracted | Page Behavior |
|----------|-------------|-------------|---------------|
| Valid route | `{ id: 'dev-123' }` | `'dev-123'` | Fetches and renders device |
| Missing ID | `{}` | `''` | Loading state → not-found |
| `undefined` ID | `{ id: undefined }` | `''` | Loading state → not-found |
| `null` ID | `{ id: null }` | `''` | Loading state → not-found |
| Non-string ID | `{ id: 12345 }` | `''` | Loading state → not-found |

## Tests

**15 tests across 5 describe blocks:**

1. **Route param handling (7 tests)**
   - Valid ID read from useParams
   - useDevice receives correct ID
   - No React.use() call
   - Missing ID does not crash
   - Undefined ID does not crash
   - Null ID does not crash
   - Non-string ID does not crash

2. **Loading state (1 test)** — loading + no device renders spinner

3. **Not found state (1 test)** — not loading + no device renders not-found UI

4. **Device content rendering (4 tests)**
   - Device name and online status
   - Score gauges and pills
   - Metrics chart area
   - No-data message for empty metrics

5. **WebSocket integration (1 test)** — callback passed to useWebSocket

6. **No backend contract changes (1 test)** — useDevice called with exactly one string

## Web Typecheck

```
No typecheck errors in changed files
```

Pre-existing typecheck errors exist in `ScheduledReportsSection.spec.tsx` and `report-schedule-status.spec.ts` (unrelated `ReportScheduleStatus` import issues). These were not introduced by AH-3R.1A.

## Web Build

```
Route (app)                              Size     First Load JS
├ ƒ /dashboard/device-health/[id]        9.25 kB         248 kB
```

Build completes successfully. The dynamic route compiles as expected.

## Manual Validation Steps

1. Start frontend (`pnpm dev` in `apps/web`) and backend.
2. Open `/dashboard/device-health` — confirm device list loads.
3. Click a real device — confirm detail page opens **without** runtime error.
4. Confirm device name, metrics, and scores render correctly.
5. Refresh the detail page directly (direct navigation) — confirm it loads.
6. Navigate to `/dashboard/device-health/invalid-id-12345` — confirm safe not-found behavior.
7. Open browser console — confirm no route-param errors.

**Note:** Manual runtime validation requires a running backend and real device data. These steps must be performed by the developer before final sign-off.

## Remaining Work (AH-3R.1B)

- Audit other routes for similar `React.use()` patterns (none found — this was the only instance).
- Consider adding a shared `useRouteParam` utility if more dynamic routes are added.
- Add E2E tests for the device detail route (requires backend).
- Address pre-existing typecheck errors in `ScheduledReportsSection.spec.tsx` and `report-schedule-status.spec.ts`.

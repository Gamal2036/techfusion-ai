# FIX-AUTH-LOGOUT-01 — Clean Logout Request Lifecycle

**Status:** ✅ COMPLETE (01 + 01A)
**Branch:** `fix/auth-logout-request-lifecycle`
**Date:** 2026-08-17
**Type:** Bug fix (race condition + spec-conformance)

## Amendment: FIX-AUTH-LOGOUT-01A — Repair Invalid Synthetic Response

The initial fix (01) returned `new Response(null, { status: 0, statusText: 'Logout in progress' })` from `apiFetch` when `_isLoggingOut` was true. This is **invalid per the Fetch specification** — the `Response` constructor throws `RangeError` for any status < 200. jsdom does not enforce this constraint, so all tests passed, but real browsers (Chromium, Firefox, Safari) would throw at runtime.

**Replacement contract:**
- `apiFetch` now `throw`s a typed `LogoutCancellationError` (exported class extending `Error`) instead of returning an invalid Response.
- Consumers (`useDashboardSummary`, `useCommandCenterData`) explicitly `catch (e) { if (e instanceof LogoutCancellationError) return; ... }` alongside their existing `isLoggingOut()` checks, as defense-in-depth.
- `LogoutCancellationError` is exported from `auth-client.ts` so all consumers can reference it for `instanceof` checks.

**Regression proof:** a strict `Response` shim in `logout-request-lifecycle.spec.ts` proves the original `new Response(null, { status: 0 })` was invalid (shim rejects status < 200). Additional tests verify: TEST 6 — `apiFetch` throws during logout; TEST 14 — no `console.error` during logout; TEST 15 — no `JSON.parse` call on the error path; TEST 16 — the error is catchable; REGRESSION — status-0 Response is invalid.

**Updated files:**
- `apps/web/src/lib/auth-client.ts` — Added `LogoutCancellationError` class; `apiFetch` throws it.
- `apps/web/src/hooks/useDashboardSummary.ts` — `LogoutCancellationError` catch for explicit suppression.
- `apps/web/src/hooks/useCommandCenterData.ts` — Same pattern.
- `apps/web/src/__tests__/logout-request-lifecycle.spec.ts` — Updated tests for throw behavior + regression.
- 16 existing test files — Updated `jest.mock('@/lib/auth-client')` to include `...jest.requireActual('@/lib/auth-client')` so `LogoutCancellationError` is available for `instanceof` checks.

**Updated test results:**
| Suite | Result |
|-------|--------|
| Focused logout tests | 27/27 PASS |
| Full web test suite | 43 suites, 923 tests — ALL PASS |
| Lint | ✔ PASS |
| Build | ✔ PASS |
| V1 Gate | ✔ 19/19 PASS |

## Problem

Users saw **"Failed to fetch dashboard summary"** console errors during logout, plus a **favicon404** in browser devtools.

## Root Cause

Race condition between `clearTokens()` and `window.location.href = '/login'` in `logout()`:
- 30s `useSessionGuard` interval or 15s `useDashboardSummary` poll could fire **after** tokens were cleared but **before** the page reload
- In-flight `apiFetch` → 401 → `refreshSession()` → `invalidateSession()` → `redirectToLogin()` → duplicate redirects + console.error

## Fix

Module-level `_isLoggingOut` flag in `auth-client.ts`, set first in `logout()`, checked by all 5 authenticated consumers:

1. `refreshSession()` → returns `'invalid'` early
2. `apiFetch()` → `throw`s `LogoutCancellationError` early (typed, catchable, no invalid Response)
3. `useSessionGuard.checkSession()` → returns early
4. `useDashboardSummary` → skips fetch, error handling, success path, and scheduling; catches `LogoutCancellationError` as defense-in-depth
5. `useCommandCenterData.fetchActiveBackupRuns` → skips fetch and error handling; catches `LogoutCancellationError` as defense-in-depth

**Favicon 404:** Created minimal valid `apps/web/public/favicon.ico` (1×1 32-bit ICO, 30 bytes).

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/lib/auth-client.ts` | `_isLoggingOut` flag, `isLoggingOut()` export, `LogoutCancellationError` class, guards in `logout()`, `refreshSession()`, `apiFetch()` |
| `apps/web/src/hooks/useSessionGuard.ts` | `isLoggingOut()` guard at top of `checkSession()` |
| `apps/web/src/hooks/useDashboardSummary.ts` | `isLoggingOut()` guards in fetch, error handler, success path, scheduling; `LogoutCancellationError` catch |
| `apps/web/src/hooks/useCommandCenterData.ts` | `isLoggingOut()` guards in backup polling and error handler; `LogoutCancellationError` catch |
| `apps/web/public/favicon.ico` | Created minimal valid ICO file |
| `apps/web/src/__tests__/logout-request-lifecycle.spec.ts` | Regression test file (27 tests incl. throw/strict-Response/catchability proofs) |
| 16 existing test files | Added `...jest.requireActual('@/lib/auth-client')` to `jest.mock` for `LogoutCancellationError` availability |

## Test Results

| Suite | Result |
|-------|--------|
| Focused logout tests | 27/27 PASS |
| Full web test suite | 43 suites, 923 tests — ALL PASS |
| Lint | ✔ PASS |
| Build | ✔ PASS |
| API/Worker/Agent tests | ✔ ALL PASS |
| V1 Gate | ✔ 19/19 PASS |

## Decisions

- **`_isLoggingOut` flag over AbortController:** Module-level flag is simpler, covers all consumers without per-call abort wiring, and is safe because `logout()` is a terminal operation.
- **`apiFetch` throws `LogoutCancellationError`:** The Fetch spec requires `Response` status >= 200; `status: 0` throws `RangeError` in conforming browsers. A typed error is both spec-correct and type-safe — callers use `instanceof` to suppress it.
- **Defense-in-depth catch pattern:** `useDashboardSummary` and `useCommandCenterData` catch `LogoutCancellationError` explicitly alongside `isLoggingOut()` checks, so even a skipped guard never reaches `console.error` or `JSON.parse`.
- **Guard `res.ok` success path:** Late successful responses after logout must not restore stale state.

## Known Limitations

- No session revocation on server (server session persists until TTL). Addressed by future ACC-SEC-02D2B.
- No password change UI yet.
- `isLoggingOut()` is a module-level export — not an abstraction boundary. This is acceptable given the stable, small consumer set.

## Lessons Learned

- Page reload (`window.location.href`) creates a timing window where in-flight fetches can trigger error handlers before the page unloads.
- Guarding the success path (`res.ok`) is as important as guarding the error path when stopping late responses.

# AH-2A.2 — Authentication & Session Recovery

## Summary

Repaired and stabilized the authentication and session flow across Backend and Frontend. Created a centralized frontend authentication layer with automatic token refresh, fixed logout to use centralized API URL, enforced MFA during login, added role-aware sidebar filtering, and improved dashboard route protection. Added 19 frontend tests and structured backend auth tests.

## Verified Problems

| # | Problem | Status |
|---|---------|--------|
| 1 | Frontend stores `refreshToken` but never uses it | FIXED |
| 2 | No centralized API client or 401 handling | FIXED |
| 3 | Expired access tokens cause requests to fail without attempting refresh | FIXED |
| 4 | Authentication headers duplicated across many hooks and pages | FIXED |
| 5 | Dashboard route protection is client-side only | IMPROVED |
| 6 | Logout uses hardcoded localhost API URL | FIXED |
| 7 | MFA enrollment exists but is not enforced during login | FIXED |
| 8 | Frontend roles displayed but protected actions not consistently hidden/blocked | FIXED |

## Architecture Preserved

- JWT access tokens (15-minute expiry) signed with `JWT_SECRET`
- Opaque refresh tokens stored in database with 7-day expiry
- Refresh token rotation (old token revoked, new token issued)
- Global `CombinedAuthGuard` with `@Public()` decorator pattern
- `localStorage` token storage (not migrated to cookies)
- Existing MFA enrollment/verification endpoints unchanged
- All existing guards, interceptors, and middleware pipeline unchanged

## Files Modified

### Backend
- `apps/api-gateway/src/auth/auth.service.ts` — Added `verifyLoginMfa()` method, modified `login()` to return `{ mfaRequired: true, userId }` when MFA enabled
- `apps/api-gateway/src/auth/auth.controller.ts` — Added `POST /auth/verify-login` public endpoint for MFA verification during login

### Frontend — New Files
- `apps/web/src/lib/auth-client.ts` — Centralized auth client (API URL, token CRUD, auth headers, JWT decode, `apiFetch` with 401 refresh, logout, role helpers)
- `apps/web/src/__tests__/auth-client.spec.ts` — 19 tests for auth client
- `apps/web/jest.config.js` — Jest config with jsdom environment
- `apps/web/jest.setup.js` — Response polyfill for jsdom
- `apps/api-gateway/test/auth.spec.ts` — Backend auth integration tests

### Frontend — Modified Files
- `apps/web/src/hooks/useDevices.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useAlerts.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useReports.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useKb.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useBackups.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useRemoteSupport.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useInventory.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useNetwork.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useSecurity.ts` — Uses `apiFetch` from auth client
- `apps/web/src/hooks/useAiChat.ts` — Uses `apiFetch` from auth client
- `apps/web/src/app/login/page.tsx` — Uses `setTokens` from auth client, added MFA challenge UI
- `apps/web/src/app/signup/page.tsx` — Uses `setTokens` from auth client
- `apps/web/src/app/dashboard/layout.tsx` — Uses `getCurrentUser`/`isAuthenticated` from auth client, added periodic auth validation, fixed `user` type from `any` to `JwtPayload`
- `apps/web/src/app/dashboard/page.tsx` — Uses `apiFetch` from auth client
- `apps/web/src/app/dashboard/settings/page.tsx` — Uses `apiFetch` from auth client
- `apps/web/src/app/dashboard/team/page.tsx` — Uses `apiFetch` from auth client
- `apps/web/src/app/dashboard/backup/page.tsx` — Uses `apiFetch` from auth client
- `apps/web/src/app/dashboard/monitoring/page.tsx` — Uses `apiFetch` from auth client
- `apps/web/src/app/dashboard/device-health/page.tsx` — Uses `apiFetch` from auth client
- `apps/web/src/components/Topbar.tsx` — Uses `logout()` from auth client (removed hardcoded `localhost:3001`)
- `apps/web/src/components/Sidebar.tsx` — Added role-based nav filtering (Billing/Team hidden for Viewers)
- `apps/web/package.json` — Added jest, ts-jest, @types/jest, jest-environment-jsdom devDependencies and `test` script

## Central Authentication Layer

Created `apps/web/src/lib/auth-client.ts` providing:

- `getApiUrl()` — Base URL from `NEXT_PUBLIC_API_URL`
- `getAccessToken()` / `getRefreshToken()` — Token retrieval from localStorage
- `setTokens(access, refresh)` / `clearTokens()` — Token storage management
- `getAuthHeaders()` — Auth header generation with Bearer token
- `decodeJwt(token)` — JWT payload decoding
- `getCurrentUser()` — Current user from JWT payload
- `isAuthenticated()` — Token existence and expiry check
- `apiFetch(path, options)` — Authenticated fetch with automatic 401 handling
- `refreshSession()` — Token refresh with shared promise lock
- `logout()` — Backend logout + local cleanup + redirect
- `canAccess(user, roles)` / `isOwner()` / `isAdminOrAbove()` / `isTechnicianOrAbove()` — Role checks

All 20+ duplicated `getAuthHeaders()` and `API_URL` definitions across hooks and pages replaced with imports from this module.

## Token Refresh Flow

1. `apiFetch()` sends request with current access token
2. If backend returns 401 and refresh token exists:
   - Calls `refreshSession()` which uses a shared `refreshPromise` (singleton pattern)
   - Only one refresh request fires even if multiple concurrent 401s occur
3. If refresh succeeds:
   - Stores new access + refresh tokens
   - Retries original request once
4. If refresh fails:
   - Clears all tokens from localStorage
   - Redirects to `/login`
5. Auth endpoints (`/auth/login`, `/auth/refresh`) are NOT retried to prevent infinite loops

## MFA Login Flow

### Backend
- `POST /auth/login` now checks `user.isMfaEnabled`
- If MFA enabled: returns `{ mfaRequired: true, userId }` (no tokens issued)
- If MFA not enabled: returns full tokens as before
- New `POST /auth/verify-login` (public, rate-limited) accepts `{ userId, token }`, verifies TOTP, returns full tokens

### Frontend
- Login page detects `mfaRequired` response
- Shows MFA code input field (6-digit TOTP)
- Calls `POST /auth/verify-login` with userId and code
- On success: stores tokens and redirects to dashboard
- On failure: shows error, allows retry

## Route Protection

### Dashboard Layout (`dashboard/layout.tsx`)
- Uses `getCurrentUser()` and `isAuthenticated()` from centralized auth client
- Renders nothing (`return null`) until auth check completes — prevents content flash
- Periodic auth validation every 30 seconds (redirects to `/login` if token expires)
- No false server-side protection — all auth checks are client-side

### Security Limitation (documented)
- Tokens stored in `localStorage` are not accessible to Next.js Middleware (server-side)
- Dashboard protection is client-side only: an attacker with server access could bypass it
- Backend `CombinedAuthGuard` remains the authoritative authorization layer

## Role-Aware UI Changes

- Sidebar filters "Billing" and "Team" navigation items for Owner/Admin only
- Role information comes from decoded JWT payload via `getCurrentUser()`
- Backend remains the final authorization authority
- No hiding of normal pages for any role — only restricted actions hidden

## Tests Added or Updated

### Frontend (19 tests, all passing)
```
Auth Client
  Token Storage
    ✓ stores and retrieves access token
    ✓ stores and retrieves refresh token
    ✓ clears all tokens
  Auth Headers
    ✓ includes Authorization header when token exists
    ✓ omits Authorization header when no token
  JWT Decoding
    ✓ decodes valid JWT payload
    ✓ returns null for invalid JWT
  isAuthenticated
    ✓ returns true for valid unexpired token
    ✓ returns false for expired token
    ✓ returns false when no token
  Role Helpers
    ✓ isOwner returns true for Owner role
    ✓ isAdminOrAbove returns true for Owner and Admin
    ✓ isTechnicianOrAbove returns true for Owner, Admin, Technician
    ✓ canAccess checks role array
  Token Refresh
    ✓ single refresh attempt on 401
    ✓ clears tokens when refresh fails
    ✓ shares refresh promise for concurrent 401s
  Logout
    ✓ clears local authentication state
    ✓ clears tokens even when backend logout fails
```

### Backend (structured, requires database)
Created `apps/api-gateway/test/auth.spec.ts` with tests for:
- Login without MFA succeeds
- Login with MFA enabled requires verification
- Correct MFA code completes authentication
- Incorrect MFA code is rejected
- Refresh token rotates successfully
- Reusing a revoked refresh token fails
- Expired refresh token is rejected
- Logout revokes all active refresh tokens
- Signup creates user and returns tokens
- Duplicate email signup is rejected

**Note:** Backend tests require PostgreSQL at `localhost:5433` and `STRIPE_SECRET_KEY` env var. Cannot run without database.

## Validation Results

| Command | Result |
|---------|--------|
| `pnpm run lint` (backend) | PASS |
| `pnpm run lint` (frontend) | PASS |
| `pnpm run build` (backend) | PASS |
| `pnpm run build` (frontend) | PASS |
| Frontend tests (19) | 19/19 PASS |
| Backend auth tests | Cannot run — no database available |

## Regression Results

- All existing pages build successfully with no TypeScript errors
- Login and Signup pages use centralized token storage
- Dashboard layout renders correctly with centralized auth checks
- All hooks use `apiFetch` for authenticated requests
- Token refresh interceptor is transparent to existing code
- No billing, AI, device agent, worker, or UI design changes

## Remaining Authentication Risks

1. **localStorage tokens are vulnerable to XSS** — Any XSS attack can steal tokens. Consider httpOnly cookies in a future stage.
2. **No CSRF protection** — Tokens in Authorization headers are not vulnerable to CSRF, but this depends on no cookie-based auth being added.
3. **No token binding** — Tokens are not bound to specific devices/browsers. A stolen token works from any client.
4. **MFA rate limiting** — The `/auth/verify-login` endpoint has basic rate limiting (10/60s) but no progressive delay or lockout.
5. **Backend integration tests cannot run** without database — The test environment requires PostgreSQL at `localhost:5433` with proper schema.
6. **No server-side route protection** — Next.js Middleware cannot read localStorage tokens. Dashboard routes are protected only client-side.

## Completion Decision

**AH-2A.2 COMPLETE**

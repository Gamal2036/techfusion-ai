# V1-STAGE-01B-R1 — Session Persistence & Automatic Token Refresh

**Stage:** V1-STAGE-01B-R1 (R1 for STAGE-01B)
**Priority:** P0 — Authentication Reliability / SaaS Session Stability
**Mode:** AUDIT → REPRODUCE → TRACE → FIX MINIMALLY → SINGLE-FLIGHT → RETRY → MULTI-ORG SAFETY → REGRESSION → MANUAL LONG-SESSION CERTIFICATION
**Status:** AUTOMATED CERTIFICATION COMPLETE — LONG-SESSION MANUAL TEST PENDING
**Date:** 2026-08-08

---

## 1. Executive Summary

A real-user issue caused the web app to redirect to `/login` while the user was
still inside the authenticated dashboard — repeatedly, and during the long
wait required for ONLINE → DEGRADED → OFFLINE presence certification. The
refresh session was still valid; the logout was premature.

Audit + reproduction isolated **two compounding frontend root causes** and two
minor hardening gaps:

1. **Primary (deterministic premature logout):** `apps/web/src/app/dashboard/layout.tsx`
   ran a 30-second interval that called `router.push('/login')` whenever
   `isAuthenticated()` returned false — i.e. purely when the access-token JWT
   `exp` (15 minutes) had passed. It **never attempted a refresh**. Because
   polling hooks pause when the tab is hidden, a backgrounded tab (the
   OFFLINE-wait scenario) lets the access token expire with no in-flight
   request to trigger the reactive 401→refresh; the throttled interval then
   boots the user. Even foregrounded, it raced the next poll's refresh.
2. **Secondary (outage destroys session):** `apiFetch` treated *any* refresh
   failure — including network errors, 5xx, and API restart — as session
   invalidation: it cleared tokens and hard-redirected to `/login`. A transient
   outage destroyed a valid session.
3. **Minor:** after a successful refresh, a second 401 on the retried request
   was silently returned, leaving a broken session without cleanup; a malformed
   refresh 2xx stored literal `"undefined"` strings.
4. **Minor (backend):** refresh rotation was not compare-and-swap; concurrent
   use of the same refresh token (e.g. two tabs) could mint two pairs.

All four were fixed minimally. The access token is renewed transparently through
a single-flight refresh with exactly-one retry; the session is only destroyed
on a definitively invalid refresh outcome; refresh rotation is now atomic. All
certified baselines are preserved and full regression passes.

---

## 2. Real-User Symptom

- User logs in successfully and stays on Dashboard / Device Health.
- Frontend polling continues normally.
- After some time the app unexpectedly redirects to `/login`.
- Occurred repeatedly, not just once.
- Interrupted the V1-STAGE-01B real-device wait for the 15-minute OFFLINE
  threshold (the tab is backgrounded during that wait).

Expected: expired access token → exactly one refresh → fresh access token →
original request retried → user stays on the same route → active organization
unchanged → polling continues. Only a truly invalid refresh session clears auth
state and redirects to login.

---

## 3. Auth Architecture Map

**Backend (`apps/api-gateway`):**

```
POST /auth/login        → bcrypt check → membership resolve → mint JWT (15m) + opaque refresh (7d)
POST /auth/signup       → creates org + user + membership (Owner) → mints pair
POST /auth/verify-login → MFA TOTP verify → mints pair
POST /auth/refresh      → validate opaque token → validate membership → CAS-revoke → mint new pair
POST /auth/logout       → revoke ALL live refresh tokens for the user (soft revoke)
POST /organizations/:id/switch → re-bind live refresh tokens to new org → mint new pair
```

- JWT: `jwt.sign({ sub, orgId, role }, JWT_SECRET, { expiresIn: '15m' })`
  (`src/auth/auth.service.ts:252-270`).
- Membership authoritative: every request re-resolves `OrganizationMember` from
  DB (`src/common/membership-auth.ts:50-67`); role/org claims in the JWT are
  snapshot data only. Org switch and removal take effect immediately.
- Rotation: opaque 96-hex token, single-use (presented token revoked on use).
- RefreshToken model: `token @unique`, `userId` (FK cascade), `orgId`,
  `expiresAt`, `revokedAt` (`prisma/schema.prisma:150-159`). No migration.

**Frontend (`apps/web`):**

```
LoginForm → POST /auth/login (raw fetch) → setTokens → router.push('/dashboard')
auth-client: apiFetch(path, opts) → Bearer from localStorage → 401 handling
  └→ refreshSession() (single-flight refreshPromise) → retry once
token persistence: localStorage keys "accessToken", "refreshToken"
user/org: decoded from the access-token JWT on demand (no separate storage)
org switch: org-client.switchToOrganization → setTokens(new pair) → ORG_SWITCH_EVENT → layout remounts
logout: POST /auth/logout (best effort) → disconnectAll → clearTokens → /login
```

Polling surfaces (`useDashboardSummary`, `useDevices`, `useCommandCenterData`,
`useBackups`, `useNetwork`, `useSecurity`, per-device loops) all go through
`apiFetch`, which reads the current token from `localStorage` on every call —
there were **no stale-token closures** (audited). WebSockets authenticate with
the access JWT at connect time only.

---

## 4. Access Token TTL

**15 minutes.** Hard-coded `expiresIn: '15m'` in `AuthService.generateTokens`
(`apps/api-gateway/src/auth/auth.service.ts:256`). Not env-configurable, and
intentionally **not extended** to hide the refresh bug.

## 5. Refresh Token TTL

**7 days.** `expiresAt = now + 7 * 24 * 60 * 60 * 1000`
(`apps/api-gateway/src/auth/auth.service.ts:265`). Not env-configurable.

- Refresh-token database expiry: same 7 days (`RefreshToken.expiresAt`).
- Inactivity timeout: none.
- Frontend timer/session timeout: none by design — the previous 30s
  `isAuthenticated()` redirect in the dashboard layout was the premature-logout
  bug, not a product timeout, and was removed.
- Cookie maxAge: N/A (no cookies are used; token storage is localStorage).

## 6. Token Storage

- Browser storage: `localStorage` keys `accessToken` and `refreshToken`
  (`apps/web/src/lib/auth-client.ts`). User and active org are derived from the
  access JWT on demand.
- Security note (documented, not re-architected this stage): localStorage is
  readable by any script executed in the origin (XSS would expose tokens). The
  existing architecture already mitigates CSRF (no cookies) and the refresh
  token is opaque/rotated. Migrating to HttpOnly cookies is out of scope for
  this bug fix (§23) and would be a separate stage.
- Server side: refresh token stored as plaintext opaque string in the
  `RefreshToken` table (unique). Soft-revoke via `revokedAt`.
- Never logged, displayed, or placed in query parameters.

## 7. Refresh Endpoint Contract

`POST /auth/refresh` — `@Public()`, throttled, body `{ refreshToken }`.

Server behavior (`src/auth/auth.service.ts:174-221` after fix):

1. Look up the opaque token; reject (401) if missing, revoked, or `expiresAt`
   passed.
2. Resolve the **authoritative membership** for `(user.id, token.orgId)`.
   - Missing membership → **revoke** the presented token and reject (401).
     This enforces membership removal and deleted-org cases without a hidden
     fallback to another org.
3. **Compare-and-swap revoke** — `updateMany({ id, revokedAt: null })`; if zero
   rows updated the token is already being rotated by a concurrent request →
   reject (401) instead of minting a duplicate pair.
4. Mint a fresh pair bound to the live membership org/role.

Response: `{ user, accessToken, refreshToken }`.

## 8. Root Cause

1. **`apps/web/src/app/dashboard/layout.tsx` (before: lines 65-73)** — a 30s
   `setInterval` redirected to `/login` whenever `isAuthenticated()` returned
   false, i.e. whenever the access JWT `exp` passed. No refresh was attempted.
   Combined with visibility-paused polling (hooks pause when hidden), a
   backgrounded tab lets the token expire (15m) with no poll to trigger the
   reactive 401→refresh; the throttled interval then redirects. This precisely
   explains the repeated logouts and the OFFLINE-wait interruption.
2. **`apps/web/src/lib/auth-client.ts` (before)** — `performRefresh` returned a
   boolean and classified every failure (network error, 5xx, API restart) the
   same as a genuinely revoked session; `apiFetch` then cleared tokens and hard
   redirected on any `false`. Transient outages destroyed valid sessions.
3. **`auth.service.ts`** — rotation was not atomic: concurrent use of the same
   refresh token could mint two pairs (multi-tab).

## 9. 401 Handling Before

- `apiFetch` on a protected-request 401 with a refresh token present:
  single-flight refresh (module-level `refreshPromise`) → on success retry once
  (result returned even if the retry 401s) → on failure `clearTokens()` +
  `window.location.href = '/login'` unconditionally (unless already on
  /login//signup).
- Layout: 30s interval → `isAuthenticated()` false → `router.push('/login')`
  with no refresh attempt (the primary bug).
- Login/MFA/signup used raw `fetch` (correctly not intercepted). Device tokens
  use a separate `device-token.guard`, unaffected.

## 10. Automatic Refresh Design

Refresh outcomes are now classified into three states
(`apps/web/src/lib/auth-client.ts`):

| Outcome | Meaning | Handling |
|---|---|---|
| `ok` | fresh pair stored | retry original request exactly once |
| `invalid` | refresh session definitively rejected (401/403 from /auth/refresh, other 4xx, malformed 2xx) | `invalidateSession()` (clear tokens + disconnect sockets) + redirect to /login |
| `unavailable` | transient (network error, 429, 5xx, API restart) | **preserve session**, return the original 401 to the caller; polling continues and the next cycle retries |

A protected-request 401 only ever escalates when the refresh session itself is
proven invalid. Access-token expiry alone never logs the user out.

## 11. Single-Flight Coordinator

`refreshSession()` keeps the existing module-level singleton:

```
if (refreshPromise) return refreshPromise;
refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
```

All concurrent 401s await the **same** promise — exactly one `POST /auth/refresh`
per browser session at a time. Test-proven for 2 and 5 simultaneous polling
401s (S1, S2, S3). With rotation enabled, the winner stores the fresh pair
before the promise resolves, so all waiters retry with the current token.

## 12. Request Retry

- On `ok`: retry the original request **once** with fresh headers (method, URL,
  body, content-type, org context preserved — only the `Authorization` header
  is rebuilt from the current token).
- If the retried request **also** returns 401 with a fresh token → the session
  is truly invalid → `invalidateSession()` + redirect (definitive failure, no
  infinite loop).
- No refresh-loop is possible: refresh is attempted at most once per `apiFetch`
  call.

## 13. Refresh Rotation

Rotation **exists** (single-use opaque tokens) and is **preserved**. It is now
a compare-and-swap (`updateMany({ id, revokedAt: null })`) so a token already
being rotated by a concurrent request can never mint a second pair — the loser
gets 401 instead of a duplicate. Client single-flight + atomic `setTokens`
order guarantees waiters read the post-rotation pair. Backend test proves
concurrent refresh of the same token yields exactly one success.

## 14. Multi-Organization Safety

- Server side unchanged: `refresh` resolves the **live** `OrganizationMember`
  for `(user.id, token.orgId)` and mints the new pair bound to that org/role —
  the active org is preserved, never silently swapped.
- Org switch re-binds live refresh tokens to the new org (`organizations.service.ts`)
  and mints a fresh pair; a subsequent refresh stays in the active org.
- Membership removal → refresh rejected and token revoked (no hidden fallback
  to another org). Tested: switch-then-refresh stays bound to the new org with
  the authoritative role; membership removal rejects refresh.

## 15. Polling Reliability

All polling hooks call `apiFetch`, which now participates in the refresh flow:
a poll 401 triggers the shared refresh and retries transparently; the route
stays mounted; polling resumes with the new token. No hook redirects to
/login directly (verified repo-wide — the only `/login` redirects are in
`layout.tsx` via the guard and `auth-client.ts`). No duplicate intervals, no
stale-token closures (headers are rebuilt from `localStorage` per request), no
runaway retries (exactly one refresh + one retry).

## 16. Hidden Tab Behavior

- Polling hooks pause when hidden (existing visibility handling).
- The new `useSessionGuard` interval continues to run in background tabs
  (browsers throttle it to roughly once per minute) and **renews the access
  token** when `exp` passes instead of redirecting.
- On return to a foregrounded tab, any request that 401s triggers the refresh
  via `apiFetch` regardless.
- Result: returning to a tab after access expiry refreshes transparently; no
  manual page reload required. This directly fixes the OFFLINE-wait
  interruption.

## 17. API Outage Behavior

- Refresh network error / 429 / 5xx → `unavailable` → session preserved, no
  redirect, no token clearing. Polling continues and retries the refresh on the
  next cycle.
- ECONNREFUSED / fetch failed / 502 / 503 / 504 during normal requests are
  returned as non-ok responses to callers; they are never classified as auth
  failures.
- Only an explicit auth failure (401/403 from the refresh endpoint, or a retried
  protected-request 401) invalidates the session. Tested: network-error and 5xx
  refresh failures preserve tokens.

## 18. Logout Behavior

Explicit logout (`logout()`) is unchanged and correct:
- `POST /auth/logout` revokes all live refresh tokens (best effort).
- Disconnects authenticated sockets.
- Clears both tokens and current user state.
- Redirects to `/login`.
- Explicit logout never triggers an automatic refresh. Tested (existing +
  backend): after logout, refresh returns 401 and protected access is gone.

## 19. Account Deletion Safety

Unchanged and preserved: account deletion hard-deletes the user (and cascades
refresh tokens via FK), so an old access token cannot restore the session and
an old refresh token cannot refresh. Backend test: deleted user → refresh 401.
Browser state is cleared on the client after deletion. Not weakened.

## 20. Membership Removal Safety

Authoritative membership is re-checked at refresh and on every request
(`resolveMembershipUser`). Removing a member from the active org revokes their
refresh tokens for that org and rejects refresh immediately (backend test
asserts the presented token is revoked on the membership-missing path). No
stale access is issued after removal.

## 21. WebSocket Authentication

Audited, left as-is (safe):
- Access JWT is validated only at socket handshake (`ws-auth.middleware.ts`),
  then `socket.data.user` is membership-authoritative.
- An open connection stays valid across access-token refresh (server does not
  re-validate mid-session).
- Reconnects read the **current** token via the `auth` callback
  (`socket-client.ts:28-36`).
- Org switch and logout already call `disconnectAll()`; `invalidateSession()`
  now also disconnects sockets on definitive session invalidation.
- No stale-token forced logout or reconnect failure identified; no transport
  redesign performed.

## 22. Security Assessment

- No token values are logged or displayed; diagnostics carry safe metadata only
  (§30).
- Refresh session validity requires: token exists, not expired, not revoked,
  user exists (FK cascade), membership exists, org exists, role resolved from
  authoritative membership — all verified server-side at refresh time.
- Single-flight is browser-session-local (not global), so no server-side
  bottleneck and no cross-user coupling.
- Known limitation: `localStorage` storage is XSS-readable (documented, not
  re-architected this stage). Multi-tab concurrent refresh from *two separate
  tabs* is not coordinated (single-flight is per tab); the new CAS rotation
  makes the loser fail closed (401) rather than mint duplicates — a logged-out
  second tab can re-login. Documented as a limitation; no hidden org switch.

## 23. Defects Found

1. Dashboard layout 30s interval redirected to /login purely on JWT expiry with
   no refresh attempt (deterministic premature logout, foreground race + hidden
   tab).
2. `apiFetch` treated transient refresh failures (network/5xx) as session
   invalidation → outage destroyed valid sessions.
3. Retried request 401 (after successful refresh) was silently returned; session
   left broken without cleanup.
4. Malformed refresh 2xx stored literal `"undefined"` tokens.
5. Backend rotation was not atomic (concurrent same-token refresh could mint two
   pairs).
6. `JWT_REFRESH_SECRET` env is required by validation but unused (refresh tokens
   are opaque, not signed) — dead config, left in place, documented.

## 24. Defects Fixed

1. Replaced the layout's expiry-boot with `useSessionGuard` — renews access
   transparently; only a definitively invalid refresh session redirects.
2. `apiFetch` now classifies refresh outcomes (`ok`/`invalid`/`unavailable`) and
   preserves the session on transient failures.
3. Retried-request 401 → `invalidateSession()` + redirect (definitive failure
   path, no loop).
4. Refresh response shape validated before persisting.
5. Backend rotation made compare-and-swap (`updateMany({ id, revokedAt: null })`);
   exactly one concurrent rotation succeeds.
6. Safe auth diagnostics added (CustomEvent + dev-only debug, no tokens).

## 25. Tests Added

- Backend: `apps/api-gateway/test/session-refresh.spec.ts` — **11 tests**.
- Frontend: `apps/web/src/__tests__/auth-client.spec.ts` (+7 tests) and new
  `apps/web/src/__tests__/use-session-guard.spec.tsx` (**6 tests**).
- Total targeted auth/session tests added: **24** (all passing).

## 26. Backend Tests

`test/session-refresh.spec.ts` (11/11):

- Refresh returns a fresh access token bound to the same org/user.
- Rotation chain: new token refreshes again; old token is dead.
- Session survives multiple access-token cycles (3 sequential refreshes, each
  access `exp` in the future, org constant).
- Role after refresh comes from the current membership (role changed before
  refresh).
- Membership removal rejects refresh and revokes the presented token.
- Deleted user cannot refresh.
- Switch-then-refresh stays bound to the active org with authoritative role.
- Expired refresh token rejected.
- Garbage refresh token rejected.
- Explicit logout revokes session; refresh rejected.
- Concurrent refresh of the same token → exactly one succeeds (CAS).

Existing auth/membership/account-deletion/security suites re-run and passing.

## 27. Frontend Tests

`auth-client.spec.ts` additions (7):
- Exactly one refresh for five simultaneous polling 401s (S1/S2/S3).
- Original request retried with the fresh token (header asserted) (R3/R4).
- Network-error refresh preserves the session (F5).
- 5xx refresh preserves the session (F5).
- Retried-request 401 clears the session (definitive failure).
- Malformed refresh response clears the session.
- No navigation attempted when already on /login (no redirect loop).

`use-session-guard.spec.tsx` (6):
- Valid token → active, no refresh.
- Expired token + valid refresh → active, transparent renewal.
- Expired token + invalid refresh → logged-out, tokens cleared.
- Expired token + transient refresh failure → active, session preserved.
- No token → logged-out.
- Session stays alive across repeated access-expiry cycles.

## 28. Long-Session Simulation

- Frontend: `use-session-guard` test drives repeated access-expiry cycles with a
  short interval and a re-expiring mock token — the guard refreshes on every
  cycle and never logs out.
- Backend: `session-refresh.spec.ts` runs 3 sequential refresh cycles, verifying
  each access token is future-dated and org-bound.
- Production TTLs were **not** changed for testing.

## 29. Full Regression

| Suite | Baseline | After | Status |
|---|---|---|---|
| API | 902/902 | **913/913** (+11 new) | PASS |
| Web | 777/777 | **790/790** (+13 new) | PASS |
| Lifecycle | 27/27 | 27/27 | PASS |
| Billing | 55/55 | 55/55 | PASS |
| Worker | 79/79 | 79/79 | PASS (unaffected) |
| Agent | 78/78 | 78/78 | PASS (unaffected) |
| API typecheck (`tsc --noEmit`) | — | PASS | PASS |
| Web typecheck (`tsc --noEmit`) | — | PASS | PASS |
| API build (`tsc`) | — | PASS | PASS |
| Web build (`next build`) | — | PASS | PASS |
| Migrations | NONE | NONE | PASS |

Zero regressions.

## 30. Files Modified

R1-scoped files (the working tree already carried prior-stage uncommitted
changes; R1 touched only the following):

1. `apps/api-gateway/src/auth/auth.service.ts` — CAS-safe refresh rotation.
2. `apps/web/src/lib/auth-client.ts` — refresh outcome classification,
   `invalidateSession()`, `apiFetch` retry/redirect semantics, safe auth
   diagnostics.
3. `apps/web/src/hooks/useSessionGuard.ts` — **new** session guard hook.
4. `apps/web/src/app/dashboard/layout.tsx` — replaced the premature-logout
   interval with `useSessionGuard`.
5. `apps/api-gateway/test/session-refresh.spec.ts` — **new** backend tests.
6. `apps/web/src/__tests__/auth-client.spec.ts` — added frontend tests.
7. `apps/web/src/__tests__/use-session-guard.spec.tsx` — **new** frontend tests.
8. `docs/v1/V1-STAGE-01B-R1_SESSION_PERSISTENCE_TOKEN_REFRESH_REPORT.md` — **new**.

## 31. Migrations

**NONE.** This was a pure auth/session-logic fix. No schema change was required
or performed.

## 32. Known Limitations

- `localStorage` token storage is XSS-readable (existing architecture,
  documented, not re-architected this stage).
- Multi-tab refresh is coordinated per tab only; the backend CAS makes a losing
  tab fail closed (401) instead of minting duplicates, and no hidden org switch
  is possible. A full cross-tab coordinator is future work.
- `JWT_REFRESH_SECRET` remains required-but-unused env (refresh tokens are
  opaque, not signed). Left untouched to avoid unnecessary churn.
- Expired/revoked `RefreshToken` rows are not swept by a cron (accumulate).
  Pre-existing; out of scope.

## 33. Manual Certification Procedure

Production TTLs are **not** modified for this test. Access TTL = 15 min, so each
cycle requires a ~15-minute wait.

**MANUAL SR-01** — Login normally, open Device Health. Record the current time.
Decode the access-token `exp` locally if desired (never display the token).

**MANUAL SR-02** — Leave the page open (foreground) longer than 15 minutes.
Dashboard/device polling must continue. **Expected: no redirect to /login.**

**MANUAL SR-03** — Verify a refresh occurred: dev console shows
`[auth] auth_refresh_started` / `auth_refresh_succeeded` (or a `techfusion:auth-event`
listener), user remains on the same Device Health route, active organization
unchanged, device page still updating.

**MANUAL SR-04** — Repeat one more access-expiry cycle if practical. The session
must survive multiple refresh cycles.

**MANUAL SR-05** — Explicit logout. **Expected:** login page; no silent
automatic re-login.

**MANUAL SR-06** — Login again and resume Presence certification: Agent OFFLINE
→ wait > 15 min (tab may be backgrounded). The session must remain alive long
enough to observe OFFLINE; the guard renews the token in the background.
Then Agent restart → ONLINE, without logging in again.

## 34. Final Automated Verdict

**AUTOMATED CERTIFICATION COMPLETE — LONG-SESSION MANUAL TEST PENDING**

The root cause was reproduced and fixed, all automated acceptance gates pass,
and the long-session (real-device presence) scenario now has an explicit manual
certification plan. Real-user certification of the 15-minute OFFLINE wait will
be completed via MANUAL SR-01..06 before V1-STAGE-01B resumes.

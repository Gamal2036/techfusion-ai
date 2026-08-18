# ACC-UX-02D3 — Password Change & Active Sessions UX

> Frontend implementation. **PUSHED: NO. PRODUCTION DEPLOYED: NO.**
> Branch: `feat/acc-ux-02d3-password-active-sessions`.
> Prior mission (unchanged): `ACC-SEC-02D2B` password change & active session management backend.

## 1. Objective

Implement production-ready frontend support for:

1. **Password change** — 3-field modal dialog (current password, new password, confirm new password), client-side validation aligned to backend contract (8–128 chars), typed error handling, token lifecycle management after password change (backend issues fresh token pair).
2. **Active sessions listing** — server-authoritative session list with current-session badge, revoke-one/revoke-others/revoke-current flows, loading/error/empty states, honest device/user-agent summarization.
3. **Security section integration** — replace the stub "Not available in this release" text in `SecuritySection` with real interactive `PasswordChangeDialog` + `ActiveSessions` controls.

## 2. Scope

- `apps/web/src/lib/security-client.ts` — new API client (changePassword, listSessions, revokeSession, revokeOtherSessions, revokeCurrentSession).
- `apps/web/src/hooks/useAccountSecurity.ts` — new hook managing sessions load/error/ready state.
- `apps/web/src/components/account/PasswordChangeDialog.tsx` — new 3-field dialog.
- `apps/web/src/components/account/ActiveSessions.tsx` — new session list + revoke dialogs.
- `apps/web/src/components/account/SecuritySection.tsx` — modified: replaced stubs with real components.
- `apps/web/src/__tests__/password-sessions-ux.spec.tsx` — new: 74 automated tests.
- `apps/web/src/__tests__/account-page.spec.tsx` — modified: mocks for new modules.
- `apps/web/src/__tests__/security-section.spec.tsx` — modified: mocks for new modules + icon mocks.

## 3. Evidence Markers

`VERIFIED_THIS_RUN` (this branch, local): 74-proof passing spec in `password-sessions-ux.spec.tsx`,
updated existing specs passing (`account-page.spec.tsx` 27 tests, `security-section.spec.tsx` 34 tests), full web suite 997 tests / 44 suites PASS,
`pnpm lint` + `pnpm build` green (all 7 packages), `git diff --check` clean, secret scan clean,
V1 gate 19/19 PASS.

## 4. API Routes Consumed

| Method | Path | Throttle | Auth | Description |
|--------|------|----------|------|-------------|
| `POST` | `/auth/change-password` | 20/60s | JWT | Change password with reauth |
| `GET` | `/auth/sessions` | 30/60s | JWT | List active sessions |
| `DELETE` | `/auth/sessions/:sessionId` | 10/60s | JWT | Revoke specific session |
| `DELETE` | `/auth/sessions` | 10/60s | JWT | Revoke all other sessions |
| `DELETE` | `/auth/sessions/current` | 10/60s | JWT | Revoke current session |

All five endpoints are implemented in the `ACC-SEC-02D2B` backend (verified, 30-proof spec).

## 5. Design Summary

### 5.1 Security Client (`security-client.ts`)

Typed API client wrapping `apiFetch` from `auth-client.ts`:

- `changePassword(currentPassword, newPassword)` — `POST /auth/change-password`, calls `setTokens()` to persist the fresh token pair returned by the backend.
- `listSessions()` — `GET /auth/sessions`, returns `Session[]` with typed fields.
- `revokeSession(sessionId)` — `DELETE /auth/sessions/:sessionId`.
- `revokeOtherSessions()` — `DELETE /auth/sessions`, returns `{ revokedCount }`.
- `revokeCurrentSession()` — `DELETE /auth/sessions/current`, calls `clearTokens()` + sets `window.location.href = '/login'`.

Error handling: typed error codes preserved from backend (400, 401, 403, 404, 409, 429, 5xx).

### 5.2 Sessions Hook (`useAccountSecurity.ts`)

State machine: `loading` → `ready` (with session data) | `error` (with message).

### 5.3 PasswordChangeDialog

3-field modal: current password, new password, confirm new password.

- Client-side validation: all fields required, new password 8–128 chars, new ≠ current, confirm matches new.
- Controlled error handling: every status code mapped to a user-facing message. Raw backend messages are never exposed.
- On success: `setTokens()` called (backend returns fresh pair), success message shown, fields cleared.

### 5.4 ActiveSessions

Session list with current-session identification.

- IP privacy: IPv4 addresses masked as `192.168.xxx.xxx` (first two octets visible, last two masked).
- Three revoke flows with controlled error messages for all failure modes.
- `actionError` state with dismissible error banner for revoke failures.

### 5.5 SecuritySection Integration

The `SecuritySection` component now imports and renders:
- `PasswordChangeDialog` with a "Change password" button in the password row.
- `ActiveSessions` below the MFA section.
- Loading spinner uses `motion-reduce:animate-none` for reduced-motion accessibility.

## 6. Security Properties

- No fabricated session data — all data comes from `GET /auth/sessions`.
- IP addresses masked: `192.168.xxx.xxx` format — preserves honest server-derived information while protecting full IP.
- No geographic location fabricated from IP — no third-party geolocation used.
- Current-session badge derived from server-authoritative `current` field (JWT `sid` claim).
- No token material returned by session API — verified `sessionId` only.
- `clearTokens()` + redirect on revoke-current — session fully invalidated client-side.
- `setTokens()` after password change — fresh token pair persisted immediately.
- All authenticated calls go through `apiFetch` with refresh rotation.
- No console.log/warn/error in any security-related code paths.
- Passwords and tokens are never logged or exposed in the DOM.

## 7. Interaction Gap Review (CERT-02D3)

### 7.1 Current Session Ordering

**Status: PASS**

Current session is always rendered first regardless of array order. The component extracts `sessions.find((s) => s.current)` and renders it before the sorted `otherSessions` list. Test: "current session is rendered first regardless of array order" with sessions provided in reverse order.

### 7.2 Duplicate Action Protection

**Status: PASS**

- **Password**: `submitting` state disables button and blocks Enter key during API call.
- **Revoke one**: `revokingId` state guard prevents re-entry.
- **Revoke others**: `revokingId` state guard prevents re-entry.
- **Revoke current**: `revokingId` state guard prevents re-entry.
- Tests prove each path calls the API exactly once even with rapid repeated interactions.

### 7.3 Explicit 429 User-Facing Handling

**Status: PASS**

Every operation maps 429 to a controlled message: "Too many attempts. Wait a moment before trying again."

| Operation | 429 Behavior |
|-----------|-------------|
| Password change | Shows controlled message, calls `onThrottled` callback |
| Revoke one | Closes dialog, shows controlled error banner |
| Revoke others | Closes dialog, shows controlled error banner |
| Revoke current | Closes dialog, shows controlled error banner |

### 7.4 Revoke-One 404 Handling

**Status: PASS**

On 404, the dialog closes and the session list is refreshed. No error is shown to the user (the session is already gone — this is the expected outcome). Test proves refresh is called and no error message appears.

### 7.5 Missing SID / Cannot-Determine-Current-Session

**Status: PASS**

When no session has `current: true`, the current-session block simply does not render. The revoke-current button is not shown. Other sessions render normally. The component does not crash. Tests verify both cases (single non-current session and multiple non-current sessions).

### 7.6 Revoke-Current Redirects to /login Exactly Once

**Status: PASS**

After `revokeCurrentSession()` succeeds: `clearTokens()` is called once, socket disconnect is attempted, `window.location.href = '/login'` is set once. The component does not re-execute this path after redirect begins because `revokingId` state blocks re-entry. Test proves `clearTokens` is called exactly once even after rerender.

### 7.7 Raw Backend Internal Messages Not Exposed

**Status: PASS**

PasswordChangeDialog maps every status code to a controlled message. The generic fallback is "Something went wrong. Please try again." — never `err.message`. Tests verify that `TypeError`, `Cannot read property`, and `stack` strings are never rendered.

### 7.8 Passwords and Tokens Never Logged

**Status: PASS**

No `console.log`, `console.warn`, or `console.error` calls exist in any security-related code (`security-client.ts`, `ActiveSessions.tsx`, `PasswordChangeDialog.tsx`, `useAccountSecurity.ts`). Tests verify that password values and token strings do not appear in console output.

### 7.9 Session IP Metadata — Privacy-Conscious Presentation

**Status: PASS**

IPv4 addresses are masked to `first-octet.second-octet.xxx.xxx` format (e.g., `192.168.xxx.xxx`). IPv6 addresses are masked to `group1:group2:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx`. No geographic information is fabricated. No third-party geolocation is used. Tests verify masked format and absence of location terms.

## 8. Error Normalization

### 8.1 Password Change Dialog

| Status | User-Facing Message |
|--------|-------------------|
| 400 | "The password you entered does not meet the requirements." |
| 401 | "The current password you entered is incorrect." |
| 409 | "A password change is already in progress. Please wait and try again." |
| 429 | "Too many attempts. Wait a moment before trying again." |
| 5xx | "Something went wrong on our end. Please try again later." |
| Network offline | "You appear to be offline. Check your connection and try again." |
| Other | "Something went wrong. Please try again." |

### 8.2 Active Sessions

| Operation | Error | User-Facing Message |
|-----------|-------|-------------------|
| Revoke one | 429 | "Too many attempts. Wait a moment before trying again." |
| Revoke one | Other | "Could not revoke this session. Please try again." |
| Revoke one | 404 | (dialog closes, list refreshed silently) |
| Revoke others | 429 | "Too many attempts. Wait a moment before trying again." |
| Revoke others | Other | "Could not sign out other sessions. Please try again." |
| Revoke current | 429 | "Too many attempts. Wait a moment before trying again." |
| Revoke current | Other | "Could not sign out of this session. Please try again." |

All error messages are dismissible via a "Dismiss" button.

## 9. Duplicate-Action Protection

**Password submit**: `submitting` state disables the submit button and Enter-key handler.
**Revoke one**: `revokingId === sessionId` guard; button shows loading spinner and is disabled.
**Revoke others**: `revokingId === '__others__'` guard; button shows loading spinner and is disabled.
**Revoke current**: `revokingId === '__current__'` guard; button shows loading spinner and is disabled.

## 10. Missing SID Behavior

When no session carries `current: true`:
- The "This device" section does not render.
- The "Sign out" button for the current session does not render.
- Other sessions display normally.
- The component does not crash or show an error.

## 11. Exact-One Redirect Proof

`handleRevokeCurrent` calls `window.location.href = '/login'` exactly once after:
1. `revokeCurrentSession()` succeeds
2. `clearTokens()` executes
3. Socket disconnect is attempted

The `revokingId` guard prevents any re-execution. Even if the component rerenders (test proves it), `clearTokens` is not called again.

## 12. Accessibility Certification

### 12.1 Dialog Keyboard Operation

- All dialogs (revoke-one, revoke-others, revoke-current, password change) are built on Radix UI Dialog primitive via `@techfusion/ui Modal`.
- Radix Dialog provides: focus trapping, Escape-to-close, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`.
- Password dialog supports Enter-to-submit via `onKeyDown` handler.
- Enter-to-submit is blocked during submission (`!submitting` guard).

### 12.2 Accessible Icon-Button Labels

- "Sign out this session" button: `aria-label="Sign out this session"`
- "Revoke session on [device]" button: `aria-label="Revoke session on {deviceName}"`
- Decorative icons (Globe, Monitor, Smartphone): `aria-hidden="true"`
- Loading state: `role="status"` with `aria-label="Loading sessions"`
- Modal close button: `<span className="sr-only">Close</span>` (from Radix Modal)

### 12.3 Reduced-Motion Support

- Loading spinner in SecuritySection: `animate-spin motion-reduce:animate-none`
- Modal animations handled by `tailwindcss-animate` plugin which provides automatic `@media (prefers-reduced-motion: reduce)` overrides for `animate-in`/`animate-out` classes.

## 13. Responsive Manual Certification

### 13.1 Structural Analysis (headless environment — no browser available)

| Pattern | Location | Purpose |
|---------|----------|---------|
| `min-w-0` | Session card inner divs | Prevents long text from overflowing |
| `flex-wrap` | Device name + badge row | Wraps on narrow screens |
| `flex-col gap-3 sm:flex-row` | Session card layout | Vertical stacking on mobile, horizontal on desktop |
| `flex-wrap gap-x-4 gap-y-0.5` | IP + timestamp row | Metadata wraps gracefully |
| `w-full max-w-lg` | Modal content | Fits inside any viewport width |
| `p-6` (Modal padding) | Modal content | Consistent spacing |

### 13.2 Viewport Assessment

- **Desktop widescreen** (≥1280px): Session cards render horizontally with device info left, action button right. Modal centered at max-width 512px.
- **Laptop** (1024px): Same layout, no overflow.
- **Tablet** (768px): Same horizontal layout within sm breakpoint. Metadata wraps.
- **Mobile** (375px): Session cards stack vertically (flex-col). Device name, IP, timestamps each on their own line. Modal fills width with padding.

### 13.3 Known Limitation

**Honest assessment**: Actual browser-based visual certification was NOT performed. The dev server could not start in this headless CLI environment. The structural analysis above is based on CSS class inspection and built output verification. The build succeeded, all responsive patterns are correct, but pixel-perfect visual verification requires a real browser.

## 14. Browser Console Certification

- No `console.log`, `console.warn`, or `console.error` calls in security-client.ts, ActiveSessions.tsx, PasswordChangeDialog.tsx, or useAccountSecurity.ts.
- Verified via grep — zero matches.
- `auth-client.ts` has `console.debug` in non-production only for auth events (not security operations).

## 15. Test Evidence

| Suite | Tests | Result |
|-------|-------|--------|
| `password-sessions-ux.spec.tsx` (certified) | 74 | PASS |
| `account-page.spec.tsx` (updated) | 27 | PASS |
| `security-section.spec.tsx` (updated) | 34 | PASS |
| Full web suite | 997 / 44 suites | PASS |
| `pnpm lint` | 7 packages | PASS (exit 0) |
| `pnpm build` | 7 packages | PASS (exit 0) |
| Secret scan | — | NO SECRETS DETECTED |
| `git diff --check` | — | CLEAN |
| V1 CI gate | 19/19 | PASS |

### 15.1 Certification Proof List (ACC-UX-02D3)

| # | Requirement | Test |
|---|------------|------|
| 1 | Current session rendered first | "current session is rendered first regardless of array order" |
| 2 | Rapid password submits call API once | "rapid password submits call the API exactly once" |
| 3 | Rapid revoke clicks call API once | "rapid revoke clicks call the API exactly once" |
| 4 | Password 429 controlled message | "password 429 displays controlled user-facing message" |
| 5 | Revoke-one 404 safe refresh | "handles 404 by closing dialog and refreshing without error" |
| 6 | Missing sid does not revoke all | "does not crash when no session is marked current" |
| 7 | Revoke-current clears tokens | "revokes current session, clears tokens, and attempts redirect" |
| 8 | Revoke-current redirects once | "redirects exactly once even if component re-renders" |
| 9 | No raw internal message rendered | "no raw internal backend message is ever rendered" |
| 10 | Sensitive values not logged | "password values are not written to console.log" + "tokens are not written to console.log" |
| 11 | Keyboard dialog operation | "password dialog submits on Enter key" + "does not submit when already submitting" |
| 12 | Accessible icon labels | "sign out current session button has accessible label" + "revoke other session button has accessible label with device name" + "decorative device and IP icons have aria-hidden" + "loading state has role=status" |
| 13 | Privacy-conscious IP rendering | "masks IPv4 addresses showing only first two octets" + "does not fabricate geographic location from IP" |

## 16. What Was NOT Built (deliberately)

- Forgot/reset password flow (DEFER — requires email infrastructure).
- Password strength meter beyond backend policy (8–128 chars only).
- Session activity timeline / login history (no backend support).
- Device trust / "remember this device" (no backend support).
- Concurrent session limit (no backend support).
- Session geolocation display (no backend IP geolocation service).

## 17. Remaining Risks

1. **jsdom `window.location` limitation** — `window.location.href = '/login'` throws "Not implemented" in jsdom. Tests verify `clearTokens()` + API call instead of URL assertion. No runtime impact.
2. **IP masking is visual only** — Full IP is still transmitted by the backend. Masking is a UI-level privacy measure.
3. **Strict throttling** — password change (20/60s), session operations (10/60s). UX not degraded since these are infrequent operations.
4. **No live visual certification** — Headless CLI environment prevented browser-based visual inspection. Structural CSS analysis was performed instead.

## 18. Document Updates

- `docs/tech-lead/00_CURRENT_STATE.md` — headline finding 19, test evidence.
- `docs/tech-lead/03_WEB_SURFACE_MAP.md` — security-client + useAccountSecurity in hooks inventory.
- `docs/tech-lead/08_FEATURE_READINESS_MATRIX.md` — Authentication row updated, account profile row updated.
- `docs/tech-lead/10_TECHNICAL_DEBT_REGISTER.md` — T25 annotation: password/sessions UI complete.
- `docs/tech-lead/14_DECISION_LOG.md` — D37.

## 19. Commit

Single commit, amended: `feat(account): add professional password and session management UX`
(local only; **PUSHED: NO; PRODUCTION DEPLOYED: NO**).

## 20. Recommended Next Stage

Account page remaining deferred capabilities: email verification status, avatar/profile photo, last-login display (requires backend `User` model changes — no `emailVerifiedAt`, `avatarUrl`, `lastLoginAt` fields exist).

# ACC-UX-02E2B-FE — Password Recovery Frontend

> Frontend implementation. **PUSHED: NO. PRODUCTION DEPLOYED: NO.**
> Branch: `feat/acc-ux-02e2b-fe-password-recovery`.
> Backend (unchanged): `ACC-SEC-02E2B` password reset backend lifecycle (merged into this branch).
> Email infrastructure (unchanged): `ACC-SEC-02E2A` transactional email foundation.

## 1. Objective

Implement production-ready frontend for the self-service password recovery flow:

1. **Forgot Password page** (`/forgot-password`) — email input form, enumeration-resistant generic success message ("If an account exists with that email, you'll receive a reset link"), loading and error states.
2. **Reset Password page** (`/reset-password?token=<token>`) — new password + confirm fields, show/hide toggle, 8–128 char validation aligned to backend `ResetPasswordDto`, token read from URL query string (never rendered, logged, or stored), success state with session revocation notice, invalid/expired/used/malformed token error state (all share one UI), missing token state.
3. **Login integration** — "Forgot password?" link added to `LoginForm.tsx` between the Sign in button and Sign up link, routing to `/forgot-password`.
4. **Shared layout** — `AuthShell` component reusing existing `AuthEnvironment`, `AuthBrandPanel`, `AuthLogo` for visual consistency with login/signup pages.

## 2. Scope

### New files

| File | Description |
|------|-------------|
| `apps/web/src/lib/recovery-client.ts` | Typed API client: `requestPasswordReset(email)`, `resetPassword(token, newPassword)`, error types (`RecoveryError` with `kind`), network/rate-limit error handling |
| `apps/web/src/components/auth/AuthShell.tsx` | Shared auth page layout shell (brand panel, logo, environment, decorative borders) |
| `apps/web/src/components/forgot-password/ForgotPasswordForm.tsx` | Forgot password form component |
| `apps/web/src/app/forgot-password/page.tsx` | Forgot password route page |
| `apps/web/src/components/reset-password/ResetPasswordForm.tsx` | Reset password form component |
| `apps/web/src/app/reset-password/page.tsx` | Reset password route page |
| `apps/web/src/__tests__/forgot-password-page.spec.tsx` | 26-proof test suite |
| `apps/web/src/__tests__/reset-password-page.spec.tsx` | 35-proof test suite |
| `apps/web/src/__tests__/recovery-client.spec.ts` | 11-proof contract test suite |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/components/login/LoginForm.tsx` | Added "Forgot password?" link (Sign in button → Forgot password link → Sign up link) |
| `apps/web/src/components/auth/AuthLogo.tsx` | Removed unused `Link` import |
| `apps/web/src/__tests__/login-page.spec.tsx` | Replaced "does not add Forgot Password" test with 3 tests asserting Forgot Password link exists and routes to `/forgot-password` |
| `apps/api-gateway/src/mail/__tests__/mail.spec.ts` | Updated LOGIN_GUARD test: now asserts link points to `/forgot-password` and does not inject a new backend route |

## 3. Evidence Markers

`VERIFIED_THIS_RUN` (this branch, local):
- `forgot-password-page.spec.tsx`: 26/26 PASS
- `reset-password-page.spec.tsx`: 35/35 PASS
- `recovery-client.spec.ts`: 11/11 PASS
- `login-page.spec.tsx`: 38/38 PASS (updated tests)
- Full web suite: **1070/1070 PASS (47 suites)**
- API suite: **1210/1210 PASS (67 suites)** (includes updated `mail.spec.ts` guardrail)
- `pnpm lint`: 7/7 PASS
- `pnpm build --filter=@techfusion/web`: PASS
- `scripts/ci-v1-gate.sh`: 19/19 PASS (Docker-dependent steps deferred to operator)

## 4. API Routes Consumed

| Method | Path | Throttle | Auth | Description |
|--------|------|----------|------|-------------|
| `POST` | `/auth/forgot-password` | 3/300s (fingerprint: SHA-256 of email) | public | Request password reset email; always returns 200 with generic message (enumeration-resistant) |
| `POST` | `/auth/reset-password` | 5/300s (fingerprint: SHA-256 of token) | public (token) | Reset password with token; 200 success or 400 for invalid/expired token |

## 5. Security Design

- **Enumeration resistance**: `POST /auth/forgot-password` returns the same HTTP 200 + generic message for existing and unknown accounts. The UI renders identical success states for both.
- **Token handling**: token is read from `window.location.search` via `useEffect` on mount. It is never rendered in the DOM, never stored in `localStorage`/`sessionStorage`/cookies, never logged. On success, `window.history.replaceState` cleans the URL history.
- **Token error unification**: expired, invalid, used, superseded, and malformed tokens all display the same "Reset link expired" UI with a "Request a new reset link" action. No information about the specific failure mode is exposed.
- **Password policy**: client-side validation enforces 8–128 characters (matching `ResetPasswordDto` backend constraints). No invented strength scoring.
- **No automatic sign-in after reset**: success state shows a confirmation with "Back to sign in" link only. The backend revokes all sessions on reset.
- **Session revocation notice**: success state informs the user that existing sessions have been signed out.

## 6. Test Coverage

### `forgot-password-page.spec.tsx` (26 tests)

- Renders email input, submit button, branding
- Validates empty email, invalid email format
- Submits `POST /auth/forgot-password` with normalized email body
- Shows generic success message for 200 response
- Shows error state for network failure, 429 rate limit, other errors
- Does not reveal whether the account exists
- Loading state disables form, announces via `aria-busy`
- Keyboard navigation reaches all controls
- Back to sign in link present

### `reset-password-page.spec.tsx` (35 tests)

- Missing token → invalid-link state with request-new-link action
- Token present → renders form (password + confirm fields, toggle buttons, policy guidance, submit button)
- Token not rendered visually, not in localStorage/sessionStorage
- Validation: empty password, short password, empty confirm, mismatch, valid passwords accepted
- Validation errors announced via `role="alert"`
- API interaction: correct `POST /auth/reset-password` body, prevents duplicate submission, shows success, success removes form from DOM, success informs about session revocation, success does not auto-authenticate, success has return-to-login link
- Invalid/expired token → same `invalid_token` UI state with request-new-link action
- Rate limit, network failure, generic error handling
- Contract test matches backend DTO
- Accessibility: `aria-busy` loading state, keyboard navigation

### `recovery-client.spec.ts` (11 tests)

- `requestPasswordReset`: sends normalized email, trims/lowercases, throws `rate_limited` on 429, throws `network` on fetch failure, throws `server` on non-200
- `resetPassword`: sends token + newPassword, throws `invalid_token` on 400 with expired message, throws `rate_limited` on 429, throws `network` on fetch failure, throws `server` on unexpected error, returns ok on success

### `login-page.spec.tsx` (38 tests — updated)

- 3 new tests asserting Forgot Password link exists and routes to `/forgot-password`
- 1 test replacing the previous "does not add Forgot Password" assertion

## 7. Decisions

- **Shared `AuthShell` component**: both forgot and reset pages use `AuthShell` with `AuthBrandPanel variant="login"` for visual consistency with login/signup.
- **No automatic sign-in after reset**: success state shows confirmation with "Return to sign in" link only — backend revokes all sessions, forcing fresh authentication.
- **Password requirements**: real-time guidance shows "8–128 characters" matching backend's `MinLength(8)` `MaxLength(128)` — no invented strength scoring.
- **`window.history.replaceState` for URL cleanup**: jsdom prevents `Object.defineProperty(window, 'location', ...)`. Used `replaceState` + `useEffect` reading `window.location.search` at mount.
- **`document.querySelector` for password inputs in tests**: `getByLabelText(/confirm password/i)` matched both label and input elements in jsdom causing "Found multiple elements" errors. Created `getPasswordInput(name)` helper.
- **Guardrail test updated**: `src/mail/__tests__/mail.spec.ts` LOGIN_GUARD test now asserts the link routes to `/forgot-password` (not a new backend route) instead of asserting no `forgot-password` reference.

## 8. Production Certification

**PENDING** — operator manual Vercel/Railway gate required before production deployment.

Pre-requisites:
- Backend `ACC-SEC-02E2B` deployed (password reset endpoints, `PasswordResetToken` model)
- Email infrastructure `ACC-SEC-02E2A` deployed with `MAIL_ENABLED=true` and valid SMTP configuration
- Manual end-to-end test: request reset email → receive email → click link → reset password → sign in with new password

## 9. Residual / Deferred

- **Email delivery**: `MAIL_ENABLED=false` in production — real emails not yet sent. The frontend works end-to-end but the "reset link" in the email must be configured with the correct `WEB_APP_URL` and the email template must include the reset URL.
- **Email verification**: not in scope (T34).
- **Email change**: not in scope (T36).
- **Password strength indicator**: current UI shows "8–128 characters" only; a stronger visual strength meter is a future enhancement.

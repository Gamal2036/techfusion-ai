# ACC-UX-02C — Interactive Account Security Experience

> **Type:** Implementation + verification report
> **Date:** 2026-08-16
> **Branch:** `feat/acc-ux-02c-interactive-account-security`
> **Scope:** Interactive Account Security UX in `apps/web` on top of the merged
> ACC-SEC-02B1/B2 backend: MFA enrollment, one-time recovery-code display,
> regeneration, disable, and recovery-mode login. Profile/Organization/Danger
> Zone refinements included where they close stated ACC-UX-02C gaps.
> **Evidence standard:** `docs/tech-lead/README.md` markers (`VERIFIED_THIS_RUN`,
> `VERIFIED_BY_CURRENT_CI`, `INFERRED_FROM_CODE`, `UNVERIFIED`). No production
> certification claim is made before the operator manual gate in §8.

---

## 1. Executive summary

The account security surface on `/dashboard/settings/account` is now fully
interactive against the verified backend, with **no fabricated data and no
secret material persisted or logged client-side**.

Verified outcomes of this stage:

- **MFA enrollment** (`components/account/mfa/MfaEnrollmentDialog.tsx`): intro →
  setup (QR from backend `qrCode` data URL, masked setup key with reveal/copy) →
  verify TOTP (`POST /mfa/verify`) → success chain into recovery-code generation.
- **One-time recovery codes** (`RecoveryCodesDialog.tsx` + `OneTimeCodes.tsx`):
  password + TOTP challenge before generate/regenerate; codes rendered exactly
  once from the backend response; per-code and copy-all affordances; never
  stored in the client.
- **MFA disable** (`DisableMfaDialog.tsx`): requires password AND TOTP **or**
  an unused recovery code — exactly one second factor is ever sent.
- **Security section state machine** (`SecuritySection.tsx`): status from the
  authoritative `GET /mfa/status` + `GET /mfa/recovery-codes/status`; enroll /
  disable / generate / regenerate / copy affordances; loading / error+retry
  states; **no optimistic status mutation** — every mutation refreshes from the
  API. A real UI bug found by the new spec was fixed: the regenerate dialog is
  now opened only when the recovery status reports `generated === true`
  (previously a never-generated status incorrectly offered "Regenerate").
- **Recovery-mode login** (`LoginMfaStep.tsx` + `LoginForm.tsx`): toggle between
  authenticator code and recovery code; the submit body carries exactly
  `{ userId, recoveryCode }` (normalized `XXXX-XXXX-XXXX-XXXX`); switching mode
  clears the typed code; "Use a different account" resets the mode.
- **Error mapping** (`lib/mfa-errors.ts`): typed `MfaError`/`MfaRequestError`;
  backend copy passed through only for 400/401/403/404/409; calm copy for
  429/5xx/network/unknown; AbortError → cancelled; no raw server internals leak.
- **Section navigation** (`AccountSectionNav.tsx` + `account-sections.ts`):
  URL-fragment anchors with `aria-current`, sections `scroll-mt-6`.
- **Profile/Organization refinements**: Profile uses the shared `copyText`
  helper; Account ID copy, avatar initials, and per-section loading/error/retry
  verified. Danger Zone sole-Owner blocker rows link the real
  `/dashboard/settings/organization` route (route verified to exist).

**Stage verdict: GO — implementation complete, all gates green, single local
commit created. Production certification PENDING operator manual gate (§8).**

---

## 2. Branch & git state

- Branch: `feat/acc-ux-02c-interactive-account-security` — `VERIFIED_THIS_RUN`.
- HEAD before stage: `0deb9c3 fix(security): complete MFA recovery lifecycle (#5)`
  (ACC-SEC-02B2). Working tree had no ACC-UX-02C files at stage start.
- **PUSHED: NO; PRODUCTION DEPLOYED: NO; MANUAL VERCEL/RAILWAY CERTIFICATION: PENDING.**
- Staged files are listed in the commit; only files owned by this stage were
  staged (`git add` of explicit paths). `apps/api-gateway/.env.test` untouched.

---

## 3. Requirements traceability

| Requirement (from ACC-UX-02C) | Implementation | Evidence |
|-------------------------------|----------------|----------|
| Interactive MFA enrollment | `MfaEnrollmentDialog` (intro/setup/verify/success) | `security-section.spec.tsx` |
| QR code shown from backend | `<img src={qrCode}>` — no new dependency | code; QR is a backend-generated data URL (`INFERRED_FROM_CODE` + backend spec) |
| Setup key masked w/ reveal + copy | `MfaEnrollmentDialog` + `copyText` | `security-section.spec.tsx` |
| One-time recovery-code display | `RecoveryCodesDialog` → `OneTimeCodes` | `security-section.spec.tsx` |
| Regenerate (password + TOTP) | `RecoveryCodesDialog` regenerate flow; regenerate flag `generated === true` only | `security-section.spec.tsx`; bug fix `SecuritySection.tsx` |
| Disable with password + TOTP **or** recovery | `DisableMfaDialog` (radio; sends exactly one second factor) | `security-section.spec.tsx` |
| No optimistic status updates | `SecuritySection` always refetches status after mutations | `security-section.spec.tsx` |
| Login recovery option | `LoginMfaStep` mode toggle; `LoginForm` sends normalized `recoveryCode` only | `login-page.spec.tsx` |
| Never persist/show secrets beyond once | codes held in state only, cleared on close; copy via clipboard only | code review + `mfa-client.spec.ts` |
| Controlled errors (400/401/404/409/429/5xx/network/cancel) | `mfa-errors.ts` `mapMfaError` | `mfa-errors.spec.ts` |
| Section nav + keyboard/a11y + reduced motion | `AccountSectionNav`, existing `motion-reduce` classes | `account-page.spec.tsx` |
| UNKNOWN over false certainty | status rows render honest UNKNOWN/empty states | `account-page.spec.tsx` |

---

## 4. What changed

### 4.1 New capability modules (`apps/web/src/lib`)
- `mfa-client.ts` — typed MFA + recovery client mirroring the verified contracts
  (`GET /mfa/status`, `POST /mfa/enroll`, `POST /mfa/verify`,
  `POST /mfa/disable`, `POST /mfa/recovery-codes/generate|regenerate`,
  `GET /mfa/recovery-codes/status`); normalization/validation helpers
  (`normalizeRecoveryCode`, `isValidRecoveryCode`, `normalizeTotp`,
  `isValidTotp`) mirroring `recovery-codes.util.ts` alphabet (A-Z2-7, groups of
  4, 16 chars). `apiCall` reads `body.message` safely.
- `mfa-errors.ts` — `MfaErrorKind`, `MfaError`, `MfaRequestError`,
  `mapMfaError`. Passthrough only for 400/401/403/404/409; 429 →
  "Too many attempts. Wait a moment and try again."; 5xx → generic unavailable
  copy; `TypeError` → network copy; unknown → "Security request failed. Try
  again."; `AbortError` → cancelled. No raw internals surfaced.
- `account-sections.ts` + `clipboard.ts` (shared `copyText`, silent
  degradation in non-secure contexts).

### 4.2 UI (`apps/web/src/components/account`)
- `SecuritySection.tsx` — self-contained state machine (no props from page);
  status + recovery-status data loading; enroll/disable/generate/regenerate
  dialogs; retry/error states; **regenerate flag fixed** to
  `recovery?.generated === true`.
- `components/account/mfa/` — `MfaEnrollmentDialog.tsx`,
  `RecoveryCodesDialog.tsx`, `DisableMfaDialog.tsx`, `OneTimeCodes.tsx`.
- `AccountSectionNav.tsx`, `ProfileSection.tsx` (uses `copyText`),
  `OrganizationSection.tsx`, `DangerZone.tsx` (sole-Owner rows link the real
  `/dashboard/settings/organization` route).
- `app/dashboard/settings/account/page.tsx` — section shell with
  fragment-based nav and `scroll-mt-6` anchors.
- `components/login/LoginMfaStep.tsx` + `LoginForm.tsx` — recovery mode.

### 4.3 Refactors
- `lib/account-client.ts` — `MfaStatus`/`fetchMfaStatus` moved to
  `mfa-client.ts`; `readError` exported. No stale imports remain (lint clean).

---

## 5. Tests

New/extended suites (`apps/web/src/__tests__`):

| Suite | Count | Covers |
|-------|-------|--------|
| `account-page.spec.tsx` (rewritten) | 27 | page contract: section nav anchors/aria-current, profile summary, MFA status rows (enabled/disabled/error+retry), recovery counts/depleted/none, org context + roles, loading/error/retry, display-name edit, DangerZone DELETE confirm + redirect |
| `security-section.spec.tsx` (new) | 34 | SecuritySection + dialog workflows: enroll intro/setup/verify/success → recovery chain, regenerate challenge + confirm, disable via TOTP vs recovery (one factor), throttle 429, status/recovery-status failure states |
| `mfa-client.spec.ts` (new) | 12 | normalization/validation helpers + constant consistency |
| `mfa-errors.spec.ts` (new) | 11 | `mapMfaError` across 400/401/403/404/409/429/5xx/network/unknown/AbortError |
| `login-page.spec.tsx` (extended) | 35 (+6) | recovery toggle + copy, switch-back, invalid-code block, exact recovery payload (no `token`), mode-switch clears code, different-account resets mode |

Verification run (this stage, `VERIFIED_THIS_RUN`):

| Check | Result |
|-------|--------|
| Targeted web suites (5 files) | 119 tests, 5 suites PASS |
| Full web suite | 42 suites / 896 tests PASS |
| `pnpm lint` (`tsc --noEmit`) | PASS |
| `pnpm build` (production) | PASS |
| api-gateway MFA/auth suites (`pnpm test mfa auth`) | 6 suites / 108 tests PASS |
| `scripts/ci-secret-scan.sh` | NO SECRETS DETECTED |
| `scripts/ci-v1-gate.sh` | 19/19 PASS (PASSED: 19, FAILED: 0) |
| `git diff --check` | clean |

The `security-section.spec.tsx` suite was built failing-then-passing: the
initial run exposed the regenerate-dialog bug (17 failures) which was fixed in
`SecuritySection.tsx` before the suite was completed.

---

## 6. Security posture notes

- Identity and org are server-derived; the web client never sends a
  `userId`/`orgId` to MFA endpoints except the value the backend itself
  returned during `POST /auth/login` (`pendingUserId`) on `verify-login`.
- Recovery codes are never written to `localStorage`/`sessionStorage`/URLs/logs.
  `copyText` writes to the OS clipboard only on explicit user click.
- `mfa-errors.ts` guarantees no raw server internals reach the user; backend
  copy is passed through only on the controlled 4xx set.
- The disable dialog sends exactly one second factor (`token` **or**
  `recoveryCode`) — never both — matching the backend DTO.
- No new dependencies were added (QR rendered as `<img>`; clipboard is native).

---

## 7. Open items / documented gaps

- **Password change and session management remain deferred** (no backend; T25).
- **Network/Org-pool merge and other product gaps unchanged** — out of scope.
- **Production certification pending** the operator manual gate below.

---

## 8. Operator manual certification gate (PENDING)

The following must be run by a human against a deployed (Vercel + Railway)
environment before this feature is marked production-certified:

1. Sign in with an MFA-enabled account; verify the recovery-code toggle appears
   and a valid recovery code signs in; an invalid code is rejected.
2. On `/dashboard/settings/account`, enable MFA with a real authenticator
   (QR scans; verify TOTP succeeds).
3. Generate recovery codes; verify all 10 codes display exactly once; reload
   does not re-display them; copy works in a secure (https) context.
4. Regenerate codes (password + TOTP) — old codes are rejected at login.
5. Disable MFA using (a) TOTP and (b) a recovery code — both must work; the
   wrong second factor must be rejected.
6. Confirm no secret material appears in browser devtools storage, network
   bodies beyond the single enrollment response, or app logs.
7. Check 429 throttling behaves (rapid repeated attempts) with calm copy.

Each box: PASS/FAIL with the environment used. This report is NOT a
certification; it is an evidence package.

---

## 9. References

- Backend contracts verified in this run: `apps/api-gateway/src/mfa/*`,
  `src/auth/auth.service.ts`, `src/reauthentication/*` (ACC-SEC-02B1/B2).
- Canonical docs updated with this stage: `00_CURRENT_STATE.md`,
  `03_WEB_SURFACE_MAP.md`, `08_FEATURE_READINESS_MATRIX.md`,
  `10_TECHNICAL_DEBT_REGISTER.md`, `14_DECISION_LOG.md`.

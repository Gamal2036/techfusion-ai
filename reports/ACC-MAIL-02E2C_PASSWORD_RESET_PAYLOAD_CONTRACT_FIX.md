# ACC-MAIL-02E2C — Password Reset Payload Contract Fix

**Branch:** `feat/acc-ux-02e2b-fe-password-recovery` (based on `08356d6`)
**Date:** 2026-08-23
**Scope:** Transactional-email V1 queue payload architecture alignment (API producer ↔ Worker consumer)

---

## 1. Proven root cause

The transactional-email queue carried **two competing payload architectures**.

The authoritative shared contract (`packages/types/transactional-email-job.ts`,
`TransactionalEmailJobV1`) and the Worker implementation
(`apps/worker/src/mail/mail-processor.ts`) define **architecture A**: the API
enqueues an *envelope* (`version`, `templateId`, `encryptedPayload` containing
raw template data, `recipientHash`, `idempotencyKey`, `correlationId`) and the
Worker decrypts the payload and calls `renderTemplate()` itself.

The API password-reset producer violated this contract:
`apps/api-gateway/src/auth/password-reset.service.ts` rendered the email
API-side via `emailService.renderEmail(...)` and enqueued
`encryptedPayload = JSON.stringify({ rendered, to })`.

Runtime failure path (empirically reproduced before this fix):

1. Worker `decryptPayload()` returns `{ rendered, to }`.
2. Worker calls `renderTemplate('password-reset', { rendered, to })`.
3. `renderPasswordReset()` reads `data.recipientName`, which does not exist.
4. `escapeHtml(undefined)` → `undefined.replace(...)` →
   **`TypeError: Cannot read properties of undefined (reading 'replace')`**.
5. The processor catches this inside its render guard and converts it to a
   non-retryable `MailDeliveryError` ('template') — job fails permanently
   **before SMTP**; Brevo is never contacted (consistent with the passing
   independent Brevo SMTP smoke test).

## 2. Selected authoritative architecture

**Architecture A — API sends typed raw template data; Worker renders.**

Rationale: it is the model already defined by the authoritative shared
contract and implemented by the Worker's queue boundary
(`decryptPayload → renderTemplate → provider.send`). Architecture B would have
required rewriting the Worker contract, all Worker tests, and moving rendering
out of the Worker, contradicting the intended boundary.

To make the payload shape authoritative rather than conventional,
`packages/types` now also exports:

- `PasswordResetEmailPayloadV1`, `EmailVerificationEmailPayloadV1`,
  `SecurityNotificationEmailPayloadV1`, `TransactionalEmailPayloadMapV1`,
  `TransactionalEmailPayloadV1`
- Runtime validators `isValidTransactionalEmailTemplateId()` and
  `isValidTransactionalEmailPayload(templateId, payload)` (single source of
  required-field truth).

Both apps import these from `@techfusion/types`; no parallel definitions exist.
Additive change only — `TRANSACTIONAL_EMAIL_CONTRACT_VERSION` stays `1` and the
envelope is unchanged, so existing valid jobs remain compatible.

## 3. Why the old payload failed

`{ rendered, to }` was passed to the Worker as if it were raw template data.
Every template renderer dereferences `recipientName` / `actionUrl` /
`expiresIn`; none exist on `{ rendered, to }`. The first HTML-escaped
interpolation (`escapeHtml(data.recipientName)`) crashed on `undefined`.

## 4. Files changed

| File | Change |
|------|--------|
| `packages/types/transactional-email-job.ts` | Additive: V1 template-payload types + shared validators |
| `packages/types/index.ts` | Export the new types/validators |
| `apps/api-gateway/src/auth/password-reset.service.ts` | Producer now emits typed raw `PasswordResetEmailPayloadV1` in `encryptedPayload`; API-side pre-render removed |
| `apps/worker/src/mail/mail-processor.ts` | Validate decrypted payload against the shared validator for known templates; sanitized permanent `MailDeliveryError('Invalid transactional email payload')` **before** render and SMTP |
| `apps/api-gateway/test/password-reset.spec.ts` | P10 asserts new payload shape + V1 envelope via shared validators; new P10b proves producer emits a valid V1 envelope with no plaintext email in payload/hash |
| `apps/api-gateway/src/mail/__tests__/transactional-email-contract.spec.ts` | Replace broken `{rendered,to}` samples with contract payloads; add producer→worker validator-symmetry test |
| `apps/worker/src/__tests__/transactional-email-contract.spec.ts` | Add render-exactly-once spy test, shared-validator symmetry test, missing-field/non-string/empty-payload rejection tests (SMTP never called), non-retryable classification test |

No frontend, database schema, migration, Redis infrastructure, Railway,
Brevo configuration, `.env`, or production settings changed.

## 5. Security posture preserved

- `TRANSACTIONAL_EMAIL_CONTRACT_VERSION = 1` (unchanged, strictly enforced).
- Enumeration-resistant generic 200 response (P1/P2/P27/P28 still green).
- SHA-256 reset-token hashing (`prt:v1:<64hex>`), 15-minute expiry,
  single-use tokens, session revocation after reset (all asserted by suite).
- Strict unsupported-version rejection (0 / undefined / 999 rejected, SMTP untouched).
- Invalid payloads fail **before SMTP** with a sanitized permanent error that
  contains no field values, no email addresses, no tokens, no hashes.
- Logs continue to carry only jobId/templateId/correlationId/errorType; tests
  assert no reset-token or credential leakage.
- Retryable vs permanent classification preserved (provider retryable errors
  rethrow; contract errors are permanent).

## 6. Verification evidence

All commands run locally against the hermetic test services
(`infra/docker/docker-compose.test.yml`, Postgres :5434 / Redis :6381). Tests
use the in-memory/test mail providers only — **no real SMTP was contacted**.

| Gate | Result |
|------|--------|
| Shared-contract tests (API `transactional-email-contract.spec`) | 15 passed |
| Shared-contract tests (Worker `transactional-email-contract.spec`) | 25 passed (within full run) |
| API password-reset e2e (`test/password-reset.spec.ts`) | 44 passed |
| Full API Gateway suite | **68 suites / 1237 tests passed** (~291s) |
| Full Worker suite | **10 suites / 137 tests passed** (~17s) |
| TypeScript checks (`pnpm lint` = `tsc --noEmit`) | PASS — packages/types, api-gateway, worker |
| Builds (`tsc`) | PASS — packages/types, api-gateway, worker |
| `git diff --check` | clean |
| Repository secret scan (`scripts/ci-secret-scan.sh`) | NO SECRETS DETECTED |

Test-to-requirement map (mission §TEST REQUIREMENTS): 1→P8/P10b;
2→API+Worker suites both import `@techfusion/types` validators (symmetry tests);
3→Worker "accepts payloads matching the shared authoritative payload validator";
4→render-once spy (`toHaveBeenCalledTimes(1)`); 5→"call provider exactly once";
6→recipientName/non-string/empty-object rejection tests; 7→"invalid payloads
never call SMTP"; 8→unsupported-version rejection (existing + retained);
9→retryable propagation; 10→non-retryable payload/version/template errors;
11→log-leak tests on both sides.

## 7. Commit

`fix(mail): align password reset template payload contract` — see git log for
the final hash. Working tree clean after commit.

## 8. Manual Brevo/Gmail E2E instructions (operator-run)

Prerequisites: Brevo SMTP credentials available; Gmail mailbox as recipient;
local dev stack configured via existing `.env` files (**do not commit them**).

1. Ensure Docker dev infra is up and `MAIL_ENABLED=true`, `MAIL_TRANSPORT=smtp`
   with Brevo host `smtp-relay.brevo.com:587` in the API **and** Worker env,
   plus identical `JWT_SECRET` and `WEB_APP_URL` pointing at the running web app.
2. Start API Gateway and Worker (`pnpm --filter api-gateway dev`,
   `pnpm --filter worker dev`). Worker must log
   `Transactional email using SMTP provider in worker.` and
   `Transactional email processor registered`.
3. From the web UI, request a password reset for the Gmail address.
4. Expected: generic success message immediately; within ~seconds the Worker
   logs `Processing transactional email job` then
   `Transactional email sent successfully` (correlationId present, **no**
   email address/token in any log line); the Gmail inbox receives
   “Reset your TechFusion AI password” with a working
   `/reset-password?token=...` button; Brevo dashboard shows 1 delivered event.
5. Negative check (optional): enqueue a job with `encryptedPayload='{}'`
   directly in Redis — the Worker must log
   `Invalid template payload, aborting before render and send`
   (`PayloadValidationError`) and mark the job failed **without contacting
   Brevo**.

## 9. Scope confirmation

No frontend changes; no DB schema changes; no migrations; no Redis
infrastructure changes; no Railway changes; no Brevo configuration changes;
no `.env` edits; no production deployment; no deletion of existing BullMQ
jobs; no unrelated refactoring. Evidence-marker: VERIFIED_THIS_RUN.

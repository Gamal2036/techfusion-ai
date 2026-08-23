# ACC-MAIL-02E2D — Encrypted Recipient Delivery Envelope & Permanent Retry Fix

**Branch:** `feat/acc-ux-02e2b-fe-password-recovery` (based on `cfb9469`)
**Date:** 2026-08-23
**Scope:** Transactional-email V1 delivery-envelope encryption, recipient validation,
SMTP error classification, and BullMQ non-retryable failure handling
(API Gateway producer ↔ Worker consumer ↔ SMTP provider)

---

## 1. Exact root cause

`apps/worker/src/mail/mail-processor.ts` called `provider.send()` with:

```ts
to: `recipient-${maskHash(data.recipientHash)}`
```

and `apps/worker/src/mail/mail-providers.ts` passed `metadata.to` verbatim into
Nodemailer `sendMail()`. `recipientHash` is an observability/correlation digest
(`sha256(email)[0:16]`, `MailUrlBuilder.hashRecipient()`), **not an SMTP
recipient address**. Every queued transactional email therefore attempted
delivery to a synthetic address like `recipient-abc1****def4`. The independent
Brevo SMTP smoke test with a real Gmail address passed because it never went
through the queue path; password-reset jobs failed at `provider.send()` with
the unclassified wrapper error `SMTP delivery failed: unknown`.

Secondary defects repaired in the same pass:

1. **No recipient transport existed at all.** The V1 job carried only the hash;
   there was no way for the Worker to learn the real address.
2. **`encryptedPayload` was plain JSON**, not encrypted (Worker "decrypted"
   with `JSON5/JSON.parse`).
3. **SMTP errors were misclassified**: `EENVELOPE`/`EAUTH` fell through to a
   bare `'unknown'` category; raw Nodemailer fields (`response`, `message`)
   that can contain full recipient addresses were one careless interpolation
   away from logs.
4. **Permanent failures exhausted retries**: contract/validation/template/
   decryption failures threw regular errors, so BullMQ re-ran all 5 configured
   attempts for jobs that can never succeed.

## 2. Authoritative encrypted envelope design

New shared module `packages/types/transactional-email-envelope.ts`
(re-exported by `@techfusion/types`; consumed identically by both apps):

**Delivery envelope (V1)** — exists ONLY inside AES-256-GCM ciphertext:

```json
{
  "envelopeVersion": 1,
  "to": "<real recipient address>",
  "templateData": { "...typed PasswordResetEmailPayloadV1 / etc.": "..." }
}
```

**Versioned encrypted container (V1)** — serialized into the queue job's
`encryptedPayload` field:

```json
{
  "containerVersion": 1,
  "scheme": "aes-256-gcm",
  "iv": "<12-byte fresh random IV per payload, base64>",
  "tag": "<16-byte auth tag, base64>",
  "ciphertext": "<base64>"
}
```

Key management contract (operator decision, recorded in `14` D43):

- `MAIL_PAYLOAD_ENCRYPTION_KEY_B64` — must decode to **exactly 32 bytes** of
  canonical base64; identical value in API Gateway and Worker.
- Never derived from `JWT_SECRET`, `MASTER_KEY`, `AI_ENCRYPTION_KEY`,
  database credentials, or any other existing secret (strict key separation).
- **Fail closed**: producer refuses to enqueue when sealing is impossible
  (forgot-password still returns the generic enumeration-safe response and
  queues nothing); Worker registers a fail-closed stub processor and rejects
  mail jobs rather than processing them without a key.
- Root BullMQ job data remains exactly:
  `version, templateId, encryptedPayload, recipientHash, idempotencyKey,
  correlationId (+ _correlation metadata)`. The plaintext recipient email and
  `templateData` exist only inside ciphertext.

`recipientHash` is retained strictly for safe logging, correlation, and
idempotency/observability. It is never used to derive an SMTP recipient
(the `maskHash` derivation helper was deleted).

## 3. Files changed

| File | Change |
|------|--------|
| `packages/types/transactional-email-envelope.ts` | NEW: envelope/container types, `loadMailPayloadEncryptionKey()` (fail-closed 32-byte validation), `sealTransactionalEmailDeliveryEnvelope()`, `openTransactionalEmailDeliveryEnvelope()` (auth-tag verified, sanitized static errors), `isValidRecipientEmailAddress()` (header-injection safe), `isValidTransactionalEmailDeliveryEnvelope()` |
| `packages/types/index.ts` | Export the envelope contract + functions |
| `apps/api-gateway/src/auth/password-reset.service.ts` | Producer seals `{to: normalizedEmail, templateData}` into `encryptedPayload`; fails closed without key |
| `apps/api-gateway/src/mail/__tests__/transactional-email-contract.spec.ts` | Sealed-envelope samples; round-trip/tamper/wrong-key/key-validation/recipient-validator tests; producer→worker validator symmetry |
| `apps/api-gateway/test/password-reset.spec.ts` | Ephemeral in-test key injection; P10/P10b rewritten for ciphertext; P10c fail-closed proof; root-field allow-list proof |
| `apps/api-gateway/.env.example` | Documented (commented, no real key) entry for `MAIL_PAYLOAD_ENCRYPTION_KEY_B64` |
| `apps/worker/src/mail/mail-processor.ts` | Opens encrypted envelope, validates recipient before render/send, passes decrypted real `to` to provider, permanent failures → `UnrecoverableError` |
| `apps/worker/src/mail/mail-providers.ts` | Sanitized `classifySmtpDeliveryError()`: `EENVELOPE`→permanent `envelope`, `EAUTH`→permanent `auth`, connection/timeout/dns retryable, responseCode categories preserved, unrecognized safe codes surfaced instead of `unknown`; human-readable Nodemailer fields never read into errors |
| `apps/worker/src/main.ts` | Loads key at startup; fail-closed stub registration when key missing/invalid while mail enabled |
| `apps/worker/src/__tests__/mail.spec.ts` | Envelope-based processor tests; real seal/open round-trip; SMTP classification suite incl. leak-safety assertions |
| `apps/worker/src/__tests__/transactional-email-contract.spec.ts` | Full envelope-contract rewrite: provider-receives-real-address, hash-never-used-as-to, no-plaintext-in-root-payload, legacy plain-JSON permanently rejected pre-SMTP, UnrecoverableError permanence proofs |

No frontend, database schema, migration, Redis infrastructure, Railway,
Brevo configuration, `.env` (real), or production settings changed.

## 4. Tests and counts

Focused gates (`VERIFIED_THIS_RUN`):

| Suite | Result |
|-------|--------|
| Worker `mail.spec.ts` + `transactional-email-contract.spec.ts` | **85 passed** |
| API Gateway `transactional-email-contract.spec.ts` | **21 passed** |
| API Gateway `test/password-reset.spec.ts` (incl. new P10b/P10c) | **45 passed** |

Full certification gates:

| Gate | Result |
|------|--------|
| Worker full suite | **10 suites / 165 tests passed** (~27 s) |
| API Gateway full suite | **68 suites / 1244 tests passed** |
| Web full suite (within V1 gate) | 1077 tests passed |
| Agent fmt/tests/release build/version check | PASS |
| `pnpm ci:v1` (scripts/ci-v1-gate.sh) | **19/19 PASS — "baseline is releasable"** |
| TypeScript checks (`tsc --noEmit`) packages/types, api-gateway, worker | PASS |
| Builds (`tsc`) packages/types, api-gateway, worker | PASS |
| `git diff --check` | clean |
| Secret scan (`scripts/ci-secret-scan.sh`) | NO SECRETS DETECTED |

Regression-to-mission map (mission §10): provider-receives-decrypted-address →
worker contract spec "provider receives the decrypted real recipient address";
hash-never-SMTP-to → "recipientHash is never used as the SMTP recipient";
no-plaintext-root-payload → "root BullMQ job payload contains no plaintext
recipient email"; valid-envelope-after-decryption → "encrypted payload contains
a valid delivery envelope after decryption"; malformed/missing recipient →
"Malformed recipients are rejected before SMTP" (3 proofs); EENVELOPE →
"SMTP Error Classification (sanitized)" (7 proofs incl. leak-safety);
permanent-not-exhausting → "Permanent errors use the BullMQ non-retryable
mechanism" (5 UnrecoverableError proofs); retryable-retained → retryable
propagation tests both suites; actionUrl+expiry rendering retained; log-leak
proofs extended with recipient email + test key scanning.

## 5. Retry behavior proof

- Producer configures `attempts: 5`, exponential backoff 2 s (unchanged).
- Permanent paths (contract shape, decryption/authentication, envelope
  recipient, template payload, template rendering, non-retryable SMTP codes
  `EENVELOPE`/`EAUTH`) throw `bullmq.UnrecoverableError` — BullMQ moves the
  job straight to the failed set **without consuming remaining attempts**
  (verified in installed bullmq@5.78.1 `classes/job.js`).
- Transient paths (connection reset/refused, timeouts, DNS, SMTP 4xx/5xx
  responses) rethrow the retryable `MailDeliveryError` unchanged — normal
  BullMQ retry/backoff continues.
- No unrelated existing jobs were deleted or mutated.

## 6. Secret and privacy scan result

- Repository secret scan: **NO SECRETS DETECTED** (standalone + inside V1 gate).
- No real key material exists anywhere in the repository; `.env.example`
  carries a commented placeholder only; tests generate ephemeral in-memory
  keys (`Buffer.alloc(32, n)`).
- Log-leak regression tests assert: no reset token, no recipient email, no
  observability hash, no SMTP credential, and no test key appear in any
  console output across success and permanent-failure paths.
- SMTP classifier unit tests assert categories never contain `@`, hostname,
  or free text from Nodemailer `response`/`message`.

### Known unrelated flakiness (documented, not caused by this change)

Two long-running worker dev processes (operator's Brevo debug session) loaded
the machine during early gate runs, producing varying failures in the
timing-sensitive `mfa-security`/`mfa-recovery` throttle tests. Evidence: the
failure sets differed between two runs of the **identical clean tree**
(10 failed vs 3 failed). After stopping those processes, both MFA suites pass
46/46 and the full V1 gate is green 19/19.

## 7. Commit

`fix(mail): deliver password reset to encrypted recipient address` — see
`git log -1` for the final hash. Working tree clean after commit.

## 8. Manual local E2E instructions (one password-reset email)

Prerequisites: Brevo SMTP credentials, Gmail mailbox as recipient, local dev
stack via existing `.env` files (**never committed**).

1. Generate one shared key and copy the same value into BOTH
   `apps/api-gateway/.env` and `apps/worker/.env`:
   ```
   openssl rand -base64 32
   # → append to both files:
   # MAIL_PAYLOAD_ENCRYPTION_KEY_B64="<generated value>"
   ```
2. In both env files keep `MAIL_ENABLED=true`, `MAIL_TRANSPORT=smtp`,
   Brevo host `smtp-relay.brevo.com:587`, identical `JWT_SECRET`, and
   `WEB_APP_URL` pointing at the running web app.
3. Start API Gateway and Worker:
   ```
   pnpm --filter api-gateway dev
   pnpm --filter worker dev
   ```
   Worker must log `Transactional email using SMTP provider in worker.` then
   `Transactional email processor registered` (NOT the fail-closed stub line).
4. From the web UI (`http://localhost:3000/forgot-password`), request a reset
   for the Gmail address.
5. Expected: generic success message immediately; within seconds Worker logs
   `Processing transactional email job` → `Transactional email sent successfully`
   (correlationId present; **no** email address, hash, token, or key material
   in any log line); Gmail receives “Reset your TechFusion AI password” with a
   working `/reset-password?token=...` button expiring in 15 minutes; Brevo
   dashboard shows 1 delivered event to the real address (not
   `recipient-*`).
6. Negative check (optional): stop the Worker, set
   `MAIL_PAYLOAD_ENCRYPTION_KEY_B64` to a wrong/different value, replay a
   queued job — Worker logs the fail-closed stub warning and the job fails
   without contacting Brevo. Restoring the correct key resumes normal
   processing.

## 9. Scope confirmation

No frontend changes; no DB schema/migration changes; no Redis infrastructure
changes; no Railway/production setting changes; no Brevo configuration
changes; no real `.env` file edited or staged (`apps/api-gateway/.env.test`
untouched); no real emails sent during automated tests; no deletion of
existing BullMQ jobs; no unrelated refactors. Evidence marker:
`VERIFIED_THIS_RUN`.

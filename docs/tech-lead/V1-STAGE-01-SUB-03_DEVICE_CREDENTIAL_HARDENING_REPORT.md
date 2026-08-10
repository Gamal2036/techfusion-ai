# V1-STAGE-01-SUB-03 — Device Credential Hardening Report (S3 closure)

Status date: 2026-08-10. Mission: close S3 (Plaintext `Device.deviceToken`
retained + fallback lookup) from `07` by removing the plaintext column,
making the SHA-256 `deviceTokenHash` the sole device credential verifier
(fail-closed), and adding a permanent adversarial regression suite.
`MIGRATION: YES` — one additive-destructive migration, no data loss:
`20260810000000_device_token_plaintext_removal`.

## 1. Original Finding (S3, MEDIUM — Plaintext credential + fallback auth)

`Device.deviceToken` (plaintext, unique, NOT NULL) was stored in the DB, and
the `DeviceTokenGuard` verified a presented bearer by hashing it and looking up
`deviceTokenHash`, then — **only when no hash matched** — fell back to an
equality lookup against the plaintext column
(`device-token.guard.ts:38-47`; `devices.service.ts:249-260`). Any DB read
would expose live, usable device credentials, and the fallback path meant a
device whose row lacked a verifier could still authenticate with the plaintext.

## 2. Changes Made

### 2.1 Schema + migration

- Removed `deviceToken String @unique` from `Device` in
  `apps/api-gateway/prisma/schema.prisma` (synced to
  `apps/worker/prisma/schema.prisma`).
- New migration `20260810000000_device_token_plaintext_removal`:
  `DROP INDEX "Device_deviceToken_key"` + `DROP COLUMN "deviceToken"`.
  No backfill is performed — the earlier `20260720130000_device_token_hash_credential_rotation`
  migration already backfilled SHA-256 hashes for every pre-hash row, and the
  application writes `deviceTokenHash` on every register/rotate path. A
  one-way hash cannot be derived from an unknown token, so there was nothing to
  backfill.

### 2.2 Verifier-only authentication (fail-closed)

- `device-token.guard.ts`: removed the plaintext equality fallback. The guard
  now does a single `findFirst({ where: { deviceTokenHash: sha256(token) } })`
  and throws 401 when nothing matches.
- `devices.service.ts findByToken`: same — hash-only
  lookup, no fallback. Used by the security-report ingestion path
  (`SecurityService.findDeviceByToken` → `findByToken`), which therefore now
  hashes the body credential before lookup.

### 2.3 Raw credentials never persisted

- `register`, `register-public`, and `rotateCredential` write only
  `deviceTokenHash`; the one-time raw token is returned to the device over TLS
  at issuance and nowhere else.
- `register` now returns `{ device, deviceToken: string | null }` — an existing
  (duplicate) registration returns `null` token (no raw credential is available
  or minted for it).
- `rotateCredential` uses the stored verifier as `oldTokenHash`; for a
  verifier-less row it records the documented sentinel `legacy-no-verifier`
  (cannot collide with a real 64-hex verifier). Rotation still issues a new
  token + hash and increments `credentialVersion`.

### 2.4 Recovery path for verifier-less rows (fail-closed + controlled recovery)

- A device row with `deviceTokenHash = NULL` cannot authenticate (401) —
  fail-closed. Recovery is deliberate and admin-controlled:
  - `POST /devices/recover-credential` (requires a valid enrollment token in
    `x-org-token` + an identity attribute) rotates the credential;
  - duplicate `register-public` (same identity fingerprint/installation id)
    auto-rotates;
  - agent re-enrollment (agent stores `device_token`/`device_id`, `reset.rs`
    clears them; `install-linux.sh` skips enrollment when a token exists).
- No API contract change for agents: they keep using the `Authorization: Bearer
  <token>` header; the optional `deviceToken` body field on
  `MetricsPayloadDto`/`SubmitFindingsDto` is now inert input (hashed and
  looked up, never stored).

## 3. New Adversarial Suite — `apps/api-gateway/test/device-credential-hardening.spec.ts` (13 tests)

| Scenario | Expectation |
|---|---|
| Valid bearer matching `deviceTokenHash` | 201 (authenticated) |
| Wrong token when a hashed device exists | 401 (no plaintext fallback) |
| Unknown token | 401 |
| Malformed bearer | 401 |
| No `Authorization` header | 401 |
| Legacy row with `deviceTokenHash = NULL` | 401 (fail-closed) |
| `register-public` stores only the hash; raw token not in DB row JSON | hash matches sha256(raw); raw absent |
| Device listing (`GET /devices`) never exposes `deviceTokenHash` | field undefined |
| `recover-credential` invalidates the old verifier; new token authenticates | old → 401, new → 201 |
| `recover-credential` rejects an invalid org token | `INVALID_ORG_TOKEN` |
| Duplicate `register-public` (same fingerprint) rotates the credential | first → 401, second → 201 |
| Device credential cannot access human-facing API (`GET /devices`) | 401 |
| `security-report` hashes the body credential; unknown credential rejected | 200 + `scanId` vs `Invalid device token` |

## 4. Existing Tests Updated

All device fixtures that previously created rows with only a plaintext
`deviceToken` now store the verifier (`deviceTokenHash`) and keep the raw token
in memory only where a Bearer is needed:

`app.integration`, `cross-tenant-isolation`, `tenant-isolation-security`,
`security`, `enterprise.integration`, `lifecycle-data-integrity`,
`full-e2e-scenario`, `membership-authoritative`, `presence-telemetry`,
`organizations`, `account-deletion`, `devices.controller.spec`.

Also fixed a pre-existing test-hygiene bug exposed by interrupted runs:
`full-e2e-scenario.spec.ts` cleanup did not clear `EnrollmentToken` before
deleting organizations (FK violation); the table is now cleared first.

## 5. Verification Evidence

- **api-gateway**: 55 suites / 956 tests PASS (includes the new 13-test
  hardening suite and the SUB-02 20-test isolation suite).
- **worker**: 8 suites / 80 tests PASS.
- **web**: 35 suites / 790 tests PASS.
- `tsc --noEmit` + `tsc` (build) green for api-gateway, worker, web.
- `prisma migrate status` + `validate` green against both the test DB (5434)
  and dev DB (5433); migration `20260810000000_*` applied and recorded.
- `scripts/ci-secret-scan.sh`: NO SECRETS DETECTED (including the new
  migration, which contains no data values).

## 6. Residual Risk

- **Legacy rows without a verifier** (theoretically possible only if a row was
  inserted outside the application after the 20260720130000 backfill): such
  devices fail closed until an admin rotates their credential or the agent
  re-enrolls. Documented recovery path in §2.4. `deviceTokenHash` remains
  nullable `@unique` to allow this state to exist without blocking writes.
- **Backfill correctness caveat (pre-existing)**: the 20260720130000 backfill
  hashed `substring("deviceToken" from 1 for 64)` as hex — correct for 64-hex
  tokens (current `generateSecureToken()` output), but a token minted by the
  older `crypto.randomUUID()` (36 chars) would have been hashed from raw bytes,
  producing an unusable verifier. Such devices also fail closed and recover via
  the §2.4 path. This is strictly safer than the removed plaintext fallback.

## 7. Files Changed

- `apps/api-gateway/prisma/schema.prisma` (removed `Device.deviceToken`)
- `apps/api-gateway/prisma/migrations/20260810000000_device_token_plaintext_removal/migration.sql` (new)
- `apps/worker/prisma/schema.prisma` (synced)
- `apps/api-gateway/src/devices/device-token.guard.ts` (hash-only, no fallback)
- `apps/api-gateway/src/devices/devices.service.ts` (`findByToken` hash-only;
  register/register-public/rotate store hash only; sentinel for verifier-less rotation)
- `apps/api-gateway/src/devices/devices.controller.ts` (register returns token from
  service; `sanitizeDevice` no longer strips a nonexistent column)
- `apps/api-gateway/test/device-credential-hardening.spec.ts` (new, 13 tests)
- `apps/api-gateway/test/{app.integration,cross-tenant-isolation,tenant-isolation-security,security,enterprise.integration,lifecycle-data-integrity,full-e2e-scenario,membership-authoritative,presence-telemetry,organizations,account-deletion}.spec.ts` (verifier fixtures)
- `apps/api-gateway/src/devices/devices.controller.spec.ts` (mock fixture)
- `apps/api-gateway/src/inventory/inventory.controller.spec.ts` (mock fixture — hash already present, field aligned)
- `docs/tech-lead/07_SECURITY_TENANCY_REVIEW.md`, `12_MASTER_ROADMAP.md`, `14_DECISION_LOG.md` (S3 marked resolved, D16)

## 8. Rollback Notes

Reversible without data loss: apply the down by re-adding the column and
backfilling `deviceTokenHash` → `deviceToken` is **impossible** (one-way hash).
Rolling back auth to a plaintext fallback is not possible without stored
plaintext, by design. If the migration must be reversed, re-introduce a
`deviceToken` column populated by agent re-enrollment (tokens are regenerated).
No production data was migrated or transformed by this substage's migration
(both migrations applied here were pre-verified on the test DB before any dev
DB apply).

## 9. Next Recommended Work

From `12`/`07` remaining items (not a numbered substage): metrics token auth
cleanup (S5 — `GET /metrics?token=` leakage; require `METRICS_AUTH_TOKEN`),
then the secrets hygiene review.

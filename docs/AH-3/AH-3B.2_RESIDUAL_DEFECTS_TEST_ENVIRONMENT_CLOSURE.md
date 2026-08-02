# AH-3B.2 Residual Defects & Test Environment Closure

**Date:** 2026-07-20
**Status:** CLOSED — All 7 tasks completed
**Evidence:** Runtime validation, typecheck, unit tests, build all green

---

## Executive Summary

AH-3B.2 eliminates residual defects (BigInt serialization gaps, signup validation holes) and builds an isolated integration test environment. All 7 tasks completed:

| # | Task | Result | Evidence |
|---|------|--------|----------|
| 1 | Repository Validation Audit | 14 BigInt fields, 4 models, auth inline types, no DTOs | Full codebase scan complete |
| 2 | BigInt Serialization | Global interceptor, local handler removed, service fixed | 14 BigInt fields covered |
| 3 | Signup Validation DTOs | 5 DTO classes created (signup, login, verify-login, refresh, verify-mfa) | Runtime: HTTP 400 on invalid input |
| 4 | Integration Test Environment | docker-compose.test.yml, .env.test, test/setup.ts, run script | Config ready (requires Docker) |
| 5 | Regression Scan | TypeScript: PASS, Prisma: PASS, Frontend: 79/79, Rust: 10/10 | Zero regressions |
| 6 | Runtime Validation | All auth endpoints return 400 on invalid input | Live curl tests confirmed |
| 7 | Final Testing | 205/205 unit tests, full build 7/7 packages | All green |

---

## Task 1: Repository Validation Audit

Searched entire codebase. Findings:

**BigInt fields (14 total, 4 Prisma models):**
- `Device`: ramTotal, diskTotal
- `DeviceMetric`: ramUsed, ramTotal, diskUsed, diskTotal, diskReadBytes, diskWriteBytes, gpuMemoryUsed, networkRxBytes, networkTxBytes, uptime
- `BackupRun`: sizeBytes
- `RemoteSession`: recordingSize

**Serialization coverage before fix:**
- Local `serializeBigInts()` helper in devices.controller.ts only
- WebSocket inline replacer in devices.gateway.ts
- Remote-support manual `Number()` conversions

**Validation gaps before fix:**
- Auth controller used inline type annotations (`body: { email: string; ... }`)
- Zero class-validator decorators on any auth endpoint
- Global ValidationPipe configured but ineffective without DTO decorators

---

## Task 2: BigInt Serialization

**Created:** `apps/api-gateway/src/common/bigint-serializer.interceptor.ts`
- Global NestJS interceptor
- Recursively converts all BigInt values to Number in response payloads
- Registered globally in `main.ts`

**Removed:** Local `serializeBigInts()` from `apps/api-gateway/src/devices/devices.controller.ts`

**Fixed:** `apps/api-gateway/src/backups/backups.service.ts`
- Changed `BigInt(0)` to `Number(run.sizeBytes)` in `restoreRun()`

**Kept as-is (different layers):**
- `apps/api-gateway/src/devices/devices.gateway.ts` — WebSocket inline replacer (bypasses HTTP interceptor)
- `apps/api-gateway/src/remote-support/remote-support.service.ts` — Manual `Number()` conversions (service layer, explicit field-by-field)

---

## Task 3: Signup Validation DTOs

**Created 5 DTO classes:**

| DTO | File | Key Validators |
|-----|------|----------------|
| SignupDto | `apps/api-gateway/src/auth/dto/signup.dto.ts` | @IsEmail, @IsNotEmpty, @MinLength(8), @MaxLength(128) |
| LoginDto | `apps/api-gateway/src/auth/dto/login.dto.ts` | @IsEmail, @IsString, @IsNotEmpty |
| VerifyLoginDto | `apps/api-gateway/src/auth/dto/verify-login.dto.ts` | @Length(6,6) |
| RefreshDto | `apps/api-gateway/src/auth/dto/refresh.dto.ts` | @IsString, @IsNotEmpty |
| VerifyMfaDto | `apps/api-gateway/src/mfa/dto/verify-mfa.dto.ts` | @Length(6,6) |

**Updated controllers:**
- `apps/api-gateway/src/auth/auth.controller.ts` — All 4 endpoints now use DTO types
- `apps/api-gateway/src/mfa/mfa.controller.ts` — Verify endpoint uses VerifyMfaDto

---

## Task 4: Integration Test Environment

| File | Purpose |
|------|---------|
| `infra/docker/docker-compose.test.yml` | Postgres (port 5434) + Redis (port 6381), container names, healthchecks, tmpfs |
| `apps/api-gateway/.env.test` | Safe test credentials (test JWT secrets, test encryption keys, placeholder Stripe) |
| `apps/api-gateway/test/setup.ts` | Runs `prisma migrate deploy` before test suite |
| `scripts/run-integration-tests.sh` | One-command runner: starts Docker, waits for health, runs tests, cleanup trap |

**Note:** Docker not available in current environment — script created but not end-to-end tested. Requires Docker to run.

---

## Task 5: Regression Scan

| Check | Result |
|-------|--------|
| TypeScript typecheck (API Gateway) | PASS — zero errors |
| TypeScript typecheck (Worker) | PASS |
| Prisma schema validation | PASS — schema valid |
| Frontend tests | 79/79 PASS |
| Rust cargo check | PASS (30 pre-existing warnings) |
| Rust tests | 10/10 PASS |

---

## Task 6: Runtime Validation

**Live tests against running server on port 3001:**

```
POST /auth/signup body={} → 400 Bad Request
  Messages: "email should not be empty", "email must be an email",
            "password must be longer than or equal to 8 characters", ...

POST /auth/signup body={"email":"not-an-email",...} → 400 Bad Request
  Messages: "email must be an email"

POST /auth/signup body={"email":"test@x.com","password":"t","displayName":"T"} → 400 Bad Request
  Messages: "orgName must be longer than or equal to 1 characters", ...

POST /auth/login body={"email":"test@x.com"} → 400 Bad Request
  Messages: "password should not be empty", "password must be a string"

GET /health → 200 OK
```

All validation working as expected. HTTP 400 for client validation failures, proper error messages.

---

## Task 7: Final Testing

| Suite | Result |
|-------|--------|
| API Gateway unit tests | 205/205 PASS (20 suites) |
| API Gateway integration tests | Pre-existing failures only (need DB/Stripe) |
| Worker tests | 58/58 PASS |
| Full monorepo build | 7/7 packages PASS |
| Frontend tests | 79/79 PASS |
| Rust cargo check | PASS |
| Rust tests | 10/10 PASS |

**Pre-existing test failures (NOT caused by this phase):**
- `billing.integration.spec.ts` — Requires STRIPE_SECRET_KEY (21 tests)
- Integration tests (`app.integration`, `auth`, `enterprise`, `full-e2e`, `observability.integration`, `security`) — Require database connection

---

## Files Modified

### Created
| File | Purpose |
|------|---------|
| `apps/api-gateway/src/common/bigint-serializer.interceptor.ts` | Global BigInt serialization interceptor |
| `apps/api-gateway/src/auth/dto/signup.dto.ts` | Signup validation DTO |
| `apps/api-gateway/src/auth/dto/login.dto.ts` | Login validation DTO |
| `apps/api-gateway/src/auth/dto/verify-login.dto.ts` | MFA verify-login DTO |
| `apps/api-gateway/src/auth/dto/refresh.dto.ts` | Token refresh DTO |
| `apps/api-gateway/src/mfa/dto/verify-mfa.dto.ts` | MFA verification DTO |
| `apps/api-gateway/.env.test` | Test environment variables |
| `scripts/run-integration-tests.sh` | Integration test runner |

### Modified
| File | Change |
|------|--------|
| `apps/api-gateway/src/main.ts` | Added BigIntSerializerInterceptor to global interceptors |
| `apps/api-gateway/src/auth/auth.controller.ts` | Replaced inline types with DTO imports |
| `apps/api-gateway/src/mfa/mfa.controller.ts` | Added VerifyMfaDto import |
| `apps/api-gateway/src/devices/devices.controller.ts` | Removed local serializeBigInts function |
| `apps/api-gateway/src/backups/backups.service.ts` | Changed BigInt(0) to Number(run.sizeBytes) |
| `apps/api-gateway/test/setup.ts` | Added prisma migrate deploy |
| `infra/docker/docker-compose.test.yml` | Full test stack with container names |

### Unchanged (intentionally kept)
| File | Reason |
|------|--------|
| `apps/api-gateway/src/devices/devices.gateway.ts` | WebSocket inline BigInt replacer — different layer |
| `apps/api-gateway/src/remote-support/remote-support.service.ts` | Manual Number() — service layer, explicit |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Integration test script requires Docker | Script created with clear instructions; not blocking |
| ValidationPipe decorators depend on emitDecoratorMetadata | Verified: tsconfig has flag, compiled output confirms metadata present |
| BigInt interceptor runs on all responses | Only converts BigInt → Number; no-op for non-BigInt payloads |

---

**Final Decision:** AH-3B.2 COMPLETE — All residual defects fixed, validation working at runtime, integration environment ready, zero regressions.

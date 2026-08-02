# AH-1B — Backend Discovery

**Repository:** Tech Fusion AI
**Date:** 2026-07-16
**Scope:** `apps/api-gateway/` only
**Status:** Discovery only — no code modifications

---

## Backend Overview

The backend is a **NestJS 10** application running on the **Express** platform. It serves as the central API gateway for the Tech Fusion AI SaaS platform — a multi-tenant IT fleet management and cybersecurity system.

- **Framework:** NestJS 10.3 (Express)
- **Language:** TypeScript 5.4 (ES2021 target, CommonJS modules)
- **Database:** PostgreSQL via Prisma ORM (27+ models)
- **Port:** 3001 (default)
- **Architecture:** Modular monolith with 18 feature modules + 3 root controllers
- **Global middleware:** CORS, ValidationPipe (whitelist + transform)
- **Observability:** OpenTelemetry (OTLP gRPC traces), Prometheus metrics (prom-client)

---

## Bootstrap Flow

```
src/main.ts
  │
  ├─ initTelemetry()          // OpenTelemetry SDK startup (OTLP gRPC exporter)
  │    └─ NodeSDK.start()     // Auto-instrumentations enabled
  │
  ├─ NestFactory.create(AppModule, { rawBody: true })
  │    └─ AppModule registered with:
  │         ├─ ThrottlerModule (2 tiers: 10/s short, 100/min long)
  │         ├─ PrismaModule (global)
  │         ├─ 18 feature modules
  │         └─ 5 global providers:
  │              ├─ APP_INTERCEPTOR: MetricsInterceptor (Prometheus)
  │              ├─ APP_INTERCEPTOR: OrgContextInterceptor (tenant isolation)
  │              ├─ APP_GUARD: CombinedAuthGuard (JWT + RBAC)
  │              ├─ APP_GUARD: PlanGuard (plan-based feature gating)
  │              └─ APP_GUARD: ThrottlerGuard (rate limiting)
  │
  ├─ app.enableCors()         // Configurable via ALLOWED_ORIGINS
  │
  ├─ app.useGlobalPipes()     // ValidationPipe with whitelist + transform
  │
  └─ app.listen(port)         // PORT || 3001

Process handlers:
  └─ SIGTERM → shutdownTelemetry() → process.exit(0)
  └─ Uncaught → shutdownTelemetry() → process.exit(1)
```

---

## Module Map

### Global Infrastructure (root-level in `src/`)

| File | Type | Purpose |
|---|---|---|
| `main.ts` | Entry | Bootstrap, CORS, pipes, telemetry lifecycle |
| `app.module.ts` | Module | Root module — imports all 18 feature modules, registers global guards/interceptors |
| `health.controller.ts` | Controller | `GET /health` — unauthenticated health check |
| `metrics.controller.ts` | Controller | `GET /metrics` — Prometheus metrics endpoint (unauthenticated) |
| `metrics.interceptor.ts` | Interceptor + Registry | Prometheus histogram/counter for HTTP requests, AI cost/latency/tokens |
| `telemetry.ts` | Utility | OpenTelemetry NodeSDK init/shutdown |
| `demo.controller.ts` | Controller | `GET /demo/*` — RBAC demonstration endpoints (Owner/Admin/Technician/Viewer) |

### Common Module (`src/common/`)

| File | Type | Purpose |
|---|---|---|
| `combined-auth.guard.ts` | Guard | **Global.** Skips `@Public()`, verifies JWT Bearer, enforces RBAC hierarchy (Owner > Admin > Technician > Viewer) |
| `jwt-auth.guard.ts` | Guard | Simpler JWT-only guard (no RBAC). Used directly by `kb` controller |
| `roles.guard.ts` | Guard | Standalone RBAC guard (duplicates logic from CombinedAuthGuard — **dead code**) |
| `roles.decorator.ts` | Decorator | `@Roles(...)` — sets role metadata for guard evaluation |
| `public.decorator.ts` | Decorator | `@Public()` — marks endpoint as unauthenticated |
| `plan.decorator.ts` | Decorator | `@Plan(...)` and `@RequireFeature(...)` — sets metadata for PlanGuard |
| `org-context.interceptor.ts` | Interceptor | **Global.** Sets PostgreSQL session variable `app.current_org_id` for RLS |
| `decorators/org-context.decorator.ts` | ParamDecorator | `@OrgContext()` — extracts orgId from request |

### Feature Modules (18 total)

| # | Module | Path | Status | Controllers | Services | Guards | Gateways | Tests |
|---|---|---|---|---|---|---|---|---|
| 1 | **prisma** | `prisma/` | Complete | 0 | 1 (PrismaService) | 0 | 0 | 0 |
| 2 | **auth** | `auth/` | Complete | 1 (4 routes) | 1 | 0 | 0 | 0 |
| 3 | **mfa** | `mfa/` | Complete* | 1 (3 routes) | 1 | 0 | 0 | 0 |
| 4 | **devices** | `devices/` | Complete | 1 (8 routes) | 3 | 1 | 1 | 1 |
| 5 | **alerts** | `alerts/` | Complete | 1 (7 routes) | 3 | 0 | 1 | 1 |
| 6 | **ai** | `ai/` | Complete** | 2 (4 routes) | 5 | 0 | 0 | 2 |
| 7 | **billing** | `billing/` | Complete | 1 (7 routes) | 1 + config | 1 (PlanGuard) | 0 | 3 |
| 8 | **reporting** | `reporting/` | Complete | 1 (8 routes) | 6 | 0 | 0 | 0 |
| 9 | **security** | `security/` | Complete | 1 (8 routes) | 3 | 0 | 0 | 2 |
| 10 | **remote-support** | `remote-support/` | Complete | 1 (13 routes) | 1 | 0 | 1 | 0 |
| 11 | **network** | `network/` | Complete | 1 (10 routes) | 1 | 0 | 1 | 1 |
| 12 | **inventory** | `inventory/` | Complete | 1 (4 routes) | 1 | 0 | 0 | 0 |
| 13 | **backups** | `backups/` | **Partial** | 1 (10 routes) | 1 | 0 | 0 | 0 |
| 14 | **kb** | `kb/` | Complete | 1 (6 routes) | 1 | 0 | 0 | 1 |
| 15 | **sso** | `sso/` | Complete*** | 1 (4 routes) | 1 | 0 | 0 | 0 |
| 16 | **audit** | `audit/` | Complete | 1 (3 routes) | 1 | 0 | 0 | 0 |
| 17 | **retention** | `retention/` | Complete | 1 (4 routes) | 1 | 0 | 0 | 0 |
| 18 | **encryption** | `encryption/` | Complete**** | 1 (1 route) | 1 | 0 | 0 | 0 |
| 19 | **admin** | `admin/` | Complete | 1 (6 routes) | 1 | 0 | 0 | 0 |

**Notes:**
- \* MFA: enrollment/activation complete, but **not integrated into login flow**, no disable endpoint, no backup codes
- \** AI: `SanitizePipe` defined but not applied to any endpoint; `ChatMessageDto` unused
- \*** SSO: IdP token validation is **minimal** (length check only — not real SAML/OIDC verification)
- \**** Encryption: no unit tests

---

## Authentication Architecture

### JWT Token Flow

```
User → POST /auth/login { email, password }
  │
  ├─ AuthService.login()
  │    ├─ Find user by email (Prisma)
  │    ├─ bcrypt.compare(password, hash)
  │    ├─ generateTokens(userId, orgId, role)
  │    │    ├─ jwt.sign({ sub, orgId, role }, JWT_SECRET, { expiresIn: '15m' })
  │    │    └─ Create RefreshToken record (random hex, 7d expiry)
  │    └─ Return { user, accessToken, refreshToken }
  │
  ├─ Client stores both tokens in localStorage
  │
  └─ Subsequent requests: Authorization: Bearer <accessToken>
```

### Refresh Token Rotation

```
POST /auth/refresh { refreshToken }
  │
  ├─ Look up RefreshToken in DB (includes user relation)
  ├─ Validate: not revoked, not expired
  ├─ Revoke old token (set revokedAt)
  ├─ Generate new token pair
  └─ Return { user, accessToken, refreshToken }
```

### RBAC Hierarchy

```
Owner (4) > Admin (3) > Technician (2) > Viewer (1)
```

**CombinedAuthGuard** (global) enforces:
1. If `@Public()` → skip auth entirely
2. If no `@Roles()` → allow any authenticated user
3. If `@Roles()` present → check user's role level >= minimum required level

### Organization Context

**OrgContextInterceptor** (global) extracts `orgId` from the JWT payload and sets a PostgreSQL session variable:
```sql
SELECT set_config('app.current_org_id', '<orgId>', true)
```
This enables row-level security (RLS) at the database level for tenant isolation.

### Plan-Based Feature Gating

**PlanGuard** (global) reads `@Plan()` or `@RequireFeature()` metadata:
- If `@Plan('Business')` → checks org's plan meets or exceeds Business tier
- If `@RequireFeature('sso')` → checks if org's plan includes that feature

Plan tiers: **Free** → **Pro** ($29) → **Business** ($99) → **Enterprise** ($299)

### Global Guard Execution Order

NestJS evaluates `APP_GUARD` providers in registration order:
1. **CombinedAuthGuard** — JWT verification + RBAC
2. **PlanGuard** — plan/feature gating (only runs if decorators present)
3. **ThrottlerGuard** — rate limiting

### Request Lifecycle

```
Request
  │
  ├─ ThrottlerGuard (rate limit check)
  ├─ CombinedAuthGuard (JWT + RBAC)
  ├─ PlanGuard (plan/feature check)
  ├─ OrgContextInterceptor (set PostgreSQL org_id)
  ├─ MetricsInterceptor (start timer)
  ├─ ValidationPipe (DTO validation + transform)
  ├─ Controller method
  ├─ Service logic
  └─ Response → MetricsInterceptor (record duration + status)
```

---

## API Architecture

### Route Organization

Routes follow a flat module structure with NestJS's default module prefixing:

| Prefix Pattern | Module | Example Routes |
|---|---|---|
| `/auth/*` | auth | login, signup, refresh, logout |
| `/mfa/*` | mfa | enroll, verify, status |
| `/devices/*` | devices | register, metrics, list, get, scores |
| `/alerts/*` | alerts | rules CRUD, list, acknowledge |
| `/ai/*` | ai | troubleshoot, providers/status, router/stats |
| `/billing/*` | billing | checkout, portal, plan, usage, webhook |
| `/reports/*` | reporting | generate, list, download, branding, schedules |
| `/security/*` | security | scans, findings, executive-summary, export-pdf |
| `/remote-support/*` | remote-support | sessions, recordings, audit-logs |
| `/network/*` | network | discovery, devices, scans, topology, diagnostics |
| `/inventory/*` | inventory | report, drivers, software, catalog |
| `/backups/*` | backups | jobs CRUD, runs, restore-points, restore |
| `/kb/*` | kb | articles CRUD, query (semantic search) |
| `/admin/*` | admin | dashboard, org, users |
| `/audit/*` | audit | logs, export/csv, export/json |
| `/admin/retention/*` | retention | policy CRUD, enforce, enforce-all |
| `/admin/encryption/*` | encryption | verify |
| `/admin/sso/*` | sso | config, disable |
| `/auth/sso/*` | sso | sso/login (public) |
| `/health`, `/metrics` | root | health check, Prometheus metrics |
| `/demo/*` | root | RBAC demo endpoints |

### Module Communication

Modules communicate via **direct dependency injection** (not events/message passing):

| Consumer | Provider | Purpose |
|---|---|---|
| `devices` | `alerts` (AlertEvaluationService, AlertsGateway, NotificationService) | Evaluate alert rules on metric ingestion, broadcast alerts |
| `devices` | `billing` (getPlanConfig) | Enforce device limits |
| `ai` | `kb` (KbService via forwardRef) | RAG: query KB for relevant articles |
| `ai` | `billing` (getPlanConfig) | Enforce AI query limits |
| `reporting` | `ai` (AiOrchestratorService) | AI-generated executive summaries |
| `reporting` | `billing` (getPlanConfig) | Enforce report limits |
| `kb` | `ai` (AiOrchestratorService via forwardRef) | Generate embeddings |

### Validation Approach

- **Global:** `ValidationPipe` with `whitelist: true` (strips unknown props) and `transform: true` (auto-converts types)
- **DTOs:** Most modules use inline `@Body()` type annotations instead of dedicated DTO classes
- **DTO files present:** `devices/` (3 DTOs with class-validator decorators), `alerts/` (4 DTOs), `reporting/` (3 DTOs), `security/` (2 DTOs), `ai/` (2 DTOs)
- **DTO files absent:** `auth`, `mfa`, `billing`, `remote-support`, `network`, `inventory`, `backups`, `kb`, `sso`, `audit`, `retention`, `admin` — all use inline types

### Error Handling

- **HTTP exceptions:** NestJS built-in (`NotFoundException`, `UnauthorizedException`, `ForbiddenException`, `BadRequestException`, `ConflictException`)
- **Validation errors:** Automatic via `ValidationPipe` + class-validator
- **Telemetry errors:** `MetricsInterceptor` captures error status codes
- **OpenTelemetry:** Graceful degradation — telemetry init failure is non-fatal
- **No global exception filter** — relies on NestJS default exception handling

### Logging

- **OpenTelemetry:** Distributed tracing via `@opentelemetry/auto-instrumentations-node`
- **Prometheus:** HTTP request duration, total requests, AI cost/latency/tokens
- **Console:** Minimal `console.log` in bootstrap and telemetry
- **No structured logging library** (no Winston, Pino, or similar)
- **No request-level logging middleware**

### WebSocket Gateways (3 total)

| Gateway | Namespace | Purpose | Events |
|---|---|---|---|
| `DevicesGateway` | `/metrics` | Real-time device metrics | `metrics`, `alerts` → room `org:{orgId}` |
| `AlertsGateway` | `/metrics` | Alert broadcasting (shares namespace) | `alerts` → room `org:{orgId}` |
| `RemoteSupportGateway` | `/remote` | WebRTC signaling + screen sharing | `signal`, `screen-frame`, `input-event`, `session-ended` |
| `NetworkGateway` | `/network` | Topology + diagnostics broadcast | `topology`, `diagnostics` |

All gateways use Socket.IO with `cors: { origin: '*' }`.

### Background Worker Integration

- **BullMQ queues:** `alert` (notifications), `default` (catch-all) — processed by `apps/worker`
- **Direct integration:** `NotificationService` in `alerts/` sends webhook POSTs directly (not via queue)
- **No BullMQ producer** exists in the backend — the worker currently operates independently
- The `TF_API_URL` env var in the worker is declared but unused, suggesting planned but not-yet-implemented backend→worker communication

---

## Backend Strengths

1. **Well-structured module system:** Clean NestJS module boundaries with proper dependency injection
2. **Multi-layered security:** JWT + RBAC + PlanGuard + rate limiting + tenant isolation (RLS)
3. **Comprehensive AI routing:** 6 providers with circuit breaker, cost tracking, usage limits per plan
4. **Envelope encryption:** Production-grade KEK/DEK architecture for API key storage
5. **Plan-based feature gating:** Full billing integration with Stripe, graceful downgrade, feature flags
6. **Real-time capabilities:** 3 WebSocket gateways for live metrics, alerts, and remote support
7. **RAG knowledge base:** AI-powered semantic search with embeddings and cosine similarity
8. **Report generation:** 3 formats (PDF/DOCX/HTML) with branding, AI summaries, and scheduling
9. **Scoring algorithms:** Documented health/performance/risk scoring with test coverage
10. **OpenTelemetry:** Distributed tracing from day one, non-fatal initialization

---

## Backend Weaknesses

1. **MFA not enforced:** TOTP enrollment exists but is never checked during login — MFA is decorative
2. **SSO token validation is a stub:** IdP token validated by length check only (`token.length >= 10`)
3. **No global exception filter:** Unhandled errors return raw NestJS defaults (no structured error responses)
4. **No structured logging:** Console.log only — no log levels, no request correlation IDs, no log shipping
5. **Inconsistent DTO usage:** Some modules use class-validator DTOs, most use inline `@Body()` types
6. **Duplicate RBAC logic:** `RolesGuard` duplicates `CombinedAuthGuard` role-checking — `RolesGuard` is dead code
7. **No refresh token in guard:** `CombinedAuthGuard` only checks access token — no refresh token rotation validation at the guard level
8. **WebSocket CORS wide open:** All 3 gateways use `cors: { origin: '*' }` — insecure for production
9. **Backup execution is simulated:** `BackupsService.executeRun()` waits 2s and returns random data
10. **No request timeout middleware:** Slow AI provider responses could block request threads
11. **`JWT_REFRESH_SECRET` is dead code:** Defined in `AuthService` but never used
12. **`OrgContextInterceptor` uses `$executeRawUnsafe`:** SQL injection risk if `orgId` is ever not from a verified JWT
13. **Hardcoded JWT fallback secret:** `'dev-secret-change-in-production-abc123'` in guards
14. **No integration tests:** Only unit tests with mocked Prisma — no real DB integration tests
15. **`devices/register-public` is `@Public()`:** Device registration without authentication — relies only on x-org-id header

---

## Dead / Unused Code

| File / Code | Location | Issue |
|---|---|---|
| `RolesGuard` | `common/roles.guard.ts` | Duplicates RBAC logic already in `CombinedAuthGuard`; never registered as global guard |
| `JWT_REFRESH_SECRET()` | `auth/auth.service.ts` | Defined but never used — refresh tokens are opaque random strings |
| `SanitizePipe` | `ai/guards/sanitize.pipe.ts` | Defined but never applied via `@UsePipes()` on any endpoint |
| `ChatMessageDto` | `ai/dto/chat.dto.ts` | Defined but no controller uses it — likely planned for future chat feature |
| `conversationId` field | `ai/dto/troubleshoot.dto.ts` | Accepted in DTO but never read by the controller |
| `ServiceChecksDto` | `alerts/dto/service-check.dto.ts` | Wrapper type never referenced anywhere |
| `key-management.docs.ts` | `encryption/key-management.docs.ts` | Pure documentation file exporting empty object — not dead code per se, but unusual |
| `demo.controller.ts` | Root `src/` | Demo/test endpoints — should not exist in production |
| Duplicate `tsconfig.json` | Root + base | Two identical TypeScript configs |

---

## Production Readiness

### Production-Ready Modules

| Module | Confidence | Notes |
|---|---|---|
| **prisma** | High | Standard global service pattern |
| **auth** | High | Full signup/login/refresh/logout lifecycle with bcrypt + JWT |
| **devices** | High | Complete CRUD + metrics pipeline + scoring + tests |
| **alerts** | High | Full CRUD + evaluation engine + debouncing + tests |
| **billing** | High | Stripe integration + webhook handling + plan enforcement + tests |
| **reporting** | High | 3 report types + 3 formats + AI summaries + branding |
| **security** | High | Scanning + scoring + executive summaries + tests |
| **network** | High | Real diagnostics + topology + WebSocket + tests |
| **kb** | High | RAG with embeddings + cosine similarity + tests |
| **audit** | High | Logging + query + CSV/JSON export + domain helpers |
| **admin** | High | Dashboard + user management + role control |
| **encryption** | Medium | Envelope encryption works but has **no tests** |

### Partial Modules

| Module | Issue |
|---|---|
| **backups** | CRUD complete but `executeRun()` and `restoreRun()` are **simulated** — no real backup engine |
| **remote-support** | Full session lifecycle + WebRTC signaling, but no actual WebRTC/media server integration |
| **inventory** | Working but `POST /inventory/report` has **no authentication decorator** |

### Modules Needing Verification (AH-2)

| Module | Issue |
|---|---|
| **mfa** | Enrollment works but **not enforced at login** — needs integration verification |
| **sso** | Config/JIT provisioning works but **IdP token validation is a stub** — critical security gap |
| **retention** | Logic is correct but **no scheduling mechanism** — enforcement is manual only |

---

## Recommendations for AH-2

1. **Verify MFA login integration:** Confirm whether `AuthService.login()` checks `isMfaEnabled` — current evidence says it does not
2. **Verify SSO token validation:** The `length >= 10` check is almost certainly a placeholder — confirm no real SAML/OIDC verification exists
3. **Test Prisma schema completeness:** Verify all 27+ models referenced in code exist in `schema.prisma`
4. **Test WebSocket connections:** Verify namespace isolation and room-based broadcasting works end-to-end
5. **Test Stripe webhook signature verification:** Confirm `stripe.webhooks.constructEvent()` is properly implemented
6. **Test AI provider circuit breaker:** Verify reset timing, fallback chain, and cost tracking accuracy
7. **Test plan limit enforcement:** Verify device/report/AI query limits are actually enforced at the service level
8. **Test `OrgContextInterceptor`:** Verify RLS session variable is correctly set and used by Prisma queries
9. **Verify `devices/register-public` security:** This endpoint is `@Public()` — confirm it cannot be abused
10. **Test backup simulation awareness:** Confirm the UI does not present simulated backups as real

---

## Test Coverage Summary

| Module | Test File | Test Count | Coverage |
|---|---|---|---|
| devices | `scoring.service.spec.ts` | 8 | Health/performance/risk scoring formulas |
| alerts | `alert-evaluation.service.spec.ts` | 6 | Threshold evaluation, debouncing, operators |
| ai | `ai-orchestrator.service.spec.ts` | 4 | Provider fallback, usage logging |
| ai | `troubleshooting.controller.spec.ts` | 4 | Anti-hallucination, prompt guardrails |
| billing | `billing.integration.spec.ts` | ~12 | Stripe customer, plan limits, webhook events |
| billing | `plan-guard.spec.ts` | 6 | Plan/feature guard logic |
| billing | `plan-features.spec.ts` | ~8 | Tier configs, hierarchy, limits |
| security | `security.integration.spec.ts` | 4 | Findings submission, scan retrieval |
| security | `security-scoring.service.spec.ts` | 8 | Scoring formula, risk levels |
| kb | `kb.service.spec.ts` | 4 | Article CRUD, semantic search, chunking |
| network | `network.service.spec.ts` | ~6 | Topology, device listing, discovery |
| **Total** | **11 spec files** | **~70 tests** | **6 of 18 modules tested** |

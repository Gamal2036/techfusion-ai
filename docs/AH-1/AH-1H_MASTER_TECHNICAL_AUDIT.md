# AH-1H — Master Technical Audit

**Repository:** Tech Fusion AI
**Date:** 2026-07-16
**Status:** Consolidated audit — no code modifications
**Sources:** AH-1A through AH-1G discovery reports

---

# Executive Verdict

Tech Fusion AI is a **Partial MVP** with a valid and well-structured architecture that does not require rebuilding. The monorepo, multi-tenant database, AI routing, and frontend are all architecturally sound. However, the project has **4 Critical, 10 High, and 15 Medium issues** that prevent B2B V1 deployment. The most damaging gaps are: broken frontend–backend API contracts (team management, report generation), absent token refresh, committed secrets, and a non-functional worker queue. The architecture is suitable for B2B, but significant integration and security work is required before production.

---

# Current Architecture

## Frontend
- **Stack:** Next.js 14 (App Router), React 18, Tailwind CSS, Framer Motion, Recharts
- **Routes:** 18 (3 top-level + 15 dashboard)
- **Auth:** JWT via localStorage, no token refresh, no 401 interceptor
- **Real-time:** Socket.IO for metrics/alerts, raw WebSocket for remote support, hand-rolled SSE for AI chat
- **Shared UI:** 8 components in `@techfusion/ui` (Button, Card/GlassPanel, Input, Dialog, Table, Badge, ScorePill, Toaster)
- **Status:** 14/17 pages fully connected to real API. Team management, report generation, and remote support have broken or hardcoded integrations.

## Backend
- **Stack:** NestJS 10 (Express), TypeScript, Prisma ORM
- **Routes:** 115 HTTP endpoints, 4 WebSocket gateways, 18 feature modules
- **Auth:** JWT + RBAC (Owner/Admin/Technician/Viewer) + PlanGuard (Free/Pro/Business/Enterprise) + ThrottlerGuard
- **Multi-tenancy:** OrgContextInterceptor sets PostgreSQL session variable; RLS policies on 31/34 tables
- **AI:** Smart router across 6 providers with circuit breaker, usage tracking, plan limits
- **Payments:** Stripe integration (placeholder keys in config)
- **Observability:** OpenTelemetry (OTLP gRPC), Prometheus metrics
- **Status:** Core modules production-ready. MFA, SSO, and backups have partial implementations. Worker integration absent.

## Database
- **Engine:** PostgreSQL 16 + TimescaleDB
- **Schema:** 34 models, 3 enums, 8 migrations
- **RLS:** 31 tables covered; AiMessage missing RLS and orgId
- **Hypertable:** DeviceMetric (composite PK drift from Prisma — known TimescaleDB pattern)
- **Indexes:** Comprehensive, covering all major query patterns
- **Status:** Well-designed but needs AiMessage RLS, RefreshToken FK constraint, and encryption of sensitive fields.

## Device Agent
- **Stack:** Rust (edition 2021), Tokio, sysinfo, reqwest
- **Active modules:** 6 (main, agent, config, client, collector, registration)
- **Dead modules:** 4 (remote, inventory, network_discovery, security) — 1,463 lines not compiled
- **Metrics collected:** CPU, RAM, disk usage, network bytes, process count, uptime
- **Missing metrics:** Temperature, battery, load averages, disk I/O, service checks — all hardcoded to None
- **Status:** Core metrics pipeline works. 4 feature modules exist but are never compiled. No systemd unit, no auto-update, no local buffering.

## AI
- **Architecture:** Single orchestrator (`AiOrchestratorService`) + smart router (`AiRouterService`) + circuit breaker
- **Providers:** Anthropic, OpenAI, Gemini, Groq, OpenRouter, Ollama
- **RAG:** KB with embedding (text-embedding-3-small), chunking (500-char window), cosine similarity in JS (no vector DB)
- **Streaming:** SSE for troubleshooting endpoint only
- **Conversation persistence:** Schema-only (AiConversation/AiMessage models exist but unused)
- **Status:** Core orchestration and routing production-ready. KB search is in-memory O(n) — will not scale. Conversation history unimplemented.

## Worker
- **Stack:** BullMQ + Redis, Node.js 22
- **Queues defined:** alert, default
- **Backend queue producers:** None — backend has no BullMQ or Redis client dependency
- **Tests:** None (`"test": "echo 'no tests yet'"`)
- **Status:** Non-functional skeleton. Worker connects to Redis but no jobs are ever enqueued.

## Infrastructure
- **Docker Compose:** 5 services (postgres, redis, api-gateway, web, worker). Agent excluded (runs on device hosts).
- **Kubernetes:** Helm chart with 4 subcharts (Prometheus, Grafana, Loki, cert-manager), HPA on all services, nginx ingress with TLS
- **Observability:** Prometheus, Grafana (5 dashboards), Loki, OpenTelemetry Collector
- **Status:** Compose validates. K8s chart complete but uses placeholder secrets.

## CI/CD
- **CI:** lint → build → test → docker build → push to GHCR
- **CD Staging:** Auto-deploy via Helm on CI success
- **CD Production:** Manual dispatch with smoke test
- **Status:** All 3 pipelines defined and structurally valid.

---

# Project Maturity

## Classification: Partial MVP

**Evidence for Partial MVP (not Prototype or Foundation):**
- 4 applications with distinct responsibilities in a working monorepo structure
- 34 Prisma models with comprehensive indexing and RLS
- 115 backend HTTP routes across 18 feature modules with real business logic
- 18 frontend pages, 14 fully connected to real API endpoints
- Multi-tenant isolation via RLS and OrgContextInterceptor
- JWT auth with RBAC hierarchy and plan-based feature gating
- AI routing across 6 providers with circuit breaker
- Stripe billing integration (scaffolded)
- Docker Compose, Kubernetes Helm chart, CI/CD pipelines all defined
- TypeScript typecheck and build pass across all 7 packages

**Evidence against Advanced MVP or higher:**
- 4 Critical issues (token refresh broken, API contract mismatches, committed secrets)
- 10 High issues (worker disconnected, K8s placeholder secrets, hardcoded URLs)
- Backup execution is simulated
- Remote support has no real WebRTC/media server
- MFA not enforced at login
- SSO validation is a stub
- No integration tests
- No structured logging
- KB search is in-memory O(n)

---

# Readiness Scorecard

| Domain | Score | Justification |
|--------|:-----:|---------------|
| **Architecture** | 72 | Valid monorepo, clear service boundaries, appropriate framework choices. Docked for dead worker integration, dead agent modules, and missing shared package usage. |
| **Backend** | 68 | Strong module system, real business logic in 12/18 modules. Docked for MFA not enforced, SSO stub, no global exception filter, no structured logging, simulated backups. |
| **Database** | 70 | 34 well-designed models, comprehensive RLS, TimescaleDB hypertable. Docked for AiMessage missing RLS, RefreshToken missing FK, seed dimension mismatch, no DB-level retention. |
| **Frontend** | 65 | 14/17 pages fully connected, real API integration, SSE streaming. Docked for no token refresh, 17 duplicate getAuthHeaders, hardcoded localhost, no middleware, no RBAC enforcement. |
| **Device Agent** | 55 | Core metrics pipeline works, registration and retry logic functional. Docked for 4 dead modules (1,463 lines), 9 stubbed metrics, no buffering, no re-registration on 401. |
| **AI** | 60 | Production-quality orchestrator, router, circuit breaker, usage tracking. Docked for in-memory KB search, no conversation persistence, no vector DB, streaming token counts return zero. |
| **Security** | 25 | Secrets committed to git, K8s secrets are placeholders, hardcoded JWT fallback, MFA not enforced, SSO is stub, no output filtering on AI, no CSP headers, WebSocket CORS `*`. |
| **Integration** | 40 | 4 broken frontend–backend route mismatches, worker completely disconnected, no backend queue producers, NetworkWS never connected, duplicate WS connections. |
| **Testing** | 30 | ~70 unit tests across 6/18 modules. No integration tests, no E2E tests verified, worker has zero tests, no RLS verification tests, no DB integration tests. |
| **Deployment** | 70 | CI/CD pipelines defined, Docker Compose validates, K8s chart complete with HPAs and ingress. Docked for placeholder secrets, missing health checks, agent not in compose. |
| **Overall B2B Readiness** | **50** | Architecture is valid but critical integration, security, and deployment gaps must be resolved before any B2B customer could use the platform. |

---

# Verified Strengths

1. **Valid monorepo architecture** — pnpm + Turborepo with clear app/package boundaries and dependency graph
2. **Multi-tenant database isolation** — RLS on 31/34 tables with session-variable-based org context
3. **Comprehensive backend module system** — 18 NestJS modules with proper DI, guards, and interceptors
4. **AI provider routing with circuit breaker** — 6 providers, smart/cost/speed/round-robin strategies, automatic fallback
5. **Envelope encryption** — Production-grade KEK/DEK architecture for API key storage
6. **Plan-based feature gating** — Full billing integration with Stripe, plan tiers, and per-feature limits
7. **Real-time capabilities** — 3 WebSocket gateways + SSE streaming for AI chat
8. **RAG knowledge base** — Semantic search with embeddings and cosine similarity (works, but does not scale)
9. **Report generation** — 3 formats (PDF/DOCX/HTML) with branding, AI summaries, and scheduling
10. **OpenTelemetry from day one** — Distributed tracing, Prometheus metrics, 5 Grafana dashboards
11. **CI/CD pipelines complete** — lint → build → test → docker → deploy for staging and production
12. **Device agent metrics pipeline** — Clean Rust implementation with retry logic and graceful shutdown

---

# Consolidated Risk Register

## Critical (4)

| # | Issue | Domain | Source |
|---|-------|--------|--------|
| C1 | **No token refresh mechanism** — frontend stores refreshToken but never uses it; expired JWT forces re-login | Authentication | AH-1F, AH-1G |
| C2 | **Committed secrets in git** — JWT_SECRET, JWT_REFRESH_SECRET, AI_ENCRYPTION_KEY in `.env` committed to repository | Secrets | AH-1G |
| C3 | **K8s production secrets are placeholders** — `change-me-in-production` for all cryptographic keys; deploying as-is is a security incident | Secrets | AH-1G |
| C4 | **Frontend–backend route mismatches** — Team management (3 routes) and report generation (1 route) call endpoints that do not exist on the backend | Integration | AH-1G |

## High (10)

| # | Issue | Domain | Source |
|---|-------|--------|--------|
| H1 | **Worker queue system disconnected** — backend has no BullMQ/Redis dependency; worker connects but nothing enqueues jobs | Worker | AH-1G |
| H2 | **Hardcoded logout URL** — `http://localhost:3001/auth/logout` in Topbar; fails on any non-localhost deployment | Frontend–Backend | AH-1F, AH-1G |
| H3 | **Hardcoded `orgId='demo'` in remote support WebSocket** — breaks multi-tenant remote support | Multi-tenant | AH-1F |
| H4 | **No 401 interceptor on frontend** — expired tokens cause silent failures without refresh attempt | Authentication | AH-1F |
| H5 | **No centralized auth utility** — 17 independent copies of `getAuthHeaders()` across the frontend | Frontend | AH-1F |
| H6 | **No client-side middleware** — route protection relies solely on dashboard layout; direct URL access briefly exposes content | Frontend | AH-1F |
| H7 | **Duplicate Toaster instances** — root and dashboard layouts both render `<Toaster>`, causing duplicate notifications | Frontend | AH-1F |
| H8 | **No global error boundary** — only AI chat has `ChatErrorBoundary`; uncaught errors crash the React tree | Frontend | AH-1F |
| H9 | **AiMessage has no RLS and no orgId** — cross-organization access possible via direct DB query | Database | AH-1C |
| H10 | **RefreshToken.orgId has no FK to Organization** — orphan tokens with invalid orgId possible | Database | AH-1C |

## Medium (15)

| # | Issue | Domain | Source |
|---|-------|--------|--------|
| M1 | **MFA not enforced at login** — TOTP enrollment exists but AuthService never checks `isMfaEnabled` | Auth | AH-1B |
| M2 | **SSO token validation is a stub** — IdP token validated by length check only (`token.length >= 10`) | Auth | AH-1B |
| M3 | **Backup execution is simulated** — `BackupsService.executeRun()` waits 2s and returns random data | Worker | AH-1B |
| M4 | **Remote support has no WebRTC/media server** — full session lifecycle exists but no actual screen sharing | Integration | AH-1B |
| M5 | **KB similarity search is in-memory O(n)** — loads all org embeddings into Node.js; will not scale | AI | AH-1E |
| M6 | **Conversation persistence is schema-only** — AiConversation/AiMessage models exist but nothing creates or reads them | AI | AH-1E |
| M7 | **Streaming returns zero tokens** — both Anthropic and OpenAI providers return `promptTokens: 0, completionTokens: 0` when streaming | AI | AH-1E |
| M8 | **Embedding cost invisible in usage logs** — only completion costs logged; embedding calls not tracked | AI | AH-1E |
| M9 | **No structured logging** — console.log only; no log levels, no request correlation IDs | Backend | AH-1B |
| M10 | **No global exception filter** — unhandled errors return raw NestJS defaults | Backend | AH-1B |
| M11 | **WebSocket CORS wide open** — all 3 gateways use `cors: { origin: '*' }` | Security | AH-1B |
| M12 | **Duplicate WebSocket connections** — useWebSocket and useAlertWebSocket both connect to `/metrics` independently | Integration | AH-1F |
| M13 | **Network topology WebSocket never connected** — backend broadcasts on `/network` but frontend never subscribes | Integration | AH-1G |
| M14 | **Seed embedding dimension mismatch** — seed.ts uses dim=64, production uses 1536 | Database | AH-1C |
| M15 | **Docker Compose api-gateway missing REDIS_URL and auth secrets** — service may fail to start correctly | Deployment | AH-1G |

---

# Feature Completion Matrix

## Fully Implemented

| Feature | Evidence |
|---------|----------|
| Auth signup/login/logout | Full lifecycle with bcrypt + JWT + refresh token rotation |
| JWT RBAC | CombinedAuthGuard with 4-tier hierarchy, enforced globally |
| Plan-based feature gating | PlanGuard + @Plan/@RequireFeature decorators, 4 tiers |
| Device registration | Public endpoint with org token, device token persistence |
| Device metrics collection | Rust agent collecting CPU/RAM/disk/network every 30s |
| Device metrics storage | TimescaleDB hypertable with proper indexing |
| Device health scoring | Algorithms for health/performance/risk with test coverage |
| Alert rule CRUD | Full CRUD with evaluation engine, debouncing, operators |
| Alert WebSocket broadcasting | AlertsGateway emits to org rooms |
| AI provider routing | 6 providers, smart/cost/speed/round-robin strategies |
| AI circuit breaker | Failure threshold + reset window, in-memory |
| AI usage and cost tracking | Logged to DB with tokens, latency, cost |
| AI plan enforcement | Monthly query limits by plan tier |
| SSE streaming (AI chat) | Proper headers, event types, error handling |
| KB article CRUD | Create/update/delete with auto-re-embedding |
| KB semantic search | Embedding + cosine similarity (works, does not scale) |
| Stripe billing integration | Checkout, portal, webhook handling, plan enforcement |
| Security scan submission | Findings, scoring, executive summary |
| Network diagnostics | Latency, DNS, traceroute, connectivity |
| Network topology map | SVG force-directed graph frontend component |
| Report generation | 3 formats (PDF/DOCX/HTML) with branding |
| Audit logging | CRUD with CSV/JSON export |
| Data retention policy | CRUD with manual enforcement |
| Envelope encryption | AES-256-GCM with KEK/DEK architecture |
| OpenTelemetry | Distributed tracing with OTLP gRPC exporter |
| Prometheus metrics | HTTP duration, request count, AI cost/latency/tokens |
| CI pipeline | lint → build → test → docker build → push |
| CD staging | Auto-deploy via Helm on CI success |
| CD production | Manual dispatch → Helm deploy → smoke test |
| K8s Helm chart | Full chart with HPAs, ingress, subcharts |
| Docker Compose local dev | 5 services with health checks and dependency chain |
| Frontend design system | 8 shared UI components with glassmorphism theme |
| Frontend dashboard | 15 dashboard pages with real API integration |

## Partially Implemented

| Feature | Gap |
|---------|-----|
| MFA (TOTP) | Enrollment works; not enforced at login; no disable endpoint; no backup codes |
| SSO (SAML/OIDC) | Config/JIT provisioning works; IdP token validation is length check only |
| Remote support | Full session lifecycle + WebRTC signaling; no actual WebRTC/media server |
| Backups | CRUD works; executeRun() and restoreRun() are simulated |
| Device agent metrics | CPU/RAM/disk/network/processes/uptime collected; temperature/battery/load/disk I/O/services stubbed |
| AI conversation persistence | Schema exists (AiConversation/AiMessage); no code creates or reads |
| KB chunking | 500-char sliding window; splits mid-sentence/word/code-block |
| RLS coverage | 31/34 tables covered; AiMessage missing |

## Present but Disconnected

| Feature | Gap |
|---------|-----|
| Worker queue processing | Worker has BullMQ; backend has no queue producers |
| Agent security scanning | Module exists (382 lines), never compiled |
| Agent inventory collection | Module exists (374 lines), never compiled |
| Agent network discovery | Module exists (428 lines), never compiled |
| Agent remote support | Module exists (279 lines), never compiled; uses blocking HTTP incompatible with Tokio |
| Network topology WebSocket | Backend broadcasts on `/network`; frontend never subscribes |
| Frontend KB semantic search | `useKbQuery` hook exported but never imported by any page |
| `@techfusion/config` theme | Full theme object exported but never imported by web app |
| `@techfusion/types` package | Types defined but never imported by web app |
| `@techfusion/utils` package | Utilities defined but never imported by web app |

## Simulated or Stubbed

| Feature | Evidence |
|---------|----------|
| Backup execution | `BackupsService.executeRun()` waits 2s, returns random data |
| Security executive summary | Template strings based on risk level; no AI involvement |
| Temperature/battery/load/disk I/O/service checks in agent | All hardcoded to None |
| SSO IdP token validation | `token.length >= 10` check only |
| `isLaptop` detection | Always hardcoded to `false` |
| `cpuLogical` vs `cpuCores` | Set to same value; not distinguished |

## Not Implemented

| Feature | Evidence |
|---------|----------|
| Token refresh on frontend | refreshToken stored but never used |
| Frontend RBAC enforcement | Roles displayed but not enforced on any page |
| Client-side middleware | No Next.js middleware for route protection |
| Global error boundary | Only AI chat has ChatErrorBoundary |
| Structured logging | No Winston/Pino; console.log only |
| Request timeout middleware | Slow AI responses could block threads |
| Vector database | All similarity search is in-memory JS |
| Multi-turn AI conversation | Each request is stateless |
| Agent auto-update | Version hardcoded; no update mechanism |
| Agent systemd service | No daemonization support |
| Agent local data buffering | Metrics lost if backend unreachable |
| Database backup/restore | No configuration or documentation found |
| Content moderation on AI output | Responses streamed directly to client |
| PII detection | No check in user queries or AI responses |
| Connection pooling config | Not visible in Prisma config |
| DB-level retention | TimescaleDB `drop_chunks()` not used; app-level only |

---

# B2B V1 Required Scope

These items must be completed before B2B V1 can ship.

## Security (must complete)
1. Remove committed secrets from git; rotate all keys
2. Replace K8s placeholder secrets with proper secret management
3. Implement frontend token refresh mechanism
4. Implement 401 interceptor with automatic retry
5. Fix hardcoded logout URL to use environment variable
6. Add Next.js middleware for route protection
7. Encrypt sensitive DB fields (TURN credentials, SSO certificates)
8. Restrict WebSocket CORS origins

## Integration (must complete)
9. Fix team management route mismatches (frontend `/team/*` → backend `/admin/*`)
10. Fix report generation route mismatch (`POST /reports` → `POST /reports/generate`)
11. Fix remote support WebSocket hardcoded `orgId='demo'`
12. Connect worker queue system (add BullMQ producers to backend)
13. Fix Docker Compose api-gateway missing env vars (REDIS_URL, secrets)
14. Add Docker health checks for api-gateway, web, worker

## Database (must complete)
15. Add RLS to AiMessage (add orgId column or join-through policy)
16. Add FK constraint on RefreshToken.orgId

## Backend (must complete)
17. Enforce MFA at login flow
18. Remove demo controller from production build
19. Add global exception filter for structured error responses

## Frontend (must complete)
20. Centralize auth utility (single getAuthHeaders)
21. Add global error boundary
22. Remove duplicate Toaster
23. Fix duplicate WebSocket connections

## Device Agent (must complete)
24. Wire inventory module into main loop (or remove dead code)
25. Wire security scanning module into main loop (or remove dead code)
26. Implement agent re-registration on 401

---

# Deferred Scope

## Safe to Defer to B2B V1.1

| Feature | Rationale |
|---------|-----------|
| SSO real validation (SAML/OIDC) | Only needed for Enterprise tier customers |
| Backup real execution | Can be documented as "coming soon"; CRUD works |
| Remote support WebRTC/media server | Full session lifecycle works; real screen sharing is an enhancement |
| Structured logging (Winston/Pino) | Console logging works for initial deployment; upgrade later |
| Agent network discovery module | Nice-to-have; core metrics are sufficient for V1 |
| Agent temperature/battery/load metrics | Platform-specific; not all devices have these |
| KB chunking improvement | Current 500-char window works; semantic chunking is an enhancement |
| Streaming token counting | Usage tracking works for non-streaming; streaming counts are cosmetic |
| Embedding cost tracking | Costs are partially visible; full tracking is an enhancement |
| Mobile responsive layout | Desktop-first is acceptable for IT fleet management |
| Accessibility improvements | Important but not blocking B2B V1 |

## Safe to Defer to V2

| Feature | Rationale |
|---------|-----------|
| Vector database (pgvector or dedicated) | In-memory search works for small deployments; scale later |
| Multi-turn AI conversation | Stateless chat is acceptable for V1 troubleshooting |
| Agent auto-update mechanism | Manual redeployment is acceptable for V1 fleet sizes |
| Agent local data buffering | Metrics loss on connectivity issues is acceptable for V1 |
| DB-level retention (TimescaleDB drop_chunks) | App-level retention works; DB-level is an optimization |
| Content moderation / PII detection | Can be added as a guard later |
| Per-provider rate limiting | Global throttling is sufficient for V1 |
| Request timeout middleware | Can be added if issues arise in production |
| Agent systemd service | Docker containerization is sufficient for V1 |

---

# Components to Preserve

These components have valid architecture and must NOT be rebuilt:

| Component | Rationale |
|-----------|-----------|
| NestJS module system (18 modules) | Clean DI boundaries, proper separation of concerns |
| CombinedAuthGuard + PlanGuard + ThrottlerGuard | Multi-layered security with proper guard ordering |
| OrgContextInterceptor + RLS policies | Production-grade multi-tenant isolation pattern |
| AiOrchestratorService | Well-designed orchestrator with provider caching, fallback, usage logging |
| AiRouterService + CircuitBreaker | Smart routing with fault tolerance — solid pattern |
| Prisma schema (34 models) | Comprehensive, well-indexed, proper relations |
| TimescaleDB hypertable setup | Correct composite PK pattern for time-series data |
| Envelope encryption service | Production-grade KEK/DEK for API key storage |
| Stripe billing integration | Full checkout, portal, webhook flow |
| Report generation (3 formats) | PDF/DOCX/HTML with branding and AI summaries |
| Device metrics pipeline (agent + backend) | Clean Rust collection → NestJS ingestion → TimescaleDB storage |
| OpenTelemetry + Prometheus setup | Proper observability from day one |
| CI/CD pipelines | lint → build → test → docker → deploy for all environments |
| Helm chart structure | Complete with HPAs, ingress, subcharts, dashboards |
| Frontend design system (8 components) | Consistent glassmorphism theme with Radix + Tailwind |
| Frontend dashboard pages (14 connected) | Real API integration, proper loading/error states |
| Docker Compose local dev | Correct service dependencies and health checks |

---

# Components Requiring Integration

These components exist but need wiring, completion, or connection — not replacement:

| Component | Current State | Required Work |
|-----------|---------------|---------------|
| Worker queue system | BullMQ skeleton, no producers | Add BullMQ producers to backend; define job types |
| Agent inventory module | 374 lines, not compiled | Wire into main loop or remove |
| Agent security module | 382 lines, not compiled | Wire into main loop or remove |
| Agent network discovery | 428 lines, not compiled | Wire into main loop or remove |
| Agent remote support | 279 lines, blocking HTTP | Refactor to async Tokio, wire into main loop |
| MFA login integration | TOTP enrollment works, login check missing | Add `isMfaEnabled` check to AuthService.login() |
| SSO token validation | Length check only | Implement real SAML/OIDC verification |
| Frontend token refresh | Token stored, never used | Implement refresh flow with 401 interceptor |
| Frontend team management | Calls `/team/*` routes | Align with backend `/admin/*` routes |
| Frontend report generation | Calls `POST /reports` | Align with backend `POST /reports/generate` |
| Frontend remote support WS | Hardcoded `orgId='demo'` | Read orgId from JWT payload |
| Frontend auth utility | 17 duplicate copies | Extract to single shared utility |
| Network topology WS | Backend broadcasts, frontend silent | Add WebSocket connection hook |
| Backup execution | Simulated (2s wait + random data) | Replace with real backup engine |
| AI conversation persistence | Schema only | Implement creation, loading, context injection |
| Docker health checks | Only postgres/redis have them | Add for api-gateway, web, worker |
| K8s secrets | Placeholder values | Implement proper secret management |

---

# Correct AH-2 Repair Order

The repair order must respect dependencies. Security and tenancy must be addressed before deployment. API contracts must be fixed before E2E testing. Worker integration must exist before notification testing.

## Phase 1: Security Foundation
1. **Rotate and remove committed secrets** — generate new JWT_SECRET, JWT_REFRESH_SECRET, AI_ENCRYPTION_KEY; remove from git history
2. **Fix K8s secrets** — implement proper secret management (Sealed Secrets, Vault, or external secrets operator)
3. **Fix Docker Compose env vars** — add missing REDIS_URL, JWT_SECRET, and auth secrets to api-gateway service
4. **Restrict WebSocket CORS** — change `cors: { origin: '*' }` to configured origins on all 3 gateways
5. **Add AiMessage RLS** — add orgId column or join-through policy
6. **Add RefreshToken FK constraint** — add `@relation` to Organization
7. **Encrypt sensitive DB fields** — TURN credentials, SSO certificates

## Phase 2: Authentication and Session
8. **Implement frontend token refresh** — add refresh flow with 401 interceptor
9. **Fix hardcoded logout URL** — use `NEXT_PUBLIC_API_URL` environment variable
10. **Enforce MFA at login** — add `isMfaEnabled` check to AuthService
11. **Add Next.js middleware** — route protection before layout mount
12. **Centralize auth utility** — single `getAuthHeaders()` function

## Phase 3: API Contracts
13. **Fix team management routes** — align frontend `/team/*` with backend `/admin/*` or add routes
14. **Fix report generation route** — align frontend `POST /reports` with backend `POST /reports/generate`
15. **Fix remote support WebSocket** — read orgId from JWT instead of hardcoded `'demo'`
16. **Fix duplicate WebSocket connections** — merge useWebSocket and useAlertWebSocket

## Phase 4: Worker Integration
17. **Add BullMQ producers to backend** — define queue names and job types
18. **Implement worker queue consumers** — connect worker to defined queues
19. **Implement backup execution** — replace simulated backups with real engine

## Phase 5: Agent Completion
20. **Wire agent inventory module** — add `mod inventory` to main.rs, schedule collection
21. **Wire agent security module** — fix syntax error, add `mod security`, schedule scans
22. **Implement agent re-registration on 401** — attempt re-registration before next tick

## Phase 6: Frontend Hardening
23. **Add global error boundary** — wrap root layout
24. **Remove duplicate Toaster** — keep only dashboard instance
25. **Connect network topology WebSocket** — add hook for `/network` namespace
26. **Add Docker health checks** — for api-gateway, web, worker

## Phase 7: Integration Testing
27. **Add RLS verification tests** — cross-org query attempts
28. **Add integration tests** — real DB tests for critical paths
29. **Verify E2E flows** — login → dashboard → device → alerts → AI chat

---

# AH-2 Exit Criteria

AH-2 is complete when ALL of the following are true:

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| 1 | No secrets committed to git | `git log` scan, `.env` in `.gitignore` |
| 2 | K8s secrets are not placeholders | Secrets populated from external source |
| 3 | Frontend token refresh works | Login → wait for expiry → request auto-refreshes → no redirect |
| 4 | Team management page works end-to-end | Invite/remove team members via UI |
| 5 | Report generation works end-to-end | Generate report via UI, download in all formats |
| 6 | Remote support WebSocket uses real orgId | No hardcoded `'demo'` values |
| 7 | Worker processes jobs | Enqueue test job → worker picks up → job completes |
| 8 | MFA enforced at login | Enable MFA → login requires TOTP code |
| 9 | AiMessage has RLS | Cross-org query returns zero rows |
| 10 | Agent re-registers on 401 | Invalidate token → agent obtains new token |
| 11 | No critical integration mismatches | All frontend routes match backend endpoints |
| 12 | Global error boundary exists | Throw error in component → boundary catches |
| 13 | Docker Compose starts all services | `docker compose up` succeeds, all services healthy |
| 14 | E2E smoke test passes | Login → dashboard → device → alert → AI → report |

---

# Final Readiness Decision

**`READY TO BEGIN AH-2`**

The architecture is valid, the codebase compiles and builds successfully, and the foundational patterns (monorepo, multi-tenancy, AI routing, auth) are correctly implemented. AH-2 should focus exclusively on integration, security hardening, and completing disconnected components — not rebuilding.

| Metric | Value |
|--------|-------|
| **Current estimated completion** | 52% |
| **Estimated B2B V1 readiness** | 50% |
| **Critical issues** | 4 |
| **High issues** | 10 |
| **Medium issues** | 15 |
| **Low issues** | 0 (consolidated into Medium or higher) |

### Top 5 Blockers to B2B V1

1. **Broken API contracts** — Team management and report generation call non-existent backend routes; the team page and report generation are completely non-functional
2. **No token refresh** — Frontend never uses the stored refresh token; users are silently logged out on JWT expiry with no recovery path
3. **Committed secrets** — JWT_SECRET, JWT_REFRESH_SECRET, and AI_ENCRYPTION_KEY are in the git repository; any leaked repo exposes all authentication and encryption
4. **Worker disconnected** — The background job worker connects to Redis but the backend never enqueues any jobs; alerts, notifications, and scheduled tasks cannot function
5. **K8s placeholder secrets** — Production Kubernetes secrets use `change-me-in-production` values; deploying would be an immediate security incident

---

*Audit completed. No code changes, migrations, or data modifications were made.*

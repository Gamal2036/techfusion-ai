# 01 — Product Architecture

## 1. Runtime Relationship (found in code, not assumed)

```
Web (Next.js 14, apps/web)
   │  HTTPS REST (apiFetch client, JWT bearer + refresh rotation)
   │  WebSocket (socket.io /metrics: live alerts, presence, network, remote)
   ▼
API Gateway (NestJS, apps/api-gateway, :3001)
   │  Prisma → PostgreSQL/TimescaleDB (timescaledb extension; DeviceMetric hypertable)
   │  BullMQ → Redis (queue producers: monitoring sweep, alerts, backups,
   │            inventory, security, retention, kb embedding, report[dead])
   │  Stripe API (billing) · provider APIs (anthropic/openai/gemini/groq — AI)
   ▼
Worker (BullMQ, apps/worker) — 8 Workers, concurrency 5
   │  Prisma (schema synced via scripts/sync-prisma-schema.sh)
   │  POST back to gateway for report delegation / KB embedding (2 dead routes)
   ▼
Agent (Rust, apps/agent, Linux systemd) — polling loop (15s command ticker,
   30s telemetry), Bearer device token
   │  POST /devices/metrics (heartbeat+metrics) · /devices/register-public
   │  GET /network/discovery/pending · /security/pending/:id · /inventory/pending/:id
   │  GET /remote-support/agent/pending (auto-consent) · /inventory/report
   ▼
Database (TimescaleDB) / Redis / Object storage (local disk for reports)
```

Observability: OpenTelemetry SDK in gateway and worker; Prometheus metrics
(`metrics.controller.ts`, worker `:9464`); health endpoints (`/health`, worker
`/live` `/ready`).

## 2. System Context

| Component | Purpose | Tech | Entry point |
|-----------|---------|------|-------------|
| apps/web | Command center product surface | Next.js 14 (App Router), React 18, Tailwind, socket.io-client, recharts, three.js (landing) | `apps/web/src/app` |
| apps/api-gateway | All business logic + HTTP API | NestJS 10, Prisma 6, BullMQ 5, Socket.IO, Stripe | `src/main.ts` (binds `:3001`) |
| apps/worker | Background processing | Node, BullMQ, Prisma, prom-client | `src/main.ts` |
| apps/agent | Endpoint telemetry + ops | Rust 1.96, tokio, reqwest, sysinfo | `src/main.rs` |
| packages/config | shared env/rate limits | TS | — |
| packages/types | shared TS types | TS | — |
| packages/ui | shared UI kit (Radix-based) | TS/React | `src/components` |
| packages/utils | shared utilities | TS | — |

## 3. Cross-Cutting Mechanisms

- **Auth**: JWT access (15 m) + opaque refresh (7 d, DB-stored, CAS rotation on refresh, revocation on logout/membership loss). `src/auth/auth.service.ts`.
- **Authorization**: global `CombinedAuthGuard` resolves JWT → `OrganizationMember` (membership-authoritative). `PermissionsGuard` enforces ~40 `domain:action` permissions via decorators. `PlanGuard` + `RequireFeature` gate feature flags. Guard order: Throttler → CombinedAuth → Permissions → Plan.
- **Tenant isolation**: app-layer `orgId` filtering everywhere (org resolved from token → membership). RLS migrations exist but are **non-authoritative defense-in-depth** (app role is SUPERUSER+BYPASSRLS; empirically inert — `V1-STAGE-01-SUB-02` chose Option B: app-layer authoritative).
- **Device auth**: `DeviceTokenGuard` (SHA-256 of bearer vs `deviceTokenHash`, legacy plaintext fallback) → resolves org + device. Ingest endpoints additionally validate `X-Org-Id`/body org against token org.
- **Queues**: `apps/api-gateway/src/queue/queue.service.ts` produces; worker consumes. Queue names duplicated across gateway and worker (sync risk — see `06`).
- **Presence**: derived from `lastSeenAt` (see `00` §6).
- **Plans**: 4 tiers (Free/Pro/Business/Enterprise) dual-stored on `Organization.plan` + `Subscription`. Partial server-side enforcement (`09`).

## 4. Data Model Highlights (30 models, `apps/api-gateway/prisma/schema.prisma`)

- `User` (legacy single-org snapshot `orgId/role`) + `OrganizationMember` (authoritative) + `Organization` + `OrganizationInvitation` + `RefreshToken`.
- `Device` (+ `deviceTokenHash`, `identityFingerprint`, `installationId`, `credentialVersion`), `EnrollmentToken`, `CredentialRotationEvent`, `DeviceMetric` (hypertable), `DeviceHealthScore`.
- `AlertRule` / `Alert` (`activeKey` unique → one open alert per rule+device), `NetworkDevice`/`NetworkScan`, `RemoteSession` (+ recordings fields), `SoftwareInventory`/`SoftwareCatalogItem`/`Driver`/`DriverCatalogItem` (catalogs global), `SecurityScan`/`SecurityFinding`/`SecurityScore`, `KbArticle`/`KbEmbedding` (1536-dim JSON, cosine in app), `AuditLog` (immutable), `Subscription`/`Invoice`, `DataRetentionPolicy`, `Report`/`ReportTemplate`/`ReportSchedule`, `BackupJob`/`BackupRun`, `AiProviderConfig`/`AiUsageLog`/`AiConversation`/`AiMessage`, `SsoConfig`.

## 5. Failure & Recovery Design

- Agent: exponential backoff + jitter (metrics 500 ms→15 s), 60 s pause on 429, 401→re-enroll (≤3 attempts), systemd `Restart=on-failure`.
- Worker: BullMQ retries with `_correlation` envelope; alert webhook fetch 10 s timeout; retention batched (1000).
- Gateway: distributed Redis lock for presence sweep (55 s TTL) to prevent multi-replica duplicate sweeps.

## 6. Architecture Gaps (evidence-based)

1. **No single source of truth for queue constants and presence thresholds** — duplicated across gateway/worker/web with drift risk.
2. **RLS non-authoritative** — app-layer filtering is authoritative and regression-tested (`test/cross-tenant-isolation.spec.ts`); RLS kept as inert defense-in-depth (`07`, SUB-02 report).
3. **SSO login unauthenticated against IdP** (`07`, CRITICAL).
4. **CD chart undeployable as written** (`02`, `10`).
5. **Agent remote support = auto-consent stub; no real remote control** (`05`).
6. **Windows unsupported** (`05`).
7. **Report queue dead; KB embeddings mock** (`06`).
8. **`Organization.plan` + `Subscription` dual source of truth** — mitigated by `V1-STAGE-01A` lifecycle integrity work but still a maintenance risk.

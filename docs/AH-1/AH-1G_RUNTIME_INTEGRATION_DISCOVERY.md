# AH-1G — Runtime & Integration Discovery Report

> **Scope:** Root workspace, infra/docker, infra/k8s, .github/workflows, env files, all application packages
> **Date:** 2026-07-16

---

## Runtime Architecture

### Services

| Service | Type | Runtime | Port | Framework | Database |
|---|---|---|---|---|---|
| api-gateway | Backend API | Node.js 22 | 3001 | NestJS + Prisma | PostgreSQL (TimescaleDB) |
| web | Frontend | Node.js 22 | 3000 | Next.js 14 | None (API-only) |
| worker | Background | Node.js 22 | None | BullMQ + ioredis | None (Redis only) |
| agent | Device Agent | Rust (binary) | None | reqwest + sysinfo | None (API-only) |
| postgres | Database | TimescaleDB (pg16) | 5432 (host:5433) | — | — |
| redis | Cache/Queue | Redis 7 Alpine | 6379 | — | — |

### Monorepo Structure

```
techfusion-ai/
├── apps/
│   ├── api-gateway/    NestJS backend (115 HTTP routes, 3 WS namespaces, 30 Prisma models)
│   ├── web/            Next.js 14 frontend (18 routes, 12 hooks, 6 components)
│   ├── worker/         BullMQ worker (3 source files, no tests)
│   └── agent/          Rust device agent (10 source files)
├── packages/
│   ├── ui/             Shared UI components (8 components)
│   ├── config/         Theme config (unused by web app)
│   ├── types/          Shared types (unused by web app)
│   └── utils/          Shared utilities (unused by web app)
└── infra/
    ├── docker/         Docker Compose (6 services)
    └── k8s/            Helm chart with 4 dependencies
```

---

## Service Startup Order

### Docker Compose (`infra/docker/docker-compose.yml`)

```
Phase 1: postgres, redis (parallel, both have healthchecks)
Phase 2: api-gateway (depends_on: postgres (healthy), redis (healthy))
Phase 3: web (depends_on: api-gateway), worker (depends_on: redis (healthy))
```

**Verified dependency chain:**
1. `postgres` → healthcheck: `pg_isready -U techfusion` (5s interval, 5 retries)
2. `redis` → healthcheck: `redis-cli ping` (5s interval, 5 retries)
3. `api-gateway` → `depends_on: postgres (service_healthy), redis (service_healthy)`
4. `web` → `depends_on: api-gateway` (no health condition, just container start)
5. `worker` → `depends_on: redis (service_healthy)`

**Observation:** The `agent` service is not defined in docker-compose.yml. It runs on device hosts, not in the container stack.

### Kubernetes Startup (Helm chart)

```
Phase 1: postgres (StatefulSet), redis (StatefulSet)
Phase 2: api-gateway (Deployment with initContainer: prisma db push)
Phase 3: web, worker (Deployments)
Phase 4: otel-collector, monitoring stack (Prometheus, Grafana, Loki)
```

The api-gateway has a `prisma-migrate` init container that runs `npx prisma db push --accept-data-loss` before the main container starts.

---

## Ports and Environment Map

### Port Allocation

| Service | Container Port | Host Port (Docker) | K8s Service Port |
|---|---|---|---|
| postgres | 5432 | 5433 | 5432 (ClusterIP) |
| redis | 6379 | 6379 | 6379 (ClusterIP) |
| api-gateway | 3001 | 3001 | 3001 (ClusterIP) |
| web | 3000 | 3000 | 3000 (ClusterIP) |
| worker | — | — | — |
| agent | — | — | 3003 (ClusterIP) |
| otel-collector | 4317/4318 | — | 4317/4318 (ClusterIP) |
| prometheus | — | — | — (subchart) |
| grafana | — | — | — (subchart) |

### Environment Variables by Service

#### api-gateway (.env)
```
DATABASE_URL="postgresql://techfusion:techfusion@localhost:5433/techfusion"
JWT_SECRET="6034422d..." (committed to repo)
JWT_REFRESH_SECRET="848a1116..." (committed to repo)
AI_ENCRYPTION_KEY="1a99ee03..." (committed to repo)
PORT=3001
ANTHROPIC_API_KEY="" (empty)
OPENAI_API_KEY="" (empty)
GEMINI_API_KEY="" (empty)
GROQ_API_KEY="" (empty)
OPENROUTER_API_KEY="" (empty)
OLLAMA_BASE_URL="http://localhost:11434"
AI_ROUTER_STRATEGY="smart"
STRIPE_SECRET_KEY="sk_test_placeholder"
STRIPE_WEBHOOK_SECRET="whsec_placeholder"
STRIPE_PRO_PRICE_ID="price_pro"
STRIPE_BUSINESS_PRICE_ID="price_business"
STRIPE_ENTERPRISE_PRICE_ID="price_enterprise"
```

#### worker (Docker Compose)
```
REDIS_URL=redis://redis:6379
```

#### web (Docker Compose)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### agent (Runtime env vars)
```
TF_API_URL (required)
TF_DEVICE_TOKEN (for existing devices)
TF_ORG_TOKEN (for first-time registration)
TF_INTERVAL=30 (default seconds between metric sends)
```

### Missing Environment Variables (Not Configured)

| Variable | Service | Impact |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | web | Defaults to `http://localhost:3001` — may break in Docker/K8s if WS needs different host |
| `REDIS_URL` | api-gateway (Docker Compose) | Not passed in docker-compose; only in K8s manifests |
| `NODE_ENV` | worker (Docker Compose) | Not set; defaults to development |
| `DATABASE_URL` | worker | Not set; worker only uses Redis |
| `TF_API_URL` | agent | Must be provided at runtime |

---

## Docker Compose Review

### File: `infra/docker/docker-compose.yml`

| Service | Build Context | Dockerfile | Health Check | Depends On |
|---|---|---|---|---|
| postgres | `timescale/timescaledb:latest-pg16` | (image) | `pg_isready -U techfusion` | — |
| redis | `redis:7-alpine` | (image) | `redis-cli ping` | — |
| api-gateway | `../..` (root) | `apps/api-gateway/Dockerfile` | **None** | postgres (healthy), redis (healthy) |
| web | `../..` (root) | `apps/web/Dockerfile` | **None** | api-gateway (start) |
| worker | `../..` (root) | `apps/worker/Dockerfile` | **None** | redis (healthy) |

**Docker network:** Single bridge network `techfusion`.

**Volumes:** `postgres-data` (named volume).

### Issues Found

| # | Issue | Evidence |
|---|---|---|
| 1 | api-gateway has no healthcheck in docker-compose | `docker-compose.yml` — no `healthcheck` key on api-gateway |
| 2 | web has no healthcheck in docker-compose | `docker-compose.yml` — no `healthcheck` key on web |
| 3 | worker has no healthcheck in docker-compose | `docker-compose.yml` — no `healthcheck` key on worker |
| 4 | api-gateway missing `REDIS_URL` env var in docker-compose | `docker-compose.yml:28-33` — only `PORT`, `NODE_ENV`, `DATABASE_URL` set |
| 5 | api-gateway missing `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` | `docker-compose.yml:28-33` — secrets not injected |
| 6 | Worker has no tests | `apps/worker/package.json:8` — `"test": "echo 'no tests yet'"` |
| 7 | Root `Dockerfile.web` exists but not used by CI or docker-compose | CI matrix uses `apps/web` context → `apps/web/Dockerfile`; compose uses `apps/web/Dockerfile` |

---

## Kubernetes and Helm Review

### Chart: `infra/k8s/Chart.yaml`

| Dependency | Version | Condition |
|---|---|---|
| prometheus | ~25.0 | `prometheus.enabled` |
| grafana | ~8.0 | `grafana.enabled` |
| loki | ~6.0 | `loki.enabled` |
| cert-manager | ~1.15 | `cert-manager.enabled` |

### K8s Secrets (Hardcoded Placeholders)

| Secret Key | Value in `templates/secrets.yaml` | Production Risk |
|---|---|---|
| `JWT_SECRET` | `change-me-in-production` (base64) | **CRITICAL** |
| `JWT_REFRESH_SECRET` | `change-me-in-production-refresh` (base64) | **CRITICAL** |
| `ENCRYPTION_KEY` | `00000000000000000000000000000000` (base64) | **CRITICAL** |
| `STRIPE_SECRET_KEY` | `""` (empty string) | **HIGH** — billing non-functional |
| `STRIPE_WEBHOOK_SECRET` | `""` (empty string) | **HIGH** — webhooks fail |
| `POSTGRES_PASSWORD` | Same as `postgresql.user` value | **MEDIUM** — weak default |

### K8s Ingress

- nginx ingress class with TLS via cert-manager (Let's Encrypt)
- Hosts: `techfusion.ai`, `api.techfusion.ai`
- TLS secret: `techfusion-tls`
- Routes: `api.*` → api-gateway, everything else → web + `/api` → api-gateway

### K8s HPA

| Service | Min | Max | CPU Target | Memory Target |
|---|---|---|---|---|
| api-gateway | 3 | 20 | 70% | 80% |
| web | 2 | 10 | 70% | — |
| worker | 2 | 10 | 70% | — |

---

## CI/CD Review

### CI Pipeline (`.github/workflows/ci.yml`)

**Trigger:** Push/PR to `main`

**Job 1: lint-build-test**
- Node.js 22, pnpm 9
- `pnpm install --frozen-lockfile`
- `pnpm run lint` (TypeScript typecheck across all packages)
- `pnpm run build` (Turborepo build)
- `pnpm run test` (Turborepo test)

**Job 2: docker-build** (only on `main`, after lint-build-test passes)
- Matrix: 4 services (api-gateway, web, worker, agent)
- Build context: `apps/{service}` for each
- Push to `ghcr.io` with SHA tag + `latest`
- GHA cache enabled

### CD Staging (`.github/workflows/cd-staging.yml`)

**Trigger:** Auto on CI success on `main`
- Helm deploy to `techfusion-staging` namespace
- Values: `values-staging.yaml`
- Verifies rollout of api-gateway, web, worker
- Health check: `curl -sf http://.../health`

### CD Production (`.github/workflows/cd-production.yml`)

**Trigger:** Manual `workflow_dispatch` with `tag` input
- Helm deploy to `techfusion-production` namespace
- Values: `values-production.yaml`
- 15-minute timeout
- Smoke test: `curl -sf http://.../health`

### Required Secrets

| Secret | Used By | Status |
|---|---|---|
| `GITHUB_TOKEN` | Docker push (GHCR) | Auto-provided |
| `KUBECONFIG_STAGING` | CD staging | Must be configured |
| `KUBECONFIG_PRODUCTION` | CD production | Must be configured |

---

## Frontend–Backend Contract Matrix

### REST Endpoints

| Frontend Call | File | Backend Route | Match? |
|---|---|---|---|
| `POST /auth/login` | `login/page.tsx` | `POST /auth/login` | **MATCH** |
| `POST /auth/signup` | `signup/page.tsx` | `POST /auth/signup` | **MATCH** |
| `POST /auth/logout` | `Topbar.tsx` (hardcoded URL) | `POST /auth/logout` | **MISMATCH** (URL hardcoded to localhost) |
| `GET /devices` | `useDevices.ts` | `GET /devices` | **MATCH** |
| `GET /devices/:id/latest` | `useDevices.ts` | `GET /devices/:id/latest` | **MATCH** |
| `GET /devices/:id/metrics` | `useDevices.ts` | `GET /devices/:id/metrics` | **MATCH** |
| `GET /devices/:id/scores` | `device-health/page.tsx` | `GET /devices/:id/scores` | **MATCH** |
| `GET /alerts/latest` | `dashboard/page.tsx`, `useAlerts.ts` | `GET /alerts/latest` | **MATCH** |
| `GET /alerts/rules` | `useAlerts.ts` | `GET /alerts/rules` | **MATCH** |
| `POST /alerts/rules` | `useAlerts.ts` | `POST /alerts/rules` | **MATCH** |
| `PATCH /alerts/rules/:id` | `useAlerts.ts` | `PATCH /alerts/rules/:id` | **MATCH** |
| `DELETE /alerts/rules/:id` | `useAlerts.ts` | `DELETE /alerts/rules/:id` | **MATCH** |
| `PATCH /alerts/:id/acknowledge` | `useAlerts.ts` | `PATCH /alerts/:id/acknowledge` | **MATCH** |
| `GET /admin/dashboard` | `dashboard/page.tsx` | `GET /admin/dashboard` | **MATCH** |
| `POST /ai/troubleshoot` (SSE) | `useAiChat.ts` | `POST /ai/troubleshoot` | **MATCH** |
| `GET /ai/providers/status` | `settings/page.tsx` | `GET /ai/providers/status` | **MATCH** |
| `GET /ai/router/stats` | `settings/page.tsx` | `GET /ai/router/stats` | **MATCH** |
| `PUT /ai/router/strategy` | `settings/page.tsx` | `PUT /ai/router/strategy` | **MATCH** |
| `GET /security/latest/:id` | `useSecurity.ts` | `GET /security/latest/:deviceId` | **MATCH** |
| `GET /security/scans/:id` | `useSecurity.ts` | `GET /security/scans/:deviceId` | **MATCH** |
| `GET /security/executive-summary/:id` | `useSecurity.ts` | `GET /security/executive-summary/:deviceId` | **MATCH** |
| `POST /security/scans/:id/trigger` | `useSecurity.ts` | `POST /security/scans/:deviceId/trigger` | **MATCH** |
| `POST /security/findings/:id/remediate` | `useSecurity.ts` | `POST /security/findings/:findingId/remediate` | **MATCH** |
| `GET /security/export-pdf/:id` | `cybersecurity/page.tsx` | `GET /security/export-pdf/:deviceId` | **MATCH** |
| `GET /network/devices` | `useNetwork.ts` | `GET /network/devices` | **MATCH** |
| `GET /network/topology` | `useNetwork.ts` | `GET /network/topology` | **MATCH** |
| `GET /network/scans` | `useNetwork.ts` | `GET /network/scans` | **MATCH** |
| `POST /network/diagnostics/latency` | `useNetwork.ts` | `POST /network/diagnostics/latency` | **MATCH** |
| `POST /network/diagnostics/dns` | `useNetwork.ts` | `POST /network/diagnostics/dns` | **MATCH** |
| `POST /network/diagnostics/traceroute` | `useNetwork.ts` | `POST /network/diagnostics/traceroute` | **MATCH** |
| `POST /network/diagnostics/connectivity` | `useNetwork.ts` | `POST /network/diagnostics/connectivity` | **MATCH** |
| `GET /inventory/drivers` | `useInventory.ts` | `GET /inventory/drivers` | **MATCH** |
| `GET /inventory/software` | `useInventory.ts` | `GET /inventory/software` | **MATCH** |
| `GET /backups/jobs` | `useBackups.ts` | `GET /backups/jobs` | **MATCH** |
| `GET /backups/runs` | `useBackups.ts` | `GET /backups/runs` | **MATCH** |
| `GET /backups/restore-points/:id` | `useBackups.ts` | `GET /backups/restore-points/:deviceId` | **MATCH** |
| `GET /kb/articles` | `useKb.ts` | `GET /kb/articles` | **MATCH** |
| `POST /kb/articles` | `useKb.ts` | `POST /kb/articles` | **MATCH** |
| `PUT /kb/articles/:id` | `useKb.ts` | `PUT /kb/articles/:id` | **MATCH** |
| `DELETE /kb/articles/:id` | `useKb.ts` | `DELETE /kb/articles/:id` | **MATCH** |
| `POST /kb/query` | `useKb.ts` (unused) | `POST /kb/query` | **MATCH** (dead code) |
| `GET /billing/plan` | `useBilling.ts` | `GET /billing/plan` | **MATCH** |
| `GET /billing/usage` | `useBilling.ts` | `GET /billing/usage` | **MATCH** |
| `GET /billing/history` | `useBilling.ts` | `GET /billing/history` | **MATCH** |
| `POST /billing/checkout` | `useBilling.ts` | `POST /billing/checkout` | **MATCH** |
| `POST /billing/portal` | `useBilling.ts` | `POST /billing/portal` | **MATCH** |
| `GET /remote-support/sessions` | `useRemoteSupport.ts` | `GET /remote-support/sessions` | **MATCH** |
| `POST /remote-support/sessions` | `useRemoteSupport.ts` | `POST /remote-support/sessions` | **MATCH** |
| `POST /remote-support/sessions/:id/end` | `useRemoteSupport.ts` | `POST /remote-support/sessions/:id/end` | **MATCH** |
| `GET /remote-support/recordings` | `useRemoteSupport.ts` | `GET /remote-support/recordings` | **MATCH** |
| `GET /remote-support/audit-logs` | `useRemoteSupport.ts` | `GET /remote-support/audit-logs` | **MATCH** |
| **`POST /reports`** | `useReports.ts:29` | **`POST /reports/generate`** | **MISMATCH** |
| **`GET /reports`** | `useReports.ts:15` | `GET /reports` | **MATCH** |
| **`GET /team/members`** | `team/page.tsx` | **`GET /admin/users`** | **MISMATCH** |
| **`POST /team/members`** | `team/page.tsx` | **`POST /admin/users/:userId/role`** | **MISMATCH** |
| **`DELETE /team/members/:id`** | `team/page.tsx` | **`POST /admin/users/:userId/remove`** | **MISMATCH** |

### WebSocket Namespaces

| Frontend Consumer | Namespace | Backend Gateway | Match? |
|---|---|---|---|
| `useWebSocket.ts` | `/metrics` | DevicesGateway (`/metrics`) | **MATCH** |
| `useAlerts.ts` (`useAlertWebSocket`) | `/metrics` | AlertsGateway (`/metrics`) | **MATCH** |
| `remote-support/page.tsx` | `/remote` | RemoteSupportGateway (`/remote`) | **MATCH** (but hardcoded `orgId='demo'`) |
| `useNetwork.ts` (topology) | Not connected | NetworkGateway (`/network`) | **MISSING** — frontend never connects |

---

## Agent–Backend Contract Matrix

| Agent Action | Agent Endpoint Call | Backend Route | Auth Method | Match? |
|---|---|---|---|---|
| Health check ping | `GET /health` | `GET /health` | None (`@Public()`) | **MATCH** |
| Device registration | `POST /devices/register-public` | `POST /devices/register-public` | None (`@Public()`) | **MATCH** |
| Send metrics | `POST /devices/metrics` | `POST /devices/metrics` | DeviceToken (Bearer) | **MATCH** |
| Security report | `POST /devices/security-report` | `POST /devices/security-report` | deviceToken in body | **MATCH** |
| Pending remote sessions | `GET /remote-support/agent/pending` | `GET /remote-support/agent/pending` | Bearer token | **MATCH** |
| Remote consent | `POST /remote-support/consent` | `POST /remote-support/consent` | Public (device auth) | **MATCH** |
| Remote status update | `POST /remote-support/agent/status` | `POST /remote-support/agent/status` | Public (device auth) | **MATCH** |

### Agent Metrics Payload Structure

The agent sends to `POST /devices/metrics`:
```json
{
  "timestamp": "ISO-8601",
  "cpu": { "usage": f64, "cores": u32, "loadAverage1Min": null },
  "memory": { "total": f64, "used": f64, "percent": f64 },
  "disk": { "total": f64, "used": f64, "readBytes": null, "writeBytes": null },
  "temperatures": { "cpu": null },
  "network": { "rxBytes": f64, "txBytes": f64 },
  "battery": null | { "percent": f64, "status": "Charging"|"Discharging" },
  "processes": u32,
  "uptime": u64,
  "services": null
}
```

Backend `MetricsPayloadDto` expects: `{ cpu, memory, disk, gpu, battery, temperatures, fans, network, processes, uptime, services, timestamp }` — compatible (missing fields are optional).

---

## Backend–Worker Contract Matrix

| Component | Expected | Actual | Match? |
|---|---|---|---|
| Queue system | BullMQ queues in backend | Backend has **no queue producer code** | **MISMATCH** |
| Worker consumers | Worker reads from BullMQ queues | Worker has `bullmq` + `ioredis` deps but `main.ts` is minimal | **MISMATCH** |
| Redis URL | Worker expects `REDIS_URL` env | Docker Compose provides `REDIS_URL=redis://redis:6379` | **MATCH** |
| Queue names | Undefined | No queue names defined anywhere | **N/A** |
| Job types | Undefined | No job type definitions | **N/A** |
| Backend Redis usage | Backend uses Redis for what? | Backend package.json has no `bullmq` or `ioredis` dependency | **MISMATCH** |

**Key finding:** The backend (`api-gateway`) has no BullMQ or Redis client dependencies in `package.json`. The worker has BullMQ but there are no queue definitions or producers in the backend. The worker appears to be a skeleton with no functional queue consumers.

---

## WebSocket and SSE Contract Matrix

### WebSocket Namespaces (Backend)

| Namespace | Gateway File | Events Emitted | Events Consumed |
|---|---|---|---|
| `/metrics` | `devices.gateway.ts` | `metrics`, `alerts` | Connection (orgId room join) |
| `/metrics` | `alerts.gateway.ts` | `alerts` | Connection (orgId room join) |
| `/network` | `network.gateway.ts` | `topology`, `diagnostics` | Connection (orgId room join) |
| `/remote` | `remote-support.gateway.ts` | `signal`, `screen-frame`, `input-event`, `session-ended`, `session-update` | `signal`, `screen-frame`, `input-event`, `session-ended` |

### SSE Endpoints (Backend)

| Endpoint | Events | Consumer |
|---|---|---|
| `POST /ai/troubleshoot` | `token`, `done`, `citations`, `error` | `useAiChat.ts` (frontend) |

### Frontend WebSocket Connections

| Frontend Hook/Page | Namespace | Events Listened | Backend Match |
|---|---|---|---|
| `useWebSocket.ts` | `/metrics` | `metrics` | DevicesGateway |
| `useAlerts.ts` (`useAlertWebSocket`) | `/metrics` | `alerts` | AlertsGateway |
| `remote-support/page.tsx` | `/remote` (raw WS) | `screen-frame` | RemoteSupportGateway |

**Issue:** Frontend never connects to the `/network` namespace despite the backend having a NetworkGateway that broadcasts topology updates.

---

## Safe Validation Results

### Commands Executed

| Command | Work Dir | Result | Duration |
|---|---|---|---|
| `docker compose config --quiet` | `infra/docker/` | **PASS** (exit 0) | <1s |
| `cargo check` | `apps/agent/` | **PASS** (8 warnings) | ~65s |
| `pnpm run lint` (tsc --noEmit × 7) | root | **PASS** (7/7 successful) | ~26s |
| `pnpm run build` (turbo build × 7) | root | **PASS** (7/7 successful) | <1s (cached) |

### Validation Summary

| Validation | Status | Notes |
|---|---|---|
| Docker Compose config syntax | **PASS** | Valid YAML, correct service definitions |
| TypeScript typecheck (api-gateway) | **PASS** | No type errors |
| TypeScript typecheck (web) | **PASS** | No type errors |
| TypeScript typecheck (worker) | **PASS** | No type errors |
| TypeScript typecheck (ui) | **PASS** | No type errors |
| TypeScript typecheck (config) | **PASS** | No type errors |
| TypeScript typecheck (types) | **PASS** | No type errors |
| TypeScript typecheck (utils) | **PASS** | No type errors |
| Rust cargo check (agent) | **PASS** | 8 warnings (dead code + non-snake case fields) |
| Full build (all packages) | **PASS** | All 7 packages build successfully |

### Commands NOT Executed (With Reason)

| Command | Reason Not Executed |
|---|---|
| `docker compose up` | Would start services; destructive to local environment |
| `docker build` for each service | Requires network for base images; not requested |
| `pnpm run test` | Worker test is `echo 'no tests yet'`; api-gateway tests need DB |
| `helm template` | Would require downloading chart dependencies |
| `prisma migrate` | Would modify database |
| `pnpm run dev` | Would start dev servers; not requested |

---

## Verified Integration Mismatches

### Critical

| # | Caller | Expected | Actual | File Evidence |
|---|---|---|---|---|
| 1 | Frontend team page | `GET /team/members` | Backend has `GET /admin/users` | `team/page.tsx:15` vs `admin.controller.ts` |
| 2 | Frontend team page | `POST /team/members` (invite) | Backend has `POST /admin/users/:userId/role` | `team/page.tsx:25` vs `admin.controller.ts` |
| 3 | Frontend team page | `DELETE /team/members/:id` | Backend has `POST /admin/users/:userId/remove` | `team/page.tsx:40` vs `admin.controller.ts` |
| 4 | Frontend reports page | `POST /reports` (generate) | Backend has `POST /reports/generate` | `useReports.ts:29` vs `reporting.controller.ts` |
| 5 | Topbar logout | Hardcoded `http://localhost:3001/auth/logout` | Should use `NEXT_PUBLIC_API_URL` | `Topbar.tsx:50` |
| 6 | Remote support WS | `orgId = 'demo'` (hardcoded) | Should use JWT payload orgId | `remote-support/page.tsx:104` |
| 7 | Backend → Worker | No queue producers | Worker expects BullMQ consumers | Backend `package.json` (no bullmq), worker `package.json` (has bullmq) |

### High

| # | Issue | Evidence |
|---|---|---|
| 8 | K8s secrets use placeholder values (`change-me-in-production`) | `templates/secrets.yaml:14-16` |
| 9 | `JWT_SECRET` committed to git in `.env` file | `apps/api-gateway/.env:3` |
| 10 | `AI_ENCRYPTION_KEY` committed to git in `.env` file | `apps/api-gateway/.env:5` |
| 11 | Docker Compose api-gateway missing `REDIS_URL` | `docker-compose.yml:28-33` |
| 12 | Docker Compose api-gateway missing auth secrets (`JWT_SECRET`, etc.) | `docker-compose.yml:28-33` |
| 13 | Web Dockerfile hardcodes `NEXT_PUBLIC_API_URL=http://localhost:3001` at build time | `apps/web/Dockerfile:22` |
| 14 | Worker has zero tests | `apps/worker/package.json:8` — `"test": "echo 'no tests yet'"` |
| 15 | Frontend never connects to `/network` WebSocket namespace | No `useNetworkWebSocket` hook exists |
| 16 | Duplicate WebSocket connections to `/metrics` | `useWebSocket.ts` + `useAlertWs` both connect independently |

### Medium

| # | Issue | Evidence |
|---|---|---|
| 17 | Root `Dockerfile.web` not used by CI or docker-compose | `Dockerfile.web` exists at root; CI matrix uses `apps/web/Dockerfile` |
| 18 | Agent Dockerfile uses `rust:latest` (non-reproducible builds) | `apps/agent/Dockerfile:1` |
| 19 | Backend has no health check in docker-compose | `docker-compose.yml` api-gateway section |
| 20 | Web has no health check in docker-compose | `docker-compose.yml` web section |
| 21 | Agent inventory/network modules exist but no trigger to run them | `agent/src/inventory.rs`, `agent/src/network_discovery.rs` not called from `main.rs` |
| 22 | `@techfusion/config`, `@techfusion/types`, `@techfusion/utils` not imported by any app | Unused workspace packages |
| 23 | Worker `REDIS_URL` set but no queue producers in backend | Worker connects to Redis but nothing enqueues jobs |
| 24 | OpenTelemetry collector config sends traces to Prometheus (wrong exporter) | `templates/opentelemetry-collector.yaml:49` — `otlp` exporter endpoint points to prometheus-server |

---

## Deployment Readiness Facts

### What Works

| Area | Status | Evidence |
|---|---|---|
| TypeScript typecheck (all 7 packages) | **PASS** | `pnpm run lint` — 7/7 successful |
| Full build (all packages) | **PASS** | `pnpm run build` — 7/7 successful |
| Rust compilation (agent) | **PASS** | `cargo check` — compiled with warnings only |
| Docker Compose syntax | **PASS** | `docker compose config --quiet` — exit 0 |
| CI pipeline definition | **COMPLETE** | lint → build → test → docker build → push |
| CD staging pipeline | **COMPLETE** | Helm deploy → rollout verify → health check |
| CD production pipeline | **COMPLETE** | Manual dispatch → Helm deploy → smoke test |
| K8s chart structure | **COMPLETE** | 4 subcharts, HPAs, Ingress, Secrets, ConfigMaps |
| Observability stack | **DEFINED** | Prometheus, Grafana (5 dashboards), Loki, OTEL collector |

### What Does Not Work

| Area | Status | Evidence |
|---|---|---|
| Team management | **BROKEN** | Frontend calls `/team/*`, backend has `/admin/*` |
| Report generation | **BROKEN** | Frontend calls `POST /reports`, backend expects `POST /reports/generate` |
| Worker queue processing | **NON-FUNCTIONAL** | No queue producers in backend; worker skeleton only |
| Stripe integration | **NON-FUNCTIONAL** | Placeholder keys (`sk_test_placeholder`, `whsec_placeholder`) |
| AI provider calls | **NON-FUNCTIONAL** | All API keys empty in `.env` |
| Network topology WebSocket | **NOT CONNECTED** | Backend broadcasts on `/network` namespace, frontend never subscribes |
| Remote support org context | **BROKEN** | Hardcoded `orgId='demo'` in WebSocket connection |
| Logout | **BROKEN in non-localhost** | Hardcoded `http://localhost:3001/auth/logout` |
| K8s secrets | **PLACEHOLDERS** | `change-me-in-production` for JWT_SECRET |
| Agent Rust warnings | **8 WARNINGS** | Dead code (`DeviceInfo.hostname`), non-snake-case fields |

---

## Summary Statistics

| Metric | Value |
|---|---|
| Services discovered | 6 (api-gateway, web, worker, agent, postgres, redis) |
| Safe commands executed | 4 (docker compose config, cargo check, pnpm lint, pnpm build) |
| Passed validations | 10 (all typecheck packages + build + cargo check + compose config) |
| Failed validations | 0 |
| Integration mismatches found | 24 (7 critical, 8 high, 9 medium) |
| Frontend→Backend route mismatches | 4 (team × 3, reports × 1) |
| Hardcoded secrets in git | 3 (JWT_SECRET, JWT_REFRESH_SECRET, AI_ENCRYPTION_KEY) |
| Placeholder K8s secrets | 5 (JWT_SECRET, JWT_REFRESH, ENCRYPTION_KEY, STRIPE_SECRET, STRIPE_WEBHOOK) |
| Backend HTTP routes | 115 |
| Backend WebSocket namespaces | 3 (/metrics, /network, /remote) |
| Frontend routes | 18 |
| Frontend hooks | 12 files, 22 exports |
| Dockerfiles | 5 (4 in apps + 1 root Dockerfile.web) |
| CI/CD workflows | 3 (ci.yml, cd-staging.yml, cd-production.yml) |
| K8s dashboards | 5 (overview, request-latency, error-rate, queue-depth, ai-cost) |

---

**Top 5 Runtime Gaps:**

1. **Team management endpoints mismatch** — Frontend calls `/team/members` routes that do not exist in the backend (`/admin/users` is the actual endpoint), making the team page completely non-functional
2. **Report generation endpoint mismatch** — Frontend calls `POST /reports` but backend expects `POST /reports/generate`, causing report generation to fail with 404
3. **Worker queue system disconnected** — Worker has BullMQ dependencies but the backend has no queue producers; no jobs will ever be processed
4. **Committed secrets in `.env`** — `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `AI_ENCRYPTION_KEY` are committed to the repository in plaintext
5. **K8s production secrets are placeholders** — `templates/secrets.yaml` contains `change-me-in-production` for all cryptographic keys; deploying as-is would be a security incident

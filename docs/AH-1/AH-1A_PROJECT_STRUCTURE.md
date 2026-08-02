# AH-1A — Project Structure Discovery

**Repository:** Tech Fusion AI
**Date:** 2026-07-16
**Status:** Discovery only — no code modifications

---

## 1. Repository Overview

Tech Fusion AI is a **full-stack AI-powered IT fleet management and cybersecurity SaaS platform**. It is structured as a **pnpm monorepo** managed by **Turborepo**, containing four applications (Next.js frontend, NestJS backend, Rust device agent, Node.js background worker), four shared packages, infrastructure-as-code for Docker/Kubernetes, and comprehensive test suites.

---

## 2. High-Level Folder Tree

```
techfusion-ai/
├── apps/
│   ├── web/                  # Next.js 14 frontend (App Router)
│   ├── api-gateway/          # NestJS 10 backend API
│   ├── agent/                # Rust device monitoring agent
│   └── worker/               # Node.js background job worker (BullMQ)
├── packages/
│   ├── config/               # App config + design theme tokens
│   ├── types/                # Shared TypeScript types
│   ├── ui/                   # Shared React UI component library (Radix + Tailwind)
│   └── utils/                # Shared utility functions
├── infra/
│   ├── docker/               # docker-compose.yml (local dev stack)
│   └── k8s/                  # Helm chart (Kubernetes manifests, Grafana dashboards)
├── test/
│   ├── chaos/                # Chaos engineering scripts + results
│   ├── e2e/                  # End-to-end test specs
│   ├── load/                 # Load/performance test scripts
│   └── security/             # Security audit scripts + results
├── docs/                     # Project documentation (PRD, specs, reports)
├── .github/workflows/        # CI/CD pipelines (ci, cd-staging, cd-production)
├── package.json              # Root workspace config
├── pnpm-workspace.yaml       # pnpm workspace definition
├── turbo.json                # Turborepo task config
├── tsconfig.json             # Root TypeScript config
├── tsconfig.base.json        # Shared base TS config
├── Dockerfile.web            # Standalone Next.js Docker build
└── .prettierrc               # Code formatting config
```

---

## 3. Application Map

| Application | Path | Type | Framework | Language | Port | Purpose |
|---|---|---|---|---|---|---|
| **web** | `apps/web/` | Frontend | Next.js 14 (App Router) | TypeScript/React | 3000 | SaaS dashboard — fleet management, AI chat, monitoring, cybersecurity, billing |
| **api-gateway** | `apps/api-gateway/` | Backend | NestJS 10 (Express) | TypeScript | 3001 | REST/WebSocket API, auth, AI routing, device mgmt, billing, reporting |
| **agent** | `apps/agent/` | Device Agent | Tokio + Reqwest | Rust | — | Daemon collecting CPU/RAM/disk/network metrics from Linux machines |
| **worker** | `apps/worker/` | Worker | BullMQ + Redis | TypeScript | 9464 (metrics) | Background job processing (alerts, notifications), Prometheus metrics |

### Application Details

#### apps/web — Frontend Dashboard
- **Framework:** Next.js 14 with App Router, React 18, Tailwind CSS
- **Entry point:** `src/app/layout.tsx` (root), `src/app/dashboard/layout.tsx` (app shell)
- **Key features:** AI chat, device health, cybersecurity, network visualization, billing (Stripe), team management, knowledge base, remote support, backups, reports
- **Auth:** JWT via localStorage, decoded in dashboard layout
- **Real-time:** socket.io-client for WebSocket connections
- **UI:** Custom glassmorphism dark-mode design system using `@techfusion/ui`
- **Dependencies on packages:** `@techfusion/ui`, `@techfusion/config`, `@techfusion/types`, `@techfusion/utils`

#### apps/api-gateway — Backend API
- **Framework:** NestJS 10 with Express, Prisma ORM (PostgreSQL)
- **Entry point:** `src/main.ts`
- **Database:** PostgreSQL via Prisma with 27+ models (multi-tenant, organizations, devices, metrics, alerts, AI conversations, security, billing, etc.)
- **Modules:** 18 feature modules — auth, devices, ai, alerts, billing, backups, cybersecurity, encryption, inventory, kb, mfa, network, remote-support, reporting, retention, security, sso, audit
- **AI routing:** Smart router with circuit-breaker across 6 providers (Anthropic, OpenAI, Gemini, Groq, OpenRouter, Ollama)
- **Auth:** JWT + RBAC (Owner/Admin/Technician/Viewer), plan-based feature gating (Free/Pro/Business/Enterprise), TOTP MFA, SSO (SAML/OIDC)
- **Global guards:** CombinedAuthGuard, PlanGuard, ThrottlerGuard (rate limiting)
- **Observability:** OpenTelemetry (OTLP gRPC), Prometheus metrics (prom-client)
- **Payments:** Stripe integration

#### apps/agent — Device Agent
- **Language:** Rust (edition 2021)
- **Entry point:** `src/main.rs`
- **Active modules:** agent, client, collector, config, registration
- **Inactive modules (in source, not wired into main):** inventory, network_discovery, security, remote
- **Behavior:** Registers device via org JWT or existing device token, collects system metrics every 30s, sends to API via POST /devices/metrics with retry logic
- **Token persistence:** `~/.techfusion/device_token`
- **Key crates:** tokio, reqwest, sysinfo, clap, tracing, tokio-retry

#### apps/worker — Background Worker
- **Framework:** BullMQ (Redis-backed job queue), OpenTelemetry
- **Entry point:** `src/main.ts`
- **Queues:** `alert` (notifications via email placeholders + webhook POSTs), `default` (catch-all)
- **Metrics:** Prometheus on port 9464 (queue depth, jobs completed/failed, duration, utilization)
- **Polling:** Queue depth polled every 15s

---

## 4. Shared Packages

| Package | Path | Purpose | Key Exports |
|---|---|---|---|
| **@techfusion/config** | `packages/config/` | App config + design theme tokens | `config`, `theme`, `TechFusionTheme` |
| **@techfusion/types** | `packages/types/` | Shared TypeScript type definitions | `HealthCheckResponse`, `WorkspaceName` |
| **@techfusion/ui** | `packages/ui/` | React component library (Radix + Tailwind) | `Button`, `Card`, `Dialog`, `Input`, `Table`, `Badge`, `ScorePill`, `Toaster`, `cn` |
| **@techfusion/utils** | `packages/utils/` | General utility functions | `delay()`, `isDefined()`, `formatTimestamp()` |

---

## 5. Infrastructure

### Docker (local dev)
- **`infra/docker/docker-compose.yml`** — Local development stack
- **Root `Dockerfile.web`** — Multi-stage Next.js production build (Node 22 Alpine + pnpm 9)
- **`apps/api-gateway/Dockerfile`** — NestJS production build
- **`apps/agent/Dockerfile`** — Rust multi-stage build (rust:latest -> debian:bookworm-slim)
- **`apps/worker/Dockerfile`** — Node.js worker production build

### Kubernetes (Helm chart)
- **`infra/k8s/`** — Full Helm chart with:
  - **Workload deployments:** web, api-gateway, agent, worker (per-environment values: staging, production)
  - **Data stores:** PostgreSQL (StatefulSet), Redis (StatefulSet)
  - **Observability stack:** Prometheus, Grafana, Loki, OpenTelemetry Collector
  - **Grafana dashboards:** 5 pre-built dashboards (overview, request-latency, error-rate, queue-depth, ai-cost)
  - **Networking:** Ingress controller
  - **Config:** ConfigMap, Secrets

### CI/CD
- **`.github/workflows/ci.yml`** — Continuous integration
- **`.github/workflows/cd-staging.yml`** — Staging deployment
- **`.github/workflows/cd-production.yml`** — Production deployment

---

## 6. Test Suites

| Suite | Path | Description |
|---|---|---|
| **e2e** | `test/e2e/` | End-to-end test (Playwright-style spec) |
| **load** | `test/load/` | Load tests: AI chat, mixed workloads, remote support, reports, telemetry |
| **chaos** | `test/chaos/` | Chaos engineering with shell runner + results |
| **security** | `test/security/` | Security audit with shell runner + results |

---

## 7. Entry Points

| App | Dev Command | Source Entry | Compiled Entry |
|---|---|---|---|
| web | `pnpm dev` (via turbo) | `src/app/layout.tsx` | `.next/server/` |
| api-gateway | `ts-node src/main.ts` | `src/main.ts` | `dist/main.js` |
| agent | `cargo run` | `src/main.rs` | `target/debug/agent` |
| worker | `ts-node src/main.ts` | `src/main.ts` | `dist/main.js` |

---

## 8. Build System

- **Package manager:** pnpm 9.0.0 (workspace monorepo)
- **Task runner:** Turborepo 2.x — orchestrates build, dev, lint, test, clean across all apps/packages
- **TypeScript:** v5.4, base config at root (`tsconfig.base.json`), each app/package has its own `tsconfig.json`
- **Rust build:** Cargo (agent app), independent of pnpm/turbo
- **Build outputs:** `.next/**` (web), `dist/**` (api-gateway, worker), `target/**` (agent)

---

## 9. Important Configuration Files

| File | Purpose |
|---|---|
| `package.json` | Root workspace scripts (build, dev, lint, test, format, clean) |
| `pnpm-workspace.yaml` | Declares `apps/*` and `packages/*` as workspace members |
| `turbo.json` | Turborepo task definitions with dependency graph and caching |
| `tsconfig.base.json` | Shared TypeScript compiler options (ES2022, strict, bundler) |
| `tsconfig.json` | Root TS config (identical to base — potential redundancy, see §11) |
| `.prettierrc` | Prettier formatting rules |
| `.gitignore` | Git ignore patterns |
| `Dockerfile.web` | Standalone Next.js production Docker build |
| `apps/api-gateway/.env.example` | Template for all backend environment variables |
| `apps/api-gateway/.env` | Live environment file (gitignored) |
| `apps/api-gateway/prisma/schema.prisma` | PostgreSQL database schema (27+ models) |

---

## 10. Monorepo Architecture

```
                    ┌─────────────────────────────────┐
                    │         Turborepo (turbo)        │
                    │     pnpm workspace (pnpm 9)      │
                    └─────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
        ┌─────▼─────┐        ┌──────▼──────┐        ┌─────▼──────┐
        │   apps/    │        │  packages/  │        │   infra/   │
        ├───────────┤        ├─────────────┤        ├────────────┤
        │ web       │◄───────│ ui          │        │ docker/    │
        │ api-gw    │◄──┬────│ config      │        │ k8s/       │
        │ agent     │   ├────│ types       │        │ (Helm)     │
        │ worker    │◄──┴────│ utils       │        └────────────┘
        └───────────┘        └─────────────┘
              │                      ▲
              │    depends on        │
              └──────────────────────┘
```

**Dependency graph:**
- `apps/web` depends on: `@techfusion/ui`, `@techfusion/config`, `@techfusion/types`, `@techfusion/utils`
- `apps/api-gateway` depends on: `@techfusion/types` (via Prisma/types)
- `apps/worker` depends on: `@techfusion/config`, `@techfusion/types` (referenced in Dockerfile, not yet in source)
- `apps/agent` is Rust-only — no TypeScript package dependencies
- `packages/*` are leaf nodes with no inter-package dependencies

---

## 11. Anything Unusual Discovered

### Potential Issues

1. **Duplicate tsconfig.json:** Root `tsconfig.json` and `tsconfig.base.json` are byte-identical. `tsconfig.base.json` exists to be extended by apps/packages, but no app actually extends it — they each define their own compiler options. The root `tsconfig.json` appears unused/redundant.

2. **Dead Rust modules:** `apps/agent/src/` contains 4 modules (`inventory.rs`, `network_discovery.rs`, `security.rs`, `remote.rs`) that are **not imported in `main.rs`**. These appear to be feature modules in development that are not yet wired into the agent's main loop.

3. **Empty `.cargo/` directory:** `apps/agent/.cargo/` exists but is empty — likely a placeholder for future cargo configuration overrides.

4. **Live .env committed:** `apps/api-gateway/.env` exists on disk. It should be gitignored (verify `.gitignore` covers it).

5. **Worker has no tests:** `apps/worker/package.json` has a placeholder `test` script (`echo "No tests yet"`).

6. **Worker references unused packages:** The worker's `Dockerfile` copies all monorepo packages, but the source code does not import any shared packages yet.

7. **Report storage with UUID directories:** `apps/api-gateway/report-storage/` contains UUID-named directories — these appear to be generated runtime artifacts that should not be version-controlled.

8. **`tsconfig.base.json` is never extended:** Despite existing for reuse, no `tsconfig.json` in any app or package uses `"extends": "../../tsconfig.base.json"`. Each defines its own full compiler options.

### Generated Folders (Do Not Edit)

| Folder | Reason |
|---|---|
| `apps/web/.next/` | Next.js build output |
| `apps/agent/target/` | Rust/Cargo build output |
| `apps/*/dist/` | TypeScript compiled output |
| `apps/*/.turbo/` | Turborepo cache |
| `node_modules/` | Package manager installed deps |
| `apps/api-gateway/report-storage/` | Runtime-generated report files |

### Legacy/Deprecated

- **`Dockerfile.web` (root):** A standalone Dockerfile for the web app at root level, while each app also has its own `Dockerfile`. The root one is a more comprehensive multi-stage build. Both `apps/web/Dockerfile` and root `Dockerfile.web` exist — potential duplication.

---

## 12. Summary

| Metric | Count |
|---|---|
| Applications | 4 (web, api-gateway, agent, worker) |
| Shared packages | 4 (config, types, ui, utils) |
| Infrastructure targets | 2 (Docker Compose, Kubernetes/Helm) |
| Test suites | 4 (e2e, load, chaos, security) |
| CI/CD pipelines | 3 (ci, cd-staging, cd-production) |
| Dockerfiles | 4 (web has 2 — root + app level) |
| Prisma models | 27+ |
| AI providers supported | 6 (Anthropic, OpenAI, Gemini, Groq, OpenRouter, Ollama) |
| Database | PostgreSQL (Prisma ORM) |
| Cache/Queue | Redis (BullMQ) |

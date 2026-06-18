# TechFusion AI — Project Context

> **Canonical reference for AI models working on this codebase.**
> Generated from the actual codebase at commit `HEAD`. Last updated 2026-06-18.

---

## 1. Tech Stack

### Monorepo Infrastructure
| Tool | Version | Role |
|------|---------|------|
| pnpm | 9.0.0 | Package manager |
| Turbo | ^2.0.0 | Monorepo task runner |
| TypeScript | ^5.4.0 | Language (all Node.js apps) |
| Rust | edition 2021 | Language (agent binary) |
| Node.js | >=18 (CI: 22) | Runtime |

### api-gateway (`apps/api-gateway`)
| Package | Version | Purpose |
|---------|---------|---------|
| `@nestjs/common/core/platform-express` | ^10.3.0 | NestJS framework |
| `@nestjs/config` | ^4.0.4 | Environment config |
| `@nestjs/jwt` | ^11.0.2 | JWT auth |
| `@nestjs/passport` / `passport` / `passport-jwt` / `passport-local` | ^11.0.5 / ^0.7.0 / ^4.0.1 / ^1.0.0 | Passport auth |
| `@nestjs/throttler` | ^6.5.0 | Rate limiting |
| `@nestjs/platform-socket.io` / `@nestjs/websockets` / `socket.io` | ^10.3.0 / ^10.3.0 / ^4.7.0 | WebSockets |
| `@prisma/client` / `prisma` | ^6.19.3 | ORM |
| `@anthropic-ai/sdk` | ^0.104.2 | Claude API |
| `openai` | ^6.42.0 | OpenAI API |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `jsonwebtoken` | ^9.0.3 | JWT verification |
| `class-validator` / `class-transformer` | ^0.15.1 / ^0.5.1 | DTO validation |
| `stripe` | ^22.2.1 | Payment processing |
| `speakeasy` / `qrcode` | ^2.0.0 / ^1.5.4 | TOTP MFA |
| `pdfkit` / `docx` | ^0.19.1 / ^9.7.1 | Report generation |
| `prom-client` | ^15.1.0 | Prometheus metrics |
| `@opentelemetry/*` | ^0.54.0 / ^1.27.0-1.9.0 | Distributed tracing |
| `jest` / `ts-jest` / `supertest` | ^30.4.2 / ^29.4.11 / ^7.2.2 | Testing |

### web (`apps/web`)
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^14.2.0 | React framework (App Router) |
| `react` / `react-dom` | ^18.2.0 | UI library |
| `next-themes` | ^0.3.0 | Dark/light mode |
| `lucide-react` | ^0.372.0 | Icons |
| `recharts` | ^2.12.0 | Charting |
| `cmdk` | ^1.0.0 | Command palette |
| `sonner` | ^1.4.0 | Toast notifications |
| `socket.io-client` | ^4.7.0 | WebSocket client |
| `tailwindcss` / `tailwindcss-animate` | ^3.4.0 / ^1.0.7 | Styling |

### worker (`apps/worker`)
| Package | Version | Purpose |
|---------|---------|---------|
| `bullmq` | ^5.0.0 | Redis-backed job queue |
| `ioredis` | ^5.4.0 | Redis client |
| `prom-client` | ^15.1.0 | Metrics |
| `@opentelemetry/*` | ^0.54.0 | Distributed tracing |

### agent (`apps/agent`)
| Crate | Version | Purpose |
|-------|---------|---------|
| `sysinfo` | 0.30 | System metrics collection |
| `serde` / `serde_json` | 1 | Serialization |
| `reqwest` (json, blocking) | 0.12 | HTTP client |
| `chrono` (serde) | 0.4 | Timestamps |
| `rand` | 0.8 | Random generation |

### Shared Packages
| Package | Path | Purpose |
|---------|------|---------|
| `@techfusion/config` | `packages/config` | Theme constants, shared config |
| `@techfusion/types` | `packages/types` | Shared TypeScript types |
| `@techfusion/ui` | `packages/ui` | Shared UI components (Badge, Button, Card, Dialog, Input, ScorePill, Table, Toast) |
| `@techfusion/utils` | `packages/utils` | Shared utilities |

### Database
- **PostgreSQL 16** via `timescale/timescaledb:latest-pg16` (TimescaleDB extension active: `DeviceMetric` is a hypertable)
- **Redis 7** (alpine) — BullMQ queues, WebSocket pub/sub
- **ORM:** Prisma 6.19.3

---

## 2. Real Folder Structure

```
techfusion-ai/
├── apps/
│   ├── agent/                          # Rust binary (system agent)
│   │   ├── Cargo.toml
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── main.rs                 # Entrypoint: metrics, security, network, inventory, remote
│   │       ├── inventory.rs            # Driver + software enumeration
│   │       ├── network_discovery.rs    # ARP/ICMP network sweep
│   │       ├── remote.rs               # Remote session client logic
│   │       └── security.rs             # Security findings collection
│   ├── api-gateway/                    # NestJS API server (port 3001)
│   │   ├── Dockerfile
│   │   ├── jest.config.js
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── .env
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # Canonical DB schema (745 lines)
│   │   │   ├── seed.ts                 # KB seed (deterministic 64-dim embeddings)
│   │   │   ├── embed.sql               # Custom embedding SQL helpers
│   │   │   └── migrations/             # 7 sequential migrations
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts           # Root module wiring all feature modules
│   │       ├── telemetry.ts            # OpenTelemetry init
│   │       ├── health.controller.ts    # GET /health
│   │       ├── metrics.controller.ts   # GET /metrics (Prometheus)
│   │       ├── demo.controller.ts      # Role-based demo endpoints
│   │       ├── prisma/                 # PrismaModule + PrismaService
│   │       ├── admin/                  # Admin dashboard, user management
│   │       ├── ai/                     # AI orchestrator, Anthropic + OpenAI providers
│   │       ├── alerts/                 # Alert rules + alert evaluation
│   │       ├── audit/                  # Audit log query + export
│   │       ├── auth/                   # Signup, login, refresh, logout
│   │       ├── backups/                # Backup jobs + runs + restore
│   │       ├── billing/                # Stripe checkout, portal, webhook, plans
│   │       ├── common/                 # Guards, decorators (auth, roles, plan, org-context)
│   │       ├── devices/                # Device CRUD, metrics ingestion, scoring, WebSocket
│   │       ├── encryption/             # Envelope encryption verification
│   │       ├── inventory/              # Driver/software inventory ingestion
│   │       ├── kb/                     # Knowledge base articles + RAG query
│   │       ├── mfa/                    # TOTP MFA enroll/verify/status
│   │       ├── network/                # Network discovery, topology, diagnostics, WebSocket
│   │       ├── remote-support/         # Remote session management + WebRTC signaling
│   │       ├── reporting/              # Report generation (PDF/DOCX/HTML), branding, schedules
│   │       ├── retention/              # Data retention policy management
│   │       ├── security/               # Security scan findings, scoring, executive summary
│   │       └── sso/                    # SAML/OIDC SSO configuration + JIT provisioning
│   ├── web/                            # Next.js 14 App Router (port 3000)
│   │   ├── Dockerfile
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/                    # App Router pages
│   │       │   ├── page.tsx            # Landing page
│   │       │   ├── layout.tsx          # Root layout
│   │       │   ├── login/page.tsx
│   │       │   ├── signup/page.tsx
│   │       │   └── dashboard/          # All dashboard pages (14 sub-routes)
│   │       │       ├── page.tsx        # Dashboard home
│   │       │       ├── layout.tsx      # Dashboard layout with sidebar
│   │       │       ├── ai-chat/page.tsx
│   │       │       ├── backup/page.tsx
│   │       │       ├── billing/page.tsx
│   │       │       ├── cybersecurity/page.tsx
│   │       │       ├── device-health/page.tsx + [id]/page.tsx
│   │       │       ├── drivers/page.tsx
│   │       │       ├── knowledge-base/page.tsx
│   │       │       ├── monitoring/page.tsx
│   │       │       ├── network/page.tsx
│   │       │       ├── remote-support/page.tsx
│   │       │       ├── reports/page.tsx
│   │       │       ├── settings/page.tsx
│   │       │       └── team/page.tsx
│   │       ├── components/             # AiChatDrawer, CommandPalette, NetworkMap, ScoreGauge, Sidebar, Topbar
│   │       └── hooks/                  # 11 custom hooks (useAiChat, useAlerts, useBackups, etc.)
│   └── worker/                         # BullMQ worker (port 9464 metrics)
│       ├── Dockerfile
│       ├── package.json
│       └── src/
│           ├── main.ts                 # Alert + default queue workers
│           ├── metrics.ts              # Prometheus metrics server
│           └── telemetry.ts            # OpenTelemetry init
├── packages/
│   ├── config/                         # Theme, shared config
│   ├── types/                          # Shared TS types
│   ├── ui/                             # UI component library (8 components)
│   └── utils/                          # Shared utilities
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml          # Dev setup: postgres, redis, api-gateway, web, agent, worker
│   └── k8s/                            # Helm chart
│       ├── Chart.yaml                  # Dependencies: prometheus, grafana, loki, cert-manager
│       ├── values.yaml                 # Staging defaults
│       ├── values-production.yaml
│       ├── values-staging.yaml
│       ├── README.md
│       ├── dashboards/                 # 5 Grafana dashboards (JSON)
│       └── templates/                  # Deployments, HPA, configmap, secrets, ingress, postgres, redis, OTEL collector
├── test/
│   ├── e2e/full-scenario.spec.ts       # 13 integration tests
│   ├── chaos/                          # Chaos testing results + script
│   ├── load/                           # k6 load test scripts (5 scenarios)
│   └── security/                       # Security review script + results
├── .github/workflows/
│   ├── ci.yml                          # Lint → Build → Test → Docker build+push (GHCR)
│   ├── cd-staging.yml
│   └── cd-production.yml
├── .prettierrc
├── turbo.json
├── tsconfig.base.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Database Schema

**Source:** `apps/api-gateway/prisma/schema.prisma` (745 lines)

### Enums
- `Role`: Owner, Admin, Technician, Viewer
- `Plan`: Free, Pro, Business, Enterprise
- `SubscriptionStatus`: Active, PastDue, Canceled, Incomplete, IncompleteExpired, Trialing, Unpaid, Paused

### Models (34 total)

| Model | Key Fields | Notes |
|-------|-----------|-------|
| `Organization` | id, name, slug (unique), plan, stripeCustomerId | Root tenant entity |
| `User` | id, email (unique), passwordHash, displayName, orgId, role, isMfaEnabled, mfaSecret, ssoId, ssoProvider | `@@unique([orgId, email])` |
| `RefreshToken` | token (unique), userId, orgId, expiresAt, revokedAt | |
| `Device` | id, name, hostname, os, osVersion, cpuModel, cpuCores, ramTotal (BigInt), deviceToken (unique), inactive, metadata (Json) | |
| `DeviceMetric` | cpuUsage, ramUsed/Total (BigInt), diskSmartStatus, gpu*, battery*, temp*, fanRpm, networkRx/Tx (BigInt), loadAverage*, uptime (BigInt), serviceChecks (Json) | **TimescaleDB hypertable** on `recordedAt` |
| `DeviceHealthScore` | healthScore, performanceScore, riskScore (all Float 0-100) | |
| `AlertRule` | metricName, threshold, operator, severity, debounceSeconds, webhookUrl | |
| `Alert` | metricValue, threshold, severity, acknowledgedAt, resolvedAt | |
| `AiProviderConfig` | provider ("anthropic"/"openai"), apiKeyEncrypted, model, priority, isEnabled | `@@unique([orgId, provider])` |
| `AiUsageLog` | provider, model, promptTokens, completionTokens, costUsd, latencyMs, success | |
| `AiConversation` | title, deviceId (optional) | Has child `AiMessage[]` |
| `AiMessage` | role, content, tokenCount | |
| `SecurityScan` | status, triggeredBy, startedAt, completedAt | |
| `SecurityFinding` | category, severity, status, remediation, details (Json) | Categories: updates, firewall, weak_config, open_ports, password_policy |
| `SecurityScore` | securityScore, riskLevel, totalFindings, critical/high/medium/low counts | |
| `NetworkDevice` | ip, mac, hostname, vendor, interface, source, reachable, latencyMs | `@@unique([orgId, ip])` |
| `NetworkScan` | gatewayIp, gatewayMac, localIp, subnet, discoveredIps (Json) | |
| `DriverCatalogItem` | name, vendor, minVersion, latestVersion, downloadUrl, checksum | `@@unique([name, vendor])` |
| `Driver` | name, vendor, version, modulePath, source, status | `@@unique([orgId, name])` |
| `SoftwareCatalogItem` | name, vendor, minVersion, latestVersion, category, isEssential | `@@unique([name, vendor])` |
| `SoftwareInventory` | name, version, vendor, installDate, source, status | `@@unique([orgId, name])` |
| `BackupJob` | type (file/full_image), schedule (cron), sourcePaths, destination, retention | |
| `BackupRun` | status, type, sizeBytes (BigInt), fileCount, errorMessage | |
| `Subscription` | stripeSubscriptionId, stripeCustomerId, status, plan, currentPeriodStart/End | |
| `Invoice` | stripeInvoiceId, amount (cents), currency, status, invoicePdf | |
| `ReportTemplate` | companyName, logoPath, accentColor | One per org |
| `Report` | type, format, storagePath, fileSize, signedUrl, aiGenerated, aiSummary | |
| `ReportSchedule` | type, formats, cron, deviceIds, isEnabled | |
| `RemoteSession` | status, protocol (webrtc/vnc/rdp), turnServer, recordingPath, consentGranted, unattendedPolicy (Json) | |
| `SsoConfig` | provider (saml/oidc), issuer, entryPoint, certificate, clientId, clientSecretEncrypted, attributeMapping (Json) | One per org |
| `DataRetentionPolicy` | metricsRetentionDays (90), recordingsRetentionDays (365), auditRetentionDays (730), securityScanRetentionDays (365), backupRetentionDays (90) | One per org |
| `AuditLog` | sessionId, action, actorId, targetId, details (Json), immutable | |
| `KbArticle` | title, markdown | Has child `KbEmbedding[]` |
| `KbEmbedding` | chunkIndex, chunkText, **embedding (Json)** | `@@unique([articleId, chunkIndex])` |

### Row-Level Security (RLS)
All tenant-scoped tables have RLS enabled via a `current_org_id()` PostgreSQL function that reads `app.current_org_id` session variable (set by `OrgContextInterceptor`). Each table has a `FOR ALL USING ("orgId" = current_org_id())` policy.

### TimescaleDB Hypertable
`DeviceMetric` is converted to a hypertable on `recordedAt` via:
```sql
SELECT create_hypertable('DeviceMetric', 'recordedAt', if_not_exists => TRUE);
```

### KB Embedding Design
**Deviation from original plan:** Embeddings are stored as `Json` (JSONB) float arrays rather than using a native `pgvector` extension. This was a deliberate choice to avoid requiring `pgvector` in CI/dev environments.

- **Dimension:** 1536 (consistent with `text-embedding-3-small`)
- **Storage:** Each `KbEmbedding.embedding` column stores `[float, float, ...]` as JSONB
- **Similarity computation:** Cosine similarity is computed in application code (`kb.service.ts:cosineSimilarity()`)
- **Why not pgvector:** Eliminates a dependency; the number of embeddings is small enough that brute-force cosine similarity in JS is acceptable. Can be migrated to pgvector index if the KB grows beyond ~10K chunks.
- **Dev/test fallback:** When no AI provider is configured, `AiOrchestratorService.getLocalEmbedding()` produces a deterministic hash-based vector (same dimension) — not semantically meaningful, but keeps the RAG pipeline functional in dev.

---

## 4. API Endpoints

### Public (no auth required)
| Method | Path | Source | Notes |
|--------|------|--------|-------|
| GET | `/health` | `health.controller.ts` | |
| GET | `/metrics` | `metrics.controller.ts` | Prometheus metrics |
| POST | `/auth/signup` | `auth.controller.ts` | |
| POST | `/auth/login` | `auth.controller.ts` | |
| POST | `/auth/refresh` | `auth.controller.ts` | |
| POST | `/devices/register-public` | `devices.controller.ts` | Device self-registration |
| POST | `/devices/metrics` | `devices.controller.ts` | Device-token-guarded |
| POST | `/devices/security-report` | `security.controller.ts` | Device-token-guarded |
| POST | `/network/discovery` | `network.controller.ts` | |
| POST | `/billing/webhook` | `billing.controller.ts` | Stripe webhook |
| POST | `/auth/sso/login` | `sso.controller.ts` | |
| GET | `/remote-support/agent/pending` | `remote-support.controller.ts` | Device-token |
| POST | `/remote-support/consent` | `remote-support.controller.ts` | Device-token |
| POST | `/remote-support/agent/status` | `remote-support.controller.ts` | Device-token |

### Auth (JWT required, role-gated)

#### Auth
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/auth/logout` | any | `auth.controller.ts` |

#### Devices
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/devices/register` | any (device-token) | `devices.controller.ts` |
| GET | `/devices` | any | `devices.controller.ts` |
| GET | `/devices/:id` | any | `devices.controller.ts` |
| GET | `/devices/:id/metrics` | any | `devices.controller.ts` |
| GET | `/devices/:id/scores` | any | `devices.controller.ts` |
| GET | `/devices/:id/latest` | any | `devices.controller.ts` |

#### AI / Troubleshooting
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/ai/troubleshoot` | Owner/Admin/Technician/Viewer | `troubleshooting.controller.ts` |

#### Alerts
| Method | Path | Role | Source |
|--------|------|------|--------|
| GET | `/alerts/rules` | any | `alerts.controller.ts` |
| POST | `/alerts/rules` | Admin/Owner | `alerts.controller.ts` |
| PATCH | `/alerts/rules/:id` | Admin/Owner | `alerts.controller.ts` |
| DELETE | `/alerts/rules/:id` | Admin/Owner | `alerts.controller.ts` |
| GET | `/alerts` | any | `alerts.controller.ts` |
| GET | `/alerts/latest` | any | `alerts.controller.ts` |
| PATCH | `/alerts/:id/acknowledge` | any | `alerts.controller.ts` |

#### Security
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/security/scans/:deviceId/trigger` | any | `security.controller.ts` |
| GET | `/security/latest/:deviceId` | any | `security.controller.ts` |
| GET | `/security/scans/:deviceId` | any | `security.controller.ts` |
| GET | `/security/scans/detail/:scanId` | any | `security.controller.ts` |
| POST | `/security/findings/:findingId/remediate` | any | `security.controller.ts` |
| GET | `/security/executive-summary/:deviceId` | any | `security.controller.ts` |
| GET | `/security/export-pdf/:deviceId` | any | `security.controller.ts` |

#### Network
| Method | Path | Role | Source |
|--------|------|------|--------|
| GET | `/network/devices` | any | `network.controller.ts` |
| GET | `/network/devices/:ip` | any | `network.controller.ts` |
| GET | `/network/scans` | any | `network.controller.ts` |
| GET | `/network/scans/latest` | any | `network.controller.ts` |
| GET | `/network/topology` | any | `network.controller.ts` |
| POST | `/network/diagnostics/latency` | any | `network.controller.ts` |
| POST | `/network/diagnostics/dns` | any | `network.controller.ts` |
| POST | `/network/diagnostics/traceroute` | any | `network.controller.ts` |
| POST | `/network/diagnostics/connectivity` | any | `network.controller.ts` |

#### Backup
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/backups/jobs` | any | `backups.controller.ts` |
| GET | `/backups/jobs` | any | `backups.controller.ts` |
| GET | `/backups/jobs/:id` | any | `backups.controller.ts` |
| PATCH | `/backups/jobs/:id` | any | `backups.controller.ts` |
| DELETE | `/backups/jobs/:id` | any | `backups.controller.ts` |
| POST | `/backups/jobs/:id/trigger` | any | `backups.controller.ts` |
| GET | `/backups/runs` | any | `backups.controller.ts` |
| GET | `/backups/runs/:id` | any | `backups.controller.ts` |
| GET | `/backups/restore-points/:deviceId` | any | `backups.controller.ts` |
| POST | `/backups/runs/:id/restore` | any | `backups.controller.ts` |

#### Billing
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/billing/checkout` | Owner | `billing.controller.ts` |
| POST | `/billing/portal` | Owner | `billing.controller.ts` |
| GET | `/billing/plan` | any | `billing.controller.ts` |
| GET | `/billing/usage` | any | `billing.controller.ts` |
| GET | `/billing/history` | Owner | `billing.controller.ts` |
| GET | `/billing/admin` | Owner | `billing.controller.ts` |

#### Reporting
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/reports/generate` | Admin/Owner | `reporting.controller.ts` |
| GET | `/reports` | any | `reporting.controller.ts` |
| GET | `/reports/download/:id/:format` | any | `reporting.controller.ts` |
| GET | `/reports/branding` | any (requires `customBranding`) | `reporting.controller.ts` |
| POST | `/reports/branding` | Admin/Owner (requires `customBranding`) | `reporting.controller.ts` |
| GET | `/reports/schedules` | any | `reporting.controller.ts` |
| POST | `/reports/schedules` | Admin/Owner | `reporting.controller.ts` |
| DELETE | `/reports/schedules/:id` | Admin/Owner | `reporting.controller.ts` |

#### Remote Support
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/remote-support/sessions` | any | `remote-support.controller.ts` |
| GET | `/remote-support/sessions` | any | `remote-support.controller.ts` |
| GET | `/remote-support/sessions/:id` | any | `remote-support.controller.ts` |
| POST | `/remote-support/sessions/:id/end` | any | `remote-support.controller.ts` |
| GET | `/remote-support/recordings` | any | `remote-support.controller.ts` |
| GET | `/remote-support/recordings/:sessionId` | any | `remote-support.controller.ts` |
| GET | `/remote-support/audit-logs` | any | `remote-support.controller.ts` |
| POST | `/remote-support/audit-logs` | any | `remote-support.controller.ts` |
| POST | `/remote-support/recordings/:sessionId` | any | `remote-support.controller.ts` |
| POST | `/remote-support/recordings/:sessionId/frames` | any | `remote-support.controller.ts` |

#### Knowledge Base
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/kb/articles` | any (JWT) | `kb.controller.ts` |
| GET | `/kb/articles` | any (JWT) | `kb.controller.ts` |
| GET | `/kb/articles/:id` | any (JWT) | `kb.controller.ts` |
| PUT | `/kb/articles/:id` | any (JWT) | `kb.controller.ts` |
| DELETE | `/kb/articles/:id` | any (JWT) | `kb.controller.ts` |
| POST | `/kb/query` | any (JWT) | `kb.controller.ts` |

#### Inventory
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/inventory/report` | any | `inventory.controller.ts` |
| GET | `/inventory/drivers` | any | `inventory.controller.ts` |
| GET | `/inventory/software` | any | `inventory.controller.ts` |
| GET | `/inventory/catalog` | any | `inventory.controller.ts` |

#### MFA
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/mfa/enroll` | any | `mfa.controller.ts` |
| POST | `/mfa/verify` | any | `mfa.controller.ts` |
| GET | `/mfa/status` | any | `mfa.controller.ts` |

#### SSO
| Method | Path | Role | Source |
|--------|------|------|--------|
| GET | `/admin/sso/config` | Owner/Admin (requires `sso` feature) | `sso.controller.ts` |
| POST | `/admin/sso/config` | Owner (requires `sso` feature) | `sso.controller.ts` |
| POST | `/admin/sso/disable` | Owner (requires `sso` feature) | `sso.controller.ts` |

#### Admin
| Method | Path | Role | Source |
|--------|------|------|--------|
| GET | `/admin/dashboard` | Owner/Admin | `admin.controller.ts` |
| GET | `/admin/org` | Owner/Admin | `admin.controller.ts` |
| GET | `/admin/users` | Owner/Admin | `admin.controller.ts` |
| GET | `/admin/users/:userId` | Owner/Admin | `admin.controller.ts` |
| POST | `/admin/users/:userId/role` | Owner | `admin.controller.ts` |
| POST | `/admin/users/:userId/remove` | Owner | `admin.controller.ts` |

#### Encryption
| Method | Path | Role | Source |
|--------|------|------|--------|
| POST | `/admin/encryption/verify` | Owner | `encryption.controller.ts` |

#### Retention
| Method | Path | Role | Source |
|--------|------|------|--------|
| GET | `/admin/retention` | Owner/Admin | `retention.controller.ts` |
| POST | `/admin/retention` | Owner/Admin | `retention.controller.ts` |
| POST | `/admin/retention/enforce` | Owner/Admin | `retention.controller.ts` |
| POST | `/admin/retention/enforce-all` | Owner | `retention.controller.ts` |

#### Audit
| Method | Path | Role | Source |
|--------|------|------|--------|
| GET | `/audit/logs` | Owner/Admin | `audit.controller.ts` |
| GET | `/audit/export/csv` | Owner/Admin | `audit.controller.ts` |
| GET | `/audit/export/json` | Owner/Admin | `audit.controller.ts` |

#### Demo (role testing)
| Method | Path | Role | Source |
|--------|------|------|--------|
| GET | `/demo/admin` | Owner/Admin | `demo.controller.ts` |
| GET | `/demo/technician` | Owner/Admin/Technician | `demo.controller.ts` |
| GET | `/demo/viewer` | any authenticated | `demo.controller.ts` |

### WebSocket Namespaces
| Namespace | Source | Purpose |
|-----------|--------|---------|
| `/metrics` | `devices.gateway.ts`, `alerts.gateway.ts` | Real-time metrics + alerts by `orgId` |
| `/network` | `network.gateway.ts` | Topology + diagnostics by `orgId` |
| `/remote` | `remote-support.gateway.ts` | WebRTC signaling, screen frames, input events per session |

---

## 5. Environment Variables

**Source:** `apps/api-gateway/.env` and code references across all apps.

### Required (no default)
| Variable | Used In | Mandatory | Description |
|----------|---------|-----------|-------------|
| `DATABASE_URL` | api-gateway, agent | **Yes** | `postgresql://user:pass@host:port/db` |
| `JWT_SECRET` | api-gateway | **Yes** | JWT signing secret |
| `JWT_REFRESH_SECRET` | api-gateway | **Yes** | Refresh token signing secret |
| `AI_ENCRYPTION_KEY` | api-gateway | **Yes** | AES-256-GCM key derivation seed (min 32 chars, used with scrypt) |

### Required for AI features (optional otherwise)
| Variable | Used In | Mandatory | Description |
|----------|---------|-----------|-------------|
| `ANTHROPIC_API_KEY` | api-gateway | For Claude | Falls back to deterministic embeddings if unset |
| `OPENAI_API_KEY` | api-gateway | For OpenAI/embeddings | Required for real KB embeddings + OpenAI completions |

### Optional
| Variable | Default | Used In | Description |
|----------|---------|---------|-------------|
| `PORT` | `3001` | api-gateway | HTTP listen port |
| `STRIPE_SECRET_KEY` | `sk_test_placeholder` | api-gateway | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_placeholder` | api-gateway | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | `price_pro` | api-gateway | Stripe price ID for Pro plan |
| `STRIPE_BUSINESS_PRICE_ID` | `price_business` | api-gateway | Stripe price ID for Business plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | `price_enterprise` | api-gateway | Stripe price ID for Enterprise plan |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-20250514` | api-gateway | Claude model override |
| `OPENAI_MODEL` | `gpt-4o` | api-gateway | OpenAI model override |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | api-gateway, worker | OpenTelemetry gRPC endpoint |
| `OTEL_SERVICE_NAME` | `techfusion-api-gateway` | api-gateway | OpenTelemetry service name |
| `REDIS_URL` | `redis://localhost:6379` | worker | BullMQ Redis connection |

### Agent-specific
| Variable | Default | Description |
|----------|---------|-------------|
| `TF_API_URL` | `http://localhost:3001` | API server URL |
| `TF_INTERVAL` | `10` | Metrics collection interval (seconds) |
| `TF_SECURITY_INTERVAL` | `3600` | Security scan interval |
| `TF_NETWORK_INTERVAL` | `300` | Network discovery interval |
| `TF_INVENTORY_INTERVAL` | `1800` | Inventory scan interval |
| `TF_REMOTE_INTERVAL` | `5` | Remote session poll interval |
| `TF_SERVICES` | (empty) | Comma-separated systemd services to monitor |

### Worker-specific
| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `TF_API_URL` | `http://localhost:3001` | API server for notifications |

### .env.example (from `apps/api-gateway/.env`)
```
DATABASE_URL="postgresql://techfusion:techfusion@localhost:5433/techfusion"
JWT_SECRET="dev-secret-change-in-production-abc123"
JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production-xyz789"
PORT=3001
AI_ENCRYPTION_KEY="dev-encryption-key-change-in-production-at-least-32-chars"
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
STRIPE_SECRET_KEY="sk_test_placeholder"
STRIPE_WEBHOOK_SECRET="whsec_placeholder"
STRIPE_PRO_PRICE_ID="price_pro"
STRIPE_BUSINESS_PRICE_ID="price_business"
STRIPE_ENTERPRISE_PRICE_ID="price_enterprise"
```

**Important:** The AI Orchestrator falls back to `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars when no `AiProviderConfig` rows exist for an org. For real KB embedding, either set `OPENAI_API_KEY` (OpenAI's `text-embedding-3-small` is used for embeddings) or configure an `AiProviderConfig` record with an OpenAI key. When neither is available, `getLocalEmbedding()` produces deterministic hash-based vectors (1536 dim) — these pass the query pipeline but are **not semantically meaningful**.

---

## 6. How to Run Locally

### Prerequisites
- Node.js >= 18
- pnpm 9 (`pnpm@9.0.0`)
- Docker + docker-compose
- Rust toolchain (for agent; optional for API-only dev)

### Option A: Docker Compose (recommended for dev)
```bash
# 1. Start infrastructure (PostgreSQL + Redis)
docker compose -f infra/docker/docker-compose.yml up -d postgres redis

# 2. Install dependencies
pnpm install

# 3. Generate Prisma client + run migrations
cd apps/api-gateway
npx prisma generate
npx prisma migrate deploy

# 4. Set up env
cp .env .env.local  # edit as needed

# 5. Start all services
pnpm dev
# or from root: pnpm --filter @techfusion/api-gateway dev

# 6. (Optional) Seed KB articles with deterministic embeddings
#    First sign up and create an org (POST /auth/signup),
#    then run:
#    pnpm seed
```

**Full docker-compose** (all services):
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```
This starts: postgres (5433), redis (6379), api-gateway (3001), web (3000), agent, worker.

### Option B: k3d / Kubernetes (infra/k8s)
```bash
# 1. Create k3d cluster (if not existing)
k3d cluster create techfusion --port "8080:80@loadbalancer"

# 2. Install cert-manager (dependency)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.5/cert-manager.yaml

# 3. Create namespace
kubectl create namespace techfusion

# 4. Install Helm chart
helm upgrade --install techfusion ./infra/k8s \
  --namespace techfusion \
  --values ./infra/k8s/values-staging.yaml

# 5. Verify
kubectl get pods -n techfusion
helm list -n techfusion
```

**Note:** The k8s setup requires pre-configured secrets (`postgres-credentials`, etc.) and the GHCR image registry. The Helm chart deploys: api-gateway (3 replicas + HPA), web (3 replicas), worker (2 replicas), agent (1 replica), PostgreSQL (TimescaleDB), Redis, Prometheus, Grafana, Loki, OpenTelemetry Collector, and cert-manager.

---

## 7. Running Tests

### All API Gateway Tests
```bash
cd apps/api-gateway

# Single command (with OOM fix flags):
NODE_OPTIONS="--max-old-space-size=6144" jest --forceExit --runInBand

# Or via pnpm:
pnpm test
```

The `pnpm test` script in `apps/api-gateway/package.json` is:
```
NODE_OPTIONS="--max-old-space-size=6144" jest --forceExit --runInBand
```

**Memory flags explained:** `--max-old-space-size=6144` (6 GB heap) was required after OOM failures during full test suite execution. `--forceExit` prevents hanging after all tests complete. `--runInBand` avoids concurrency issues with the shared test database.

### Expected Test Count
**201 `it()` test cases** across 14 spec files + 1 test directory spec:

| Spec File | Tests |
|-----------|-------|
| `apps/api-gateway/test/app.integration.spec.ts` | 39 |
| `apps/api-gateway/test/enterprise.integration.spec.ts` | 22 |
| `apps/api-gateway/test/full-e2e-scenario.spec.ts` | 13 |
| `src/billing/billing.integration.spec.ts` | 24 |
| `src/billing/plan-features.spec.ts` | 21 |
| `src/billing/plan-guard.spec.ts` | 13 |
| `src/devices/scoring.service.spec.ts` | 10 |
| `src/security/services/security-scoring.service.spec.ts` | 9 |
| `src/network/network.service.spec.ts` | 9 |
| `src/alerts/alert-evaluation.service.spec.ts` | 8 |
| `src/kb/kb.service.spec.ts` | 6 |
| `src/security/security.integration.spec.ts` | 5 |
| `src/ai/controllers/troubleshooting.controller.spec.ts` | 5 |
| `src/ai/ai-orchestrator.service.spec.ts` | 4 |
| `test/e2e/full-scenario.spec.ts` (at root `/test`) | 13 |

> **Note:** The agent (`apps/agent`) has Rust unit tests in `network_discovery.rs` (5 tests, run via `cargo test`). The worker (`apps/worker`) has no tests (`echo 'no tests yet'`).

---

## 8. Known Limitations / Technical Debt

### Stubs & Incomplete Features
1. **Recovery Wizard — NOT IMPLEMENTED.** No recovery/remediation workflow exists beyond individual finding remediation. The original plan's "Phase 13 Recovery Wizard" was not built.
2. **Remote session execution is a stub.** The agent endpoint `remote-support/agent/status` and screen-capture flow exist, but the actual WebRTC/ICE relay (`turnServer`/`turnCredential`) is not provisioned — sessions get created but no real TURN server is configured.
3. **Worker notification is a stub.** The worker logs to console instead of sending real email/webhook notifications (`src/main.ts:14` shows `console.log`).
4. **Agent updates — NOT IMPLEMENTED.** No agent auto-update mechanism exists.
5. **Multi-region / geographic redundancy — NOT IMPLEMENTED.** Single-region only.
6. **CI/CD secrets management — NOT IMPLEMENTED.** Production k8s secrets must be manually created.

### Simplified / Dev-Grade Implementations
7. **KB embeddings are deterministic in seed data.** `prisma/seed.ts` uses 64-dim embeddings generated by character-code hashing, not real AI embeddings. The production pipeline (`kb.service.ts`) uses 1536-dim embeddings via `AiOrchestratorService.getEmbedding()` which calls OpenAI `text-embedding-3-small`, falling back to `getLocalEmbedding()` (deterministic hash) when no API key is configured.
8. **No pgvector extension.** Embedding similarity search is brute-force O(n) in application code rather than indexed. Fine for <10K chunks; will need pgvector migration at scale.
9. **Security scans are agent-driven only.** There's no server-triggered scan scheduling beyond what the agent periodically sends.
10. **Test database is shared.** Tests delete all data in `beforeEach`, so they cannot run in parallel (hence `--runInBand`).
11. **No Helm chart for production readiness.** The `infra/k8s/README.md` notes that k8s manifests were planned for Phase 14; the current charts exist but haven't been validated in a production environment.
12. **Agent compile-time vendor OUI list.** The MAC vendor lookup in `network_discovery.rs` is hardcoded — no external OUI database file is used.

### Security/Production Gaps
13. **JWT secret in .env is a dev placeholder.** `JWT_SECRET="dev-secret-change-in-production-abc123"` — MUST be changed in production.
14. **AI_ENCRYPTION_KEY is a dev placeholder.** Uses `dev-encryption-key-change-in-production-at-least-32-chars` — MUST be changed. Production should use a KMS (AWS KMS / GCP Cloud KMS / Azure Key Vault) for the master key.
15. **CORS is wide open.** `app.enableCors({ origin: '*', credentials: true })` — restrict in production.
16. **Stripe secrets are placeholders.** `sk_test_placeholder` / `whsec_placeholder` — MUST be replaced with real keys.

---

## 9. Default / Seed Credentials

There are **no hardcoded seed users or credentials** created by the application. The `prisma/seed.ts` script only seeds KB articles (not users). To create test accounts:

1. Use the signup flow:
```bash
curl -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Test123!","displayName":"Admin","orgName":"TestOrg"}'
```

2. This creates: an `Organization`, a `User` with `Owner` role, and returns JWT + refresh tokens.

3. Use the returned JWT for subsequent requests:
```bash
curl -H "Authorization: Bearer <jwt>" http://localhost:3001/admin/dashboard
```

### KB Seed Data
Running `pnpm seed` (from `apps/api-gateway`) populates 8 troubleshooting articles with deterministic 64-dim embeddings:
- Troubleshooting a Slow Computer
- Network Connectivity Troubleshooting
- Blue Screen of Death (BSOD) Analysis
- Printer Not Working
- Email Configuration and Troubleshooting
- VPN Connection Troubleshooting
- Disk Space Management and Recovery
- Malware Infection Detection and Response

These are real markdown articles, but their embeddings are character-code hashes (not semantic). The articles are usable for UI testing; semantic search requires real OpenAI embeddings.

---

## 10. Module Map

| Module | Phase | Folder/Service | Purpose |
|--------|-------|---------------|---------|
| Auth | 1 | `api-gateway/src/auth` | User registration, login, JWT refresh, logout |
| MFA | 1 | `api-gateway/src/mfa` | TOTP multi-factor enrollment and verification |
| Devices | 2 | `api-gateway/src/devices` | Device registration, metrics ingestion, health scoring |
| Alerts | 3 | `api-gateway/src/alerts` | Alert rule CRUD, evaluation engine, notification dispatch |
| AI Orchestrator | 4 | `api-gateway/src/ai` | LLM provider abstraction (Anthropic/OpenAI), cost tracking, usage logging |
| Troubleshooting | 4 | `api-gateway/src/ai/controllers` | AI-powered device troubleshooting with RAG and SSE streaming |
| Security | 5 | `api-gateway/src/security` | Security findings ingestion, scoring, executive summaries |
| Network | 6 | `api-gateway/src/network` | Network device discovery, topology, diagnostics (latency/DNS/traceroute) |
| Inventory | 6 | `api-gateway/src/inventory` | Driver and software inventory ingestion and catalog |
| Reporting | 7 | `api-gateway/src/reporting` | PDF/DOCX/HTML report generation with branding and scheduling |
| Backups | 8 | `api-gateway/src/backups` | Backup job CRUD, run management, restore points |
| Remote Support | 9 | `api-gateway/src/remote-support` | Remote session management, WebRTC signaling, consent, recording |
| Knowledge Base | 10 | `api-gateway/src/kb` | RAG knowledge base: article CRUD, chunking, embedding, cosine-similarity search |
| Billing | 11 | `api-gateway/src/billing` | Stripe integration, plan management, usage limits |
| Audit | 12 | `api-gateway/src/audit` | Audit log query, CSV/JSON export |
| Encryption | 12 | `api-gateway/src/encryption` | Envelope encryption verification endpoint |
| SSO | 12 | `api-gateway/src/sso` | SAML/OIDC SSO configuration, JIT user provisioning |
| Retention | 12 | `api-gateway/src/retention` | Data retention policy management and enforcement |
| Admin | 12 | `api-gateway/src/admin` | Organization dashboard, user management, role assignment |
| Agent | 6 | `apps/agent` | Rust system agent: metrics, security scans, network discovery, inventory, remote session client |
| Worker | 3 | `apps/worker` | BullMQ queue worker for alert notifications |
| Web UI | 2+ | `apps/web` | Next.js dashboard: device health, AI chat, cybersecurity, network, backup, reporting, settings |
| Infrastructure | 14 | `infra/k8s` | Helm chart: PostgreSQL, Redis, Prometheus, Grafana, Loki, cert-manager, OTEL collector |
| Load Testing | 15 | `test/load` | k6 scripts: AI chat, mixed workload, remote support, reports, telemetry |
| E2E Testing | 15 | `test/e2e` | Full end-to-end scenario with 13 test cases |
| Chaos Testing | 16 | `test/chaos` | Chaos engineering experiments and results |
| Security Review | 16 | `test/security` | Automated security review findings |

---

## Quick Reference

### Start development
```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres redis
pnpm install
cd apps/api-gateway && npx prisma generate && npx prisma migrate deploy && cd -
pnpm dev
```

### Run all tests
```bash
cd apps/api-gateway && pnpm test
```

### Build all
```bash
pnpm build
```

### Seed KB
```bash
cd apps/api-gateway && pnpm seed
```

### Run Rust agent locally
```bash
cd apps/agent
TF_API_URL="http://localhost:3001" cargo run
```

### Apply k8s Helm chart
```bash
helm upgrade --install techfusion ./infra/k8s --namespace techfusion --values ./infra/k8s/values-staging.yaml
```

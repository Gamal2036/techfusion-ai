# TechFusion AI — Master Specification (2026 Enterprise Edition)

> Unified platform for IT Technicians, MSPs, SysAdmins, and Cybersecurity teams.
> Positioning: "Cursor + Linear + Splashtop + AIDA64 + TeamViewer + Malwarebytes + AI" — in one product.

---

## 1. Executive Summary

TechFusion AI replaces 8–10 fragmented tools (diagnostics, RMM, AV scanners, remote desktop, ticketing, knowledge base, reporting) with one SaaS platform built around three pillars: **real-time device intelligence**, **AI-assisted resolution**, and **defensive security posture management**. It targets independent technicians, IT departments, and Managed Service Providers (MSPs) who currently stitch together AIDA64 + TeamViewer + Malwarebytes + spreadsheets + Word reports.

**Differentiators:** a single lightweight cross-platform agent, a multi-provider AI layer with anti-hallucination guardrails, automated executive-grade reporting, and a 2026-grade glassmorphic UI rather than a legacy enterprise console.

---

## 2. Core Modules (Functional Scope)

### 2.1 Device Health Center
Full hardware diagnostics: CPU, GPU, RAM, SSD/HDD with SMART data, battery wear, thermals, fan RPM, motherboard sensors. Outputs three composite scores — **Health Score**, **Performance Score**, **Risk Score** — plus live charts (utilization, temperature trend, throughput).

### 2.2 AI Troubleshooting Agent
A specialized support agent that ingests logs and error signatures, classifies the probable root cause, explains it in plain language, and proposes a ranked, step-by-step remediation plan. Guardrails: every claim must be traceable to a parsed log line, a known KB article, or a documented vendor advisory — if no grounding exists, the agent says so explicitly instead of guessing.

### 2.3 Cybersecurity Center (Defensive Only)
Posture scanning for missing OS/software updates, weak configurations, exposed services/open ports (read-only enumeration of the local host/network — no exploitation, no payload delivery), password policy compliance, and common misconfigurations (e.g., SMBv1 enabled, default credentials, disabled firewall). Produces a **Security Score**, **Risk Level** (Low/Medium/High/Critical), and an **Executive Summary Report**. Explicitly out of scope: exploit generation, intrusion tooling, credential cracking, offensive payloads.

### 2.4 Network Center
Passive/active device discovery on the local subnet, a visual network map, latency monitoring, DNS resolution testing, connectivity/internet diagnostics (traceroute, packet loss, jitter).

### 2.5 Remote Support
WebRTC-based remote desktop and screen sharing, remote assistance (chat + annotation), session recording, and tamper-evident audit logs of every remote action.

### 2.6 Driver & Software Center
Detects installed drivers/software, flags missing or outdated drivers against a vendor catalog, maintains a software inventory with version tracking and EOL/CVE flags.

### 2.7 Backup & Recovery Center
File-level and full-image backup scheduling, restore point management, and a guided recovery wizard.

### 2.8 Monitoring Center
Continuous telemetry for CPU/RAM/Network/Disk/Services with threshold-based real-time alerts (push, email, webhook).

### 2.9 AI Knowledge Base
RAG-powered internal knowledge base (documentation, guides, troubleshooting articles) backed by a vector database, used both for technician self-service and as grounding context for the AI Troubleshooting Agent.

### 2.10 Enterprise Reporting Engine
Generates PDF/DOCX/HTML reports combining discovered issues, risk ratings, recommendations, and an executive summary — brandable per tenant (MSP white-labeling).

### 2.11 AI Layer (Cross-Cutting)
Multi-provider abstraction (Anthropic, OpenAI, etc.) with automatic fallback on provider failure, load balancing across providers/keys, and cost-optimization routing (cheaper model for classification, stronger model for root-cause reasoning).

---

## 3. Personas

- **Independent IT Technician** — needs fast diagnostics + client-ready reports.
- **MSP Operator** — needs multi-tenant device fleets, remote support, billing per client.
- **Enterprise SysAdmin / SOC Analyst** — needs fleet monitoring, security posture, SSO, audit trails, compliance exports.

---

## 4. System Architecture (High Level)

```
                         ┌────────────────────────┐
                         │   Web App (Next.js)     │
                         │  Dashboard / Admin UI   │
                         └───────────┬─────────────┘
                                     │ HTTPS / WSS
                         ┌───────────▼─────────────┐
                         │     API Gateway          │
                         │  (NestJS, REST + WS)     │
                         │  AuthN/Z, rate limit,    │
                         │  tenant routing          │
                         └─────┬─────────┬──────────┘
           ┌─────────────────┐ │         │ ┌──────────────────┐
           │  Auth Service    │◄┘         └►│ AI Orchestrator   │
           └─────────────────┘               │ (multi-provider)  │
           ┌─────────────────┐               └──────────────────┘
           │ Device Health Svc│
           └─────────────────┘
           ┌─────────────────┐   ┌──────────────────┐  ┌─────────────────┐
           │ Cybersecurity Svc│   │ Network Svc      │  │ Monitoring Svc   │
           └─────────────────┘   └──────────────────┘  └─────────────────┘
           ┌─────────────────┐   ┌──────────────────┐  ┌─────────────────┐
           │ Remote Support Svc│  │ Driver/SW Svc     │  │ Backup Svc       │
           └─────────────────┘   └──────────────────┘  └─────────────────┘
           ┌─────────────────┐   ┌──────────────────┐
           │ Knowledge Base Svc│  │ Reporting Svc     │
           │ (RAG + Vector DB) │  └──────────────────┘
           └─────────────────┘   ┌──────────────────┐
                                  │ Billing Svc       │
                                  └──────────────────┘

  Endpoint Agent (Rust/Go, cross-platform) ── gRPC/WSS (mTLS) ──► Ingestion Gateway
```

**Data layer:** PostgreSQL (system of record, multi-tenant via `org_id` row-level security) + TimescaleDB extension (metrics time-series) + Redis (cache, sessions, queues) + Qdrant/pgvector (KB embeddings) + S3-compatible object storage (reports, backups, session recordings).

**Async layer:** Redis/BullMQ for MVP; Kafka introduced at Enterprise scale for event streaming (telemetry ingestion, audit events).

---

## 5. Database Schema (Core Tables)

```
organizations(id, name, plan_tier, billing_customer_id, created_at)
users(id, org_id, email, password_hash, role, mfa_enabled, created_at)
roles(id, org_id, name, permissions_json)
devices(id, org_id, hostname, os, agent_version, last_seen_at, status)
device_metrics(id, device_id, ts, cpu_pct, ram_pct, gpu_pct, disk_io, temp_c, fan_rpm)  -- Timescale hypertable
device_health_scores(id, device_id, ts, health_score, performance_score, risk_score, raw_breakdown_json)
smart_data(id, device_id, ts, drive_id, attributes_json, predicted_failure)
security_scans(id, device_id, started_at, finished_at, status)
security_findings(id, scan_id, category, severity, title, description, remediation, cve_refs)
security_scores(id, device_id, scan_id, score, risk_level)
network_devices(id, org_id, network_id, ip, mac, hostname, vendor, last_seen_at)
network_scans(id, org_id, network_id, started_at, finished_at, topology_json)
remote_sessions(id, org_id, device_id, technician_id, started_at, ended_at, recording_url)
audit_logs(id, org_id, actor_id, action, target_type, target_id, ts, ip, metadata_json)
drivers(id, device_id, name, vendor, current_version, latest_version, status)
software_inventory(id, device_id, name, version, install_date, eol_date, cve_flag)
backup_jobs(id, device_id, type, schedule_cron, target_storage, status)
backup_runs(id, job_id, started_at, finished_at, size_bytes, status)
alerts(id, org_id, device_id, type, threshold, severity, status, created_at)
kb_articles(id, org_id, title, content_md, tags, created_at)
kb_embeddings(id, article_id, chunk_index, embedding_vector, content_chunk)
reports(id, org_id, device_id, type, format, file_url, generated_at)
subscriptions(id, org_id, plan_tier, stripe_subscription_id, status, current_period_end)
invoices(id, org_id, amount, currency, status, issued_at)
ai_provider_configs(id, org_id, provider, api_key_encrypted, priority, enabled)
ai_usage_logs(id, org_id, provider, model, tokens_in, tokens_out, cost_usd, ts)
```

All tenant-scoped tables include `org_id` with PostgreSQL Row-Level Security policies enforcing isolation at the database level (defense-in-depth alongside application-level checks).

---

## 6. API Architecture

- REST, versioned: `/api/v1/...`, JSON:API-style error envelope.
- Domain-grouped routes: `/devices`, `/devices/:id/metrics`, `/devices/:id/health-score`, `/security/scans`, `/security/findings`, `/network/discovery`, `/remote/sessions`, `/drivers`, `/software`, `/backups`, `/alerts`, `/kb/articles`, `/kb/query` (RAG), `/reports`, `/billing/subscriptions`.
- Real-time: WebSocket channels per tenant (`org:{id}:metrics`, `org:{id}:alerts`, `remote:{sessionId}:signaling`).
- Agent ↔ backend: gRPC over mTLS for telemetry ingestion (lower overhead, strong auth per device certificate).
- AuthN: OAuth2/OIDC + JWT access/refresh tokens; SAML SSO for Enterprise tier.
- AuthZ: RBAC (Owner/Admin/Technician/Viewer) enforced in gateway middleware + RLS in DB.
- Rate limiting per tenant and per API key; idempotency keys on write endpoints.

---

## 7. Frontend Structure

- **Framework:** Next.js (App Router) + TypeScript + TailwindCSS + shadcn/ui.
- **Design language:** dark-mode-first, glassmorphism panels, subtle 3D depth (Framer Motion + a light Three.js layer for the network map / device 3D health visual), Linear-style command palette (Cmd+K), Cursor-style AI side panel.
- **Key surfaces:** Dashboard (fleet overview), Device Detail (health/perf/risk + charts), Security Center, Network Map (canvas/3D), AI Chat Panel (persistent right-side drawer), Remote Session Viewer, Reports Library, Knowledge Base, Billing/Settings.
- **State:** React Query for server state, Zustand for UI/local state, WebSocket hooks for live metrics.

---

## 8. Backend Structure

NestJS modular monolith for MVP (faster to ship, simpler ops), with clear module boundaries (`auth`, `devices`, `security`, `network`, `ai`, `remote`, `drivers`, `backups`, `monitoring`, `kb`, `reporting`, `billing`) designed to be extracted into independent microservices once usage justifies it (Enterprise phase). Each module: controller → service → repository, with its own DTOs and Postgres schema namespace, so extraction later is a lift-and-shift, not a rewrite.

---

## 9. AI Layer Architecture

- **Provider abstraction:** a single `AiOrchestratorService` interface (`complete()`, `embed()`) implemented per provider (Anthropic, OpenAI, etc.), selected via a routing policy (task type → preferred model tier).
- **Fallback:** circuit breaker per provider; on failure/timeout, automatic retry against the next provider in priority order; failure is logged to `ai_usage_logs` and surfaced in admin monitoring.
- **Cost optimization:** cheap/fast model for classification & summarization, stronger model reserved for root-cause reasoning and report writing.
- **RAG pipeline (Knowledge Base):** ingest → chunk → embed → store in vector DB → on query, retrieve top-k chunks → inject as grounding context → generate answer with citations to source article. The Troubleshooting Agent always answers from retrieved context or explicitly states it lacks sufficient information rather than fabricating a fix.

---

## 10. Security Architecture

- Multi-tenant isolation: `org_id` everywhere + Postgres RLS.
- Transport: TLS 1.3 everywhere; agent-to-backend over mTLS with per-device certificates (revocable).
- Secrets: vault-based secret storage (e.g., AWS Secrets Manager/HashiCorp Vault) — never plaintext API keys in DB; `ai_provider_configs.api_key_encrypted` encrypted with envelope encryption (KMS).
- AuthN/Z: MFA support, short-lived JWTs with refresh rotation, SAML/OIDC SSO at Enterprise tier.
- Audit: every privileged action (remote session start, security scan, settings change) written to `audit_logs`, append-only, exportable for compliance.
- Cybersecurity Center constraints: scanning is strictly read-only/enumerative and runs only against assets the tenant owns/has registered the agent on — no external scanning of arbitrary hosts, no exploitation, no credential brute-forcing.
- Compliance posture (Enterprise): SOC 2-aligned controls, data residency options, configurable data retention.

---

## 11. Deployment Architecture

**MVP (single region):** Docker Compose locally → managed Postgres (RDS/Cloud SQL) + Redis (Elasticache) + app containers on a single ECS/Cloud Run service group behind a load balancer; object storage on S3.

**Enterprise (Kubernetes):**
- Namespaces per environment (`staging`, `production`) and logically per major tenant tier if needed.
- Deployments: `api-gateway`, `auth-svc`, `device-health-svc`, `cybersecurity-svc`, `network-svc`, `ai-orchestrator-svc`, `remote-support-svc`, `kb-svc`, `reporting-svc`, `billing-svc`, `web` (Next.js), `worker` (BullMQ consumers).
- HorizontalPodAutoscaler on CPU/RPS for `api-gateway`, `ai-orchestrator-svc`, `reporting-svc`.
- StatefulSets/managed services for Postgres (prefer managed RDS over in-cluster), Redis, Qdrant.
- Ingress with TLS termination (NGINX Ingress / Cloud LB), cert-manager for certs.
- Observability: Prometheus + Grafana, OpenTelemetry tracing, Loki/ELK for logs.
- CI/CD: GitHub Actions → build/test → push images → ArgoCD/Helm rollout, blue-green or canary for `api-gateway`.

---

## 12. Full Folder Structure (Monorepo, Turborepo/Nx)

```
techfusion-ai/
├── apps/
│   ├── web/                      # Next.js frontend
│   ├── api-gateway/               # NestJS gateway + module-per-domain
│   │   └── src/modules/{auth,devices,security,network,ai,remote,drivers,backups,monitoring,kb,reporting,billing}/
│   ├── agent/                     # Cross-platform endpoint agent (Rust)
│   └── worker/                    # Background job consumers
├── packages/
│   ├── ui/                        # Shared design system (shadcn-based components)
│   ├── types/                     # Shared TypeScript types/DTOs
│   ├── config/                    # Shared eslint/tsconfig/env schema
│   └── utils/
├── infra/
│   ├── docker/                    # Dockerfiles + docker-compose.yml
│   ├── k8s/                       # Helm charts / manifests per service
│   └── terraform/                 # Cloud infra as code
├── docs/                          # PRD, architecture, ADRs
├── .github/workflows/             # CI/CD pipelines
├── turbo.json
└── package.json
```

---

## 13. Business Model & Pricing

| Tier | Target | Devices | Highlights | Indicative Price |
|---|---|---|---|---|
| **Free** | Individual hobbyist | 1 device | Health Center, basic AI chat (rate-limited), 1 manual report/month | $0 |
| **Pro** | Independent technician | up to 10 devices | Full diagnostics, full AI agent, Security Center, unlimited reports | $19–29/mo |
| **Business** | Small MSP / IT team | up to 100 devices | Multi-tenant client management, Remote Support, Network Center, white-label reports | $99–199/mo |
| **Enterprise** | Large org / large MSP | Unlimited | SSO/SAML, audit/compliance exports, dedicated AI cost controls, SLA, on-prem agent options | Custom |

Secondary revenue: per-seat technician add-ons, overage pricing for AI usage above plan quota, marketplace for KB content packs.

---

## 14. Scope Tiers (MVP → Growth → Enterprise)

**MVP:** Auth/multi-tenant core, Device Health Center, Monitoring + Alerts, AI Troubleshooting Agent (no RAG yet, direct provider calls), Cybersecurity Center (basic scan + score + report), Reporting Engine (PDF), Billing (Free/Pro/Business via Stripe).

**Growth:** Network Center, Driver & Software Center, Backup & Recovery, Remote Support (WebRTC), AI Knowledge Base with full RAG.

**Enterprise:** SSO/SAML, audit/compliance exports, Kubernetes-scale deployment with autoscaling, white-labeling, advanced cost-optimized AI routing, data residency controls.

---

## 15. Roadmap Overview

See `02-OpenCode-Build-Prompts.md` for the executable, phase-by-phase build plan (16 phases, Phase 0 → Phase 15) designed to be run sequentially through OpenCode, each with explicit acceptance criteria and a mandatory test-and-confirm step.

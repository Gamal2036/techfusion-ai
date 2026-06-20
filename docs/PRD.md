# TechFusion AI — Product Requirements Document

> **Status:** v1.0 — MVP Implemented
> **Last Updated:** 2026-06-20

---

## 1. Executive Summary

TechFusion AI is a unified SaaS platform for IT technicians, MSPs, sysadmins, and cybersecurity teams. It replaces 8–10 fragmented tools (diagnostics, RMM, AV scanners, remote desktop, ticketing, knowledge base, reporting) with one platform built around three pillars: **real-time device intelligence**, **AI-assisted resolution**, and **defensive security posture management**.

**Target Users:** Independent technicians, IT departments, and Managed Service Providers (MSPs) who currently stitch together AIDA64 + TeamViewer + Malwarebytes + spreadsheets + Word reports.

**Tagline:** "Cursor + Linear + Splashtop + AIDA64 + TeamViewer + Malwarebytes + AI — in one product."

### Problem Statement
IT professionals managing multiple devices face tool sprawl — separate apps for diagnostics, remote access, security scanning, reporting, and ticketing. This leads to context switching, inconsistent data, manual report generation, and delayed incident response. There is no affordable all-in-one platform that combines real-time device health monitoring, AI-powered troubleshooting, and security posture management.

### Solution
A single cross-platform agent + cloud dashboard that provides:
- Real-time device health monitoring with composite scoring
- AI-assisted root cause analysis and remediation planning
- Defensive security scanning and posture scoring
- Network discovery and topology visualization
- Remote desktop and screen sharing
- Driver/software inventory management
- Backup scheduling and restore management
- RAG-powered knowledge base
- Automated executive-grade reporting
- Multi-tenant MSP support with billing

---

## 2. Product Objectives

| Objective | Metric | Target |
|-----------|--------|--------|
| Reduce tool count per technician | Integrated features | Replace 8+ separate tools |
| Speed up troubleshooting | Mean time to resolution | 40% reduction via AI agent |
| Improve security posture | Devices with security score | 100% coverage |
| Automate reporting | Reports generated automatically | Zero manual report creation |
| Enable MSP operations | Multi-tenant support | Tenant isolation + per-client billing |

---

## 3. Personas

### 3.1 Independent IT Technician
- Needs fast diagnostics + client-ready reports
- Manages 1–10 devices
- Values simplicity, low cost, professional output
- **Primary features:** Device Health Center, AI Troubleshooting, Reporting

### 3.2 MSP Operator
- Needs multi-tenant device fleets, remote support, per-client billing
- Manages 10–100+ devices across multiple clients
- Values white-labeling, team management, consolidated dashboard
- **Primary features:** Multi-tenant, Remote Support, Network Center, Billing

### 3.3 Enterprise SysAdmin / SOC Analyst
- Needs fleet monitoring, security posture, SSO, audit trails, compliance exports
- Manages 100+ devices
- Values compliance, audit, role-based access, data retention
- **Primary features:** SSO/SAML, Audit Logs, Retention Policies, Security Center

---

## 4. Feature Requirements

### 4.1 Device Health Center (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| DH-01 | Collect CPU, RAM, GPU, disk metrics from agent | P0 | Done |
| DH-02 | Store time-series metrics in TimescaleDB hypertable | P0 | Done |
| DH-03 | Compute Health Score, Performance Score, Risk Score (0–100) | P0 | Done |
| DH-04 | Expose live charts and latest metrics via REST API | P0 | Done |
| DH-05 | WebSocket real-time metric streaming | P1 | Done |
| DH-06 | SMART disk health data collection | P1 | Done |
| DH-07 | Battery wear and thermal monitoring | P1 | Done |

### 4.2 AI Troubleshooting Agent (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| AI-01 | Multi-provider LLM abstraction (Anthropic, OpenAI) | P0 | Done |
| AI-02 | Automatic fallback between providers | P0 | Done |
| AI-03 | RAG-grounded troubleshooting from KB articles | P0 | Done |
| AI-04 | Anti-hallucination guardrails (cite source or state uncertainty) | P0 | Done |
| AI-05 | SSE streaming of AI responses | P1 | Done |
| AI-06 | Cost tracking per request (tokens, model, latency) | P1 | Done |
| AI-07 | Deterministic hash embedding fallback when no API key | P1 | Done |
| AI-08 | Per-org AI provider configuration (encrypted API keys) | P1 | Done |

### 4.3 Cybersecurity Center (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| SC-01 | Agent-side security posture scanning (updates, firewall, ports, config) | P0 | Done |
| SC-02 | REST API for findings ingestion and query | P0 | Done |
| SC-03 | Security Score (0–100) + Risk Level (Low/Medium/High/Critical) | P0 | Done |
| SC-04 | Executive Summary Report generation | P1 | Done |
| SC-05 | PDF export of security reports | P1 | Done |
| SC-06 | Finding remediation endpoint | P1 | Done |

### 4.4 Network Center (Growth — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| NC-01 | ARP/ICMP-based local subnet device discovery | P1 | Done |
| NC-02 | Network topology visualization data | P1 | Done |
| NC-03 | Latency, DNS, traceroute, connectivity diagnostics | P1 | Done |
| NC-04 | WebSocket real-time network status | P1 | Done |

### 4.5 Remote Support (Growth — Partially Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| RS-01 | Remote session creation and management | P1 | Done |
| RS-02 | WebRTC signaling gateway | P1 | Done |
| RS-03 | Session recording metadata | P1 | Done |
| RS-04 | Consent workflow and audit logging | P1 | Done |
| RS-05 | **TURN server provisioning** | P1 | **Stub** — no real TURN server configured |
| RS-06 | Agent-side screen capture and input forwarding | P1 | Done |

### 4.6 Driver & Software Center (Growth — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| DS-01 | Driver inventory ingestion from agent | P1 | Done |
| DS-02 | Software inventory ingestion from agent | P1 | Done |
| DS-03 | Vendor driver catalog with version tracking | P1 | Done |
| DS-04 | Software catalog with EOL/CVE flags | P1 | Done |

### 4.7 Backup & Recovery (Growth — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| BK-01 | Backup job CRUD with cron scheduling | P1 | Done |
| BK-02 | Backup run tracking and status | P1 | Done |
| BK-03 | Restore point management | P1 | Done |
| BK-04 | Restore trigger endpoint | P1 | Done |
| BK-05 | **Recovery Wizard** | P2 | **Not implemented** |

### 4.8 Monitoring & Alerts (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| AL-01 | Alert rule CRUD (metric, threshold, operator, severity) | P0 | Done |
| AL-02 | Alert evaluation engine against device metrics | P0 | Done |
| AL-03 | Alert acknowledgment workflow | P0 | Done |
| AL-04 | WebSocket real-time alert push | P0 | Done |
| AL-05 | **Email/webhook notification dispatch** | P1 | **Stub** — console.log only |

### 4.9 AI Knowledge Base (Growth — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| KB-01 | Article CRUD with markdown content | P1 | Done |
| KB-02 | Text chunking and embedding pipeline (1536-dim) | P1 | Done |
| KB-03 | Cosine similarity search in application code | P1 | Done |
| KB-04 | RAG query endpoint (retrieve + generate) | P1 | Done |
| KB-05 | 8 seed KB articles with deterministic embeddings | P1 | Done |

### 4.10 Enterprise Reporting (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| RP-01 | Report generation in PDF, DOCX, HTML formats | P0 | Done |
| RP-02 | AI-generated executive summaries | P1 | Done |
| RP-03 | Report scheduling with cron | P1 | Done |
| RP-04 | Branding (company name, logo, accent color) | P1 | Done |

### 4.11 Billing & Plans (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| BL-01 | Stripe checkout session creation | P0 | Done |
| BL-02 | Stripe customer portal | P0 | Done |
| BL-03 | Stripe webhook handling | P0 | Done |
| BL-04 | Plan-based feature gating (Free/Pro/Business/Enterprise) | P0 | Done |
| BL-05 | Usage tracking and quota limiting | P1 | Done |

### 4.12 Enterprise Features (Enterprise — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| EN-01 | SAML/OIDC SSO configuration | P1 | Done |
| EN-02 | JIT user provisioning from SSO | P1 | Done |
| EN-03 | Audit log query with CSV/JSON export | P1 | Done |
| EN-04 | Data retention policy management | P1 | Done |
| EN-05 | Data retention enforcement | P1 | Done |

### 4.13 Admin & Management (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| AD-01 | Organization dashboard | P0 | Done |
| AD-02 | User management (list, detail, role change, remove) | P0 | Done |
| AD-03 | Role-based access control (Owner/Admin/Technician/Viewer) | P0 | Done |

### 4.14 Multi-Factor Authentication (MVP — Implemented)
| ID | Requirement | Priority | Status |
|----|------------|----------|--------|
| MF-01 | TOTP enrollment (secret generation + QR code) | P0 | Done |
| MF-02 | TOTP verification endpoint | P0 | Done |
| MF-03 | MFA status query | P0 | Done |

---

## 5. Pricing Tiers

| Tier | Target | Devices | Key Features | Price |
|------|--------|---------|-------------|-------|
| **Free** | Individual hobbyist | 1 device | Health Center, basic AI chat (rate-limited), 1 report/month | $0 |
| **Pro** | Independent technician | Up to 10 | Full diagnostics, full AI agent, Security Center, unlimited reports | $19–29/mo |
| **Business** | Small MSP / IT team | Up to 100 | Multi-tenant, Remote Support, Network Center, white-label reports | $99–199/mo |
| **Enterprise** | Large org / MSP | Unlimited | SSO/SAML, audit/compliance, dedicated AI cost controls, SLA | Custom |

Secondary revenue: per-seat add-ons, AI usage overage, marketplace KB content packs.

---

## 6. Technical Architecture

### 6.1 System Overview
- **Frontend:** Next.js 14 (App Router) + TypeScript + TailwindCSS
- **API Gateway:** NestJS monolith with domain modules (18 modules)
- **Worker:** BullMQ background job processor (Node.js)
- **Agent:** Cross-platform Rust binary
- **Database:** PostgreSQL 16 + TimescaleDB + Redis 7
- **AI:** Multi-provider (Anthropic Claude, OpenAI GPT) with automatic fallback

### 6.2 Data Layer
- **PostgreSQL** — System of record, multi-tenant via `org_id` RLS
- **TimescaleDB** — Time-series metrics (`DeviceMetric` hypertable)
- **Redis** — BullMQ queues, WebSocket pub/sub
- **Embeddings** — JSONB float arrays in PostgreSQL (1536-dim), cosine similarity in application code

### 6.3 API Design
- REST (no version prefix), JSON:API-style error envelope
- Auth: JWT access/refresh tokens + device tokens for agent endpoints
- RBAC: Owner/Admin/Technician/Viewer
- WebSocket: `/metrics`, `/network`, `/remote` namespaces per org
- Rate limiting per tenant (via `@nestjs/throttler`)
- Plan-gating per feature (via `PlanGuard`)

### 6.4 Agent Architecture
- Written in Rust with `sysinfo`, `serde`, `reqwest`
- Runs as a persistent daemon on target devices
- Collects: system metrics (10s interval), security findings (1h), network sweep (5m), inventory (30m)
- Communicates with API via HTTP (device-token authenticated)

### 6.5 AI Architecture
| Task | Provider | Model |
|------|----------|-------|
| Troubleshooting | Anthropic (primary) / OpenAI (fallback) | Claude Sonnet 4 / GPT-4o |
| Embeddings | OpenAI | text-embedding-3-small (1536-dim) |
| Classification | Gemini Flash / Claude Haiku (planned) | Cost-optimized routing |
| Fallback (no key) | Deterministic hash | 1536-dim character-code hash (not semantic) |

---

## 7. Deployment Architecture

### Development
- Docker Compose: postgres + redis + api-gateway + web + worker
- Build: pnpm monorepo with multi-stage Docker builds from root context

### Production (planned)
- Kubernetes: ECS / Cloud Run (single-region MVP)
- Helm chart with Prometheus + Grafana + Loki
- CI/CD: GitHub Actions → GHCR → k8s

### Infrastructure Requirements
| Component | Specification |
|-----------|---------------|
| PostgreSQL | ~1 GB per 1K devices (metrics) |
| Redis | ~500 MB cache + queue |
| API Gateway | 2–4 vCPU, 4 GB RAM |
| Web | 2 vCPU, 2 GB RAM |
| Worker | 1 vCPU, 1 GB RAM |

---

## 8. Security Requirements

| Requirement | Implementation | Status |
|------------|---------------|--------|
| Multi-tenant isolation | `org_id` RLS + application-level guards | Done |
| Password hashing | bcryptjs | Done |
| JWT auth | Access + refresh token rotation | Done |
| MFA | TOTP via speakeasy | Done |
| SSO | SAML/OIDC | Done |
| Encryption at rest | AES-256-GCM envelope encryption for secrets | Done |
| Transport security | TLS 1.3 (mTLS for agent) | Planned |
| Audit logging | Append-only `AuditLog` table with export | Done |
| Rate limiting | @nestjs/throttler per tenant | Done |

### Security Gaps (pre-production)
- JWT secrets are dev placeholders
- AI encryption key is a dev placeholder
- CORS is wide open (`origin: '*'`)
- Stripe secrets are placeholders

---

## 9. Constraints & Assumptions

### Constraints
- Single-region PostgreSQL (no multi-region replication)
- Embeddings stored as JSONB (no pgvector extension)
- Agent must be manually installed on each device (no auto-update)
- WebRTC requires a TURN server for production use
- No offline mode — all features require API connectivity

### Assumptions
- Target devices have internet access to reach the API
- Users have basic IT literacy to install the Rust agent
- MSPs manage devices that belong to clearly defined organizations
- AI provider API keys are provisioned by the platform admin or org owner

---

## 10. Scope & Roadmap

### Phase 1 — Auth & Core (Completed)
- User registration, login, JWT refresh, logout
- TOTP MFA enrollment and verification
- Organization creation on signup

### Phase 2 — Device Health (Completed)
- Device registration (authenticated + public device-token)
- Metrics ingestion from agent
- Health scoring (Health, Performance, Risk)
- Device list, detail, metrics, scores endpoints

### Phase 3 — Monitoring & Alerts (Completed)
- Alert rule CRUD
- Alert evaluation engine
- Alert acknowledgment
- WebSocket push for real-time alerts

### Phase 4 — AI Layer (Completed)
- Multi-provider LLM abstraction
- AI-powered troubleshooting with RAG
- SSE streaming
- Cost tracking and usage logging

### Phase 5 — Security Center (Completed)
- Security findings ingestion
- Security scoring and risk level
- Executive summary and PDF export

### Phase 6 — Network & Inventory (Completed)
- Network device discovery and topology
- Diagnostics (latency, DNS, traceroute)
- Driver and software inventory

### Phase 7 — Reporting (Completed)
- PDF/DOCX/HTML report generation
- AI executive summaries
- Report scheduling and branding

### Phase 8 — Backups (Completed)
- Backup job management
- Run tracking and restore

### Phase 9 — Remote Support (Completed, with stubs)
- Session management
- WebRTC signaling
- Audit logging and consent

### Phase 10 — Knowledge Base (Completed)
- Article CRUD with markdown
- RAG pipeline with embedding search
- Seed data for testing

### Phase 11 — Billing (Completed)
- Stripe integration (checkout, portal, webhook)
- Plan-based feature gating
- Usage tracking

### Phase 12 — Enterprise Features (Completed)
- SSO/SAML configuration
- Audit log export
- Data retention policies
- Admin dashboard and user management

### Phase 13 — Recovery Wizard (Not Started)
- Guided remediation workflows
- Automated fix execution

### Phase 14 — Kubernetes Deployment (In Progress)
- Helm chart exists but not production-validated

### Phase 15 — Load & E2E Testing (Completed)
- k6 load test scripts (5 scenarios)
- Full E2E scenario tests

### Phase 16 — Chaos & Security Review (Completed)
- Chaos engineering experiments
- Security review findings documented

---

## 11. Success Metrics

| Metric | How to Measure | Current Baseline |
|--------|---------------|-----------------|
| API availability | Uptime monitoring | N/A (pre-launch) |
| Signup completion rate | Conversion funnel | N/A |
| Devices registered per org | DB count | N/A |
| AI response acceptance rate | User feedback / retry rate | N/A |
| Test suite pass rate | CI pipeline | 201 tests, target 100% |
| Build time | Docker build duration | ~3 min cold build |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Agent | Rust binary installed on target devices for metrics collection and remote access |
| Device Health Score | Composite 0–100 rating of a device's overall health based on metrics |
| MSP | Managed Service Provider — company that manages IT for multiple clients |
| RAG | Retrieval-Augmented Generation — AI that grounds responses in retrieved documents |
| RLS | Row-Level Security — PostgreSQL feature for automatic multi-tenant isolation |
| TURN | Traversal Using Relays around NAT — WebRTC relay server for NAT traversal |
| Hypertable | TimescaleDB automatic partitioning by time interval |
| RBAC | Role-Based Access Control — Owner > Admin > Technician > Viewer |

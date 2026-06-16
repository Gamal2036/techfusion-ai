# TechFusion AI — OpenCode Build Prompts (Phase 0 → Phase 15)

How to use this file: copy ONE phase block at a time into OpenCode, in order. Do not start Phase N+1 until OpenCode has confirmed Phase N with "good work". Each prompt already contains the verification rule, so you don't need to add it yourself.

---

## PHASE 0 — Monorepo Bootstrap & Infra Skeleton

```
You are building "TechFusion AI", a unified SaaS platform for IT technicians and cybersecurity teams. This is Phase 0 of 16. Build only what is described below — do not implement business features yet.

GOAL: Set up a production-grade monorepo skeleton with working CI and local dev environment.

TASKS:
1. Initialize a Turborepo monorepo named `techfusion-ai` with workspaces: apps/web, apps/api-gateway, apps/agent, apps/worker, packages/ui, packages/types, packages/config, packages/utils.
2. apps/web: Next.js 14+ (App Router) + TypeScript + TailwindCSS, with a placeholder landing page that just renders "TechFusion AI" with dark background.
3. apps/api-gateway: NestJS + TypeScript, with a /health endpoint returning { status: "ok" }.
4. apps/agent: minimal Rust binary scaffold (cargo project) that prints "agent stub" — full telemetry logic comes in Phase 3.
5. apps/worker: minimal Node/TypeScript worker scaffold connecting to a Redis instance (BullMQ) and logging "worker ready".
6. infra/docker: docker-compose.yml that spins up Postgres (with TimescaleDB image), Redis, and the four apps, all networked together.
7. infra/k8s: empty directory with a README describing it will hold Helm charts from Phase 14 onward.
8. .github/workflows: a CI workflow that runs lint + build + test for every workspace on push.
9. Root README.md explaining the monorepo layout and how to run `docker-compose up`.

ACCEPTANCE CRITERIA:
- `docker-compose up` brings up all services with no crash loops.
- `curl localhost:<gateway-port>/health` returns 200 { status: "ok" }.
- apps/web loads in a browser and shows the placeholder page.
- CI workflow file is syntactically valid and would run lint/build/test if pushed.

TESTING (mandatory before you finish):
- Run the build for every workspace.
- Run `docker-compose up -d`, curl the health endpoint, then `docker-compose down`.
- Run lint across the monorepo and fix any errors.
- Do not stop and ask the user for confirmation — fix all build/test errors yourself first.

FINAL STEP: Once the build succeeds, containers start cleanly, and the health check passes, output exactly the line `good work` on its own line. If anything fails, list the exact failing command and error, fix it, retest, and only then output `good work`.
```

---

## PHASE 1 — Auth, Multi-Tenancy & RBAC Core

```
This is Phase 1 of TechFusion AI (continuing the monorepo from Phase 0 — do not recreate the skeleton, extend it).

GOAL: Implement organizations, users, roles, and authentication with multi-tenant isolation.

TASKS:
1. Add Postgres schema/migrations (use the ORM of your choice, e.g. Prisma or TypeORM) for tables: organizations, users, roles. Every tenant-scoped table must include org_id.
2. Enable Postgres Row-Level Security policies so a query without the correct tenant context cannot read another org's rows.
3. Implement signup (creates an organization + first user as Owner), login, JWT access + refresh token issuance, and refresh rotation.
4. Implement RBAC middleware in apps/api-gateway with roles: Owner, Admin, Technician, Viewer. Protect a sample endpoint per role to prove enforcement.
5. Add MFA scaffold (TOTP) — can be feature-flagged off by default but the data model and enrollment endpoint must exist.
6. apps/web: build login + signup pages wired to the new endpoints, plus a basic authenticated layout shell (sidebar + topbar placeholder) shown after login.
7. Write integration tests proving: (a) a user cannot read another org's data, (b) role-protected endpoints reject lower-privilege roles, (c) refresh token rotation invalidates the old refresh token.

ACCEPTANCE CRITERIA:
- A new org + owner user can be created via signup.
- Login returns valid JWTs; protected endpoints reject missing/invalid tokens.
- Cross-tenant data access attempt is blocked at the DB level, not just the app level.
- All three integration tests above pass.

TESTING (mandatory before you finish):
- Run the full test suite (unit + integration) and ensure 100% pass.
- Manually exercise signup → login → call a protected endpoint → call it again after deliberately altering the org_id context to confirm isolation holds.
- Re-run Phase 0's health check to confirm nothing regressed.

FINAL STEP: Once all tests pass and the manual isolation check confirms tenant separation, output exactly `good work` on its own line. If any test fails, fix the root cause, rerun the full suite, and only then output `good work`.
```

---

## PHASE 2 — Design System & Frontend App Shell (2026 UI)

```
This is Phase 2 of TechFusion AI (build on Phases 0–1; auth already works).

GOAL: Build the shared design system and the authenticated app shell with a 2026 enterprise look: dark-mode-first, glassmorphism, subtle depth, Linear-style command palette.

TASKS:
1. In packages/ui, build a shared component library on top of shadcn/ui + Tailwind: buttons, cards (glass panel variant with backdrop-blur), inputs, modals, tables, badges/score-pills (for Health/Risk/Security scores), toasts.
2. Define a design token set (colors, radii, shadows, blur values) in packages/config so both web and future surfaces stay consistent.
3. Build the authenticated shell in apps/web: collapsible sidebar with module icons (Device Health, Monitoring, Cybersecurity, Network, Remote Support, Drivers/Software, Backup, AI Chat, Knowledge Base, Reports, Billing, Settings), topbar with org switcher and user menu, and a Cmd+K command palette for navigation.
4. Build an empty-state Dashboard page (fleet overview cards) using placeholder data — no live data wiring yet, that comes with later modules.
5. Add a persistent right-side AI chat drawer shell (UI only, no backend call yet) that can be toggled from anywhere in the app.
6. Ensure responsive behavior down to tablet width and a clean dark/light toggle (default dark).

ACCEPTANCE CRITERIA:
- All shell navigation items route to placeholder pages without errors.
- Cmd+K opens the command palette and can navigate to at least 3 different sections.
- Visual design matches the brief: dark glassmorphic panels, no default unstyled shadcn look.
- No console errors/warnings in the browser on any shell page.

TESTING (mandatory before you finish):
- Run the frontend build and fix any TypeScript/build errors.
- Run any component/unit tests for the shared UI package.
- Manually click through every sidebar item and the command palette and confirm no broken routes or console errors.

FINAL STEP: Once the shell builds cleanly and every navigation path works with no console errors, output exactly `good work` on its own line. Otherwise, fix the issues, re-verify, then output `good work`.
```

---

## PHASE 3 — Device Health Center (Agent + Ingestion + Dashboard)

```
This is Phase 3 of TechFusion AI (auth + shell exist from Phases 1–2).

GOAL: Implement real device telemetry end to end: agent collects data, backend ingests and stores it, frontend visualizes it.

TASKS:
1. apps/agent (Rust): collect CPU usage, RAM usage, GPU usage (if available), disk usage + SMART data, battery status (if laptop), temperatures, fan RPM, motherboard sensor data where exposed by the OS. Package into a typed payload and send it over a secure channel (mTLS gRPC or WSS) to the gateway every N seconds (configurable).
2. apps/api-gateway: add a `devices` module — device registration (issues a per-device certificate/token), an ingestion endpoint/stream for metrics, and persistence into `devices` and `device_metrics` (Timescale hypertable) tables, scoped by org_id.
3. Implement a scoring service that computes Health Score, Performance Score, and Risk Score from the latest metrics + SMART data, using clearly documented weighted formulas (write the formula in code comments so it's auditable, not a black box).
4. Expose REST endpoints: list devices, get device detail, get device metrics history, get current scores.
5. apps/web: build the Device Health Center pages — fleet list with score badges, and a device detail page with live/near-live charts (CPU/RAM/temp over time) and the three score gauges.
6. Add WebSocket push so the dashboard updates without manual refresh when new metrics arrive.

ACCEPTANCE CRITERIA:
- Running the agent locally registers a device and metrics appear in the database within seconds.
- The device detail page renders real charts from real ingested data, not mock data.
- Health/Performance/Risk scores recalculate as new metrics arrive and are visible in the UI.
- Cross-tenant isolation still holds for device data (reuse Phase 1 isolation tests, extended to devices).

TESTING (mandatory before you finish):
- Run unit tests for the scoring formulas with known inputs/expected outputs.
- Run an end-to-end test: start agent stub → confirm metric row appears in DB → confirm API returns it → confirm UI receives the WebSocket push.
- Run the full existing test suite to confirm no regressions from Phases 0–2.

FINAL STEP: Once end-to-end ingestion, scoring, and live UI updates are verified, output exactly `good work` on its own line. If anything fails, fix it, rerun all tests, then output `good work`.
```

---

## PHASE 4 — Monitoring Center & Real-Time Alerts

```
This is Phase 4 of TechFusion AI (Device Health Center from Phase 3 already streams metrics).

GOAL: Add continuous monitoring with configurable thresholds and real-time alerting on top of the existing metrics pipeline.

TASKS:
1. Extend the `devices` module with an `alerts` module: alert rule model (metric type, operator, threshold, severity), CRUD endpoints, and an evaluation worker (in apps/worker) that checks incoming metrics against active rules.
2. On rule breach, create an `alerts` row, push a WebSocket event to the org's `alerts` channel, and send a notification (email + optional webhook) via a notification service.
3. apps/web: build the Monitoring Center page — live status tiles per device (CPU/RAM/Network/Disk/Services), an alert feed with severity color-coding, and an alert rule management UI.
4. Add a "services" check on the agent (Phase 3 agent) reporting whether key OS services are running, feeding into monitoring status.
5. Ensure alert evaluation is debounced/hysteresis-aware so a metric flapping at the threshold doesn't spam duplicate alerts.

ACCEPTANCE CRITERIA:
- Creating an alert rule and then exceeding the threshold (simulate via test data) produces exactly one alert per breach episode, visible in UI within seconds via WebSocket.
- Email/webhook notification fires on breach (can be verified via a test inbox/mock webhook receiver in dev).
- Alert rules are tenant-scoped and respect RBAC (only Admin/Owner can create/edit rules; Technician/Viewer can view).

TESTING (mandatory before you finish):
- Unit test the threshold evaluation logic, including the debounce/hysteresis behavior.
- Integration test: simulate a metric breach end-to-end and assert an alert is created, pushed, and notified exactly once.
- Re-run the full test suite for regressions.

FINAL STEP: Once alerting is verified end-to-end with no duplicate/missed alerts, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 5 — AI Troubleshooting Agent (Multi-Provider Orchestrator)

```
This is Phase 5 of TechFusion AI.

GOAL: Build the AI layer's provider-agnostic orchestrator and the AI Troubleshooting Agent chat experience, with anti-hallucination guardrails. No RAG/Knowledge Base yet — that is Phase 12.

TASKS:
1. Add an `ai` module in apps/api-gateway implementing an `AiOrchestratorService` interface with `complete()` and `embed()` methods, and at least two real provider adapters behind it (e.g. Anthropic and one other), selected via a configurable priority list stored in `ai_provider_configs` (API keys encrypted at rest, never logged in plaintext).
2. Implement automatic fallback: if the primary provider errors or times out, retry against the next provider in priority order; log every attempt (provider, latency, success/failure, token counts, cost) to `ai_usage_logs`.
3. Implement the Troubleshooting Agent flow: user pastes an error/log snippet or describes a symptom → the agent parses available structured context (the device's latest metrics/scores from Phase 3 if a device is selected) → produces (a) likely root cause, (b) plain-language explanation, (c) ranked step-by-step fix, all clearly labeled, and (d) an explicit confidence/“insufficient information” statement when it cannot ground its answer in the provided data — it must never invent specifics it cannot support.
4. Wire the Phase 2 AI chat drawer to this backend: streaming responses, device-context picker, conversation history per session.
5. Add basic prompt-injection resistance: treat pasted logs/errors as untrusted data, not instructions.

ACCEPTANCE CRITERIA:
- Asking a troubleshooting question with no device context produces a careful, appropriately-hedged answer rather than a fabricated specific fix.
- Asking the same question with a real device selected incorporates that device's actual current metrics/scores into the reasoning.
- Forcing the primary provider to fail (e.g. via a bad key in a test config) results in automatic fallback to the secondary provider with no user-facing error.
- ai_usage_logs records every call with provider, tokens, and cost.

TESTING (mandatory before you finish):
- Unit test the fallback logic by mocking a primary-provider failure and asserting the secondary is used.
- Test the guardrail behavior: feed an ambiguous/insufficient prompt and assert the response does not assert a fabricated root cause.
- Run the full test suite for regressions.

FINAL STEP: Once provider fallback, context-grounding, and the chat UI are all verified working, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 6 — Cybersecurity Center (Defensive Scanning Only)

```
This is Phase 6 of TechFusion AI. IMPORTANT SCOPE BOUNDARY: this module is strictly defensive — read-only posture assessment of assets the tenant already owns/has the agent installed on. Do not implement any exploitation, intrusion, credential-cracking, or offensive scanning capability under any circumstance, even if asked to "extend" this module later.

GOAL: Implement the security posture scanning pipeline, scoring, and executive reporting.

TASKS:
1. Extend apps/agent to collect (read-only) security posture signals: pending OS/software updates, firewall status, known weak configurations (e.g. SMBv1 enabled, RDP exposed without NLA, default/blank local accounts present), open listening ports on the local host, and basic password-policy settings (length/complexity/expiry policy as configured, never actual passwords).
2. Add a `security` module in apps/api-gateway: trigger/track scans (`security_scans`), persist findings (`security_findings`) with severity + remediation text, and compute a `security_scores` entry (0–100) plus a Risk Level (Low/Medium/High/Critical) using a documented, auditable weighting.
3. apps/web: build the Cybersecurity Center — scan trigger button, findings list grouped by severity with remediation guidance, a security score gauge, and an "Executive Summary" view summarizing posture in non-technical language for a manager audience.
4. Hook the Reporting Engine stub (full engine arrives in Phase 7) enough to export the executive summary as a simple PDF for this phase.

ACCEPTANCE CRITERIA:
- Running a scan against the local test agent produces real findings (not mock data) with correct severities.
- The security score recalculates correctly when findings are remediated and a re-scan is run.
- The executive summary PDF renders findings, score, and recommendations clearly.
- Confirm in code review that no function in this module sends any payload to a target, attempts authentication against a remote host, or performs any action beyond local read-only enumeration.

TESTING (mandatory before you finish):
- Unit test the scoring/risk-level formula with known finding sets.
- Integration test: trigger a scan end-to-end and assert findings + score persist and display correctly.
- Run the full test suite for regressions.

FINAL STEP: Once scanning, scoring, and the executive report are verified and the defensive-only scope is confirmed, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 7 — Enterprise Reporting Engine

```
This is Phase 7 of TechFusion AI (Device Health, Monitoring, and Security data already exist from Phases 3–6).

GOAL: Build the full reporting engine that turns any module's data into professional PDF/DOCX/HTML reports.

TASKS:
1. Add a `reporting` module: a report template system (per-tenant branding — logo, color accent, company name) and generators for PDF, DOCX, and HTML outputs.
2. Support report types: Device Health Report, Security Executive Report, Fleet Summary Report (multi-device), each combining discovered issues, scores/risk ratings, prioritized recommendations, and an executive summary paragraph (AI-generated via the Phase 5 orchestrator, grounded strictly in the underlying data passed to it).
3. apps/web: build a Reports Library page — generate-on-demand, schedule recurring generation, download/share links, and a branding settings page for white-label customization (Business/Enterprise tiers).
4. Store generated reports in object storage with a `reports` table record (org-scoped) and signed, expiring download URLs.

ACCEPTANCE CRITERIA:
- Generating each report type produces a correctly formatted, branded file in all three formats.
- The AI-generated executive summary in a report only references facts present in the underlying data (no fabricated figures).
- Reports are only downloadable by users in the owning organization (signed URL + auth check).

TESTING (mandatory before you finish):
- Unit test each generator (PDF/DOCX/HTML) for structural correctness (sections present, branding applied).
- Integration test: generate a report end-to-end from real Phase 3/6 data and verify the file is retrievable only by the correct tenant.
- Run the full test suite for regressions.

FINAL STEP: Once all three report types generate correctly and access control is verified, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 8 — Billing & Subscription System (MVP Checkpoint)

```
This is Phase 8 of TechFusion AI. Completing this phase marks the MVP as functionally complete.

GOAL: Implement the Free / Pro / Business / Enterprise plan tiers with Stripe billing and plan-based feature gating.

TASKS:
1. Add a `billing` module: Stripe customer + subscription creation, webhook handling (payment success/failure, plan change, cancellation), and persistence into `subscriptions` and `invoices`.
2. Implement plan-based feature gating middleware: device count limits, report generation limits, AI usage quotas, and module access (e.g. Remote Support gated to Business+) — enforced server-side, not just hidden in UI.
3. apps/web: build a Billing & Plans page — current plan display, usage meters (devices used / quota, AI usage this period), upgrade/downgrade flow via Stripe Checkout/Customer Portal.
4. Implement graceful downgrade handling (e.g. org exceeds new plan's device limit — flag excess devices as inactive rather than silently deleting data).
5. Add an internal admin view (Owner-only) showing the org's full billing history and current entitlements.

ACCEPTANCE CRITERIA:
- A test org can sign up on Free, hit a quota limit, upgrade via Stripe test mode, and immediately gain access to the gated feature.
- Stripe webhooks correctly update subscription status in the database (use Stripe CLI/test webhooks to verify).
- Feature gates are enforced at the API layer even if a client tries to call a gated endpoint directly.

TESTING (mandatory before you finish):
- Unit test the feature-gating logic for every plan tier boundary.
- Integration test the Stripe webhook handler with simulated test events (success, failure, cancellation).
- Run the full test suite for regressions — this is the MVP checkpoint, so also do a full smoke test of Phases 1–8 together (signup → device onboarding → monitoring → AI chat → security scan → report → billing).

FINAL STEP: Once billing, gating, and the full MVP smoke test all pass, output exactly `good work` on its own line, followed by a one-line note confirming "MVP scope complete". Otherwise fix, retest, then output `good work`.
```

---

## PHASE 9 — Network Center

```
This is Phase 9 of TechFusion AI (Growth scope begins here, building on the completed MVP).

GOAL: Implement local network discovery, visual mapping, and connectivity diagnostics.

TASKS:
1. Extend apps/agent with (read-only, local-network-only) device discovery: ARP table reads, mDNS/SSDP listening, and ICMP sweep within the agent's own subnet only — never scanning networks the device isn't part of.
2. Add a `network` module: persist discovered devices (`network_devices`), run periodic discovery scans (`network_scans`), and compute a topology graph for visualization.
3. Implement diagnostics endpoints: latency monitoring (ping over time), DNS resolution testing against configurable resolvers, traceroute/connectivity testing to common external endpoints.
4. apps/web: build the Network Center — a visual network map (force-directed graph or simple radial layout) showing discovered devices and their status, plus latency/DNS/connectivity charts.

ACCEPTANCE CRITERIA:
- Running discovery on a real local network surfaces real connected devices (not mock data), each with vendor/hostname where resolvable.
- The visual map renders without overlap/freezing for at least 50 nodes.
- Latency and DNS diagnostics produce real, time-stamped results that update on schedule.

TESTING (mandatory before you finish):
- Unit test the topology-graph builder with a known device list.
- Integration test: run a discovery scan end-to-end and confirm devices + map render correctly in the UI.
- Run the full test suite for regressions.

FINAL STEP: Once discovery, diagnostics, and the visual map are verified, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 10 — Driver & Software Center + Backup & Recovery Center

```
This is Phase 10 of TechFusion AI.

GOAL: Implement driver/software inventory tracking and backup/recovery management.

TASKS:
1. Extend apps/agent to enumerate installed drivers (name, vendor, current version) and installed software (name, version, install date).
2. Add a `drivers` and `software` data pipeline: persist into `drivers`/`software_inventory`, and cross-reference against a maintained "latest known version" catalog (start with a simple seedable catalog table; flag drivers as outdated/missing when no match exists).
3. apps/web: Driver & Software Center page — sortable/filterable inventory table, outdated/missing badges, version history per item.
4. Add a `backups` module: backup job scheduling (file-level and full-image types), `backup_jobs`/`backup_runs` tracking, and a restore-point list per device.
5. apps/web: Backup & Recovery Center — job scheduling UI, run history with status, and a guided Recovery Wizard (step-by-step UI flow; can target a mock/stub restore execution for now if true OS-level restore is out of scope for this phase, but the workflow and state machine must be real and tested).

ACCEPTANCE CRITERIA:
- Driver/software inventory reflects real data from the test machine running the agent.
- Outdated/missing driver detection correctly flags items against the seeded catalog.
- A scheduled backup job actually runs on schedule and records a `backup_runs` entry with real status/size.
- The Recovery Wizard walks through all steps without dead ends and reaches a clear success/failure state.

TESTING (mandatory before you finish):
- Unit test the version-comparison logic for outdated/missing detection.
- Integration test: schedule a backup job, let it fire, and confirm a `backup_runs` record with correct status.
- Run the full test suite for regressions.

FINAL STEP: Once inventory tracking and backup scheduling/execution are verified, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 11 — Remote Support (WebRTC Remote Desktop)

```
This is Phase 11 of TechFusion AI.

GOAL: Implement remote desktop/screen sharing, session recording, and tamper-evident audit logging.

TASKS:
1. Add a `remote` module: session initiation (technician requests a session against a specific device, device-side agent must accept/consent — never silent/unattended access without explicit consent unless the org has pre-configured unattended access with documented policy), WebRTC signaling over the existing WebSocket infrastructure, and a TURN/STUN configuration for NAT traversal.
2. Implement screen sharing + remote input control over the WebRTC data/media channels, with a clear on-device indicator that a session is active (never a silent/invisible remote session).
3. Implement session recording (store to object storage) and full audit logging of session start/end, actions taken, and participants, into `remote_sessions` and `audit_logs`.
4. apps/web: Remote Support page — session launcher, in-browser remote viewer, session recording playback, and an audit log view per session.

ACCEPTANCE CRITERIA:
- A technician can initiate a session, the target device shows a clear consent/active-session indicator, and the technician can view/control the remote screen in-browser.
- Every session is recorded and the recording is retrievable and playable afterward.
- The audit log accurately captures session start, end, and key actions, and is immutable (no update/delete endpoint exposed for audit_logs).

TESTING (mandatory before you finish):
- Integration test the signaling handshake end-to-end between two test clients.
- Test that session recordings are correctly stored and retrievable, scoped to the owning org.
- Run the full test suite for regressions.

FINAL STEP: Once a full remote session can be initiated, recorded, and audited end-to-end, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 12 — AI Knowledge Base (RAG + Vector DB)

```
This is Phase 12 of TechFusion AI. Completing this phase marks the Growth scope as functionally complete.

GOAL: Implement the RAG-powered Knowledge Base and connect it as grounding context for the Phase 5 Troubleshooting Agent.

TASKS:
1. Stand up a vector database (pgvector extension on the existing Postgres, or Qdrant if you prefer a dedicated service) and a `kb` module: article CRUD (`kb_articles`), chunking + embedding pipeline on save, storing chunks in `kb_embeddings`.
2. Implement a retrieval endpoint (`/kb/query`) that embeds the query, retrieves top-k relevant chunks, and returns them with source article references.
3. Wire the Troubleshooting Agent (Phase 5) to call `/kb/query` first and inject retrieved chunks as grounding context before generating its answer, citing which KB article(s) informed the response.
4. apps/web: Knowledge Base page — article browser/search, article editor (Markdown), and within the AI chat drawer, visible citations linking back to the KB articles used in a given answer.
5. Seed the KB with a starter set of generic IT troubleshooting articles so RAG has something real to retrieve from day one.

ACCEPTANCE CRITERIA:
- Asking the Troubleshooting Agent a question that matches a seeded KB article produces an answer that cites that article.
- Asking a question with no relevant KB content results in the agent relying on general reasoning and explicitly noting it found no matching internal documentation, rather than fabricating a citation.
- KB search returns relevant articles for plausible technician queries.

TESTING (mandatory before you finish):
- Unit test the chunking/embedding pipeline.
- Integration test: seed a known article, query something it should match, and assert retrieval + citation works.
- Run the full test suite for regressions, plus a full Growth-scope smoke test (Network Center, Driver/Software, Backup, Remote Support, Knowledge Base all together).

FINAL STEP: Once RAG retrieval, grounded citations, and the full Growth smoke test all pass, output exactly `good work` on its own line, followed by a one-line note confirming "Growth scope complete". Otherwise fix, retest, then output `good work`.
```

---

## PHASE 13 — Enterprise Security Hardening

```
This is Phase 13 of TechFusion AI (Enterprise scope begins here).

GOAL: Add enterprise-grade auth, audit, and compliance controls.

TASKS:
1. Implement SAML 2.0 / OIDC SSO as an alternative login path, configurable per organization (Enterprise tier only), with just-in-time user provisioning.
2. Extend audit logging to cover every privileged action across all modules built so far (security scans, remote sessions, billing changes, settings changes, user role changes) with consistent schema and an exportable CSV/JSON audit report.
3. Implement encryption-at-rest verification for sensitive fields (API keys, backup metadata, recording URLs) and document the key management approach (KMS-backed envelope encryption).
4. Add configurable data retention policies per org (e.g. auto-purge metrics/recordings after N days) with a scheduled job enforcing them.
5. Add an Enterprise admin console: org-wide user management, SSO configuration, audit export, retention policy configuration.

ACCEPTANCE CRITERIA:
- SSO login works against a test IdP (e.g. a test SAML/OIDC provider) and provisions a new user correctly on first login.
- Audit export contains every action type tested across previous phases, correctly attributed and timestamped.
- Retention policy enforcement actually purges data past the configured window in a test run.

TESTING (mandatory before you finish):
- Integration test SSO login flow end-to-end against a test IdP.
- Integration test the retention purge job with seeded old data.
- Run the full test suite for regressions.

FINAL STEP: Once SSO, audit export, and retention enforcement are all verified, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 14 — Kubernetes Production Deployment & Observability

```
This is Phase 14 of TechFusion AI.

GOAL: Move from Docker Compose to a production-grade Kubernetes deployment with autoscaling and full observability.

TASKS:
1. Write Helm charts (or equivalent manifests) in infra/k8s for every deployable service (api-gateway, worker, web, and any modules extracted as separate services), including resource requests/limits, liveness/readiness probes, and ConfigMap/Secret usage for environment config.
2. Configure HorizontalPodAutoscalers for the api-gateway and AI orchestrator path based on CPU/RPS.
3. Set up Ingress with TLS (cert-manager), and externalize stateful dependencies (Postgres, Redis, vector DB) to managed services or StatefulSets as appropriate.
4. Add observability: Prometheus metrics exposed by each service, a Grafana dashboard set (request latency, error rate, queue depth, AI provider latency/cost), OpenTelemetry tracing across the gateway and at least two downstream modules, and centralized logging.
5. Wire CI/CD: GitHub Actions builds and pushes images, then triggers a Helm/ArgoCD rollout to a staging namespace automatically and to production on manual approval.

ACCEPTANCE CRITERIA:
- A clean `helm install` (or manifest apply) into a test cluster brings the full platform up successfully.
- Killing a pod results in automatic recovery with no data loss, observable in the dashboards.
- Autoscaling triggers correctly under synthetic load and scales back down afterward.
- CI/CD pipeline successfully deploys a trivial change through staging automatically.

TESTING (mandatory before you finish):
- Deploy to a test/staging cluster and run the full existing test suite against it, not just locally.
- Run a basic load test against api-gateway and confirm autoscaling behavior in the metrics dashboard.
- Verify zero-downtime rollout by deploying a change while sending continuous health-check traffic.

FINAL STEP: Once the cluster deployment, autoscaling, observability, and CI/CD pipeline are all verified, output exactly `good work` on its own line. Otherwise fix, retest, then output `good work`.
```

---

## PHASE 15 — Performance, Load Testing & Launch Readiness (Enterprise Checkpoint)

```
This is Phase 15 of TechFusion AI, the final phase. Completing this phase marks the Enterprise scope as functionally complete and the platform launch-ready.

GOAL: Validate performance, resilience, and overall product readiness across every module built in Phases 0–14.

TASKS:
1. Build a load-testing suite (e.g. k6 or similar) covering: concurrent device telemetry ingestion at realistic fleet scale, concurrent AI chat sessions, concurrent report generation, and concurrent remote support sessions.
2. Run chaos/resilience checks: kill a database connection pool under load, kill an AI provider, kill a pod mid-request, and confirm the system degrades gracefully (fallbacks, retries, clear error states) rather than cascading failure.
3. Run a full security review pass: dependency vulnerability scan, verify RLS tenant isolation still holds under the full feature set, verify the Cybersecurity Center module still contains zero offensive capability, verify all secrets are encrypted at rest and never logged.
4. Produce a final launch checklist document (docs/launch-checklist.md) covering monitoring dashboards in place, on-call/alerting configured, backup of the platform's own database configured, and rollback procedure documented.
5. Run one full end-to-end scenario covering every module in sequence: signup → invite team → onboard 3 devices → live monitoring/alerts → AI troubleshooting with KB citation → security scan + executive report → network discovery → remote support session → backup job → billing plan upgrade → SSO login for a second user → audit export.

ACCEPTANCE CRITERIA:
- Load tests meet defined latency/error-rate targets at target fleet scale (define and document the target numbers based on realistic MSP fleet sizes, e.g. 500 devices / 50 concurrent technicians, and report actual results against them).
- Chaos tests show graceful degradation with no data corruption and clear recovery.
- Security review finds no critical/high vulnerabilities left unresolved, and confirms the defensive-only boundary of the Cybersecurity Center is intact.
- The full end-to-end scenario completes successfully with no manual workarounds.

TESTING (mandatory before you finish):
- Execute the full load test suite and record results in docs/launch-checklist.md.
- Execute all chaos scenarios and document observed behavior.
- Execute the full end-to-end scenario personally, step by step, and fix any breakage found.
- Run the complete automated test suite for the entire project one final time, end to end.

FINAL STEP: Once load testing, chaos testing, the security review, and the full end-to-end scenario all pass, output exactly `good work` on its own line, followed by a one-line note confirming "Enterprise scope complete — TechFusion AI is launch-ready". Otherwise fix the issues found, retest, and only then output `good work`.
```

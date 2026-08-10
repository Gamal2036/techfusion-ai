# 00 — Current State

Status date: 2026-08-09. Branch `main` at `1b7ee52`. Latest mission: `V1-STAGE-01-SUB-01` SSO authentication remediation (S1 CRITICAL closed — SSO login DISABLED_SAFE; full report `docs/tech-lead/V1-STAGE-01-SUB-01_SSO_REMEDIATION_REPORT.md`).

## 1. Verified Baseline

| Claim | Verdict | Evidence |
|-------|---------|----------|
| V1 CI/CD local gate is green | `VERIFIED_THIS_RUN` (local) | `scripts/ci-v1-gate.sh` 19-step gate; certification reports `docs/v1/V1-STAGE-01C_CICD_RELEASE_GATE_CERTIFICATION_REPORT.md`, `V1-STAGE-01C-R4_DOCKER_PACKAGING_GATE_REPORT.md` report 19/19 PASS and 913 API / 790 web / 79 worker / 78 agent tests |
| GitHub-native CI green | `UNVERIFIED` | Both STAGE-01C reports explicitly state `GITHUB RUN PENDING`; CI-REAL-01..07 deferred to an operator push. No GitHub run evidence in git |
| ci-api / ci-web / ci-worker / ci-agent / ci-bootstrap / ci-migration / ci-security / v1-green-gate jobs | `INFERRED_FROM_CODE` | `.github/workflows/ci.yml` defines all eight; fail-closed gate at lines 318-348 |
| Docker matrix builds green (gateway/web/worker/agent) | `INFERRED_FROM_CODE` (local gate step) | `ci.yml:351-437`; Dockerfiles exist for all four services; local gate verifies image builds |
| GHCR publishing authorized | `VERIFIED_THIS_RUN` | Commit `c4d56bf fix(ci): authorize GHCR package publishing`; login/package-write permissions in `ci.yml:362-364,412-417` |
| Linux agent enrollment/reconnection manually tested | `VERIFIED_BY_CURRENT_CI` | `docs/v1/V1-STAGE-00B-R2_BETA4_RELEASE_REAL_DEVICE_CERTIFICATION_REPORT.md`, `V1-ENROLL-01A_LINUX_ZERO_TOUCH_ENROLLMENT_REPORT.md`, `V1-STAGE-01B_PRESENCE_TELEMETRY_RELIABILITY_REPORT.md` |
| Persistent device credentials exist | `VERIFIED_THIS_RUN` | `apps/agent/src/registration.rs` (token/device_id files, 0600); `Device.deviceTokenHash` + rotation events server-side |
| Organization / membership / RBAC / monitoring work exists | `VERIFIED_THIS_RUN` | `OrganizationMember` model (migration `20260807000000`), `Permission` catalog ~40 keys, monitoring/presence sweep, alert lifecycle |

## 2. Git State

- `git status --short`: single untracked file `apps/api-gateway/.env.test` (test placeholders, explicitly unignored via `!.env.test`). Not modified by this mission.
- Recent history: 8 commits after the `v1.0.0-agent-beta.4` tag — CI/release-gate hardening (`STAGE-01C`), modular CI, TimescaleDB fix, GHCR auth, billing/RBAC/monitoring/account work (`STAGE-01A/B`), command-center UI hardening.

## 3. What This Repository Actually Is

A working monorepo for a Linux-first device management + monitoring SaaS:

- **apps/web** — Next.js 14 command center (real API wiring, WebSocket live alerts, polling).
- **apps/api-gateway** — NestJS API (auth/RBAC/orgs/devices/enrollment/monitoring/alerts/network/inventory/security/KB/reporting/backups/remote-support/billing/AI/audit/admin).
- **apps/worker** — BullMQ worker, 8 processors (monitoring sweep, alerts, backups, inventory, security, retention, KB embedding, report).
- **apps/agent** — Rust (1.96.0) systemd Linux agent, `1.0.0-beta.4`, 78 tests, 17 verified endpoint call-sites.
- **packages/** — shared config, types, ui, utils.

## 4. Headline Findings (detail in referenced docs)

1. **Security CRITICAL — CLOSED**: SSO login accepted client-supplied identity with no IdP assertion validation — `POST /auth/sso/login` could authenticate as any email in an SSO-enabled org. Remediated `V1-STAGE-01-SUB-01` (fail-closed `501`, no tokens/JIT/link, 10 new regression tests, full API suite 923 green). SSO is **DISABLED_SAFE**, not certified. (`07`, `V1-STAGE-01-SUB-01_SSO_REMEDIATION_REPORT.md`)
2. **RLS DECIDED (Option B — app-layer authoritative, `V1-STAGE-01-SUB-02`)**: Empirically proven inert — the app DB role is `SUPERUSER` + `BYPASSRLS` (32 tables RLS-enabled, 0 FORCE, policies never consulted), no `set_config`/`OrgContextInterceptor` exists, and Prisma pooling cannot carry session settings safely. RLS stays as non-authoritative defense-in-depth (no migration, no FORCE added). Isolation is enforced by membership/device-authoritative app-layer `orgId` scoping + the `test/cross-tenant-isolation.spec.ts` regression suite (20 tests) + worker org re-verification. (`07`, `V1-STAGE-01-SUB-02_RLS_TENANT_ISOLATION_REPORT.md`)
3. **REPORT queue has no producer and its worker path hits a non-existent route**; **KB embedding silently falls back to deterministic mock vectors**. (`06`)
4. **CD (staging/production) is not deployable as written**: Helm chart `required` values not supplied, image repo/tag mismatch, `prisma db push --accept-data-loss` in prod init. (`02`, `10`)
5. **Presence/15-minute issue**: OFFLINE classification and offline alerts are, by design, only raised 15 minutes after the last heartbeat; presence sweeps run every minute. Fast UI classification (60s/5min bands) exists. (See `00` §6 and `06`)
6. **Windows agent: not implemented** — 15-gap analysis in `05_AGENT_PLATFORM_MATRIX.md`.
7. **Entitlement enforcement is partial**: devices/reports/AI-quota/feature-gates enforced server-side; `maxTeamMembers` and `maxAlertRules` defined but never enforced. (`09`)

## 5. Test Evidence

| App | Files | Count (from cert reports) | Command |
|-----|-------|---------------------------|---------|
| api-gateway | 20 specs (baseline) → 54 suites incl. `test/sso-login.spec.ts` + `test/cross-tenant-isolation.spec.ts` | 913 (baseline) → 923 (SUB-01) → 943 (SUB-02) | `pnpm test` (`jest --forceExit --runInBand`) |
| web | 35 specs | 790 | `pnpm test` (`jest --forceExit`) |
| worker | 8 specs | 79 (baseline) → 80 (SUB-02) | `pnpm test` |
| agent | 78 tests in-source | 78 | `cargo test` |

`VERIFIED_THIS_RUN` for api-gateway (54 suites / 943 tests green) and worker (8 suites / 80 tests green) on `V1-STAGE-01-SUB-02`; `pnpm lint` + `pnpm build` green; `scripts/ci-v1-gate.sh` 19/19 PASS. Web/agent counts from STAGE-01C cert reports; not re-run during this substage (no web/agent code touched).

## 6. Device Presence Finding (summary)

- Agent heartbeat = metrics POST every ~30 s (`apps/agent/src/config.rs`); server writes `Device.lastSeenAt` on every ingest (`apps/api-gateway/src/devices/devices.service.ts:314-317`).
- Classification bands (client & worker, mirrored): ONLINE ≤ 5 min, DEGRADED 5-15 min, OFFLINE > 15 min (`apps/web/src/lib/device-presence-state.ts`, `apps/worker/src/presence-state.ts`).
- Presence sweep: cron every minute + Redis lock → `MONITORING` queue → worker evaluates rules and creates/reopens OFFLINE alerts only when a device crosses the 15-minute boundary.
- **Root cause of the observed "~15 minutes"**: the OFFLINE threshold is 15 minutes by design; an offline device is therefore not flagged (UI stays ONLINE→DEGRADED) until 15 minutes after the last heartbeat, and the offline *alert* is not emitted until the sweep observes the crossing. Web UI poll is 15 s so UI latency itself is not the cause. Secondary contributors: any failure that stops metrics ingestion (401s after 3 consecutive auth failures stop telemetry; gateway/queue downtime) inherits the same 5/15-min detection window.
- Recommendation path (do not destabilize enrollment): add an optional DEGRADED/warning presence rule tier, make the sweep threshold/step tunable per rule, and document OFFLINE latency as inherent to the 15-min band. See `06_WORKER_QUEUE_MAP.md` §Presence.

## 7. Working-Tree Hygiene

`apps/api-gateway/.env.test` remains untracked (intended). This mission stages explicit mission files only (`apps/api-gateway/src/sso/sso.service.ts`, `apps/api-gateway/test/sso-login.spec.ts`, updated legacy SSO tests in `enterprise.integration.spec.ts` / `full-e2e-scenario.spec.ts`, and `docs/tech-lead/` updates). No secrets staged.

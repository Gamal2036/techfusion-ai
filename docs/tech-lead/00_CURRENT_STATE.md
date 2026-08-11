# 00 — Current State

Status date: 2026-08-11. Branch `main` at `8785dba`. Latest mission: `V1-STAGE-02-SUB-01A` Real Device Product Integration Certification — real-device integration boundary (Agent→Device Identity→Presence/Telemetry→Dashboard→Cybersecurity→Network) traced, truthfulness-certified, and three integration defects fixed (SEC-1 security push path fail-open 200→401; NET-1 dead `/api/network/scans` endpoint fetch; NET-2 unknown-MAC sentinel rendered as real). V1 gate 19/19 PASS; **manual real-device certification still required** to close the stage (report `docs/tech-lead/V1-STAGE-02-SUB-01A_REAL_DEVICE_PRODUCT_INTEGRATION_REPORT.md`). SUB-01 (enrollment/device-link reliability) remains the certified baseline; V1-STAGE-01 remains CLOSED.

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

- `git status --short`: single untracked file `apps/api-gateway/.env.test` (test placeholders, explicitly unignored via `!.env.test`). Never modified, never staged.
- Latest commit: `fix(integration): align device-backed product data flows` (V1-STAGE-02-SUB-01A) — security push-path fail-closed 401, network page dead-endpoint removal + unknown-MAC truthfulness, focused test updates, integration certification report + living-doc updates.
- Previous: `fix(device): certify enrollment and device-link reliability` (V1-STAGE-02-SUB-01) — schema/migration, devices/enrollment service hardening, E1-E8 suite, presence truthfulness, docs.
- Recent history: GOV-01 governance foundation, then V1-STAGE-01 security closure (S1-S5, `V1-STAGE-01-SUB-01..05`), CI/release-gate hardening, billing/RBAC/monitoring/account work, command-center UI hardening.

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
8. **Presence truthfulness CERTIFIED (`V1-STAGE-02-SUB-01`)**: `Device.lastSeenAt` nullable; registration never implies ONLINE (UNKNOWN until a verified heartbeat); enrollment/device-link lifecycle certified by `test/enrollment-device-link.spec.ts` (E1-E8, 16 tests) — single-use/expiry/revocation tokens, reconnect→same Device, registration race collapse, strong-identity credential recovery, no hostname-only relink.
9. **Real-device integration boundaries certified, 3 defects fixed (`V1-STAGE-02-SUB-01A`)**: telemetry→Dashboard, Cybersecurity, and Network paths are REAL_AGENT_DATA end-to-end (no demo/mock/fabricated values; zero hardcoded device data in web production pages; org/device always server-derived). Fixed: **SEC-1** `POST /devices/security-report` was fail-open (HTTP 200 + error body for an invalid/revoked credential, which the agent treated as success) → now 401 fail-closed, consistent with `DeviceTokenGuard`; **NET-1** Network page polled a non-existent `/api/network/scans` endpoint (dead scan-completion logic) → now uses real `GET /network/scans`; **NET-2** unknown-MAC sentinel `00:00:00:00:00:00` was rendered as a real MAC → now `-`. `GET /security/scans/detail/:scanId` verified NOT shadowed by `:deviceId` (single-segment matching). Remaining product gaps (security push-path body-token transport, Network org-pool merge/unassigned-scan semantics, server-host diagnostics) documented, not fixed. **Manual real-device gate pending** (operator evidence required to mark the stage COMPLETE).

## 5. Test Evidence

| App | Files | Count (from cert reports) | Command |
|-----|-------|---------------------------|---------|
| api-gateway | 58 suites incl. `test/enrollment-device-link.spec.ts`, `test/presence-telemetry.spec.ts`, `test/sso-login.spec.ts`, `test/cross-tenant-isolation.spec.ts`, `test/device-credential-hardening.spec.ts`, `test/device-metrics-security.spec.ts`, `test/metrics-auth-security.spec.ts` | 994 | `pnpm test` (`jest --forceExit --runInBand`) |
| web | 35 specs | 791 | `pnpm test` (`jest --forceExit`) |
| worker | 8 specs | 80 | `pnpm test` |
| agent | 78 tests in-source | 78 | `cargo test` |

`VERIFIED_THIS_RUN` for api-gateway (58 suites / 994 tests green — incl. E1-E8 enrollment/device-link suite and all five Stage-01 security suites), web (35 suites / 791 tests green — incl. onboarding baseline detection), worker (8 suites / 80 tests green), and agent (78 in-source tests) on `V1-STAGE-02-SUB-01A`; `pnpm lint` + `pnpm build` green (api/web/worker); `scripts/ci-v1-gate.sh` 19/19 PASS (incl. migration validation + worker schema sync + secret scan — NO SECRETS DETECTED). Security suite re-verified green after the SEC-1 fail-closed change (48 tests in the three touched specs; full suite 994 clean on re-run).

## 6. Device Presence Finding (summary)

- Agent heartbeat = metrics POST every ~30 s (`apps/agent/src/config.rs`); server writes `Device.lastSeenAt` on every authenticated ingest (`apps/api-gateway/src/devices/devices.service.ts:325-328`).
- **Presence truthfulness (V1-STAGE-02-SUB-01): `Device.lastSeenAt` is now nullable with no default.** Registration alone no longer writes a lastSeenAt — a Device row never implies ONLINE. A registered-but-never-heartbeat device derives **UNKNOWN** (verified by `test/enrollment-device-link.spec.ts` E1/E6 and `test/presence-telemetry.spec.ts` P1-P4). Migration `20260810120000_device_lastseen_nullable_presence_truth` (DROP NOT NULL + DROP DEFAULT); existing timestamps preserved (they reflect real prior heartbeats). Worker schema copy synced (`scripts/sync-prisma-schema.sh`).
- Classification bands (client & worker, mirrored): ONLINE ≤ 5 min, DEGRADED 5-15 min, OFFLINE > 15 min, UNKNOWN = no verified heartbeat (`apps/web/src/lib/device-presence-state.ts`, `apps/worker/src/presence-state.ts`).
- Presence sweep: cron every minute + Redis lock → `MONITORING` queue → worker evaluates rules and creates/reopens OFFLINE alerts only when a device crosses the 15-minute boundary; UNKNOWN devices are never flagged OFFLINE.
- **Root cause of the observed "~15 minutes"**: the OFFLINE threshold is 15 minutes by design; an offline device is therefore not flagged (UI stays ONLINE→DEGRADED) until 15 minutes after the last heartbeat, and the offline *alert* is not emitted until the sweep observes the crossing. Web UI poll is 15 s so UI latency itself is not the cause. Secondary contributors: any failure that stops metrics ingestion (401s after 3 consecutive auth failures stop telemetry; gateway/queue downtime) inherits the same 5/15-min detection window.
- Recommendation path (do not destabilize enrollment): add an optional DEGRADED/warning presence rule tier, make the sweep threshold/step tunable per rule, and document OFFLINE latency as inherent to the 15-min band. See `06_WORKER_QUEUE_MAP.md` §Presence.

## 7. Working-Tree Hygiene

`apps/api-gateway/.env.test` remains untracked (intended, D9). SUB-01A staged explicit integration files only: `src/security/security.controller.ts` (+ its integration spec), `test/device-credential-hardening.spec.ts`, `test/security.spec.ts`, `apps/web/src/app/dashboard/network/page.tsx`, `apps/web/src/components/NetworkMap.tsx`, and `docs/tech-lead/` updates (00, 08, 12 + the SUB-01A report). No secrets staged; no `.env*` staged.

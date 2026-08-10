# 12 — Master Roadmap

Dependency-aware execution plan from CURRENT STATE to Production V1. Stages are ordered by architecture dependencies (not UI pages). The stage list from the mission brief was retained where evidence supports it, but reordered/merged: identity/RBAC is already strong (not a P0 gate), so it is merged into Stage 01 rather than a separate early stage; Windows is split as its own dependency-serialized stage; billing/entitlements and reliability/deploy fixes are moved earlier because they gate paid launch.

Legend — S: S/M/L/XL complexity. "GATE" = the exit criterion for each stage.

## V1-STAGE-01 — Security, Tenancy & Credential Remediation (P0 hard gate)

- **Objective**: close the security findings that make paid V1 impossible (S1 SSO, S2 RLS, S3 device-token fallback).
- **Why now**: every later stage builds on a trust boundary; S1 was an active auth bypass.
- **Dependencies**: none (foundation).
- **Scope**: ~~SSO login fix or route removal~~ — **S1 DONE `V1-STAGE-01-SUB-01` (SSO login DISABLED_SAFE, fail-closed 501, regression tests green; real SAML/OIDC verification deferred to a dedicated future substage — see report §7 contract).** ~~RLS decision + cross-tenant isolation regression suite~~ — **S2 DONE `V1-STAGE-01-SUB-02` (Option B: app-layer authoritative; RLS kept as inert defense-in-depth; 4 cross-tenant write defects fixed; 20-test isolation suite; worker org re-verification).** Remaining: plaintext token fallback removal with backfill + rotation sweep (`SUB-03`); metrics token auth cleanup; secrets hygiene review.
- **Out of scope**: feature work, UI, Windows.
- **Acceptance criteria**: SSO login requires verified IdP assertions OR is disabled (✅ achieved via fail-closed disablement); isolation suite green (✅ `test/cross-tenant-isolation.spec.ts`, 20 tests); no plaintext-token auth path for devices lacking hash (⏳ `SUB-03`).
- **Required tests**: ✅ new SSO fail-closed auth tests (`test/sso-login.spec.ts`, 10); ✅ cross-tenant isolation suite (`test/cross-tenant-isolation.spec.ts`, 20); ⏳ credential-rotation backfill tests.
- **Security gate**: CRITICAL/HIGH from `07` closed (S1 ✅ closed; S2 ✅ closed; S3 open).
- **Rollback/risk**: SSO change is code-only, no migration; do NOT re-enable by reverting (pre-change code is the vulnerability). SUB-02 is code+test only (`MIGRATION: NONE`); RLS kept untouched as defense-in-depth — do NOT add FORCE/set_config later without re-running the isolation suite against a non-owner role. Token fallback removal risks lock-out of legacy devices — backfill before removing.
- **Complexity**: M.

## V1-STAGE-02 — Deployment Reliability & CD Repairs

- **Objective**: make staging/production CD actually deployable (T1-T4).
- **Why now**: commercial V1 cannot ship without a working deployment path; the green gate is currently local-only.
- **Dependencies**: Stage 01 (deploy on a safe baseline).
- **Scope**: fix Helm required-values/image refs/tag wiring/agent DB URL; `migrate deploy` not `db push` in prod; replace `kubectl run -it` checks; drive a real GitHub Actions run of the green gate; verify GHCR images pull and boot.
- **Out of scope**: feature work.
- **Acceptance criteria**: `cd-staging` deploys all four services and `/health` passes; `cd-production` gated on tag; GitHub-native green gate evidence exists.
- **Required tests**: pipeline run + post-deploy smoke tests.
- **Security gate**: secrets supplied via cluster secrets (not repo).
- **Rollback/risk**: Helm migration from current chart = destructive; stage on staging first.
- **Complexity**: M.

## V1-STAGE-03 — Billing & Entitlements Certification

- **Objective**: server-authoritative entitlements (P0 #4, #5).
- **Why now**: billing correctness is a paid-V1 gate; quota gaps exist today.
- **Dependencies**: Stage 01 (authz baseline).
- **Scope**: `UsageService`/`assertLimit`; enforce maxTeamMembers + maxAlertRules; plan-tiered retention; self-serve plan change; downgrade/upgrade integration tests; rename `PREMIUM_TIER_PLACEHOLDER` decision captured in `14`.
- **Out of scope**: final pricing (founder).
- **Acceptance criteria**: every limit enforced server-side and tested; UI reflects entitlements only.
- **Required tests**: billing limits suite + downgrade paths.
- **Security gate**: billing endpoints authz re-verified.
- **Rollback/risk**: Stripe webhook event processing regression; keep STAGE-01A integrity guards.
- **Complexity**: M.

## V1-STAGE-04 — Fleet Reliability: Agent Self-Update, Version Telemetry & Presence Improvements

- **Objective**: reliable fleet lifecycle + presence quality.
- **Why now**: no self-update and no post-enrollment version visibility weaken a commercial device-management product.
- **Dependencies**: Stage 01; agent module split from `05`.
- **Scope**: signed atomic self-update; version reported on heartbeat/metrics; presence improvement (optional DEGRADED alert tier, tunable thresholds, sweep cost analysis) — without destabilizing enrollment.
- **Out of scope**: Windows (Stage 10).
- **Acceptance criteria**: fleet can be upgraded remotely; server tracks versions; presence alerts tunable.
- **Required tests**: agent update tests, presence regression.
- **Security gate**: update artifact signing verified.
- **Rollback/risk**: self-update corruption → keep fallback to installer; staged rollout.
- **Complexity**: M.

## V1-STAGE-05 — Monitoring, Alerts & Notifications Productization

- **Objective**: make monitoring/alerts/notification a complete P0 surface.
- **Why now**: monitoring is the product's core value; P1 gaps remain (no notification center, no webhook UI).
- **Dependencies**: Stages 01, 04.
- **Scope**: notification center; webhook management UI; alert UX polish; monitoring retention tiering.
- **Out of scope**: new analysis engines.
- **Acceptance criteria**: users can configure, receive, and manage alerts end-to-end.
- **Required tests**: UI + integration tests.
- **Security gate**: org isolation on new surfaces.
- **Rollback/risk**: low.
- **Complexity**: M.

## V1-STAGE-06 — Operations: Remote Support, Recordings, Reports & Backup Productization

- **Objective**: complete the operations surface (P0 #10, P1 #2-#4).
- **Why now**: remote-support is a PRO/PREMIUM differentiator; current agent side is auto-consent stub.
- **Dependencies**: Stage 04 (agent), Stage 03 (reports quota).
- **Scope**: real remote control (WebRTC/TURN with consent UX) or explicit v1 "pending" state; recording player/viewer; REPORT async path + schedules; backup UX polish.
- **Out of scope**: screen capture/input injection on agent beyond consent-gated session (P2).
- **Acceptance criteria**: operator can run a consent-gated remote session; recordings viewable; scheduled reports deliver.
- **Required tests**: remote session E2E, report schedule E2E.
- **Security gate**: consent + session authz; TURN credentials scoped.
- **Rollback/risk**: remote session regressions; feature-flag behind PRO.
- **Complexity**: XL (remote control is the heavy item).

## V1-STAGE-07 — Security, Network, Inventory & Knowledge Productization

- **Objective**: complete security/network/inventory/KB surfaces.
- **Why now**: P1 depth items; KB embeddings must become real (P0 #6).
- **Dependencies**: Stage 01 (isol.), Stage 05.
- **Scope**: real KB embeddings + `POST /ai/embed`; executive security reports UI; discovery scheduling; software catalog page; drivers refresh UX.
- **Out of scope**: new detection engines.
- **Acceptance criteria**: KB citations use real embeddings; security/network/inventory surfaces are complete.
- **Required tests**: embedding pipeline E2E; discovery E2E.
- **Security gate**: ingest endpoints org-scoped.
- **Rollback/risk**: re-embedding migration for existing KB rows.
- **Complexity**: M.

## V1-STAGE-08 — AI Product Layer

- **Objective**: finish AI troubleshooting/chat depth (P1 #7).
- **Why now**: AI is a differentiator; P0 quota is already enforced.
- **Dependencies**: Stage 07 (real embeddings).
- **Scope**: provider config admin UI; cost/usage dashboard; troubleshooting quality (freshness honesty already present); quota UX.
- **Out of scope**: autonomous remediation (P2).
- **Acceptance criteria**: admins configure providers; usage visible; troubleshooting stable.
- **Required tests**: AI quota + router tests.
- **Security gate**: API-key encryption verified.
- **Rollback/risk**: provider fallback handling.
- **Complexity**: M.

## V1-STAGE-09 — Admin, Audit & Remaining Product Surface

- **Objective**: admin console, audit viewer, retention UI, misc surface (P1 #5, #6).
- **Why now**: operational governance completeness.
- **Dependencies**: Stages 01-08.
- **Scope**: admin web console; audit-log viewer; retention settings; settings polish.
- **Out of scope**: new backend domains.
- **Acceptance criteria**: admin + audit + retention usable.
- **Required tests**: admin RBAC tests; audit viewer tests.
- **Security gate**: admin role boundaries.
- **Rollback/risk**: low.
- **Complexity**: S-M.

## V1-STAGE-10 — Windows Agent

- **Objective**: deliver Windows MVP agent (P0 #7).
- **Why now**: "Linux AND Windows production support" is a launch requirement.
- **Dependencies**: agent platform-adapter split (Stage 04 groundwork), Stage 04 self-update.
- **Scope**: SCM service + installer (MSI/exe) + DPAPI/Credential Manager store + metrics/network/inventory/security adapters + update/uninstall + code signing + x64/arm64 targets.
- **Out of scope**: full remote-desktop parity (P2).
- **Acceptance criteria**: Windows agent enrolls, heartbeats, reports inventory/security, survives reboot, updates, uninstalls; signed artifacts.
- **Required tests**: Windows CI (self-hosted runner or cross-build + smoke), installer tests.
- **Security gate**: signing + credential protection.
- **Rollback/risk**: cross-compile complexity; device availability for testing.
- **Complexity**: XL.

## V1-STAGE-11 — UX / Performance / Accessibility

- **Objective**: polish, accessibility, performance for fleets.
- **Why now**: launch quality bar.
- **Dependencies**: most stages (stable surfaces).
- **Scope**: a11y pass (focus, contrast, ARIA), empty/error states audit, large-fleet dashboard query optimization, presence sweep scalability.
- **Out of scope**: visual redesign.
- **Acceptance criteria**: a11y automated checks; p95 dashboard latency target; sweep cost bounded.
- **Required tests**: a11y + perf tests.
- **Security gate**: n/a.
- **Rollback/risk**: low.
- **Complexity**: M.

## V1-STAGE-12 — Production Certification / Beta

- **Objective**: final production gate.
- **Why now**: release.
- **Dependencies**: all prior.
- **Scope**: full green gate (GitHub-native), CD run to production, security re-audit, backup/restore drill, runbook, beta cohort.
- **Out of scope**: post-V1 features.
- **Acceptance criteria**: paid beta live; all P0 acceptance criteria met.
- **Required tests**: full suite + prod smoke.
- **Security gate**: final review.
- **Rollback/risk**: documented rollback plan.
- **Complexity**: M.

## Stage Dependency Graph

```
V1-STAGE-01 (security/tenancy)
   ├── V1-STAGE-02 (deploy/CD)          (parallel-safe after 01)
   └── V1-STAGE-03 (billing)            (after 01)
            └── V1-STAGE-04 (fleet reliability) (after 01)
                     ├── V1-STAGE-05 (monitoring/notifications)
                     ├── V1-STAGE-06 (ops: remote/reports/backups)
                     └── V1-STAGE-10 (Windows)  (split + self-update dep)
V1-STAGE-05 ──> V1-STAGE-07 (security/network/inventory/KB) ──> V1-STAGE-08 (AI)
V1-STAGE-03..08 ──> V1-STAGE-09 (admin/audit/retention)
V1-STAGE-09 ──> V1-STAGE-11 (UX/perf/a11y) ──> V1-STAGE-12 (cert/beta)
```

## NEXT EXACT STAGE

**V1-STAGE-01 — Security, Tenancy & Credential Remediation** (P0 hard gate).

## NEXT EXACT SUBSTAGE

**V1-STAGE-01-SUB-03 — plaintext `Device.deviceToken` fallback removal (S3).**

Exact steps (implementation mission):
1. Confirm all enrolled devices carry `deviceTokenHash` (or backfill from existing plaintext at rotation time); remove the equality fallback in `device-token.guard.ts:38-47` / `devices.service.ts:249-260`.
2. Add rotation sweep + regression tests; update `07`, `08`, `14`.

**Completed: V1-STAGE-01-SUB-02 — RLS decision & cross-tenant isolation regression suite (S2)** (2026-08-10):
- **RLS DECISION (Option B — Application-Layer Authoritative).** Empirically proven inert: app role is SUPERUSER+BYPASSRLS (32 tables RLS-enabled, 0 FORCE); `SET app.current_org_id` + FORCE RLS both still showed both orgs' rows for the superuser; only a NOBYPASSRLS non-owner role was filtered. No `set_config`/`OrgContextInterceptor` exists and Prisma pooling cannot carry session settings safely. RLS kept as non-authoritative defense-in-depth; no migration, no FORCE (`MIGRATION: NONE`).
- **Fixed 4 confirmed cross-tenant write defects**: `backups.service` updateJob/deleteJob TOCTOU (now scoped `updateMany/deleteMany {id, orgId}`), `remote-support.updateRecording` unscoped update + `cleanupStaleSessions` now org-scoped, `network.updateDiscoveryStatus`/`cleanupStaleScans` org-scoped, AI router strategy/stats now per-org (`orgId` threaded through `complete`/`embed`). Worker: backup verify/restore/execute + KB embedding now org re-verify payload resource IDs (follows the `processSecurityJob` safe pattern); security processor `deviceId` now bound to the verified row.
- Regression suite: `test/cross-tenant-isolation.spec.ts` (20 tests) — READ/WRITE/DELETE isolation across backups/remote-support/alerts/security/KB/reports/network, device-token scanId substitution, JWT-claim vs membership authority, X-Org-Id forgery, AI router per-org state, org-switch context.
- Verified: api-gateway 54 suites / 943 tests; worker 8 suites / 80 tests; `pnpm lint` + `pnpm build` green; `scripts/ci-v1-gate.sh` 19/19 PASS; secret scan clean.
- Decisions: `14` D14-D15. Report: `V1-STAGE-01-SUB-02_RLS_TENANT_ISOLATION_REPORT.md`.

**Completed: V1-STAGE-01-SUB-01 — SSO authentication remediation** (2026-08-09):
- `POST /auth/sso/login` is DISABLED_SAFE (fail-closed `501 Not Implemented`; no tokens, no JIT provisioning, no SSO identity writes, no config reads). Insecure implementation removed; route + `SsoConfig` architecture preserved for a future verified SAML/OIDC substage (contract in `V1-STAGE-01-SUB-01_SSO_REMEDIATION_REPORT.md` §7).
- Regression tests: `test/sso-login.spec.ts` (10) + updated `enterprise.integration.spec.ts` / `full-e2e-scenario.spec.ts`. Full api-gateway suite 53 suites / 923 tests green; `pnpm lint` + `pnpm build` green.
- Decisions: `14` D11-D13.

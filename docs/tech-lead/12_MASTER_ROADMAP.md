# 12 — Master Roadmap

Dependency-aware execution plan from CURRENT STATE to Production V1. Stages are ordered by architecture dependencies (not UI pages). The stage list from the mission brief was retained where evidence supports it, but reordered/merged: identity/RBAC is already strong (not a P0 gate), so it is merged into Stage 01 rather than a separate early stage; Windows is split as its own dependency-serialized stage; billing/entitlements and reliability/deploy fixes are moved earlier because they gate paid launch.

Legend — S: S/M/L/XL complexity. "GATE" = the exit criterion for each stage.

## V1-STAGE-01 — Security, Tenancy & Credential Remediation (P0 hard gate)

- **Objective**: close the security findings that make paid V1 impossible (S1 SSO, S2 RLS, S3 device-token fallback).
- **Why now**: every later stage builds on a trust boundary; S1 is an active auth bypass.
- **Dependencies**: none (foundation).
- **Scope**: SSO login fix or route removal; RLS decision (implement or remove) + cross-tenant isolation regression suite; plaintext token fallback removal with backfill + rotation sweep; metrics token auth cleanup; secrets hygiene review.
- **Out of scope**: feature work, UI, Windows.
- **Acceptance criteria**: SSO requires verified IdP assertions (or route disabled); isolation suite green; no plaintext-token auth path for devices lacking hash.
- **Required tests**: new SSO auth tests; cross-tenant isolation suite (every controller); credential-rotation backfill tests.
- **Security gate**: CRITICAL/HIGH from `07` closed.
- **Rollback/risk**: RLS enablement risk = app-layer misses cause data invisibility; run with non-owner role in staging first. Token fallback removal risks lock-out of legacy devices — backfill before removing.
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

**V1-STAGE-01-SUB-01 — SSO authentication remediation.**

Exact steps (implementation mission, not this one):
1. Decide with founder: (a) disable `POST /auth/sso/login` until a real IdP integration exists, or (b) implement SAML/OIDC assertion verification.
2. Add tests proving spoofed IdP tokens/attributes are rejected (no bypass via fake `idpToken >= 10`).
3. Update `07_SECURITY_TENANCY_REVIEW.md` S1 status + `14_DECISION_LOG.md`.
4. Green gate must pass with the new SSO tests.

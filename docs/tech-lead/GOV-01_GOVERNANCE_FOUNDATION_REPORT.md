# GOV-01 — Product & Engineering Governance Foundation Report

> Governance/documentation-only stage. Date: 2026-08-11. Goal: a minimal,
> canonical, extensible governance layer derived from repository evidence.
> No product code, schema, migration, UI, CI/CD, or runtime behavior was
> modified by GOV-01. Historic reports remain untouched.

## Documents Inventoried

**186 markdown files structurally inspected** (163 under `docs/`, 23 at repo
root). Full title inventory was captured; categories assigned as:

- **CANONICAL-CANDIDATE**: `docs/tech-lead/00`-`15` + `docs/tech-lead/README.md`, `docs/PRD.md`, `docs/README.md`, `docs/PROJECT_CONTEXT.md`
- **STAGE-REPORT**: `docs/tech-lead/V1-STAGE-01-SUB-01..05*`, `docs/v1/V1-*`, `docs/dashboard/DASH-IMPL-01*`, `docs/enrollment/*`
- **HISTORICAL-EVIDENCE**: `docs/AH-1/` (8), `docs/AH-2/` (16), `docs/AH-3/` (46), `docs/AH-3F/` (11), `docs/AH-3R/` (11), root `TF_*.md` (22), `TECHFUSION_V1_READINESS_AUDIT.md`
- **DESIGN-GOVERNANCE**: `docs/TG-1A/`, `docs/TG-2A/`, `docs/TG-2X/`, `docs/TG-3/`, `docs/TG-CORE/`
- **STALE-CANDIDATE**: `roadmap/roadmap.md`, `blueprints/*/README.md` status fields, `docs/PROJECT_CONTEXT.md`, `docs/01-Master-Specification.md` (original plan), `docs/launch-checklist.md`
- **DUPLICATE-CANDIDATE**: `docs/INVENTORY_REPORT.md` / `docs/AUDIT_REPORT.md` (vs `tech-lead/02`), `TECHFUSION_V1_READINESS_AUDIT.md` (vs `tech-lead/08`), `roadmap/roadmap.md` (vs `tech-lead/12`)

Nothing was deleted, moved, renamed, archived, or consolidated.

## Deep-Read Documents

**17** deep-read: `00_CURRENT_STATE`, `01_PRODUCT_ARCHITECTURE`,
`02_REPOSITORY_INVENTORY`, `07_SECURITY_TENANCY_REVIEW`,
`08_FEATURE_READINESS_MATRIX`, `10_TECHNICAL_DEBT_REGISTER`,
`11_PRODUCTION_V1_SCOPE`, `12_MASTER_ROADMAP`, `13_AI_TECH_LEAD_OPERATING_MODEL`,
`14_DECISION_LOG`, `tech-lead/README`, `docs/PRD`, `docs/README`,
`docs/PROJECT_CONTEXT`, `docs/01-Master-Specification` (partial),
`roadmap/roadmap`, root `README`. Remaining docs were title-scanned for
classification; historical reports were not re-read deeply except to resolve
the interrupted-stage question.

## Canonical Sources (decision — REUSE > UPDATE > CREATE)

| Concept | Source | Action |
|---------|--------|--------|
| A. PRD | `docs/PRD.md` | **UPDATED** (factual corrections + scope classes) |
| B. Engineering rules | `AGENTS.md` | **CREATED** (none existed) |
| C. Current architecture | `docs/tech-lead/01_PRODUCT_ARCHITECTURE.md` | **DESIGNATED** (adequate, verified) |
| D. Module extensibility contract | `docs/tech-lead/15_MODULE_EXTENSIBILITY_CONTRACT.md` | **CREATED** (none existed) |
| E. Feature readiness matrix | `docs/tech-lead/08_FEATURE_READINESS_MATRIX.md` | **DESIGNATED** (single master matrix) |

Supporting existing sources: `00` (current state), `12` (roadmap), `14`
(decisions), `13` (operating model), `07` (security/tenancy), `10` (debt).

## Files Created

- `AGENTS.md` — engineering constitution for any coding AI (18 principles,
  navigation, working rules, living-docs policy).
- `docs/tech-lead/15_MODULE_EXTENSIBILITY_CONTRACT.md` — core modules are
  capability platforms; layered boundaries; 11 module principles; example
  boundaries for Cybersecurity, Network, Monitoring, Remote Support,
  Jobs/Automation, Inventory, Software/Drivers, Enrollment; growth rules.
- `docs/tech-lead/GOV-01_GOVERNANCE_FOUNDATION_REPORT.md` — this report.

## Files Updated

- `docs/PRD.md` — living-doc header; CURRENT / V1 REQUIRED / FUTURE scope
  classes; corrected security table (SSO = DISABLED_SAFE, isolation = app-layer
  authoritative, device creds hash-only, telemetry identity server-authoritative,
  metrics header-only); added Trust & Truthfulness requirements; corrected
  stale security gaps; corrected test count; roadmap now points to `12`.
- `docs/README.md` — added canonical START HERE index (AGENTS.md, PRD,
  tech-lead series, GOV-01); added missing doc areas; flagged
  `roadmap/roadmap.md` and root legacy reports as superseded.
- `docs/tech-lead/README.md` — added `15_MODULE_EXTENSIBILITY_CONTRACT.md` to
  the index.

## Duplicate / Stale Candidates (NOT deleted)

- `roadmap/roadmap.md` (2026-08-01) lists implemented modules as
  Planned/Analysis — superseded by `tech-lead/12`.
- `blueprints/*/README.md` status fields say "Planned/Discovery not started"
  for implemented modules — planning containers only.
- `docs/PROJECT_CONTEXT.md` (2026-06-18) — 34 models / 7 migrations / RLS
  "authoritative via OrgContextInterceptor" all superseded (38 models, 18
  migrations, RLS inert per D14). Flagged; retained.
- `docs/01-Master-Specification.md` — original plan; historical.
- `docs/INVENTORY_REPORT.md` / `docs/AUDIT_REPORT.md` vs `tech-lead/02`.
- `TECHFUSION_V1_READINESS_AUDIT.md`, root `TF_*.md`, `docs/launch-checklist.md`
  — pre-CI-era historical (debt T13).
- `docs/README.md` vs `docs/tech-lead/README.md` — two indexes resolved by
  reference (docs/README now points to tech-lead/README as authoritative), not
  by duplication.

## Code-Verified Claims (GOV-01 session)

- Web command center implemented: `apps/web/src/components/command-center/`
  (CommandCenterPage, OnboardingFlow, FleetPresenceSummary, ModuleSlot, etc.).
- API gateway modules exist: account, admin, ai, alerts, audit, auth, backups,
  billing, common, config, dashboard, demo, devices, encryption, **enrollment**,
  kb, mfa, monitoring, network, organizations, queue, remote-support, reporting,
  retention, security, sso.
- Worker: `processors.ts`, `monitoring-sweep.ts`, `presence-state.ts`,
  `backup-runner.ts`, `queue-names.ts`. `presence-state.ts` already maps a null
  `lastSeenAt` to `UNKNOWN`.
- Agent (Rust): `registration.rs` (enrollment via `TF_ORG_TOKEN`, persists
  `device_token`/`device_id`), `identity.rs`, `reset.rs`, `client.rs`, etc.
- Schema: **38 models**, **18 committed migrations** + 1 untracked
  (`20260810120000_device_lastseen_nullable_presence_truth`).
- SSO fail-closed confirmed in code (`sso.service.ts` throws
  `NotImplementedException` 501).
- `.env.test` inspected: test placeholders only (16 lines). Untouched, unstaged.

## Documentation Conflicts

| # | Historical/plan claim | Current truth | Source of truth | Action |
|---|----------------------|---------------|-----------------|--------|
| 1 | PRD: SSO "Done" | DISABLED_SAFE (fail-closed 501) | `07`, SUB-01 report, code | PRD corrected |
| 2 | PRD: CORS wide open, JWT/AI/Stripe placeholders are open gaps | ALLOWED_ORIGINS restricted; fail-closed `validateEnvironment`; SUB-05 audit found no real creds | `07`, SUB-05 | PRD corrected |
| 3 | PRD: 201 tests | ~979 api / 790 web / 80 worker / 78 agent | `00` §5, STAGE-01C reports | PRD corrected |
| 4 | PROJECT_CONTEXT: RLS authoritative | RLS inert; app-layer authoritative (D14) | SUB-02 empirical proof | Documented (stale flag) |
| 5 | roadmap/roadmap.md: modules "Planned" | Implemented/certified | `08`, `00` | Flagged superseded |
| 6 | Interrupted SUB-01 scope = "Enrollment, Token & Device-Link Reliability" | Documented V1-STAGE-02 scope = "Deployment Reliability & CD Repairs" | `12` | Open governance decision — see below |
| 7 | docs/README did not index the authoritative tech-lead series | tech-lead is authoritative (D2) | `14` D2 | docs/README updated |

Historical reports were not rewritten; only current canonical sources were
corrected.

## Interrupted V1-STAGE-02-SUB-01 State

**STATUS: PARTIAL IMPLEMENTATION + PARTIAL TESTING** — code and tests were
written but not committed, the new migration is untracked, and nothing was
verified by the V1 gate in this session.

- **Modified (12, uncommitted)**: `apps/api-gateway/prisma/schema.prisma` and
  `apps/worker/prisma/schema.prisma` (`lastSeenAt` nullable);
  `dashboard.service.ts` (orderBy nulls last); `devices.controller.ts`
  (recover-credential requires strong identity only);
  `devices.service.ts` (register P2002 race → idempotent reuse,
  `reuseExistingDevice`, hostname removed from `findExistingDevice`);
  `reporting/report-types/device-health.report.ts` (nullable lastBoot);
  `test/presence-telemetry.spec.ts` (null lastSeenAt baseline); web:
  `useDevices.ts` (nullable lastSeenAt), `monitoring/page.tsx`,
  `device-health/page.tsx`, `command-center/OnboardingFlow.tsx` (baseline
  anchoring so onboarding completes only on a NEW device), `__tests__/onboarding-flow.spec.tsx`.
- **Untracked (3)**: `apps/api-gateway/.env.test` (leave untouched),
  `apps/api-gateway/prisma/migrations/20260810120000_device_lastseen_nullable_presence_truth/`
  (DROP NOT NULL + DROP DEFAULT on `Device.lastSeenAt`),
  `apps/api-gateway/test/enrollment-device-link.spec.ts` (437 lines, 8 blocks
  E1-E8, 16 tests).
- **Known completed work (appears done, unverified)**: presence truthfulness
  migration + null-safe worker already consistent; E1-E8 enrollment/link spec;
  register race handling; OnboardingFlow baseline detection.
- **Remaining work**: apply the untracked migration to test DB + `prisma generate`;
  run api-gateway suite (incl. `enrollment-device-link.spec.ts`,
  `presence-telemetry.spec.ts`), web suite (`onboarding-flow.spec.tsx`), lint +
  build, then `scripts/ci-v1-gate.sh`; commit worker schema copy;
  update `00_CURRENT_STATE`, `12` (if scope confirmed), and append
  `14_DECISION_LOG` rows; verify no `Device` row ever implies ONLINE without a
  heartbeat.
- **Governance blocker to resolve before resuming**: this SUB-01 scope is NOT
  the documented V1-STAGE-02 scope in `12` (deployment/CD). A founder/AI-lead
  decision is required: either re-scope Stage-02 to include
  "Enrollment, Token & Device-Link Reliability" (recorded in `14`/`12`), or
  park this work and resume the documented CD scope. GOV-01 does not decide this.
- **Safe resume point**: the working tree as-is IS the checkpoint. Do not
  delete or complete SUB-01 work as part of GOV-01. Resume by (1) resolving the
  scope question, (2) applying the untracked migration, (3) running the test
  gates above, (4) committing SUB-01 separately from GOV-01.

## Canonical Gaps Remaining

- `00_CURRENT_STATE.md` still describes the pre-SUB-01 baseline (to be updated
  when SUB-01 is certified and committed).
- `12_MASTER_ROADMAP.md` Stage-02 scope vs the interrupted SUB-01 scope —
  open decision.
- `docs/PROJECT_CONTEXT.md` is stale (models/migrations/RLS claims) — update
  scheduled as a future docs chore, not GOV-01 scope.
- Windows agent (Stage 10), real SAML/OIDC verification, entitlement
  enforcement, real KB embeddings — feature gaps already tracked in `11`/`12`.

## Validation (Phase 10)

- `git diff --check` clean for GOV-01 files.
- GOV-01 diff contains documentation/governance changes only (AGENTS.md + 4
  docs). No runtime/source/schema/migration files touched by GOV-01.
- No secrets introduced; `.env.test` remains untouched and unstaged.
- All doc links/references verified against the working tree.

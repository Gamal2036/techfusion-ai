# 13 — AI Technical Lead Operating Model

Operating model for running TechFusion AI V1 development with an AI Technical Lead (later possibly a system such as Verdent — the model is vendor-neutral and must not depend on one tool).

## 1. Role Map

```
FOUNDER / PRODUCT OWNER
   │  decisions: scope, pricing, naming, priorities, acceptance of major stages
   ▼
AI TECHNICAL LEAD
   │  owns: architecture, dependency ordering, stage definitions, tech-lead docs
   │  delegates: implementation to agents, gates on CI
   ▼
IMPLEMENTATION AGENT(S)
   │  modify code/tests under guardrails
   ▼
CI/CD (local gate + GitHub Actions)
   │  fail-closed green gate
   ▼
HUMAN ACCEPTANCE (founder/stage certification)
```

## 2. Decision Authority

**AI Technical Lead may decide (no approval needed):**
- Implementation order within an approved stage/substage.
- Code style, refactors scoped to the stage, test strategy.
- Which implementation agents run which tasks.
- Whether to reuse/mirror a constant or centralize it (within a stage).
- How to satisfy acceptance criteria of the current substage.

**Requires founder approval:**
- Changing a stage boundary, scope, or P0/P1/P2 classification in `11`.
- Introducing or removing third-party dependencies/paid services.
- Changing the architecture (per §7) or the data model in ways that require new migrations with data risk.
- Pricing, tier naming, plan feature mapping in `09`.
- Any destructive operation on production data (per §5).
- Enabling SSO for customers before S1 remediation is merged.
- Launch/beta decisions.

## 3. What Implementation Agents May Modify

- Code and tests under `apps/*` and `packages/*` within the assigned stage.
- Documentation under `docs/tech-lead/` (updating their stage's reports).
- New migrations **only** via the migration process in §6.
- They must NOT: modify CI/CD unless the stage explicitly includes it; touch production data; edit `.env*`; commit secrets; delete other teams'/stages' working-tree changes.

## 4. Mandatory Tests Before Merge

- The relevant app suite must pass locally (`pnpm --filter <app> test` or `cargo test`).
- Typecheck/lint (`pnpm --filter <app> lint`, `cargo fmt --check`) must pass.
- If a queue/schema/contract changed: worker + gateway tests, and the `v1-green-gate` (or at minimum `ci-v1-gate.sh`) must be green locally.
- Any schema change: `prisma migrate dev` on a scratch DB + `ci-migration` equivalence.
- New behavior needs a test that fails before the change and passes after.

## 5. Destructive Operations Rules

- **Never** run `prisma db push --accept-data-loss` against production. Use `migrate deploy`.
- No `DELETE`/`TRUNCATE` on production tables outside an approved stage with a backup and rollback plan.
- Data migrations must be additive or two-phase (deploy code → backfill → switch → remove legacy), each phase gated.
- Before any production-impacting change: confirm a verified backup exists and state the restore procedure.

## 6. Migration Rules

1. New migrations are created from `apps/api-gateway/prisma/schema.prisma` (authoritative) only.
2. Run `scripts/sync-prisma-schema.sh` and commit the worker schema copy in the same change.
3. Migrations must apply cleanly on a fresh TimescaleDB (CI enforces).
4. No irreversible destructive steps without an explicit two-phase plan.
5. Migration names follow the `YYYYMMDDHHMMSS_description` convention.

## 7. Rules for Changing Architecture

- Propose in writing; update `01_PRODUCT_ARCHITECTURE.md` and `14_DECISION_LOG.md`.
- Changes that alter the runtime relationship (new service, new queue domain, new auth boundary, changing the RLS strategy) require founder approval and a dependency analysis against `12_MASTER_ROADMAP.md`.
- Prefer incremental changes over re-architecture; the current architecture is not to be rewritten merely because another design is preferred.

## 8. Rules for Introducing Dependencies

- Prefer existing deps (BullMQ, NestJS, Prisma, Stripe, sysinfo, reqwest…). New dependency = founder approval + rationale (what problem, why not current stack, licensing, maintenance status).
- Pin versions; record in the decision log.

## 9. Documentation / Update Requirements

- `docs/tech-lead/` is the durable source of truth — **not AI conversation history**.
- Every completed substage updates: `00_CURRENT_STATE.md`, the relevant capability doc, `10` (debt changes), and `14_DECISION_LOG.md`.
- Certification reports continue to live in `docs/v1/` and are summarized in `00`.
- If an external tool (e.g., Verdent) is used, it must operate from these docs; nothing may be committed that is only explainable from a chat log.

## 10. Rollback Requirements

- Every stage lists rollback notes in `12`.
- Prefer feature flags + two-phase migrations so any substage can be reverted independently.
- Git revert is acceptable for code-only changes; data changes require the migration rollback path.

## 11. Secrets

- Never print, commit, log, or copy secrets. `.env*` files stay out of git (`.env.test` may stay untracked with test placeholders only).
- Provider keys and SSO client secrets are stored encrypted via `encryption.service.ts`; do not introduce new plaintext secret columns.
- The secret scan gate must pass before merge.

## 12. CI / Acceptance Loop

- Every merge target must keep the fail-closed `v1-green-gate` green (GitHub-native once Stage 02 lands).
- Human acceptance = founder (or delegated reviewer) signing off the substage certification, recorded in `14`.

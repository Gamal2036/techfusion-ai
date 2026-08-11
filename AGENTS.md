# AGENTS.md — TechFusion AI Engineering Constitution

> Applies to any coding agent working in this repository: OpenCode, Copilot,
> Codex, or future agents. This document is mandatory reading before any change.
> It complements — it does not replace — `docs/tech-lead/13_AI_TECH_LEAD_OPERATING_MODEL.md`
> (who may change what) and `docs/tech-lead/15_MODULE_EXTENSIBILITY_CONTRACT.md`
> (how core modules must grow).

## Read first (navigation)

| To know | Read |
|---------|------|
| Where everything is | `docs/README.md` and `docs/tech-lead/README.md` |
| What the product is | `docs/PRD.md` |
| What actually exists / works today | `docs/tech-lead/00_CURRENT_STATE.md` |
| Current architecture (verified) | `docs/tech-lead/01_PRODUCT_ARCHITECTURE.md` |
| Feature readiness | `docs/tech-lead/08_FEATURE_READINESS_MATRIX.md` |
| What to build next, in order | `docs/tech-lead/12_MASTER_ROADMAP.md` |
| Decisions made and why | `docs/tech-lead/14_DECISION_LOG.md` |
| In-progress / interrupted work | `docs/tech-lead/00_CURRENT_STATE.md` §Git State + GOV-01 report |

Before starting any task, check `git status --short` and `git log -3 --oneline`.
Uncommitted work may belong to an interrupted stage. Do not delete, complete,
or commit it unless the task explicitly owns it.

## Principles

1. **Production truth over visual simulation.** UI must show real, verified
   server data. Never render fabricated device, network, security, telemetry,
   or scan values.
2. **Never fabricate data.** Device, network, security, telemetry, and scan
   data must come from code or tests that prove it. No fake values to "make the
   demo work".
3. **UNKNOWN is preferable to false certainty.** When state cannot be verified,
   say UNKNOWN / PENDING explicitly. Never present assumptions as facts.
4. **Every CORE MODULE must be extensible by design.** Core modules are
   capability platforms, not single-purpose pages. See
   `docs/tech-lead/15_MODULE_EXTENSIBILITY_CONTRACT.md`.
5. **Preserve clear boundaries.** UI, application/service, provider/adapter,
   persistence, and Agent/runtime stay separated. Do not merge them to save
   time.
6. **Do not tightly couple a core module to one provider/engine.** Multi-provider
   abstraction is a product requirement (AI, scanners, discovery, delivery).
7. **Security boundaries may never be weakened to solve UX problems.** When they
   conflict, the security boundary wins and the UX gap is documented instead.
8. **Client-provided tenant/device identity is never authoritative** where
   authenticated server context exists. Derive `orgId`/`deviceId` from the
   verified session/token, never from the request body.
9. **Prefer backward-compatible extension.** Additive fields, optional params,
   superset contracts. Avoid breaking changes to shipped agent/API contracts.
10. **Database/schema changes require evidence and migration discipline.**
    Authoritative schema is `apps/api-gateway/prisma/schema.prisma`. Create a
    named migration, apply it, and commit the worker schema copy
    (`scripts/sync-prisma-schema.sh`). Never `prisma db push` on production.
    Follow `13_AI_TECH_LEAD_OPERATING_MODEL.md` §6.
11. **No unrelated refactors during scoped stages.** A stage touches only what
    its scope requires.
12. **Work loop:** inspect → implement → targeted tests → full gate → docs →
    atomic commit.
13. **Never automatically push.** Commit locally; the human/CI controls pushes.
14. **Never stage environment/secrets files.** `.env*` files stay out of commits.
    `apps/api-gateway/.env.test` is intentionally untracked (test placeholders
    only) and must remain untouched and unstaged.
15. **Documentation is living documentation.** Canonical docs are updated when
    verified state changes, not as a final chore.
16. **Code/tests are implementation truth.** No document overrides a verified
    test or running system. Documentation describes verified reality.
17. **Update canonical documentation when verified product/architecture state
    changes.** At minimum: `00_CURRENT_STATE.md`, the relevant capability doc,
    `10_TECHNICAL_DEBT_REGISTER.md` if debt changed, and `14_DECISION_LOG.md`
    for decisions. Historic reports stay immutable.
18. **Never duplicate canonical sources.** If a document already fulfills a
    role, reuse or update it. Do not create parallel sources of truth. Flag
    duplicates instead of creating more.

## Working rules

- **Evidence markers:** reuse the `docs/tech-lead/README.md` convention
  (`VERIFIED_THIS_RUN`, `VERIFIED_BY_CURRENT_CI`, `INFERRED_FROM_CODE`,
  `UNVERIFIED`). Never write a doc claim stronger than its evidence.
- **Tests:** relevant app suite, then the V1 gate (`scripts/ci-v1-gate.sh`,
  `pnpm ci:v1`) for cross-cutting or schema changes. New behavior needs a
  failing-then-passing test.
- **Commits:** conventional commits, scoped and explicit. Stage only the files
  belonging to the task. Never `git add .` / `git add -A`.
- **Stop and ask** when: scope is ambiguous, a security boundary is involved, an
  architecture conflict appears, a large refactor is needed, or the task would
  weaken a documented boundary.

## Living documentation policy

Canonical documents (this file, `docs/PRD.md`, `docs/tech-lead/00`-`15`) are
living documentation. Update them only when verified implementation, product
scope, architecture, module contracts, or engineering policy change. Historical
stage reports remain immutable evidence, except for factual-correction
annotations. Major documentation updates normally accompany the stage/commit
that caused the change. Do not rewrite history.

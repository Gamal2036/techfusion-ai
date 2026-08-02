# Contributing to TechFusion-AI

> **Owner:** Engineering Execution Governance
> **Last Updated:** 2026-08-01

Every contribution obeys TG-CORE — the Execution Constitution. If a request, instinct, or deadline conflicts with it, the constitution wins. **Small scope. Perfect execution.**

## Branch Strategy

- `main` is the protected integration branch. CI runs on every push and pull request to `main`.
- New work starts from an up-to-date `main` on a short-lived feature branch: `feat/<scope>-<slug>`, `fix/<scope>-<slug>`, or `docs/<slug>`.
- Branches live only as long as their work. Merges happen through a Pull Request — never direct commits to `main`.
- Each PR is small, isolated, and reversible on its own (TG-CORE Section 2).

## Commit Message Style

Use conventional commits so history stays machine-readable and reviewable:

```
type(scope): summary

body — why, not just what
```

| Type | Use for |
|------|---------|
| `feat` | New capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Tooling, no product behavior change |
| `refactor` | Behavior-preserving change |
| `test` | Tests only |

Example: `fix(security): enforce CORS origin allowlist`.

## Pull Request Checklist

- [ ] Scope matches the approved prompt; nothing extra (TG-CORE Section 1)
- [ ] Isolated: reviewable and revertable without opening files outside scope (TG-CORE Section 2)
- [ ] No new dependencies without written justification and approval (TG-CORE Section 6)
- [ ] No visual decisions invented; governing documents applied (TG-CORE Section 3)
- [ ] TypeScript validation, lint, and build pass
- [ ] Relevant automated tests pass; new scope covered
- [ ] Manual QA performed and documented (see below)
- [ ] Regression report attached or referenced
- [ ] Completion record included (see `templates/implementation-report.md`)
- [ ] No secrets, keys, or local configuration committed

## Code Review Expectations

- Reviewers verify the checklist above, not just the diff.
- Every review answers: is the change minimal, clean, predictable, maintainable, accessible, and performant (TG-CORE Section 4)?
- The No Break Policy outranks the feature: a regression anywhere in the protected surface blocks merge (TG-CORE Section 7).
- Naming, structure, and patterns must match the surrounding codebase (TG-CORE Section 5).
- A change that can no longer be isolated or reviewed as a unit is too large; split it.

## Manual QA Requirement

No PR is complete without manual QA per the Manual QA Contract (TG-CORE Section 9):

- Desktop, laptop, tablet, mobile
- Dark theme (and light theme when available)
- Keyboard and accessibility pass
- Edge cases: empty states, long content, rapid interaction, offline, unusual data
- Failure states render correctly and recovery paths work

Record results with `templates/manual-qa.md` and store the record in `reports/qa/`. Failures are documented, not silently fixed.

## Certification Requirement

No surface enters Production without certification under TG-3 (TG-CORE Section 10):

- Target score: **95+**
- Below **90**: **Rejected**
- Certification evidence uses `templates/certification.md` and is stored in `reports/certification/`.

## Stop and Ask

Immediately stop implementation and raise the question when scope is ambiguous, an architecture conflict appears, a security risk is detected, a large refactor becomes necessary, or an unexpected regression appears (TG-CORE Section 13). Stopping is not failure; it is discipline.

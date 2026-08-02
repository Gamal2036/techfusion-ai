# TechFusion-AI — Core Design Contract & Executive Execution Constitution

> **Document ID:** TG-CORE
> **Phase:** Execution Governance
> **Priority:** MANDATORY FOR ALL CONTRIBUTORS
> **Status:** EXECUTION STANDARD
> **Owner:** Engineering Execution Governance — VP of Engineering
> **Version:** 1.0
> **Effective for:** Every person, AI Agent, developer, designer, reviewer, and contributor working on TechFusion-AI

---

## Preamble — Why This Document Exists

This document is the **official execution contract** of TechFusion-AI.

It does **not** redefine the Brand.

It does **not** replace the Design System.

It does **not** replace the Design Quality Framework.

It answers the single question every other document leaves open: **how work must be executed.**

TG-1A defines *who we are*. TG-2A defines *how we look and behave*. TG-3 defines *how we prove it is good enough*. TG-CORE defines *the discipline by which all of it is built* — the workflow, the boundaries, and the verification every implementation must pass before it is allowed to exist.

Where TG-3 is the caliper that certifies the instrument face, TG-CORE is the procedure the precision assembler follows at the bench: the exact steps, the exact boundaries, and the exact moment to stop and ask for direction. A precision-instrument brand cannot be assembled by improvisation. Every screw is torqued to spec, or the instrument is not shipped.

Every implementation on TechFusion-AI must obey this contract. No exception is granted for urgency, seniority, or enthusiasm. The contract is the product's immune system; every violated rule is a small wound to the platform's long-term stability.

### The one-sentence definition

> **The Core Design Contract is the permanent execution standard that guarantees every TechFusion-AI implementation is small in scope, perfect in execution, fully verified, and safe for the product — by defining what may be touched, how it must be built, and what must be proven before anything is considered done.**

### How the execution contract relates to the foundations

| Document | Answers | Governs |
|----------|---------|---------|
| TG-1A — Brand Identity Foundation | Who we are | Identity, voice, purpose |
| TG-2A / TG-2X — Design System Foundation | How we look and behave | Tokens, components, patterns, motion |
| TG-3 — Design Quality Framework | How we prove it is good enough | Certification, scoring, gates, release |
| **TG-CORE — Execution Constitution** | **How we execute the work** | **Scope, isolation, verification, completion** |
| Visual Architecture documents (e.g. AUTH-VIS) | How a surface is specified | Screen-level visual decisions |

**Hierarchy of authority.** TG-CORE cannot override TG-1A, TG-2A, TG-2X, or TG-3. When a Visual Architecture document, the Design System, or TG-3 conflicts with a request, the request is wrong — stop, explain, and escalate. TG-CORE is the process that enforces their authority.

---

# SECTION 1 — THE GOLDEN RULE

## The rule

> **Implement ONLY the requested scope.**

## What it means

Every task has a border. The border is drawn by the prompt, the approved scope, and the reference documents — never by the implementer's imagination, momentum, or sense of opportunity.

## The behavior

- Implement the **requested page**, **component**, **feature**, and **tests** — nothing more.
- Never redesign unrelated screens.
- Never modify unrelated components.
- Never refactor unrelated files.
- Never introduce architectural changes outside the approved scope.
- When an improvement is spotted outside scope: **record it, do not build it.** Unrequested improvement is scope creep wearing a helpful mask.

## Why it matters

Large scope produces large risk. A single implementation that touches five systems cannot be verified, cannot be reviewed, and cannot be rolled back cleanly. Small scope produces perfect execution: a change that is small enough to be fully understood is small enough to be fully verified.

> **Small scope. Perfect execution.** This is not a slogan. It is the unit of work that keeps the platform stable.

---

# SECTION 2 — CHANGE ISOLATION

## The rule

Every implementation must be **isolated**. It touches only what the approved scope permits, and it changes nothing outside it.

## Allowed

- Requested page
- Requested component
- Requested feature
- Requested tests

## Forbidden

- Global styling modifications
- Design token changes (unless explicitly requested)
- Shared component modifications (unless explicitly requested)
- Routing changes
- Backend modifications
- Database changes
- Architecture changes

## The test of isolation

A change is isolated if it can be reviewed, reverted, and reasoned about **without opening any file outside its scope**. If reverting the change requires touching a second system, the change was not isolated.

Isolation is what makes large software reliable. Any implementation that needs to reach across the architecture to succeed has silently failed the contract.

---

# SECTION 3 — DESIGN AUTHORITY

## The rule

Visual decisions must **never be invented.**

## What it means

Every pixel, spacing value, color, type treatment, and interaction already has a home in an authoritative document. The implementer's job is to apply the authority, not to create new preferences.

## The authority chain

1. **TG-1A** — Brand Identity Foundation (identity, voice, purpose)
2. **TG-2A / TG-2X** — Design System Foundation (tokens, components, patterns)
3. **TG-3** — Design Quality Framework (certification, scoring, gates)
4. **Visual Architecture documents** — e.g. AUTH-VIS, Dashboard, Cybersecurity, Knowledge Base, Reports (screen-level visual decisions)

## The conflict rule

If a request, an instinct, or a stakeholder demand conflicts with the authority chain:

1. **Stop.**
2. **Explain.** State the conflict and which document governs.
3. **Do NOT improvise.**

Improvising a visual decision "temporarily" is how a design system decays one screen at a time. A conflict is a governance event, not a design opportunity.

---

# SECTION 4 — IMPLEMENTATION PRINCIPLES

## The rule

Every implementation must be:

- **Minimal** — the smallest change that fully satisfies the scope
- **Clean** — readable by the next contributor without a guide
- **Predictable** — behaves as the user and the codebase expect
- **Maintainable** — easy to extend, easy to debug
- **Accessible** — usable by everyone, per WCAG and TG-3
- **Performant** — no waste on the critical path
- **Professional** — production-grade from the first commit

## The caution

- **Never over-engineer.** Do not add abstraction, flexibility, or "future-proofing" the scope does not ask for. Unused generalization is dead complexity.
- **Never under-engineer.** Do not ship shortcuts, hard-coded values, or missing states that the scope genuinely requires.

The standard is the minimum work that is *complete* — not the minimum work that *compiles*.

---

# SECTION 5 — CODE QUALITY

## The rule

Generated code must respect the product's architecture as if it had been written by the product's senior engineers.

## The standards

- Follow the project architecture and its layering rules
- Follow existing naming conventions
- Be **strongly typed** — no `any`, no implicit contracts
- **Avoid duplication** — reuse existing utilities and components
- **Avoid dead code** — no unused exports, branches, or props
- **Avoid unnecessary abstraction** — prefer the concrete pattern already in the codebase
- **Respect existing patterns** — if the file next door does it one way, do it that way

## The principle

The codebase is not a collection of pages; it is one system. An implementation that ignores how the system is written today makes the system harder to read tomorrow. Quality is measured in the code's behavior and its fit with the whole — never in its cleverness in isolation.

---

# SECTION 6 — DEPENDENCY POLICY

## The rule

**Do NOT install packages unless explicitly approved.**

## The order of preference

1. Prefer **existing libraries** already in the project
2. Prefer **internal utilities** already built by the team
3. Prefer **reusable components** already in the design system
4. Prefer **the language's standard library**

## The discipline

- A new dependency is a permanent commitment: build tooling, bundle size, supply-chain surface, and upgrade burden.
- Every proposed new dependency **must include written justification** and receive explicit approval before installation.
- If the needed behavior can be built with existing tools in reasonable time, it must be built with existing tools.

A package is not a shortcut; it is a maintenance contract. Do not sign one on behalf of the product without authorization.

---

# SECTION 7 — NO BREAK POLICY

## The rule

New work must **never break** what already works.

## The protected surface

- **Authentication** — sessions, login, registration, recovery
- **Navigation** — every route, every link, every back button
- **Responsive layouts** — desktop, laptop, tablet, mobile
- **Accessibility** — keyboard, screen readers, contrast, focus
- **Existing tests** — unit, integration, end-to-end, regression
- **Existing APIs** — contracts, status codes, payload shapes
- **Existing visual consistency** — tokens, spacing, component language

## The verification

Any implementation that ships while a regression exists anywhere in the protected surface is **incomplete**, regardless of how well the requested feature works. The no-break policy outranks the feature itself: a feature that destabilizes the platform is not a feature, it is an incident waiting to happen.

---

# SECTION 8 — TESTING CONTRACT

## The rule

**Nothing is complete without verification.**

## The required verification chain

| Stage | Requirement |
|-------|-------------|
| Static analysis | No new warnings, no new smells |
| TypeScript validation | Type-check passes across the project |
| Lint | Passes with zero errors per project config |
| Automated tests | Relevant suites pass; new scope covered |
| Manual QA | Performed per Section 9 |
| Regression verification | Protected surface re-verified per Section 7 |

## The gate

An implementation is "done" only when every stage above passes. Completion is a **state of verification**, not a state of writing code. If a stage is skipped because of time pressure, the work is not late-but-done; it is unfinished.

---

# SECTION 9 — MANUAL QA CONTRACT

## The rule

Every page must be **tested by hand**, on real devices, in real conditions.

## The matrix

- **Desktop** — wide viewport, mouse, full keyboard
- **Laptop** — typical working resolution, trackpad
- **Tablet** — touch, medium viewport
- **Mobile** — touch, narrow viewport, thumb reach
- **Dark Theme** — required
- **Light Theme** — when available
- **Keyboard** — full tab order, no mouse traps, visible focus
- **Accessibility** — screen reader pass, contrast, labels
- **Edge cases** — empty states, long content, rapid interaction, offline, unusual data
- **Failures** — errors render correctly, recovery paths work

## The duty

Failures found in manual QA must be **documented** — not quietly fixed and forgotten, not left for the next person to rediscover. The QA record is part of the deliverable. A page that has not been manually exercised on the devices above has not been QA'd.

---

# SECTION 10 — DESIGN QUALITY CONTRACT

## The rule

Every implementation is evaluated by **TG-3** before it is considered shippable.

## The standard

- Target score: **95+**
- Below **90**: **Rejected.**

## The consequence

No page enters Production without certification under TG-3. A beautiful screen that scores 88 is a rework item, not a shipping item. Quality is measured because quality that is measured is quality that is enforced; a target nobody tracks is a promise nobody keeps.

---

# SECTION 11 — DOCUMENTATION RULES

## The rule

Every completed implementation must include a completion record containing:

- **Summary** — what was built and why
- **Files changed** — precise, reviewable list
- **Features completed** — what the scope asked for, and confirmation each was delivered
- **Known limitations** — honest, documented, with owners if not resolved
- **Manual QA guide** — how a reviewer reproduces the verification
- **Regression notes** — what was protected and how it was proven safe
- **Next recommended phase** — the logical successor to this scope, for planning

## The principle

Documentation is not an afterthought for other people; it is the evidence of execution discipline. A completed implementation without its record is indistinguishable from an abandoned one.

---

# SECTION 12 — PROMPT EXECUTION RULES

## The rule

Every implementation prompt must be structured before work begins.

## The required prompt structure

| Field | Purpose |
|-------|---------|
| **Mission** | The goal, in one or two sentences |
| **Scope** | What is inside the border |
| **Constraints** | Hard limits and non-negotiables |
| **Allowed modifications** | The explicit list of what may be touched |
| **Forbidden modifications** | The explicit list of what must not be touched |
| **Expected output** | The deliverable, precisely defined |
| **Success criteria** | How the result is judged complete |
| **Validation requirements** | The verification chain required (Section 8) |
| **Completion report** | The documentation record required (Section 11) |

## The rule of ambiguity

If a prompt does not define these fields, the implementer must **clarify before building** — never fill the blanks with assumptions. Ambiguity is not permission to decide; it is an obligation to ask.

---

# SECTION 13 — STOP CONDITIONS

## The rule

**Immediately stop implementation** — then explain why and wait for approval — when:

- **Requirements are ambiguous** — the scope cannot be determined from the prompt
- **Architecture conflict exists** — the request fights the existing architecture
- **Security risk detected** — any exposure, credential, or authorization concern
- **A large refactor becomes necessary** — the change can no longer be isolated
- **An unexpected regression appears** — something outside scope broke

## The duty

Stopping is not failure. Stopping is the highest-discipline action available: it prevents unverified, unauthorized, or unsafe change from entering the product. The implementer who stops, explains, and waits is protecting the platform exactly as the contract requires. The implementer who pushes through a stop condition is gambling with the product on behalf of everyone.

---

# SECTION 14 — PROJECT STATES

## The rule

Every page follows exactly one lifecycle, in order.

## The lifecycle

```
Discovery
  ↓
Analysis
  ↓
Vision
  ↓
Implementation
  ↓
Automated QA
  ↓
Manual QA
  ↓
Certification
  ↓
Frozen
```

## The discipline

- **Never skip a stage.**
- A page cannot move forward without completing its current stage.
- **Frozen** is the only terminal state — the page is certified, stable, and no longer open to casual change. Any future modification to a frozen page begins a new lifecycle at Discovery.

A stage skipped is a debt deferred; every deferred stage returns later as rework, incident, or customer-facing defect.

---

# SECTION 15 — DEFINITION OF SUCCESS

## What success is NOT

- Beautiful UI
- Many animations
- Complex code
- Large commits

## What success MEANS

- **Correct architecture** — the change fits the system
- **Excellent UX** — the user's task is effortless and obvious
- **Brand consistency** — the surface is unmistakably TechFusion
- **Accessibility** — no user is excluded
- **Performance** — the change costs the platform nothing it can avoid
- **Maintainability** — the next contributor thanks the author
- **Zero regressions** — the protected surface is untouched
- **Successful QA** — automated and manual gates pass
- **Certification** — TG-3 confirms the page is Production-ready

Success is not the moment a feature appears on a screen. Success is the moment a feature is **safe, verified, and certified to stay.**

---

# SECTION 16 — THE EXECUTION MANIFESTO

*One page. Read it before every implementation.*

---

**Why precision matters.** TechFusion-AI is a precision-instrument brand for IT professionals whose decisions carry real consequence — a misconfigured firewall, a fleet exposed overnight. Our users do not buy decoration; they buy trust in a machine that behaves exactly as it promises. Precision is not a preference. It is the product's core promise, and it is delivered one exact change at a time. A platform that is precise in its surface must be precise in its build, or the surface is a lie.

**Why small isolated changes create stable software.** Large changes are where software dies — too much surface to understand, too much to verify, too much to revert. A small, isolated change can be fully read, fully tested, fully reviewed, and fully rolled back. That is not caution; it is engineering leverage. Twenty small, verified changes are not slower than one large gamble; they are the only version of the work that produces a stable product. The platform's resilience is the sum of discipline at the bench.

**Why quality is measured.** Trust cannot be claimed; it must be demonstrated. A number we track — a TG-3 score, a verification gate, a regression pass — is a promise we keep on paper, not just in sentiment. Measurement turns "we care" into "we prove." It makes quality reviewable, comparable, and irreversible. What is not measured drifts; what is measured holds.

**Why every contributor protects the product.** The product is a shared instrument, and every contributor is its custodian for the hours they hold it. A skipped test, an invented visual, a package added without justification, a scope silently expanded — each is a small wound to the whole. Nobody remembers who widened the scope; everyone inherits the instability. Protecting the product means defending its standards against the very human urge to be faster, cleverer, or more ambitious than the task allows.

**Why implementation discipline is part of the TechFusion culture.** Discipline is not bureaucracy; it is the shared language that lets many hands build one coherent thing. When every contributor follows the same boundaries, verifies the same gates, and documents the same records, the team compounds: knowledge transfers, review is fast, and the platform grows without fracturing. Discipline is the culture of people who build precision instruments for a living — people who know that the last 2% of correctness is the entire job. TechFusion-AI is built exactly the way its product behaves: exactly, carefully, and without improvisation.

**So we commit.** Small scope. Perfect execution. Isolation before ambition. Verification before completion. Certification before release. Protect the product. Stop when uncertain. Document the work. And in every implementation, honor the instrument we are trusted to build.

---

## Appendix A — Contributor Quick Reference

| Rule | In one line |
|------|-------------|
| The Golden Rule | Implement only the requested scope |
| Change Isolation | Touch only what the scope permits |
| Design Authority | Never invent; apply the governing document |
| Implementation Principles | Minimal, clean, predictable, accessible, performant |
| Dependency Policy | No packages without approval and justification |
| No Break Policy | Never break what already works |
| Testing Contract | Nothing is complete without verification |
| Manual QA Contract | Every page, every device, every theme, documented |
| Design Quality Contract | 95+ or rejected; 90 is the floor, not the goal |
| Documentation Rules | Every completion includes its record |
| Stop Conditions | Stop, explain, wait — when in doubt |
| Definition of Success | Correct, safe, verified, certified |

## Appendix B — Reference Documents

| Document | Purpose |
|----------|---------|
| TG-1A — Brand Identity Foundation | Who we are |
| TG-2A — Design System Foundation | How we look and behave |
| TG-2X — Design System Extensions | Extended design language |
| TG-3 — Design Quality Framework | How we prove quality |
| AUTH-VIS and future Visual Architectures | Screen-level visual specification |

---

*This document is the permanent execution contract for every future TechFusion-AI implementation. Amendments require formal approval; silent deviation is not permitted.*

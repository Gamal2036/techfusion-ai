# TechFusion-AI — Documentation Index

> **Purpose:** The map of the repository's documentation and execution infrastructure.
> **Owner:** Engineering Execution Governance
> **Last Updated:** 2026-08-01

---

## How this repository is documented

TechFusion-AI runs on a small set of permanent governance documents. Every implementation, report, and blueprint references them. When a request conflicts with any of them, the documents win — stop, explain, and escalate (TG-CORE Section 13).

## The TG Document Family

| Document | Answers | Location | Read-only |
|----------|---------|----------|-----------|
| **TG-1A** — Brand Identity Foundation | Who we are | `docs/TG-1A/` | Yes |
| **TG-2A** — Design System Foundation | How we look and behave | `docs/TG-2A/` | Yes |
| **TG-2X** — Design System Extensions | The extended design language | `docs/TG-2X/` | Yes |
| **TG-3** — Design Quality Framework | How we prove it is good enough | `docs/TG-3/` | Yes |
| **TG-CORE** — Execution Constitution | How we execute the work | `docs/TG-CORE/` | Yes |

The mission references TG-1 and TG-2; within the repository these correspond to the **TG-1A** and **TG-2A / TG-2X** documents above.

## Visual Architecture

Visual architecture documents define the screen-level visual decisions every surface must follow.

| Document | Scope |
|----------|-------|
| **AUTH-VIS-01B** — Authentication Experience Vision | Authentication experience vision |
| **AUTH-VIS-01C** — Visual Architecture Bible | The permanent visual architecture of every current and future surface |

Future per-surface visual architecture documents (Dashboard, Cybersecurity, Knowledge Base, Reports, Settings, etc.) will be referenced from this index as they are produced.

## Blueprint Folders — `blueprints/`

One folder per planned module, each with a `README.md` containing: module purpose, product owner, current status, current version, dependencies, reference documents, future roadmap, certification status, and last updated.

```
blueprints/
├── authentication/
├── dashboard/
├── cybersecurity/
├── knowledge-base/
├── reports/
├── settings/
├── billing/
├── admin/
└── shared/
```

Blueprints are planning containers only — they contain no implementation.

## Report Folders — `reports/`

One folder per report discipline, where verification and governance records are stored.

```
reports/
├── qa/             # Manual QA records (TG-CORE Section 9)
├── certification/  # TG-3 certification evidence
├── releases/       # Release notes and version history
└── architecture/   # Architecture review records
```

## Template Folders — `templates/`

Ready-to-fill document templates. Every report and completion record should start from the matching template to keep the repository consistent.

```
templates/
├── implementation-report.md
├── manual-qa.md
├── certification.md
├── feature-analysis.md
├── release-notes.md
├── regression-report.md
└── architecture-review.md
```

## Other Documentation

| Area | Location |
|------|----------|
| Product requirements | `docs/PRD.md`, `docs/01-Master-Specification.md` |
| Project context | `docs/PROJECT_CONTEXT.md` |
| Discovery series | `docs/AH-1/` |
| Stabilization and recovery series | `docs/AH-2/` |
| Feature completion and validation series | `docs/AH-3/` |
| Frontend readiness series | `docs/AH-3F/` |
| Runtime stabilization series | `docs/AH-3R/` |
| Development standards | `CONTRIBUTING.md` |
| Project roadmap | `roadmap/roadmap.md` |

## Reading Order for Contributors

1. `README.md` — what the product is
2. `docs/TG-CORE/TG-CORE_V1_EXECUTION_CONSTITUTION.md` — how work is executed
3. `docs/TG-3/` — how quality is proven
4. `CONTRIBUTING.md` — how to contribute
5. `roadmap/roadmap.md` — what is planned

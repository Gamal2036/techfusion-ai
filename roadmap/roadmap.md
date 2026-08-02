# TechFusion-AI — Project Roadmap

> **Purpose:** Planned module work, divided into phases. No implementation.
> **Owner:** Engineering Execution Governance
> **Last Updated:** 2026-08-01

---

## How to read this roadmap

This roadmap lists **planned modules only**. Nothing here is in progress unless its status says so. Before any module moves to Implementation it must pass Discovery and Analysis, and every implementation obeys TG-CORE.

Status legend: **Planned** — Discovery not started · **Discovery** — requirements being gathered · **Analysis** — design and gap analysis in progress · **In Progress** — implementation active.

## Phase 2 — Core Operational Surfaces

The operating foundation technicians and analysts rely on daily.

| Module | Blueprint | Status | Notes |
|--------|-----------|--------|-------|
| Authentication | `blueprints/authentication/` | Analysis | Visual architecture defined (AUTH-VIS-01C) |
| Dashboard | `blueprints/dashboard/` | Analysis | Visual architecture defined (AUTH-VIS-01C) |
| Reports | `blueprints/reports/` | Planned | Report types, formats, scheduling, exports |
| Knowledge Base | `blueprints/knowledge-base/` | Planned | Searchable knowledge and AI-assisted troubleshooting |

## Phase 3 — Expansion Surfaces

Operational depth for security, configuration, and account management.

| Module | Blueprint | Status | Notes |
|--------|-----------|--------|-------|
| Cybersecurity | `blueprints/cybersecurity/` | Planned | Security posture, threats, remediation |
| Settings | `blueprints/settings/` | Planned | Organization, enrollment, preferences |
| Billing | `blueprints/billing/` | Planned | Plans, subscriptions, invoices |

## Phase 4 — Governance and Scale

Administrative control and the shared infrastructure every module depends on.

| Module | Blueprint | Status | Notes |
|--------|-----------|--------|-------|
| Admin | `blueprints/admin/` | Planned | Organization and role governance |
| Shared | `blueprints/shared/` | Analysis | Design system, shared types, config, utilities |

## Cross-phase commitments

- **Certification:** every surface reaches Production only after passing TG-3 (95+ target; below 90 rejected).
- **Manual QA:** every surface is exercised per the Manual QA Contract before release.
- **No regressions:** the protected surface is verified on every change (TG-CORE Section 7).

## Roadmap governance

- Status changes require approval by Engineering Execution Governance.
- Additions and reordering are proposed through `templates/feature-analysis.md` before entering the roadmap.
- This roadmap is planned work only; it contains no implementation.

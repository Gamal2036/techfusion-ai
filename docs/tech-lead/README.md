# TechFusion AI — Technical Lead Documentation

Controlled technical-lead documentation area. This directory is the durable
source of truth for TechFusion AI architecture, product surface, readiness,
security, and the Production V1 roadmap. Content is maintained by the AI
Technical Lead operating model (see `13_AI_TECH_LEAD_OPERATING_MODEL.md`) and
supersedes ad-hoc audit reports in the repository root.

## Document Index

| Doc | Title | Status |
|-----|-------|--------|
| 00 | CURRENT_STATE.md | Baseline verified 2026-08-09 |
| 01 | PRODUCT_ARCHITECTURE.md | Baseline |
| 02 | REPOSITORY_INVENTORY.md | Baseline |
| 03 | WEB_SURFACE_MAP.md | Baseline |
| 04 | BACKEND_CAPABILITY_MAP.md | Baseline |
| 05 | AGENT_PLATFORM_MATRIX.md | Baseline |
| 06 | WORKER_QUEUE_MAP.md | Baseline |
| 07 | SECURITY_TENANCY_REVIEW.md | Baseline |
| 08 | FEATURE_READINESS_MATRIX.md | Baseline |
| 09 | COMMERCIAL_ENTITLEMENTS.md | Design recommendation |
| 10 | TECHNICAL_DEBT_REGISTER.md | Baseline |
| 11 | PRODUCTION_V1_SCOPE.md | Baseline |
| 12 | MASTER_ROADMAP.md | Baseline |
| 13 | AI_TECH_LEAD_OPERATING_MODEL.md | Ratified |
| 14 | DECISION_LOG.md | Appended |
| 15 | MODULE_EXTENSIBILITY_CONTRACT.md | Ratified (GOV-01) |

## Authority

- `00_CURRENT_STATE.md` is authoritative for "what exists and what works".
- `08_FEATURE_READINESS_MATRIX.md` is the single master feature matrix.
- `12_MASTER_ROADMAP.md` is authoritative for execution ordering.
- `13_AI_TECH_LEAD_OPERATING_MODEL.md` defines who may change what.

## Evidence Markers

Claims in these documents carry one of:

- `VERIFIED_THIS_RUN` — re-confirmed during the 2026-08-09 discovery mission.
- `VERIFIED_BY_CURRENT_CI` — proven by the local V1 green gate (19/19, reports
  in `docs/v1/V1-STAGE-01C*`). GitHub-native runs remain pending.
- `INFERRED_FROM_CODE` — read from implementation, not executed.
- `UNVERIFIED` — reported elsewhere, not independently confirmed.

## Related (not authoritative here)

Historical stage reports live in `docs/v1/`; the root-level `TF_*.md` files are
legacy working reports. They inform but do not override this directory.

# 10 — Technical Debt Register

Status: 2026-08-09. **Nothing in this register was deleted or fixed during the discovery mission.** Items are reported for controlled remediation only. Subsequent security substages fixed T8 (`SUB-01`), T9/T14 (`SUB-02`), T10 (`SUB-03`); `SUB-05` (2026-08-10) fixed T11 and audited T12/T20 (see annotations).

| # | Area | Item | Severity | Evidence |
|---|------|------|----------|----------|
| T1 | CD/deploy | **Helm chart not deployable as written.** `templates/secrets.yaml` uses `required` on postgresql.password/jwtSecret/jwtRefreshSecret/encryptionKey — none supplied by workflows or values. Deployment image refs `ghcr.io/techfusion-ai/<svc>` ≠ pushed `ghcr.io/Gamal2036/techfusion-ai/<svc>`; `--set image.tag` sets an unused top-level value. | HIGH | `infra/k8s/templates/secrets.yaml:10-13`, `values.yaml`, `cd-*.yml` |
| T2 | CD/deploy | Prod migration initContainer uses `prisma db push --accept-data-loss` (data-loss flag in prod; CI contract is `migrate deploy`). | HIGH | `infra/k8s/templates/api-gateway/deployment.yaml:39` |
| T3 | CD/deploy | Agent deployment DATABASE_URL password = username; missing secret ref. | HIGH | `infra/k8s/templates/agent/deployment.yaml:40` |
| T4 | CD/deploy | CD health checks use `kubectl run -it` (TTY not available on runners). | MEDIUM | `cd-staging.yml:69-71`, `cd-production.yml:69-71` |
| T5 | Queues | REPORT queue: producer missing + worker delegates to non-existent `POST /reports`. | HIGH | `06`; `queue.service.ts:8,86`; `processors.ts:144` |
| T6 | Queues | KB_EMBEDDING: `POST /ai/embed` missing; silent deterministic mock vectors written to DB. | HIGH | `06`; `processors.ts:1295-1320` |
| T7 | Queues | Queue names/thresholds duplicated across gateway/worker/web (`queue.constants.ts`, `queue-names.ts`, presence files) — drift risk; `REINDEX` constant already drifted. | MEDIUM | `06` |
| T8 | Security | SSO login bypass (S1). | CRITICAL | `07` |
| T9 | Security | RLS inert (S2); decorative policies. | MEDIUM | `07` |
| T10 | Security | Plaintext `Device.deviceToken` + fallback lookup (S3). | MEDIUM | `07` |
| T11 | Security | ~~Metrics token in query string; optional auth (S5).~~ **FIXED `V1-STAGE-01-SUB-05`: metrics auth is header-only (`Authorization: Bearer`) and fail-closed (403 in production when `METRICS_AUTH_TOKEN` unset); 8-test suite.** | `07`; `test/metrics-auth-security.spec.ts` |
| T12 | Data | `backups/` — 60 committed DB/config backup artifacts in VCS (incl. old pg/redis dumps). **`SUB-05` audited: no real credentials in any artifact (Device tables empty; test bcrypt hashes only); kept intentionally — history rewrite not justified; retention is a founder decision (P3 residual).** | root `backups/`; `V1-STAGE-01-SUB-05` §1/§7 |
| T13 | Data | Legacy root reports contradict current state (`TECHFUSION_V1_READINESS_AUDIT.md` predates CI; `infra/k8s/README.md` "Phase 14" claim stale; `launch-checklist.md` references non-existent release `techfusion-api-gateway`). | LOW | `02` |
| T14 | Code | `demo.controller.ts` dead RBAC demo (SCAFFOLD); `RolesGuard`/`@Roles` dead code (zero usages). | LOW | grep + read |
| T15 | Code | Legacy `Dockerfile.web` unused (CI/compose use `apps/web/Dockerfile`). | LOW | `02` |
| T16 | Data model | `Organization.plan` + `Subscription` dual source of truth (mitigated by STAGE-01A integrity work). | MEDIUM | `schema.prisma` |
| T17 | Agent | Agent has no self-update; version only sent at registration (server unaware of upgrades). | MEDIUM | `05` |
| T18 | Agent | Temperature/battery/load/service fields hardcoded `None`. | LOW | `collector.rs` |
| T19 | Frontend/backend contract | `CpuMetricsDto` whitelist strips agent CPU model; duplicated presence constants risk drift (tests mitigate). | LOW | `metrics-payload.dto.ts`, `device-presence.ts` |
| T20 | Tests | Secret scan only covers `git ls-files` — untracked-but-unignored `.env.test` never scanned (contains test placeholders only today). **`SUB-05` assessed and kept (accepted residual): CI checks out a clean tree (no untracked files), and `.env.test` is intentionally untracked (D9); extending the scanner to untracked files would add local false-positive risk with no CI value.** | `ci-secret-scan.sh:32`; `V1-STAGE-01-SUB-05` §7 |
| T21 | Tests | No end-to-end tests for SSO login; `actionlint` claim unverifiable (only YAML parse). | MEDIUM | `07`, `02` |
| T22 | Misc | Malformed leftover file at repo root: `tablish TechFusion V1 enterprise foundation and command center"` (untracked). | LOW | root listing |
| T23 | Billing | `maxTeamMembers` / `maxAlertRules` unenforced. | MEDIUM | `09` |
| T24 | Misc | `engines.node ">=18"` vs Node 22 pin; `forceExit` in test scripts (flakiness masking). | LOW | `package.json`, app manifests |
| T25 | Account profile | **Deferred account capabilities — no backend support, surfaced honestly on `/dashboard/settings/account` as "not available in this release" (no fabricated controls).** Email verification status, avatar/profile photo, last-login, password change endpoint, session listing/revocation, and MFA enrollment/management UI on the account page are all absent (`User` has no email-verified/avatar/last-login fields; no password-change or session endpoints exist; MFA status is read-only via `GET /mfa/status`). Recorded as deferred per ACC-FOUND-01, never faked. | LOW | `prisma/schema.prisma` `User` (84-105), `src/auth`, `src/mfa`, `src/account`; `03` |

## 2. High-Risk TODO/FIXME Scan

No TODO/FIXME hotspots with destructive implications were found in critical paths (`INFERRED_FROM_CODE`). The three highest-risk items are all configuration/deploy-time (T1-T3) rather than logic bugs.

# 02 — Repository Inventory

Status: 2026-08-09. Root `/home/ge/techfusion-ai`. Monorepo (pnpm workspace + Turbo), tracked files ~950.

## 1. Top-Level Layout

| Path | Purpose | Notes |
|------|---------|-------|
| `apps/web` | Next.js command center | see `03_WEB_SURFACE_MAP.md` |
| `apps/api-gateway` | NestJS API | see `04_BACKEND_CAPABILITY_MAP.md` |
| `apps/worker` | BullMQ worker | see `06_WORKER_QUEUE_MAP.md` |
| `apps/agent` | Rust Linux agent | see `05_AGENT_PLATFORM_MATRIX.md` |
| `packages/{config,types,ui,utils}` | shared workspace packages | |
| `prisma` schemas | `apps/api-gateway/prisma/schema.prisma` (authoritative), worker copy synced by `scripts/sync-prisma-schema.sh` | 16 migrations |
| `scripts/` | gate + installer tooling | 14 scripts (see table below) |
| `.github/workflows/` | ci, release-agent, cd-staging, cd-production | 4 workflows |
| `infra/` | Docker compose + Helm (k8s) + observability | prod deploy story |
| `Dockerfile.web` | legacy web Dockerfile | `INFERRED_FROM_CODE`: unused by CI/compose; superseded by `apps/web/Dockerfile` |
| `docs/` | governance + stage reports; `docs/tech-lead/` = this suite (authoritative) | |
| `docs/v1/`, `docs/certifications/` | stage/certification reports | historical evidence |
| `backups/` | committed legacy local backups (60 files) | `INFERRED_FROM_CODE`: pg/redis/config dumps from old `scripts/backup/` (dir gone). Debt: DB dumps in VCS |
| `dist/` | gitignored release staging (agent binary) | build output |
| `reports/`, `roadmap/`, `blueprints/`, `templates/` | planning/governance scaffolding | READMEs + templates only |
| `report-storage/` (root + api-gateway) | gitignored runtime report output | generated PDFs |
| `TF_*.md` (root, 15 files) | legacy working reports | historical only; not authoritative |
| `TECHFUSION_V1_READINESS_AUDIT.md` | pre-CI-era audit | contradicts current state (see `10`) |

## 2. CI / CD

### `.github/workflows/ci.yml` (437 lines)
- Trigger: push to `main`, PRs to `main`. Pins Node 22.22.3, pnpm 9.15.9, Rust 1.96.0.
- Jobs: `ci-api` (TimescaleDB + Redis services, lint+test+build), `ci-web`, `ci-worker`, `ci-agent` (fmt, check, test, release build, version/capability gates), `ci-bootstrap` (3 offline verifiers), `ci-migration` (16 migrations on fresh TimescaleDB + schema-sync check), `ci-security` (secret scan), `v1-green-gate` (fail-closed aggregator), `docker-build` (main-only, needs green gate, GHCR push of api-gateway/web/worker/agent).
- GHCR: `ghcr.io/Gamal2036/techfusion-ai/<service>`, tags `sha-<full>` + `latest`.
- Status: local-certified 19/19; GitHub-native run pending (`VERIFIED_BY_CURRENT_CI` for local).

### `.github/workflows/release-agent.yml` (174 lines)
- Builds x86_64 + aarch64 Linux binaries, gates on fmt+test+version+capability, publishes GitHub release with `.sha256`, post-publish verification + installer regression.

### CD
- `cd-staging.yml`: triggered by `workflow_run` of workflow "CI" on `main` success; Helm release `techfusion-staging`.
- `cd-production.yml`: `workflow_dispatch` with required `tag`; Helm release `techfusion-prod`.
- **Blockers found** (`INFERRED_FROM_CODE`, detail in `10`): chart `required` values never provided; image repo `ghcr.io/techfusion-ai/<svc>` ≠ pushed `ghcr.io/Gamal2036/techfusion-ai/<svc>`; `--set image.tag` sets unused top-level value; prod migration uses `prisma db push --accept-data-loss`; agent deployment DATABASE_URL password=username; `kubectl run -it` health checks need a TTY.

## 3. Docker

| Image | Context | Dockerfile | Base | Notes |
|-------|---------|------------|------|-------|
| api-gateway | repo root | `apps/api-gateway/Dockerfile` | node:22-alpine | multi-stage, Prisma generate |
| web | repo root | `apps/web/Dockerfile` | node:22-alpine | prod-only install, next start |
| worker | repo root | `apps/worker/Dockerfile` | node:22-alpine (+bash) | full install (Prisma CLI) |
| agent | `apps/agent` | `apps/agent/Dockerfile` | rust:1.96 → debian:trixie-slim | |
| legacy | repo root | `Dockerfile.web` | node:22-alpine | unused |

## 4. Infra

- `infra/docker/docker-compose.yml` — local dev: TimescaleDB (5433), Redis (6379), api-gateway (3001), web (3000), worker.
- `infra/docker/docker-compose.test.yml` — test-postgres (5434, tmpfs), test-redis (6381).
- `infra/docker/docker-compose.observability.yml` — Prometheus, Grafana, OTel collector.
- `infra/k8s/` — Helm chart (TimescaleDB + Redis StatefulSets, 4 service Deployments, HPA, ingress + cert-manager, OTel collector, prometheus/grafana/loki subcharts). README's "Phase 14 will replace compose" is stale.

## 5. Scripts

| Script | Purpose |
|--------|---------|
| `ci-v1-gate.sh` | 19-step authoritative local gate (`pnpm ci:v1`) |
| `ci-secret-scan.sh` | redacting scan over `git ls-files` |
| `sync-prisma-schema.sh` | copies gateway schema → worker |
| `install-linux.sh` / `uninstall-linux.sh` | agent systemd installer/uninstaller (v1.3.0) |
| `enroll-device.sh` | enrollment helper |
| `verify-linux-bootstrap.sh`, `verify-agent-systemd-unit.sh`, `verify-installer-arch-resolution.sh`, `verify-agent-release-assets.sh`, `test-installer-artifact-regression.sh`, `sync-installer-assets.sh` | release/installer verification |
| `agent-release-config.sh` | single source of truth: `AGENT_RELEASE_TAG=v1.0.0-agent-beta.5` |
| `run-integration-tests.sh` | compose test infra + migrate deploy + jest |
| `backup/` | legacy backup scripts (dir removed; artifacts remain in `backups/`) |

## 6. Migrations (16, all apply on fresh TimescaleDB — `VERIFIED_BY_CURRENT_CI`)

`20260616190116_init` → `…20_rls` → `…30_devices` → `…40_alerts` → `…50_billing` → `…60_kb` → `20260617000100_enterprise` → `…300_missing_tables` → `…400_rls_complete` → `20260720120000_device_identity_enrollment` → `20260720130000_device_token_hash_credential_rotation` → `20260725000000_device_lastseenat_explicit` → `20260806000000_report_completion_fields` → `20260806010000_monitoring` → `20260807000000_organization_membership` → `20260808000000_organization_invitation`.

## 7. Tests

- api-gateway: 20 spec files (`apps/api-gateway/test/`)
- web: 35 spec files (`apps/web/__tests__/`)
- worker: 8 spec files (`apps/worker/src/__tests__/`)
- agent: 78 in-source tests
- Coverage claims 913/790/79/78 per STAGE-01C cert reports (`VERIFIED_BY_CURRENT_CI`).

## 8. Known Risks / Debt (see `10` for full register)

1. CD not deployable as written.
2. `backups/` DB dumps committed to VCS (data-governance + secret risk).
3. Legacy root reports contradict current state.
4. `Dockerfile.web` unused; `demo.controller.ts` dead; `RolesGuard`/`@Roles` dead.
5. `apps/api-gateway/.env.test` untracked by design but not covered by secret scan (`git ls-files` only).

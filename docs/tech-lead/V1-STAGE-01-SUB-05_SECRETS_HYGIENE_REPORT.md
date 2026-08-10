# V1-STAGE-01-SUB-05 — Secrets Hygiene Review & Stage-01 Security Closure

Status date: 2026-08-10. Mission: close the Stage-01 secrets-hygiene surface —
audit every credential touchpoint (source, env wiring, CI/CD, Docker/Helm,
backups), prove production fail-closed posture, remediate the confirmed gaps,
and mark V1-STAGE-01 CLOSED. `MIGRATION: NONE`. No schema change was required.

## 1. Scope of the Review

Every surface where a secret is produced, consumed, stored, transmitted,
logged, or versioned:

- **Code**: JWT/refresh signing + verification, device credentials (hash-only),
  enrollment tokens (hashed at rest), AI provider keys + SSO client secrets
  (AES-256-GCM encrypted at rest), TOTP secrets (base32 at rest), Stripe keys +
  webhook signature verification.
- **Startup fail-closed**: `validateEnvironment()` runs before `app.listen`
  (`main.ts:18`); `env.validation.ts` rejects missing / empty / placeholder /
  <32-char secrets in production. `auth.service.ts` throws when
  `JWT_SECRET`/`JWT_REFRESH_SECRET` are absent. **No known/default secret
  fallback exists in production.**
- **Logging**: `StructuredLogger` redacts values matching password/secret/token/
  authorization/bearer/api-key/credit-card/ssn and redacts object keys containing
  password/secret/token/authorization/api_key/apikey (production JSON logs).
  No `logger.*` call was found that includes a raw credential. `RequestLoggingInterceptor`
  logs routed-path or URL (query strings only for unrouted 404s); the metrics
  query-token was the remaining URL/log leakage vector (see §2).
- **Client boundary**: web consumes only `NEXT_PUBLIC_API_URL` /
  `NEXT_PUBLIC_WS_URL` (public config); no server-only secret reaches a client
  bundle. Docker build contexts exclude `.env*`, `backups`, `docs` via
  `.dockerignore` (root) and `apps/agent/.dockerignore`.
- **CI/CD**: secrets come from GitHub Secrets env only (`KUBECONFIG` base64,
  image refs); no literals, no `echo` of values, deterministic non-production
  TEST constants in `ci.yml`.
- **Helm**: `infra/k8s/templates/secrets.yaml` uses `required` for
  postgresql.password / jwtSecret / jwtRefreshSecret / encryptionKey; no values
  file supplies them → deploy fails closed until provisioned (T1–T3 are
  deploy-wiring debt, Stage-02 scope).
- **Backups (`backups/`)**: ~60 committed artifacts (config tars, pg/redis
  dumps, manifest). `tar -tzf` + SQL extraction audit (`/tmp/opencode/*.sql`):
  `Device` tables have **0 rows** (no plaintext device tokens); credential
  tables hold only test users (bcrypt hashes) and SHA-256 refresh-token hashes;
  config tars contain infra files only, no `.env` with values. Pattern scan
  (`sk_live_*`, `AKIA*`, `ghp_*`, `tfenr_*`, `BEGIN PRIVATE KEY`) over all
  artifacts and extracted dumps: **NO MATCHES**.

## 2. Findings

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| F1 (S5) | P2 | **Metrics token accepted via query string** (`GET /metrics?token=`), optional auth. A production token sent in the query string is captured by proxies and by request-URL logging (`RequestLoggingInterceptor` uses Nest `Logger` and `AllExceptionsFilter` logs `request.url`). Helm ingress maps `api.techfusion.ai/` → api-gateway Prefix `/`, so `/metrics` is publicly reachable in the current topology; `METRICS_AUTH_TOKEN` is not provisioned anywhere in Helm. | **FIXED — header-only.** `metrics.controller.ts` now authenticates via `Authorization: Bearer` only (query-string `?token=` input removed) and **fails closed**: 403 when `METRICS_AUTH_TOKEN` is set and the Bearer header does not match, and 403 in `NODE_ENV=production` even when the token is not configured. Dev (`NODE_ENV != production`, token unset) remains open for local/`prometheus.yml` scraping. |
| F2 | P3 | Hardcoded 64-hex JWT fallback in a dev seed script (`scripts/seed-inventory-test.ts:6`). | **FIXED — replaced with an exempt placeholder marker** (`tfenr_ci-secret-replace-before-deploy`, recognized by the scanner's `ci-secret`/`tfenr_` markers). |
| F3 (T12) | P3 | 60 committed backup artifacts in VCS. | **Audited, kept.** No real credentials found (see §1). History rewrite is out of scope and not justified; documented as accepted residual. |
| F4 (worker) | P3 residual | Worker metrics (`apps/worker/src/metrics.ts:237-255`) still accepts a query token on port 9464. | **Deferred, documented.** Cluster-internal only (no ingress, no DNS exposure); the api-gateway (public) surface is closed. Follow in Stage-02 wiring. |

## 3. Fixes (targeted; no architecture change)

1. **`apps/api-gateway/src/metrics.controller.ts`** — removed the query-string
   token path; Bearer-header-only comparison; explicit fail-closed branches for
   (a) token configured + no/wrong header → 403 and (b) `NODE_ENV=production` +
   token not configured → 403. Env is read per-request (no module-load stale
   snapshot).
2. **`apps/api-gateway/scripts/seed-inventory-test.ts`** — placeholder JWT
   fallback.
3. **No change** to scanner / `.gitignore` / CI / Docker / Helm / backups —
   each was assessed and the status-quo posture is already correct or a
   documented residual (T1–T4 deploy wiring, T20 scanner scope, T12 backups).

## 4. Adversarial Suite — `test/metrics-auth-security.spec.ts` (8 tests)

| # | Scenario | Result |
|---|----------|--------|
| 01 | Token unset, not production (dev) | 200 |
| 02 | Token set + valid Bearer header | 200 |
| 03 | Token set + wrong Bearer header | 403 |
| 04 | Token set + `?token=` query string (S5 regression) | 403 |
| 05 | Token set + no auth header | 403 |
| 06 | Production + token unset | 403 (fail-closed) |
| 07 | Production + token unset + bogus Bearer | 403 |
| 08 | Production + token set + valid Bearer | 200 |

## 5. Verification Evidence

- **api-gateway**: 57 suites / 979 tests PASS (includes the new 8-test suite +
  SUB-04 15-test + SUB-03 13-test + SUB-02 20-test suites; existing
  `observability.integration.spec.ts` metrics tests still green under
  `NODE_ENV=test`).
- `tsc --noEmit` (lint) + `tsc` (build) green — api-gateway.
- No Worker/Web/Agent source changed; `MIGRATION: NONE`.
- `scripts/ci-v1-gate.sh` — **19/19 PASS** (includes api/web/worker/agent
  typecheck+test+build, migration validation, installer/arch/systemd checks,
  and repository secret scan → NO SECRETS DETECTED).
- `.env.test` remains untracked (D9) and contains test placeholders only.

## 6. Stage-01 Closure Statement

All V1-STAGE-01 security items are closed:

- **S1** SSO bypass → fail-closed 501 (SUB-01).
- **S2** RLS decision → app-layer authoritative + 20-test isolation suite (SUB-02).
- **S3** plaintext `Device.deviceToken` removed; hash-only + fail-closed (SUB-03).
- **S4** device telemetry trust boundary certified (SUB-04).
- **S5** metrics token out of query string; fail-closed prod auth (SUB-05).
- Secrets hygiene review (final Stage-01 item) complete; no real secret found
  in tree, history-adjacent artifacts, or backups.

Stage-01 CRITICAL/HIGH findings from `07` are closed. **V1-STAGE-01 is CLOSED.**

## 7. Residual Risks (accepted, deferred to Stage-02+)

- **Deploy secret wiring (T1–T3)** — Helm chart fails closed until secrets are
  provisioned; agent `DATABASE_URL` still uses username-as-password (T3).
  Stage-02 (Deployment Reliability & CD Repairs).
- **Worker metrics query-token** on cluster-internal port 9464 (F4).
- **Committed backup artifacts (T12)** — audited no-real-secrets; retention is
  a founder decision (do not rewrite history).
- **Secret scanner covers only `git ls-files` (T20)** — accepted; CI has no
  untracked files, and `.env.test` is intentionally untracked (D9).

## 8. Files Changed

- `apps/api-gateway/src/metrics.controller.ts` (header-only, fail-closed metrics auth)
- `apps/api-gateway/scripts/seed-inventory-test.ts` (placeholder JWT fallback)
- `apps/api-gateway/test/metrics-auth-security.spec.ts` (new, 8 tests)
- `docs/tech-lead/07_SECURITY_TENANCY_REVIEW.md`, `10_TECHNICAL_DEBT_REGISTER.md`,
  `12_MASTER_ROADMAP.md`, `14_DECISION_LOG.md` (SUB-05 status; Stage-01 CLOSED)

## 9. Next Recommended Work

`V1-STAGE-02` — Deployment Reliability & CD Repairs (T1–T4): provision Helm
secrets properly, `migrate deploy` not `db push` in prod, agent `DATABASE_URL`
secret ref, real CD run + GHCR verify, and wire `METRICS_AUTH_TOKEN` into the
Helm chart / Prometheus ServiceMonitor as part of that wiring.

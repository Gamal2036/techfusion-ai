# TF-DEPLOYMENT-CONNECTION-AUDIT-01 — Render (API Gateway) ⇄ Vercel (Web) Connection Audit

- **Task:** TF-DEPLOYMENT-CONNECTION-AUDIT-01
- **Date:** 2026-08-14
- **Status:** COMPLETE (read-only evidence audit; no code changed)
- **Audit type:** Static code + config verification. No live platform re-fetch (credential-gated values are `REPORTED_BY_OPERATOR`).
- **Evidence markers:** `VERIFIED_THIS_RUN` (read from working tree), `INFERRED_FROM_CODE`, `REPORTED_BY_OPERATOR` (current platform env values supplied with the task, not re-fetched), `UNVERIFIED`.

> Per `AGENTS.md` §14: environment/secret **values** are never printed in this report. Only variable **names**, defaults, and routing contracts are documented. No `.env*` file was read for values; only `process.env.*` reference sites in source.

---

## 1. Scope & Method

- **Targets**
  - Backend: NestJS API Gateway in `apps/api-gateway`, deployed on Render at `https://techfusion-ai.onrender.com` (deployment URL reported by operator).
  - Frontend: Next.js app in `apps/web`, deployed on Vercel at `https://webtechfusion-ai.vercel.app`.
  - Related: `apps/worker`, `apps/agent` (downstream consumers of the same API), GitHub Releases as the agent binary mirror.
- **Method:** Enumerated every `process.env.*` reference in `apps/api-gateway/src` and `apps/web/src`; read bootstrap (`main.ts`), startup validation (`env.validation.ts`), CORS/WS wiring, health/metrics controllers, gateways, queue, billing, AI providers, Dockerfiles, `next.config.js`, installer scripts, and release config. Cross-checked the certified agent release tag against the live GitHub release page.
- **Constraints honored:** read-only; no route/port/script/var guessed; no code changes; env names only.
- **Out of scope (flagged, not fixed):** code changes required for production connectivity (CSP in `next.config.js`), ephemeral filesystem implications of `REPORT_STORAGE_DIR` on Render, CSP-adjacent hardening.

---

## 2. Executive Verdict

The application layer is **connection-correct by design**:

1. **Port binding** — `apps/api-gateway/src/main.ts:51-52` uses `process.env.PORT || 3001` and `app.listen(port)` with **no host argument** → binds all interfaces (equivalent to `0.0.0.0`). Nothing in code overrides `PORT`. **Render-compatible: YES** (`VERIFIED_THIS_RUN`).
2. **No global prefix** — no `setGlobalPrefix` anywhere in `apps/api-gateway/src`. Every controller serves at root (`/health`, `/auth/login`, `/reports`, …). Base URL = `https://techfusion-ai.onrender.com` directly. (`VERIFIED_THIS_RUN`)
3. **CORS/WS origins** — `ALLOWED_ORIGINS` (`main.ts:34`) and `WS_ALLOWED_ORIGINS` (`ws-cors.ts:4`) are comma-separated, trimmed, exact-match origin arrays. The operator-supplied value `https://webtechfusion-ai.vercel.app` matches the app's origin exactly. **Compatible: YES**.
4. **WebSocket paths** — gateways use Socket.IO **namespaces** `/metrics`, `/network`, `/remote` with the **default Socket.IO root path** (no `/ws` path, no custom `path` option). The client appends the namespace to the WS base URL (`socket-client.ts:27`). Therefore `NEXT_PUBLIC_WS_URL` must be `wss://techfusion-ai.onrender.com` **without** `/ws`.

**However, the current platform configuration will NOT connect:**

- All four operator-reported `NEXT_PUBLIC_*` values on Vercel point at `https://api-staging.techfusion.ai` (a placeholder host) and two of them (`/ws` suffix, `/download/agent` path) contradict the code's routing contract (`VERIFIED_THIS_RUN` code vs `REPORTED_BY_OPERATOR` values).
- The frontend's CSP `connect-src` (`apps/web/next.config.js:20`) blocks HTTPS REST calls to the Render origin (only `'self'`, `http://localhost:3001`, `ws:`, `wss:` are allowed). **Code fix required** before production connectivity.
- Multiple boot-fatal env vars are missing from the Render service (Section 3.1).

> ⚠️ The audit request also names a hosting detail: the operator-specified target backend is `https://techfusion-ai.onrender.com`, while all current frontend values point at `api-staging.techfusion.ai`. This audit validates the **code contract** for `techfusion-ai.onrender.com`; whether `api-staging.techfusion.ai` is a real DNS alias of the same Render service is **UNVERIFIED** and must be confirmed with the platform owner. The commands in Section 9 verify whichever host is live.

---

## 3. Section 1 — Render Environment Variables (API Gateway)

Source of truth: `apps/api-gateway/src/config/env.validation.ts` (startup validation called from `main.ts:18`), plus eager-DI constructors in `app.module.ts:42-47`.

### 3.1 Boot-fatal (process exits if missing/invalid — `main.ts:56-62`)

| Variable | Tag | Why | Evidence |
|---|---|---|---|
| `NODE_ENV` | REQUIRED (must be `production`) | Gates strict secret checks, HSTS, stricter throttling, error masking, metrics fail-closed, JSON logs | `env.validation.ts:46`; `security-headers.ts`; `rate-limits.ts:9`; `all-exceptions.filter.ts:21`; `metrics.controller.ts:12`; `structured-logger.ts:3` |
| `DATABASE_URL` | REQUIRED | Prisma connection; readiness check | `env.validation.ts:49`; `prisma/schema.prisma` datasource `env("DATABASE_URL")`; `health.controller.ts:41` |
| `REDIS_URL` | REQUIRED | BullMQ queue, readiness, schedulers | `env.validation.ts:50`; `queue/queue.service.ts:29`; `health.controller.ts:56,60`; `presence-sweep-scheduler.service.ts:68`; `reporting/report-schedule-executor.service.ts:100`. `rediss://` handled by ioredis. |
| `JWT_SECRET` | REQUIRED (≥32 chars prod) | Access-token signing/verification | `env.validation.ts:52`; `auth/auth.service.ts:8-11,264`; `common/membership-auth.ts:16-19` |
| `JWT_REFRESH_SECRET` | REQUIRED (≥32 chars prod) — **enforced but functionally unused** | Validated at startup; refresh tokens are opaque DB hex strings and the getter at `auth.service.ts:15-18` is never invoked | `env.validation.ts:53`; `auth.service.ts:15-18` |
| `AI_ENCRYPTION_KEY` | REQUIRED (≥32 chars prod) | AI provider credentials at rest | `env.validation.ts:56`; `ai/services/encryption.service.ts:9` |
| `REPORT_URL_SECRET` | REQUIRED (≥32 chars prod) | Signed report-download URLs | `env.validation.ts:57`; `reporting/services/report-storage.service.ts:8-11` |
| `ALLOWED_ORIGINS` | REQUIRED (non-empty prod) | HTTP CORS origin allowlist | `env.validation.ts:59-64`; `main.ts:34-36` |
| `WS_ALLOWED_ORIGINS` | REQUIRED (non-empty prod) | Socket.IO CORS origin allowlist | `env.validation.ts:66-71`; `ws-cors.ts:1-6` |
| `WEB_APP_URL` | REQUIRED (prod) | Web-app base URL for invitation/email links (must be the Vercel app, not the gateway) | `env.validation.ts:75-80`; `organizations/invitation-token.ts:55` |
| `PORT` | REQUIRED on Render (injected by platform) | `process.env.PORT || 3001`; no host arg → all interfaces | `main.ts:51-52` |
| `STRIPE_SECRET_KEY` | REQUIRED to boot (not in `validateEnvironment`, but **eager DI makes it fatal**) | `BillingService` constructor throws when missing; `BillingModule` is imported unconditionally | `billing/billing.service.ts:6,13-20`; `app.module.ts:24,46` |

### 3.2 Boot-safe / OPTIONAL / CONDITIONAL

| Variable | Tag | Notes | Evidence |
|---|---|---|---|
| `METRICS_AUTH_TOKEN` | OPTIONAL (recommended) | In production `/metrics` is **fail-closed 403** when unset — set it to enable scraping | `metrics.controller.ts:11-28` |
| `STRIPE_WEBHOOK_SECRET` | CONDITIONAL (webhook events only) | Missing → webhook signature verification fails at event time | `billing.service.ts:7` |
| `STRIPE_PRO_PRICE_ID` / `STRIPE_BUSINESS_PRICE_ID` / `STRIPE_ENTERPRISE_PRICE_ID` | CONDITIONAL (Stripe checkout) | Defaults are placeholders (`plan-features.ts`); they pass validation (not `requireSecret`-registered) so real IDs needed only if billing is exercised | `plan-features.ts:82,103,124`; `env.validation.ts:1-7` |
| `GROQ_API_KEY` | OPTIONAL (one of the AI providers) | Operator has it set; wired in Groq provider + router | `ai/providers/groq.provider.ts`; `ai/ai-orchestrator.service.ts:102`; `ai/providers/router/groq-router.provider.ts:15` |
| `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | OPTIONAL | Not required at boot; per-request provider fallback | AI provider/router files |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | OPTIONAL | Defaults `http://localhost:11434` / `llama3` | `ai/providers/ollama.provider.ts:11`; `ollama-router.provider.ts:17` |
| `OPENAI_MODEL`, `ANTHROPIC_MODEL` | OPTIONAL | Defaults `gpt-4o` / `claude-sonnet-4-20250514` | AI providers |
| `AI_ROUTER_STRATEGY` | OPTIONAL | Default `smart` | `ai/router/ai-router.service.ts:51` |
| `AI_FALLBACK_ENABLED` | OPTIONAL | Default `true` | `ai-router.service.ts:99` |
| `AI_ROUTER_TIMEOUT_MS` | OPTIONAL | Default `30000` | `ai-router.service.ts:98,151` |
| `AI_CIRCUIT_BREAKER_THRESHOLD` / `AI_CIRCUIT_BREAKER_RESET_MS` | OPTIONAL | Defaults `3` / `600000` | `ai-router.service.ts:37-38` |
| `OTEL_ENABLED` | OPTIONAL — **recommend `false` on Render** | Default `true` (`telemetry.ts:12`) → tries to export to default `http://localhost:4317` (`telemetry.ts:13`); failures are **non-fatal** (`telemetry.ts:43-48`) but noisy | `telemetry.ts:12-15` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` / `OTEL_SAMPLE_RATE` | OPTIONAL | Defaults `http://localhost:4317` / `techfusion-api-gateway` / `0.1` | `telemetry.ts:13-15` |
| `APP_VERSION` | OPTIONAL | Default `0.1.0` | `health.controller.ts:18` |
| `REPORT_STORAGE_DIR` | OPTIONAL — **ephemeral on Render** | Default `./report-storage`; Render's filesystem is wiped on redeploy/restart → stored reports and their signed URLs do not survive a restart. Not a boot blocker for staging | `reporting/services/report-storage.service.ts:6` |
| `REPORT_SCHEDULE_LOCK_TTL_MS` | OPTIONAL | Default ~5 min | `report-schedule-executor.service.ts:358` |
| `BACKUP_RESTORE_DEST` | OPTIONAL | Default `/tmp/techfusion-recovery` | `backups/backups.service.ts:206` |
| `MASTER_KEY` | OPTIONAL / legacy | Alternate to `AI_ENCRYPTION_KEY` in the general encryption service | `encryption/encryption.service.ts:68` |
| `INVITE_BASE_URL` | UNUSED / legacy | Fallback only; `WEB_APP_URL` is the primary | `invitation-token.ts:56` |
| `HOST` | UNUSED | No `process.env.HOST` reference anywhere in `apps/api-gateway/src` | grep |
| `NEXT_PUBLIC_OBSERVABILITY_ENABLED/ENDPOINT/SAMPLE_RATE` | UNUSED on backend | Referenced in `.env.example` but consumed by the **web** app only | `.env.example`; web grep |

**Render checklist (name-only) — copy-paste block A, Section 8.**

---

## 4. Section 2 — Vercel Environment Variables (Web)

All web vars are `NEXT_PUBLIC_*` (browser-exposed) and contain only URLs/booleans/floats — no secrets. Sources: `apps/web/src/lib/auth-client.ts`, `apps/web/src/lib/socket-client.ts`, `apps/web/src/lib/agent-download.ts`, `apps/web/src/lib/observability.ts`, onboarding/enrollment pages.

| Variable | Tag | Correct production value | Fallback if unset (UNSAFE) | Evidence |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | REQUIRED | `https://techfusion-ai.onrender.com` | `http://localhost:3001` | `auth-client.ts:3`; `socket-client.ts:5`; onboarding/enrollment |
| `NEXT_PUBLIC_WS_URL` | OPTIONAL (recommended) | `wss://techfusion-ai.onrender.com` (**no `/ws`**) | falls back to `NEXT_PUBLIC_API_URL` | `socket-client.ts:5`; namespace appended at `socket-client.ts:27` |
| `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` | OPTIONAL — **leave unset** | Unset (uses built-in default) or `https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.4` | built-in default (correct) | `agent-download.ts:22-23,33-34` |
| `NEXT_PUBLIC_APP_URL` | OPTIONAL | `https://webtechfusion-ai.vercel.app` (falls back to `window.location.origin`, which is already correct on Vercel) | `window.location.origin` | onboarding/enrollment pages |
| `NEXT_PUBLIC_OBSERVABILITY_ENABLED` | OPTIONAL — set `false` | `false` | **defaults to `true`** when unset → beacons to a non-existent backend route | `observability.ts:8` |
| `NEXT_PUBLIC_OBSERVABILITY_ENDPOINT` | OPTIONAL — leave empty | empty | empty | `observability.ts:9` |
| `NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE` | OPTIONAL | `0.1` | `0.1` | `observability.ts:10` |

**Agent download contract (why the current value is wrong):**
- `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` is the **GitHub-Release BASE URL**, not a single artifact and not an API route (`agent-download.ts:10-19`). The installer appends `techfusion-agent-linux-<arch>` and its `<name>.sha256` sibling for the detected architecture (`x86_64`/`aarch64`).
- The frontend never downloads binaries itself; it passes the base URL to `install-linux.sh` via `--release` (OnboardingFlow / enrollment page) and the installer resolves concrete assets (`apps/web/public/install-linux.sh`).
- No `/download/agent` route exists in `apps/api-gateway` and the gateway serves **no static assets** (grep over `apps/api-gateway/src`; no static config in `main.ts`).
- Certified release: `v1.0.0-agent-beta.4` (source of truth `scripts/agent-release-config.sh:17`; web default `agent-download.ts:23`). **VERIFIED_THIS_RUN**: the GitHub release page exists and lists 6 assets, auto-released by `github-actions` — the default URL is live.
- CI keeps the web default in sync with the certified tag (`scripts/verify-linux-bootstrap.sh:121`).

**Websocket contract (why the `/ws` suffix is wrong):**
- Client connects with `io(\`${WS_URL}${namespace}\`)` (`socket-client.ts:27`), namespaces `/metrics`, `/network`, `/remote` (e.g. `useCommandCenterData.ts:43`, `useNetwork.ts:449`, `useRemoteSupport.ts:204`, `useWebSocket.ts:11`).
- Gateways declare those namespaces with the **default Socket.IO path** (`devices.gateway.ts:16-19`, `network.gateway.ts:15-18`, `remote-support.gateway.ts:26-29`) — no `/ws` path exists. A WS_URL ending in `/ws` would produce `/ws/metrics` etc., which the server does not host.

---

## 5. Section 3 — CORS / WebSocket Wiring

- **HTTP CORS** (`main.ts:34-42`): `ALLOWED_ORIGINS` split on `,`, trimmed, `filter(Boolean)`; dev fallback `['http://localhost:3000']`; `credentials: true`; methods `GET,POST,PUT,PATCH,DELETE,OPTIONS`; allowedHeaders `Content-Type, Authorization, X-Org-Id, X-Device-Token, X-Request-Id, X-Correlation-Id`; exposedHeaders `Content-Disposition, X-Request-Id, X-Correlation-Id`; `maxAge 86400`.
- **WS CORS** (`ws-cors.ts:1-14`): same comma-split/trim from `WS_ALLOWED_ORIGINS`; **production fallback is `['https://techfusion.ai']`** (`ws-cors.ts:8-10`) — wrong host, but unreachable in practice because `validateEnvironment` requires `WS_ALLOWED_ORIGINS` in production (`env.validation.ts:66-71`).
- **Match check:** `https://webtechfusion-ai.vercel.app` (REPORTED) is an exact member of both allowlists as configured. No wildcards. Exact string match → **no trailing slash, no quotes, no scheme case change**.
- **Vercel Preview domains** are NOT in the allowlist; per-preview deployment would require adding each origin (and per-preview `NEXT_PUBLIC_API_URL`). Documented limitation, not a blocker for the production app.
- **WS auth:** client sends JWT via handshake `auth.token` (`socket-client.ts:28-36`); server extracts `auth.token` or `Authorization: Bearer` (`ws-auth.middleware.ts:45-49`).

### CSP finding (code change REQUIRED before production works)
`apps/web/next.config.js:13-24` CSP `connect-src 'self' http://localhost:3001 ws://localhost:3001 ws: wss:` does **not** allow arbitrary HTTPS origins. Browser REST calls to `https://techfusion-ai.onrender.com` will be **blocked by CSP** (only `'self'`, `localhost:3001`, and websocket schemes are allowed). `wss:` is allowed, so Socket.IO's websocket transport would pass CSP (though polling transport would not). Add the Render origin (or `https:`) to `connect-src`. **REQUIRED code fix — not implemented (out of scope).**

### Related container notes
- `apps/web/Dockerfile` and root `Dockerfile.web` hardcode `ENV NEXT_PUBLIC_API_URL=http://localhost:3001` at build. Irrelevant to a normal Vercel deploy (Vercel uses its own build), but would break any containerized/web deployment on Render. Flag only.
- `apps/api-gateway/Dockerfile` runs `node dist/main.js` — no env overrides; fine for Render.

---

## 6. Section 4 — Route Map (no global prefix; base `https://techfusion-ai.onrender.com`)

### HTTP
- `GET /health`, `GET /health/live` — public (`health.controller.ts:12,23`)
- `GET /health/ready` — public; 503 `degraded` when Postgres/Redis unreachable (`health.controller.ts:33-90`)
- `GET /metrics` — public route but requires `Authorization: Bearer <METRICS_AUTH_TOKEN>` in production; 403 otherwise (`metrics.controller.ts:9-29`)
- Auth: `POST /auth/signup|login|verify-login|refresh|logout`, `/auth/account/*`, `/mfa/*`, `POST /auth/sso/login`, `/admin/sso/*`
- Devices: `POST /devices/register`, `POST /devices/register-public` (public), `POST /devices/recover-credential` (public), `POST /devices/metrics` (device token), `GET /devices…`, `POST /devices/security-report`
- Platform modules at root: `/alerts`, `/ai/*`, `/security/*`, `/network/*`, `/remote-support/*`, `/reports*` (incl. public signed `GET /reports/download/:id/:format`), `/inventory/*`, `/backups/*`, `/kb/*`, `/billing/*`, `/audit/logs`, `/audit/export/*`, `/admin/*`, `/enrollment/tokens*`, `/organizations*`, `/invitations*`, `/dashboard/*`, `/demo/*`, `/retention/*`

### WebSocket (Socket.IO, default root path)
- `wss://techfusion-ai.onrender.com/metrics` — `devices.gateway.ts:16-19`
- `wss://techfusion-ai.onrender.com/network` — `network.gateway.ts:15-18`
- `wss://techfusion-ai.onrender.com/remote` — `remote-support.gateway.ts:26-29`

### Agent artifacts
- Installer (frontend-served): `https://webtechfusion-ai.vercel.app/install-linux.sh` and `/install-linux.sh.sha256` (`apps/web/public/`)
- Binary: `https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.4/techfusion-agent-linux-<arch>` (+ `.sha256`)
- Worker: `apps/worker` consumes `TF_API_URL` (base URL, same host as `NEXT_PUBLIC_API_URL`) — not part of the Vercel/Render browser surface.

---

## 7. Section 5 — Current vs Required Configuration

Provenance: current values are `REPORTED_BY_OPERATOR`; required values are `VERIFIED_THIS_RUN` from code.

### 7.1 Vercel mismatches (all four `NEXT_PUBLIC_*` are wrong for the target host)

| Var | Current (REPORTED) | Required (code-verified) | Verdict |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api-staging.techfusion.ai` | `https://techfusion-ai.onrender.com` | **WRONG host** — REQUIRED fix |
| `NEXT_PUBLIC_WS_URL` | `wss://api-staging.techfusion.ai/ws` | `wss://techfusion-ai.onrender.com` (no `/ws`) | **WRONG host + WRONG path** — REQUIRED fix |
| `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` | `https://api-staging.techfusion.ai/download/agent` | unset, or GitHub release base | **INVALID shape + no such route** — REQUIRED fix |
| `NEXT_PUBLIC_OBSERVABILITY_ENABLED` | `false` | `false` | OK |
| `NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE` | `0.1` | `0.1` | OK |

### 7.2 Render gaps

Present (REPORTED): `DATABASE_URL`, `REDIS_URL`, `GROQ_API_KEY`, `ALLOWED_ORIGINS=https://webtechfusion-ai.vercel.app`, `WS_ALLOWED_ORIGINS=https://webtechfusion-ai.vercel.app`.

Missing / REQUIRED to boot (code-verified): `NODE_ENV=production`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_ENCRYPTION_KEY`, `REPORT_URL_SECRET`, `WEB_APP_URL=https://webtechfusion-ai.vercel.app`, `STRIPE_SECRET_KEY`.

Recommended: `METRICS_AUTH_TOKEN`, `OTEL_ENABLED=false`; add `STRIPE_WEBHOOK_SECRET` + real price IDs only when billing is exercised.

### 7.3 Classification summary
- REQUIRED: 12 backend vars, 1 frontend var, 1 CSP change, 3 Vercel value fixes.
- OPTIONAL: 1 recommended (METRICS_AUTH_TOKEN), 1 recommended (OTEL_ENABLED=false), observability trio, AI tuning vars.
- CONDITIONAL: Stripe webhook + price IDs (billing use), WS_URL/APP_URL/AGENT_DOWNLOAD_URL (fallback-safe).
- UNUSED: `HOST`, `INVITE_BASE_URL`, backend `NEXT_PUBLIC_OBSERVABILITY_*`.
- UNRESOLVED: whether `api-staging.techfusion.ai` is a live alias of the Render service (outside code evidence).

---

## 8. Copy-paste Blocks

### Block A — Render env checklist (name-only, keyed to Section 3)
```bash
# REQUIRED (boot-fatal). Render injects PORT automatically.
NODE_ENV=production
DATABASE_URL=<Postgres URL>
REDIS_URL=<redis[s]:// URL>
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
AI_ENCRYPTION_KEY=<openssl rand -hex 32>
REPORT_URL_SECRET=<openssl rand -hex 32>
ALLOWED_ORIGINS=https://webtechfusion-ai.vercel.app
WS_ALLOWED_ORIGINS=https://webtechfusion-ai.vercel.app
WEB_APP_URL=https://webtechfusion-ai.vercel.app
STRIPE_SECRET_KEY=<real Stripe secret key>
# RECOMMENDED
METRICS_AUTH_TOKEN=<openssl rand -hex 32>
OTEL_ENABLED=false
# OPTIONAL (already set / AI providers)
GROQ_API_KEY=<set>
```

### Block B — Vercel env checklist (name-only, keyed to Section 4)
```bash
NEXT_PUBLIC_API_URL=https://techfusion-ai.onrender.com
NEXT_PUBLIC_WS_URL=wss://techfusion-ai.onrender.com        # no /ws suffix
# NEXT_PUBLIC_AGENT_DOWNLOAD_URL -> leave UNSET (built-in GitHub release default)
# NEXT_PUBLIC_APP_URL          -> optional (defaults to window.location.origin)
NEXT_PUBLIC_OBSERVABILITY_ENABLED=false
NEXT_PUBLIC_OBSERVABILITY_SAMPLE_RATE=0.1
```

### Block C — Origins to set on Render (exact string, no trailing slash, no quotes)
```bash
ALLOWED_ORIGINS=https://webtechfusion-ai.vercel.app
WS_ALLOWED_ORIGINS=https://webtechfusion-ai.vercel.app
WEB_APP_URL=https://webtechfusion-ai.vercel.app
```

### Block D — Endpoint verification
```bash
BASE=https://techfusion-ai.onrender.com
curl -sS -o /dev/null -w "health %{http_code}\n"     "$BASE/health"
curl -sS -o /dev/null -w "health/live %{http_code}\n" "$BASE/health/live"
curl -sS -o /dev/null -w "health/ready %{http_code}\n" "$BASE/health/ready"
curl -sS -o /dev/null -w "metrics %{http_code}\n"   -H "Authorization: Bearer $METRICS_AUTH_TOKEN" "$BASE/metrics"
# Socket.IO namespaces (wss handshake path check):
#   wss://techfusion-ai.onrender.com/metrics|network|remote
# Web origin check (from a browser tab on the Vercel app):
curl -sS -o /dev/null -w "installer %{http_code}\n" https://webtechfusion-ai.vercel.app/install-linux.sh
```

### Block E — Agent installer invocation (uses the frontend + certified release)
```bash
curl -fsSL https://webtechfusion-ai.vercel.app/install-linux.sh -o install-linux.sh
bash install-linux.sh --api https://techfusion-ai.onrender.com \
  --release https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.4
```

---

## 9. Machine-readable Summary

```json
{
  "task": "TF-DEPLOYMENT-CONNECTION-AUDIT-01",
  "status": "COMPLETE_READONLY",
  "date": "2026-08-14",
  "targets": {
    "backend": "https://techfusion-ai.onrender.com",
    "frontend": "https://webtechfusion-ai.vercel.app"
  },
  "architecture_verdict": "CONNECTION_CORRECT",
  "port_binding": "PORT || 3001, all-interfaces (main.ts:51-52)",
  "global_prefix": "none",
  "ws_paths": { "metrics": "/metrics", "network": "/network", "remote": "/remote", "prefix": "none" },
  "agent_download": { "kind": "github_release_base", "tag": "v1.0.0-agent-beta.4", "gateway_route": false },
  "required_backend_env": ["NODE_ENV","DATABASE_URL","REDIS_URL","JWT_SECRET","JWT_REFRESH_SECRET","AI_ENCRYPTION_KEY","REPORT_URL_SECRET","ALLOWED_ORIGINS","WS_ALLOWED_ORIGINS","WEB_APP_URL","STRIPE_SECRET_KEY","PORT"],
  "recommended_backend_env": ["METRICS_AUTH_TOKEN","OTEL_ENABLED=false"],
  "required_frontend_env": ["NEXT_PUBLIC_API_URL"],
  "recommended_frontend_env": ["NEXT_PUBLIC_WS_URL","NEXT_PUBLIC_OBSERVABILITY_ENABLED=false"],
  "mismatches": [
    { "var": "NEXT_PUBLIC_API_URL", "current": "https://api-staging.techfusion.ai", "required": "https://techfusion-ai.onrender.com", "tag": "REQUIRED" },
    { "var": "NEXT_PUBLIC_WS_URL", "current": "wss://api-staging.techfusion.ai/ws", "required": "wss://techfusion-ai.onrender.com", "tag": "REQUIRED" },
    { "var": "NEXT_PUBLIC_AGENT_DOWNLOAD_URL", "current": "https://api-staging.techfusion.ai/download/agent", "required": "unset-or-github-release-base", "tag": "REQUIRED" }
  ],
  "code_changes_required": [
    { "file": "apps/web/next.config.js", "issue": "connect-src blocks HTTPS REST to Render origin", "tag": "REQUIRED" }
  ],
  "verification": "Block D commands",
  "provenance": { "code": "VERIFIED_THIS_RUN", "platform_values": "REPORTED_BY_OPERATOR", "dns_alias": "UNVERIFIED" }
}
```

---

## 10. Caveats

- Current platform env **values** were supplied by the operator and not re-fetched (no platform credentials in scope). Names required by code are exhaustive per source grep (`VERIFIED_THIS_RUN`).
- `api-staging.techfusion.ai` vs `techfusion-ai.onrender.com` host resolution is `UNVERIFIED` — confirm with the platform owner before running Block D against a real host.
- `REPORT_STORAGE_DIR` defaults to local disk (`./report-storage`); on Render the filesystem is ephemeral, so stored reports/signed URLs do not survive redeploys. Flagged, not a boot blocker.
- The GitHub release default is live (verified 6 assets); the exact asset filenames/sha256s were not byte-verified from the remote in this read-only pass.

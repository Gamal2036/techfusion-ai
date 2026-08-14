# TF-RENDER-DEPLOYMENT-AUDIT-01 — Render `apps/api-gateway` Deployment Audit

- **Task:** TF-RENDER-DEPLOYMENT-AUDIT-01
- **Mode:** READ-ONLY INVESTIGATION (no source, package.json, lockfile, Dockerfile, workflow, or deployment config modified)
- **Date:** 2026-08-14
- **Status:** COMPLETE — report only; no fix applied
- **Evidence markers:** `VERIFIED_THIS_RUN` (command executed against this working tree during the audit), `REPORTED_BY_OPERATOR` (Render dashboard values supplied with the task, not re-fetched — no platform credentials in scope), `INFERRED_FROM_CODE`, `UNVERIFIED`.
- **Working tree:** clean of tracked changes at audit start and end (`git status --short` shows only the untracked `reports/deployment/` directory). `dist/`, `*.tsbuildinfo`, `.turbo/`, and `.env` regenerated during verification are all git-ignored and were left in their regenerated state.
- **Head commit inspected:** `bc95c97f172809af4e3bf728c6fc21893b2c06c7` (`fix(deps): sync lockfile after adding express`, branch `main`).

---

## 1. Executive summary

The failure is **not** a build problem. The Render build command, as reported, correctly produces the artifact at `apps/api-gateway/dist/main.js` (reproduced `VERIFIED_THIS_RUN` on a fresh-clone-equivalent build). The failure is a **start-command/cwd mismatch**:

- Render's runtime log line `Running 'node dist/main.js'` is Render's own announcement of the **exact Start Command it executes** (external Render logs confirm the format `==> Running '<command>'`). pnpm/npm lifecycle output has a different format (`> pkg@version start <cwd>` then `> node dist/main.js`), so the line is not pnpm.
- Node's error `Cannot find module '/opt/render/project/src/dist/main.js'` is Node's absolute resolution of `./dist/main.js` against the **process cwd = `/opt/render/project/src`** — the repository root (`Root Directory` is empty).
- A bare `node dist/main.js` run from the repository root can **never** find the artifact, because the artifact lives at `apps/api-gateway/dist/main.js`.
- The pnpm filter command `npx pnpm@9.15.9 --filter @techfusion/api-gateway start` **cannot** produce that error path: pnpm executes package scripts with cwd = the package directory (`VERIFIED_THIS_RUN` twice). If it had run, Node would have resolved `/opt/render/project/src/apps/api-gateway/dist/main.js` and the log would have shown the pnpm header `> @techfusion/api-gateway@0.1.0 start /opt/render/project/src/apps/api-gateway`.
- **Therefore the effective Start Command that ran was `node dist/main.js`, and it does not match the operator-reported displayed command.** That mismatch is a stale deployment snapshot, an unsaved/dashboard-state mismatch, or a different Render service — resolved only by the Section 6 dashboard checklist (the repository contains **zero** Render configuration files, so nothing in the repo can override or explain the dashboard).

**Recommended fix (operator-only, dashboard):** keep the service Native Node, Root Directory empty, keep the reported build command, and set the Start Command to `node apps/api-gateway/dist/main.js` (or the pnpm filter start, equally valid), then redeploy. No repository code changes are required.

---

## 2. Files inspected

### Repository deployment configuration (complete sweep)
| File | Lines | Content | Active? | Can override Render dashboard? |
|---|---|---|---|---|
| `render.yaml` / `render.yml` | — | **Absent** (glob `**/render.{yaml,yml}` → no files) | n/a | No Blueprint in repo today |
| `Procfile` | — | **Absent** | n/a | n/a |
| `nixpacks.toml` | — | **Absent** | n/a | n/a |
| `railway.json` / `fly.toml` / `vercel.json` | — | **Absent** | n/a | n/a |
| `.render/*` | — | Directory **does not exist** | n/a | n/a |
| `.nvmrc` / `.node-version` | — | **Absent** | n/a | Render uses its default Node (or `engines`) |
| `nest-cli.json` | — | **Absent** (build is plain `tsc`, not `nest build`) | n/a | n/a |
| `apps/api-gateway/Dockerfile` | 1-38 | Multi-stage pnpm workspace Dockerfile; runner `WORKDIR /app/apps/api-gateway` (line 36), `CMD ["node", "dist/main.js"]` (line 38) | Active for Docker builds (CI `docker-build` job + `infra/docker/docker-compose.yml`) | Only if the Render service is **Docker** type. The observed error path proves it is **Native Node** (see §4) — so NOT active here |
| `Dockerfile.web` | 1-29 | Root web Dockerfile, `CMD ["node", "apps/web/server.js"]` (line 29) | Active only for a root-Docker-type web deploy | Would only apply if service is Docker type at repo root — not the case (error path) |
| `apps/worker/Dockerfile` | 41 | `CMD ["node", "dist/main.js"]` | Docker-only | No |
| `.github/workflows/ci.yml` | 55-123, 318-437 | `ci-api` runs `pnpm build` with `working-directory: apps/api-gateway` (lines 121-123); `docker-build` builds the api-gateway image (lines 388-391) | Active CI/CD, **not** Render | No |
| `.github/workflows/cd-staging.yml` / `cd-production.yml` | 1-71 each | Helm + GHCR deploys to k8s (`techfusion-staging` / `techfusion-production`) | Active, **not** Render | No |
| `package.json` (root) | 4-12, 23 | Scripts `build`=`turbo run build` (line 5); `packageManager: pnpm@9.15.9` (line 23); no `start` script | Root scripts only | No |
| `pnpm-workspace.yaml` | 1-3 | `packages: ["apps/*", "packages/*"]` | Active (workspace) | No |
| `turbo.json` | 4-7 | `build` outputs `.next/**`, `dist/**`, `target/**` (caching) | Active only via root `pnpm build` | No (Render build command never invokes turbo) |
| `apps/api-gateway/package.json` | 6, 8, 12, 13 | `build`=`tsc`; `start`=`node dist/main.js`; `clean`=`rm -rf dist .turbo`; `postinstall`=`prisma generate` | Active (package scripts) | No |
| `apps/worker/package.json` | 10 | `start`=`node dist/main.js` | Active (worker package) | No |
| `apps/web/package.json` | — | `start`=`next start` | Active (web package) | No |

### Search-string sweep results
| String | Locations | Significance |
|---|---|---|
| `node dist/main.js` / `dist/main.js` | `apps/api-gateway/package.json:8`; `apps/worker/package.json:10`; `apps/api-gateway/Dockerfile:38`; `apps/worker/Dockerfile:41`; historical docs (`TF_V1_*`, `docs/v1/...`, `docs/AH-2/...`) | Only package scripts/Dockerfiles. No repo file instructs Render to run `node dist/main.js` from the repo root |
| `pnpm --filter @techfusion/api-gateway` | `apps/api-gateway/Dockerfile:22`; historical docs | Build-time usage only |
| `startCommand` / `buildCommand` / `rootDir` / `workingDirectory` | `rootDir` in jest/tsconfig files (test/build scope only); `workingDirectory` in `.github/workflows/ci.yml` | No Render influence |
| `process.chdir` / `cwd` | **None** | No code changes cwd |
| `render.com` / `RENDER` / `WEB_SERVICE` | Only in prior audit reports `reports/deployment/TF_DEPLOYMENT_CONNECTION_AUDIT_01.md` (informative, historical) | No active Render config in repo |

**Conclusion of §1 sweep:** nothing inside the repository can control, influence, or override the Render build/start process. All effective Render behavior is dashboard state (service settings snapshots), except a Docker-type service consuming `apps/api-gateway/Dockerfile` — which the error path rules out.

---

## 3. Current deployment architecture

- **Repo:** `Gamal2036/techfusion-ai`, branch `main` (REPORTED_BY_OPERATOR).
- **Target:** NestJS API Gateway (`@techfusion/api-gateway`) in `apps/api-gateway`, workspace member (`pnpm-workspace.yaml:1-3`; `pnpm-lock.yaml:27`).
- **Render service type (inferred):** Native Node (Nixpacks). Evidence: runtime error path `/opt/render/project/src/dist/main.js` is the native clone/cwd path; a Docker runtime using `apps/api-gateway/Dockerfile` would fail at `/app/dist/main.js` (WORKDIR line 36); a root Docker type would use `Dockerfile.web`. `INFERRED_FROM_CODE` + error path.
- **Root Directory:** empty → build and start both run with cwd `/opt/render/project/src` (REPORTED_BY_OPERATOR).
- **Build Command (reported):** `npx pnpm@9.15.9 install --frozen-lockfile && npx pnpm@9.15.9 --filter @techfusion/api-gateway exec prisma generate && npx pnpm@9.15.9 --filter @techfusion/api-gateway build`.
- **Effective Start Command (observed):** `node dist/main.js` (from Render log `Running 'node dist/main.js'`).
- **Failure:** `Error: Cannot find module '/opt/render/project/src/dist/main.js'`, `code: MODULE_NOT_FOUND`.

---

## 4. Build execution trace (Section 2 of brief)

Traced and executed locally (`VERIFIED_THIS_RUN`, same pnpm `9.15.9`, Node `v22.22.3`):

```
Render Build Command
→ npx pnpm@9.15.9 install --frozen-lockfile        (workspace install; postinstall runs prisma generate in package dir)
→ npx pnpm@9.15.9 --filter @techfusion/api-gateway exec prisma generate
→ npx pnpm@9.15.9 --filter @techfusion/api-gateway build
   → workspace root found via pnpm-workspace.yaml
   → package selected: @techfusion/api-gateway (unique; lockfile apps/api-gateway: line 27)
   → script "build" = "tsc"
   → cwd for script = <repo>/apps/api-gateway   [VERIFIED: "pnpm --filter @techfusion/api-gateway exec pwd" → /home/ge/techfusion-ai/apps/api-gateway]
   → tsc reads tsconfig.json (outDir "dist", rootDir "src", include src/**/*)
   → emits <repo>/apps/api-gateway/dist/main.js
```

Direct answers to the brief's questions:

1. **Which package pnpm selects:** `@techfusion/api-gateway` (single match; workspace membership `pnpm-workspace.yaml:1-3` + `pnpm-lock.yaml:27`).
2. **Which working directory pnpm uses:** the package directory for the child script (`apps/api-gateway`); the invoking shell stays at the repo root.
3. **Which exact script:** `build` → `tsc` (`apps/api-gateway/package.json:6`).
4. **Which command it expands to:** `tsc`.
5. **Which path Node resolves at start:** only relevant at runtime — `node dist/main.js` (`apps/api-gateway/package.json:8`) with cwd = package dir → `apps/api-gateway/dist/main.js`.
6. **Lifecycle/cwd alterations:** `postinstall` (`prisma generate`, package.json:13) runs only during install and does not persist a cwd change; no `process.chdir` anywhere in the repo; `npx` does not change cwd; the root package has **no `start` script**, so the root cannot intercept a `--filter @techfusion/api-gateway start`.
7. **Can the root package intercept start:** No — `--filter` selects exactly one package and pnpm runs its script in that package's directory.

Local reproduction (VERIFIED_THIS_RUN):
- `pnpm --filter @techfusion/api-gateway exec node -e "console.log('CWD='+process.cwd())"` → `CWD=/home/ge/techfusion-ai/apps/api-gateway`.
- Fresh build (after removing git-ignored `dist/`, `tsconfig.tsbuildinfo`, `tsconfig.test.tsbuildinfo` to emulate a Render fresh clone): `BUILD_EXIT=0`, artifact created at `apps/api-gateway/dist/main.js` (3040 bytes).

---

## 5. Start execution trace (Section 2 of brief, continued)

```
Reported Start Command (would-be)
→ npx pnpm@9.15.9 --filter @techfusion/api-gateway start
→ pnpm → workspace root → package @techfusion/api-gateway
→ script "start" = "node dist/main.js"
→ cwd = /opt/render/project/src/apps/api-gateway
→ node /opt/render/project/src/apps/api-gateway/dist/main.js   → would START correctly
```

Observed reality (VERIFIED_THIS_RUN locally for the pnpm side):
```
> @techfusion/api-gateway@0.1.0 start /home/ge/techfusion-ai/apps/api-gateway
> node dist/main.js
[Nest] ... [Bootstrap] API Gateway listening on port 3001
```
The pnpm lifecycle header **prints the absolute script cwd**. On Render, had pnpm run, the header would have been `> @techfusion/api-gateway@0.1.0 start /opt/render/project/src/apps/api-gateway` and Nest would have booted.

Observed Render error:
```
Running 'node dist/main.js'
Error: Cannot find module '/opt/render/project/src/dist/main.js'
code: MODULE_NOT_FOUND
```
This is the trace of `node dist/main.js` with cwd `/opt/render/project/src` — the **repository root**, not the package directory. It is **inconsistent with the pnpm filter command**.

---

## 6. TypeScript / Nest build-output trace (Section 3 of brief)

Config chain (all `VERIFIED_THIS_RUN` reads):
- `apps/api-gateway/tsconfig.json`: `outDir: "dist"` (line 11), `rootDir: "src"` (line 12), `include: ["src/**/*"]` (line 25), `incremental: true` (line 14), `module: commonjs` (line 3). No `nest-cli.json` and no `tsconfig.build.json` exist, so `build` = plain `tsc` (`apps/api-gateway/package.json:6`).
- Root `tsconfig.json` / `tsconfig.base.json` are not consumed by the api-gateway build (package has its own tsconfig; no `extends` in `apps/api-gateway/tsconfig.json`).

**Exact expected build artifact:** `apps/api-gateway/src/main.ts` → **`apps/api-gateway/dist/main.js`**. Not root `dist/main.js`, not `dist/apps/api-gateway/main.js`.

`apps/api-gateway/dist` status:
| Question | Answer | Evidence |
|---|---|---|
| Generated by current build command? | **Yes** (fresh-clone repro, exit 0, artifact present) | VERIFIED_THIS_RUN |
| Committed to Git? | **No** — 0 tracked files under any `/dist/` | `git ls-files` (VERIFIED_THIS_RUN) |
| Ignored by Git? | **Yes** | `.gitignore:2` `dist/`, `.gitignore:13` `*.tsbuildinfo` |
| Copied by Docker? | Yes (builder→runner `COPY dist`) | `apps/api-gateway/Dockerfile:35` |
| Deleted by clean? | Yes | `apps/api-gateway/package.json:12` `rm -rf dist .turbo` |
| Affected by Turbo caching? | Only via root `pnpm build` (turbo) — Render build command uses `pnpm --filter ... build`, which does **not** invoke turbo | `turbo.json:4-7`; build command |

**Local stale-artifact trap (VERIFIED_THIS_RUN):** with `dist/` deleted but the git-ignored `apps/api-gateway/tsconfig.tsbuildinfo` still present, `pnpm --filter @techfusion/api-gateway build` exits **0 and emits nothing** (`incremental` short-circuit). This is a **local-only** trap: Render performs a fresh clone per deploy, so `.tsbuildinfo` never exists there and a full emit always occurs. Any local "dist deleted, build says success, then start fails" experiment is explained by this; it does **not** explain the Render failure (the Render error path is the root, not `apps/api-gateway/dist`).

---

## 7. Render build-artifact analysis (Section 4 of brief)

**Q: Does the reported build command guarantee `apps/api-gateway/dist/main.js` exists after build?** **Yes.**
- `build` invokes `tsc` (`apps/api-gateway/package.json:6`) with `outDir=dist`/`rootDir=src` (`tsconfig.json:11-12`).
- Build output is not removed afterward (no `prebuild`/`postbuild` cleanup scripts exist; `clean` is manual only).
- `prisma generate` runs as a child process in the package dir and does **not** change the invoking shell's cwd; the subsequent `build` step starts from the repo root again and emits into `apps/api-gateway/dist`.
- Render (Native Node, Root Directory empty) clones to `/opt/render/project/src` and runs the build there; the artifact lands at `/opt/render/project/src/apps/api-gateway/dist/main.js` and **persists into the runtime phase** (native services keep the build filesystem).
- Paths are identical on Linux/CI (no Windows casing concern; exact-lowercase `dist/main.js`).
- Case sensitivity: no issue — every path is lowercase and consistent.
- Free-tier native environment: preserves build output; not a factor in this failure.
- Docker auto-selection: Render only builds a Dockerfile when the service is Docker type. A Docker-type service at repo root would pick `Dockerfile.web`; a Docker type with this repo never yields the observed error path (see §3). **Ruled out.**
- Stale build artifacts: irrelevant on Render (fresh clone).

**One-time diagnostic Build Command (fails if artifact absent; prints no secrets):**
```bash
npx pnpm@9.15.9 install --frozen-lockfile && npx pnpm@9.15.9 --filter @techfusion/api-gateway exec prisma generate && npx pnpm@9.15.9 --filter @techfusion/api-gateway build && printf 'PWD=%s\n' "$(pwd)" && printf 'NODE=%s\n' "$(node -v)" && printf 'PNPM=%s\n' "$(npx pnpm@9.15.9 -v)" && printf 'PKG_DIR=%s\n' "$(npx pnpm@9.15.9 --filter @techfusion/api-gateway exec pwd)" && find . -type f -name main.js -not -path '*/node_modules/*' && ls -la apps/api-gateway/dist && realpath apps/api-gateway/dist/main.js && test -f apps/api-gateway/dist/main.js
```
The trailing `test -f apps/api-gateway/dist/main.js` fails the deploy if the artifact is missing.

---

## 8. Render start-command analysis (Section 5 of brief)

**Q: Why does the log print `Running 'node dist/main.js'` when the dashboard is said to display the pnpm filter command?**

Determination: **Render printing the Start Command it executes.** External Render logs confirm the format — a Render community thread shows `==> Running 'npm run start'` immediately followed by the npm lifecycle lines `> cb-api@1.0.0 start` / `> node dist/index.js` (https://community.render.com/t/express-node-web-service-deployment-fails/24948/5), and a Stack Overflow thread shows `==> Running 'npm run start:prod'` (https://stackoverflow.com/questions/79008250/). Render docs describe the Start Command as "the command that Render runs to start your built service in a newly deployed instance" (https://render.com/docs/deploys).

Exclusions, with evidence:
- **Not pnpm/npm lifecycle output:** pnpm prints `> <pkg>@<ver> start <absolute cwd>` then `> node dist/main.js` (VERIFIED_THIS_RUN, §5). No `Running '...'` text.
- **Not a repository file:** no repo file contains `node dist/main.js` as a root-run instruction (§2 sweep).
- **Not a Blueprint-controlled service:** no `render.yaml`/`render.yml` exists anywhere in the repo (§2).
- **Not an unresolved inconsistency in pnpm cwd behavior:** pnpm demonstrably runs package scripts in the package directory (VERIFIED_THIS_RUN twice). If the pnpm command had executed, the error path would be `/opt/render/project/src/apps/api-gateway/dist/main.js`, not the root.

**Q: How could the process have cwd `/opt/render/project/src` despite pnpm filtering?** It **cannot** — and the error path is the proof that pnpm did not run. The absolute path `/opt/render/project/src/dist/main.js` is Node's resolution of `./dist/main.js` against a process whose cwd is `/opt/render/project/src`. That is only possible when a **bare `node dist/main.js` is executed from the repository root** (Root Directory empty). The remaining explanation for the dashboard-vs-log mismatch is therefore **stale/different dashboard state** — either the `Running 'node dist/main.js'` line belongs to an older deployment snapshot (the log explorer retains historical logs), or the Logs page and the Settings page belong to different services. Both are verified only via the Section 9 checklist.

---

## 9. Service identity and stale configuration (Section 6 of brief)

**Repository evidence for multiple services:** the repo defines production/staging deployments for GHCR+k8s (`.github/workflows/cd-*.yml`) and Docker images (`ci.yml` `docker-build`), plus `infra/docker/docker-compose.yml` — none of which are Render. There is **no Render blueprint in the repo**, so any Render service(s) are dashboard-created. Multiple Render web services on the same repo are plausible (the previous audit report names `https://techfusion-ai.onrender.com` as the target host; `api-staging.techfusion.ai` alias status is UNVERIFIED).

**Operator checklist (Render dashboard):**
1. Service ID and Service Name (Settings → Service Details).
2. Repository: must be `Gamal2036/techfusion-ai`.
3. Branch: must be `main`.
4. Deploy commit SHA (Events/Deploys) — should match `git log -1` of what you expect (`main` HEAD at deploy time).
5. Service type badge: **Native Node** (not Docker).
6. Root Directory: empty.
7. Build Command: the pnpm chain (§3).
8. Start Command: what is currently in the field — compare against the `Running '...'` line of the failing deploy.
9. Auto Deploy: enabled/disabled.
10. Blueprint sync: **Off / no blueprint file attached** (must be OFF; repo has no `render.yaml`).
11. Latest deployment timestamp + trigger (manual / push / blueprint sync / CLI).
12. Environment group inheritance: confirm the failing service's env group is the one with `DATABASE_URL`, `REDIS_URL`, secrets (name-only check; never read values).
13. Health Check Path (default `/`) — recommend `/health` (public, 200 at `health.controller.ts:11-20`).

**How to prove the Logs page belongs to the same service whose Settings were edited:** match (a) Service name/ID in the URL and page header, (b) the service-type badge and repository URL shown on both pages, (c) the failing deploy's **commit SHA** and **timestamp** in Events against the log timestamps on the Logs page, (d) the deployment URL and unique env vars of that service, and (e) re-open the deploy-specific logs via Events → click the failing **Deploy** entry (per Render docs, that is the per-deploy log view). A log line timestamped before the Settings edit (or from a different deploy) proves staleness; a different service name/ID proves a wrong-service log.

---

## 10. Deployment strategies (Section 7 of brief)

### Strategy A — Repository-root native service
| Item | Verdict |
|---|---|
| Compatibility | **COMPATIBLE** — verified end-to-end locally (build emits artifact; `node apps/api-gateway/dist/main.js` from root resolves it; pnpm filter start also works) |
| Required configuration | Native Node; Root Directory **empty**; Build Command = current pnpm chain; Start Command = `node apps/api-gateway/dist/main.js` (or `npx pnpm@9.15.9 --filter @techfusion/api-gateway start`); Health Check Path `/health` |
| Advantages | No code changes; artifact path directly proven; minimal moving parts; matches existing CI pattern (`ci.yml` builds with cwd `apps/api-gateway`) |
| Risks | Runtime env vars (name-only: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `AI_ENCRYPTION_KEY`, `REPORT_URL_SECRET`, `ALLOWED_ORIGINS`, `WS_ALLOWED_ORIGINS`, `WEB_APP_URL`, `STRIPE_SECRET_KEY`; recommended `METRICS_AUTH_TOKEN`, `OTEL_ENABLED=false`) must be present or boot fails at `env.validation.ts` (`main.ts:18`) |
| Code changes | None |

### Strategy B — `apps/api-gateway` as Render Root Directory
| Item | Verdict |
|---|---|
| Compatibility | **NOT RECOMMENDED; NOT FULLY PROVEN.** pnpm resolves the workspace root by walking up from the invocation directory, and a workspace install from a member directory installs the whole workspace — so lockfile discovery, shared `packages/*`, and the Prisma schema (`prisma/schema.prisma` relative to the package dir) would in principle work. However, this was **not** verified against Render's Nixpacks detection from a subdirectory, and it changes the deploy context for the whole repo. Per the task constraint ("do not recommend Strategy B unless workspace dependencies are proven to resolve correctly"), it is not recommended on this evidence |
| Required configuration | Root Directory `apps/api-gateway`; Build Command `npx pnpm@9.15.9 install --frozen-lockfile && npx pnpm@9.15.9 exec prisma generate && npx pnpm@9.15.9 build`; Start Command `node dist/main.js` |
| Advantages | Start command becomes the conventional `node dist/main.js` |
| Risks | Nonstandard monorepo posture on Render; Nixpacks detection and environment variables can behave differently at subdirectory root; introduces a second, unproven deployment path |
| Code changes | None |

### Strategy C — Docker deployment
| Item | Verdict |
|---|---|
| Compatibility | **COMPATIBLE** — `apps/api-gateway/Dockerfile` is a multi-stage production image (deps→builder→runner), runs `prisma generate` + `build` in the builder (line 22), copies `dist` (line 35), fixes `WORKDIR /app/apps/api-gateway` (line 36) and `CMD ["node", "dist/main.js"]` (line 38). Certified PASS in the V1 Docker packaging gate (`docs/v1/V1-STAGE-01C-R4_DOCKER_PACKAGING_GATE_REPORT.md:241`). It removes workspace/cwd ambiguity entirely (fixed WORKDIR + CMD) |
| Required configuration | Render service type **Docker**; Dockerfile path `apps/api-gateway/Dockerfile` (context = repo root); build/start commands ignored by Render in Docker mode |
| Advantages | Deterministic; no dashboard start-command fragility; matches the already-certified image |
| Risks | Dockerfile `deps` stage copies manifests for `packages/{config,types,ui,utils}` + api-gateway only (lines 7-11); must be re-verified that `pnpm install --frozen-lockfile` succeeds in Render's Docker pipeline given the lockfile also contains `apps/web` and `apps/worker` (the CI docker gate passed, but Render's Docker environment should be re-validated). Image build time and free-tier container limits apply |
| Code changes | None |

### Recommendation
**Strategy A.** It is fully verified from the repository, requires no code changes, keeps the already-proven build command, and only needs an operator Start Command change plus env verification.

---

## 11. Root-cause ranking (Section 8 of brief)

| Rank | Cause | Evidence |
|---|---|---|
| **CONFIRMED ROOT CAUSE** | The service's effective **Start Command is `node dist/main.js` executed from `/opt/render/project/src`** (Root Directory empty), while the build artifact lives at `apps/api-gateway/dist/main.js`. Render's `Running '...'` line is Render announcing that exact command; the MODULE_NOT_FOUND absolute path proves root cwd | Render log line + error path (REPORTED_BY_OPERATOR); log-format corroboration (external Render threads, §8); artifact location VERIFIED_THIS_RUN |
| **HIGH-PROBABILITY CONTRIBUTOR** | **Stale or mismatched dashboard state**: the executed Start Command differs from the operator-reported displayed pnpm command. Either the failing deploy predates the dashboard edit (historical log) or the edit was not saved/deployed | §8/§9 analysis; no repo file can produce the observed line |
| POSSIBLE CONTRIBUTOR | **Different Render service**: Logs page and Settings page may belong to different web services on the same repo | §9; only dashboard verification resolves |
| POSSIBLE CONTRIBUTOR | **Historical Blueprint-created service** whose config persisted after the blueprint file was removed from the repo | No `render.yaml` now (VERIFIED); past state UNVERIFIED |
| RULED OUT | **Wrong build output / missing generated artifact** | Fresh-clone build reproduces `apps/api-gateway/dist/main.js` (VERIFIED_THIS_RUN) |
| RULED OUT | **pnpm cwd behavior** | `pnpm --filter … exec pwd` → package dir; pnpm start header prints package cwd (VERIFIED_THIS_RUN) |
| RULED OUT | **Package script behavior / root intercepting start** | Filter selects unique package; root has no `start` script; pnpm runs in package dir |
| RULED OUT | **Docker/native mismatch** | Error path is the native `/opt/render/project/src/...` path; Docker runtime would use `/app` (WORKDIR) or `Dockerfile.web` |
| RULED OUT | **Git-ignored output assumptions** | `dist/`/`*.tsbuildinfo` ignored, but fresh clones build cleanly; ignoring does not affect Render |
| RULED OUT | **Turbo caching** | Render build command never invokes turbo (root `turbo run build` only via `pnpm build`) |
| RULED OUT | **Case sensitivity / platform path difference** | All paths lowercase, Linux-identical |
| RULED OUT | **Cached deployment configuration** | Caching cannot change a start-command path; only stale deploy snapshots can (covered above) |

---

## 12. Diagnostic commands

### One-time diagnostic Build Command (replace Build Command field temporarily)
```bash
npx pnpm@9.15.9 install --frozen-lockfile && npx pnpm@9.15.9 --filter @techfusion/api-gateway exec prisma generate && npx pnpm@9.15.9 --filter @techfusion/api-gateway build && printf 'PWD=%s\n' "$(pwd)" && printf 'NODE=%s\n' "$(node -v)" && printf 'PNPM=%s\n' "$(npx pnpm@9.15.9 -v)" && printf 'PKG_DIR=%s\n' "$(npx pnpm@9.15.9 --filter @techfusion/api-gateway exec pwd)" && find . -type f -name main.js -not -path '*/node_modules/*' && ls -la apps/api-gateway/dist && realpath apps/api-gateway/dist/main.js && test -f apps/api-gateway/dist/main.js
```

### One-time diagnostic Start Command (replace Start Command field temporarily)
```bash
pwd && node -e "try { console.log('NODE_CWD='+process.cwd()); console.log('RESOLVED='+require.resolve('./apps/api-gateway/dist/main.js')); } catch (e) { console.error('MISSING='+e.message); process.exit(1); }" && npx pnpm@9.15.9 --filter @techfusion/api-gateway start
```
This prints the runtime cwd, resolves the artifact (fails with exit 1 if absent), then boots via the repo-canonical pnpm command.

### Operator-only dashboard checks
Run the Section 9 checklist (service identity + config snapshot + Blueprint OFF + Health Check Path `/health`).

---

## 13. Comparison of deployment strategies

See Section 10 (table). Summary: **A (recommended)** verified and minimal; **B** viable in principle but unproven for Render's subdirectory detection and not recommended; **C** production-ready Dockerfile but introduces Docker-pipeline risk and removes the pnpm build path already proven on the dashboard.

---

## 14. Recommended final configuration

- **Service type:** Native Node
- **Root Directory:** (empty)
- **Build Command:** `npx pnpm@9.15.9 install --frozen-lockfile && npx pnpm@9.15.9 --filter @techfusion/api-gateway exec prisma generate && npx pnpm@9.15.9 --filter @techfusion/api-gateway build`
- **Start Command:** `node apps/api-gateway/dist/main.js` (alternate, equally valid: `npx pnpm@9.15.9 --filter @techfusion/api-gateway start`)
- **Health Check Path:** `/health`
- **Auto Deploy:** on `main` pushes (as intended)
- **Blueprint sync:** OFF (no blueprint in repo)

---

## 15. Code changes required

**None.** No repository source, package, Dockerfile, workflow, or deployment file needs to change for this deployment to succeed. All required changes are operator-only (dashboard). (Deployment-readiness env vars and the previously-flagged `apps/web/next.config.js` CSP issue are separate, already-documented items in `reports/deployment/TF_DEPLOYMENT_CONNECTION_AUDIT_01.md`.)

---

## 16. Operator-only changes required

1. Verify service identity via the Section 9 checklist (confirm the Logs page and Settings page are the same service; check deploy commit SHA and timestamps).
2. Confirm the failing deploy's commit SHA corresponds to the intended `main` HEAD.
3. Set Start Command to `node apps/api-gateway/dist/main.js` (or the pnpm filter start).
4. Confirm Build Command is the §3 chain (it is reported correct).
5. Confirm Blueprint sync is OFF.
6. Set Health Check Path to `/health`.
7. Ensure the boot-fatal env vars are present on the service/group (names only — see §10, Strategy A risks; values never printed).
8. Trigger a fresh deploy (manual) and watch the new deploy's logs, not historical ones.

---

## 17. Verification procedure

1. Fresh deploy succeeds (build phase green).
2. Build logs show `apps/api-gateway/dist/main.js` in the diagnostic `find`/`realpath` output (if diagnostic build used) or simply a successful build phase.
3. Runtime log shows the **new** start command (`Running 'node apps/api-gateway/dist/main.js'` or the pnpm header `> @techfusion/api-gateway@0.1.0 start /opt/render/project/src/apps/api-gateway`), then Nest boot logs, then `API Gateway listening on port ...`.
4. `curl -sS -o /dev/null -w "%{http_code}\n" https://<service-url>/health` → 200.
5. `curl -sS https://<service-url>/health/ready` → 200 (needs Postgres + Redis reachable) or 503 `degraded` with named failing checks (diagnostic).
6. Render dashboard shows "Live" and no `MODULE_NOT_FOUND`.
7. Env validation passes (`[ENV VALIDATION] All required environment variables validated successfully.`).

---

## 18. Rollback procedure

- If a fresh deploy regresses: in Render Events, **deploy the last-known-good deployment** (Render keeps prior deploys re-deployable) or revert the Start Command field to the previous value and redeploy.
- Keep the old failed deploy's Start Command value recorded before editing, so it can be restored identically.
- If moving to Strategy C (Docker), retain the Native Node configuration in writing; to fall back, re-create the Native Node service with the §14 values.
- No repository rollback needed (no code changed).

---

## 19. Unresolved evidence

| Item | Status |
|---|---|
| The **actual current** Start Command string stored in the Render dashboard | UNVERIFIED — requires dashboard access (operator) |
| Whether `Running 'node dist/main.js'` belongs to the latest deploy or a historical one | UNVERIFIED — correlate timestamps/SHA in dashboard |
| Whether the failing service is the only Render web service on this repo (and whether `api-staging.techfusion.ai` is an alias of it) | UNVERIFIED — prior audit also flagged this |
| Render's default Start Command when the field is empty (relevant if the field turns out empty) | UNVERIFIED — dashboard check first; `node dist/main.js` does not match Render's documented `npm start` default, so an empty field is unlikely the cause |
| Whether `pnpm install --frozen-lockfile` succeeds inside Render's Docker pipeline for Strategy C | UNVERIFIED — CI docker gate passed, but Render Docker environment not tested |

---

## A. CONFIRMED EXPECTED ARTIFACT

PATH=apps/api-gateway/dist/main.js
(Render absolute: /opt/render/project/src/apps/api-gateway/dist/main.js)

## B. RECOMMENDED RENDER CONFIGURATION

SERVICE_TYPE=Native Node
ROOT_DIRECTORY=EMPTY
BUILD_COMMAND=npx pnpm@9.15.9 install --frozen-lockfile && npx pnpm@9.15.9 --filter @techfusion/api-gateway exec prisma generate && npx pnpm@9.15.9 --filter @techfusion/api-gateway build
START_COMMAND=node apps/api-gateway/dist/main.js

## C. ONE-TIME DIAGNOSTIC BUILD COMMAND

npx pnpm@9.15.9 install --frozen-lockfile && npx pnpm@9.15.9 --filter @techfusion/api-gateway exec prisma generate && npx pnpm@9.15.9 --filter @techfusion/api-gateway build && printf 'PWD=%s\n' "$(pwd)" && printf 'NODE=%s\n' "$(node -v)" && printf 'PNPM=%s\n' "$(npx pnpm@9.15.9 -v)" && printf 'PKG_DIR=%s\n' "$(npx pnpm@9.15.9 --filter @techfusion/api-gateway exec pwd)" && find . -type f -name main.js -not -path '*/node_modules/*' && ls -la apps/api-gateway/dist && realpath apps/api-gateway/dist/main.js && test -f apps/api-gateway/dist/main.js

## D. ONE-TIME DIAGNOSTIC START COMMAND

pwd && node -e "try { console.log('NODE_CWD='+process.cwd()); console.log('RESOLVED='+require.resolve('./apps/api-gateway/dist/main.js')); } catch (e) { console.error('MISSING='+e.message); process.exit(1); }" && npx pnpm@9.15.9 --filter @techfusion/api-gateway start

## E. VERIFICATION SUCCESS CRITERIA

- Build artifact exists: `apps/api-gateway/dist/main.js` present after build phase
- Correct command is executed: runtime log shows `Running 'node apps/api-gateway/dist/main.js'` (or the pnpm header `> @techfusion/api-gateway@0.1.0 start /opt/render/project/src/apps/api-gateway`)
- NestJS starts: `[Nest] ... [Bootstrap] API Gateway listening on port ...`
- Render detects the bound port: dashboard shows Live (app binds all interfaces; `main.ts:51-52` uses `process.env.PORT || 3001`)
- Health endpoint returns success: `GET /health` → 200 (and `/health/ready` → 200 with Postgres+Redis)

## F. FINAL MACHINE-READABLE SUMMARY

AUDIT_ID: TF-RENDER-DEPLOYMENT-AUDIT-01
SOURCE_CHANGES: NONE
EXPECTED_ARTIFACT: apps/api-gateway/dist/main.js
BUILD_PATH_STATUS: PASS
START_PATH_STATUS: FAIL
DASHBOARD_CONFIG_STATUS: FAIL
BLUEPRINT_OVERRIDE_STATUS: ABSENT
SERVICE_IDENTITY_STATUS: UNRESOLVED
RECOMMENDED_STRATEGY: A
ROOT_CAUSE: Effective Render Start Command is `node dist/main.js` executed from repository root (/opt/render/project/src, Root Directory empty); the build artifact exists only at apps/api-gateway/dist/main.js so Node resolves the wrong path. The pnpm filter start was not the command that ran (pnpm runs package scripts in the package directory; the root-path MODULE_NOT_FOUND proves a bare `node dist/main.js` at root). Dashboard-vs-log Start Command mismatch = stale or cross-service dashboard state, resolvable only via dashboard verification.
DEPLOYMENT_READY: NO
NEXT_OPERATOR_ACTION: Verify service identity per Section 9 checklist, then set Start Command to `node apps/api-gateway/dist/main.js` (Blueprint OFF, Health Check Path /health, boot-fatal env vars present) and trigger a fresh deploy.

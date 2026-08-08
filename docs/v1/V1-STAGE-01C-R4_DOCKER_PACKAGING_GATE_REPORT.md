# V1-STAGE-01C-R4 — Docker Packaging Gate Fix Report

**Mission:** V1-STAGE-01C-R4
**Status:** LOCAL CERTIFICATION COMPLETE — GITHUB RUN PENDING
**Local Gate:** V1 GREEN GATE: PASS — baseline is releasable (19/19 steps)
**Date:** 2026-08-09
**Scope:** Docker packaging gate (`docker-build` job in `.github/workflows/ci.yml`), all four application Dockerfiles, and the root `.dockerignore`. No application feature code, tests, or CI job topology were changed.

---

## 1. Executive Summary

The GitHub `docker-build` job failed during image build with a BuildKit
"not found" error:

```
COPY apps/api-gateway/prisma ./apps/api-gateway/prisma
"/apps/api-gateway/prisma": not found
```

**Root cause (single):** the CI matrix built every service with the **app
directory as the build context** (`context: apps/<service>`), but the
api-gateway / web / worker Dockerfiles are **pnpm-monorepo Dockerfiles whose
`COPY` paths are resolved from the repository root**. With an app-local
context the root manifests, lockfile, `packages/`, and `apps/<service>/...`
paths simply do not exist, so the first repo-root `COPY` in the failing image
died. This was reproduced 1:1 locally before any change. The **agent** is the
one legitimate app-local Dockerfile (a standalone Rust crate whose `COPY`s are
self-relative), so only its context was retained.

**Fix summary:**

1. **CI matrix aligned with the real Dockerfile design** — api-gateway / web /
   worker now build with `context: .` + explicit `file: apps/<service>/Dockerfile`
   (the exact mapping `infra/docker/docker-compose.yml` already uses:
   `context: ../..`, `dockerfile: apps/<service>/Dockerfile`). The agent keeps
   `context: apps/agent` + `file: Dockerfile`.
2. **Dockerfile latent bugs fixed** that only surface once the root context is
   used (postinstall `prisma generate`, worker `prisma:sync` requiring `bash`,
   workspace `node_modules` for the builder stages, pinned Prisma CLI, glibc
   mismatch on the agent runtime image).
3. **Root `.dockerignore` added** so the repo-root build context never ships
   `.git`, `node_modules`, build output, `report-storage`, or `.env*` secrets
   into the builder.

**Result:** all four images were rebuilt from a clean root context with
`--no-cache` and smoke-tested (artifacts present, Prisma client loads, web
serves HTTP 200, agent binary runs). The local authoritative V1 gate still
passes **19/19**. The only new uncommitted file beside the report is the
pre-existing untracked `apps/api-gateway/.env.test` (never staged).

---

## 2. Goal & Constraints

**Goal:** Make the `docker-build` packaging gate green without touching
application code or weakening the V1 green gate.

**Constraints honored:**
- Docker / CI packaging scope only; **no app feature code changes**.
- **No push / tag / publish**; exactly **one** focused commit,
  `fix(ci): align monorepo Docker build contexts`, staged with explicit paths
  (never `git add .` / `-A`); `apps/api-gateway/.env.test` must not be staged.
- `docker-build` stays `needs: v1-green-gate` on main-only pushes with
  **no** `continue-on-error`.
- Local reproduction used the **exact CI contexts**; certification builds ran
  with `--no-cache`; images were smoke-tested without starting the full stack
  or connecting to any production database.
- The agent image was **preserved and fixed** (not silently dropped from the
  matrix).

---

## 3. Root Cause Analysis

### 3.1 The failure

The failing `COPY` is line 33 of `apps/api-gateway/Dockerfile`:

```
COPY apps/api-gateway/prisma ./apps/api-gateway/prisma
```

`COPY <src>` paths are resolved **relative to the build context**. The CI
matrix supplied `context: apps/api-gateway`, so the context contained only the
contents of the app directory. A probe of that context confirmed:

```
Dockerfile, jest.config.js, package.json, prisma, report-storage,
scripts, src, test, tsconfig*.json   (+ Dockerfile.probe)
```

It contains **no** `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
`packages/`, or `apps/`, so every repo-root `COPY` in the Dockerfile is a
build-time "not found". The api-gateway build happened to die at the prisma
`COPY`; the same class of failure would hit web/worker (their repo-root
`COPY`s come first) had the matrix order differed.

### 3.2 Reproduced locally (pre-fix)

```
$ docker build --no-cache -t tf-r4-repro -f apps/api-gateway/Dockerfile apps/api-gateway
#6 [deps 3/3] COPY apps/api-gateway/prisma ./apps/api-gateway/prisma
#6 ERROR: failed to compute cache key: "/apps/api-gateway/prisma": not found
```

Byte-for-byte the observed GitHub error.

### 3.3 Why it was invisible locally

The repository has always documented/used the root-context layout via
`infra/docker/docker-compose.yml` (`context: ../..` + `dockerfile:
apps/<service>/Dockerfile`). Only the CI matrix deviated by passing the app
directory as the context; the `docker-build` job never ran green on `main`
before because the packaging gate was only introduced/run after the V1 gate
was green.

---

## 4. Per-Image Context Map (correct design)

| Image        | Context             | Dockerfile                 | COPY base assumption        |
|--------------|---------------------|----------------------------|-----------------------------|
| api-gateway  | repo root (`.`)     | `apps/api-gateway/Dockerfile` | repo root (pnpm workspace)  |
| web          | repo root (`.`)     | `apps/web/Dockerfile`         | repo root (pnpm workspace)  |
| worker       | repo root (`.`)     | `apps/worker/Dockerfile`      | repo root (pnpm workspace)  |
| agent        | `apps/agent`        | `Dockerfile`                  | app dir (self-relative)     |

`infra/docker/docker-compose.yml` already encodes the root-context mapping for
the first three; the CI matrix was the outlier.

---

## 5. Dockerfile Assumptions the Fix Must Respect

- **Monorepo Dockerfiles** (`api-gateway` / `web` / `worker`) assume a repo-root
  context and a pnpm workspace: they `COPY` the workspace manifests + lockfile,
  `packages/*`, and `apps/<service>/*` independently in each stage.
- **api-gateway** `postinstall` runs `prisma generate`
  (`apps/api-gateway/package.json`) → the prisma schema directory must exist
  **before** `pnpm install` in every install stage (deps + runner).
- **worker** `postinstall` runs `pnpm prisma:sync && prisma generate` and
  `prebuild` runs `pnpm prisma:sync`. `prisma:sync` executes
  `bash ../../scripts/sync-prisma-schema.sh`, which copies the API-Gateway
  schema onto the worker schema. Therefore every install stage needs (a) `bash`
  (Alpine has none), (b) `scripts/sync-prisma-schema.sh`, and (c) the API
  schema, and the runner must run a **full** install (not `--prod`) so the
  `prisma` CLI — a devDependency — is present for `prisma generate`.
- **Builder stages** must not re-resolve tools: without the deps-stage
  `node_modules`, `npx prisma generate` in the api builder downloads the latest
  Prisma CLI (7.9.1) instead of the lockfile-pinned 6.19.3, and `next` /
  `packages/ui` deps are unresolved in the web builder (`next: not found`,
  TS2307 `Cannot find module 'react'` / `clsx` / `tailwind-merge`).
- **agent** is a standalone Rust crate: `COPY Cargo.toml`, `Cargo.lock`,
  `rust-toolchain.toml`, `src/` are all self-relative, so an app-local context
  is correct. Its runtime image must satisfy the glibc ABI of the binary built
  from `rust:1.96.0` (Debian 13 / glibc ≥ 2.39).

---

## 6. `.dockerignore` Audit

A root `.dockerignore` did not exist; with a repo-root context, Docker would
send the whole tree — `.git`, `.github`, every `node_modules`, `dist`, `.next`,
`target`, `report-storage`, local `*.db`, and any `.env*` secrets — into the
build daemon. New root `.dockerignore` excludes:

`.git`, `.github`, `node_modules`, `dist`, `.next`, `target`, `.turbo`,
`coverage`, `*.tsbuildinfo`, `*.log`, `.env*` (`.env.example` preserved),
`report-storage`, `backups`, `reports`, `blueprints`, `roadmap`, `templates`,
`docs`, `test`, `*.db`.

Everything the Dockerfiles actually `COPY` (workspace manifests, lockfile,
`packages/`, `apps/<service>/{package.json,prisma,src,public,next.config*}`,
`scripts/sync-prisma-schema.sh`) is kept. The agent keeps its own
`.dockerignore` (excludes `target/`) for its app-local context.

---

## 7. Changes Made

### `.github/workflows/ci.yml` — `docker-build` matrix
- api-gateway / web / worker: `context: .` + `file: apps/<service>/Dockerfile`.
- agent: `context: apps/agent` + `file: Dockerfile` (unchanged intent).
- `file:` added to the `docker/build-push-action@v6` step (`${{ matrix.service.file }}`).
- Job topology untouched: `needs: v1-green-gate`, `if: github.ref == 'refs/heads/main'`,
  GHCR push with `type=sha,format=long` + `latest` on default branch. YAML
  validated with `PyYAML`; matrix entries and `needs:` confirmed intact.

### `apps/api-gateway/Dockerfile`
- `COPY apps/api-gateway/prisma ./apps/api-gateway/prisma` added **before**
  `pnpm install` in the deps stage (postinstall `prisma generate` needs the
  schema).
- Builder: `COPY --from=deps /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules`
  so `npx prisma generate` resolves the **pinned Prisma CLI 6.19.3** instead of
  downloading the latest.
- Runner: prisma schema copied before `pnpm install` (postinstall needs it);
  the now-redundant post-install prisma `COPY` removed.

### `apps/web/Dockerfile`
- Builder: `COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules`
  (fixes `next: not found`) and
  `COPY --from=deps /app/packages ./packages`
  (fixes TS2307 on `packages/ui` imports during type-check/build).

### `apps/worker/Dockerfile`
- Base image: `RUN apk add --no-cache bash` (worker postinstall/prebuild run
  `bash ../../scripts/sync-prisma-schema.sh`).
- deps / builder / runner: `COPY scripts/sync-prisma-schema.sh ...` and
  `COPY apps/api-gateway/prisma ...` added.
- Builder: `COPY --from=deps /app/packages ./packages` and
  `COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules`.
- Runner: `FROM base AS runner` (inherits node + pnpm + bash) and full
  `pnpm install --frozen-lockfile` (not `--prod`) so `prisma:sync` +
  `prisma generate` can run against the installed `@prisma/client`.

### `apps/agent/Dockerfile`
- Builder pinned `rust:latest` → `rust:1.96.0` (matches committed
  `apps/agent/rust-toolchain.toml`).
- `COPY Cargo.toml Cargo.lock ./` and `COPY rust-toolchain.toml ./` for
  reproducible builds.
- Runner `debian:bookworm-slim` → `debian:trixie-slim`: the binary built from
  `rust:1.96.0` (Debian 13, glibc 2.41) requires GLIBC ≥ 2.39, which
  bookworm-slim (glibc 2.36) cannot satisfy — caught by a runtime smoke check
  (`/lib/x86_64-linux-gnu/libc.so.6: version GLIBC_2.39 not found`).

### New file: `.dockerignore` (root)
See §6.

---

## 8. Local Build Results

Environment: Docker 29.6.1, BuildKit v0.31.1, 2 CPU, 13 GiB RAM. Every image
below is a **`--no-cache` certification build** using the exact CI
`(context, file)` pair, followed by a runtime smoke check **without** starting
the application stack.

| Image       | Command                                                            | Result | Smoke check                                                        |
|-------------|--------------------------------------------------------------------|--------|--------------------------------------------------------------------|
| api-gateway | `docker build --no-cache -t tf-r4-api -f apps/api-gateway/Dockerfile .` | PASS   | Node v22.23.2; `dist/main.js`; `@prisma/client` PrismaClient loads (client 6.19.3 generated in pnpm store); no `.env*` |
| web         | `docker build --no-cache -t tf-r4-web -f apps/web/Dockerfile .`         | PASS   | `.next/BUILD_ID`; Next 14.2.35; boots `next start` → **HTTP 200** `<title>TechFusion AI — Enterprise AI Platform</title>`; no `.env*` |
| worker      | `docker build --no-cache -t tf-r4-worker -f apps/worker/Dockerfile .`   | PASS   | `dist/main.js`; PrismaClient + BullMQ `Worker` resolve; worker schema **identical** to API schema (postinstall sync); no `.env*` |
| agent       | `docker build --no-cache -t tf-r4-agent -f apps/agent/Dockerfile apps/agent` | PASS   | `techfusion-agent 1.0.0-beta.4`; `--help` lists `reset-identity` + `identity-status` |

Notes:
- The generated Prisma client lives in the pnpm virtual store
  (`node_modules/.pnpm/@prisma+client@.../node_modules/.prisma`); `@prisma/client`
  resolves to it through the workspace symlink, verified by a live
  `require("@prisma/client")` inside each image.
- The pre-fix reproduction image and all probe/diagnostic images were removed
  after use; the four certification images above are the verification artifacts.

---

## 9. V1 Green Gate Result

`bash scripts/ci-v1-gate.sh` (the authoritative local gate) was re-run after
all changes:

```
PASSED: 19   FAILED: 0
V1 GREEN GATE: PASS — baseline is releasable.
```

All suites green: installer bootstrap / arch resolution / systemd unit
verification, migration deploy + status + validate, worker Prisma schema sync,
API typecheck / 913 tests / build, Web typecheck / tests / build, Worker
typecheck / tests / build, Agent fmt / tests / release build / version +
capability check, repository secret scan. No application source was touched,
so the gate result is a genuine regression pass.

---

## 10. Files Changed

| File                        | Status  | Purpose                                            |
|-----------------------------|---------|----------------------------------------------------|
| `.dockerignore`             | new     | Root context hygiene (secrets/artifacts excluded)  |
| `.github/workflows/ci.yml`  | modified| docker-build matrix: `context: .` + `file:`; agent app-local |
| `apps/api-gateway/Dockerfile` | modified | prisma in deps/runner; pinned Prisma CLI in builder |
| `apps/web/Dockerfile`       | modified| web + packages `node_modules` from deps in builder |
| `apps/worker/Dockerfile`    | modified| bash, sync script + API schema in all stages, full runner install |
| `apps/agent/Dockerfile`     | modified| pinned Rust 1.96.0, lockfile/toolchain COPYs, trixie-slim runner |
| `docs/v1/V1-STAGE-01C-R4_DOCKER_PACKAGING_GATE_REPORT.md` | new | this report |

Untouched: application code, tests, CI job topology (the `v1-green-gate`
"needs" and fail-closed checks), `infra/docker/*`, and the legacy unused root
`Dockerfile.web` (referenced by neither CI nor compose). `apps/api-gateway/.env.test`
remains untracked and is **not** part of the commit.

---

## 11. Commit

Single focused commit, staged with explicit paths only:

```
fix(ci): align monorepo Docker build contexts
```

---

## 12. GitHub Retest Instructions

1. Push the commit to `main`.
2. Watch the `docker-build` job (runs only on `main` after `v1-green-gate` is
   green, per `if: github.ref == 'refs/heads/main'`).
3. Expected: four matrix entries build and push to GHCR
   (`ghcr.io/<repo>/{api-gateway,web,worker,agent}:<sha>` + `latest` on main),
   each with the correct context/file pair:
   - api-gateway / web / worker: repo-root context, `apps/<service>/Dockerfile`.
   - agent: `apps/agent` context, `Dockerfile`.
4. The failure symptom `"/apps/api-gateway/prisma": not found` should no longer
   occur; the gate is the same pass/fail required gate it was before.

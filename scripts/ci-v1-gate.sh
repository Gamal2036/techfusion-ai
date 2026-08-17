#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — V1 Local CI Gate (V1-STAGE-01C)
#
# One local command that approximates the required V1 green gate:
#   pnpm ci:v1
# or:
#   bash scripts/ci-v1-gate.sh
#
# Order (resource-aware — major suites run SEQUENTIALLY to respect limited
# local CPU/storage; CI itself parallelizes the same jobs):
#   1. test services up (Postgres+Redis via infra/docker/docker-compose.test.yml)
#   2. installer static verification (bootstrap / arch resolution / systemd unit)
#   3. migration validation (fresh-style migrate deploy + status + validate)
#   4. API typecheck -> test -> build
#   5. Web typecheck -> test -> build
#   6. Worker typecheck -> test -> build
#   7. Agent fmt -> test -> release build -> version/capability check
#   8. repository secret scan
#
# Explicitly NOT done here (per V1-STAGE-01C §30):
#   - does NOT wipe the DB
#   - does NOT publish releases or download future unpublished artifacts
#   - does NOT modify git (no commit/stage/tag)
#   - does NOT require the published GitHub release to exist (offline-safe)
#
# Stops non-zero on the first required failure.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="$ROOT/infra/docker/docker-compose.test.yml"
ENV_TEST="$ROOT/apps/api-gateway/.env.test"

# ── test environment contract (hermetic; never the dev/prod DB) ────────────
if [ -f "$ENV_TEST" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_TEST"
  set +a
else
  export NODE_ENV=test
  export DATABASE_URL="postgresql://techfusion_test:test_password_123@localhost:5434/techfusion_test"
  export DATABASE_URL_TEST="postgresql://techfusion_test:test_password_123@localhost:5434/techfusion_test"
  export REDIS_URL="redis://localhost:6381"
  export JWT_SECRET="test-jwt-secret-00000000000000000000000000000000000000000000000000000000"
  export JWT_REFRESH_SECRET="test-refresh-secret-00000000000000000000000000000000000000000000000000000000"
  export AI_ENCRYPTION_KEY="test-encryption-key-0000000000000000000000000000000000000000000000"
  export REPORT_URL_SECRET="test-report-secret-0000000000000000000000000000000000000000000000000"
  export PORT=3001
  export ALLOWED_ORIGINS="http://localhost:3000"
  export WS_ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
fi

export DATABASE_URL_TEST="${DATABASE_URL_TEST:-$DATABASE_URL}"

PASS=0
FAIL=0
run() {
  local desc="$1"; shift
  echo ""
  echo "══════════════════════════════════════════════════"
  echo "  $desc"
  echo "══════════════════════════════════════════════════"
  if "$@"; then
    printf '  \033[1;32m✔\033[0m %s\n' "$desc"
    PASS=$((PASS + 1))
  else
    printf '  \033[1;31m✘\033[0m %s\n' "$desc"
    FAIL=$((FAIL + 1))
  fi
  return 0
}

echo "TechFusion AI — V1 Local CI Gate"
echo "================================="

# ── 0. dependencies present ────────────────────────────────────────────────
if [ ! -x "node_modules/.bin/jest" ]; then
  echo "Installing workspace dependencies (frozen lockfile)..."
  pnpm install --frozen-lockfile
fi

# ── 1. test services ───────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo "  1. Test services (Postgres + Redis)"
echo "══════════════════════════════════════════════════"

# Verify both dedicated test services are healthy.
# Uses Docker Compose project-scoped inspection (same compose file) and checks
# the exact service names defined in docker-compose.test.yml, preventing false
# positives from unrelated dev, production, or manually-started containers.
_test_services_healthy() {
  local ps_output
  ps_output=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null) || return 1
  # Each service must be present with Health == "healthy" on its own JSON line
  echo "$ps_output" | grep '"Service":"test-postgres"' | grep -q '"Health":"healthy"' || return 1
  echo "$ps_output" | grep '"Service":"test-redis"'  | grep -q '"Health":"healthy"' || return 1
  # Verify useful connectivity to the correct test ports (not dev 5433/6379)
  docker exec techfusion-test-postgres pg_isready -U techfusion_test -d techfusion_test >/dev/null 2>&1 || return 1
  docker exec techfusion-test-redis redis-cli ping >/dev/null 2>&1 || return 1
  return 0
}

if _test_services_healthy; then
  echo "  Test services already healthy."
else
  echo "  Starting test services (docker compose up -d --wait)..."
  docker compose -f "$COMPOSE_FILE" up -d --wait
  # Verify readiness after start
  echo "  Verifying test service readiness..."
  if ! docker exec techfusion-test-postgres pg_isready -U techfusion_test -d techfusion_test >/dev/null 2>&1; then
    echo "  ERROR: test-postgres not reachable on localhost:5434" >&2
    docker compose -f "$COMPOSE_FILE" logs test-postgres 2>&1 | tail -20 >&2
    exit 1
  fi
  if ! docker exec techfusion-test-redis redis-cli ping >/dev/null 2>&1; then
    echo "  ERROR: test-redis not reachable on localhost:6381" >&2
    docker compose -f "$COMPOSE_FILE" logs test-redis 2>&1 | tail -20 >&2
    exit 1
  fi
  echo "  Test services ready."
fi

# ── 2. installer static verification (offline) ─────────────────────────────
run "Installer bootstrap verification" bash scripts/verify-linux-bootstrap.sh
run "Installer arch/URL resolution verification" bash scripts/verify-installer-arch-resolution.sh
run "Agent systemd unit verification" bash scripts/verify-agent-systemd-unit.sh

# ── 3. migration validation ────────────────────────────────────────────────
run "Migration validation (deploy + status + validate)" bash -c '
  cd apps/api-gateway
  npx prisma migrate deploy --schema=prisma/schema.prisma
  npx prisma migrate status --schema=prisma/schema.prisma
  npx prisma validate --schema=prisma/schema.prisma
'
run "Worker Prisma schema in sync" bash -c '
  bash scripts/sync-prisma-schema.sh
  if ! diff -q apps/api-gateway/prisma/schema.prisma apps/worker/prisma/schema.prisma >/dev/null 2>&1; then
    echo "ERROR: apps/worker/prisma/schema.prisma drifted from apps/api-gateway/prisma/schema.prisma." >&2
    exit 1
  fi
  echo "  Worker schema matches the API schema."
  if ! git diff --quiet -- apps/worker/prisma/schema.prisma; then
    echo "  NOTE: the worker schema is updated in the working tree but not yet committed"
    echo "  (CI checks the committed state; commit the sync along with the schema change)."
  fi
'

# ── 4. API ─────────────────────────────────────────────────────────────────
run "API typecheck" bash -c "cd apps/api-gateway && pnpm lint"
run "API tests" bash -c "cd apps/api-gateway && pnpm test"
run "API build" bash -c "cd apps/api-gateway && pnpm build"

# ── 5. Web ─────────────────────────────────────────────────────────────────
run "Web typecheck" bash -c "cd apps/web && pnpm lint"
run "Web tests" bash -c "cd apps/web && pnpm test"
run "Web build" bash -c "cd apps/web && pnpm build"

# ── 6. Worker ──────────────────────────────────────────────────────────────
run "Worker typecheck" bash -c "cd apps/worker && pnpm lint"
run "Worker tests" bash -c "cd apps/worker && pnpm test"
run "Worker build" bash -c "cd apps/worker && pnpm build"

# ── 7. Agent ───────────────────────────────────────────────────────────────
run "Agent fmt check" bash -c "cd apps/agent && cargo fmt --check"
run "Agent tests" bash -c "cd apps/agent && cargo test"
run "Agent release build" bash -c "cd apps/agent && cargo build --release"
run "Agent version + capability check" bash -c '
  cd apps/agent
  BIN="target/release/agent"
  CARGO_VERSION="$(grep -m1 "^version" Cargo.toml | cut -d"\"" -f2)"
  VER_OUT="$("$BIN" --version)"
  if ! printf "%s\n" "$VER_OUT" | grep -q "techfusion-agent ${CARGO_VERSION}$"; then
    echo "ERROR: version mismatch: got $VER_OUT, want techfusion-agent ${CARGO_VERSION}" >&2
    exit 1
  fi
  for cap in reset-identity identity-status; do
    if ! "$BIN" --help | grep -qw "$cap"; then
      echo "ERROR: missing required capability: ${cap}" >&2
      exit 1
    fi
  done
  echo "  OK: $VER_OUT with reset-identity + identity-status"
'

# ── 8. secret scan ─────────────────────────────────────────────────────────
run "Repository secret scan" bash scripts/ci-secret-scan.sh

# ── summary ────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
echo "  V1 LOCAL CI GATE SUMMARY"
echo "  PASSED: ${PASS}   FAILED: ${FAIL}"
echo "══════════════════════════════════════════════════"
if [ "$FAIL" = "0" ]; then
  echo "V1 GREEN GATE: PASS — baseline is releasable."
  exit 0
fi
echo "V1 GREEN GATE: FAIL — a required gate is not green."
exit 1

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/docker/docker-compose.test.yml"
API_DIR="$REPO_ROOT/apps/api-gateway"

echo "═══════════════════════════════════════════════════════════"
echo "  Tech Fusion AI — Integration Test Runner"
echo "═══════════════════════════════════════════════════════════"

cleanup() {
  echo ""
  echo "Cleaning up test infrastructure..."
  docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans 2>/dev/null || true
  echo "Cleanup complete."
}
trap cleanup EXIT

echo ""
echo "Step 1: Starting test infrastructure (Postgres + Redis)..."
docker compose -f "$COMPOSE_FILE" up -d --wait

echo "Step 2: Waiting for services to be healthy..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" ps --format json | grep -q '"Health":"healthy"' 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "Step 3: Running database migrations..."
cd "$API_DIR"
DATABASE_URL="postgresql://techfusion_test:test_password_123@localhost:5434/techfusion_test" \
  npx prisma migrate deploy --schema=prisma/schema.prisma 2>&1 || echo "Migration warning (may be first run)"

echo "Step 4: Executing integration tests..."
cd "$API_DIR"
DATABASE_URL_TEST="postgresql://techfusion_test:test_password_123@localhost:5434/techfusion_test" \
  DATABASE_URL="postgresql://techfusion_test:test_password_123@localhost:5434/techfusion_test" \
  REDIS_URL="redis://localhost:6381" \
  NODE_ENV=test \
  npx jest --forceExit --runInBand --testPathPattern='test/.*\\.spec\\.ts$' \
  2>&1

TEST_EXIT=$?

echo ""
echo "═══════════════════════════════════════════════════════════"
if [ $TEST_EXIT -eq 0 ]; then
  echo "  Integration tests: ALL PASSED"
else
  echo "  Integration tests: SOME FAILED (exit code: $TEST_EXIT)"
fi
echo "═══════════════════════════════════════════════════════════"

exit $TEST_EXIT

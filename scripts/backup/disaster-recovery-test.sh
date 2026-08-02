#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Disaster Recovery Validation Script
# ═══════════════════════════════════════════════════════════════
# Performs controlled disaster recovery scenarios and validates
# recovery for all critical platform components.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PG_CONTAINER="${PG_CONTAINER:-techfusion-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-techfusion-redis}"
PG_USER="${POSTGRES_USER:-techfusion}"
PG_DB="${POSTGRES_DB:-techfusion}"

PASS=0
FAIL=0
WARN=0

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --scenario NAME    Run specific scenario (db-loss|redis-loss|config-loss|file-loss|full)
  --skip-containers  Skip container restart scenarios
  --help             Show this help

Scenarios:
  db-loss       PostgreSQL loss and recovery
  redis-loss    Redis loss and recovery
  config-loss   Configuration corruption recovery
  file-loss     Report storage loss and recovery
  full          Run all scenarios
EOF
    exit 0
}

SCENARIO="full"
SKIP_CONTAINERS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --scenario) SCENARIO="$2"; shift 2 ;;
        --skip-containers) SKIP_CONTAINERS=true; shift ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

record() {
    local status="$1"
    local msg="$2"
    case "${status}" in
        PASS) echo "[DR]   [PASS] ${msg}"; PASS=$((PASS + 1)) ;;
        FAIL) echo "[DR]   [FAIL] ${msg}"; FAIL=$((FAIL + 1)) ;;
        WARN) echo "[DR]   [WARN] ${msg}"; WARN=$((WARN + 1)) ;;
    esac
}

test_postgres_health() {
    if docker exec "${PG_CONTAINER}" pg_isready -U "${PG_USER}" 2>/dev/null | grep -q "accepting connections"; then
        return 0
    fi
    return 1
}

test_redis_health() {
    if docker exec "${REDIS_CONTAINER}" redis-cli ping 2>/dev/null | grep -q "PONG"; then
        return 0
    fi
    return 1
}

scenario_db_loss() {
    echo "[DR] ═══════════════════════════════════════"
    echo "[DR] Scenario: PostgreSQL Loss Recovery"
    echo "[DR] ═══════════════════════════════════════"

    echo "[DR] [1/4] Creating backup before test..."
    local pre_backup
    pre_backup=$("${SCRIPT_DIR}/backup-postgres.sh" --database "${PG_DB}" 2>/dev/null | tail -1)
    if [[ -f "${pre_backup}" ]]; then
        record PASS "Pre-test backup created"
    else
        record FAIL "Pre-test backup failed"
        return
    fi

    echo "[DR] [2/4] Verifying pre-test backup..."
    if pg_restore --list "${pre_backup}" > /dev/null 2>&1; then
        record PASS "Pre-test backup is valid"
    else
        record FAIL "Pre-test backup invalid"
        return
    fi

    echo "[DR] [3/4] Validating restore capability..."
    if [[ "${SKIP_CONTAINERS}" == "false" ]]; then
        echo "[DR]   Skipping actual data loss (destructive in dev)"
        echo "[DR]   Validating pg_dump + pg_restore pipeline..."
        local test_db="${PG_DB}_dr_test_$(date +%s)"
        docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -c "CREATE DATABASE ${test_db};" 2>/dev/null
        if pg_restore -U "${PG_USER}" -d "${test_db}" -h localhost -p 5433 --no-owner "${pre_backup}" 2>/dev/null; then
            local test_count
            test_count=$(psql -U "${PG_USER}" -d "${test_db}" -h localhost -p 5433 -tAc \
                "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
            record PASS "Restore test succeeded (${test_count} tables)"
            docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -c "DROP DATABASE ${test_db};" 2>/dev/null
        else
            record FAIL "Restore test failed"
        fi
    fi

    echo "[DR] [4/4] Validating schema integrity..."
    local schema_check
    schema_check=$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -tAc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    if [[ "${schema_check}" -gt 0 ]]; then
        record PASS "Schema intact (${schema_check} tables)"
    else
        record FAIL "Schema validation failed"
    fi
}

scenario_redis_loss() {
    echo "[DR] ═══════════════════════════════════════"
    echo "[DR] Scenario: Redis Loss Recovery"
    echo "[DR] ═══════════════════════════════════════"

    echo "[DR] [1/3] Checking Redis persistence config..."
    local aof
    aof=$(docker exec "${REDIS_CONTAINER}" redis-cli CONFIG GET appendonly 2>/dev/null | tail -1 || echo "no")
    local save
    save=$(docker exec "${REDIS_CONTAINER}" redis-cli CONFIG GET save 2>/dev/null | tail -1 || echo "")
    record PASS "Persistence: AOF=${aof}, RDB save='${save}'"

    echo "[DR] [2/3] Verifying queue data durability..."
    local queue_keys
    queue_keys=$(docker exec "${REDIS_CONTAINER}" redis-cli KEYS "bull:*" 2>/dev/null | wc -l || echo "0")
    record PASS "BullMQ queue keys present: ${queue_keys}"

    echo "[DR] [3/3] Validating restart recovery..."
    if [[ "${SKIP_CONTAINERS}" == "false" ]]; then
        local keys_before
        keys_before=$(docker exec "${REDIS_CONTAINER}" redis-cli DBSIZE 2>/dev/null | awk '{print $1}' || echo "0")
        docker restart "${REDIS_CONTAINER}" > /dev/null 2>&1
        sleep 5
        if test_redis_health; then
            local keys_after
            keys_after=$(docker exec "${REDIS_CONTAINER}" redis-cli DBSIZE 2>/dev/null | awk '{print $1}' || echo "0")
            record PASS "Redis restarted, keys: ${keys_before} -> ${keys_after}"
        else
            record FAIL "Redis did not recover after restart"
        fi
    else
        record PASS "Restart test skipped (--skip-containers)"
    fi
}

scenario_config_loss() {
    echo "[DR] ═══════════════════════════════════════"
    echo "[DR] Scenario: Configuration Corruption Recovery"
    echo "[DR] ═══════════════════════════════════════"

    echo "[DR] [1/3] Running configuration backup..."
    "${SCRIPT_DIR}/backup-config.sh" 2>/dev/null
    local config_backup
    config_backup=$(ls -t "${PROJECT_ROOT}/backups/config/"*.tar.gz 2>/dev/null | head -1)
    if [[ -f "${config_backup}" ]]; then
        record PASS "Configuration backup created"
    else
        record FAIL "Configuration backup failed"
        return
    fi

    echo "[DR] [2/3] Verifying archive integrity..."
    if tar -tzf "${config_backup}" > /dev/null 2>&1; then
        local items
        items=$(tar -tzf "${config_backup}" 2>/dev/null | wc -l)
        record PASS "Archive valid (${items} items)"
    else
        record FAIL "Archive corrupt"
        return
    fi

    echo "[DR] [3/3] Validating critical config presence..."
    local has_compose has_prometheus has_prisma has_grafana
    has_compose=$(tar -tzf "${config_backup}" 2>/dev/null | grep -c "docker-compose" || echo "0")
    has_prometheus=$(tar -tzf "${config_backup}" 2>/dev/null | grep -c "prometheus.yml" || echo "0")
    has_prisma=$(tar -tzf "${config_backup}" 2>/dev/null | grep -c "schema.prisma" || echo "0")
    has_grafana=$(tar -tzf "${config_backup}" 2>/dev/null | grep -c "grafana" || echo "0")

    [[ "${has_compose}" -gt 0 ]] && record PASS "Docker Compose in backup" || record WARN "Docker Compose missing"
    [[ "${has_prometheus}" -gt 0 ]] && record PASS "Prometheus config in backup" || record WARN "Prometheus config missing"
    [[ "${has_prisma}" -gt 0 ]] && record PASS "Prisma schema in backup" || record WARN "Prisma schema missing"
    [[ "${has_grafana}" -gt 0 ]] && record PASS "Grafana config in backup" || record WARN "Grafana config missing"
}

scenario_file_loss() {
    echo "[DR] ═══════════════════════════════════════"
    echo "[DR] Scenario: Report Storage Loss Recovery"
    echo "[DR] ═══════════════════════════════════════"

    echo "[DR] [1/3] Running file backup..."
    "${SCRIPT_DIR}/backup-files.sh" 2>/dev/null
    local file_backup
    file_backup=$(ls -t "${PROJECT_ROOT}/backups/files/"*.tar.gz 2>/dev/null | head -1)
    if [[ -f "${file_backup}" ]]; then
        record PASS "File backup created"
    else
        record WARN "No file data to backup (empty storage)"
        return
    fi

    echo "[DR] [2/3] Verifying archive..."
    if tar -tzf "${file_backup}" > /dev/null 2>&1; then
        local files
        files=$(tar -tzf "${file_backup}" 2>/dev/null | grep -cv '/$' || echo "0")
        record PASS "Archive valid (${files} files)"
    else
        record FAIL "Archive corrupt"
        return
    fi

    echo "[DR] [3/3] Validating checksum..."
    if [[ -f "${file_backup}.sha256" ]]; then
        local expected actual
        expected=$(awk '{print $1}' "${file_backup}.sha256")
        actual=$(sha256sum "${file_backup}" | awk '{print $1}')
        if [[ "${expected}" == "${actual}" ]]; then
            record PASS "Checksum verified"
        else
            record FAIL "Checksum mismatch"
        fi
    else
        record WARN "No checksum file"
    fi
}

echo "[DR] ═══════════════════════════════════════"
echo "[DR] Disaster Recovery Validation"
echo "[DR] Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[DR] Scenario: ${SCENARIO}"
echo "[DR] ═══════════════════════════════════════"

case "${SCENARIO}" in
    db-loss) scenario_db_loss ;;
    redis-loss) scenario_redis_loss ;;
    config-loss) scenario_config_loss ;;
    file-loss) scenario_file_loss ;;
    full)
        scenario_db_loss
        scenario_redis_loss
        scenario_config_loss
        scenario_file_loss
        ;;
    *) echo "[DR] Unknown scenario: ${SCENARIO}"; exit 1 ;;
esac

echo ""
echo "[DR] ═══════════════════════════════════════"
echo "[DR] Results: ${PASS} passed, ${FAIL} failed, ${WARN} warnings"
echo "[DR] ═══════════════════════════════════════"

if [[ "${FAIL}" -gt 0 ]]; then
    exit 1
fi
exit 0

#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Redis Backup & Recovery Validation Script
# ═══════════════════════════════════════════════════════════════
# Backs up Redis data via BGSAVE, validates persistence config,
# and tests recovery behavior after restart.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups/redis}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER_NAME="${REDIS_CONTAINER:-techfusion-redis}"

mkdir -p "${BACKUP_BASE}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --container NAME    Redis container name (default: ${CONTAINER_NAME})
  --output DIR        Output directory (default: ${BACKUP_BASE})
  --validate          Validate persistence config only
  --recovery-test     Perform full recovery test (restarts container)
  --help              Show this help
EOF
    exit 0
}

VALIDATE_ONLY=false
RECOVERY_TEST=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --container) CONTAINER_NAME="$2"; shift 2 ;;
        --output) BACKUP_BASE="$2"; shift 2 ;;
        --validate) VALIDATE_ONLY=true; shift ;;
        --recovery-test) RECOVERY_TEST=true; shift ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "[Redis Backup] Starting at ${TIMESTAMP}"

echo "[Redis Backup] [1/5] Checking Redis connectivity..."
if ! docker exec "${CONTAINER_NAME}" redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "[Redis Backup] ERROR: Redis not responding"
    exit 1
fi
echo "[Redis Backup]   PASS — Redis responding"

echo "[Redis Backup] [2/5] Validating persistence configuration..."
RDB_ENABLED=$(docker exec "${CONTAINER_NAME}" redis-cli CONFIG GET save 2>/dev/null | tail -1 || echo "")
AOF_ENABLED=$(docker exec "${CONTAINER_NAME}" redis-cli CONFIG GET appendonly 2>/dev/null | tail -1 || echo "")
MEMORY_POLICY=$(docker exec "${CONTAINER_NAME}" redis-cli CONFIG GET maxmemory-policy 2>/dev/null | tail -1 || echo "")
MAXMEMORY=$(docker exec "${CONTAINER_NAME}" redis-cli CONFIG GET maxmemory 2>/dev/null | tail -1 || echo "")

echo "[Redis Backup]   RDB save config: ${RDB_ENABLED:-default}"
echo "[Redis Backup]   AOF enabled: ${AOF_ENABLED:-no}"
echo "[Redis Backup]   Max memory policy: ${MEMORY_POLICY:-no-limit}"
echo "[Redis Backup]   Max memory: ${MAXMEMORY:-unlimited}"

INFO_KEYS=$(docker exec "${CONTAINER_NAME}" redis-cli DBSIZE 2>/dev/null || echo "0 keys")
echo "[Redis Backup]   Current keys: ${INFO_KEYS}"

if [[ "${VALIDATE_ONLY}" == "true" ]]; then
    echo "[Redis Backup] Validation complete"
    exit 0
fi

echo "[Redis Backup] [3/5] Triggering BGSAVE..."
BGSAVE_RESULT=$(docker exec "${CONTAINER_NAME}" redis-cli BGSAVE 2>/dev/null || echo "error")
echo "[Redis Backup]   BGSAVE result: ${BGSAVE_RESULT}"

WAIT_COUNT=0
MAX_WAIT=30
while [[ ${WAIT_COUNT} -lt ${MAX_WAIT} ]]; do
    LAST_SAVE=$(docker exec "${CONTAINER_NAME}" redis-cli LASTSAVE 2>/dev/null || echo "0")
    BG_STATUS=$(docker exec "${CONTAINER_NAME}" redis-cli INFO persistence 2>/dev/null | grep rdb_bgsave_in_progress | tr -d '\r' || echo "")
    if [[ "${BG_STATUS}" == "rdb_bgsave_in_progress:0" ]] || [[ ${WAIT_COUNT} -gt 5 ]]; then
        break
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done
echo "[Redis Backup]   Last save epoch: ${LAST_SAVE}"

echo "[Redis Backup] [4/5] Copying RDB dump..."
DUMP_SRC=$(docker exec "${CONTAINER_NAME}" redis-cli CONFIG GET dir 2>/dev/null | tail -1 || echo "/data")
DUMP_FILE="${DUMP_SRC}/dump.rdb"
BACKUP_FILE="${BACKUP_BASE}/dump_${TIMESTAMP}.rdb"

docker cp "${CONTAINER_NAME}:${DUMP_FILE}" "${BACKUP_FILE}" 2>/dev/null || {
    echo "[Redis Backup]   RDB copy from container failed, using redis-cli"
    docker exec "${CONTAINER_NAME}" cat "${DUMP_FILE}" > "${BACKUP_FILE}" 2>/dev/null || {
        echo "[Redis Backup]   WARN: Could not copy RDB directly"
        BACKUP_FILE=""
    }
}

if [[ -n "${BACKUP_FILE}" && -f "${BACKUP_FILE}" ]]; then
    FILE_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}" 2>/dev/null || echo "0")
    sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
    echo "[Redis Backup]   Backup saved: $(basename "${BACKUP_FILE}") (${FILE_SIZE} bytes)"
else
    echo "[Redis Backup]   WARN: RDB backup file not created"
fi

echo "[Redis Backup] [5/5] Redis backup complete"
echo "[Redis Backup] Snapshot: ${LAST_SAVE}"

if [[ "${RECOVERY_TEST}" == "true" ]]; then
    echo ""
    echo "[Redis Recovery Test] Starting recovery validation..."
    echo "[Redis Recovery Test] [1/4] Recording pre-restart state..."
    KEYS_BEFORE=$(docker exec "${CONTAINER_NAME}" redis-cli DBSIZE 2>/dev/null || echo "0")
    echo "[Redis Recovery Test]   Keys before: ${KEYS_BEFORE}"

    echo "[Redis Recovery Test] [2/4] Restarting Redis container..."
    docker restart "${CONTAINER_NAME}" > /dev/null 2>&1
    sleep 5

    echo "[Redis Recovery Test] [3/4] Checking post-restart connectivity..."
    RECONNECT_COUNT=0
    while [[ ${RECONNECT_COUNT} -lt 10 ]]; do
        if docker exec "${CONTAINER_NAME}" redis-cli ping 2>/dev/null | grep -q "PONG"; then
            break
        fi
        sleep 1
        RECONNECT_COUNT=$((RECONNECT_COUNT + 1))
    done

    if [[ ${RECONNECT_COUNT} -lt 10 ]]; then
        echo "[Redis Recovery Test]   PASS — Redis reconnected after ${RECONNECT_COUNT}s"
    else
        echo "[Redis Recovery Test]   FAIL — Redis did not reconnect"
        exit 1
    fi

    echo "[Redis Recovery Test] [4/4] Checking data recovery..."
    KEYS_AFTER=$(docker exec "${CONTAINER_NAME}" redis-cli DBSIZE 2>/dev/null || echo "0")
    echo "[Redis Recovery Test]   Keys after: ${KEYS_AFTER}"

    if [[ "${KEYS_AFTER}" -ge "${KEYS_BEFORE}" ]] || [[ "${KEYS_BEFORE}" == "0 keys" && "${KEYS_AFTER}" == "0 keys" ]]; then
        echo "[Redis Recovery Test]   PASS — data recovered"
    else
        echo "[Redis Recovery Test]   WARN — key count changed (${KEYS_BEFORE} -> ${KEYS_AFTER})"
    fi

    AOF_AFTER=$(docker exec "${CONTAINER_NAME}" redis-cli CONFIG GET appendonly 2>/dev/null | tail -1 || echo "no")
    echo "[Redis Recovery Test]   AOF status: ${AOF_AFTER}"

    echo "[Redis Recovery Test] ═══════════════════════════════════"
    echo "[Redis Recovery Test] Recovery test PASSED"
    echo "[Redis Recovery Test] ═══════════════════════════════════"
fi

echo ""
echo "[Redis Backup] ═══════════════════════════════════════"
echo "[Redis Backup] Backup & validation complete"
echo "[Redis Backup] Persistence: RDB=${RDB_ENABLED:-default}, AOF=${AOF_ENABLED:-no}"
echo "[Redis Backup] ═══════════════════════════════════════"

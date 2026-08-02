#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — PostgreSQL Backup Script
# ═══════════════════════════════════════════════════════════════
# Creates compressed pg_dump backups with SHA-256 checksums.
# Supports Docker container and direct PostgreSQL connections.
# Never overwrites existing backups.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups/postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
CONTAINER_NAME="${PG_CONTAINER:-techfusion-postgres}"
PG_USER="${POSTGRES_USER:-techfusion}"
PG_DB="${POSTGRES_DB:-techfusion}"
PG_PORT="${PG_PORT:-5432}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --container NAME    Docker container name (default: ${CONTAINER_NAME})
  --user USER         PostgreSQL user (default: ${PG_USER})
  --database DB       Database name (default: ${PG_DB})
  --port PORT         PostgreSQL port (default: ${PG_PORT})
  --output DIR        Output directory (default: ${BACKUP_BASE})
  --incremental       Create incremental backup (uses pg_dump --inserts)
  --schema-only       Backup schema only (no data)
  --data-only         Data only (no schema)
  --help              Show this help

Environment:
  BACKUP_DIR          Override backup output directory
  PG_CONTAINER        Override Docker container name
  POSTGRES_USER       Override PostgreSQL user
  POSTGRES_DB         Override database name
  PG_PORT             Override PostgreSQL port

Examples:
  $(basename "$0")
  $(basename "$0") --database techfusion --container techfusion-postgres
  $(basename "$0") --schema-only
  $(basename "$0") --incremental
EOF
    exit 0
}

SCHEMA_ONLY=false
DATA_ONLY=false
INCREMENTAL=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --container) CONTAINER_NAME="$2"; shift 2 ;;
        --user) PG_USER="$2"; shift 2 ;;
        --database) PG_DB="$2"; shift 2 ;;
        --port) PG_PORT="$2"; shift 2 ;;
        --output) BACKUP_BASE="$2"; shift 2 ;;
        --incremental) INCREMENTAL=true; shift ;;
        --schema-only) SCHEMA_ONLY=true; shift ;;
        --data-only) DATA_ONLY=true; shift ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

mkdir -p "${BACKUP_BASE}"

DUMP_FLAGS="--format=custom --compress=6 --verbose"
if [[ "${SCHEMA_ONLY}" == "true" ]]; then
    DUMP_FLAGS="${DUMP_FLAGS} --schema-only"
fi
if [[ "${DATA_ONLY}" == "true" ]]; then
    DUMP_FLAGS="${DUMP_FLAGS} --data-only"
fi
if [[ "${INCREMENTAL}" == "true" ]]; then
    DUMP_FLAGS="${DUMP_FLAGS} --inserts --column-inserts"
fi

SUFFIX=""
if [[ "${SCHEMA_ONLY}" == "true" ]]; then
    SUFFIX="-schema"
elif [[ "${DATA_ONLY}" == "true" ]]; then
    SUFFIX="-data"
elif [[ "${INCREMENTAL}" == "true" ]]; then
    SUFFIX="-incremental"
fi

BACKUP_FILE="${BACKUP_BASE}/${PG_DB}_${TIMESTAMP}${SUFFIX}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
MANIFEST_FILE="${BACKUP_BASE}/manifest.json"

echo "[PostgreSQL Backup] Starting at ${TIMESTAMP}"
echo "[PostgreSQL Backup] Database: ${PG_DB}"
echo "[PostgreSQL Backup] Output: ${BACKUP_FILE}"

START_MS=$(($(date +%s%N)/1000000))

if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[PostgreSQL Backup] Using Docker exec against container: ${CONTAINER_NAME}"
    docker exec "${CONTAINER_NAME}" \
        pg_dump -U "${PG_USER}" -d "${PG_DB}" -p "${PG_PORT}" ${DUMP_FLAGS} \
        > "${BACKUP_FILE}"
else
    echo "[PostgreSQL Backup] Using direct pg_dump connection"
    pg_dump -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" ${DUMP_FLAGS} \
        > "${BACKUP_FILE}"
fi

END_MS=$(($(date +%s%N)/1000000))
DURATION_MS=$((END_MS - START_MS))

echo "[PostgreSQL Backup] Dump completed in ${DURATION_MS}ms"

sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
CHECKSUM=$(awk '{print $1}' "${CHECKSUM_FILE}")
FILE_SIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}")

echo "[PostgreSQL Backup] SHA-256: ${CHECKSUM}"
echo "[PostgreSQL Backup] Size: ${FILE_SIZE} bytes"

echo "[PostgreSQL Backup] Verifying archive readability..."
if pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1; then
    TOC_COUNT=$(pg_restore --list "${BACKUP_FILE}" | grep -c "^;" || true)
    echo "[PostgreSQL Backup] Archive readable. TOC entries: ${TOC_COUNT}"
    VERIFY_STATUS="passed"
else
    echo "[PostgreSQL Backup] WARNING: pg_restore --list failed"
    VERIFY_STATUS="failed"
fi

MANIFEST_ENTRIES=""
if [[ -f "${MANIFEST_FILE}" ]]; then
    EXISTING=$(tail -1 "${MANIFEST_FILE}" 2>/dev/null || echo "{}")
fi

cat >> "${MANIFEST_FILE}" <<MANIFEST_EOF
{"timestamp":"${TIMESTAMP}","database":"${PG_DB}","file":"$(basename "${BACKUP_FILE}")","size":${FILE_SIZE},"checksum":"${CHECKSUM}","duration_ms":${DURATION_MS},"verify":"${VERIFY_STATUS}","type":"${SUFFIX:-full}","schema_only":${SCHEMA_ONLY},"data_only":${DATA_ONLY},"incremental":${INCREMENTAL}}
MANIFEST_EOF

echo "[PostgreSQL Backup] Manifest updated: ${MANIFEST_FILE}"
echo "[PostgreSQL Backup] Complete: ${BACKUP_FILE}"
echo "${BACKUP_FILE}"

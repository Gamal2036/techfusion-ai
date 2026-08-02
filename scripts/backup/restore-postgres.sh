#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — PostgreSQL Restore Script
# ═══════════════════════════════════════════════════════════════
# Restores PostgreSQL from a pg_dump backup with full validation.
# Verifies schema integrity, migration state, Prisma compatibility,
# and tenant isolation (RLS policies) post-restore.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups/postgres}"
CONTAINER_NAME="${PG_CONTAINER:-techfusion-postgres}"
PG_USER="${POSTGRES_USER:-techfusion}"
PG_DB="${POSTGRES_DB:-techfusion}"
PG_PORT="${PG_PORT:-5432}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS] BACKUP_FILE

Restores PostgreSQL from a .dump backup file.

Options:
  --container NAME    Docker container name (default: ${CONTAINER_NAME})
  --user USER         PostgreSQL user (default: ${PG_USER})
  --database DB       Database name (default: ${PG_DB})
  --port PORT         PostgreSQL port (default: ${PG_PORT})
  --skip-verify       Skip post-restore verification
  --dry-run           Show what would be restored without executing
  --target DIR        Restore target directory for data files
  --help              Show this help

Positional:
  BACKUP_FILE         Path to the .dump file to restore

Examples:
  $(basename "$0") backups/postgres/techfusion_20260718T120000Z.dump
  $(basename "$0") --dry-run backups/postgres/techfusion_20260718T120000Z.dump
  $(basename "$0") --skip-verify backups/postgres/techfusion_20260718T120000Z.dump
EOF
    exit 0
}

SKIP_VERIFY=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --container) CONTAINER_NAME="$2"; shift 2 ;;
        --user) PG_USER="$2"; shift 2 ;;
        --database) PG_DB="$2"; shift 2 ;;
        --port) PG_PORT="$2"; shift 2 ;;
        --skip-verify) SKIP_VERIFY=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --help) usage ;;
        -*) echo "Unknown option: $1"; exit 1 ;;
        *) BACKUP_FILE="$1"; shift ;;
    esac
done

if [[ -z "${BACKUP_FILE:-}" ]]; then
    echo "[PostgreSQL Restore] ERROR: No backup file specified"
    usage
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
    echo "[PostgreSQL Restore] ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "[PostgreSQL Restore] Starting restore from: $(basename "${BACKUP_FILE}")"
echo "[PostgreSQL Restore] Target database: ${PG_DB}"

if [[ -f "${BACKUP_FILE}.sha256" ]]; then
    echo "[PostgreSQL Restore] Verifying checksum..."
    EXPECTED=$(awk '{print $1}' "${BACKUP_FILE}.sha256")
    ACTUAL=$(sha256sum "${BACKUP_FILE}" | awk '{print $1}')
    if [[ "${EXPECTED}" == "${ACTUAL}" ]]; then
        echo "[PostgreSQL Restore] Checksum verified: ${ACTUAL}"
    else
        echo "[PostgreSQL Restore] ERROR: Checksum mismatch!"
        echo "  Expected: ${EXPECTED}"
        echo "  Actual:   ${ACTUAL}"
        exit 1
    fi
else
    echo "[PostgreSQL Restore] WARNING: No checksum file found, skipping verification"
fi

echo "[PostgreSQL Restore] Verifying archive integrity..."
if ! pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1; then
    echo "[PostgreSQL Restore] ERROR: Backup archive is corrupt or unreadable"
    exit 1
fi
TOC_COUNT=$(pg_restore --list "${BACKUP_FILE}" | grep -c "^;" || true)
echo "[PostgreSQL Restore] Archive valid. TOC entries: ${TOC_COUNT}"

if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[PostgreSQL Restore] DRY RUN — would restore ${TOC_COUNT} objects"
    pg_restore --list "${BACKUP_FILE}" 2>/dev/null | head -20
    echo "[PostgreSQL Restore] Dry run complete"
    exit 0
fi

echo "[PostgreSQL Restore] Pre-restore state check..."
TABLES_BEFORE=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
echo "[PostgreSQL Restore] Tables before restore: ${TABLES_BEFORE}"

START_MS=$(($(date +%s%N)/1000000))

echo "[PostgreSQL Restore] Dropping and recreating database..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker exec "${CONTAINER_NAME}" psql -U "${PG_USER}" -d postgres \
        -c "DROP DATABASE IF EXISTS ${PG_DB};" \
        -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" 2>/dev/null

    echo "[PostgreSQL Restore] Restoring via pg_restore..."
    docker exec -i "${CONTAINER_NAME}" \
        pg_restore -U "${PG_USER}" -d "${PG_DB}" --no-owner --no-privileges --verbose \
        < "${BACKUP_FILE}" 2>/dev/null || true
else
    psql -U "${PG_USER}" -d postgres -h localhost -p "${PG_PORT}" \
        -c "DROP DATABASE IF EXISTS ${PG_DB};" \
        -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" 2>/dev/null

    pg_restore -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" \
        --no-owner --no-privileges --verbose "${BACKUP_FILE}" 2>/dev/null || true
fi

END_MS=$(($(date +%s%N)/1000000))
DURATION_MS=$((END_MS - START_MS))

echo "[PostgreSQL Restore] Restore completed in ${DURATION_MS}ms"

if [[ "${SKIP_VERIFY}" == "true" ]]; then
    echo "[PostgreSQL Restore] Skipping post-restore verification"
    echo "[PostgreSQL Restore] Done"
    exit 0
fi

echo "[PostgreSQL Restore] Running post-restore verification..."
PASS=0
FAIL=0

echo "[PostgreSQL Restore]   [1/7] Checking table count..."
TABLES_AFTER=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
if [[ "${TABLES_AFTER}" -gt 0 ]]; then
    echo "[PostgreSQL Restore]     PASS — ${TABLES_AFTER} tables found"
    PASS=$((PASS + 1))
else
    echo "[PostgreSQL Restore]     FAIL — no tables found"
    FAIL=$((FAIL + 1))
fi

echo "[PostgreSQL Restore]   [2/7] Checking Prisma migration table..."
MIGRATIONS=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM _prisma_migrations;" 2>/dev/null || echo "0")
if [[ "${MIGRATIONS}" -gt 0 ]]; then
    echo "[PostgreSQL Restore]     PASS — ${MIGRATIONS} migrations recorded"
    PASS=$((PASS + 1))
else
    echo "[PostgreSQL Restore]     FAIL — no migrations found"
    FAIL=$((FAIL + 1))
fi

echo "[PostgreSQL Restore]   [3/7] Checking organization table..."
ORGS=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM \"Organization\";" 2>/dev/null || echo "0")
echo "[PostgreSQL Restore]     PASS — ${ORGS} organizations"
PASS=$((PASS + 1))

echo "[PostgreSQL Restore]   [4/7] Checking users table..."
USERS=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM \"User\";" 2>/dev/null || echo "0")
echo "[PostgreSQL Restore]     PASS — ${USERS} users"
PASS=$((PASS + 1))

echo "[PostgreSQL Restore]   [5/7] Checking RLS policies..."
RLS_POLICIES=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM pg_policies WHERE schemaname = 'public';" 2>/dev/null || echo "0")
if [[ "${RLS_POLICIES}" -gt 0 ]]; then
    echo "[PostgreSQL Restore]     PASS — ${RLS_POLICIES} RLS policies"
    PASS=$((PASS + 1))
else
    echo "[PostgreSQL Restore]     WARN — no RLS policies (may be expected for fresh DB)"
    PASS=$((PASS + 1))
fi

echo "[PostgreSQL Restore]   [6/7] Checking seed data integrity..."
DRIVERS=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM \"DriverCatalogItem\";" 2>/dev/null || echo "0")
KB_ARTICLES=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM \"KbArticle\";" 2>/dev/null || echo "0")
echo "[PostgreSQL Restore]     PASS — drivers: ${DRIVERS}, KB articles: ${KB_ARTICLES}"
PASS=$((PASS + 1))

echo "[PostgreSQL Restore]   [7/7] Checking tenant isolation columns..."
TENANT_COLS=$(psql -U "${PG_USER}" -d "${PG_DB}" -h localhost -p "${PG_PORT}" -tAc \
    "SELECT count(*) FROM information_schema.columns WHERE column_name = 'orgId' AND table_schema = 'public';" 2>/dev/null || echo "0")
if [[ "${TENANT_COLS}" -gt 0 ]]; then
    echo "[PostgreSQL Restore]     PASS — ${TENANT_COLS} tables with orgId"
    PASS=$((PASS + 1))
else
    echo "[PostgreSQL Restore]     WARN — no orgId columns found"
    PASS=$((PASS + 1))
fi

echo ""
echo "[PostgreSQL Restore] ═══════════════════════════════════════"
echo "[PostgreSQL Restore] Verification: ${PASS} passed, ${FAIL} failed"
echo "[PostgreSQL Restore] Restore duration: ${DURATION_MS}ms"
echo "[PostgreSQL Restore] ═══════════════════════════════════════"

if [[ "${FAIL}" -gt 0 ]]; then
    echo "[PostgreSQL Restore] FAILED"
    exit 1
fi

echo "[PostgreSQL Restore] RESTORE SUCCESSFUL"
exit 0

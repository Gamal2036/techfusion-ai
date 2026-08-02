#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Master Backup Script
# ═══════════════════════════════════════════════════════════════
# Orchestrates all backup operations: PostgreSQL, Redis, Files,
# Configuration. Verifies all backups. Enforces retention.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG_FILE="${BACKUP_BASE}/backup_${TIMESTAMP}.log"

mkdir -p "${BACKUP_BASE}"

PASS=0
FAIL=0
START_MS=$(($(date +%s%N)/1000000))

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --skip-postgres    Skip PostgreSQL backup
  --skip-redis       Skip Redis backup
  --skip-files       Skip file backup
  --skip-config      Skip configuration backup
  --skip-verify      Skip verification
  --skip-retention   Skip retention enforcement
  --help             Show this help
EOF
    exit 0
}

SKIP_POSTGRES=false
SKIP_REDIS=false
SKIP_FILES=false
SKIP_CONFIG=false
SKIP_VERIFY=false
SKIP_RETENTION=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-postgres) SKIP_POSTGRES=true; shift ;;
        --skip-redis) SKIP_REDIS=true; shift ;;
        --skip-files) SKIP_FILES=true; shift ;;
        --skip-config) SKIP_CONFIG=true; shift ;;
        --skip-verify) SKIP_VERIFY=true; shift ;;
        --skip-retention) SKIP_RETENTION=true; shift ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

log() {
    echo "$1" | tee -a "${LOG_FILE}"
}

run_step() {
    local name="$1"
    shift
    log "[Backup All] ${name}..."
    if "$@" >> "${LOG_FILE}" 2>&1; then
        log "[Backup All] ${name}: SUCCESS"
        PASS=$((PASS + 1))
    else
        log "[Backup All] ${name}: FAILED"
        FAIL=$((FAIL + 1))
    fi
}

log "══════════════════════════════════════════════════"
log "TechFusion AI — Full Backup Run"
log "Timestamp: ${TIMESTAMP}"
log "Log: ${LOG_FILE}"
log "══════════════════════════════════════════════════"

if [[ "${SKIP_POSTGRES}" != "true" ]]; then
    run_step "PostgreSQL Backup" "${SCRIPT_DIR}/backup-postgres.sh"
fi

if [[ "${SKIP_REDIS}" != "true" ]]; then
    run_step "Redis Backup" "${SCRIPT_DIR}/backup-redis.sh"
fi

if [[ "${SKIP_FILES}" != "true" ]]; then
    run_step "File Backup" "${SCRIPT_DIR}/backup-files.sh"
fi

if [[ "${SKIP_CONFIG}" != "true" ]]; then
    run_step "Configuration Backup" "${SCRIPT_DIR}/backup-config.sh"
fi

if [[ "${SKIP_VERIFY}" != "true" ]]; then
    run_step "Backup Verification" "${SCRIPT_DIR}/verify-backup.sh"
fi

if [[ "${SKIP_RETENTION}" != "true" ]]; then
    run_step "Retention Enforcement" "${SCRIPT_DIR}/apply-retention.sh"
fi

END_MS=$(($(date +%s%N)/1000000))
DURATION_MS=$((END_MS - START_MS))

log ""
log "══════════════════════════════════════════════════"
log "Backup Run Complete"
log "Duration: ${DURATION_MS}ms"
log "Results: ${PASS} succeeded, ${FAIL} failed"
log "══════════════════════════════════════════════════"

if [[ "${FAIL}" -gt 0 ]]; then
    exit 1
fi
exit 0

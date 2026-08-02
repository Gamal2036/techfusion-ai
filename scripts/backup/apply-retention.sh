#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Backup Retention Policy Script
# ═══════════════════════════════════════════════════════════════
# Enforces backup retention: Daily (7d), Weekly (4w), Monthly (3m).
# Removes expired backups and generates cleanup reports.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"

DAILY_RETENTION_DAYS="${DAILY_RETENTION:-7}"
WEEKLY_RETENTION_DAYS="${WEEKLY_RETENTION:-28}"
MONTHLY_RETENTION_DAYS="${MONTHLY_RETENTION:-90}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Enforces backup retention policy.

Options:
  --backup-dir DIR        Backup root directory (default: ${BACKUP_BASE})
  --daily-days N          Keep daily backups for N days (default: ${DAILY_RETENTION_DAYS})
  --weekly-days N         Keep weekly backups for N days (default: ${WEEKLY_RETENTION_DAYS})
  --monthly-days N        Keep monthly backups for N days (default: ${MONTHLY_RETENTION_DAYS})
  --dry-run               Show what would be deleted without deleting
  --help                  Show this help

Retention Policy:
  Daily:   Keep all backups for ${DAILY_RETENTION_DAYS} days
  Weekly:  Keep one backup per week for ${WEEKLY_RETENTION_DAYS} days
  Monthly: Keep one backup per month for ${MONTHLY_RETENTION_DAYS} days
EOF
    exit 0
}

DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup-dir) BACKUP_BASE="$2"; shift 2 ;;
        --daily-days) DAILY_RETENTION_DAYS="$2"; shift 2 ;;
        --weekly-days) WEEKLY_RETENTION_DAYS="$2"; shift 2 ;;
        --monthly-days) MONTHLY_RETENTION_DAYS="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

NOW_EPOCH=$(date +%s)
DELETED=0
KEPT=0

echo "[Retention] ═══════════════════════════════════════"
echo "[Retention] Backup Retention Policy Enforcement"
echo "[Retention] Daily: ${DAILY_RETENTION_DAYS}d, Weekly: ${WEEKLY_RETENTION_DAYS}d, Monthly: ${MONTHLY_RETENTION_DAYS}d"
echo "[Retention] Dry run: ${DRY_RUN}"
echo "[Retention] ═══════════════════════════════════════"

process_backups() {
    local dir="$1"
    local type="$2"

    if [[ ! -d "${dir}" ]]; then
        echo "[Retention] ${type}: directory not found, skipping"
        return
    fi

    echo "[Retention] Processing ${type} backups..."

    for backup_file in "${dir}"/*.{dump,rdb,tar.gz} 2>/dev/null; do
        [[ -f "${backup_file}" ]] || continue

        local basename_file
        basename_file=$(basename "${backup_file}")
        local file_epoch
        file_epoch=$(stat -c%Y "${backup_file}" 2>/dev/null || stat -f%m "${backup_file}" 2>/dev/null || echo "0")
        local age_days=$(( (NOW_EPOCH - file_epoch) / 86400 ))

        if [[ ${age_days} -le ${DAILY_RETENTION_DAYS} ]]; then
            echo "[Retention]   KEEP (${age_days}d): ${basename_file}"
            KEPT=$((KEPT + 1))
            continue
        fi

        local day_of_week
        day_of_week=$(date -d "@${file_epoch}" +%u 2>/dev/null || date -r "${file_epoch}" +%u 2>/dev/null || echo "1")
        local day_of_month
        day_of_month=$(date -d "@${file_epoch}" +%d 2>/dev/null || date -r "${file_epoch}" +%d 2>/dev/null || echo "1")

        if [[ ${age_days} -le ${WEEKLY_RETENTION_DAYS} ]]; then
            if [[ "${day_of_week}" == "7" ]] || [[ "${day_of_month}" == "01" ]] || [[ ${age_days} -le 7 ]]; then
                echo "[Retention]   KEEP-weekly (${age_days}d): ${basename_file}"
                KEPT=$((KEPT + 1))
                continue
            fi
        fi

        if [[ ${age_days} -le ${MONTHLY_RETENTION_DAYS} ]]; then
            if [[ "${day_of_month}" == "01" ]] || [[ ${age_days} -le 30 ]]; then
                echo "[Retention]   KEEP-monthly (${age_days}d): ${basename_file}"
                KEPT=$((KEPT + 1))
                continue
            fi
        fi

        if [[ "${DRY_RUN}" == "true" ]]; then
            echo "[Retention]   WOULD DELETE (${age_days}d): ${basename_file}"
        else
            echo "[Retention]   DELETE (${age_days}d): ${basename_file}"
            rm -f "${backup_file}" "${backup_file}.sha256"
        fi
        DELETED=$((DELETED + 1))
    done
}

process_backups "${BACKUP_BASE}/postgres" "PostgreSQL"
process_backups "${BACKUP_BASE}/redis" "Redis"
process_backups "${BACKUP_BASE}/files" "Files"
process_backups "${BACKUP_BASE}/config" "Config"

echo ""
echo "[Retention] ═══════════════════════════════════════"
echo "[Retention] Retention enforcement complete"
echo "[Retention] Kept: ${KEPT}, Deleted: ${DELETED}"
echo "[Retention] ═══════════════════════════════════════"

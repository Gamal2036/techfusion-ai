#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — File Backup Script
# ═══════════════════════════════════════════════════════════════
# Backs up uploaded files, generated reports, report storage,
# and custom source paths. Creates compressed tar archives
# with SHA-256 checksums.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups/files}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

REPORT_STORAGE="${PROJECT_ROOT}/apps/api-gateway/report-storage"
REPORT_STORAGE_ALT="${PROJECT_ROOT}/report-storage"

CUSTOM_PATHS=()

mkdir -p "${BACKUP_BASE}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --output DIR        Output directory (default: ${BACKUP_BASE})
  --reports-only      Backup only report storage
  --paths "p1,p2"     Comma-separated list of source paths to back up
  --job-label LABEL   Label for the backup archive
  --help              Show this help
EOF
    exit 0
}

REPORTS_ONLY=false
JOB_LABEL=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output) BACKUP_BASE="$2"; shift 2 ;;
        --reports-only) REPORTS_ONLY=true; shift ;;
        --paths) IFS=',' read -ra CUSTOM_PATHS <<< "$2"; shift 2 ;;
        --job-label) JOB_LABEL="$2"; shift 2 ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "[File Backup] Starting at ${TIMESTAMP}"
TOTAL_SIZE=0
ARCHIVE_COUNT=0

backup_directory() {
    local src="$1"
    local label="$2"
    local archive_name="${label}_${TIMESTAMP}.tar.gz"
    local archive_path="${BACKUP_BASE}/${archive_name}"

    if [[ ! -d "${src}" ]]; then
        echo "[File Backup]   SKIP — ${label}: directory not found (${src})"
        return
    fi

    local file_count
    file_count=$(find "${src}" -type f 2>/dev/null | wc -l)

    if [[ "${file_count}" -eq 0 ]]; then
        echo "[File Backup]   SKIP — ${label}: empty directory"
        return
    fi

    echo "[File Backup]   Backing up ${label}: ${file_count} files..."
    local start_ms
    start_ms=$(($(date +%s%N)/1000000))

    tar -czf "${archive_path}" -C "$(dirname "${src}")" "$(basename "${src}")" 2>/dev/null

    local end_ms
    end_ms=$(($(date +%s%N)/1000000))
    local duration_ms=$((end_ms - start_ms))

    local file_size
    file_size=$(stat -c%s "${archive_path}" 2>/dev/null || stat -f%z "${archive_path}" 2>/dev/null || echo "0")
    sha256sum "${archive_path}" > "${archive_path}.sha256"

    echo "[File Backup]   ${label}: ${file_count} files, ${file_size} bytes, ${duration_ms}ms"
    echo "[File Backup]   SHA-256: $(awk '{print $1}' "${archive_path}.sha256")"
    echo "[File Backup]   TOC entries: ${file_count}"
    echo "[File Backup]   Size: ${file_size} bytes"
    echo "[File Backup]   Archive: ${archive_path}"

    TOTAL_SIZE=$((TOTAL_SIZE + file_size))
    ARCHIVE_COUNT=$((ARCHIVE_COUNT + 1))
}

backup_custom_path() {
    local src="$1"
    local index="$2"
    local safe_name
    safe_name=$(echo "${src}" | tr '/' '_' | tr -c 'a-zA-Z0-9_-' '_')
    local label="${JOB_LABEL:+${JOB_LABEL}_}path${index}_${safe_name}"
    local archive_name="${label}_${TIMESTAMP}.tar.gz"
    local archive_path="${BACKUP_BASE}/${archive_name}"

    if [[ ! -e "${src}" ]]; then
        echo "[File Backup]   SKIP — path not found: ${src}"
        return
    fi

    local file_count=0
    if [[ -d "${src}" ]]; then
        file_count=$(find "${src}" -type f 2>/dev/null | wc -l)
    elif [[ -f "${src}" ]]; then
        file_count=1
    fi

    if [[ "${file_count}" -eq 0 ]]; then
        echo "[File Backup]   SKIP — empty or no files: ${src}"
        return
    fi

    echo "[File Backup]   Backing up custom path ${src}: ${file_count} files..."
    local start_ms
    start_ms=$(($(date +%s%N)/1000000))

    if [[ -d "${src}" ]]; then
        tar -czf "${archive_path}" -C "$(dirname "${src}")" "$(basename "${src}")" 2>/dev/null
    else
        tar -czf "${archive_path}" -C "$(dirname "${src}")" "$(basename "${src}")" 2>/dev/null
    fi

    local end_ms
    end_ms=$(($(date +%s%N)/1000000))
    local duration_ms=$((end_ms - start_ms))

    local file_size
    file_size=$(stat -c%s "${archive_path}" 2>/dev/null || stat -f%z "${archive_path}" 2>/dev/null || echo "0")
    sha256sum "${archive_path}" > "${archive_path}.sha256"

    echo "[File Backup]   Custom path ${src}: ${file_count} files, ${file_size} bytes, ${duration_ms}ms"
    echo "[File Backup]   SHA-256: $(awk '{print $1}' "${archive_path}.sha256")"
    echo "[File Backup]   TOC entries: ${file_count}"
    echo "[File Backup]   Size: ${file_size} bytes"
    echo "[File Backup]   Archive: ${archive_path}"

    TOTAL_SIZE=$((TOTAL_SIZE + file_size))
    ARCHIVE_COUNT=$((ARCHIVE_COUNT + 1))
}

if [[ ${#CUSTOM_PATHS[@]} -gt 0 ]]; then
    echo "[File Backup] Backing up ${#CUSTOM_PATHS[@]} custom source path(s)..."
    for i in "${!CUSTOM_PATHS[@]}"; do
        backup_custom_path "${CUSTOM_PATHS[$i]}" "$i"
    done
else
    echo "[File Backup] [1/3] Backing up report storage (API Gateway)..."
    backup_directory "${REPORT_STORAGE}" "report-storage-api"

    if [[ "${REPORTS_ONLY}" != "true" ]]; then
        echo "[File Backup] [2/3] Backing up report storage (root)..."
        backup_directory "${REPORT_STORAGE_ALT}" "report-storage-root"
    else
        echo "[File Backup] [2/3] SKIP — reports-only mode"
    fi

    echo "[File Backup] [3/3] Backing up worker report output..."
    WORKER_REPORTS="${PROJECT_ROOT}/apps/worker/report-output"
    backup_directory "${WORKER_REPORTS}" "worker-reports"
fi

echo ""
echo "[File Backup] ═══════════════════════════════════════"
echo "[File Backup] Archives created: ${ARCHIVE_COUNT}"
echo "[File Backup] Total backup size: ${TOTAL_SIZE} bytes"
echo "[File Backup] Backup directory: ${BACKUP_BASE}"
echo "[File Backup] ═══════════════════════════════════════"

if [[ "${ARCHIVE_COUNT}" -eq 0 ]]; then
    echo "[File Backup] FAIL: No archives were created (${#CUSTOM_PATHS[@]} custom paths provided)"
    exit 1
fi

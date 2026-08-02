#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Safe File Restore Script
# ═══════════════════════════════════════════════════════════════
# Non-destructive file restore. By default restores into a
# recovery directory and never overwrites existing files.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

usage() {
    cat <<EOF
Usage: $(basename "$0") --archive ARCHIVE --dest DEST [OPTIONS]

Required:
  --archive PATH    Path to the tar.gz backup archive
  --dest DIR        Destination directory for restored files

Options:
  --overwrite       Allow overwriting existing files (default: off)
  --dry-run         Show what would be restored without extracting
  --help            Show this help

Safety:
  By default, files are restored to <dest>/recovery_<timestamp>/
  and existing files are NEVER overwritten.
EOF
    exit 0
}

ARCHIVE=""
DEST=""
OVERWRITE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --archive) ARCHIVE="$2"; shift 2 ;;
        --dest) DEST="$2"; shift 2 ;;
        --overwrite) OVERWRITE=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ -z "${ARCHIVE}" || -z "${DEST}" ]]; then
    echo "[Restore Files] ERROR: --archive and --dest are required"
    exit 1
fi

if [[ ! -f "${ARCHIVE}" ]]; then
    echo "[Restore Files] ERROR: Archive not found: ${ARCHIVE}"
    exit 1
fi

ARCHIVE_BASENAME=$(basename "${ARCHIVE}")
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

if [[ "${OVERWRITE}" != "true" ]]; then
    RESTORE_DIR="${DEST}/recovery_${TIMESTAMP}"
else
    RESTORE_DIR="${DEST}"
fi

mkdir -p "${RESTORE_DIR}"

echo "[Restore Files] ═══════════════════════════════════════"
echo "[Restore Files] Archive: ${ARCHIVE}"
echo "[Restore Files] Destination: ${RESTORE_DIR}"
echo "[Restore Files] Overwrite: ${OVERWRITE}"
echo "[Restore Files] Dry run: ${DRY_RUN}"
echo "[Restore Files] ═══════════════════════════════════════"

if [[ -f "${ARCHIVE}.sha256" ]]; then
    echo "[Restore Files] Verifying checksum..."
    EXPECTED=$(awk '{print $1}' "${ARCHIVE}.sha256")
    ACTUAL=$(sha256sum "${ARCHIVE}" | awk '{print $1}')
    if [[ "${EXPECTED}" != "${ACTUAL}" ]]; then
        echo "[Restore Files] ERROR: Checksum MISMATCH"
        echo "[Restore Files]   Expected: ${EXPECTED}"
        echo "[Restore Files]   Actual:   ${ACTUAL}"
        exit 1
    fi
    echo "[Restore Files] Checksum verified (SHA-256: ${ACTUAL})"
fi

echo "[Restore Files] Listing archive contents..."
tar -tzf "${ARCHIVE}" 2>/dev/null || {
    echo "[Restore Files] ERROR: Cannot read archive"
    exit 1
}

if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[Restore Files] Dry run — no files restored"
    echo "[Restore Files] Would restore to: ${RESTORE_DIR}"
    exit 0
fi

echo "[Restore Files] Extracting files..."
EXTRACT_COUNT=0
SKIP_COUNT=0

if [[ "${OVERWRITE}" != "true" ]]; then
    tar -xzf "${ARCHIVE}" -C "${RESTORE_DIR}" 2>/dev/null
    EXTRACT_COUNT=$(find "${RESTORE_DIR}" -type f 2>/dev/null | wc -l)
else
    tar -xzf "${ARCHIVE}" -C "${RESTORE_DIR}" 2>/dev/null
    EXTRACT_COUNT=$(find "${RESTORE_DIR}" -type f 2>/dev/null | wc -l)
fi

RESTORE_SIZE=$(find "${RESTORE_DIR}" -type f -exec stat -c%s {} + 2>/dev/null | awk '{s+=$1} END {print s}' || echo "0")

echo "[Restore Files] ═══════════════════════════════════════"
echo "[Restore Files] Restore complete"
echo "[Restore Files] Files restored: ${EXTRACT_COUNT}"
echo "[Restore Files] Size: ${RESTORE_SIZE} bytes"
echo "[Restore Files] Destination: ${RESTORE_DIR}"
echo "[Restore Files] ═══════════════════════════════════════"

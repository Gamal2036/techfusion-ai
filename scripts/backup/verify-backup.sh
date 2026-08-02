#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Backup Verification Script
# ═══════════════════════════════════════════════════════════════
# Verifies backup integrity: archive readability, checksums,
# and restore capability for all backup types.
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Options:
  --backup-dir DIR        Backup root directory (default: ${BACKUP_BASE})
  --type TYPE             Verify specific type: postgres|redis|files|config|all (default: all)
  --archive-path PATH     Verify a single archive file directly
  --archive-checksum HEX  Expected checksum (hex) to compare against
  --help                  Show this help
EOF
    exit 0
}

VERIFY_TYPE="all"
ARCHIVE_PATH=""
EXPECTED_CHECKSUM=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --backup-dir) BACKUP_BASE="$2"; shift 2 ;;
        --type) VERIFY_TYPE="$2"; shift 2 ;;
        --archive-path) ARCHIVE_PATH="$2"; shift 2 ;;
        --archive-checksum) EXPECTED_CHECKSUM="$2"; shift 2 ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

PASS=0
FAIL=0
WARN=0

verify_archive() {
    local file="$1"
    local label="$2"
    local type="$3"

    echo "[Verify]   Checking ${label}..."
    local checks_passed=0
    local checks_total=0

    checks_total=$((checks_total + 1))
    if [[ -f "${file}" ]]; then
        echo "[Verify]     [✓] File exists"
        checks_passed=$((checks_passed + 1))
    else
        echo "[Verify]     [✗] File missing: ${file}"
        FAIL=$((FAIL + 1))
        return
    fi

    checks_total=$((checks_total + 1))
    if [[ -f "${file}.sha256" ]]; then
        EXPECTED=$(awk '{print $1}' "${file}.sha256")
        ACTUAL=$(sha256sum "${file}" | awk '{print $1}')
        if [[ "${EXPECTED}" == "${ACTUAL}" ]]; then
            echo "[Verify]     [✓] Checksum valid"
            checks_passed=$((checks_passed + 1))
        else
            echo "[Verify]     [✗] Checksum MISMATCH"
            FAIL=$((FAIL + 1))
            return
        fi
    else
        echo "[Verify]     [!] No checksum file (warn)"
        WARN=$((WARN + 1))
    fi

    checks_total=$((checks_total + 1))
    if [[ "${type}" == "dump" ]]; then
        if pg_restore --list "${file}" > /dev/null 2>&1; then
            echo "[Verify]     [✓] pg_restore readable"
            checks_passed=$((checks_passed + 1))
        else
            echo "[Verify]     [✗] pg_restore failed"
            FAIL=$((FAIL + 1))
            return
        fi
    elif [[ "${type}" == "tar" ]]; then
        if tar -tzf "${file}" > /dev/null 2>&1; then
            local count
            count=$(tar -tzf "${file}" 2>/dev/null | wc -l)
            echo "[Verify]     [✓] tar readable (${count} entries)"
            checks_passed=$((checks_passed + 1))
        else
            echo "[Verify]     [✗] tar archive corrupt"
            FAIL=$((FAIL + 1))
            return
        fi
    elif [[ "${type}" == "rdb" ]]; then
        local size
        size=$(stat -c%s "${file}" 2>/dev/null || stat -f%z "${file}" 2>/dev/null || echo "0")
        if [[ "${size}" -gt 0 ]]; then
            echo "[Verify]     [✓] RDB file present (${size} bytes)"
            checks_passed=$((checks_passed + 1))
        else
            echo "[Verify]     [✗] RDB file empty"
            FAIL=$((FAIL + 1))
            return
        fi
    fi

    local size
    size=$(stat -c%s "${file}" 2>/dev/null || stat -f%z "${file}" 2>/dev/null || echo "0")
    echo "[Verify]     [i] Size: ${size} bytes"

    if [[ ${checks_passed} -eq ${checks_total} ]]; then
        echo "[Verify]     PASS (${checks_passed}/${checks_total} checks)"
        PASS=$((PASS + 1))
    fi
}

# Single archive verification mode
if [[ -n "${ARCHIVE_PATH}" ]]; then
    echo "[Verify] ═══════════════════════════════════════"
    echo "[Verify] Single Archive Verification — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "[Verify] Archive: ${ARCHIVE_PATH}"
    echo "[Verify] ═══════════════════════════════════════"
    echo ""

    local_archive="${ARCHIVE_PATH}"
    if [[ ! -f "${local_archive}" ]]; then
        echo "[Verify]   [✗] Archive not found: ${local_archive}"
        FAIL=$((FAIL + 1))
    else
        PASS=$((PASS + 1))
        echo "[Verify]     [✓] File exists"

        if [[ -f "${local_archive}.sha256" ]]; then
            expected=$(awk '{print $1}' "${local_archive}.sha256")
            actual=$(sha256sum "${local_archive}" | awk '{print $1}')
            if [[ "${expected}" == "${actual}" ]]; then
                echo "[Verify]     [✓] Checksum valid"
                PASS=$((PASS + 1))
            else
                echo "[Verify]     [✗] Checksum MISMATCH (expected=${expected}, actual=${actual})"
                FAIL=$((FAIL + 1))
            fi
        elif [[ -n "${EXPECTED_CHECKSUM}" ]]; then
            actual=$(sha256sum "${local_archive}" | awk '{print $1}')
            if [[ "${EXPECTED_CHECKSUM}" == "${actual}" ]]; then
                echo "[Verify]     [✓] Checksum matches expected"
                PASS=$((PASS + 1))
            else
                echo "[Verify]     [✗] Checksum MISMATCH (expected=${EXPECTED_CHECKSUM}, actual=${actual})"
                FAIL=$((FAIL + 1))
            fi
        else
            echo "[Verify]     [!] No checksum file or expected checksum (warn)"
            WARN=$((WARN + 1))
        fi

        if tar -tzf "${local_archive}" > /dev/null 2>&1; then
            count=$(tar -tzf "${local_archive}" 2>/dev/null | wc -l)
            echo "[Verify]     [✓] tar readable (${count} entries)"
            PASS=$((PASS + 1))
        else
            echo "[Verify]     [✗] tar archive corrupt"
            FAIL=$((FAIL + 1))
        fi

        size=$(stat -c%s "${local_archive}" 2>/dev/null || stat -f%z "${local_archive}" 2>/dev/null || echo "0")
        echo "[Verify]     [i] Size: ${size} bytes"
    fi

    echo ""
    echo "[Verify] ═══════════════════════════════════════"
    echo "[Verify] Results: ${PASS} passed, ${FAIL} failed, ${WARN} warnings"
    echo "[Verify] ═══════════════════════════════════════"
    if [[ "${FAIL}" -gt 0 ]]; then
        exit 1
    fi
    exit 0
fi

echo "[Verify] ═══════════════════════════════════════"
echo "[Verify] Backup Verification — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[Verify] Backup directory: ${BACKUP_BASE}"
echo "[Verify] ═══════════════════════════════════════"

if [[ "${VERIFY_TYPE}" == "all" || "${VERIFY_TYPE}" == "postgres" ]]; then
    echo ""
    echo "[Verify] PostgreSQL Backups:"
    PG_DIR="${BACKUP_BASE}/postgres"
    if [[ -d "${PG_DIR}" ]]; then
        FOUND=false
        for dump_file in "${PG_DIR}"/*.dump; do
            if [[ -f "${dump_file}" ]]; then
                verify_archive "${dump_file}" "$(basename "${dump_file}")" "dump"
                FOUND=true
            fi
        done
        if [[ "${FOUND}" == "false" ]]; then
            echo "[Verify]   No .dump files found"
        fi
    else
        echo "[Verify]   Directory not found: ${PG_DIR}"
    fi
fi

if [[ "${VERIFY_TYPE}" == "all" || "${VERIFY_TYPE}" == "redis" ]]; then
    echo ""
    echo "[Verify] Redis Backups:"
    REDIS_DIR="${BACKUP_BASE}/redis"
    if [[ -d "${REDIS_DIR}" ]]; then
        FOUND=false
        for rdb_file in "${REDIS_DIR}"/*.rdb; do
            if [[ -f "${rdb_file}" ]]; then
                verify_archive "${rdb_file}" "$(basename "${rdb_file}")" "rdb"
                FOUND=true
            fi
        done
        if [[ "${FOUND}" == "false" ]]; then
            echo "[Verify]   No .rdb files found"
        fi
    else
        echo "[Verify]   Directory not found: ${REDIS_DIR}"
    fi
fi

if [[ "${VERIFY_TYPE}" == "all" || "${VERIFY_TYPE}" == "files" ]]; then
    echo ""
    echo "[Verify] File Backups:"
    FILES_DIR="${BACKUP_BASE}/files"
    if [[ -d "${FILES_DIR}" ]]; then
        FOUND=false
        for tar_file in "${FILES_DIR}"/*.tar.gz; do
            if [[ -f "${tar_file}" ]]; then
                verify_archive "${tar_file}" "$(basename "${tar_file}")" "tar"
                FOUND=true
            fi
        done
        if [[ "${FOUND}" == "false" ]]; then
            echo "[Verify]   No .tar.gz files found"
        fi
    else
        echo "[Verify]   Directory not found: ${FILES_DIR}"
    fi
fi

if [[ "${VERIFY_TYPE}" == "all" || "${VERIFY_TYPE}" == "config" ]]; then
    echo ""
    echo "[Verify] Configuration Backups:"
    CONFIG_DIR="${BACKUP_BASE}/config"
    if [[ -d "${CONFIG_DIR}" ]]; then
        FOUND=false
        for tar_file in "${CONFIG_DIR}"/*.tar.gz; do
            if [[ -f "${tar_file}" ]]; then
                verify_archive "${tar_file}" "$(basename "${tar_file}")" "tar"
                FOUND=true
            fi
        done
        if [[ "${FOUND}" == "false" ]]; then
            echo "[Verify]   No .tar.gz files found"
        fi
    else
        echo "[Verify]   Directory not found: ${CONFIG_DIR}"
    fi
fi

echo ""
echo "[Verify] ═══════════════════════════════════════"
echo "[Verify] Results: ${PASS} passed, ${FAIL} failed, ${WARN} warnings"
echo "[Verify] ═══════════════════════════════════════"

if [[ "${FAIL}" -gt 0 ]]; then
    exit 1
fi
exit 0

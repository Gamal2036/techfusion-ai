#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Configuration Backup Script
# ═══════════════════════════════════════════════════════════════
# Backs up Docker configs, compose files, Prometheus, Grafana,
# OTel, Prisma schema, and environment templates.
# NEVER backs up real secrets (.env files with actual values).
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

BACKUP_BASE="${BACKUP_DIR:-${PROJECT_ROOT}/backups/config}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${BACKUP_BASE}/config_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_BASE}"
STAGING_DIR=$(mktemp -d)
trap 'rm -rf "${STAGING_DIR}"' EXIT

echo "[Config Backup] Starting at ${TIMESTAMP}"

echo "[Config Backup] Collecting Docker configuration..."
mkdir -p "${STAGING_DIR}/docker"
cp "${PROJECT_ROOT}/infra/docker/docker-compose.yml" "${STAGING_DIR}/docker/" 2>/dev/null || true
cp "${PROJECT_ROOT}/infra/docker/docker-compose.observability.yml" "${STAGING_DIR}/docker/" 2>/dev/null || true
cp "${PROJECT_ROOT}/Dockerfile.web" "${STAGING_DIR}/docker/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/api-gateway/Dockerfile" "${STAGING_DIR}/docker/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/worker/Dockerfile" "${STAGING_DIR}/docker/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/web/Dockerfile" "${STAGING_DIR}/docker/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/agent/Dockerfile" "${STAGING_DIR}/docker/" 2>/dev/null || true

echo "[Config Backup] Collecting Prometheus configuration..."
mkdir -p "${STAGING_DIR}/prometheus"
cp "${PROJECT_ROOT}/infra/observability/prometheus/prometheus.yml" "${STAGING_DIR}/prometheus/" 2>/dev/null || true
cp "${PROJECT_ROOT}/infra/observability/prometheus/alert-rules.yml" "${STAGING_DIR}/prometheus/" 2>/dev/null || true
cp "${PROJECT_ROOT}/infra/docker/prometheus-prometheus.yml" "${STAGING_DIR}/prometheus/" 2>/dev/null || true

echo "[Config Backup] Collecting Grafana configuration..."
mkdir -p "${STAGING_DIR}/grafana/provisioning"
cp -r "${PROJECT_ROOT}/infra/observability/grafana/provisioning/"* "${STAGING_DIR}/grafana/provisioning/" 2>/dev/null || true
mkdir -p "${STAGING_DIR}/grafana/dashboards"
cp "${PROJECT_ROOT}/infra/observability/grafana/dashboards/"*.json "${STAGING_DIR}/grafana/dashboards/" 2>/dev/null || true

echo "[Config Backup] Collecting OTel configuration..."
mkdir -p "${STAGING_DIR}/otel"
cp "${PROJECT_ROOT}/infra/observability/otel/collector-config.yaml" "${STAGING_DIR}/otel/" 2>/dev/null || true

echo "[Config Backup] Collecting Prisma schema..."
mkdir -p "${STAGING_DIR}/prisma"
cp "${PROJECT_ROOT}/apps/api-gateway/prisma/schema.prisma" "${STAGING_DIR}/prisma/" 2>/dev/null || true
cp -r "${PROJECT_ROOT}/apps/api-gateway/prisma/migrations" "${STAGING_DIR}/prisma/" 2>/dev/null || true

echo "[Config Backup] Collecting environment templates..."
mkdir -p "${STAGING_DIR}/env"
cp "${PROJECT_ROOT}/apps/api-gateway/.env.example" "${STAGING_DIR}/env/" 2>/dev/null || true
cp "${PROJECT_ROOT}/pnpm-workspace.yaml" "${STAGING_DIR}/env/" 2>/dev/null || true
cp "${PROJECT_ROOT}/turbo.json" "${STAGING_DIR}/env/" 2>/dev/null || true
cp "${PROJECT_ROOT}/tsconfig.base.json" "${STAGING_DIR}/env/" 2>/dev/null || true
cp "${PROJECT_ROOT}/tsconfig.json" "${STAGING_DIR}/env/" 2>/dev/null || true

echo "[Config Backup] Collecting package.json files..."
mkdir -p "${STAGING_DIR}/packages"
cp "${PROJECT_ROOT}/package.json" "${STAGING_DIR}/packages/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/api-gateway/package.json" "${STAGING_DIR}/packages/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/worker/package.json" "${STAGING_DIR}/packages/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/web/package.json" "${STAGING_DIR}/packages/" 2>/dev/null || true
cp "${PROJECT_ROOT}/apps/agent/Cargo.toml" "${STAGING_DIR}/packages/" 2>/dev/null || true

echo "[Config Backup] Collecting K8s manifests..."
mkdir -p "${STAGING_DIR}/k8s"
cp -r "${PROJECT_ROOT}/infra/k8s/"* "${STAGING_DIR}/k8s/" 2>/dev/null || true

echo "[Config Backup] Collecting CI/CD pipelines..."
mkdir -p "${STAGING_DIR}/github/workflows"
cp "${PROJECT_ROOT}/.github/workflows/"*.yml "${STAGING_DIR}/github/workflows/" 2>/dev/null || true

echo "[Config Backup] Creating archive..."
tar -czf "${ARCHIVE}" -C "${STAGING_DIR}" . 2>/dev/null
FILE_SIZE=$(stat -c%s "${ARCHIVE}" 2>/dev/null || stat -f%z "${ARCHIVE}" 2>/dev/null || echo "0")
sha256sum "${ARCHIVE}" > "${ARCHIVE}.sha256"

echo "[Config Backup] Archive: $(basename "${ARCHIVE}") (${FILE_SIZE} bytes)"
echo "[Config Backup] SHA-256: $(awk '{print $1}' "${ARCHIVE}.sha256")"

ITEM_COUNT=$(tar -tzf "${ARCHIVE}" 2>/dev/null | wc -l)
echo "[Config Backup] Items archived: ${ITEM_COUNT}"

echo ""
echo "[Config Backup] ═══════════════════════════════════════"
echo "[Config Backup] Configuration backup complete"
echo "[Config Backup] Archive: ${ARCHIVE}"
echo "[Config Backup] Size: ${FILE_SIZE} bytes"
echo "[Config Backup] Items: ${ITEM_COUNT}"
echo "[Config Backup] ═══════════════════════════════════════"

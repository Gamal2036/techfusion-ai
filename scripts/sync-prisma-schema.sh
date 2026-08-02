#!/usr/bin/env bash
# Syncs the Prisma schema from API Gateway to Worker.
# Run this after any change to apps/api-gateway/prisma/schema.prisma
# to keep the worker's copy in sync.

set -euo pipefail

SOURCE="apps/api-gateway/prisma/schema.prisma"
TARGET="apps/worker/prisma/schema.prisma"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC_PATH="$REPO_ROOT/$SOURCE"
TGT_PATH="$REPO_ROOT/$TARGET"

if [ ! -f "$SRC_PATH" ]; then
  echo "ERROR: Source schema not found at $SOURCE" >&2
  exit 1
fi

if [ ! -f "$TGT_PATH" ]; then
  mkdir -p "$(dirname "$TGT_PATH")"
fi

if diff -q "$SRC_PATH" "$TGT_PATH" > /dev/null 2>&1; then
  echo "Schemas already in sync."
  exit 0
fi

cp "$SRC_PATH" "$TGT_PATH"
echo "Synced: $SOURCE -> $TARGET"

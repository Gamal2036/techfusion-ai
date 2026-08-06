#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Sync Linux installer assets into the web app static dir
#
# Regenerates:
#   apps/web/public/install-linux.sh          (served installer script)
#   apps/web/public/install-linux.sh.sha256   (integrity checksum)
#
# Run after editing scripts/install-linux.sh so the Dashboard-served
# bootstrap command always verifies against the published script.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/scripts/install-linux.sh"
DEST_DIR="$ROOT/apps/web/public"

if [ ! -f "$SRC" ]; then
  echo "ERROR: $SRC not found" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST_DIR/install-linux.sh"
chmod 0644 "$DEST_DIR/install-linux.sh"

# checksum file matches `sha256sum -c` format
HASH="$(sha256sum "$SRC" | awk '{print $1}')"
printf '%s  install-linux.sh\n' "$HASH" > "$DEST_DIR/install-linux.sh.sha256"

echo "Synced:"
echo "  $DEST_DIR/install-linux.sh"
echo "  $DEST_DIR/install-linux.sh.sha256  ($HASH)"

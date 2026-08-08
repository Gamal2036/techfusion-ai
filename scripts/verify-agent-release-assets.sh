#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Published Linux Agent Release Asset Verification (V1-AGENT-E2E-01,
# V1-STAGE-00B-R1)
#
# Downloads the published techfusion-agent-linux-{x86_64,aarch64} assets from a
# release base URL and verifies the full artifact contract the installer relies on:
#   - asset downloadable (HTTP 200)
#   - sibling <name>.sha256 obtainable and matches the binary
#   - binary is an ELF of the expected architecture
#   - native binary executes (--version) when the host arch matches
#   - native binary reports the certified version (AGENT_RELEASE_VERSION)
#   - native binary exposes the required lifecycle capabilities
#     (reset-identity / identity-status) — this is the V1-STAGE-00B-R1 gate that
#     catches a stale published artifact that predates those commands
#
# The default release base URL comes from scripts/agent-release-config.sh
# (the single source of truth).
#
# Non-destructive: writes only to a temp dir. No root, no system changes,
# no enrollment token, no API calls.
#
# Run:  bash scripts/verify-agent-release-assets.sh [release-base-url]
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=agent-release-config.sh
source "$ROOT/scripts/agent-release-config.sh"

RELEASE_BASE="${1:-$AGENT_RELEASE_BASE_URL}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAILED=0
ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[1;31m✘\033[0m %s\n' "$1"; FAILED=1; }

case "$(uname -m)" in
  x86_64|amd64) LOCAL_ARCH="x86_64" ;;
  aarch64|arm64) LOCAL_ARCH="aarch64" ;;
  *) LOCAL_ARCH="unknown" ;;
esac

echo "V1-AGENT-E2E-01 Published Release Asset Verification"
echo "────────────────────────────────────────────────────"
echo "  Release base: ${RELEASE_BASE}"
echo "  Expected version: ${AGENT_RELEASE_VERSION}"
echo "  Required capabilities: ${AGENT_REQUIRED_CAPABILITIES}"
echo "  Host arch:    ${LOCAL_ARCH}"
echo ""

for ARCH in x86_64 aarch64; do
  NAME="techfusion-agent-linux-${ARCH}"
  URL="${RELEASE_BASE%/}/${NAME}"
  echo "── ${NAME} ──"
  if ! curl -fsSL -o "$TMP/$NAME" "$URL"; then
    fail "$NAME downloadable (HTTP 200)"
    continue
  fi
  ok "$NAME downloadable (HTTP 200)"

  EXP="$(curl -fsSL "${URL}.sha256" 2>/dev/null | awk '{print $1}' || true)"
  if [ -z "$EXP" ]; then
    fail "$NAME checksum sidecar obtainable"
  else
    ok "$NAME checksum sidecar obtainable"
  fi

  ACT="$(sha256sum "$TMP/$NAME" | awk '{print $1}')"
  if [ -n "$EXP" ] && [ "$ACT" = "$EXP" ]; then
    ok "$NAME sha256 verified ($ACT)"
  else
    fail "$NAME sha256 verified (expected $EXP, got $ACT)"
  fi

  if [ "$ARCH" = "x86_64" ]; then ELF_PAT="x86-64"; else ELF_PAT="aarch64"; fi
  if file "$TMP/$NAME" | grep -q "$ELF_PAT"; then
    ok "$NAME is ELF $ARCH"
  else
    fail "$NAME is ELF $ARCH ($(file "$TMP/$NAME"))"
  fi

  if [ "$LOCAL_ARCH" = "$ARCH" ]; then
    chmod +x "$TMP/$NAME"
    if "$TMP/$NAME" --version >/dev/null 2>&1; then
      ok "$NAME executes (--version) on native host"
    else
      fail "$NAME executes (--version) on native host"
    fi
    VER_OUT="$("$TMP/$NAME" --version 2>/dev/null || true)"
    if printf '%s\n' "$VER_OUT" | grep -q "techfusion-agent ${AGENT_RELEASE_VERSION}$"; then
      ok "$NAME reports certified version techfusion-agent ${AGENT_RELEASE_VERSION}"
    else
      fail "$NAME certified version (got '$VER_OUT', want techfusion-agent ${AGENT_RELEASE_VERSION})"
    fi
    for cap in $AGENT_REQUIRED_CAPABILITIES; do
      if "$TMP/$NAME" --help 2>/dev/null | grep -qw "$cap"; then
        ok "$NAME exposes lifecycle command: ${cap}"
      else
        fail "$NAME lifecycle command: ${cap} (stale artifact detected)"
      fi
    done
  fi
  echo ""
done

echo "────────────────────────────────────────────────────"
if [ "$FAILED" = "0" ]; then
  echo "Result: ALL RELEASE ASSET CHECKS PASSED"
  exit 0
fi
echo "Result: RELEASE ASSET CHECKS FAILED"
exit 1

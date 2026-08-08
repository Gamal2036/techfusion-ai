#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Installer Artifact Regression Test (V1-STAGE-00B-R1)
#
# Simulates the exact real-device path that regressed:
#   published/current artifact -> installer -> installed binary
# and asserts the INSTALLED binary (not the source-tree binary) exposes the
# certified Agent lifecycle commands:
#   reset-identity
#   identity-status
#
# It also executes the installer's OWN post-install capability gate verbatim
# against the downloaded artifact, so a stale published binary (one that also
# reports the same base version but predates those commands) fails here first.
#
# Artifact sources (pick one):
#   (default)        -- the certified release base from agent-release-config.sh
#   --release <URL>  -- any published release base URL
#   --url <URL>      -- direct download URL (sibling <url>.sha256 verified)
#   --binary <PATH>  -- a local binary (offline / pre-publish preparation)
#
# Non-destructive: downloads into a temp dir only. No root, no system changes.
# Run:  bash scripts/test-installer-artifact-regression.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=agent-release-config.sh
source "$ROOT/scripts/agent-release-config.sh"

INSTALLER="$ROOT/scripts/install-linux.sh"

RELEASE_BASE=""
BINARY_URL=""
BINARY_PATH=""
EXPECTED_SHA256=""

usage() {
  cat <<EOF
TechFusion AI — Installer Artifact Regression Test

Usage:
  bash scripts/test-installer-artifact-regression.sh [--release <base-url>]
                                                    [--url <url>] [--binary <path>]
                                                    [--sha256 <hex>]

  Default source: the certified release base from scripts/agent-release-config.sh
  (${AGENT_RELEASE_TAG}).

  Asserts the downloaded/installed binary:
    - sha256 matches the sibling .sha256 (or --sha256)
    - reports techfusion-agent ${AGENT_RELEASE_VERSION}
    - --help exposes every required capability (${AGENT_REQUIRED_CAPABILITIES})
    - passes the installer's own post-install capability gate verbatim

  Exit 0 = artifact current & certified. Exit 1 = any contract violation.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --release) RELEASE_BASE="${2:?missing value for --release}"; shift 2 ;;
    --url)     BINARY_URL="${2:?missing value for --url}"; shift 2 ;;
    --binary)  BINARY_PATH="${2:?missing value for --binary}"; shift 2 ;;
    --sha256)  EXPECTED_SHA256="${2:?missing value for --sha256}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [ -n "$RELEASE_BASE" ] && [ -n "$BINARY_URL" ]; then
  echo "ERROR: provide exactly one artifact source: --release OR --url" >&2
  exit 1
fi
if [ -n "$RELEASE_BASE" ] && [ -n "$BINARY_PATH" ]; then
  echo "ERROR: provide exactly one artifact source: --release OR --binary" >&2
  exit 1
fi
if [ -n "$BINARY_URL" ] && [ -n "$BINARY_PATH" ]; then
  echo "ERROR: provide exactly one artifact source: --url OR --binary" >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64|amd64)  BINARY_ARCH="x86_64" ;;
  aarch64|arm64) BINARY_ARCH="aarch64" ;;
  *) echo "ERROR: unsupported host architecture for regression test: $(uname -m)" >&2; exit 1 ;;
esac

[ -f "$INSTALLER" ] || { echo "ERROR: $INSTALLER not found" >&2; exit 1; }

FAILED=0
ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[1;31m✘\033[0m %s\n' "$1"; FAILED=1; }

echo "V1-STAGE-00B-R1 Installer Artifact Regression Test"
echo "───────────────────────────────────────────────────"
echo "  Expected version:       techfusion-agent ${AGENT_RELEASE_VERSION}"
echo "  Required capabilities:  ${AGENT_REQUIRED_CAPABILITIES}"
echo "  Host architecture:      ${BINARY_ARCH}"
echo ""

# Extract the installer's post-install capability gate VERBATIM.
GATE_BLOCK="$(awk '/^[[:space:]]*for cap in \$REQUIRED_CAPABILITIES; do$/{f=1} f{print} f && /^[[:space:]]*done$/{exit}' "$INSTALLER")"
if [ -z "$GATE_BLOCK" ]; then
  echo "ERROR: could not extract the capability gate from $INSTALLER" >&2
  exit 1
fi
ok "extracted installer post-install capability gate verbatim"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
BIN_FILE="$TMP/techfusion-agent"

if [ -n "$BINARY_PATH" ]; then
  [ -f "$BINARY_PATH" ] || { echo "ERROR: local binary not found: $BINARY_PATH" >&2; exit 1; }
  cp "$BINARY_PATH" "$BIN_FILE"
  ok "using local binary: ${BINARY_PATH}"
else
  if [ -n "$RELEASE_BASE" ]; then
    case "$RELEASE_BASE" in
      http://*|https://*) BINARY_URL="${RELEASE_BASE%/}/techfusion-agent-linux-${BINARY_ARCH}" ;;
      *) echo "ERROR: refusing unsupported release scheme: ${RELEASE_BASE}" >&2; exit 1 ;;
    esac
  elif [ -z "$BINARY_URL" ]; then
    BINARY_URL="${AGENT_RELEASE_BASE_URL%/}/techfusion-agent-linux-${BINARY_ARCH}"
    RELEASE_BASE="${AGENT_RELEASE_BASE_URL}"
  fi

  echo "  Downloading: ${BINARY_URL}"
  if ! curl -fsSL --max-time 60 -o "$BIN_FILE" "$BINARY_URL" 2>/dev/null; then
    fail "published artifact downloadable"
    echo ""
    echo "───────────────────────────────────────────────────"
    echo "The certified release (${AGENT_RELEASE_TAG}) is not published/reachable."
    echo "Publish it first, then re-run; or run offline against the built artifact:"
    echo "  bash scripts/test-installer-artifact-regression.sh --binary apps/agent/target/release/agent"
    exit 1
  fi
  ok "published artifact downloadable"

  if [ -z "$EXPECTED_SHA256" ]; then
    EXPECTED_SHA256="$(curl -fsSL --max-time 30 "${BINARY_URL}.sha256" 2>/dev/null | awk '{print $1}' || true)"
  fi
  if [ -z "$EXPECTED_SHA256" ]; then
    fail "sibling .sha256 sidecar obtainable"
  else
    ok "sibling .sha256 sidecar obtainable"
  fi
  ACTUAL_SHA256="$(sha256sum "$BIN_FILE" | awk '{print $1}')"
  if [ -n "$EXPECTED_SHA256" ] && [ "$ACTUAL_SHA256" = "$EXPECTED_SHA256" ]; then
    ok "artifact sha256 verified (${ACTUAL_SHA256:0:16}...)"
  else
    fail "artifact sha256 match (expected ${EXPECTED_SHA256:-none}, got ${ACTUAL_SHA256})"
  fi
fi

chmod +x "$BIN_FILE" 2>/dev/null || true

# 1. binary executes
if "$BIN_FILE" --version >/dev/null 2>&1; then
  ok "binary executes (--version)"
else
  fail "binary executes (--version)"
fi

# 2. certified version reported
VER_OUT="$("$BIN_FILE" --version 2>/dev/null || true)"
if printf '%s\n' "$VER_OUT" | grep -q "techfusion-agent ${AGENT_RELEASE_VERSION}$"; then
  ok "binary reports certified version: techfusion-agent ${AGENT_RELEASE_VERSION}"
else
  fail "binary version (got '$VER_OUT', want techfusion-agent ${AGENT_RELEASE_VERSION})"
fi

# 3. required capabilities present in --help (the regression this test exists for)
HELP_OUT="$("$BIN_FILE" --help 2>/dev/null || true)"
for cap in $AGENT_REQUIRED_CAPABILITIES; do
  if printf '%s\n' "$HELP_OUT" | grep -qw "$cap"; then
    ok "installed binary --help exposes: ${cap}"
  else
    fail "installed binary --help contains: ${cap} (STALE ARTIFACT — matches the real-device regression)"
  fi
done

# 4. installer's own post-install gate passes verbatim against the artifact
#    (locals are initialized exactly as the installer's verify_agent_capabilities
#    function does; the extracted block itself is untouched).
if REQUIRED_CAPABILITIES="$AGENT_REQUIRED_CAPABILITIES" bash -c '
    ok()  { :; }
    die() { echo "die: $*" >&2; exit 3; }
    gate() {
      local bin="$1" label="$2" cap
      '"$GATE_BLOCK"'
    }
    gate "$1" "installed agent"
  ' _ "$BIN_FILE" 2>/dev/null; then
  ok "installer post-install capability gate passes verbatim"
else
  fail "installer post-install capability gate (would have refused this artifact)"
fi

echo ""
echo "───────────────────────────────────────────────────"
if [ "$FAILED" = "0" ]; then
  echo "Result: INSTALLER ARTIFACT REGRESSION TEST PASSED"
  echo "  The artifact the installer would download is CURRENT and CERTIFIED."
  exit 0
fi
echo "Result: INSTALLER ARTIFACT REGRESSION TEST FAILED"
echo "  The artifact is STALE — the installer must not present it as a current install."
exit 1

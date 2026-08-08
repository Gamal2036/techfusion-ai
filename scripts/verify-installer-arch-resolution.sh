#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Installer Architecture & Release-URL Resolution Verification
# (V1-AGENT-E2E-01)
#
# Dynamically executes the arch-detection + release-resolution block extracted
# VERBATIM from scripts/install-linux.sh and asserts the per-architecture asset
# contract:
#   x86_64/amd64   -> .../techfusion-agent-linux-x86_64
#   aarch64/arm64  -> .../techfusion-agent-linux-aarch64
#   other          -> exit 2 (unsupported architecture, clear failure)
#   non-http(s) base -> exit 3 (fail closed)
#
# Non-destructive: runs in a subshell with a mocked uname; touches nothing.
# Run:  bash scripts/verify-installer-arch-resolution.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALLER="$ROOT/scripts/install-linux.sh"

FAILED=0
ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[1;31m✘\033[0m %s\n' "$1"; FAILED=1; }

# Extract the arch case + release resolution block verbatim from the real installer.
BLOCK="$(sed -n '/case "\$(uname -m)" in/,/^fi$/p' "$INSTALLER")"

run_resolution() { # <arch>
  local arch="$1" expected="$2"
  local out code
  out="$(MOCK_UNAME_M="$arch" bash -c '
    set -euo pipefail
    ok()  { :; }
    die() { echo "die: $*" >&2; exit "${1:-1}"; }
    uname() { printf "%s\n" "$MOCK_UNAME_M"; }
    RELEASE_BASE_URL="https://downloads.example/releases/download/v1.0.0-agent-beta.4"
    '"$BLOCK"'
    printf "%s\n" "$BINARY_URL"
  ' 2>&1)" || code=$?
  code="${code:-0}"

  if [ "$expected" = "exit:2" ]; then
    if [ "$code" = "2" ]; then ok "unsupported arch (${arch}) fails with exit 2"; else fail "unsupported arch (${arch}) exit (got ${code:-0})"; fi
    return
  fi

  if [ "$code" = "0" ] && [ "$out" = "$expected" ]; then
    ok "${arch} -> ${expected}"
  else
    fail "${arch} resolution (expected ${expected}, got exit ${code:-0} / ${out})"
  fi
}

run_scheme_fail() { # <base>
  local base="$1"
  local code
  ( MOCK_UNAME_M="x86_64" RELEASE_BASE_URL="$base" bash -c '
    set -euo pipefail
    ok()  { :; }
    die() { echo "die: $*" >&2; exit "${1:-1}"; }
    uname() { printf "%s\n" "$MOCK_UNAME_M"; }
    '"$BLOCK"'
  ' >/dev/null 2>&1 ) || code=$?
  code="${code:-0}"
  if [ "$code" = "3" ]; then ok "non-http(s) release base fails closed (exit 3)"; else fail "non-http(s) release base (got exit ${code:-0})"; fi
}

echo "V1-AGENT-E2E-01 Installer Arch / URL Resolution Verification"
echo "────────────────────────────────────────────────────────────"
[ -n "$BLOCK" ] || { echo "ERROR: could not extract arch block from $INSTALLER" >&2; exit 1; }
ok "extracted arch/resolution block verbatim from installer"

run_resolution "x86_64" "https://downloads.example/releases/download/v1.0.0-agent-beta.4/techfusion-agent-linux-x86_64"
run_resolution "amd64"  "https://downloads.example/releases/download/v1.0.0-agent-beta.4/techfusion-agent-linux-x86_64"
run_resolution "aarch64" "https://downloads.example/releases/download/v1.0.0-agent-beta.4/techfusion-agent-linux-aarch64"
run_resolution "arm64"  "https://downloads.example/releases/download/v1.0.0-agent-beta.4/techfusion-agent-linux-aarch64"
run_resolution "riscv64" "exit:2"
run_scheme_fail "ftp://downloads.example/artifacts"

echo "────────────────────────────────────────────────────────────"
if [ "$FAILED" = "0" ]; then
  echo "Result: ALL ARCH / URL RESOLUTION CHECKS PASSED"
  exit 0
fi
echo "Result: ARCH / URL RESOLUTION CHECKS FAILED"
exit 1

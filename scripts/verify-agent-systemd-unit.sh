#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Linux Agent systemd Unit Verification (V1-AGENT-E2E-02A)
#
# Extracts the techfusion-agent.service unit VERBATIM from scripts/install-linux.sh
# and verifies the production service contract the installer enforces:
#   - stable unit name + installed production binary path
#   - environment/config file wiring (no token, no TF_ORG_TOKEN in the unit)
#   - restart policy (Restart=on-failure + RestartSec) and network dependency
#   - durable state directory + hardening options
#   - enable-at-boot (WantedBy=multi-user.target)
#   - the unit passes systemd-analyze verify (syntax/directive validity)
#
# Non-destructive: writes only to a temp dir; requires no root.
# Run:  bash scripts/verify-agent-systemd-unit.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALLER="$ROOT/scripts/install-linux.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAILED=0
ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$1"; }
fail() { printf '  \033[1;31m✘\033[0m %s\n' "$1"; FAILED=1; }

# Extract the heredoc written by the installer between
#   cat > "$UNIT_PATH" <<'UNIT'   and the closing   UNIT
UNIT_TEXT="$(sed -n "/cat > \"\$UNIT_PATH\" <<'UNIT'/,/^UNIT$/p" "$INSTALLER" | sed '1d;$d')"

echo "V1-AGENT-E2E-02A systemd Unit Verification"
echo "──────────────────────────────────────────"
if [ -z "$UNIT_TEXT" ]; then
  echo "ERROR: could not extract unit text from $INSTALLER" >&2
  exit 1
fi
ok "extracted unit text verbatim from installer"

UNIT_FILE="$TMP/techfusion-agent.service"
printf '%s\n' "$UNIT_TEXT" > "$UNIT_FILE"

check_unit() { # desc
  local desc="$1"
  if grep -qE "$2" "$UNIT_FILE"; then ok "$desc"; else fail "$desc"; fi
}

# 1. identity / paths
check_unit "stable unit name (techfusion-agent.service)" '^Description=TechFusion AI Device Agent$'
check_unit "installed production binary ExecStart" '^ExecStart=/usr/local/bin/techfusion-agent$'
check_unit "environment file wiring" '^EnvironmentFile=/etc/techfusion/agent.env$'

# 2. restart / resilience
check_unit "restart policy on-failure" '^Restart=on-failure$'
check_unit "restart delay 5s" '^RestartSec=5$'
check_unit "network-online dependency (Wants)" '^Wants=network-online.target$'
check_unit "network-online dependency (After)" '^After=network-online.target$'

# 3. durable identity/state
check_unit "StateDirectory=techfusion" '^StateDirectory=techfusion$'
check_unit "StateDirectoryMode=0700" '^StateDirectoryMode=0700$'

# 4. hardening (compatible subset)
check_unit "NoNewPrivileges=true" '^NoNewPrivileges=true$'
check_unit "ProtectSystem=strict" '^ProtectSystem=strict$'
check_unit "ProtectHome=true" '^ProtectHome=true$'
check_unit "PrivateTmp=true" '^PrivateTmp=true$'

# 5. enable at boot
check_unit "WantedBy=multi-user.target" '^WantedBy=multi-user.target$'

# 6. no secrets
if ! grep -qE 'tfenr_|TF_ORG_TOKEN' "$UNIT_FILE"; then
  ok "unit contains no enrollment token / TF_ORG_TOKEN"
else
  fail "unit contains a token or TF_ORG_TOKEN"
fi

# 7. systemd-analyze verify (syntax/directive validity).
#    Rewrite ExecStart to a stub so the check works on CI where the production
#    binary is not installed; the real path is asserted above.
STUB="$TMP/stub"
printf '#!/bin/sh\n' > "$STUB"
chmod 0755 "$STUB"
VERIFY_FILE="$TMP/verify.service"
sed "s#^ExecStart=/usr/local/bin/techfusion-agent#ExecStart=$STUB#" "$UNIT_FILE" > "$VERIFY_FILE"

if command -v systemd-analyze >/dev/null 2>&1; then
  VERIFY_OUT="$(systemd-analyze verify "$VERIFY_FILE" 2>&1 || true)"
  if [ -z "$VERIFY_OUT" ]; then
    ok "systemd-analyze verify: unit is valid (no warnings/errors)"
  else
    FAILED=1
    printf '  \033[1;31m✘\033[0m systemd-analyze verify reported:\n'
    printf '%s\n' "$VERIFY_OUT" | sed 's/^/       /'
  fi
else
  fail "systemd-analyze not available on this host"
fi

echo "──────────────────────────────────────────"
if [ "$FAILED" = "0" ]; then
  echo "Result: ALL SYSTEMD UNIT CHECKS PASSED"
  exit 0
fi
echo "Result: SYSTEMD UNIT CHECKS FAILED"
exit 1

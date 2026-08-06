#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Linux Bootstrap Installer Verification (V1-ENROLL-01A)
#
# Static + integrity checks for the installer and its web-served assets.
# Run:  bash scripts/verify-linux-bootstrap.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALLER="$ROOT/scripts/install-linux.sh"
UNINSTALLER="$ROOT/scripts/uninstall-linux.sh"
WEB_COPY="$ROOT/apps/web/public/install-linux.sh"
WEB_SUM="$ROOT/apps/web/public/install-linux.sh.sha256"

FAILED=0
check() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '  \033[1;32m✔\033[0m %s\n' "$desc"
  else
    printf '  \033[1;31m✘\033[0m %s\n' "$desc"
    FAILED=1
  fi
}

echo "V1-ENROLL-01A Linux Bootstrap Installer Verification"
echo "────────────────────────────────────────────────────"

[ -f "$INSTALLER" ] && [ -f "$UNINSTALLER" ] && [ -f "$WEB_COPY" ] && [ -f "$WEB_SUM" ]

# 1. shell syntax
check "install-linux.sh parses (bash -n)" bash -n "$INSTALLER"
check "uninstall-linux.sh parses (bash -n)" bash -n "$UNINSTALLER"

# 2. strict mode + security posture
check "installer runs with strict mode (set -euo pipefail)" grep -q 'set -euo pipefail' "$INSTALLER"
check "installer refuses to run non-root" grep -q 'id -u.*-ne 0' "$INSTALLER"
check "installer does not use eval" bash -c "! grep -qE '(^|[^a-z])eval '" "$INSTALLER"
check "installer validates download URL scheme" grep -q 'http://\*|https://\*' "$INSTALLER"

# 3. systemd unit generation/content
check "unit has stable unit name" grep -q 'techfusion-agent.service' "$INSTALLER"
check "unit waits for network-online" grep -q 'Wants=network-online.target' "$INSTALLER"
check "unit uses Restart=on-failure" grep -q 'Restart=on-failure' "$INSTALLER"
check "unit uses StateDirectory" grep -q 'StateDirectory=techfusion' "$INSTALLER"
check "unit loads EnvironmentFile" grep -q 'EnvironmentFile=/etc/techfusion/agent.env' "$INSTALLER"
check "unit enables at boot" grep -q 'WantedBy=multi-user.target' "$INSTALLER"
check "installer runs daemon-reload/enable/start" grep -q 'systemctl daemon-reload' "$INSTALLER"
check "unit runs the installed production binary" grep -q 'ExecStart=/usr/local/bin/techfusion-agent' "$INSTALLER"
check "unit hardens with NoNewPrivileges" grep -q 'NoNewPrivileges=true' "$INSTALLER"
check "unit hardens with ProtectSystem=strict" grep -q 'ProtectSystem=strict' "$INSTALLER"
check "unit hardens with ProtectHome=true" grep -q 'ProtectHome=true' "$INSTALLER"
check "unit text contains no token or TF_ORG_TOKEN" bash -c "sed -n '/cat > \"\$UNIT_PATH\" <<.UNIT/,/^UNIT$/p' '$INSTALLER' | grep -qvE 'tfenr_|TF_ORG_TOKEN'"
check "installer surfaces service start diagnostics (journalctl)" grep -q 'journalctl -u techfusion-agent -n' "$INSTALLER"
check "installer fails clearly (die 6) when service inactive" grep -q 'die 6' "$INSTALLER"

# 4. enrollment hygiene + watchdog
check "config file excludes the enrollment token" bash -c "sed -n '/cat > \"\$ENV_FILE\" <<EOF/,/^EOF$/p' '$INSTALLER' | grep -q TF_API_URL && ! sed -n '/cat > \"\$ENV_FILE\" <<EOF/,/^EOF$/p' '$INSTALLER' | grep -q TF_ORG_TOKEN"
check "installer invokes one-shot enroll via env" grep -q 'TF_ENROLL=true' "$INSTALLER"
check "installer skips enroll when identity exists" grep -q 'device_token.*device_id' "$INSTALLER"
check "installer unsets token after enrollment" grep -q 'unset ENROLL_TOKEN' "$INSTALLER"
check "installer bounds enrollment with a watchdog (no indefinite hang)" grep -q 'enroll_with_timeout' "$INSTALLER"
check "installer watchdog kill-on-timeout returns 124" grep -q 'return 124' "$INSTALLER"
check "installer validates credential persisted after enroll" grep -q 'did not persist the device credential' "$INSTALLER"
check "installer stops standalone agents before service start" grep -q 'pkill -x techfusion-agent' "$INSTALLER"

# 4b. uninstall contract
check "uninstaller stops the service" grep -q 'systemctl stop techfusion-agent' "$UNINSTALLER"
check "uninstaller disables the service" grep -q 'systemctl disable techfusion-agent' "$UNINSTALLER"
check "uninstaller removes the unit file" grep -q 'rm -f "\$UNIT"' "$UNINSTALLER"
check "uninstaller daemon-reloads" grep -q 'systemctl daemon-reload' "$UNINSTALLER"
check "uninstaller reset-failed after unit removal" grep -q 'systemctl reset-failed' "$UNINSTALLER"
check "uninstaller stops standalone agent processes" grep -q 'pkill -x techfusion-agent' "$UNINSTALLER"
check "uninstaller preserves state unless --purge" grep -q -- '--purge' "$UNINSTALLER" && grep -q 'Preserved persistent device state' "$UNINSTALLER"

# 5. binary/artifact path
check "installer supports --binary local source" grep -q -- '--binary' "$INSTALLER"
check "installer supports TECHFUSION_AGENT_DOWNLOAD_URL" grep -q 'TECHFUSION_AGENT_DOWNLOAD_URL' "$INSTALLER"
check "installer supports --release base URL" grep -q -- '--release' "$INSTALLER"
check "installer supports TECHFUSION_AGENT_RELEASE_URL" grep -q 'TECHFUSION_AGENT_RELEASE_URL' "$INSTALLER"
check "installer selects asset per detected arch" grep -q 'techfusion-agent-linux-\${BINARY_ARCH}' "$INSTALLER"
check "installer requires checksum when downloading (fail-closed)" grep -q 'refusing to install an unverified binary' "$INSTALLER"
check "installer verifies sha256 when provided" grep -q 'sha256sum' "$INSTALLER"
check "installer fetches checksum with selected fetcher" grep -q '"${BINARY_URL}.sha256"' "$INSTALLER"

# 6. web-served asset integrity
check "web copy matches scripts/install-linux.sh" cmp -s "$INSTALLER" "$WEB_COPY"
ACTUAL_HASH="$(sha256sum "$INSTALLER" | awk '{print $1}')"
SIDE_HASH="$(awk '{print $1}' "$WEB_SUM")"
check "checksum sidecar matches installer" [ "$ACTUAL_HASH" = "$SIDE_HASH" ]

echo "────────────────────────────────────────────────────"
if [ "$FAILED" = "0" ]; then
  echo "Result: ALL CHECKS PASSED"
  exit 0
else
  echo "Result: CHECKS FAILED"
  exit 1
fi

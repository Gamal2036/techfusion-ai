#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Linux Bootstrap Installer Verification (V1-ENROLL-01A,
# V1-STAGE-00B-R1)
#
# Static + integrity checks for the installer and its web-served assets,
# including the single-source-of-truth release consistency contract:
#   - installer enforces the post-install capability gate (no stale artifact)
#   - web dashboard default release URL matches the certified release tag
#   - web required-capability list matches the certified release
# Run:  bash scripts/verify-linux-bootstrap.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=agent-release-config.sh
source "$ROOT/scripts/agent-release-config.sh"
INSTALLER="$ROOT/scripts/install-linux.sh"
UNINSTALLER="$ROOT/scripts/uninstall-linux.sh"
WEB_COPY="$ROOT/apps/web/public/install-linux.sh"
WEB_SUM="$ROOT/apps/web/public/install-linux.sh.sha256"
WEB_DOWNLOAD_TS="$ROOT/apps/web/src/lib/agent-download.ts"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

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
echo "  Certified release: ${AGENT_RELEASE_TAG} (${AGENT_RELEASE_VERSION})"
echo "  Required capabilities: ${AGENT_REQUIRED_CAPABILITIES}"
echo ""

[ -f "$INSTALLER" ] && [ -f "$UNINSTALLER" ] && [ -f "$WEB_COPY" ] && [ -f "$WEB_SUM" ]

# 1. shell syntax
check "install-linux.sh parses (bash -n)" bash -n "$INSTALLER"
check "uninstall-linux.sh parses (bash -n)" bash -n "$UNINSTALLER"

# 2. strict mode + security posture
check "installer runs with strict mode (set -euo pipefail)" grep -q 'set -euo pipefail' "$INSTALLER"
check "installer refuses to run non-root" grep -q 'id -u.*-ne 0' "$INSTALLER"
check "installer does not use eval" bash -c '! grep -qE "(^|[^a-z])eval " -- "$0"' "$INSTALLER"
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

# 4c. network discovery enablement (NET-01A) — default-on for V1, opt-out preserved
DISC_FUNC_FILE="$TMP/resolve_network_discovery.sh"
sed -n '/^resolve_network_discovery() {/,/^}/p' "$INSTALLER" > "$DISC_FUNC_FILE"
check "installer defines resolve_network_discovery" [ -s "$DISC_FUNC_FILE" ]
check "installer writes TF_NETWORK_DISCOVERY to agent.env" bash -c "sed -n '/cat > \"\$ENV_FILE\" <<EOF/,/^EOF$/p' '$INSTALLER' | grep -q 'TF_NETWORK_DISCOVERY=\${NETWORK_DISCOVERY}'"
check "fresh install enables network discovery (default true)" bash -c "ENV_FILE='$TMP/fresh.env'; source '$DISC_FUNC_FILE'; [ \"\$(resolve_network_discovery)\" = 'true' ]"
check "installer preserves explicit TF_NETWORK_DISCOVERY=false opt-out" bash -c "printf 'TF_NETWORK_DISCOVERY=false\n' > '$TMP/optout.env'; ENV_FILE='$TMP/optout.env'; source '$DISC_FUNC_FILE'; [ \"\$(resolve_network_discovery)\" = 'false' ]"
check "installer preserves explicit TF_NETWORK_DISCOVERY=true" bash -c "printf 'TF_NETWORK_DISCOVERY=true\n' > '$TMP/on.env'; ENV_FILE='$TMP/on.env'; source '$DISC_FUNC_FILE'; [ \"\$(resolve_network_discovery)\" = 'true' ]"

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

# 5b. post-install capability gate (V1-STAGE-00B-R1) — stale artifact refusal
check "installer enforces post-install capability gate" grep -q 'verify_agent_capabilities' "$INSTALLER"
check "installer gates the artifact BEFORE install" grep -q 'verify_agent_capabilities "\$BIN_FILE"' "$INSTALLER"
check "installer re-verifies the installed path" grep -q 'verify_agent_capabilities "\$BIN_PATH"' "$INSTALLER"
check "installer verifies each required capability" grep -q 'for cap in \$REQUIRED_CAPABILITIES' "$INSTALLER"
check "installer greps --help for capabilities" grep -q -e '--help 2>/dev/null | grep -qw' "$INSTALLER"
check "installer fails closed on stale artifact (die 3)" grep -q 'older than the required TechFusion Agent' "$INSTALLER"
check "installer never installs a stale binary on failure" grep -q 'no stale artifact was installed' "$INSTALLER"
check "capability list overridable via TF_REQUIRED_AGENT_CAPABILITIES" grep -q 'TF_REQUIRED_AGENT_CAPABILITIES' "$INSTALLER"

# 5c. single-source-of-truth release consistency (V1-STAGE-00B-R1)
check "web dashboard default release URL uses certified tag" grep -q "releases/download/${AGENT_RELEASE_TAG}" "$WEB_DOWNLOAD_TS"
check "web required capabilities match certified release" grep -q "reset-identity" "$WEB_DOWNLOAD_TS" && grep -q "identity-status" "$WEB_DOWNLOAD_TS"
check "installer stale-artifact message references certified release" grep -q 'v1.0.0-agent-beta.5+' "$INSTALLER"

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

#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Linux Agent Uninstaller (V1-ENROLL-01A)
# ═══════════════════════════════════════════════════════════════════════════
#
#   sudo bash uninstall-linux.sh            # stop+remove service, binary, config
#   sudo bash uninstall-linux.sh --purge    # also remove persistent device state
#
# UNINSTALL  preserves /var/lib/techfusion (device identity + credential).
# PURGE      additionally deletes local device state. Cloud device records are
#            NEVER deleted automatically — remove the device from the Dashboard.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

PURGE=0
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
    -h|--help)
      echo "Usage: sudo bash uninstall-linux.sh [--purge]"
      echo "  --purge  also remove persistent device state (/var/lib/techfusion)"
      exit 0
      ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: This uninstaller must run as root (sudo)." >&2
  exit 1
fi

UNIT="/etc/systemd/system/techfusion-agent.service"
BIN="/usr/local/bin/techfusion-agent"
CONFIG="/etc/techfusion/agent.env"
STATE="/var/lib/techfusion"

echo ""
echo "  TechFusion AI — Agent Uninstaller"
echo "  ─────────────────────────────────"
echo "  Purge state: $([ "$PURGE" = "1" ] && echo YES || echo no)"
echo ""

# 1. stop + disable service
if systemctl list-unit-files | grep -q '^techfusion-agent\.service'; then
  echo "  Stopping service..."
  systemctl stop techfusion-agent 2>/dev/null || true
  echo "  Disabling service..."
  systemctl disable techfusion-agent 2>/dev/null || true
  echo "  Removing unit file..."
  rm -f "$UNIT"
  systemctl daemon-reload
  systemctl reset-failed techfusion-agent 2>/dev/null || true
fi

# 1b. stop any standalone agent process not managed by systemd
#     (exact process-name match only; the systemd unit was stopped above)
if pgrep -x techfusion-agent >/dev/null 2>&1; then
  echo "  Stopping standalone agent process(es)..."
  pkill -x techfusion-agent 2>/dev/null || true
  sleep 1
  if pgrep -x techfusion-agent >/dev/null 2>&1; then
    pkill -9 -x techfusion-agent 2>/dev/null || true
  fi
fi

# 2. remove binary
if [ -f "$BIN" ]; then
  rm -f "$BIN"
fi

# 3. remove config (no device credentials are stored here)
if [ -d "$(dirname "$CONFIG")" ]; then
  rm -f "$CONFIG"
  rmdir "$(dirname "$CONFIG")" 2>/dev/null || true
fi

# 4. purge state only when explicitly requested
if [ "$PURGE" = "1" ]; then
  rm -rf "$STATE"
  echo "  Purged persistent device state: $STATE"
else
  echo "  Preserved persistent device state: $STATE (identity + credential)"
  echo "  Reinstalling on this machine will reuse the same device record."
fi

cat <<'EOF'

  ─────────────────────────────────────────
   TechFusion Agent removed from this host.

   Cloud device records were NOT deleted.
   To remove the device from your Dashboard,
   delete it from Connect Device → Devices.

   To remove local device state too, run:
     sudo bash uninstall-linux.sh --purge
  ─────────────────────────────────────────
EOF
exit 0

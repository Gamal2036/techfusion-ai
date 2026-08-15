#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Linux Agent Installer / Bootstrap (V1-ENROLL-01A)
# ═══════════════════════════════════════════════════════════════════════════
#
# One-time install + enrollment for the TechFusion Device Agent.
#
#   sudo bash install-linux.sh --api https://your-host \
#                              --enroll-token tfenr_<token> \
#                              --release <release-base-url>
#
# Binary sources (exactly one):
#   --release <base>   Base URL of a published agent release; the installer
#                      downloads techfusion-agent-linux-<arch> and its sibling
#                      <name>.sha256 for the detected architecture
#                      (x86_64/amd64 -> techfusion-agent-linux-x86_64,
#                       aarch64/arm64 -> techfusion-agent-linux-aarch64).
#   --url <url>        Direct download URL of the agent binary (sibling
#                      <url>.sha256 is verified when no --sha256 is given).
#   --binary <path>    Install from a local binary file (testing/offline).
#
# The enrollment token is used once for first registration, is never written
# to disk, and is NOT required after the agent's persistent identity is stored.
#
# Idempotent: re-running with existing state reuses the stored device identity
# and skips enrollment.
#
# Exit codes:
#   0  success
#   1  usage / argument error
#   2  unsupported platform or missing dependency
#   3  binary acquisition or verification failure (incl. stale/old artifact)
#   4  configuration error
#   5  enrollment failure
#   6  systemd/service failure
#
# Post-install capability gate: after installing, the installer verifies the
# binary actually provides the certified Agent lifecycle commands
# (reset-identity / identity-status, overridable via
# TF_REQUIRED_AGENT_CAPABILITIES). If the downloaded artifact predates those
# commands, the installer FAILS instead of reporting a successful install.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

VERSION="1.3.0"

API_URL=""
ENROLL_TOKEN=""
BINARY_URL="${TECHFUSION_AGENT_DOWNLOAD_URL:-}"
RELEASE_BASE_URL="${TECHFUSION_AGENT_RELEASE_URL:-}"
BINARY_PATH_ARG=""
EXPECTED_SHA256=""
STATE_DIR="/var/lib/techfusion"
PRESERVE_IDENTITY=1
BIN_PATH="/usr/local/bin/techfusion-agent"
CONFIG_DIR="/etc/techfusion"
ENV_FILE="${CONFIG_DIR}/agent.env"
UNIT_PATH="/etc/systemd/system/techfusion-agent.service"
LOG_LEVEL="info"
ENROLL_TIMEOUT_SECS="${TF_ENROLL_TIMEOUT_SECS:-90}"
# Lifecycle capabilities the certified agent build MUST expose. A stale artifact
# that predates these commands is refused (fail closed). Override for other
# release tracks with TF_REQUIRED_AGENT_CAPABILITIES="cap1 cap2 ...".
REQUIRED_CAPABILITIES="${TF_REQUIRED_AGENT_CAPABILITIES:-reset-identity identity-status}"

usage() {
  cat <<'EOF'
TechFusion AI Linux Agent Installer

Usage:
  sudo bash install-linux.sh [options]

Required:
  --api <URL>          TechFusion API gateway URL (e.g. https://host:3001)

Binary source (exactly one):
  --release <URL>      Base URL of a published agent release. The installer
                       downloads techfusion-agent-linux-<arch> plus its sibling
                       <name>.sha256 for the detected architecture.
                       (or set TECHFUSION_AGENT_RELEASE_URL)
  --url <URL>          Direct download URL for the techfusion-agent binary
                       (or set TECHFUSION_AGENT_DOWNLOAD_URL)
  --binary <PATH>      Install from a local binary file (testing/offline)

Enrollment:
  --enroll-token <T>   Enrollment token (tfenr_...) for first registration.
                       Optional when a persistent identity already exists.
  --sha256 <HEX>       Expected SHA-256 of the downloaded binary (optional;
                       the sibling .sha256 sidecar is fetched when omitted).

Other:
  --state-dir <DIR>    Persistent state directory (default: /var/lib/techfusion)
  --log <LEVEL>        Log level for the service (default: info)
  --no-preserve-identity  Do not migrate an existing ~/.techfusion identity
  -h, --help           Show this help
EOF
  exit 0
}

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m   ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m   !\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit "${1:-1}"; }

# ── argument parsing ────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --api)               API_URL="${2:?missing value for --api}"; shift 2 ;;
    --enroll-token)      ENROLL_TOKEN="${2:?missing value for --enroll-token}"; shift 2 ;;
    --release)           RELEASE_BASE_URL="${2:?missing value for --release}"; shift 2 ;;
    --url)               BINARY_URL="${2:?missing value for --url}"; shift 2 ;;
    --binary)            BINARY_PATH_ARG="${2:?missing value for --binary}"; shift 2 ;;
    --sha256)            EXPECTED_SHA256="${2:?missing value for --sha256}"; shift 2 ;;
    --state-dir)         STATE_DIR="${2:?missing value for --state-dir}"; shift 2 ;;
    --log)               LOG_LEVEL="${2:?missing value for --log}"; shift 2 ;;
    --no-preserve-identity) PRESERVE_IDENTITY=0; shift ;;
    -h|--help)           usage ;;
    *) die 1 "unknown argument: $1 (see --help)" ;;
  esac
done

if [ -z "$API_URL" ]; then
  die 1 "--api <URL> is required (e.g. --api https://your-host:3001)"
fi

if [ -n "$BINARY_PATH_ARG" ]; then
  :
elif [ -n "$RELEASE_BASE_URL" ] && [ -n "$BINARY_URL" ]; then
  die 1 "Provide exactly one binary source: --release OR --url (not both)."
elif [ -z "$RELEASE_BASE_URL" ] && [ -z "$BINARY_URL" ]; then
  die 1 "No agent binary source configured.
  Provide one of:
    --release <release-base-url>          (or export TECHFUSION_AGENT_RELEASE_URL)
    --url <download-url>                  (or export TECHFUSION_AGENT_DOWNLOAD_URL)
    --binary /path/to/techfusion-agent
  The TechFusion release pipeline publishes per-architecture binaries named
  techfusion-agent-linux-<arch> with sibling .sha256 checksums; ask your operator
  for the release base URL or use --binary with a locally built artifact."
fi

# ── root + platform pre-checks ──────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
  die 1 "This installer must run as root (use: sudo bash install-linux.sh ...)"
fi

if [ "$(uname -s)" != "Linux" ]; then
  die 2 "Unsupported OS: $(uname -s). This installer is Linux-only."
fi

case "$(uname -m)" in
  x86_64|amd64) BINARY_ARCH="x86_64" ;;
  aarch64|arm64) BINARY_ARCH="aarch64" ;;
  *) die 2 "Unsupported CPU architecture: $(uname -m). Supported: x86_64, aarch64." ;;
esac

# Published asset naming contract (V1-AGENT-E2E-01):
#   x86_64/amd64  -> techfusion-agent-linux-x86_64
#   aarch64/arm64 -> techfusion-agent-linux-aarch64
# The release base URL is used verbatim; only the asset suffix is arch-selected.
if [ -n "$RELEASE_BASE_URL" ]; then
  case "$RELEASE_BASE_URL" in
    http://*|https://*) : ;;
    *) die 3 "Refusing to use unsupported release scheme: ${RELEASE_BASE_URL}" ;;
  esac
  BINARY_URL="${RELEASE_BASE_URL%/}/techfusion-agent-linux-${BINARY_ARCH}"
  ok "Resolved per-architecture asset: ${BINARY_URL}"
fi

for dep in sha256sum install systemctl pkill; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    die 2 "Missing dependency: $dep. Install it (e.g. sudo apt install coreutils procps systemd) and retry."
  fi
done

FETCHER=""
if command -v curl >/dev/null 2>&1; then
  FETCHER="curl"
elif command -v wget >/dev/null 2>&1; then
  FETCHER="wget"
fi
if [ -z "$FETCHER" ]; then
  die 2 "Missing dependency: curl or wget is required to download the agent binary."
fi

if ! systemctl --version >/dev/null 2>&1; then
  die 2 "systemd is not available on this host. TechFusion requires systemd for service management."
fi

# ── banner ──────────────────────────────────────────────────────────────────
cat <<EOF

  TechFusion AI Agent Installer v${VERSION}
  ─────────────────────────────────────────
  API URL:    ${API_URL}
  Architecture: ${BINARY_ARCH}
  Binary:     ${BIN_PATH}
  State:      ${STATE_DIR}
  Config:     ${ENV_FILE}
  Service:    techfusion-agent.service
  ─────────────────────────────────────────
EOF

# ── 1. acquire the agent binary ─────────────────────────────────────────────
log "Acquiring agent binary"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
BIN_FILE="${TMP_DIR}/techfusion-agent"

if [ -n "$BINARY_PATH_ARG" ]; then
  if [ ! -f "$BINARY_PATH_ARG" ]; then
    die 3 "Local binary not found: ${BINARY_PATH_ARG}"
  fi
  cp "$BINARY_PATH_ARG" "$BIN_FILE"
  ok "Using local binary: ${BINARY_PATH_ARG}"
else
  # url-validate: only http(s) downloads
  case "$BINARY_URL" in
    http://*|https://*) : ;;
    *) die 3 "Refusing to download from unsupported scheme: ${BINARY_URL}" ;;
  esac

  log "Downloading agent from ${BINARY_URL}"
  if [ "$FETCHER" = "curl" ]; then
    curl -fsSL --retry 3 -o "$BIN_FILE" "$BINARY_URL" || die 3 "Download failed from ${BINARY_URL}"
  else
    wget -q --tries=3 -O "$BIN_FILE" "$BINARY_URL" || die 3 "Download failed from ${BINARY_URL}"
  fi
  ok "Download complete ($(du -h "$BIN_FILE" | cut -f1))"

  if [ -z "$EXPECTED_SHA256" ]; then
    # fetch the sibling .sha256 checksum file; verification is mandatory
    if [ "$FETCHER" = "curl" ]; then
      EXPECTED_SHA256="$(curl -fsSL "${BINARY_URL}.sha256" 2>/dev/null | awk '{print $1}' || true)"
    else
      EXPECTED_SHA256="$(wget -q -O - "${BINARY_URL}.sha256" 2>/dev/null | awk '{print $1}' || true)"
    fi
  fi
  if [ -z "$EXPECTED_SHA256" ]; then
    die 3 "Checksum unavailable at ${BINARY_URL}.sha256 — refusing to install an unverified binary. Supply --sha256 or check the release/URL."
  fi
  ACTUAL_SHA256="$(sha256sum "$BIN_FILE" | awk '{print $1}')"
  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
    die 3 "Checksum mismatch: expected ${EXPECTED_SHA256}, got ${ACTUAL_SHA256}"
  fi
  ok "Checksum verified (sha256 ${ACTUAL_SHA256:0:16}...)"
fi

if [ ! -x "$BIN_FILE" ] && [ "${BINARY_PATH_ARG:-}" = "" ]; then
  chmod +x "$BIN_FILE"
fi

# ── agent capability gate ──────────────────────────────────────────────────
# Verifies a candidate agent binary actually provides the certified Agent
# lifecycle commands. Catches exactly the stale-artifact regression where an
# older published binary (which also reports the same base version) silently
# replaces a newer local build. Runs BEFORE install (so a stale artifact can
# never overwrite a working binary) and again on the installed path below.
# Usage: verify_agent_capabilities <binary-path> <artifact-label>
verify_agent_capabilities() {
  local bin="$1" label="$2" cap
  for cap in $REQUIRED_CAPABILITIES; do
    if "$bin" --help 2>/dev/null | grep -qw "$cap"; then
      ok "${label} exposes: ${cap}"
    else
      die 3 "Installed Agent artifact is older than the required TechFusion Agent
  lifecycle build — it is missing the '${cap}' command.

  This usually means the installer downloaded a stale published artifact
  (e.g. a release tagged before reset-identity/identity-status existed).
  Installation aborted; no stale artifact was installed and no service was
  started.

  Re-run with --release/--url pointing at the current certified release
  (v1.0.0-agent-beta.5+), or with --binary <path> of a current build."
    fi
  done
}

log "Verifying artifact capabilities"
verify_agent_capabilities "$BIN_FILE" "downloaded artifact"

log "Installing binary"
mkdir -p "$(dirname "$BIN_PATH")"
install -m 0755 -o root -g root "$BIN_FILE" "$BIN_PATH"
ok "Installed ${BIN_PATH}"

"$BIN_PATH" --version >/dev/null 2>&1 || die 3 "Installed binary failed to execute."

# ── post-install capability gate ───────────────────────────────────────────
# Re-verifies the installed path, so a stale binary can never be presented as
# a successful current install.
log "Verifying installed artifact capabilities"
verify_agent_capabilities "$BIN_PATH" "installed agent"
ok "Installed agent artifact matches the required TechFusion Agent lifecycle build"

# ── 2. configuration ────────────────────────────────────────────────────────
# Resolve the TF_NETWORK_DISCOVERY value for agent.env (NET-01A).
# Network discovery is ENABLED by default for the V1 product. An explicit
# operator value already present in an existing agent.env (e.g.
# TF_NETWORK_DISCOVERY=false) is an intentional opt-out and is preserved
# across reinstall/upgrade.
resolve_network_discovery() {
  local existing=""
  if [ -f "$ENV_FILE" ]; then
    existing="$(sed -n 's/^TF_NETWORK_DISCOVERY=//p' "$ENV_FILE" | tail -n 1 | tr -d '[:space:]')"
  fi
  if [ -n "$existing" ]; then
    printf '%s\n' "$existing"
  else
    printf 'true\n'
  fi
}

log "Writing configuration"
mkdir -p "$CONFIG_DIR"
umask 077
NETWORK_DISCOVERY="$(resolve_network_discovery)"
cat > "$ENV_FILE" <<EOF
# TechFusion Agent configuration (managed by install-linux.sh)
TF_API_URL=${API_URL}
TF_STATE_DIR=${STATE_DIR}
RUST_LOG=${LOG_LEVEL}
TF_NETWORK_DISCOVERY=${NETWORK_DISCOVERY}
EOF
chown root:root "$ENV_FILE"
chmod 0600 "$ENV_FILE"
ok "Config written to ${ENV_FILE} (root-only, no enrollment token)"
if [ "$NETWORK_DISCOVERY" = "true" ]; then
  ok "Network discovery ENABLED (TF_NETWORK_DISCOVERY=true)"
else
  warn "Network discovery DISABLED (TF_NETWORK_DISCOVERY=${NETWORK_DISCOVERY}) — operator opt-out preserved"
fi

# ── 3. state directory + identity migration ─────────────────────────────────
log "Preparing state directory"
mkdir -p "$STATE_DIR"
chmod 0700 "$STATE_DIR"
chown root:root "$STATE_DIR"

if [ "$PRESERVE_IDENTITY" = "1" ] && [ ! -f "${STATE_DIR}/installation_id" ]; then
  SRC_USER="${SUDO_USER:-}"
  if [ -n "$SRC_USER" ] && [ "$SRC_USER" != "root" ]; then
    SRC_ID_FILE="$(getent passwd "$SRC_USER" 2>/dev/null | cut -d: -f6)/.techfusion/installation_id"
    if [ -n "$SRC_ID_FILE" ] && [ -f "$SRC_ID_FILE" ]; then
      install -m 0600 -o root -g root "$SRC_ID_FILE" "${STATE_DIR}/installation_id"
      ok "Migrated existing device identity from ${SRC_ID_FILE} (avoids duplicate device record)"
    fi
  fi
fi

# ── 4. enrollment ───────────────────────────────────────────────────────────
# Run the one-shot enrollment under a watchdog so a binary that does not
# implement the TF_ENROLL=true → register → exit contract (e.g. a build that
# predates one-shot enrollment) can never hang the installer indefinitely.
# Success is validated against the persisted device credential, not just exit code.
enroll_with_timeout() {
  local log_file="$1" timeout_secs="$2"
  shift 2
  local pid waited=0
  "$@" >"$log_file" 2>&1 &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$waited" -ge "$timeout_secs" ]; then
      kill -TERM "$pid" 2>/dev/null || true
      sleep 1
      kill -KILL "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      return 124
    fi
    sleep 2
    waited=$((waited + 2))
  done
  wait "$pid"
}

if [ -s "${STATE_DIR}/device_token" ] && [ -s "${STATE_DIR}/device_id" ]; then
  ok "Existing persistent identity found — reusing it, skipping enrollment"
  warn "This Agent is already enrolled. The installer never overwrites an"
  warn "existing device identity (security protection)."
  warn "To intentionally remove its local identity and return it to the"
  warn "UNENROLLED state, run:"
  warn "  sudo techfusion-agent reset-identity"
  warn "Then re-run this installer with a fresh --enroll-token."
elif [ -n "$ENROLL_TOKEN" ]; then
  log "Enrolling device (one-shot, token consumed by the API and not stored)"
  ENROLL_LOG="${TMP_DIR}/enroll.log"
  set +e
  enroll_with_timeout "$ENROLL_LOG" "$ENROLL_TIMEOUT_SECS" \
    env TF_STATE_DIR="$STATE_DIR" TF_API_URL="$API_URL" \
        TF_ORG_TOKEN="$ENROLL_TOKEN" TF_ENROLL=true "$BIN_PATH"
  ENROLL_EXIT=$?
  set -e
  cat "$ENROLL_LOG" >&2
  if [ "$ENROLL_EXIT" -eq 124 ]; then
    die 5 "The agent binary did not complete one-shot enrollment within ${ENROLL_TIMEOUT_SECS}s.
  This means the binary does not implement the one-shot enrollment contract
  (TF_ENROLL=true → register → exit) expected by this installer — for example it
  predates it. Re-run with --release/--url pointing at a current build
  (v1.0.0-agent-beta.5+), or with --binary <path> of a current build."
  fi
  if [ "$ENROLL_EXIT" -ne 0 ]; then
    die 5 "Enrollment failed. Check that the token is valid/unused/unexpired and the API is reachable."
  fi
  unset ENROLL_TOKEN
  if [ ! -s "${STATE_DIR}/device_token" ] || [ ! -s "${STATE_DIR}/device_id" ]; then
    die 5 "Enrollment reported success but did not persist the device credential in ${STATE_DIR}.
  Inspect the enrollment output above and the API logs, then retry with a fresh token."
  fi
  ok "Device enrolled — persistent credential stored in ${STATE_DIR}"
else
  die 4 "No enrollment token provided and no existing persistent identity found.
  Run with --enroll-token tfenr_<token>, or restore ${STATE_DIR} first."
fi

# ── 5. systemd service ──────────────────────────────────────────────────────
log "Installing systemd service"
cat > "$UNIT_PATH" <<'UNIT'
[Unit]
Description=TechFusion AI Device Agent
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/techfusion-agent
EnvironmentFile=/etc/techfusion/agent.env
Restart=on-failure
RestartSec=5
StateDirectory=techfusion
StateDirectoryMode=0700
PrivateTmp=true
NoNewPrivileges=true
ProtectHome=true
ProtectSystem=strict
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=multi-user.target
UNIT
chown root:root "$UNIT_PATH"
chmod 0644 "$UNIT_PATH"

systemctl daemon-reload
systemctl enable "$(basename "$UNIT_PATH" .service)" >/dev/null 2>&1

if systemctl is-active --quiet techfusion-agent; then
  systemctl restart techfusion-agent
else
  # No service process is running; stop any standalone agent process so the
  # systemd service becomes the single owner (exact process-name match only).
  pkill -x techfusion-agent 2>/dev/null || true
  systemctl start techfusion-agent
fi
ok "Service enabled and started (auto-starts on boot)"

# ── 6. verification ─────────────────────────────────────────────────────────
sleep 2
if systemctl is-active --quiet techfusion-agent; then
  DEVICE_ID_FILE="${STATE_DIR}/device_id"
  DEVICE_ID="$(cat "$DEVICE_ID_FILE" 2>/dev/null || echo "unknown")"
  cat <<EOF

  ─────────────────────────────────────────
   TechFusion Agent is RUNNING
   Service:    techfusion-agent.service
   Device ID:  ${DEVICE_ID}
   State:      ${STATE_DIR}
   Logs:       journalctl -u techfusion-agent -f
  ─────────────────────────────────────────
   The device should appear in your Dashboard within a few seconds.
   No enrollment token is needed after this point.
EOF
  exit 0
else
  echo "techfusion-agent did not become active. Diagnostics:" >&2
  systemctl status techfusion-agent --no-pager -n 10 >&2 || true
  journalctl -u techfusion-agent -n 50 --no-pager >&2 || true
  die 6 "The techfusion-agent service did not start. See the diagnostics above."
fi

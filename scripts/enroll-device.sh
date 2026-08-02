#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TechFusion AI — Device Enrollment Helper
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   ./scripts/enroll-device.sh <ENROLLMENT_TOKEN> [API_URL]
#
# Examples:
#   # Linux / macOS
#   export TF_API_URL=http://localhost:3001
#   export TF_ORG_TOKEN=tfenr_abc123...
#   cd apps/agent && cargo run
#
#   # Or use this script directly:
#   ./scripts/enroll-device.sh tfenr_abc123... http://localhost:3001
#
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

TOKEN="${1:-}"
API_URL="${2:-http://localhost:3001}"

if [ -z "$TOKEN" ]; then
    echo ""
    echo "  TechFusion AI — Device Enrollment"
    echo "  ─────────────────────────────────"
    echo ""
    echo "  Usage: $0 <ENROLLMENT_TOKEN> [API_URL]"
    echo ""
    echo "  Steps:"
    echo "    1. Open Dashboard → Enrollment"
    echo "    2. Click 'Generate Token'"
    echo "    3. Copy the token (starts with tfenr_)"
    echo "    4. Run: $0 tfenr_your_token_here"
    echo ""
    echo "  Environment Variables:"
    echo "    TF_API_URL     API gateway URL (default: http://localhost:3001)"
    echo "    TF_ORG_TOKEN   Enrollment token for first-time registration"
    echo ""
    exit 1
fi

echo ""
echo "  TechFusion AI — Device Enrollment"
echo "  ─────────────────────────────────"
echo ""
echo "  API URL:  $API_URL"
echo "  Token:    ${TOKEN:0:12}...${TOKEN: -4}"
echo ""

# Check if Rust agent exists
AGENT_DIR="$(dirname "$0")/../apps/agent"
if [ ! -f "$AGENT_DIR/Cargo.toml" ]; then
    echo "  ERROR: Rust agent not found at $AGENT_DIR"
    exit 1
fi

echo "  Starting agent..."
echo ""

export TF_API_URL="$API_URL"
export TF_ORG_TOKEN="$TOKEN"

cd "$AGENT_DIR"
cargo run

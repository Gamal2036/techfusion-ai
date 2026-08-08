#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Lightweight repository-native secret scan (V1-STAGE-01C)
#
# Scans TRACKED text files for high-confidence credential/secret patterns and
# fails the build when any is found. No third-party platform required.
#
# Safety properties:
#   - Only `git ls-files` output is scanned (no node_modules/dist/history).
#   - Never prints the matched value — only file:line + pattern name, so a
#     leaked secret is not echoed into CI logs (§29).
#   - Known non-production markers (test/ci/example placeholders) are ignored.
#   - .env files are gitignored and therefore never scanned.
#
# Run:  bash scripts/ci-secret-scan.sh
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# A matched line is IGNORED when it contains one of these non-production
# markers (placeholders / test / CI constants), or references a secret via the
# GitHub expression form `${{ secrets.NAME }}` rather than a literal value.
# `tfenr_abcdef` is the exact string used as the mocked enrollment token in
# apps/api-gateway/src/devices/devices.controller.spec.ts (a real token is
# random hex, so it will not collide with this fixture).
SAFE_MARKERS='placeholder|changeme|REPLACE|your_token|your_key|your-|<YOUR_|sk_test_|test_secret|test-secret|ci-secret|ci-jwt|ci-refresh|test-jwt|test-refresh|test-encryption|test-report|tfenr_abcdef|user:pass@|\$\{\{\s*secrets\.'

# Tracked text files to scan (excludes lockfiles, binaries, generated maps).
FILES="$(
  git ls-files \
    | grep -v -E '(^|/)pnpm-lock\.yaml$' \
    | grep -v -E '\.(png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|eot|map|lock|wasm)$' \
    || true
)"

# pattern_name|regex  (one per line, first column is the safe label).
# DB/Redis URL patterns only flag credentials pointing at a NON-local host, so
# the repo's own localhost test constants are never false positives.
PATTERNS=(
  "stripe_live_key|sk_live_[A-Za-z0-9]{16,}"
  "aws_access_key|AKIA[0-9A-Z]{16}"
  "github_token|(ghp|gho|ghu|ghs)_[A-Za-z0-9]{30,}"
  "github_fine_grained_pat|github_pat_[A-Za-z0-9_]{30,}"
  "slack_token|xox[baprs]-[A-Za-z0-9-]{20,}"
  "google_api_key|AIza[0-9A-Za-z_-]{35}"
  "private_key|-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----"
  "enrollment_token|tfenr_[A-Za-z0-9]{20,}"
  "redis_credentials|redis://[A-Za-z0-9_.-]+:[^/@\s]+@(?!localhost|127\.0\.0\.1)[A-Za-z0-9_.-]+"
  "postgres_credentials|postgres(ql)?://[A-Za-z0-9_.-]+:[^/@\s]+@(?!localhost|127\.0\.0\.1)[A-Za-z0-9_.-]+"
  "mongodb_credentials|mongodb(\+srv)?://[A-Za-z0-9_.-]+:[^/@\s]+@(?!localhost|127\.0\.0\.1)[A-Za-z0-9_.-]+"
)

FAILED=0
scan_file() {
  local file="$1"
  local line pat_name pat_regex label
  for entry in "${PATTERNS[@]}"; do
    pat_name="${entry%%|*}"
    pat_regex="${entry#*|}"
    while IFS= read -r line; do
      label="$(printf '%s\n' "$line" | cut -d: -f1-2)"
      content="${line#*:*:}"
      if printf '%s\n' "$content" | grep -qiE "$SAFE_MARKERS"; then
        continue
      fi
      echo "::error file=${file},line=${label}::Potential ${pat_name} detected (value redacted)"
      FAILED=1
    done < <(grep -nP -e "$pat_regex" "$file" || true)
  done
}

if [ -z "$FILES" ]; then
  echo "No tracked files to scan."
  exit 0
fi

echo "TechFusion AI — repository secret scan"
echo "──────────────────────────────────────"
while IFS= read -r file; do
  [ -f "$file" ] || continue
  scan_file "$file"
done <<< "$FILES"

echo "──────────────────────────────────────"
if [ "$FAILED" = "0" ]; then
  echo "Result: NO SECRETS DETECTED"
  exit 0
fi
echo "Result: SECRET(S) DETECTED — fix and re-run (values are NOT printed)."
exit 1

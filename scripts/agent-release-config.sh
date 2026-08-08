#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TechFusion AI — Linux Agent Release Source of Truth (V1-STAGE-00B-R1)
#
# Single canonical definition of the current certified Linux Agent release.
# Everything that references a release (installer defaults, web dashboard
# download URL, release-asset verification, installer regression tests) must
# resolve through this file so the installer can never silently fall back to
# an older/stale artifact.
#
# This file is meant to be `source`d by bash tooling. The web app mirrors the
# same values in apps/web/src/lib/agent-download.ts; verify-linux-bootstrap.sh
# asserts the two never drift (release version + required capabilities).
# ═══════════════════════════════════════════════════════════════════════════

# GitHub release tag (repo naming convention: v<major>.<minor>.<patch>-agent-<prerelease>).
AGENT_RELEASE_TAG="v1.0.0-agent-beta.4"

# Cargo package version of apps/agent/Cargo.toml. MUST equal the version that
# `techfusion-agent --version` prints after the command name.
AGENT_RELEASE_VERSION="1.0.0-beta.4"

# Release owner/repo + full release base URL used by the installer's
# `--release` argument (per-architecture asset suffix is appended).
AGENT_RELEASE_OWNER="Gamal2036"
AGENT_RELEASE_REPO="techfusion-ai"
AGENT_RELEASE_BASE_URL="https://github.com/${AGENT_RELEASE_OWNER}/${AGENT_RELEASE_REPO}/releases/download/${AGENT_RELEASE_TAG}"

# Capabilities the certified build MUST expose. The installer and every
# release-verification/regression check refuse to proceed when any is missing.
AGENT_REQUIRED_CAPABILITIES="reset-identity identity-status"

# Architectures published by the release-agent workflow (asset naming contract).
AGENT_RELEASE_ARCHS="x86_64 aarch64"

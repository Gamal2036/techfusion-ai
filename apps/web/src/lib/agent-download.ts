/**
 * Linux agent release artifact configuration (V1-AGENT-E2E-01 / V1-STAGE-00B-R1).
 *
 * The single source of truth for the certified release tag lives in
 * scripts/agent-release-config.sh (AGENT_RELEASE_TAG). Keep these two in sync:
 * verify-linux-bootstrap.sh asserts the default below still matches the
 * source-of-truth tag, so CI fails if the installer assets drift from the
 * certified release.
 *
 * NEXT_PUBLIC_AGENT_DOWNLOAD_URL is the release BASE URL (not a single
 * architecture asset). The installer appends techfusion-agent-linux-<arch>
 * and its sibling <name>.sha256 for the detected architecture:
 *
 *   x86_64 / amd64   -> techfusion-agent-linux-x86_64
 *   aarch64 / arm64  -> techfusion-agent-linux-aarch64
 *
 * A built-in default keeps the published release usable without deployment
 * configuration; NEXT_PUBLIC_AGENT_DOWNLOAD_URL overrides it for other
 * mirrors/deployments.
 */

export const DEFAULT_AGENT_RELEASE_BASE_URL =
  'https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.5';

/**
 * Lifecycle commands the certified agent build MUST expose. The installer and
 * the installer regression test refuse a stale artifact that predates them.
 * Mirrors AGENT_REQUIRED_CAPABILITIES in scripts/agent-release-config.sh.
 */
export const AGENT_REQUIRED_CAPABILITIES = ['reset-identity', 'identity-status'];

export function resolveAgentReleaseBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL?.trim();
  return configured || DEFAULT_AGENT_RELEASE_BASE_URL;
}

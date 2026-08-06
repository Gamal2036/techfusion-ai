/**
 * Linux agent release artifact configuration (V1-AGENT-E2E-01).
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
  'https://github.com/Gamal2036/techfusion-ai/releases/download/v1.0.0-agent-beta.3';

export function resolveAgentReleaseBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_AGENT_DOWNLOAD_URL?.trim();
  return configured || DEFAULT_AGENT_RELEASE_BASE_URL;
}

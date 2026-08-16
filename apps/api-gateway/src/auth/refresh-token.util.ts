import * as crypto from 'crypto';

/**
 * Refresh-token verifier utility (ACC-SEC-02D2A).
 *
 * Raw opaque refresh tokens are returned to the client exactly once (through
 * the authenticated response) and are NEVER persisted. Only a SHA-256 verifier
 * with an explicit versioned prefix is stored at rest.
 *
 * Verifier format: rt:v1:<sha256-hex>
 *   - "rt:v1:" marks the value as a v1 refresh-token verifier so it can never
 *     be confused with a legacy plaintext token (96-char hex) and vice versa.
 *   - The prefix also lets a future verifier format (rt:v2:...) be introduced
 *     without ambiguity.
 *
 * Lookup contract: refresh validates by computing the verifier from the
 * presented raw token first; only if no row matches is a single exact lookup
 * against the raw value allowed (controlled legacy plaintext compatibility
 * path). Raw tokens and verifiers are never logged.
 */

export const REFRESH_TOKEN_VERIFIER_PREFIX = 'rt:v1:';

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashRefreshToken(rawToken: string): string {
  return REFRESH_TOKEN_VERIFIER_PREFIX + sha256Hex(rawToken);
}

export function isRefreshVerifier(value: string): boolean {
  return value.startsWith(REFRESH_TOKEN_VERIFIER_PREFIX);
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

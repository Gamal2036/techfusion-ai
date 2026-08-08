import { createHash, randomBytes } from 'crypto';

/**
 * V1 invitation token policy.
 *
 * - Tokens are cryptographically random (256 bits).
 * - Only the SHA-256 hash is persisted; the raw token appears solely in the
 *   invitation link handed to the inviter.
 * - Tokens are single-use: acceptance consumes the invitation and any resend
 *   replaces the stored hash, so an old token can never be accepted again.
 */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Invitation is live when it is PENDING and has not passed expiresAt. */
export function isInvitationLive(
  status: string,
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return status === 'PENDING' && expiresAt.getTime() > now.getTime();
}

/** Masks an email for safe display, e.g. "a***@example.com". */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = (local || 'a').slice(0, 1);
  const tail = domain.split('.').slice(-2).join('.');
  return `${head}***@${tail}`;
}

/**
 * Base URL of the human-facing web application (V1-RBAC-01E).
 *
 * Invitation links are consumed by people, so they must resolve to the WEB app
 * (e.g. http://localhost:3000/invite/<token>), never to the API gateway. The
 * API gateway's own request origin is NOT a valid fallback because the browser
 * calls the API directly on its own host/port, where no /invite route exists —
 * that was the source of the original `Cannot GET /invite/<token>` 404.
 *
 * Precedence: WEB_APP_URL > INVITE_BASE_URL (legacy) > caller-provided fallback
 * > development default. WEB_APP_URL is required in production (validated at
 * startup) so invitation links remain configurable without code changes.
 */
export function getWebAppBaseUrl(fallback?: string): string {
  return (
    process.env.WEB_APP_URL ||
    process.env.INVITE_BASE_URL ||
    fallback ||
    'http://localhost:3000'
  );
}

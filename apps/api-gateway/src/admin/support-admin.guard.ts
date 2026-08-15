import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createStructuredLogger } from '../common/structured-logger';
import * as crypto from 'crypto';

/**
 * DEV-REV-01 — Support-admin authorization boundary.
 *
 * The repository has NO system-level role (no SYSTEM_ADMIN / SUPPORT_ADMIN in
 * the Role enum or the permission matrix); every authenticated principal is an
 * OrganizationMember of exactly one org. Cross-organization recovery therefore
 * cannot reuse the membership RBAC and is gated by the smallest secure
 * internal boundary consistent with project conventions: an environment-held
 * support-admin API key.
 *
 * Security properties:
 *  - Only the SHA-256 HASHES of allowed keys live in the environment
 *    (`SUPPORT_ADMIN_API_KEY_HASHES`, JSON array of 64-hex hashes). The raw
 *    keys are never stored in the database, in source, or in logs.
 *  - The header key is hashed on arrival and compared against the configured
 *    hashes; the raw key is never logged.
 *  - Fail closed: missing configuration, unparseable configuration, a missing
 *    header, or a non-matching key all yield HTTP 401.
 *  - The principal attached to the request is a stable pseudo-actor
 *    (`support:admin`); no membership/org claim is ever assumed.
 */
@Injectable()
export class SupportAdminGuard implements CanActivate {
  private readonly events = createStructuredLogger('SupportAdmin');

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const presented = request.headers['x-support-admin-key'];

    if (typeof presented !== 'string' || presented.length === 0) {
      this.events.warn('support_admin_denied', {
        event: 'support_admin_denied',
        reason: 'missing_key',
        route: `${context.getClass()?.name}.${context.getHandler()?.name}`,
      });
      throw new UnauthorizedException('Support authorization required');
    }

    const configuredHashes = this.configuredKeyHashes();
    if (configuredHashes.length === 0) {
      this.events.warn('support_admin_denied', {
        event: 'support_admin_denied',
        reason: 'not_configured',
        route: `${context.getClass()?.name}.${context.getHandler()?.name}`,
      });
      throw new UnauthorizedException('Support authorization required');
    }

    const presentedHash = crypto.createHash('sha256').update(presented).digest('hex');
    if (!configuredHashes.includes(presentedHash)) {
      this.events.warn('support_admin_denied', {
        event: 'support_admin_denied',
        reason: 'invalid_key',
        route: `${context.getClass()?.name}.${context.getHandler()?.name}`,
      });
      throw new UnauthorizedException('Support authorization required');
    }

    // Stable pseudo-actor for audit attribution. keyHashPrefix is a coarse,
    // non-sensitive correlation aid (8 hex chars, never the full hash).
    request.supportAdmin = {
      subject: 'support:admin',
      keyHashPrefix: presentedHash.slice(0, 8),
    };
    return true;
  }

  private configuredKeyHashes(): string[] {
    const raw = process.env.SUPPORT_ADMIN_API_KEY_HASHES;
    if (!raw || raw.trim() === '') return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (h): h is string => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h),
      );
    } catch {
      return [];
    }
  }
}

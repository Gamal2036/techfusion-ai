import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createStructuredLogger } from '../common/structured-logger';
import * as bcrypt from 'bcryptjs';

/**
 * ACC-SEC-02B2 — Server-authoritative re-authentication for sensitive account
 * security operations (MFA disable, recovery-code generation/regeneration).
 *
 * Contract:
 * - Identity always comes from the authenticated request principal
 *   (req.user.sub). A client-supplied userId is never accepted as authority;
 *   callers derive userId from the verified session and pass it here.
 * - The current account password is required and verified against the existing
 *   bcrypt passwordHash (the same hashing infrastructure as login).
 * - Failures are deterministic 401s with a generic message that never reveals
 *   whether another account exists.
 * - Every failed attempt emits a structured `reauthentication_failed` security
 *   event. The password is never logged.
 * - Callers are responsible for route-level throttling (the MFA routes are
 *   decorated with the strict 5/60 s MFA throttle).
 */
@Injectable()
export class ReauthenticationService {
  private readonly events = createStructuredLogger('Reauth');

  constructor(private prisma: PrismaService) {}

  /**
   * Verifies the current account password for an authenticated user.
   * Throws a deterministic 401 on any failure.
   */
  async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      this.events.warn('reauthentication_failed', { userId, reason: 'account_not_found' });
      throw new UnauthorizedException('Current password is incorrect');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      this.events.warn('reauthentication_failed', { userId, reason: 'invalid_password' });
      throw new UnauthorizedException('Current password is incorrect');
    }
  }
}

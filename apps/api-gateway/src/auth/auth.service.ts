import { Injectable, ConflictException, UnauthorizedException, BadRequestException, InternalServerErrorException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { AuditService } from '../audit/audit.service';
import { ReauthenticationService } from '../reauthentication/reauthentication.service';
import { createStructuredLogger } from '../common/structured-logger';
import { decryptMfaSecret } from '../mfa/mfa-secret.util';
import { RecoveryCodesService } from '../mfa/recovery-codes.service';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.util';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as speakeasy from 'speakeasy';

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};
const JWT_REFRESH_SECRET = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
  return secret;
};

interface SignupInput {
  email: string;
  password: string;
  displayName: string;
  orgName: string;
}

interface LoginInput {
  email: string;
  password: string;
}

/**
 * Truthful server-observed session metadata (ACC-SEC-02D2A). Values are
 * captured from the request (server-observed IP, User-Agent header with a
 * strict maximum length) and are never accepted from a request body.
 * deviceName is reserved for a future client-declared value and is never
 * fabricated.
 */
export interface SessionMetadata {
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
}

const MAX_USER_AGENT_LENGTH = 300;

export function sanitizeUserAgent(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, MAX_USER_AGENT_LENGTH);
}

const MAX_SLUG_RETRIES = 10;

type DbClient = PrismaService | Prisma.TransactionClient;

export function normalizeSlug(input: string): string {
  let slug = input
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || 'organization';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly events = createStructuredLogger('Auth');

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private recoveryCodes: RecoveryCodesService,
    private audit: AuditService,
    private reauth: ReauthenticationService,
  ) {}

  async signup(input: SignupInput, metadata?: SessionMetadata) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const baseSlug = normalizeSlug(input.orgName);

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= MAX_SLUG_RETRIES; attempt++) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: { name: input.orgName, slug },
          });

          const user = await tx.user.create({
            data: {
              email: input.email,
              passwordHash,
              displayName: input.displayName,
              orgId: org.id,
              role: 'Owner',
            },
          });

          // ORG-01A2: new users must receive their OrganizationMember at
          // signup time; the ORG-01A1 backfill only covers pre-existing users.
          await tx.organizationMember.create({
            data: { userId: user.id, orgId: org.id, role: 'Owner' },
          });

          return { org, user };
        });

        this.logger.debug(`Signup complete with slug "${slug}"`);
        const tokens = await this.generateTokens(result.user.id, result.org.id, result.user.role, undefined, undefined, metadata);
        return {
          user: { id: result.user.id, email: result.user.email, displayName: result.user.displayName, role: result.user.role, orgId: result.org.id },
          ...tokens,
        };
      } catch (err: any) {
        if (err?.code === 'P2002' && attempt < MAX_SLUG_RETRIES) {
          this.logger.debug(`Slug collision on "${slug}", retrying (attempt ${attempt + 1})`);
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    this.logger.error(`Failed to generate unique slug after ${MAX_SLUG_RETRIES + 1} attempts`);
    throw lastError || new Error('Failed to generate unique slug');
  }

  async login(input: LoginInput, metadata?: SessionMetadata) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.isMfaEnabled) {
      return { mfaRequired: true, userId: user.id };
    }

    const membership = await this.requireMembership(user);
    const tokens = await this.generateTokens(user.id, membership.orgId, membership.role, undefined, undefined, metadata);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: membership.role,
        orgId: membership.orgId,
      },
      ...tokens,
    };
  }

  /**
   * ACC-SEC-02B2 — the MFA login challenge accepts a valid TOTP token OR a
   * valid unused recovery code. The response contract is unchanged. A recovery
   * code is consumed atomically inside the same transaction that mints the
   * refresh token: it can never be spent on a failed login, and concurrent
   * attempts can never reuse it. A recovery code never replaces the password —
   * the password is verified in the login step before the challenge.
   */
  async verifyLoginMfa(userId: string, token?: string, recoveryCode?: string, metadata?: SessionMetadata) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA verification required');
    }

    const hasToken = typeof token === 'string' && token.length > 0;
    const hasRecoveryCode = typeof recoveryCode === 'string' && recoveryCode.length > 0;

    if (hasRecoveryCode && !hasToken) {
      const membership = await this.requireMembership(user);
      let tokens: { accessToken: string; refreshToken: string };
      try {
        tokens = await this.prisma.$transaction(async (tx) => {
          const consumed = await this.recoveryCodes.consume(tx, userId, recoveryCode);
          if (!consumed) {
            throw new UnauthorizedException('Invalid MFA code');
          }
          return this.generateTokens(user.id, membership.orgId, membership.role, tx, undefined, metadata);
        });
      } catch (err) {
        if (err instanceof UnauthorizedException) {
          this.events.warn('mfa_verification_failed', { userId, reason: 'invalid_recovery_code' });
        }
        throw err;
      }
      this.events.log('mfa_recovery_code_used', { userId });
      return {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: membership.role,
          orgId: membership.orgId,
        },
        ...tokens,
      };
    }

    if (!hasToken) {
      // No usable second factor was supplied.
      this.events.warn('mfa_verification_failed', { userId, reason: 'missing_second_factor' });
      throw new UnauthorizedException('Invalid MFA code');
    }

    // The stored secret may be encrypted (enc:v1:) or a legacy plaintext
    // value. Decryption is transparent and fails closed: an unreadable secret
    // denies login rather than ever being treated as the actual secret.
    let plaintextSecret: string;
    try {
      plaintextSecret = decryptMfaSecret(this.encryption, user.mfaSecret);
    } catch {
      this.events.error('mfa_verification_failed', { userId, reason: 'secret_decryption_failed' });
      throw new InternalServerErrorException('MFA verification unavailable');
    }

    const verified = speakeasy.totp.verify({
      secret: plaintextSecret,
      encoding: 'base32',
      token,
    });

    if (!verified) {
      this.events.warn('mfa_verification_failed', { userId, reason: 'invalid_token' });
      throw new UnauthorizedException('Invalid MFA code');
    }

    const membership = await this.requireMembership(user);
    const tokens = await this.generateTokens(user.id, membership.orgId, membership.role, undefined, undefined, metadata);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: membership.role,
        orgId: membership.orgId,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string, metadata?: SessionMetadata) {
    // ACC-SEC-02D2A: lookup by the SHA-256 verifier first. A single exact
    // lookup against the raw value is the controlled legacy-plaintext
    // compatibility path for tokens persisted before this stage; the row is
    // upgraded to verifier-only storage by the normal rotation below.
    const verifier = hashRefreshToken(refreshToken);
    let stored = await this.prisma.refreshToken.findUnique({
      where: { token: verifier },
      include: { user: true },
    });
    let legacyMatch = false;
    if (!stored) {
      stored = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
      });
      legacyMatch = stored !== null;
    }

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // The refresh session must remain bound to an active membership. Membership
    // is the authority for organization access; without it the refresh is
    // rejected rather than silently restoring a previous org.
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: stored.user.id, orgId: stored.user.orgId } },
    });

    if (!membership) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('No active membership for this organization');
    }

    // Single-use rotation, implemented as a compare-and-swap: the revoke only
    // succeeds while revokedAt is still null, so a refresh token that a
    // concurrent request (e.g. a second browser tab) is already rotating can
    // never mint a second token pair. The loser of the race is treated as an
    // invalid session instead of silently issuing a duplicate. When the row
    // was matched through the legacy plaintext path, the same atomic operation
    // rewrites the stored value to the verifier so no raw token remains at
    // rest (ACC-SEC-02D2A).
    const revoke = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        ...(legacyMatch ? { token: verifier } : {}),
      },
    });

    if (revoke.count === 0) {
      throw new UnauthorizedException('Refresh token already used');
    }

    const tokens = await this.generateTokens(
      stored.user.id,
      membership.orgId,
      membership.role,
      undefined,
      { sessionId: stored.sessionId },
      {
        // Server-observed metadata follows first-seen policy across the
        // rotation chain: the IP recorded at the original login is preserved
        // and only filled from the current request when it was never recorded.
        // deviceName is never fabricated.
        ipAddress: stored.ipAddress ?? metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        deviceName: stored.deviceName ?? undefined,
      },
    );
    return {
      user: {
        id: stored.user.id,
        email: stored.user.email,
        displayName: stored.user.displayName,
        role: membership.role,
        orgId: membership.orgId,
      },
      ...tokens,
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── ACC-SEC-02D2B: Password Change & Active Session Management ────

  /**
   * Change the authenticated user's password. Requires current-password
   * reauthentication. Revokes all existing sessions and issues a fresh token
   * pair so the client stays signed in.
   */
  async changePassword(
    userId: string,
    orgId: string,
    currentPassword: string,
    newPassword: string,
    metadata?: SessionMetadata,
  ) {
    await this.reauth.verifyPassword(userId, currentPassword);

    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must differ from current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return true;
    });

    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });

    if (!membership) {
      throw new UnauthorizedException('No active membership for this organization');
    }

    const tokens = await this.generateTokens(
      userId,
      membership.orgId,
      membership.role,
      undefined,
      undefined,
      metadata,
    );

    this.events.log('password_changed', { userId, orgId });
    await this.audit.log({
      orgId,
      action: 'password_changed',
      actorId: userId,
      details: { targetUserId: userId },
    });

    return {
      message: 'Password changed successfully',
      ...tokens,
    };
  }

  /**
   * List active sessions for the authenticated user. Returns safe metadata
   * only — no token material. The `current` flag is derived from the
   * requesting session's `sid` claim.
   */
  async listSessions(userId: string, currentSessionId?: string) {
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        sessionId: true,
        createdAt: true,
        expiresAt: true,
        lastUsedAt: true,
        ipAddress: true,
        userAgent: true,
        deviceName: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const seen = new Set<string>();
    const sessions = rows
      .filter((row) => {
        if (seen.has(row.sessionId)) return false;
        seen.add(row.sessionId);
        return true;
      })
      .map((row) => ({
        sessionId: row.sessionId,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        lastUsedAt: row.lastUsedAt,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        deviceName: row.deviceName,
        current: currentSessionId ? row.sessionId === currentSessionId : false,
      }));

    return { sessions };
  }

  /**
   * Revoke a specific session by sessionId. Ownership check is enforced.
   * Returns 404 if not found or not owned. Idempotent: already-revoked
   * sessions return 200.
   */
  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await this.prisma.refreshToken.findFirst({
        where: { userId, sessionId },
      });
      if (!exists) {
        throw new NotFoundException('Session not found');
      }
      return { message: 'Session already revoked' };
    }

    this.events.log('session_revoked', { userId, operation: sessionId });
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
    });
    if (membership) {
      await this.audit.log({
        orgId: membership.orgId,
        action: 'session_revoked',
        actorId: userId,
        details: { sessionId },
      });
    }

    return { message: 'Session revoked' };
  }

  /**
   * Revoke all sessions except the current one. Requires the current
   * session's `sid` to be known.
   */
  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        sessionId: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    this.events.log('sessions_revoked_others', { userId, reason: 'user_initiated' });
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
    });
    if (membership) {
      await this.audit.log({
        orgId: membership.orgId,
        action: 'sessions_revoked_others',
        actorId: userId,
        details: { revokedCount: result.count, currentSessionId },
      });
    }

    return { message: 'All other sessions signed out', revokedCount: result.count };
  }

  /**
   * Revoke only the current session. The client must clear tokens and
   * redirect to login afterward.
   */
  async revokeCurrentSession(userId: string, sessionId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      const exists = await this.prisma.refreshToken.findFirst({
        where: { userId, sessionId },
      });
      if (!exists) {
        throw new NotFoundException('Session not found');
      }
      return { message: 'Session already revoked' };
    }

    this.events.log('session_revoked_current', { userId, operation: sessionId });
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId },
    });
    if (membership) {
      await this.audit.log({
        orgId: membership.orgId,
        action: 'session_revoked_current',
        actorId: userId,
        details: { sessionId },
      });
    }

    return { message: 'Current session revoked' };
  }

  /**
   * Issues a fresh access + refresh token pair for an explicit org/role. Used
   * by the organization switch flow so the new JWT immediately reflects the
   * selected organization and membership role.
   */
  async issueTokensForOrg(userId: string, orgId: string, role: string) {
    return this.generateTokens(userId, orgId, role);
  }

  /**
   * Membership is the authority for organization access. A login that cannot
   * be bound to a current OrganizationMember row for the user's active org is
   * rejected. The legacy User.orgId/User.role fields are snapshot data only and
   * are intentionally NOT used to mint credentials.
   */
  private async requireMembership(user: { id: string; orgId: string | null }) {
    if (!user.orgId) {
      throw new UnauthorizedException('No active membership for this organization');
    }
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: user.orgId } },
    });
    if (!membership) {
      throw new UnauthorizedException('No active membership for this organization');
    }
    return membership;
  }

  private async generateTokens(
    userId: string,
    orgId: string,
    role: string,
    db: DbClient = this.prisma,
    opts?: { sessionId?: string },
    metadata?: SessionMetadata,
  ) {
    // A stable, non-secret session identity that survives the full refresh
    // rotation chain. It is additive and non-authoritative: guards only
    // require sub + orgId, so still-valid access tokens minted before this
    // stage (no sid) remain accepted until natural expiry.
    const sessionId = opts?.sessionId ?? crypto.randomUUID();
    const accessToken = jwt.sign(
      { sub: userId, orgId, role, sid: sessionId },
      JWT_SECRET(),
      { expiresIn: '15m' },
    );

    const refreshTokenStr = generateRefreshToken();
    await db.refreshToken.create({
      data: {
        // Only the SHA-256 verifier is persisted at rest; the raw token is
        // returned to the client exactly once through this response.
        token: hashRefreshToken(refreshTokenStr),
        sessionId,
        userId,
        orgId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        deviceName: metadata?.deviceName,
      },
    });

    return { accessToken, refreshToken: refreshTokenStr };
  }
}

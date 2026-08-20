import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TransactionalEmailService } from '../mail/mail.service';
import { QueueService } from '../queue/queue.service';
import { createStructuredLogger } from '../common/structured-logger';
import { loadMailConfig } from '../mail/mail.config';

const TOKEN_BYTES = 32;
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const VERIFIER_PREFIX = 'prt:v1:';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function hashToken(raw: string): string {
  return VERIFIER_PREFIX + sha256Hex(raw);
}

function timingSafeTokenCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly events = createStructuredLogger('Auth');
  private readonly mailConfig = loadMailConfig();

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private emailService: TransactionalEmailService,
    private queueService: QueueService,
  ) {}

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, orgId: true, email: true, displayName: true, isMfaEnabled: true },
    });

    if (!user) {
      this.events.log('password_reset_request_suppressed', {
        reason: 'user_not_found',
      });
      return {
        message: 'If an account exists for that email, password reset instructions will be sent.',
      };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MS);

    const rawToken = randomBytes(TOKEN_BYTES).toString('hex');
    const verifier = hashToken(rawToken);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      const resetToken = await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: verifier,
          expiresAt,
        },
      });

      return resetToken;
    });

    this.events.log('password_reset_token_created', {
      userId: user.id,
    });

    await this.audit.log({
      orgId: user.orgId,
      action: 'password_reset_requested',
      actorId: user.id,
      details: { tokenId: result.id },
    });

    if (this.mailConfig.enabled) {
      try {
        const resetUrl = this.emailService
          .getUrlBuilder()
          .buildActionUrl('/reset-password', { token: rawToken });

        const rendered = await this.emailService.renderEmail('password-reset', {
          recipientName: user.displayName || 'User',
          actionUrl: resetUrl,
          expiresIn: '15 minutes',
        });

        const idempotencyKey = `pwd-reset-${result.id}`;
        const correlationId = `pwd-reset-${user.id}-${Date.now()}`;

        await this.queueService.addTransactionalEmail({
          templateId: 'password-reset',
          encryptedPayload: JSON.stringify({
            rendered,
            to: user.email,
          }),
          recipientHash: this.emailService.getUrlBuilder().hashRecipient(user.email),
          idempotencyKey,
          correlationId,
        });

        this.events.log('password_reset_email_queued', {
          userId: user.id,
        });
      } catch (err: any) {
        this.events.warn('password_reset_email_queue_failed', {
          userId: user.id,
          reason: err?.message || 'unknown',
        });
      }
    }

    return {
      message: 'If an account exists for that email, password reset instructions will be sent.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const verifier = hashToken(token);

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: verifier },
      include: { user: { select: { id: true, orgId: true } } },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumed.count === 0) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      const passwordHash = await (await import('bcryptjs')).hash(newPassword, 10);

      await tx.user.update({
        where: { id: resetToken.user.id },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: {
          userId: resetToken.user.id,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      return true;
    });

    this.events.log('password_reset_completed', {
      userId: resetToken.user.id,
    });

    await this.audit.log({
      orgId: resetToken.user.orgId,
      action: 'password_reset_completed',
      actorId: resetToken.user.id,
      details: { tokenId: resetToken.id },
    });

    await this.audit.log({
      orgId: resetToken.user.orgId,
      action: 'password_reset_sessions_revoked',
      actorId: resetToken.user.id,
      details: { tokenId: resetToken.id },
    });

    return { message: 'Password has been reset successfully' };
  }
}

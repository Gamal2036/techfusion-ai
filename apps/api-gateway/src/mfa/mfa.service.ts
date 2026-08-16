import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { createStructuredLogger } from '../common/structured-logger';
import { encryptMfaSecret, decryptMfaSecret, isEncryptedMfaSecret } from './mfa-secret.util';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

/**
 * ACC-SEC-02B1 — MFA secret lifecycle hardening.
 *
 * - Secrets are encrypted at rest with a versioned marker (enc:v1:). Legacy
 *   plaintext base32 rows stay readable and are transparently upgraded to
 *   encrypted form only after a successful, possession-proven verification.
 * - Enrollment never silently replaces a valid enabled MFA secret. A pending
 *   (not-yet-verified) secret may be regenerated.
 * - Decryption failure fails closed: MFA can never be enabled or verified
 *   against an unreadable secret, and nothing about the failure leaks.
 */
@Injectable()
export class MfaService {
  private readonly events = createStructuredLogger('Mfa');

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  async enroll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (user?.isMfaEnabled) {
      this.events.warn('mfa_enrollment_rejected', { userId, reason: 'already_enabled' });
      throw new ConflictException('MFA already enabled');
    }

    const secret = speakeasy.generateSecret({ name: 'TechFusion AI' });

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptMfaSecret(this.encryption, secret.base32) },
    });

    this.events.log('mfa_enrollment_started', { userId });

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url!);
    return { secret: secret.base32, qrCode: qrCodeDataUrl };
  }

  async verify(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new BadRequestException('MFA not enrolled');
    }
    if (user.isMfaEnabled) {
      this.events.warn('mfa_enrollment_rejected', { userId, reason: 'already_enabled' });
      throw new ConflictException('MFA already enabled');
    }

    const storedSecret = user.mfaSecret;

    let plaintextSecret: string;
    try {
      plaintextSecret = decryptMfaSecret(this.encryption, storedSecret);
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
      throw new BadRequestException('Invalid TOTP token');
    }

    // Enable MFA and, when the secret was still stored in a legacy format,
    // upgrade it to the encrypted representation in the same transaction. Both
    // writes are atomic: possession of the secret was just proven above.
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isMfaEnabled: true },
      });
      if (!isEncryptedMfaSecret(storedSecret)) {
        await tx.user.update({
          where: { id: userId },
          data: { mfaSecret: encryptMfaSecret(this.encryption, plaintextSecret) },
        });
      }
    });

    this.events.log('mfa_enabled', { userId });
    return { message: 'MFA enabled successfully' };
  }

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isMfaEnabled: true },
    });
    return { isMfaEnabled: user?.isMfaEnabled ?? false };
  }
}

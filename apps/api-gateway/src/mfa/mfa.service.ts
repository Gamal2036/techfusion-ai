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
import { ReauthenticationService } from '../reauthentication/reauthentication.service';
import { RecoveryCodesService } from './recovery-codes.service';
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
 *
 * ACC-SEC-02B2 — MFA lifecycle completion.
 *
 * - `disable` requires the current password plus a valid TOTP or a valid unused
 *   recovery code; it clears the secret and recovery material atomically.
 * - Recovery codes are hashed at rest, returned in plaintext exactly once, and
 *   consumed atomically (one-time use, concurrency-safe).
 * - Recovery-code generation/regeneration requires password re-authentication
 *   and a valid current TOTP, and only while MFA is enabled.
 */
@Injectable()
export class MfaService {
  private readonly events = createStructuredLogger('Mfa');

  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private reauth: ReauthenticationService,
    private recoveryCodes: RecoveryCodesService,
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

  // ─── MFA disable (ACC-SEC-02B2) ───────────────────────────────────

  /**
   * Disables MFA for the authenticated user. Requires the current account
   * password (re-authentication) plus a valid TOTP token OR a valid unused
   * recovery code. A password alone never disables MFA.
   *
   * Atomicity: the secret and all recovery material are cleared in the same
   * transaction/write as the disable flag. When a recovery code is used, the
   * code is consumed inside the same transaction — a failure rolls back the
   * consumption, so a code is never spent on a failed operation.
   */
  async disable(userId: string, password: string, token?: string, recoveryCode?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isMfaEnabled: true, mfaSecret: true },
    });

    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      this.events.warn('mfa_disable_failed', { userId, reason: 'not_enabled' });
      throw new BadRequestException('MFA not enabled');
    }

    await this.reauth.verifyPassword(userId, password);

    const hasToken = typeof token === 'string' && token.length > 0;
    const hasRecoveryCode = typeof recoveryCode === 'string' && recoveryCode.length > 0;

    if (!hasToken && !hasRecoveryCode) {
      this.events.warn('mfa_disable_failed', { userId, reason: 'missing_second_factor' });
      throw new BadRequestException('A valid TOTP token or recovery code is required');
    }

    if (hasToken) {
      const plaintextSecret = this.decryptSecretOrFail(userId, user.mfaSecret);
      const verified = speakeasy.totp.verify({
        secret: plaintextSecret,
        encoding: 'base32',
        token,
      });
      if (!verified) {
        this.events.warn('mfa_disable_failed', { userId, reason: 'invalid_token' });
        throw new BadRequestException('Invalid TOTP token');
      }
      await this.disableMfaAtomic(userId);
    } else {
      const disabled = await this.prisma.$transaction(async (tx) => {
        const consumed = await this.recoveryCodes.consume(tx, userId, recoveryCode!);
        if (!consumed) return false;
        await tx.user.update({
          where: { id: userId },
          data: { isMfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
        });
        return true;
      });
      if (!disabled) {
        this.events.warn('mfa_disable_failed', { userId, reason: 'invalid_recovery_code' });
        throw new BadRequestException('Invalid recovery code');
      }
      this.events.log('mfa_recovery_code_used', { userId });
    }

    this.events.log('mfa_disabled', { userId });
    return { message: 'MFA disabled' };
  }

  // ─── Recovery codes (ACC-SEC-02B2) ───────────────────────────────

  /**
   * Generates a fresh recovery-code set. Requires MFA to be enabled, password
   * re-authentication, and a valid current TOTP. Plaintext codes are returned
   * once; only hashes are stored.
   */
  async generateRecoveryCodes(userId: string, password: string, token: string) {
    await this.requireEnabledWithTopt(userId, password, token);
    const codes = await this.recoveryCodes.generate(userId, { regenerate: false });
    return { codes };
  }

  /**
   * Regenerates recovery codes, invalidating every previously issued code.
   * Same re-authentication requirements as generation.
   */
  async regenerateRecoveryCodes(userId: string, password: string, token: string) {
    await this.requireEnabledWithTopt(userId, password, token);
    const codes = await this.recoveryCodes.generate(userId, { regenerate: true });
    return { codes };
  }

  /**
   * Safe metadata only: generated flag + available count. No code value is ever
   * returned.
   */
  async recoveryCodesStatus(userId: string) {
    return this.recoveryCodes.status(userId);
  }

  // ─── Shared helpers ───────────────────────────────────────────────

  private async requireEnabledWithTopt(userId: string, password: string, token: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isMfaEnabled: true, mfaSecret: true },
    });
    if (!user || !user.isMfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA not enabled');
    }
    await this.reauth.verifyPassword(userId, password);
    const plaintextSecret = this.decryptSecretOrFail(userId, user.mfaSecret);
    const verified = speakeasy.totp.verify({
      secret: plaintextSecret,
      encoding: 'base32',
      token,
    });
    if (!verified) {
      throw new BadRequestException('Invalid TOTP token');
    }
  }

  /**
   * Decrypts the stored MFA secret using the fail-closed utility. Any
   * decryption failure becomes a deterministic 500 with no leak: the secret can
   * never be used, and MFA operations against it are denied.
   */
  private decryptSecretOrFail(userId: string, storedSecret: string): string {
    try {
      return decryptMfaSecret(this.encryption, storedSecret);
    } catch {
      this.events.error('mfa_verification_failed', { userId, reason: 'secret_decryption_failed' });
      throw new InternalServerErrorException('MFA verification unavailable');
    }
  }

  /**
   * Atomically clears MFA enablement, the encrypted secret, and any recovery
   * material in a single write. A disabled account never retains an active
   * secret or unused recovery codes.
   */
  private async disableMfaAtomic(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
    });
  }
}

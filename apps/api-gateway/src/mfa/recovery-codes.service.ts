import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createStructuredLogger } from '../common/structured-logger';
import {
  generateRecoveryCodes,
  normalizeRecoveryCode,
  hashRecoveryCode,
  serializeRecoveryCodeHashes,
  parseRecoveryCodeHashes,
  timingSafeEqualHex,
} from './recovery-codes.util';

export interface RecoveryCodesStatus {
  generated: boolean;
  availableCount: number;
}

/**
 * ACC-SEC-02B2 — MFA recovery-code lifecycle.
 *
 * - Plaintext codes are produced only by `generate()` and returned to the
 *   caller exactly once; only SHA-256 hashes are persisted.
 * - Consumption is atomic and one-time: `consume()` runs inside the caller's
 *   transaction and takes a row lock on the User row (`SELECT ... FOR UPDATE`),
 *   so two concurrent attempts can never both succeed with the same code. The
 *   consumed hash is removed before the caller's protected operation commits;
 *   if that operation fails, the whole transaction (including the consumption)
 *   rolls back.
 * - Regeneration replaces the entire stored hash set, invalidating every
 *   previous code.
 * - Status exposes only safe metadata (generated flag + available count), never
 *   code values.
 */
@Injectable()
export class RecoveryCodesService {
  private readonly events = createStructuredLogger('Mfa');

  constructor(private prisma: PrismaService) {}

  /**
   * Generates a fresh set of recovery codes and persists only their hashes.
   * `regenerate` controls the emitted security event (regenerated vs generated).
   * Returns the plaintext codes for the caller's one-time display.
   */
  async generate(userId: string, opts: { regenerate: boolean }): Promise<string[]> {
    const plaintext = generateRecoveryCodes();
    const hashes = plaintext.map((code) => hashRecoveryCode(normalizeRecoveryCode(code)));

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: serializeRecoveryCodeHashes(hashes) },
    });

    this.events.log(
      opts.regenerate ? 'mfa_recovery_codes_regenerated' : 'mfa_recovery_codes_generated',
      { userId },
    );
    return plaintext;
  }

  async status(userId: string): Promise<RecoveryCodesStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaBackupCodes: true },
    });
    const hashes = parseRecoveryCodeHashes(user?.mfaBackupCodes ?? null);
    return { generated: hashes.length > 0, availableCount: hashes.length };
  }

  /**
   * Atomically consumes a submitted recovery code inside the caller's
   * transaction. Returns true when the code matched an unused stored hash (and
   * the hash was removed); false when the code is invalid or already used.
   * The row lock serializes concurrent consumers: the loser re-reads the row
   * after the winner commits and no longer finds the code.
   */
  async consume(tx: Prisma.TransactionClient, userId: string, submittedCode: string): Promise<boolean> {
    const submittedHash = hashRecoveryCode(normalizeRecoveryCode(submittedCode));

    const rows = await tx.$queryRaw<Array<{ id: string; mfaBackupCodes: string | null }>>`
      SELECT id, "mfaBackupCodes" FROM "User" WHERE id = ${userId} FOR UPDATE`;

    const stored = parseRecoveryCodeHashes(rows[0]?.mfaBackupCodes ?? null);
    const matchIndex = stored.findIndex((hash) => timingSafeEqualHex(hash, submittedHash));
    if (matchIndex === -1) {
      return false;
    }

    const remaining = stored.filter((_, index) => index !== matchIndex);
    await tx.user.update({
      where: { id: userId },
      data: {
        mfaBackupCodes: remaining.length > 0 ? serializeRecoveryCodeHashes(remaining) : null,
      },
    });
    return true;
  }
}

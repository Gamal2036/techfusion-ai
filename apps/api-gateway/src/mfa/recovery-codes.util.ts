import * as crypto from 'crypto';

/**
 * ACC-SEC-02B2 — Canonical MFA recovery-code contract.
 *
 * FORMAT
 *   A recovery code is 16 uppercase base32 characters (alphabet A-Z2-7) grouped
 *   as XXXX-XXXX-XXXX-XXXX. Generation draws uniform random bytes and maps them
 *   into the 32-char alphabet (256 % 32 === 0, so there is no modulo bias).
 *   16 base32 chars ≈ 80 bits of entropy per code; 10 codes are issued.
 *
 * NORMALIZATION
 *   Before hashing or comparison, a submitted code is normalized:
 *   non-alphanumeric characters (hyphens, spaces) are removed and the result is
 *   uppercased. Generation output, display, storage and comparison all use the
 *   normalized flat 16-char form internally.
 *
 * HASHING
 *   Only SHA-256 hex digests of the normalized code with a fixed domain
 *   separator are stored (prefix `techfusion:mfa-recovery:v1:`). Plaintext
 *   codes are never persisted, logged, or returned more than once.
 *
 * STORAGE
 *   `User.mfaBackupCodes` (TEXT) holds a JSON array of the currently available
 *   (unused) code hashes. Consumption removes the matched hash; regeneration
 *   replaces the whole array. NULL or an empty array means "not generated".
 */
export const RECOVERY_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const RECOVERY_CODE_GROUP_LENGTH = 4;
export const RECOVERY_CODE_GROUPS = 4;
export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_CODE_HASH_DOMAIN = 'techfusion:mfa-recovery:v1:';

function flatRecoveryCode(): string {
  const bytes = crypto.randomBytes(RECOVERY_CODE_GROUPS * RECOVERY_CODE_GROUP_LENGTH);
  let flat = '';
  for (const byte of bytes) {
    flat += RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length];
  }
  return flat;
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(formatRecoveryCode(flatRecoveryCode()));
  }
  return codes;
}

export function formatRecoveryCode(flat: string): string {
  const groups: string[] = [];
  for (let i = 0; i < flat.length; i += RECOVERY_CODE_GROUP_LENGTH) {
    groups.push(flat.slice(i, i + RECOVERY_CODE_GROUP_LENGTH));
  }
  return groups.join('-');
}

export function normalizeRecoveryCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function hashRecoveryCode(normalizedCode: string): string {
  return crypto
    .createHash('sha256')
    .update(RECOVERY_CODE_HASH_DOMAIN + normalizedCode)
    .digest('hex');
}

export function serializeRecoveryCodeHashes(hashes: string[]): string {
  return JSON.stringify(hashes);
}

export function parseRecoveryCodeHashes(stored: string | null): string[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

/**
 * Constant-time comparison of two SHA-256 hex digests of equal length.
 * Length mismatches short-circuit (hashes are always 64 hex chars).
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

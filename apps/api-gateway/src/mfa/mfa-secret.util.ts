import { EncryptionService } from '../encryption/encryption.service';

/**
 * Versioned representation of an MFA secret stored at rest.
 *
 * New enrollments are stored as `enc:v1:` + envelope-encrypted base64. Legacy
 * rows written before encryption (plaintext base32) and any historical
 * `iv:authTag:ciphertext` values remain readable so existing enrolled users are
 * never locked out. Detection is unambiguous: base32 uses only A-Z2-7 (no
 * colon), the envelope base64 never contains a colon, and the versioned prefix
 * identifies our format exactly.
 */
export const MFA_SECRET_ENCRYPTED_PREFIX = 'enc:v1:';

export function encryptMfaSecret(encryption: EncryptionService, base32Secret: string): string {
  return `${MFA_SECRET_ENCRYPTED_PREFIX}${encryption.encrypt(base32Secret)}`;
}

export function decryptMfaSecret(encryption: EncryptionService, stored: string): string {
  if (stored.startsWith(MFA_SECRET_ENCRYPTED_PREFIX)) {
    return encryption.decrypt(stored.slice(MFA_SECRET_ENCRYPTED_PREFIX.length));
  }
  if (stored.includes(':')) {
    return encryption.decryptLegacy(stored);
  }
  return stored;
}

export function isEncryptedMfaSecret(stored: string): boolean {
  return stored.startsWith(MFA_SECRET_ENCRYPTED_PREFIX);
}

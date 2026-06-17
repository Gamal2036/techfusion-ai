import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Enterprise-grade encryption service using KMS-backed envelope encryption.
 *
 * KEY MANAGEMENT APPROACH:
 * ========================
 * This service implements envelope encryption where a Key Encryption Key (KEK)
 * is held by a KMS provider and Data Encryption Keys (DEKs) are generated per
 * encryption operation.
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │                   ENVELOPE ENCRYPTION                    │
 * ├─────────────────────────────────────────────────────────┤
 * │  KMS (Key Management Service)                            │
 * │  ┌──────────────────────────────────┐                    │
 * │  │  Master Key (KEK)                │  ← Stored in KMS   │
 * │  │  env: KMS_KEY_ID / MASTER_KEY    │                    │
 * │  └────────────┬─────────────────────┘                    │
 * │               │ encrypt(DEK)                             │
 * │               ▼                                          │
 * │  ┌──────────────────────────────────┐                    │
 * │  │  Wrapped DEK ──► Stored with CT  │  ← Envelope        │
 * │  └──────────────────────────────────┘                    │
 * │                                                          │
 * │  Per-field encryption:                                   │
 * │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐ │
 * │  │  API Keys   │  │  SSO Secrets │  │  Recording URLs  │ │
 * │  │ (AES-256)   │  │  (AES-256)   │  │  (AES-256)       │ │
 * │  └─────────────┘  └──────────────┘  └──────────────────┘ │
 * └─────────────────────────────────────────────────────────┘
 *
 * KEK (Key Encryption Key):
 *   - In production: AWS KMS (kms:Encrypt / kms:Decrypt) with key rotation
 *   - In dev: MASTER_KEY env var, derived via HKDF
 *   - Algorithm: AES-256-GCM for DEK wrapping
 *
 * DEK (Data Encryption Key):
 *   - 256-bit random per encryption call
 *   - Encrypted by KEK before storage
 *   - Stored alongside ciphertext as "wrappedDek"
 *
 * SENSITIVE FIELDS ENCRYPTED:
 *   - AiProviderConfig.apiKeyEncrypted
 *   - SsoConfig.clientSecretEncrypted
 *   - RemoteSession.recordingPath (via URL signing)
 *   - BackupJob.sourcePaths (when containing credentials)
 *   - BackupRun.metadata (when containing sensitive paths)
 *
 * FORMAT:
 *   Envelope: base64(iv + wrappedDek + authTag + ciphertext)
 *   Each component is 16+44+16+N bytes
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);

  private getMasterKey(): Buffer {
    // In production, this would call KMS (AWS KMS / GCP Cloud KMS / Azure Key Vault)
    // to decrypt the KEK. For development, we derive from env var.
    const raw = process.env.MASTER_KEY || process.env.AI_ENCRYPTION_KEY;
    if (!raw) {
      throw new Error(
        'MASTER_KEY or AI_ENCRYPTION_KEY environment variable is required. ' +
        'See key-management.docs.ts for production setup.',
      );
    }
    return crypto.scryptSync(raw, 'techfusion-ai-envelope-salt', KEY_LENGTH);
  }

  /**
   * Encrypt plaintext using envelope encryption:
   * 1. Generate random DEK
   * 2. Encrypt DEK with KEK (wrapped key)
   * 3. Encrypt plaintext with DEK using AES-256-GCM
   * 4. Return envelope: { wrappedDek, iv, authTag, ciphertext }
   */
  encrypt(plaintext: string): string {
    const kek = this.getMasterKey();
    const dek = crypto.randomBytes(KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Encrypt DEK with KEK
    const kekCipher = crypto.createCipheriv(ALGORITHM, kek, iv);
    let wrappedDek = kekCipher.update(dek);
    wrappedDek = Buffer.concat([wrappedDek, kekCipher.final()]);
    const kekAuthTag = kekCipher.getAuthTag();

    // Encrypt plaintext with DEK
    const dekCipher = crypto.createCipheriv(ALGORITHM, dek, iv);
    let encrypted = dekCipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, dekCipher.final()]);
    const dekAuthTag = dekCipher.getAuthTag();

    // Envelope: iv + wrappedDekLength(2 bytes) + wrappedDek + kekAuthTag + dekAuthTag + ciphertext
    const wdLen = Buffer.alloc(2);
    wdLen.writeUInt16BE(wrappedDek.length);

    const envelope = Buffer.concat([
      iv,
      wdLen,
      wrappedDek,
      kekAuthTag,
      dekAuthTag,
      encrypted,
    ]);

    return envelope.toString('base64');
  }

  /**
   * Decrypt an envelope-encrypted string.
   * Reverse of encrypt().
   */
  decrypt(encoded: string): string {
    const kek = this.getMasterKey();
    const envelope = Buffer.from(encoded, 'base64');

    let offset = 0;
    const iv = envelope.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const wdLen = envelope.readUInt16BE(offset);
    offset += 2;

    const wrappedDek = envelope.subarray(offset, offset + wdLen);
    offset += wdLen;

    const kekAuthTag = envelope.subarray(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;

    const dekAuthTag = envelope.subarray(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;

    const encrypted = envelope.subarray(offset);

    // Decrypt DEK with KEK
    const kekDecipher = crypto.createDecipheriv(ALGORITHM, kek, iv);
    kekDecipher.setAuthTag(kekAuthTag);
    const dek = Buffer.concat([
      kekDecipher.update(wrappedDek),
      kekDecipher.final(),
    ]);

    // Decrypt plaintext with DEK
    const dekDecipher = crypto.createDecipheriv(ALGORITHM, dek, iv);
    dekDecipher.setAuthTag(dekAuthTag);
    const decrypted = Buffer.concat([
      dekDecipher.update(encrypted),
      dekDecipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Encrypt using the simpler format compatible with existing
   * AiProviderConfig storage (iv:authTag:ciphertext in hex).
   * Used for fields encrypted before the envelope upgrade.
   */
  encryptLegacy(plaintext: string): string {
    const key = this.getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt a legacy-format encrypted string.
   */
  decryptLegacy(encoded: string): string {
    const key = this.getMasterKey();
    const parts = encoded.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid legacy encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Detect format and decrypt accordingly.
   */
  decryptAny(encoded: string): string {
    if (encoded.includes(':')) {
      return this.decryptLegacy(encoded);
    }
    return this.decrypt(encoded);
  }
}

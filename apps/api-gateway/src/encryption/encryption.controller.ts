import { Controller, Post, Body, Req } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { Roles } from '../common/roles.decorator';

@Controller('admin/encryption')
@Roles('Owner')
export class EncryptionController {
  constructor(private encryptionService: EncryptionService) {}

  @Post('verify')
  async verify() {
    const testPayload = 'techfusion-enterprise-encryption-verification-' + Date.now();
    try {
      const encrypted = this.encryptionService.encrypt(testPayload);
      const decrypted = this.encryptionService.decrypt(encrypted);
      const match = decrypted === testPayload;

      const legacyEncrypted = this.encryptionService.encryptLegacy(testPayload);
      const legacyDecrypted = this.encryptionService.decryptLegacy(legacyEncrypted);
      const legacyMatch = legacyDecrypted === testPayload;

      return {
        status: match && legacyMatch ? 'ok' : 'mismatch',
        envelopeEncryption: { works: match, inputLength: testPayload.length, outputLength: encrypted.length },
        legacyEncryption: { works: legacyMatch },
        keyDerivation: 'scrypt',
        algorithm: 'aes-256-gcm',
        keyManagement: 'envelope-encryption-with-kek-dek',
        note: 'In production, configure MASTER_KEY via KMS (AWS KMS / GCP Cloud KMS / Azure Key Vault)',
      };
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }
}

import {
  TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
  TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
  isValidContractVersion,
  isValidTransactionalEmailPayload,
  isValidRecipientEmailAddress,
  isValidTransactionalEmailDeliveryEnvelope,
  openTransactionalEmailDeliveryEnvelope,
  sealTransactionalEmailDeliveryEnvelope,
  loadMailPayloadEncryptionKey,
  MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV,
  type TransactionalEmailJob,
  type PasswordResetEmailPayloadV1,
} from '@techfusion/types';
import { MockQueueService } from '../../queue/queue.service.mock';

// Ephemeral in-test key — never sourced from repository .env files.
const TEST_KEY = Buffer.alloc(32, 5);
const RECIPIENT = 'user@example.com';

function sealSample(templateData?: PasswordResetEmailPayloadV1, to = RECIPIENT): string {
  return sealTransactionalEmailDeliveryEnvelope(
    {
      envelopeVersion: TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
      to,
      templateData:
        templateData ?? {
          recipientName: 'Test User',
          actionUrl: 'https://app.techfusion.ai/reset-password?token=abc',
          expiresIn: '15 minutes',
        },
    },
    TEST_KEY,
  );
}

describe('Transactional Email Producer Contract', () => {
  let mockQueue: MockQueueService;

  beforeEach(() => {
    mockQueue = new MockQueueService();
  });

  describe('Producer includes contract version', () => {
    it('MockQueueService.addTransactionalEmail accepts version field', async () => {
      await mockQueue.addTransactionalEmail({
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'password-reset',
        encryptedPayload: sealSample(),
        recipientHash: 'abc123',
        idempotencyKey: 'pwd-reset-token-1',
        correlationId: 'corr-1',
      });

      const jobs = mockQueue.getJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].type).toBe('transactional_email');
      expect(jobs[0].data.version).toBe(TRANSACTIONAL_EMAIL_CONTRACT_VERSION);
    });

    it('version field is exactly 1 (current contract version)', async () => {
      await mockQueue.addTransactionalEmail({
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'password-reset',
        encryptedPayload: sealSample(),
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
      });

      const jobs = mockQueue.getJobs();
      expect(jobs[0].data.version).toBe(1);
    });

    it('version passes through to stored job data', async () => {
      await mockQueue.addTransactionalEmail({
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'email-verification',
        encryptedPayload: sealSample(),
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
      });

      const jobs = mockQueue.getJobs();
      expect(jobs[0].data.version).toBe(1);
      expect(jobs[0].data.templateId).toBe('email-verification');
    });
  });

  describe('Contract version constant', () => {
    it('CONTRACT_VERSION is 1', () => {
      expect(TRANSACTIONAL_EMAIL_CONTRACT_VERSION).toBe(1);
    });

    it('isValidContractVersion accepts 1', () => {
      expect(isValidContractVersion(1)).toBe(true);
    });

    it('isValidContractVersion rejects undefined', () => {
      expect(isValidContractVersion(undefined)).toBe(false);
    });

    it('isValidContractVersion rejects future versions', () => {
      expect(isValidContractVersion(2)).toBe(false);
      expect(isValidContractVersion(999)).toBe(false);
    });

    it('isValidContractVersion rejects non-number types', () => {
      expect(isValidContractVersion('1')).toBe(false);
      expect(isValidContractVersion(null)).toBe(false);
    });
  });

  describe('TransactionalEmailJob type contract', () => {
    it('type requires version: 1 literal', () => {
      const job: TransactionalEmailJob = {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: 'encrypted',
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
      };
      expect(job.version).toBe(1);
    });

    it('type constrains templateId to known templates', () => {
      const validTemplates: TransactionalEmailJob['templateId'][] = [
        'password-reset',
        'email-verification',
        'security-notification',
      ];
      expect(validTemplates).toHaveLength(3);
    });
  });

  describe('Encrypted delivery envelope (shared sealing)', () => {
    it('seal → open round-trip preserves the real recipient and typed template data', () => {
      const sealed = sealSample();
      const envelope = openTransactionalEmailDeliveryEnvelope(sealed, TEST_KEY);

      expect(envelope.envelopeVersion).toBe(TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION);
      expect(envelope.to).toBe(RECIPIENT);
      expect(envelope.templateData).toMatchObject({
        actionUrl: expect.stringContaining('/reset-password?token='),
      });
      expect(
        isValidTransactionalEmailDeliveryEnvelope('password-reset', envelope),
      ).toBe(true);
    });

    it('sealed container carries no plaintext recipient email', () => {
      const sealed = sealSample();
      expect(sealed).not.toContain(RECIPIENT);

      const jobData = {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: sealed,
        recipientHash: 'abc123',
        idempotencyKey: 'key',
        correlationId: 'corr',
      };
      // Root BullMQ job data must not contain the plaintext address anywhere.
      expect(JSON.stringify(jobData)).not.toContain(RECIPIENT);
    });

    it('rejects tampered ciphertext and wrong keys', () => {
      const container = JSON.parse(sealSample());
      const ct = Buffer.from(container.ciphertext, 'base64');
      ct[ct.length - 1] ^= 0x01;
      container.ciphertext = ct.toString('base64');
      expect(() =>
        openTransactionalEmailDeliveryEnvelope(JSON.stringify(container), TEST_KEY),
      ).toThrow(/authentication failed/i);

      expect(() =>
        openTransactionalEmailDeliveryEnvelope(sealSample(), Buffer.alloc(32, 6)),
      ).toThrow(/authentication failed/i);
    });

    it('validates recipient addresses and rejects injection vectors', () => {
      expect(isValidRecipientEmailAddress('first.last+tag@sub.domain.co')).toBe(true);
      expect(isValidRecipientEmailAddress('a,b@example.com')).toBe(false);
      expect(isValidRecipientEmailAddress('a@example.com\r\nBcc: v@example.com')).toBe(false);
      expect(isValidRecipientEmailAddress('nope')).toBe(false);
    });

    it('fails closed when MAIL_PAYLOAD_ENCRYPTION_KEY_B64 is missing or invalid', () => {
      const original = process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV];
      delete process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV];
      expect(() => loadMailPayloadEncryptionKey()).toThrow(/MAIL_PAYLOAD_ENCRYPTION_KEY_B64 is required/);

      process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV] = Buffer.alloc(16, 1).toString('base64');
      expect(() => loadMailPayloadEncryptionKey()).toThrow(/exactly 32 bytes/);

      process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV] = 'not-base64!!!';
      expect(() => loadMailPayloadEncryptionKey()).toThrow();

      if (original === undefined) {
        delete process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV];
      } else {
        process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV] = original;
      }
    });

    it('accepts a canonical base64 32-byte key', () => {
      const original = process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV];
      const keyB64 = Buffer.alloc(32, 9).toString('base64');
      process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV] = keyB64;
      expect(loadMailPayloadEncryptionKey().length).toBe(32);
      if (original === undefined) {
        delete process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV];
      } else {
        process.env[MAIL_PAYLOAD_ENCRYPTION_KEY_B64_ENV] = original;
      }
    });

    it('producer payload satisfies the shared worker-side validators after opening', async () => {
      const templateData: PasswordResetEmailPayloadV1 = {
        recipientName: 'Test User',
        actionUrl: 'https://app.techfusion.ai/reset-password?token=abc123',
        expiresIn: '15 minutes',
      };

      expect(isValidTransactionalEmailPayload('password-reset', templateData)).toBe(true);
      expect(isValidTransactionalEmailPayload('password-reset', {})).toBe(false);
      expect(isValidTransactionalEmailPayload('password-reset', { recipientName: 'x' })).toBe(false);
      expect(isValidTransactionalEmailPayload('password-reset', null)).toBe(false);

      await mockQueue.addTransactionalEmail({
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'password-reset',
        encryptedPayload: sealSample(templateData),
        recipientHash: 'abc123',
        idempotencyKey: 'pwd-reset-token-123',
        correlationId: 'pwd-reset-user-1-1234567890',
      });

      const stored = mockQueue.getJobs()[0].data;
      const envelope = openTransactionalEmailDeliveryEnvelope(stored.encryptedPayload, TEST_KEY);
      expect(
        isValidTransactionalEmailDeliveryEnvelope(stored.templateId, envelope),
      ).toBe(true);
      expect(envelope.to).toBe(RECIPIENT);
    });
  });

  describe('Password-reset producer includes version', () => {
    it('forgotPassword flow would produce job with version 1', async () => {
      const jobData = {
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'password-reset' as const,
        encryptedPayload: sealSample(),
        recipientHash: 'abc123',
        idempotencyKey: 'pwd-reset-token-123',
        correlationId: 'pwd-reset-user-1-1234567890',
      };

      expect(jobData.version).toBe(1);
      expect(isValidContractVersion(jobData.version)).toBe(true);

      await mockQueue.addTransactionalEmail(jobData);
      const jobs = mockQueue.getJobs();
      expect(jobs[0].data.version).toBe(1);
    });
  });

  describe('Future producer contract enforcement', () => {
    it('invitation producer type would require version field', () => {
      const job: TransactionalEmailJob = {
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'password-reset',
        encryptedPayload: 'payload',
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
      };
      expect(job.version).toBeDefined();
      expect(typeof job.version).toBe('number');
    });

    it('email-verification producer type would require version field', () => {
      const job: TransactionalEmailJob = {
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'email-verification',
        encryptedPayload: 'payload',
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
      };
      expect(job.version).toBe(1);
    });

    it('security-notification producer type would require version field', () => {
      const job: TransactionalEmailJob = {
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'security-notification',
        encryptedPayload: 'payload',
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
      };
      expect(job.version).toBe(1);
    });
  });
});

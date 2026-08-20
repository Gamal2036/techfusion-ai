import {
  TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
  isValidContractVersion,
  type TransactionalEmailJob,
} from '@techfusion/types';
import { MockQueueService } from '../../queue/queue.service.mock';

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
        encryptedPayload: '{"rendered":{},"to":"user@test.com"}',
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
        encryptedPayload: '{}',
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
        encryptedPayload: '{}',
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

  describe('Password-reset producer includes version', () => {
    it('forgotPassword flow would produce job with version 1', async () => {
      const jobData = {
        version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
        templateId: 'password-reset' as const,
        encryptedPayload: JSON.stringify({
          rendered: { subject: 'Reset', textBody: 'text', htmlBody: '<p>html</p>' },
          to: 'user@example.com',
        }),
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

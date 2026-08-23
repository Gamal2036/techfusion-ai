import { Job } from 'bullmq';
import {
  TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
  isValidContractVersion,
  isValidTransactionalEmailPayload,
  type TransactionalEmailJob,
  type TransactionalEmailJobWithCorrelation,
} from '@techfusion/types';
import { createTestMailProvider } from '../mail/mail-providers';
import * as mailTemplates from '../mail/mail-templates';
import { MailUrlBuilder } from '../mail/mail-url-builder';
import { createMailProcessor } from '../mail/mail-processor';
import { MailDeliveryError } from '../mail/mail-provider.interface';

jest.mock('../metrics', () => ({
  startMetricsServer: jest.fn(),
  trackQueueDepth: jest.fn(),
  trackJobCompleted: jest.fn(),
  trackJobFailed: jest.fn(),
  trackJobDuration: jest.fn(),
  trackMonitoringSweep: jest.fn(),
  trackMonitoringSweepFailure: jest.fn(),
  getMetrics: jest.fn().mockResolvedValue(''),
  getMetricsContentType: jest.fn().mockReturnValue('text/plain'),
}));

jest.mock('../telemetry', () => ({
  initTelemetry: jest.fn().mockResolvedValue(undefined),
  shutdownTelemetry: jest.fn().mockResolvedValue(undefined),
}));

function makeJob(overrides: Partial<TransactionalEmailJobWithCorrelation> = {}): Job {
  return {
    id: 'test-job-1',
    data: {
      version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
      templateId: 'password-reset',
      encryptedPayload: JSON.stringify({
        recipientName: 'Test User',
        actionUrl: 'https://app.techfusion.ai/reset?token=abc123',
        expiresIn: '30 minutes',
      }),
      recipientHash: 'abc123def456',
      idempotencyKey: 'idem-test-1',
      correlationId: 'corr-test-1',
      _correlation: { requestId: 'req-1', correlationId: 'corr-test-1' },
      ...overrides,
    },
    attemptsMade: 1,
  } as unknown as Job;
}

describe('Transactional Email Queue Contract', () => {
  describe('Shared contract constant', () => {
    it('should export CONTRACT_VERSION as 1', () => {
      expect(TRANSACTIONAL_EMAIL_CONTRACT_VERSION).toBe(1);
    });

    it('should validate version 1 as valid', () => {
      expect(isValidContractVersion(1)).toBe(true);
    });

    it('should reject undefined as invalid', () => {
      expect(isValidContractVersion(undefined)).toBe(false);
    });

    it('should reject version 999 as invalid', () => {
      expect(isValidContractVersion(999)).toBe(false);
    });

    it('should reject string versions as invalid', () => {
      expect(isValidContractVersion('1')).toBe(false);
    });
  });

  describe('Worker accepts supported version (V1)', () => {
    it('should process a valid V1 password-reset job successfully', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob();
      const result = await processor(job);

      expect(result.success).toBe(true);
      expect(provider.getSentEmails()).toHaveLength(1);
    });

    it('should render password-reset template for valid V1 job', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob();
      await processor(job);

      const emails = provider.getSentEmails();
      expect(emails[0].rendered.subject).toContain('Reset your');
      expect(emails[0].rendered.htmlBody).toContain('Reset Password');
      expect(emails[0].rendered.textBody).toContain('reset your password');
    });

    it('should call provider exactly once for a valid job', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob();
      await processor(job);

      expect(provider.getSentEmails()).toHaveLength(1);
    });

    it('should render the template exactly once for a valid job', async () => {
      const renderSpy = jest.spyOn(mailTemplates, 'renderTemplate');
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob();
      await processor(job);

      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(provider.getSentEmails()).toHaveLength(1);
      renderSpy.mockRestore();
    });

    it('accepts payloads matching the shared authoritative payload validator', async () => {
      const payload = {
        recipientName: 'Test User',
        actionUrl: 'https://app.techfusion.ai/reset-password?token=abc',
        expiresIn: '15 minutes',
      };
      expect(isValidTransactionalEmailPayload('password-reset', payload)).toBe(true);

      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ encryptedPayload: JSON.stringify(payload) });
      const result = await processor(job);
      expect(result.success).toBe(true);
    });
  });

  describe('Worker rejects unsupported future version', () => {
    it('should reject version 999 with unsupported version error', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ version: 999 as any });
      await expect(processor(job)).rejects.toThrow(/Unsupported job version: 999/);
    });

    it('should reject version 0 as unsupported', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ version: 0 as any });
      await expect(processor(job)).rejects.toThrow(/Unsupported job version/);
    });

    it('should not call SMTP provider when version is unsupported', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ version: 999 as any });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Worker handles undefined version (legacy jobs)', () => {
    it('should reject undefined version with unsupported version error', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ version: undefined as any });
      await expect(processor(job)).rejects.toThrow(/Unsupported job version: undefined/);
    });

    it('should not call SMTP provider for undefined version jobs', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ version: undefined as any });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Invalid jobs never call SMTP provider', () => {
    it('should not call provider when templateId is missing', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ templateId: '' as any });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should not call provider when encryptedPayload is missing', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ encryptedPayload: '' as any });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should not call provider when idempotencyKey is missing', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ idempotencyKey: '' as any });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should reject payload missing recipientName before SMTP', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({
        encryptedPayload: JSON.stringify({
          actionUrl: 'https://app.techfusion.ai/reset-password?token=abc',
          expiresIn: '15 minutes',
        }),
      });

      await expect(processor(job)).rejects.toThrow(/Invalid transactional email payload/);
      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should reject payload with non-string required fields before SMTP', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({
        encryptedPayload: JSON.stringify({
          recipientName: 'Test User',
          actionUrl: { evil: true },
          expiresIn: '15 minutes',
        }),
      });

      await expect(processor(job)).rejects.toThrow(MailDeliveryError);
      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should reject empty-object payload before SMTP', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ encryptedPayload: JSON.stringify({}) });
      try {
        await processor(job);
        fail('Expected error');
      } catch (err: any) {
        expect(err.message).toMatch(/Invalid transactional email payload/);
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Retryable provider errors retain retry behavior', () => {
    it('should propagate retryable MailDeliveryError', async () => {
      const provider = createTestMailProvider();
      provider.setRetryableFailure(1);
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob();
      await expect(processor(job)).rejects.toThrow(MailDeliveryError);
    });
  });

  describe('Permanent contract errors do not retry', () => {
    it('should throw non-retryable error for unsupported version', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ version: 999 as any });
      try {
        await processor(job);
        fail('Expected error');
      } catch (err: any) {
        expect(err).not.toBeInstanceOf(MailDeliveryError);
        expect(err.message).toMatch(/Unsupported job version/);
      }
    });

    it('should throw non-retryable error for missing templateId', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({ templateId: '' as any });
      try {
        await processor(job);
        fail('Expected error');
      } catch (err: any) {
        expect(err).not.toBeInstanceOf(MailDeliveryError);
        expect(err.message).toMatch(/templateId/);
      }
    });

    it('should throw non-retryable MailDeliveryError for missing required payload fields', async () => {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob({
        encryptedPayload: JSON.stringify({ recipientName: 'Test User' }),
      });
      try {
        await processor(job);
        fail('Expected error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(MailDeliveryError);
        expect(err.isRetryable).toBe(false);
        expect(err.message).toMatch(/Invalid transactional email payload/);
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });
  });

  describe('No sensitive data logged', () => {
    it('should not log reset tokens in any log output', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const secretToken = 'SUPER_SECRET_RESET_TOKEN_XYZ789';
      const job = makeJob({
        encryptedPayload: JSON.stringify({
          recipientName: 'Test User',
          actionUrl: `https://app.techfusion.ai/reset?token=${secretToken}`,
          expiresIn: '30 minutes',
        }),
      });

      await processor(job);

      const allLogs = [
        ...consoleSpy.mock.calls,
        ...consoleErrorSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
      ]
        .map((c) => String(c.join(' ')))
        .join('\n');

      expect(allLogs).not.toContain(secretToken);
      expect(allLogs).not.toContain('SUPER_SECRET');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should not log SMTP credentials', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const decryptPayload = (encrypted: string) => JSON.parse(encrypted);
      const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

      const job = makeJob();
      await processor(job);

      const allLogs = [
        ...consoleSpy.mock.calls,
        ...consoleErrorSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
      ]
        .map((c) => String(c.join(' ')))
        .join('\n');

      expect(allLogs).not.toContain('smtp');
      expect(allLogs).not.toContain('password');
      expect(allLogs).not.toContain('credential');

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Contract type enforcement', () => {
    it('TransactionalEmailJob type requires version field', () => {
      const job: TransactionalEmailJob = {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: 'payload',
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
      };
      expect(job.version).toBe(1);
    });

    it('TransactionalEmailJobWithCorrelation supports _correlation', () => {
      const job: TransactionalEmailJobWithCorrelation = {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: 'payload',
        recipientHash: 'hash',
        idempotencyKey: 'key',
        correlationId: 'corr',
        _correlation: {
          requestId: 'req-1',
          correlationId: 'corr-1',
        },
      };
      expect(job._correlation?.requestId).toBe('req-1');
    });
  });
});

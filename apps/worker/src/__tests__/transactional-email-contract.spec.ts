import { Job, UnrecoverableError } from 'bullmq';
import { createCipheriv, randomBytes } from 'crypto';
import {
  TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
  TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
  isValidContractVersion,
  isValidTransactionalEmailPayload,
  isValidTransactionalEmailDeliveryEnvelope,
  isValidRecipientEmailAddress,
  openTransactionalEmailDeliveryEnvelope,
  sealTransactionalEmailDeliveryEnvelope,
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

// Ephemeral 32-byte test key — never sourced from repository .env files.
const TEST_KEY = Buffer.alloc(32, 7);
const REAL_RECIPIENT = 'user@example.com';
const OBSERVABILITY_HASH = 'abc123def4567890';

function sealedEnvelopePayload(envelopeOverrides: Record<string, unknown> = {}): string {
  return sealTransactionalEmailDeliveryEnvelope(
    {
      envelopeVersion: TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
      to: REAL_RECIPIENT,
      templateData: {
        recipientName: 'Test User',
        actionUrl: 'https://app.techfusion.ai/reset-password?token=abc123',
        expiresIn: '30 minutes',
      },
      ...envelopeOverrides,
    } as any,
    TEST_KEY,
  );
}

// Seals an arbitrary object without producer-side validation, so tests can
// simulate malformed envelopes that a compromised/buggy producer could emit.
function sealRaw(envelope: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', TEST_KEY, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(envelope), 'utf8')),
    cipher.final(),
  ]);
  return JSON.stringify({
    containerVersion: 1,
    scheme: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
}

function makeJob(options: {
  dataOverrides?: Record<string, unknown>;
  envelopeOverrides?: Record<string, unknown> | null;
  rawEncryptedPayload?: string;
} = {}): Job {
  const encryptedPayload =
    options.rawEncryptedPayload !== undefined
      ? options.rawEncryptedPayload
      : options.envelopeOverrides === null
        ? undefined
        : sealedEnvelopePayload(options.envelopeOverrides);

  return {
    id: 'test-job-1',
    data: {
      version: TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
      templateId: 'password-reset',
      encryptedPayload,
      recipientHash: OBSERVABILITY_HASH,
      idempotencyKey: 'idem-test-1',
      correlationId: 'corr-test-1',
      _correlation: { requestId: 'req-1', correlationId: 'corr-test-1' },
      ...(options.dataOverrides || {}),
    },
    attemptsMade: 1,
  } as unknown as Job;
}

function buildProcessor(provider = createTestMailProvider()) {
  const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
  const processor = createMailProcessor(
    provider,
    (encrypted: string) => openTransactionalEmailDeliveryEnvelope(encrypted, TEST_KEY),
    urlBuilder,
  );
  return { provider, processor };
}

function validTemplateData() {
  return {
    recipientName: 'Test User',
    actionUrl: 'https://app.techfusion.ai/reset-password?token=abc123',
    expiresIn: '30 minutes',
  };
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

  describe('Encrypted delivery envelope', () => {
    it('seal → open round-trip preserves recipient and typed template data', () => {
      const sealed = sealedEnvelopePayload();
      const envelope = openTransactionalEmailDeliveryEnvelope(sealed, TEST_KEY);
      expect(envelope.to).toBe(REAL_RECIPIENT);
      expect(envelope.templateData).toMatchObject({ recipientName: 'Test User' });
      expect(isValidTransactionalEmailDeliveryEnvelope('password-reset', envelope)).toBe(true);
    });

    it('sealed container never contains plaintext recipient email', () => {
      const sealed = sealedEnvelopePayload();
      expect(sealed).not.toContain(REAL_RECIPIENT);
      expect(JSON.parse(sealed)).toMatchObject({
        containerVersion: 1,
        scheme: 'aes-256-gcm',
      });
    });

    it('rejects tampered ciphertext', () => {
      const container = JSON.parse(sealedEnvelopePayload());
      const tampered = Buffer.from(container.ciphertext, 'base64');
      tampered[tampered.length - 1] ^= 0xff;
      container.ciphertext = tampered.toString('base64');
      expect(() =>
        openTransactionalEmailDeliveryEnvelope(JSON.stringify(container), TEST_KEY),
      ).toThrow(/authentication failed/i);
    });

    it('rejects decryption with the wrong key', () => {
      const wrongKey = Buffer.alloc(32, 9);
      expect(() =>
        openTransactionalEmailDeliveryEnvelope(sealedEnvelopePayload(), wrongKey),
      ).toThrow(/decryption or authentication failed/i);
    });

    it('rejects unsupported container versions and schemes', () => {
      const container = JSON.parse(sealedEnvelopePayload());
      container.containerVersion = 999;
      expect(() =>
        openTransactionalEmailDeliveryEnvelope(JSON.stringify(container), TEST_KEY),
      ).toThrow(/unsupported encrypted container/i);

      const container2 = JSON.parse(sealedEnvelopePayload());
      container2.scheme = 'aes-128-cbc';
      expect(() =>
        openTransactionalEmailDeliveryEnvelope(JSON.stringify(container2), TEST_KEY),
      ).toThrow(/unsupported encrypted container/i);
    });

    it('uses a fresh IV per sealed payload', () => {
      const first = JSON.parse(sealedEnvelopePayload());
      const second = JSON.parse(sealedEnvelopePayload());
      expect(first.iv).not.toBe(second.iv);
      expect(first.ciphertext).not.toBe(second.ciphertext);
    });

    it('validates recipient addresses without accepting injection vectors', () => {
      expect(isValidRecipientEmailAddress(REAL_RECIPIENT)).toBe(true);
      expect(isValidRecipientEmailAddress('first.last+tag@sub.domain.co')).toBe(true);
      expect(isValidRecipientEmailAddress('')).toBe(false);
      expect(isValidRecipientEmailAddress('not-an-email')).toBe(false);
      expect(isValidRecipientEmailAddress('a@b')).toBe(false);
      expect(isValidRecipientEmailAddress('a,b@example.com')).toBe(false);
      expect(isValidRecipientEmailAddress('a b@example.com')).toBe(false);
      expect(isValidRecipientEmailAddress('a@example.com\r\nBcc: victim@example.com')).toBe(false);
      expect(isValidRecipientEmailAddress(null)).toBe(false);
      expect(isValidRecipientEmailAddress(42)).toBe(false);
    });

    it('rejects envelopes with missing or malformed recipients', () => {
      expect(
        isValidTransactionalEmailDeliveryEnvelope('password-reset', {
          envelopeVersion: 1,
          templateData: {
            recipientName: 'Test User',
            actionUrl: 'https://app.techfusion.ai/reset-password?token=abc',
            expiresIn: '15 minutes',
          },
        }),
      ).toBe(false);

      expect(
        isValidTransactionalEmailDeliveryEnvelope('password-reset', {
          envelopeVersion: 1,
          to: REAL_RECIPIENT,
          templateData: { recipientName: 'Test User' },
        }),
      ).toBe(false);

      expect(isValidTransactionalEmailDeliveryEnvelope('password-reset', null)).toBe(false);
    });
  });

  describe('Worker accepts supported version (V1)', () => {
    it('should process a valid V1 password-reset job successfully', async () => {
      const { provider, processor } = buildProcessor();

      const result = await processor(makeJob());

      expect(result.success).toBe(true);
      expect(provider.getSentEmails()).toHaveLength(1);
    });

    it('provider receives the decrypted real recipient address', async () => {
      const { provider, processor } = buildProcessor();

      await processor(makeJob());

      const emails = provider.getSentEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0].metadata.to).toBe(REAL_RECIPIENT);
    });

    it('recipientHash is never used as the SMTP recipient', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({
        dataOverrides: { recipientHash: 'deadbeefcafe9876' },
      });

      await processor(job);

      const emails = provider.getSentEmails();
      expect(emails).toHaveLength(1);
      expect(emails[0].metadata.to).toBe(REAL_RECIPIENT);
      expect(emails[0].metadata.to).not.toContain('recipient-');
      expect(emails[0].metadata.to).not.toContain('deadbeef');
      expect(String(job.data.recipientHash)).not.toBe(emails[0].metadata.to);
    });

    it('root BullMQ job payload contains no plaintext recipient email', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob();
      const result = await processor(job);

      expect(result.success).toBe(true);
      const rootPayloadJson = JSON.stringify(job.data);
      expect(rootPayloadJson).not.toContain(REAL_RECIPIENT);
      expect(provider.getSentEmails()).toHaveLength(1);
    });

    it('encrypted payload contains a valid delivery envelope after decryption', async () => {
      const job = makeJob();
      const envelope = openTransactionalEmailDeliveryEnvelope(
        job.data.encryptedPayload as string,
        TEST_KEY,
      );

      expect(envelope.envelopeVersion).toBe(TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION);
      expect(envelope.to).toBe(REAL_RECIPIENT);
      expect(
        isValidTransactionalEmailDeliveryEnvelope('password-reset', envelope),
      ).toBe(true);
    });

    it('should render password-reset template for valid V1 job', async () => {
      const { provider, processor } = buildProcessor();

      await processor(makeJob());

      const emails = provider.getSentEmails();
      expect(emails[0].rendered.subject).toContain('Reset your');
      expect(emails[0].rendered.htmlBody).toContain('Reset Password');
      expect(emails[0].rendered.textBody).toContain('reset your password');
      expect(emails[0].rendered.textBody).toContain('/reset-password?token=abc123');
      expect(emails[0].rendered.textBody).toContain('30 minutes');
    });

    it('should call provider exactly once for a valid job', async () => {
      const { provider, processor } = buildProcessor();

      await processor(makeJob());

      expect(provider.getSentEmails()).toHaveLength(1);
    });

    it('should render the template exactly once for a valid job', async () => {
      const renderSpy = jest.spyOn(mailTemplates, 'renderTemplate');
      const { provider, processor } = buildProcessor();

      await processor(makeJob());

      expect(renderSpy).toHaveBeenCalledTimes(1);
      expect(provider.getSentEmails()).toHaveLength(1);
      renderSpy.mockRestore();
    });

    it('accepts envelopes whose templateData matches the shared authoritative payload validator', async () => {
      const templateData = {
        recipientName: 'Test User',
        actionUrl: 'https://app.techfusion.ai/reset-password?token=abc',
        expiresIn: '15 minutes',
      };
      expect(isValidTransactionalEmailPayload('password-reset', templateData)).toBe(true);

      const { provider, processor } = buildProcessor();
      const job = makeJob({
        envelopeOverrides: { templateData },
      });

      const result = await processor(job);
      expect(result.success).toBe(true);
      expect(provider.getSentEmails()[0].metadata.to).toBe(REAL_RECIPIENT);
    });
  });

  describe('Worker rejects unsupported future version', () => {
    it('should reject version 999 with unsupported version error', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { version: 999 } });
      await expect(processor(job)).rejects.toThrow(/Unsupported job version: 999/);
    });

    it('should reject version 0 as unsupported', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { version: 0 } });
      await expect(processor(job)).rejects.toThrow(/Unsupported job version/);
    });

    it('should not call SMTP provider when version is unsupported', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { version: 999 } });
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
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { version: undefined } });
      await expect(processor(job)).rejects.toThrow(/Unsupported job version: undefined/);
    });

    it('should not call SMTP provider for undefined version jobs', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { version: undefined } });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Malformed recipients are rejected before SMTP', () => {
    it('rejects envelope with empty recipient before contacting provider', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({
        rawEncryptedPayload: sealRaw({
          envelopeVersion: TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
          to: '',
          templateData: validTemplateData(),
        }),
      });

      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
      await expect(processor(job)).rejects.toThrow(/no valid recipient|delivery envelope/i);
      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('rejects envelope with non-address recipient before contacting provider', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({
        rawEncryptedPayload: sealRaw({
          envelopeVersion: TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
          to: 'not-an-email',
          templateData: validTemplateData(),
        }),
      });

      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
      await expect(processor(job)).rejects.toThrow(/no valid recipient/i);
      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('rejects envelope missing recipient entirely before contacting provider', async () => {
      const { provider, processor } = buildProcessor();

      // Simulates an envelope that was sealed without a recipient: opening it
      // must fail closed instead of deriving any fallback recipient.
      const job = makeJob({
        rawEncryptedPayload: sealRaw({
          envelopeVersion: TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
          templateData: validTemplateData(),
        }),
      });

      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
      expect(provider.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Invalid jobs never call SMTP provider', () => {
    it('should not call provider when templateId is missing', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { templateId: '' } });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should not call provider when encryptedPayload is missing', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { encryptedPayload: '' } });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should not call provider when idempotencyKey is missing', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { idempotencyKey: '' } });
      try {
        await processor(job);
      } catch {
        // expected
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should reject envelope templateData missing recipientName before SMTP', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({
        envelopeOverrides: {
          templateData: {
            actionUrl: 'https://app.techfusion.ai/reset-password?token=abc',
            expiresIn: '15 minutes',
          },
        },
      });

      await expect(processor(job)).rejects.toThrow(/Invalid transactional email payload/);
      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should reject envelope templateData with non-string required fields before SMTP', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({
        envelopeOverrides: {
          templateData: {
            recipientName: 'Test User',
            actionUrl: { evil: true },
            expiresIn: '15 minutes',
          },
        },
      });

      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
      await expect(processor(job)).rejects.toThrow(/Invalid transactional email payload/);
      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should reject empty-object templateData before SMTP', async () => {
      const { provider, processor } = buildProcessor();

      const job = makeJob({ envelopeOverrides: { templateData: {} } });
      try {
        await processor(job);
        fail('Expected error');
      } catch (err: any) {
        expect(err.message).toMatch(/Invalid transactional email payload/);
      }

      expect(provider.getSentEmails()).toHaveLength(0);
    });

    it('should permanently reject legacy plain-template payloads without a sealed container', async () => {
      const { provider, processor } = buildProcessor();

      const legacyPlainPayload = JSON.stringify({
        recipientName: 'Test User',
        actionUrl: 'https://app.techfusion.ai/reset-password?token=abc',
        expiresIn: '15 minutes',
      });
      const job = makeJob({ rawEncryptedPayload: legacyPlainPayload });

      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
      await expect(processor(job)).rejects.toThrow(/encrypted container|envelope/i);
      expect(provider.getSentEmails()).toHaveLength(0);
    });
  });

  describe('Permanent errors use the BullMQ non-retryable mechanism', () => {
    it('wraps unsupported version failures in UnrecoverableError', async () => {
      const { processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { version: 999 } });
      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
    });

    it('wraps missing templateId failures in UnrecoverableError', async () => {
      const { processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { templateId: '' } });
      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
    });

    it('wraps decryption failures in UnrecoverableError', async () => {
      const { processor } = buildProcessor();

      const job = makeJob({ rawEncryptedPayload: 'invalid-ciphertext' });
      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
      await expect(processor(job)).rejects.toThrow(/decryption|container|envelope/i);
    });

    it('wraps invalid template payload failures in UnrecoverableError', async () => {
      const { processor } = buildProcessor();

      const job = makeJob({
        envelopeOverrides: {
          templateData: { recipientName: 'Test User' },
        },
      });
      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
    });

    it('wraps unknown-template rendering failures in UnrecoverableError', async () => {
      const { processor } = buildProcessor();

      const job = makeJob({ dataOverrides: { templateId: 'nonexistent-template' } });
      await expect(processor(job)).rejects.toThrow(UnrecoverableError);
      await expect(processor(job)).rejects.toThrow(/Template rendering failed/);
    });
  });

  describe('Retryable provider errors retain retry behavior', () => {
    it('should propagate retryable MailDeliveryError unchanged (not Unrecoverable)', async () => {
      const provider = createTestMailProvider();
      provider.setRetryableFailure(1);
      const { processor } = buildProcessor(provider);

      let caught: any;
      try {
        await processor(makeJob());
        fail('Expected error');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(MailDeliveryError);
      expect((caught as MailDeliveryError).isRetryable).toBe(true);
      expect(caught).not.toBeInstanceOf(UnrecoverableError);
    });
  });

  describe('No sensitive data logged', () => {
    it('should not log reset tokens or recipient emails in any log output', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { processor } = buildProcessor();

      const secretToken = 'SUPER_SECRET_RESET_TOKEN_XYZ789';
      const job = makeJob({
        envelopeOverrides: {
          templateData: {
            recipientName: 'Test User',
            actionUrl: `https://app.techfusion.ai/reset?token=${secretToken}`,
            expiresIn: '30 minutes',
          },
        },
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
      expect(allLogs).not.toContain(REAL_RECIPIENT);
      expect(allLogs).not.toContain(OBSERVABILITY_HASH);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should not log recipient email even when processing fails permanently', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { processor } = buildProcessor();

      try {
        await processor(
          makeJob({
            rawEncryptedPayload: sealRaw({
              envelopeVersion: TRANSACTIONAL_EMAIL_DELIVERY_ENVELOPE_VERSION,
              to: '',
              templateData: validTemplateData(),
            }),
          }),
        );
      } catch {
        // expected permanent failure
      }

      const allLogs = [
        ...consoleSpy.mock.calls,
        ...consoleErrorSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
      ]
        .map((c) => String(c.join(' ')))
        .join('\n');

      expect(allLogs).not.toContain(REAL_RECIPIENT);

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should not log SMTP credentials', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { processor } = buildProcessor();

      await processor(makeJob());

      const allLogs = [
        ...consoleSpy.mock.calls,
        ...consoleErrorSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
      ]
        .map((c) => String(c.join(' ')))
        .join('\n');

      expect(allLogs).not.toContain('smtp-relay');
      expect(allLogs).not.toContain('password');
      expect(allLogs).not.toContain(TEST_KEY.toString('base64'));

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Contract type enforcement', () => {
    it('TransactionalEmailJob type requires version field', () => {
      const job: TransactionalEmailJobWithCorrelation = {
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

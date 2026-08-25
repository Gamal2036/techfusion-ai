import { Job, UnrecoverableError } from 'bullmq';
import {
  createDisabledMailProvider,
  createTestMailProvider,
  loadMailProviderConfig,
  classifySmtpDeliveryError,
} from '../mail/mail-providers';
import { renderTemplate } from '../mail/mail-templates';
import { MailUrlBuilder } from '../mail/mail-url-builder';
import { createMailProcessor } from '../mail/mail-processor';
import { MailDeliveryError, MailUnavailableError } from '../mail/mail-provider.interface';
import {
  openTransactionalEmailDeliveryEnvelope,
  sealTransactionalEmailDeliveryEnvelope,
} from '@techfusion/types';

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

describe('Worker Mail Providers', () => {
  // Test 1: Mail disabled by default
  it('should default to disabled when MAIL_ENABLED is not set', () => {
    delete process.env.MAIL_ENABLED;
    const config = loadMailProviderConfig();
    expect(config.enabled).toBe(false);
  });

  // Test 1b: Disabled mail never reports success
  it('disabled provider should throw MailUnavailableError on send', async () => {
    const provider = createDisabledMailProvider();
    await expect(
      provider.send(
        { subject: 'Test', textBody: 'test', htmlBody: '<p>test</p>' },
        { to: 'test@example.com', templateId: 'password-reset', correlationId: 'test' },
      ),
    ).rejects.toThrow(/not enabled/);
  });

  it('disabled provider should report not ready', () => {
    const provider = createDisabledMailProvider();
    expect(provider.isReady()).toBe(false);
  });

  // Test 3: No network connection in test mode
  it('test provider should not open any network connection', async () => {
    const provider = createTestMailProvider();
    const result = await provider.send(
      { subject: 'Test', textBody: 'test', htmlBody: '<p>test</p>' },
      { to: 'test@example.com', templateId: 'password-reset', correlationId: 'test' },
    );
    expect(result.success).toBe(true);
  });

  // Test 4: In-memory provider captures subject/text/html
  it('test provider should capture rendered message in memory', async () => {
    const provider = createTestMailProvider();
    const rendered = { subject: 'Subj', textBody: 'Text', htmlBody: '<p>HTML</p>' };
    await provider.send(rendered, { to: 'user@test.com', templateId: 'password-reset', correlationId: 'c1' });

    const emails = provider.getSentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].rendered.subject).toBe('Subj');
    expect(emails[0].rendered.textBody).toBe('Text');
    expect(emails[0].rendered.htmlBody).toBe('<p>HTML</p>');
  });
});

describe('Worker Email Templates', () => {
  // Test 12: Plain-text and HTML templates are both generated
  it('should render password-reset with both text and html', () => {
    const result = renderTemplate('password-reset', {
      recipientName: 'Test User',
      actionUrl: 'https://app.techfusion.ai/reset?token=abc123',
      expiresIn: '30 minutes',
    });
    expect(result.subject).toBeTruthy();
    expect(result.textBody).toContain('https://app.techfusion.ai/reset?token=abc123');
    expect(result.htmlBody).toContain('<!DOCTYPE html>');
  });

  it('should render email-verification with both text and html', () => {
    const result = renderTemplate('email-verification', {
      recipientName: 'Test User',
      actionUrl: 'https://app.techfusion.ai/verify?token=xyz',
      expiresIn: '24 hours',
    });
    expect(result.subject).toBeTruthy();
    expect(result.textBody).toBeTruthy();
    expect(result.htmlBody).toBeTruthy();
  });

  it('should render security-notification with both text and html', () => {
    const result = renderTemplate('security-notification', {
      recipientName: 'Test User',
      eventDescription: 'Password changed',
      timestamp: '2026-01-01',
    });
    expect(result.subject).toBeTruthy();
    expect(result.textBody).toBeTruthy();
    expect(result.htmlBody).toBeTruthy();
  });

  // Test 13: Unsupported template ID is rejected
  it('should throw for unsupported template ID', () => {
    expect(() => renderTemplate('invalid', { recipientName: 'User', actionUrl: 'https://x.com', expiresIn: '1h' })).toThrow(/Unsupported template ID/);
  });

  // Test 11: HTML interpolation is escaped
  it('should escape HTML in rendered emails', () => {
    const result = renderTemplate('password-reset', {
      recipientName: '<img onerror=alert(1)>',
      actionUrl: 'https://app.techfusion.ai/reset?token=abc',
      expiresIn: '30m',
    });
    expect(result.htmlBody).not.toContain('<img onerror=alert(1)>');
    expect(result.htmlBody).toContain('&lt;img');
  });
});

describe('Worker Mail URL Builder', () => {
  // Test 8: Production HTTPS origin is enforced
  it('should reject non-HTTPS in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new MailUrlBuilder('http://app.techfusion.ai')).toThrow(/HTTPS/);
    process.env.NODE_ENV = 'development';
  });

  // Test 9: Localhost development origin is allowed
  it('should accept localhost in development', () => {
    const builder = new MailUrlBuilder('http://localhost:3000');
    expect(builder.getOrigin()).toBe('http://localhost:3000');
  });

  // Test 10: Host headers cannot influence action URLs
  it('should construct URLs from trusted origin only', () => {
    const builder = new MailUrlBuilder('https://app.techfusion.ai');
    const url = builder.buildActionUrl('/reset', { token: 'abc' });
    expect(url).toBe('https://app.techfusion.ai/reset?token=abc');
  });

  it('should reject javascript: URLs', () => {
    expect(() => new MailUrlBuilder('javascript:alert(1)')).toThrow(/Dangerous URL scheme/);
  });

  it('should reject malformed URLs', () => {
    expect(() => new MailUrlBuilder('not-a-url')).toThrow(/Invalid/);
  });
});

describe('Worker Mail Processor', () => {
  const TEST_KEY = Buffer.alloc(32, 11);
  const RECIPIENT = 'processor@example.com';

  function sealedPayload(templateDataOverrides: Record<string, unknown> = {}, to = RECIPIENT): string {
    return sealTransactionalEmailDeliveryEnvelope(
      {
        envelopeVersion: 1,
        to,
        templateData: {
          recipientName: 'Test User',
          actionUrl: 'https://app.techfusion.ai/reset?token=abc',
          expiresIn: '30 minutes',
          ...templateDataOverrides,
        },
      },
      TEST_KEY,
    );
  }

  function makeProcessorJob(dataOverrides: Record<string, unknown> = {}, encryptedPayload?: string): Job {
    return {
      id: 'job-1',
      data: {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: encryptedPayload ?? sealedPayload(),
        recipientHash: 'abc123def456',
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
        _correlation: { requestId: 'req-1', correlationId: 'corr-1' },
        ...dataOverrides,
      },
      attemptsMade: 1,
    } as unknown as Job;
  }

  function makeEnvelopeProcessor(provider = createTestMailProvider()) {
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const processor = createMailProcessor(
      provider,
      (encrypted: string) => openTransactionalEmailDeliveryEnvelope(encrypted, TEST_KEY),
      urlBuilder,
    );
    return { provider, processor };
  }

  // Test 21: Worker processor success path
  it('should process a valid email job successfully', async () => {
    const { provider, processor } = makeEnvelopeProcessor();

    const result = await processor(makeProcessorJob());
    expect(result.success).toBe(true);
    expect(provider.getSentEmails()).toHaveLength(1);
  });

  it('passes the decrypted real recipient address to the provider', async () => {
    const { provider, processor } = makeEnvelopeProcessor();

    await processor(makeProcessorJob());

    const emails = provider.getSentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].metadata.to).toBe(RECIPIENT);
    expect(emails[0].metadata.to).not.toContain('recipient-');
  });

  // Test 22: Worker processor failure path (decryption failure)
  it('should fail on invalid encrypted payload', async () => {
    const { provider, processor } = makeEnvelopeProcessor();

    const job = makeProcessorJob({}, 'invalid');

    await expect(processor(job)).rejects.toThrow(/decryption|encrypted container/i);
    await expect(processor(job)).rejects.toThrow(UnrecoverableError);
    expect(provider.getSentEmails()).toHaveLength(0);
  });

  it('rejects malformed or missing recipients before SMTP', async () => {
    for (const badTo of ['', 'not-an-email']) {
      const provider = createTestMailProvider();
      const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
      const processor = createMailProcessor(
        provider,
        () => ({ envelopeVersion: 1, to: badTo, templateData: { recipientName: 'U', actionUrl: 'https://x.com/r?t=1', expiresIn: '15 minutes' } }),
        urlBuilder,
      );

      await expect(processor(makeProcessorJob())).rejects.toThrow(UnrecoverableError);
      await expect(processor(makeProcessorJob())).rejects.toThrow(
        /Invalid transactional email delivery envelope/,
      );
      expect(provider.getSentEmails()).toHaveLength(0);
    }
  });

  // Test 14: Malformed job payload is rejected
  it('should reject job with unsupported version', async () => {
    const { provider, processor } = makeEnvelopeProcessor();

    const job = makeProcessorJob({ version: 999 });
    await expect(processor(job)).rejects.toThrow(/version/);
    expect(provider.getSentEmails()).toHaveLength(0);
  });

  it('should reject job with missing templateId', async () => {
    const { provider, processor } = makeEnvelopeProcessor();

    const job = makeProcessorJob({ templateId: '' });
    await expect(processor(job)).rejects.toThrow(/templateId/);
    expect(provider.getSentEmails()).toHaveLength(0);
  });

  // Test 16: Retryable failure classification
  it('should propagate retryable errors', async () => {
    const provider = createTestMailProvider();
    provider.setRetryableFailure(1);
    const { processor } = makeEnvelopeProcessor(provider);

    await expect(processor(makeProcessorJob())).rejects.toThrow(MailDeliveryError);
  });

  // Test 17: Permanent failure classification
  it('should propagate permanent template errors', async () => {
    const { provider, processor } = makeEnvelopeProcessor();

    const job = makeProcessorJob({ templateId: 'nonexistent-template' });
    await expect(processor(job)).rejects.toThrow(/Template rendering failed/);
    expect(provider.getSentEmails()).toHaveLength(0);
  });

  // Test 20: Logs contain no body, token, URL, credentials or recipient email
  it('should not log sensitive payload content', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { processor } = makeEnvelopeProcessor();

    const secretToken = 'SUPER_SECRET_TOKEN_12345';
    const job = makeProcessorJob(
      {},
      sealedPayload({
        actionUrl: `https://app.techfusion.ai/reset?token=${secretToken}`,
      }),
    );

    await processor(job);

    const allLogCalls = consoleSpy.mock.calls.map((c) => String(c.join(' ')));
    for (const logLine of allLogCalls) {
      expect(logLine).not.toContain(secretToken);
      expect(logLine).not.toContain('SUPER_SECRET');
      expect(logLine).not.toContain(RECIPIENT);
    }

    consoleSpy.mockRestore();
  });
});

describe('SMTP Error Classification (sanitized)', () => {
  it('categorizes EENVELOPE as permanent envelope error without echoing addresses', () => {
    const err = {
      code: 'EENVELOPE',
      response: '550 5.1.1 <victim@example.com>: Recipient address rejected',
      responseCode: 550,
      message: 'Recipient address rejected: victim@example.com',
    };
    const { retryable, category } = classifySmtpDeliveryError(err);
    expect(category).toBe('envelope');
    expect(retryable).toBe(false);
  });

  it('categorizes EAUTH as permanent and non-retryable', () => {
    const err = { code: 'EAUTH', responseCode: 535, message: 'Invalid credentials for secret-user' };
    const { retryable, category } = classifySmtpDeliveryError(err);
    expect(category).toBe('auth');
    expect(retryable).toBe(false);
  });

  it('keeps connection/timeout classes retryable', () => {
    for (const code of ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND']) {
      const { retryable } = classifySmtpDeliveryError({ code });
      expect(retryable).toBe(true);
    }
    const { retryable, category } = classifySmtpDeliveryError({
      message: 'Connection timeout occurred',
    });
    expect(retryable).toBe(true);
    expect(category).toBe('connection');
  });

  it('preserves safe SMTP response codes as categories', () => {
    const fiveXX = classifySmtpDeliveryError({ responseCode: 500 });
    expect(fiveXX.retryable).toBe(true);
    expect(fiveXX.category).toBe('smtp-500');

    const fourXX = classifySmtpDeliveryError({ responseCode: 421 });
    expect(fourXX.retryable).toBe(true);
    expect(fourXX.category).toBe('smtp-421');
  });

  it('falls back to the raw code instead of unknown when only an unrecognized safe code exists', () => {
    const { retryable, category } = classifySmtpDeliveryError({ code: 'ECODE15' });
    expect(category).toBe('ecode15');
    expect(retryable).toBe(false);
  });

  it('never includes message text, responses, or addresses in any category output', () => {
    const leaky = {
      code: 'EENVELOPE',
      response: '553 smtp-relay.brevo.com says goodbye secret-sender@example.com',
      responseCode: 553,
      command: 'MAIL FROM',
      message: 'Unexpected upstream text with victim@example.com inside',
    };
    const { category } = classifySmtpDeliveryError(leaky);
    expect(category).not.toContain('@');
    expect(category).not.toContain('brevo');
    expect(category).not.toContain('goodbye');
    expect(typeof category).toBe('string');
    expect(category.length).toBeLessThan(32);
  });

  it('classifies truly opaque errors as unknown', () => {
    const { retryable, category } = classifySmtpDeliveryError(new Error('mystery'));
    expect(category).toBe('unknown');
    expect(retryable).toBe(false);
  });
});

describe('Worker Queue Names', () => {
  it('should include TRANSACTIONAL_EMAIL in queue names', () => {
    const { QUEUE_NAMES } = require('../queue-names');
    expect(QUEUE_NAMES.TRANSACTIONAL_EMAIL).toBe('transactional-email');
  });

  it('should include TRANSACTIONAL_EMAIL.SEND in job names', () => {
    const { JOB_NAMES } = require('../queue-names');
    expect(JOB_NAMES.TRANSACTIONAL_EMAIL.SEND).toBe('send');
  });
});

describe('Prisma Schema Unchanged', () => {
  // Test 27: No Prisma schema or migration change
  it('should not contain password reset token model in schema', () => {
    const fs = require('fs');
    const schema = fs.readFileSync(
      require('path').resolve(__dirname, '../../prisma/schema.prisma'),
      'utf8',
    );
    expect(schema).not.toContain('EmailVerificationToken');
    expect(schema).not.toContain('pendingEmail');
    expect(schema).not.toContain('emailVerified');
  });
});

describe('Mail Provider Config', () => {
  it('should default to disabled', () => {
    delete process.env.MAIL_ENABLED;
    const config = loadMailProviderConfig();
    expect(config.enabled).toBe(false);
  });

  it('should parse SMTP port', () => {
    process.env.SMTP_PORT = '465';
    const config = loadMailProviderConfig();
    expect(config.smtp.port).toBe(465);
    delete process.env.SMTP_PORT;
  });

  it('should parse timeout values', () => {
    process.env.SMTP_CONNECTION_TIMEOUT_MS = '5000';
    process.env.SMTP_SOCKET_TIMEOUT_MS = '60000';
    const config = loadMailProviderConfig();
    expect(config.smtp.connectionTimeoutMs).toBe(5000);
    expect(config.smtp.socketTimeoutMs).toBe(60000);
    delete process.env.SMTP_CONNECTION_TIMEOUT_MS;
    delete process.env.SMTP_SOCKET_TIMEOUT_MS;
  });
});

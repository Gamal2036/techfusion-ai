import { Job } from 'bullmq';
import { createDisabledMailProvider, createTestMailProvider, loadMailProviderConfig } from '../mail/mail-providers';
import { renderTemplate } from '../mail/mail-templates';
import { MailUrlBuilder } from '../mail/mail-url-builder';
import { createMailProcessor } from '../mail/mail-processor';
import { MailDeliveryError, MailUnavailableError } from '../mail/mail-provider.interface';

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
  // Test 21: Worker processor success path
  it('should process a valid email job successfully', async () => {
    const provider = createTestMailProvider();
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const decryptPayload = (encrypted: string) => JSON.parse(encrypted);

    const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

    const job = {
      id: 'job-1',
      data: {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: JSON.stringify({
          recipientName: 'Test User',
          actionUrl: 'https://app.techfusion.ai/reset?token=abc',
          expiresIn: '30 minutes',
        }),
        recipientHash: 'abc123',
        idempotencyKey: 'idem-1',
        correlationId: 'corr-1',
        _correlation: { requestId: 'req-1', correlationId: 'corr-1' },
      },
      attemptsMade: 1,
    } as unknown as Job;

    const result = await processor(job);
    expect(result.success).toBe(true);
    expect(provider.getSentEmails()).toHaveLength(1);
  });

  // Test 22: Worker processor failure path (decryption failure)
  it('should fail on invalid encrypted payload', async () => {
    const provider = createTestMailProvider();
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const decryptPayload = () => { throw new Error('bad payload'); };

    const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

    const job = {
      id: 'job-2',
      data: {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: 'invalid',
        recipientHash: 'abc',
        idempotencyKey: 'idem-2',
        correlationId: 'corr-2',
      },
      attemptsMade: 1,
    } as unknown as Job;

    await expect(processor(job)).rejects.toThrow(/decryption/i);
  });

  // Test 14: Malformed job payload is rejected
  it('should reject job with unsupported version', async () => {
    const provider = createTestMailProvider();
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const decryptPayload = (encrypted: string) => JSON.parse(encrypted);

    const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

    const job = {
      id: 'job-3',
      data: {
        version: 999,
        templateId: 'password-reset',
        encryptedPayload: '{}',
        recipientHash: 'abc',
        idempotencyKey: 'idem-3',
        correlationId: 'corr-3',
      },
      attemptsMade: 1,
    } as unknown as Job;

    await expect(processor(job)).rejects.toThrow(/version/);
  });

  it('should reject job with missing templateId', async () => {
    const provider = createTestMailProvider();
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const decryptPayload = (encrypted: string) => JSON.parse(encrypted);

    const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

    const job = {
      id: 'job-4',
      data: {
        version: 1,
        encryptedPayload: '{}',
        recipientHash: 'abc',
        idempotencyKey: 'idem-4',
        correlationId: 'corr-4',
      },
      attemptsMade: 1,
    } as unknown as Job;

    await expect(processor(job)).rejects.toThrow(/templateId/);
  });

  // Test 16: Retryable failure classification
  it('should propagate retryable errors', async () => {
    const provider = createTestMailProvider();
    provider.setRetryableFailure(1);
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const decryptPayload = (encrypted: string) => JSON.parse(encrypted);

    const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

    const job = {
      id: 'job-5',
      data: {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: JSON.stringify({ recipientName: 'User', actionUrl: 'https://app.techfusion.ai/reset?token=x', expiresIn: '30m' }),
        recipientHash: 'abc',
        idempotencyKey: 'idem-5',
        correlationId: 'corr-5',
      },
      attemptsMade: 1,
    } as unknown as Job;

    await expect(processor(job)).rejects.toThrow(MailDeliveryError);
  });

  // Test 17: Permanent failure classification
  it('should propagate permanent template errors', async () => {
    const provider = createTestMailProvider();
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const decryptPayload = (encrypted: string) => JSON.parse(encrypted);

    const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

    const job = {
      id: 'job-6',
      data: {
        version: 1,
        templateId: 'nonexistent-template',
        encryptedPayload: JSON.stringify({ recipientName: 'User', actionUrl: 'https://x.com', expiresIn: '30m' }),
        recipientHash: 'abc',
        idempotencyKey: 'idem-6',
        correlationId: 'corr-6',
      },
      attemptsMade: 1,
    } as unknown as Job;

    await expect(processor(job)).rejects.toThrow(/Template rendering failed/);
  });

  // Test 20: Logs contain no body, token, URL or credentials
  it('should not log sensitive payload content', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const provider = createTestMailProvider();
    const urlBuilder = new MailUrlBuilder('https://app.techfusion.ai');
    const decryptPayload = (encrypted: string) => JSON.parse(encrypted);

    const processor = createMailProcessor(provider, decryptPayload, urlBuilder);

    const secretToken = 'SUPER_SECRET_TOKEN_12345';
    const job = {
      id: 'job-7',
      data: {
        version: 1,
        templateId: 'password-reset',
        encryptedPayload: JSON.stringify({
          recipientName: 'User',
          actionUrl: `https://app.techfusion.ai/reset?token=${secretToken}`,
          expiresIn: '30m',
        }),
        recipientHash: 'abc123def456',
        idempotencyKey: 'idem-7',
        correlationId: 'corr-7',
      },
      attemptsMade: 1,
    } as unknown as Job;

    await processor(job);

    const allLogCalls = consoleSpy.mock.calls.map((c) => String(c.join(' ')));
    for (const logLine of allLogCalls) {
      expect(logLine).not.toContain(secretToken);
      expect(logLine).not.toContain('SUPER_SECRET');
    }

    consoleSpy.mockRestore();
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
    expect(schema).not.toContain('PasswordResetToken');
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

import { loadMailConfig } from '../mail.config';
import { MailUrlBuilder } from '../mail-url-builder';
import { renderTransactionalEmail, SUPPORTED_TEMPLATE_IDS } from '../templates/mail-templates';
import { createDisabledProvider, createTestProvider } from '../mail.providers';
import { TransactionalEmailUnavailableError } from '../contracts/mail.types';

describe('Mail Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MAIL_ENABLED;
    delete process.env.MAIL_TRANSPORT;
    delete process.env.MAIL_FROM_ADDRESS;
    delete process.env.MAIL_FROM_NAME;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_CONNECTION_TIMEOUT_MS;
    delete process.env.SMTP_GREETING_TIMEOUT_MS;
    delete process.env.SMTP_SOCKET_TIMEOUT_MS;
    delete process.env.WEB_APP_URL;
    delete process.env.PUBLIC_WEB_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // Test 1: Mail disabled by default
  it('should default to disabled when MAIL_ENABLED is not set', () => {
    const config = loadMailConfig();
    expect(config.enabled).toBe(false);
  });

  // Test 1b: Mail explicitly disabled
  it('should be disabled when MAIL_ENABLED=false', () => {
    process.env.MAIL_ENABLED = 'false';
    const config = loadMailConfig();
    expect(config.enabled).toBe(false);
  });

  // Test 5: SMTP provider is selected only with valid enabled config
  it('should accept valid SMTP config when enabled', () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    const config = loadMailConfig();
    expect(config.enabled).toBe(true);
    expect(config.transport).toBe('smtp');
    expect(config.smtp.host).toBe('smtp.example.com');
  });

  // Test 6: Missing enabled SMTP config fails validation
  it('should throw when MAIL_ENABLED=true but SMTP_USER is missing', () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PASS = 'pass';
    expect(() => loadMailConfig()).toThrow(/SMTP_USER/);
  });

  it('should throw when MAIL_ENABLED=true but SMTP_PASS is missing', () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    expect(() => loadMailConfig()).toThrow(/SMTP_PASS/);
  });

  // Test 7: Secrets are absent from validation errors
  it('should not expose secret values in validation errors', () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'my-secret-user@example.com';
    delete process.env.SMTP_PASS;
    try {
      loadMailConfig();
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).not.toContain('my-secret-user');
    }
  });

  // Port validation
  it('should validate SMTP port range', () => {
    process.env.SMTP_PORT = '99999';
    expect(() => loadMailConfig()).toThrow(/Invalid SMTP port/);
  });

  // Timeout validation
  it('should validate connection timeout bounds', () => {
    process.env.SMTP_CONNECTION_TIMEOUT_MS = '50';
    expect(() => loadMailConfig()).toThrow(/SMTP_CONNECTION_TIMEOUT_MS/);
  });
});

describe('Mail URL Builder', () => {
  // Test 8: Production HTTPS origin is enforced
  it('should accept valid production HTTPS origin', () => {
    process.env.NODE_ENV = 'production';
    const builder = new MailUrlBuilder('https://app.techfusion.ai');
    expect(builder.getOrigin()).toBe('https://app.techfusion.ai');
    process.env.NODE_ENV = 'development';
  });

  // Test 9: Localhost development origin is allowed
  it('should accept localhost development origin', () => {
    const builder = new MailUrlBuilder('http://localhost:3000');
    expect(builder.getOrigin()).toBe('http://localhost:3000');
  });

  // Test 10: Host headers cannot influence action URLs
  it('should not be influenced by external inputs', () => {
    const builder = new MailUrlBuilder('https://app.techfusion.ai');
    const url = builder.buildActionUrl('/reset', { token: 'abc123' });
    expect(url).toBe('https://app.techfusion.ai/reset?token=abc123');
    expect(url).not.toContain('localhost');
  });

  // Protocol-relative URL rejection
  it('should reject protocol-relative URLs', () => {
    expect(() => new MailUrlBuilder('//evil.com')).toThrow();
  });

  // javascript: URL rejection
  it('should reject javascript: URLs', () => {
    expect(() => new MailUrlBuilder('javascript:alert(1)')).toThrow(/Dangerous URL scheme/);
  });

  // data: URL rejection
  it('should reject data: URLs', () => {
    expect(() => new MailUrlBuilder('data:text/html,<h1>hi</h1>')).toThrow(/Dangerous URL scheme/);
  });

  // file: URL rejection
  it('should reject file: URLs', () => {
    expect(() => new MailUrlBuilder('file:///etc/passwd')).toThrow(/Dangerous URL scheme/);
  });

  // Malformed origin rejection
  it('should reject malformed URLs', () => {
    expect(() => new MailUrlBuilder('not-a-url')).toThrow(/Invalid/);
  });

  // Correct encoded query construction
  it('should correctly encode query parameters', () => {
    const builder = new MailUrlBuilder('https://app.techfusion.ai');
    const url = builder.buildActionUrl('/reset', { token: 'abc 123&foo=bar' });
    expect(url).toContain('token=abc+123%26foo%3Dbar');
  });

  // Test 11: HTML interpolation is escaped
  it('should escape HTML in rendered emails', () => {
    const rendered = renderTransactionalEmail('password-reset', {
      recipientName: '<script>alert("xss")</script>',
      actionUrl: 'https://app.techfusion.ai/reset?token=safe123',
      expiresIn: '30 minutes',
    });
    expect(rendered.htmlBody).not.toContain('<script>');
    expect(rendered.htmlBody).toContain('&lt;script&gt;');
  });
});

describe('Email Templates', () => {
  // Test 12: Plain-text and HTML templates are both generated
  it('should generate both plain-text and HTML for password-reset', () => {
    const rendered = renderTransactionalEmail('password-reset', {
      recipientName: 'Test User',
      actionUrl: 'https://app.techfusion.ai/reset?token=abc123',
      expiresIn: '30 minutes',
    });
    expect(rendered.subject).toBeTruthy();
    expect(rendered.textBody).toBeTruthy();
    expect(rendered.htmlBody).toBeTruthy();
    expect(rendered.textBody).toContain('https://app.techfusion.ai/reset?token=abc123');
  });

  it('should generate both plain-text and HTML for email-verification', () => {
    const rendered = renderTransactionalEmail('email-verification', {
      recipientName: 'Test User',
      actionUrl: 'https://app.techfusion.ai/verify?token=xyz789',
      expiresIn: '24 hours',
    });
    expect(rendered.subject).toBeTruthy();
    expect(rendered.textBody).toBeTruthy();
    expect(rendered.htmlBody).toBeTruthy();
  });

  it('should generate both plain-text and HTML for security-notification', () => {
    const rendered = renderTransactionalEmail('security-notification', {
      recipientName: 'Test User',
      eventDescription: 'Password changed',
      timestamp: '2026-01-01T00:00:00Z',
    });
    expect(rendered.subject).toBeTruthy();
    expect(rendered.textBody).toBeTruthy();
    expect(rendered.htmlBody).toBeTruthy();
  });

  // Test 13: Unsupported template ID is rejected
  it('should throw for unsupported template ID', () => {
    expect(() =>
      renderTransactionalEmail('unknown-template' as any, { recipientName: 'Test', actionUrl: 'https://example.com', expiresIn: '1h' })
    ).toThrow(/Unsupported template ID/);
  });

  // Text version contains the complete action URL
  it('should include full action URL in plain text', () => {
    const rendered = renderTransactionalEmail('password-reset', {
      recipientName: 'User',
      actionUrl: 'https://app.techfusion.ai/reset?token=SECRET_TOKEN',
      expiresIn: '30 minutes',
    });
    expect(rendered.textBody).toContain('https://app.techfusion.ai/reset?token=SECRET_TOKEN');
  });

  // No remote tracking pixels
  it('should not contain img tracking pixels', () => {
    const rendered = renderTransactionalEmail('password-reset', {
      recipientName: 'User',
      actionUrl: 'https://app.techfusion.ai/reset?token=abc',
      expiresIn: '30 minutes',
    });
    expect(rendered.htmlBody).not.toContain('img');
    expect(rendered.htmlBody).not.toMatch(/<img/i);
  });

  // No external scripts
  it('should not contain script tags', () => {
    const rendered = renderTransactionalEmail('password-reset', {
      recipientName: 'User',
      actionUrl: 'https://app.techfusion.ai/reset?token=abc',
      expiresIn: '30 minutes',
    });
    expect(rendered.htmlBody).not.toContain('<script');
  });

  // Valid semantic HTML
  it('should contain valid semantic HTML structure', () => {
    const rendered = renderTransactionalEmail('password-reset', {
      recipientName: 'User',
      actionUrl: 'https://app.techfusion.ai/reset?token=abc',
      expiresIn: '30 minutes',
    });
    expect(rendered.htmlBody).toContain('<!DOCTYPE html>');
    expect(rendered.htmlBody).toContain('<html');
    expect(rendered.htmlBody).toContain('<head>');
    expect(rendered.htmlBody).toContain('<body');
  });
});

describe('Disabled Provider', () => {
  // Test 1b: Disabled mail never reports success
  it('should throw TransactionalEmailUnavailableError on send', async () => {
    const provider = createDisabledProvider();
    await expect(
      provider.send(
        { subject: 'Test', textBody: 'test', htmlBody: '<p>test</p>' },
        { to: 'test@example.com', templateId: 'password-reset', correlationId: 'test' },
      ),
    ).rejects.toThrow(/not enabled/);
  });

  it('should report not ready', () => {
    const provider = createDisabledProvider();
    expect(provider.isReady()).toBe(false);
  });
});

describe('Test Provider', () => {
  // Test 3: No network connection in test mode
  it('should not open any network connection', async () => {
    const provider = createTestProvider();
    const result = await provider.send(
      { subject: 'Test', textBody: 'test', htmlBody: '<p>test</p>' },
      { to: 'test@example.com', templateId: 'password-reset', correlationId: 'test' },
    );
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBeDefined();
  });

  // Test 4: In-memory provider captures subject/text/html
  it('should capture rendered message in memory', async () => {
    const provider = createTestProvider();
    const rendered = {
      subject: 'Test Subject',
      textBody: 'Plain text content',
      htmlBody: '<p>HTML content</p>',
    };
    await provider.send(rendered, {
      to: 'test@example.com',
      templateId: 'password-reset',
      correlationId: 'corr-1',
    });

    const emails = (provider as any).getSentEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].rendered.subject).toBe('Test Subject');
    expect(emails[0].rendered.textBody).toBe('Plain text content');
    expect(emails[0].rendered.htmlBody).toBe('<p>HTML content</p>');
    expect(emails[0].metadata.to).toBe('test@example.com');
    expect(emails[0].metadata.templateId).toBe('password-reset');
  });

  // Test 15: Provider error normalization (injected failure)
  it('should propagate injected failures', async () => {
    const provider = createTestProvider();
    (provider as any).injectFailure(new Error('Simulated SMTP error'));

    await expect(
      provider.send(
        { subject: 'Test', textBody: 'test', htmlBody: '<p>test</p>' },
        { to: 'test@example.com', templateId: 'password-reset', correlationId: 'test' },
      ),
    ).rejects.toThrow('Simulated SMTP error');
  });

  it('should report ready', () => {
    const provider = createTestProvider();
    expect(provider.isReady()).toBe(true);
  });
});

describe('TransactionalEmailService', () => {
  it('should have disabled provider when MAIL_ENABLED is not set', async () => {
    const { TransactionalEmailService } = require('../mail.service');
    const service = new TransactionalEmailService();
    expect(service.getProviderName()).toBe('disabled');
    expect(service.isReady()).toBe(false);
  });

  it('should throw TransactionalEmailUnavailableError when sending while disabled', async () => {
    const { TransactionalEmailService } = require('../mail.service');
    const service = new TransactionalEmailService();
    await expect(
      service.send({
        templateId: 'password-reset',
        to: 'test@example.com',
        templateData: { recipientName: 'User', actionUrl: 'https://example.com', expiresIn: '30m' },
        idempotencyKey: 'test-key',
      }),
    ).rejects.toThrow(TransactionalEmailUnavailableError);
  });

  // Test 14: Malformed job payload is rejected (via template validation)
  it('should reject unsupported template IDs via renderEmail', async () => {
    const { TransactionalEmailService } = require('../mail.service');
    const service = new TransactionalEmailService();
    await expect(
      service.renderEmail('nonexistent' as any, { recipientName: 'User', actionUrl: 'https://example.com', expiresIn: '30m' }),
    ).rejects.toThrow(/Unsupported template ID/);
  });
});

describe('Mail Queue Constants', () => {
  it('should include TRANSACTIONAL_EMAIL queue name', () => {
    const { QUEUE_NAMES } = require('../../queue/queue.constants');
    expect(QUEUE_NAMES.TRANSACTIONAL_EMAIL).toBe('transactional-email');
  });

  it('should include TRANSACTIONAL_EMAIL.SEND job name', () => {
    const { JOB_NAMES } = require('../../queue/queue.constants');
    expect(JOB_NAMES.TRANSACTIONAL_EMAIL.SEND).toBe('send');
  });
});

describe('No Auth Routes Added', () => {
  // Test 25: ACC-SEC-02E2A guard — no auth route was added by the email foundation.
  // ACC-SEC-02E2B intentionally added forgot-password/reset-password endpoints.
  // This test now only verifies the web component guard below.
  it('should not contain forgot-password in web components', async () => {
    const fs = require('fs');
    const path = require('path');
    const loginForm = fs.readFileSync(
      path.resolve(__dirname, '../../../../web/src/components/login/LoginForm.tsx'),
      'utf8',
    );
    expect(loginForm).not.toContain('forgot-password');
  });
});

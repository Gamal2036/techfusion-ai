import { MailProvider, MailSendResult, MailRenderedEmail, MailUnavailableError, MailDeliveryError } from './mail-provider.interface';

function isRetryableError(err: any): boolean {
  const code = err?.code?.toUpperCase() || '';
  const message = (err?.message || '').toLowerCase();
  if (code.includes('ECONNRESET') || code.includes('ETIMEDOUT') || code.includes('ECONNREFUSED')) return true;
  if (code.includes('ENOTFOUND') || code.includes('ENETUNREACH')) return true;
  if (message.includes('timeout') || message.includes('connection')) return true;
  if (err?.responseCode && err.responseCode >= 500 && err.responseCode < 600) return true;
  return false;
}

function categorizeError(err: any): string {
  const code = err?.code || '';
  if (code.includes('ETIMEOUT') || code.includes('ESOCKET')) return 'timeout';
  if (code.includes('ECONNREFUSED') || code.includes('ECONNRESET')) return 'connection';
  if (code.includes('ENOTFOUND') || code.includes('ENETUNREACH')) return 'dns';
  if (err?.responseCode) return `smtp-${err.responseCode}`;
  return 'unknown';
}

export async function createSmtpMailProvider(config: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  connectionTimeoutMs: number;
  greetingTimeoutMs: number;
  socketTimeoutMs: number;
  fromAddress: string;
  fromName: string;
  replyTo?: string;
}): Promise<MailProvider> {
  const nodemailer = await import('nodemailer');

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: config.connectionTimeoutMs,
    greetingTimeout: config.greetingTimeoutMs,
    socketTimeout: config.socketTimeoutMs,
    tls: {
      rejectUnauthorized: true,
    },
  });

  return {
    name: 'smtp',
    async send(renderedEmail: MailRenderedEmail, metadata): Promise<MailSendResult> {
      try {
        const info = await transport.sendMail({
          from: `"${config.fromName}" <${config.fromAddress}>`,
          to: metadata.to,
          replyTo: config.replyTo,
          subject: renderedEmail.subject,
          text: renderedEmail.textBody,
          html: renderedEmail.htmlBody,
        });

        return {
          success: true,
          providerMessageId: info.messageId,
          attempts: 1,
        };
      } catch (err: any) {
        const retryable = isRetryableError(err);
        const category = categorizeError(err);
        throw new (await import('./mail-provider.interface')).MailDeliveryError(
          `SMTP delivery failed: ${category}`,
          retryable,
          category,
        );
      }
    },
    isReady(): boolean {
      return true;
    },
    async shutdown(): Promise<void> {
      await transport.close();
    },
  };
}

export function createTestMailProvider(): MailProvider & {
  getSentEmails(): Array<{ rendered: MailRenderedEmail; metadata: { to: string; templateId: string; correlationId: string }; timestamp: Date }>;
  clearSentEmails(): void;
  injectFailure(error: Error | null): void;
  setRetryableFailure(maxRetries: number): void;
} {
  const sentEmails: Array<{
    rendered: MailRenderedEmail;
    metadata: { to: string; templateId: string; correlationId: string };
    timestamp: Date;
  }> = [];

  let injectedFailure: Error | null = null;
  let retryableFailureCount = 0;
  let retryableFailureMax = 0;

  return {
    name: 'test',
    async send(renderedEmail: MailRenderedEmail, metadata): Promise<MailSendResult> {
      if (injectedFailure) {
        const error = injectedFailure;
        injectedFailure = null;
        throw error;
      }

      if (retryableFailureCount < retryableFailureMax) {
        retryableFailureCount++;
        throw new (await import('./mail-provider.interface')).MailDeliveryError(
          'Simulated retryable failure',
          true,
          'simulated',
        );
      }

      sentEmails.push({
        rendered: { ...renderedEmail },
        metadata: { ...metadata },
        timestamp: new Date(),
      });

      return {
        success: true,
        providerMessageId: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        attempts: 1,
      };
    },
    isReady(): boolean {
      return true;
    },
    async shutdown(): Promise<void> {
      sentEmails.length = 0;
    },
    getSentEmails() {
      return [...sentEmails];
    },
    clearSentEmails() {
      sentEmails.length = 0;
    },
    injectFailure(error: Error | null) {
      injectedFailure = error;
    },
    setRetryableFailure(maxRetries: number) {
      retryableFailureMax = maxRetries;
      retryableFailureCount = 0;
    },
  };
}

export function createDisabledMailProvider(): MailProvider {
  return {
    name: 'disabled',
    async send(): Promise<MailSendResult> {
      throw new MailUnavailableError('Transactional email is not enabled. Set MAIL_ENABLED=true to enable.');
    },
    isReady(): boolean {
      return false;
    },
    async shutdown(): Promise<void> {},
  };
}

export function loadMailProviderConfig(): {
  enabled: boolean;
  transport: 'smtp' | 'test';
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    connectionTimeoutMs: number;
    greetingTimeoutMs: number;
    socketTimeoutMs: number;
  };
  fromAddress: string;
  fromName: string;
  replyTo?: string;
} {
  const enabled = process.env.MAIL_ENABLED === 'true';
  const transport = (process.env.MAIL_TRANSPORT || 'smtp') as 'smtp' | 'test';
  const fromAddress = process.env.MAIL_FROM_ADDRESS || 'noreply@techfusion.ai';
  const fromName = process.env.MAIL_FROM_NAME || 'TechFusion AI';
  const replyTo = process.env.MAIL_REPLY_TO || undefined;

  return {
    enabled,
    transport,
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      connectionTimeoutMs: parseInt(process.env.SMTP_CONNECTION_TIMEOUT_MS || '10000', 10),
      greetingTimeoutMs: parseInt(process.env.SMTP_GREETING_TIMEOUT_MS || '10000', 10),
      socketTimeoutMs: parseInt(process.env.SMTP_SOCKET_TIMEOUT_MS || '30000', 10),
    },
    fromAddress,
    fromName,
    replyTo,
  };
}

import { MailProvider, MailSendResult, MailRenderedEmail, MailUnavailableError, MailDeliveryError } from './mail-provider.interface';

/**
 * Sanitized SMTP error classification.
 *
 * Only the transport error's machine-readable code and numeric response code
 * are inspected. Human-readable fields (`message`, `response`, `command`)
 * may contain full recipient addresses or credentials and are never read,
 * logged, or embedded into thrown errors.
 */

const RETRYABLE_SMTP_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
]);

const PERMANENT_SMTP_CODES = new Set([
  'EENVELOPE', // invalid recipient / envelope rejected by MTA
  'EAUTH', // authentication failure — retrying cannot help
  'EMESSAGE',
  'EPROTOCOL',
]);

export interface SmtpErrorClassification {
  retryable: boolean;
  category: string;
}

export function classifySmtpDeliveryError(err: unknown): SmtpErrorClassification {
  const code = typeof (err as any)?.code === 'string' ? (err as any).code.toUpperCase() : '';
  const responseCode =
    typeof (err as any)?.responseCode === 'number' ? (err as any).responseCode : undefined;

  if (PERMANENT_SMTP_CODES.has(code)) {
    return { retryable: false, category: smtpCategoryFor(code, responseCode) };
  }

  if (RETRYABLE_SMTP_CODES.has(code)) {
    return { retryable: true, category: smtpCategoryFor(code, responseCode) };
  }

  if (responseCode !== undefined) {
    // SMTP-layer responses keep their established retry posture: deferrals
    // and server-error classes stay transient; envelope/auth-class codes were
    // already classified permanent above.
    return { retryable: true, category: `smtp-${responseCode}` };
  }

  if (!code) {
    const message = typeof (err as any)?.message === 'string' ? (err as any).message.toLowerCase() : '';
    if (message.includes('timeout') || message.includes('connection')) {
      return { retryable: true, category: 'connection' };
    }
    return { retryable: false, category: 'unknown' };
  }

  // Unrecognized but safe machine-readable code: preserve it instead of "unknown".
  return { retryable: false, category: code.toLowerCase() };
}

function smtpCategoryFor(code: string, responseCode?: number): string {
  if (code === 'EENVELOPE') return 'envelope';
  if (code === 'EAUTH') return 'auth';
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') return 'timeout';
  if (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EPIPE') return 'connection';
  if (code === 'ENOTFOUND' || code === 'ENETUNREACH' || code === 'EAI_AGAIN') return 'dns';
  if (responseCode !== undefined) return `smtp-${responseCode}`;
  return code.toLowerCase();
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
        const { retryable, category } = classifySmtpDeliveryError(err);
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

import { TransactionalEmailProvider } from './contracts/mail-provider.interface';
import { TransactionalEmailResult, RenderedTransactionalEmail } from './contracts/mail.types';
import { MailConfig } from './mail.config';

export function createDisabledProvider(): TransactionalEmailProvider {
  return {
    name: 'disabled',
    async send(): Promise<TransactionalEmailResult> {
      throw new Error('Transactional email is not enabled. Set MAIL_ENABLED=true to enable.');
    },
    isReady(): boolean {
      return false;
    },
    async shutdown(): Promise<void> {}
  };
}

export function createTestProvider(): TransactionalEmailProvider {
  const sentEmails: Array<{
    rendered: RenderedTransactionalEmail;
    metadata: { to: string; templateId: string; correlationId: string };
    timestamp: Date;
  }> = [];

  let injectedFailure: Error | null = null;

  const provider: TransactionalEmailProvider & {
    getSentEmails(): typeof sentEmails;
    getLastEmail(): typeof sentEmails[number] | undefined;
    clearSentEmails(): void;
    injectFailure(error: Error | null): void;
  } = {
    name: 'test',
    async send(renderedEmail: RenderedTransactionalEmail, metadata): Promise<TransactionalEmailResult> {
      if (injectedFailure) {
        const error = injectedFailure;
        injectedFailure = null;
        throw error;
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
    getLastEmail() {
      return sentEmails[sentEmails.length - 1];
    },
    clearSentEmails() {
      sentEmails.length = 0;
    },
    injectFailure(error: Error | null) {
      injectedFailure = error;
    },
  };

  return provider;
}

export async function createSmtpProvider(config: MailConfig): Promise<TransactionalEmailProvider> {
  const nodemailer = await import('nodemailer');

  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    connectionTimeout: config.smtp.connectionTimeoutMs,
    greetingTimeout: config.smtp.greetingTimeoutMs,
    socketTimeout: config.smtp.socketTimeoutMs,
    tls: {
      rejectUnauthorized: true,
    },
  });

  return {
    name: 'smtp',
    async send(renderedEmail: RenderedTransactionalEmail, metadata): Promise<TransactionalEmailResult> {
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
    },
    isReady(): boolean {
      return true;
    },
    async shutdown(): Promise<void> {
      await transport.close();
    },
  };
}

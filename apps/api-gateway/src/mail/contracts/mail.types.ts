export type TransactionalEmailTemplateId =
  | 'password-reset'
  | 'email-verification'
  | 'security-notification';

export interface PasswordResetTemplateData {
  recipientName: string;
  actionUrl: string;
  expiresIn: string;
}

export interface EmailVerificationTemplateData {
  recipientName: string;
  actionUrl: string;
  expiresIn: string;
}

export interface SecurityNotificationTemplateData {
  recipientName: string;
  eventDescription: string;
  timestamp: string;
}

export type TransactionalEmailTemplateData =
  | PasswordResetTemplateData
  | EmailVerificationTemplateData
  | SecurityNotificationTemplateData;

export interface TransactionalEmailRequest {
  templateId: TransactionalEmailTemplateId;
  to: string;
  templateData: TransactionalEmailTemplateData;
  idempotencyKey: string;
  correlationId?: string;
}

export interface RenderedTransactionalEmail {
  subject: string;
  textBody: string;
  htmlBody: string;
}

export interface TransactionalEmailJob {
  version: 1;
  templateId: TransactionalEmailTemplateId;
  encryptedPayload: string;
  recipientHash: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface TransactionalEmailResult {
  success: boolean;
  providerMessageId?: string;
  attempts: number;
}

export class TransactionalEmailUnavailableError extends Error {
  constructor(message: string = 'Transactional email is not available') {
    super(message);
    this.name = 'TransactionalEmailUnavailableError';
  }
}

export class TransactionalEmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean = false,
    public readonly providerErrorCategory?: string,
  ) {
    super(message);
    this.name = 'TransactionalEmailDeliveryError';
  }
}

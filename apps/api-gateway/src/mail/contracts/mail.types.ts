import {
  type TransactionalEmailTemplateId as SharedTransactionalEmailTemplateId,
  type TransactionalEmailJob as SharedTransactionalEmailJob,
} from '@techfusion/types';

export type TransactionalEmailTemplateId = SharedTransactionalEmailTemplateId;

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

export type TransactionalEmailJob = SharedTransactionalEmailJob;

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

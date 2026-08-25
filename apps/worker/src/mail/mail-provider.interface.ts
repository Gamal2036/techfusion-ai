export interface MailRenderedEmail {
  subject: string;
  textBody: string;
  htmlBody: string;
}

export interface MailSendResult {
  success: boolean;
  providerMessageId?: string;
  attempts: number;
}

export interface MailProvider {
  readonly name: string;
  send(renderedEmail: MailRenderedEmail, metadata: { to: string; templateId: string; correlationId: string }): Promise<MailSendResult>;
  isReady(): boolean;
  shutdown(): Promise<void>;
}

export class MailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean = false,
    public readonly providerErrorCategory?: string,
  ) {
    super(message);
    this.name = 'MailDeliveryError';
  }
}

export class MailUnavailableError extends Error {
  constructor(message: string = 'Mail is not available') {
    super(message);
    this.name = 'MailUnavailableError';
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { TransactionalEmailProvider, TransactionalEmailResult } from './contracts/mail-provider.interface';
import {
  TransactionalEmailTemplateId,
  TransactionalEmailRequest,
  TransactionalEmailUnavailableError,
  TransactionalEmailTemplateData,
} from './contracts/mail.types';
import { MailConfig, loadMailConfig } from './mail.config';
import { renderTransactionalEmail, SUPPORTED_TEMPLATE_IDS } from './templates/mail-templates';
import { MailUrlBuilder } from './mail-url-builder';
import { createDisabledProvider, createTestProvider, createSmtpProvider } from './mail.providers';

@Injectable()
export class TransactionalEmailService implements OnModuleDestroy {
  private readonly logger = new Logger(TransactionalEmailService.name);
  private readonly config: MailConfig;
  private readonly provider: TransactionalEmailProvider;
  private readonly urlBuilder: MailUrlBuilder;

  constructor() {
    this.config = loadMailConfig();
    this.urlBuilder = new MailUrlBuilder(this.config.publicWebUrl);

    if (!this.config.enabled) {
      this.provider = createDisabledProvider();
      this.logger.log('Transactional email is DISABLED. Set MAIL_ENABLED=true to enable.');
    } else if (this.config.transport === 'test') {
      this.provider = createTestProvider();
      this.logger.log('Transactional email using TEST provider (no network).');
    } else {
      throw new Error(
        'SMTP provider initialization must be done via the async factory. ' +
        'Use TransactionalEmailService.create() for enabled SMTP mode.',
      );
    }
  }

  static async create(): Promise<TransactionalEmailService> {
    const config = loadMailConfig();
    const service = new TransactionalEmailService();

    if (config.enabled && config.transport === 'smtp') {
      (service as any).provider = await createSmtpProvider(config);
      (service as any).logger.log('Transactional email using SMTP provider.');
    }

    return service;
  }

  async renderEmail(
    templateId: TransactionalEmailTemplateId,
    data: TransactionalEmailTemplateData,
  ): Promise<{ subject: string; textBody: string; htmlBody: string }> {
    if (!SUPPORTED_TEMPLATE_IDS.has(templateId)) {
      throw new Error(`Unsupported template ID: "${templateId}"`);
    }
    return renderTransactionalEmail(templateId, data);
  }

  async send(request: TransactionalEmailRequest): Promise<TransactionalEmailResult> {
    if (!this.config.enabled) {
      throw new TransactionalEmailUnavailableError(
        'Transactional email is not enabled. Set MAIL_ENABLED=true to enable.',
      );
    }

    if (!SUPPORTED_TEMPLATE_IDS.has(request.templateId)) {
      throw new Error(`Unsupported template ID: "${request.templateId}"`);
    }

    const rendered = renderTransactionalEmail(request.templateId, request.templateData);

    const result = await this.provider.send(rendered, {
      to: request.to,
      templateId: request.templateId,
      correlationId: request.correlationId || 'unknown',
    });

    return result;
  }

  isReady(): boolean {
    return this.provider.isReady();
  }

  getConfig(): MailConfig {
    return { ...this.config, smtp: { ...this.config.smtp } };
  }

  getUrlBuilder(): MailUrlBuilder {
    return this.urlBuilder;
  }

  getProviderName(): string {
    return this.provider.name;
  }

  async onModuleDestroy(): Promise<void> {
    await this.provider.shutdown();
  }
}

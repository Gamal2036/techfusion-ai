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

  constructor(config: MailConfig, provider: TransactionalEmailProvider) {
    this.config = config;
    this.provider = provider;
    this.urlBuilder = new MailUrlBuilder(config.publicWebUrl);
  }

  static async create(): Promise<TransactionalEmailService> {
    const config = loadMailConfig();

    if (!config.enabled) {
      const provider = createDisabledProvider();
      const service = new TransactionalEmailService(config, provider);
      service.logger.log('Transactional email is DISABLED. Set MAIL_ENABLED=true to enable.');
      return service;
    }

    if (config.transport === 'test') {
      const provider = createTestProvider();
      const service = new TransactionalEmailService(config, provider);
      service.logger.log('Transactional email using TEST provider (no network).');
      return service;
    }

    const provider = await createSmtpProvider(config);
    const service = new TransactionalEmailService(config, provider);
    service.logger.log('Transactional email using SMTP provider.');
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

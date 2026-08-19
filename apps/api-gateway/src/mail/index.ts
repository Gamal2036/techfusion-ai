export { MailModule } from './mail.module';
export { TransactionalEmailService } from './mail.service';
export { MailUrlBuilder } from './mail-url-builder';
export { loadMailConfig } from './mail.config';
export type { MailConfig } from './mail.config';
export { SUPPORTED_TEMPLATE_IDS } from './templates/mail-templates';
export type {
  TransactionalEmailTemplateId,
  TransactionalEmailRequest,
  TransactionalEmailJob,
  TransactionalEmailResult,
  TransactionalEmailUnavailableError,
  TransactionalEmailDeliveryError,
  TransactionalEmailTemplateData,
  PasswordResetTemplateData,
  EmailVerificationTemplateData,
  SecurityNotificationTemplateData,
  RenderedTransactionalEmail,
} from './contracts/mail.types';
export type { TransactionalEmailProvider } from './contracts/mail-provider.interface';

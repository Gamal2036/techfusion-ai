import { Job, UnrecoverableError } from 'bullmq';
import {
  TRANSACTIONAL_EMAIL_CONTRACT_VERSION,
  isValidTransactionalEmailTemplateId,
  isValidTransactionalEmailPayload,
  isValidRecipientEmailAddress,
  type TransactionalEmailDeliveryEnvelopeV1,
  type TransactionalEmailJobWithCorrelation,
} from '@techfusion/types';
import { MailProvider, MailDeliveryError, MailRenderedEmail } from './mail-provider.interface';
import { renderTemplate, TemplateData } from './mail-templates';
import { MailUrlBuilder } from './mail-url-builder';
import { createWorkerLogger } from '../structured-logger';
import { extractCorrelationFromJob } from '../correlation';

const log = createWorkerLogger('MailProcessor');

export function createMailProcessor(
  provider: MailProvider,
  openDeliveryEnvelope: (encrypted: string) => TransactionalEmailDeliveryEnvelopeV1,
  urlBuilder: MailUrlBuilder,
) {
  return async function processTransactionalEmailJob(job: Job): Promise<any> {
    const start = Date.now();
    const corr = extractCorrelationFromJob(job.data as Record<string, unknown>);

    const data = job.data as TransactionalEmailJobWithCorrelation;

    log.log('Processing transactional email job', {
      queueName: 'transactional-email',
      jobId: job.id?.toString(),
      correlationId: corr?.correlationId,
    });

    try {
      if (data.version !== TRANSACTIONAL_EMAIL_CONTRACT_VERSION) {
        throw new MailDeliveryError(`Unsupported job version: ${data.version}`, false, 'contract');
      }

      if (!data.templateId || typeof data.templateId !== 'string') {
        throw new MailDeliveryError('Missing or invalid templateId', false, 'contract');
      }

      if (!data.encryptedPayload || typeof data.encryptedPayload !== 'string') {
        throw new MailDeliveryError('Missing or invalid encryptedPayload', false, 'contract');
      }

      if (!data.idempotencyKey || typeof data.idempotencyKey !== 'string') {
        throw new MailDeliveryError('Missing or invalid idempotencyKey', false, 'contract');
      }

      let envelope: TransactionalEmailDeliveryEnvelopeV1;
      try {
        envelope = openDeliveryEnvelope(data.encryptedPayload);
      } catch (err: any) {
        log.error('Failed to open encrypted delivery envelope, aborting', {
          queueName: 'transactional-email',
          jobId: job.id?.toString(),
          errorType: 'DecryptionError',
          errorMessage: err?.message || 'Envelope decryption failed',
          correlationId: corr?.correlationId,
        });
        throw new MailDeliveryError(err?.message || 'Payload decryption failed', false, 'decryption');
      }

      // The real recipient address comes ONLY from the decrypted envelope.
      // recipientHash is observability/correlation data and must never be
      // used to derive an SMTP recipient.
      if (!isValidRecipientEmailAddress(envelope.to)) {
        log.error('Invalid delivery envelope recipient, aborting before render and send', {
          queueName: 'transactional-email',
          jobId: job.id?.toString(),
          errorType: 'EnvelopeValidationError',
          errorMessage: 'Invalid transactional email delivery envelope',
          correlationId: corr?.correlationId,
        });
        throw new MailDeliveryError('Invalid transactional email delivery envelope', false, 'envelope');
      }

      if (
        isValidTransactionalEmailTemplateId(data.templateId) &&
        !isValidTransactionalEmailPayload(data.templateId, envelope.templateData)
      ) {
        log.error('Invalid template payload, aborting before render and send', {
          queueName: 'transactional-email',
          jobId: job.id?.toString(),
          errorType: 'PayloadValidationError',
          errorMessage: 'Invalid transactional email payload',
          correlationId: corr?.correlationId,
        });
        throw new MailDeliveryError('Invalid transactional email payload', false, 'payload');
      }

      let rendered: MailRenderedEmail;
      try {
        rendered = renderTemplate(data.templateId, envelope.templateData as TemplateData);
      } catch (err: any) {
        log.error('Failed to render template', {
          queueName: 'transactional-email',
          jobId: job.id?.toString(),
          errorType: 'TemplateError',
          errorMessage: `Template rendering failed: ${data.templateId}`,
          correlationId: corr?.correlationId,
        });
        throw new MailDeliveryError(`Template rendering failed: ${data.templateId}`, false, 'template');
      }

      log.log('Sending email', {
        queueName: 'transactional-email',
        jobId: job.id?.toString(),
        correlationId: corr?.correlationId,
      });

      const result = await provider.send(rendered, {
        to: envelope.to,
        templateId: data.templateId,
        correlationId: data.correlationId,
      });

      const duration = (Date.now() - start) / 1000;

      log.log('Transactional email sent successfully', {
        queueName: 'transactional-email',
        jobId: job.id?.toString(),
        duration,
        correlationId: corr?.correlationId,
      });

      return {
        success: true,
        providerMessageId: result.providerMessageId,
        attempts: job.attemptsMade,
      };
    } catch (err: any) {
      const duration = (Date.now() - start) / 1000;

      if (err instanceof MailDeliveryError && err.isRetryable) {
        log.warn('Transactional email failed (retryable)', {
          queueName: 'transactional-email',
          jobId: job.id?.toString(),
          errorType: 'RetryableError',
          errorMessage: err.providerErrorCategory || 'retryable',
          correlationId: corr?.correlationId,
          duration,
        });
        throw err;
      }

      if (err instanceof MailDeliveryError && !err.isRetryable) {
        log.error('Transactional email failed (permanent)', {
          queueName: 'transactional-email',
          jobId: job.id?.toString(),
          errorType: err?.name || 'MailError',
          errorMessage: err.providerErrorCategory
            ? `${err.message} [category: ${err.providerErrorCategory}]`
            : err.message,
          correlationId: corr?.correlationId,
          duration,
        });
        // BullMQ-supported non-retryable mechanism: the job moves straight to
        // the failed set without consuming any remaining attempts.
        throw new UnrecoverableError(err.message);
      }

      log.error('Transactional email failed (unexpected)', {
        queueName: 'transactional-email',
        jobId: job.id?.toString(),
        errorType: err?.name || 'MailError',
        errorMessage: err?.message || 'Unknown error',
        correlationId: corr?.correlationId,
        duration,
      });

      throw err;
    }
  };
}

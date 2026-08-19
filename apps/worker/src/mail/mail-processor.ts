import { Job } from 'bullmq';
import { MailProvider, MailDeliveryError, MailRenderedEmail } from './mail-provider.interface';
import { renderTemplate, TemplateData } from './mail-templates';
import { MailUrlBuilder } from './mail-url-builder';
import { createWorkerLogger } from '../structured-logger';
import { extractCorrelationFromJob } from '../correlation';

const log = createWorkerLogger('MailProcessor');

interface TransactionalEmailJobData {
  version: number;
  templateId: string;
  encryptedPayload: string;
  recipientHash: string;
  idempotencyKey: string;
  correlationId: string;
  _correlation?: {
    requestId: string;
    correlationId: string;
    traceId?: string;
    userId?: string;
    orgId?: string;
  };
}

function maskHash(hash: string): string {
  if (hash.length <= 8) return '****';
  return `${hash.slice(0, 4)}****${hash.slice(-4)}`;
}

export function createMailProcessor(
  provider: MailProvider,
  decryptPayload: (encrypted: string) => TemplateData,
  urlBuilder: MailUrlBuilder,
) {
  return async function processTransactionalEmailJob(job: Job): Promise<any> {
    const start = Date.now();
    const corr = extractCorrelationFromJob(job.data as Record<string, unknown>);

    const data = job.data as TransactionalEmailJobData;

    log.log('Processing transactional email job', {
      queueName: 'transactional-email',
      jobId: job.id?.toString(),
      correlationId: corr?.correlationId,
    });

    try {
      if (data.version !== 1) {
        throw new Error(`Unsupported job version: ${data.version}`);
      }

      if (!data.templateId || typeof data.templateId !== 'string') {
        throw new Error('Missing or invalid templateId');
      }

      if (!data.encryptedPayload || typeof data.encryptedPayload !== 'string') {
        throw new Error('Missing or invalid encryptedPayload');
      }

      if (!data.idempotencyKey || typeof data.idempotencyKey !== 'string') {
        throw new Error('Missing or invalid idempotencyKey');
      }

      let templateData: TemplateData;
      try {
        templateData = decryptPayload(data.encryptedPayload);
      } catch (err: any) {
        log.error('Failed to decrypt payload, aborting', {
          queueName: 'transactional-email',
          jobId: job.id?.toString(),
          errorType: 'DecryptionError',
          errorMessage: 'Payload decryption failed',
          correlationId: corr?.correlationId,
        });
        throw new MailDeliveryError('Payload decryption failed', false, 'decryption');
      }

      let rendered: MailRenderedEmail;
      try {
        rendered = renderTemplate(data.templateId, templateData);
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
        to: `recipient-${maskHash(data.recipientHash)}`,
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

      log.error('Transactional email failed (permanent)', {
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

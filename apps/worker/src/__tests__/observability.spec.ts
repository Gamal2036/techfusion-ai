import { createWorkerLogger } from '../structured-logger';
import { extractCorrelationFromJob, generateCorrelationId } from '../correlation';
import {
  trackJobCompleted,
  trackJobFailed,
  trackJobDuration,
  trackQueueDepth,
  trackJobCounts,
  getMetrics,
} from '../metrics';

describe('Worker Observability (AH-2D.2)', () => {
  describe('Structured Logger', () => {
    it('creates logger with context', () => {
      const logger = createWorkerLogger('Test');
      expect(logger).toBeDefined();
    });

    it('logs without throwing', () => {
      const logger = createWorkerLogger('Test');
      expect(() => logger.log('test message')).not.toThrow();
      expect(() => logger.error('test error')).not.toThrow();
      expect(() => logger.warn('test warn')).not.toThrow();
      expect(() => logger.debug('test debug')).not.toThrow();
    });

    it('accepts structured context', () => {
      const logger = createWorkerLogger('Test');
      expect(() =>
        logger.log('processing', {
          queueName: 'alert',
          jobId: '123',
          jobName: 'notification',
        }),
      ).not.toThrow();
    });
  });

  describe('Correlation', () => {
    it('extracts correlation from job data', () => {
      const data = { _correlation: { requestId: 'req-1', correlationId: 'corr-1' } };
      const corr = extractCorrelationFromJob(data);
      expect(corr).toBeDefined();
      expect(corr?.requestId).toBe('req-1');
    });

    it('returns undefined for job data without correlation', () => {
      const corr = extractCorrelationFromJob({ foo: 'bar' });
      expect(corr).toBeUndefined();
    });

    it('generates unique correlation ids', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('Metrics', () => {
    it('trackJobCompleted increments counter', () => {
      expect(() => trackJobCompleted('alert')).not.toThrow();
    });

    it('trackJobFailed increments counter', () => {
      expect(() => trackJobFailed('alert', 'test error')).not.toThrow();
    });

    it('trackJobDuration records observation', () => {
      expect(() => trackJobDuration('alert', 'notification', 1.5)).not.toThrow();
    });

    it('trackQueueDepth sets gauge', () => {
      expect(() => trackQueueDepth('alert', 42)).not.toThrow();
    });

    it('trackJobCounts sets gauges', () => {
      expect(() => trackJobCounts('alert', 10, 5, 3)).not.toThrow();
    });

    it('getMetrics returns prometheus output', async () => {
      trackJobCompleted('alert');
      const metrics = await getMetrics();
      expect(metrics).toContain('bullmq_jobs_completed_total');
      expect(metrics).toContain('bullmq_queue_depth');
    });
  });
});

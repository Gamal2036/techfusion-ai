import { createStructuredLogger, StructuredLogger } from '../src/common/structured-logger';
import {
  generateJobCorrelationId,
  CorrelationContext,
} from '../src/common/correlation-id';

describe('Observability Unit Tests (AH-2D.2)', () => {
  describe('Structured Logger', () => {
    let logger: StructuredLogger;

    beforeEach(() => {
      logger = createStructuredLogger('TestContext');
    });

    it('creates logger with context name', () => {
      expect(logger).toBeDefined();
    });

    it('log does not throw', () => {
      expect(() => logger.log('test message')).not.toThrow();
    });

    it('error does not throw', () => {
      expect(() => logger.error('test error')).not.toThrow();
    });

    it('warn does not throw', () => {
      expect(() => logger.warn('test warn')).not.toThrow();
    });

    it('debug does not throw', () => {
      expect(() => logger.debug('test debug')).not.toThrow();
    });

    it('accepts structured context with requestId', () => {
      expect(() =>
        logger.log('request processed', {
          requestId: 'req-123',
          correlationId: 'corr-456',
          method: 'GET',
          route: '/health',
          statusCode: 200,
          duration: 42,
        }),
      ).not.toThrow();
    });

    it('accepts error context', () => {
      expect(() =>
        logger.error('operation failed', {
          errorType: 'DatabaseError',
          errorMessage: 'connection timeout',
          queueName: 'alert',
          jobId: 'job-123',
        }),
      ).not.toThrow();
    });

    it('redaction of sensitive data does not throw', () => {
      expect(() =>
        logger.log('user login', {
          userId: 'user-123',
          orgId: 'org-456',
        }),
      ).not.toThrow();
    });
  });

  describe('Correlation ID', () => {
    it('generateJobCorrelationId generates unique IDs', () => {
      const id1 = generateJobCorrelationId();
      const id2 = generateJobCorrelationId();
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('generateJobCorrelationId with parent creates nested ID', () => {
      const parent = 'parent-corr-id';
      const child = generateJobCorrelationId(parent);
      expect(child).toBeDefined();
      expect(child).not.toBe(parent);
    });

    it('generateJobCorrelationId without parent creates standalone ID', () => {
      const id = generateJobCorrelationId(undefined);
      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('Metrics Functions', () => {
    it('all tracking functions are callable', async () => {
      const metrics = await import('../src/metrics.interceptor');
      expect(() => metrics.trackAuthFailure('invalid_token')).not.toThrow();
      expect(() => metrics.trackRateLimitRejection()).not.toThrow();
      expect(() => metrics.trackValidationFailure()).not.toThrow();
      expect(() => metrics.trackDeviceRegistration('success')).not.toThrow();
      expect(() => metrics.trackMetricsIngestion('success')).not.toThrow();
      expect(() => metrics.trackInventoryIngestion('success')).not.toThrow();
      expect(() => metrics.trackSecurityReport('success')).not.toThrow();
      expect(() => metrics.trackAlertCreation('critical')).not.toThrow();
      expect(() => metrics.trackInternalError()).not.toThrow();
      expect(() => metrics.trackWsConnection('/metrics')).not.toThrow();
      expect(() => metrics.trackWsDisconnection('/metrics', 'client_initiated')).not.toThrow();
      expect(() => metrics.trackWsAuthFailure('/metrics')).not.toThrow();
      expect(() => metrics.trackRemoteSupportSession()).not.toThrow();
      expect(() => metrics.trackRemoteSupportSessionEnd()).not.toThrow();
      expect(() => metrics.trackRemoteSupportCreated()).not.toThrow();
      expect(() => metrics.trackRemoteSupportConsent('accepted')).not.toThrow();
      expect(() => metrics.trackDbConnection('success')).not.toThrow();
      expect(() => metrics.trackRedisConnection('success')).not.toThrow();
    });

    it('getMetrics returns prometheus output', async () => {
      const metrics = await import('../src/metrics.interceptor');
      const output = await metrics.getMetrics();
      expect(typeof output).toBe('string');
      expect(output).toContain('http_requests_total');
    });

    it('getMetricsContentType returns valid content type', async () => {
      const metrics = await import('../src/metrics.interceptor');
      const contentType = metrics.getMetricsContentType();
      expect(contentType).toContain('text/plain');
    });
  });

  describe('Metrics Endpoint Security', () => {
    it('metrics controller class is defined', async () => {
      const { MetricsController } = await import('../src/metrics.controller');
      expect(MetricsController).toBeDefined();
    });

    it('health controller class is defined', async () => {
      const { HealthController } = await import('../src/health.controller');
      expect(HealthController).toBeDefined();
    });
  });
});

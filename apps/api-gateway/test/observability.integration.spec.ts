import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CorrelationIdInterceptor } from '../src/common/correlation-id';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { RequestLoggingInterceptor } from '../src/common/request-logging.interceptor';

describe('Observability Integration (AH-2D.2) - requires PostgreSQL/Redis', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalInterceptors(
      new CorrelationIdInterceptor(),
      new RequestLoggingInterceptor(),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Health Endpoints', () => {
    it('GET /health returns ok with version', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeDefined();
      expect(res.body.version).toBeDefined();
    });

    it('GET /health/live returns liveness', async () => {
      const res = await request(app.getHttpServer()).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('GET /health/ready returns readiness with dependency checks', async () => {
      const res = await request(app.getHttpServer()).get('/health/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.postgres).toBeDefined();
      expect(res.body.checks.redis).toBeDefined();
    });
  });

  describe('Request Correlation', () => {
    it('generates X-Request-Id when absent', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('preserves incoming X-Request-Id', async () => {
      const incomingId = 'test-req-obs-12345678';
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('X-Request-Id', incomingId);
      expect(res.headers['x-request-id']).toBe(incomingId);
    });

    it('returns X-Correlation-Id', async () => {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.headers['x-correlation-id']).toBeDefined();
    });
  });

  describe('Metrics Endpoint', () => {
    it('GET /metrics returns prometheus metrics', async () => {
      const res = await request(app.getHttpServer()).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('http_requests_total');
    });

    it('contains new observability metrics', async () => {
      const res = await request(app.getHttpServer()).get('/metrics');
      expect(res.text).toContain('http_active_requests');
      expect(res.text).toContain('authentication_failures_total');
      expect(res.text).toContain('websocket_connections');
      expect(res.text).toContain('db_connection_attempts_total');
      expect(res.text).toContain('redis_connection_attempts_total');
    });
  });

  describe('Exception Response', () => {
    it('404 includes requestId and correlationId', async () => {
      const res = await request(app.getHttpServer()).get('/nonexistent-obs-test');
      expect(res.status).toBe(404);
      expect(res.body.requestId).toBeDefined();
      expect(res.body.correlationId).toBeDefined();
    });
  });
});

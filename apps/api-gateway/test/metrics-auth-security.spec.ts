import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Metrics Auth Security (V1-STAGE-01-SUB-05 / S5)', () => {
  let app: INestApplication;
  const VALID_TOKEN = 'ci-metrics-test-token-0123456789abcdef';
  const ORIGINAL_TOKEN = process.env.METRICS_AUTH_TOKEN;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeAll(async () => {
    delete process.env.METRICS_AUTH_TOKEN;
    delete process.env.NODE_ENV;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
    if (ORIGINAL_TOKEN === undefined) delete process.env.METRICS_AUTH_TOKEN;
    else process.env.METRICS_AUTH_TOKEN = ORIGINAL_TOKEN;
    if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  afterEach(() => {
    delete process.env.METRICS_AUTH_TOKEN;
    delete process.env.NODE_ENV;
  });

  it('open when token unset and not production (dev posture)', async () => {
    delete process.env.METRICS_AUTH_TOKEN;
    delete process.env.NODE_ENV;
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });

  it('accepts a valid Bearer header when token configured', async () => {
    process.env.METRICS_AUTH_TOKEN = VALID_TOKEN;
    delete process.env.NODE_ENV;
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });

  it('rejects a wrong Bearer header when token configured', async () => {
    process.env.METRICS_AUTH_TOKEN = VALID_TOKEN;
    delete process.env.NODE_ENV;
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', 'Bearer ci-metrics-wrong-token');
    expect(res.status).toBe(403);
  });

  it('rejects the token in the query string (no secrets in URLs/logs)', async () => {
    process.env.METRICS_AUTH_TOKEN = VALID_TOKEN;
    delete process.env.NODE_ENV;
    const res = await request(app.getHttpServer()).get(`/metrics?token=${VALID_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request when token configured', async () => {
    process.env.METRICS_AUTH_TOKEN = VALID_TOKEN;
    delete process.env.NODE_ENV;
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(403);
  });

  it('fail-closed: 403 in production when token is not configured', async () => {
    delete process.env.METRICS_AUTH_TOKEN;
    process.env.NODE_ENV = 'production';
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(403);
  });

  it('fail-closed in production even with a bogus header when token is not configured', async () => {
    delete process.env.METRICS_AUTH_TOKEN;
    process.env.NODE_ENV = 'production';
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('allows a valid Bearer header in production when token configured', async () => {
    process.env.METRICS_AUTH_TOKEN = VALID_TOKEN;
    process.env.NODE_ENV = 'production';
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});

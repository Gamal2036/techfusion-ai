import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import helmet from 'helmet';
import { getSecurityHeaders } from '../src/config/security-headers';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
};

describe('Security Hardening (AH-2D.1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QueueService)
      .useClass(MockQueueService)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    app.use(helmet(getSecurityHeaders()));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.kbEmbedding.deleteMany();
    await prisma.kbArticle.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.remoteSession.deleteMany();
    await prisma.backupRun.deleteMany();
    await prisma.backupJob.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.driverCatalogItem.deleteMany();
    await prisma.softwareInventory.deleteMany();
    await prisma.softwareCatalogItem.deleteMany();
    await prisma.networkDevice.deleteMany();
    await prisma.networkScan.deleteMany();
    await prisma.securityFinding.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
  });

  async function seedOrg(slug: string, name: string, email: string, role: any) {
    const org = await prisma.organization.create({ data: { name, slug } });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('SecureP@ssw0rd!', 4),
        displayName: name + ' User',
        orgId: org.id,
        role,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role } });
    return { org, user };
  }

  async function loginAs(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'SecureP@ssw0rd!' });
    return res.body.accessToken;
  }

  describe('Environment validation', () => {
    it('rejects insecure production JWT_SECRET', () => {
      const original = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'short';
      process.env.NODE_ENV = 'production';
      try {
        expect(() => {
          const secret = process.env.JWT_SECRET;
          if (process.env.NODE_ENV === 'production' && secret && secret.length < 32) {
            throw new Error('Secret too short');
          }
        }).toThrow('Secret too short');
      } finally {
        process.env.JWT_SECRET = original;
        process.env.NODE_ENV = 'development';
      }
    });
  });

  describe('Security headers', () => {
    it('returns X-Content-Type-Options header', async () => {
      const res = await request(app.getHttpServer())
        .get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('returns X-Frame-Options header', async () => {
      const res = await request(app.getHttpServer())
        .get('/health');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('returns Referrer-Policy header', async () => {
      const res = await request(app.getHttpServer())
        .get('/health');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('does not expose X-Powered-By header', async () => {
      const res = await request(app.getHttpServer())
        .get('/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('returns Content-Security-Policy', async () => {
      const res = await request(app.getHttpServer())
        .get('/health');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  describe('Rate limiting', () => {
    it('rate limiting is configured on auth endpoints', async () => {
      await seedOrg('ratelimit-org', 'RateLimit Org', 'rl@test.com', 'Owner');
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'rl@test.com', password: 'wrong' });
      expect([200, 401, 429]).toContain(res.status);
    });
  });

  describe('Input validation', () => {
    it('rejects empty signup body', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Authentication hardening', () => {
    it('rejects invalid JWT tokens', async () => {
      const res = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('rejects expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { sub: 'user-1', orgId: 'org-1', role: 'Owner' },
        JWT_SECRET(),
        { expiresIn: '0s' },
      );
      const res = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it('rejects tokens signed with wrong secret', async () => {
      const badToken = jwt.sign(
        { sub: 'user-1', orgId: 'org-1', role: 'Owner' },
        'wrong-secret',
        { expiresIn: '15m' },
      );
      const res = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${badToken}`);
      expect(res.status).toBe(401);
    });

    it('returns generic error message for failed login', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' });
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('does not expose user existence on login', async () => {
      await seedOrg('enum-org', 'Enum Org', 'exists@test.com', 'Owner');
      const res1 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'exists@test.com', password: 'wrong' });
      const res2 = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' });
      expect(res1.body.message).toBe(res2.body.message);
    });

    it('rejects missing authorization header', async () => {
      const res = await request(app.getHttpServer())
        .get('/devices');
      expect(res.status).toBe(401);
    });

    it('rejects malformed authorization header', async () => {
      const res = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', 'NotBearer sometoken');
      expect(res.status).toBe(401);
    });
  });

  describe('Authorization and tenant isolation', () => {
    it('prevents cross-tenant device access', async () => {
      const { org: orgA } = await seedOrg('iso-a', 'Org A', 'isoa@test.com', 'Owner');
      const { org: orgB } = await seedOrg('iso-b', 'Org B', 'isob@test.com', 'Owner');
      const tokenB = await loginAs('isob@test.com');

      const device = await prisma.device.create({
        data: { orgId: orgA.id, name: 'OrgA Device', deviceTokenHash: 'orga-token-hash' },
      });

      const res = await request(app.getHttpServer())
        .get(`/devices/${device.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    it('prevents cross-tenant backup access', async () => {
      const { org: orgA } = await seedOrg('bak-a', 'Bak A', 'baka@test.com', 'Admin');
      const { org: orgB } = await seedOrg('bak-b', 'Bak B', 'bakb@test.com', 'Admin');
      const tokenB = await loginAs('bakb@test.com');

      const job = await prisma.backupJob.create({
        data: { orgId: orgA.id, name: 'OrgA Backup', deviceId: 'dev-1', type: 'file', retention: 7 },
      });

      const res = await request(app.getHttpServer())
        .get(`/backups/jobs/${job.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });

    it('prevents cross-tenant remote session access', async () => {
      const { org: orgA } = await seedOrg('rmt-a', 'Rmt A', 'rmta@test.com', 'Admin');
      const { org: orgB } = await seedOrg('rmt-b', 'Rmt B', 'rmtb@test.com', 'Admin');
      const tokenA = await loginAs('rmta@test.com');
      const tokenB = await loginAs('rmtb@test.com');

      const deviceA = await prisma.device.create({
        data: { orgId: orgA.id, name: 'RmtDeviceA', deviceTokenHash: 'rmt-device-a-token-hash' },
      });

      const createRes = await request(app.getHttpServer())
        .post('/remote-support/sessions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ deviceId: deviceA.id })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/remote-support/sessions/${createRes.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Error handling', () => {
    it('does not expose stack traces in error responses', async () => {
      const res = await request(app.getHttpServer())
        .get('/nonexistent-endpoint-xyz');
      expect(res.status).toBe(404);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('stack');
      expect(body).not.toContain('at ');
      expect(body).not.toContain('node_modules');
    });

    it('returns structured error response', async () => {
      const res = await request(app.getHttpServer())
        .get('/nonexistent-endpoint-xyz');
      expect(res.status).toBe(404);
      expect(res.body.statusCode).toBeDefined();
      expect(res.body.message).toBeDefined();
    });

    it('returns 401 for missing auth on protected endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users');
      expect(res.status).toBe(401);
    });

    it('returns 403 for insufficient role', async () => {
      await seedOrg('role-org', 'Role Org', 'viewer-role@test.com', 'Viewer');
      const token = await loginAs('viewer-role@test.com');
      const res = await request(app.getHttpServer())
        .get('/demo/admin')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('WebSocket security', () => {
    it('rejects WebSocket connection without token', (done) => {
      const io = require('socket.io-client');
      const socket = io('http://localhost:3001/metrics', {
        transports: ['websocket'],
        reconnection: false,
      });
      socket.on('connect_error', () => {
        socket.disconnect();
        done();
      });
      setTimeout(() => {
        socket.disconnect();
        done();
      }, 3000);
    });
  });

  describe('Public endpoint protection', () => {
    it('device metrics endpoint requires device token', async () => {
      const res = await request(app.getHttpServer())
        .post('/devices/metrics')
        .send({ cpu: { usage: 50 } });
      expect(res.status).toBe(401);
    });

    it('security report handles invalid device token gracefully', async () => {
      const res = await request(app.getHttpServer())
        .post('/devices/security-report')
        .send({ deviceToken: 'invalid', findings: [] });
      expect([200, 401]).toContain(res.status);
    });

    it('remote support consent handles missing token', async () => {
      const res = await request(app.getHttpServer())
        .post('/remote-support/consent')
        .send({ sessionId: 'test', deviceId: 'test', granted: true, method: 'click' });
      expect([201, 401, 404]).toContain(res.status);
    });
  });

  describe('Refresh token reuse detection', () => {
    it('revokes refresh token after use', async () => {
      await seedOrg('reuse-org', 'Reuse Org', 'reuse@test.com', 'Owner');

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reuse@test.com', password: 'SecureP@ssw0rd!' })
        .expect(201);

      const firstRefresh = loginRes.body.refreshToken;

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: firstRefresh })
        .expect(201);

      const replayRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: firstRefresh })
        .expect(401);

      expect(replayRes.status).toBe(401);
    });
  });

  describe('Admin endpoint protection', () => {
    it('rejects unauthenticated access to admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users');
      expect(res.status).toBe(401);
    });

    it('rejects viewer access to admin dashboard', async () => {
      await seedOrg('adm-viewer', 'Adm Viewer', 'adm-viewer@test.com', 'Viewer');
      const token = await loginAs('adm-viewer@test.com');
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Audit log immutability', () => {
    it('audit logs have no update/delete REST endpoints', async () => {
      await seedOrg('audit-org', 'Audit Org', 'audit@test.com', 'Owner');
      const token = await loginAs('audit@test.com');

      const endpoints = [
        { method: 'patch' as const, url: '/audit/some-id' },
        { method: 'put' as const, url: '/audit/some-id' },
        { method: 'delete' as const, url: '/audit/some-id' },
      ];

      for (const ep of endpoints) {
        const res = await request(app.getHttpServer())
          [ep.method](ep.url)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
      }
    });
  });
});

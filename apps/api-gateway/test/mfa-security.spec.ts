import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { ThrottlerStorage } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';

const PASSWORD = 'password123';

describe('MFA Core Security Hardening (ACC-SEC-02B1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let throttlerStorage: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QueueService)
      .useClass(MockQueueService)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    throttlerStorage = moduleFixture.get<any>(ThrottlerStorage);

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    throttlerStorage.storage.clear();
    await prisma.refreshToken.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
  });

  async function seedUser(email: string, overrides: { mfaSecret?: string | null; isMfaEnabled?: boolean } = {}) {
    const org = await prisma.organization.create({
      data: { name: `MFA Org ${email}`, slug: `mfa-${email.replace(/[^a-z0-9]/g, '-')}` },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        displayName: 'MFA User',
        orgId: org.id,
        role: 'Owner',
        mfaSecret: overrides.mfaSecret ?? null,
        isMfaEnabled: overrides.isMfaEnabled ?? false,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role: 'Owner' } });
    return { org, user };
  }

  function login(email: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });
  }

  async function accessToken(email: string) {
    const res = await login(email);
    return res.body.accessToken;
  }

  async function mfaAccessToken(email: string, secret: string) {
    const loginRes = await login(email).expect(201);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-login')
      .send({ userId: loginRes.body.userId, token: totp(secret) })
      .expect(201);
    return verifyRes.body.accessToken;
  }

  function totp(secret: string) {
    return speakeasy.totp({ secret, encoding: 'base32' });
  }

  describe('MFA routes require authentication', () => {
    it('rejects POST /mfa/enroll without a token', async () => {
      const res = await request(app.getHttpServer()).post('/mfa/enroll');
      expect(res.status).toBe(401);
    });

    it('rejects POST /mfa/verify without a token', async () => {
      const res = await request(app.getHttpServer()).post('/mfa/verify').send({ token: '000000' });
      expect(res.status).toBe(401);
    });
  });

  describe('Throttling on MFA routes (deterministic 429)', () => {
    it('returns 429 on POST /mfa/enroll once the limit is exceeded', async () => {
      const { user } = await seedUser('throttle-enroll@test.com');
      const token = await accessToken(user.email);

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/mfa/enroll')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(201);
      }

      const blocked = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`);
      expect(blocked.status).toBe(429);
    });

    it('returns 429 on POST /mfa/verify once the limit is exceeded', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await seedUser('throttle-verify@test.com', { mfaSecret: secret.base32 });
      const token = await accessToken(user.email);

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/mfa/verify')
          .set('Authorization', `Bearer ${token}`)
          .send({ token: '000000' });
        expect(res.status).toBe(400);
      }

      const blocked = await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: '000000' });
      expect(blocked.status).toBe(429);
    });

    it('does not throttle unrelated endpoints', async () => {
      const { user } = await seedUser('throttle-unrelated@test.com');
      const token = await accessToken(user.email);

      for (let i = 0; i < 6; i++) {
        const statusRes = await request(app.getHttpServer())
          .get('/mfa/status')
          .set('Authorization', `Bearer ${token}`);
        expect(statusRes.status).toBe(200);

        const healthRes = await request(app.getHttpServer()).get('/health');
        expect(healthRes.status).toBe(200);
      }
    });

    it('does not break the login flow when MFA routes are throttled', async () => {
      const { user } = await seedUser('throttle-login@test.com');
      const token = await accessToken(user.email);

      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .post('/mfa/enroll')
          .set('Authorization', `Bearer ${token}`);
      }

      const res = await login(user.email);
      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });
  });

  describe('MFA secret encryption at rest', () => {
    it('stores the MFA secret encrypted, never as plaintext base32', async () => {
      const { user } = await seedUser('encrypt-at-rest@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.mfaSecret).toBeDefined();
      expect(dbUser?.mfaSecret).toMatch(/^enc:v1:/);
      expect(dbUser?.mfaSecret).not.toContain(enrollRes.body.secret);
    });

    it('returns the plaintext setup secret only from the enroll response', async () => {
      const { user } = await seedUser('setup-secret@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(enrollRes.body.secret).toBeDefined();
      expect(enrollRes.body.qrCode).toContain('data:image/png;base64,');

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.mfaSecret).not.toContain(enrollRes.body.secret);
    });

    it('never exposes the MFA secret from status', async () => {
      const { user } = await seedUser('status-no-secret@test.com');
      const token = await accessToken(user.email);

      const res = await request(app.getHttpServer())
        .get('/mfa/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ isMfaEnabled: false });
      expect(JSON.stringify(res.body)).not.toContain('mfaSecret');
    });

    it('does not log the MFA secret or TOTP tokens', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      const { user } = await seedUser('no-secret-logs@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const secret = enrollRes.body.secret;
      const badToken = totp(secret).replace(/./g, '0');

      await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: badToken });

      const allLogs = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
        .map((call) => JSON.stringify(call))
        .join('\n');

      expect(allLogs).not.toContain(secret);
      expect(allLogs).not.toContain(badToken);

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('MFA verification', () => {
    it('enables MFA when a valid token is presented against an encrypted secret', async () => {
      const { user } = await seedUser('verify-encrypted@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: totp(enrollRes.body.secret) })
        .expect(201);

      expect(res.body.message).toBe('MFA enabled successfully');

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
    });

    it('verifies with a legacy plaintext secret', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await seedUser('verify-legacy@test.com', { mfaSecret: secret.base32 });
      const token = await accessToken(user.email);

      await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: totp(secret.base32) })
        .expect(201);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
    });

    it('upgrades a legacy plaintext secret to encrypted after successful verification', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await seedUser('verify-upgrade@test.com', { mfaSecret: secret.base32 });
      const token = await accessToken(user.email);

      await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: totp(secret.base32) })
        .expect(201);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.mfaSecret).toMatch(/^enc:v1:/);
      expect(dbUser?.mfaSecret).not.toContain(secret.base32);
    });

    it('keeps the login challenge working with an encrypted secret', async () => {
      const { user } = await seedUser('login-encrypted@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: totp(enrollRes.body.secret) })
        .expect(201);

      const loginRes = await login(user.email).expect(201);
      expect(loginRes.body.mfaRequired).toBe(true);
      expect(loginRes.body.userId).toBeDefined();

      const verifyLoginRes = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: loginRes.body.userId, token: totp(enrollRes.body.secret) })
        .expect(201);

      expect(verifyLoginRes.body.accessToken).toBeDefined();
      expect(verifyLoginRes.body.refreshToken).toBeDefined();
      expect(JSON.stringify(verifyLoginRes.body)).not.toContain('mfaSecret');
    });

    it('keeps the login challenge working with a legacy plaintext secret', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await seedUser('login-legacy@test.com', { mfaSecret: secret.base32, isMfaEnabled: true });

      const loginRes = await login(user.email).expect(201);
      expect(loginRes.body.mfaRequired).toBe(true);

      const verifyLoginRes = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: loginRes.body.userId, token: totp(secret.base32) })
        .expect(201);

      expect(verifyLoginRes.body.accessToken).toBeDefined();
    });

    it('rejects an invalid TOTP token and does not enable MFA', async () => {
      const { user } = await seedUser('verify-invalid@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: '000000' });

      expect(res.status).toBe(400);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(false);
      expect(dbUser?.mfaSecret).toMatch(/^enc:v1:/);
      expect(dbUser?.mfaSecret).not.toContain(enrollRes.body.secret);
    });
  });

  describe('MFA lifecycle determinism', () => {
    it('returns 409 when enrolling while MFA is already enabled', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await seedUser('lifecycle-enabled-enroll@test.com', { mfaSecret: secret.base32, isMfaEnabled: true });
      const token = await mfaAccessToken(user.email, secret.base32);

      const res = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.mfaSecret).toBe(secret.base32);
      expect(dbUser?.isMfaEnabled).toBe(true);
    });

    it('returns 409 when verifying an already-enabled MFA', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await seedUser('lifecycle-enabled-verify@test.com', { mfaSecret: secret.base32, isMfaEnabled: true });
      const token = await mfaAccessToken(user.email, secret.base32);

      const res = await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: totp(secret.base32) });
      expect(res.status).toBe(409);
    });

    it('returns 400 when verifying with no enrollment', async () => {
      const { user } = await seedUser('lifecycle-no-enroll@test.com');
      const token = await accessToken(user.email);

      const res = await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: '000000' });
      expect(res.status).toBe(400);
    });
  });

  describe('Fail-closed crypto behavior', () => {
    it('fails closed when the stored secret cannot be decrypted', async () => {
      const { user } = await seedUser('failclosed-verify@test.com', { mfaSecret: 'enc:v1:AAAA-not-an-envelope' });
      const token = await accessToken(user.email);

      const res = await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: '000000' });
      expect(res.status).toBe(500);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(false);
      expect(dbUser?.mfaSecret).toBe('enc:v1:AAAA-not-an-envelope');
    });

    it('denies the login challenge when the stored secret cannot be decrypted', async () => {
      const { user } = await seedUser('failclosed-login@test.com', {
        mfaSecret: 'enc:v1:AAAA-not-an-envelope',
        isMfaEnabled: true,
      });

      const loginRes = await login(user.email).expect(201);
      expect(loginRes.body.mfaRequired).toBe(true);

      const verifyLoginRes = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: loginRes.body.userId, token: '000000' });
      expect(verifyLoginRes.status).toBe(500);
      expect(verifyLoginRes.body.accessToken).toBeUndefined();
      expect(verifyLoginRes.body.refreshToken).toBeUndefined();
    });
  });

  describe('Structured security events', () => {
    it('emits mfa_enrollment_started on enroll', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const { user } = await seedUser('event-enroll@test.com');
      const token = await accessToken(user.email);

      await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(logSpy.mock.calls.some((call) => JSON.stringify(call).includes('mfa_enrollment_started'))).toBe(true);
      logSpy.mockRestore();
    });

    it('emits mfa_enabled after a successful verification', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const { user } = await seedUser('event-enabled@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: totp(enrollRes.body.secret) })
        .expect(201);

      expect(logSpy.mock.calls.some((call) => JSON.stringify(call).includes('mfa_enabled'))).toBe(true);
      logSpy.mockRestore();
    });

    it('emits mfa_verification_failed on an invalid token', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const { user } = await seedUser('event-failed@test.com');
      const token = await accessToken(user.email);

      const enrollRes = await request(app.getHttpServer())
        .post('/mfa/enroll')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: '000000' })
        .expect(400);

      expect(warnSpy.mock.calls.some((call) => JSON.stringify(call).includes('mfa_verification_failed'))).toBe(true);
      warnSpy.mockRestore();
    });
  });
});

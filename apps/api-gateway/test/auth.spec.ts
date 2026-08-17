import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as speakeasy from 'speakeasy';
import { hashRefreshToken } from '../src/auth/refresh-token.util';

const JWT_SECRET = process.env.JWT_SECRET || '';

describe('Authentication & Session Recovery', () => {
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
  });

  async function createUser(email: string, role = 'Owner', mfaEnabled = false) {
    const org = await prisma.organization.create({
      data: { name: `Test Org ${email}`, slug: email.replace(/[^a-z0-9]/g, '-') },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: 'Test User',
        orgId: org.id,
        role,
        isMfaEnabled: mfaEnabled,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role } });
    return { org, user };
  }

  describe('Login without MFA', () => {
    it('succeeds with valid credentials', async () => {
      await createUser('login-test@test.com');
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login-test@test.com', password: 'password123' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('login-test@test.com');
    });

    it('rejects invalid password', async () => {
      await createUser('login-wrong@test.com');
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login-wrong@test.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('rejects nonexistent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('Login with MFA enabled', () => {
    it('returns mfaRequired when MFA is enabled', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await createUser('mfa-login@test.com', 'Owner', true);
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaSecret: secret.base32 },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'mfa-login@test.com', password: 'password123' })
        .expect(201);

      expect(res.body.mfaRequired).toBe(true);
      expect(res.body.userId).toBeDefined();
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('completes auth with correct MFA code', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await createUser('mfa-complete@test.com', 'Owner', true);
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaSecret: secret.base32 },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'mfa-complete@test.com', password: 'password123' })
        .expect(201);

      const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

      const verifyRes = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: loginRes.body.userId, token })
        .expect(201);

      expect(verifyRes.body.accessToken).toBeDefined();
      expect(verifyRes.body.refreshToken).toBeDefined();
      expect(verifyRes.body.user.email).toBe('mfa-complete@test.com');
    });

    it('rejects incorrect MFA code', async () => {
      const secret = speakeasy.generateSecret({ name: 'TechFusion AI Test' });
      const { user } = await createUser('mfa-wrong@test.com', 'Owner', true);
      await prisma.user.update({
        where: { id: user.id },
        data: { mfaSecret: secret.base32 },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'mfa-wrong@test.com', password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: loginRes.body.userId, token: '000000' })
        .expect(401);
    });
  });

  describe('Refresh token rotation', () => {
    it('rotates refresh token and invalidates old', async () => {
      await createUser('refresh-rotate@test.com');
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'refresh-rotate@test.com', password: 'password123' })
        .expect(201);

      const oldRefreshToken = loginRes.body.refreshToken;

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(201);

      expect(refreshRes.body.accessToken).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(oldRefreshToken);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('rejects revoked refresh token', async () => {
      await createUser('refresh-revoke@test.com');
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'refresh-revoke@test.com', password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
    });

    it('rejects expired refresh token', async () => {
      await createUser('refresh-expired@test.com');
      const user = await prisma.user.findUnique({ where: { email: 'refresh-expired@test.com' } });
      const expiredToken = 'expired-' + Math.random().toString(36);
      await prisma.refreshToken.create({
        data: {
          token: hashRefreshToken(expiredToken),
          sessionId: 'session-expired-test',
          userId: user!.id,
          orgId: user!.orgId,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);
    });
  });

  describe('Logout', () => {
    it('revokes all active refresh tokens', async () => {
      await createUser('logout-revoke@test.com');
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'logout-revoke@test.com', password: 'password123' })
        .expect(201);

      const accessToken = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
    });
  });

  describe('Signup', () => {
    it('creates user and returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'signup-test@test.com',
          password: 'password123',
          displayName: 'Signup User',
          orgName: 'Signup Org',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('signup-test@test.com');
      expect(res.body.user.role).toBe('Owner');
    });

    it('rejects duplicate email', async () => {
      await createUser('dup@test.com');
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'dup@test.com',
          password: 'password123',
          displayName: 'Dup User',
          orgName: 'Dup Org',
        })
        .expect(409);
    });
  });
});

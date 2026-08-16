import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import {
  hashRefreshToken,
  REFRESH_TOKEN_VERIFIER_PREFIX,
  isRefreshVerifier,
} from '../src/auth/refresh-token.util';

const JWT_SECRET = process.env.JWT_SECRET || '';

interface DecodedToken {
  sub: string;
  orgId: string;
  role: Role;
  sid?: string;
  exp?: number;
}

describe('ACC-SEC-02D2A Session Identity & Refresh Token Hardening', () => {
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
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

  async function createOrg(slug: string) {
    return prisma.organization.create({ data: { name: slug, slug } });
  }

  async function createUser(email: string, orgId: string, membershipRole: Role = 'Owner') {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: email,
        orgId,
        role: membershipRole,
      },
    });
    await prisma.organizationMember.create({
      data: { userId: user.id, orgId, role: membershipRole },
    });
    return user;
  }

  async function login(email: string, userAgent = 'spec-agent/1.0') {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('User-Agent', userAgent)
      .send({ email, password: 'password123' })
      .expect(201);
  }

  function decode(token: string): DecodedToken {
    return jwt.decode(token) as DecodedToken;
  }

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  describe('Session identity (sid) in access tokens', () => {
    it('P1 login mints an access token whose sid equals the stored sessionId', async () => {
      const org = await createOrg('harden-p1');
      const user = await createUser('harden-p1@test.com', org.id);
      const loginRes = await login(user.email);

      const decoded = decode(loginRes.body.accessToken);
      expect(decoded.sid).toBeDefined();

      const row = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(loginRes.body.refreshToken) },
      });
      expect(row).not.toBeNull();
      expect(row!.sessionId).toBe(decoded.sid);
      expect(row!.userId).toBe(user.id);
      expect(row!.orgId).toBe(org.id);
    });

    it('P2 refresh keeps the same sessionId and sid, and the new row shares it', async () => {
      const org = await createOrg('harden-p2');
      const user = await createUser('harden-p2@test.com', org.id);
      const loginRes = await login(user.email);
      const firstSid = decode(loginRes.body.accessToken).sid;

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      const decoded = decode(refreshRes.body.accessToken);
      expect(decoded.sid).toBe(firstSid);

      const oldRow = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(loginRes.body.refreshToken) },
      });
      expect(oldRow!.revokedAt).not.toBeNull();

      const newRow = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(refreshRes.body.refreshToken) },
      });
      expect(newRow).not.toBeNull();
      expect(newRow!.sessionId).toBe(firstSid);
    });

    it('P3 the sid/sessionId survives a multi-hop rotation chain', async () => {
      const org = await createOrg('harden-p3');
      const user = await createUser('harden-p3@test.com', org.id);
      const loginRes = await login(user.email);
      const firstSid = decode(loginRes.body.accessToken).sid;

      let refreshToken = loginRes.body.refreshToken as string;
      for (let hop = 0; hop < 3; hop++) {
        const res = await request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken })
          .expect(201);
        expect(decode(res.body.accessToken).sid).toBe(firstSid);
        refreshToken = res.body.refreshToken;
      }

      const chainRows = await prisma.refreshToken.findMany({
        where: { sessionId: firstSid },
      });
      expect(chainRows.length).toBe(4);
      for (const row of chainRows) {
        expect(row.sessionId).toBe(firstSid);
      }
    });

    it('P4 two separate logins produce two distinct sessionIds', async () => {
      const org = await createOrg('harden-p4');
      const user = await createUser('harden-p4@test.com', org.id);
      const login1 = await login(user.email);
      const login2 = await login(user.email);

      const sid1 = decode(login1.body.accessToken).sid;
      const sid2 = decode(login2.body.accessToken).sid;
      expect(sid1).toBeDefined();
      expect(sid2).toBeDefined();
      expect(sid1).not.toBe(sid2);

      const rows = await prisma.refreshToken.findMany({ where: { userId: user.id, revokedAt: null } });
      expect(rows.length).toBe(2);
      expect(new Set(rows.map((r) => r.sessionId)).size).toBe(2);
    });

    it('P5 sid is a non-secret random UUID, not derived from token material', async () => {
      const org = await createOrg('harden-p5');
      const user = await createUser('harden-p5@test.com', org.id);
      const loginRes = await login(user.email);
      const sid = decode(loginRes.body.accessToken).sid;
      expect(sid).toMatch(UUID_V4);
      expect(loginRes.body.refreshToken).not.toContain(sid as string);
    });

    it('P6 guarded endpoints accept still-valid access tokens minted without sid (pre-stage compatibility)', async () => {
      const org = await createOrg('harden-p6');
      const user = await createUser('harden-p6@test.com', org.id);
      const tokenWithoutSid = jwt.sign(
        { sub: user.id, orgId: org.id, role: 'Owner' },
        JWT_SECRET,
        { expiresIn: '15m' },
      );
      const res = await request(app.getHttpServer())
        .get('/mfa/status')
        .set('Authorization', `Bearer ${tokenWithoutSid}`)
        .expect(200);
      expect(res.body).toBeDefined();
    });
  });

  describe('Verifier-only storage', () => {
    it('P7 login never stores the raw refresh token, only a rt:v1 verifier', async () => {
      const org = await createOrg('harden-p7');
      const user = await createUser('harden-p7@test.com', org.id);
      const loginRes = await login(user.email);

      expect(
        await prisma.refreshToken.findUnique({ where: { token: loginRes.body.refreshToken } }),
      ).toBeNull();

      const row = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(loginRes.body.refreshToken) },
      });
      expect(row).not.toBeNull();
      expect(row!.token.startsWith(REFRESH_TOKEN_VERIFIER_PREFIX)).toBe(true);
      expect(row!.token).toMatch(/^rt:v1:[0-9a-f]{64}$/);
      expect(isRefreshVerifier(row!.token)).toBe(true);
    });

    it('P8 rotation stores the new verifier and the new raw token is never persisted', async () => {
      const org = await createOrg('harden-p8');
      const user = await createUser('harden-p8@test.com', org.id);
      const loginRes = await login(user.email);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      expect(
        await prisma.refreshToken.findUnique({ where: { token: refreshRes.body.refreshToken } }),
      ).toBeNull();

      const newRow = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(refreshRes.body.refreshToken) },
      });
      expect(newRow).not.toBeNull();
      expect(newRow!.revokedAt).toBeNull();
    });

    it('P9 refresh resolves the presented raw token through its verifier', async () => {
      const org = await createOrg('harden-p9');
      const user = await createUser('harden-p9@test.com', org.id);
      const loginRes = await login(user.email);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);
      expect(res.body.accessToken).toBeDefined();
    });

    it('P10 garbage tokens are rejected through the verifier path', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'definitely-not-a-real-token' })
        .expect(401);
      expect(res.body).toBeDefined();
    });
  });

  describe('Legacy plaintext compatibility and upgrade', () => {
    it('P11 a legacy plaintext row still refreshes through the exact-lookup path', async () => {
      const org = await createOrg('harden-p11');
      const user = await createUser('harden-p11@test.com', org.id);
      const legacyToken = 'legacy-' + cryptoRandomHex(48);
      await prisma.refreshToken.create({
        data: {
          token: legacyToken,
          sessionId: 'legacy-session-p11',
          userId: user.id,
          orgId: org.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: legacyToken })
        .expect(201);
      expect(decode(res.body.accessToken).sid).toBe('legacy-session-p11');
    });

    it('P12 the legacy row is upgraded to verifier-only storage on refresh', async () => {
      const org = await createOrg('harden-p12');
      const user = await createUser('harden-p12@test.com', org.id);
      const legacyToken = 'legacy-' + cryptoRandomHex(48);
      await prisma.refreshToken.create({
        data: {
          token: legacyToken,
          sessionId: 'legacy-session-p12',
          userId: user.id,
          orgId: org.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: legacyToken })
        .expect(201);

      const oldRow = await prisma.refreshToken.findUnique({ where: { token: legacyToken } });
      expect(oldRow).toBeNull();
      const oldRowVerifier = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(legacyToken) },
      });
      expect(oldRowVerifier!.revokedAt).not.toBeNull();

      const newRow = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(res.body.refreshToken) },
      });
      expect(newRow).not.toBeNull();
      expect(newRow!.sessionId).toBe('legacy-session-p12');
      expect(isRefreshVerifier(newRow!.token)).toBe(true);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: legacyToken })
        .expect(401);
    });

    it('P13 revoked or expired legacy rows are rejected through the legacy path', async () => {
      const org = await createOrg('harden-p13');
      const user = await createUser('harden-p13@test.com', org.id);

      const revokedLegacy = 'legacy-revoked-' + cryptoRandomHex(48);
      const expiredLegacy = 'legacy-expired-' + cryptoRandomHex(48);
      await prisma.refreshToken.create({
        data: {
          token: revokedLegacy,
          sessionId: 'legacy-session-p13a',
          userId: user.id,
          orgId: org.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: new Date(),
        },
      });
      await prisma.refreshToken.create({
        data: {
          token: expiredLegacy,
          sessionId: 'legacy-session-p13b',
          userId: user.id,
          orgId: org.id,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: revokedLegacy })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: expiredLegacy })
        .expect(401);
    });
  });

  describe('Server-observed session metadata', () => {
    it('P14 login records lastUsedAt, server-observed ipAddress and userAgent', async () => {
      const org = await createOrg('harden-p14');
      const user = await createUser('harden-p14@test.com', org.id);
      const loginRes = await login(user.email, 'harden-ua/14');

      const row = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(loginRes.body.refreshToken) },
      });
      expect(row!.lastUsedAt).not.toBeNull();
      expect(row!.lastUsedAt!.getTime()).toBeLessThanOrEqual(Date.now());
      expect(row!.ipAddress).toBeDefined();
      expect(row!.ipAddress!.length).toBeGreaterThan(0);
      expect(row!.ipAddress!.length).toBeLessThanOrEqual(45);
      expect(row!.userAgent).toBe('harden-ua/14');
    });

    it('P15 refresh updates lastUsedAt/userAgent and preserves the first-seen ipAddress', async () => {
      const org = await createOrg('harden-p15');
      const user = await createUser('harden-p15@test.com', org.id);
      const loginRes = await login(user.email, 'harden-ua/15a');

      const loginRow = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(loginRes.body.refreshToken) },
      });
      const firstIp = loginRow!.ipAddress;

      const before = loginRow!.lastUsedAt!.getTime();
      await new Promise((r) => setTimeout(r, 25));

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('User-Agent', 'harden-ua/15b')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      const newRow = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(refreshRes.body.refreshToken) },
      });
      expect(newRow!.lastUsedAt!.getTime()).toBeGreaterThan(before);
      expect(newRow!.userAgent).toBe('harden-ua/15b');
      expect(newRow!.ipAddress).toBe(firstIp);
    });

    it('P16 a client cannot inject metadata through the request body', async () => {
      const org = await createOrg('harden-p16');
      await createUser('harden-p16@test.com', org.id);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .set('User-Agent', 'harden-ua/16')
        .send({
          email: 'harden-p16@test.com',
          password: 'password123',
          deviceName: 'ATTACKER-DEVICE',
          ipAddress: '9.9.9.9',
          userAgent: 'ATTACKER-UA',
          sessionId: 'ATTACKER-SESSION',
        })
        .expect(201);

      const row = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(loginRes.body.refreshToken) },
      });
      expect(row!.deviceName).toBeNull();
      expect(row!.userAgent).toBe('harden-ua/16');
      expect(row!.ipAddress).not.toBe('9.9.9.9');
      expect(row!.sessionId).not.toBe('ATTACKER-SESSION');
      expect(row!.sessionId).toMatch(UUID_V4);
    });
  });

  describe('Revocation, rotation and session-scoped lifecycle', () => {
    it('P17 a used token cannot be replayed (CAS single-use rotation)', async () => {
      const org = await createOrg('harden-p17');
      const user = await createUser('harden-p17@test.com', org.id);
      const loginRes = await login(user.email);
      const sid = decode(loginRes.body.accessToken).sid;

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);

      const active = await prisma.refreshToken.findMany({
        where: { sessionId: sid, revokedAt: null },
      });
      expect(active.length).toBe(1);
      expect(active[0].token).toBe(hashRefreshToken(refreshRes.body.refreshToken));
    });

    it('P18 logout revokes every row of the session chain, historical and active', async () => {
      const org = await createOrg('harden-p18');
      const user = await createUser('harden-p18@test.com', org.id);
      const loginRes = await login(user.email);
      const sid = decode(loginRes.body.accessToken).sid;

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${refreshRes.body.accessToken}`)
        .expect(201);

      const chain = await prisma.refreshToken.findMany({ where: { sessionId: sid } });
      expect(chain.length).toBe(2);
      for (const row of chain) {
        expect(row.revokedAt).not.toBeNull();
      }

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshRes.body.refreshToken })
        .expect(401);
    });

    it('P18b logout-all revokes two independent login chains of the same user; sessionId must not scope logout to the current session', async () => {
      const org = await createOrg('harden-p18b');
      const user = await createUser('harden-p18b@test.com', org.id);

      const loginA = await login(user.email);
      const loginB = await login(user.email);
      const sidA = decode(loginA.body.accessToken).sid;
      const sidB = decode(loginB.body.accessToken).sid;
      expect(sidA).toBeDefined();
      expect(sidB).toBeDefined();
      expect(sidA).not.toBe(sidB);

      const refreshA = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginA.body.refreshToken })
        .expect(201);
      const refreshB = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginB.body.refreshToken })
        .expect(201);
      expect(decode(refreshA.body.accessToken).sid).toBe(sidA);
      expect(decode(refreshB.body.accessToken).sid).toBe(sidB);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${refreshA.body.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshA.body.refreshToken })
        .expect(401);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: refreshB.body.refreshToken })
        .expect(401);

      const chainA = await prisma.refreshToken.findMany({ where: { sessionId: sidA } });
      const chainB = await prisma.refreshToken.findMany({ where: { sessionId: sidB } });
      expect(chainA.length).toBe(2);
      expect(chainB.length).toBe(2);
      for (const row of [...chainA, ...chainB]) {
        expect(row.revokedAt).not.toBeNull();
      }
      expect(
        await prisma.refreshToken.findMany({ where: { userId: user.id, revokedAt: null } }),
      ).toEqual([]);
    });

    it('P19 membership removal still rejects refresh and revokes the presented token', async () => {
      const org = await createOrg('harden-p19');
      const user = await createUser('harden-p19@test.com', org.id);
      const loginRes = await login(user.email);

      await prisma.organizationMember.delete({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);

      const row = await prisma.refreshToken.findUnique({
        where: { token: hashRefreshToken(loginRes.body.refreshToken) },
      });
      expect(row?.revokedAt).not.toBeNull();
    });

    it('P20 org switch mints a distinct session bound to the new org; refresh stays within it', async () => {
      const orgA = await createOrg('harden-p20a');
      const orgB = await createOrg('harden-p20b');
      const user = await createUser('harden-p20@test.com', orgA.id);
      await prisma.organizationMember.create({
        data: { userId: user.id, orgId: orgB.id, role: 'Viewer' },
      });
      const loginRes = await login(user.email);
      const loginSid = decode(loginRes.body.accessToken).sid;
      expect(decode(loginRes.body.accessToken).orgId).toBe(orgA.id);

      const switchRes = await request(app.getHttpServer())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(201);
      const switchSid = decode(switchRes.body.accessToken).sid;
      expect(switchSid).toBeDefined();
      expect(switchSid).not.toBe(loginSid);
      expect(decode(switchRes.body.accessToken).orgId).toBe(orgB.id);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: switchRes.body.refreshToken })
        .expect(201);
      expect(decode(refreshRes.body.accessToken).sid).toBe(switchSid);
      expect(decode(refreshRes.body.accessToken).orgId).toBe(orgB.id);
      expect(decode(refreshRes.body.accessToken).role).toBe('Viewer');
    });
  });
});

function cryptoRandomHex(bytes: number): string {
  const { randomBytes } = require('crypto') as typeof import('crypto');
  return randomBytes(bytes).toString('hex');
}

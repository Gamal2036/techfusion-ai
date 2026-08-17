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
import { hashRefreshToken } from '../src/auth/refresh-token.util';

const JWT_SECRET = process.env.JWT_SECRET || '';

interface DecodedToken {
  sub: string;
  orgId: string;
  role: Role;
  sid?: string;
}

describe('ACC-SEC-02D2B Password & Active Session Management', () => {
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

  // ─── Change Password ───────────────────────────────────────────────

  describe('Change Password', () => {
    it('P1 correct current password changes password and returns new tokens', async () => {
      const org = await createOrg('cp-p1');
      const user = await createUser('cp-p1@test.com', org.id);
      const loginRes = await login(user.email);
      const accessToken = loginRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
        .expect(200);

      expect(res.body.message).toBeDefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const newLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'newpassword456' })
        .expect(201);
      expect(newLogin.body.accessToken).toBeDefined();
    });

    it('P2 incorrect current password returns 401 without account enumeration', async () => {
      const org = await createOrg('cp-p2');
      const user = await createUser('cp-p2@test.com', org.id);
      const loginRes = await login(user.email);

      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' })
        .expect(401);

      expect(res.body.message).toBe('Current password is incorrect');
    });

    it('P3 new password shorter than 8 chars returns 400 validation error', async () => {
      const org = await createOrg('cp-p3');
      const user = await createUser('cp-p3@test.com', org.id);
      const loginRes = await login(user.email);

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ currentPassword: 'password123', newPassword: 'short' })
        .expect(400);
    });

    it('P4 all other sessions are revoked after password change', async () => {
      const org = await createOrg('cp-p4');
      const user = await createUser('cp-p4@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');
      const sidA = decode(loginA.body.accessToken).sid;
      const sidB = decode(loginB.body.accessToken).sid;

      const res = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: user.id, revokedAt: null },
      });
      expect(activeTokens.length).toBe(1);
      const newSid = decode(res.body.accessToken).sid;
      expect(activeTokens[0].sessionId).toBe(newSid);
      expect(activeTokens[0].sessionId).not.toBe(sidA);
      expect(activeTokens[0].sessionId).not.toBe(sidB);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginA.body.refreshToken })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginB.body.refreshToken })
        .expect(401);
    });

    it('P5 unauthenticated request returns 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/change-password')
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
        .expect(401);
    });

    it('P6 old password no longer works after change', async () => {
      const org = await createOrg('cp-p6');
      const user = await createUser('cp-p6@test.com', org.id);
      const loginRes = await login(user.email);

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: 'password123' })
        .expect(401);
    });

    it('P7 new tokens after change are functional', async () => {
      const org = await createOrg('cp-p7');
      const user = await createUser('cp-p7@test.com', org.id);
      const loginRes = await login(user.email);

      const changeRes = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
        .expect(200);

      const decoded = decode(changeRes.body.accessToken);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.orgId).toBe(org.id);
      expect(decoded.sid).toBeDefined();

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: changeRes.body.refreshToken })
        .expect(201);
      expect(refreshRes.body.accessToken).toBeDefined();
    });
  });

  // ─── Session Listing ───────────────────────────────────────────────

  describe('Session Listing', () => {
    it('P11 returns active sessions with correct shape', async () => {
      const org = await createOrg('sl-p11');
      const user = await createUser('sl-p11@test.com', org.id);
      const loginRes = await login(user.email);

      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(res.body.sessions).toBeDefined();
      expect(Array.isArray(res.body.sessions)).toBe(true);
      expect(res.body.sessions.length).toBe(1);

      const session = res.body.sessions[0];
      expect(session.sessionId).toBeDefined();
      expect(typeof session.sessionId).toBe('string');
      expect(session.createdAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
      expect(session.current).toBe(true);
      expect(session.token).toBeUndefined();
      expect(session.refreshToken).toBeUndefined();
      expect(session.passwordHash).toBeUndefined();
    });

    it('P12 only returns sessions belonging to the authenticated user', async () => {
      const org = await createOrg('sl-p12');
      const userA = await createUser('sl-p12a@test.com', org.id);
      const userB = await createUser('sl-p12b@test.com', org.id);

      const loginA = await login(userA.email, 'device-a');
      const loginB = await login(userB.email, 'device-b');

      const resA = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      expect(resA.body.sessions.length).toBe(1);
      expect(resA.body.sessions[0].current).toBe(true);

      const resB = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginB.body.accessToken}`)
        .expect(200);

      expect(resB.body.sessions.length).toBe(1);
    });

    it('P13 current session is correctly identified by sid', async () => {
      const org = await createOrg('sl-p13');
      const user = await createUser('sl-p13@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');
      const sidA = decode(loginA.body.accessToken).sid;

      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      expect(res.body.sessions.length).toBe(2);
      const currentSession = res.body.sessions.find((s: any) => s.current === true);
      const otherSession = res.body.sessions.find((s: any) => s.current === false);
      expect(currentSession).toBeDefined();
      expect(currentSession.sessionId).toBe(sidA);
      expect(otherSession).toBeDefined();
    });

    it('P14 returns truthful metadata (lastUsedAt, ipAddress, userAgent)', async () => {
      const org = await createOrg('sl-p14');
      const user = await createUser('sl-p14@test.com', org.id);
      const loginRes = await login(user.email, 'test-browser/1.0');

      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      const session = res.body.sessions[0];
      expect(session.lastUsedAt).toBeDefined();
      expect(session.userAgent).toBe('test-browser/1.0');
    });

    it('P15 revoked sessions are not listed', async () => {
      const org = await createOrg('sl-p15');
      const user = await createUser('sl-p15@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${decode(loginB.body.accessToken).sid}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      expect(res.body.sessions.length).toBe(1);
    });

    it('P16 unauthenticated request returns 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/sessions')
        .expect(401);
    });
  });

  // ─── Revoke One Session ────────────────────────────────────────────

  describe('Revoke One Session', () => {
    it('P17 revokes a specific non-current session', async () => {
      const org = await createOrg('ro-p17');
      const user = await createUser('ro-p17@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');
      const sidB = decode(loginB.body.accessToken).sid;

      const res = await request(app.getHttpServer())
        .delete(`/auth/sessions/${sidB}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      expect(res.body.message).toBeDefined();

      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: user.id, sessionId: sidB, revokedAt: null },
      });
      expect(activeTokens.length).toBe(0);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginB.body.refreshToken })
        .expect(401);
    });

    it('P18 revoking nonexistent session returns 404', async () => {
      const org = await createOrg('ro-p18');
      const user = await createUser('ro-p18@test.com', org.id);
      const loginRes = await login(user.email);

      await request(app.getHttpServer())
        .delete('/auth/sessions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(404);
    });

    it('P19 revoking another user\'s session returns 404', async () => {
      const org = await createOrg('ro-p19');
      const userA = await createUser('ro-p19a@test.com', org.id);
      const userB = await createUser('ro-p19b@test.com', org.id);

      const loginA = await login(userA.email, 'device-a');
      const loginB = await login(userB.email, 'device-b');
      const sidB = decode(loginB.body.accessToken).sid;

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${sidB}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(404);
    });

    it('P20 revoking an already-revoked session is idempotent (200)', async () => {
      const org = await createOrg('ro-p20');
      const user = await createUser('ro-p20@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');
      const sidB = decode(loginB.body.accessToken).sid;

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${sidB}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${sidB}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);
    });

    it('P21 refresh after session revocation fails', async () => {
      const org = await createOrg('ro-p21');
      const user = await createUser('ro-p21@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');
      const sidB = decode(loginB.body.accessToken).sid;

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${sidB}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginB.body.refreshToken })
        .expect(401);
    });
  });

  // ─── Revoke Other Sessions ─────────────────────────────────────────

  describe('Revoke Other Sessions', () => {
    it('P22 revokes all sessions except the current one', async () => {
      const org = await createOrg('roo-p22');
      const user = await createUser('roo-p22@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');
      const loginC = await login(user.email, 'device-c');
      const sidA = decode(loginA.body.accessToken).sid;

      const res = await request(app.getHttpServer())
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      expect(res.body.revokedCount).toBe(2);

      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: user.id, revokedAt: null },
      });
      const activeSids = new Set(activeTokens.map((t) => t.sessionId));
      expect(activeSids.has(sidA)).toBe(true);
      expect(activeSids.size).toBe(1);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginB.body.refreshToken })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginC.body.refreshToken })
        .expect(401);
    });

    it('P23 when only one session exists, revoke-others revokes nothing', async () => {
      const org = await createOrg('roo-p23');
      const user = await createUser('roo-p23@test.com', org.id);
      const loginA = await login(user.email, 'device-a');

      const res = await request(app.getHttpServer())
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      expect(res.body.revokedCount).toBe(0);

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginA.body.refreshToken })
        .expect(201);
      expect(refreshRes.body.accessToken).toBeDefined();
    });

    it('P24 unauthenticated request returns 401', async () => {
      await request(app.getHttpServer())
        .delete('/auth/sessions')
        .expect(401);
    });
  });

  // ─── Revoke Current Session ────────────────────────────────────────

  describe('Revoke Current Session', () => {
    it('P25 revokes the current session successfully', async () => {
      const org = await createOrg('rc-p25');
      const user = await createUser('rc-p25@test.com', org.id);
      const loginRes = await login(user.email);
      const sid = decode(loginRes.body.accessToken).sid;

      const res = await request(app.getHttpServer())
        .delete('/auth/sessions/current')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(res.body.message).toBeDefined();

      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: user.id, sessionId: sid, revokedAt: null },
      });
      expect(activeTokens.length).toBe(0);
    });

    it('P26 refresh after current session revocation fails', async () => {
      const org = await createOrg('rc-p26');
      const user = await createUser('rc-p26@test.com', org.id);
      const loginRes = await login(user.email);

      await request(app.getHttpServer())
        .delete('/auth/sessions/current')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
    });

    it('P27 when no sid in token, revoke-current returns 400', async () => {
      const org = await createOrg('rc-p27');
      const user = await createUser('rc-p27@test.com', org.id);
      const loginRes = await login(user.email);

      const tokenWithoutSid = jwt.sign(
        { sub: user.id, orgId: org.id, role: 'Owner' },
        JWT_SECRET,
        { expiresIn: '15m' },
      );

      await request(app.getHttpServer())
        .delete('/auth/sessions/current')
        .set('Authorization', `Bearer ${tokenWithoutSid}`)
        .expect(400);
    });
  });

  // ─── Tenant Isolation ──────────────────────────────────────────────

  describe('Tenant Isolation', () => {
    it('P28 cross-tenant session access is denied', async () => {
      const orgA = await createOrg('ti-p28a');
      const orgB = await createOrg('ti-p28b');
      const userA = await createUser('ti-p28a@test.com', orgA.id);
      const userB = await createUser('ti-p28b@test.com', orgB.id);

      const loginA = await login(userA.email, 'device-a');
      const loginB = await login(userB.email, 'device-b');
      const sidB = decode(loginB.body.accessToken).sid;

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${sidB}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(404);

      const activeTokens = await prisma.refreshToken.findMany({
        where: { userId: userB.id, revokedAt: null },
      });
      expect(activeTokens.length).toBeGreaterThan(0);
    });
  });

  // ─── Audit Events ──────────────────────────────────────────────────

  describe('Audit Events', () => {
    it('P29 password change emits structured events and AuditLog', async () => {
      const org = await createOrg('ae-p29');
      const user = await createUser('ae-p29@test.com', org.id);
      const loginRes = await login(user.email);

      await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
        .expect(200);

      const auditRows = await prisma.auditLog.findMany({
        where: { orgId: org.id, action: 'password_changed' },
      });
      expect(auditRows.length).toBe(1);
      expect(auditRows[0].actorId).toBe(user.id);
    });

    it('P30 session revocation emits AuditLog', async () => {
      const org = await createOrg('ae-p30');
      const user = await createUser('ae-p30@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');
      const sidB = decode(loginB.body.accessToken).sid;

      await request(app.getHttpServer())
        .delete(`/auth/sessions/${sidB}`)
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      const auditRows = await prisma.auditLog.findMany({
        where: { orgId: org.id, action: 'session_revoked' },
      });
      expect(auditRows.length).toBe(1);
      expect(auditRows[0].actorId).toBe(user.id);
    });

    it('P31 revoke-others emits AuditLog', async () => {
      const org = await createOrg('ae-p31');
      const user = await createUser('ae-p31@test.com', org.id);

      const loginA = await login(user.email, 'device-a');
      const loginB = await login(user.email, 'device-b');

      await request(app.getHttpServer())
        .delete('/auth/sessions')
        .set('Authorization', `Bearer ${loginA.body.accessToken}`)
        .expect(200);

      const auditRows = await prisma.auditLog.findMany({
        where: { orgId: org.id, action: 'sessions_revoked_others' },
      });
      expect(auditRows.length).toBe(1);
      expect(auditRows[0].actorId).toBe(user.id);
    });
  });

  // ─── Security Properties ───────────────────────────────────────────

  describe('Security Properties', () => {
    it('P32 no password, token, or hash in response body', async () => {
      const org = await createOrg('sp-p32');
      const user = await createUser('sp-p32@test.com', org.id);
      const loginRes = await login(user.email);

      const changeRes = await request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ currentPassword: 'password123', newPassword: 'newpassword456' })
        .expect(200);

      const bodyStr = JSON.stringify(changeRes.body);
      expect(bodyStr).not.toContain('password123');
      expect(bodyStr).not.toContain('newpassword456');
      expect(bodyStr).not.toContain('passwordHash');
      expect(bodyStr).not.toContain('tokenHash');

      const sessionRes = await request(app.getHttpServer())
        .get('/auth/sessions')
        .set('Authorization', `Bearer ${changeRes.body.accessToken}`)
        .expect(200);

      const sessStr = JSON.stringify(sessionRes.body);
      expect(sessStr).not.toContain('rt:v1:');
      expect(sessStr).not.toContain('passwordHash');
    });

    it('P33 rate limiting is applied to change-password', async () => {
      const org = await createOrg('sp-p33');
      const user = await createUser('sp-p33@test.com', org.id);
      const loginRes = await login(user.email);

      let got429 = false;
      for (let i = 0; i < 25; i++) {
        const res = await request(app.getHttpServer())
          .post('/auth/change-password')
          .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
          .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' });
        if (res.status === 429) {
          got429 = true;
          break;
        }
      }
      expect(got429).toBe(true);
    });
  });
});

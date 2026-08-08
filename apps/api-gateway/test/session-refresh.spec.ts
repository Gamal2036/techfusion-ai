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

interface DecodedToken {
  sub: string;
  orgId: string;
  role: Role;
  exp?: number;
}

describe('V1-STAGE-01B-R1 Session Persistence & Token Refresh', () => {
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

  async function createUser(
    email: string,
    orgId: string,
    userRole: Role,
    membershipRole: Role,
  ) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: email,
        orgId,
        role: userRole,
      },
    });
    await prisma.organizationMember.create({
      data: { userId: user.id, orgId, role: membershipRole },
    });
    return user;
  }

  async function login(email: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
  }

  function decode(token: string): DecodedToken {
    return jwt.decode(token) as DecodedToken;
  }

  describe('Access / refresh lifecycle', () => {
    it('refresh returns a fresh access token bound to the same org and user', async () => {
      const org = await createOrg('refresh-bind');
      const user = await createUser('refresh-bind@test.com', org.id, 'Owner', 'Owner');
      const loginRes = await login(user.email);

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(loginRes.body.refreshToken);

      const decoded = decode(res.body.accessToken);
      expect(decoded.sub).toBe(user.id);
      expect(decoded.orgId).toBe(org.id);
      expect(decoded.role).toBe('Owner');
    });

    it('rotation chain: new token refreshes again, old token is dead', async () => {
      const org = await createOrg('refresh-chain');
      const user = await createUser('refresh-chain@test.com', org.id, 'Owner', 'Owner');
      const loginRes = await login(user.email);

      const first = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(201);

      expect(second.body.refreshToken).not.toBe(first.body.refreshToken);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
    });

    it('session survives multiple access-token cycles', async () => {
      const org = await createOrg('refresh-cycles');
      const user = await createUser('refresh-cycles@test.com', org.id, 'Admin', 'Admin');
      const loginRes = await login(user.email);

      let refreshToken = loginRes.body.refreshToken as string;
      let orgId: string | null = null;
      for (let cycle = 0; cycle < 3; cycle++) {
        const res = await request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken })
          .expect(201);

        const decoded = decode(res.body.accessToken);
        expect(decoded.sub).toBe(user.id);
        expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        if (orgId === null) orgId = decoded.orgId;
        expect(decoded.orgId).toBe(orgId);
        expect(decoded.orgId).toBe(org.id);

        refreshToken = res.body.refreshToken;
      }
    });
  });

  describe('Refresh session validation', () => {
    it('role after refresh comes from the current membership, not the old token', async () => {
      const org = await createOrg('refresh-role');
      const user = await createUser('refresh-role@test.com', org.id, 'Owner', 'Owner');
      const loginRes = await login(user.email);
      expect(decode(loginRes.body.accessToken).role).toBe('Owner');

      await prisma.organizationMember.update({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
        data: { role: 'Viewer' },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(201);

      expect(decode(res.body.accessToken).role).toBe('Viewer');
      expect(res.body.user.role).toBe('Viewer');
    });

    it('membership removal rejects refresh and revokes the presented token', async () => {
      const org = await createOrg('refresh-membership');
      const user = await createUser('refresh-membership@test.com', org.id, 'Owner', 'Owner');
      const loginRes = await login(user.email);

      await prisma.organizationMember.delete({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);

      const row = await prisma.refreshToken.findUnique({
        where: { token: loginRes.body.refreshToken },
      });
      expect(row?.revokedAt).not.toBeNull();
    });

    it('deleted user cannot refresh', async () => {
      const org = await createOrg('refresh-deleted-user');
      const user = await createUser('refresh-deleted-user@test.com', org.id, 'Owner', 'Owner');
      const loginRes = await login(user.email);

      await prisma.user.delete({ where: { id: user.id } });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
    });

    it('after switching orgs, refresh stays bound to the active org and role', async () => {
      const orgA = await createOrg('refresh-switch-a');
      const orgB = await createOrg('refresh-switch-b');
      const user = await createUser('refresh-switch@test.com', orgA.id, 'Owner', 'Owner');
      await prisma.organizationMember.create({
        data: { userId: user.id, orgId: orgB.id, role: 'Viewer' },
      });
      const loginRes = await login(user.email);
      expect(decode(loginRes.body.accessToken).orgId).toBe(orgA.id);

      const switchRes = await request(app.getHttpServer())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(201);
      expect(decode(switchRes.body.accessToken).orgId).toBe(orgB.id);

      // Refresh must keep the session in the active org (Org B) with the
      // authoritative membership role, never silently returning to Org A.
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: switchRes.body.refreshToken })
        .expect(201);

      const decoded = decode(refreshRes.body.accessToken);
      expect(decoded.orgId).toBe(orgB.id);
      expect(decoded.role).toBe('Viewer');
      expect(decoded.sub).toBe(user.id);
    });

    it('expired refresh token is rejected', async () => {
      const org = await createOrg('refresh-expired');
      const user = await createUser('refresh-expired@test.com', org.id, 'Owner', 'Owner');
      const expiredToken = 'expired-' + Math.random().toString(36);
      await prisma.refreshToken.create({
        data: {
          token: expiredToken,
          userId: user.id,
          orgId: org.id,
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);
    });

    it('garbage refresh token is rejected', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(401);
    });

    it('explicit logout revokes the session; refresh is then rejected', async () => {
      const org = await createOrg('refresh-logout');
      const user = await createUser('refresh-logout@test.com', org.id, 'Owner', 'Owner');
      const loginRes = await login(user.email);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
    });
  });

  describe('Rotation concurrency', () => {
    it('concurrent refresh of the same token: exactly one succeeds', async () => {
      const org = await createOrg('refresh-race');
      const user = await createUser('refresh-race@test.com', org.id, 'Owner', 'Owner');
      const loginRes = await login(user.email);

      const [a, b] = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken: loginRes.body.refreshToken }),
        request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken: loginRes.body.refreshToken }),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 401]);
    });
  });
});

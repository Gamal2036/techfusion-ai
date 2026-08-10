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
import * as crypto from 'crypto';
import { Role } from '@prisma/client';

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
};

interface DecodedToken {
  sub: string;
  orgId: string;
  role: Role;
}

describe('ORG-01A3 Membership-Authoritative Authorization', () => {
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

  function signToken(userId: string, orgId: string, role: string): string {
    return jwt.sign({ sub: userId, orgId, role }, JWT_SECRET(), { expiresIn: '15m' });
  }

  function decode(token: string): DecodedToken {
    return jwt.decode(token) as DecodedToken;
  }

  const server = () => app.getHttpServer();

  describe('Role resolution at login', () => {
    it('login mints a JWT from the membership role, not the stale User.role snapshot', async () => {
      const org = await createOrg('login-role');
      const user = await createUser('login-role@test.com', org.id, 'Owner', 'Viewer');

      const res = await login(user.email);

      expect(res.body.user.role).toBe('Viewer');
      expect(decode(res.body.accessToken).role).toBe('Viewer');
      expect(decode(res.body.accessToken).orgId).toBe(org.id);
    });

    it('MFA login completes with the membership role, not the stale User.role', async () => {
      const secret = speakeasy.generateSecret({ name: 'ORG-01A3 MFA' });
      const org = await createOrg('mfa-role');
      const user = await prisma.user.create({
        data: {
          email: 'mfa-role@test.com',
          passwordHash: await bcrypt.hash('password123', 4),
          displayName: 'MFA Role',
          orgId: org.id,
          role: 'Owner',
          isMfaEnabled: true,
          mfaSecret: secret.base32,
        },
      });
      await prisma.organizationMember.create({
        data: { userId: user.id, orgId: org.id, role: 'Viewer' },
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'mfa-role@test.com', password: 'password123' })
        .expect(201);
      expect(loginRes.body.mfaRequired).toBe(true);

      const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
      const verifyRes = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: loginRes.body.userId, token })
        .expect(201);

      expect(verifyRes.body.user.role).toBe('Viewer');
      expect(decode(verifyRes.body.accessToken).role).toBe('Viewer');
    });
  });

  describe('Live role enforcement (guard layer)', () => {
    it('role downgrade is reflected immediately without a new token', async () => {
      const org = await createOrg('downgrade');
      const user = await createUser('downgrade@test.com', org.id, 'Owner', 'Owner');
      const token = (await login(user.email)).body.accessToken as string;

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await prisma.organizationMember.update({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
        data: { role: 'Viewer' },
      });

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('role promotion is reflected immediately without a new token', async () => {
      const org = await createOrg('promote');
      const user = await createUser('promote@test.com', org.id, 'Viewer', 'Viewer');
      const token = (await login(user.email)).body.accessToken as string;

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      await prisma.organizationMember.update({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
        data: { role: 'Admin' },
      });

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('an inflated JWT role claim cannot bypass a lower membership role', async () => {
      const org = await createOrg('inflated-role');
      const user = await createUser('inflated-role@test.com', org.id, 'Viewer', 'Viewer');

      // Token claims Owner, but the membership is Viewer: the guard must use the
      // membership role and reject the request.
      const forgedToken = signToken(user.id, org.id, 'Owner');

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${forgedToken}`)
        .expect(403);
    });
  });

  describe('Membership removal (revocation)', () => {
    it('membership removal revokes access immediately at the guard', async () => {
      const org = await createOrg('revoke');
      const user = await createUser('revoke@test.com', org.id, 'Owner', 'Owner');
      const token = (await login(user.email)).body.accessToken as string;

      await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await prisma.organizationMember.delete({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });

      await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('a removed membership cannot be revived by logging in again', async () => {
      const org = await createOrg('no-repair');
      const user = await createUser('no-repair@test.com', org.id, 'Owner', 'Owner');
      await login(user.email);

      await prisma.organizationMember.delete({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-repair@test.com', password: 'password123' })
        .expect(401);
    });

    it('refresh is rejected after membership removal', async () => {
      const org = await createOrg('refresh-revoke');
      const user = await createUser('refresh-revoke@test.com', org.id, 'Owner', 'Owner');
      const refreshToken = (await login(user.email)).body.refreshToken as string;

      await prisma.organizationMember.delete({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('Cross-org token forgery', () => {
    it('a valid JWT for an org without a membership is rejected (tampered org claim)', async () => {
      const orgA = await createOrg('forge-a');
      await createUser('forge@test.com', orgA.id, 'Owner', 'Owner');
      const orgB = await createOrg('forge-b');

      const tampered = signToken('forge@test.com', orgB.id, 'Owner');

      await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });
  });

  describe('Organization switch', () => {
    it('switch binds the new token to the target membership role', async () => {
      const orgA = await createOrg('switch-a');
      const orgB = await createOrg('switch-b');
      const user = await createUser('switch@test.com', orgA.id, 'Owner', 'Owner');
      await prisma.organizationMember.create({
        data: { userId: user.id, orgId: orgB.id, role: 'Viewer' },
      });
      const token = (await login(user.email)).body.accessToken as string;

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const decoded = decode(res.body.accessToken);
      expect(decoded.orgId).toBe(orgB.id);
      expect(decoded.role).toBe('Viewer');
      expect(res.body.user.role).toBe('Viewer');

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(403);
    });
  });

  describe('Admin member-management authority', () => {
    it('role change requires the target to hold a membership in the org', async () => {
      const orgA = await createOrg('admin-mgmt-a');
      const orgB = await createOrg('admin-mgmt-b');
      const owner = await createUser('admin-mgmt@test.com', orgA.id, 'Owner', 'Owner');
      const target = await prisma.user.create({
        data: {
          email: 'other-org@test.com',
          passwordHash: await bcrypt.hash('password123', 4),
          displayName: 'Other Org',
          orgId: orgB.id,
          role: 'Technician',
        },
      });
      await prisma.organizationMember.create({
        data: { userId: target.id, orgId: orgB.id, role: 'Technician' },
      });
      const token = (await login(owner.email)).body.accessToken as string;

      await request(server())
        .post(`/admin/users/${target.id}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(404);
    });

    it('role change updates the membership role and stays reflected at the guard', async () => {
      const org = await createOrg('admin-mgmt-c');
      const owner = await createUser('admin-mgmt-owner@test.com', org.id, 'Owner', 'Owner');
      const tech = await createUser('admin-mgmt-tech@test.com', org.id, 'Technician', 'Technician');

      const token = (await login(owner.email)).body.accessToken as string;
      const techLogin = await login(tech.email);
      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${techLogin.body.accessToken}`)
        .expect(403);

      await request(server())
        .post(`/admin/users/${tech.id}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(201);

      await request(server())
        .get('/admin/users')
        .set('Authorization', `Bearer ${techLogin.body.accessToken}`)
        .expect(200);
    });
  });

  describe('Machine / device auth independence', () => {
    it('device token auth works without any OrganizationMember row', async () => {
      const org = await createOrg('machine-auth');
      const deviceToken = `device-token-${Math.random().toString(36).slice(2)}`;
      await prisma.device.create({
        data: {
          name: 'Machine-A',
          orgId: org.id,
          deviceTokenHash: crypto.createHash('sha256').update(deviceToken).digest('hex'),
        },
      });

      await request(server())
        .post('/devices/metrics')
        .set('Authorization', `Bearer ${deviceToken}`)
        .send({
          cpu: { usage: 42 },
          memory: { total: 16000, used: 8000, percent: 50 },
          uptime: 86400,
        })
        .expect(201);
    });
  });
});

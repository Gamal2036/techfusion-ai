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
}

describe('Organizations API (ORG-01A2)', () => {
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
    role: Role = 'Owner',
    withMembership = true,
  ) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: email,
        orgId,
        role,
      },
    });
    if (withMembership) {
      await prisma.organizationMember.create({ data: { userId: user.id, orgId, role } });
    }
    return user;
  }

  async function login(email: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
  }

  async function accessToken(email: string): Promise<string> {
    const res = await login(email);
    return res.body.accessToken as string;
  }

  function decode(token: string): DecodedToken {
    return jwt.decode(token) as DecodedToken;
  }

  const server = () => app.getHttpServer();

  describe('LIST', () => {
    it('returns exactly the orgs of the authenticated user through memberships', async () => {
      const orgA = await createOrg('list-a');
      const userA = await createUser('list-a@test.com', orgA.id, 'Owner');
      const orgB = await createOrg('list-b');
      await createUser('list-b@test.com', orgB.id, 'Owner');

      const token = await accessToken(userA.email);
      const res = await request(server())
        .get('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(orgA.id);
      expect(res.body[0].isActive).toBe(true);
    });

    it('returns both orgs for a user with two memberships with correct roles and active flag', async () => {
      const orgA = await createOrg('multi-a');
      const orgB = await createOrg('multi-b');
      const user = await createUser('multi@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });

      const token = await accessToken(user.email);
      const res = await request(server())
        .get('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      const a = res.body.find((o: any) => o.id === orgA.id);
      const b = res.body.find((o: any) => o.id === orgB.id);
      expect(a.membershipRole).toBe('Owner');
      expect(a.isActive).toBe(true);
      expect(b.membershipRole).toBe('Viewer');
      expect(b.isActive).toBe(false);
      expect(res.body[0].id).toBe(orgA.id);
    });

    it('does not leak orgs the user has no membership in', async () => {
      const orgA = await createOrg('leak-a');
      const user = await createUser('leak@test.com', orgA.id, 'Owner');
      const orgB = await createOrg('leak-b');
      await prisma.organizationMember.create({
        data: { userId: user.id, orgId: orgB.id, role: 'Viewer' },
      });
      const orgC = await createOrg('leak-c');

      const token = await accessToken(user.email);
      const res = await request(server())
        .get('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.map((o: any) => o.id).sort()).toEqual([orgA.id, orgB.id].sort());
      expect(res.body.map((o: any) => o.id)).not.toContain(orgC.id);
    });

    it('includes useful organization fields', async () => {
      const orgA = await createOrg('fields-a');
      const user = await createUser('fields@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);
      const res = await request(server())
        .get('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body[0]).toEqual(
        expect.objectContaining({
          id: orgA.id,
          name: 'fields-a',
          slug: 'fields-a',
          plan: 'Free',
          membershipRole: 'Owner',
          isActive: true,
        }),
      );
      expect(typeof res.body[0].createdAt).toBe('string');
    });

    it('requires authentication', async () => {
      await request(server()).get('/organizations').expect(401);
    });
  });

  describe('CREATE', () => {
    it('creates an organization with an OWNER membership', async () => {
      const orgA = await createOrg('create-a');
      const user = await createUser('create@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Org' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('New Org');
      expect(res.body.membershipRole).toBe('Owner');
      expect(res.body.isActive).toBe(false);

      const membership = await prisma.organizationMember.findFirst({
        where: { userId: user.id, orgId: res.body.id },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe('Owner');
    });

    it('does not clone fleet data from the current organization', async () => {
      const orgA = await createOrg('fleet-a');
      const user = await createUser('fleet@test.com', orgA.id, 'Owner');
      await prisma.device.create({
        data: {
          orgId: orgA.id,
          name: 'A1',
          deviceTokenHash: 'dev-hash-' + Math.random().toString(36),
        },
      });
      const token = await accessToken(user.email);

      const res = await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Empty Org' })
        .expect(201);

      expect(await prisma.device.count({ where: { orgId: res.body.id } })).toBe(0);
      expect(await prisma.device.count({ where: { orgId: orgA.id } })).toBe(1);
    });

    it('does not auto-switch the active organization', async () => {
      const orgA = await createOrg('noauto-a');
      const user = await createUser('noauto@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Second Org' })
        .expect(201);

      const current = await request(server())
        .get('/organizations/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(current.body.id).toBe(orgA.id);
      expect(current.body.isActive).toBe(true);
      expect(res.body.isActive).toBe(false);
    });

    it('handles slug collisions by deriving a unique slug', async () => {
      const orgA = await createOrg('slug-a');
      const user = await createUser('slug@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      const first = await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Collision Co' })
        .expect(201);
      const second = await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Collision Co' })
        .expect(201);

      const orgs = await prisma.organization.findMany({ where: { name: 'Collision Co' } });
      expect(orgs).toHaveLength(2);
      const slugs = orgs.map((o) => o.slug).sort();
      expect(slugs).toEqual(['collision-co', 'collision-co-2']);
      expect(first.body.id).not.toBe(second.body.id);
    });

    it('rejects invalid names', async () => {
      const orgA = await createOrg('valid-a');
      const user = await createUser('valid@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' })
        .expect(400);

      await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x'.repeat(101) })
        .expect(400);
    });

    it('ignores forbidden fields such as plan and ownerId', async () => {
      const orgA = await createOrg('ignore-a');
      const user = await createUser('ignore@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Plain Org', plan: 'Enterprise', ownerId: 'hacker' })
        .expect(201);

      expect(res.body.plan).toBe('Free');
      const org = await prisma.organization.findUnique({ where: { id: res.body.id } });
      expect(org!.plan).toBe('Free');
    });

    it('requires authentication', async () => {
      await request(server()).post('/organizations').send({ name: 'X' }).expect(401);
    });
  });

  describe('GET one / CURRENT', () => {
    it('returns the active org via current', async () => {
      const orgA = await createOrg('cur-a');
      const user = await createUser('cur@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .get('/organizations/current')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(orgA.id);
      expect(res.body.membershipRole).toBe('Owner');
      expect(res.body.isActive).toBe(true);
    });

    it('returns a single org for a member', async () => {
      const orgA = await createOrg('one-a');
      const user = await createUser('one@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .get(`/organizations/${orgA.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(orgA.id);
      expect(res.body.membershipRole).toBe('Owner');
      expect(res.body.isActive).toBe(true);
    });

    it('denies access to an org without membership', async () => {
      const orgA = await createOrg('g-a');
      const user = await createUser('g@test.com', orgA.id, 'Owner');
      const orgB = await createOrg('g-b');
      const token = await accessToken(user.email);

      await request(server())
        .get(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('RENAME', () => {
    it('allows the Owner to rename and preserves the slug', async () => {
      const orgB = await createOrg('ren-b');
      const user = await createUser('ren@test.com', orgB.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .patch(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed Org' })
        .expect(200);

      expect(res.body.name).toBe('Renamed Org');
      expect(res.body.slug).toBe('ren-b');
      const org = await prisma.organization.findUnique({ where: { id: orgB.id } });
      expect(org!.name).toBe('Renamed Org');
      expect(org!.slug).toBe('ren-b');
    });

    it('denies a Viewer regardless of JWT role from another org', async () => {
      const orgA = await createOrg('ren-a');
      const orgB = await createOrg('ren-b');
      const user = await createUser('renv@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      const token = await accessToken(user.email);

      // JWT role is Owner (active org A), but membership role in B is Viewer.
      await request(server())
        .patch(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hijack' })
        .expect(403);
    });

    it('denies a non-member', async () => {
      const orgA = await createOrg('ren-a');
      const orgB = await createOrg('ren-b');
      const user = await createUser('renn@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      await request(server())
        .patch(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'X' })
        .expect(403);
    });

    it('only renames the target org', async () => {
      const orgA = await createOrg('ren-a');
      const orgB = await createOrg('ren-b');
      const user = await createUser('renu@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Owner' },
        ],
      });
      const token = await accessToken(user.email);

      await request(server())
        .patch(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'B Renamed' })
        .expect(200);

      const a = await prisma.organization.findUnique({ where: { id: orgA.id } });
      expect(a!.name).toBe('ren-a');
      const b = await prisma.organization.findUnique({ where: { id: orgB.id } });
      expect(b!.name).toBe('B Renamed');
    });
  });

  describe('SWITCH', () => {
    it('switches to a member org and issues a fresh JWT with the membership role', async () => {
      const orgA = await createOrg('sw-a');
      const orgB = await createOrg('sw-b');
      const user = await createUser('sw@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Technician' },
        ],
      });
      const token = await accessToken(user.email);

      const res = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const decoded = decode(res.body.accessToken);
      expect(decoded.orgId).toBe(orgB.id);
      expect(decoded.role).toBe('Technician');
      expect(decoded.sub).toBe(user.id);
      expect(res.body.user.orgId).toBe(orgB.id);
      expect(res.body.user.role).toBe('Technician');
    });

    it('denies a non-member', async () => {
      const orgA = await createOrg('sw-a');
      const orgB = await createOrg('sw-b');
      const user = await createUser('swx@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('syncs User.orgId and User.role to the membership', async () => {
      const orgA = await createOrg('sync-a');
      const orgB = await createOrg('sync-b');
      const user = await createUser('sync@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Admin' },
        ],
      });
      const token = await accessToken(user.email);

      await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.orgId).toBe(orgB.id);
      expect(dbUser!.role).toBe('Admin');
    });

    it('does not modify unrelated membership rows', async () => {
      const orgA = await createOrg('swu-a');
      const orgB = await createOrg('swu-b');
      const orgC = await createOrg('swu-c');
      const user = await createUser('swu@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
          { userId: user.id, orgId: orgC.id, role: 'Owner' },
        ],
      });
      const token = await accessToken(user.email);

      await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const aRole = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: orgA.id } },
      });
      const cRole = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: orgC.id } },
      });
      expect(aRole!.role).toBe('Owner');
      expect(cRole!.role).toBe('Owner');
    });

    it('refresh after switch stays on the target org', async () => {
      const orgA = await createOrg('ref-a');
      const orgB = await createOrg('ref-b');
      const user = await createUser('ref@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      const loginRes = await login(user.email);
      const token = loginRes.body.accessToken;

      const switchRes = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const refreshRes = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: switchRes.body.refreshToken })
        .expect(201);

      expect(decode(refreshRes.body.accessToken).orgId).toBe(orgB.id);
      expect(decode(refreshRes.body.accessToken).role).toBe('Viewer');
      expect(refreshRes.body.user.orgId).toBe(orgB.id);
    });

    it('refresh remains on A after switching back to A', async () => {
      const orgA = await createOrg('back-a');
      const orgB = await createOrg('back-b');
      const user = await createUser('back@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      const loginRes = await login(user.email);
      let token = loginRes.body.accessToken;

      const toB = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      token = toB.body.accessToken;

      const backToA = await request(server())
        .post(`/organizations/${orgA.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(decode(backToA.body.accessToken).orgId).toBe(orgA.id);
      expect(decode(backToA.body.accessToken).role).toBe('Owner');

      const refreshRes = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: backToA.body.refreshToken })
        .expect(201);

      expect(decode(refreshRes.body.accessToken).orgId).toBe(orgA.id);
      expect(decode(refreshRes.body.accessToken).role).toBe('Owner');
    });

    it('denies switch after membership is removed and denies refresh for that org', async () => {
      const orgA = await createOrg('rm-a');
      const orgB = await createOrg('rm-b');
      const user = await createUser('rm@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      const loginRes = await login(user.email);
      const token = loginRes.body.accessToken;

      // Switch to B, then revoke the B membership
      const toB = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      const refreshTokenForB = toB.body.refreshToken;

      await prisma.organizationMember.delete({
        where: { userId_orgId: { userId: user.id, orgId: orgB.id } },
      });

      // Switching to B must be denied even with a still-valid prior JWT
      await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      // Refresh while active org (B) has no membership must be denied
      await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenForB })
        .expect(401);
    });
  });

  describe('SIGNUP', () => {
    it('creates a default OWNER OrganizationMember for new users', async () => {
      const res = await request(server())
        .post('/auth/signup')
        .send({
          email: 'orga2-signup@test.com',
          password: 'password123',
          displayName: 'Signup User',
          orgName: 'Signup Org',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.role).toBe('Owner');

      const user = await prisma.user.findUnique({ where: { email: 'orga2-signup@test.com' } });
      expect(user).not.toBeNull();

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user!.id, orgId: user!.orgId } },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe('Owner');
    });
  });

  describe('CROSS-ORG END-TO-END', () => {
    it('switch A -> B -> A preserves tokens, roles, dashboard data and refresh', async () => {
      const orgA = await createOrg('e2e-a');
      const orgB = await createOrg('e2e-b');
      const user = await createUser('e2e@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      await prisma.device.create({
        data: {
          orgId: orgA.id,
          name: 'A1',
          deviceTokenHash: 'dev-a-hash-' + Math.random().toString(36),
        },
      });
      await prisma.device.create({
        data: {
          orgId: orgA.id,
          name: 'A2',
          deviceTokenHash: 'dev-a2-hash-' + Math.random().toString(36),
        },
      });

      let session = await login(user.email);
      let token = session.body.accessToken;

      expect(decode(token).orgId).toBe(orgA.id);
      expect(decode(token).role).toBe('Owner');

      // Dashboard / devices in A
      let devicesA = await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(devicesA.body.map((d: any) => d.name).sort()).toEqual(['A1', 'A2']);

      // Switch -> B
      const toB = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      token = toB.body.accessToken;

      expect(decode(token).orgId).toBe(orgB.id);
      expect(decode(token).role).toBe('Viewer');

      // No A devices visible in B
      const devicesB = await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(devicesB.body).toHaveLength(0);

      // Owner-only action in B denied (JWT role is Viewer)
      await request(server())
        .post('/enrollment/tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'nope' })
        .expect(403);

      // Refresh while in B stays on B
      const refreshB = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: toB.body.refreshToken })
        .expect(201);
      expect(decode(refreshB.body.accessToken).orgId).toBe(orgB.id);
      expect(decode(refreshB.body.accessToken).role).toBe('Viewer');

      // Switch -> A, Owner role restored, devices restored
      const toA = await request(server())
        .post(`/organizations/${orgA.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      token = toA.body.accessToken;

      expect(decode(token).orgId).toBe(orgA.id);
      expect(decode(token).role).toBe('Owner');

      const devicesRestored = await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(devicesRestored.body.map((d: any) => d.name).sort()).toEqual(['A1', 'A2']);

      const refreshA = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: toA.body.refreshToken })
        .expect(201);
      expect(decode(refreshA.body.accessToken).orgId).toBe(orgA.id);
      expect(decode(refreshA.body.accessToken).role).toBe('Owner');
    });
  });

  describe('ENROLLMENT REGRESSION', () => {
    it('enrollment tokens stay bound to their issuing org through switches', async () => {
      const orgA = await createOrg('enr-a');
      const orgB = await createOrg('enr-b');
      const user = await createUser('enr@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Owner' },
        ],
      });

      let token = await accessToken(user.email);

      // Token created while active in A binds to A
      const tokenAres = await request(server())
        .post('/enrollment/tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'A-token', maxUses: 5 })
        .expect(201);
      const enrollmentTokenA = tokenAres.body.token as string;

      // Switch to B; a new token binds to B
      const toB = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      token = toB.body.accessToken;

      const tokenBres = await request(server())
        .post('/enrollment/tokens')
        .set('Authorization', `Bearer ${token}`)
        .send({ label: 'B-token', maxUses: 5 })
        .expect(201);
      const enrollmentTokenB = tokenBres.body.token as string;

      // A device registered with the A token lands in A, never in B
      const deviceViaA = await request(server())
        .post('/devices/register-public')
        .send({
          name: 'Agent-A',
          identityFingerprint: 'fp-a-' + Math.random().toString(36),
          enrollmentToken: enrollmentTokenA,
        })
        .expect(201);

      expect(deviceViaA.body.device.orgId).toBe(orgA.id);

      // A device registered with the B token lands in B
      const deviceViaB = await request(server())
        .post('/devices/register-public')
        .send({
          name: 'Agent-B',
          identityFingerprint: 'fp-b-' + Math.random().toString(36),
          enrollmentToken: enrollmentTokenB,
        })
        .expect(201);

      expect(deviceViaB.body.device.orgId).toBe(orgB.id);

      // The A token cannot place a device in B while the user is active in B
      const deviceViaA2 = await request(server())
        .post('/devices/register-public')
        .send({
          name: 'Agent-A2',
          identityFingerprint: 'fp-a2-' + Math.random().toString(36),
          enrollmentToken: enrollmentTokenA,
        })
        .expect(201);
      expect(deviceViaA2.body.device.orgId).toBe(orgA.id);
    });
  });
});

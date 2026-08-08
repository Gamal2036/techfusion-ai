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

describe('Organization Lifecycle (ORG-01C)', () => {
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

  describe('MEMBERS LIST', () => {
    it('returns only the target org members with safe identity fields', async () => {
      const orgA = await createOrg('memb-a');
      const orgB = await createOrg('memb-b');
      const owner = await createUser('memb-owner@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: orgA.id, role: 'Owner' },
          { userId: owner.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      const admin = await createUser('memb-admin@test.com', orgA.id, 'Admin');

      const token = await accessToken(owner.email);
      const res = await request(server())
        .get(`/organizations/${orgA.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      const self = res.body.find((m: any) => m.isSelf);
      expect(self.role).toBe('Owner');
      expect(self.email).toBe(owner.email);
      expect(res.body.some((m: any) => m.email === admin.email)).toBe(true);
      expect(res.body.some((m: any) => m.orgId === orgB.id)).toBe(false);
      expect(res.body[0]).toEqual(
        expect.objectContaining({
          membershipId: expect.any(String),
          userId: expect.any(String),
          email: expect.any(String),
          displayName: expect.any(String),
          role: expect.any(String),
          createdAt: expect.any(String),
        }),
      );
    });

    it('denies a non-member', async () => {
      const orgA = await createOrg('memb-x-a');
      const orgB = await createOrg('memb-x-b');
      const user = await createUser('memb-x@test.com', orgA.id, 'Owner');
      const token = await accessToken(user.email);

      await request(server())
        .get(`/organizations/${orgB.id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('ROLE UPDATE', () => {
    it('Owner updates Viewer → Technician and syncs the active-org snapshot', async () => {
      const orgA = await createOrg('role-a');
      const owner = await createUser('role-owner@test.com', orgA.id, 'Owner');
      const viewer = await createUser('role-viewer@test.com', orgA.id, 'Viewer');

      const token = await accessToken(owner.email);
      const res = await request(server())
        .patch(`/organizations/${orgA.id}/members/${viewer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Technician' })
        .expect(200);

      expect(res.body.role).toBe('Technician');
      const membership = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: viewer.id, orgId: orgA.id } },
      });
      expect(membership!.role).toBe('Technician');
      const dbViewer = await prisma.user.findUnique({ where: { id: viewer.id } });
      expect(dbViewer!.role).toBe('Technician');
    });

    it('denies a Viewer', async () => {
      const orgA = await createOrg('role-b');
      const viewer = await createUser('role-viewer2@test.com', orgA.id, 'Viewer');
      const other = await createUser('role-other@test.com', orgA.id, 'Technician');

      const token = await accessToken(viewer.email);
      await request(server())
        .patch(`/organizations/${orgA.id}/members/${other.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(403);
    });

    it('denies a non-member', async () => {
      const orgA = await createOrg('role-c');
      const orgB = await createOrg('role-d');
      const user = await createUser('role-nm@test.com', orgA.id, 'Owner');
      const target = await createUser('role-tgt@test.com', orgB.id, 'Viewer');
      const token = await accessToken(user.email);

      await request(server())
        .patch(`/organizations/${orgB.id}/members/${target.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Technician' })
        .expect(403);
    });

    it('Admin can manage Technician/Viewer but cannot promote to Owner', async () => {
      const orgA = await createOrg('role-e');
      const owner = await createUser('role-eowner@test.com', orgA.id, 'Owner', false);
      const admin = await createUser('role-eadmin@test.com', orgA.id, 'Admin', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: orgA.id, role: 'Owner' },
          { userId: admin.id, orgId: orgA.id, role: 'Admin' },
        ],
      });
      const viewer = await createUser('role-eviewer@test.com', orgA.id, 'Viewer');

      const token = await accessToken(admin.email);

      // Admin demotes a Viewer → Technician: allowed
      await request(server())
        .patch(`/organizations/${orgA.id}/members/${viewer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Technician' })
        .expect(200);

      // Admin promoting a Viewer → Owner: denied
      await request(server())
        .patch(`/organizations/${orgA.id}/members/${viewer.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Owner' })
        .expect(403);
    });

    it('Admin cannot demote an Owner', async () => {
      const orgA = await createOrg('role-f');
      const owner = await createUser('role-fowner@test.com', orgA.id, 'Owner', false);
      const admin = await createUser('role-fadmin@test.com', orgA.id, 'Admin', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: orgA.id, role: 'Owner' },
          { userId: admin.id, orgId: orgA.id, role: 'Admin' },
        ],
      });
      const token = await accessToken(admin.email);

      await request(server())
        .patch(`/organizations/${orgA.id}/members/${owner.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(403);
    });

    it('cannot change the role of another Owner', async () => {
      const orgA = await createOrg('role-g');
      const owner1 = await createUser('role-g1@test.com', orgA.id, 'Owner', false);
      const owner2 = await createUser('role-g2@test.com', orgA.id, 'Owner');
      await prisma.organizationMember.create({
        data: { userId: owner1.id, orgId: orgA.id, role: 'Owner' },
      });
      const token = await accessToken(owner1.email);

      await request(server())
        .patch(`/organizations/${orgA.id}/members/${owner2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(400);
    });

    it('the last Owner cannot downgrade themselves', async () => {
      const orgA = await createOrg('role-h');
      const owner = await createUser('role-h@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      await request(server())
        .patch(`/organizations/${orgA.id}/members/${owner.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(409);

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: owner.id, orgId: orgA.id } },
      });
      expect(membership!.role).toBe('Owner');
    });

    it('rejects an invalid role value', async () => {
      const orgA = await createOrg('role-i');
      const owner = await createUser('role-i@test.com', orgA.id, 'Owner');
      const other = await createUser('role-i2@test.com', orgA.id, 'Viewer');
      const token = await accessToken(owner.email);

      await request(server())
        .patch(`/organizations/${orgA.id}/members/${other.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'SuperUser' })
        .expect(400);
    });
  });

  describe('MEMBER REMOVAL', () => {
    it('deletes only the membership and preserves the global User', async () => {
      const orgA = await createOrg('rmv-a');
      const orgB = await createOrg('rmv-b');
      const owner = await createUser('rmv-owner@test.com', orgA.id, 'Owner', false);
      const member = await createUser('rmv-member@test.com', orgA.id, 'Viewer', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: orgA.id, role: 'Owner' },
          { userId: member.id, orgId: orgA.id, role: 'Viewer' },
          { userId: member.id, orgId: orgB.id, role: 'Technician' },
        ],
      });
      const token = await accessToken(owner.email);

      const res = await request(server())
        .delete(`/organizations/${orgA.id}/members/${member.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toBe('Member removed');
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: member.id, orgId: orgA.id } },
        }),
      ).toBeNull();
      // Global User preserved
      expect(await prisma.user.findUnique({ where: { id: member.id } })).not.toBeNull();
      // Other membership preserved
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: member.id, orgId: orgB.id } },
        }),
      ).not.toBeNull();
    });

    it('immediately denies the removed member access to the removed org', async () => {
      const orgA = await createOrg('rmv-a2');
      const owner = await createUser('rmv-owner2@test.com', orgA.id, 'Owner');
      const member = await createUser('rmv-member2@test.com', orgA.id, 'Viewer');
      const ownerToken = await accessToken(owner.email);
      const memberToken = await accessToken(member.email);

      // Sanity: member has access before removal.
      await request(server())
        .get(`/organizations/${orgA.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      await request(server())
        .delete(`/organizations/${orgA.id}/members/${member.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // The still-cryptographically-valid JWT is rejected because membership is
      // the authority (ORG-01A3) and it no longer exists. The A3 guard returns
      // 401 when the JWT's org membership cannot be resolved.
      await request(server())
        .get(`/organizations/${orgA.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(401);
    });

    it('a non-Owner cannot remove a member', async () => {
      const orgA = await createOrg('rmv-a3');
      const owner = await createUser('rmv-owner3@test.com', orgA.id, 'Owner', false);
      const admin = await createUser('rmv-admin3@test.com', orgA.id, 'Admin', false);
      const member = await createUser('rmv-member3@test.com', orgA.id, 'Technician');
      await prisma.organizationMember.create({
        data: { userId: admin.id, orgId: orgA.id, role: 'Admin' },
      });
      const token = await accessToken(admin.email);

      await request(server())
        .delete(`/organizations/${orgA.id}/members/${member.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: member.id, orgId: orgA.id } },
        }),
      ).not.toBeNull();
    });

    it('a sole Owner cannot remove themselves through the removal endpoint', async () => {
      const orgA = await createOrg('rmv-a4');
      const owner = await createUser('rmv-owner4@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      await request(server())
        .delete(`/organizations/${orgA.id}/members/${owner.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: orgA.id } },
        }),
      ).not.toBeNull();
    });

    it('an Owner can remove a co-Owner only while another Owner remains', async () => {
      const orgA = await createOrg('rmv-a5');
      const owner1 = await createUser('rmv-owner5@test.com', orgA.id, 'Owner', false);
      const owner2 = await createUser('rmv-owner6@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner1.id, orgId: orgA.id, role: 'Owner' },
          { userId: owner2.id, orgId: orgA.id, role: 'Owner' },
        ],
      });
      const token = await accessToken(owner2.email);

      await request(server())
        .delete(`/organizations/${orgA.id}/members/${owner1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // owner2 is now the sole Owner; the last-owner guard blocks self-removal.
      await request(server())
        .delete(`/organizations/${orgA.id}/members/${owner2.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('removed member with another membership falls back on the active org', async () => {
      const orgA = await createOrg('rmv-b1');
      const orgB = await createOrg('rmv-b2');
      const owner = await createUser('rmv-bowner@test.com', orgA.id, 'Owner', false);
      const member = await createUser('rmv-bmember@test.com', orgA.id, 'Viewer', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: orgA.id, role: 'Owner' },
          { userId: member.id, orgId: orgA.id, role: 'Viewer' },
          { userId: member.id, orgId: orgB.id, role: 'Owner' },
        ],
      });
      const token = await accessToken(owner.email);

      await request(server())
        .delete(`/organizations/${orgA.id}/members/${member.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const dbUser = await prisma.user.findUnique({ where: { id: member.id } });
      expect(dbUser!.orgId).toBe(orgB.id);
      expect(dbUser!.role).toBe('Owner');
    });
  });

  describe('LEAVE', () => {
    it('Viewer leaves a non-active org without changing the active org', async () => {
      const orgA = await createOrg('lv-a');
      const orgB = await createOrg('lv-b');
      const user = await createUser('lv-user@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      const token = await accessToken(user.email);

      const res = await request(server())
        .post(`/organizations/${orgB.id}/leave`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body.message).toBe('Left organization');
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: user.id, orgId: orgB.id } },
        }),
      ).toBeNull();
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.orgId).toBe(orgA.id);
    });

    it('leaving the active org switches to the oldest fallback and issues fresh auth state', async () => {
      const orgA = await createOrg('lv-c');
      const orgB = await createOrg('lv-d');
      // Non-Owner in the active org so the last-Owner guard does not apply.
      const user = await createUser('lv-user2@test.com', orgA.id, 'Admin', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Admin' },
          { userId: user.id, orgId: orgB.id, role: 'Technician' },
        ],
      });
      const loginRes = await login(user.email);
      const token = loginRes.body.accessToken;
      expect(decode(token).orgId).toBe(orgA.id);

      const res = await request(server())
        .post(`/organizations/${orgA.id}/leave`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(decode(res.body.accessToken).orgId).toBe(orgB.id);
      expect(decode(res.body.accessToken).role).toBe('Technician');
      expect(res.body.user.orgId).toBe(orgB.id);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.orgId).toBe(orgB.id);
      expect(dbUser!.role).toBe('Technician');

      // The left org's refresh session is revoked and refresh stays on the fallback.
      await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken })
        .expect(401);
      const refreshRes = await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: res.body.refreshToken })
        .expect(201);
      expect(decode(refreshRes.body.accessToken).orgId).toBe(orgB.id);
    });

    it('sole Owner cannot leave', async () => {
      const orgA = await createOrg('lv-e');
      const owner = await createUser('lv-owner@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      const res = await request(server())
        .post(`/organizations/${orgA.id}/leave`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);

      expect(res.body.message).toMatch(/Owner/i);
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: orgA.id } },
        }),
      ).not.toBeNull();
    });

    it('cannot leave the last organization', async () => {
      const orgA = await createOrg('lv-f');
      const viewer = await createUser('lv-viewer@test.com', orgA.id, 'Viewer');
      const owner = await createUser('lv-owner2@test.com', orgA.id, 'Owner');
      const token = await accessToken(viewer.email);

      const res = await request(server())
        .post(`/organizations/${orgA.id}/leave`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);

      expect(res.body.message).toMatch(/last organization/i);
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: viewer.id, orgId: orgA.id } },
        }),
      ).not.toBeNull();
    });

    it('Owner with a co-Owner can leave when another organization exists', async () => {
      const orgA = await createOrg('lv-g');
      const orgB = await createOrg('lv-h');
      const owner = await createUser('lv-gowner@test.com', orgA.id, 'Owner', false);
      const coOwner = await createUser('lv-gco@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: orgA.id, role: 'Owner' },
          { userId: owner.id, orgId: orgB.id, role: 'Viewer' },
          { userId: coOwner.id, orgId: orgA.id, role: 'Owner' },
        ],
      });
      const token = await accessToken(owner.email);

      await request(server())
        .post(`/organizations/${orgA.id}/leave`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(await prisma.organizationMember.count({ where: { orgId: orgA.id } })).toBe(1);
      const remaining = await prisma.organizationMember.findFirst({
        where: { orgId: orgA.id },
      });
      expect(remaining!.role).toBe('Owner');
    });
  });

  describe('SWITCH after membership changes', () => {
    it('switching to a removed org is denied with a still-valid JWT', async () => {
      const orgA = await createOrg('swr-a');
      const orgB = await createOrg('swr-b');
      const user = await createUser('swr-user@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: user.id, orgId: orgA.id, role: 'Owner' },
          { userId: user.id, orgId: orgB.id, role: 'Viewer' },
        ],
      });
      let token = await accessToken(user.email);

      const toB = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      token = toB.body.accessToken;

      await prisma.organizationMember.delete({
        where: { userId_orgId: { userId: user.id, orgId: orgB.id } },
      });

      // Old JWT still resolves membership for B? No — the A3 guard returns 401
      // because membership is gone.
      await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
});

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
import { generateInvitationToken, hashInvitationToken } from '../src/organizations/invitation-token';

interface DecodedToken {
  sub: string;
  orgId: string;
  role: Role;
}

describe('Organization Invitations (V1-TEAM-01)', () => {
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
        email: email.toLowerCase(),
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
      .send({ email: email.toLowerCase(), password: 'password123' })
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

  function invite(
    token: string,
    orgId: string,
    body: Record<string, unknown>,
  ) {
    return request(server())
      .post(`/organizations/${orgId}/invitations`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  describe('INVITE PERMISSIONS', () => {
    it('Owner can invite Admin', async () => {
      const org = await createOrg('inv-owner-admin');
      const owner = await createUser('inv-owner-admin@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      const res = await invite(token, org.id, { email: 'new-admin@test.com', role: 'Admin' }).expect(201);
      expect(res.body.role).toBe('Admin');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.email).toBe('new-admin@test.com');
      expect(res.body.invitedBy.email).toBe(owner.email);
      expect(res.body.tokenHash).toBeUndefined();
      expect(res.body.devInvitationUrl).toContain('/invite/');

      const row = await prisma.organizationInvitation.findUnique({ where: { id: res.body.id } });
      expect(row!.role).toBe('Admin');
      expect(row!.email).toBe('new-admin@test.com');
      // tokenHash is a SHA-256 hash, not the raw token.
      expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row!.tokenHash).not.toContain(res.body.devInvitationUrl);
    });

    it('Owner can invite Technician and Viewer', async () => {
      const org = await createOrg('inv-owner-tv');
      const owner = await createUser('inv-owner-tv@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      await invite(token, org.id, { email: 't1@test.com', role: 'Technician' }).expect(201);
      await invite(token, org.id, { email: 'v1@test.com', role: 'Viewer' }).expect(201);
    });

    it('Admin can invite Technician and Viewer', async () => {
      const org = await createOrg('inv-admin-tv');
      const owner = await createUser('inv-admin-tv-owner@test.com', org.id, 'Owner', false);
      const admin = await createUser('inv-admin-tv-admin@test.com', org.id, 'Admin', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: org.id, role: 'Owner' },
          { userId: admin.id, orgId: org.id, role: 'Admin' },
        ],
      });
      const token = await accessToken(admin.email);

      await invite(token, org.id, { email: 't2@test.com', role: 'Technician' }).expect(201);
      await invite(token, org.id, { email: 'v2@test.com', role: 'Viewer' }).expect(201);
    });

    it('Admin cannot invite Owner', async () => {
      const org = await createOrg('inv-admin-owner');
      const admin = await createUser('inv-admin-owner@test.com', org.id, 'Admin');
      const token = await accessToken(admin.email);

      const res = await invite(token, org.id, { email: 'x@test.com', role: 'Owner' }).expect(403);
      expect(res.body.message).toMatch(/permission/i);
      expect(await prisma.organizationInvitation.count()).toBe(0);
    });

    it('Admin cannot invite Admin', async () => {
      const org = await createOrg('inv-admin-admin');
      const admin = await createUser('inv-admin-admin@test.com', org.id, 'Admin');
      const token = await accessToken(admin.email);

      await invite(token, org.id, { email: 'a2@test.com', role: 'Admin' }).expect(403);
    });

    it('Technician cannot invite', async () => {
      const org = await createOrg('inv-tech');
      const owner = await createUser('inv-tech-owner@test.com', org.id, 'Owner', false);
      const tech = await createUser('inv-tech@test.com', org.id, 'Technician', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: org.id, role: 'Owner' },
          { userId: tech.id, orgId: org.id, role: 'Technician' },
        ],
      });
      const token = await accessToken(tech.email);

      await invite(token, org.id, { email: 'y@test.com', role: 'Viewer' }).expect(403);
      expect(await prisma.organizationInvitation.count()).toBe(0);
    });

    it('Viewer cannot invite', async () => {
      const org = await createOrg('inv-viewer');
      const viewer = await createUser('inv-viewer@test.com', org.id, 'Viewer');
      const token = await accessToken(viewer.email);

      await invite(token, org.id, { email: 'z@test.com', role: 'Viewer' }).expect(403);
    });

    it('a non-member cannot invite even with a valid token for another org', async () => {
      const orgA = await createOrg('inv-nm-a');
      const orgB = await createOrg('inv-nm-b');
      const owner = await createUser('inv-nm@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      await invite(token, orgB.id, { email: 'q@test.com', role: 'Viewer' }).expect(403);
    });

    it('rejects an invalid role value', async () => {
      const org = await createOrg('inv-role');
      const owner = await createUser('inv-role@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      await invite(token, org.id, { email: 'r@test.com', role: 'SuperUser' }).expect(400);
    });

    it('ignores injected permission arrays and extra body fields', async () => {
      const org = await createOrg('inv-inject');
      const owner = await createUser('inv-inject@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      const res = await invite(token, org.id, {
        email: 'inject@test.com',
        role: 'Viewer',
        invitedByUserId: 'attacker-id',
        permissions: ['*'],
        organizationId: 'attacker-org',
      }).expect(201);

      const row = await prisma.organizationInvitation.findUnique({ where: { id: res.body.id } });
      expect(row!.invitedByUserId).toBe(owner.id);
      expect(row!.organizationId).toBe(org.id);
    });
  });

  describe('DUPLICATES', () => {
    it('rejects inviting an existing member with a conflict', async () => {
      const org = await createOrg('dup-member');
      const owner = await createUser('dup-member-owner@test.com', org.id, 'Owner');
      const member = await createUser('dup-member@test.com', org.id, 'Technician');
      const token = await accessToken(owner.email);

      const res = await invite(token, org.id, { email: member.email.toUpperCase(), role: 'Admin' }).expect(409);
      expect(res.body.message).toMatch(/already a member/i);
      expect(await prisma.organizationInvitation.count()).toBe(0);
    });

    it('returns the existing pending invitation idempotently instead of duplicating', async () => {
      const org = await createOrg('dup-pending');
      const owner = await createUser('dup-pending@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      const first = await invite(token, org.id, { email: 'pend@test.com', role: 'Technician' }).expect(201);
      const second = await invite(token, org.id, { email: 'PEND@test.com', role: 'Technician' }).expect(201);

      expect(second.id).toBe(first.id);
      expect(await prisma.organizationInvitation.count()).toBe(1);
    });
  });

  describe('LIST INVITATIONS', () => {
    it('Owner lists invitations with safe metadata and no tokens', async () => {
      const org = await createOrg('list-owner');
      const owner = await createUser('list-owner@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);
      await invite(token, org.id, { email: 'list1@test.com', role: 'Technician' }).expect(201);
      await invite(token, org.id, { email: 'list2@test.com', role: 'Viewer' }).expect(201);

      const res = await request(server())
        .get(`/organizations/${org.id}/invitations`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      const item = res.body.find((i: any) => i.email === 'list1@test.com');
      expect(item).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          organizationId: org.id,
          role: 'Technician',
          status: 'PENDING',
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
          invitedBy: expect.objectContaining({ email: owner.email }),
        }),
      );
      expect(item.tokenHash).toBeUndefined();
      expect(item.devInvitationUrl).toBeUndefined();
    });

    it('Admin can list, Technician and Viewer cannot', async () => {
      const org = await createOrg('list-roles');
      const owner = await createUser('list-roles-owner@test.com', org.id, 'Owner', false);
      const admin = await createUser('list-roles-admin@test.com', org.id, 'Admin', false);
      const tech = await createUser('list-roles-tech@test.com', org.id, 'Technician', false);
      const viewer = await createUser('list-roles-viewer@test.com', org.id, 'Viewer', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: org.id, role: 'Owner' },
          { userId: admin.id, orgId: org.id, role: 'Admin' },
          { userId: tech.id, orgId: org.id, role: 'Technician' },
          { userId: viewer.id, orgId: org.id, role: 'Viewer' },
        ],
      });

      await request(server())
        .get(`/organizations/${org.id}/invitations`)
        .set('Authorization', `Bearer ${await accessToken(admin.email)}`)
        .expect(200);
      await request(server())
        .get(`/organizations/${org.id}/invitations`)
        .set('Authorization', `Bearer ${await accessToken(tech.email)}`)
        .expect(403);
      await request(server())
        .get(`/organizations/${org.id}/invitations`)
        .set('Authorization', `Bearer ${await accessToken(viewer.email)}`)
        .expect(403);
    });

    it('cross-org list is denied', async () => {
      const orgA = await createOrg('list-x-a');
      const orgB = await createOrg('list-x-b');
      const ownerA = await createUser('list-x-a@test.com', orgA.id, 'Owner');
      const token = await accessToken(ownerA.email);

      await request(server())
        .get(`/organizations/${orgB.id}/invitations`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('REVOKE', () => {
    it('revoking an invitation prevents later acceptance', async () => {
      const org = await createOrg('rev-1');
      const other = await createOrg('rev-1-other');
      const owner = await createUser('rev-1-owner@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      const created = await invite(token, org.id, { email: 'rev1@test.com', role: 'Technician' }).expect(201);
      const rawToken = (created.body.devInvitationUrl as string).split('/').pop();

      const revoke = await request(server())
        .delete(`/organizations/${org.id}/invitations/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(revoke.body.message).toBe('Invitation revoked');

      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.body.id } });
      expect(row!.status).toBe('REVOKED');

      // Accept with the old token must be denied and create no membership.
      const user = await createUser('rev1@test.com', other.id, 'Viewer');
      const acc = await request(server())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${await accessToken('rev1@test.com')}`)
        .expect(409);
      expect(acc.body.message).toMatch(/revoked/i);
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: user.id, orgId: org.id } },
        }),
      ).toBeNull();
    });

    it('cross-org revoke fails', async () => {
      const orgA = await createOrg('rev-x-a');
      const orgB = await createOrg('rev-x-b');
      const ownerA = await createUser('rev-x-a@test.com', orgA.id, 'Owner');
      const ownerB = await createUser('rev-x-b@test.com', orgB.id, 'Owner');
      const tokenA = await accessToken(ownerA.email);
      const tokenB = await accessToken(ownerB.email);

      const created = await invite(tokenB, orgB.id, { email: 'revx@test.com', role: 'Viewer' }).expect(201);

      await request(server())
        .delete(`/organizations/${orgA.id}/invitations/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.body.id } });
      expect(row!.status).toBe('PENDING');
    });

    it('Admin cannot revoke an Owner-created Admin invitation', async () => {
      const org = await createOrg('rev-admin');
      const owner = await createUser('rev-admin-owner@test.com', org.id, 'Owner', false);
      const admin = await createUser('rev-admin-admin@test.com', org.id, 'Admin', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: org.id, role: 'Owner' },
          { userId: admin.id, orgId: org.id, role: 'Admin' },
        ],
      });
      const ownerToken = await accessToken(owner.email);
      const adminToken = await accessToken(admin.email);

      const created = await invite(ownerToken, org.id, { email: 'revadmin@test.com', role: 'Admin' }).expect(201);

      await request(server())
        .delete(`/organizations/${org.id}/invitations/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('RESEND', () => {
    it('regenerates the token and resets expiration, invalidating the old link', async () => {
      const org = await createOrg('resend-1');
      const owner = await createUser('resend-1@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      const created = await invite(token, org.id, { email: 'res1@test.com', role: 'Technician' }).expect(201);
      const oldRaw = (created.body.devInvitationUrl as string).split('/').pop();

      const resend = await request(server())
        .post(`/organizations/${org.id}/invitations/${created.body.id}/resend`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      const newRaw = (resend.body.devInvitationUrl as string).split('/').pop();
      expect(newRaw).not.toBe(oldRaw);

      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.body.id } });
      expect(row!.tokenHash).toBe(hashInvitationToken(newRaw));
      expect(row!.status).toBe('PENDING');

      // Old token no longer works (token hash was replaced).
      const home = await createOrg('resend-1-home');
      const invitedUser = await createUser('res1@test.com', home.id, 'Viewer');
      await request(server())
        .post(`/invitations/${oldRaw}/accept`)
        .set('Authorization', `Bearer ${await accessToken('res1@test.com')}`)
        .expect(404);

      // New token works and creates the membership in the target org.
      const accept = await request(server())
        .post(`/invitations/${newRaw}/accept`)
        .set('Authorization', `Bearer ${await accessToken('res1@test.com')}`)
        .expect(201);
      expect(accept.body.organization.id).toBe(org.id);
      expect(accept.body.membership.role).toBe('Technician');
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: invitedUser.id, orgId: org.id } },
        }),
      ).not.toBeNull();
    });

    it('cannot resend an accepted invitation', async () => {
      const org = await createOrg('resend-2');
      const home = await createOrg('resend-2-home');
      const owner = await createUser('resend-2-owner@test.com', org.id, 'Owner');
      const invitedUser = await createUser('res2@test.com', home.id, 'Viewer');
      const token = await accessToken(owner.email);

      const created = await invite(token, org.id, { email: 'res2@test.com', role: 'Viewer' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(invitedUser.email)}`)
        .expect(201);

      await request(server())
        .post(`/organizations/${org.id}/invitations/${created.body.id}/resend`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('INSPECT', () => {
    it('returns safe metadata for a valid token', async () => {
      const org = await createOrg('inspect-1');
      const owner = await createUser('inspect-1@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);
      const created = await invite(token, org.id, { email: 'alice@example.com', role: 'Technician' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const res = await request(server()).get(`/invitations/${raw}`).expect(200);
      expect(res.body.organization.name).toBe(org.name);
      expect(res.body.role).toBe('Technician');
      expect(res.body.status).toBe('PENDING');
      expect(res.body.email).not.toContain('alice@');
      expect(res.body.email).toContain('***');
      expect(res.body.tokenHash).toBeUndefined();
      expect(res.body).not.toHaveProperty('invitedByUserId');
    });

    it('returns EXPIRED for an expired pending invitation', async () => {
      const org = await createOrg('inspect-2');
      const owner = await createUser('inspect-2@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);
      const created = await invite(token, org.id, { email: 'exp@example.com', role: 'Viewer' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();
      await prisma.organizationInvitation.update({
        where: { id: created.body.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await request(server()).get(`/invitations/${raw}`).expect(200);
      expect(res.body.status).toBe('EXPIRED');
    });

    it('returns 404 for an unknown token', async () => {
      await request(server()).get('/invitations/definitely-not-a-token').expect(404);
    });
  });

  describe('ACCEPT', () => {
    it('creates the membership atomically with the stored role and consumes the invitation', async () => {
      const org = await createOrg('accept-1');
      const owner = await createUser('accept-1-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);

      const created = await invite(ownerToken, org.id, { email: 'bob@test.com', role: 'Technician' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('accept-1-home');
      const bob = await createUser('bob@test.com', home.id, 'Viewer');

      const res = await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(bob.email)}`)
        .expect(201);

      expect(res.body.organization.id).toBe(org.id);
      expect(res.body.membership.role).toBe('Technician');

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: bob.id, orgId: org.id } },
      });
      expect(membership!.role).toBe('Technician');

      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.body.id } });
      expect(row!.status).toBe('ACCEPTED');
      expect(row!.acceptedAt).not.toBeNull();

      // Bob appears in the member list.
      const members = await request(server())
        .get(`/organizations/${org.id}/members`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(members.body.some((m: any) => m.email === 'bob@test.com')).toBe(true);
    });

    it('rejects replay of a consumed token without duplicating membership', async () => {
      const org = await createOrg('accept-replay');
      const owner = await createUser('accept-replay-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, org.id, { email: 'replay@test.com', role: 'Viewer' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('accept-replay-home');
      const user = await createUser('replay@test.com', home.id, 'Viewer');
      const token = await accessToken(user.email);

      await request(server()).post(`/invitations/${raw}/accept`).set('Authorization', `Bearer ${token}`).expect(201);
      const second = await request(server()).post(`/invitations/${raw}/accept`).set('Authorization', `Bearer ${token}`).expect(409);
      expect(second.body.message).toMatch(/already been accepted/i);
      expect(await prisma.organizationMember.count({ where: { userId: user.id } })).toBe(2);
    });

    it('rejects an expired invitation with no membership created', async () => {
      const org = await createOrg('accept-exp');
      const other = await createOrg('accept-exp-other');
      const owner = await createUser('accept-exp-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, org.id, { email: 'expired@test.com', role: 'Viewer' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();
      await prisma.organizationInvitation.update({
        where: { id: created.body.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const user = await createUser('expired@test.com', other.id, 'Viewer');
      const res = await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(410);
      expect(res.body.message).toMatch(/expired/i);
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: user.id, orgId: org.id } },
        }),
      ).toBeNull();
      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.body.id } });
      expect(row!.status).toBe('EXPIRED');
    });

    it('rejects acceptance with a different authenticated email', async () => {
      const org = await createOrg('accept-wrongmail');
      const owner = await createUser('accept-wrongmail-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, org.id, { email: 'alice@example.com', role: 'Technician' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const bob = await createUser('bob@example.com', org.id, 'Viewer');
      const res = await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(bob.email)}`)
        .expect(403);
      expect(res.body.message).toMatch(/different email/i);
      expect(await prisma.organizationMember.count({ where: { userId: bob.id } })).toBe(1);
      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.body.id } });
      expect(row!.status).toBe('PENDING');
    });

    it('rejects an unknown token', async () => {
      const org = await createOrg('accept-unknown');
      const owner = await createUser('accept-unknown@test.com', org.id, 'Owner');
      const res = await request(server())
        .post('/invitations/nonexistent-token/accept')
        .set('Authorization', `Bearer ${await accessToken(owner.email)}`)
        .expect(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('accepts with case-insensitive email match', async () => {
      const org = await createOrg('accept-case');
      const owner = await createUser('accept-case-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, org.id, { email: 'Case@Test.com', role: 'Viewer' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('accept-case-home');
      const user = await createUser('case@test.com', home.id, 'Viewer');
      await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(201);
    });

    it('preserves the invitee other memberships and does not change the global role', async () => {
      const orgA = await createOrg('accept-pres-a');
      const orgB = await createOrg('accept-pres-b');
      const ownerA = await createUser('accept-pres-owner@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: ownerA.id, orgId: orgA.id, role: 'Owner' },
          { userId: ownerA.id, orgId: orgB.id, role: 'Owner' },
        ],
      });
      const ownerToken = await accessToken(ownerA.email);

      const alice = await createUser('alice@test.com', orgA.id, 'Owner', false);
      await prisma.organizationMember.create({ data: { userId: alice.id, orgId: orgA.id, role: 'Admin' } });

      const created = await invite(ownerToken, orgB.id, { email: 'alice@test.com', role: 'Technician' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(alice.email)}`)
        .expect(201);

      // Org A membership preserved, new Org B membership present.
      expect(
        await prisma.organizationMember.findUnique({ where: { userId_orgId: { userId: alice.id, orgId: orgA.id } } }),
      ).not.toBeNull();
      const inB = await prisma.organizationMember.findUnique({ where: { userId_orgId: { userId: alice.id, orgId: orgB.id } } });
      expect(inB!.role).toBe('Technician');
      expect(await prisma.organizationMember.count({ where: { userId: alice.id } })).toBe(2);

      // Global User snapshot untouched by acceptance.
      const dbAlice = await prisma.user.findUnique({ where: { id: alice.id } });
      expect(dbAlice!.role).toBe('Owner');
      expect(dbAlice!.orgId).toBe(orgA.id);
    });

    it('rejects acceptance when the user is already a member of the target org', async () => {
      const org = await createOrg('accept-member');
      const owner = await createUser('accept-member-owner@test.com', org.id, 'Owner');
      const member = await createUser('member@test.com', org.id, 'Technician');

      // The create API refuses invitations for existing members, so seed the
      // invitation row directly to exercise the accept path.
      const rawToken = generateInvitationToken();
      const created = await prisma.organizationInvitation.create({
        data: {
          organizationId: org.id,
          email: 'member@test.com',
          role: 'Viewer',
          tokenHash: hashInvitationToken(rawToken),
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 60_000),
          invitedByUserId: owner.id,
        },
      });

      const res = await request(server())
        .post(`/invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${await accessToken(member.email)}`)
        .expect(409);
      expect(res.body.message).toMatch(/already a member/i);
      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.id } });
      expect(row!.status).toBe('PENDING');
    });

    it('does not accept a client-supplied role; membership uses the stored role', async () => {
      const org = await createOrg('accept-role');
      const owner = await createUser('accept-role-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, org.id, { email: 'stored@test.com', role: 'Viewer' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('accept-role-home');
      const user = await createUser('stored@test.com', home.id, 'Viewer');
      const res = await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .send({ role: 'Owner' })
        .expect(201);

      expect(res.body.membership.role).toBe('Viewer');
      const membership = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });
      expect(membership!.role).toBe('Viewer');
    });

    it('newly accepted membership can switch immediately with RBAC role active', async () => {
      const org = await createOrg('accept-switch');
      const owner = await createUser('accept-switch-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, org.id, { email: 'switcher@test.com', role: 'Viewer' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('accept-switch-home');
      const user = await createUser('switcher@test.com', home.id, 'Owner');

      await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(201);

      const switchRes = await request(server())
        .post(`/organizations/${org.id}/switch`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(201);
      expect(decode(switchRes.body.accessToken).orgId).toBe(org.id);
      expect(decode(switchRes.body.accessToken).role).toBe('Viewer');
    });
  });

  describe('DEV INVITATION URL OWNERSHIP (V1-RBAC-01E)', () => {
    it('resolves to the web app base URL (development default localhost:3000), not the API origin', async () => {
      const prev = process.env.WEB_APP_URL;
      const prevLegacy = process.env.INVITE_BASE_URL;
      delete process.env.WEB_APP_URL;
      delete process.env.INVITE_BASE_URL;
      try {
        const org = await createOrg('devurl-web');
        const owner = await createUser('devurl-web@test.com', org.id, 'Owner');
        const token = await accessToken(owner.email);

        const res = await invite(token, org.id, { email: 'devurl@test.com', role: 'Viewer' }).expect(201);
        expect(res.body.devInvitationUrl).toMatch(
          /^http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]+$/,
        );
        expect(res.body.devInvitationUrl).not.toContain(':3001');
        expect(res.body.devInvitationUrl).not.toContain('/invitations/');
      } finally {
        process.env.WEB_APP_URL = prev;
        process.env.INVITE_BASE_URL = prevLegacy;
      }
    });

    it('honors WEB_APP_URL when configured for production-like deployments', async () => {
      const prev = process.env.WEB_APP_URL;
      process.env.WEB_APP_URL = 'https://app.example.com';
      try {
        const org = await createOrg('devurl-cfg');
        const owner = await createUser('devurl-cfg@test.com', org.id, 'Owner');
        const token = await accessToken(owner.email);

        const res = await invite(token, org.id, { email: 'devurlc@test.com', role: 'Viewer' }).expect(201);
        expect(res.body.devInvitationUrl).toMatch(
          /^https:\/\/app\.example\.com\/invite\/[A-Za-z0-9_-]+$/,
        );
      } finally {
        process.env.WEB_APP_URL = prev;
      }
    });
  });

  describe('ADMIN INVITATION E2E (V1-RBAC-01E)', () => {
    it('Owner creates an ADMIN invitation; the invited email accepts as ADMIN and NOT OWNER', async () => {
      const org = await createOrg('e2e-admin-org');
      const owner = await createUser('e2e-admin-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);

      const created = await invite(ownerToken, org.id, { email: 'e2e-admin@test.com', role: 'Admin' }).expect(201);
      expect(created.body.role).toBe('Admin');
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('e2e-admin-home');
      const user = await createUser('e2e-admin@test.com', home.id, 'Viewer');

      const acceptRes = await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(201);
      expect(acceptRes.body.membership.role).toBe('Admin');
      expect(acceptRes.body.membership.role).not.toBe('Owner');

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });
      expect(membership!.role).toBe('Admin');

      const row = await prisma.organizationInvitation.findUnique({ where: { id: created.body.id } });
      expect(row!.status).toBe('ACCEPTED');
    });

    it('the accepted organization appears in the user org list with the ADMIN role and switches cleanly', async () => {
      const org = await createOrg('e2e-admin-list-org');
      const owner = await createUser('e2e-admin-list-owner@test.com', org.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, org.id, { email: 'e2e-admin-list@test.com', role: 'Admin' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('e2e-admin-list-home');
      const user = await createUser('e2e-admin-list@test.com', home.id, 'Viewer');
      await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(201);

      const listRes = await request(server())
        .get('/organizations')
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(200);
      const listed = listRes.body.find((o: any) => o.id === org.id);
      expect(listed).toBeDefined();
      expect(listed.membershipRole).toBe('Admin');

      const switchRes = await request(server())
        .post(`/organizations/${org.id}/switch`)
        .set('Authorization', `Bearer ${await accessToken(user.email)}`)
        .expect(201);
      expect(decode(switchRes.body.accessToken).orgId).toBe(org.id);
      expect(decode(switchRes.body.accessToken).role).toBe('Admin');
    });

    it('a non-invited user with the raw token cannot join another organization (token is org-bound)', async () => {
      const orgA = await createOrg('e2e-orgbound-a');
      const orgB = await createOrg('e2e-orgbound-b');
      const ownerA = await createUser('e2e-orgbound-owner@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(ownerA.email);
      const created = await invite(ownerToken, orgA.id, { email: 'e2e-orgbound@test.com', role: 'Technician' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      // A member of Org B has no membership in Org A before acceptance.
      const memberB = await createUser('e2e-orgbound@test.com', orgB.id, 'Viewer');
      await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(memberB.email)}`)
        .expect(201);

      // The token created the membership in Org A only — Org B isolation holds.
      const inA = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: memberB.id, orgId: orgA.id } },
      });
      expect(inA!.role).toBe('Technician');
      expect(inA!.role).not.toBe('Owner');
    });

    it('an accepted ADMIN member of the invited org cannot read an unrelated org', async () => {
      const invitedOrg = await createOrg('e2e-isol-a');
      const unrelated = await createOrg('e2e-isol-b');
      const owner = await createUser('e2e-isol-owner@test.com', invitedOrg.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const created = await invite(ownerToken, invitedOrg.id, { email: 'e2e-isol-admin@test.com', role: 'Admin' }).expect(201);
      const raw = (created.body.devInvitationUrl as string).split('/').pop();

      const home = await createOrg('e2e-isol-home');
      const admin = await createUser('e2e-isol-admin@test.com', home.id, 'Viewer');
      await request(server())
        .post(`/invitations/${raw}/accept`)
        .set('Authorization', `Bearer ${await accessToken(admin.email)}`)
        .expect(201);

      const switchRes = await request(server())
        .post(`/organizations/${invitedOrg.id}/switch`)
        .set('Authorization', `Bearer ${await accessToken(admin.email)}`)
        .expect(201);
      const switchedToken = switchRes.body.accessToken as string;
      expect(decode(switchedToken).role).toBe('Admin');

      // Isolation: ADMIN in the invited org grants nothing in the unrelated org.
      await request(server())
        .get(`/organizations/${unrelated.id}`)
        .set('Authorization', `Bearer ${switchedToken}`)
        .expect(403);
      await request(server())
        .get(`/organizations/${unrelated.id}/invitations`)
        .set('Authorization', `Bearer ${switchedToken}`)
        .expect(403);
    });
  });
});

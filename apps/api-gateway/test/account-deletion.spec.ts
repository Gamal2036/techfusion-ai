import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Role, Prisma } from '@prisma/client';

describe('Account Deletion (V1-STAGE-00A)', () => {
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

  async function createOrg(name: string, slug?: string) {
    return prisma.organization.create({
      data: { name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-') },
    });
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

  async function addMembership(userId: string, orgId: string, role: Role) {
    return prisma.organizationMember.create({ data: { userId, orgId, role } });
  }

  function login(email: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
  }

  async function accessToken(email: string): Promise<string> {
    const res = await login(email);
    return res.body.accessToken as string;
  }

  function deleteAccount(token: string, confirmation = 'DELETE') {
    return request(app.getHttpServer())
      .delete('/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirmation });
  }

  function preview(token: string) {
    return request(app.getHttpServer())
      .get('/auth/account/deletion-preview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }

  async function createDevice(orgId: string, name: string, tokenSuffix: string) {
    return prisma.device.create({
      data: {
        orgId,
        name,
        deviceTokenHash: crypto.createHash('sha256').update(`dev-token-${tokenSuffix}`).digest('hex'),
      },
    });
  }

  const server = () => app.getHttpServer();

  describe('AUTHORIZATION & CONFIRMATION', () => {
    it('rejects deletion without the exact confirmation value', async () => {
      const org = await createOrg('confirm-org');
      const user = await createUser('confirm@test.com', org.id, 'Owner');
      const token = await accessToken(user.email);

      await deleteAccount(token, '') .expect(400);
      await deleteAccount(token, 'delete') .expect(400);
      await deleteAccount(token, 'CONFIRM') .expect(400);
      await request(server())
        .delete('/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    });

    it('cannot delete another user account — a body userId is never trusted', async () => {
      const victimOrg = await createOrg('victim-org');
      const victim = await createUser('victim@test.com', victimOrg.id, 'Owner');

      const attackerOrg = await createOrg('attacker-org');
      const attacker = await createUser('attacker@test.com', attackerOrg.id, 'Owner');
      const token = await accessToken(attacker.email);

      // The request carries a body userId pointing at the victim. The endpoint
      // only acts on req.user.sub, so the attacker's own account is deleted and
      // the victim is left completely untouched.
      await request(server())
        .delete('/auth/account')
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmation: 'DELETE', userId: victim.id })
        .expect(200);

      const dbVictim = await prisma.user.findUnique({ where: { id: victim.id } });
      expect(dbVictim).not.toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: victim.id, orgId: victimOrg.id } },
        }),
      ).not.toBeNull();
      // The victim can still log in afterwards.
      await login(victim.email).expect(201);

      // The attacker's own account is the one removed.
      expect(await prisma.user.findUnique({ where: { id: attacker.id } })).toBeNull();
    });

    it('requires an authenticated human session (401 without token)', async () => {
      await request(server())
        .delete('/auth/account')
        .send({ confirmation: 'DELETE' })
        .expect(401);
      await request(server()).get('/auth/account/deletion-preview').expect(401);
    });
  });

  describe('OWNERSHIP SAFETY', () => {
    it('blocks a sole Owner of a non-empty org (device present)', async () => {
      const org = await createOrg('block-device');
      const owner = await createUser('block-device@test.com', org.id, 'Owner');
      await createDevice(org.id, 'Device A', 'block-device');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(409);

      expect(res.body.message).toMatch(/Owner/i);
      expect(res.body.blockers).toHaveLength(1);
      expect(res.body.blockers[0].organizationId).toBe(org.id);
      expect(res.body.blockers[0].reason).toBe('SOLE_OWNER');

      // Nothing is deleted: user, membership, org, and device all remain.
      expect(await prisma.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: org.id } },
        }),
      ).not.toBeNull();
      expect(await prisma.device.count({ where: { orgId: org.id } })).toBe(1);
    });

    it('blocks a sole Owner of a shared org (another member present)', async () => {
      const org = await createOrg('block-shared');
      const owner = await createUser('block-shared@test.com', org.id, 'Owner');
      await createUser('block-shared-2@test.com', org.id, 'Viewer');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(409);
      expect(res.body.blockers[0].organizationId).toBe(org.id);
      expect(res.body.blockers[0].organizationName).toBe('block-shared');

      expect(await prisma.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
    });

    it('allows deletion when another Owner remains', async () => {
      const org = await createOrg('co-owner');
      const owner = await createUser('co-owner-a@test.com', org.id, 'Owner', false);
      const coOwner = await createUser('co-owner-b@test.com', org.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: org.id, role: 'Owner' },
          { userId: coOwner.id, orgId: org.id, role: 'Owner' },
        ],
      });
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.message).toBe('Account deleted');

      // Account and membership removed; org and co-Owner preserved.
      expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: org.id } },
        }),
      ).toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: coOwner.id } })).not.toBeNull();
      expect(
        await prisma.organizationMember.count({ where: { orgId: org.id, role: 'Owner' } }),
      ).toBe(1);
    });

    it('a blocked deletion rolls back entirely — no partial cleanup', async () => {
      const personalOrg = await createOrg('personal-empty');
      const teamOrg = await createOrg('team-with-device');
      const owner = await createUser('rollback@test.com', personalOrg.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: personalOrg.id, role: 'Owner' },
          { userId: owner.id, orgId: teamOrg.id, role: 'Owner' },
        ],
      });
      await createDevice(teamOrg.id, 'Device T', 'rollback-team');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(409);
      expect(res.body.blockers).toHaveLength(1);
      expect(res.body.blockers[0].organizationId).toBe(teamOrg.id);

      // The empty personal org must NOT have been deleted (atomic rollback).
      expect(await prisma.organization.findUnique({ where: { id: personalOrg.id } })).not.toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: personalOrg.id } },
        }),
      ).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
    });
  });

  describe('SUCCESSFUL DELETION (non-owner, multi-org)', () => {
    async function buildFixture() {
      const orgA = await createOrg('succ-a');
      const orgB = await createOrg('succ-b');
      const deletingUser = await createUser('succ-user@test.com', orgA.id, 'Viewer', false);
      const otherMember = await createUser('succ-other@test.com', orgB.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: deletingUser.id, orgId: orgA.id, role: 'Viewer' },
          { userId: deletingUser.id, orgId: orgB.id, role: 'Technician' },
          { userId: otherMember.id, orgId: orgB.id, role: 'Owner' },
        ],
      });
      const device = await createDevice(orgB.id, 'Device B', 'succ-b');
      await prisma.deviceMetric.create({
        data: {
          deviceId: device.id,
          orgId: orgB.id,
          cpuUsage: 12.5,
          ramUsed: BigInt(1024),
          ramTotal: BigInt(4096),
          ramPercent: 25,
        },
      });
      return { orgA, orgB, deletingUser, otherMember, device };
    }

    it('deletes the account and memberships while preserving orgs, users, devices, and metrics', async () => {
      const { orgA, orgB, deletingUser, otherMember, device } = await buildFixture();
      const token = await accessToken(deletingUser.email);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.removedOrganizations).toEqual([]);

      expect(await prisma.user.findUnique({ where: { id: deletingUser.id } })).toBeNull();
      expect(await prisma.organizationMember.count({ where: { userId: deletingUser.id } })).toBe(0);

      // Organizations preserved.
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).not.toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: orgB.id } })).not.toBeNull();

      // Other user + membership preserved.
      expect(await prisma.user.findUnique({ where: { id: otherMember.id } })).not.toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: otherMember.id, orgId: orgB.id } },
        }),
      ).not.toBeNull();

      // Devices + metrics preserved.
      expect(await prisma.device.count({ where: { orgId: orgB.id } })).toBe(1);
      expect(await prisma.deviceMetric.count({ where: { deviceId: device.id } })).toBe(1);
    });

    it('revokes all refresh sessions and rejects the old JWT and refresh token', async () => {
      const { orgB, deletingUser } = await buildFixture();
      const loginRes = await login(deletingUser.email);
      const token = loginRes.body.accessToken as string;
      const refreshToken = loginRes.body.refreshToken as string;

      // Multiple active sessions for the account.
      const extra = await login(deletingUser.email);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.message).toBe('Account deleted');

      // No stored refresh rows remain.
      expect(await prisma.refreshToken.count({ where: { userId: deletingUser.id } })).toBe(0);

      // Old access JWT is rejected by the membership-authoritative guard (ORG-01A3).
      await request(server())
        .get('/auth/account/deletion-preview')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
      await request(server())
        .get(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      // The old refresh token can no longer mint tokens.
      await request(server())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
      await request(server())
        .post('/auth/refresh')
        .send({ refreshToken: extra.body.refreshToken })
        .expect(401);

      // Login with the same credentials now fails.
      await login(deletingUser.email).expect(401);
    });

    it('revokes pending invitations addressed to the deleted email', async () => {
      const { orgA, deletingUser } = await buildFixture();
      await prisma.organizationInvitation.create({
        data: {
          organizationId: orgA.id,
          email: deletingUser.email,
          role: 'Viewer',
          tokenHash: `inv-to-user-${deletingUser.id}`,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          invitedByUserId: deletingUser.id,
        },
      });
      const token = await accessToken(deletingUser.email);

      await deleteAccount(token).expect(200);

      const inv = await prisma.organizationInvitation.findUnique({
        where: { tokenHash: `inv-to-user-${deletingUser.id}` },
      });
      expect(inv!.status).toBe('REVOKED');
    });

    it('preserves invitations created BY the user without cascading other invitations', async () => {
      const { orgA, orgB, deletingUser, otherMember } = await buildFixture();
      const createdByUser = await prisma.organizationInvitation.create({
        data: {
          organizationId: orgB.id,
          email: 'pending-invitee@test.com',
          role: 'Viewer',
          tokenHash: `inv-created-by-${deletingUser.id}`,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          invitedByUserId: deletingUser.id,
        },
      });
      const createdByOther = await prisma.organizationInvitation.create({
        data: {
          organizationId: orgA.id,
          email: 'pending-other@test.com',
          role: 'Technician',
          tokenHash: `inv-created-other-${deletingUser.id}`,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          invitedByUserId: otherMember.id,
        },
      });
      const token = await accessToken(deletingUser.email);

      await deleteAccount(token).expect(200);

      // The invitation created by the deleted user survives (no cascade), and
      // the invitation created by another member survives too.
      const preserved = await prisma.organizationInvitation.findUnique({
        where: { id: createdByUser.id },
      });
      expect(preserved).not.toBeNull();
      expect(preserved!.status).toBe('PENDING');
      expect(preserved!.invitedByUserId).toBe(deletingUser.id);

      expect(
        await prisma.organizationInvitation.findUnique({ where: { id: createdByOther.id } }),
      ).not.toBeNull();
    });

    it('preserves audit history with the deleted actor id', async () => {
      const { orgB, deletingUser } = await buildFixture();
      await prisma.auditLog.create({
        data: {
          orgId: orgB.id,
          action: 'remote_session_ended',
          actorId: deletingUser.id,
          details: { note: 'historical' },
        },
      });
      const token = await accessToken(deletingUser.email);

      await deleteAccount(token).expect(200);

      const rows = await prisma.auditLog.findMany({ where: { orgId: orgB.id } });
      const historical = rows.find((r) => r.action === 'remote_session_ended');
      expect(historical).not.toBeNull();
      expect(historical!.actorId).toBe(deletingUser.id);

      // The new account_deleted event is also recorded for the surviving org.
      expect(rows.some((r) => r.action === 'account_deleted')).toBe(true);
    });
  });

  describe('EMPTY PERSONAL ORGANIZATION POLICY', () => {
    it('deletes a genuinely empty solely-owned org together with the account', async () => {
      const org = await createOrg('empty-personal');
      const owner = await createUser('empty-personal@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.removedOrganizations).toEqual([org.id]);

      expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: org.id } })).toBeNull();
    });

    it('blocks when the org has one device', async () => {
      const org = await createOrg('empty-plus-device');
      const owner = await createUser('empty-plus-device@test.com', org.id, 'Owner');
      await createDevice(org.id, 'Device X', 'empty-plus-device');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(409);
      expect(res.body.blockers).toHaveLength(1);
      expect(res.body.blockers[0].reason).toBe('SOLE_OWNER');

      expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
      expect(await prisma.device.count({ where: { orgId: org.id } })).toBe(1);
    });

    it('blocks when a second member exists (sole Owner of a shared org)', async () => {
      const org = await createOrg('empty-plus-member');
      const owner = await createUser('empty-plus-member@test.com', org.id, 'Owner');
      await createUser('empty-plus-member-2@test.com', org.id, 'Viewer');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(409);
      expect(res.body.blockers).toHaveLength(1);
      expect(res.body.blockers[0].reason).toBe('SOLE_OWNER');

      expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
    });

    it('blocks when a pending invitation exists in the org', async () => {
      const org = await createOrg('empty-plus-invite');
      const owner = await createUser('empty-plus-invite@test.com', org.id, 'Owner');
      await prisma.organizationInvitation.create({
        data: {
          organizationId: org.id,
          email: 'someone@test.com',
          role: 'Viewer',
          tokenHash: 'inv-empty-plus-invite',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          invitedByUserId: owner.id,
        },
      });
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(409);
      expect(res.body.blockers).toHaveLength(1);

      expect(await prisma.organization.findUnique({ where: { id: org.id } })).not.toBeNull();
    });

    it('deletes the empty personal org while a non-owner org membership survives', async () => {
      const personalOrg = await createOrg('mixed-personal');
      const sharedOrg = await createOrg('mixed-shared');
      const owner = await createUser('mixed@test.com', personalOrg.id, 'Owner', false);
      const sharedOwner = await createUser('mixed-shared-owner@test.com', sharedOrg.id, 'Owner', false);
      await prisma.organizationMember.createMany({
        data: [
          { userId: owner.id, orgId: personalOrg.id, role: 'Owner' },
          { userId: owner.id, orgId: sharedOrg.id, role: 'Viewer' },
          { userId: sharedOwner.id, orgId: sharedOrg.id, role: 'Owner' },
        ],
      });
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.removedOrganizations).toEqual([personalOrg.id]);

      expect(await prisma.organization.findUnique({ where: { id: personalOrg.id } })).toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: sharedOrg.id } })).not.toBeNull();
      expect(await prisma.user.findUnique({ where: { id: sharedOwner.id } })).not.toBeNull();
    });
  });

  describe('DELETION PREVIEW', () => {
    it('reports blockers with organization id, name, and SOLE_OWNER reason', async () => {
      const org = await createOrg('preview-blocked');
      const owner = await createUser('preview-blocked@test.com', org.id, 'Owner');
      await createUser('preview-blocked-2@test.com', org.id, 'Technician');
      const token = await accessToken(owner.email);

      const res = await preview(token);
      expect(res.body.canDelete).toBe(false);
      expect(res.body.blockers).toEqual([
        { organizationId: org.id, organizationName: 'preview-blocked', reason: 'SOLE_OWNER' },
      ]);
      expect(res.body.membershipsCount).toBe(1);
      expect(res.body.ownedOrganizationsCount).toBe(1);
    });

    it('reports eligibility with counts for an eligible account', async () => {
      const org = await createOrg('preview-ok');
      const user = await createUser('preview-ok@test.com', org.id, 'Technician');
      const token = await accessToken(user.email);

      const res = await preview(token);
      expect(res.body.canDelete).toBe(true);
      expect(res.body.blockers).toEqual([]);
      expect(res.body.membershipsCount).toBe(1);
      expect(res.body.ownedOrganizationsCount).toBe(0);
    });

    it('lists empty personal orgs that would be removed', async () => {
      const org = await createOrg('preview-empty');
      const owner = await createUser('preview-empty@test.com', org.id, 'Owner');
      const token = await accessToken(owner.email);

      const res = await preview(token);
      expect(res.body.canDelete).toBe(true);
      expect(res.body.emptyOrganizationsToRemove).toEqual([
        { organizationId: org.id, organizationName: 'preview-empty' },
      ]);
    });
  });

  describe('TENANT ISOLATION', () => {
    it('other organizations and users are untouched by a deletion', async () => {
      const orgA = await createOrg('iso-a');
      const orgB = await createOrg('iso-b');
      const userA = await createUser('iso-a@test.com', orgA.id, 'Admin');
      const userB = await createUser('iso-b@test.com', orgB.id, 'Owner');
      await createDevice(orgB.id, 'Device B', 'iso-b');
      const token = await accessToken(userA.email);

      await deleteAccount(token).expect(200);

      expect(await prisma.user.findUnique({ where: { id: userA.id } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: userB.id } })).not.toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).not.toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: orgB.id } })).not.toBeNull();
      expect(await prisma.device.count({ where: { orgId: orgB.id } })).toBe(1);
      // Org B membership and access intact.
      const bToken = await accessToken(userB.email);
      await request(server())
        .get(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${bToken}`)
        .expect(200);
    });
  });
});

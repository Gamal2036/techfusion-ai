import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
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

describe('V1-STAGE-01A Lifecycle Data Integrity', () => {
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

  async function addMembership(userId: string, orgId: string, role: Role) {
    return prisma.organizationMember.create({ data: { userId, orgId, role } });
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

  function createEnrollmentToken(
    token: string,
    body: { label?: string; maxUses?: number; expiresAt?: string } = {},
  ) {
    return request(app.getHttpServer())
      .post('/enrollment/tokens')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  function registerPublic(body: Record<string, any>) {
    return request(app.getHttpServer()).post('/devices/register-public').send(body);
  }

  async function createDevice(orgId: string, name: string, tokenSuffix: string) {
    return prisma.device.create({
      data: { orgId, name, deviceToken: `dev-token-${tokenSuffix}` },
    });
  }

  const server = () => app.getHttpServer();

  describe('A. ACCOUNT DELETION — never destroys org/device data the user touched', () => {
    it('A1 deletes only the account, preserving organizations, devices and other members', async () => {
      const orgA = await createOrg('lif-a1');
      const owner = await createUser('lif-a1-owner@test.com', orgA.id, 'Owner');
      const member = await createUser('lif-a1-member@test.com', orgA.id, 'Viewer');
      const device = await createDevice(orgA.id, 'dev-a1', 'a1');
      const memberToken = await accessToken(member.email);

      const res = await deleteAccount(memberToken).expect(200);
      expect(res.body.message).toBe('Account deleted');

      expect(await prisma.user.findUnique({ where: { id: member.id } })).toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).not.toBeNull();
      expect(await prisma.device.findUnique({ where: { id: device.id } })).not.toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: member.id, orgId: orgA.id } },
        }),
      ).toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: orgA.id } },
        }),
      ).not.toBeNull();
    });

    it('A2 revokes every stored refresh session and the account cannot log in again', async () => {
      const orgA = await createOrg('lif-a2');
      const owner = await createUser('lif-a2@test.com', orgA.id, 'Owner');
      const loginRes = await login(owner.email);
      const refreshToken = loginRes.body.refreshToken as string;
      expect(
        await prisma.refreshToken.findUnique({ where: { token: refreshToken } }),
      ).not.toBeNull();

      await deleteAccount(loginRes.body.accessToken).expect(200);

      expect(await prisma.refreshToken.findUnique({ where: { token: refreshToken } })).toBeNull();
      await request(server())
        .post('/auth/login')
        .send({ email: owner.email, password: 'password123' })
        .expect(401);
    });

    it('A3 a non-empty solely-owned org blocks account deletion with a SOLE_OWNER blocker', async () => {
      const orgA = await createOrg('lif-a3');
      const owner = await createUser('lif-a3@test.com', orgA.id, 'Owner');
      await createDevice(orgA.id, 'dev-a3', 'a3');
      const token = await accessToken(owner.email);

      const previewRes = await preview(token);
      expect(previewRes.body.canDelete).toBe(false);
      expect(previewRes.body.blockers).toEqual([
        expect.objectContaining({ organizationId: orgA.id, reason: 'SOLE_OWNER' }),
      ]);

      const res = await deleteAccount(token).expect(409);
      expect(res.body.blockers[0].reason).toBe('SOLE_OWNER');
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).not.toBeNull();
      expect(await prisma.device.count({ where: { orgId: orgA.id } })).toBe(1);
      expect(await prisma.user.findUnique({ where: { id: owner.id } })).not.toBeNull();
    });

    it('A4 a provably-empty solely-owned personal org is hard-deleted with the account', async () => {
      const orgA = await createOrg('lif-a4');
      const owner = await createUser('lif-a4@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      const previewRes = await preview(token);
      expect(previewRes.body.canDelete).toBe(true);
      expect(previewRes.body.emptyOrganizationsToRemove).toEqual([
        expect.objectContaining({ organizationId: orgA.id }),
      ]);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.removedOrganizations).toContain(orgA.id);
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).toBeNull();
      expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
    });
  });

  describe('O. ORGANIZATION DELETION POLICY — distinct from account deletion', () => {
    it('O1 there is no standalone organization-deletion endpoint in V1', async () => {
      const orgA = await createOrg('lif-o1');
      const owner = await createUser('lif-o1@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      await request(server())
        .delete(`/organizations/${orgA.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).not.toBeNull();
    });

    it('O2 an empty org is removed only under the empty-org account-deletion policy', async () => {
      const emptyOrg = await createOrg('lif-o2-empty');
      const sharedOrg = await createOrg('lif-o2-shared');
      const owner = await createUser('lif-o2@test.com', emptyOrg.id, 'Owner', false);
      const coOwner = await createUser('lif-o2-co@test.com', sharedOrg.id, 'Owner', false);
      await addMembership(owner.id, emptyOrg.id, 'Owner');
      await addMembership(owner.id, sharedOrg.id, 'Owner');
      await addMembership(coOwner.id, sharedOrg.id, 'Owner');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.removedOrganizations).toContain(emptyOrg.id);
      expect(res.body.removedOrganizations).not.toContain(sharedOrg.id);
      expect(await prisma.organization.findUnique({ where: { id: emptyOrg.id } })).toBeNull();
      expect(await prisma.organization.findUnique({ where: { id: sharedOrg.id } })).not.toBeNull();
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: coOwner.id, orgId: sharedOrg.id } },
        }),
      ).not.toBeNull();
    });

    it('O3 a non-empty org and its devices survive when another Owner remains', async () => {
      const orgA = await createOrg('lif-o3');
      const owner = await createUser('lif-o3@test.com', orgA.id, 'Owner', false);
      const coOwner = await createUser('lif-o3-co@test.com', orgA.id, 'Owner', false);
      await addMembership(owner.id, orgA.id, 'Owner');
      await addMembership(coOwner.id, orgA.id, 'Owner');
      const device = await createDevice(orgA.id, 'dev-o3', 'o3');
      const token = await accessToken(owner.email);

      const res = await deleteAccount(token).expect(200);
      expect(res.body.removedOrganizations).toHaveLength(0);
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).not.toBeNull();
      expect(await prisma.device.findUnique({ where: { id: device.id } })).not.toBeNull();
      expect(await prisma.organizationMember.count({ where: { orgId: orgA.id } })).toBe(1);
    });
  });

  describe('ORG. OWNERSHIP & MEMBERSHIP INVARIANTS', () => {
    it('ORG1a the sole Owner of an organization cannot be downgraded', async () => {
      const orgA = await createOrg('lif-org1a');
      const owner = await createUser('lif-org1a@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      await request(server())
        .patch(`/organizations/${orgA.id}/members/${owner.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(409);
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: orgA.id } },
        }),
      ).toMatchObject({ role: 'Owner' });
    });

    it('ORG1b a user cannot leave their last organization', async () => {
      const orgA = await createOrg('lif-org1b');
      const owner = await createUser('lif-org1b@test.com', orgA.id, 'Owner');
      const token = await accessToken(owner.email);

      await request(server())
        .post(`/organizations/${orgA.id}/leave`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
      expect(
        await prisma.organizationMember.findUnique({
          where: { userId_orgId: { userId: owner.id, orgId: orgA.id } },
        }),
      ).not.toBeNull();
    });

    it('ORG2 removing a member revokes org access immediately (membership is authority)', async () => {
      const orgA = await createOrg('lif-org2');
      const owner = await createUser('lif-org2-owner@test.com', orgA.id, 'Owner');
      const member = await createUser('lif-org2-member@test.com', orgA.id, 'Viewer');
      const ownerToken = await accessToken(owner.email);
      const memberToken = await accessToken(member.email);

      await request(server())
        .get(`/organizations/${orgA.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      await request(server())
        .delete(`/organizations/${orgA.id}/members/${member.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      await request(server())
        .get(`/organizations/${orgA.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(401);
      await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(401);
    });

    it('ORG3a invitations addressed to a deleted account email are revoked', async () => {
      const orgA = await createOrg('lif-org3a');
      const owner = await createUser('lif-org3a-owner@test.com', orgA.id, 'Owner');
      const orgB = await createOrg('lif-org3a-b');
      const member = await createUser('lif-org3a-member@test.com', orgB.id, 'Owner');
      const ownerToken = await accessToken(owner.email);

      await request(server())
        .post(`/organizations/${orgA.id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: member.email, role: 'Admin' })
        .expect(201);

      const invitation = await prisma.organizationInvitation.findFirst({
        where: { email: member.email, status: 'PENDING' },
      });
      expect(invitation).not.toBeNull();

      const memberToken = await accessToken(member.email);
      await deleteAccount(memberToken).expect(200);

      expect(
        await prisma.organizationInvitation.findUnique({ where: { id: invitation!.id } }),
      ).toMatchObject({ status: 'REVOKED' });
    });

    it('ORG3b invitations created by a deleted user are preserved (no FK, not revoked)', async () => {
      const orgA = await createOrg('lif-org3b');
      const owner = await createUser('lif-org3b-owner@test.com', orgA.id, 'Owner', false);
      const coOwner = await createUser('lif-org3b-co@test.com', orgA.id, 'Owner', false);
      await addMembership(owner.id, orgA.id, 'Owner');
      await addMembership(coOwner.id, orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);

      await request(server())
        .post(`/organizations/${orgA.id}/invitations`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: 'lif-org3b-invitee@test.com', role: 'Admin' })
        .expect(201);

      const invitation = await prisma.organizationInvitation.findFirst({
        where: { email: 'lif-org3b-invitee@test.com', status: 'PENDING' },
      });
      expect(invitation).not.toBeNull();

      await deleteAccount(ownerToken).expect(200);

      const after = await prisma.organizationInvitation.findUnique({
        where: { id: invitation!.id },
      });
      expect(after).not.toBeNull();
      expect(after!.status).toBe('PENDING');
      expect(after!.invitedByUserId).toBe(owner.id);
    });
  });

  describe('D. DEVICE & ENROLLMENT TOKEN LIFECYCLE', () => {
    it('D1 the organization is derived from the enrollment token, never the client', async () => {
      const orgA = await createOrg('lif-d1');
      const owner = await createUser('lif-d1@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { label: 'd1' }).expect(201);
      const rawToken = tokenRes.body.token as string;

      const res = await registerPublic({
        name: 'd1-device',
        hostname: 'd1-host',
        identityFingerprint: 'finger-d1',
        installationId: 'inst-d1',
        enrollmentToken: rawToken,
      }).expect(201);

      expect(res.body.duplicate).toBe(false);
      const device = await prisma.device.findUnique({ where: { id: res.body.device.id } });
      expect(device!.orgId).toBe(orgA.id);
    });

    it('D2 re-registering the same identity returns the same device and rotates its credential', async () => {
      const orgA = await createOrg('lif-d2');
      const owner = await createUser('lif-d2@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { label: 'd2', maxUses: 2 }).expect(201);
      const rawToken = tokenRes.body.token as string;

      const body = {
        name: 'd2-device',
        hostname: 'd2-host',
        identityFingerprint: 'finger-d2',
        installationId: 'inst-d2',
        enrollmentToken: rawToken,
      };
      const first = await registerPublic(body).expect(201);
      const second = await registerPublic(body).expect(201);

      expect(first.body.device.id).toBe(second.body.device.id);
      expect(second.body.duplicate).toBe(true);
      expect(second.body.deviceToken).not.toBe(first.body.deviceToken);
      expect(await prisma.device.count({ where: { orgId: orgA.id } })).toBe(1);
    });

    it('D3 only the SHA-256 hash of the raw token is persisted', async () => {
      const orgA = await createOrg('lif-d3');
      const owner = await createUser('lif-d3@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { label: 'd3' }).expect(201);
      const rawToken = tokenRes.body.token as string;
      expect(rawToken).toMatch(/^tfenr_[0-9a-f]{64}$/);

      const row = await prisma.enrollmentToken.findUnique({
        where: { id: tokenRes.body.id },
      });
      const plain = rawToken.startsWith('tfenr_') ? rawToken.slice('tfenr_'.length) : rawToken;
      expect(row!.tokenHash).toBe(crypto.createHash('sha256').update(plain).digest('hex'));
      expect(row!.tokenHash).not.toBe(plain);
    });

    it('D4 a consumed single-use token is non-reusable', async () => {
      const orgA = await createOrg('lif-d4');
      const owner = await createUser('lif-d4@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { maxUses: 1 }).expect(201);
      const rawToken = tokenRes.body.token as string;

      await registerPublic({
        name: 'd4-device',
        identityFingerprint: 'finger-d4',
        enrollmentToken: rawToken,
      }).expect(201);

      await registerPublic({
        name: 'd4-device-2',
        identityFingerprint: 'finger-d4-2',
        enrollmentToken: rawToken,
      }).expect(403);

      const row = await prisma.enrollmentToken.findUnique({
        where: { id: tokenRes.body.id },
      });
      expect(row!.useCount).toBe(1);
      expect(await prisma.device.count({ where: { orgId: orgA.id } })).toBe(1);
    });

    it('D5 reset-identity is local-only: no server endpoint can wipe the device record', async () => {
      const orgA = await createOrg('lif-d5');
      const owner = await createUser('lif-d5@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const device = await createDevice(orgA.id, 'd5-device', 'd5');

      await request(server())
        .post('/devices/reset-identity')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(404);
      expect(await prisma.device.findUnique({ where: { id: device.id } })).not.toBeNull();
    });

    it('D6 credential recovery requires an org token and a matching identity', async () => {
      const orgA = await createOrg('lif-d6');
      const owner = await createUser('lif-d6@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { maxUses: 6 }).expect(201);
      const rawToken = tokenRes.body.token as string;

      const reg = await registerPublic({
        name: 'd6-device',
        identityFingerprint: 'finger-d6',
        enrollmentToken: rawToken,
      }).expect(201);

      const recovered = await request(server())
        .post('/devices/recover-credential')
        .set('x-org-token', rawToken)
        .send({ identityFingerprint: 'finger-d6' })
        .expect(201);
      expect(recovered.body.device.id).toBe(reg.body.device.id);
      expect(recovered.body.deviceToken).not.toBe(reg.body.deviceToken);

      const missing = await request(server())
        .post('/devices/recover-credential')
        .set('x-org-token', rawToken)
        .send({ identityFingerprint: 'finger-does-not-exist' })
        .expect(201);
      expect(missing.body.code).toBe('DEVICE_NOT_FOUND');

      await request(server())
        .post('/devices/recover-credential')
        .send({ identityFingerprint: 'finger-d6' })
        .expect(201)
        .expect((res) => expect(res.body.code).toBe('ORG_TOKEN_REQUIRED'));
    });
  });

  describe('T. TENANT ISOLATION', () => {
    it('T1 a JWT with tampered org/role claims is rejected', async () => {
      const orgA = await createOrg('lif-t1a');
      const orgB = await createOrg('lif-t1b');
      const user = await createUser('lif-t1@test.com', orgA.id, 'Owner');
      const tampered = jwt.sign(
        { sub: user.id, orgId: orgB.id, role: 'Owner' },
        JWT_SECRET(),
        { expiresIn: '15m' },
      );

      await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });

    it('T2 an enrollment token scoped to orgA cannot enroll into orgB', async () => {
      const orgA = await createOrg('lif-t2a');
      const orgB = await createOrg('lif-t2b');
      const owner = await createUser('lif-t2@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { label: 't2' }).expect(201);

      const res = await registerPublic({
        name: 't2-device',
        identityFingerprint: 'finger-t2',
        enrollmentToken: tokenRes.body.token,
      }).expect(201);

      expect(res.body.device.orgId).toBe(orgA.id);
      expect(await prisma.device.count({ where: { orgId: orgB.id } })).toBe(0);
    });

    it('T3 inventory reports with a mismatched x-org-id are rejected', async () => {
      const orgA = await createOrg('lif-t3a');
      const orgB = await createOrg('lif-t3b');
      const owner = await createUser('lif-t3@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { label: 't3' }).expect(201);
      const reg = await registerPublic({
        name: 't3-device',
        identityFingerprint: 'finger-t3',
        enrollmentToken: tokenRes.body.token,
      }).expect(201);
      const deviceToken = reg.body.deviceToken as string;

      await request(server())
        .post('/inventory/report')
        .set('Authorization', `Bearer ${deviceToken}`)
        .set('x-org-id', orgB.id)
        .send({ reportType: 'full' })
        .expect(403);

      const ok = await request(server())
        .post('/inventory/report')
        .set('Authorization', `Bearer ${deviceToken}`)
        .set('x-org-id', orgA.id)
        .send({ reportType: 'full' })
        .expect(201);
      expect(ok.body.orgId).toBe(orgA.id);
    });

    it('T5 switching organizations re-mints tokens bound to the new org', async () => {
      const orgA = await createOrg('lif-t5a');
      const orgB = await createOrg('lif-t5b');
      const user = await createUser('lif-t5@test.com', orgA.id, 'Owner', false);
      await addMembership(user.id, orgA.id, 'Owner');
      await addMembership(user.id, orgB.id, 'Admin');
      const token = await accessToken(user.email);
      expect(decode(token).orgId).toBe(orgA.id);

      const res = await request(server())
        .post(`/organizations/${orgB.id}/switch`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(decode(res.body.accessToken).orgId).toBe(orgB.id);
      expect(decode(res.body.accessToken).role).toBe('Admin');

      const stored = await prisma.refreshToken.findUnique({
        where: { token: res.body.refreshToken },
      });
      expect(stored!.orgId).toBe(orgB.id);
    });
  });

  describe('X. CROSS-CUTTING CONCURRENCY & CONSERVATIVE DELETION', () => {
    it('X1 concurrent consumption of a single-use token admits exactly one consumer', async () => {
      const orgA = await createOrg('lif-x1');
      const owner = await createUser('lif-x1@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { maxUses: 1 }).expect(201);
      const rawToken = tokenRes.body.token as string;

      const responses = await Promise.all([
        registerPublic({ name: 'x1-device-a', identityFingerprint: 'finger-x1a', enrollmentToken: rawToken }),
        registerPublic({ name: 'x1-device-b', identityFingerprint: 'finger-x1b', enrollmentToken: rawToken }),
      ]);

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 403]);
      const loser = responses.find((r) => r.status === 403);
      expect(loser!.body.message).toBe('Enrollment token has been fully used');

      const row = await prisma.enrollmentToken.findUnique({
        where: { id: tokenRes.body.id },
      });
      expect(row!.useCount).toBe(1);
      expect(await prisma.device.count({ where: { orgId: orgA.id } })).toBe(1);
    });

    it('X2 an org-scoped enrollment token keeps an otherwise-empty org from silent deletion', async () => {
      const orgA = await createOrg('lif-x2');
      const owner = await createUser('lif-x2@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      await createEnrollmentToken(ownerToken, { label: 'x2' }).expect(201);

      const previewRes = await preview(ownerToken);
      expect(previewRes.body.canDelete).toBe(false);
      expect(previewRes.body.emptyOrganizationsToRemove).toEqual([]);
      expect(previewRes.body.blockers).toEqual([
        expect.objectContaining({ organizationId: orgA.id, reason: 'SOLE_OWNER' }),
      ]);

      await deleteAccount(ownerToken).expect(409);
      expect(await prisma.organization.findUnique({ where: { id: orgA.id } })).not.toBeNull();
      expect(await prisma.enrollmentToken.count({ where: { orgId: orgA.id } })).toBe(1);
    });

    it('X3 lifecycle changes are reflected in the deletion preview', async () => {
      const orgA = await createOrg('lif-x3');
      const owner = await createUser('lif-x3@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);

      const empty = await preview(ownerToken);
      expect(empty.body.canDelete).toBe(true);

      const device = await createDevice(orgA.id, 'x3-direct-device', 'x3');
      const blocked = await preview(ownerToken);
      expect(blocked.body.canDelete).toBe(false);
      expect(blocked.body.blockers.some((b: any) => b.reason === 'SOLE_OWNER')).toBe(true);

      await prisma.device.delete({ where: { id: device.id } });
      const toggled = await preview(ownerToken);
      expect(toggled.body.canDelete).toBe(true);
    });

    it('X3b an enrollment token leaves audit history that keeps the org out of the empty-org policy', async () => {
      const orgA = await createOrg('lif-x3b');
      const owner = await createUser('lif-x3b@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);

      expect((await preview(ownerToken)).body.canDelete).toBe(true);

      const tokenRes = await createEnrollmentToken(ownerToken, { label: 'x3b' }).expect(201);
      expect((await preview(ownerToken)).body.canDelete).toBe(false);

      await prisma.enrollmentToken.delete({ where: { id: tokenRes.body.id } });
      const afterCleanup = await preview(ownerToken);
      expect(afterCleanup.body.canDelete).toBe(false);
      expect(await prisma.auditLog.count({ where: { orgId: orgA.id } })).toBe(1);
    });

    it('X5 lifecycle events are written to the audit trail', async () => {
      const orgA = await createOrg('lif-x5');
      const owner = await createUser('lif-x5@test.com', orgA.id, 'Owner');
      const ownerToken = await accessToken(owner.email);
      const tokenRes = await createEnrollmentToken(ownerToken, { label: 'x5' }).expect(201);

      await registerPublic({
        name: 'x5-device',
        identityFingerprint: 'finger-x5',
        enrollmentToken: tokenRes.body.token,
      }).expect(201);

      const used = await prisma.auditLog.findFirst({
        where: { orgId: orgA.id, action: 'enrollment_token_used' },
      });
      expect(used).not.toBeNull();
      expect(used!.targetId).toBe(tokenRes.body.id);

      const invitee = await createUser('lif-x5-other@test.com', orgA.id, 'Owner', false);
      await addMembership(invitee.id, orgA.id, 'Owner');
      const orgB = await createOrg('lif-x5b');
      await addMembership(owner.id, orgB.id, 'Owner');
      await addMembership(invitee.id, orgB.id, 'Owner');

      await deleteAccount(ownerToken).expect(200);

      const deletionAudit = await prisma.auditLog.findFirst({
        where: { orgId: orgB.id, action: 'account_deleted', actorId: owner.id },
      });
      expect(deletionAudit).not.toBeNull();
    });
  });
});

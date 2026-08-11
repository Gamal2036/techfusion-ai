import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS } from '../src/devices/device-presence-state';

// V1-STAGE-02-SUB-01 — Enrollment & Device Link Lifecycle.
// Proof that registration links a device to the CORRECT identity and that
// ONLINE presence means verified agent heartbeats, never the mere existence of
// a Device row:
//   * first enrollment with a single-use token;
//   * token reuse / expiry / revocation fail closed;
//   * persistent reconnect maps back to the same Device and rotates safely;
//   * duplicate/race registrations collapse to a single row;
//   * cross-tenant identity isolation;
//   * stale/never-seen rows derive UNKNOWN/OFFLINE, never ONLINE;
//   * hostname is never an identity signal (no false-merge);
//   * credential recovery requires strong identity (no hostname handover).

const sha256 = (plain: string) => crypto.createHash('sha256').update(plain).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');
const PASSWORD = 'SecureP@ssw0rd!';
const MIN = 60 * 1000;

describe('V1-STAGE-02-SUB-01 Enrollment & Device Link Lifecycle', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockQueue: MockQueueService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QueueService)
      .useClass(MockQueueService)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    mockQueue = moduleFixture.get<MockQueueService>(QueueService);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function freshOrg(slug: string) {
    return prisma.organization.create({ data: { name: slug, slug: slug + '-' + crypto.randomBytes(3).toString('hex') } });
  }

  async function ownerTokenFor(org: any) {
    const email = `owner-${crypto.randomBytes(4).toString('hex')}@test.local`;
    const user = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(PASSWORD, 4), displayName: email, orgId: org.id, role: 'Owner' },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role: 'Owner' } });
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(201);
    return login.body.accessToken as string;
  }

  async function createEnrollmentToken(orgId: string, maxUses = 1, expiresAt?: Date) {
    const raw = randomToken();
    const record = await prisma.enrollmentToken.create({
      data: { orgId, tokenHash: sha256(raw), maxUses, expiresAt: expiresAt ?? null },
    });
    return { id: record.id, raw };
  }

  function registerPublic(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post('/devices/register-public').send(body);
  }

  function ingest(token: string, overrides: Record<string, unknown> = {}) {
    return request(app.getHttpServer())
      .post('/devices/metrics')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cpu: { usage: 30, cores: 4 },
        memory: { total: 16_000, used: 8_000, percent: 50 },
        uptime: 86400,
        ...overrides,
      });
  }

  async function deviceList(token: string) {
    const res = await request(app.getHttpServer()).get('/devices').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body as any[];
  }

  const baseRegistration = (fp: string, inst: string) => ({
    name: 'Enrolled-Machine',
    hostname: 'enrolled.local',
    os: 'Ubuntu 24.04',
    osVersion: '24.04',
    cpuModel: 'Intel Core i7',
    cpuCores: 8,
    cpuLogical: 16,
    identityFingerprint: fp,
    installationId: inst,
    agentVersion: '1.0.0',
    identityVersion: 2,
  });

  beforeEach(async () => {
    mockQueue.clear();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
    await prisma.deviceMetric.deleteMany();
    await prisma.deviceHealthScore.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.device.deleteMany();
    await prisma.enrollmentToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('E1 — First enrollment', () => {
    it('registers one device with a single-use token; stores only the hash; the row does not imply ONLINE', async () => {
      const org = await freshOrg('e1');
      const owner = await ownerTokenFor(org);
      const { raw } = await createEnrollmentToken(org.id, 1);

      const res = await registerPublic({
        ...baseRegistration('fp-e1', 'inst-e1'),
        enrollmentToken: raw,
      });
      expect(res.status).toBe(201);
      expect(res.body.duplicate).toBe(false);
      const deviceId = res.body.device.id as string;
      const issuedToken = res.body.deviceToken as string;
      expect(deviceId).toBeDefined();
      expect(issuedToken).toBeDefined();

      const dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });
      expect(dbDevice?.deviceTokenHash).toBe(sha256(issuedToken));
      expect(JSON.stringify(dbDevice)).not.toContain(issuedToken);
      expect(dbDevice?.lastSeenAt).toBeNull();

      const list = await deviceList(owner);
      expect(list).toHaveLength(1);
      expect(list[0].presence).toBe('UNKNOWN');
    });

    it('rejects reuse of the same single-use enrollment token', async () => {
      const org = await freshOrg('e1-reuse');
      const { raw } = await createEnrollmentToken(org.id, 1);
      await registerPublic({ ...baseRegistration('fp-reuse', 'inst-reuse'), enrollmentToken: raw }).expect(201);

      const res = await registerPublic({
        ...baseRegistration('fp-reuse-other', 'inst-reuse-other'),
        enrollmentToken: raw,
      });
      expect(res.status).toBe(403);
    });
  });

  describe('E2 — Invalid, expired and foreign tokens fail closed', () => {
    it('rejects an unknown enrollment token', async () => {
      const org = await freshOrg('e2-unknown');
      await createEnrollmentToken(org.id, 1);
      const res = await registerPublic({
        ...baseRegistration('fp-e2u', 'inst-e2u'),
        enrollmentToken: 'tfenr_' + randomToken(),
      });
      expect(res.status).toBe(403);
    });

    it('rejects an expired enrollment token', async () => {
      const org = await freshOrg('e2-expired');
      const { raw } = await createEnrollmentToken(org.id, 1, new Date(Date.now() - MIN));
      const res = await registerPublic({
        ...baseRegistration('fp-e2x', 'inst-e2x'),
        enrollmentToken: raw,
      });
      expect(res.status).toBe(403);
    });

    it('a token belongs to its own org only (device lands in the token org, never another)', async () => {
      const orgA = await freshOrg('e2-orga');
      const orgB = await freshOrg('e2-orgb');
      const ownerB = await ownerTokenFor(orgB);
      const { raw } = await createEnrollmentToken(orgB.id, 1);

      const res = await registerPublic({
        ...baseRegistration('fp-e2b', 'inst-e2b'),
        enrollmentToken: raw,
      });
      expect(res.status).toBe(201);
      expect(res.body.device.orgId).toBe(orgB.id);

      const ownerA = await ownerTokenFor(orgA);
      const listA = await deviceList(ownerA);
      expect(listA.find((d) => d.id === res.body.device.id)).toBeUndefined();
      const listB = await deviceList(ownerB);
      expect(listB.find((d) => d.id === res.body.device.id)).toBeDefined();
    });
  });

  describe('E3 — Persistent reconnect maps to the same Device', () => {
    it('re-registration with the same identity returns the same device id and rotates the credential', async () => {
      const org = await freshOrg('e3');
      const { raw } = await createEnrollmentToken(org.id, 2);

      const first = await registerPublic({
        ...baseRegistration('fp-e3', 'inst-e3'),
        enrollmentToken: raw,
      }).expect(201);
      const firstToken = first.body.deviceToken as string;
      await ingest(firstToken).expect(201);

      const second = await registerPublic({
        ...baseRegistration('fp-e3', 'inst-e3'),
        enrollmentToken: raw,
      }).expect(201);
      expect(second.body.duplicate).toBe(true);
      expect(second.body.device.id).toBe(first.body.device.id);
      expect(second.body.deviceToken).not.toBe(firstToken);

      await ingest(firstToken).expect(401);
      await ingest(second.body.deviceToken as string).expect(201);
      expect(await prisma.device.count({ where: { orgId: org.id } })).toBe(1);
    });

    it('a restart with the stored credential reconnects to the same Device without re-registration', async () => {
      const org = await freshOrg('e3-restart');
      const { raw } = await createEnrollmentToken(org.id, 1);

      const reg = await registerPublic({
        ...baseRegistration('fp-e3r', 'inst-e3r'),
        enrollmentToken: raw,
      }).expect(201);
      const storedToken = reg.body.deviceToken as string;

      await ingest(storedToken).expect(201);
      const list = await deviceList(await ownerTokenFor(org));
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(reg.body.device.id);
      expect(list[0].presence).toBe('ONLINE');
    });
  });

  describe('E4 — Duplicate / race safety', () => {
    it('two concurrent first-time registrations with the same identity collapse to a single device', async () => {
      const org = await freshOrg('e4');
      const { raw } = await createEnrollmentToken(org.id, 2);
      const body = { ...baseRegistration('fp-e4', 'inst-e4'), enrollmentToken: raw };

      const [resA, resB] = await Promise.all([registerPublic(body), registerPublic(body)]);
      expect(resA.status).toBe(201);
      expect(resB.status).toBe(201);
      expect(resA.body.device.id).toBe(resB.body.device.id);
      expect(await prisma.device.count({ where: { orgId: org.id } })).toBe(1);

      const tokenA = resA.body.deviceToken as string;
      const tokenB = resB.body.deviceToken as string;
      const stored = await prisma.device.findUnique({ where: { id: resA.body.device.id } });
      const hashes = new Set([sha256(tokenA), sha256(tokenB)]);
      expect(hashes).toContain(stored?.deviceTokenHash);

      const winner = sha256(tokenA) === stored?.deviceTokenHash ? tokenA : tokenB;
      const loser = winner === tokenA ? tokenB : tokenA;
      await ingest(winner).expect(201);
      await ingest(loser).expect(401);
    });
  });

  describe('E5 — Cross-tenant identity isolation', () => {
    it('the same identity fingerprint in two orgs produces two distinct devices', async () => {
      const orgA = await freshOrg('e5-a');
      const orgB = await freshOrg('e5-b');
      const ownerA = await ownerTokenFor(orgA);
      const ownerB = await ownerTokenFor(orgB);
      const tokenA = (await createEnrollmentToken(orgA.id, 1)).raw;
      const tokenB = (await createEnrollmentToken(orgB.id, 1)).raw;

      const resA = await registerPublic({ ...baseRegistration('fp-shared', 'inst-shared'), enrollmentToken: tokenA }).expect(201);
      const resB = await registerPublic({ ...baseRegistration('fp-shared', 'inst-shared'), enrollmentToken: tokenB }).expect(201);
      expect(resA.body.device.id).not.toBe(resB.body.device.id);

      const listA = await deviceList(ownerA);
      const listB = await deviceList(ownerB);
      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
      expect(listA[0].id).toBe(resA.body.device.id);
      expect(listB[0].id).toBe(resB.body.device.id);

      const tokenOfA = resA.body.deviceToken as string;
      const res = await ingest(tokenOfA);
      expect(res.status).toBe(201);
      expect(res.body.metric.orgId).toBe(orgA.id);
    });
  });

  describe('E6 — Presence truthfulness & stale rows', () => {
    it('a registered-but-never-seen device derives UNKNOWN, never ONLINE', async () => {
      const org = await freshOrg('e6');
      const owner = await ownerTokenFor(org);
      const { raw } = await createEnrollmentToken(org.id, 1);
      await registerPublic({ ...baseRegistration('fp-e6', 'inst-e6'), enrollmentToken: raw }).expect(201);

      const list = await deviceList(owner);
      expect(list).toHaveLength(1);
      expect(list[0].presence).toBe('UNKNOWN');

      const summary = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${owner}`);
      expect(summary.status).toBe(200);
      expect(summary.body.fleet.total).toBe(1);
      expect(summary.body.fleet.online).toBe(0);
      expect(summary.body.fleet.unknown).toBe(1);
    });

    it('a device whose last heartbeat is older than the offline threshold derives OFFLINE', async () => {
      const org = await freshOrg('e6-off');
      const owner = await ownerTokenFor(org);
      const { raw } = await createEnrollmentToken(org.id, 1);
      const reg = await registerPublic({ ...baseRegistration('fp-e6o', 'inst-e6o'), enrollmentToken: raw }).expect(201);
      await ingest(reg.body.deviceToken as string).expect(201);

      await prisma.device.update({
        where: { id: reg.body.device.id },
        data: { lastSeenAt: new Date(Date.now() - (DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS + MIN)) },
      });

      const list = await deviceList(owner);
      expect(list[0].presence).toBe('OFFLINE');
    });

    it('an unauthenticated ingest cannot set lastSeenAt (no heartbeat, no presence)', async () => {
      const org = await freshOrg('e6-unauth');
      const owner = await ownerTokenFor(org);
      const { raw } = await createEnrollmentToken(org.id, 1);
      await registerPublic({ ...baseRegistration('fp-e6ua', 'inst-e6ua'), enrollmentToken: raw }).expect(201);

      await request(app.getHttpServer()).post('/devices/metrics').send({
        cpu: { usage: 30, cores: 4 },
        memory: { total: 16_000, used: 8_000, percent: 50 },
      }).expect(401);

      const list = await deviceList(owner);
      expect(list[0].lastSeenAt).toBeNull();
      expect(list[0].presence).toBe('UNKNOWN');
    });
  });

  describe('E7 — Hostname is not an identity signal', () => {
    it('two distinct machines with the same hostname stay separate devices (no false-merge)', async () => {
      const org = await freshOrg('e7');
      const owner = await ownerTokenFor(org);
      const tokenA = (await createEnrollmentToken(org.id, 1)).raw;
      const tokenB = (await createEnrollmentToken(org.id, 1)).raw;

      const sharedHostname = 'shared-hostname.local';
      const resA = await registerPublic({
        ...baseRegistration('fp-e7a', 'inst-e7a'),
        hostname: sharedHostname,
        enrollmentToken: tokenA,
      }).expect(201);
      const resB = await registerPublic({
        ...baseRegistration('fp-e7b', 'inst-e7b'),
        hostname: sharedHostname,
        enrollmentToken: tokenB,
      }).expect(201);

      expect(resB.body.duplicate).toBe(false);
      expect(resB.body.device.id).not.toBe(resA.body.device.id);
      expect(await prisma.device.count({ where: { orgId: org.id } })).toBe(2);

      const tokenOfA = resA.body.deviceToken as string;
      await ingest(tokenOfA).expect(201);

      const list = await deviceList(owner);
      expect(list).toHaveLength(2);
      const deviceA = await prisma.device.findUnique({ where: { id: resA.body.device.id } });
      expect(deviceA?.deviceTokenHash).toBe(sha256(tokenOfA));
    });
  });

  describe('E8 — Credential recovery requires strong identity', () => {
    it('hostname-only recovery is rejected and rotates no credential', async () => {
      const org = await freshOrg('e8');
      const { raw } = await createEnrollmentToken(org.id, 1);
      const reg = await registerPublic({
        ...baseRegistration('fp-e8', 'inst-e8'),
        enrollmentToken: raw,
      }).expect(201);
      const token = reg.body.deviceToken as string;
      const before = await prisma.device.findUnique({ where: { id: reg.body.device.id } });

      const recoveryToken = (await createEnrollmentToken(org.id, 2)).raw;
      const res = await request(app.getHttpServer())
        .post('/devices/recover-credential')
        .set('x-org-token', recoveryToken)
        .send({ hostname: 'enrolled.local' });
      expect(res.status).toBe(201);
      expect(res.body.code).toBe('IDENTITY_REQUIRED');
      expect(res.body.deviceToken).toBeUndefined();

      const after = await prisma.device.findUnique({ where: { id: reg.body.device.id } });
      expect(after?.deviceTokenHash).toBe(before?.deviceTokenHash);
      await ingest(token).expect(201);
    });

    it('fingerprint-based recovery rotates the credential for the matching device only', async () => {
      const org = await freshOrg('e8-fp');
      const { raw } = await createEnrollmentToken(org.id, 1);
      const reg = await registerPublic({
        ...baseRegistration('fp-e8fp', 'inst-e8fp'),
        enrollmentToken: raw,
      }).expect(201);
      const oldToken = reg.body.deviceToken as string;
      await ingest(oldToken).expect(201);

      const recoveryToken = (await createEnrollmentToken(org.id, 2)).raw;
      const res = await request(app.getHttpServer())
        .post('/devices/recover-credential')
        .set('x-org-token', recoveryToken)
        .send({ identityFingerprint: 'fp-e8fp' })
        .expect(201);
      expect(res.body.device.id).toBe(reg.body.device.id);
      expect(res.body.deviceToken).not.toBe(oldToken);

      await ingest(oldToken).expect(401);
      await ingest(res.body.deviceToken as string).expect(201);
    });
  });
});

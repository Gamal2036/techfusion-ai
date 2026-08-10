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

const hashToken = (plain: string) => crypto.createHash('sha256').update(plain).digest('hex');
const MIN = 60 * 1000;

describe('PRES-01 Presence, Telemetry & Online/Offline Reliability', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockQueue: MockQueueService;

  let orgA: any;
  let orgB: any;
  let userA: any;
  let userB: any;
  let ownerTokenA: string;
  let deviceA1: any;
  let deviceA2: any;
  let deviceB1: any;

  const PASSWORD = 'SecureP@ssw0rd!';

  function validMetrics(overrides: Record<string, unknown> = {}) {
    return {
      cpu: { usage: 42.5, cores: 8 },
      memory: { total: 16_000_000_000, used: 8_000_000_000, percent: 50 },
      disk: { total: 1_000_000_000_000, used: 500_000_000_000 },
      uptime: 86_400,
      processes: 240,
      ...overrides,
    };
  }

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

  beforeEach(async () => {
    mockQueue.clear();
    await prisma.deviceMetric.deleteMany();
    await prisma.deviceHealthScore.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.device.deleteMany();
    await prisma.enrollmentToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);

    orgA = await prisma.organization.create({
      data: { name: 'Presence Org A', slug: 'pres-a-' + crypto.randomBytes(3).toString('hex') },
    });
    orgB = await prisma.organization.create({
      data: { name: 'Presence Org B', slug: 'pres-b-' + crypto.randomBytes(3).toString('hex') },
    });

    const hash = await bcrypt.hash(PASSWORD, 4);
    userA = await prisma.user.create({
      data: { email: 'presence-a@test.local', passwordHash: hash, displayName: 'User A', orgId: orgA.id, role: 'Owner' },
    });
    userB = await prisma.user.create({
      data: { email: 'presence-b@test.local', passwordHash: hash, displayName: 'User B', orgId: orgB.id, role: 'Owner' },
    });
    await prisma.organizationMember.createMany({
      data: [
        { userId: userA.id, orgId: orgA.id, role: 'Owner' },
        { userId: userB.id, orgId: orgB.id, role: 'Owner' },
      ],
    });

    const rawA1 = 'pres-token-a1-' + crypto.randomBytes(6).toString('hex');
    const rawA2 = 'pres-token-a2-' + crypto.randomBytes(6).toString('hex');
    const rawB1 = 'pres-token-b1-' + crypto.randomBytes(6).toString('hex');
    deviceA1 = await prisma.device.create({
      data: {
        name: 'Device A1',
        hostname: 'a1.pres.test',
        orgId: orgA.id,
        deviceTokenHash: hashToken(rawA1),
      },
    });
    deviceA2 = await prisma.device.create({
      data: {
        name: 'Device A2',
        hostname: 'a2.pres.test',
        orgId: orgA.id,
        deviceTokenHash: hashToken(rawA2),
      },
    });
    deviceB1 = await prisma.device.create({
      data: {
        name: 'Device B1',
        hostname: 'b1.pres.test',
        orgId: orgB.id,
        deviceTokenHash: hashToken(rawB1),
      },
    });
    deviceA1 = { ...deviceA1, deviceToken: rawA1 };
    deviceA2 = { ...deviceA2, deviceToken: rawA2 };
    deviceB1 = { ...deviceB1, deviceToken: rawB1 };

    const loginA = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'presence-a@test.local', password: PASSWORD });
    expect(loginA.status).toBe(201);
    ownerTokenA = loginA.body.accessToken;
  });

  async function ingest(token: string, body: unknown) {
    return request(app.getHttpServer())
      .post('/devices/metrics')
      .set('Authorization', `Bearer ${token}`)
      .send(body as any);
  }

  async function deviceList(token: string) {
    const res = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body as any[];
  }

  describe('P — Presence freshness & online/offline derivation', () => {
    it('P1: authenticated telemetry freshens the device and shows ONLINE', async () => {
      const before = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });

      const res = await ingest(deviceA1.deviceToken, validMetrics());
      expect(res.status).toBe(201);

      const after = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });
      expect(after.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before.lastSeenAt.getTime());

      const list = await deviceList(ownerTokenA);
      const entry = list.find((d) => d.id === deviceA1.id);
      expect(entry).toBeDefined();
      expect(entry.presence).toBe('ONLINE');
    });

    it('P2: unauthenticated telemetry is rejected and cannot freshen presence', async () => {
      const before = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });

      const res = await request(app.getHttpServer())
        .post('/devices/metrics')
        .send(validMetrics());
      expect(res.status).toBe(401);

      const after = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });
      expect(after.lastSeenAt.getTime()).toBe(before.lastSeenAt.getTime());
    });

    it('P3: one device credential cannot affect another device', async () => {
      const beforeA1 = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });
      const beforeA2 = await prisma.device.findUniqueOrThrow({ where: { id: deviceA2.id } });

      const res = await ingest(deviceA2.deviceToken, validMetrics());
      expect(res.status).toBe(201);

      const afterA1 = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });
      const afterA2 = await prisma.device.findUniqueOrThrow({ where: { id: deviceA2.id } });
      expect(afterA1.lastSeenAt.getTime()).toBe(beforeA1.lastSeenAt.getTime());
      expect(afterA2.lastSeenAt.getTime()).toBeGreaterThan(beforeA2.lastSeenAt.getTime());
    });

    it('P4: activity in Org A cannot affect a device in Org B', async () => {
      const beforeB1 = await prisma.device.findUniqueOrThrow({ where: { id: deviceB1.id } });

      const res = await ingest(deviceA1.deviceToken, validMetrics());
      expect(res.status).toBe(201);

      const afterB1 = await prisma.device.findUniqueOrThrow({ where: { id: deviceB1.id } });
      expect(afterB1.lastSeenAt.getTime()).toBe(beforeB1.lastSeenAt.getTime());
    });

    it('O1: a device quiet beyond the offline threshold derives OFFLINE', async () => {
      await prisma.device.update({
        where: { id: deviceA1.id },
        data: { lastSeenAt: new Date(Date.now() - (DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS + MIN)) },
      });

      const list = await deviceList(ownerTokenA);
      const entry = list.find((d) => d.id === deviceA1.id);
      expect(entry.presence).toBe('OFFLINE');
    });

    it('O2: an OFFLINE device remains listed (record is not deleted)', async () => {
      await prisma.device.update({
        where: { id: deviceA1.id },
        data: { lastSeenAt: new Date(Date.now() - (DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS + MIN)) },
      });

      const list = await deviceList(ownerTokenA);
      expect(list.find((d) => d.id === deviceA1.id)).toBeDefined();
      expect(list.length).toBe(2);
    });

    it('O3: historical metrics remain after the device goes OFFLINE', async () => {
      const ingestRes = await ingest(deviceA1.deviceToken, validMetrics());
      expect(ingestRes.status).toBe(201);

      await prisma.device.update({
        where: { id: deviceA1.id },
        data: { lastSeenAt: new Date(Date.now() - (DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS + MIN)) },
      });

      const list = await deviceList(ownerTokenA);
      const entry = list.find((d) => d.id === deviceA1.id);
      expect(entry.presence).toBe('OFFLINE');

      const metrics = await prisma.deviceMetric.count({ where: { deviceId: deviceA1.id } });
      expect(metrics).toBeGreaterThanOrEqual(1);
    });

    it('O4: fresh activity returns the same device to ONLINE (same device id)', async () => {
      await prisma.device.update({
        where: { id: deviceA1.id },
        data: { lastSeenAt: new Date(Date.now() - (DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS + MIN)) },
      });

      const stale = await deviceList(ownerTokenA);
      expect(stale.find((d) => d.id === deviceA1.id).presence).toBe('OFFLINE');

      const res = await ingest(deviceA1.deviceToken, validMetrics());
      expect(res.status).toBe(201);

      const fresh = await deviceList(ownerTokenA);
      const entry = fresh.find((d) => d.id === deviceA1.id);
      expect(entry.presence).toBe('ONLINE');
      expect(fresh.filter((d) => d.presence === 'ONLINE').length).toBe(2);
    });
  });

  describe('T — Telemetry ingestion safety', () => {
    it('T1: valid nested telemetry is accepted and persisted', async () => {
      const res = await ingest(deviceA1.deviceToken, validMetrics());
      expect(res.status).toBe(201);
      expect(res.body.metric).toBeDefined();
      expect(res.body.metric.cpuUsage).toBe(42.5);

      const metric = await prisma.deviceMetric.findFirstOrThrow({
        where: { deviceId: deviceA1.id },
      });
      expect(metric.cpuUsage).toBeCloseTo(42.5, 1);
      expect(metric.orgId).toBe(orgA.id);
    });

    it('T2: an unknown/invalid credential is rejected with 401', async () => {
      const res = await ingest('pres-token-does-not-exist', validMetrics());
      expect(res.status).toBe(401);
    });

    it('T3: telemetry is attributed to the authenticated device regardless of body fields', async () => {
      const res = await ingest(deviceA1.deviceToken, {
        ...validMetrics(),
        deviceId: deviceA2.id,
        orgId: orgB.id,
      });
      expect(res.status).toBe(201);

      const metric = await prisma.deviceMetric.findFirstOrThrow({
        where: { deviceId: deviceA1.id },
      });
      expect(metric.orgId).toBe(orgA.id);
      const crossWrites = await prisma.deviceMetric.count({
        where: { deviceId: deviceA2.id },
      });
      expect(crossWrites).toBe(0);
    });

    it('T4: metrics written by an Org A device never land in Org B', async () => {
      const res = await ingest(deviceA1.deviceToken, validMetrics());
      expect(res.status).toBe(201);

      const orgBMetrics = await prisma.deviceMetric.count({ where: { orgId: orgB.id } });
      expect(orgBMetrics).toBe(0);
    });

    it('T5a: out-of-range CPU usage is rejected as a 4xx', async () => {
      const res = await ingest(deviceA1.deviceToken, validMetrics({ cpu: { usage: 150, cores: 8 } }));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('T5b: a malformed client timestamp is rejected as a 4xx (never a 500)', async () => {
      const res = await ingest(deviceA1.deviceToken, validMetrics({ timestamp: 'not-a-date' }));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('T5c: a non-numeric CPU usage is rejected as a 4xx', async () => {
      const res = await ingest(deviceA1.deviceToken, validMetrics({ cpu: { usage: 'high', cores: 8 } }));
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it('T6: client-supplied timestamps cannot bypass server presence freshness', async () => {
      const resFuture = await ingest(
        deviceA1.deviceToken,
        validMetrics({ timestamp: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString() }),
      );
      expect(resFuture.status).toBe(201);

      const future = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });
      expect(Math.abs(Date.now() - future.lastSeenAt.getTime())).toBeLessThan(30_000);
      expect(future.lastSeenAt.getTime()).toBeLessThan(Date.now());

      const resPast = await ingest(
        deviceA1.deviceToken,
        validMetrics({ timestamp: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString() }),
      );
      expect(resPast.status).toBe(201);

      const past = await prisma.device.findUniqueOrThrow({ where: { id: deviceA1.id } });
      expect(Math.abs(Date.now() - past.lastSeenAt.getTime())).toBeLessThan(30_000);

      const list = await deviceList(ownerTokenA);
      expect(list.find((d) => d.id === deviceA1.id).presence).toBe('ONLINE');
    });
  });

  describe('D — Dashboard fleet state', () => {
    it('D1: summary online/degraded/offline counts match per-device derivation', async () => {
      await ingest(deviceA1.deviceToken, validMetrics());
      await prisma.device.update({
        where: { id: deviceA2.id },
        data: { lastSeenAt: new Date(Date.now() - (DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS + MIN)) },
      });

      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${ownerTokenA}`);
      expect(res.status).toBe(200);

      const { fleet } = res.body;
      expect(fleet.total).toBe(2);
      expect(fleet.online).toBe(1);
      expect(fleet.degraded).toBe(0);
      expect(fleet.offline).toBe(1);
    });

    it('D2: summary recovers after fresh telemetry from a previously offline device', async () => {
      await prisma.device.update({
        where: { id: deviceA2.id },
        data: { lastSeenAt: new Date(Date.now() - (DEVICE_PRESENCE_OFFLINE_THRESHOLD_MS + MIN)) },
      });

      await ingest(deviceA1.deviceToken, validMetrics());

      const before = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${ownerTokenA}`);
      expect(before.body.fleet.online).toBe(1);
      expect(before.body.fleet.offline).toBe(1);

      await ingest(deviceA2.deviceToken, validMetrics());

      const after = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${ownerTokenA}`);
      expect(after.body.fleet.online).toBe(2);
      expect(after.body.fleet.offline).toBe(0);
    });

    it('D3: an org summary excludes devices belonging to other orgs', async () => {
      await ingest(deviceA1.deviceToken, validMetrics());
      await ingest(deviceA2.deviceToken, validMetrics());
      await ingest(deviceB1.deviceToken, validMetrics());

      const res = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .set('Authorization', `Bearer ${ownerTokenA}`);
      expect(res.body.fleet.total).toBe(2);
      const ids = res.body.fleet.recentDevices.map((d: any) => d.id);
      expect(ids).not.toContain(deviceB1.id);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as crypto from 'crypto';

// V1-STAGE-01-SUB-04 — Device Metrics / Telemetry Authentication & Secret Boundary.
// Proof that POST /devices/metrics enforces a server-authoritative trust boundary:
//   * metrics are accepted only from a verified device credential (SHA-256 verifier);
//   * authenticated device identity (req.device.id / req.device.orgId) is authoritative;
//   * client-supplied deviceId/orgId/credential fields can never impersonate or re-scope;
//   * revoked/rotated credentials fail closed;
//   * malformed telemetry (timestamp / numerics) fails deterministically (4xx, never 500);
//   * raw credentials never appear in logs/errors/responses.

const sha256 = (plain: string) => crypto.createHash('sha256').update(plain).digest('hex');

describe('MET-01 Device Metrics Security (V1-STAGE-01-SUB-04)', () => {
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

  async function createEnrollmentToken(orgId: string, maxUses: number = 1) {
    const raw = crypto.randomBytes(32).toString('hex');
    const record = await prisma.enrollmentToken.create({
      data: { orgId, tokenHash: sha256(raw), maxUses },
    });
    return { id: record.id, raw };
  }

  async function createDeviceWithHash(orgId: string, name: string, token: string, extra: Record<string, any> = {}) {
    return prisma.device.create({
      data: { orgId, name, deviceTokenHash: sha256(token), ...extra },
    });
  }

  function validMetrics() {
    return {
      timestamp: new Date().toISOString(),
      cpu: { usage: 42, cores: 8 },
      memory: { total: 16000, used: 8000, percent: 50 },
      disk: { total: 512000, used: 256000, readBytes: 1024, writeBytes: 512 },
      network: { rxBytes: 2048, txBytes: 1024 },
      uptime: 86400,
    };
  }

  function ingest(token: string | undefined, body: any = validMetrics()) {
    const req = request(app.getHttpServer()).post('/devices/metrics').send(body);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  async function countMetricsFor(deviceId: string) {
    return prisma.deviceMetric.count({ where: { deviceId } });
  }

  const server = () => app.getHttpServer();

  describe('Authentication fail-closed', () => {
    it('01: accepts metrics only from an authenticated hashed device credential', async () => {
      const org = await createOrg('m-valid');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Valid-A', token);

      await ingest(token).expect(201);
    });

    it('02: rejects an invalid credential with 401', async () => {
      const org = await createOrg('m-invalid');
      await createDeviceWithHash(org.id, 'Valid-B', crypto.randomBytes(32).toString('hex'));

      await ingest(crypto.randomBytes(32).toString('hex')).expect(401);
    });

    it('03: a plaintext-only legacy credential cannot authenticate (hash-only, no fallback)', async () => {
      const org = await createOrg('m-legacy');
      const stored = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Legacy-Device', stored);

      const legacyPlaintext = 'legacy-plaintext-device-token';
      await ingest(legacyPlaintext).expect(401);

      const dbDevice = await prisma.device.findFirst({ where: { orgId: org.id } });
      expect(JSON.stringify(dbDevice)).not.toContain(legacyPlaintext);
      expect(dbDevice?.deviceTokenHash).toBe(sha256(stored));
    });

    it('04: a device with no stored verifier (missing hash) fails closed with 401', async () => {
      const org = await createOrg('m-null-verifier');
      await prisma.device.create({
        data: { orgId: org.id, name: 'No-Verifier', deviceTokenHash: null },
      });

      await ingest(crypto.randomBytes(32).toString('hex')).expect(401);
    });

    it('05: an old credential after rotation fails closed (401); the new credential works', async () => {
      const org = await createOrg('m-rotate');
      const { raw } = await createEnrollmentToken(org.id);
      const oldToken = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Rotate-M', oldToken, { identityFingerprint: 'fp-m-rotate' });

      await ingest(oldToken).expect(201);

      const recovery = await request(server())
        .post('/devices/recover-credential')
        .set('x-org-token', raw)
        .send({ identityFingerprint: 'fp-m-rotate' })
        .expect(201);
      const newToken = recovery.body.deviceToken as string;
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);

      await ingest(oldToken).expect(401);
      await ingest(newToken).expect(201);
    });
  });

  describe('Authenticated device identity is authoritative', () => {
    it('06: a valid Device B token cannot write metrics as Device A via body deviceId', async () => {
      const orgA = await createOrg('m-a');
      const orgB = await createOrg('m-b');
      const tokenA = crypto.randomBytes(32).toString('hex');
      const tokenB = crypto.randomBytes(32).toString('hex');
      const deviceA = await createDeviceWithHash(orgA.id, 'Device-A', tokenA);
      const deviceB = await createDeviceWithHash(orgB.id, 'Device-B', tokenB);

      const res = await ingest(tokenB, {
        ...validMetrics(),
        deviceId: deviceA.id,
        orgId: orgA.id,
      }).expect(201);

      expect(res.body.metric.deviceId).toBe(deviceB.id);
      expect(res.body.metric.orgId).toBe(orgB.id);
      expect(await countMetricsFor(deviceA.id)).toBe(0);
      expect(await countMetricsFor(deviceB.id)).toBe(1);
    });

    it('07: a forged orgId in the body cannot re-scope telemetry to another organization', async () => {
      const orgReal = await createOrg('m-real');
      const orgForged = await createOrg('m-forged');
      const token = crypto.randomBytes(32).toString('hex');
      const device = await createDeviceWithHash(orgReal.id, 'Real-Device', token);

      const res = await ingest(token, {
        ...validMetrics(),
        orgId: orgForged.id,
      }).expect(201);

      expect(res.body.metric.orgId).toBe(orgReal.id);
      expect(await prisma.deviceMetric.count({ where: { orgId: orgForged.id } })).toBe(0);
      expect(await prisma.deviceMetric.count({ where: { orgId: orgReal.id, deviceId: device.id } })).toBe(1);
    });

    it('08: malformed timestamps produce a controlled 4xx, not 500', async () => {
      const org = await createOrg('m-ts');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Ts-Device', token);

      await ingest(token, { ...validMetrics(), timestamp: 'not-a-date' }).expect(400);
      await ingest(token, { ...validMetrics(), timestamp: '2026-13-01T00:00:00Z' }).expect(400);
      await ingest(token, { ...validMetrics(), timestamp: 1234567890 }).expect(400);
    });

    it('09: fractional/overflowing numeric telemetry fails with 4xx, never 500', async () => {
      const org = await createOrg('m-num');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Num-Device', token);

      await ingest(token, { ...validMetrics(), disk: { readBytes: 1.5 } }).expect(400);
      await ingest(token, { ...validMetrics(), disk: { writeBytes: 1.5 } }).expect(400);
      await ingest(token, { ...validMetrics(), network: { rxBytes: 1.5 } }).expect(400);
      await ingest(token, { ...validMetrics(), network: { txBytes: 1.5 } }).expect(400);
      await ingest(token, { ...validMetrics(), gpu: { memoryUsed: 1.5 } }).expect(400);
      await ingest(token, { ...validMetrics(), uptime: 1.5 }).expect(400);
    });

    it('10: a non-numeric fans.rpm fails with 4xx, never 500 (validated nested DTO)', async () => {
      const org = await createOrg('m-fans');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Fans-Device', token);

      await ingest(token, { ...validMetrics(), fans: { rpm: 'abc' } }).expect(400);
      await ingest(token, { ...validMetrics(), fans: { rpm: -5 } }).expect(400);
      await ingest(token, { ...validMetrics(), fans: { rpm: 1500 } }).expect(201);
    });

    it('11: out-of-range telemetry values fail with 4xx, not 500', async () => {
      const org = await createOrg('m-range');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Range-Device', token);

      await ingest(token, { ...validMetrics(), cpu: { usage: 150, cores: 8 } }).expect(400);
      await ingest(token, { ...validMetrics(), memory: { total: 16000, used: 8000, percent: 150 } }).expect(400);
      await ingest(token, { ...validMetrics(), cpu: { usage: 'not-a-number' } }).expect(400);
    });
  });

  describe('Authoritative storage and secret hygiene', () => {
    it('12: valid telemetry is stored under the authenticated device and org', async () => {
      const org = await createOrg('m-store');
      const token = crypto.randomBytes(32).toString('hex');
      const device = await createDeviceWithHash(org.id, 'Store-Device', token);
      const before = device.lastSeenAt;

      const res = await ingest(token).expect(201);
      const metric = await prisma.deviceMetric.findUnique({ where: { id: res.body.metric.id } });
      expect(metric?.deviceId).toBe(device.id);
      expect(metric?.orgId).toBe(org.id);

      const score = await prisma.deviceHealthScore.findUnique({ where: { id: res.body.score.id } });
      expect(score?.deviceId).toBe(device.id);
      expect(score?.orgId).toBe(org.id);

      const after = await prisma.device.findUnique({ where: { id: device.id } });
      expect(after?.lastSeenAt).toBeDefined();
      expect(before === null || after!.lastSeenAt! >= before).toBe(true);
    });

    it('13: cross-tenant — Device B (org B) cannot store metrics under Device A (org A)', async () => {
      const orgA = await createOrg('m-x-a');
      const orgB = await createOrg('m-x-b');
      const tokenA = crypto.randomBytes(32).toString('hex');
      const tokenB = crypto.randomBytes(32).toString('hex');
      const deviceA = await createDeviceWithHash(orgA.id, 'XA', tokenA);
      const deviceB = await createDeviceWithHash(orgB.id, 'XB', tokenB);

      await ingest(tokenB, {
        ...validMetrics(),
        deviceId: deviceA.id,
      }).expect(201);

      const bRows = await prisma.deviceMetric.findMany({ where: { deviceId: deviceB.id } });
      expect(bRows.length).toBe(1);
      expect(bRows[0].orgId).toBe(orgB.id);
      expect(await prisma.deviceMetric.count({ where: { deviceId: deviceA.id } })).toBe(0);
      expect(await prisma.deviceMetric.count({ where: { orgId: orgA.id } })).toBe(0);
    });
  });

  describe('Malformed telemetry fails deterministically (4xx, never 500)', () => {
    it('14: raw credential never appears in an error response or in the accepted response', async () => {
      const org = await createOrg('m-secret');
      const stored = crypto.randomBytes(32).toString('hex');
      const presented = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Secret-Device', stored);

      const rejected = await ingest(presented);
      expect(rejected.status).toBe(401);
      expect(JSON.stringify(rejected.body)).not.toContain(presented);
      expect(JSON.stringify(rejected.body)).not.toContain(stored);

      const accepted = await ingest(stored);
      expect(accepted.status).toBe(201);
      expect(JSON.stringify(accepted.body)).not.toContain(stored);
    });

    it('15: a client-supplied deviceToken body field is ignored and never echoed', async () => {
      const org = await createOrg('m-body-token');
      const stored = crypto.randomBytes(32).toString('hex');
      const bogus = crypto.randomBytes(32).toString('hex');
      const device = await createDeviceWithHash(org.id, 'BodyToken-Device', stored);

      const res = await ingest(stored, {
        ...validMetrics(),
        deviceToken: bogus,
      }).expect(201);

      expect(JSON.stringify(res.body)).not.toContain(bogus);
      expect(res.body.metric.deviceId).toBe(device.id);
      const metric = await prisma.deviceMetric.findUnique({ where: { id: res.body.metric.id } });
      const json = JSON.stringify(metric, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
      expect(json).not.toContain(bogus);
      expect(metric?.deviceToken).toBeUndefined();
      expect(await prisma.deviceMetric.count({ where: { deviceId: device.id } })).toBe(1);
    });
  });
});

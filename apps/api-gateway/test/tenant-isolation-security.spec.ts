import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';

const hashToken = (plain: string) => crypto.createHash('sha256').update(plain).digest('hex');

describe('ORG-01B Tenant Isolation & Ingestion Security', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockQueue: MockQueueService;

  let orgA: any;
  let orgB: any;
  let userA: any;
  let userB: any;
  let deviceA: any;
  let deviceB: any;
  let tokenA: string;
  let tokenB: string;

  const A = {
    email: 'orga@tenant-isolation.test',
    password: 'SecureP@ssw0rd!',
  };
  const B = {
    email: 'orgb@tenant-isolation.test',
    password: 'SecureP@ssw0rd!',
  };

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
    await prisma.networkDevice.deleteMany();
    await prisma.networkScan.deleteMany();
    await prisma.securityFinding.deleteMany();
    await prisma.securityScore.deleteMany();
    await prisma.securityScan.deleteMany();
    await prisma.softwareInventory.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.device.deleteMany();
    await prisma.enrollmentToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);

    orgA = await prisma.organization.create({ data: { name: 'Isolation Org A', slug: 'iso-a-' + crypto.randomBytes(3).toString('hex') } });
    orgB = await prisma.organization.create({ data: { name: 'Isolation Org B', slug: 'iso-b-' + crypto.randomBytes(3).toString('hex') } });

    const hash = await bcrypt.hash('SecureP@ssw0rd!', 4);
    userA = await prisma.user.create({
      data: { email: A.email, passwordHash: hash, displayName: 'User A', orgId: orgA.id, role: 'Owner' },
    });
    userB = await prisma.user.create({
      data: { email: B.email, passwordHash: hash, displayName: 'User B', orgId: orgB.id, role: 'Owner' },
    });
    await prisma.organizationMember.createMany({
      data: [
        { userId: userA.id, orgId: orgA.id, role: 'Owner' },
        { userId: userB.id, orgId: orgB.id, role: 'Owner' },
      ],
    });

    deviceA = await prisma.device.create({
      data: {
        name: 'Device A',
        hostname: 'device-a.iso.test',
        orgId: orgA.id,
        deviceToken: 'dev-token-a-' + crypto.randomBytes(6).toString('hex'),
      },
    });
    deviceB = await prisma.device.create({
      data: {
        name: 'Device B',
        hostname: 'device-b.iso.test',
        orgId: orgB.id,
        deviceToken: 'dev-token-b-' + crypto.randomBytes(6).toString('hex'),
      },
    });

    tokenA = deviceA.deviceToken;
    tokenB = deviceB.deviceToken;
  });

  async function loginAs(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'SecureP@ssw0rd!' });
    expect(res.status).toBe(201);
    return res.body.accessToken;
  }

  describe('F1 — Inventory ingestion (POST /inventory/report)', () => {
    it('A: rejects unauthenticated write with forged X-Org-Id', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/report')
        .set('x-org-id', orgA.id)
        .send({ drivers: [], software: [] });
      expect(res.status).toBe(401);
      expect(mockQueue.getJobs().filter((j: any) => j.type === 'inventory_ingest')).toHaveLength(0);
    });

    it('B: rejects unauthenticated write with forged body.orgId', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/report')
        .send({ orgId: orgA.id, drivers: [], software: [] });
      expect(res.status).toBe(401);
      expect(mockQueue.getJobs().filter((j: any) => j.type === 'inventory_ingest')).toHaveLength(0);
    });

    it('E: rejects invalid device token + forged org', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/report')
        .set('Authorization', 'Bearer invalid-token')
        .set('x-org-id', orgA.id)
        .send({ drivers: [], software: [] });
      expect(res.status).toBe(401);
    });

    it('D: rejects Device A token with Org B X-Org-Id header', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/report')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-org-id', orgB.id)
        .send({ drivers: [], software: [] });
      expect(res.status).toBe(403);
      expect(mockQueue.getJobs().filter((j: any) => j.type === 'inventory_ingest')).toHaveLength(0);
    });

    it('D: rejects Device A token with Org B body.orgId', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/report')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ orgId: orgB.id, drivers: [], software: [] });
      expect(res.status).toBe(403);
      expect(mockQueue.getJobs().filter((j: any) => j.type === 'inventory_ingest')).toHaveLength(0);
    });

    it('F: rejects Device A token with Device B payload deviceId', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/report')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ deviceId: deviceB.id, drivers: [], software: [] });
      expect(res.status).toBe(403);
      expect(mockQueue.getJobs().filter((j: any) => j.type === 'inventory_ingest')).toHaveLength(0);
    });

    it('PASS: Device A legitimate report is accepted under Org A', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/report')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          deviceId: deviceA.id,
          xOrgId: orgA.id,
          drivers: [{ name: 'nvidia', version: '1.0' }],
          software: [{ name: 'nginx', version: '1.24' }],
        });
      expect(res.status).toBe(201);
      expect(res.body.orgId).toBe(orgA.id);
      expect(res.body.deviceId).toBe(deviceA.id);
      const jobs = mockQueue.getJobs().filter((j: any) => j.type === 'inventory_ingest');
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data.orgId).toBe(orgA.id);
      expect(jobs[0].data.deviceId).toBe(deviceA.id);
    });
  });

  describe('F2 — Network discovery ingestion (POST /network/discovery)', () => {
    it('A: rejects unauthenticated write with forged X-Org-Id', async () => {
      const res = await request(app.getHttpServer())
        .post('/network/discovery')
        .set('x-org-id', orgA.id)
        .send({ gatewayIp: '192.168.1.1' });
      expect(res.status).toBe(401);
    });

    it('B: rejects unauthenticated write with forged body.orgId', async () => {
      const res = await request(app.getHttpServer())
        .post('/network/discovery')
        .send({ orgId: orgA.id, gatewayIp: '192.168.1.1' });
      expect(res.status).toBe(401);
    });

    it('E: rejects invalid token + forged org', async () => {
      const res = await request(app.getHttpServer())
        .post('/network/discovery')
        .set('Authorization', 'Bearer invalid-token')
        .set('x-org-id', orgA.id)
        .send({ gatewayIp: '192.168.1.1' });
      expect(res.status).toBe(401);
    });

    it('D: rejects Device A token with Org B X-Org-Id header', async () => {
      const res = await request(app.getHttpServer())
        .post('/network/discovery')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-org-id', orgB.id)
        .send({ gatewayIp: '192.168.1.1' });
      expect(res.status).toBe(403);
    });

    it('D: rejects Device A token with Org B body.orgId', async () => {
      const res = await request(app.getHttpServer())
        .post('/network/discovery')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ orgId: orgB.id, gatewayIp: '192.168.1.1' });
      expect(res.status).toBe(403);
    });

    it('PASS: Device A legitimate discovery writes into Org A only', async () => {
      const res = await request(app.getHttpServer())
        .post('/network/discovery')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          gatewayIp: '10.0.0.1',
          devices: [{ ip: '10.0.0.50', mac: 'aa:bb:cc:dd:ee:ff' }],
        });
      expect(res.status).toBe(201);
      const scan = await prisma.networkScan.findFirst({ where: { orgId: orgA.id } });
      expect(scan).toBeDefined();
      expect(await prisma.networkScan.count({ where: { orgId: orgB.id } })).toBe(0);
      const dev = await prisma.networkDevice.findFirst({ where: { ip: '10.0.0.50' } });
      expect(dev?.orgId).toBe(orgA.id);
    });
  });

  describe('F2 — Network scan ownership (status/result/pending)', () => {
    it('rejects unauthenticated pending-command poll', async () => {
      const res = await request(app.getHttpServer()).get('/network/discovery/pending');
      expect(res.status).toBe(401);
    });

    it('returns only Org A pending commands for Device A', async () => {
      await prisma.networkScan.create({ data: { orgId: orgA.id, deviceId: deviceA.id, status: 'pending' } });
      await prisma.networkScan.create({ data: { orgId: orgB.id, deviceId: deviceB.id, status: 'pending' } });
      const res = await request(app.getHttpServer())
        .get('/network/discovery/pending')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].orgId).toBe(orgA.id);
    });

    it('rejects Device A completing a scan owned by Org B / Device B', async () => {
      const scanB = await prisma.networkScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'pending' },
      });
      const res = await request(app.getHttpServer())
        .post('/network/discovery/status')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanB.id, status: 'running' });
      expect(res.status).toBe(403);
      expect((await prisma.networkScan.findUnique({ where: { id: scanB.id } }))?.status).toBe('pending');
    });

    it('rejects Device A reporting a result for a scan owned by Org B', async () => {
      const scanB = await prisma.networkScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'pending' },
      });
      const res = await request(app.getHttpServer())
        .post('/network/discovery/result')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanB.id, devices: [{ ip: '10.9.9.9' }] });
      expect(res.status).toBe(403);
    });

    it('allows Device A to complete its own Org A scan', async () => {
      const scanA = await prisma.networkScan.create({
        data: { orgId: orgA.id, deviceId: deviceA.id, status: 'pending' },
      });
      const res = await request(app.getHttpServer())
        .post('/network/discovery/status')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanA.id, status: 'running' });
      expect([200, 201]).toContain(res.status);
      expect((await prisma.networkScan.findUnique({ where: { id: scanA.id } }))?.status).toBe('running');
    });
  });

  describe('Security ingestion (pending/scan-result)', () => {
    it('rejects unauthenticated pending-scan poll', async () => {
      const res = await request(app.getHttpServer()).get(`/security/pending/${deviceA.id}`);
      expect(res.status).toBe(401);
    });

    it('rejects Device A polling pending scans for Device B', async () => {
      const res = await request(app.getHttpServer())
        .get(`/security/pending/${deviceB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(403);
    });

    it('rejects Device A completing a scan owned by Org B / Device B', async () => {
      const scanB = await prisma.securityScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'pending' },
      });
      const res = await request(app.getHttpServer())
        .post('/security/scan-result')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanB.id, findings: [] });
      expect(res.status).toBe(403);
    });

    it('allows Device A to complete its own Org A scan', async () => {
      const scanA = await prisma.securityScan.create({
        data: { orgId: orgA.id, deviceId: deviceA.id, status: 'pending' },
      });
      const res = await request(app.getHttpServer())
        .post('/security/scan-result')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanA.id, findings: [] });
      expect([200, 201]).toContain(res.status);
    });
  });

  describe('Cross-tenant human reads', () => {
    it('Org A user cannot read Org B device', async () => {
      const token = await loginAs(A.email);
      const res = await request(app.getHttpServer())
        .get(`/devices/${deviceB.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('Org A user cannot read Org B network scans', async () => {
      await prisma.networkScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'completed', gatewayIp: '192.168.99.1' },
      });
      const token = await loginAs(A.email);
      const res = await request(app.getHttpServer())
        .get('/network/scans/latest')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body).toEqual({});
    });

    it('Org A user cannot read Org B security scan detail', async () => {
      const scanB = await prisma.securityScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'completed' },
      });
      const token = await loginAs(A.email);
      const res = await request(app.getHttpServer())
        .get(`/security/scans/detail/${scanB.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('Cross-tenant human writes', () => {
    it('Org A user cannot trigger discovery on Org B device', async () => {
      const token = await loginAs(A.email);
      const res = await request(app.getHttpServer())
        .post('/network/discovery/trigger')
        .set('Authorization', `Bearer ${token}`)
        .send({ deviceId: deviceB.id });
      expect(res.status).toBe(404);
    });

    it('Org A user cannot trigger security scan on Org B device', async () => {
      const token = await loginAs(A.email);
      const res = await request(app.getHttpServer())
        .post(`/security/scans/${deviceB.id}/trigger`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('Enrollment binding', () => {
    it('client-provided orgId cannot override EnrollmentToken org', async () => {
      const plain = crypto.randomBytes(32).toString('hex');
      const prefixed = `tfenr_${plain}`;
      await prisma.enrollmentToken.create({
        data: {
          orgId: orgA.id,
          tokenHash: hashToken(plain),
          label: 'isolation-test',
          maxUses: 5,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/devices/register-public')
        .set('x-org-id', orgB.id)
        .send({
          enrollmentToken: prefixed,
          orgId: orgB.id,
          name: 'Enrolled Device',
          hostname: 'enrolled-device.iso.test',
          identityFingerprint: 'fp-enrollment-' + crypto.randomBytes(4).toString('hex'),
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.device).toBeDefined();
      const created = await prisma.device.findUnique({ where: { id: res.body.device.id } });
      expect(created?.orgId).toBe(orgA.id);
      expect(created?.orgId).not.toBe(orgB.id);
    });
  });
});

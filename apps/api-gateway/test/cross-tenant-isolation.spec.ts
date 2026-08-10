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

describe('ORG-01C Cross-Tenant Isolation Boundary Enforcement', () => {
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

  const A = { email: 'orga@cross-tenant.test', password: 'SecureP@ssw0rd!' };
  const B = { email: 'orgb@cross-tenant.test', password: 'SecureP@ssw0rd!' };

  const ADMINS = [
    { email: 'admin-a@cross-tenant.test', role: 'Admin', targetOrg: 'A' },
    { email: 'admin-b@cross-tenant.test', role: 'Admin', targetOrg: 'B' },
  ];

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
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.backupRun.deleteMany();
    await prisma.backupJob.deleteMany();
    await prisma.remoteSession.deleteMany();
    await prisma.reportSchedule.deleteMany();
    await prisma.report.deleteMany();
    await prisma.kbEmbedding.deleteMany();
    await prisma.kbArticle.deleteMany();
    await prisma.securityFinding.deleteMany();
    await prisma.securityScan.deleteMany();
    await prisma.securityScore.deleteMany();
    await prisma.networkDevice.deleteMany();
    await prisma.networkScan.deleteMany();
    await prisma.softwareInventory.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.deviceMetric.deleteMany();
    await prisma.device.deleteMany();
    await prisma.enrollmentToken.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);

    orgA = await prisma.organization.create({ data: { name: 'X-Tenant Org A', slug: 'xta-' + crypto.randomBytes(3).toString('hex') } });
    orgB = await prisma.organization.create({ data: { name: 'X-Tenant Org B', slug: 'xtb-' + crypto.randomBytes(3).toString('hex') } });

    const hash = await bcrypt.hash('SecureP@ssw0rd!', 4);
    userA = await prisma.user.create({
      data: { email: A.email, passwordHash: hash, displayName: 'User A', orgId: orgA.id, role: 'Owner' },
    });
    userB = await prisma.user.create({
      data: { email: B.email, passwordHash: hash, displayName: 'User B', orgId: orgB.id, role: 'Owner' },
    });

    const adminRecords = await Promise.all(
      ADMINS.map((adm) =>
        prisma.user.create({
          data: {
            email: adm.email,
            passwordHash: hash,
            displayName: adm.email,
            orgId: adm.targetOrg === 'A' ? orgA.id : orgB.id,
            role: adm.role as any,
          },
        }),
      ),
    );

    await prisma.organizationMember.createMany({
      data: [
        { userId: userA.id, orgId: orgA.id, role: 'Owner' },
        { userId: userB.id, orgId: orgB.id, role: 'Owner' },
        { userId: adminRecords[0].id, orgId: orgA.id, role: 'Admin' },
        { userId: adminRecords[1].id, orgId: orgB.id, role: 'Admin' },
      ],
    });

    const rawTokenA = 'xtok-a-' + crypto.randomBytes(6).toString('hex');
    const rawTokenB = 'xtok-b-' + crypto.randomBytes(6).toString('hex');
    deviceA = await prisma.device.create({
      data: {
        name: 'X-Device A',
        hostname: 'xdev-a.cross-tenant.test',
        orgId: orgA.id,
        deviceTokenHash: hashToken(rawTokenA),
      },
    });
    deviceB = await prisma.device.create({
      data: {
        name: 'X-Device B',
        hostname: 'xdev-b.cross-tenant.test',
        orgId: orgB.id,
        deviceTokenHash: hashToken(rawTokenB),
      },
    });

    tokenA = rawTokenA;
    tokenB = rawTokenB;
  });

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'SecureP@ssw0rd!' });
    expect(res.status).toBe(201);
    return res.body.accessToken;
  }

  describe('High-risk domain READ isolation', () => {
    it('Org A user cannot read Org B backup job or its runs', async () => {
      const jobB = await prisma.backupJob.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, name: 'B Backup', type: 'file' },
      });
      await prisma.backupRun.create({
        data: { jobId: jobB.id, orgId: orgB.id, deviceId: deviceB.id, type: 'file' },
      });
      const token = await loginAs(A.email);

      const getRes = await request(app.getHttpServer())
        .get(`/backups/jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(404);

      const listRes = await request(app.getHttpServer())
        .get('/backups/jobs')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.some((j: any) => j.id === jobB.id)).toBe(false);
    });

    it('Org A user cannot read Org B remote session recording', async () => {
      const sessionB = await prisma.remoteSession.create({
        data: {
          orgId: orgB.id,
          deviceId: deviceB.id,
          technicianId: userB.id,
          status: 'ended',
          recordingPath: 'recordings/org-b/session-b.webm',
          recordingSize: 2048,
          recordingDuration: 120,
          metadata: { recordingFrames: [] },
        },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .get(`/remote-support/recordings/${sessionB.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('Org A user cannot read Org B KB article', async () => {
      const articleB = await prisma.kbArticle.create({
        data: { orgId: orgB.id, title: 'B Secret Runbook', markdown: '# B internal procedures' },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .get(`/kb/articles/${articleB.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('Org A user cannot read Org B report', async () => {
      const reportB = await prisma.report.create({
        data: {
          orgId: orgB.id,
          type: 'security_executive',
          format: 'pdf',
          title: 'B Security Report',
          storagePath: 'reports/org-b/executive.pdf',
          status: 'completed',
        },
      });
      const token = await loginAs(A.email);

      const listRes = await request(app.getHttpServer())
        .get('/reports')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((r: any) => r.id === reportB.id)).toBe(false);
    });

    it('Org A user cannot read Org B alert or alert rule', async () => {
      const ruleB = await prisma.alertRule.create({
        data: {
          orgId: orgB.id,
          name: 'B Critical CPU',
          metricName: 'cpu.usage',
          threshold: 95,
        },
      });
      await prisma.alert.create({
        data: {
          orgId: orgB.id,
          alertRuleId: ruleB.id,
          deviceId: deviceB.id,
          metricValue: 99,
          threshold: 95,
          severity: 'critical',
          message: 'B CPU overload',
        },
      });
      const token = await loginAs(A.email);

      const alerts = await request(app.getHttpServer())
        .get('/alerts')
        .set('Authorization', `Bearer ${token}`);
      expect(alerts.status).toBe(200);
      expect(alerts.body.data.some((a: any) => a.alertRuleId === ruleB.id)).toBe(false);
    });
  });

  describe('High-risk domain WRITE isolation (boundary enforcement)', () => {
    it('Org A user cannot update Org B backup job (must not be applied cross-tenant)', async () => {
      const jobB = await prisma.backupJob.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, name: 'B Backup', type: 'file' },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .patch(`/backups/jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hijacked', orgId: orgA.id });
      expect(res.status).toBe(404);

      const after = await prisma.backupJob.findUnique({ where: { id: jobB.id } });
      expect(after?.name).toBe('B Backup');
      expect(after?.orgId).toBe(orgB.id);
    });

    it('Org A user cannot delete Org B backup job', async () => {
      const jobB = await prisma.backupJob.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, name: 'B Backup', type: 'file' },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .delete(`/backups/jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);

      const after = await prisma.backupJob.findUnique({ where: { id: jobB.id } });
      expect(after).not.toBeNull();
    });

    it('Org A user cannot write recording frames to Org B session', async () => {
      const sessionB = await prisma.remoteSession.create({
        data: {
          orgId: orgB.id,
          deviceId: deviceB.id,
          technicianId: userB.id,
          status: 'active',
          metadata: { recordingFrames: [] },
        },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .post(`/remote-support/recordings/${sessionB.id}/frames`)
        .set('Authorization', `Bearer ${token}`)
        .send({ frameData: 'AAAA', timestamp: new Date().toISOString() });
      expect(res.status).toBe(404);

      const after = await prisma.remoteSession.findUnique({ where: { id: sessionB.id } });
      expect((after?.metadata as any)?.recordingFrames ?? []).toHaveLength(0);
    });

    it('Org A user cannot acknowledge Org B alert', async () => {
      const ruleB = await prisma.alertRule.create({
        data: {
          orgId: orgB.id,
          name: 'B Disk',
          metricName: 'disk.usage',
          threshold: 90,
        },
      });
      const alertB = await prisma.alert.create({
        data: {
          orgId: orgB.id,
          alertRuleId: ruleB.id,
          deviceId: deviceB.id,
          metricValue: 95,
          threshold: 90,
          severity: 'warning',
          message: 'B disk full',
        },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .patch(`/alerts/${alertB.id}/acknowledge`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);

      const after = await prisma.alert.findUnique({ where: { id: alertB.id } });
      expect(after?.status).toBe('OPEN');
      expect(after?.acknowledgedAt).toBeNull();
    });

    it('Org A user cannot remediate Org B security finding', async () => {
      const scanB = await prisma.securityScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'completed' },
      });
      const findingB = await prisma.securityFinding.create({
        data: {
          scanId: scanB.id,
          orgId: orgB.id,
          deviceId: deviceB.id,
          category: 'firewall',
          finding: 'B firewall off',
          severity: 'high',
          remediation: 'Enable firewall',
          status: 'open',
        },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .post(`/security/findings/${findingB.id}/remediate`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);

      const after = await prisma.securityFinding.findUnique({ where: { id: findingB.id } });
      expect(after?.status).toBe('open');
    });

    it('Org A user cannot delete Org B KB article', async () => {
      const articleB = await prisma.kbArticle.create({
        data: { orgId: orgB.id, title: 'B Guide', markdown: '# B' },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .delete(`/kb/articles/${articleB.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);

      const after = await prisma.kbArticle.findUnique({ where: { id: articleB.id } });
      expect(after).not.toBeNull();
    });
  });

  describe('Device-token isolation (agent ingestion)', () => {
    it('Device A cannot update status of Org B scan (payload scanId substitution)', async () => {
      const scanB = await prisma.networkScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'pending' },
      });

      const res = await request(app.getHttpServer())
        .post('/network/discovery/status')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanB.id, status: 'completed' });
      expect(res.status).toBe(403);

      const after = await prisma.networkScan.findUnique({ where: { id: scanB.id } });
      expect(after?.status).toBe('pending');
    });

    it('Device A cannot submit result for Org B scan', async () => {
      const scanB = await prisma.networkScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'running' },
      });

      const res = await request(app.getHttpServer())
        .post('/network/discovery/result')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanB.id, devices: [], status: 'completed' });
      expect(res.status).toBe(403);

      const after = await prisma.networkScan.findUnique({ where: { id: scanB.id } });
      expect(after?.status).toBe('running');
    });

    it('Device A cannot complete Org B security scan', async () => {
      const scanB = await prisma.securityScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'running' },
      });

      const res = await request(app.getHttpServer())
        .post('/security/scan-result')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ scanId: scanB.id, findings: [] });
      expect(res.status).toBe(403);

      const after = await prisma.securityScan.findUnique({ where: { id: scanB.id } });
      expect(after?.status).toBe('running');
    });

    it('Device A cleanup cannot mark Org B scans stale', async () => {
      const scanB = await prisma.networkScan.create({
        data: {
          orgId: orgB.id,
          deviceId: deviceB.id,
          status: 'pending',
          startedAt: new Date(Date.now() - 10 * 60 * 1000),
        },
      });

      await request(app.getHttpServer())
        .get('/network/discovery/pending')
        .set('Authorization', `Bearer ${tokenA}`);

      const after = await prisma.networkScan.findUnique({ where: { id: scanB.id } });
      expect(after?.status).toBe('pending');
    });
  });

  describe('JWT org claim vs membership authority', () => {
    it('Org A JWT cannot act as Org B for write endpoints', async () => {
      const jobB = await prisma.backupJob.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, name: 'B Backup', type: 'file' },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .patch(`/backups/jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-org-id', orgB.id)
        .send({ name: 'Forge attempt' });
      expect(res.status).toBe(404);
    });

    it('X-Org-Id header cannot cross org boundaries on authenticated reads', async () => {
      const scanB = await prisma.securityScan.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, status: 'completed' },
      });
      const token = await loginAs(A.email);

      const res = await request(app.getHttpServer())
        .get(`/security/scans/detail/${scanB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-org-id', orgB.id);
      expect(res.status).toBe(404);
    });
  });

  describe('AI router per-org isolation', () => {
    it('Org A strategy change does not affect Org B stats/strategy', async () => {
      const adminAToken = await loginAs(ADMINS[0].email);
      const adminBToken = await loginAs(ADMINS[1].email);

      const putRes = await request(app.getHttpServer())
        .put('/ai/router/strategy')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ strategy: 'cost-first' });
      expect([200, 201]).toContain(putRes.status);

      const statsB = await request(app.getHttpServer())
        .get('/ai/router/stats')
        .set('Authorization', `Bearer ${adminBToken}`);
      expect(statsB.status).toBe(200);
      expect(statsB.body.activeStrategy).not.toBe('cost-first');

      const statsA = await request(app.getHttpServer())
        .get('/ai/router/stats')
        .set('Authorization', `Bearer ${adminAToken}`);
      expect(statsA.status).toBe(200);
      expect(statsA.body.activeStrategy).toBe('cost-first');
    });

    it('Viewer without ORGANIZATION_SETTINGS is denied router strategy change', async () => {
      const viewer = await prisma.user.create({
        data: {
          email: 'viewer-a@cross-tenant.test',
          passwordHash: await bcrypt.hash('SecureP@ssw0rd!', 4),
          displayName: 'Viewer A',
          orgId: orgA.id,
          role: 'Viewer',
        },
      });
      await prisma.organizationMember.create({
        data: { userId: viewer.id, orgId: orgA.id, role: 'Viewer' },
      });

      const token = await loginAs('viewer-a@cross-tenant.test');
      const res = await request(app.getHttpServer())
        .put('/ai/router/strategy')
        .set('Authorization', `Bearer ${token}`)
        .send({ strategy: 'round-robin' });
      expect([401, 403]).toContain(res.status);
    });
  });

  describe('Org-switch context isolation', () => {
    it('Member moved between orgs acts under the new org only', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'mover@cross-tenant.test',
          passwordHash: await bcrypt.hash('SecureP@ssw0rd!', 4),
          displayName: 'Mover',
          orgId: orgA.id,
          role: 'Owner',
        },
      });
      await prisma.organizationMember.create({
        data: { userId: user.id, orgId: orgA.id, role: 'Owner' },
      });

      const token = await loginAs('mover@cross-tenant.test');

      const jobB = await prisma.backupJob.create({
        data: { orgId: orgB.id, deviceId: deviceB.id, name: 'B Backup', type: 'file' },
      });

      const crossRes = await request(app.getHttpServer())
        .patch(`/backups/jobs/${jobB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'mover hijack' });
      expect(crossRes.status).toBe(404);
    });
  });
});

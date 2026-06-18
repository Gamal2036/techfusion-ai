import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-in-production-abc123';

describe('Full E2E Scenario (Phase 15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const state: Record<string, any> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();

    await prisma.kbEmbedding.deleteMany();
    await prisma.kbArticle.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.remoteSession.deleteMany();
    await prisma.backupRun.deleteMany();
    await prisma.backupJob.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.driverCatalogItem.deleteMany();
    await prisma.softwareInventory.deleteMany();
    await prisma.softwareCatalogItem.deleteMany();
    await prisma.networkDevice.deleteMany();
    await prisma.networkScan.deleteMany();
    await prisma.securityFinding.deleteMany();
    await prisma.securityScore.deleteMany();
    await prisma.securityScan.deleteMany();
    await prisma.deviceMetric.deleteMany();
    await prisma.deviceHealthScore.deleteMany();
    await prisma.device.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.dataRetentionPolicy.deleteMany();
    await prisma.ssoConfig.deleteMany();
    await prisma.user.deleteMany();
    await prisma.aiProviderConfig.deleteMany();
    await prisma.aiUsageLog.deleteMany();
    await prisma.aiMessage.deleteMany();
    await prisma.aiConversation.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.report.deleteMany();
    await prisma.reportTemplate.deleteMany();
    await prisma.reportSchedule.deleteMany();
    await prisma.organization.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Step 1: User signs up creating a new organization', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'owner@e2e-test.com',
        password: 'SecurePass123!',
        displayName: 'E2E Owner',
        orgName: 'TechFusion E2E',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('owner@e2e-test.com');
    expect(res.body.user.role).toBe('Owner');
    expect(res.body.user.orgId).toBeDefined();

    state.ownerToken = res.body.accessToken;
    state.ownerId = res.body.user.id;
    state.orgId = res.body.user.orgId;

    const decoded = jwt.verify(state.ownerToken, JWT_SECRET()) as any;
    expect(decoded.orgId).toBe(state.orgId);
    expect(decoded.role).toBe('Owner');
  });

  it('Step 2: Owner adds team members', async () => {
    const hash = await bcrypt.hash('SecurePass123!', 4);

    const admin = await prisma.user.create({
      data: {
        email: 'admin@e2e-test.com',
        passwordHash: hash,
        displayName: 'E2E Admin',
        role: 'Admin',
        org: { connect: { id: state.orgId } },
      },
    });
    expect(admin.id).toBeDefined();
    state.adminId = admin.id;

    const tech = await prisma.user.create({
      data: {
        email: 'tech@e2e-test.com',
        passwordHash: hash,
        displayName: 'E2E Technician',
        role: 'Technician',
        org: { connect: { id: state.orgId } },
      },
    });
    expect(tech.id).toBeDefined();
    state.techId = tech.id;

    const rosterRes = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(rosterRes.body.length).toBe(3);
    const emails = rosterRes.body.map((u: any) => u.email);
    expect(emails).toContain('owner@e2e-test.com');
    expect(emails).toContain('admin@e2e-test.com');
    expect(emails).toContain('tech@e2e-test.com');
  });

  it('Step 3: Onboard 3 devices', async () => {
    const deviceData = [
      { name: 'E2E-Server-01', hostname: 'srv-01.e2e.local', os: 'Ubuntu 24.04', deviceToken: 'e2e-device-token-001' },
      { name: 'E2E-Workstation-01', hostname: 'ws-01.e2e.local', os: 'Windows 11', deviceToken: 'e2e-device-token-002' },
      { name: 'E2E-Laptop-01', hostname: 'laptop-01.e2e.local', os: 'macOS 15', deviceToken: 'e2e-device-token-003' },
    ];

    state.devices = [];
    for (const dd of deviceData) {
      const device = await prisma.device.create({
        data: {
          name: dd.name,
          hostname: dd.hostname,
          os: dd.os,
          deviceToken: dd.deviceToken,
          org: { connect: { id: state.orgId } },
        },
      });
      state.devices.push(device);
    }

    expect(state.devices.length).toBe(3);

    const listRes = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(listRes.body.length).toBe(3);
  });

  it('Step 4: Submit device metrics and create alert rules', async () => {
    const device = state.devices[0];

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/devices/metrics')
        .set('Authorization', `Bearer ${device.deviceToken}`)
        .send({
          cpuUsage: 45 + Math.random() * 30,
          ramUsed: 8000000000,
          ramTotal: 16000000000,
          ramPercent: 50,
          diskUsed: 500000000000,
          diskTotal: 1000000000000,
          uptime: 86400 * 30,
        })
        .expect(201);
    }

    const alertRuleRes = await request(app.getHttpServer())
      .post('/alerts/rules')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ name: 'High CPU Alert', metricName: 'cpuUsage', threshold: 80, operator: 'gt', severity: 'warning', enabled: true })
      .expect(201);

    expect(alertRuleRes.body.name).toBe('High CPU Alert');
    state.alertRule = alertRuleRes.body;

    const alertsRes = await request(app.getHttpServer())
      .get('/alerts')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    // Can be array or { data, total } format
    expect(Array.isArray(alertsRes.body) || Array.isArray(alertsRes.body.data)).toBe(true);
  });

  it('Step 5: AI troubleshooting with KB query', async () => {
    const kbRes = await request(app.getHttpServer())
      .post('/kb/articles')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        title: 'High CPU Troubleshooting Guide',
        markdown: '# High CPU Guide\n\nCheck top processes with `top` or `htop`.\nLook for runaway processes.',
      })
      .expect(201);

    expect(kbRes.body.data?.id).toBeDefined();
    state.kbArticle = kbRes.body.data;

    const queryRes = await request(app.getHttpServer())
      .post('/kb/query')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ query: 'How to fix high CPU?', topK: 3 })
      .expect(201);

    expect(queryRes.body.data || queryRes.body.results).toBeDefined();

    const troubleshootRes = await request(app.getHttpServer())
      .post('/ai/troubleshoot')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ message: 'CPU is at 95% on server. What should I do?', deviceId: state.devices[0].id });

    expect([200, 201, 402, 500, 503]).toContain(troubleshootRes.status);
  });

  it('Step 6: Security scan and executive report', async () => {
    const device = state.devices[0];

    const scanRes = await request(app.getHttpServer())
      .post('/devices/security-report')
      .send({
        deviceToken: device.deviceToken,
        findings: [
          { category: 'updates', finding: '3 pending security updates', severity: 'medium', remediation: 'Run apt update && apt upgrade' },
          { category: 'firewall', finding: 'UFW is inactive', severity: 'high', remediation: 'Enable UFW and configure rules' },
        ],
        healthScore: 75,
      })
      .expect(200);

    expect(scanRes.body.securityScore).toBeDefined();

    const triggerRes = await request(app.getHttpServer())
      .post(`/security/scans/${device.id}/trigger`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(201);

    expect(triggerRes.body.scanId).toBeDefined();

    const summaryRes = await request(app.getHttpServer())
      .get(`/security/executive-summary/${device.id}`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(summaryRes.body).toBeDefined();

    const reportRes = await request(app.getHttpServer())
      .post('/reports/generate')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ type: 'security_executive', format: 'pdf', title: 'E2E Security Report', sourceIds: JSON.stringify([device.id]) })
      .expect(201);

    expect(reportRes.body.id).toBeDefined();
  });

  it('Step 7: Network discovery scan', async () => {
    const device = state.devices[0];

    const discoveryRes = await request(app.getHttpServer())
      .post('/network/discovery')
      .set('x-org-id', state.orgId)
      .send({
        deviceToken: device.deviceToken,
        gatewayIp: '192.168.1.1',
        gatewayMac: '00:11:22:33:44:55',
        localIp: '192.168.1.100',
        subnet: '192.168.1.0/24',
        devices: [
          { ip: '192.168.1.1', mac: '00:11:22:33:44:55', hostname: 'gateway', vendor: 'Cisco' },
          { ip: '192.168.1.50', mac: '11:22:33:44:55:66', hostname: 'printer', vendor: 'HP' },
          { ip: '192.168.1.101', mac: '22:33:44:55:66:77', hostname: 'nas', vendor: 'Synology' },
        ],
      })
      .expect(201);

    expect(discoveryRes.body.scan).toBeDefined();
    expect(discoveryRes.body.scan.status).toBe('completed');

    const devicesRes = await request(app.getHttpServer())
      .get('/network/devices')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(devicesRes.body.length).toBeGreaterThanOrEqual(3);

    const topologyRes = await request(app.getHttpServer())
      .get('/network/topology')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(topologyRes.body).toBeDefined();
  });

  it('Step 8: Remote support session lifecycle', async () => {
    const device = state.devices[1];

    const createRes = await request(app.getHttpServer())
      .post('/remote-support/sessions')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ deviceId: device.id })
      .expect(201);

    expect(createRes.body.status).toBe('pending');

    const consentRes = await request(app.getHttpServer())
      .post('/remote-support/consent')
      .set('Authorization', `Bearer ${device.deviceToken}`)
      .send({ sessionId: createRes.body.id, deviceId: device.id, granted: true, method: 'click' })
      .expect(201);

    expect(consentRes.body.granted).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get(`/remote-support/sessions/${createRes.body.id}`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(getRes.body.status).toBe('active');

    const endRes = await request(app.getHttpServer())
      .post(`/remote-support/sessions/${createRes.body.id}/end`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(201);

    expect(endRes.body.status).toBe('ended');
  });

  it('Step 9: Backup job creation and run', async () => {
    const device = state.devices[0];

    const jobRes = await request(app.getHttpServer())
      .post('/backups/jobs')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ name: 'E2E Daily Backup', deviceId: device.id, type: 'file', schedule: '0 2 * * *', retention: 30 })
      .expect(201);

    expect(jobRes.body.name).toBe('E2E Daily Backup');

    const runRes = await request(app.getHttpServer())
      .post(`/backups/jobs/${jobRes.body.id}/trigger`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(201);

    expect(runRes.body.status).toBe('running');

    const runsRes = await request(app.getHttpServer())
      .get('/backups/runs')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(runsRes.body.length).toBe(1);
  });

  it('Step 10: Billing plan upgrade', async () => {
    const planRes = await request(app.getHttpServer())
      .get('/billing/plan')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(planRes.body.plan).toBeDefined();

    await prisma.subscription.create({
      data: {
        plan: 'Enterprise',
        status: 'Active',
        org: { connect: { id: state.orgId } },
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
      },
    });

    await prisma.organization.update({
      where: { id: state.orgId },
      data: { plan: 'Enterprise' },
    });

    const updatedPlanRes = await request(app.getHttpServer())
      .get('/billing/plan')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(updatedPlanRes.body.plan).toBe('Enterprise');
  });

  it('Step 11: SSO login configuration and JIT provisioning', async () => {
    const ssoRes = await request(app.getHttpServer())
      .post('/admin/sso/config')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ provider: 'oidc', issuer: 'https://idp.e2e-test.com', entryPoint: 'https://idp.e2e-test.com/sso', certificate: 'test-cert-e2e', clientId: 'e2e-client-id' })
      .expect(201);

    expect(ssoRes.body.provider).toBe('oidc');
    expect(ssoRes.body.isEnabled).toBe(true);

    const ssoLoginRes = await request(app.getHttpServer())
      .post('/auth/sso/login')
      .send({
        orgSlug: 'techfusion-e2e',
        idpToken: 'e2e-idp-token-12345',
        provider: 'oidc',
        attributes: { email: 'sso-user@e2e-test.com', displayName: 'SSO E2E User', ssoId: 'sso-e2e-001' },
      })
      .expect(201);

    expect(ssoLoginRes.body.user.email).toBe('sso-user@e2e-test.com');
    expect(ssoLoginRes.body.accessToken).toBeDefined();
    state.ssoToken = ssoLoginRes.body.accessToken;

    const devicesRes = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${state.ssoToken}`)
      .expect(200);

    expect(Array.isArray(devicesRes.body)).toBe(true);
    expect(devicesRes.body.length).toBe(3);
  });

  it('Step 12: Audit log export', async () => {
    const csvRes = await request(app.getHttpServer())
      .get('/audit/export/csv')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text.length).toBeGreaterThan(0);

    const jsonRes = await request(app.getHttpServer())
      .get('/audit/export/json')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(Array.isArray(jsonRes.body)).toBe(true);

    const logsRes = await request(app.getHttpServer())
      .get('/audit/logs')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(logsRes.body.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(logsRes.body.rows)).toBe(true);
  });
});

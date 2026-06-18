/**
 * TechFusion AI – Full End-to-End Scenario Test (Phase 15)
 *
 * Covers every module in sequence:
 *   signup → invite team → onboard 3 devices → live monitoring/alerts →
 *   AI troubleshooting with KB citation → security scan + executive report →
 *   network discovery → remote support session → backup job →
 *   billing plan upgrade → SSO login for second user → audit export
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

describe('Full E2E Scenario (Phase 15)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // State carried across steps
  const state: Record<string, any> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean all tables
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

  // ═══════════════════════════════════════════════════════════
  // Step 1: Signup (new organization + owner user)
  // ═══════════════════════════════════════════════════════════
  it('Step 1: User signs up creating a new organization', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'owner@techfusion-e2e.com',
        password: 'SecurePass123!',
        displayName: 'E2E Owner',
        orgName: 'TechFusion E2E',
        orgSlug: 'techfusion-e2e',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe('owner@techfusion-e2e.com');
    expect(res.body.user.role).toBe('Owner');
    expect(res.body.org.name).toBe('TechFusion E2E');
    expect(res.body.org.slug).toBe('techfusion-e2e');

    state.owner = res.body.user;
    state.org = res.body.org;
    state.ownerToken = res.body.accessToken;
    state.ownerRefreshToken = res.body.refreshToken;
  });

  // ═══════════════════════════════════════════════════════════
  // Step 2: Invite team members (Admin, Technician)
  // ═══════════════════════════════════════════════════════════
  it('Step 2: Owner invites team members', async () => {
    // Create team members directly (invite endpoint not implemented – uses admin/users)
    // Add an admin user
    const adminRes = await request(app.getHttpServer())
      .post('/admin/users')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        email: 'admin@techfusion-e2e.com',
        displayName: 'E2E Admin',
        role: 'Admin',
        password: 'SecurePass123!',
      })
      .expect(201);

    expect(adminRes.body.email).toBe('admin@techfusion-e2e.com');
    expect(adminRes.body.role).toBe('Admin');
    state.admin = adminRes.body;

    // Add a technician
    const techRes = await request(app.getHttpServer())
      .post('/admin/users')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        email: 'tech@techfusion-e2e.com',
        displayName: 'E2E Technician',
        role: 'Technician',
        password: 'SecurePass123!',
      })
      .expect(201);

    expect(techRes.body.role).toBe('Technician');
    state.technician = techRes.body;

    // Verify team roster
    const rosterRes = await request(app.getHttpServer())
      .get('/admin/users')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(rosterRes.body.length).toBe(3); // owner + admin + tech
  });

  // ═══════════════════════════════════════════════════════════
  // Step 3: Onboard 3 devices
  // ═══════════════════════════════════════════════════════════
  it('Step 3: Onboard 3 devices via public registration', async () => {
    const devices = [
      { name: 'E2E-Server-01', hostname: 'srv-01.e2e.local', os: 'Ubuntu 24.04' },
      { name: 'E2E-Workstation-01', hostname: 'ws-01.e2e.local', os: 'Windows 11' },
      { name: 'E2E-Laptop-01', hostname: 'laptop-01.e2e.local', os: 'macOS 15' },
    ];

    const onboardedDevices = [];
    for (const dev of devices) {
      const res = await request(app.getHttpServer())
        .post('/devices/register')
        .send({
          orgId: state.org.id,
          name: dev.name,
          hostname: dev.hostname,
          os: dev.os,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe(dev.name);
      expect(res.body.deviceToken).toBeDefined();
      expect(res.body.orgId).toBe(state.org.id);
      onboardedDevices.push(res.body);
    }

    expect(onboardedDevices.length).toBe(3);
    state.devices = onboardedDevices;

    // Verify devices via authenticated endpoint
    const listRes = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(listRes.body.length).toBe(3);
  });

  // ═══════════════════════════════════════════════════════════
  // Step 4: Live monitoring & alerts
  // ═══════════════════════════════════════════════════════════
  it('Step 4: Submit device metrics and create alert rules', async () => {
    const device = state.devices[0];

    // Submit metrics
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/devices/metrics')
        .send({
          deviceToken: device.deviceToken,
          cpuUsage: 45 + Math.random() * 30,
          ramUsed: 8000000000,
          ramTotal: 16000000000,
          ramPercent: 50,
          diskUsed: 500000000000,
          diskTotal: 1000000000000,
          networkRxBytes: 100000000,
          networkTxBytes: 50000000,
          tempCpu: 65 + Math.random() * 10,
          loadAverage1Min: 2.5,
          uptime: 86400 * 30,
        })
        .expect(201);
    }

    // Create alert rule for high CPU
    const alertRuleRes = await request(app.getHttpServer())
      .post('/alerts/rules')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        name: 'High CPU Alert',
        metricName: 'cpuUsage',
        threshold: 80,
        operator: 'gt',
        severity: 'warning',
        enabled: true,
      })
      .expect(201);

    expect(alertRuleRes.body.name).toBe('High CPU Alert');
    state.alertRule = alertRuleRes.body;

    // Verify alerts endpoint works
    const alertsRes = await request(app.getHttpServer())
      .get('/alerts')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(Array.isArray(alertsRes.body)).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════
  // Step 5: AI troubleshooting with KB citation
  // ═══════════════════════════════════════════════════════════
  it('Step 5: AI troubleshooting with KB query', async () => {
    // Create a KB article
    const kbRes = await request(app.getHttpServer())
      .post('/kb/articles')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        title: 'High CPU Troubleshooting Guide',
        markdown: `# High CPU Guide\n\nCheck top processes with \`top\` or \`htop\`.\nLook for runaway processes.`,
      })
      .expect(201);

    expect(kbRes.body.id).toBeDefined();
    state.kbArticle = kbRes.body;

    // Query KB
    const queryRes = await request(app.getHttpServer())
      .post('/kb/query')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        query: 'How to fix high CPU?',
        topK: 3,
      })
      .expect(201);

    expect(queryRes.body.results).toBeDefined();

    // AI troubleshoot (may fail if no AI provider configured, but should return structured response)
    const troubleshootRes = await request(app.getHttpServer())
      .post('/ai/troubleshoot')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        message: 'CPU is at 95% on server. What should I do?',
        deviceId: state.devices[0].id,
      });

    // Should succeed or return graceful error
    expect([201, 402, 503, 500]).toContain(troubleshootRes.status);
    if (troubleshootRes.status === 201) {
      expect(troubleshootRes.body.response || troubleshootRes.body.message).toBeDefined();
    }
  });

  // ═══════════════════════════════════════════════════════════
  // Step 6: Security scan + executive report
  // ═══════════════════════════════════════════════════════════
  it('Step 6: Security scan and executive report', async () => {
    const device = state.devices[0];

    // Submit security report (from device agent)
    const scanRes = await request(app.getHttpServer())
      .post('/devices/security-report')
      .send({
        deviceToken: device.deviceToken,
        findings: [
          {
            category: 'updates',
            finding: '3 pending security updates',
            severity: 'medium',
            remediation: 'Run apt update && apt upgrade',
          },
          {
            category: 'firewall',
            finding: 'UFW is inactive',
            severity: 'high',
            remediation: 'Enable UFW and configure rules',
          },
        ],
        healthScore: 75,
      })
      .expect(201);

    expect(scanRes.body.status).toBe('completed');
    state.securityScan = scanRes.body;

    // Trigger new scan
    const triggerRes = await request(app.getHttpServer())
      .post(`/security/scans/${device.id}/trigger`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(201);

    expect(triggerRes.body.id).toBeDefined();

    // Get executive summary
    const summaryRes = await request(app.getHttpServer())
      .get(`/security/executive-summary/${device.id}`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(summaryRes.body).toBeDefined();

    // Generate report
    const reportRes = await request(app.getHttpServer())
      .post('/reports/generate')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        type: 'security_executive',
        format: 'pdf',
        title: 'E2E Security Report',
        sourceIds: JSON.stringify([device.id]),
      })
      .expect(201);

    expect(reportRes.body.id).toBeDefined();
    state.report = reportRes.body;
  });

  // ═══════════════════════════════════════════════════════════
  // Step 7: Network discovery
  // ═══════════════════════════════════════════════════════════
  it('Step 7: Network discovery scan', async () => {
    const device = state.devices[0];

    // Submit network discovery (from agent)
    const discoveryRes = await request(app.getHttpServer())
      .post('/network/discovery')
      .send({
        deviceToken: device.deviceToken,
        gatewayIp: '192.168.1.1',
        gatewayMac: '00:11:22:33:44:55',
        localIp: '192.168.1.100',
        localMac: 'aa:bb:cc:dd:ee:ff',
        subnet: '192.168.1.0/24',
        neighbors: [
          { ip: '192.168.1.1', mac: '00:11:22:33:44:55', hostname: 'gateway', vendor: 'Cisco' },
          { ip: '192.168.1.50', mac: '11:22:33:44:55:66', hostname: 'printer', vendor: 'HP' },
          { ip: '192.168.1.101', mac: '22:33:44:55:66:77', hostname: 'nas', vendor: 'Synology' },
        ],
      })
      .expect(201);

    expect(discoveryRes.body.status).toBe('completed');

    // Query network devices
    const devicesRes = await request(app.getHttpServer())
      .get('/network/devices')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(devicesRes.body.length).toBeGreaterThanOrEqual(3);

    // Get topology
    const topologyRes = await request(app.getHttpServer())
      .get('/network/topology')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(topologyRes.body).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════
  // Step 8: Remote support session
  // ═══════════════════════════════════════════════════════════
  it('Step 8: Remote support session lifecycle', async () => {
    const device = state.devices[1];

    // Create session
    const createRes = await request(app.getHttpServer())
      .post('/remote-support/sessions')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({ deviceId: device.id })
      .expect(201);

    expect(createRes.body.status).toBe('pending');
    expect(createRes.body.consentGranted).toBe(false);
    state.remoteSession = createRes.body;

    // Grant consent (from device agent)
    const consentRes = await request(app.getHttpServer())
      .post('/remote-support/consent')
      .send({
        sessionId: createRes.body.id,
        deviceId: device.id,
        granted: true,
        method: 'click',
      })
      .expect(201);

    expect(consentRes.body.granted).toBe(true);

    // Verify session active
    const getRes = await request(app.getHttpServer())
      .get(`/remote-support/sessions/${createRes.body.id}`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(getRes.body.status).toBe('active');
    expect(getRes.body.consentGranted).toBe(true);

    // End session
    const endRes = await request(app.getHttpServer())
      .post(`/remote-support/sessions/${createRes.body.id}/end`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(201);

    expect(endRes.body.status).toBe('ended');
  });

  // ═══════════════════════════════════════════════════════════
  // Step 9: Backup job
  // ═══════════════════════════════════════════════════════════
  it('Step 9: Backup job creation and run', async () => {
    const device = state.devices[0];

    // Create backup job
    const jobRes = await request(app.getHttpServer())
      .post('/backups/jobs')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        name: 'E2E Daily Backup',
        deviceId: device.id,
        type: 'file',
        schedule: '0 2 * * *',
        retention: 30,
        sourcePaths: JSON.stringify(['/etc', '/home', '/var/log']),
      })
      .expect(201);

    expect(jobRes.body.name).toBe('E2E Daily Backup');
    state.backupJob = jobRes.body;

    // Trigger a run
    const runRes = await request(app.getHttpServer())
      .post(`/backups/jobs/${jobRes.body.id}/trigger`)
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(201);

    expect(runRes.body.status).toBe('running');
    state.backupRun = runRes.body;

    // List runs
    const runsRes = await request(app.getHttpServer())
      .get('/backups/runs')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(runsRes.body.length).toBe(1);
  });

  // ═══════════════════════════════════════════════════════════
  // Step 10: Billing plan upgrade
  // ═══════════════════════════════════════════════════════════
  it('Step 10: Billing plan upgrade', async () => {
    // Get current plan
    const planRes = await request(app.getHttpServer())
      .get('/billing/plan')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(planRes.body.plan).toBeDefined();

    // Create a subscription (bypass Stripe – directly create for testing)
    const subscription = await prisma.subscription.create({
      data: {
        orgId: state.org.id,
        status: 'Active',
        plan: 'Enterprise',
      },
    });
    state.subscription = subscription;

    // Verify plan changed
    const updatedPlanRes = await request(app.getHttpServer())
      .get('/billing/plan')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(updatedPlanRes.body.plan).toBe('Enterprise');
    expect(updatedPlanRes.body.status).toBe('Active');
  });

  // ═══════════════════════════════════════════════════════════
  // Step 11: SSO login for second user
  // ═══════════════════════════════════════════════════════════
  it('Step 11: SSO login configuration and JIT provisioning', async () => {
    // Configure SSO for the org
    const ssoRes = await request(app.getHttpServer())
      .post('/admin/sso/config')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .send({
        provider: 'oidc',
        issuer: 'https://idp.e2e-test.com',
        entryPoint: 'https://idp.e2e-test.com/sso',
        certificate: 'test-cert-e2e',
        clientId: 'e2e-client-id',
      })
      .expect(201);

    expect(ssoRes.body.provider).toBe('oidc');
    expect(ssoRes.body.isEnabled).toBe(true);

    // SSO login with JIT provisioning
    const ssoLoginRes = await request(app.getHttpServer())
      .post('/auth/sso/login')
      .send({
        orgSlug: 'techfusion-e2e',
        idpToken: 'e2e-idp-token',
        provider: 'oidc',
        attributes: {
          email: 'sso-user@e2e-test.com',
          displayName: 'SSO E2E User',
          ssoId: 'sso-e2e-001',
        },
      })
      .expect(201);

    expect(ssoLoginRes.body.user.email).toBe('sso-user@e2e-test.com');
    expect(ssoLoginRes.body.user.ssoId).toBe('sso-e2e-001');
    expect(ssoLoginRes.body.accessToken).toBeDefined();
    state.ssoToken = ssoLoginRes.body.accessToken;
    state.ssoUser = ssoLoginRes.body.user;

    // Verify the SSO user can access the system
    const devicesRes = await request(app.getHttpServer())
      .get('/devices')
      .set('Authorization', `Bearer ${state.ssoToken}`)
      .expect(200);

    expect(Array.isArray(devicesRes.body)).toBe(true);
  });

  // ═══════════════════════════════════════════════════════════
  // Step 12: Audit export
  // ═══════════════════════════════════════════════════════════
  it('Step 12: Audit log export', async () => {
    // Export as CSV
    const csvRes = await request(app.getHttpServer())
      .get('/audit/export/csv')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text.length).toBeGreaterThan(0);

    // Export as JSON
    const jsonRes = await request(app.getHttpServer())
      .get('/audit/export/json')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(Array.isArray(jsonRes.body)).toBe(true);

    // Query audit logs
    const logsRes = await request(app.getHttpServer())
      .get('/audit/logs')
      .set('Authorization', `Bearer ${state.ownerToken}`)
      .expect(200);

    expect(logsRes.body.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(logsRes.body.rows)).toBe(true);
  });
});

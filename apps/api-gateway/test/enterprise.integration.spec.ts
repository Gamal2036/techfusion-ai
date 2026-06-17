import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-in-production-abc123';

describe('Enterprise Phase 13 Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let auditService: AuditService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    auditService = moduleFixture.get<AuditService>(AuditService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
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
    await prisma.organization.deleteMany();
  });

  async function seedOrg(orgSlug: string, orgName: string, email: string, role: any, plan?: string) {
    const org = await prisma.organization.create({
      data: { name: orgName, slug: orgSlug, plan: (plan as any) || 'Enterprise' },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: orgName + ' User',
        orgId: org.id,
        role,
      },
    });
    return { org, user };
  }

  async function loginAs(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
    return res.body.accessToken;
  }

  // ─── 1. SSO Login & JIT Provisioning ──────────────────────────

  describe('SSO login with JIT provisioning', () => {
    it('rejects SSO login when org has no SSO config', async () => {
      await seedOrg('sso-no-config', 'No SSO', 'owner@sso.com', 'Owner');
      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send({
          orgSlug: 'sso-no-config',
          idpToken: 'valid-idp-token-value-12345',
          provider: 'oidc',
          attributes: { email: 'newuser@test.com', displayName: 'New SSO User' },
        })
        .expect(401);
    });

    it('JIT provisions a new user on first SSO login', async () => {
      const { org } = await seedOrg('sso-jit', 'SSO JIT', 'owner@sso-jit.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@sso-jit.com');

      await request(app.getHttpServer())
        .post('/admin/sso/config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          provider: 'oidc',
          issuer: 'https://idp.example.com',
          entryPoint: 'https://idp.example.com/sso',
          certificate: 'test-cert',
          clientId: 'test-client-id',
        })
        .expect(201);

      // SSO login with new user (JIT provisioning)
      const ssoRes = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send({
          orgSlug: 'sso-jit',
          idpToken: 'valid-idp-token-value-12345',
          provider: 'oidc',
          attributes: { email: 'jit-user@test.com', displayName: 'JIT User', ssoId: 'sso-abc-123' },
        })
        .expect(201);

      expect(ssoRes.body.user).toBeDefined();
      expect(ssoRes.body.user.email).toBe('jit-user@test.com');
      expect(ssoRes.body.user.displayName).toBe('JIT User');
      expect(ssoRes.body.user.role).toBe('Viewer');
      expect(ssoRes.body.accessToken).toBeDefined();
      expect(ssoRes.body.refreshToken).toBeDefined();

      // Verify user was created in DB with SSO fields
      const dbUser = await prisma.user.findUnique({ where: { email: 'jit-user@test.com' } });
      expect(dbUser).toBeDefined();
      expect(dbUser!.ssoId).toBe('sso-abc-123');
      expect(dbUser!.ssoProvider).toBe('oidc');
    });

    it('links existing user to SSO on subsequent login', async () => {
      const { org } = await seedOrg('sso-link', 'SSO Link', 'owner@sso-link.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@sso-link.com');

      // Configure SSO
      await request(app.getHttpServer())
        .post('/admin/sso/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'saml', issuer: 'https://saml.idp.com' })
        .expect(201);

      // Create a user via normal signup first, then SSO login with same email
      const ssoRes = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send({
          orgSlug: 'sso-link',
          idpToken: 'another-valid-token-xyz',
          provider: 'saml',
          attributes: { email: 'owner@sso-link.com', displayName: 'Linked SSO User', ssoId: 'sso-link-456' },
        })
        .expect(201);

      // Should link SSO fields to existing user
      const dbUser = await prisma.user.findUnique({ where: { email: 'owner@sso-link.com' } });
      expect(dbUser!.ssoId).toBe('sso-link-456');
      expect(dbUser!.ssoProvider).toBe('saml');
    });

    it('configures SSO settings for an org', async () => {
      const { org } = await seedOrg('sso-config', 'SSO Config', 'owner@sso-cfg.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@sso-cfg.com');

      const configRes = await request(app.getHttpServer())
        .post('/admin/sso/config')
        .set('Authorization', `Bearer ${token}`)
        .send({
          provider: 'oidc',
          issuer: 'https://accounts.example.com',
          entryPoint: 'https://accounts.example.com/auth',
          certificate: '-----BEGIN CERTIFICATE-----\nMIID...',
          clientId: 'client-123',
          clientSecretEncrypted: 'encrypted-secret',
          attributeMapping: { email: 'email', displayName: 'name', role: 'role' },
        })
        .expect(201);

      expect(configRes.body.provider).toBe('oidc');
      expect(configRes.body.issuer).toBe('https://accounts.example.com');
      expect(configRes.body.clientId).toBe('client-123');
      expect(configRes.body.isEnabled).toBe(true);
    });

    it('disables SSO', async () => {
      const { org } = await seedOrg('sso-disable', 'SSO Disable', 'owner@sso-dis.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@sso-dis.com');

      await request(app.getHttpServer())
        .post('/admin/sso/config')
        .set('Authorization', `Bearer ${token}`)
        .send({ provider: 'oidc' })
        .expect(201);

      const disableRes = await request(app.getHttpServer())
        .post('/admin/sso/disable')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(disableRes.body.isEnabled).toBe(false);
    });
  });

  // ─── 2. Audit Export ──────────────────────────────────────────

  describe('Audit logging & export', () => {
    it('logs all privileged action types', async () => {
      const { org } = await seedOrg('audit-all', 'Audit All', 'owner@audit.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@audit.com');
      const userId = jwt.verify(token, JWT_SECRET()) as any;

      // Log various action types through the audit service
      const actionTypes = [
        'security_scan', 'session_start', 'session_end', 'session_consent',
        'billing_change', 'settings_change', 'role_change', 'user_invite',
        'user_remove', 'retention_policy_change', 'sso_config_change',
        'backup_run', 'report_generated', 'device_registered', 'alert_triggered',
      ];

      for (const action of actionTypes) {
        await auditService.log({
          orgId: org.id,
          action,
          actorId: userId.sub,
          targetId: org.id,
          details: { test: true, timestamp: Date.now() },
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        });
      }

      // Verify all are queryable
      const logs = await auditService.query(org.id, { limit: 100 });
      expect(logs.total).toBe(actionTypes.length);

      const loggedActions = logs.rows.map((l: any) => l.action);
      for (const action of actionTypes) {
        expect(loggedActions).toContain(action);
      }
    });

    it('exports audit logs as CSV', async () => {
      const { org } = await seedOrg('audit-csv', 'Audit CSV', 'owner@audit-csv.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@audit-csv.com');
      const userId = jwt.verify(token, JWT_SECRET()) as any;

      await auditService.log({
        orgId: org.id, action: 'test_action', actorId: userId.sub, details: { key: 'value' },
      });

      const res = await request(app.getHttpServer())
        .get('/audit/export/csv')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.split('\n');
      expect(lines[0]).toContain('id,createdAt,action,actorId');
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    it('exports audit logs as JSON', async () => {
      const { org } = await seedOrg('audit-json', 'Audit JSON', 'owner@audit-json.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@audit-json.com');
      const userId = jwt.verify(token, JWT_SECRET()) as any;

      await auditService.log({
        orgId: org.id, action: 'json_export_test', actorId: userId.sub, details: { num: 42 },
      });

      const res = await request(app.getHttpServer())
        .get('/audit/export/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].action).toBe('json_export_test');
    });

    it('filters audit logs by action type', async () => {
      const { org } = await seedOrg('audit-filter', 'Audit Filter', 'owner@audit-flt.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@audit-flt.com');
      const userId = jwt.verify(token, JWT_SECRET()) as any;

      await auditService.log({ orgId: org.id, action: 'type_a', actorId: userId.sub });
      await auditService.log({ orgId: org.id, action: 'type_b', actorId: userId.sub });
      await auditService.log({ orgId: org.id, action: 'type_a', actorId: userId.sub });

      const res = await request(app.getHttpServer())
        .get('/audit/logs?action=type_a')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(2);
      expect(res.body.rows.length).toBe(2);
    });

    it('queries audit logs with date range filter', async () => {
      const { org } = await seedOrg('audit-date', 'Audit Date', 'owner@audit-dt.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@audit-dt.com');
      const userId = jwt.verify(token, JWT_SECRET()) as any;

      await auditService.log({ orgId: org.id, action: 'dated_action', actorId: userId.sub });

      const res = await request(app.getHttpServer())
        .get('/audit/logs?startDate=2020-01-01&endDate=2099-12-31')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
    });
  });

  // ─── 3. Encryption Verification ───────────────────────────────

  describe('Encryption-at-rest verification', () => {
    it('verifies encryption/decryption round-trip', async () => {
      const { org } = await seedOrg('enc-test', 'Enc Test', 'owner@enc-test.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@enc-test.com');

      const res = await request(app.getHttpServer())
        .post('/admin/encryption/verify')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body.status).toBe('ok');
      expect(res.body.envelopeEncryption.works).toBe(true);
      expect(res.body.legacyEncryption.works).toBe(true);
      expect(res.body.keyManagement).toBe('envelope-encryption-with-kek-dek');
    });
  });

  // ─── 4. Data Retention Policies ───────────────────────────────

  describe('Data retention policies', () => {
    it('creates default retention policy on first access', async () => {
      const { org } = await seedOrg('ret-default', 'Ret Default', 'owner@ret-def.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@ret-def.com');

      const res = await request(app.getHttpServer())
        .get('/admin/retention')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.orgId).toBe(org.id);
      expect(res.body.metricsRetentionDays).toBe(90);
      expect(res.body.recordingsRetentionDays).toBe(365);
      expect(res.body.auditRetentionDays).toBe(730);
    });

    it('updates retention policy', async () => {
      const { org } = await seedOrg('ret-update', 'Ret Update', 'owner@ret-upd.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@ret-upd.com');

      const res = await request(app.getHttpServer())
        .post('/admin/retention')
        .set('Authorization', `Bearer ${token}`)
        .send({
          metricsRetentionDays: 30,
          recordingsRetentionDays: 90,
          auditRetentionDays: 180,
          securityScanRetentionDays: 90,
          backupRetentionDays: 14,
        })
        .expect(201);

      expect(res.body.metricsRetentionDays).toBe(30);
      expect(res.body.auditRetentionDays).toBe(180);
      expect(res.body.backupRetentionDays).toBe(14);
    });

    it('enforces retention by purging old data', async () => {
      const { org } = await seedOrg('ret-purge', 'Ret Purge', 'owner@ret-purge.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@ret-purge.com');

      // Create old data (backdated)
      // DeviceMetric with old recordedAt
      const device = await prisma.device.create({
        data: { orgId: org.id, name: 'Old Device', deviceToken: 'old-device-token' },
      });

      const oldDate = new Date('2020-01-01');
      const recentDate = new Date('2040-01-01'); // far in the future

      await prisma.deviceMetric.create({
        data: {
          deviceId: device.id,
          orgId: org.id,
          recordedAt: oldDate,
          cpuUsage: 50,
          ramUsed: BigInt(8000000000),
          ramTotal: BigInt(16000000000),
          ramPercent: 50,
        },
      });

      await prisma.deviceMetric.create({
        data: {
          deviceId: device.id,
          orgId: org.id,
          recordedAt: recentDate,
          cpuUsage: 30,
          ramUsed: BigInt(4000000000),
          ramTotal: BigInt(16000000000),
          ramPercent: 25,
        },
      });

      // Audit log with old date
      await prisma.auditLog.create({
        data: {
          orgId: org.id,
          action: 'old_action',
          createdAt: oldDate,
        },
      });

      await prisma.auditLog.create({
        data: {
          orgId: org.id,
          action: 'recent_action',
          createdAt: recentDate,
        },
      });

      // Set retention to purge everything older than 365 days
      await request(app.getHttpServer())
        .post('/admin/retention')
        .set('Authorization', `Bearer ${token}`)
        .send({
          metricsRetentionDays: 1,
          auditRetentionDays: 1,
          recordingsRetentionDays: 1,
          securityScanRetentionDays: 1,
          backupRetentionDays: 1,
        })
        .expect(201);

      // Enforce
      const enforceRes = await request(app.getHttpServer())
        .post('/admin/retention/enforce')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      // Old data should be deleted
      const remainingMetrics = await prisma.deviceMetric.findMany({ where: { orgId: org.id } });
      const remainingAudit = await prisma.auditLog.findMany({ where: { orgId: org.id } });

      // Only recent records should remain (the ones from 2040)
      expect(remainingMetrics.length).toBe(1);
      expect(remainingMetrics[0].cpuUsage).toBe(30);
      expect(remainingAudit.length).toBe(1);
      expect(remainingAudit[0].action).toBe('recent_action');
    });

    it('enforce-all processes all orgs', async () => {
      const { org: org1 } = await seedOrg('all-1', 'All 1', 'all1@test.com', 'Owner', 'Enterprise');
      const { org: org2 } = await seedOrg('all-2', 'All 2', 'all2@test.com', 'Owner', 'Enterprise');

      const token1 = await loginAs('all1@test.com');

      const enforceAllRes = await request(app.getHttpServer())
        .post('/admin/retention/enforce-all')
        .set('Authorization', `Bearer ${token1}`)
        .expect(201);

      expect(enforceAllRes.body.orgsProcessed).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── 5. Enterprise Admin Console ──────────────────────────────

  describe('Enterprise admin console', () => {
    it('lists all users in the org', async () => {
      const { org } = await seedOrg('admin-users', 'Admin Users', 'owner@admin.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@admin.com');

      // Add more users
      await prisma.user.create({
        data: {
          email: 'tech1@admin.com',
          passwordHash: 'hash',
          displayName: 'Technician One',
          orgId: org.id,
          role: 'Technician',
        },
      });
      await prisma.user.create({
        data: {
          email: 'viewer1@admin.com',
          passwordHash: 'hash',
          displayName: 'Viewer One',
          orgId: org.id,
          role: 'Viewer',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(3);
      const roles = res.body.map((u: any) => u.role);
      expect(roles).toContain('Owner');
      expect(roles).toContain('Technician');
      expect(roles).toContain('Viewer');
    });

    it('updates user role', async () => {
      const { org } = await seedOrg('admin-role', 'Admin Role', 'owner@role.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@role.com');

      const techUser = await prisma.user.create({
        data: {
          email: 'promote@role.com',
          passwordHash: 'hash',
          displayName: 'To Promote',
          orgId: org.id,
          role: 'Technician',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/admin/users/${techUser.id}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'Admin' })
        .expect(201);

      expect(res.body.role).toBe('Admin');

      const updated = await prisma.user.findUnique({ where: { id: techUser.id } });
      expect(updated!.role).toBe('Admin');
    });

    it('removes a user from the org', async () => {
      const { org } = await seedOrg('admin-remove', 'Admin Remove', 'owner@remove.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@remove.com');

      const removableUser = await prisma.user.create({
        data: {
          email: 'remove-me@test.com',
          passwordHash: 'hash',
          displayName: 'Remove Me',
          orgId: org.id,
          role: 'Technician',
        },
      });

      await request(app.getHttpServer())
        .post(`/admin/users/${removableUser.id}/remove`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const deleted = await prisma.user.findUnique({ where: { id: removableUser.id } });
      expect(deleted).toBeNull();
    });

    it('shows org dashboard stats', async () => {
      const { org } = await seedOrg('admin-dash', 'Admin Dash', 'owner@dash.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@dash.com');

      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.devices).toBeDefined();
      expect(res.body.activeRemoteSessions).toBeDefined();
      expect(res.body.openSecurityFindings).toBeDefined();
      expect(res.body.reportsThisMonth).toBeDefined();
      expect(res.body.unresolvedAlerts).toBeDefined();
      expect(res.body.recentActivity).toBeDefined();
    });

    it('shows org info', async () => {
      const { org } = await seedOrg('admin-info', 'Admin Info', 'owner@info.com', 'Owner', 'Enterprise');
      const token = await loginAs('owner@info.com');

      const res = await request(app.getHttpServer())
        .get('/admin/org')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.name).toBe('Admin Info');
      expect(res.body.slug).toBe('admin-info');
      expect(res.body.plan).toBe('Enterprise');
      expect(res.body._count).toBeDefined();
    });
  });
});

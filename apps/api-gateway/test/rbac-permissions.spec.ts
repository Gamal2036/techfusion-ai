import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

/**
 * V1-RBAC-01 controller-level enforcement tests.
 *
 * These exercise the PermissionsGuard as a global guard across real HTTP
 * endpoints: Viewer is denied every mutating/management surface, Technician
 * can operate but not configure, Admin is denied Owner-only lifecycle powers,
 * and Owner can do everything. Backend enforcement only ever reads the
 * membership-resolved role (ORG-01A3), never a client-supplied one.
 */

describe('V1-RBAC-01 RBAC enforcement', () => {
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
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.kbEmbedding.deleteMany();
    await prisma.kbArticle.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.remoteSession.deleteMany();
    await prisma.backupRun.deleteMany();
    await prisma.backupJob.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.softwareInventory.deleteMany();
    await prisma.networkDevice.deleteMany();
    await prisma.networkScan.deleteMany();
    await prisma.securityFinding.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
  });

  async function seedUser(email: string, role: Role) {
    const org = await prisma.organization.create({
      data: { name: `Org ${email}`, slug: `org-${email.replace(/[^a-z0-9]/gi, '').toLowerCase()}` },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: `User ${email}`,
        orgId: org.id,
        role,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role } });
    return { org, user };
  }

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);
    return res.body.accessToken as string;
  }

  function get(server: ReturnType<INestApplication['getHttpServer']>, url: string, token: string) {
    return request(server).get(url).set('Authorization', `Bearer ${token}`);
  }

  function post(server: ReturnType<INestApplication['getHttpServer']>, url: string, token: string, body?: any) {
    return request(server).post(url).set('Authorization', `Bearer ${token}`).send(body ?? {});
  }

  const server = () => app.getHttpServer();

  describe('Viewer is read-only', () => {
    it('is denied every mutating / management surface', async () => {
      await seedUser('viewer-rbac@test.com', 'Viewer');
      const token = await loginAs('viewer-rbac@test.com');
      const { org } = await seedUser('viewer-rbac2@test.com', 'Owner');

      const denied: Array<[string, string, any]> = [
        ['post', '/alerts/rules', { name: 'CPU', metricName: 'cpuUsage', threshold: 90 }],
        ['post', '/enrollment/tokens', { label: 't' }],
        ['post', '/backups/jobs', { name: 'b' }],
        ['post', '/network/discovery/trigger', {}],
        ['post', '/remote-support/sessions', { deviceId: 'none' }],
        ['post', '/inventory/refresh', {}],
        ['post', '/security/scans/none/trigger', {}],
        ['post', '/reports/generate', {}],
        ['get', '/admin/users', undefined],
        ['get', '/billing/history', undefined],
        ['get', '/audit/logs', undefined],
        ['patch', `/organizations/${org.id}/members/x`, { role: 'Technician' }],
      ];

      for (const [method, url, body] of denied) {
        const res = await (method === 'get'
          ? get(server(), url, token)
          : method === 'patch'
            ? request(server()).patch(url).set('Authorization', `Bearer ${token}`).send(body)
            : post(server(), url, token, body));
        expect(res.status).toBe(403);
      }
    });

    it('can read across the product domains', async () => {
      await seedUser('viewer-ro@test.com', 'Viewer');
      const token = await loginAs('viewer-ro@test.com');

      const allowed: string[] = [
        '/devices',
        '/alerts',
        '/network/devices',
        '/inventory/drivers',
        '/backups/jobs',
        '/remote-support/sessions',
        '/billing/plan',
        '/reports',
        '/dashboard/summary',
      ];

      for (const url of allowed) {
        const res = await get(server(), url, token);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('Technician is operational but not configuration', () => {
    it('can trigger scans and read, but not manage rules/enrollment/settings', async () => {
      await seedUser('tech-rbac@test.com', 'Technician');
      const token = await loginAs('tech-rbac@test.com');

      await post(server(), '/network/discovery/trigger', token).expect(201);
      await get(server(), '/devices', token).expect(200);

      await post(server(), '/alerts/rules', token, {
        name: 'CPU', metricName: 'cpuUsage', threshold: 90,
      }).expect(403);
      await post(server(), '/enrollment/tokens', token, { label: 't' }).expect(403);
      await get(server(), '/admin/users', token).expect(403);
      await get(server(), '/billing/history', token).expect(403);
    });
  });

  describe('Admin is denied Owner-only lifecycle powers', () => {
    it('can manage but not rename org, remove members, or touch billing', async () => {
      const { org } = await seedUser('admin-rbac@test.com', 'Admin');
      const token = await loginAs('admin-rbac@test.com');

      await get(server(), '/admin/users', token).expect(200);
      await post(server(), '/alerts/rules', token, {
        name: 'CPU', metricName: 'cpuUsage', threshold: 90,
      }).expect(201);

      await request(server())
        .patch(`/organizations/${org.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hijack' })
        .expect(403);
      await get(server(), '/billing/history', token).expect(403);
      await request(server())
        .delete(`/organizations/${org.id}/members/someone`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  describe('Owner has full access', () => {
    it('can rename the org, manage billing, and manage rules', async () => {
      const { org } = await seedUser('owner-rbac@test.com', 'Owner');
      const token = await loginAs('owner-rbac@test.com');

      await get(server(), '/billing/history', token).expect(200);
      await request(server())
        .patch(`/organizations/${org.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Renamed Org' })
        .expect(200);
      await post(server(), '/alerts/rules', token, {
        name: 'CPU', metricName: 'cpuUsage', threshold: 90,
      }).expect(201);
    });
  });

  describe('Role source of truth is the membership (ORG-01A3)', () => {
    it('a stale Owner token still hits Viewer denial after a downgrade', async () => {
      const { user } = await seedUser('down-rbac@test.com', 'Owner');
      const token = await loginAs('down-rbac@test.com');

      await get(server(), '/billing/history', token).expect(200);

      await prisma.organizationMember.update({
        where: { userId_orgId: { userId: user.id, orgId: user.orgId } },
        data: { role: 'Viewer' },
      });

      await get(server(), '/billing/history', token).expect(403);
    });

    it('a Viewer token cannot escalate by targeting a different org rename', async () => {
      const { user: owner } = await seedUser('own-a@test.com', 'Owner');
      const { org: orgB } = await seedUser('own-b@test.com', 'Owner');
      await prisma.organizationMember.create({
        data: { userId: owner.id, orgId: orgB.id, role: 'Viewer' },
      });

      const token = await loginAs('own-a@test.com');
      // Guard sees the active-org (A) Owner role and passes; the service then
      // enforces the target-org membership (Viewer in B) and denies.
      await request(server())
        .patch(`/organizations/${orgB.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Escalate' })
        .expect(403);
    });
  });
});

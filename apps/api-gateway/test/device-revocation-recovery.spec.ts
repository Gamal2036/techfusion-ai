import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { REVOKE_ACTION } from '../src/admin/admin-recovery.service';

// DEV-REV-01 — Administrative/support stale-device recovery.
// Proof of the safe server-side revocation, unlinking and duplicate-safe
// re-enrollment foundation:
//   * support-only cross-organization recovery (no normal user, no cross-org
//     user, no credential-only identity);
//   * idempotent revocation; safe not-found; stable DEVICE_CREDENTIAL_REVOKED;
//   * pending network/security scans and remote sessions cancelled;
//   * structured audit event with no credential material;
//   * duplicate-safe re-enrollment inside the same org and across orgs;
//   * the old credential never becomes valid again; other devices/orgs intact.

const sha256 = (plain: string) => crypto.createHash('sha256').update(plain).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');
const PASSWORD = 'SecureP@ssw0rd!';

const SUPPORT_KEY = 'support-admin-test-' + crypto.randomBytes(24).toString('hex');

describe('DEV-REV-01 Device Revocation & Recovery', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockQueue: MockQueueService;

  beforeAll(async () => {
    process.env.SUPPORT_ADMIN_API_KEY_HASHES = JSON.stringify([sha256(SUPPORT_KEY)]);

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
    delete process.env.SUPPORT_ADMIN_API_KEY_HASHES;
  });

  beforeEach(async () => {
    mockQueue.clear();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
    await prisma.deviceMetric.deleteMany();
    await prisma.deviceHealthScore.deleteMany();
    await prisma.alert.deleteMany();
    await prisma.alertRule.deleteMany();
    await prisma.remoteSession.deleteMany();
    await prisma.networkScan.deleteMany();
    await prisma.securityScan.deleteMany();
    await prisma.device.deleteMany();
    await prisma.enrollmentToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.auditLog.deleteMany();
  });

  async function freshOrg(slug: string) {
    return prisma.organization.create({
      data: { name: slug, slug: slug + '-' + crypto.randomBytes(3).toString('hex') },
    });
  }

  async function ownerTokenFor(org: any) {
    const email = `owner-${crypto.randomBytes(4).toString('hex')}@test.local`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        displayName: email,
        orgId: org.id,
        role: 'Owner',
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role: 'Owner' } });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });
    expect(login.status).toBe(201);
    return login.body.accessToken as string;
  }

  async function createEnrollmentToken(orgId: string, maxUses = 1) {
    const raw = randomToken();
    const record = await prisma.enrollmentToken.create({
      data: { orgId, tokenHash: sha256(raw), maxUses },
    });
    return { id: record.id, raw };
  }

  const baseRegistration = (fp: string, inst: string) => ({
    name: 'Revocable-Machine',
    hostname: 'revocable.local',
    os: 'Ubuntu 24.04',
    osVersion: '24.04',
    identityFingerprint: fp,
    installationId: inst,
    agentVersion: '1.0.0-beta.5',
    identityVersion: 2,
  });

  function registerPublic(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post('/devices/register-public').send(body);
  }

  function ingest(token: string | undefined) {
    const req = request(app.getHttpServer()).post('/devices/metrics').send({
      cpu: { usage: 30, cores: 4 },
      memory: { total: 16_000, used: 8_000, percent: 50 },
      uptime: 86400,
    });
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  function supportRevokePath(deviceId: string, reason?: string) {
    const req = request(app.getHttpServer())
      .post(`/admin/devices/${deviceId}/revoke-and-unlink`)
      .set('x-support-admin-key', SUPPORT_KEY);
    return reason !== undefined ? req.send({ reason }) : req.send({});
  }

  function supportRevokeByIdentifier(body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/admin/devices/revoke-and-unlink')
      .set('x-support-admin-key', SUPPORT_KEY)
      .send(body);
  }

  async function enrollDevice(orgId: string, fp: string, inst: string, token: string) {
    const res = await registerPublic({
      ...baseRegistration(fp, inst),
      enrollmentToken: token,
    }).expect(201);
    return { deviceId: res.body.device.id as string, deviceToken: res.body.deviceToken as string };
  }

  // ─── 1. Authorized support/admin can revoke a stale device ───────────────

  it('authorized support revokes a stale device identified by deviceId', async () => {
    const org = await freshOrg('r1');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId, deviceToken } = await enrollDevice(org.id, 'fp-r1', 'inst-r1', raw);
    await ingest(deviceToken).expect(201);

    const res = await supportRevokePath(deviceId, 'account credentials unavailable').expect(201);
    expect(res.body.deviceId).toBe(deviceId);
    expect(res.body.organizationId).toBe(org.id);
    expect(res.body.action).toBe(REVOKE_ACTION);
    expect(res.body.alreadyRevoked).toBe(false);
    expect(res.body.revokedAt).toBeDefined();
    expect(res.body.deviceToken).toBeUndefined();
    expect(res.body.deviceTokenHash).toBeUndefined();

    const dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });
    expect(dbDevice?.revokedAt).toBeDefined();
    expect(dbDevice?.revokedReason).toBe('account credentials unavailable');
    expect(dbDevice?.inactive).toBe(true);
    expect(dbDevice?.lastSeenAt).toBeNull();
  });

  it('revokes by identityFingerprint via the identifier route', async () => {
    const org = await freshOrg('r1-fp');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId } = await enrollDevice(org.id, 'fp-r1fp', 'inst-r1fp', raw);

    const res = await supportRevokeByIdentifier({ identityFingerprint: 'fp-r1fp', reason: 'stale' }).expect(201);
    expect(res.body.deviceId).toBe(deviceId);
    expect(await prisma.device.findUnique({ where: { id: deviceId } })).toMatchObject({
      revokedAt: expect.any(Date),
    });
  });

  // ─── 2 / 3. Normal and cross-org users cannot use recovery ───────────────

  it('a normal organization Owner cannot use cross-organization recovery', async () => {
    const org = await freshOrg('r2');
    const owner = await ownerTokenFor(org);
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId } = await enrollDevice(org.id, 'fp-r2', 'inst-r2', raw);

    const res = await request(app.getHttpServer())
      .post(`/admin/devices/${deviceId}/revoke-and-unlink`)
      .set('Authorization', `Bearer ${owner}`)
      .send({});
    expect(res.status).toBe(401);
    expect(await prisma.device.findUnique({ where: { id: deviceId } })).toMatchObject({
      revokedAt: null,
    });
  });

  it('a user from another Organization cannot revoke the device', async () => {
    const orgA = await freshOrg('r3-a');
    const orgB = await freshOrg('r3-b');
    const ownerB = await ownerTokenFor(orgB);
    const { raw } = await createEnrollmentToken(orgA.id, 1);
    const { deviceId } = await enrollDevice(orgA.id, 'fp-r3', 'inst-r3', raw);

    const res = await request(app.getHttpServer())
      .post(`/admin/devices/${deviceId}/revoke-and-unlink`)
      .set('Authorization', `Bearer ${ownerB}`)
      .send({});
    expect(res.status).toBe(401);
    expect(await prisma.device.findUnique({ where: { id: deviceId } })).toMatchObject({
      revokedAt: null,
    });
  });

  it('cannot recover with only an identity attribute and no trusted authorization', async () => {
    const org = await freshOrg('r3-nokey');
    const { raw } = await createEnrollmentToken(org.id, 1);
    await enrollDevice(org.id, 'fp-r3nk', 'inst-r3nk', raw);

    const res = await request(app.getHttpServer())
      .post('/admin/devices/revoke-and-unlink')
      .send({ identityFingerprint: 'fp-r3nk' });
    expect(res.status).toBe(401);

    const res2 = await request(app.getHttpServer())
      .post('/admin/devices/revoke-and-unlink')
      .set('x-support-admin-key', SUPPORT_KEY)
      .send({ installationId: 'inst-r3nk', deviceToken: 'never-accepted' });
    expect(res2.status).toBe(201);
    // A plaintext device credential is never accepted or required; the identity
    // attribute is what matters and the token field is ignored (whitelisted out).
    expect(res2.body.deviceToken).toBeUndefined();
  });

  // ─── 4. Unknown deviceId → safe not-found ────────────────────────────────

  it('an unknown deviceId returns a safe not-found response', async () => {
    const res = await supportRevokePath('does-not-exist-0000', 'stale').expect(404);
    expect(res.body.code).toBe('DEVICE_NOT_FOUND');
    expect(res.body.deviceToken).toBeUndefined();
  });

  it('a missing identifier returns 400 IDENTIFIER_REQUIRED', async () => {
    const res = await supportRevokeByIdentifier({}).expect(400);
    expect(res.body.code).toBe('IDENTIFIER_REQUIRED');
  });

  // ─── 5. Idempotent repeated revocation ───────────────────────────────────

  it('repeated revocation is idempotent', async () => {
    const org = await freshOrg('r5');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId, deviceToken } = await enrollDevice(org.id, 'fp-r5', 'inst-r5', raw);

    await supportRevokePath(deviceId, 'first').expect(201);
    const second = await supportRevokePath(deviceId, 'second').expect(201);
    expect(second.body.alreadyRevoked).toBe(true);
    expect(second.body.revokedAt).toBeDefined();

    const dbDevice = await prisma.device.findUnique({ where: { id: deviceId } });
    expect(dbDevice?.revokedReason).toBe('first');
    expect(dbDevice?.inactive).toBe(true);
    await ingest(deviceToken).expect(401);
  });

  // ─── 6 / 7. Previous credential → 401 DEVICE_CREDENTIAL_REVOKED ──────────

  it('the previous device credential returns 401 with DEVICE_CREDENTIAL_REVOKED', async () => {
    const org = await freshOrg('r6');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId, deviceToken } = await enrollDevice(org.id, 'fp-r6', 'inst-r6', raw);
    await ingest(deviceToken).expect(201);

    await supportRevokePath(deviceId).expect(201);

    const denied = await ingest(deviceToken);
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('DEVICE_CREDENTIAL_REVOKED');

    // The body-token transport (security-report) also fails closed.
    const report = await request(app.getHttpServer())
      .post('/devices/security-report')
      .send({ deviceToken, findings: [] });
    expect(report.status).toBe(401);
  });

  // ─── 8. Active sessions invalidated ──────────────────────────────────────

  it('active remote sessions are terminated', async () => {
    const org = await freshOrg('r8');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId } = await enrollDevice(org.id, 'fp-r8', 'inst-r8', raw);

    await prisma.remoteSession.create({
      data: { orgId: org.id, deviceId, technicianId: 'u-technician', status: 'active', protocol: 'webrtc' },
    });
    await prisma.remoteSession.create({
      data: { orgId: org.id, deviceId, technicianId: 'u-technician', status: 'pending', protocol: 'webrtc' },
    });

    const res = await supportRevokePath(deviceId).expect(201);
    expect(res.body.activeRemoteSessionsTerminated).toBe(2);

    const sessions = await prisma.remoteSession.findMany({ where: { deviceId } });
    for (const s of sessions) {
      expect(s.status).toBe('ended');
      expect(s.endedAt).toBeDefined();
    }
  });

  // ─── 9 / 10 / 11. Pending work cancelled ─────────────────────────────────

  it('pending network and security scans are cancelled or failed', async () => {
    const org = await freshOrg('r9');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId } = await enrollDevice(org.id, 'fp-r9', 'inst-r9', raw);

    await prisma.networkScan.create({
      data: { orgId: org.id, deviceId, status: 'pending', startedAt: new Date() },
    });
    await prisma.networkScan.create({
      data: { orgId: org.id, deviceId, status: 'running', startedAt: new Date() },
    });
    await prisma.securityScan.create({
      data: { orgId: org.id, deviceId, status: 'pending', triggeredBy: 'user' },
    });
    await prisma.securityScan.create({
      data: { orgId: org.id, deviceId, status: 'running', triggeredBy: 'user' },
    });

    const res = await supportRevokePath(deviceId).expect(201);
    expect(res.body.pendingNetworkScansCancelled).toBe(2);
    expect(res.body.pendingSecurityScansCancelled).toBe(2);

    const networkScans = await prisma.networkScan.findMany({ where: { deviceId } });
    for (const s of networkScans) {
      expect(s.status).toBe('failed');
      expect(s.completedAt).toBeDefined();
    }
    const securityScans = await prisma.securityScan.findMany({ where: { deviceId } });
    for (const s of securityScans) {
      expect(s.status).toBe('failed');
      expect(s.completedAt).toBeDefined();
    }
  });

  it('terminal (completed) scans are left intact', async () => {
    const org = await freshOrg('r9b');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId } = await enrollDevice(org.id, 'fp-r9b', 'inst-r9b', raw);

    await prisma.networkScan.create({
      data: { orgId: org.id, deviceId, status: 'completed', startedAt: new Date(), completedAt: new Date() },
    });
    await prisma.securityScan.create({
      data: { orgId: org.id, deviceId, status: 'completed', startedAt: new Date(), completedAt: new Date() },
    });

    await supportRevokePath(deviceId).expect(201);

    expect(
      (await prisma.networkScan.findMany({ where: { deviceId } })).every((s) => s.status === 'completed'),
    ).toBe(true);
    expect(
      (await prisma.securityScan.findMany({ where: { deviceId } })).every((s) => s.status === 'completed'),
    ).toBe(true);
  });

  // ─── 12. Audit event ─────────────────────────────────────────────────────

  it('creates a structured audit event with the required fields', async () => {
    const org = await freshOrg('r12');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId } = await enrollDevice(org.id, 'fp-r12', 'inst-r12', raw);

    const res = await request(app.getHttpServer())
      .post(`/admin/devices/${deviceId}/revoke-and-unlink`)
      .set('x-support-admin-key', SUPPORT_KEY)
      .set('x-request-id', 'req-abc-123')
      .send({ reason: 'stale test account' });

    expect(res.status).toBe(201);

    const audit = await prisma.auditLog.findFirst({
      where: { action: REVOKE_ACTION, targetId: deviceId },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit!.orgId).toBe(org.id);
    expect(audit!.actorId).toBe('support:admin');
    expect(audit!.targetId).toBe(deviceId);
    const details = audit!.details as any;
    expect(details.deviceId).toBe(deviceId);
    expect(details.previousOrganizationId).toBe(org.id);
    expect(details.action).toBe(REVOKE_ACTION);
    expect(details.reason).toBe('stale test account');
    expect(details.requestId).toBe('req-abc-123');
    expect(details.correlationId).toBeDefined();
    expect(audit!.createdAt).toBeDefined();
  });

  // ─── 13. No credential value written to logs ─────────────────────────────

  it('never writes a credential value to logs or responses', async () => {
    const org = await freshOrg('r13');
    const { raw } = await createEnrollmentToken(org.id, 1);
    const { deviceId, deviceToken } = await enrollDevice(org.id, 'fp-r13', 'inst-r13', raw);

    const spyLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const spyError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await supportRevokePath(deviceId, 'stale').expect(201);
      await ingest(deviceToken).expect(401);
    } finally {
      const output = [...spyLog.mock.calls, ...spyWarn.mock.calls, ...spyError.mock.calls]
        .map((c) => c.join(' '))
        .join('\n');
      spyLog.mockRestore();
      spyWarn.mockRestore();
      spyError.mockRestore();
      expect(output).not.toContain(deviceToken);
    }

    const audit = await prisma.auditLog.findFirst({ where: { action: REVOKE_ACTION, targetId: deviceId } });
    expect(JSON.stringify(audit)).not.toContain(deviceToken);
  });

  // ─── 14. Re-enrollment in a new Organization ─────────────────────────────

  it('the same physical device joins a new Organization without reusing the old credential', async () => {
    const orgA = await freshOrg('r14-a');
    const orgB = await freshOrg('r14-b');
    const tokenA = (await createEnrollmentToken(orgA.id, 1)).raw;
    const tokenB = (await createEnrollmentToken(orgB.id, 1)).raw;

    const inA = await enrollDevice(orgA.id, 'fp-shared', 'inst-shared', tokenA);
    await ingest(inA.deviceToken).expect(201);

    await supportRevokePath(inA.deviceId, 'stale').expect(201);

    const inB = await registerPublic({
      ...baseRegistration('fp-shared', 'inst-shared'),
      enrollmentToken: tokenB,
    }).expect(201);
    expect(inB.body.device.id).not.toBe(inA.deviceId);
    expect(inB.body.device.orgId).toBe(orgB.id);
    const tokenB2 = inB.body.deviceToken as string;
    expect(tokenB2).not.toBe(inA.deviceToken);

    await ingest(tokenB2).expect(201);
    expect(await prisma.device.count({ where: { orgId: orgA.id } })).toBe(1);
    expect(await prisma.device.count({ where: { orgId: orgB.id } })).toBe(1);
  });

  // ─── 15. Same-org re-enrollment does not duplicate ───────────────────────

  it('re-enrolling in the same Organization reuses the row (no duplicate)', async () => {
    const org = await freshOrg('r15');
    const token1 = (await createEnrollmentToken(org.id, 1)).raw;
    const token2 = (await createEnrollmentToken(org.id, 1)).raw;

    const first = await enrollDevice(org.id, 'fp-r15', 'inst-r15', token1);
    await supportRevokePath(first.deviceId, 'stale').expect(201);

    const second = await registerPublic({
      ...baseRegistration('fp-r15', 'inst-r15'),
      enrollmentToken: token2,
    }).expect(201);
    expect(second.body.duplicate).toBe(true);
    expect(second.body.device.id).toBe(first.deviceId);
    expect(await prisma.device.count({ where: { orgId: org.id } })).toBe(1);

    const newToken = second.body.deviceToken as string;
    expect(newToken).not.toBe(first.deviceToken);
    await ingest(newToken).expect(201);

    const dbDevice = await prisma.device.findUnique({ where: { id: first.deviceId } });
    expect(dbDevice?.revokedAt).toBeNull();
    expect(dbDevice?.inactive).toBe(false);
    expect(dbDevice?.deviceTokenHash).toBe(sha256(newToken));
  });

  // ─── 16. The old credential never becomes valid again ────────────────────

  it('the old credential never becomes valid again after re-enrollment', async () => {
    const orgA = await freshOrg('r16-a');
    const orgB = await freshOrg('r16-b');
    const tokenA = (await createEnrollmentToken(orgA.id, 1)).raw;
    const tokenB = (await createEnrollmentToken(orgB.id, 1)).raw;

    const inA = await enrollDevice(orgA.id, 'fp-r16', 'inst-r16', tokenA);
    await supportRevokePath(inA.deviceId).expect(201);

    const inB = await registerPublic({
      ...baseRegistration('fp-r16', 'inst-r16'),
      enrollmentToken: tokenB,
    }).expect(201);
    const tokenB2 = inB.body.deviceToken as string;

    // Old org-A credential: still maps to the revoked org-A row → revoked code.
    const denied = await ingest(inA.deviceToken);
    expect(denied.status).toBe(401);
    expect(denied.body.code).toBe('DEVICE_CREDENTIAL_REVOKED');

    // New org-B credential works normally.
    await ingest(tokenB2).expect(201);

    // Body-token transport also rejects the old credential.
    const report = await request(app.getHttpServer())
      .post('/devices/security-report')
      .send({ deviceToken: inA.deviceToken, findings: [] });
    expect(report.status).toBe(401);
  });

  // ─── 17. Other devices and organizations unaffected ──────────────────────

  it('other Devices and Organizations are unaffected', async () => {
    const orgA = await freshOrg('r17-a');
    const orgB = await freshOrg('r17-b');

    const tokenA1 = (await createEnrollmentToken(orgA.id, 1)).raw;
    const tokenA2 = (await createEnrollmentToken(orgA.id, 1)).raw;
    const tokenB = (await createEnrollmentToken(orgB.id, 1)).raw;

    const victim = await enrollDevice(orgA.id, 'fp-victim', 'inst-victim', tokenA1);
    const survivor = await enrollDevice(orgA.id, 'fp-survivor', 'inst-survivor', tokenA2);
    const bDevice = await enrollDevice(orgB.id, 'fp-b', 'inst-b', tokenB);

    await supportRevokePath(victim.deviceId, 'stale').expect(201);

    // Survivor in the same org keeps its credential and presence.
    await ingest(survivor.deviceToken).expect(201);
    // Device in another org is untouched.
    await ingest(bDevice.deviceToken).expect(201);
    // The revoked device's credential is dead.
    await ingest(victim.deviceToken).expect(401);

    const deviceA = await prisma.device.findUnique({ where: { id: survivor.deviceId } });
    expect(deviceA?.revokedAt).toBeNull();
    expect(deviceA?.inactive).toBe(false);
    const deviceB = await prisma.device.findUnique({ where: { id: bDevice.deviceId } });
    expect(deviceB?.revokedAt).toBeNull();

    expect(await prisma.device.count({ where: { orgId: orgA.id } })).toBe(2);
    expect(await prisma.device.count({ where: { orgId: orgB.id } })).toBe(1);
  });
});

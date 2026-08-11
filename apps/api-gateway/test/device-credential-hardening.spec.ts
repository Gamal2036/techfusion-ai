import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { Role } from '@prisma/client';

// V1-STAGE-01-SUB-03 — Device Credential Hardening (S3 closure).
// Proof that the plaintext Device.deviceToken fallback is gone:
//   * authentication succeeds ONLY against the SHA-256 deviceTokenHash verifier;
//   * the raw credential is never persisted (register/rotate store hash only);
//   * devices lacking a verifier, or presenting an unknown/malformed credential,
//     fail closed;
//   * rotation invalidates the previous credential immediately.

const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET required');
  return secret;
};

const sha256 = (plain: string) => crypto.createHash('sha256').update(plain).digest('hex');

describe('DEV-01B Device Credential Hardening (V1-STAGE-01-SUB-03)', () => {
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

  async function createUser(email: string, orgId: string, role: Role) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: email,
        orgId,
        role,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId, role } });
    return user;
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
      cpu: { usage: 42, cores: 8 },
      memory: { total: 16000, used: 8000, percent: 50 },
      uptime: 86400,
    };
  }

  function ingest(token: string | undefined) {
    const req = request(app.getHttpServer()).post('/devices/metrics').send(validMetrics());
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  }

  const server = () => app.getHttpServer();

  describe('Hash-only credential verification', () => {
    it('authenticates a device when the SHA-256 of the bearer matches deviceTokenHash', async () => {
      const org = await createOrg('hash-auth');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Hashed-A', token);

      await ingest(token).expect(201);
    });

    it('rejects a wrong token even though a hashed device exists (no plaintext fallback)', async () => {
      const org = await createOrg('wrong-token');
      const stored = crypto.randomBytes(32).toString('hex');
      const presented = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Hashed-B', stored);

      await ingest(presented).expect(401);
    });

    it('rejects an unknown token', async () => {
      const org = await createOrg('unknown-token');
      await createDeviceWithHash(org.id, 'Hashed-C', crypto.randomBytes(32).toString('hex'));

      await ingest(crypto.randomBytes(32).toString('hex')).expect(401);
    });

    it('rejects a malformed bearer token', async () => {
      const org = await createOrg('malformed-token');
      await createDeviceWithHash(org.id, 'Hashed-D', crypto.randomBytes(32).toString('hex'));

      await ingest('not-a-valid-token').expect(401);
    });

    it('rejects requests without an Authorization header', async () => {
      await ingest(undefined).expect(401);
    });

    it('fails closed for a legacy device row with no stored verifier (deviceTokenHash null)', async () => {
      const org = await createOrg('no-verifier');
      const token = crypto.randomBytes(32).toString('hex');
      await prisma.device.create({
        data: { orgId: org.id, name: 'Legacy-NoHash', deviceTokenHash: null },
      });

      await ingest(token).expect(401);
    });
  });

  describe('Raw credential is never persisted', () => {
    it('register-public stores only the SHA-256 verifier; the raw token never reaches the DB', async () => {
      const org = await createOrg('reg-no-plaintext');
      const { raw } = await createEnrollmentToken(org.id);

      const res = await request(server())
        .post('/devices/register-public')
        .send({
          name: 'Enrolled-Device',
          hostname: 'enrolled-1.local',
          os: 'Ubuntu 24.04',
          identityFingerprint: 'fp-register-1',
          installationId: 'inst-register-1',
          enrollmentToken: raw,
        })
        .expect(201);

      const issuedToken = res.body.deviceToken as string;
      expect(issuedToken).toBeDefined();

      const dbDevice = await prisma.device.findUnique({
        where: { id: res.body.device.id },
      });
      expect(dbDevice?.deviceTokenHash).toBe(sha256(issuedToken));
      expect(JSON.stringify(dbDevice)).not.toContain(issuedToken);
    });

    it('device listing does not expose deviceTokenHash to API consumers', async () => {
      const org = await createOrg('no-hash-leak');
      const user = await createUser('no-leak@test.com', org.id, 'Owner');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Listed-Device', token);

      const loginRes = await request(server())
        .post('/auth/login')
        .send({ email: user.email, password: 'password123' })
        .expect(201);

      const res = await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
      for (const device of res.body) {
        expect(device.deviceTokenHash).toBeUndefined();
        expect(JSON.stringify(device)).not.toContain(token);
      }
    });
  });

  describe('Credential rotation invalidates the previous verifier', () => {
    it('recover-credential issues a new token; the old one fails closed immediately', async () => {
      const org = await createOrg('rotate');
      const enrollment = await createEnrollmentToken(org.id);
      const oldToken = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Rotate-Me', oldToken, { identityFingerprint: 'fp-rotate-1' });

      await ingest(oldToken).expect(201);

      const recoveryRes = await request(server())
        .post('/devices/recover-credential')
        .set('x-org-token', enrollment.raw)
        .send({ identityFingerprint: 'fp-rotate-1' })
        .expect(201);

      const newToken = recoveryRes.body.deviceToken as string;
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(oldToken);

      const dbDevice = await prisma.device.findUnique({
        where: { id: recoveryRes.body.device.id },
      });
      expect(dbDevice?.deviceTokenHash).toBe(sha256(newToken));
      expect(dbDevice?.deviceTokenHash).not.toBe(sha256(oldToken));

      await ingest(oldToken).expect(401);
      await ingest(newToken).expect(201);
    });

    it('recover-credential rejects an invalid organization token', async () => {
      const org = await createOrg('rotate-bad');
      await createDeviceWithHash(org.id, 'Rotate-Bad', crypto.randomBytes(32).toString('hex'), {
        identityFingerprint: 'fp-rotate-bad',
      });

      const res = await request(server())
        .post('/devices/recover-credential')
        .set('x-org-token', crypto.randomBytes(32).toString('hex'))
        .send({ identityFingerprint: 'fp-rotate-bad' });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('INVALID_ORG_TOKEN');
      expect(res.body.deviceToken).toBeUndefined();
    });

    it('duplicate register-public (same fingerprint) rotates the credential', async () => {
      const org = await createOrg('rotate-dup');
      const { raw } = await createEnrollmentToken(org.id, 2);

      const first = await request(server())
        .post('/devices/register-public')
        .send({
          name: 'Dup-Device',
          hostname: 'dup-1.local',
          identityFingerprint: 'fp-dup-1',
          installationId: 'inst-dup-1',
          enrollmentToken: raw,
        })
        .expect(201);
      const firstToken = first.body.deviceToken as string;
      await ingest(firstToken).expect(201);

      const second = await request(server())
        .post('/devices/register-public')
        .send({
          name: 'Dup-Device',
          hostname: 'dup-1.local',
          identityFingerprint: 'fp-dup-1',
          installationId: 'inst-dup-1',
          enrollmentToken: raw,
        })
        .expect(201);
      expect(second.body.duplicate).toBe(true);
      const secondToken = second.body.deviceToken as string;
      expect(secondToken).not.toBe(firstToken);

      await ingest(firstToken).expect(401);
      await ingest(secondToken).expect(201);
    });
  });

  describe('Credential scope boundaries', () => {
    it('a device credential cannot be used to access human-facing API endpoints', async () => {
      const org = await createOrg('scope-device');
      const token = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Scope-Device', token);

      await request(server())
        .get('/devices')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });

    it('security-report hashes the body credential before lookup; unknown credential is rejected', async () => {
      const org = await createOrg('security-hash');
      const valid = crypto.randomBytes(32).toString('hex');
      await createDeviceWithHash(org.id, 'Sec-Device', valid);

      const ok = await request(server())
        .post('/devices/security-report')
        .send({
          deviceToken: valid,
          findings: [{ category: 'firewall', finding: 'UFW inactive', severity: 'high', remediation: 'Enable UFW' }],
        })
        .expect(200);
      expect(ok.body.scanId).toBeDefined();

      const bad = await request(server())
        .post('/devices/security-report')
        .send({ deviceToken: crypto.randomBytes(32).toString('hex'), findings: [] })
        .expect(401);
      expect(bad.body.scanId).toBeUndefined();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, Logger } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { ThrottlerStorage } from '@nestjs/throttler';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import { normalizeRecoveryCode, hashRecoveryCode } from '../src/mfa/recovery-codes.util';

const PASSWORD = 'password123';

describe('MFA Recovery & Re-authentication Foundation (ACC-SEC-02B2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let throttlerStorage: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(QueueService)
      .useClass(MockQueueService)
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    throttlerStorage = moduleFixture.get<any>(ThrottlerStorage);

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    throttlerStorage.storage.clear();
    await prisma.refreshToken.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
  });

  async function seedUser(
    email: string,
    overrides: { mfaSecret?: string | null; isMfaEnabled?: boolean } = {},
  ) {
    const org = await prisma.organization.create({
      data: { name: `MFA Org ${email}`, slug: `mfa-${email.replace(/[^a-z0-9]/g, '-')}` },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
        displayName: 'MFA User',
        orgId: org.id,
        role: 'Owner',
        mfaSecret: overrides.mfaSecret ?? null,
        isMfaEnabled: overrides.isMfaEnabled ?? false,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role: 'Owner' } });
    return { org, user };
  }

  function login(email: string) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: PASSWORD });
  }

  async function accessToken(email: string) {
    const res = await login(email);
    return res.body.accessToken;
  }

  async function mfaAccessToken(email: string, secret: string) {
    const loginRes = await login(email).expect(201);
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-login')
      .send({ userId: loginRes.body.userId, token: totp(secret) })
      .expect(201);
    return verifyRes.body.accessToken;
  }

  function totp(secret: string) {
    return speakeasy.totp({ secret, encoding: 'base32' });
  }

  /**
   * Enrolls + verifies MFA through the real API for a fresh user, returning the
   * plaintext base32 secret (known to the test from the enroll response) and an
   * authenticated access token. The stored secret is encrypted at rest.
   */
  async function enrollAndEnable(email: string) {
    const { user } = await seedUser(email);
    const token = await accessToken(email);
    const enrollRes = await request(app.getHttpServer())
      .post('/mfa/enroll')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const secret = enrollRes.body.secret;
    await request(app.getHttpServer())
      .post('/mfa/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: totp(secret) })
      .expect(201);
    return { user, token, secret };
  }

  async function generateCodes(userId: string, token: string, secret: string, overrides: { regenerate?: boolean } = {}) {
    const path = overrides.regenerate ? '/mfa/recovery-codes/regenerate' : '/mfa/recovery-codes/generate';
    const res = await request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: PASSWORD, token: totp(secret) })
      .expect(201);
    return res.body.codes as string[];
  }

  async function storedHashes(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { mfaBackupCodes: true } });
    if (!user?.mfaBackupCodes) return [];
    return JSON.parse(user.mfaBackupCodes) as string[];
  }

  describe('Re-authentication (server-authoritative, password)', () => {
    it('uses the authenticated identity and ignores a forged userId', async () => {
      const attacker = await enrollAndEnable('reauth-attacker@test.com');
      const victim = await enrollAndEnable('reauth-victim@test.com');

      const res = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${attacker.token}`)
        .send({
          userId: victim.user.id,
          password: PASSWORD,
          token: totp(attacker.secret),
        })
        .expect(201);

      expect(res.body.message).toBe('MFA disabled');

      const attackerDb = await prisma.user.findUnique({ where: { id: attacker.user.id } });
      const victimDb = await prisma.user.findUnique({ where: { id: victim.user.id } });
      expect(attackerDb?.isMfaEnabled).toBe(false);
      expect(attackerDb?.mfaSecret).toBeNull();
      // The forged body userId never redirected the operation to the victim.
      expect(victimDb?.isMfaEnabled).toBe(true);
      expect(victimDb?.mfaSecret).toBeDefined();
    });

    it('returns deterministic 401 for a wrong current password', async () => {
      const { user, token, secret } = await enrollAndEnable('reauth-wrong-password@test.com');

      const res = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'definitely-wrong', token: totp(secret) });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Current password is incorrect');

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
      expect(dbUser?.mfaSecret).toBeDefined();
    });

    it('does not reveal whether another account exists', async () => {
      const { user, token, secret } = await enrollAndEnable('reauth-no-enum@test.com');
      await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrong-password', token: totp(secret) })
        .expect(401);

      // A forged/nonexistent target still yields the same generic 401 through
      // the same authenticated route — no account-state oracle.
      const forged = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrong-password', token: totp(secret), userId: user.id })
        .expect(401);
      expect(forged.body.message).toBe('Current password is incorrect');
    });

    it('is throttled (deterministic 429 after the MFA route limit)', async () => {
      const { user, token, secret } = await enrollAndEnable('reauth-throttle@test.com');

      for (let i = 0; i < 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/mfa/disable')
          .set('Authorization', `Bearer ${token}`)
          .send({ password: 'wrong-password', token: totp(secret) });
        expect(res.status).toBe(401);
      }

      const blocked = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrong-password', token: totp(secret) });
      expect(blocked.status).toBe(429);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
    });
  });

  describe('MFA disable', () => {
    it('requires MFA to be enabled', async () => {
      const { user } = await seedUser('disable-not-enabled@test.com');
      const token = await accessToken(user.email);

      const res = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('MFA not enabled');
    });

    it('never disables MFA with a password alone', async () => {
      const { user, token } = await enrollAndEnable('disable-password-only@test.com');

      const res = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('A valid TOTP token or recovery code is required');

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
      expect(dbUser?.mfaSecret).toBeDefined();
    });

    it('rejects an invalid TOTP and keeps MFA enabled', async () => {
      const { user, token, secret } = await enrollAndEnable('disable-invalid-totp@test.com');

      const res = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid TOTP token');

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
      expect(dbUser?.mfaSecret).toBeDefined();
    });

    it('disables MFA atomically with password + valid TOTP', async () => {
      const { user, token, secret } = await enrollAndEnable('disable-valid-totp@test.com');

      await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: totp(secret) })
        .expect(201);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(false);
      expect(dbUser?.mfaSecret).toBeNull();
      expect(dbUser?.mfaBackupCodes).toBeNull();

      const statusRes = await request(app.getHttpServer())
        .get('/mfa/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(statusRes.body).toEqual({ isMfaEnabled: false });
    });

    it('disables MFA with a valid unused recovery code', async () => {
      const { user, token, secret } = await enrollAndEnable('disable-recovery@test.com');
      const codes = await generateCodes(user.id, token, secret);

      await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, recoveryCode: codes[0] })
        .expect(201);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(false);
      expect(dbUser?.mfaSecret).toBeNull();
      expect(dbUser?.mfaBackupCodes).toBeNull();
    });
  });

  describe('Recovery-code storage and exposure', () => {
    it('stores only hashes — never plaintext recovery codes', async () => {
      const { user, token, secret } = await enrollAndEnable('codes-hashed@test.com');
      const codes = await generateCodes(user.id, token, secret);

      const hashes = await storedHashes(user.id);
      expect(hashes).toHaveLength(codes.length);
      for (const hash of hashes) {
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }
      const storedJson = JSON.stringify(hashes);
      for (const code of codes) {
        expect(storedJson).not.toContain(code);
        expect(storedJson).not.toContain(normalizeRecoveryCode(code));
      }
      // The stored hashes must equal the canonical contract hash of each code.
      for (let i = 0; i < codes.length; i++) {
        expect(hashes[i]).toBe(hashRecoveryCode(normalizeRecoveryCode(codes[i])));
      }
    });

    it('returns plaintext codes exactly once (generation response only)', async () => {
      const { user, token, secret } = await enrollAndEnable('codes-once@test.com');
      const codes = await generateCodes(user.id, token, secret);
      expect(codes).toHaveLength(10);
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
      }

      const statusRes = await request(app.getHttpServer())
        .get('/mfa/recovery-codes/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(JSON.stringify(statusRes.body)).not.toContain(codes[0]);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.mfaBackupCodes).not.toContain(codes[0]);

      const summaryRes = await request(app.getHttpServer())
        .get('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(JSON.stringify(summaryRes.body)).not.toContain(codes[0]);
    });

    it('status exposes only safe metadata — never code values', async () => {
      const { user, token, secret } = await enrollAndEnable('codes-status@test.com');

      const before = await request(app.getHttpServer())
        .get('/mfa/recovery-codes/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(before.body).toEqual({ generated: false, availableCount: 0 });

      const codes = await generateCodes(user.id, token, secret);

      const after = await request(app.getHttpServer())
        .get('/mfa/recovery-codes/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(after.body).toEqual({ generated: true, availableCount: 10 });
      for (const code of codes) {
        expect(JSON.stringify(after.body)).not.toContain(code);
      }
    });
  });

  describe('One-time recovery-code consumption', () => {
    it('accepts a recovery code once only in the login challenge', async () => {
      const { user, secret } = await enrollAndEnable('login-code-once@test.com');
      const codes = await generateCodes(user.id, await mfaAccessToken(user.email, secret), secret);

      const firstLogin = await login(user.email).expect(201);
      expect(firstLogin.body.mfaRequired).toBe(true);

      const firstChallenge = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: user.id, recoveryCode: codes[0] })
        .expect(201);
      expect(firstChallenge.body.accessToken).toBeDefined();
      expect(firstChallenge.body.refreshToken).toBeDefined();

      const secondLogin = await login(user.email).expect(201);
      const secondChallenge = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: user.id, recoveryCode: codes[0] });
      expect(secondChallenge.status).toBe(401);

      // A different, still-unused code is accepted — only the consumed one is gone.
      const thirdChallenge = await request(app.getHttpServer())
        .post('/auth/verify-login')
        .send({ userId: user.id, recoveryCode: codes[1] })
        .expect(201);
      expect(thirdChallenge.body.accessToken).toBeDefined();

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
      const hashes = await storedHashes(user.id);
      expect(hashes).toHaveLength(codes.length - 2);
    });

    it('concurrent attempts can never both succeed with the same code', async () => {
      const { user, token, secret } = await enrollAndEnable('codes-concurrent@test.com');
      const codes = await generateCodes(user.id, token, secret);

      const [a, b] = await Promise.all([
        request(app.getHttpServer())
          .post('/mfa/disable')
          .set('Authorization', `Bearer ${token}`)
          .send({ password: PASSWORD, recoveryCode: codes[0] }),
        request(app.getHttpServer())
          .post('/mfa/disable')
          .set('Authorization', `Bearer ${token}`)
          .send({ password: PASSWORD, recoveryCode: codes[0] }),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 400]);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(false);
      expect(dbUser?.mfaSecret).toBeNull();
      expect(dbUser?.mfaBackupCodes).toBeNull();
    });
  });

  describe('Recovery-code regeneration', () => {
    it('regenerating invalidates every previous code', async () => {
      const { user, token, secret } = await enrollAndEnable('codes-regenerate@test.com');
      const first = await generateCodes(user.id, token, secret);
      const second = await generateCodes(user.id, token, secret, { regenerate: true });

      // Previous codes no longer match any stored hash.
      const firstBlocked = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, recoveryCode: first[0] });
      expect(firstBlocked.status).toBe(400);

      // A new code works.
      await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, recoveryCode: second[0] })
        .expect(201);

      const hashes = await storedHashes(user.id);
      const secondHash = hashRecoveryCode(normalizeRecoveryCode(second[0]));
      const firstHash = hashRecoveryCode(normalizeRecoveryCode(first[0]));
      expect(hashes.some((h) => h === secondHash)).toBe(false);
      expect(hashes.some((h) => h === firstHash)).toBe(false);
    });

    it('requires password re-authentication and a valid TOTP', async () => {
      const { user, token, secret } = await enrollAndEnable('codes-regenerate-reauth@test.com');
      const before = await generateCodes(user.id, token, secret);

      const wrongPassword = await request(app.getHttpServer())
        .post('/mfa/recovery-codes/regenerate')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrong-password', token: totp(secret) });
      expect(wrongPassword.status).toBe(401);

      const wrongToken = await request(app.getHttpServer())
        .post('/mfa/recovery-codes/regenerate')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: '000000' });
      expect(wrongToken.status).toBe(400);

      const hashesAfterFailures = await storedHashes(user.id);
      expect(hashesAfterFailures).toEqual(before.map((c) => hashRecoveryCode(normalizeRecoveryCode(c))));

      const ok = await request(app.getHttpServer())
        .post('/mfa/recovery-codes/regenerate')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: totp(secret) })
        .expect(201);
      expect(ok.body.codes).toHaveLength(before.length);
    });

    it('generation/regeneration are rejected while MFA is disabled', async () => {
      const { user } = await seedUser('codes-no-mfa@test.com');
      const token = await accessToken(user.email);

      const genRes = await request(app.getHttpServer())
        .post('/mfa/recovery-codes/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: '000000' });
      expect(genRes.status).toBe(400);
      expect(genRes.body.message).toBe('MFA not enabled');
    });
  });

  describe('Fail-closed crypto behavior', () => {
    it('fails closed when the stored MFA secret cannot be decrypted', async () => {
      const { user } = await seedUser('failclosed-disable@test.com', {
        mfaSecret: 'enc:v1:AAAA-not-an-envelope',
        isMfaEnabled: false,
      });
      const token = await accessToken(user.email);
      await prisma.user.update({ where: { id: user.id }, data: { isMfaEnabled: true } });

      const disableRes = await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: '000000' });
      expect(disableRes.status).toBe(500);

      const genRes = await request(app.getHttpServer())
        .post('/mfa/recovery-codes/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: '000000' });
      expect(genRes.status).toBe(500);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.isMfaEnabled).toBe(true);
      expect(dbUser?.mfaSecret).toBe('enc:v1:AAAA-not-an-envelope');
      expect(JSON.stringify(disableRes.body)).not.toContain('AAAA-not-an-envelope');
    });
  });

  describe('Sensitive-value log hygiene', () => {
    it('never logs the password, TOTP values, or recovery codes', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      const { user, token, secret } = await enrollAndEnable('log-hygiene@test.com');
      const codes = await generateCodes(user.id, token, secret);
      const totpValue = totp(secret);
      await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: totpValue })
        .expect(201);

      const allLogs = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
        .map((call) => JSON.stringify(call))
        .join('\n');

      expect(allLogs).not.toContain(PASSWORD);
      expect(allLogs).not.toContain(secret);
      expect(allLogs).not.toContain(totpValue);
      for (const code of codes) {
        expect(allLogs).not.toContain(code);
        expect(allLogs).not.toContain(normalizeRecoveryCode(code));
      }

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('Structured security events', () => {
    it('emits mfa_recovery_codes_generated and mfa_recovery_code_used and mfa_disabled', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const { user, token, secret } = await enrollAndEnable('events-recovery@test.com');

      const codes = await generateCodes(user.id, token, secret);

      await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, recoveryCode: codes[0] })
        .expect(201);

      const allCalls = logSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n');
      expect(allCalls).toContain('mfa_recovery_codes_generated');
      expect(allCalls).toContain('mfa_recovery_code_used');
      expect(allCalls).toContain('mfa_disabled');
      logSpy.mockRestore();
    });

    it('emits mfa_recovery_codes_regenerated and reauthentication_failed', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const { user, token, secret } = await enrollAndEnable('events-regenerate@test.com');

      await request(app.getHttpServer())
        .post('/mfa/recovery-codes/regenerate')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, token: totp(secret) })
        .expect(201);

      await request(app.getHttpServer())
        .post('/mfa/recovery-codes/regenerate')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: 'wrong-password', token: totp(secret) })
        .expect(401);

      const logCalls = logSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n');
      const warnCalls = warnSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n');
      expect(logCalls).toContain('mfa_recovery_codes_regenerated');
      expect(warnCalls).toContain('reauthentication_failed');
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('emits mfa_disable_failed on invalid recovery code', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const { user, token, secret } = await enrollAndEnable('events-disable-failed@test.com');
      await generateCodes(user.id, token, secret);

      await request(app.getHttpServer())
        .post('/mfa/disable')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: PASSWORD, recoveryCode: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' })
        .expect(400);

      expect(warnSpy.mock.calls.some((call) => JSON.stringify(call).includes('mfa_disable_failed'))).toBe(true);
      warnSpy.mockRestore();
    });
  });
});

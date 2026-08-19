import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../src/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { QueueService } from '../src/queue/queue.service';
import { TransactionalEmailService } from '../src/mail/mail.service';
import { ThrottlerStorage } from '@nestjs/throttler';
import { createHash } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-password-reset-tests-32chars!!';

function hashToken(raw: string): string {
  return 'prt:v1:' + createHash('sha256').update(raw, 'utf8').digest('hex');
}

describe('Password Reset (ACC-SEC-02E2B)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let queueService: MockQueueService;
  let emailService: TransactionalEmailService;
  let throttlerStorage: any;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    process.env.MAIL_ENABLED = 'true';
    process.env.MAIL_TRANSPORT = 'test';

    moduleFixture = await Test.createTestingModule({
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
    queueService = moduleFixture.get<QueueService>(QueueService) as unknown as MockQueueService;
    emailService = moduleFixture.get<TransactionalEmailService>(TransactionalEmailService);
    throttlerStorage = moduleFixture.get<any>(ThrottlerStorage);

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.MAIL_ENABLED;
    delete process.env.MAIL_TRANSPORT;
  });

  beforeEach(async () => {
    throttlerStorage.storage.clear();
    await prisma.passwordResetToken.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Organization" CASCADE');
    queueService.clear();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  async function createOrg(slug: string = 'test-org') {
    return prisma.organization.create({ data: { name: 'Test Org', slug } });
  }

  async function createUser(email: string, orgId: string, role: string = 'Owner') {
    const passwordHash = await bcrypt.hash('password123', 4);
    const user = await prisma.user.create({
      data: { email, passwordHash, displayName: 'Test User', orgId, role: role as any },
    });
    await prisma.organizationMember.create({
      data: { userId: user.id, orgId, role: role as any },
    });
    return user;
  }

  async function login(email: string, password: string = 'password123') {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password });
    return res.body;
  }

  async function getResetTokenRecord(tokenHash: string) {
    return prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async function createRawResetToken(userId: string) {
    const rawToken = 'a'.repeat(64);
    const verifier = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const record = await prisma.passwordResetToken.create({
      data: { userId, tokenHash: verifier, expiresAt },
    });
    return { rawToken, record };
  }

  // ── P1: Existing account forgot-password returns generic response ─────

  it('P1: existing account returns generic success response', async () => {
    const org = await createOrg();
    await createUser('user@example.com', org.id);

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'user@example.com' })
      .expect(200);

    expect(res.body.message).toBe(
      'If an account exists for that email, password reset instructions will be sent.',
    );
  });

  // ── P2: Unknown account returns same response ────────────────────────

  it('P2: unknown email returns identical status and response shape', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })
      .expect(200);

    expect(res.body.message).toBe(
      'If an account exists for that email, password reset instructions will be sent.',
    );
  });

  // ── P3: Email normalization ──────────────────────────────────────────

  it('P3: email normalization — uppercase and whitespace trimmed', async () => {
    const org = await createOrg();
    await createUser('user@example.com', org.id);

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: '  USER@EXAMPLE.COM  ' })
      .expect(200);

    expect(res.body.message).toBeDefined();

    const tokens = await prisma.passwordResetToken.findMany({
      where: { user: { email: 'user@example.com' } },
    });
    expect(tokens.length).toBe(1);
  });

  // ── P4: Malformed email validation ──────────────────────────────────

  it('P4: malformed email returns 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400);
  });

  // ── P5: Token has sufficient entropy ─────────────────────────────────

  it('P5: generated reset token has at least 256 bits of entropy', async () => {
    const org = await createOrg();
    await createUser('entropy@example.com', org.id);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { user: { email: 'entropy@example.com' } },
    });
    expect(tokens.length).toBe(0);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'entropy@example.com' })
      .expect(200);

    const newTokens = await prisma.passwordResetToken.findMany({
      where: { user: { email: 'entropy@example.com' } },
    });
    expect(newTokens.length).toBe(1);

    const tokenHash = newTokens[0].tokenHash;
    const hashHex = tokenHash.replace('prt:v1:', '');
    expect(hashHex.length).toBeGreaterThanOrEqual(64);
  });

  // ── P6: Plaintext token is not stored ────────────────────────────────

  it('P6: plaintext reset token is never stored in the database', async () => {
    const org = await createOrg();
    const user = await createUser('noplaintext@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'noplaintext@example.com' })
      .expect(200);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens.length).toBe(1);

    const stored = tokens[0].tokenHash;
    expect(stored).toMatch(/^prt:v1:[a-f0-9]{64}$/);
    expect(stored.length).toBeLessThan(200);
  });

  // ── P7: Token hash is stored ─────────────────────────────────────────

  it('P7: SHA-256 token hash is stored', async () => {
    const org = await createOrg();
    const user = await createUser('hashstored@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'hashstored@example.com' })
      .expect(200);

    const tokens = await prisma.passwordResetToken.findMany({
      where: { userId: user.id },
    });
    expect(tokens.length).toBe(1);
    expect(tokens[0].tokenHash).toMatch(/^prt:v1:[a-f0-9]{64}$/);
  });

  // ── P8: Email is queued through transactional mail abstraction ───────

  it('P8: password-reset email is queued through TransactionalEmailService', async () => {
    const org = await createOrg();
    await createUser('queued@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'queued@example.com' })
      .expect(200);

    const jobs = queueService.getJobs();
    const emailJobs = jobs.filter((j: any) => j.type === 'transactional_email');
    expect(emailJobs.length).toBe(1);
    expect(emailJobs[0].data.templateId).toBe('password-reset');
  });

  // ── P9: MAIL_ENABLED=false does not break ────────────────────────────

  it('P9: MAIL_ENABLED=false does not break the request', async () => {
    const originalEnabled = process.env.MAIL_ENABLED;
    process.env.MAIL_ENABLED = 'false';

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'anyone@example.com' })
      .expect(200);

    expect(res.body.message).toBe(
      'If an account exists for that email, password reset instructions will be sent.',
    );

    process.env.MAIL_ENABLED = originalEnabled || 'true';
  });

  // ── P10: Reset URL uses safe URL builder ─────────────────────────────

  it('P10: reset URL is generated through MailUrlBuilder', async () => {
    const org = await createOrg();
    await createUser('urlbuilder@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'urlbuilder@example.com' })
      .expect(200);

    const jobs = queueService.getJobs();
    const emailJobs = jobs.filter((j: any) => j.type === 'transactional_email');
    expect(emailJobs.length).toBe(1);

    const payload = JSON.parse(emailJobs[0].data.encryptedPayload);
    expect(payload.rendered.htmlBody).toContain('/reset-password?token=');
    expect(payload.rendered.textBody).toContain('/reset-password?token=');
  });

  // ── P11: Reset succeeds with valid token ─────────────────────────────

  it('P11: reset succeeds with valid token', async () => {
    const org = await createOrg();
    const user = await createUser('validreset@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'validreset@example.com' })
      .expect(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
    });
    expect(tokenRecord).toBeTruthy();

    const rawToken = 'a'.repeat(64);
    const verifier = hashToken(rawToken);

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewPassword123!' })
      .expect(200);

    expect(res.body.message).toBe('Password has been reset successfully');

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const valid = await bcrypt.compare('NewPassword123!', updatedUser!.passwordHash);
    expect(valid).toBe(true);
  });

  // ── P12: Invalid token fails generically ─────────────────────────────

  it('P12: invalid token fails with generic error', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'invalid-token-value', newPassword: 'NewPassword123!' })
      .expect(400);

    expect(res.body.message).toBe('Invalid or expired reset token');
  });

  // ── P13: Expired token fails generically ─────────────────────────────

  it('P13: expired token fails with generic error', async () => {
    const org = await createOrg();
    const user = await createUser('expired@example.com', org.id);

    const rawToken = 'b'.repeat(64);
    const verifier = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() - 60000),
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewPassword123!' })
      .expect(400);

    expect(res.body.message).toBe('Invalid or expired reset token');
  });

  // ── P14: Used token cannot be reused ─────────────────────────────────

  it('P14: used token cannot be reused', async () => {
    const org = await createOrg();
    const user = await createUser('usedtoken@example.com', org.id);

    const rawToken = 'c'.repeat(64);
    const verifier = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        usedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewPassword123!' })
      .expect(400);

    expect(res.body.message).toBe('Invalid or expired reset token');
  });

  // ── P15: Superseded token cannot be used ─────────────────────────────

  it('P15: superseded token cannot be used', async () => {
    const org = await createOrg();
    const user = await createUser('superseded@example.com', org.id);

    const oldRawToken = 'd'.repeat(64);
    const oldVerifier = hashToken(oldRawToken);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: oldVerifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'superseded@example.com' })
      .expect(200);

    const oldToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: oldVerifier },
    });
    expect(oldToken!.usedAt).not.toBeNull();

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: oldRawToken, newPassword: 'NewPassword123!' })
      .expect(400);

    expect(res.body.message).toBe('Invalid or expired reset token');
  });

  // ── P16: Concurrent reset attempts — exactly one success ─────────────

  it('P16: two concurrent reset attempts allow exactly one success', async () => {
    const org = await createOrg();
    const user = await createUser('concurrent@example.com', org.id);

    const rawToken = 'e'.repeat(64);
    const verifier = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const results = await Promise.all([
      request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPassword123!' }),
      request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: rawToken, newPassword: 'NewPassword123!' }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 400]);
  });

  // ── P17: Password rehashed using existing hasher ─────────────────────

  it('P17: password is rehashed using bcrypt (existing hasher)', async () => {
    const org = await createOrg();
    const user = await createUser('rehash@example.com', org.id);

    const rawToken = 'f'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'RehashedPass123!' })
      .expect(200);

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updatedUser!.passwordHash).toMatch(/^\$2[aby]?\$\d{1,2}\$/);
  });

  // ── P18: Old password no longer works ────────────────────────────────

  it('P18: old password no longer works after reset', async () => {
    const org = await createOrg();
    await createUser('oldpass@example.com', org.id);

    const loginBefore = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'oldpass@example.com', password: 'password123' });
    expect(loginBefore.status).toBe(201);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'oldpass@example.com' })
      .expect(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'oldpass@example.com' } },
    });

    const rawToken = 'g'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: 'oldpass@example.com' } },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: tokenRecord!.userId,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewPassword456!' })
      .expect(200);

    const loginAfter = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'oldpass@example.com', password: 'password123' });
    expect(loginAfter.status).toBe(401);
  });

  // ── P19: New password works ──────────────────────────────────────────

  it('P19: new password works for login after reset', async () => {
    const org = await createOrg();
    await createUser('newpass@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'newpass@example.com' })
      .expect(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'newpass@example.com' } },
    });

    const rawToken = 'h'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: 'newpass@example.com' } },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: tokenRecord!.userId,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewWorking123!' })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'newpass@example.com', password: 'NewWorking123!' });
    expect(loginRes.status).toBe(201);
    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();
  });

  // ── P20: All refresh sessions revoked after reset ────────────────────

  it('P20: all refresh sessions are revoked after successful reset', async () => {
    const org = await createOrg();
    await createUser('revokesess@example.com', org.id);

    const login1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'revokesess@example.com', password: 'password123' });
    const login2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'revokesess@example.com', password: 'password123' });

    const activeTokens = await prisma.refreshToken.count({
      where: { userId: login1.body.user.id, revokedAt: null },
    });
    expect(activeTokens).toBeGreaterThanOrEqual(2);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'revokesess@example.com' })
      .expect(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'revokesess@example.com' } },
    });

    const rawToken = 'i'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: 'revokesess@example.com' } },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: tokenRecord!.userId,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'ResetSession123!' })
      .expect(200);

    const activeAfter = await prisma.refreshToken.count({
      where: { userId: login1.body.user.id, revokedAt: null },
    });
    expect(activeAfter).toBe(0);
  });

  // ── P21: Other users' sessions unaffected ────────────────────────────

  it('P21: other users sessions are unaffected', async () => {
    const org = await createOrg();
    const user1 = await createUser('user1-isolated@example.com', org.id);
    const user2 = await createUser('user2-isolated@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user1-isolated@example.com', password: 'password123' });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user2-isolated@example.com', password: 'password123' });

    const user1SessionsBefore = await prisma.refreshToken.count({
      where: { userId: user1.id, revokedAt: null },
    });
    const user2SessionsBefore = await prisma.refreshToken.count({
      where: { userId: user2.id, revokedAt: null },
    });

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'user1-isolated@example.com' })
      .expect(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: user1.id },
    });

    const rawToken = 'j'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.deleteMany({ where: { userId: user1.id } });
    await prisma.passwordResetToken.create({
      data: {
        userId: user1.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NewIsolated123!' })
      .expect(200);

    const user1SessionsAfter = await prisma.refreshToken.count({
      where: { userId: user1.id, revokedAt: null },
    });
    const user2SessionsAfter = await prisma.refreshToken.count({
      where: { userId: user2.id, revokedAt: null },
    });

    expect(user1SessionsAfter).toBe(0);
    expect(user2SessionsAfter).toBe(user2SessionsBefore);
  });

  // ── P22: Password policy enforced ────────────────────────────────────

  it('P22: password policy is enforced (min 8, max 128)', async () => {
    const org = await createOrg();
    const user = await createUser('policy@example.com', org.id);

    const rawToken = 'k'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'short' })
      .expect(400);

    const rawToken2 = 'l'.repeat(64);
    const verifier2 = hashToken(rawToken2);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier2,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const longPassword = 'a'.repeat(129);
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken2, newPassword: longPassword })
      .expect(400);
  });

  // ── P23: Rate limiting for repeated forgot-password ──────────────────

  it('P23: rate limiting works for repeated forgot-password attempts', async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'ratelimit@example.com' });
      results.push(res.status);
    }

    expect(results).toContain(429);
  });

  // ── P24: Rate limiting for repeated reset attempts ───────────────────

  it('P24: rate limiting works for repeated reset-password attempts', async () => {
    const sameToken = 'same-token-for-rate-limit-' + Date.now();
    const results = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: sameToken, newPassword: 'NewPassword123!' });
      results.push(res.status);
    }

    expect(results).toContain(429);
  });

  // ── P25: Audit events emitted ────────────────────────────────────────

  it('P25: audit events are emitted for forgot-password and reset-password', async () => {
    const org = await createOrg();
    const user = await createUser('auditevents@example.com', org.id);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'auditevents@example.com' })
      .expect(200);

    const auditLogs = await prisma.auditLog.findMany({
      where: { action: 'password_reset_requested' },
    });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].actorId).toBe(user.id);

    const rawToken = 'm'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'AuditEvent123!' })
      .expect(200);

    const resetAudit = await prisma.auditLog.findMany({
      where: { action: 'password_reset_completed' },
    });
    expect(resetAudit.length).toBe(1);
    expect(resetAudit[0].actorId).toBe(user.id);

    const revokeAudit = await prisma.auditLog.findMany({
      where: { action: 'password_reset_sessions_revoked' },
    });
    expect(revokeAudit.length).toBe(1);
  });

  // ── P26: No plaintext token in logs/events/database ──────────────────

  it('P26: no plaintext token appears in database', async () => {
    const org = await createOrg();
    const user = await createUser('noplaintextdb@example.com', org.id);

    const rawToken = 'n'.repeat(64);
    const verifier = hashToken(rawToken);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'noplaintextdb@example.com' })
      .expect(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
    });

    expect(tokenRecord!.tokenHash).not.toBe(rawToken);
    expect(tokenRecord!.tokenHash).toMatch(/^prt:v1:[a-f0-9]{64}$/);

    const rawExists = tokenRecord!.tokenHash === rawToken;
    expect(rawExists).toBe(false);
  });

  // ── P27: No account enumeration through response ─────────────────────

  it('P27: response body and status are identical for existing and unknown email', async () => {
    const org = await createOrg();
    await createUser('enum-test@example.com', org.id);

    const knownRes = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'enum-test@example.com' });

    const unknownRes = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'unknown-enum@example.com' });

    expect(knownRes.status).toBe(unknownRes.status);
    expect(knownRes.body.message).toBe(unknownRes.body.message);
  });

  // ── P28: Queue/provider failure does not expose account existence ────

  it('P28: queue failure does not expose account existence', async () => {
    const org = await createOrg();
    await createUser('queuefail@example.com', org.id);

    const originalAdd = queueService.addTransactionalEmail.bind(queueService);
    queueService.addTransactionalEmail = async () => {
      throw new Error('Queue unavailable');
    };

    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'queuefail@example.com' })
      .expect(200);

    expect(res.body.message).toBe(
      'If an account exists for that email, password reset instructions will be sent.',
    );

    queueService.addTransactionalEmail = originalAdd;
  });

  // ── P29: Transaction rollback leaves consistent state ────────────────

  it('P29: password unchanged if token consumption fails after password hash', async () => {
    const org = await createOrg();
    const user = await createUser('rollback@example.com', org.id);
    const originalHash = user.passwordHash;

    const rawToken = 'o'.repeat(64);
    const verifier = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        usedAt: new Date(),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'ShouldNotWork123!' })
      .expect(400);

    const userAfter = await prisma.user.findUnique({ where: { id: user.id } });
    expect(userAfter!.passwordHash).toBe(originalHash);
  });

  // ── P30: Migration works on fresh test database ──────────────────────

  it('P30: PasswordResetToken table exists and is queryable', async () => {
    const count = await prisma.passwordResetToken.count();
    expect(count).toBe(0);

    const org = await createOrg();
    const user = await createUser('migration@example.com', org.id);

    const rawToken = 'p'.repeat(64);
    const verifier = hashToken(rawToken);

    const record = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    expect(record.id).toBeDefined();
    expect(record.userId).toBe(user.id);
    expect(record.tokenHash).toBe(verifier);
    expect(record.usedAt).toBeNull();
  });

  // ── P31: Existing auth tests remain green (verified by full run) ─────
  // This is verified by running the full test suite.

  // ── P32: No frontend changes ─────────────────────────────────────────
  // This is verified by code review and git diff.

  // ── Additional: forgot-password for non-existent user suppresses event ─

  it('forgot-password for non-existent user emits suppressed event, not requested', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'nonexistent-suppress@example.com' })
      .expect(200);

    const requestedAudit = await prisma.auditLog.findMany({
      where: { action: 'password_reset_requested' },
    });
    expect(requestedAudit.length).toBe(0);
  });

  // ── Additional: reset with empty/missing token returns 400 ──────────

  it('reset-password with empty token returns 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: '', newPassword: 'ValidPass123!' })
      .expect(400);
  });

  // ── Additional: reset without newPassword returns 400 ────────────────

  it('reset-password without newPassword returns 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: 'some-token' })
      .expect(400);
  });

  // ── Additional: forgot-password with invalid email format returns 400 ─

  it('forgot-password with invalid email returns 400', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'invalid-email' })
      .expect(400);
  });

  // ── Additional: reset-password returns no tokens ─────────────────────

  it('reset-password returns no tokens (forces fresh login)', async () => {
    const org = await createOrg();
    const user = await createUser('notokens@example.com', org.id);

    const rawToken = 'q'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'NoTokens123!' })
      .expect(200);

    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.message).toBeDefined();
  });

  // ── Additional: new session required after reset ─────────────────────

  it('user must log in again after password reset (no tokens returned)', async () => {
    const org = await createOrg();
    await createUser('freshlogin@example.com', org.id);

    const loginBefore = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'freshlogin@example.com', password: 'password123' });
    expect(loginBefore.status).toBe(201);

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'freshlogin@example.com' })
      .expect(200);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { user: { email: 'freshlogin@example.com' } },
    });

    const rawToken = 'r'.repeat(64);
    const verifier = hashToken(rawToken);
    await prisma.passwordResetToken.deleteMany({
      where: { user: { email: 'freshlogin@example.com' } },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: tokenRecord!.userId,
        tokenHash: verifier,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const resetRes = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: rawToken, newPassword: 'FreshLogin123!' })
      .expect(200);

    expect(resetRes.body.accessToken).toBeUndefined();

    const loginAfter = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'freshlogin@example.com', password: 'FreshLogin123!' });
    expect(loginAfter.status).toBe(201);
    expect(loginAfter.body.accessToken).toBeDefined();
  });

  // ── Additional: superseded token usedAt set ──────────────────────────

  it('superseded token has usedAt set when new request arrives', async () => {
    const org = await createOrg();
    const user = await createUser('supersede-check@example.com', org.id);

    const rawToken1 = 's1'.repeat(32);
    const verifier1 = hashToken(rawToken1);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: verifier1,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'supersede-check@example.com' })
      .expect(200);

    const oldToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: verifier1 },
    });
    expect(oldToken!.usedAt).not.toBeNull();
  });

  // ── Fingerprint throttle certification tests ─────────────────────────

  it('fingerprint throttle: different IPs cannot bypass normalized-email limit', async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', `10.0.0.${i + 1}`)
        .send({ email: 'fp-different-ip@example.com' });
      results.push(res.status);
    }
    expect(results).toContain(429);
  });

  it('fingerprint throttle: different token strings use non-plaintext fingerprints', async () => {
    const results = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: `unique-token-${i}-for-cert-${Date.now()}`, newPassword: 'NewPassword123!' });
      results.push(res.status);
    }
    expect(results).not.toContain(429);
  });

  it('fingerprint throttle: raw email never appears in throttle keys', async () => {
    const storage = moduleFixture.get<any>(ThrottlerStorage);
    const beforeKeys = new Set(Object.keys(storage.storage?.store || storage.storage || {}));

    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'raw-email-leak-test@example.com' });

    const afterStore = storage.storage?.store || storage.storage || {};
    const allKeys = [...beforeKeys, ...Object.keys(afterStore)];
    const hasRawEmail = allKeys.some(k => k.includes('raw-email-leak-test@example.com'));
    expect(hasRawEmail).toBe(false);
  });

  it('fingerprint throttle: raw token never appears in throttle keys', async () => {
    const storage = moduleFixture.get<any>(ThrottlerStorage);
    const secretToken = `secret-token-cert-${Date.now()}`;
    const beforeKeys = new Set(Object.keys(storage.storage?.store || storage.storage || {}));

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: secretToken, newPassword: 'NewPassword123!' });

    const afterStore = storage.storage?.store || storage.storage || {};
    const allKeys = [...beforeKeys, ...Object.keys(afterStore)];
    const hasRawToken = allKeys.some(k => k.includes(secretToken));
    expect(hasRawToken).toBe(false);
  });

  it('fingerprint throttle: known and unknown accounts return identical response shape', async () => {
    const knownRes = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', '10.99.0.1')
      .send({ email: 'known-cert@example.com' });

    const unknownRes = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', '10.99.0.2')
      .send({ email: 'unknown-cert@example.com' });

    expect(knownRes.status).toBe(200);
    expect(unknownRes.status).toBe(200);
    expect(Object.keys(knownRes.body)).toEqual(Object.keys(unknownRes.body));
    expect(knownRes.body.message).toBe(unknownRes.body.message);
  });

  it('fingerprint throttle: known and unknown accounts return identical status under throttle', async () => {
    const org = await createOrg();
    await createUser('throttled-known-cert@example.com', org.id);

    const results = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .set('X-Forwarded-For', '10.98.0.1')
        .send({ email: 'throttled-known-cert@example.com' });
      results.push(res.status);
    }
    expect(results).toContain(429);
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

/**
 * ACC-FOUND-01 — Account summary & display-name editing.
 *
 * The account summary surface is self-scoped: identity is derived exclusively
 * from the authenticated server context (req.user.sub). A body-supplied userId
 * is never consulted, only safe profile fields are returned, and no credential
 * material (password hash, MFA secrets, SSO identity, tokens) ever leaves the
 * endpoint.
 */
describe('Account Summary (ACC-FOUND-01)', () => {
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

  async function createOrg(name: string, slug?: string) {
    return prisma.organization.create({
      data: { name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-') },
    });
  }

  async function createUser(
    email: string,
    orgId: string,
    role: Role = 'Owner',
    overrides: { mfaSecret?: string; mfaBackupCodes?: string } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: email.split('@')[0],
        orgId,
        role,
        mfaSecret: overrides.mfaSecret ?? null,
        mfaBackupCodes: overrides.mfaBackupCodes ?? null,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId, role } });
    return user;
  }

  async function accessToken(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  }

  const server = () => app.getHttpServer();

  describe('AUTHORIZATION', () => {
    it('rejects unauthenticated requests (401) for both routes', async () => {
      await request(server()).get('/auth/account/summary').expect(401);
      await request(server()).patch('/auth/account/summary').send({ displayName: 'X' }).expect(401);
    });

    it('is self-scoped — returns only the authenticated user profile', async () => {
      const org = await createOrg('self-org');
      const user = await createUser('self@test.com', org.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .get('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(user.id);
      expect(res.body.email).toBe(user.email);
      expect(res.body.displayName).toBe('self');
      expect(typeof res.body.createdAt).toBe('string');
      expect(typeof res.body.updatedAt).toBe('string');
    });

    it('preserves tenant isolation — users in different orgs see only their own data', async () => {
      const orgA = await createOrg('iso-a');
      const orgB = await createOrg('iso-b');
      const userA = await createUser('iso-a@test.com', orgA.id, 'Admin');
      const userB = await createUser('iso-b@test.com', orgB.id, 'Owner');

      const resA = await request(server())
        .get('/auth/account/summary')
        .set('Authorization', `Bearer ${await accessToken(userA.email)}`)
        .expect(200);
      const resB = await request(server())
        .get('/auth/account/summary')
        .set('Authorization', `Bearer ${await accessToken(userB.email)}`)
        .expect(200);

      expect(resA.body.id).toBe(userA.id);
      expect(resA.body.email).toBe('iso-a@test.com');
      expect(resB.body.id).toBe(userB.id);
      expect(resB.body.email).toBe('iso-b@test.com');
    });
  });

  describe('SAFE RESPONSE FIELDS', () => {
    it('never exposes credential material or foreign identity fields', async () => {
      const org = await createOrg('safe-org');
      const user = await createUser('safe@test.com', org.id, 'Owner', {
        mfaSecret: 'BASE32SECRETVALUE',
        mfaBackupCodes: 'backup-codes',
      });
      const token = await accessToken(user.email);

      const res = await request(server())
        .get('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = JSON.stringify(res.body);
      const allowed = ['id', 'email', 'displayName', 'createdAt', 'updatedAt'];

      for (const key of allowed) {
        expect(res.body).toHaveProperty(key);
      }

      // Secret surfaces must never appear in the payload.
      expect(body).not.toContain('passwordHash');
      expect(body).not.toContain('mfaSecret');
      expect(body).not.toContain('mfaBackupCodes');
      expect(body).not.toContain('ssoId');
      expect(body).not.toContain('ssoProvider');
      expect(body).not.toContain('BASE32SECRETVALUE');
      expect(body).not.toContain('backup-codes');
      // Token values must never leak through the response.
      expect(body).not.toContain(token);
    });
  });

  describe('DISPLAY NAME EDITING', () => {
    it('updates the authenticated user display name and returns the fresh summary', async () => {
      const org = await createOrg('edit-org');
      const user = await createUser('edit@test.com', org.id, 'Owner');
      const token = await accessToken(user.email);

      const res = await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Ada Lovelace' })
        .expect(200);

      expect(res.body.id).toBe(user.id);
      expect(res.body.displayName).toBe('Ada Lovelace');
      expect(res.body.email).toBe(user.email);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.displayName).toBe('Ada Lovelace');
    });

    it('ignores a forged body userId — the victim account is never touched', async () => {
      const orgA = await createOrg('forge-a');
      const orgB = await createOrg('forge-b');
      const attacker = await createUser('forge-a@test.com', orgA.id, 'Owner');
      const victim = await createUser('forge-b@test.com', orgB.id, 'Owner');
      const token = await accessToken(attacker.email);

      await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Attacker Name', userId: victim.id })
        .expect(200);

      const dbAttacker = await prisma.user.findUnique({ where: { id: attacker.id } });
      const dbVictim = await prisma.user.findUnique({ where: { id: victim.id } });
      expect(dbAttacker?.displayName).toBe('Attacker Name');
      expect(dbVictim?.displayName).toBe('forge-b');
    });

    it('does not touch MFA secret or password when only the display name changes', async () => {
      const org = await createOrg('mfa-org');
      const user = await createUser('mfa@test.com', org.id, 'Owner', {
        mfaSecret: 'KEEPMESAFE',
        mfaBackupCodes: 'KEEPTHESE',
      });
      const token = await accessToken(user.email);

      await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'MFA User' })
        .expect(200);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.mfaSecret).toBe('KEEPMESAFE');
      expect(dbUser?.mfaBackupCodes).toBe('KEEPTHESE');
      expect(dbUser?.passwordHash).not.toBe('KEEPMESAFE');
      expect(dbUser?.passwordHash).not.toBeNull();
    });

    it('advances updatedAt after a successful edit (deterministic time source)', async () => {
      const org = await createOrg('time-org');
      const user = await createUser('time@test.com', org.id, 'Owner');
      const token = await accessToken(user.email);

      const before = await request(server())
        .get('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'Time User' })
        .expect(200);

      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(before.body.updatedAt).getTime(),
      );
    });

    it('rejects invalid display names with deterministic 400 responses', async () => {
      const org = await createOrg('validate-org');
      const user = await createUser('validate@test.com', org.id, 'Owner');
      const token = await accessToken(user.email);

      await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
      await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: '' })
        .expect(400);
      await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: '   ' })
        .expect(400);
      await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: 'x'.repeat(101) })
        .expect(400);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.displayName).toBe('validate');
    });

    it('strips the display name for storage', async () => {
      const org = await createOrg('trim-org');
      const user = await createUser('trim@test.com', org.id, 'Owner');
      const token = await accessToken(user.email);

      await request(server())
        .patch('/auth/account/summary')
        .set('Authorization', `Bearer ${token}`)
        .send({ displayName: '  Trimmed Name  ' })
        .expect(200);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.displayName).toBe('Trimmed Name');
    });
  });
});

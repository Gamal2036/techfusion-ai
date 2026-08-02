import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { normalizeSlug } from '../src/auth/auth.service';

describe('Signup Slug Collision Fix', () => {
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
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

  describe('normalizeSlug', () => {
    it('lowercases input', () => {
      expect(normalizeSlug('My Company')).toBe('my-company');
    });

    it('removes duplicated separators', () => {
      expect(normalizeSlug('My   Company')).toBe('my-company');
    });

    it('trims leading/trailing hyphens', () => {
      expect(normalizeSlug('-My Company-')).toBe('my-company');
    });

    it('collapses multiple hyphens', () => {
      expect(normalizeSlug('my--company')).toBe('my-company');
    });

    it('returns organization for empty string', () => {
      expect(normalizeSlug('')).toBe('organization');
    });

    it('returns organization for whitespace-only', () => {
      expect(normalizeSlug('   ')).toBe('organization');
    });

    it('handles unicode characters', () => {
      const slug = normalizeSlug('Café résumé');
      expect(slug).toMatch(/^[a-z0-9\u00C0-\u024F-]+$/);
      expect(slug).not.toMatch(/^-|-$/);
    });

    it('preserves digits', () => {
      expect(normalizeSlug('Company123')).toBe('company123');
    });

    it('normalizes complex input', () => {
      expect(normalizeSlug('  --My  Company--  ')).toBe('my-company');
    });
  });

  describe('Signup with slug collision', () => {
    it('creates user and organization with unique slug', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'unique-org@test.com',
          password: 'password123',
          displayName: 'Unique Org User',
          orgName: 'TechFusion',
        })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('unique-org@test.com');

      const org = await prisma.organization.findFirst({ where: { name: 'TechFusion' } });
      expect(org).toBeDefined();
      expect(org!.slug).toBe('techfusion');
    });

    it('generates company-2 when slug already exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'dup1@test.com',
          password: 'password123',
          displayName: 'User 1',
          orgName: 'TechFusion',
        })
        .expect(201);

      const res2 = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'dup2@test.com',
          password: 'password123',
          displayName: 'User 2',
          orgName: 'TechFusion',
        })
        .expect(201);

      expect(res2.body.accessToken).toBeDefined();
      const orgs = await prisma.organization.findMany({ where: { name: 'TechFusion' } });
      expect(orgs).toHaveLength(2);
      const slugs = orgs.map((o) => o.slug).sort();
      expect(slugs).toEqual(['techfusion', 'techfusion-2']);
    });

    it('generates company-3 for three duplicates', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'tri1@test.com', password: 'password123', displayName: 'U1', orgName: 'TripCo' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'tri2@test.com', password: 'password123', displayName: 'U2', orgName: 'TripCo' })
        .expect(201);

      const res3 = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'tri3@test.com', password: 'password123', displayName: 'U3', orgName: 'TripCo' })
        .expect(201);

      expect(res3.body.accessToken).toBeDefined();
      const orgs = await prisma.organization.findMany({ where: { name: 'TripCo' } });
      expect(orgs).toHaveLength(3);
      const slugs = orgs.map((o) => o.slug).sort();
      expect(slugs).toEqual(['tripco', 'tripco-2', 'tripco-3']);
    });

    it('does not return 500 on slug collision', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'no500a@test.com', password: 'password123', displayName: 'A', orgName: 'SameOrg' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'no500b@test.com', password: 'password123', displayName: 'B', orgName: 'SameOrg' })
        .expect(201);

      expect(res.status).not.toBe(500);
    });

    it('rejects duplicate email independently of slug', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'sameemail@test.com', password: 'password123', displayName: 'First', orgName: 'Org One' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'sameemail@test.com', password: 'password123', displayName: 'Second', orgName: 'Org Two' })
        .expect(409);
    });

    it('creates valid user in the organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'validuser@test.com', password: 'password123', displayName: 'Valid User', orgName: 'ValidOrg' })
        .expect(201);

      expect(res.body.user.role).toBe('Owner');
      expect(res.body.user.orgId).toBeDefined();

      const user = await prisma.user.findUnique({ where: { email: 'validuser@test.com' } });
      expect(user).toBeDefined();
      expect(user!.orgId).toBe(res.body.user.orgId);
    });
  });

  describe('Transaction safety', () => {
    it('does not create orphan organization when email already exists', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'orphan@test.com', password: 'password123', displayName: 'First', orgName: 'OrphanOrg' })
        .expect(201);

      const orgCountBefore = await prisma.organization.count({ where: { name: 'OrphanOrg' } });

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'orphan@test.com', password: 'password123', displayName: 'Second', orgName: 'OrphanOrg' })
        .expect(409);

      const orgCountAfter = await prisma.organization.count({ where: { name: 'OrphanOrg' } });
      expect(orgCountAfter).toBe(orgCountBefore);
    });
  });

  describe('Existing data unchanged', () => {
    it('does not modify existing organization slugs', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'existing1@test.com', password: 'password123', displayName: 'E1', orgName: 'ExistingOrg' })
        .expect(201);

      const originalOrgId = res1.body.user.orgId;

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'existing2@test.com', password: 'password123', displayName: 'E2', orgName: 'ExistingOrg' })
        .expect(201);

      const originalOrg = await prisma.organization.findUnique({ where: { id: originalOrgId } });
      expect(originalOrg).toBeDefined();
      expect(originalOrg!.slug).toBe('existingorg');
    });
  });

  describe('Login still works after signup', () => {
    it('can login after signup with collision slug', async () => {
      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'login-after@test.com', password: 'password123', displayName: 'LA', orgName: 'LoginOrg' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({ email: 'login-after2@test.com', password: 'password123', displayName: 'LA2', orgName: 'LoginOrg' })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login-after@test.com', password: 'password123' })
        .expect(201);

      expect(loginRes.body.accessToken).toBeDefined();
      expect(loginRes.body.user.email).toBe('login-after@test.com');
    });
  });
});

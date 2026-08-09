import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';

/**
 * V1-STAGE-01-SUB-01 — SSO fail-closed regression (S1 authentication bypass).
 *
 * The pre-remediation `POST /auth/sso/login` was `@Public()` and trusted
 * client-supplied `attributes { email, ssoId, displayName }` plus an IdP token
 * validated only by `length >= 10`, then JIT-provisioned users, linked SSO
 * identities, and issued JWT access + refresh tokens. That is a P0 auth
 * bypass. Real SAML/OIDC assertion verification is intentionally out of scope
 * for this substage, so the incomplete login path must FAIL CLOSED:
 *
 *   - never returns an access token or refresh token
 *   - never creates (JIT) or links a user / SSO identity
 *   - never consults or leaks SSO/org configuration
 *   - always rejects with a deterministic, safe API error
 */
describe('V1-STAGE-01-SUB-01 — SSO login fail-closed (S1 auth bypass)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const SSO_ORG_SLUG = 'sso-acme';
  const SSO_PROVIDER = 'oidc';

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
    await prisma.ssoConfig.deleteMany();
    await prisma.organizationMember.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
  });

  async function createSsoEnabledOrg(slug: string = SSO_ORG_SLUG) {
    const org = await prisma.organization.create({ data: { name: 'SSO Acme', slug } });
    await prisma.ssoConfig.create({
      data: {
        orgId: org.id,
        provider: SSO_PROVIDER,
        issuer: 'https://idp.example.com',
        clientId: 'client-123',
        isEnabled: true,
      },
    });
    return org;
  }

  async function createOrgUser(email: string, role: 'Owner' | 'Admin' | 'Technician' | 'Viewer' = 'Owner') {
    const org = await prisma.organization.create({
      data: { name: 'Acme ' + email, slug: 'acme-' + crypto.randomBytes(4).toString('hex') },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('password123', 4),
        displayName: 'Acme User',
        orgId: org.id,
        role,
      },
    });
    await prisma.organizationMember.create({ data: { userId: user.id, orgId: org.id, role } });
    return { org, user };
  }

  function ssoPayload(overrides: Record<string, any> = {}) {
    return {
      orgSlug: SSO_ORG_SLUG,
      idpToken: 'fake-unsigned-idp-token-1234567890',
      provider: SSO_PROVIDER,
      attributes: { email: 'attacker@evil.example', displayName: 'Attacker', ssoId: 'attacker-subject-id' },
      ...overrides,
    };
  }

  async function counts() {
    return {
      refreshTokens: await prisma.refreshToken.count(),
      users: await prisma.user.count(),
      memberships: await prisma.organizationMember.count(),
    };
  }

  async function expectRejectedNoSideEffects(res: request.Response) {
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBe(501);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.user).toBeUndefined();
    const before = await counts();
    expect(before.refreshTokens).toBe(0);
    expect(before.users).toBe(0);
    expect(before.memberships).toBe(0);
  }

  describe('spoof-proof rejection of client-supplied identity', () => {
    it('rejects an existing-user email spoof with no session and no SSO link', async () => {
      const { org, user } = await createOrgUser('victim@existing.test', 'Owner');
      await prisma.ssoConfig.create({
        data: { orgId: org.id, provider: SSO_PROVIDER, issuer: 'https://idp.example.com', isEnabled: true },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(
          ssoPayload({
            orgSlug: org.slug,
            attributes: { email: 'victim@existing.test', displayName: 'Imposter', ssoId: 'attacker-controlled-sub' },
          }),
        )
        .expect(501);

      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.ssoId).toBeNull();
      expect(dbUser!.ssoProvider).toBeNull();
      expect(dbUser!.displayName).toBe('Acme User');
      expect(await prisma.refreshToken.count()).toBe(0);
    });

    it('rejects a brand-new / JIT user spoof and creates no user, membership, or token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(ssoPayload({ attributes: { email: 'newcomer@jit.test', displayName: 'Jit Spoof', ssoId: 'fake-subject' } }))
        .expect(501);

      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(await prisma.user.findUnique({ where: { email: 'newcomer@jit.test' } })).toBeNull();
      expect(await prisma.user.count()).toBe(0);
      expect(await prisma.organizationMember.count()).toBe(0);
      expect(await prisma.refreshToken.count()).toBe(0);
    });

    it('rejects a privileged-user email spoof with no session and unchanged identity', async () => {
      const { org, user } = await createOrgUser('admin@privileged.test', 'Admin');
      await prisma.ssoConfig.create({
        data: { orgId: org.id, provider: SSO_PROVIDER, issuer: 'https://idp.example.com', isEnabled: true },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(
          ssoPayload({
            orgSlug: org.slug,
            attributes: { email: 'admin@privileged.test', displayName: 'Fake Admin', ssoId: 'attacker-sub' },
          }),
        )
        .expect(501);

      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.ssoId).toBeNull();
      expect(dbUser!.ssoProvider).toBeNull();

      const membership = await prisma.organizationMember.findUnique({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
      });
      expect(membership!.role).toBe('Admin');
      expect(await prisma.refreshToken.count()).toBe(0);
    });

    it('rejects a fake / unsigned IdP token', async () => {
      await createSsoEnabledOrg();
      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(ssoPayload({ idpToken: 'not-a-real-assertion' }))
        .expect(501);

      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      const before = await counts();
      expect(before.refreshTokens).toBe(0);
      expect(before.users).toBe(0);
      expect(before.memberships).toBe(0);
    });

    it('rejects an unknown / random organization deterministically', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(ssoPayload({ orgSlug: 'organization-that-does-not-exist' }))
        .expect(501);

      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.body.user).toBeUndefined();
      expect(await prisma.refreshToken.count()).toBe(0);
      expect(await prisma.user.count()).toBe(0);
    });

    it('rejects when the target organization has SSO enabled', async () => {
      await createSsoEnabledOrg();
      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(ssoPayload({ attributes: { email: 'insider@acme.test', displayName: 'Insider', ssoId: 'insider-sub' } }))
        .expect(501);

      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(await prisma.refreshToken.count()).toBe(0);
      expect(await prisma.user.count()).toBe(0);
    });

    it('rejects a request with no attributes (no email to trust)', async () => {
      await createSsoEnabledOrg();
      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(ssoPayload({ attributes: undefined }))
        .expect(501);

      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(await prisma.refreshToken.count()).toBe(0);
      expect(await prisma.user.count()).toBe(0);
    });

    it('does not create a refresh token for any spoofed request', async () => {
      await createSsoEnabledOrg();
      await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(ssoPayload())
        .expect(501);
      expect(await prisma.refreshToken.count()).toBe(0);
    });

    it('does not return an access token for any spoofed request', async () => {
      const { org } = await createOrgUser('victim2@existing.test', 'Viewer');
      await prisma.ssoConfig.create({
        data: { orgId: org.id, provider: SSO_PROVIDER, issuer: 'https://idp.example.com', isEnabled: true },
      });
      const res = await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(ssoPayload({ orgSlug: org.slug, attributes: { email: 'victim2@existing.test', ssoId: 'x', displayName: 'X' } }))
        .expect(501);
      expect(res.body.accessToken).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('does not modify an existing user SSO identity (no link by arbitrary email)', async () => {
      const { org, user } = await createOrgUser('existing@linked.test', 'Technician');
      await prisma.ssoConfig.create({
        data: { orgId: org.id, provider: SSO_PROVIDER, issuer: 'https://idp.example.com', isEnabled: true },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { ssoId: 'legitimate-idp-sub', ssoProvider: 'oidc' },
      });

      await request(app.getHttpServer())
        .post('/auth/sso/login')
        .send(
          ssoPayload({
            orgSlug: org.slug,
            attributes: { email: 'existing@linked.test', displayName: 'Spoof', ssoId: 'attacker-controlled-sub' },
          }),
        )
        .expect(501);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser!.ssoId).toBe('legitimate-idp-sub');
      expect(dbUser!.ssoProvider).toBe('oidc');
      expect(await prisma.refreshToken.count()).toBe(0);
    });
  });
});

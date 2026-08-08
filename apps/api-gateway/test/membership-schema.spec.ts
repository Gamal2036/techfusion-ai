import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { QueueService } from '../src/queue/queue.service';
import { MockQueueService } from '../src/queue/queue.service.mock';
import { Role } from '@prisma/client';

// ORG-01A1: Membership schema foundation + backfill behavior.
// Validates the OrganizationMember model, the one-user-per-membership backfill
// logic from 20260807000000_organization_membership, and the schema-level
// multi-org capability. No application-level multi-org behavior is exercised.
describe('OrganizationMember schema & backfill', () => {
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
    await prisma.organizationMember.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);
  });

  // Mirror of the migration's backfill INSERT ... SELECT (idempotent-safe).
  const backfill = () =>
    prisma.$executeRawUnsafe(`
      INSERT INTO "OrganizationMember" ("id", "userId", "orgId", "role", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), u.id, u."orgId", u.role, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM "User" u
      WHERE NOT EXISTS (
        SELECT 1 FROM "OrganizationMember" m
        WHERE m."userId" = u.id AND m."orgId" = u."orgId"
      )
      ON CONFLICT ("userId", "orgId") DO NOTHING;
    `);

  async function seedUserWithOrg(slug: string, role: Role) {
    const org = await prisma.organization.create({ data: { name: slug, slug } });
    const user = await prisma.user.create({
      data: {
        email: `${slug}@test.local`,
        passwordHash: 'hash',
        displayName: slug,
        orgId: org.id,
        role,
      },
    });
    return { org, user };
  }

  it('backfills exactly one membership per existing user mirroring orgId and role', async () => {
    const { org, user } = await seedUserWithOrg('backfill-a', 'Owner');
    await prisma.user.create({
      data: {
        email: 'backfill-b@test.local',
        passwordHash: 'hash',
        displayName: 'B',
        orgId: org.id,
        role: 'Technician',
      },
    });

    await backfill();

    const memberships = await prisma.organizationMember.findMany();
    expect(memberships).toHaveLength(2);

    const owners = memberships.filter((m) => m.role === 'Owner');
    expect(owners).toHaveLength(1);
    expect(owners[0].userId).toBe(user.id);
    expect(owners[0].orgId).toBe(org.id);

    const techs = memberships.filter((m) => m.role === 'Technician');
    expect(techs).toHaveLength(1);
    expect(techs[0].orgId).toBe(org.id);
  });

  it('backfill is idempotent-safe when run twice', async () => {
    await seedUserWithOrg('idem-a', 'Admin');
    await backfill();
    await backfill();
    const count = await prisma.organizationMember.count();
    expect(count).toBe(1);
  });

  it('unique(userId, orgId) rejects a duplicate membership', async () => {
    const { org, user } = await seedUserWithOrg('dup-a', 'Admin');
    await prisma.organizationMember.create({
      data: { userId: user.id, orgId: org.id, role: 'Admin' },
    });

    await expect(
      prisma.organizationMember.create({
        data: { userId: user.id, orgId: org.id, role: 'Viewer' },
      }),
    ).rejects.toThrow(/unique/i);
  });

  it('a user can hold memberships in two organizations with a distinct per-membership role', async () => {
    const orgA = await prisma.organization.create({ data: { name: 'Multi A', slug: 'multi-a' } });
    const orgB = await prisma.organization.create({ data: { name: 'Multi B', slug: 'multi-b' } });
    const user = await prisma.user.create({
      data: {
        email: 'multi@test.local',
        passwordHash: 'hash',
        displayName: 'Multi',
        orgId: orgA.id,
        role: 'Owner',
      },
    });

    await prisma.organizationMember.createMany({
      data: [
        { userId: user.id, orgId: orgA.id, role: 'Owner' },
        { userId: user.id, orgId: orgB.id, role: 'Viewer' },
      ],
    });

    const memberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      orderBy: { orgId: 'asc' },
    });
    expect(memberships).toHaveLength(2);
    const orgBRole = memberships.find((m) => m.orgId === orgB.id)?.role;
    const orgARole = memberships.find((m) => m.orgId === orgA.id)?.role;
    expect(orgARole).toBe('Owner');
    expect(orgBRole).toBe('Viewer');
  });

  it('an organization can contain many memberships', async () => {
    const org = await prisma.organization.create({ data: { name: 'Fleet', slug: 'fleet-a' } });
    for (const i of [1, 2, 3]) {
      const user = await prisma.user.create({
        data: {
          email: `fleet-${i}@test.local`,
          passwordHash: 'hash',
          displayName: `Fleet ${i}`,
          orgId: org.id,
          role: 'Viewer',
        },
      });
      await prisma.organizationMember.create({
        data: { userId: user.id, orgId: org.id, role: 'Viewer' },
      });
    }
    expect(await prisma.organizationMember.count({ where: { orgId: org.id } })).toBe(3);
  });

  it('memberships cascade when their user is removed', async () => {
    const { org, user } = await seedUserWithOrg('cascade-a', 'Owner');
    await prisma.organizationMember.create({
      data: { userId: user.id, orgId: org.id, role: 'Owner' },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.organizationMember.count({ where: { orgId: org.id } })).toBe(0);
  });
});

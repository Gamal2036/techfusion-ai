import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Organization" CASCADE`);

  const org = await prisma.organization.create({
    data: { name: 'Load Test Org', slug: 'load-test-org' },
  });

  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = bcrypt.hashSync('LoadTestPass123!', 10);
  await prisma.user.create({
    data: {
      email: 'admin@loadtest.com',
      passwordHash,
      displayName: 'Load Test Admin',
      role: 'Owner',
      orgId: org.id,
      mfaEnabled: false,
    },
  });

  for (let i = 1; i <= 10; i++) {
    const token = `load-test-device-${String(i).padStart(3, '0')}`;
    await prisma.device.create({
      data: {
        orgId: org.id,
        name: `load-device-${i}`,
        hostname: `load-device-${i}.internal`,
        os: 'Linux',
        osVersion: '6.1',
        cpuModel: 'Intel Xeon',
        cpuCores: 8,
        cpuLogical: 16,
        ramTotal: BigInt(17179869184),
        diskTotal: BigInt(1099511627776),
        deviceToken: token,
      },
    });
    console.log(`  Created token: ${token}`);
  }

  console.log(`Org ID: ${org.id}`);
}

seed().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

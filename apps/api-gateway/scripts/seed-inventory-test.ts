import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'tfenr_ci-secret-replace-before-deploy';
const ENROLLMENT_TOKEN_BYTES = 32;
const ENROLLMENT_TOKEN_PREFIX = 'tfenr_';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function main() {
  let org = await prisma.organization.findFirst({ where: { name: 'Inventory Test Org' } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: 'Inventory Test Org', slug: 'inv-test-' + Date.now(), plan: 'Enterprise' },
    });
    console.log('Created org:', org.id);
  } else {
    console.log('Using existing org:', org.id);
  }

  let user = await prisma.user.findFirst({ where: { email: 'inventory-test@techfusion.ai' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'inventory-test@techfusion.ai',
        passwordHash: 'test-hash',
        displayName: 'Inventory Test',
        role: 'Owner',
        orgId: org.id,
      },
    });
    console.log('Created user:', user.id);
  } else {
    console.log('Using existing user:', user.id);
  }

  const rawToken = crypto.randomBytes(ENROLLMENT_TOKEN_BYTES).toString('hex');
  const prefixedToken = `${ENROLLMENT_TOKEN_PREFIX}${rawToken}`;
  const tokenHash = hashToken(rawToken);

  // Revoke old tokens, always create fresh one with known plaintext
  await prisma.enrollmentToken.updateMany({
    where: { orgId: org.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.enrollmentToken.create({
    data: {
      orgId: org.id,
      tokenHash,
      label: 'inventory-test',
      maxUses: 100,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      useCount: 0,
    },
  });
  console.log('Created enrollment token:', prefixedToken);

  const token = jwt.sign(
    { sub: user.id, orgId: org.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '365d' },
  );
  console.log('\nJWT Token:', token);
  console.log('\nEnrollment Token for agent registration:', prefixedToken);
  console.log('Org ID:', org.id);
  console.log('User ID:', user.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

export default async function setup(): Promise<void> {
  const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (testDbUrl) {
    process.env.DATABASE_URL = testDbUrl;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
  try {
    await prisma.$connect();
  } catch {
    console.warn('Test database not available — tests requiring DB will fail.');
  } finally {
    await prisma.$disconnect();
  }
}

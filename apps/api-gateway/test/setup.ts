import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

export default async function setup(): Promise<void> {
  const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!testDbUrl) {
    console.warn('No DATABASE_URL_TEST or DATABASE_URL set — DB-dependent tests will be skipped.');
    return;
  }

  process.env.DATABASE_URL = testDbUrl;

  const prisma = new PrismaClient({ datasources: { db: { url: testDbUrl } } });

  try {
    await prisma.$connect();
  } catch {
    console.warn('Test database not available — tests requiring DB will fail.');
    return;
  }

  try {
    const schemaPath = require('path').resolve(__dirname, '../prisma/schema.prisma');
    execSync(
      `npx prisma migrate deploy --schema=${schemaPath}`,
      {
        env: { ...process.env, DATABASE_URL: testDbUrl },
        stdio: 'pipe',
        timeout: 30000,
      },
    );
    console.log('Test database migrations applied successfully.');
  } catch (err: any) {
    console.warn('Migration failed — tests requiring DB may fail.', err?.message);
  } finally {
    await prisma.$disconnect();
  }
}

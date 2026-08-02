import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/techfusion';

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

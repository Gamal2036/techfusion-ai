-- Add report creation/completion tracking fields present in the Prisma schema
-- but missing from the original Report table definition.
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

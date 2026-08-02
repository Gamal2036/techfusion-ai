-- AlterTable: Remove @updatedAt behavior from Device.lastSeenAt
-- Replace auto-update trigger with explicit default(now())
-- Existing lastSeenAt values are preserved; column remains non-nullable
ALTER TABLE "Device" ALTER COLUMN "lastSeenAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Add deviceTokenHash column to Device table for hashed credential storage
ALTER TABLE "Device" ADD COLUMN "deviceTokenHash" TEXT;

-- Create unique index for deviceTokenHash lookups
CREATE UNIQUE INDEX "Device_deviceTokenHash_key" ON "Device"("deviceTokenHash");

-- Create index for deviceTokenHash lookups
CREATE INDEX "Device_deviceTokenHash_idx" ON "Device"("deviceTokenHash");

-- Migration: Hash existing plaintext deviceToken values
-- This is a data migration that creates SHA-256 hashes of all existing tokens
UPDATE "Device"
SET "deviceTokenHash" = encode(
  sha256(
    decode(substring("deviceToken" from 1 for 64), 'hex')
  ),
  'hex'
)
WHERE "deviceToken" IS NOT NULL;

-- Create the credential_rotation_event logging table for audit
CREATE TABLE "CredentialRotationEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "oldTokenHash" TEXT NOT NULL,
    "newTokenHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'rotation',
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "CredentialRotationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CredentialRotationEvent_deviceId_idx" ON "CredentialRotationEvent"("deviceId");
CREATE INDEX "CredentialRotationEvent_orgId_idx" ON "CredentialRotationEvent"("orgId");
CREATE INDEX "CredentialRotationEvent_rotatedAt_idx" ON "CredentialRotationEvent"("rotatedAt");

-- AddForeignKey
ALTER TABLE "CredentialRotationEvent"
  ADD CONSTRAINT "CredentialRotationEvent_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CredentialRotationEvent"
  ADD CONSTRAINT "CredentialRotationEvent_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

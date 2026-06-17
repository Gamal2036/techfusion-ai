-- AlterTable: Add SSO fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ssoId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ssoProvider" TEXT;

-- CreateTable SsoConfig
CREATE TABLE IF NOT EXISTS "SsoConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "issuer" TEXT,
    "entryPoint" TEXT,
    "certificate" TEXT,
    "clientId" TEXT,
    "clientSecretEncrypted" TEXT,
    "attributeMapping" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable DataRetentionPolicy
CREATE TABLE IF NOT EXISTS "DataRetentionPolicy" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "metricsRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "recordingsRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 730,
    "securityScanRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "backupRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SsoConfig_orgId_key" ON "SsoConfig"("orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "DataRetentionPolicy_orgId_key" ON "DataRetentionPolicy"("orgId");
CREATE INDEX IF NOT EXISTS "SsoConfig_orgId_idx" ON "SsoConfig"("orgId");
CREATE INDEX IF NOT EXISTS "DataRetentionPolicy_orgId_idx" ON "DataRetentionPolicy"("orgId");

-- AddForeignKey
ALTER TABLE "SsoConfig" ADD CONSTRAINT "SsoConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DataRetentionPolicy" ADD CONSTRAINT "DataRetentionPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "SsoConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataRetentionPolicy" ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS sso_config_isolation ON "SsoConfig";
CREATE POLICY sso_config_isolation ON "SsoConfig"
  FOR ALL USING ("orgId" = current_org_id());

DROP POLICY IF EXISTS data_retention_policy_isolation ON "DataRetentionPolicy";
CREATE POLICY data_retention_policy_isolation ON "DataRetentionPolicy"
  FOR ALL USING ("orgId" = current_org_id());

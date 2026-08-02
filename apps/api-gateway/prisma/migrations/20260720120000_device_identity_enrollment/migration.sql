-- AlterTable: Add identity and enrollment fields to Device
ALTER TABLE "Device" ADD COLUMN "identityFingerprint" TEXT;
ALTER TABLE "Device" ADD COLUMN "installationId" TEXT;
ALTER TABLE "Device" ADD COLUMN "agentVersion" TEXT;
ALTER TABLE "Device" ADD COLUMN "identityVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Device" ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Device" ADD COLUMN "lastRegisteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: Unique identity per org
CREATE UNIQUE INDEX "unique_identity_per_org" ON "Device"("orgId", "identityFingerprint") WHERE "identityFingerprint" IS NOT NULL;

-- CreateIndex: Unique installation per org
CREATE UNIQUE INDEX "unique_installation_per_org" ON "Device"("orgId", "installationId") WHERE "installationId" IS NOT NULL;

-- CreateIndex: identity fingerprint lookup
CREATE INDEX "Device_identityFingerprint_idx" ON "Device"("identityFingerprint");

-- CreateIndex: installation ID lookup
CREATE INDEX "Device_installationId_idx" ON "Device"("installationId");

-- CreateTable: EnrollmentToken
CREATE TABLE "EnrollmentToken" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "EnrollmentToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: EnrollmentToken unique hash
CREATE UNIQUE INDEX "EnrollmentToken_tokenHash_key" ON "EnrollmentToken"("tokenHash");

-- CreateIndex: EnrollmentToken org lookup
CREATE INDEX "EnrollmentToken_orgId_idx" ON "EnrollmentToken"("orgId");

-- CreateIndex: EnrollmentToken token lookup
CREATE INDEX "EnrollmentToken_tokenHash_idx" ON "EnrollmentToken"("tokenHash");

-- AddForeignKey: EnrollmentToken org
ALTER TABLE "EnrollmentToken" ADD CONSTRAINT "EnrollmentToken_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

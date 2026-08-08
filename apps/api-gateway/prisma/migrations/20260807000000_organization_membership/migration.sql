-- ORG-01A1: Membership Schema Foundation & Backfill
-- Additive, non-destructive. Creates the OrganizationMember join table that
-- enables ONE USER -> MANY ORGANIZATIONS at the schema level while preserving
-- the legacy single-org fields (User.orgId, User.role) for backward
-- compatibility until ORG-01A2/A3 rewire the auth/API layer.

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_userId_orgId_key" ON "OrganizationMember"("userId", "orgId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "OrganizationMember_orgId_idx" ON "OrganizationMember"("orgId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one membership row per existing user, mirroring the legacy
-- single-org state (orgId and role copied verbatim from User).
-- Idempotent-safe: NOT EXISTS guard + ON CONFLICT DO NOTHING make a second
-- run a no-op. Does not alter any existing User/Organization/Device row.
INSERT INTO "OrganizationMember" ("id", "userId", "orgId", "role", "createdAt", "updatedAt")
SELECT gen_random_uuid(), u.id, u."orgId", u.role, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1 FROM "OrganizationMember" m
    WHERE m."userId" = u.id AND m."orgId" = u."orgId"
)
ON CONFLICT ("userId", "orgId") DO NOTHING;

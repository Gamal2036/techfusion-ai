-- ACC-SEC-02D2A: RefreshToken session identity & metadata.
-- Additive, non-destructive, backward compatible. No column is dropped, no
-- constraint is weakened, no data is transformed.
--
-- Adds:
--   * sessionId  — stable, NON-SECRET session identity that survives the full
--     refresh-token rotation chain. Deliberately NOT unique: multiple
--     historical (revoked) rows in one rotation chain share it. It is never
--     accepted from a client and never grants authentication by itself.
--   * lastUsedAt / ipAddress / userAgent / deviceName — truthful server-
--     observed session metadata (deviceName is reserved, never fabricated).
--
-- Existing rows receive a safe stable random sessionId (gen_random_uuid()) so
-- the column can be enforced NOT NULL for all future sessions without
-- destroying shipped refresh sessions. No production data backfill was
-- performed by this stage; this migration itself is the only backfill and is
-- additive by construction.

-- AddColumn
ALTER TABLE "RefreshToken" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "RefreshToken" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "deviceName" TEXT;

-- Backfill: one stable random sessionId per existing row (idempotent-safe).
UPDATE "RefreshToken" SET "sessionId" = gen_random_uuid() WHERE "sessionId" IS NULL;

-- NotNull
ALTER TABLE "RefreshToken" ALTER COLUMN "sessionId" SET NOT NULL;

-- CreateIndex: session-management queries (list active sessions, per-session
-- revocation). sessionId alone is intentionally NOT unique.
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");
CREATE INDEX "RefreshToken_userId_sessionId_idx" ON "RefreshToken"("userId", "sessionId");

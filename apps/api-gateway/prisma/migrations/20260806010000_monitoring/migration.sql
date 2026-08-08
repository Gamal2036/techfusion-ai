-- V1-MON-01: Continuous Monitoring, Real Device Presence & Automatic Alert Engine
-- Additive, non-destructive schema changes.

-- AlertRule.kind: "metric" (default) or "presence" (heartbeat freshness)
ALTER TABLE "AlertRule" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'metric';

-- Alert lifecycle: status (OPEN/ACKNOWLEDGED/RESOLVED), source, dedup key, last detection, updatedAt
ALTER TABLE "Alert" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Alert" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'metric';
ALTER TABLE "Alert" ADD COLUMN "activeKey" TEXT;
ALTER TABLE "Alert" ADD COLUMN "lastDetectedAt" TIMESTAMP(3);
ALTER TABLE "Alert" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill lifecycle status from the existing implicit lifecycle.
-- Precedence: RESOLVED (resolvedAt set) > ACKNOWLEDGED (acknowledgedAt set) > OPEN.
UPDATE "Alert" SET
  "status" = CASE
    WHEN "resolvedAt" IS NOT NULL THEN 'RESOLVED'
    WHEN "acknowledgedAt" IS NOT NULL THEN 'ACKNOWLEDGED'
    ELSE 'OPEN'
  END,
  "lastDetectedAt" = "createdAt",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Backfill activeKey for the single oldest unresolved alert per (org, device, rule).
-- Legacy duplicates (possible from pre-dedup in-memory debounce) keep NULL and are
-- reconciled by the monitoring sweep.
UPDATE "Alert" SET "activeKey" = sub.key, "updatedAt" = CURRENT_TIMESTAMP
FROM (
  SELECT a.id,
         a."alertRuleId" || ':' || a."deviceId" AS key,
         ROW_NUMBER() OVER (
           PARTITION BY a."alertRuleId", a."deviceId"
           ORDER BY a."createdAt" ASC, a.id ASC
         ) AS rn
  FROM "Alert" a
  WHERE a."resolvedAt" IS NULL
) sub
WHERE "Alert".id = sub.id
  AND sub.rn = 1
  AND "Alert"."resolvedAt" IS NULL;

-- Unique index enforcing the one-open-alert-per-(rule, device) invariant.
-- NULLs are distinct in Postgres, so only non-null (active) keys are constrained.
CREATE UNIQUE INDEX "Alert_activeKey_key" ON "Alert"("activeKey");

-- Composite index for the org-scoped lifecycle queries.
CREATE INDEX "Alert_orgId_status_idx" ON "Alert"("orgId", "status");

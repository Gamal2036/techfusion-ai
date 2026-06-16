-- CreateTable: AlertRule
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metricName" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'gt',
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "debounceSeconds" INTEGER NOT NULL DEFAULT 300,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "deviceSelector" TEXT,
    "webhookUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Alert
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- Add serviceChecks column to DeviceMetric
ALTER TABLE "DeviceMetric" ADD COLUMN IF NOT EXISTS "serviceChecks" JSONB;

-- CreateIndex
CREATE INDEX "AlertRule_orgId_idx" ON "AlertRule"("orgId");
CREATE INDEX "Alert_orgId_createdAt_idx" ON "Alert"("orgId", "createdAt");
CREATE INDEX "Alert_alertRuleId_idx" ON "Alert"("alertRuleId");
CREATE INDEX "Alert_deviceId_idx" ON "Alert"("deviceId");

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "AlertRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alert" ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY alert_rule_isolation ON "AlertRule"
  FOR ALL USING ("orgId" = current_org_id());

CREATE POLICY alert_isolation ON "Alert"
  FOR ALL USING ("orgId" = current_org_id());

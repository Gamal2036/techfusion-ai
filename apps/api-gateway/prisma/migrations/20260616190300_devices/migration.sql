-- CreateTable: Device
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT,
    "os" TEXT,
    "osVersion" TEXT,
    "cpuModel" TEXT,
    "cpuCores" INTEGER,
    "cpuLogical" INTEGER,
    "ramTotal" BIGINT,
    "gpuInfo" TEXT,
    "diskTotal" BIGINT,
    "isLaptop" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "deviceToken" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DeviceMetric (will be converted to hypertable)
CREATE TABLE "DeviceMetric" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuUsage" DOUBLE PRECISION NOT NULL,
    "ramUsed" BIGINT NOT NULL,
    "ramTotal" BIGINT NOT NULL,
    "ramPercent" DOUBLE PRECISION NOT NULL,
    "diskUsed" BIGINT,
    "diskTotal" BIGINT,
    "diskReadBytes" BIGINT,
    "diskWriteBytes" BIGINT,
    "diskSmartStatus" TEXT,
    "diskSmartReallocatedSectors" INTEGER,
    "diskSmartTemperature" DOUBLE PRECISION,
    "gpuUsage" DOUBLE PRECISION,
    "gpuTemp" DOUBLE PRECISION,
    "gpuMemoryUsed" BIGINT,
    "batteryPercent" INTEGER,
    "batteryStatus" TEXT,
    "tempCpu" DOUBLE PRECISION,
    "tempGpu" DOUBLE PRECISION,
    "tempMotherboard" DOUBLE PRECISION,
    "fanRpm" INTEGER,
    "networkRxBytes" BIGINT,
    "networkTxBytes" BIGINT,
    "loadAverage1Min" DOUBLE PRECISION,
    "loadAverage5Min" DOUBLE PRECISION,
    "loadAverage15Min" DOUBLE PRECISION,
    "processes" INTEGER,
    "uptime" BIGINT,

    CONSTRAINT "DeviceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DeviceHealthScore
CREATE TABLE "DeviceHealthScore" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "healthScore" DOUBLE PRECISION NOT NULL,
    "performanceScore" DOUBLE PRECISION NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DeviceHealthScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceToken_key" ON "Device"("deviceToken");
CREATE INDEX "Device_orgId_idx" ON "Device"("orgId");
CREATE INDEX "DeviceMetric_deviceId_recordedAt_idx" ON "DeviceMetric"("deviceId", "recordedAt");
CREATE INDEX "DeviceMetric_orgId_recordedAt_idx" ON "DeviceMetric"("orgId", "recordedAt");
CREATE INDEX "DeviceHealthScore_deviceId_calculatedAt_idx" ON "DeviceHealthScore"("deviceId", "calculatedAt");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceMetric" ADD CONSTRAINT "DeviceMetric_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceMetric" ADD CONSTRAINT "DeviceMetric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceHealthScore" ADD CONSTRAINT "DeviceHealthScore_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceHealthScore" ADD CONSTRAINT "DeviceHealthScore_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop primary key to allow TimescaleDB hypertable conversion
ALTER TABLE "DeviceMetric" DROP CONSTRAINT "DeviceMetric_pkey";

-- Convert DeviceMetric to TimescaleDB hypertable
SELECT create_hypertable('"DeviceMetric"', 'recordedAt', if_not_exists => TRUE);

-- Recreate primary key as composite including partition column
ALTER TABLE "DeviceMetric" ADD CONSTRAINT "DeviceMetric_pkey" PRIMARY KEY ("id", "recordedAt");

-- Enable RLS on new tables
ALTER TABLE "Device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceHealthScore" ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY device_isolation ON "Device"
  FOR ALL USING ("orgId" = current_org_id());

CREATE POLICY device_metric_isolation ON "DeviceMetric"
  FOR ALL USING ("orgId" = current_org_id());

CREATE POLICY device_health_score_isolation ON "DeviceHealthScore"
  FOR ALL USING ("orgId" = current_org_id());

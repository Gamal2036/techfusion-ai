-- CreateTable: AiProviderConfig
CREATE TABLE IF NOT EXISTS "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "baseUrl" TEXT,
    "model" TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiUsageLog
CREATE TABLE IF NOT EXISTS "AiUsageLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiConversation
CREATE TABLE IF NOT EXISTS "AiConversation" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AiMessage
CREATE TABLE IF NOT EXISTS "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SecurityScan
CREATE TABLE IF NOT EXISTS "SecurityScan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SecurityFinding
CREATE TABLE IF NOT EXISTS "SecurityFinding" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "remediation" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remediatedAt" TIMESTAMP(3),

    CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SecurityScore
CREATE TABLE IF NOT EXISTS "SecurityScore" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "securityScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "totalFindings" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NetworkDevice
CREATE TABLE IF NOT EXISTS "NetworkDevice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "mac" TEXT,
    "hostname" TEXT,
    "vendor" TEXT,
    "interface" TEXT,
    "source" TEXT NOT NULL DEFAULT 'arp',
    "reachable" BOOLEAN NOT NULL DEFAULT false,
    "latencyMs" DOUBLE PRECISION,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "NetworkDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NetworkScan
CREATE TABLE IF NOT EXISTS "NetworkScan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "gatewayIp" TEXT,
    "gatewayMac" TEXT,
    "localIp" TEXT,
    "localMac" TEXT,
    "subnet" TEXT,
    "scanDurationMs" INTEGER,
    "deviceCount" INTEGER NOT NULL DEFAULT 0,
    "discoveredIps" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DriverCatalogItem (global, no orgId)
CREATE TABLE IF NOT EXISTS "DriverCatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "minVersion" TEXT,
    "latestVersion" TEXT,
    "category" TEXT,
    "downloadUrl" TEXT,
    "checksum" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SoftwareCatalogItem (global, no orgId)
CREATE TABLE IF NOT EXISTS "SoftwareCatalogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "minVersion" TEXT,
    "latestVersion" TEXT,
    "category" TEXT,
    "downloadUrl" TEXT,
    "isEssential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Driver
CREATE TABLE IF NOT EXISTS "Driver" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "version" TEXT,
    "modulePath" TEXT,
    "usedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'kernel_module',
    "status" TEXT NOT NULL DEFAULT 'current',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SoftwareInventory
CREATE TABLE IF NOT EXISTS "SoftwareInventory" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "vendor" TEXT,
    "installDate" TEXT,
    "description" TEXT,
    "source" TEXT NOT NULL DEFAULT 'deb',
    "status" TEXT NOT NULL DEFAULT 'current',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SoftwareInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BackupJob
CREATE TABLE IF NOT EXISTS "BackupJob" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'file',
    "schedule" TEXT,
    "sourcePaths" TEXT,
    "destination" TEXT,
    "retention" INTEGER NOT NULL DEFAULT 7,
    "compression" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BackupRun
CREATE TABLE IF NOT EXISTS "BackupRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "type" TEXT NOT NULL DEFAULT 'file',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "sizeBytes" BIGINT,
    "fileCount" INTEGER,
    "sourcePaths" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReportTemplate
CREATE TABLE IF NOT EXISTS "ReportTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "companyName" TEXT,
    "logoPath" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Report
CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "signedUrl" TEXT,
    "urlExpiresAt" TIMESTAMP(3),
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiSummary" TEXT,
    "sourceIds" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ReportSchedule
CREATE TABLE IF NOT EXISTS "ReportSchedule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "formats" TEXT NOT NULL DEFAULT 'pdf',
    "cron" TEXT NOT NULL,
    "deviceIds" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RemoteSession
CREATE TABLE IF NOT EXISTS "RemoteSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "protocol" TEXT NOT NULL DEFAULT 'webrtc',
    "turnServer" TEXT,
    "turnCredential" TEXT,
    "recordingPath" TEXT,
    "recordingSize" BIGINT,
    "recordingDuration" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "consentGranted" BOOLEAN NOT NULL DEFAULT false,
    "consentMethod" TEXT,
    "unattendedPolicy" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sessionId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: AiProviderConfig
CREATE UNIQUE INDEX IF NOT EXISTS "AiProviderConfig_orgId_provider_key" ON "AiProviderConfig"("orgId", "provider");
CREATE INDEX IF NOT EXISTS "AiProviderConfig_orgId_priority_idx" ON "AiProviderConfig"("orgId", "priority");

-- CreateIndex: AiUsageLog
CREATE INDEX IF NOT EXISTS "AiUsageLog_orgId_createdAt_idx" ON "AiUsageLog"("orgId", "createdAt");

-- CreateIndex: AiConversation
CREATE INDEX IF NOT EXISTS "AiConversation_orgId_updatedAt_idx" ON "AiConversation"("orgId", "updatedAt");

-- CreateIndex: AiMessage
CREATE INDEX IF NOT EXISTS "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- CreateIndex: SecurityScan
CREATE INDEX IF NOT EXISTS "SecurityScan_orgId_startedAt_idx" ON "SecurityScan"("orgId", "startedAt");
CREATE INDEX IF NOT EXISTS "SecurityScan_deviceId_startedAt_idx" ON "SecurityScan"("deviceId", "startedAt");

-- CreateIndex: SecurityFinding
CREATE INDEX IF NOT EXISTS "SecurityFinding_orgId_severity_idx" ON "SecurityFinding"("orgId", "severity");
CREATE INDEX IF NOT EXISTS "SecurityFinding_deviceId_severity_idx" ON "SecurityFinding"("deviceId", "severity");
CREATE INDEX IF NOT EXISTS "SecurityFinding_scanId_idx" ON "SecurityFinding"("scanId");

-- CreateIndex: SecurityScore
CREATE UNIQUE INDEX IF NOT EXISTS "SecurityScore_scanId_key" ON "SecurityScore"("scanId");
CREATE INDEX IF NOT EXISTS "SecurityScore_orgId_calculatedAt_idx" ON "SecurityScore"("orgId", "calculatedAt");
CREATE INDEX IF NOT EXISTS "SecurityScore_deviceId_calculatedAt_idx" ON "SecurityScore"("deviceId", "calculatedAt");

-- CreateIndex: NetworkDevice
CREATE UNIQUE INDEX IF NOT EXISTS "NetworkDevice_orgId_ip_key" ON "NetworkDevice"("orgId", "ip");
CREATE INDEX IF NOT EXISTS "NetworkDevice_orgId_idx" ON "NetworkDevice"("orgId");
CREATE INDEX IF NOT EXISTS "NetworkDevice_orgId_reachable_idx" ON "NetworkDevice"("orgId", "reachable");

-- CreateIndex: NetworkScan
CREATE INDEX IF NOT EXISTS "NetworkScan_orgId_startedAt_idx" ON "NetworkScan"("orgId", "startedAt");

-- CreateIndex: DriverCatalogItem
CREATE UNIQUE INDEX IF NOT EXISTS "DriverCatalogItem_name_vendor_key" ON "DriverCatalogItem"("name", "vendor");

-- CreateIndex: SoftwareCatalogItem
CREATE UNIQUE INDEX IF NOT EXISTS "SoftwareCatalogItem_name_vendor_key" ON "SoftwareCatalogItem"("name", "vendor");

-- CreateIndex: Driver
CREATE UNIQUE INDEX IF NOT EXISTS "Driver_orgId_name_key" ON "Driver"("orgId", "name");
CREATE INDEX IF NOT EXISTS "Driver_orgId_idx" ON "Driver"("orgId");
CREATE INDEX IF NOT EXISTS "Driver_orgId_status_idx" ON "Driver"("orgId", "status");

-- CreateIndex: SoftwareInventory
CREATE UNIQUE INDEX IF NOT EXISTS "SoftwareInventory_orgId_name_key" ON "SoftwareInventory"("orgId", "name");
CREATE INDEX IF NOT EXISTS "SoftwareInventory_orgId_idx" ON "SoftwareInventory"("orgId");
CREATE INDEX IF NOT EXISTS "SoftwareInventory_orgId_status_idx" ON "SoftwareInventory"("orgId", "status");

-- CreateIndex: BackupJob
CREATE INDEX IF NOT EXISTS "BackupJob_orgId_idx" ON "BackupJob"("orgId");
CREATE INDEX IF NOT EXISTS "BackupJob_orgId_deviceId_idx" ON "BackupJob"("orgId", "deviceId");

-- CreateIndex: BackupRun
CREATE INDEX IF NOT EXISTS "BackupRun_orgId_startedAt_idx" ON "BackupRun"("orgId", "startedAt");
CREATE INDEX IF NOT EXISTS "BackupRun_jobId_startedAt_idx" ON "BackupRun"("jobId", "startedAt");

-- CreateIndex: ReportTemplate
CREATE UNIQUE INDEX IF NOT EXISTS "ReportTemplate_orgId_key" ON "ReportTemplate"("orgId");

-- CreateIndex: Report
CREATE INDEX IF NOT EXISTS "Report_orgId_createdAt_idx" ON "Report"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "Report_orgId_type_idx" ON "Report"("orgId", "type");

-- CreateIndex: ReportSchedule
CREATE INDEX IF NOT EXISTS "ReportSchedule_orgId_nextRunAt_idx" ON "ReportSchedule"("orgId", "nextRunAt");

-- CreateIndex: RemoteSession
CREATE INDEX IF NOT EXISTS "RemoteSession_orgId_status_idx" ON "RemoteSession"("orgId", "status");
CREATE INDEX IF NOT EXISTS "RemoteSession_orgId_deviceId_status_idx" ON "RemoteSession"("orgId", "deviceId", "status");
CREATE INDEX IF NOT EXISTS "RemoteSession_deviceId_status_idx" ON "RemoteSession"("deviceId", "status");

-- CreateIndex: AuditLog
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_sessionId_idx" ON "AuditLog"("orgId", "sessionId");
CREATE INDEX IF NOT EXISTS "AuditLog_sessionId_idx" ON "AuditLog"("sessionId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiUsageLog" ADD CONSTRAINT "AiUsageLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityScan" ADD CONSTRAINT "SecurityScan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityScan" ADD CONSTRAINT "SecurityScan_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "SecurityScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityScore" ADD CONSTRAINT "SecurityScore_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "SecurityScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityScore" ADD CONSTRAINT "SecurityScore_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityScore" ADD CONSTRAINT "SecurityScore_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NetworkDevice" ADD CONSTRAINT "NetworkDevice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NetworkScan" ADD CONSTRAINT "NetworkScan_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SoftwareInventory" ADD CONSTRAINT "SoftwareInventory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackupJob" ADD CONSTRAINT "BackupJob_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackupJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportTemplate" ADD CONSTRAINT "ReportTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

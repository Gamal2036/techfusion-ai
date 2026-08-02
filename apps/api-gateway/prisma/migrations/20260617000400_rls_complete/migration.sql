-- Enable RLS on all tenant-scoped tables
-- Re-enabling on tables that already have RLS is idempotent

-- Tables from migration 2 (init)
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;

-- Tables from migration 3 (devices)
ALTER TABLE "Device" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceHealthScore" ENABLE ROW LEVEL SECURITY;

-- Tables from migration 4 (alerts)
ALTER TABLE "AlertRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Alert" ENABLE ROW LEVEL SECURITY;

-- Tables from migration 5 (billing)
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;

-- Tables from migration 6 (kb)
ALTER TABLE "KbArticle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KbEmbedding" ENABLE ROW LEVEL SECURITY;

-- Tables from migration 7 (enterprise)
ALTER TABLE "SsoConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataRetentionPolicy" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (ai)
ALTER TABLE "AiProviderConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiUsageLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AiMessage" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (security)
ALTER TABLE "SecurityScan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityScore" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (network)
ALTER TABLE "NetworkDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NetworkScan" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (inventory)
ALTER TABLE "Driver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SoftwareInventory" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (backups)
ALTER TABLE "BackupJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BackupRun" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (reports)
ALTER TABLE "ReportTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReportSchedule" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (remote)
ALTER TABLE "RemoteSession" ENABLE ROW LEVEL SECURITY;

-- Tables from missing_tables migration (audit)
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- NOTE: DriverCatalogItem and SoftwareCatalogItem are GLOBAL tables (no orgId)
-- They intentionally do NOT have RLS enabled.

-- Drop and recreate all policies for idempotency

-- Organization policy
DROP POLICY IF EXISTS org_isolation ON "Organization";
CREATE POLICY org_isolation ON "Organization"
  FOR ALL USING (id = current_org_id());

-- User policy
DROP POLICY IF EXISTS user_isolation ON "User";
CREATE POLICY user_isolation ON "User"
  FOR ALL USING ("orgId" = current_org_id());

-- RefreshToken policy
DROP POLICY IF EXISTS refresh_token_isolation ON "RefreshToken";
CREATE POLICY refresh_token_isolation ON "RefreshToken"
  FOR ALL USING ("orgId" = current_org_id());

-- Device policy
DROP POLICY IF EXISTS device_isolation ON "Device";
CREATE POLICY device_isolation ON "Device"
  FOR ALL USING ("orgId" = current_org_id());

-- DeviceMetric policy
DROP POLICY IF EXISTS device_metric_isolation ON "DeviceMetric";
CREATE POLICY device_metric_isolation ON "DeviceMetric"
  FOR ALL USING ("orgId" = current_org_id());

-- DeviceHealthScore policy
DROP POLICY IF EXISTS device_health_score_isolation ON "DeviceHealthScore";
CREATE POLICY device_health_score_isolation ON "DeviceHealthScore"
  FOR ALL USING ("orgId" = current_org_id());

-- AlertRule policy
DROP POLICY IF EXISTS alert_rule_isolation ON "AlertRule";
CREATE POLICY alert_rule_isolation ON "AlertRule"
  FOR ALL USING ("orgId" = current_org_id());

-- Alert policy
DROP POLICY IF EXISTS alert_isolation ON "Alert";
CREATE POLICY alert_isolation ON "Alert"
  FOR ALL USING ("orgId" = current_org_id());

-- Subscription policy
DROP POLICY IF EXISTS subscription_isolation ON "Subscription";
CREATE POLICY subscription_isolation ON "Subscription"
  FOR ALL USING ("orgId" = current_org_id());

-- Invoice policy
DROP POLICY IF EXISTS invoice_isolation ON "Invoice";
CREATE POLICY invoice_isolation ON "Invoice"
  FOR ALL USING ("orgId" = current_org_id());

-- KbArticle policy
DROP POLICY IF EXISTS kb_article_isolation ON "KbArticle";
CREATE POLICY kb_article_isolation ON "KbArticle"
  FOR ALL USING ("orgId" = current_org_id());

-- KbEmbedding policy (uses subquery through KbArticle)
DROP POLICY IF EXISTS kb_embedding_isolation ON "KbEmbedding";
CREATE POLICY kb_embedding_isolation ON "KbEmbedding"
  FOR ALL
  USING (
    "articleId" IN (
      SELECT id FROM "KbArticle" WHERE "orgId" = current_org_id()
    )
  );

-- SsoConfig policy
DROP POLICY IF EXISTS sso_config_isolation ON "SsoConfig";
CREATE POLICY sso_config_isolation ON "SsoConfig"
  FOR ALL USING ("orgId" = current_org_id());

-- DataRetentionPolicy policy
DROP POLICY IF EXISTS data_retention_policy_isolation ON "DataRetentionPolicy";
CREATE POLICY data_retention_policy_isolation ON "DataRetentionPolicy"
  FOR ALL USING ("orgId" = current_org_id());

-- AiProviderConfig policy
DROP POLICY IF EXISTS ai_provider_config_isolation ON "AiProviderConfig";
CREATE POLICY ai_provider_config_isolation ON "AiProviderConfig"
  FOR ALL USING ("orgId" = current_org_id());

-- AiUsageLog policy
DROP POLICY IF EXISTS ai_usage_log_isolation ON "AiUsageLog";
CREATE POLICY ai_usage_log_isolation ON "AiUsageLog"
  FOR ALL USING ("orgId" = current_org_id());

-- AiConversation policy
DROP POLICY IF EXISTS ai_conversation_isolation ON "AiConversation";
CREATE POLICY ai_conversation_isolation ON "AiConversation"
  FOR ALL USING ("orgId" = current_org_id());

-- AiMessage policy (uses subquery through AiConversation, no orgId on AiMessage)
DROP POLICY IF EXISTS ai_message_isolation ON "AiMessage";
CREATE POLICY ai_message_isolation ON "AiMessage"
  FOR ALL
  USING (
    "conversationId" IN (
      SELECT id FROM "AiConversation" WHERE "orgId" = current_org_id()
    )
  );

-- SecurityScan policy
DROP POLICY IF EXISTS security_scan_isolation ON "SecurityScan";
CREATE POLICY security_scan_isolation ON "SecurityScan"
  FOR ALL USING ("orgId" = current_org_id());

-- SecurityFinding policy
DROP POLICY IF EXISTS security_finding_isolation ON "SecurityFinding";
CREATE POLICY security_finding_isolation ON "SecurityFinding"
  FOR ALL USING ("orgId" = current_org_id());

-- SecurityScore policy
DROP POLICY IF EXISTS security_score_isolation ON "SecurityScore";
CREATE POLICY security_score_isolation ON "SecurityScore"
  FOR ALL USING ("orgId" = current_org_id());

-- NetworkDevice policy
DROP POLICY IF EXISTS network_device_isolation ON "NetworkDevice";
CREATE POLICY network_device_isolation ON "NetworkDevice"
  FOR ALL USING ("orgId" = current_org_id());

-- NetworkScan policy
DROP POLICY IF EXISTS network_scan_isolation ON "NetworkScan";
CREATE POLICY network_scan_isolation ON "NetworkScan"
  FOR ALL USING ("orgId" = current_org_id());

-- Driver policy
DROP POLICY IF EXISTS driver_isolation ON "Driver";
CREATE POLICY driver_isolation ON "Driver"
  FOR ALL USING ("orgId" = current_org_id());

-- SoftwareInventory policy
DROP POLICY IF EXISTS software_inventory_isolation ON "SoftwareInventory";
CREATE POLICY software_inventory_isolation ON "SoftwareInventory"
  FOR ALL USING ("orgId" = current_org_id());

-- BackupJob policy
DROP POLICY IF EXISTS backup_job_isolation ON "BackupJob";
CREATE POLICY backup_job_isolation ON "BackupJob"
  FOR ALL USING ("orgId" = current_org_id());

-- BackupRun policy
DROP POLICY IF EXISTS backup_run_isolation ON "BackupRun";
CREATE POLICY backup_run_isolation ON "BackupRun"
  FOR ALL USING ("orgId" = current_org_id());

-- ReportTemplate policy
DROP POLICY IF EXISTS report_template_isolation ON "ReportTemplate";
CREATE POLICY report_template_isolation ON "ReportTemplate"
  FOR ALL USING ("orgId" = current_org_id());

-- Report policy
DROP POLICY IF EXISTS report_isolation ON "Report";
CREATE POLICY report_isolation ON "Report"
  FOR ALL USING ("orgId" = current_org_id());

-- ReportSchedule policy
DROP POLICY IF EXISTS report_schedule_isolation ON "ReportSchedule";
CREATE POLICY report_schedule_isolation ON "ReportSchedule"
  FOR ALL USING ("orgId" = current_org_id());

-- RemoteSession policy
DROP POLICY IF EXISTS remote_session_isolation ON "RemoteSession";
CREATE POLICY remote_session_isolation ON "RemoteSession"
  FOR ALL USING ("orgId" = current_org_id());

-- AuditLog policy
DROP POLICY IF EXISTS audit_log_isolation ON "AuditLog";
CREATE POLICY audit_log_isolation ON "AuditLog"
  FOR ALL USING ("orgId" = current_org_id());

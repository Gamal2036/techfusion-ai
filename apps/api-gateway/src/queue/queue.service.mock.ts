import { IQueueService } from './queue.service';
import { QueueName } from './queue.constants';

export class MockQueueService implements IQueueService {
  private readonly jobs: any[] = [];

  async addAlertNotification(data: { alert: any; rule: any; deviceName: string; orgId: string }): Promise<void> {
    this.jobs.push({ type: 'alert_notification', data });
  }

  async addReportGeneration(data: { orgId: string; userId: string; reportType: string; format: string; title: string; options: any }): Promise<void> {
    this.jobs.push({ type: 'report_generation', data });
  }

  async addBackupExecution(data: { runId: string; jobId: string; orgId: string; deviceId: string; type: string; sourcePaths: string | null }): Promise<void> {
    this.jobs.push({ type: 'backup_execution', data });
  }

  async addBackupRestore(data: { runId: string; orgId: string; deviceId: string }): Promise<void> {
    this.jobs.push({ type: 'backup_restore', data });
  }

  async addBackupVerify(data: { runId: string; orgId: string; deviceId: string; archivePath: string }): Promise<void> {
    this.jobs.push({ type: 'backup_verify', data });
  }

  async addInventoryIngest(data: { orgId: string; deviceId: string; drivers: any[]; software: any[] }): Promise<void> {
    this.jobs.push({ type: 'inventory_ingest', data });
  }

  async addSecurityScanComplete(data: { scanId: string; orgId: string; deviceId: string; score: any; findingCount: number }): Promise<void> {
    this.jobs.push({ type: 'security_scan_complete', data });
  }

  async addSecurityFindingAlert(data: { findingId: string; orgId: string; deviceId: string; severity: string; finding: string }): Promise<void> {
    this.jobs.push({ type: 'security_finding_alert', data });
  }

  async addRetentionEnforce(data: { orgId?: string; allOrgs: boolean }): Promise<void> {
    this.jobs.push({ type: 'retention_enforce', data });
  }

  async addKbEmbedding(data: { orgId: string; articleId: string }): Promise<void> {
    this.jobs.push({ type: 'kb_embedding', data });
  }

  async addPresenceSweep(data: { allOrgs: boolean; scheduledAt?: string }): Promise<void> {
    this.jobs.push({ type: 'presence_sweep', data });
  }

  async getQueueDepth(name: QueueName): Promise<number> {
    return 0;
  }

  async getAllQueueDepths(): Promise<Record<string, number>> {
    return {};
  }

  getJobs(): any[] {
    return this.jobs;
  }

  clear(): void {
    this.jobs.length = 0;
  }
}

import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { QUEUE_NAMES, JOB_NAMES, DEFAULT_JOB_OPTIONS, QueueName } from './queue.constants';
import { getCorrelationContext, generateJobCorrelationId } from '../common/correlation-id';

export interface IQueueService {
  addAlertNotification(data: { alert: any; rule: any; deviceName: string; orgId: string }): Promise<void>;
  addReportGeneration(data: { orgId: string; userId: string; reportType: string; format: string; title: string; options: any }): Promise<void>;
  addBackupExecution(data: { runId: string; jobId: string; orgId: string; deviceId: string; type: string; sourcePaths: string | null }): Promise<void>;
  addBackupRestore(data: { runId: string; orgId: string; deviceId: string; type?: string; destPath?: string }): Promise<void>;
  addBackupVerify(data: { runId: string; orgId: string; deviceId: string; archivePath: string }): Promise<void>;
  addInventoryIngest(data: { orgId: string; deviceId: string; drivers: any[]; software: any[]; reportType?: string; reportVersion?: string; collectedAt?: string; payloadHash?: string }): Promise<void>;
  addSecurityScanComplete(data: { scanId: string; orgId: string; deviceId: string; score: any; findingCount: number }): Promise<void>;
  addSecurityFindingAlert(data: { findingId: string; orgId: string; deviceId: string; severity: string; finding: string }): Promise<void>;
  addRetentionEnforce(data: { orgId?: string; allOrgs: boolean; requestedBy?: string }): Promise<void>;
  addKbEmbedding(data: { orgId: string; articleId: string }): Promise<void>;
  addPresenceSweep(data: { allOrgs: boolean; scheduledAt?: string }): Promise<void>;
  addTransactionalEmail(data: { templateId: string; encryptedPayload: string; recipientHash: string; idempotencyKey: string; correlationId: string }): Promise<void>;
  getQueueDepth(name: QueueName): Promise<number>;
  getAllQueueDepths(): Promise<Record<string, number>>;
}

@Injectable()
export class QueueService implements IQueueService, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Map<string, Queue> = new Map();
  private readonly redisUrl: string;

  constructor(@Optional() private readonly connectionOptions?: { url: string }) {
    this.redisUrl = connectionOptions?.url || process.env.REDIS_URL || 'redis://localhost:6379';
    this.initializeQueues();
  }

  private initializeQueues(): void {
    const connection = { url: this.redisUrl };

    for (const name of Object.values(QUEUE_NAMES)) {
      const queue = new Queue(name, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
      this.queues.set(name, queue);
      this.logger.log(`Queue "${name}" initialized`);
    }

    this.logger.log(`All ${this.queues.size} queues initialized`);
  }

  private getQueue(name: QueueName): Queue {
    const queue = this.queues.get(name);
    if (!queue) {
      throw new Error(`Queue "${name}" not found`);
    }
    return queue;
  }

  private attachCorrelation(data: Record<string, any>): Record<string, any> {
    const ctx = getCorrelationContext();
    if (!ctx) return data;
    return {
      ...data,
      _correlation: {
        requestId: ctx.requestId,
        correlationId: generateJobCorrelationId(ctx.correlationId),
        traceId: ctx.traceId,
        userId: ctx.userId,
        orgId: ctx.orgId,
      },
    };
  }

  async addAlertNotification(data: {
    alert: any;
    rule: any;
    deviceName: string;
    orgId: string;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.ALERT);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.ALERT.NOTIFICATION, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: data.alert.severity === 'critical' ? 1 : data.alert.severity === 'high' ? 2 : 3,
    });
    this.logger.log(`Alert notification job added for alert ${data.alert.id}`);
  }

  async addReportGeneration(data: {
    orgId: string;
    userId: string;
    reportType: string;
    format: string;
    title: string;
    options: any;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.REPORT);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.REPORT.GENERATE, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 5,
    });
    this.logger.log(`Report generation job added: ${data.reportType} (${data.format})`);
  }

  async addBackupExecution(data: {
    runId: string;
    jobId: string;
    orgId: string;
    deviceId: string;
    type: string;
    sourcePaths: string | null;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.BACKUP);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.BACKUP.EXECUTE, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 4,
    });
    this.logger.log(`Backup execution job added for run ${data.runId}`);
  }

  async addBackupRestore(data: {
    runId: string;
    orgId: string;
    deviceId: string;
    type?: string;
    destPath?: string;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.BACKUP);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.BACKUP.RESTORE, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 4,
    });
    this.logger.log(`Backup restore job added for run ${data.runId} (type: ${data.type || 'restore-postgres'})`);
  }

  async addBackupVerify(data: {
    runId: string;
    orgId: string;
    deviceId: string;
    archivePath: string;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.BACKUP);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.BACKUP.VERIFY, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 5,
    });
    this.logger.log(`Backup verify job added for run ${data.runId}, archive: ${data.archivePath}`);
  }

  async addInventoryIngest(data: {
    orgId: string;
    deviceId: string;
    drivers: any[];
    software: any[];
    reportType?: string;
    reportVersion?: string;
    collectedAt?: string;
    payloadHash?: string;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.INVENTORY);
    const enriched = this.attachCorrelation(data);
    const jobId = data.payloadHash
      ? `inventory-${data.deviceId}-${data.payloadHash}`
      : undefined;
    await queue.add(JOB_NAMES.INVENTORY.INGEST, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 6,
      jobId,
    });
    this.logger.log(`Inventory ingest job added for device ${data.deviceId}`);
  }

  async addSecurityScanComplete(data: {
    scanId: string;
    orgId: string;
    deviceId: string;
    score: any;
    findingCount: number;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.SECURITY);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.SECURITY.SCAN_COMPLETE, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 2,
    });
    this.logger.log(`Security scan complete job added for scan ${data.scanId}`);
  }

  async addSecurityFindingAlert(data: {
    findingId: string;
    orgId: string;
    deviceId: string;
    severity: string;
    finding: string;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.SECURITY);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.SECURITY.FINDING_ALERT, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: data.severity === 'critical' ? 1 : 2,
    });
    this.logger.log(`Security finding alert job added for finding ${data.findingId}`);
  }

  async addRetentionEnforce(data: {
    orgId?: string;
    allOrgs: boolean;
    requestedBy?: string;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.RETENTION);
    const enriched = this.attachCorrelation(data);
    await queue.add(JOB_NAMES.RETENTION.ENFORCE, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 8,
    });
    this.logger.log(`Retention enforce job added (allOrgs: ${data.allOrgs})`);
  }

  async addKbEmbedding(data: { orgId: string; articleId: string }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.KB_EMBEDDING);
    const enriched = this.attachCorrelation({
      ...data,
      _dedupKey: `kb-embed-${data.articleId}`,
    });
    await queue.add(JOB_NAMES.KB_EMBEDDING.EMBED, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 3,
      jobId: `kb-embed-${data.articleId}`,
    });
    this.logger.log(`KB embedding job added for article ${data.articleId}`);
  }

  async addPresenceSweep(data: { allOrgs: boolean; scheduledAt?: string }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.MONITORING);
    const enriched = this.attachCorrelation(data);
    const minuteKey = new Date().toISOString().slice(0, 16).replace(':', '-');
    await queue.add(JOB_NAMES.MONITORING.PRESENCE_SWEEP, enriched, {
      ...DEFAULT_JOB_OPTIONS,
      priority: 10,
      jobId: `presence-sweep-${minuteKey}`,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 20 },
    });
    this.logger.log(`Presence sweep job added (allOrgs: ${data.allOrgs})`);
  }

  async addTransactionalEmail(data: {
    templateId: string;
    encryptedPayload: string;
    recipientHash: string;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<void> {
    const queue = this.getQueue(QUEUE_NAMES.TRANSACTIONAL_EMAIL);
    const jobData = {
      ...data,
      _correlation: {
        requestId: getCorrelationContext()?.requestId || '',
        correlationId: data.correlationId,
        traceId: getCorrelationContext()?.traceId,
        userId: getCorrelationContext()?.userId,
        orgId: getCorrelationContext()?.orgId,
      },
    };
    const jobId = `txmail-${createHash('sha256').update(data.idempotencyKey).digest('hex').slice(0, 16)}`;
    await queue.add(JOB_NAMES.TRANSACTIONAL_EMAIL.SEND, jobData, {
      ...DEFAULT_JOB_OPTIONS,
      attempts: 5,
      backoff: { type: 'exponential' as const, delay: 2000 },
      jobId,
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 100 },
    });
    this.logger.log(`Transactional email job added`, {
      queueName: QUEUE_NAMES.TRANSACTIONAL_EMAIL,
      jobId,
    });
  }

  async getQueueDepth(name: QueueName): Promise<number> {
    const queue = this.getQueue(name);
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
    return (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
  }

  async getAllQueueDepths(): Promise<Record<string, number>> {
    const depths: Record<string, number> = {};
    for (const name of Object.values(QUEUE_NAMES)) {
      depths[name] = await this.getQueueDepth(name);
    }
    return depths;
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing all queues...');
    const closePromises: Promise<void>[] = [];
    for (const [name, queue] of this.queues) {
      closePromises.push(
        queue.close().then(() => {
          this.logger.log(`Queue "${name}" closed`);
        }),
      );
    }
    await Promise.all(closePromises);
    this.logger.log('All queues closed');
  }
}

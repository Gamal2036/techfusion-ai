import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface RetentionPolicyInput {
  metricsRetentionDays?: number;
  recordingsRetentionDays?: number;
  auditRetentionDays?: number;
  securityScanRetentionDays?: number;
  backupRetentionDays?: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private prisma: PrismaService) {}

  async getPolicy(orgId: string) {
    let policy = await this.prisma.dataRetentionPolicy.findUnique({ where: { orgId } });
    if (!policy) {
      policy = await this.prisma.dataRetentionPolicy.create({
        data: { orgId },
      });
    }
    return policy;
  }

  async updatePolicy(orgId: string, input: RetentionPolicyInput) {
    const existing = await this.prisma.dataRetentionPolicy.findUnique({ where: { orgId } });
    if (!existing) {
      return this.prisma.dataRetentionPolicy.create({
        data: { orgId, ...input },
      });
    }
    return this.prisma.dataRetentionPolicy.update({
      where: { orgId },
      data: input,
    });
  }

  /**
   * Enforce retention policies for a specific org.
   * Returns summary of deleted records.
   */
  async enforceOrgRetention(orgId: string): Promise<{
    metricsDeleted: number;
    healthScoresDeleted: number;
    recordingsCleared: number;
    auditDeleted: number;
    securityScansDeleted: number;
    backupRunsDeleted: number;
  }> {
    const policy = await this.getPolicy(orgId);
    const now = new Date();

    const results = {
      metricsDeleted: 0,
      healthScoresDeleted: 0,
      recordingsCleared: 0,
      auditDeleted: 0,
      securityScansDeleted: 0,
      backupRunsDeleted: 0,
    };

    // 1. Purge old device metrics
    if (policy.metricsRetentionDays > 0) {
      const cutoff = new Date(now.getTime() - policy.metricsRetentionDays * 24 * 60 * 60 * 1000);
      const del = await this.prisma.deviceMetric.deleteMany({
        where: { orgId, recordedAt: { lt: cutoff } },
      });
      results.metricsDeleted = del.count;

      const hsDel = await this.prisma.deviceHealthScore.deleteMany({
        where: { orgId, calculatedAt: { lt: cutoff } },
      });
      results.healthScoresDeleted = hsDel.count;
    }

    // 2. Clear recording paths for old sessions (keep session record, clear recording data)
    if (policy.recordingsRetentionDays > 0) {
      const cutoff = new Date(now.getTime() - policy.recordingsRetentionDays * 24 * 60 * 60 * 1000);
      const recUpdate = await this.prisma.remoteSession.updateMany({
        where: { orgId, startedAt: { lt: cutoff }, recordingPath: { not: null } },
        data: {
          recordingPath: null,
          recordingSize: null,
          recordingDuration: null,
        },
      });
      results.recordingsCleared = recUpdate.count;
    }

    // 3. Purge old audit logs
    if (policy.auditRetentionDays > 0) {
      const cutoff = new Date(now.getTime() - policy.auditRetentionDays * 24 * 60 * 60 * 1000);
      const del = await this.prisma.auditLog.deleteMany({
        where: { orgId, createdAt: { lt: cutoff } },
      });
      results.auditDeleted = del.count;
    }

    // 4. Purge old security scans and findings
    if (policy.securityScanRetentionDays > 0) {
      const cutoff = new Date(now.getTime() - policy.securityScanRetentionDays * 24 * 60 * 60 * 1000);
      // Findings cascade-delete with scans, so just delete scans
      const del = await this.prisma.securityScan.deleteMany({
        where: { orgId, startedAt: { lt: cutoff } },
      });
      results.securityScansDeleted = del.count;
    }

    // 5. Purge old backup runs
    if (policy.backupRetentionDays > 0) {
      const cutoff = new Date(now.getTime() - policy.backupRetentionDays * 24 * 60 * 60 * 1000);
      const del = await this.prisma.backupRun.deleteMany({
        where: { orgId, startedAt: { lt: cutoff } },
      });
      results.backupRunsDeleted = del.count;
    }

    this.logger.log(`Retention enforced for org ${orgId}: ${JSON.stringify(results)}`);
    return results;
  }

  /**
   * Enforce retention policies for ALL orgs.
   * Called by scheduled job.
   */
  async enforceAllRetention(): Promise<{
    orgsProcessed: number;
    totalDeleted: Record<string, number>;
  }> {
    const totalDeleted: Record<string, number> = {
      metricsDeleted: 0,
      healthScoresDeleted: 0,
      recordingsCleared: 0,
      auditDeleted: 0,
      securityScansDeleted: 0,
      backupRunsDeleted: 0,
    };
    let orgsProcessed = 0;

    const orgs = await this.prisma.organization.findMany({
      select: { id: true },
    });

    for (const org of orgs) {
      try {
        const result = await this.enforceOrgRetention(org.id);
        totalDeleted.metricsDeleted += result.metricsDeleted;
        totalDeleted.healthScoresDeleted += result.healthScoresDeleted;
        totalDeleted.recordingsCleared += result.recordingsCleared;
        totalDeleted.auditDeleted += result.auditDeleted;
        totalDeleted.securityScansDeleted += result.securityScansDeleted;
        totalDeleted.backupRunsDeleted += result.backupRunsDeleted;
        orgsProcessed++;
      } catch (err: any) {
        this.logger.error(`Retention enforcement failed for org ${org.id}: ${err.message}`);
      }
    }

    this.logger.log(`Retention enforced for ${orgsProcessed} orgs: ${JSON.stringify(totalDeleted)}`);
    return { orgsProcessed, totalDeleted };
  }
}

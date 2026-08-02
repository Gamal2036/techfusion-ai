import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import * as fs from 'fs';
import * as path from 'path';

const VALID_BACKUP_TYPES = ['file', 'full_image', 'database', 'config'];

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {}

  async createJob(orgId: string, data: { deviceId: string; name: string; type?: string; schedule?: string; sourcePaths?: string[]; destination?: string; retention?: number; compression?: boolean }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Job name is required');
    }
    if (!data.deviceId) {
      throw new BadRequestException('Device ID is required');
    }

    const device = await this.prisma.device.findFirst({ where: { id: data.deviceId, orgId }, select: { id: true } });
    if (!device) {
      throw new ForbiddenException('Device does not belong to this organization');
    }

    if (data.sourcePaths && data.sourcePaths.length > 0) {
      const invalid = data.sourcePaths.filter((p) => !p.startsWith('/'));
      if (invalid.length > 0) {
        throw new BadRequestException(`Invalid source paths (must be absolute): ${invalid.join(', ')}`);
      }
    }

    const jobType = data.type || 'file';
    if (!VALID_BACKUP_TYPES.includes(jobType)) {
      throw new BadRequestException(`Invalid backup type: ${jobType}. Supported: ${VALID_BACKUP_TYPES.join(', ')}`);
    }

    const job = await this.prisma.backupJob.create({
      data: {
        orgId,
        deviceId: data.deviceId,
        name: data.name.trim(),
        type: jobType,
        schedule: data.schedule || null,
        sourcePaths: data.sourcePaths ? JSON.stringify(data.sourcePaths) : null,
        destination: data.destination || null,
        retention: data.retention ?? 7,
        compression: data.compression ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        action: 'backup_job_created',
        actorId: 'system',
        details: { jobId: job.id, jobName: job.name, jobType, deviceId: data.deviceId },
      },
    }).catch((e) => this.logger.warn('Failed to create audit log:', e));

    return job;
  }

  async listJobs(orgId: string, deviceId?: string) {
    const where: any = { orgId };
    if (deviceId) where.deviceId = deviceId;
    return this.prisma.backupJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
  }

  async getJob(orgId: string, jobId: string) {
    const job = await this.prisma.backupJob.findFirst({
      where: { id: jobId, orgId },
      include: { runs: { orderBy: { startedAt: 'desc' }, take: 20 } },
    });
    if (!job) throw new NotFoundException('Backup job not found');
    return job;
  }

  async updateJob(orgId: string, jobId: string, data: any) {
    const job = await this.prisma.backupJob.findFirst({ where: { id: jobId, orgId } });
    if (!job) throw new NotFoundException('Backup job not found');
    const updated = await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        ...data,
        sourcePaths: data.sourcePaths ? JSON.stringify(data.sourcePaths) : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        action: 'backup_job_updated',
        actorId: 'system',
        details: { jobId, changes: Object.keys(data) },
      },
    }).catch((e) => this.logger.warn('Failed to create audit log:', e));

    return updated;
  }

  async deleteJob(orgId: string, jobId: string) {
    const job = await this.prisma.backupJob.findFirst({ where: { id: jobId, orgId } });
    if (!job) throw new NotFoundException('Backup job not found');
    await this.prisma.backupJob.delete({ where: { id: jobId } });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        action: 'backup_job_deleted',
        actorId: 'system',
        details: { jobId, jobName: job.name },
      },
    }).catch((e) => this.logger.warn('Failed to create audit log:', e));

    return { deleted: true };
  }

  async triggerRun(orgId: string, jobId: string) {
    const job = await this.prisma.backupJob.findFirst({ where: { id: jobId, orgId } });
    if (!job) throw new NotFoundException('Backup job not found');

    if (!job.isEnabled) {
      throw new BadRequestException('Backup job is disabled');
    }

    const device = await this.prisma.device.findFirst({ where: { id: job.deviceId, orgId }, select: { id: true } });
    if (!device) {
      throw new ForbiddenException('Device associated with this job no longer belongs to this organization');
    }

    const run = await this.prisma.backupRun.create({
      data: {
        jobId: job.id,
        orgId,
        deviceId: job.deviceId,
        status: 'pending',
        type: job.type,
        sourcePaths: job.sourcePaths,
      },
    });

    await this.queueService.addBackupExecution({
      runId: run.id,
      jobId: job.id,
      orgId,
      deviceId: job.deviceId,
      type: job.type,
      sourcePaths: job.sourcePaths,
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        action: 'backup_run_triggered',
        actorId: 'system',
        details: { runId: run.id, jobId, jobName: job.name },
      },
    }).catch((e) => this.logger.warn('Failed to create audit log:', e));

    return run;
  }

  async listRuns(orgId: string, jobId?: string, limit = 20) {
    const where: any = { orgId };
    if (jobId) where.jobId = jobId;
    return this.prisma.backupRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async getRun(orgId: string, runId: string) {
    const run = await this.prisma.backupRun.findFirst({ where: { id: runId, orgId } });
    if (!run) throw new NotFoundException('Backup run not found');
    return run;
  }

  async getRestorePoints(orgId: string, deviceId: string) {
    const runs = await this.prisma.backupRun.findMany({
      where: { orgId, deviceId, status: 'completed' },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { job: { select: { name: true, type: true } } },
    });
    return runs;
  }

  async restoreRun(orgId: string, runId: string) {
    const run = await this.prisma.backupRun.findFirst({ where: { id: runId, orgId, status: 'completed' } });
    if (!run) throw new NotFoundException('Completed backup run not found for restore');

    const restoreType = run.type === 'file' ? 'file' : 'restore-postgres';
    const destPath = process.env.BACKUP_RESTORE_DEST || '/tmp/techfusion-recovery';

    await this.queueService.addBackupRestore({
      runId: run.id,
      orgId,
      deviceId: run.deviceId || '',
      type: restoreType,
      destPath,
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        action: 'backup_restore_queued',
        actorId: 'system',
        details: { runId, jobId: run.jobId, restoreType, destPath },
      },
    }).catch((e) => this.logger.warn('Failed to create audit log:', e));

    return {
      status: 'queued' as const,
      message: `Restore job queued (${restoreType}${restoreType === 'file' ? ', non-destructive' : ''})`,
      runId: run.id,
      jobId: run.jobId,
      type: run.type,
      startedAt: new Date().toISOString(),
      details: {
        filesRestored: 0,
        sizeBytes: 0,
        destination: destPath,
      },
    };
  }

  async verifyRun(orgId: string, runId: string) {
    const run = await this.prisma.backupRun.findFirst({ where: { id: runId, orgId, status: 'completed' } });
    if (!run) throw new NotFoundException('Completed backup run not found for verification');

    const metadata = (run.metadata as any) || {};
    const archivePath = metadata?.backupPath;
    if (!archivePath) {
      throw new BadRequestException('No backup archive path found for this run');
    }

    if (!fs.existsSync(archivePath)) {
      throw new BadRequestException(`Backup archive not found on disk: ${archivePath}`);
    }

    const deviceId = run.deviceId || '';
    await this.queueService.addBackupVerify({
      runId: run.id,
      orgId,
      deviceId,
      archivePath,
    });

    await this.prisma.auditLog.create({
      data: {
        orgId,
        action: 'backup_verify_queued',
        actorId: 'system',
        details: { runId, jobId: run.jobId, archivePath },
      },
    }).catch((e) => this.logger.warn('Failed to create audit log:', e));

    return {
      status: 'queued' as const,
      message: 'Verification job queued',
      runId: run.id,
      jobId: run.jobId,
    };
  }

  async getArtifact(orgId: string, runId: string, res: any) {
    const run = await this.prisma.backupRun.findFirst({ where: { id: runId, orgId } });
    if (!run) throw new NotFoundException('Backup run not found');

    const metadata = (run.metadata as any) || {};
    const archivePath = metadata?.backupPath;
    if (!archivePath) {
      throw new NotFoundException('No backup artifact for this run');
    }

    if (!fs.existsSync(archivePath)) {
      throw new NotFoundException('Backup artifact file not found on disk');
    }

    const fileName = path.basename(archivePath);
    const stat = fs.statSync(archivePath);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(archivePath);
    stream.pipe(res);
  }

  async enforceRetention(orgId: string) {
    const policy = await this.prisma.dataRetentionPolicy.findUnique({ where: { orgId } });
    if (!policy || policy.backupRetentionDays <= 0) return { deleted: 0 };

    const cutoff = new Date(Date.now() - policy.backupRetentionDays * 86400000);
    const oldRuns = await this.prisma.backupRun.findMany({
      where: { orgId, startedAt: { lt: cutoff } },
      select: { id: true, metadata: true },
    });

    if (oldRuns.length === 0) return { deleted: 0 };

    for (const run of oldRuns) {
      const meta = run.metadata as any;
      const backupPath = meta?.backupPath;
      if (backupPath && typeof backupPath === 'string') {
        try {
          const fs = require('fs');
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            this.logger.log(`Deleted backup artifact: ${backupPath}`);
          }
          const shaPath = backupPath + '.sha256';
          if (fs.existsSync(shaPath)) {
            fs.unlinkSync(shaPath);
          }
        } catch (e) {
          this.logger.warn(`Failed to delete backup artifact ${backupPath}: ${e}`);
        }
      }
    }

    await this.prisma.backupRun.deleteMany({ where: { id: { in: oldRuns.map((r) => r.id) } } });

    this.logger.log(`Retention enforced: deleted ${oldRuns.length} old backup runs for org ${orgId}`);

    await this.prisma.auditLog.create({
      data: {
        orgId,
        action: 'retention_enforced',
        actorId: 'system',
        details: { deletions: oldRuns.length },
      },
    }).catch((e) => this.logger.warn('Failed to create audit log:', e));

    return { deleted: oldRuns.length };
  }
}

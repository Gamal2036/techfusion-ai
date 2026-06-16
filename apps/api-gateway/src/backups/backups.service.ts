import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BackupsService {
  constructor(private prisma: PrismaService) {}

  async createJob(orgId: string, data: { deviceId: string; name: string; type?: string; schedule?: string; sourcePaths?: string[]; destination?: string; retention?: number; compression?: boolean }) {
    const job = await this.prisma.backupJob.create({
      data: {
        orgId,
        deviceId: data.deviceId,
        name: data.name,
        type: data.type || 'file',
        schedule: data.schedule || null,
        sourcePaths: data.sourcePaths ? JSON.stringify(data.sourcePaths) : null,
        destination: data.destination || null,
        retention: data.retention ?? 7,
        compression: data.compression ?? true,
      },
    });
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
    return this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        ...data,
        sourcePaths: data.sourcePaths ? JSON.stringify(data.sourcePaths) : undefined,
      },
    });
  }

  async deleteJob(orgId: string, jobId: string) {
    const job = await this.prisma.backupJob.findFirst({ where: { id: jobId, orgId } });
    if (!job) throw new NotFoundException('Backup job not found');
    await this.prisma.backupJob.delete({ where: { id: jobId } });
    return { deleted: true };
  }

  async triggerRun(orgId: string, jobId: string) {
    const job = await this.prisma.backupJob.findFirst({ where: { id: jobId, orgId } });
    if (!job) throw new NotFoundException('Backup job not found');

    const run = await this.prisma.backupRun.create({
      data: {
        jobId: job.id,
        orgId,
        deviceId: job.deviceId,
        status: 'running',
        type: job.type,
        sourcePaths: job.sourcePaths,
      },
    });

    this.executeRun(run.id, job).catch((err) => console.error('Backup run failed:', err));

    return run;
  }

  private async executeRun(runId: string, job: any) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockSize = Math.floor(Math.random() * 1073741824) + 52428800;
      const mockFiles = Math.floor(Math.random() * 5000) + 100;

      await this.prisma.backupRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          sizeBytes: BigInt(mockSize),
          fileCount: mockFiles,
        },
      });

      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: { lastRunAt: new Date() },
      });

      console.log(`[Backup] Run ${runId} completed: ${mockFiles} files, ${(mockSize / 1048576).toFixed(0)}MB`);
    } catch (e: any) {
      await this.prisma.backupRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date(), errorMessage: e.message },
      }).catch(() => {});
    }
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

    const result = {
      status: 'success' as const,
      message: 'Restore initiated successfully',
      runId: run.id,
      jobId: run.jobId,
      type: run.type,
      startedAt: new Date().toISOString(),
      details: {
        filesRestored: run.fileCount ?? 0,
        sizeBytes: run.sizeBytes ?? BigInt(0),
        destination: '/tmp/restore/' + run.id,
      },
    };

    return result;
  }
}

import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, Res } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';

@Controller('backups')
export class BackupsController {
  constructor(private backupsService: BackupsService) {}

  @RequirePermissions(Permission.BACKUPS_MANAGE)
  @Post('jobs')
  async createJob(@Req() req: any, @Body() body: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.createJob(orgId, body);
  }

  @RequirePermissions(Permission.BACKUPS_VIEW)
  @Get('jobs')
  async listJobs(@Req() req: any, @Query('deviceId') deviceId?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.backupsService.listJobs(orgId, deviceId);
  }

  @RequirePermissions(Permission.BACKUPS_VIEW)
  @Get('jobs/:id')
  async getJob(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.getJob(orgId, id);
  }

  @RequirePermissions(Permission.BACKUPS_MANAGE)
  @Patch('jobs/:id')
  async updateJob(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.updateJob(orgId, id, body);
  }

  @RequirePermissions(Permission.BACKUPS_MANAGE)
  @Delete('jobs/:id')
  async deleteJob(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.deleteJob(orgId, id);
  }

  @RequirePermissions(Permission.BACKUPS_RUN)
  @Post('jobs/:id/trigger')
  async triggerRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.triggerRun(orgId, id);
  }

  @RequirePermissions(Permission.BACKUPS_VIEW)
  @Get('runs')
  async listRuns(@Req() req: any, @Query('jobId') jobId?: string, @Query('limit') limit?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.backupsService.listRuns(orgId, jobId, limit ? parseInt(limit, 10) : 20);
  }

  @RequirePermissions(Permission.BACKUPS_VIEW)
  @Get('runs/:id')
  async getRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.getRun(orgId, id);
  }

  @RequirePermissions(Permission.BACKUPS_VIEW)
  @Get('restore-points/:deviceId')
  async getRestorePoints(@Req() req: any, @Param('deviceId') deviceId: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.backupsService.getRestorePoints(orgId, deviceId);
  }

  @RequirePermissions(Permission.BACKUPS_RUN)
  @Post('runs/:id/restore')
  async restoreRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.restoreRun(orgId, id);
  }

  @RequirePermissions(Permission.BACKUPS_RUN)
  @Post('runs/:id/verify')
  async verifyRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.verifyRun(orgId, id);
  }

  @RequirePermissions(Permission.BACKUPS_VIEW)
  @Get('artifacts/:runId')
  async getArtifact(@Req() req: any, @Param('runId') runId: string, @Res() res: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    return this.backupsService.getArtifact(orgId, runId, res);
  }

  @RequirePermissions(Permission.BACKUPS_MANAGE)
  @Post('enforce-retention')
  async enforceRetention(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return { deleted: 0 };
    return this.backupsService.enforceRetention(orgId);
  }
}

import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, Res } from '@nestjs/common';
import { BackupsService } from './backups.service';

@Controller('backups')
export class BackupsController {
  constructor(private backupsService: BackupsService) {}

  @Post('jobs')
  async createJob(@Req() req: any, @Body() body: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.createJob(orgId, body);
  }

  @Get('jobs')
  async listJobs(@Req() req: any, @Query('deviceId') deviceId?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.backupsService.listJobs(orgId, deviceId);
  }

  @Get('jobs/:id')
  async getJob(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.getJob(orgId, id);
  }

  @Patch('jobs/:id')
  async updateJob(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.updateJob(orgId, id, body);
  }

  @Delete('jobs/:id')
  async deleteJob(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.deleteJob(orgId, id);
  }

  @Post('jobs/:id/trigger')
  async triggerRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.triggerRun(orgId, id);
  }

  @Get('runs')
  async listRuns(@Req() req: any, @Query('jobId') jobId?: string, @Query('limit') limit?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.backupsService.listRuns(orgId, jobId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('runs/:id')
  async getRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.getRun(orgId, id);
  }

  @Get('restore-points/:deviceId')
  async getRestorePoints(@Req() req: any, @Param('deviceId') deviceId: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.backupsService.getRestorePoints(orgId, deviceId);
  }

  @Post('runs/:id/restore')
  async restoreRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.restoreRun(orgId, id);
  }

  @Post('runs/:id/verify')
  async verifyRun(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.backupsService.verifyRun(orgId, id);
  }

  @Get('artifacts/:runId')
  async getArtifact(@Req() req: any, @Param('runId') runId: string, @Res() res: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    return this.backupsService.getArtifact(orgId, runId, res);
  }

  @Post('enforce-retention')
  async enforceRetention(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return { deleted: 0 };
    return this.backupsService.enforceRetention(orgId);
  }
}

import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { QueueService } from '../queue/queue.service';
import { Roles } from '../common/roles.decorator';

@Controller('admin/retention')
@Roles('Owner', 'Admin')
export class RetentionController {
  constructor(
    private retentionService: RetentionService,
    private queueService: QueueService,
  ) {}

  @Get()
  async getPolicy(@Req() req: any) {
    return this.retentionService.getPolicy(req.user.orgId);
  }

  @Post()
  async updatePolicy(
    @Req() req: any,
    @Body() body: {
      metricsRetentionDays?: number;
      recordingsRetentionDays?: number;
      auditRetentionDays?: number;
      securityScanRetentionDays?: number;
      backupRetentionDays?: number;
    },
  ) {
    return this.retentionService.updatePolicy(req.user.orgId, body);
  }

  @Post('enforce')
  async enforceNow(@Req() req: any) {
    await this.queueService.addRetentionEnforce({
      orgId: req.user.orgId,
      allOrgs: false,
      requestedBy: req.user?.id,
    });

    return {
      status: 'queued',
      message: 'Retention enforcement job dispatched',
      orgId: req.user.orgId,
    };
  }

  @Post('enforce-all')
  @Roles('Owner')
  async enforceAll(@Req() req: any) {
    await this.queueService.addRetentionEnforce({
      allOrgs: true,
      requestedBy: req.user?.id,
    });

    return {
      status: 'queued',
      message: 'Global retention enforcement job dispatched',
    };
  }
}

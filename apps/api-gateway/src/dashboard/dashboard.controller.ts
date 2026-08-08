import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @RequirePermissions(Permission.MONITORING_VIEW)
  @Get('summary')
  getSummary(@Req() req: any) {
    return this.dashboardService.getSummary(req.user.orgId);
  }
}

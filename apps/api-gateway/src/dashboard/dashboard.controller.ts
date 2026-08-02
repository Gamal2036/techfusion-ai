import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Req() req: any) {
    return this.dashboardService.getSummary(req.user.orgId);
  }
}

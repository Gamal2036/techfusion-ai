import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { QueryAlertsDto } from './dto/query-alerts.dto';
import { Roles } from '../common/roles.decorator';

@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get('rules')
  async listRules(@Req() req: any) {
    return this.alertsService.findRulesByOrg(req.user.orgId);
  }

  @Post('rules')
  @Roles('Admin', 'Owner')
  async createRule(@Req() req: any, @Body() dto: CreateAlertRuleDto) {
    return this.alertsService.createRule(req.user.orgId, dto);
  }

  @Patch('rules/:id')
  @Roles('Admin', 'Owner')
  async updateRule(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertsService.updateRule(id, req.user.orgId, dto);
  }

  @Delete('rules/:id')
  @Roles('Admin', 'Owner')
  async deleteRule(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.deleteRule(id, req.user.orgId);
  }

  @Get()
  async listAlerts(@Req() req: any, @Query() query: QueryAlertsDto) {
    return this.alertsService.findAlertsByOrg(req.user.orgId, query);
  }

  @Get('latest')
  async getLatestAlerts(@Req() req: any) {
    return this.alertsService.getLatestAlerts(req.user.orgId, 10);
  }

  @Patch(':id/acknowledge')
  async acknowledgeAlert(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.acknowledgeAlert(id, req.user.orgId);
  }
}

import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';
import { QueryAlertsDto } from './dto/query-alerts.dto';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';

@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @RequirePermissions(Permission.ALERTS_VIEW)
  @Get('rules')
  async listRules(@Req() req: any) {
    return this.alertsService.findRulesByOrg(req.user.orgId);
  }

  @RequirePermissions(Permission.ALERT_RULES_MANAGE)
  @Post('rules')
  async createRule(@Req() req: any, @Body() dto: CreateAlertRuleDto) {
    return this.alertsService.createRule(req.user.orgId, dto);
  }

  @RequirePermissions(Permission.ALERT_RULES_MANAGE)
  @Patch('rules/:id')
  async updateRule(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertsService.updateRule(id, req.user.orgId, dto);
  }

  @RequirePermissions(Permission.ALERT_RULES_MANAGE)
  @Delete('rules/:id')
  async deleteRule(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.deleteRule(id, req.user.orgId);
  }

  @RequirePermissions(Permission.ALERTS_VIEW)
  @Get()
  async listAlerts(@Req() req: any, @Query() query: QueryAlertsDto) {
    return this.alertsService.findAlertsByOrg(req.user.orgId, query);
  }

  @RequirePermissions(Permission.ALERTS_VIEW)
  @Get('latest')
  async getLatestAlerts(@Req() req: any) {
    return this.alertsService.getLatestAlerts(req.user.orgId, 10);
  }

  @RequirePermissions(Permission.ALERTS_ACKNOWLEDGE)
  @Patch(':id/acknowledge')
  async acknowledgeAlert(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.acknowledgeAlert(id, req.user.orgId);
  }

  @RequirePermissions(Permission.ALERTS_RESOLVE)
  @Patch(':id/resolve')
  async resolveAlert(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.resolveAlert(id, req.user.orgId);
  }
}

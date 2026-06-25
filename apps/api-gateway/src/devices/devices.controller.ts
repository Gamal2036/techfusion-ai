import {
  Controller, Get, Post, Param, Query, Body, UseGuards, Req,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { MetricsPayloadDto } from './dto/metrics-payload.dto';
import { QueryMetricsDto } from './dto/query-metrics.dto';
import { DeviceTokenGuard } from './device-token.guard';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { DevicesGateway } from './devices.gateway';

@Controller('devices')
export class DevicesController {
  constructor(
    private devicesService: DevicesService,
    private devicesGateway: DevicesGateway,
  ) {}

  @Post('register')
  @UseGuards(DeviceTokenGuard)
  async register(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    const device = await this.devicesService.register(req.orgId, dto);
    return { device, deviceToken: device.deviceToken };
  }

  @Public()
  @Post('register-public')
  async registerPublic(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    const device = await this.devicesService.register(
      req.headers['x-org-id'] || '00000000-0000-0000-0000-000000000000',
      dto,
    );
    return { device, deviceToken: device.deviceToken };
  }

  @Public()
  @Post('metrics')
  @UseGuards(DeviceTokenGuard)
  async ingestMetrics(@Req() req: any, @Body() dto: MetricsPayloadDto) {
    const device = req.device;
    const result = await this.devicesService.ingestMetrics(device.id, device.orgId, dto);

    // Convert BigInts to numbers for serialization
    const safeResult = JSON.parse(JSON.stringify(result, (_, v) =>
      typeof v === 'bigint' ? Number(v) : v,
    ));

    // Push live update via WebSocket
    this.devicesGateway.broadcastMetrics(device.orgId, device.id, {
      metric: safeResult.metric,
      score: safeResult.score,
    });

    // Broadcast alerts if any were triggered
    if (safeResult.alerts && safeResult.alerts.length > 0) {
      for (const alert of safeResult.alerts) {
        this.devicesGateway.broadcastAlert(device.orgId, alert);
      }
    }

    return safeResult;
  }

  @Get()
  async listDevices(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.devicesService.findByOrg(orgId);
  }

  @Get(':id')
  async getDevice(@Req() req: any, @Param('id') id: string) {
    return this.devicesService.findById(id, req.user.orgId);
  }

  @Get(':id/metrics')
  async getMetrics(
    @Req() req: any,
    @Param('id') id: string,
    @Query() query: QueryMetricsDto,
  ) {
    return this.devicesService.getMetrics(
      id,
      req.user.orgId,
      query.minutes,
      query.limit,
    );
  }

  @Get(':id/scores')
  async getScores(@Req() req: any, @Param('id') id: string) {
    return this.devicesService.getLatestScores(id, req.user.orgId);
  }

  @Get(':id/latest')
  async getLatest(@Req() req: any, @Param('id') id: string) {
    const [device, metrics, scores] = await Promise.all([
      this.devicesService.findById(id, req.user.orgId),
      this.devicesService.getLatestMetrics(id, req.user.orgId),
      this.devicesService.getLatestScores(id, req.user.orgId),
    ]);
    return { device, metrics, scores };
  }
}

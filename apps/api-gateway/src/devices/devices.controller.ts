import {
  Controller, Get, Post, Delete, Param, Query, Body, UseGuards, Req, Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { MetricsPayloadDto } from './dto/metrics-payload.dto';
import { QueryMetricsDto } from './dto/query-metrics.dto';
import { DeviceTokenGuard } from './device-token.guard';
import { Public } from '../common/public.decorator';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';
import { DevicesGateway } from './devices.gateway';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { throttle } from '../config/rate-limits';
import { RegisterPublicDto } from '../enrollment/dto/register-public.dto';
import { ForbiddenException } from '@nestjs/common';
import { derivePresenceState } from './device-presence-state';

@Controller('devices')
export class DevicesController {
  private readonly logger = new Logger(DevicesController.name);

  constructor(
    private devicesService: DevicesService,
    private devicesGateway: DevicesGateway,
    private enrollmentService: EnrollmentService,
  ) {}

  @Post('register')
  @UseGuards(DeviceTokenGuard)
  async register(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    const result = await this.devicesService.register(req.orgId, dto);
    return { device: result.device, deviceToken: result.deviceToken };
  }

  @Public()
  @Throttle(throttle(10, 60000))
  @Post('register-public')
  async registerPublic(@Req() req: any, @Body() dto: RegisterPublicDto) {
    let orgId: string;

    if (dto.enrollmentToken) {
      orgId = await this.enrollmentService.validateToken(dto.enrollmentToken);
    } else {
      return {
        error: 'Enrollment token is required. Contact your organization admin to obtain one.',
        code: 'ENROLLMENT_REQUIRED',
      };
    }

    const result = await this.devicesService.registerPublic(orgId, dto);
    return {
      device: result.device,
      deviceToken: result.deviceToken,
      duplicate: result.duplicate,
    };
  }

  @Public()
  @Throttle(throttle(5, 60000))
  @Post('recover-credential')
  async recoverCredential(@Req() req: any, @Body() body: { identityFingerprint?: string; installationId?: string; hostname?: string; deviceId?: string }) {
    if (!body.identityFingerprint && !body.installationId) {
      return {
        error: 'Credential recovery requires a strong device identity (identityFingerprint or installationId). Hostname/deviceId alone cannot authorize a credential rotation.',
        code: 'IDENTITY_REQUIRED',
      };
    }

    const orgToken = req.headers['x-org-token'] as string;
    if (!orgToken) {
      return {
        error: 'Organization token (x-org-token) is required for credential recovery.',
        code: 'ORG_TOKEN_REQUIRED',
      };
    }

    let orgId: string;
    try {
      orgId = await this.enrollmentService.validateToken(orgToken);
    } catch {
      return {
        error: 'Invalid or expired organization token.',
        code: 'INVALID_ORG_TOKEN',
      };
    }

    const where: any = { orgId };
    if (body.identityFingerprint) where.identityFingerprint = body.identityFingerprint;
    else where.installationId = body.installationId;

    const device = await this.devicesService['findFirstOrNull'](where);
    if (!device) {
      return {
        error: 'No device found matching the provided identity attributes.',
        code: 'DEVICE_NOT_FOUND',
      };
    }

    const rotated = await this.devicesService.rotateCredential(
      device.id,
      orgId,
      'recovery',
      { recoveryMethod: 'credential_recovery_endpoint' },
    );

    return {
      device: {
        id: rotated.device.id,
        name: rotated.device.name,
        hostname: rotated.device.hostname,
      },
      deviceToken: rotated.newToken,
    };
  }

  @Public()
  @Throttle(throttle(120, 60000))
  @Post('metrics')
  @UseGuards(DeviceTokenGuard)
  async ingestMetrics(@Req() req: any, @Body() dto: MetricsPayloadDto) {
    const device = req.device;
    const previousLastSeenAt = device.lastSeenAt;
    const result = await this.devicesService.ingestMetrics(device.id, device.orgId, dto);

    const updatedLastSeenAt = result.metric?.recordedAt ?? new Date();

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[DEV_METRIC_INGEST] deviceId=${device.id} orgId=${device.orgId} ` +
        `hostname=${device.hostname} ` +
        `metricRecordedAt=${result.metric?.recordedAt?.toISOString() ?? 'N/A'} ` +
        `previousLastSeenAt=${previousLastSeenAt?.toISOString() ?? 'null'} ` +
        `updatedLastSeenAt=${updatedLastSeenAt?.toISOString() ?? 'N/A'}`
      );
    }

    this.devicesGateway.broadcastMetrics(device.orgId, device.id, {
      metric: result.metric,
      score: result.score,
      lastSeenAt: updatedLastSeenAt.toISOString(),
    });

    if (result.alerts && result.alerts.length > 0) {
      for (const alert of result.alerts) {
        this.devicesGateway.broadcastAlert(device.orgId, alert);
      }
    }

    return result;
  }

  @RequirePermissions(Permission.DEVICES_VIEW)
  @Get()
  async listDevices(@Req() req: any) {
    const orgId = req.user?.orgId;
    const userId = req.user?.sub;
    if (!orgId) return [];

    const devices = await this.devicesService.findByOrg(orgId);
    const now = new Date();
    const safe = devices.map((d: any) => ({
      id: d.id,
      orgId: d.orgId,
      name: d.name,
      hostname: d.hostname,
      os: d.os,
      osVersion: d.osVersion,
      cpuModel: d.cpuModel,
      cpuCores: d.cpuCores,
      cpuLogical: d.cpuLogical,
      ramTotal: d.ramTotal,
      gpuInfo: d.gpuInfo,
      diskTotal: d.diskTotal,
      isLaptop: d.isLaptop,
      inactive: d.inactive,
      registeredAt: d.registeredAt,
      lastSeenAt: d.lastSeenAt,
      presence: derivePresenceState(d.lastSeenAt, now),
      agentVersion: d.agentVersion,
    }));

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(
        `[DEV] GET /devices userId=${userId} orgId=${orgId} count=${safe.length} ids=${safe.map((d: any) => d.id).join(',')} hostnames=${safe.map((d: any) => d.hostname).join(',')}`
      );
    }

    return safe;
  }

  @RequirePermissions(Permission.DEVICES_VIEW)
  @Get(':id')
  async getDevice(@Req() req: any, @Param('id') id: string) {
    const device = await this.devicesService.findById(id, req.user.orgId);
    return this.sanitizeDevice(device);
  }

  @RequirePermissions(Permission.DEVICES_VIEW)
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

  @RequirePermissions(Permission.DEVICES_VIEW)
  @Get(':id/scores')
  async getScores(@Req() req: any, @Param('id') id: string) {
    return this.devicesService.getLatestScores(id, req.user.orgId);
  }

  @RequirePermissions(Permission.DEVICES_VIEW)
  @Get(':id/latest')
  async getLatest(@Req() req: any, @Param('id') id: string) {
    const [device, metrics, scores] = await Promise.all([
      this.devicesService.findById(id, req.user.orgId),
      this.devicesService.getLatestMetrics(id, req.user.orgId),
      this.devicesService.getLatestScores(id, req.user.orgId),
    ]);
    return { device: this.sanitizeDevice(device), metrics, scores };
  }

  private sanitizeDevice(device: any) {
    if (!device) return device;
    const { deviceTokenHash, metadata, ...safe } = device;
    return safe;
  }
}

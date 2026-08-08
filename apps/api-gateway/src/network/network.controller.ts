import { Controller, Get, Post, Param, Query, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NetworkService } from './network.service';
import { NetworkGateway } from './network.gateway';
import { DevicesService } from '../devices/devices.service';
import { DeviceTokenGuard } from '../devices/device-token.guard';
import { Public } from '../common/public.decorator';
import { RequirePermissions } from '../common/permissions.decorator';
import { Permission } from '../common/permissions';
import { createStructuredLogger } from '../common/structured-logger';
import { throttle } from '../config/rate-limits';

@Controller('network')
export class NetworkController {
  private readonly logger = createStructuredLogger(NetworkController.name);

  constructor(
    private networkService: NetworkService,
    private networkGateway: NetworkGateway,
    private devicesService: DevicesService,
  ) {}

  @RequirePermissions(Permission.NETWORK_SCAN_TRIGGER)
  @Post('discovery/trigger')
  async triggerDiscovery(@Req() req: any, @Body() body: { deviceId?: string }) {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return { error: 'Organization context required' };
    }
    if (body.deviceId) {
      await this.devicesService.findById(body.deviceId, orgId);
    }
    const scan = await this.networkService.createDiscoveryCommand(orgId, body.deviceId);
    return { scanId: scan.id, status: scan.status, startedAt: scan.startedAt };
  }

  @Public()
  @UseGuards(DeviceTokenGuard)
  @Throttle(throttle(30, 60000))
  @Get('discovery/pending')
  async getPendingDiscoveryCommands(@Req() req: any) {
    const device = req.device;
    await this.networkService.cleanupStaleScans();
    return this.networkService.getPendingDiscoveryCommands(device.orgId, device.id);
  }

  @Public()
  @UseGuards(DeviceTokenGuard)
  @Throttle(throttle(30, 60000))
  @Post('discovery/status')
  async updateDiscoveryStatus(
    @Req() req: any,
    @Body() body: { scanId: string; status: string },
  ) {
    if (!body.scanId || !body.status) {
      return { error: 'scanId and status required' };
    }
    const device = req.device;
    const owned = await this.networkService.getScanForDevice(body.scanId, device.orgId, device.id);
    if (!owned) {
      this.logger.warn('tenant_ingestion_denied', {
        event: 'tenant_ingestion_denied',
        orgId: device.orgId,
        deviceId: device.id,
        reason: 'scan_not_owned',
        scanId: body.scanId,
      });
      throw new ForbiddenException('Scan not found or not owned by this device');
    }
    const scan = await this.networkService.updateDiscoveryStatus(body.scanId, body.status);
    return { scanId: scan.id, status: scan.status };
  }

  @Public()
  @UseGuards(DeviceTokenGuard)
  @Throttle(throttle(30, 60000))
  @Post('discovery/result')
  async ingestDiscoveryResult(
    @Req() req: any,
    @Body() body: { scanId: string; error?: string; status?: string; completedAt?: string; devices?: any[]; gateway_ip?: string; gateway_mac?: string; local_ip?: string; local_mac?: string; subnet?: string; scan_duration_ms?: number; device_count?: number; neighbors?: any[] },
  ) {
    const device = req.device;
    const owned = await this.networkService.getScanForDevice(body.scanId, device.orgId, device.id);
    if (!owned) {
      this.logger.warn('tenant_ingestion_denied', {
        event: 'tenant_ingestion_denied',
        orgId: device.orgId,
        deviceId: device.id,
        reason: 'scan_not_owned',
        scanId: body.scanId,
      });
      throw new ForbiddenException('Scan not found or not owned by this device');
    }

    const orgId = owned.orgId;

    if (body.error) {
      const scan = await this.networkService.updateDiscoveryStatus(body.scanId, 'failed', body.error);
      const topology = await this.networkService.getTopology(orgId);
      this.networkGateway.broadcastTopology(orgId, topology);
      this.networkGateway.broadcastScanStatus(orgId, scan);
      return { scanId: scan.id, status: 'failed' };
    }

    const scan = await this.networkService.ingestDiscovery(orgId, {
      ...body,
      orgId,
    });

    await this.networkService.updateDiscoveryStatus(body.scanId, 'completed');

    const topology = await this.networkService.getTopology(orgId);
    this.networkGateway.broadcastTopology(orgId, topology);
    this.networkGateway.broadcastScanStatus(orgId, scan);

    return { scanId: body.scanId, status: 'completed', scan };
  }

  @Public()
  @UseGuards(DeviceTokenGuard)
  @Throttle(throttle(10, 60000))
  @Post('discovery')
  async ingestDiscovery(@Req() req: any, @Body() body: any) {
    const device = req.device;
    const orgId = device.orgId;

    const clientOrgId = req.headers['x-org-id'] || body?.orgId;
    if (clientOrgId && clientOrgId !== orgId) {
      this.logger.warn('tenant_ingestion_denied', {
        event: 'tenant_ingestion_denied',
        orgId,
        deviceId: device.id,
        reason: 'client_org_id_mismatch',
        clientOrgId,
      });
      throw new ForbiddenException('Organization context mismatch');
    }

    const scan = await this.networkService.ingestDiscovery(orgId, body);
    const topology = await this.networkService.getTopology(orgId);

    this.networkGateway.broadcastTopology(orgId, topology);
    this.networkGateway.broadcastScanStatus(orgId, scan);

    return { scan, topology };
  }

  @RequirePermissions(Permission.NETWORK_VIEW)
  @Get('devices')
  async listDevices(@Req() req: any, @Query('reachable') reachable?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    const reachableFilter = reachable === 'true' ? true : reachable === 'false' ? false : undefined;
    return this.networkService.getDevices(orgId, reachableFilter);
  }

  @RequirePermissions(Permission.NETWORK_VIEW)
  @Get('devices/:ip')
  async getDevice(@Req() req: any, @Param('ip') ip: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.getDeviceByIp(orgId, ip);
  }

  @RequirePermissions(Permission.NETWORK_VIEW)
  @Get('scans')
  async listScans(@Req() req: any, @Query('limit') limit?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.networkService.getScans(orgId, limit ? parseInt(limit, 10) : 20);
  }

  @RequirePermissions(Permission.NETWORK_VIEW)
  @Get('scans/latest')
  async getLatestScan(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.getLatestScan(orgId);
  }

  @RequirePermissions(Permission.NETWORK_VIEW)
  @Get('topology')
  async getTopology(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return { nodes: [], links: [], scan: null };
    return this.networkService.getTopology(orgId);
  }

  @RequirePermissions(Permission.NETWORK_SCAN_TRIGGER)
  @Post('diagnostics/latency')
  async runLatencyCheck(@Req() req: any, @Body() body: { targetIp: string; count?: number }) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.runLatencyCheck(orgId, body.targetIp, body.count ?? 4);
  }

  @RequirePermissions(Permission.NETWORK_SCAN_TRIGGER)
  @Post('diagnostics/dns')
  async resolveDns(@Req() req: any, @Body() body: { hostname: string; resolvers?: string[] }) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.resolveDns(orgId, body.hostname, body.resolvers);
  }

  @RequirePermissions(Permission.NETWORK_SCAN_TRIGGER)
  @Post('diagnostics/traceroute')
  async runTraceroute(@Req() req: any, @Body() body: { target: string }) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.runTraceroute(orgId, body.target);
  }

  @RequirePermissions(Permission.NETWORK_SCAN_TRIGGER)
  @Post('diagnostics/connectivity')
  async runConnectivityCheck(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.runConnectivityCheck(orgId);
  }
}

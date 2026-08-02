import { Controller, Get, Post, Param, Query, Body, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NetworkService } from './network.service';
import { NetworkGateway } from './network.gateway';
import { DevicesService } from '../devices/devices.service';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { throttle } from '../config/rate-limits';

@Controller('network')
export class NetworkController {
  constructor(
    private networkService: NetworkService,
    private networkGateway: NetworkGateway,
    private devicesService: DevicesService,
  ) {}

  @Roles('Owner', 'Admin', 'Technician', 'Viewer')
  @Post('discovery/trigger')
  async triggerDiscovery(@Req() req: any, @Body() body: { deviceId?: string }) {
    const orgId = req.user?.orgId;
    if (!orgId) {
      return { error: 'Organization context required' };
    }
    const scan = await this.networkService.createDiscoveryCommand(orgId, body.deviceId);
    return { scanId: scan.id, status: scan.status, startedAt: scan.startedAt };
  }

  @Public()
  @Get('discovery/pending')
  async getPendingDiscoveryCommands(@Query('deviceId') deviceId?: string) {
    await this.networkService.cleanupStaleScans();
    return this.networkService.getPendingDiscoveryCommands(deviceId || '');
  }

  @Public()
  @Post('discovery/status')
  async updateDiscoveryStatus(
    @Body() body: { scanId: string; status: string },
  ) {
    if (!body.scanId || !body.status) {
      return { error: 'scanId and status required' };
    }
    const scan = await this.networkService.updateDiscoveryStatus(body.scanId, body.status);
    return { scanId: scan.id, status: scan.status };
  }

  @Public()
  @Post('discovery/result')
  async ingestDiscoveryResult(
    @Body() body: { scanId: string; error?: string; status?: string; completedAt?: string; devices?: any[]; gateway_ip?: string; gateway_mac?: string; local_ip?: string; local_mac?: string; subnet?: string; scan_duration_ms?: number; device_count?: number; neighbors?: any[] },
  ) {
    if (body.error) {
      const scan = await this.networkService.updateDiscoveryStatus(body.scanId, 'failed', body.error);
      const orgId = scan.orgId;
      const topology = await this.networkService.getTopology(orgId);
      this.networkGateway.broadcastTopology(orgId, topology);
      this.networkGateway.broadcastScanStatus(orgId, scan);
      return { scanId: scan.id, status: 'failed' };
    }

    let orgId = '00000000-0000-0000-0000-000000000000';
    const existingScan = await this.networkService.getScanById(body.scanId);
    if (existingScan) {
      orgId = existingScan.orgId;
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
  @Throttle(throttle(10, 60000))
  @Post('discovery')
  async ingestDiscovery(@Req() req: any, @Body() body: any) {
    let orgId = req.headers['x-org-id'] || body.orgId;

    const deviceToken = body.deviceToken || req.headers['x-device-token'];
    if (deviceToken) {
      const device = await this.devicesService.findByToken(deviceToken);
      if (device) {
        orgId = device.orgId;
      }
    }

    if (!orgId) {
      orgId = '00000000-0000-0000-0000-000000000000';
    }

    const scan = await this.networkService.ingestDiscovery(orgId, body);
    const topology = await this.networkService.getTopology(orgId);

    this.networkGateway.broadcastTopology(orgId, topology);
    this.networkGateway.broadcastScanStatus(orgId, scan);

    return { scan, topology };
  }

  @Get('devices')
  async listDevices(@Req() req: any, @Query('reachable') reachable?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    const reachableFilter = reachable === 'true' ? true : reachable === 'false' ? false : undefined;
    return this.networkService.getDevices(orgId, reachableFilter);
  }

  @Get('devices/:ip')
  async getDevice(@Req() req: any, @Param('ip') ip: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.getDeviceByIp(orgId, ip);
  }

  @Get('scans')
  async listScans(@Req() req: any, @Query('limit') limit?: string) {
    const orgId = req.user?.orgId;
    if (!orgId) return [];
    return this.networkService.getScans(orgId, limit ? parseInt(limit, 10) : 20);
  }

  @Get('scans/latest')
  async getLatestScan(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.getLatestScan(orgId);
  }

  @Get('topology')
  async getTopology(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return { nodes: [], links: [], scan: null };
    return this.networkService.getTopology(orgId);
  }

  @Post('diagnostics/latency')
  async runLatencyCheck(@Req() req: any, @Body() body: { targetIp: string; count?: number }) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.runLatencyCheck(orgId, body.targetIp, body.count ?? 4);
  }

  @Post('diagnostics/dns')
  async resolveDns(@Req() req: any, @Body() body: { hostname: string; resolvers?: string[] }) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.resolveDns(orgId, body.hostname, body.resolvers);
  }

  @Post('diagnostics/traceroute')
  async runTraceroute(@Req() req: any, @Body() body: { target: string }) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.runTraceroute(orgId, body.target);
  }

  @Post('diagnostics/connectivity')
  async runConnectivityCheck(@Req() req: any) {
    const orgId = req.user?.orgId;
    if (!orgId) return null;
    return this.networkService.runConnectivityCheck(orgId);
  }
}

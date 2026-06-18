import { Controller, Get, Post, Param, Query, Body, Req } from '@nestjs/common';
import { NetworkService } from './network.service';
import { NetworkGateway } from './network.gateway';
import { Public } from '../common/public.decorator';

@Controller('network')
export class NetworkController {
  constructor(
    private networkService: NetworkService,
    private networkGateway: NetworkGateway,
  ) {}

  @Public()
  @Post('discovery')
  async ingestDiscovery(@Req() req: any, @Body() body: any) {
    // Resolve org from device token or header
    const deviceToken = body.deviceToken || req.headers['x-device-token'];
    const orgId = req.headers['x-org-id'] || body.orgId || '00000000-0000-0000-0000-000000000000';
    const scan = await this.networkService.ingestDiscovery(orgId, body);
    const topology = await this.networkService.getTopology(orgId);

    this.networkGateway.broadcastTopology(orgId, topology);

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

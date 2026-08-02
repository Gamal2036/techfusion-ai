import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NetworkDevice } from '@prisma/client';
import { execFileSync } from 'child_process';

function sanitizeTarget(value: string): string {
  if (!value || typeof value !== 'string') {
    throw new BadRequestException('Invalid target');
  }
  const sanitized = value.replace(/[^a-zA-Z0-9.\-:\/]/g, '');
  if (sanitized.length === 0 || sanitized.length > 255) {
    throw new BadRequestException('Invalid target format');
  }
  return sanitized;
}

function sanitizeHostname(value: string): string {
  if (!value || typeof value !== 'string') {
    throw new BadRequestException('Invalid hostname');
  }
  const sanitized = value.replace(/[^a-zA-Z0-9.\-]/g, '');
  if (sanitized.length === 0 || sanitized.length > 255) {
    throw new BadRequestException('Invalid hostname format');
  }
  return sanitized;
}

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const [a, b] = parts.map(Number);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  return false;
}

function parsePingLatency(stdout: string): number | null {
  const match = stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

function parseDigResult(stdout: string): { addresses: string[]; timeMs: number } {
  const addresses: string[] = [];
  let timeMs = 0;

  const queryTimeMatch = stdout.match(/Query time:\s*(\d+)/);
  if (queryTimeMatch) {
    timeMs = parseInt(queryTimeMatch[1], 10);
  }

  const lines = stdout.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(';') || trimmed === '' || trimmed.startsWith(';;')) continue;

    const ipMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (ipMatch) {
      addresses.push(ipMatch[1]);
    }
  }

  return { addresses, timeMs };
}

@Injectable()
export class NetworkService {
  private readonly logger = new Logger(NetworkService.name);

  constructor(private prisma: PrismaService) {}

  async createDiscoveryCommand(orgId: string, deviceId?: string) {
    const existingRunning = await this.prisma.networkScan.findFirst({
      where: {
        orgId,
        status: { in: ['pending', 'running'] },
        ...(deviceId && { deviceId }),
      },
    });

    if (existingRunning) {
      this.logger.log(`Discovery already in progress: ${existingRunning.id}`);
      return existingRunning;
    }

    const scan = await this.prisma.networkScan.create({
      data: {
        orgId,
        deviceId: deviceId || null,
        status: 'pending',
        startedAt: new Date(),
      },
    });

    this.logger.log(`Network discovery command ${scan.id} created for org ${orgId}`);
    return scan;
  }

  async getPendingDiscoveryCommands(deviceId: string) {
    return this.prisma.networkScan.findMany({
      where: {
        status: 'pending',
      },
      orderBy: { startedAt: 'asc' },
    });
  }

  async cleanupStaleScans() {
    const staleThreshold = new Date(Date.now() - 3 * 60 * 1000);
    const staleScans = await this.prisma.networkScan.findMany({
      where: {
        status: { in: ['pending', 'running'] },
        startedAt: { lt: staleThreshold },
      },
    });

    if (staleScans.length > 0) {
      this.logger.log(`Cleaning up ${staleScans.length} stale scans`);
      await this.prisma.networkScan.updateMany({
        where: {
          status: { in: ['pending', 'running'] },
          startedAt: { lt: staleThreshold },
        },
        data: {
          status: 'failed',
          error: 'Scan timed out — exceeded maximum allowed duration',
          completedAt: new Date(),
        },
      });
    }
  }

  async updateDiscoveryStatus(scanId: string, status: string, error?: string) {
    return this.prisma.networkScan.update({
      where: { id: scanId },
      data: {
        status,
        ...(error && { error }),
        ...(status === 'completed' || status === 'failed' ? { completedAt: new Date() } : {}),
      },
    });
  }

  async getScanById(scanId: string) {
    return this.prisma.networkScan.findUnique({
      where: { id: scanId },
    });
  }

  async ingestDiscovery(orgId: string, data: any) {
    const devices: any[] = data.devices || data.neighbors || [];

    const discoveredIps: string[] = [];

    for (const d of devices) {
      discoveredIps.push(d.ip);
      try {
        await this.prisma.networkDevice.upsert({
          where: { orgId_ip: { orgId, ip: d.ip } },
          update: {
            mac: d.mac || null,
            hostname: d.hostname || null,
            vendor: d.vendor || null,
            interface: d.interface || null,
            source: d.source || 'arp',
            reachable: d.reachable ?? false,
            latencyMs: d.latency_ms ?? null,
            metadata: d as any,
          },
          create: {
            orgId,
            ip: d.ip,
            mac: d.mac || null,
            hostname: d.hostname || null,
            vendor: d.vendor || null,
            interface: d.interface || null,
            source: d.source || 'arp',
            reachable: d.reachable ?? false,
            latencyMs: d.latency_ms ?? null,
            metadata: d as any,
          },
        });
      } catch (e) {
        console.error(`Failed to upsert network device ${d.ip}:`, e);
      }
    }

    const scan = await this.prisma.networkScan.create({
      data: {
        orgId,
        status: 'completed',
        gatewayIp: data.gateway_ip || null,
        gatewayMac: data.gateway_mac || null,
        localIp: data.local_ip || null,
        localMac: data.local_mac || null,
        subnet: data.subnet || null,
        scanDurationMs: data.scan_duration_ms || null,
        deviceCount: data.device_count || devices.length,
        discoveredIps,
      },
    });

    return scan;
  }

  async getDevices(orgId: string, reachable?: boolean) {
    const where: any = { orgId };
    if (reachable !== undefined) {
      where.reachable = reachable;
    }
    return this.prisma.networkDevice.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async getDeviceByIp(orgId: string, ip: string) {
    return this.prisma.networkDevice.findUnique({
      where: { orgId_ip: { orgId, ip } },
    });
  }

  async getScans(orgId: string, limit = 20) {
    return this.prisma.networkScan.findMany({
      where: { orgId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async getLatestScan(orgId: string) {
    return this.prisma.networkScan.findFirst({
      where: { orgId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getTopology(orgId: string) {
    const devices = await this.prisma.networkDevice.findMany({
      where: { orgId, reachable: true },
    });
    const latestScan = await this.getLatestScan(orgId);

    const nodes = devices.map((d: NetworkDevice) => ({
      id: d.ip,
      label: d.hostname || d.ip,
      ip: d.ip,
      mac: d.mac,
      vendor: d.vendor,
      hostname: d.hostname,
      reachable: d.reachable,
      latencyMs: d.latencyMs,
      isGateway: d.ip === latestScan?.gatewayIp,
      isLocal: d.ip === latestScan?.localIp,
    }));

    const gatewayIp = latestScan?.gatewayIp;
    const links: { source: string; target: string; type: string }[] = [];

    if (gatewayIp) {
      if (latestScan?.localIp) {
        links.push({ source: gatewayIp, target: latestScan.localIp, type: 'gateway' });
      }
      for (const node of nodes) {
        if (node.ip !== gatewayIp && node.ip !== latestScan?.localIp) {
          links.push({ source: gatewayIp, target: node.ip, type: 'connected' });
        }
      }
    }

    return {
      nodes,
      links,
      scan: latestScan
        ? {
            id: latestScan.id,
            subnet: latestScan.subnet,
            gatewayIp: latestScan.gatewayIp,
            localIp: latestScan.localIp,
            deviceCount: latestScan.deviceCount,
            scanDurationMs: latestScan.scanDurationMs,
            startedAt: latestScan.startedAt,
          }
        : null,
    };
  }

  async runLatencyCheck(orgId: string, targetIp: string, count = 4) {
    const sanitizedIp = sanitizeTarget(targetIp);
    if (!sanitizedIp.match(/^[a-zA-Z0-9.\-:\/]+$/)) {
      throw new BadRequestException('Invalid target IP');
    }

    const results: { seq: number; latencyMs: number | null; error?: string }[] = [];
    const clampedCount = Math.min(Math.max(1, count), 10);

    for (let i = 0; i < clampedCount; i++) {
      try {
        const stdout = execFileSync('ping', ['-c', '1', '-W', '2', sanitizedIp], {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const latency = parsePingLatency(stdout);
        results.push({ seq: i + 1, latencyMs: latency });
      } catch (e: any) {
        const stderr = e.stderr || '';
        if (stderr.includes('100% packet loss') || e.status === 1) {
          results.push({ seq: i + 1, latencyMs: null, error: 'unreachable' });
        } else if (e.killed || e.signal === 'SIGTERM') {
          results.push({ seq: i + 1, latencyMs: null, error: 'timeout' });
        } else {
          results.push({ seq: i + 1, latencyMs: null, error: 'failed' });
        }
      }
    }

    const succeeded = results.filter((r) => r.latencyMs != null);
    const avg =
      succeeded.length > 0
        ? succeeded.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / succeeded.length
        : null;
    const min = succeeded.length > 0 ? Math.min(...succeeded.map((r) => r.latencyMs ?? 0)) : null;
    const max = succeeded.length > 0 ? Math.max(...succeeded.map((r) => r.latencyMs ?? 0)) : null;
    const loss = clampedCount > 0 ? ((clampedCount - succeeded.length) / clampedCount) * 100 : 0;

    return { targetIp: sanitizedIp, results, avg, min, max, packetLoss: loss, count: clampedCount, timestamp: new Date().toISOString() };
  }

  async resolveDns(orgId: string, hostname: string, resolvers?: string[]) {
    const safeHostname = sanitizeHostname(hostname);
    const validResolvers = (resolvers || ['1.1.1.1', '8.8.8.8', '9.9.9.9'])
      .slice(0, 5)
      .map(r => sanitizeTarget(r))
      .filter(r => r.match(/^[a-zA-Z0-9.\-:\/]+$/));
    const dnsResolvers = validResolvers.length ? validResolvers : ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
    const results: { resolver: string; addresses: string[]; timeMs: number; error?: string }[] = [];

    for (const resolver of dnsResolvers) {
      try {
        const stdout = execFileSync('dig', [resolver, safeHostname, '+short'], {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const parsed = parseDigResult(stdout);
        results.push({ resolver, addresses: parsed.addresses, timeMs: parsed.timeMs });
      } catch (e: any) {
        results.push({ resolver, addresses: [], timeMs: 0, error: 'failed' });
      }
    }

    return { hostname: safeHostname, results, timestamp: new Date().toISOString() };
  }

  async runTraceroute(orgId: string, target: string) {
    const safeTarget = sanitizeTarget(target);
    const hops: { hop: number; ip: string; latencyMs: number | null }[] = [];

    try {
      const stdout = execFileSync('traceroute', ['-n', '-q', '1', '-w', '2', safeTarget], {
        timeout: 30000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('traceroute')) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const hop = parseInt(parts[0], 10);
          if (isNaN(hop)) continue;
          const ip = parts[1].replace('*', '');
          const latencyStr = parts.length > 2 ? parts[2] : '';
          const latency = latencyStr === '*' || latencyStr.includes('ms') ? null : parseFloat(latencyStr);
          if (ip && ip !== '*') {
            hops.push({ hop, ip: ip.replace(/[()]/g, ''), latencyMs: isNaN(latency ?? NaN) ? null : latency });
          }
        }
      }
    } catch (e: any) {
      if (!e.stdout) {
        throw new BadRequestException('Traceroute command not available or failed');
      }
    }

    return { target: safeTarget, hops, timestamp: new Date().toISOString() };
  }

  async runConnectivityCheck(orgId: string) {
    const endpoints = [
      { name: 'Cloudflare', host: '1.1.1.1' },
      { name: 'Google DNS', host: '8.8.8.8' },
      { name: 'Internet', host: 'google.com' },
    ];

    const results: { name: string; reachable: boolean; latencyMs: number | null; error?: string }[] = [];

    for (const ep of endpoints) {
      try {
        const stdout = execFileSync('ping', ['-c', '1', '-W', '3', ep.host], {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const latency = parsePingLatency(stdout);
        results.push({ name: ep.name, reachable: true, latencyMs: latency });
      } catch {
        results.push({ name: ep.name, reachable: false, latencyMs: null, error: 'unreachable' });
      }
    }

    return { results, timestamp: new Date().toISOString() };
  }
}

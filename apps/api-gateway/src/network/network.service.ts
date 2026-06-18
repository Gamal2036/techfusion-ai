import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class NetworkService {
  constructor(private prisma: PrismaService) {}

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

    const nodes = devices.map((d) => ({
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
    const results: { seq: number; latencyMs: number | null; error?: string }[] = [];

    for (let i = 0; i < count; i++) {
      const start = Date.now();
      try {
        const { execSync } = require('child_process');
        const stdout = execSync(`ping -c 1 -W 2 ${targetIp}`, {
          timeout: 3000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const elapsed = Date.now() - start;
        results.push({ seq: i + 1, latencyMs: elapsed });
      } catch (e: any) {
        results.push({ seq: i + 1, latencyMs: null, error: e.stderr?.trim() || 'timeout' });
      }
    }

    const succeeded = results.filter((r) => r.latencyMs != null);
    const avg =
      succeeded.length > 0
        ? succeeded.reduce((s, r) => s + (r.latencyMs ?? 0), 0) / succeeded.length
        : null;
    const min = succeeded.length > 0 ? Math.min(...succeeded.map((r) => r.latencyMs ?? 0)) : null;
    const max = succeeded.length > 0 ? Math.max(...succeeded.map((r) => r.latencyMs ?? 0)) : null;
    const loss = count > 0 ? ((count - succeeded.length) / count) * 100 : 0;

    return { targetIp, results, avg, min, max, packetLoss: loss, count, timestamp: new Date().toISOString() };
  }

  async resolveDns(orgId: string, hostname: string, resolvers?: string[]) {
    const dnsResolvers = resolvers?.length ? resolvers : ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
    const results: { resolver: string; addresses: string[]; timeMs: number; error?: string }[] = [];

    for (const resolver of dnsResolvers) {
      const start = Date.now();
      try {
        const { execSync } = require('child_process');
        const stdout = execSync(`dig @${resolver} ${hostname} +short`, {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        const elapsed = Date.now() - start;
        const addresses = stdout.trim().split('\n').filter((l: string) => l && !l.startsWith(';'));
        results.push({ resolver, addresses, timeMs: elapsed });
      } catch (e: any) {
        results.push({ resolver, addresses: [], timeMs: Date.now() - start, error: e.stderr?.trim() || 'failed' });
      }
    }

    return { hostname, results, timestamp: new Date().toISOString() };
  }

  async runTraceroute(orgId: string, target: string) {
    const hops: { hop: number; ip: string; latencyMs: number | null }[] = [];

    try {
      const { execSync } = require('child_process');
      const stdout = execSync(`traceroute -n -q 1 -w 2 ${target}`, {
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
      console.error('Traceroute failed:', e.message);
    }

    return { target, hops, timestamp: new Date().toISOString() };
  }

  async runConnectivityCheck(orgId: string) {
    const endpoints = [
      { name: 'Cloudflare', url: '1.1.1.1' },
      { name: 'Google DNS', url: '8.8.8.8' },
      { name: 'Internet', url: 'google.com' },
    ];

    const results: { name: string; reachable: boolean; latencyMs: number | null; error?: string }[] = [];

    for (const ep of endpoints) {
      const start = Date.now();
      try {
        const { execSync } = require('child_process');
        execSync(`ping -c 1 -W 3 ${ep.url}`, {
          timeout: 5000,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        results.push({ name: ep.name, reachable: true, latencyMs: Date.now() - start });
      } catch {
        results.push({ name: ep.name, reachable: false, latencyMs: null, error: 'timeout' });
      }
    }

    return { results, timestamp: new Date().toISOString() };
  }
}

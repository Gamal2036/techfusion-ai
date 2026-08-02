import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Public } from './common/public.decorator';
import { Response } from 'express';
import { PrismaService } from './prisma/prisma.service';
import { trackDbConnection, trackRedisConnection } from './metrics.interceptor';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  getHealth(): { status: string; timestamp: string; uptime: number; version: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '0.1.0',
    };
  }

  @Public()
  @Get('health/live')
  getLiveness(): { status: string; timestamp: string; uptime: number } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('health/ready')
  async getReadiness(@Res() res: Response): Promise<void> {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
    let overallStatus = 'ok';
    const start = Date.now();

    try {
      const dbStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = {
        status: 'ok',
        latencyMs: Date.now() - dbStart,
      };
      trackDbConnection('success');
    } catch (err: any) {
      checks.postgres = {
        status: 'error',
        error: err?.message || 'Connection failed',
      };
      trackDbConnection('failure');
      overallStatus = 'degraded';
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      const redisStart = Date.now();
      const Redis = (await import('ioredis')).default;
      const client = new Redis(redisUrl, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 0,
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      await client.disconnect();
      checks.redis = {
        status: 'ok',
        latencyMs: Date.now() - redisStart,
      };
      trackRedisConnection('success');
    } catch (err: any) {
      checks.redis = {
        status: 'error',
        error: err?.message || 'Connection failed',
      };
      trackRedisConnection('failure');
      overallStatus = 'degraded';
    }

    const statusCode = overallStatus === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      totalLatencyMs: Date.now() - start,
    });
  }
}

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QueueService } from '../queue/queue.service';

interface DistributedLock {
  acquire(key: string, ttlMs: number): Promise<string | null>;
  release(key: string, token: string): Promise<boolean>;
}

class RedisDistributedLock implements DistributedLock {
  private client: any | null = null;
  private readonly redisUrl: string;
  private readonly logger = new Logger(RedisDistributedLock.name);

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
  }

  private async ensureClient() {
    if (this.client) return;
    const Redis = (await import('ioredis')).default;
    this.client = new Redis(this.redisUrl, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 0,
      lazyConnect: false,
    });
    await this.client.connect();
  }

  async acquire(key: string, ttlMs: number): Promise<string | null> {
    try {
      await this.ensureClient();
      const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      const ok = await this.client.set(key, token, 'PX', ttlMs, 'NX');
      if (ok === 'OK') return token;
      return null;
    } catch (err: any) {
      this.logger.debug(`RedisDistributedLock acquire error: ${err?.message ?? 'unknown'}`);
      throw err;
    }
  }

  async release(key: string, token: string): Promise<boolean> {
    const script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    try {
      if (!this.client) return false;
      const res = await this.client.eval(script, 1, key, token);
      return res === 1;
    } catch (err: any) {
      this.logger.debug(`RedisDistributedLock release error: ${err?.message ?? 'unknown'}`);
      return false;
    }
  }
}

const SWEEP_LOCK_KEY = 'techfusion:presence-sweep:lock';
const SWEEP_LOCK_TTL_MS = 55_000;

@Injectable()
export class PresenceSweepSchedulerService {
  private readonly logger = new Logger(PresenceSweepSchedulerService.name);

  constructor(
    private readonly queueService: QueueService,
    @Optional() private readonly distributedLock?: DistributedLock,
  ) {
    if (!this.distributedLock) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.distributedLock = new RedisDistributedLock(redisUrl);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handlePresenceSweepTick(): Promise<void> {
    this.logger.debug('Presence sweep tick started');

    let token: string | null;
    try {
      token = await this.distributedLock!.acquire(SWEEP_LOCK_KEY, SWEEP_LOCK_TTL_MS);
    } catch (err) {
      this.logger.error(
        `Presence sweep lock acquisition failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return;
    }

    if (token === null) {
      this.logger.debug('Presence sweep lock already held by another instance');
      return;
    }

    try {
      await this.queueService.addPresenceSweep({
        allOrgs: true,
        scheduledAt: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `Failed to enqueue presence sweep: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    } finally {
      await this.distributedLock!.release(SWEEP_LOCK_KEY, token);
    }
  }
}

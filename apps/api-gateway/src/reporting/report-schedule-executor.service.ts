import { Injectable, Logger, UnprocessableEntityException, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ReportingService } from './reporting.service';
import { GenerateReportDto, ReportFormat, ReportType } from './dto/generate-report.dto';
import type { ReportSchedule } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';

export interface ReportScheduleExecutionResult {
  scheduleId: string;
  successfulFormats: string[];
  failedFormats: Array<{ format: string; code?: string; message: string }>;
}

export type ReportScheduleExecutionInput = Omit<ReportSchedule, 'formats' | 'deviceIds'> & {
  formats: string | string[];
  deviceIds?: string | string[];
};

// Distributed lock interface used to coordinate ownership of a schedule occurrence
// across multiple API instances. Implementations must provide an acquire method that
// returns a unique ownership token string when the lock was acquired, or null when
// the lock is already owned. The release method must only remove the lock when the
// supplied token still matches the stored owner.
interface DistributedLock {
  acquire(key: string, ttlMs: number): Promise<string | null>;
  release(key: string, token: string): Promise<boolean>;
}

// A minimal Redis-backed distributed lock that uses SET NX PX and a safe release
// Lua script to ensure ownership-safe deletion. The client is lazily initialized
// so creating the service does not immediately attempt network connections in tests.
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
    // Lua script: if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end
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

@Injectable()
export class ReportScheduleExecutorService {
  private readonly logger = new Logger(ReportScheduleExecutorService.name);
  private static readonly SYSTEM_USER_ID = 'system-scheduler';
  private static readonly SUPPORTED_FORMATS = new Set<string>([
    ReportFormat.PDF,
    ReportFormat.DOCX,
    ReportFormat.HTML,
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportingService: ReportingService,
    // Optional distributed lock implementation — tests should inject a mock. Use @Optional so
    // NestJS DI does not fail when no provider was registered for this token.
    @Optional() private readonly distributedLock?: DistributedLock,
  ) {
    // If no lock implementation was provided, create a Redis-based implementation
    // that uses REDIS_URL from the environment. We do not eagerly connect here.
    if (!this.distributedLock) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.distributedLock = new RedisDistributedLock(redisUrl);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledReportsTick(): Promise<void> {
    this.logger.debug('Scheduled report executor tick started');

    const tickNow = new Date();

    let dueSchedules;
    try {
      dueSchedules = await this.findDueSchedules(tickNow);
    } catch (error) {
      const message =
        error instanceof Error
          ? `Report schedule discovery failed: ${error.message}`
          : 'Report schedule discovery failed: unknown error';
      this.logger.error(message, undefined, ReportScheduleExecutorService.name);
      return;
    }

    if (!dueSchedules.length) {
      return;
    }

    const ids = dueSchedules.map((schedule) => schedule.id).join(',');
    this.logger.debug(
      `Due report schedules discovered: count=${dueSchedules.length} ids=${ids} now=${tickNow.toISOString()}`,
    );

    // Process each due schedule sequentially. Each schedule is independent and must
    // advance its nextRunAt (claim) before generation to avoid duplicate runs.
    for (const item of dueSchedules) {
      try {
        // processDueSchedule loads the full schedule, claims it by advancing nextRunAt,
        // executes generation only when claim succeeds, and updates lastRunAt on success.
        // It is intentionally robust: one schedule failure must not stop others.
        // Use await to process sequentially for deterministic ordering and simpler logs.
        await this.processDueSchedule(item.id, tickNow);
      } catch (err) {
        // Catch unexpected errors per-schedule so the tick continues.
        this.logger.error(
          `Unexpected processing failure for scheduleId=${item.id}: ${(err as Error)?.message ?? 'unknown'}`,
          undefined,
          ReportScheduleExecutorService.name,
        );
      }
    }
  }

  async executeScheduleGeneration(
    schedule: ReportScheduleExecutionInput,
  ): Promise<ReportScheduleExecutionResult> {
    const formats = this.parseFormats(schedule.formats);
    const deviceIds = this.parseDeviceIds(schedule.deviceIds, schedule.id);
    const result: ReportScheduleExecutionResult = {
      scheduleId: schedule.id,
      successfulFormats: [],
      failedFormats: [],
    };

    this.logger.debug(
      `Scheduled report generation starting scheduleId=${schedule.id} type=${schedule.type} formatCount=${formats.length}`,
    );

    if (!formats.length) {
      const message = 'No report formats were configured for this schedule.';
      this.logger.warn(
        `Scheduled report generation skipped because no formats were configured scheduleId=${schedule.id}`,
        undefined,
        ReportScheduleExecutorService.name,
      );
      result.failedFormats.push({ format: 'none', code: 'NO_REPORT_FORMATS', message });
      return result;
    }

    const title = this.buildScheduledTitle(schedule.type);

    for (const format of formats) {
      if (!ReportScheduleExecutorService.SUPPORTED_FORMATS.has(format)) {
        const message = `Unsupported report format: ${format}`;
        this.logger.warn(
          `Scheduled report generation unsupported format scheduleId=${schedule.id} format=${format}`,
          undefined,
          ReportScheduleExecutorService.name,
        );
        result.failedFormats.push({ format, code: 'UNSUPPORTED_FORMAT', message });
        continue;
      }

      const dto: GenerateReportDto = {
        type: schedule.type as ReportType,
        format: format as ReportFormat,
        title,
        deviceIds,
        generateAiSummary: false,
      };

      try {
        const report = await this.reportingService.generate(
          schedule.orgId,
          ReportScheduleExecutorService.SYSTEM_USER_ID,
          dto,
        );
        this.logger.debug(
          `Scheduled report generation succeeded scheduleId=${schedule.id} format=${format} reportId=${report?.id ?? 'unknown'}`,
        );
        result.successfulFormats.push(format);
      } catch (error) {
        const code = this.extractErrorCode(error);
        const message = this.extractErrorMessage(error);
        this.logger.warn(
          `Scheduled report generation failed scheduleId=${schedule.id} format=${format} code=${code ?? 'UNKNOWN'} message=${message}`,
          undefined,
          ReportScheduleExecutorService.name,
        );
        result.failedFormats.push({ format, code, message });
      }
    }

    return result;
  }

  private parseFormats(formats: string | string[] | undefined): string[] {
    if (!formats) return [];
    const items = Array.isArray(formats)
      ? formats
      : formats.split(',');
    return items
      .map((format) => format.trim().toLowerCase())
      .filter(Boolean);
  }

  private parseDeviceIds(
    deviceIds: string | string[] | undefined,
    scheduleId?: string,
  ): string[] | undefined {
    if (!deviceIds) return undefined;
    if (Array.isArray(deviceIds)) return deviceIds;
    if (typeof deviceIds !== 'string') return undefined;

    try {
      const parsed = JSON.parse(deviceIds);
      if (Array.isArray(parsed)) return parsed.map(String);
      return undefined;
    } catch {
      this.logger.warn(
        `Scheduled report generation ignored invalid deviceIds JSON scheduleId=${scheduleId ?? 'unknown'}`,
        undefined,
        ReportScheduleExecutorService.name,
      );
      return undefined;
    }
  }

  private buildScheduledTitle(type: string): string {
    const reportName = this.friendlyReportType(type);
    const date = new Date().toISOString().split('T')[0];
    return `Scheduled ${reportName} Report — ${date}`;
  }

  private friendlyReportType(type: string): string {
    switch (type) {
      case ReportType.DEVICE_HEALTH:
        return 'Device Health';
      case ReportType.SECURITY_EXECUTIVE:
        return 'Security Executive';
      case ReportType.FLEET_SUMMARY:
        return 'Fleet Summary';
      default:
        return 'Report';
    }
  }

  private extractErrorCode(error: unknown): string | undefined {
    if (error instanceof UnprocessableEntityException) {
      const response = error.getResponse();
      if (response && typeof response === 'object' && 'code' in response) {
        return String((response as any).code);
      }
    }
    if (error && typeof error === 'object' && 'code' in error) {
      return String((error as any).code);
    }
    return undefined;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof UnprocessableEntityException) {
      const response = error.getResponse();
      if (response && typeof response === 'object' && 'message' in response) {
        return String((response as any).message);
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Report generation failed';
  }

  /**
   * Calculate the next run date strictly after `from` using cron-parser.
   * Uses UTC behavior by default. If the cron expression is invalid this
   * method throws an Error which the caller must handle safely.
   */
  calculateNextRunAt(cronExpression: string, from: Date): Date {
    try {
      // cron-parser's parseExpression accepts an options object. Use UTC mode
      // (tz not supplied) and get the next occurrence strictly after `from`.
      const opts: any = { currentDate: from };
      const interval = CronExpressionParser.parse(cronExpression, opts);
      const next = interval.next();
      // CronExpression.next() returns a CronDate. Use toDate() for a native Date.
      return next.toDate();
    } catch (err) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
  }

  /**
   * Process a single due schedule by id. This will load the schedule, calculate
   * the nextRunAt (prefer preserving existing nextRunAt as the base for cadence),
   * perform a compare-and-set updateMany to advance nextRunAt (claim), and only
   * on success execute generation. lastRunAt is updated only when at least one
   * format succeeded. Failures do not roll back nextRunAt.
   */
  async processDueSchedule(scheduleId: string, tickNow: Date): Promise<void> {
    // Load full schedule
    const schedule = await this.prisma.reportSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) {
      this.logger.debug(`Schedule not found when attempting to process scheduleId=${scheduleId}`);
      return;
    }

    // Determine base date for next run calculation. Prefer existing nextRunAt to
    // preserve cadence; fall back to tickNow when missing or invalid.
    const originalNextRunAt = schedule.nextRunAt instanceof Date ? schedule.nextRunAt : tickNow;

    let calculatedNext: Date;
    try {
      calculatedNext = this.calculateNextRunAt(schedule.cron, originalNextRunAt);
    } catch (err) {
      // Invalid cron expression — log and skip generation. Do not change schedule.
      this.logger.error(
        `Invalid cron for scheduleId=${scheduleId}: cron=${schedule.cron}. Administrative correction required.`,
        undefined,
        ReportScheduleExecutorService.name,
      );
      return;
    }

    // Build deterministic lock key for this specific scheduled occurrence. Use ISO timestamp
    // to ensure distinct keys for separate occurrences.
    const occurrenceKey = `report-schedule:${schedule.id}:${originalNextRunAt.toISOString()}`;

    // Lock TTL from configuration or default to 5 minutes.
    const lockTtlMs = parseInt(process.env.REPORT_SCHEDULE_LOCK_TTL_MS || '', 10) || 5 * 60 * 1000;

    // Acquire distributed lock BEFORE claiming the schedule in the database. This
    // prevents the following bad outcome:
    //  - instance A advances nextRunAt (claim)
    //  - instance B cannot acquire a lock and therefore cannot generate
    //  - occurrence is lost because nextRunAt already moved and no one generated
    // By acquiring the lock first we ensure that when we advance nextRunAt we are
    // also the owner that will perform generation. If the lock infra is unavailable
    // we fail closed (skip generation and do not advance nextRunAt) to avoid lost occurrences.

    let lockToken: string | null = null;
    try {
      lockToken = await this.distributedLock!.acquire(occurrenceKey, lockTtlMs);
    } catch (err) {
      // Lock infrastructure failure — fail closed: skip claiming/execution but do not crash.
      this.logger.error(
        `Lock infrastructure failure for scheduleId=${scheduleId}: lock unavailable, skipping execution`,
        undefined,
        ReportScheduleExecutorService.name,
      );
      return;
    }

    if (!lockToken) {
      // Another instance owns the occurrence lock — skip generation safely.
      this.logger.debug(
        `Occurrence lock unavailable (already owned) scheduleId=${scheduleId} occurrence=${originalNextRunAt.toISOString()}`,
      );
      return;
    }

    // At this point the lock has been acquired. Log acquisition (do not log token).
    this.logger.log(
      `Occurrence lock acquired scheduleId=${scheduleId} occurrence=${originalNextRunAt.toISOString()}`,
    );

    // Now perform the compare-and-set claim in the database. If the claim fails,
    // release the lock and skip generation.
    const where: any = { id: schedule.id, isEnabled: true, nextRunAt: schedule.nextRunAt };
    const data: any = { nextRunAt: calculatedNext };

    let claimed = false;
    try {
      const res = await this.prisma.reportSchedule.updateMany({ where, data });
      if ((res as any)?.count === 1) {
        claimed = true;
        this.logger.debug(
          `Schedule claimed for execution scheduleId=${scheduleId} oldNextRunAt=${schedule.nextRunAt?.toISOString()} newNextRunAt=${calculatedNext.toISOString()}`,
        );
      } else {
        this.logger.debug(
          `Schedule claim race lost scheduleId=${scheduleId} — releasing lock and skipping occurrence`,
        );
      }
    } catch (err) {
      // DB failure during claim — release lock and skip
      this.logger.error(
        `Database claim failure for scheduleId=${scheduleId}: skipping occurrence`,
        undefined,
        ReportScheduleExecutorService.name,
      );
      claimed = false;
    }

    if (!claimed) {
      try {
        await this.distributedLock!.release(occurrenceKey, lockToken);
        this.logger.debug(`Occurrence lock released scheduleId=${scheduleId}`);
      } catch (releaseErr) {
        this.logger.debug(`Failed to release occurrence lock scheduleId=${scheduleId}`);
      }
      return;
    }

    // Execute generation as the confirmed claim owner. Ensure lock is released in finally.
    let execResult: ReportScheduleExecutionResult;
    try {
      execResult = await this.executeScheduleGeneration(schedule as any);
    } catch (err) {
      // Unexpected error during execution — log. nextRunAt remains advanced.
      this.logger.error(
        `Unexpected execution failure scheduleId=${scheduleId}: ${(err as Error)?.message ?? 'unknown'}`,
        undefined,
        ReportScheduleExecutorService.name,
      );
      // fallthrough to finally to release lock
      execResult = { scheduleId: scheduleId, successfulFormats: [], failedFormats: [] };
    } finally {
      try {
        const released = await this.distributedLock!.release(occurrenceKey, lockToken!);
        this.logger.debug(`Occurrence lock released scheduleId=${scheduleId}`);
        if (!released) {
          this.logger.debug(`Occurrence lock not released because ownership did not match scheduleId=${scheduleId}`);
        }
      } catch (err) {
        this.logger.debug(`Error releasing occurrence lock scheduleId=${scheduleId}`);
      }
    }

    const successCount = execResult.successfulFormats.length;
    const failCount = execResult.failedFormats.length;
    const outcome = successCount === 0 ? 'failed' : successCount === execResult.successfulFormats.length ? 'success' : 'partial';

    this.logger.debug(
      `Scheduled report execution result scheduleId=${scheduleId} success=${successCount} failed=${failCount} outcome=${outcome}`,
    );

    // Update lastRunAt only when at least one format succeeded
    if (successCount > 0) {
      try {
        await this.prisma.reportSchedule.update({ where: { id: scheduleId }, data: { lastRunAt: new Date() } });
      } catch (err) {
        this.logger.error(
          `Failed to update lastRunAt for scheduleId=${scheduleId}: ${(err as Error)?.message ?? 'unknown'}`,
          undefined,
          ReportScheduleExecutorService.name,
        );
      }
    }
  }

  private findDueSchedules(now: Date) {
    return this.prisma.reportSchedule.findMany({
      where: {
        isEnabled: true,
        nextRunAt: {
          not: null,
          lte: now,
        },
      },
      orderBy: [{ nextRunAt: 'asc' }, { id: 'asc' }],
      // Use a small bounded batch for discovery. Execution batching and
      // paging can be expanded in later phases when actual execution is added.
      take: 50,
      select: { id: true },
    });
  }
}

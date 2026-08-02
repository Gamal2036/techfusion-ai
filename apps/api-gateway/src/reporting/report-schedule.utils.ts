import { CronExpressionParser } from 'cron-parser';
import { ReportFormat } from './dto/generate-report.dto';
import type { ReportSchedule } from '@prisma/client';

export const SUPPORTED_REPORT_FORMATS: readonly ReportFormat[] = [
  ReportFormat.PDF,
  ReportFormat.DOCX,
  ReportFormat.HTML,
  ReportFormat.CSV,
  ReportFormat.JSON,
];

export function normalizeScheduleFormats(formats: string[]): string[] {
  return Array.from(new Set(formats.map((format) => format.trim().toLowerCase()).filter(Boolean)));
}

export function calculateNextRunAt(cronExpression: string, from: Date): Date {
  try {
    const opts = { currentDate: from };
    const interval = CronExpressionParser.parse(cronExpression, opts);
    return interval.next().toDate();
  } catch (err) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }
}

export function parseScheduleFormats(formats: string | string[]): string[] {
  if (!formats) return [];
  const items = Array.isArray(formats) ? formats : formats.split(',');
  return normalizeScheduleFormats(items);
}

export function parseScheduleDeviceIds(deviceIds: string | string[] | undefined): string[] | undefined {
  if (deviceIds === undefined || deviceIds === null) return undefined;
  if (Array.isArray(deviceIds)) return deviceIds.map(String);
  if (typeof deviceIds === 'string') {
    try {
      const parsed = JSON.parse(deviceIds);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function scheduleToResponse(schedule: ReportSchedule) {
  const formats = parseScheduleFormats(schedule.formats);
  const deviceIds = parseScheduleDeviceIds(schedule.deviceIds ?? undefined);
  return {
    id: schedule.id,
    type: schedule.type,
    formats,
    cron: schedule.cron,
    deviceIds,
    isEnabled: schedule.isEnabled,
    lastRunAt: schedule.lastRunAt,
    nextRunAt: schedule.nextRunAt,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  };
}

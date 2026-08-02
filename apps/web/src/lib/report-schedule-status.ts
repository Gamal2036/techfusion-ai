import type { ReportSchedule } from '@techfusion/types';

export type ReportScheduleStatus =
  | 'disabled'
  | 'scheduled'
  | 'never_run'
  | 'overdue'
  | 'unscheduled'
  | 'invalid';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'muted';

export interface ReportScheduleStatusMetadata {
  label: string;
  description: string;
  tone: StatusTone;
}

/**
 * Grace period before an enabled schedule is considered overdue.
 * Accounts for clock skew and processing delays.
 * 60 000 ms = 60 seconds.
 */
export const OVERDUE_GRACE_PERIOD_MS = 60_000;

export const STATUS_METADATA: Record<ReportScheduleStatus, ReportScheduleStatusMetadata> = {
  disabled: {
    label: 'Disabled',
    description: 'Automatic report generation is paused.',
    tone: 'muted',
  },
  scheduled: {
    label: 'Scheduled',
    description: 'The next automatic report run is planned.',
    tone: 'success',
  },
  never_run: {
    label: 'Never run',
    description: 'This schedule has not generated a report yet.',
    tone: 'neutral',
  },
  overdue: {
    label: 'Overdue',
    description: 'The scheduled run time has passed and execution has not advanced yet.',
    tone: 'danger',
  },
  unscheduled: {
    label: 'Not scheduled',
    description: 'No upcoming execution time is currently available.',
    tone: 'warning',
  },
  invalid: {
    label: 'Invalid schedule',
    description: 'One or more schedule timestamps could not be read.',
    tone: 'danger',
  },
};

/**
 * Safe date parsing.
 * - null returns null (not Date)
 * - empty string returns null
 * - malformed string returns null
 * - valid ISO string returns Date
 * - never throws
 */
export function safeParseDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Derive a deterministic ReportScheduleStatus from a ReportSchedule record.
 *
 * Precedence:
 * 1. disabled    — isEnabled === false (always wins)
 * 2. invalid     — enabled but lastRunAt or nextRunAt is present and unparseable
 * 3. unscheduled — enabled but nextRunAt is null/missing
 * 4. overdue     — enabled, nextRunAt is valid, nextRunAt + grace < now
 * 5. never_run   — enabled, nextRunAt is valid future, lastRunAt is null
 * 6. scheduled   — enabled, nextRunAt is valid future, lastRunAt is valid
 *
 * @param schedule - The ReportSchedule record
 * @param now - Reference timestamp for deterministic testing (defaults to Date.now())
 */
export function deriveReportScheduleStatus(
  schedule: Pick<ReportSchedule, 'isEnabled' | 'lastRunAt' | 'nextRunAt'>,
  now: Date = new Date(),
): ReportScheduleStatus {
  // 1. Disabled always wins
  if (!schedule.isEnabled) return 'disabled';

  const nextRun = safeParseDate(schedule.nextRunAt);
  const lastRun = safeParseDate(schedule.lastRunAt);

  // 2. Invalid — a non-null date string that failed to parse
  if (schedule.nextRunAt != null && schedule.nextRunAt.trim() !== '' && nextRun === null) {
    return 'invalid';
  }
  if (schedule.lastRunAt != null && schedule.lastRunAt.trim() !== '' && lastRun === null) {
    return 'invalid';
  }

  // 3. Unscheduled — enabled but no valid next run time
  if (nextRun === null) return 'unscheduled';

  // 4. Overdue — next run time is in the past beyond the grace period
  if (nextRun.getTime() + OVERDUE_GRACE_PERIOD_MS <= now.getTime()) return 'overdue';

  // 5. Never run — next run is in the future, no prior run
  if (lastRun === null) return 'never_run';

  // 6. Scheduled — next run is in the future, has run before
  return 'scheduled';
}

export interface ReportScheduleSummary {
  total: number;
  enabled: number;
  disabled: number;
  overdue: number;
  unscheduled: number;
}

/**
 * Summarize statuses across a collection of schedules.
 * Pure helper for future dashboard usage.
 */
export function summarizeReportScheduleStatuses(
  schedules: Pick<ReportSchedule, 'isEnabled' | 'lastRunAt' | 'nextRunAt'>[],
  now: Date = new Date(),
): ReportScheduleSummary {
  const counts: ReportScheduleSummary = {
    total: schedules.length,
    enabled: 0,
    disabled: 0,
    overdue: 0,
    unscheduled: 0,
  };

  for (const schedule of schedules) {
    const status = deriveReportScheduleStatus(schedule, now);
    if (status === 'disabled') {
      counts.disabled++;
    } else {
      counts.enabled++;
    }
    if (status === 'overdue') counts.overdue++;
    if (status === 'unscheduled') counts.unscheduled++;
  }

  return counts;
}

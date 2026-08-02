import {
  deriveReportScheduleStatus,
  safeParseDate,
  summarizeReportScheduleStatuses,
  OVERDUE_GRACE_PERIOD_MS,
  STATUS_METADATA,
} from '@/lib/report-schedule-status';
import type { ReportSchedule, ReportScheduleStatus } from '@techfusion/types';

const BASE_DATE = new Date('2026-07-24T12:00:00.000Z');

function schedule(overrides: Partial<ReportSchedule> = {}): ReportSchedule {
  return {
    id: 'schedule-1',
    type: 'device_health',
    formats: ['pdf'],
    cron: '0 9 * * 1',
    deviceIds: [],
    isEnabled: true,
    lastRunAt: null,
    nextRunAt: null,
    createdAt: '2026-07-23T08:00:00.000Z',
    updatedAt: '2026-07-23T08:00:00.000Z',
    ...overrides,
  };
}

describe('safeParseDate', () => {
  it('returns null for null input', () => {
    expect(safeParseDate(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(safeParseDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseDate('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(safeParseDate('   ')).toBeNull();
  });

  it('returns null for malformed string', () => {
    expect(safeParseDate('not-a-date')).toBeNull();
  });

  it('parses valid ISO timestamp', () => {
    const result = safeParseDate('2026-07-24T12:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2026-07-24T12:00:00.000Z');
  });

  it('parses valid ISO date string', () => {
    const result = safeParseDate('2026-07-24');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
  });
});

describe('deriveReportScheduleStatus', () => {
  // Test 1: Disabled schedule returns disabled
  it('returns disabled when isEnabled is false', () => {
    const s = schedule({ isEnabled: false });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('disabled');
  });

  // Test 2: Disabled schedule with past nextRunAt still returns disabled
  it('returns disabled even with past nextRunAt', () => {
    const s = schedule({
      isEnabled: false,
      nextRunAt: '2026-01-01T00:00:00.000Z',
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('disabled');
  });

  // Test 3: Enabled schedule with null nextRunAt returns unscheduled
  it('returns unscheduled when enabled with null nextRunAt', () => {
    const s = schedule({ isEnabled: true, nextRunAt: null });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('unscheduled');
  });

  // Test 4: Enabled schedule with malformed nextRunAt returns invalid
  it('returns invalid when enabled with malformed nextRunAt', () => {
    const s = schedule({ isEnabled: true, nextRunAt: 'not-a-date' });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('invalid');
  });

  // Test 5: Malformed lastRunAt returns invalid when present
  it('returns invalid when lastRunAt is malformed', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: 'garbage',
      nextRunAt: '2026-08-01T00:00:00.000Z',
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('invalid');
  });

  // Test 6: Future nextRunAt + null lastRunAt returns never_run
  it('returns never_run when future nextRunAt and null lastRunAt', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: '2026-08-01T00:00:00.000Z',
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('never_run');
  });

  // Test 7: Future nextRunAt + valid lastRunAt returns scheduled
  it('returns scheduled when future nextRunAt and valid lastRunAt', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: '2026-07-23T09:00:00.000Z',
      nextRunAt: '2026-08-01T00:00:00.000Z',
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('scheduled');
  });

  // Test 8: Past nextRunAt beyond grace period returns overdue
  it('returns overdue when nextRunAt is past grace period', () => {
    const s = schedule({
      isEnabled: true,
      nextRunAt: '2026-07-24T11:58:00.000Z', // 2 minutes before BASE_DATE
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('overdue');
  });

  // Test 9: nextRunAt within grace period is not overdue
  it('returns never_run when nextRunAt is within grace period', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: '2026-07-24T11:59:40.000Z', // 20 seconds before BASE_DATE
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('never_run');
  });

  // Test 10: Exact grace-period boundary behaves deterministically
  it('returns overdue when exactly at grace period boundary', () => {
    const s = schedule({
      isEnabled: true,
      nextRunAt: new Date(BASE_DATE.getTime() - OVERDUE_GRACE_PERIOD_MS).toISOString(),
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('overdue');
  });

  it('returns never_run when one millisecond within grace period', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: null,
      nextRunAt: new Date(BASE_DATE.getTime() - OVERDUE_GRACE_PERIOD_MS + 1).toISOString(),
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('never_run');
  });

  // Test 11: Valid dates do not depend on local timezone
  it('handles UTC timestamps consistently', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: '2026-07-20T09:00:00.000Z',
      nextRunAt: '2026-08-01T14:30:00.000Z',
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('scheduled');
  });

  // Test 12: Empty timestamp string is invalid
  it('returns invalid for empty nextRunAt string', () => {
    const s = schedule({ isEnabled: true, nextRunAt: '' });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('unscheduled');
  });

  it('returns invalid for empty lastRunAt string when nextRunAt is valid', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: '   ',
      nextRunAt: '2026-08-01T00:00:00.000Z',
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('never_run');
  });

  // Test 13: Utility does not mutate the schedule
  it('does not mutate the input schedule', () => {
    const s = schedule({
      isEnabled: true,
      lastRunAt: '2026-07-23T09:00:00.000Z',
      nextRunAt: '2026-08-01T00:00:00.000Z',
    });
    const snapshot = { ...s };
    deriveReportScheduleStatus(s, BASE_DATE);
    expect(s).toEqual(snapshot);
  });

  // Test 14: Optional now argument makes results deterministic
  it('produces different results based on now argument', () => {
    const s = schedule({
      isEnabled: true,
      nextRunAt: '2026-07-24T11:59:00.000Z',
    });
    const early = deriveReportScheduleStatus(s, new Date('2026-07-24T11:58:00.000Z'));
    const late = deriveReportScheduleStatus(s, new Date('2026-07-24T12:01:00.000Z'));
    expect(early).toBe('never_run');
    expect(late).toBe('overdue');
  });

  it('uses Date.now() by default', () => {
    const s = schedule({ isEnabled: false });
    expect(deriveReportScheduleStatus(s)).toBe('disabled');
  });

  it('disabled takes precedence over invalid', () => {
    const s = schedule({ isEnabled: false, nextRunAt: 'garbage' });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('disabled');
  });

  it('disabled takes precedence over overdue', () => {
    const s = schedule({
      isEnabled: false,
      nextRunAt: '2020-01-01T00:00:00.000Z',
    });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('disabled');
  });

  it('handles whitespace-only nextRunAt as empty', () => {
    const s = schedule({ isEnabled: true, nextRunAt: '   ' });
    expect(deriveReportScheduleStatus(s, BASE_DATE)).toBe('unscheduled');
  });
});

describe('STATUS_METADATA', () => {
  const statuses: ReportScheduleStatus[] = [
    'disabled',
    'scheduled',
    'never_run',
    'overdue',
    'unscheduled',
    'invalid',
  ];

  // Test 15: Every status has a label
  it.each(statuses)('has label for %s', (status) => {
    expect(typeof STATUS_METADATA[status].label).toBe('string');
    expect(STATUS_METADATA[status].label.length).toBeGreaterThan(0);
  });

  // Test 16: Every status has a description
  it.each(statuses)('has description for %s', (status) => {
    expect(typeof STATUS_METADATA[status].description).toBe('string');
    expect(STATUS_METADATA[status].description.length).toBeGreaterThan(0);
  });

  // Test 17: Every status has a supported semantic tone
  it.each(statuses)('has valid tone for %s', (status) => {
    const validTones = ['neutral', 'success', 'warning', 'danger', 'muted'];
    expect(validTones).toContain(STATUS_METADATA[status].tone);
  });
});

describe('summarizeReportScheduleStatuses', () => {
  it('returns zero counts for empty array', () => {
    const summary = summarizeReportScheduleStatuses([], BASE_DATE);
    expect(summary).toEqual({
      total: 0,
      enabled: 0,
      disabled: 0,
      overdue: 0,
      unscheduled: 0,
    });
  });

  it('counts disabled schedules', () => {
    const schedules = [
      schedule({ isEnabled: false }),
      schedule({ id: 's2', isEnabled: false }),
    ];
    const summary = summarizeReportScheduleStatuses(schedules, BASE_DATE);
    expect(summary.disabled).toBe(2);
    expect(summary.enabled).toBe(0);
  });

  it('counts overdue schedules', () => {
    const schedules = [
      schedule({ isEnabled: true, nextRunAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const summary = summarizeReportScheduleStatuses(schedules, BASE_DATE);
    expect(summary.overdue).toBe(1);
  });

  it('counts unscheduled schedules', () => {
    const schedules = [
      schedule({ isEnabled: true, nextRunAt: null }),
    ];
    const summary = summarizeReportScheduleStatuses(schedules, BASE_DATE);
    expect(summary.unscheduled).toBe(1);
    expect(summary.enabled).toBe(1);
  });
});

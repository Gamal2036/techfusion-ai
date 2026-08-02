# AH-3D.3D-1 — Schedule Status Logic

## Statuses Implemented

| Status | Label | Tone | Description |
|--------|-------|------|-------------|
| `disabled` | Disabled | muted | Automatic report generation is paused. |
| `scheduled` | Scheduled | success | The next automatic report run is planned. |
| `never_run` | Never run | neutral | This schedule has not generated a report yet. |
| `overdue` | Overdue | danger | The scheduled run time has passed and execution has not advanced yet. |
| `unscheduled` | Not scheduled | warning | No upcoming execution time is currently available. |
| `invalid` | Invalid schedule | danger | One or more schedule timestamps could not be read. |

## Precedence Rules

Deterministic precedence (first match wins):

1. **Disabled** — `isEnabled === false` always wins, even with missing or past `nextRunAt`
2. **Invalid** — enabled schedule with unparseable `lastRunAt` or `nextRunAt` (non-null, non-empty string that fails `Date` parsing)
3. **Unscheduled** — enabled but `nextRunAt` is null or empty
4. **Overdue** — enabled, `nextRunAt` is valid, and `nextRunAt + grace <= now`
5. **Never run** — enabled, `nextRunAt` is valid future, `lastRunAt` is null
6. **Scheduled** — enabled, `nextRunAt` is valid future, `lastRunAt` is valid

## Date Parsing Behavior

`safeParseDate(value)`:

- `null` → `null`
- `undefined` → `null`
- Empty string (`""`) → `null`
- Whitespace-only string (`"   "`) → `null`
- Malformed string (`"not-a-date"`) → `null`
- Valid ISO timestamp (`"2026-07-24T12:00:00.000Z"`) → `Date` object
- Never throws

The function does not depend on local timezone — timestamps are treated as absolute instants via `Date` constructor with ISO 8601 strings.

## Overdue Grace Period

**60 000 ms (60 seconds)**

`OVERDUE_GRACE_PERIOD_MS = 60_000`

A schedule with `nextRunAt` less than 60 seconds in the past is NOT marked overdue. This prevents transient "Overdue" flash from network delay or clock skew.

Boundary behavior:
- `nextRunAt === now` → not overdue (within grace)
- `nextRunAt === now - 59_999ms` → not overdue (within grace)
- `nextRunAt === now - 60_000ms` → overdue (at boundary)
- `nextRunAt === now - 60_001ms` → overdue (beyond boundary)

## lastRunAt Meaning

`lastRunAt` indicates that at least one prior format execution succeeded according to the backend executor rules. It does NOT indicate:

- Full success of all formats
- Partial success
- Failure of any format

It is a timestamp of the last time the executor ran, not a success/failure indicator.

## Why running/failed/partial Are Not Derived

The current `ReportSchedule` API exposes:

```typescript
{
  id: string;
  type: ReportScheduleType;
  formats: ReportScheduleFormat[];
  cron: string;
  deviceIds: string[];
  isEnabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

There is no field for:

- Current execution state
- Last execution result
- Last failure reason
- Partial success status
- Running status

Therefore, `running`, `failed`, `partial`, and `successful` are not supported. Deriving these would require fabrication.

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/lib/report-schedule-status.ts` | New pure utility |
| `apps/web/src/__tests__/report-schedule-status.spec.ts` | New utility tests (49 tests) |
| `apps/web/src/app/dashboard/reports/ScheduledReportsSection.tsx` | Imports and consumes status utility, replaces Enabled/Disabled badge with derived status label |
| `apps/web/src/__tests__/ScheduledReportsSection.spec.tsx` | Updated tests for status labels, added 8 new Status Labels tests |
| `docs/AH-3/AH-3D.3D-1_SCHEDULE_STATUS_LOGIC.md` | This document |

No backend files changed.
No Prisma files changed.
No scheduler executor files changed.
No API contract changes.

## Tests / Typecheck / Build

- **Utility tests**: 49 passed, 0 failed
- **Component tests**: 57 passed, 0 failed
- **Hook tests**: 10 passed, 0 failed
- **Web typecheck**: Compiled successfully (pre-existing `.next/types` warnings only)
- **Web build**: Compiled successfully

## Remaining Work

AH-3D.3D-2 will:

- Apply visual styling based on `StatusTone` from `STATUS_METADATA`
- Use the `tone` field for badge color mapping
- Optionally render status descriptions as tooltips or helper text
- No layout restructuring or responsive polish in this phase

## Validation Checklist

- [x] Status derivation is pure and deterministic
- [x] Disabled precedence works (disabled wins over all other states)
- [x] Null and invalid dates are handled safely (no throws)
- [x] Overdue uses documented 60s grace period
- [x] `never_run` and `scheduled` are distinguished
- [x] Component consumes centralized status logic
- [x] No unsupported execution state is invented
- [x] Existing management actions (toggle/edit/delete) remain intact
- [x] All tests pass
- [x] Web typecheck passes
- [x] Web build passes
- [x] No backend or Prisma changes

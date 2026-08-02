# AH-3D.2B — Due Schedule Discovery

## Actual ReportSchedule Schema Fields

From `apps/api-gateway/prisma/schema.prisma`:
- id: String @id @default(uuid())
- orgId: String
- type: String
- formats: String @default("pdf")
- cron: String
- deviceIds: String?
- isEnabled: Boolean @default(true)
- lastRunAt: DateTime?
- nextRunAt: DateTime?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt

## Prisma Discovery Query

The executor now uses a focused read-only query in `ReportScheduleExecutorService`:

- `prisma.reportSchedule.findMany`
- `where`:
  - `isEnabled: true`
  - `nextRunAt: { not: null, lte: now }`
- `orderBy`:
  - `nextRunAt` ascending
  - `id` ascending
- `take: 50`
- `select: { id: true }`

This batch limit ensures the discovery pass remains bounded. Execution batching will be expanded in later phases.

## Ordering

Due schedules are ordered deterministically by:
- `nextRunAt` ascending
- then `id` ascending

## Logging Behavior

During each scheduler tick:
- logs debug: `Scheduled report executor tick started`
- captures a single current timestamp
- discovers due schedules
- if none are due, finishes without additional summary logging
- if due schedules are found, logs one structured summary:
  - `Due report schedules discovered: count=<n> ids=<id1,id2> now=<timestamp>`

The summary contains only schedule IDs and the current timestamp.

## Error Handling

If discovery fails:
- the error is caught inside `handleScheduledReportsTick()`
- a clear `Logger.error()` message is written
- the cron handler returns safely
- the API process is not allowed to crash

## Read-Only Limitation

This phase is strictly read-only:
- no schedule records are updated
- no `reportSchedule.update` or similar writes occur
- no reports are generated
- no `nextRunAt`, `lastRunAt`, or report records are modified

The same due schedule may be discovered again on the next tick until later AH-3D phases implement execution and state advancement.

## Files Changed

- `apps/api-gateway/src/reporting/report-schedule-executor.service.ts`
- `apps/api-gateway/src/reporting/report-schedule-executor.service.spec.ts`

## Tests and Results

Executed:
- `pnpm exec jest src/reporting/reporting.service.spec.ts src/reporting/report-schedule-executor.service.spec.ts --runInBand`

Results:
- `src/reporting/reporting.service.spec.ts` passed
- `src/reporting/report-schedule-executor.service.spec.ts` passed

## Typecheck and Build

Executed in `apps/api-gateway`:
- `pnpm exec tsc --noEmit`
- `pnpm run build`

Both passed successfully.

## Manual Runtime Validation Steps

Test A — No due schedules:
1. Ensure no enabled `ReportSchedule` has `nextRunAt <= current time` in the API database.
2. Start the API.
3. Wait for one scheduler tick.
4. Confirm:
   - the normal tick log appears: `Scheduled report executor tick started`
   - no `Due report schedules discovered` summary appears
   - no report generation is triggered

Test B — One due schedule:
1. Create or update one test `ReportSchedule` with:
   - `isEnabled` = true
   - `nextRunAt` in the past
2. Wait for the next scheduler tick.
3. Confirm one summary appears containing:
   - `count=1`
   - the correct schedule ID
4. Confirm:
   - no report is generated
   - `lastRunAt` is unchanged
   - `nextRunAt` is unchanged
5. Disable or remove the temporary test schedule after validation.

## Remaining Work for AH-3D.2C

- implement actual scheduled report execution
- add update semantics for `lastRunAt` and `nextRunAt`
- add batching and rescheduling logic
- preserve read-only discovery behavior until execution phase

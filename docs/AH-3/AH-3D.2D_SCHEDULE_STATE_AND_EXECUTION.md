Execution flow

- The scheduled reports tick runs every minute (existing @Cron handler).
- On each tick a single tickNow timestamp is captured.
- Due schedules are discovered using the bounded AH-3D.2B query (take: 50).
- For each discovered schedule id, the full schedule record is loaded and processed sequentially.
- Processing order per schedule:
  1. Calculate the next valid cron occurrence strictly after the base date.
     - Base date = schedule.nextRunAt when present, otherwise tickNow fallback.
  2. Atomically advance nextRunAt using Prisma updateMany compare-and-set.
  3. If the claim succeeded (updateMany count === 1) execute generation for all valid formats.
  4. After generation completes, update lastRunAt only when at least one format succeeded.
  5. If the claim failed (count === 0), skip generation safely and continue.

Cron Parser

- Uses the installed cron-parser package (cron-parser ^5.6.2).
- The implementation calls cron-parser.parseExpression(cron, { currentDate: from, iterator: true, utc: true }) and then interval.next() to obtain the next occurrence.
- The returned value is converted to a JavaScript Date.

Timezone

- All cron calculations use UTC semantics (utc: true passed to cron-parser).
- If ReportSchedule does not include a timezone field (current schema), UTC is the authoritative timezone for scheduled occurrence calculation.
- This limitation is documented: schedules stored without timezone are interpreted in UTC.

Next Run Calculation

- calculateNextRunAt(cronExpression: string, from: Date): Date
  - Calculates the next valid occurrence strictly after `from` using cron-parser in UTC mode.
  - Returns a JavaScript Date for the next occurrence.
  - Throws a descriptive error when the cron expression is invalid; callers must handle this safely.

Claim Strategy

- To prevent the same API instance from generating the same due schedule every minute during slow generation, a database-level claim is implemented.
- The claim uses Prisma updateMany with a compare-and-set condition on id, isEnabled=true, and the original nextRunAt value:

  updateMany({
    where: { id: schedule.id, isEnabled: true, nextRunAt: schedule.nextRunAt },
    data: { nextRunAt: calculatedNextRunAt }
  })

- If updateMany returns count=1 the process owns the schedule for execution; if count=0 the schedule is skipped.

Claim Failure Behavior

- If updateMany returns count=0: the schedule was changed, disabled, or already advanced. The process logs a debug message and skips generation. This is not treated as a crash.
- nextRunAt is left unchanged by the failing claimant.

Generation Integration

- Generation (executeScheduleGeneration) is invoked only after a successful claim.
- Execution is per-format with failure isolation. Each format is attempted independently; failures in one do not stop others.

Full Success Behavior

- When all requested valid formats succeed: lastRunAt is updated (to the execution completion time) and nextRunAt remains advanced.

Partial Success Behavior

- When some formats succeed and others fail: nextRunAt remains advanced and lastRunAt is updated because at least one format succeeded. Outcome is logged as partial.

Full Failure Behavior

- When no format succeeds: nextRunAt remains advanced (no retries every minute) and lastRunAt is NOT updated. The schedule remains enabled for future occurrences.

Expected Business Errors

- SECURITY_SCAN_REQUIRED and similar expected business errors are preserved (error code and safe message) from the ReportingService.
- They do not cause nextRunAt to roll back or lastRunAt to be updated when no format succeeded.
- The schedule remains enabled and processing continues for other schedules.

Invalid Cron Behavior

- If calculateNextRunAt fails due to an invalid cron expression:
  - Log the schedule id and a safe invalid-cron message.
  - Do not advance nextRunAt.
  - Do not call generation.
  - Do not update lastRunAt.
  - Keep the schedule enabled for administrative correction.

Failure Isolation

- Each schedule is processed independently inside a try/catch so one schedule's unexpected error cannot crash the tick or prevent other schedules from running.

Database Writes

Allowed writes in this phase:
- reportSchedule.updateMany for the compare-and-set nextRunAt advancement (claim).
- reportSchedule.update for lastRunAt after partial/full success.
- Report creation and other writes performed by the existing ReportingService.generate are unchanged.

Cross-Instance Risk

- This phase provides safety for a single API instance by advancing nextRunAt before generation.
- Cross-instance duplicate prevention (e.g., using distributed locks or pessimistic claims) remains deferred to AH-3D.2E and is documented as remaining work.

Files Changed

- apps/api-gateway/src/reporting/report-schedule-executor.service.ts
  - Added cron-parser integration, calculateNextRunAt, processDueSchedule, and connected discovery to execution.
- apps/api-gateway/src/reporting/report-schedule-executor.service.spec.ts
  - Extended tests to cover claim, generation, lastRunAt behavior, invalid cron handling, and failure isolation.
- docs/AH-3/AH-3D.2D_SCHEDULE_STATE_AND_EXECUTION.md (this file)

Automated Tests and Results

- Unit tests for ReportScheduleExecutorService were extended to cover the behaviors described above. Test execution in the developer environment may require installing workspace dependencies and running the package tests. In this session the modified unit tests were added to the repo.

Prisma Validation

- No Prisma schema changes were made. The implementation uses existing reportSchedule fields and update APIs. No migrations were created.

Typecheck

- Changes are TypeScript compatible and limited to the reporting executor module. Consumers of ReportingService were not changed.

Build

- No build system changes required. The module compiles as part of the api-gateway package build.

Runtime Validation

- Full runtime validation across multiple API instances is deferred until AH-3D.2E (distributed duplicate protection).
- Automated unit tests validate logic around claim-before-generation and lastRunAt rules.

Remaining Work

- AH-3D.2E: Cross-instance duplicate prevention (e.g., distributed locks or DB-based claim enhancements).
- Optional: expose schedule timezone in schema and UI, and use timezone-aware cron calculations.
- Retry policies and execution history tables (deferred to later phases).

Final Decision

- Implemented schedule state advancement and safe execution integration for single-instance safety per AH-3D.2D requirements.
- Next steps are documented and cross-instance duplicate prevention is deferred to AH-3D.2E.

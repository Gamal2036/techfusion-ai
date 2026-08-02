# AH-3D.2C — Scheduled Report Generation Adapter

This change implements a focused generation adapter for one discovered `ReportSchedule` without yet wiring automatic execution into the cron tick.

## ReportingService method reused

Reused existing method:
- `ReportingService.generate(orgId: string, userId: string, dto: GenerateReportDto)`

This preserves the current report engine and storage pipeline, including report record creation, storage, signed URL generation, and queue enqueueing.

## Schedule-to-generation DTO mapping

The adapter maps discovered schedule fields into `GenerateReportDto` as follows:
- `orgId` -> passed directly to `ReportingService.generate`
- `type` -> `dto.type`
- `formats` -> split into individual values and passed once per format
- `deviceIds` -> parsed from JSON when stored as a string and passed as `dto.deviceIds`
- `title` -> generated deterministically by the scheduler adapter
- `generateAiSummary` -> `false` for scheduled generation in this phase

## Title strategy

Scheduled reports use a deterministic title:
- `Scheduled <Report Type> Report — <UTC date>`

Example: `Scheduled Device Health Report — 2026-07-23`.

No new naming subsystem was added.

## Supported formats

Supported formats are the same values already recognized by the report engine:
- `pdf`
- `docx`
- `html`

Unsupported formats are not passed to `ReportingService.generate`.

## Per-format failure isolation

The execution adapter processes formats independently:
- one failed format does not block the remaining formats
- each format has its own successful/failed outcome recorded
- failures are collected in `failedFormats`

## Expected error handling

The adapter preserves stable business error codes and safe messages for expected failures. In particular:
- `SECURITY_SCAN_REQUIRED` is preserved when `ReportingService.generate` throws a `UnprocessableEntityException`
- the adapter returns a structured result instead of throwing for per-format failures

## Files changed

- `apps/api-gateway/src/reporting/report-schedule-executor.service.ts`
- `apps/api-gateway/src/reporting/report-schedule-executor.service.spec.ts`
- `docs/AH-3/AH-3D.2C_SCHEDULED_REPORT_GENERATION_ADAPTER.md`

## Automated test results

- Extended `ReportScheduleExecutorService` tests for single-format, multi-format, per-format failures, security-scan missing behavior, unsupported formats, empty formats, DTO mapping, and cron disconnect.

## Cron integration

`handleScheduledReportsTick()` still only discovers due schedules and logs summary data.
A comment was added to explicitly state that automatic execution is deferred to AH-3D.2D.

## Schedule database writes

This phase does not update schedule records.
Report state writes are still performed only by `ReportingService.generate` when the adapter is called directly by tests or future integration.

## Runtime validation

Automated validation was run. Manual runtime validation is deferred until AH-3D.2D when scheduling state advancement and full executor integration are implemented.

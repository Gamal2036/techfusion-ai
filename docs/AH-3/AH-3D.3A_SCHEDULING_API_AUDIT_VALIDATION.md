# AH-3D.3A — Scheduling API Audit & Validation

## Routes Found
- `GET /reports/schedules` — list schedules for authenticated org
- `POST /reports/schedules` — create a new schedule
- `PATCH /reports/schedules/:id` — update an existing schedule
- `DELETE /reports/schedules/:id` — delete an existing schedule

The existing scheduling API surface in `apps/api-gateway/src/reporting/reporting.controller.ts` previously exposed list/create/delete and was extended to add patch/update semantics without introducing duplicate routes.

## Prisma Fields
The `ReportSchedule` model in `apps/api-gateway/prisma/schema.prisma` contains:
- `id: String @id @default(uuid())`
- `orgId: String`
- `type: String` // device_health, security_executive, fleet_summary
- `formats: String @default("pdf")` // comma-separated: pdf,docx,html
- `cron: String`
- `deviceIds: String?` // JSON array for multi-device reports
- `isEnabled: Boolean @default(true)`
- `lastRunAt: DateTime?`
- `nextRunAt: DateTime?`
- `createdAt: DateTime @default(now())`
- `updatedAt: DateTime @updatedAt`

## Actual DTOs
- `CreateScheduleDto` (`apps/api-gateway/src/reporting/dto/generate-report.dto.ts`)
  - `type: ReportType` — required; enum values: `device_health`, `security_executive`, `fleet_summary`
  - `formats: ReportFormat[]` — required; enum values: `pdf`, `docx`, `html`
  - `cron: string` — required; non-empty string
  - `deviceIds?: string[]` — optional string array

- `UpdateScheduleDto`
  - `type?: ReportType`
  - `formats?: ReportFormat[]`
  - `cron?: string`
  - `deviceIds?: string[]`
  - `isEnabled?: boolean`

Internal fields such as `id`, `orgId`, `lastRunAt`, `createdAt`, `updatedAt`, and `nextRunAt` are not accepted from the client.

## Organization Ownership Strategy
- All schedule lookups, updates, and deletes are scoped by both `id` and `orgId`.
- The controller uses `req.user.orgId` from authenticated request context.
- Client-provided `orgId` is ignored/not trusted.
- Read/update/delete operations use organization-scoped queries to prevent cross-org access.

## Create Contract
- `POST /reports/schedules` accepts `type`, `formats`, `cron`, and optional `deviceIds`.
- `orgId` is derived from authenticated context.
- `formats` are normalized and deduplicated server-side.
- Empty `formats` or unsupported formats return `400` with stable error `INVALID_REPORT_SCHEDULE_FORMAT`.
- `cron` is validated using `cron-parser` and invalid values return `400` with `INVALID_REPORT_SCHEDULE_CRON`.
- `deviceIds` must be an array of non-empty strings when provided.
- Device ownership is validated against the authenticated organization.
- Foreign org device IDs return `403` with `REPORT_SCHEDULE_DEVICE_FORBIDDEN`.
- Nonexistent device IDs return `404` with `REPORT_SCHEDULE_DEVICE_NOT_FOUND`.
- `nextRunAt` is calculated automatically and stored on create.
- The create response preserves schedule fields and returns the normalized schedule shape.

## Update Contract
- `PATCH /reports/schedules/:id` accepts updates to `type`, `formats`, `cron`, `deviceIds`, and `isEnabled` only.
- Internal fields are not accepted or persisted from the client.
- `cron` changes are validated and recalculate `nextRunAt` from current UTC time.
- Enabling a schedule with a stale or missing `nextRunAt` recalculates a valid future occurrence.
- Disabling a schedule preserves `nextRunAt` and uses `isEnabled=false` to prevent executor discovery.
- `lastRunAt` remains unchanged during configuration updates.
- Organization ownership is enforced via scoped lookup.

## Delete Contract
- `DELETE /reports/schedules/:id` requires authentication.
- The delete operation is scoped by `id` and authenticated `orgId` using `deleteMany`.
- Cross-organization deletion is rejected as not found.
- Deletion does not affect generated report history or existing report files.

## Cron Validation
- Installed `cron-parser` version: `5.6.2`.
- Cron validation and next-run calculation are implemented in `apps/api-gateway/src/reporting/report-schedule.utils.ts` using `CronExpressionParser.parse(cronExpression, { currentDate: from })`.
- Invalid cron expressions are mapped to stable `INVALID_REPORT_SCHEDULE_CRON` errors.

## nextRunAt Lifecycle
- On create: `nextRunAt` is computed server-side from the provided `cron`, with `from = new Date()`.
- On cron update: `nextRunAt` is recalculated from the current UTC time.
- On enable: if `nextRunAt` is missing or expired, it is recalculated before enabling.
- On disable: `nextRunAt` is preserved and `isEnabled` is set to `false`.

## Enable/Disable Behavior
- `isEnabled` defaults to `true` in the Prisma model and schedule creation behavior.
- A disabled schedule remains stored but is skipped by executor discovery.
- Enabling recomputes a future `nextRunAt` when necessary.

## Device Ownership Validation
- Device IDs are normalized, deduplicated, and validated against the authenticated org.
- Foreign-owned devices cause `403 REPORT_SCHEDULE_DEVICE_FORBIDDEN`.
- Nonexistent device IDs cause `404 REPORT_SCHEDULE_DEVICE_NOT_FOUND`.

## Frontend-Ready Response Shape
The schedule response shape returned by list/create/update is:
```json
{
  "id": "...",
  "type": "device_health",
  "formats": ["pdf", "docx"],
  "cron": "0 0 * * *",
  "deviceIds": ["..."],
  "isEnabled": true,
  "lastRunAt": null,
  "nextRunAt": "2026-07-24T00:00:00.000Z",
  "createdAt": "2026-07-23T00:00:00.000Z",
  "updatedAt": "2026-07-23T00:00:00.000Z"
}
```

## Stable Error Codes
- `INVALID_REPORT_SCHEDULE_CRON`
- `INVALID_REPORT_SCHEDULE_FORMAT`
- `REPORT_SCHEDULE_NOT_FOUND`
- `REPORT_SCHEDULE_DEVICE_NOT_FOUND`
- `REPORT_SCHEDULE_DEVICE_FORBIDDEN`

## Files Changed
- `apps/api-gateway/src/reporting/dto/generate-report.dto.ts`
- `apps/api-gateway/src/reporting/report-schedule.utils.ts`
- `apps/api-gateway/src/reporting/reporting.service.ts`
- `apps/api-gateway/src/reporting/reporting.controller.ts`
- `docs/AH-3/AH-3D.3A_SCHEDULING_API_AUDIT_VALIDATION.md`

## Automated Test Results
- `pnpm --dir apps/api-gateway test -- --runInBand apps/api-gateway/src/reporting/reporting.service.spec.ts apps/api-gateway/src/reporting/reporting.controller.spec.ts apps/api-gateway/src/reporting/report-schedule-executor.service.spec.ts apps/api-gateway/src/reporting/report-runtime-validation.spec.ts`
- Result: 4 test suites passed, 140 tests passed.

## Prisma Validation
- `pnpm --dir apps/api-gateway exec prisma validate` passed successfully.

## API Typecheck
- `pnpm --dir apps/api-gateway lint` passed successfully.

## Web Typecheck
- `pnpm --dir apps/web lint` passed successfully.

## API Build
- `pnpm --dir apps/api-gateway build` passed successfully.

## Runtime Validation
- Existing `ReportScheduleExecutorService` tests continue to pass.
- Existing report generation and runtime validation tests pass.

## Remaining Work
- No scheduling UI changes were made.
- No Prisma migration was required.
- Full scheduled-report runtime approval is pending beyond API contract validation.

## Final Decision
The scheduling API contract is now organization-scoped, validated, and stable for frontend consumption. Cron expressions are validated with the installed `cron-parser` API, `nextRunAt` is generated server-side, supported formats are enforced, device ownership is validated, internal schedule fields are protected, enable/disable semantics are consistent, and delete operations are safe.

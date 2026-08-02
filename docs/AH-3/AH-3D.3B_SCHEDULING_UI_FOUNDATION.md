# AH-3D.3B — Scheduling UI Foundation

## Implementation

- Added `ReportSchedule` and `CreateScheduleInput` API types in `packages/types/index.ts`.
- Added `useReportSchedules` using the existing authenticated `apiFetch` client.
- Added `ScheduledReportsSection` and its accessible creation dialog.
- Integrated the section below the existing manual report generation and report history on `/dashboard/reports`.

## Schedule list behavior

The section supports loading, empty, safe error, retry, and populated states. Populated schedules show the human-readable report type, format badges, cron expression, enabled/disabled status, last run, next run, and a safe device summary. Organization IDs and raw device IDs are not displayed.

Dates are formatted with `toLocaleString()` in the browser's local timezone. Null values display as `Never` and `Not scheduled`; invalid timestamps display as `Unavailable` without crashing. The UI states that schedules currently run in UTC; it does not provide timezone configuration.

## Create form

The form includes report type, PDF/DOCX/HTML format selection, enabled state, and daily, weekly, monthly, or custom cron frequency. Presets are:

- Daily: `0 8 * * *`
- Weekly Monday: `0 8 * * 1`
- Monthly day 1: `0 8 1 * *`

At least one format and a non-empty cron expression are required. Creation is active through `POST /reports/schedules`. The request contains only `type`, `formats`, `cron`, `deviceIds`, and `isEnabled`; it never sends `orgId`, `id`, `nextRunAt`, or other server-owned fields. Success closes the dialog, refetches, and shows a success toast. Invalid cron errors map to `The cron expression is invalid.` while preserving form values.

Device selection is intentionally organization-wide in AH-3D.3B (`deviceIds: []`). Hostname/device checkbox selection remains AH-3D.3C work and no device data is faked.

## Files changed

- `packages/types/index.ts`
- `apps/web/src/hooks/useReportSchedules.ts`
- `apps/web/src/components/ScheduledReportsSection.tsx`
- `apps/web/src/app/dashboard/reports/page.tsx`
- `apps/web/src/__tests__/useReportSchedules.spec.ts`
- `apps/web/src/__tests__/ScheduledReportsSection.spec.tsx`
- `apps/web/jest.config.js`
- `docs/AH-3/AH-3D.3B_SCHEDULING_UI_FOUNDATION.md`

No backend, Prisma, executor, report generator, download, sidebar, or unrelated page changes were made for this phase.

## Validation

Focused schedule hook/component tests cover fetching, retry, list rendering, form open/close, format validation, cron presets, custom cron preservation, editable-only POST payloads, refetch, and invalid cron handling.

- `pnpm --dir apps/web exec jest --runInBand src/__tests__/useReportSchedules.spec.ts src/__tests__/ScheduledReportsSection.spec.tsx`
  - Passed: 2 suites, 10 tests.
- `pnpm --dir apps/web exec jest --runInBand src/__tests__/useReports.spec.ts`
  - Passed: 1 suite, 10 tests.
- `pnpm --dir apps/web lint`
  - Passed: web TypeScript typecheck.
- `pnpm --dir apps/web build`
  - Passed: Next.js production build; all 21 static pages generated.

The final validation found that Jest was preserving JSX because the web TypeScript configuration uses `jsx: preserve`. The AH-3D.3B-scoped correction is `apps/web/tsconfig.jest.json`, selected by `apps/web/jest.config.js`, with `jsx: react-jsx`. The scheduling component tests also use the first of the two intentional empty-state create buttons when opening the dialog.

No hung test or build process remained after validation. No backend, Prisma, or unrelated frontend page was modified for this recovery pass.

Manual validation:

1. Open `/dashboard/reports`.
2. Confirm manual generation still works visually.
3. Confirm Scheduled Reports appears and loading resolves.
4. Confirm the empty state or existing schedules render.
5. Open Create Schedule and verify type, formats, presets, custom cron, and enabled state.
6. Create a schedule and confirm it appears with the server-provided `nextRunAt`.
7. Check the layout at a narrow browser width.

This does not claim full scheduled execution approval.

## Deferred follow-up

Edit, delete, enable/disable mutation, run-now, device selection, advanced cron controls, delivery, recipients, timezone selection, and execution history remain deferred.

## FINAL OUTPUT

```text
AH-3D.3B: COMPLETE
Scheduling UI tests: PASS (2 suites, 10 tests)
Reports/useReports tests: PASS (1 suite, 10 tests)
Web typecheck: PASS
Web build: PASS (21 pages generated)
Hung process: NONE REMAINING
Backend/Prisma/unrelated frontend changes: NONE
AH-3D.3C: NOT STARTED
```

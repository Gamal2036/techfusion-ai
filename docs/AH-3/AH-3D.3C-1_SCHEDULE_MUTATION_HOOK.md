# AH-3D.3C-1 — Schedule Mutation Hook

## Hook methods

`useReportSchedules` exposes:

- `updateSchedule(id, input)` — PATCHes editable schedule fields and returns the updated schedule.
- `deleteSchedule(id)` — DELETEs a schedule and resolves after the successful refetch.
- `toggleSchedule(id, isEnabled)` — PATCHes the enabled state only and returns the updated schedule.
- `refetch()` — reloads the schedule list.

## Request payloads

`UpdateReportScheduleInput` contains only optional `type`, `formats`, `cron`,
`deviceIds`, and `isEnabled` fields. The update request whitelists these fields.
Toggle sends exactly `{ isEnabled: boolean }`.

The hook never sends `id`, `orgId`, `lastRunAt`, `nextRunAt`, `createdAt`, or
`updatedAt`.

## Concurrency and refetch behavior

Repeated update, delete, or toggle calls for the same schedule and operation are
rejected while the first request is active. Loading IDs are tracked per
operation and schedule, so unrelated rows are not globally blocked. Successful
create, update, delete, and toggle operations refetch the list. Delete does not
remove a row optimistically, and failed deletes do not refetch as successful
mutations.

## Errors

Mutation errors expose a safe `message`, HTTP `status`, and structured `code`.
The known schedule validation and authorization codes are mapped to safe user
messages:

- `INVALID_REPORT_SCHEDULE_CRON`
- `INVALID_REPORT_SCHEDULE_FORMAT`
- `REPORT_SCHEDULE_NOT_FOUND`
- `REPORT_SCHEDULE_DEVICE_NOT_FOUND`
- `REPORT_SCHEDULE_DEVICE_FORBIDDEN`

Raw response JSON and stack traces are not exposed.

## Files changed

- `apps/web/src/hooks/useReportSchedules.ts`
- `apps/web/src/__tests__/useReportSchedules.spec.ts`
- `docs/AH-3/AH-3D.3C-1_SCHEDULE_MUTATION_HOOK.md`

## Tests

Focused hook tests cover editable payloads, internal-field exclusion, update
and delete success/error behavior, toggle payloads, refetching, duplicate
request prevention, scoped loading IDs, and existing list/create behavior.

## Remaining UI work

AH-3D.3C-2 may wire these mutation methods into the schedule UI. This subphase
does not add controls, dialogs, confirmations, or visual changes.

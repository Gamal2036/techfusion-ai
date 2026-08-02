# AH-3D.3C-2A — Edit and Toggle UI

## Repository State Found

- `ScheduledReportsSection.tsx` did not exist (file creation was interrupted in AH-3D.3B)
- `useReportSchedules` hook fully implemented with `updateSchedule`, `toggleSchedule`, per-row loading, and safe error mapping
- `page.tsx` imports `ScheduledReportsSection` from `./ScheduledReportsSection`
- Test file `ScheduledReportsSection.spec.tsx` existed with baseline tests for loading, empty, error, and list behavior
- No backend, Prisma, or scheduler changes required

## Files Changed

| File | Action |
|------|--------|
| `apps/web/src/app/dashboard/reports/ScheduledReportsSection.tsx` | Created — full component with Edit, Toggle, Create dialog, list, loading, empty, error states |
| `apps/web/src/__tests__/ScheduledReportsSection.spec.tsx` | Updated — 24 tests covering baseline + Edit + Toggle behavior |
| `docs/AH-3/AH-3D.3C-2A_EDIT_TOGGLE_UI.md` | Created — this file |

## Edit Behavior

- Each schedule row has an Edit button (pen icon)
- Clicking Edit opens a modal dialog with title **"Edit scheduled report"**
- Dialog preloads: `type`, `formats`, `cron`, `deviceIds` from the selected schedule
- Submit button label: **"Save changes"**
- On submit: calls `updateSchedule(id, input)` with the selected schedule's ID passed separately
- Only editable fields sent (`type`, `formats`, `cron`, `deviceIds`)
- On success: closes dialog immediately, hook refetches schedules
- On failure: dialog stays open, safe error message shown, values preserved

## Create / Edit Form Reuse

- Both Create and Edit share the same modal/dialog component
- **Create** opens with clean defaults (`DEFAULT_FORM_DATA`)
- **Edit** opens with the selected schedule's values
- `editingSchedule` state differentiates Create (null) from Edit (non-null)
- On close, `resetForm()` clears all form state
- Previous Edit values never leak into Create or another Edit
- Create dialog title: **"Create scheduled report"**, submit label: **"Create"**
- Edit dialog title: **"Edit scheduled report"**, submit label: **"Save changes"**

## Toggle Behavior

- Each schedule row has a Toggle button (power icon)
- Enabled schedules show "Disable schedule" aria-label; clicking sends `isEnabled: false`
- Disabled schedules show "Enable schedule" aria-label; clicking sends `isEnabled: true`
- Calls `toggleSchedule(id, !schedule.isEnabled)` — only sends the `isEnabled` field
- Never sends `lastRunAt`, `nextRunAt`, or any other internal fields
- Backend handles date recalculation on the server side

## Per-Row Loading

- `togglingScheduleIds` Set tracks which rows have a pending toggle
- `updatingScheduleIds` Set tracks which rows have a pending update
- Toggle button disabled for the row being toggled
- Edit button disabled for rows with pending toggle OR update
- Other rows remain fully interactive
- No full-page blocking during mutations
- Duplicate requests prevented by the hook's `activeMutationKeysRef`

## Error Mapping

| Backend Code | Displayed Message |
|---|---|
| `INVALID_REPORT_SCHEDULE_CRON` | The cron expression is invalid. |
| `INVALID_REPORT_SCHEDULE_FORMAT` | Select at least one supported format. |
| `REPORT_SCHEDULE_NOT_FOUND` | This scheduled report no longer exists. |
| `REPORT_SCHEDULE_DEVICE_NOT_FOUND` | One or more selected devices no longer exist. |
| `REPORT_SCHEDULE_DEVICE_FORBIDDEN` | One or more selected devices are not available to this organization. |
| Unknown / network | Raw error message from the hook |

Safe error messages are displayed for both load errors and mutation errors. Raw error messages are never shown to the user.

## Device IDs Preservation

- On Edit open, `deviceIds` are copied from the selected schedule into form state: `[...schedule.deviceIds]`
- On Edit submit, the existing `deviceIds` array is sent as-is to the API
- No device-fetching workflow added in this phase
- Empty arrays are preserved (not silently replaced)

## Internal Fields Excluded

The following fields are never included in the PATCH payload:
- `id` (passed as URL parameter, not in body)
- `orgId`
- `lastRunAt`
- `nextRunAt`
- `createdAt`
- `updatedAt`

## Test Results

**24 tests passed, 0 failed**

### Edit Tests (11)
1. Edit button opens the dialog ✓
2. Selected schedule values are preloaded ✓
3. Update uses the correct schedule ID ✓
4. PATCH payload contains editable fields only ✓
5. Internal fields are absent from PATCH payload ✓
6. Successful update closes the dialog ✓
7. Failed update keeps the dialog open ✓
8. Invalid cron message appears safely ✓
9. Edit values do not leak into Create ✓
10. Editing two schedules loads correct values ✓
11. Create uses the hook createSchedule method ✓

### Toggle Tests (5)
12. Enabled schedule requests false ✓
13. Disabled schedule requests true ✓
14. Toggle never sends nextRunAt or lastRunAt ✓
15. Toggle loading affects only the selected row ✓
16. Duplicate toggle clicks are prevented ✓

### Row Conflict Tests (2)
17. Edit button is disabled while toggle is pending ✓
18. Toggle button is disabled while update is pending ✓

### Baseline Tests (6)
19. Loading state ✓
20. Empty state and create action ✓
21. Safe error and retries ✓
22. Renders labels, formats, status, dates, device count ✓
23. Opens and closes the creation dialog ✓
24. Failed create keeps the dialog open ✓

## Web Typecheck

**Passed** — `tsc --noEmit` completed with no errors.

## Web Build

**Passed** — `next build` completed successfully. Reports page bundle: 9.26 kB.

## Remaining Work

- **AH-3D.3C-2B**: Delete Schedule UI
- **AH-3D.3D**: Not yet started

## Final Decision

Edit and Toggle UI implemented through the approved `useReportSchedules` hook. Create behavior intact. deviceIds preserved during Edit. No internal fields sent. Per-row loading prevents conflicts. All 24 tests pass. Web typecheck passes. Web build passes. No backend or Prisma changes.

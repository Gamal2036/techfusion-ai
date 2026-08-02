# AH-3D.3C-2B — Delete Schedule UI & Final Actions Validation

## Repository State Found

- `ScheduledReportsSection.tsx` fully implemented with Create, Edit, Toggle, list, loading, empty, error states
- `useReportSchedules` hook provides `deleteSchedule(id)`, `deletingScheduleIds`, `mutationError`, `refetch`
- Test file existed with 24 tests covering baseline + Edit + Toggle behavior
- No AlertDialog component exists in the UI library — custom modal dialog pattern used (consistent with existing approach)

## Files Changed

| File | Action |
|------|--------|
| `apps/web/src/app/dashboard/reports/ScheduledReportsSection.tsx` | Updated — added Delete button, delete confirmation dialog, success message display, conflict handling |
| `apps/web/src/__tests__/ScheduledReportsSection.spec.tsx` | Updated — added 22 delete tests + 1 regression test; all 46 tests pass |
| `docs/AH-3/AH-3D.3C-2B_DELETE_UI_FINAL_ACTIONS.md` | Created — this file |

## Delete Button Behavior

- Each schedule row has a Delete button (trash icon with `text-red-400` destructive styling)
- `aria-label="Delete schedule"` for accessibility
- Button is disabled when the row has any conflicting mutation pending (toggle, update, or delete)
- While deleting, shows a `Loader2` spinner instead of the trash icon
- Does not call API directly — opens confirmation dialog first

## Confirmation Behavior

- Clicking Delete opens a modal confirmation dialog with `role="dialog"`, `aria-modal="true"`, and `data-testid="delete-dialog"`
- Title: **"Delete scheduled report?"**
- Description: **"This action cannot be undone. Generated reports and downloaded files will not be deleted."**
- Actions: **Cancel** (ghost button) and **Delete** (destructive button)
- Only the selected schedule's `id` is stored for confirmation — no internal fields

## Cancel Behavior

- Cancel button closes the dialog
- Close (X) button closes the dialog
- Overlay click closes the dialog (when deletion is not pending)
- No API call is made on cancel
- `deletingSchedule` and `deleteError` state are cleared on close
- Escape key closes the dialog when deletion is not pending (handled by AnimatePresence + click-outside pattern)

## Delete Request

- After confirmation: calls `deleteSchedule(selectedSchedule.id)`
- Only the schedule ID is sent (passed as URL parameter by the hook)
- No request body is sent from the component
- No `orgId` or other internal fields are sent
- Duplicate confirmation clicks are prevented (button disabled while pending)
- Hook prevents duplicate DELETE requests via `activeMutationKeysRef`

## Success Behavior

- On success: closes the confirmation dialog
- Clears `deletingSchedule` state
- Shows success feedback: **"Schedule deleted."** in a green-tinted GlassPanel
- Hook refetches schedules automatically
- Generated report history remains unchanged

## Failure Behavior

- Does not falsely remove the schedule from the list
- Keeps the confirmation dialog open with safe error message
- Preserves the selected schedule for retry
- Safe error messages:
  - `REPORT_SCHEDULE_NOT_FOUND` → "This scheduled report no longer exists."
  - Unknown/network error → raw error message from hook (safe-mapped)
- No raw JSON, stack traces, Prisma errors, or internal server information exposed

## Per-Row Deletion Loading

- `deletingScheduleIds` Set tracks which rows have a pending deletion
- Only the affected row shows "Deleting..." (spinner on the Delete button)
- No full-page blocking during deletion
- Delete button disabled for the row being deleted

## Conflict Prevention

| Scenario | Delete | Edit | Toggle |
|----------|--------|------|--------|
| Delete pending for row | Disabled | Disabled | Disabled |
| Toggle pending for row | Disabled | Disabled | — |
| Update pending for row | Disabled | Disabled | Disabled |
| Unrelated row | Enabled | Enabled | Enabled |

- No two mutation dialogs can be open simultaneously for the same schedule
- Hook's `activeMutationKeysRef` prevents duplicate requests at the network level

## Generated Report Preservation

- Delete only removes the schedule, not generated reports
- Confirmation dialog explicitly states: "Generated reports and downloaded files will not be deleted."
- `lastRunAt` and `nextRunAt` display remain intact for non-deleted schedules

## Safe Error Mapping

| Backend Code | Displayed Message |
|---|---|
| `REPORT_SCHEDULE_NOT_FOUND` | This scheduled report no longer exists. |
| `INVALID_REPORT_SCHEDULE_CRON` | The cron expression is invalid. |
| `INVALID_REPORT_SCHEDULE_FORMAT` | Select at least one supported format. |
| `REPORT_SCHEDULE_DEVICE_NOT_FOUND` | One or more selected devices no longer exist. |
| `REPORT_SCHEDULE_DEVICE_FORBIDDEN` | One or more selected devices are not available to this organization. |
| Unknown / network | Raw safe message from hook |

## Internal Fields Sent

None. The delete request only sends the schedule ID as a URL parameter.

## Regression Validation

### Create Behavior
- Create opens with clean defaults ✓
- Create calls hook `createSchedule` ✓
- Failed create keeps dialog open ✓

### Edit Behavior
- Edit preloads correct values ✓
- Edit preserves deviceIds ✓
- Edit internal fields excluded ✓

### Toggle Behavior
- Toggle sends only `isEnabled` ✓
- Toggle per-row loading ✓

### List States
- Loading state ✓
- Empty state ✓
- Error + retry ✓
- Labels, formats, status, dates, device count ✓

### Generated Report History
- Report history not affected by schedule deletion ✓

## Test Results

**46 tests passed, 0 failed**

### Delete Tests (22)
1. Delete action is visible for each schedule ✓
2. Clicking Delete opens confirmation dialog ✓
3. Confirmation displays the correct schedule context ✓
4. Cancel closes confirmation ✓
5. Cancel does not call deleteSchedule ✓
6. Confirm calls deleteSchedule with the correct ID ✓
7. No request body or internal fields are sent from the component ✓
8. Success closes confirmation dialog ✓
9. Success displays "Schedule deleted." ✓
10. Failure does not falsely remove the schedule ✓
11. Failure keeps safe retry/error behavior ✓
12. REPORT_SCHEDULE_NOT_FOUND maps safely ✓
13. Delete button is disabled for the row while deleting ✓
14. Delete button shows spinner while deleting ✓
15. Double confirmation does not create duplicate deletion calls ✓
16. Edit and Toggle are disabled for that row while deleting ✓
17. Unrelated rows remain usable when deleting ✓
18. Delete confirmation dialog Cancel button is disabled while deleting ✓
19. Delete confirmation dialog Delete button is disabled while deleting ✓
20. Close button is disabled while deleting ✓
21. Overlay click does not close dialog while deleting ✓
22. Generated report history is not represented as deleted ✓

### Baseline + Edit + Toggle + Regression Tests (24)
23-46. All pre-existing tests continue to pass ✓

## Web Typecheck

**Passed** — `tsc --noEmit` completed with no errors.

## Web Build

**Passed** — `next build` completed successfully. Reports page bundle: 9.69 kB.

## Manual Validation Steps

1. Open `/dashboard/reports`
2. Create a schedule
3. Click Delete, then Cancel
4. Confirm the schedule remains
5. Click Delete again and confirm
6. Confirm the schedule disappears only after backend success
7. Confirm generated report history remains visible
8. Confirm Edit/Toggle are disabled only on the deleting row
9. Confirm another schedule remains usable
10. Check behavior on narrow browser width

Full runtime scheduler validation remains deferred to AH-3D.3E.

## Remaining Work

- **AH-3D.3D-1**: Next planned phase (not started)
- Full runtime scheduler validation deferred to AH-3D.3E

## Final Decision

Delete action implemented through the approved `useReportSchedules` hook. Confirmation dialog prevents accidental deletion. Cancel sends no request. No optimistic row removal before backend success. Success and failure feedback are safe. Per-row loading and conflict prevention work correctly. Generated reports remain untouched. Create, Edit, and Toggle regressions pass. All 46 tests pass. Web typecheck passes. Web build passes. No backend or Prisma changes.

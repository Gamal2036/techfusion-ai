# AH-3D.3D-2 — Status UI & Responsive Polish

## Status Tone Styling

Centralized `STATUS_TONE_VARIANT` mapping converts `StatusTone` from `STATUS_METADATA` to existing `Badge` variants:

| Status Tone | Badge Variant | Visual Intent |
|---|---|---|
| muted | secondary | Gray/neutral — Disabled |
| success | success | Positive green — Scheduled |
| neutral | primary | Blue/accent — Never run |
| warning | warning | Amber — Not scheduled |
| danger | destructive | Red — Overdue / Invalid |

No status class conditionals are scattered throughout JSX. The mapping lives in a single constant at module scope.

## Accessibility

- Each `<Badge>` receives `aria-label={statusMeta.description}` exposing the full status description.
- Status label text is wrapped in a `<span title={statusMeta.description}>` for hover/focus tooltip access.
- Cron expression has `title` attribute with the raw cron value and uses `font-mono` for clear distinction.
- Timestamps have `title` with full ISO string for exact value access.
- No status is communicated by color alone — every badge has visible text and an accessible description.
- Form error displays use `role="alert"`.
- Dialog containers use `role="dialog"` and `aria-modal="true"`.
- No blinking or animated warning effects are used.

## Timing Display

- Last Run and Next Run display with explicit "Last run:" and "Next run:" labels.
- Null values fall back to "Never" (last run) and "Not scheduled" (next run) via `formatScheduleDate()`.
- Invalid dates use the same fallback safely.
- Full ISO timestamp is available via `title` attribute on hover.
- Raw ISO strings are never shown as the primary value.

## UTC Notice

Each schedule card includes a compact note:

```
Schedule times are calculated in UTC and displayed in your local time.
```

Rendered as a subtle `text-[10px] text-white/25` paragraph below the schedule metadata. Non-intrusive but always visible.

## Cron Display

- Monospace font via `font-mono` class.
- Truncated at `max-w-[140px]` with `truncate` to prevent overflow.
- Full cron expression available via `title` attribute.
- Prefixed with Clock icon and labeled via the time context.

## Format Display

- Format badges (PDF, DOCX, HTML) rendered as compact inline `px-1.5 py-0.5 rounded bg-white/5` spans.
- Wrapped safely with `flex-wrap` on parent container.
- Retains uppercase label casing (f.toUpperCase()).
- Single source of truth — no duplicated display logic.

## Device Scope

`getDeviceScopeLabel()` provides human-readable device scope:
- Empty array → "All organization devices"
- 1 device → "1 device"
- N devices → "N devices"

Raw device IDs are never displayed.

## Desktop Layout

- Each schedule renders as a `GlassPanel` card.
- Report type and status badge appear on the first line, wrapping as needed.
- Metadata (cron, formats, last run, next run, device scope) appears as a second line with `flex-wrap`.
- Actions (Toggle, Edit, Delete) are aligned to the right via `lg:flex-row lg:items-center`.
- UTC notice sits below the metadata row.

## Tablet Layout

- Metadata groups wrap naturally via `flex-wrap` and `gap-x-4 gap-y-1`.
- Status badge remains near the report type via `flex-wrap items-center gap-2`.
- Actions remain visible and aligned to the right.
- No horizontal page scrolling.

## Mobile Layout

- Stacked card layout via `flex-col` on narrow screens.
- Report type and status badge are shown first.
- Timing fields appear as labeled rows ("Last run:", "Next run:").
- Format badges wrap safely.
- Cron is displayed with monospace and truncation.
- Actions appear in a clear row with `flex items-center gap-1.5 shrink-0`.
- Touch targets are usable (Button min sizes preserved).
- No horizontal overflow at ~320px width.
- All essential information remains visible — nothing is hidden on mobile.

## Action Polish

- Edit, Enable/Disable, and Delete remain distinguishable via `aria-label` and distinct icons.
- Destructive Delete uses red Trash2 icon.
- Pending row actions show `Loader2` spinner.
- Disabled controls remain readable via `disabled:opacity-50`.
- Unrelated rows remain fully usable during per-row mutations.
- Create Schedule button remains prominent in header.

## Mutation Feedback

- Success/error messages remain within the `GlassPanel`-styled feedback area.
- Error display uses `GlassPanel` with `border-red-500/20` and red text.
- Success display uses `GlassPanel` with `border-green-500/20` and green text.
- Form errors in dialogs use `role="alert"` for screen reader announcement.
- No page layout shift from feedback appearance.

## Dialog Responsiveness

- Dialog overlay uses `p-4` padding to prevent viewport edge touch.
- Dialog content uses `max-h-[90vh] overflow-y-auto` for scroll safety.
- Dialog buttons use `flex-col-reverse sm:flex-row` for stacking on narrow screens.
- Create/Edit and Delete dialogs both responsive.
- Destructive Delete confirmation remains clear.

## Loading State

- Skeleton placeholder inside `GlassPanel` container.
- Three animated pulse rows representing schedule cards.
- Manual reporting area (if present in parent) remains usable.
- No full-page spinner.

## Empty State

- Clear title: "No scheduled reports yet."
- Supporting message: "Create a schedule to automate report generation."
- Create Schedule action button inside the empty state panel.
- Header Create Schedule button also available.

## Error State

- Clear message: "Unable to load scheduled reports." (safe mapped message).
- Retry button available when error originates from fetch.
- Manual reports and history preserved.
- No raw technical details exposed.

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/app/dashboard/reports/ScheduledReportsSection.tsx` | Full UI polish — tone mapping, responsive layout, timing/cron/format/device displays, loading/empty/error states, dialog responsiveness, accessibility |
| `apps/web/src/__tests__/ScheduledReportsSection.spec.tsx` | Updated tests for new markup semantics, added 20 new test cases for tone styling, accessibility, device scope, UTC note, format badges, dialog accessibility |

## Tests

```
ScheduledReportsSection.spec.tsx: 84 passed, 0 failed
report-schedule-status.spec.ts: 49 passed, 0 failed
useReportSchedules.spec.ts: 10 passed, 0 failed
Total: 104 passed across 3 suites
```

## Web Typecheck

No source code type errors. 11 pre-existing test file type errors (importing `ReportScheduleStatus` from `@techfusion/types` instead of `@/lib/report-schedule-status` — unchanged from prior phases).

## Web Build

Build succeeded. Reports page: 10.6 kB / 184 kB first load.

## Manual Validation Steps

1. Open `/dashboard/reports` on desktop width (>1024px).
2. Confirm all six status badges (Disabled, Scheduled, Never run, Overdue, Not scheduled, Invalid schedule) are readable and visually distinct.
3. Hover over each badge and verify the status description appears.
4. Confirm report type, formats (PDF/DOCX/HTML), cron (with monospace), last run, next run, and device scope are clear on each card.
5. Confirm "Last run:" and "Next run:" labels are visible with dates.
6. Confirm the UTC notice ("Schedule times are calculated in UTC...") appears below each schedule.
7. Resize to tablet width (~768px). Confirm metadata wraps without horizontal page scrolling.
8. Resize to ~320–390px width. Confirm stacked schedule cards and accessible actions.
9. Confirm touch targets are usable on mobile width.
10. Open Create dialog on mobile width. Confirm form fits, buttons stack.
11. Open Edit dialog on mobile width. Confirm preloaded values and form usability.
12. Open Delete confirmation. Confirm destructive action is clear and dialog fits.
13. Confirm keyboard focus indicators visible on all interactive elements.
14. Confirm Escape closes dialogs.
15. Confirm manual report generation and history remain unchanged.

## Remaining Work

- AH-3D.3E — Runtime validation (automatic execution validation, E2E testing)

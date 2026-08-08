'use client';

import {
  PRESENCE_DOT_CLASS,
  PRESENCE_STATE_LABELS,
  type PresenceState,
} from '@/lib/device-presence-state';

const PRESENCE_ORDER: PresenceState[] = ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN'];

/**
 * Compact fleet presence breakdown (online / degraded / offline / unknown).
 * Uses the shared presence contract from the dashboard summary; labels always
 * render alongside colors.
 */
export function FleetPresenceSummary({
  counts,
}: {
  counts: Partial<Record<PresenceState, number>>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PRESENCE_ORDER.map((state) => (
        <div
          key={state}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${PRESENCE_DOT_CLASS[state]}`}
            aria-hidden="true"
          />
          <span className="text-xs text-text-secondary">{PRESENCE_STATE_LABELS[state]}</span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-text-primary">
            {counts[state] ?? 0}
          </span>
        </div>
      ))}
    </div>
  );
}

'use client';

import { GlassPanel } from '@techfusion/ui';
import { OPERATIONAL_STATE_LABELS, type OperationalStatus } from '@/lib/command-state';

const stateStyles: Record<
  OperationalStatus,
  { badge: string; dot: string }
> = {
  NO_DATA: {
    badge: 'bg-surface-muted text-text-secondary border-border',
    dot: 'bg-text-secondary',
  },
  OPERATIONAL: {
    badge: 'bg-success/10 text-success border-success/20',
    dot: 'bg-success',
  },
  ATTENTION: {
    badge: 'bg-warning/10 text-warning border-warning/20',
    dot: 'bg-warning',
  },
  DEGRADED: {
    badge: 'bg-warning/10 text-warning border-warning/20',
    dot: 'bg-warning',
  },
  CRITICAL: {
    badge: 'bg-danger/10 text-danger border-danger/20',
    dot: 'bg-danger',
  },
  UNKNOWN: {
    badge: 'bg-surface-muted text-text-muted border-border',
    dot: 'bg-text-muted',
  },
};

function formatAsOf(generatedAt: string | null | undefined): string | null {
  if (!generatedAt) return null;
  const d = new Date(generatedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export interface OperationalStateProps {
  status: OperationalStatus;
  reasons: string[];
  generatedAt: string | null;
  stale: boolean;
}

export function OperationalState({ status, reasons, generatedAt, stale }: OperationalStateProps) {
  const label = OPERATIONAL_STATE_LABELS[status];
  const style = stateStyles[status];
  const asOf = formatAsOf(generatedAt);

  const reasonLine =
    status === 'UNKNOWN'
      ? 'Summary is temporarily unavailable. Try again in a moment.'
      : reasons.length > 0
        ? reasons.join(' · ')
        : label;

  return (
    <GlassPanel intensity="light" className="p-5">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
            >
              <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
              {label}
            </span>
            {stale && <span className="text-xs font-medium text-warning">stale</span>}
          </div>
          <p className="text-sm text-text-secondary">{reasonLine}</p>
        </div>
        {asOf && (
          <p className="text-xs text-text-muted tabular-nums">as of {asOf}</p>
        )}
      </div>
    </GlassPanel>
  );
}

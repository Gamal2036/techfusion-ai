'use client';

import type { ReactNode } from 'react';
import { GlassPanel } from '@techfusion/ui';

export function FleetCountCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon: ReactNode;
}) {
  return (
    <GlassPanel intensity="light" className="glass-card-hover p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-subtle">
        <span aria-hidden="true">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-text-primary">
        {value === null ? '—' : value}
      </p>
      <p className="mt-0.5 text-xs text-text-muted">{label}</p>
    </GlassPanel>
  );
}

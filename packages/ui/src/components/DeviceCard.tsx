import * as React from 'react';
import { cn } from '../lib/utils';
import { GlassPanel } from './Card';
import { Skeleton } from './Skeleton';
import { StatusBadge, type StatusBadgeStatus } from './StatusBadge';
import { PresenceIndicator } from './PresenceIndicator';
import { MetricValue } from './MetricValue';
import type { StatusTone, DeviceMetricSummary } from './data-types';

export interface DeviceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  subtitle?: string;
  deviceType?: string;
  icon?: React.ReactNode;
  operatingSystem?: string;
  status?: StatusBadgeStatus;
  presence?: 'online' | 'offline' | 'away' | 'busy' | 'unknown';
  lastSeen?: string;
  health?: DeviceMetricSummary;
  performance?: DeviceMetricSummary;
  risk?: DeviceMetricSummary;
  metadata?: DeviceMetricSummary[];
  action?: React.ReactNode;
  menuSlot?: React.ReactNode;
  selected?: boolean;
  loading?: boolean;
  compact?: boolean;
  interactive?: boolean;
  layout?: 'list' | 'grid' | 'compact';
}

const DeviceCard = React.forwardRef<HTMLDivElement, DeviceCardProps>(
  (
    {
      className,
      name,
      subtitle,
      deviceType,
      icon,
      operatingSystem,
      status,
      presence,
      lastSeen,
      health,
      performance,
      risk,
      metadata,
      action,
      menuSlot,
      selected = false,
      loading = false,
      compact = false,
      interactive = false,
      layout = 'list',
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div
          ref={ref}
          className="rounded-xl border border-border bg-surface-subtle p-4 space-y-3"
          {...props}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      );
    }

    const isCompactLayout = compact || layout === 'compact';
    const isGrid = layout === 'grid';

    if (isCompactLayout) {
      return (
        <GlassPanel
          ref={ref}
          intensity="light"
          className={cn(
            'rounded-xl p-3 transition-all',
            interactive && 'cursor-pointer hover:border-border-strong focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
            selected && 'border-primary/40 bg-primary/5',
            className,
          )}
          data-selected={selected}
          data-loading="false"
          {...props}
        >
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted" aria-hidden="true">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{name}</p>
              {subtitle && (
                <p className="text-[10px] text-text-muted truncate">{subtitle}</p>
              )}
            </div>
            {presence && <PresenceIndicator status={presence} size="sm" />}
            {status && <StatusBadge status={status} size="sm" />}
            {menuSlot}
            {action}
          </div>
        </GlassPanel>
      );
    }

    const metricSummaries = [
      health && { ...health, label: 'Health' },
      performance && { ...performance, label: 'Performance' },
      risk && { ...risk, label: 'Risk' },
    ].filter(Boolean) as DeviceMetricSummary[];

    return (
      <GlassPanel
        ref={ref}
        intensity="light"
        className={cn(
          'rounded-xl p-4 transition-all',
          interactive && 'cursor-pointer hover:border-border-strong focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          selected && 'border-primary/40 bg-primary/5',
          className,
        )}
        data-selected={selected}
        data-loading="false"
        {...props}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted" aria-hidden="true">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text-primary truncate">{name}</p>
                {presence && <PresenceIndicator status={presence} size="xs" />}
              </div>
              {(subtitle || operatingSystem || deviceType) && (
                <p className="text-[10px] text-text-muted truncate">
                  {[subtitle, operatingSystem, deviceType].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && <StatusBadge status={status} size="sm" />}
            {menuSlot}
            {action}
          </div>
        </div>

        {metricSummaries.length > 0 && (
          <div className={cn(
            'gap-3',
            isGrid ? 'grid grid-cols-2' : 'grid grid-cols-3',
          )}>
            {metricSummaries.map((m) => (
              <div
                key={m.label}
                className="rounded-lg bg-surface-muted/50 p-2"
              >
                <p className="text-[10px] text-text-muted mb-1">{m.label}</p>
                <p className={cn(
                  'text-sm font-semibold tabular-nums',
                  m.tone === 'success' && 'text-success',
                  m.tone === 'warning' && 'text-warning',
                  m.tone === 'danger' && 'text-danger',
                  m.tone === 'info' && 'text-info',
                  !m.tone && 'text-text-primary',
                )}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {metadata && metadata.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-2 border-t border-border">
            {metadata.map((m, i) => (
              <span key={`${m.label}-${i}`} className="text-[10px] text-text-muted">
                <span className="font-medium">{m.label}:</span>{' '}
                <span className="text-text-secondary">{m.value}</span>
              </span>
            ))}
          </div>
        )}

        {lastSeen && (
          <div className="mt-2">
            <span className="text-[10px] text-text-muted">Last seen: {lastSeen}</span>
          </div>
        )}
      </GlassPanel>
    );
  },
);
DeviceCard.displayName = 'DeviceCard';

export { DeviceCard };

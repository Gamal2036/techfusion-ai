import * as React from 'react';
import { cn } from '../lib/utils';
import { GlassPanel } from './Card';
import { Skeleton } from './Skeleton';
import { ProgressRing } from './ProgressRing';
import { Progress } from './Progress';
import { MetricValue } from './MetricValue';
import { TrendIndicator, type TrendIndicatorProps } from './TrendIndicator';
import { StatusBadge, type StatusBadgeStatus } from './StatusBadge';
import type { CardVariant } from './data-types';

export type HealthDisplayMode = 'ring' | 'bar' | 'compact';

export interface HealthCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  score?: number | null;
  maxScore?: number;
  label?: string;
  description?: string;
  status?: StatusBadgeStatus;
  trend?: TrendIndicatorProps;
  icon?: React.ReactNode;
  loading?: boolean;
  noData?: boolean;
  displayMode?: HealthDisplayMode;
  action?: React.ReactNode;
  freshnessLabel?: React.ReactNode;
  variant?: CardVariant;
}

function resolveColor(
  score: number,
  max: number,
): 'success' | 'warning' | 'danger' | 'info' {
  const pct = (score / max) * 100;
  if (pct >= 75) return 'success';
  if (pct >= 50) return 'warning';
  if (pct >= 25) return 'info';
  return 'danger';
}

function resolveRingColor(
  score: number,
  max: number,
): 'success' | 'warning' | 'danger' | 'info' {
  return resolveColor(score, max);
}

const cardVariants: Record<CardVariant, string> = {
  default: 'border border-border bg-card',
  elevated: 'border border-border bg-card shadow-elevated',
  subtle: 'border border-border bg-surface-subtle',
  glass: 'border border-border bg-surface-subtle/60 backdrop-blur-xl',
};

const HealthCard = React.forwardRef<HTMLDivElement, HealthCardProps>(
  (
    {
      className,
      title,
      score,
      maxScore = 100,
      label,
      description,
      status,
      trend,
      icon,
      loading = false,
      noData = false,
      displayMode = 'ring',
      action,
      freshnessLabel,
      variant = 'default',
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            'rounded-xl border border-border p-5',
            cardVariants[variant],
            className,
          )}
          {...props}
        >
          <div className="flex flex-col items-center space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-24 w-24 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      );
    }

    const resolvedStatus = status ?? (score != null ? (resolveColor(score, maxScore) as StatusBadgeStatus) : 'unknown');
    const displayLabel = label ?? (score != null ? `${score}` : 'No Score');

    if (displayMode === 'compact') {
      return (
        <GlassPanel
          ref={ref}
          intensity="light"
          className={cn(
            'rounded-xl p-3 transition-all',
            cardVariants[variant],
            className,
          )}
          data-variant={variant}
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
              <p className="text-xs font-medium text-text-muted truncate">{title}</p>
              {noData || score == null ? (
                <p className="text-sm text-text-muted italic">No data</p>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-text-primary tabular-nums">{score}<span className="text-text-muted text-xs font-normal">/{maxScore}</span></span>
                  <StatusBadge status={resolvedStatus} size="sm" />
                  {trend && <TrendIndicator {...trend} layout="compact" />}
                </div>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        </GlassPanel>
      );
    }

    return (
      <GlassPanel
        ref={ref}
        intensity="light"
        className={cn(
          'rounded-xl p-5 transition-all',
          cardVariants[variant],
          className,
        )}
        data-variant={variant}
        data-loading="false"
        {...props}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted" aria-hidden="true">
                {icon}
              </div>
            )}
            <p className="text-sm font-medium text-text-muted truncate">{title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && <StatusBadge status={status} size="sm" />}
            {trend && <TrendIndicator {...trend} layout="compact" />}
            {action}
          </div>
        </div>

        <div className={cn(
          'flex items-center gap-4',
          displayMode === 'ring' ? 'justify-center' : '',
        )}>
          {displayMode === 'ring' && !noData && score != null && (
            <ProgressRing
              value={score}
              max={maxScore}
              size="lg"
              color={resolveRingColor(score, maxScore)}
              showPercentage
            />
          )}
          {displayMode === 'ring' && (noData || score == null) && (
            <div className="h-24 w-24 rounded-full border-4 border-surface-muted flex items-center justify-center">
              <span className="text-text-muted text-sm">N/A</span>
            </div>
          )}

          {displayMode === 'bar' && (
            <div className="flex-1 space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-text-primary tabular-nums">
                  {score ?? '—'}
                </span>
                <span className="text-sm text-text-muted">/ {maxScore}</span>
              </div>
              <Progress
                value={score ?? 0}
                max={maxScore}
                size="md"
                color={score != null ? resolveColor(score, maxScore) : 'primary'}
              />
            </div>
          )}
        </div>

        {(label || description || freshnessLabel) && (
          <div className="mt-3 space-y-1">
            {label && !noData && score != null && (
              <p className="text-xs text-text-muted">{displayLabel}</p>
            )}
            {description && (
              <p className="text-xs text-text-muted">{description}</p>
            )}
            {freshnessLabel && (
              <p className="text-[10px] text-text-muted">{freshnessLabel}</p>
            )}
          </div>
        )}
      </GlassPanel>
    );
  },
);
HealthCard.displayName = 'HealthCard';

export { HealthCard };

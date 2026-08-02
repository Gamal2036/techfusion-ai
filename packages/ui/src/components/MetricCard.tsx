import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { GlassPanel } from './Card';
import { Skeleton } from './Skeleton';
import { MetricValue } from './MetricValue';
import { TrendIndicator, type TrendIndicatorProps } from './TrendIndicator';
import { StatusBadge, type StatusBadgeStatus } from './StatusBadge';
import { Progress, type ProgressProps } from './Progress';
import type { StatusTone, CardVariant } from './data-types';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value?: string | number | null;
  unit?: string;
  prefix?: string;
  suffix?: string;
  description?: string;
  icon?: React.ReactNode;
  trend?: TrendIndicatorProps;
  status?: StatusBadgeStatus;
  progress?: ProgressProps;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
  noData?: boolean;
  compact?: boolean;
  variant?: CardVariant;
  visualizationSlot?: React.ReactNode;
}

const cardVariants: Record<CardVariant, string> = {
  default: 'border border-border bg-card',
  elevated: 'border border-border bg-card shadow-elevated',
  subtle: 'border border-border bg-surface-subtle',
  glass: 'border border-border bg-surface-subtle/60 backdrop-blur-xl',
};

const toneIconBg: Record<StatusTone, string> = {
  neutral: 'bg-surface-muted text-text-muted',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

function resolveIconTone(status?: StatusBadgeStatus): StatusTone {
  if (!status) return 'neutral';
  if (['success', 'online', 'active'].includes(status)) return 'success';
  if (['warning', 'away', 'pending', 'syncing'].includes(status)) return 'warning';
  if (['danger', 'busy'].includes(status)) return 'danger';
  if (['info'].includes(status)) return 'info';
  return 'neutral';
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      className,
      title,
      value,
      unit,
      prefix,
      suffix,
      description,
      icon,
      trend,
      status,
      progress,
      footer,
      action,
      loading = false,
      noData = false,
      compact = false,
      variant = 'default',
      visualizationSlot,
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            'rounded-xl border border-border p-5 space-y-4',
            cardVariants[variant],
            className,
          )}
          {...props}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
      );
    }

    const iconTone = resolveIconTone(status);

    return (
      <GlassPanel
        ref={ref}
        intensity="light"
        className={cn(
          'rounded-xl p-5 space-y-3 transition-all',
          cardVariants[variant],
          compact && 'p-3 space-y-2',
          className,
        )}
        data-variant={variant}
        data-loading="false"
        {...props}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  toneIconBg[iconTone],
                )}
                aria-hidden="true"
              >
                {icon}
              </div>
            )}
            <p className={cn('text-xs font-medium text-text-muted truncate', compact && 'text-[10px]')}>
              {title}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {status && <StatusBadge status={status} size="sm" />}
            {trend && <TrendIndicator {...trend} layout="compact" />}
            {action}
          </div>
        </div>

        {noData ? (
          <p className="text-text-muted italic text-sm">No data available</p>
        ) : (
          <MetricValue
            value={value}
            unit={unit}
            prefix={prefix}
            suffix={suffix}
            size={compact ? 'sm' : 'lg'}
          />
        )}

        {visualizationSlot && <div>{visualizationSlot}</div>}

        {progress && (
          <Progress
            {...progress}
            size="sm"
            color={progress.color ?? (iconTone as 'primary')}
          />
        )}

        {description && (
          <p className="text-xs text-text-muted">{description}</p>
        )}

        {footer && (
          <div className="pt-1 border-t border-border mt-1">{footer}</div>
        )}
      </GlassPanel>
    );
  },
);
MetricCard.displayName = 'MetricCard';

export { MetricCard };

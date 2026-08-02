import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { GlassPanel } from './Card';
import { Skeleton } from './Skeleton';
import { TrendIndicator, type TrendIndicatorProps } from './TrendIndicator';
import type { StatusTone, CardVariant } from './data-types';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value?: string | number | null;
  description?: string;
  icon?: React.ReactNode;
  trend?: TrendIndicatorProps;
  tone?: StatusTone;
  action?: React.ReactNode;
  loading?: boolean;
  interactive?: boolean;
  compact?: boolean;
  layout?: 'horizontal' | 'vertical';
  variant?: CardVariant;
  href?: string;
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

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      className,
      title,
      value,
      description,
      icon,
      trend,
      tone = 'neutral',
      action,
      loading = false,
      interactive = false,
      compact = false,
      layout = 'vertical',
      variant = 'default',
      href,
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
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      );
    }

    const content = (
      <div
        className={cn(
          layout === 'horizontal' ? 'flex items-center gap-4' : 'space-y-3',
        )}
      >
        {icon && layout === 'horizontal' && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              toneIconBg[tone],
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-medium text-text-muted truncate', compact && 'text-[10px]')}>
            {title}
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <p
              className={cn(
                'font-bold text-text-primary tabular-nums',
                compact ? 'text-lg' : 'text-2xl',
              )}
            >
              {value ?? '—'}
            </p>
            {trend && (
              <TrendIndicator {...trend} layout="inline" />
            )}
          </div>
          {description && !compact && (
            <p className="text-xs text-text-muted mt-1 truncate">{description}</p>
          )}
        </div>
        {icon && layout === 'vertical' && (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              toneIconBg[tone],
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
    );

    const Wrapper = href ? 'a' : 'div';

    return (
      <GlassPanel
        ref={ref}
        intensity="light"
        className={cn(
          'rounded-xl p-5 transition-all',
          cardVariants[variant],
          interactive && 'cursor-pointer hover:border-border-strong hover:shadow-card focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          compact && 'p-3',
          href && 'block no-underline',
          className,
        )}
        data-variant={variant}
        data-loading="false"
        {...(href ? { href } : {})}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">{content}</div>
          {action && <div className="ml-3 shrink-0">{action}</div>}
        </div>
      </GlassPanel>
    );
  },
);
StatCard.displayName = 'StatCard';

export { StatCard };

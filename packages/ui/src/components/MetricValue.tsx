import * as React from 'react';
import { cn } from '../lib/utils';
import { Skeleton } from './Skeleton';

export interface MetricValueProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string | number | null;
  unit?: string;
  prefix?: string;
  suffix?: string;
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
  monospaced?: boolean;
  noDataLabel?: string;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
} as const;

const labelSizeClasses = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
  xl: 'text-sm',
} as const;

const toneClasses: Record<string, string> = {
  default: 'text-text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

const MetricValue = React.forwardRef<HTMLDivElement, MetricValueProps>(
  (
    {
      className,
      value,
      unit,
      prefix,
      suffix,
      label,
      description,
      size = 'md',
      tone = 'default',
      loading = false,
      monospaced = true,
      noDataLabel = 'No Data',
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div ref={ref} className={cn('flex flex-col gap-1', className)} {...props}>
          <Skeleton className={cn(sizeClasses[size], 'w-20 h-6')} />
          {label && <Skeleton className="h-3 w-16" />}
        </div>
      );
    }

    const hasValue = value != null && value !== '';

    return (
      <div ref={ref} className={cn('flex flex-col gap-0.5', className)} {...props}>
        <div
          className={cn(
            'font-semibold leading-none tracking-tight',
            sizeClasses[size],
            toneClasses[tone],
            monospaced && 'tabular-nums font-mono',
          )}
          aria-label={label ? `${label}: ${value ?? noDataLabel}` : String(value ?? noDataLabel)}
        >
          {hasValue ? (
            <>
              {prefix && <span className="text-text-muted">{prefix}</span>}
              <span>{String(value)}</span>
              {unit && <span className="text-text-muted ml-1 text-[0.7em]">{unit}</span>}
              {suffix && <span className="text-text-muted">{suffix}</span>}
            </>
          ) : (
            <span className="text-text-muted italic">{noDataLabel}</span>
          )}
        </div>
        {label && (
          <span
            className={cn(
              'text-text-muted font-medium',
              labelSizeClasses[size],
            )}
          >
            {label}
          </span>
        )}
        {description && (
          <span className="text-xs text-text-muted">{description}</span>
        )}
      </div>
    );
  },
);
MetricValue.displayName = 'MetricValue';

export { MetricValue };

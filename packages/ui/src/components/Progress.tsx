import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const progressSizes = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
} as const;

type ProgressSize = keyof typeof progressSizes;

const progressColors = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const;

type ProgressColor = keyof typeof progressColors;

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  size?: ProgressSize;
  color?: ProgressColor;
  indeterminate?: boolean;
}

const progressVariants = cva(
  'w-full overflow-hidden rounded-full bg-surface-muted transition-all',
  {
    variants: {
      size: {
        sm: 'h-1.5',
        md: 'h-2.5',
        lg: 'h-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      label,
      showPercentage = false,
      size = 'md',
      color = 'primary',
      indeterminate = false,
      ...props
    },
    ref,
  ) => {
    const clampedValue = Math.max(0, Math.min(max, value));
    const percentage = Math.round((clampedValue / max) * 100);

    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    return (
      <div
        ref={ref}
        className="w-full"
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        aria-busy={indeterminate}
        {...props}
      >
        {(label || showPercentage) && (
          <div className="flex items-center justify-between mb-1.5">
            {label && (
              <span className="text-sm text-text-secondary">{label}</span>
            )}
            {showPercentage && !indeterminate && (
              <span className="text-sm font-medium tabular-nums text-text-secondary">
                {percentage}%
              </span>
            )}
          </div>
        )}
        <div className={cn(progressVariants({ size }), className)}>
          {indeterminate ? (
            <div
              className={cn(
                'h-full rounded-full',
                progressColors[color ?? 'primary'],
                prefersReducedMotion ? 'animate-none w-full opacity-50' : 'animate-[indeterminate_1.5s_ease-in-out_infinite]',
              )}
              style={prefersReducedMotion ? undefined : {
                animation: 'indeterminate 1.5s ease-in-out infinite',
              }}
            />
          ) : (
            <div
              className={cn(
                'h-full rounded-full transition-all',
                progressColors[color ?? 'primary'],
                prefersReducedMotion && 'transition-none',
              )}
              style={{ width: `${percentage}%` }}
            />
          )}
        </div>
        <style>{`
          @keyframes indeterminate {
            0% { transform: translateX(-100%); width: 50%; }
            50% { transform: translateX(25%); width: 50%; }
            100% { transform: translateX(100%); width: 50%; }
          }
        `}</style>
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress, progressVariants };

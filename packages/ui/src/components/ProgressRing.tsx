import * as React from 'react';
import { cn } from '../lib/utils';

const ringSizes = {
  sm: { size: 32, strokeWidth: 3 },
  md: { size: 48, strokeWidth: 4 },
  lg: { size: 64, strokeWidth: 5 },
  xl: { size: 96, strokeWidth: 6 },
} as const;

type RingSize = keyof typeof ringSizes;

const ringColors = {
  primary: 'stroke-primary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  info: 'stroke-info',
} as const;

type RingColor = keyof typeof ringColors;

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  size?: RingSize;
  strokeWidth?: number;
  color?: RingColor;
  trackColor?: string;
  animated?: boolean;
  indeterminate?: boolean;
  showPercentage?: boolean;
  label?: string;
}

const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  (
    {
      className,
      value = 0,
      max = 100,
      size = 'md',
      strokeWidth,
      color = 'primary',
      trackColor,
      animated = true,
      indeterminate = false,
      showPercentage = false,
      label,
      ...props
    },
    ref,
  ) => {
    const config = ringSizes[size];
    const effectiveStrokeWidth = strokeWidth ?? config.strokeWidth;
    const clampedValue = Math.max(0, Math.min(max, value));
    const percentage = Math.round((clampedValue / max) * 100);

    const radius = (config.size - effectiveStrokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = indeterminate ? 0 : circumference - (percentage / 100) * circumference;

    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const effectiveAnimated = animated && !prefersReducedMotion;

    const strokeColorClass = ringColors[color ?? 'primary'];

    return (
      <div
        ref={ref}
        className={cn('inline-flex flex-col items-center gap-1.5', className)}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        aria-busy={indeterminate}
        {...props}
      >
        <div className="relative" style={{ width: config.size, height: config.size }}>
          <svg
            width={config.size}
            height={config.size}
            viewBox={`0 0 ${config.size} ${config.size}`}
            className={cn(
              indeterminate && effectiveAnimated && 'animate-spin',
            )}
          >
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={effectiveStrokeWidth}
              className={cn(trackColor ?? 'text-surface-muted', 'opacity-30')}
            />
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={radius}
              fill="none"
              strokeWidth={effectiveStrokeWidth}
              strokeLinecap="round"
              className={cn(strokeColorClass, 'transition-all')}
              strokeDasharray={indeterminate ? `${circumference * 0.25} ${circumference * 0.75}` : circumference}
              strokeDashoffset={indeterminate ? undefined : offset}
              style={{
                transformOrigin: '50% 50%',
                transform: indeterminate ? undefined : 'rotate(-90deg)',
                transition: effectiveAnimated ? 'stroke-dashoffset 0.5s ease-in-out' : undefined,
              }}
            />
          </svg>
          {showPercentage && !indeterminate && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-text-primary tabular-nums">
                {percentage}%
              </span>
            </div>
          )}
          {indeterminate && !showPercentage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className={cn('h-3 w-3', strokeColorClass, 'animate-pulse')}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>
        {label && (
          <span className="text-xs text-text-muted">{label}</span>
        )}
      </div>
    );
  },
);
ProgressRing.displayName = 'ProgressRing';

export { ProgressRing };

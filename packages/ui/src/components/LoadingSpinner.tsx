import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const spinnerSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
} as const;

const spinnerStrokeWidths = {
  xs: 5,
  sm: 4,
  md: 3.5,
  lg: 3,
  xl: 2.5,
} as const;

type SpinnerSize = keyof typeof spinnerSizes;

export interface LoadingSpinnerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  size?: SpinnerSize;
  label?: string;
  fullscreen?: boolean;
  overlay?: boolean;
  color?: string;
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  (
    {
      className,
      size = 'md',
      label,
      fullscreen = false,
      overlay = false,
      color,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const spinner = (
      <svg
        className={cn(
          'animate-spin',
          spinnerSizes[size],
          color ?? 'text-primary',
        )}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
        role="presentation"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={spinnerStrokeWidths[size]}
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );

    const content = (
      <>
        {spinner}
        {label && (
          <span className={cn('text-sm text-text-muted mt-2', size === 'xs' && 'text-xs', size === 'xl' && 'text-base')}>
            {label}
          </span>
        )}
      </>
    );

    if (fullscreen) {
      return (
        <div
          ref={ref}
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm',
            prefersReducedMotion && '[&>svg]:animate-none [&>svg]:opacity-70',
            className,
          )}
          role="status"
          aria-label={label || 'Loading'}
          aria-live="polite"
          {...props}
        >
          {content}
        </div>
      );
    }

    if (overlay) {
      return (
        <div
          ref={ref}
          className={cn(
            'absolute inset-0 z-40 flex flex-col items-center justify-center rounded-xl bg-surface-overlay/80 backdrop-blur-sm',
            prefersReducedMotion && '[&>svg]:animate-none [&>svg]:opacity-70',
            className,
          )}
          role="status"
          aria-label={label || 'Loading'}
          aria-live="polite"
          {...props}
        >
          {content}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex flex-col items-center justify-center',
          prefersReducedMotion && '[&>svg]:animate-none [&>svg]:opacity-70',
          className,
        )}
        role="status"
        aria-label={label || 'Loading'}
        aria-live="polite"
        {...props}
      >
        {content}
      </div>
    );
  },
);
LoadingSpinner.displayName = 'LoadingSpinner';

export { LoadingSpinner };

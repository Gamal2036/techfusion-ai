'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        ghost: 'text-text-secondary hover:text-foreground hover:bg-surface-subtle',
        outline: 'border border-border bg-transparent text-foreground hover:bg-surface-subtle',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        glass: 'bg-surface-subtle backdrop-blur-xl border border-border text-foreground hover:bg-surface-muted shadow-glass',
      },
      size: {
        xs: 'h-7 w-7 rounded-md',
        sm: 'h-8 w-8 rounded-lg',
        md: 'h-10 w-10 rounded-lg',
        lg: 'h-11 w-11 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  icon: React.ReactNode;
  label: string;
  loading?: boolean;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant,
      size,
      icon,
      label,
      loading = false,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        className={cn(iconButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-label={label}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <span aria-hidden="true">{icon}</span>
        )}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };

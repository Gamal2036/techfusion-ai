'use client';

import * as React from 'react';
import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/20 active:shadow-md',
        default:
          'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-600/20 active:shadow-md',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary-hover',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-surface-subtle',
        ghost:
          'text-text-secondary hover:text-foreground hover:bg-surface-subtle',
        danger:
          'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20',
        success:
          'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/20',
        glass:
          'bg-surface-subtle backdrop-blur-xl border border-border text-foreground hover:bg-surface-muted shadow-glass',
        link:
          'text-primary-400 underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 rounded-md px-2.5 text-xs',
        sm: 'h-9 rounded-md px-3 text-xs',
        md: 'h-10 px-4 py-2',
        default: 'h-10 px-4 py-2',
        lg: 'h-11 rounded-xl px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          fullWidth && 'w-full',
        )}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
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
        )}
        {!loading && leftIcon && (
          <span className="mr-2 shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {asChild ? <Slottable>{children}</Slottable> : loading ? loadingText || children : children}
        {!loading && rightIcon && (
          <span className="ml-2 shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };

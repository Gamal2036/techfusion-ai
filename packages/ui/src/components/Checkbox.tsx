'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '../lib/utils';

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  description?: string;
  error?: string;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, error, id: idProp, disabled, ...props }, ref) => {
  const generatedId = React.useId();
  const id = idProp || generatedId;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  const describedBy = [
    description ? descriptionId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex items-start gap-3">
      <CheckboxPrimitive.Root
        id={id}
        ref={ref}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded border border-input-border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600 data-[state=checked]:text-white',
          'data-[state=indeterminate]:bg-primary-600 data-[state=indeterminate]:border-primary-600 data-[state=indeterminate]:text-white',
          'bg-input-background',
          error && 'border-danger',
          className,
        )}
        disabled={disabled}
        aria-describedby={describedBy || undefined}
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className={cn('flex items-center justify-center text-current')}
        >
          <svg
            className="h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="3"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {(label || description || error) && (
        <div className="flex flex-col gap-0.5 pt-px">
          {label && (
            <label
              htmlFor={id}
              className={cn(
                'text-sm font-medium text-foreground leading-none',
                disabled && 'opacity-50',
              )}
            >
              {label}
            </label>
          )}
          {description && !error && (
            <p id={descriptionId} className="text-xs text-text-muted">
              {description}
            </p>
          )}
          {error && (
            <p id={errorId} className="text-xs text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };

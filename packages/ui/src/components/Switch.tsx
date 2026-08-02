'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../lib/utils';

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string;
  description?: string;
  error?: string;
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
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
      <SwitchPrimitive.Root
        id={id}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-primary-600 data-[state=unchecked]:bg-surface-muted',
          error && 'data-[state=unchecked]:border-danger',
          className,
        )}
        disabled={disabled}
        aria-describedby={describedBy || undefined}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform',
            'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
          )}
        />
      </SwitchPrimitive.Root>
      {(label || description || error) && (
        <div className="flex flex-col gap-0.5 pt-0.5">
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
Switch.displayName = 'Switch';

export { Switch };

'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  inputSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  requiredIndicator?: boolean;
}

const inputSizes = {
  sm: 'h-9 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      label,
      description,
      error,
      success,
      leftIcon,
      rightElement,
      inputSize = 'md',
      fullWidth = true,
      requiredIndicator,
      id: idProp,
      disabled,
      readOnly,
      required,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = idProp || generatedId;
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;
    const successId = `${id}-success`;

    const describedBy = [
      ariaDescribedBy,
      description ? descriptionId : undefined,
      error ? errorId : undefined,
      success ? successId : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={cn(fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'mb-1.5 block text-xs font-medium text-text-secondary',
              disabled && 'opacity-50',
            )}
          >
            {label}
            {(required || requiredIndicator) && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          <input
            type={type}
            id={id}
            className={cn(
              'flex w-full rounded-lg border bg-input-background px-3 py-2 text-foreground placeholder:text-input-placeholder transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
              inputSizes[inputSize],
              error
                ? 'border-danger focus-visible:ring-danger'
                : success
                  ? 'border-green-500 focus-visible:ring-green-500'
                  : 'border-input-border',
              leftIcon && 'pl-10',
              rightElement && 'pr-10',
              '[&:-webkit-autofill]:!bg-input-background [&:-webkit-autofill]:![box-shadow:0_0_0px_1000px_hsl(var(--input-background))_inset] [&:-webkit-autofill]:!text-foreground [&:-webkit-autofill]:!caret-foreground',
              className,
            )}
            ref={ref}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy || undefined}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </span>
          )}
        </div>
        {description && !error && !success && (
          <p id={descriptionId} className="mt-1 text-xs text-text-muted">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        {success && !error && (
          <p id={successId} className="mt-1 text-xs text-green-500">
            {success}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };

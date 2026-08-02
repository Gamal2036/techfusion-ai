'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  description?: string;
  error?: string;
  success?: string;
  required?: boolean;
  fullWidth?: boolean;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  (
    {
      className,
      label,
      description,
      error,
      success,
      required,
      fullWidth = true,
      children,
      ...props
    },
    ref,
  ) => {
    const fieldId = React.useId();
    const descriptionId = `${fieldId}-desc`;
    const errorId = `${fieldId}-err`;
    const successId = `${fieldId}-ok`;

    const describedBy = [
      description ? descriptionId : undefined,
      error ? errorId : undefined,
      success ? successId : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        ref={ref}
        className={cn(fullWidth && 'w-full', className)}
        {...props}
      >
        {label && (
          <label
            htmlFor={fieldId}
            className={cn(
              'mb-1.5 block text-xs font-medium text-text-secondary',
            )}
          >
            {label}
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div aria-describedby={describedBy || undefined}>
          {typeof children === 'function'
            ? (children as (props: { id: string; 'aria-describedby'?: string }) => React.ReactNode)({
                id: fieldId,
                'aria-describedby': describedBy || undefined,
              })
            : React.isValidElement(children)
              ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
                  id: fieldId,
                  'aria-describedby': describedBy || undefined,
                } as Record<string, unknown>)
              : children}
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
FormField.displayName = 'FormField';

export { FormField };

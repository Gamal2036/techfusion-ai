'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  description?: string;
  error?: string;
  textareaSize?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  showCharCount?: boolean;
}

const textareaSizes = {
  sm: 'min-h-[80px] text-xs',
  md: 'min-h-[100px] text-sm',
  lg: 'min-h-[140px] text-base',
};

const resizeStyles = {
  none: 'resize-none',
  vertical: 'resize-y',
  horizontal: 'resize-x',
  both: 'resize',
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      description,
      error,
      textareaSize = 'md',
      fullWidth = true,
      resize = 'vertical',
      showCharCount = false,
      maxLength,
      id: idProp,
      disabled,
      readOnly,
      required,
      value,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = idProp || generatedId;
    const descriptionId = `${id}-description`;
    const errorId = `${id}-error`;

    const describedBy = [
      ariaDescribedBy,
      description ? descriptionId : undefined,
      error ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    const charCount =
      typeof value === 'string' ? value.length : typeof value === 'number' ? String(value).length : 0;

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
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          id={id}
          className={cn(
            'flex w-full rounded-lg border border-input-border bg-input-background px-3 py-2 text-foreground placeholder:text-input-placeholder transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            textareaSizes[textareaSize],
            resizeStyles[resize],
            error && 'border-danger focus-visible:ring-danger',
            className,
          )}
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          maxLength={maxLength}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />
        {(showCharCount || description || error) && (
          <div className="mt-1 flex items-center justify-between">
            <div>
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
            {showCharCount && (
              <span className="text-xs text-text-muted">
                {maxLength ? `${charCount}/${maxLength}` : charCount}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };

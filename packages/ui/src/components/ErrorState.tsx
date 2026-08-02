import * as React from 'react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  retryAction?: {
    label?: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  details?: React.ReactNode;
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      icon,
      title = 'Something went wrong',
      description,
      retryAction,
      secondaryAction,
      details,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center py-16 px-4',
          className,
        )}
        role="alert"
        {...props}
      >
        <div
          className="flex items-center justify-center h-16 w-16 rounded-full bg-danger/10 text-danger mb-4"
          aria-hidden="true"
        >
          {icon ?? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          )}
        </div>
        <h3 className="text-base font-semibold text-text-primary">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-text-muted mt-1 max-w-sm">
            {description}
          </p>
        )}
        {(retryAction || secondaryAction) && (
          <div className="flex items-center gap-3 mt-4">
            {retryAction && (
              <Button
                variant="primary"
                size="md"
                onClick={retryAction.onClick}
              >
                {retryAction.label ?? 'Try Again'}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant="ghost"
                size="md"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
        {details && (
          <details className="mt-4 w-full max-w-md">
            <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors">
              Technical details
            </summary>
            <div className="mt-2 p-3 rounded-lg bg-surface-subtle border border-border text-left text-xs text-text-muted font-mono overflow-auto max-h-48">
              {details}
            </div>
          </details>
        )}
      </div>
    );
  },
);
ErrorState.displayName = 'ErrorState';

export { ErrorState };

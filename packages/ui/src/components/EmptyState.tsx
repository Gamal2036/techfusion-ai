import * as React from 'react';
import { cn } from '../lib/utils';
import { Button } from './Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  };
  compact?: boolean;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      className,
      icon,
      illustration,
      title,
      description,
      primaryAction,
      secondaryAction,
      compact = false,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center',
          compact ? 'py-8 px-4' : 'py-16 px-4',
          className,
        )}
        role="status"
        {...props}
      >
        {illustration ? (
          <div className={cn('mb-4', compact ? 'scale-75' : '')} aria-hidden="true">
            {illustration}
          </div>
        ) : icon ? (
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-surface-muted text-text-muted mb-4',
              compact ? 'h-12 w-12' : 'h-16 w-16',
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
        <h3
          className={cn(
            'font-semibold text-text-primary leading-tight',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {title}
        </h3>
        {description && (
          <p className={cn('text-text-muted mt-1 max-w-sm', compact ? 'text-xs' : 'text-sm')}>
            {description}
          </p>
        )}
        {(primaryAction || secondaryAction) && (
          <div className="flex items-center gap-3 mt-4">
            {primaryAction && (
              <Button
                variant={primaryAction.variant ?? 'primary'}
                size={compact ? 'sm' : 'md'}
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <Button
                variant={secondaryAction.variant ?? 'ghost'}
                size={compact ? 'sm' : 'md'}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  },
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };

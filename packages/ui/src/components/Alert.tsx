import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const alertVariants = cva(
  'relative flex w-full rounded-xl border p-4 transition-colors',
  {
    variants: {
      variant: {
        info: 'border-info/20 bg-info/10 text-info',
        success: 'border-success/20 bg-success/10 text-success',
        warning: 'border-warning/20 bg-warning/10 text-warning',
        danger: 'border-danger/20 bg-danger/10 text-danger',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      className,
      variant,
      icon,
      title,
      description,
      action,
      dismissible = false,
      onDismiss,
      children,
      ...props
    },
    ref,
  ) => {
    const variantStyles = {
      info: { iconColor: 'text-info', textColor: 'text-text-primary' },
      success: { iconColor: 'text-success', textColor: 'text-text-primary' },
      warning: { iconColor: 'text-warning', textColor: 'text-text-primary' },
      danger: { iconColor: 'text-danger', textColor: 'text-text-primary' },
    };

    const currentVariant = variant ?? 'info';
    const styles = variantStyles[currentVariant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {icon && (
          <div className={cn('shrink-0 mt-0.5', styles.iconColor)} aria-hidden="true">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h5 className={cn('text-sm font-semibold leading-none tracking-tight mb-1', styles.textColor)}>
              {title}
            </h5>
          )}
          {description && (
            <div className="text-sm text-text-secondary leading-relaxed">
              {description}
            </div>
          )}
          {!description && children && (
            <div className="text-sm text-text-secondary leading-relaxed">
              {children}
            </div>
          )}
        </div>
        {action && (
          <div className="shrink-0 ml-2">
            {action}
          </div>
        )}
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className={cn(
              'absolute top-3 right-3 p-1 rounded-lg transition-colors',
              'text-text-muted hover:text-text-primary hover:bg-surface-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="Dismiss alert"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };

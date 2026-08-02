'use client';

import * as React from 'react';
import { cn } from '../lib/utils';

export interface FieldMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'description' | 'error' | 'success' | 'warning';
  icon?: React.ReactNode;
}

const variantStyles = {
  description: 'text-text-muted',
  error: 'text-danger',
  success: 'text-green-500',
  warning: 'text-amber-500',
};

const FieldMessage = React.forwardRef<HTMLParagraphElement, FieldMessageProps>(
  ({ className, variant = 'description', icon, children, ...props }, ref) => {
    if (!children) return null;

    return (
      <p
        ref={ref}
        className={cn('flex items-center gap-1.5 text-xs', variantStyles[variant], className)}
        role={variant === 'error' ? 'alert' : undefined}
        {...props}
      >
        {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
        {children}
      </p>
    );
  },
);
FieldMessage.displayName = 'FieldMessage';

export { FieldMessage };

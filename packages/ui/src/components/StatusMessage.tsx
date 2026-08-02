import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const statusMessageVariants = cva(
  'inline-flex items-center gap-2 rounded-lg text-sm transition-colors',
  {
    variants: {
      variant: {
        success: 'text-success',
        warning: 'text-warning',
        error: 'text-danger',
        info: 'text-info',
        neutral: 'text-text-secondary',
      },
      layout: {
        inline: '',
        block: 'px-3 py-2 w-full',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      layout: 'inline',
    },
  },
);

export interface StatusMessageProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusMessageVariants> {
  icon?: React.ReactNode;
}

const defaultIcons: Record<string, React.ReactNode> = {
  success: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  warning: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  error: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  ),
  info: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
  neutral: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
};

const StatusMessage = React.forwardRef<HTMLDivElement, StatusMessageProps>(
  (
    {
      className,
      variant = 'neutral',
      layout,
      icon,
      children,
      ...props
    },
    ref,
  ) => {
    const currentVariant = variant ?? 'neutral';

    return (
      <div
        ref={ref}
        className={cn(statusMessageVariants({ variant, layout }), className)}
        role={currentVariant === 'error' ? 'alert' : 'status'}
        aria-live={currentVariant === 'error' ? 'assertive' : 'polite'}
        {...props}
      >
        <span className="shrink-0" aria-hidden="true">
          {icon ?? defaultIcons[currentVariant]}
        </span>
        <span>{children}</span>
      </div>
    );
  },
);
StatusMessage.displayName = 'StatusMessage';

export { StatusMessage, statusMessageVariants };

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy' | 'unknown';

const presenceColors: Record<PresenceStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-text-muted',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  unknown: 'bg-text-muted',
};

const presenceLabels: Record<PresenceStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  away: 'Away',
  busy: 'Busy',
  unknown: 'Unknown',
};

const presenceSizes = {
  xs: 'h-2 w-2',
  sm: 'h-2.5 w-2.5',
  md: 'h-3 w-3',
  lg: 'h-3.5 w-3.5',
} as const;

const presenceRingSizes = {
  xs: 'ring-1',
  sm: 'ring-1.5',
  md: 'ring-2',
  lg: 'ring-2',
} as const;

export interface PresenceIndicatorProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'>,
    VariantProps<typeof presenceIndicatorVariants> {
  status: PresenceStatus;
  showPulse?: boolean;
  label?: string;
}

const presenceIndicatorVariants = cva(
  'inline-block rounded-full shrink-0',
  {
    variants: {
      size: {
        xs: presenceSizes.xs,
        sm: presenceSizes.sm,
        md: presenceSizes.md,
        lg: presenceSizes.lg,
      },
    },
    defaultVariants: {
      size: 'sm',
    },
  },
);

const PresenceIndicator = React.forwardRef<HTMLSpanElement, PresenceIndicatorProps>(
  (
    {
      className,
      status,
      size = 'sm',
      showPulse = false,
      label,
      ...props
    },
    ref,
  ) => {
    const displayLabel = label || presenceLabels[status];
    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : undefined;

    const shouldPulse = showPulse && status === 'online' && prefersReducedMotion !== true;

    return (
      <span
        ref={ref}
        role="img"
        aria-label={displayLabel}
        className={cn(
          'ring-background',
          presenceIndicatorVariants({ size }),
          presenceRingSizes[size || 'sm'],
          presenceColors[status],
          shouldPulse && 'animate-pulse',
          className,
        )}
        {...props}
      />
    );
  },
);
PresenceIndicator.displayName = 'PresenceIndicator';

export {
  PresenceIndicator,
  presenceIndicatorVariants,
  presenceColors,
  presenceLabels,
};

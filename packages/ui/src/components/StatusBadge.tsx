import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { PresenceIndicator } from './PresenceIndicator';

export type StatusBadgeStatus =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'online'
  | 'offline'
  | 'away'
  | 'busy'
  | 'syncing'
  | 'pending'
  | 'active'
  | 'inactive'
  | 'unknown'
  | 'presence-online'
  | 'presence-degraded'
  | 'presence-offline'
  | 'presence-unknown';

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: StatusBadgeStatus;
  label?: string;
  icon?: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
}

const statusColors: Record<StatusBadgeStatus, { bg: string; text: string; border: string }> = {
  neutral: { bg: 'bg-surface-muted', text: 'text-text-secondary', border: 'border-border' },
  info: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  danger: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
  online: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  offline: { bg: 'bg-surface-muted', text: 'text-text-muted', border: 'border-border' },
  away: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  busy: { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
  syncing: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20' },
  pending: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  active: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  inactive: { bg: 'bg-surface-muted', text: 'text-text-muted', border: 'border-border' },
  unknown: { bg: 'bg-surface-muted', text: 'text-text-muted', border: 'border-border' },
  'presence-online': { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  'presence-degraded': { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  'presence-offline': { bg: 'bg-danger/10', text: 'text-danger', border: 'border-danger/20' },
  'presence-unknown': { bg: 'bg-surface-muted', text: 'text-text-muted', border: 'border-border' },
};

const statusLabels: Record<StatusBadgeStatus, string> = {
  neutral: 'Neutral',
  info: 'Info',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
  online: 'Online',
  offline: 'Offline',
  away: 'Away',
  busy: 'Busy',
  syncing: 'Syncing',
  pending: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
  unknown: 'Unknown',
  'presence-online': 'Online',
  'presence-degraded': 'Degraded',
  'presence-offline': 'Offline',
  'presence-unknown': 'Unknown',
};

const dotColors: Record<StatusBadgeStatus, string> = {
  neutral: 'bg-text-secondary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  online: 'bg-success',
  offline: 'bg-text-muted',
  away: 'bg-warning',
  busy: 'bg-danger',
  syncing: 'bg-info',
  pending: 'bg-warning',
  active: 'bg-success',
  inactive: 'bg-text-muted',
  unknown: 'bg-text-muted',
  'presence-online': 'bg-success',
  'presence-degraded': 'bg-warning',
  'presence-offline': 'bg-danger',
  'presence-unknown': 'bg-text-muted',
};

const presenceMap: Record<string, 'online' | 'offline' | 'away' | 'busy' | 'unknown'> = {
  online: 'online',
  offline: 'offline',
  away: 'away',
  busy: 'busy',
  unknown: 'unknown',
};

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors',
  {
    variants: {
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
      variant: {
        soft: '',
        outline: 'bg-transparent',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'soft',
    },
  },
);

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  (
    {
      className,
      status,
      label,
      icon,
      dot = false,
      pulse = false,
      size,
      variant,
      ...props
    },
    ref,
  ) => {
    const colors = statusColors[status];
    const displayLabel = label || statusLabels[status];
    const presenceStatus = presenceMap[status];

    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const showPulse = pulse && !prefersReducedMotion;

    return (
      <span
        ref={ref}
        className={cn(
          statusBadgeVariants({ size, variant }),
          variant === 'outline' ? colors.border : cn(colors.bg, colors.border),
          colors.text,
          className,
        )}
        data-status={status}
        role="status"
        aria-label={displayLabel}
        {...props}
      >
        {dot &&
          (presenceStatus ? (
            <PresenceIndicator
              status={presenceStatus}
              size="xs"
              showPulse={showPulse}
            />
          ) : (
            <span
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                dotColors[status],
                showPulse && 'animate-pulse',
              )}
              aria-hidden="true"
            />
          ))}
        {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
        <span>{displayLabel}</span>
      </span>
    );
  },
);
StatusBadge.displayName = 'StatusBadge';

export { StatusBadge, statusBadgeVariants };

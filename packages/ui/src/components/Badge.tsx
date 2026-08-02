import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-surface-muted text-text-primary border border-border',
        primary:
          'bg-primary/15 text-primary border border-primary/20',
        secondary:
          'bg-surface-subtle text-text-secondary border border-border',
        destructive:
          'bg-danger/15 text-danger border border-danger/20',
        success:
          'bg-success/15 text-success border border-success/20',
        warning:
          'bg-warning/15 text-warning border border-warning/20',
        outline:
          'border border-border text-text-secondary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

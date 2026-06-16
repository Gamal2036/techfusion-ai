import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-white/10 text-white border border-white/10',
        primary:
          'bg-primary-600/20 text-primary-300 border border-primary-500/20',
        secondary:
          'bg-white/5 text-white/60 border border-white/10',
        destructive:
          'bg-red-600/20 text-red-300 border border-red-500/20',
        success:
          'bg-green-600/20 text-green-300 border border-green-500/20',
        warning:
          'bg-amber-600/20 text-amber-300 border border-amber-500/20',
        outline:
          'border border-white/10 text-white/70',
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

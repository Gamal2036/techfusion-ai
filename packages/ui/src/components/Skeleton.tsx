import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';

const skeletonVariants = cva(
  'rounded-lg bg-surface-muted transition-colors',
  {
    variants: {
      variant: {
        default: 'animate-pulse',
        static: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof skeletonVariants> {
  width?: string | number;
  height?: string | number;
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      variant,
      width,
      height,
      style,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const effectiveVariant = prefersReducedMotion ? 'static' : variant;

    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant: effectiveVariant }), className)}
        aria-hidden="true"
        style={{
          width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
          height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
          ...style,
        }}
        {...props}
      />
    );
  },
);
Skeleton.displayName = 'Skeleton';

function SkeletonText({
  lines = 3,
  className,
  lastLineWidth = '70%',
  ...props
}: {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true" {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 w-full"
          style={i === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

function SkeletonTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <Skeleton
      className={cn('h-6 w-48', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

function SkeletonCircle({
  size = 40,
  className,
  ...props
}: {
  size?: number;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <Skeleton
      className={cn('rounded-full', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    />
  );
}

function SkeletonAvatar({ size = 40, className, ...props }: { size?: number; className?: string } & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  return (
    <SkeletonCircle size={size} className={className} {...props} />
  );
}

function SkeletonButton({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <Skeleton
      className={cn('h-10 w-24 rounded-lg', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border p-4 space-y-3', className)} aria-hidden="true" {...props}>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

function SkeletonTableRow({ columns = 4, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { columns?: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 py-3', className)} aria-hidden="true" {...props}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4 flex-1"
          style={i === 0 ? { width: '30%' } : i === columns - 1 ? { width: '15%' } : undefined}
        />
      ))}
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonTitle,
  SkeletonCircle,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonCard,
  SkeletonTableRow,
  skeletonVariants,
};

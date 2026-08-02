import * as React from 'react';
import { cn } from '../lib/utils';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import type { DataSummaryItem, StatusTone } from './data-types';

export interface DataSummaryProps extends React.HTMLAttributes<HTMLDivElement> {
  items: DataSummaryItem[];
  columns?: 1 | 2 | 3 | 4;
  compact?: boolean;
  bordered?: boolean;
  divided?: boolean;
  orientation?: 'horizontal' | 'vertical';
  loading?: boolean;
  emptyTitle?: string;
}

const toneValueClasses: Record<StatusTone, string> = {
  neutral: '',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function SummaryItem({
  item,
  compact,
  bordered,
}: {
  item: DataSummaryItem;
  compact?: boolean;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex gap-3',
        bordered && 'border-b border-border last:border-b-0',
        compact ? 'py-1.5' : 'py-2.5',
      )}
    >
      {item.icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted" aria-hidden="true">
          {item.icon}
        </div>
      )}
      <dl className="flex-1 min-w-0">
        <dt className="text-xs font-medium text-text-muted">{item.label}</dt>
        <dd className={cn(
          'text-sm text-text-primary mt-0.5',
          item.tone && toneValueClasses[item.tone],
        )}>
          {item.value}
        </dd>
        {item.description && (
          <dd className="text-xs text-text-muted mt-0.5">{item.description}</dd>
        )}
      </dl>
    </div>
  );
}

const DataSummary = React.forwardRef<HTMLDivElement, DataSummaryProps>(
  (
    {
      className,
      items,
      columns = 2,
      compact = false,
      bordered = true,
      divided = false,
      orientation = 'vertical',
      loading = false,
      emptyTitle = 'No data available',
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div ref={ref} className={cn('space-y-3', className)} {...props}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          title={emptyTitle}
          compact
        />
      );
    }

    if (orientation === 'horizontal') {
      return (
        <div
          ref={ref}
          className={cn('space-y-0', className)}
          role="list"
          {...props}
        >
          {items.map((item, i) => (
            <SummaryItem key={i} item={item} compact={compact} bordered={bordered} />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'grid gap-x-6',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 sm:grid-cols-2',
          columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
          divided && 'divide-y divide-border',
          className,
        )}
        role="list"
        {...props}
      >
        {items.map((item, i) => (
          <div key={i} role="listitem">
            <SummaryItem item={item} compact={compact} bordered={!divided && bordered} />
          </div>
        ))}
      </div>
    );
  },
);
DataSummary.displayName = 'DataSummary';

export { DataSummary };
export type { DataSummaryItem };

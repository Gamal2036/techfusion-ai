import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { Skeleton } from './Skeleton';
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip';

export interface CitationProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof citationVariants> {
  index?: string | number;
  title?: string;
  source?: string;
  excerpt?: string;
  href?: string;
  icon?: React.ReactNode;
  confidence?: number;
  timestamp?: string;
  compact?: boolean;
  expanded?: boolean;
  loading?: boolean;
}

const citationVariants = cva(
  'group',
  {
    variants: {
      variant: {
        inline: 'inline-flex items-center gap-1 text-xs font-medium',
        card: 'block rounded-lg border border-border bg-surface-subtle p-3 text-sm',
        compact: 'inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle/50 px-2 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'card',
    },
  },
);

const Citation = React.forwardRef<HTMLDivElement, CitationProps>(
  (
    {
      className,
      index,
      title,
      source,
      excerpt,
      href,
      icon,
      confidence,
      timestamp,
      compact = false,
      expanded = false,
      loading = false,
      variant = 'card',
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div ref={ref} className={cn(citationVariants({ variant }), className)} {...props}>
          <Skeleton className="h-3 w-32" />
        </div>
      );
    }

    if (variant === 'inline') {
      return (
        <span
          ref={ref}
          className={cn(citationVariants({ variant }), className)}
          data-variant="inline"
          {...props}
        >
          {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-info underline underline-offset-2 hover:text-info/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              aria-label={`Citation: ${title || source || 'source'}`}
            >
              {index != null && <span className="mr-1">[{index}]</span>}
              {title || source}
            </a>
          ) : (
            <span>
              {index != null && <span className="mr-1">[{index}]</span>}
              {title || source}
            </span>
          )}
        </span>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          citationVariants({ variant }),
          compact && 'text-xs p-2',
          'transition-colors',
          href && 'hover:border-border-strong cursor-pointer',
          className,
        )}
        data-variant={variant}
        {...props}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {index != null && (
              <span className="shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                {index}
              </span>
            )}
            {icon && (
              <span className="shrink-0 mt-0.5 text-text-muted" aria-hidden="true">
                {icon}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {title && (
                <p className={cn(
                  'font-medium text-text-primary',
                  compact ? 'text-xs' : 'text-sm',
                  !expanded && 'truncate',
                )}>
                  {title}
                </p>
              )}
              {source && (
                <p className="text-xs text-text-muted mt-0.5 truncate">{source}</p>
              )}
              {excerpt && (
                <p className={cn(
                  'text-text-secondary mt-1',
                  compact ? 'text-xs line-clamp-1' : 'text-xs line-clamp-2',
                )}>
                  {excerpt}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {confidence != null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {Math.round(confidence * 100)}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>Confidence: {Math.round(confidence * 100)}%</TooltipContent>
              </Tooltip>
            )}
            {timestamp && (
              <time className="text-[10px] text-text-muted" dateTime={timestamp}>
                {timestamp}
              </time>
            )}
          </div>
        </div>

        {href && (
          <div className="mt-2">
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-info underline underline-offset-2 hover:text-info/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
              aria-label={`Open ${title || source || 'source'} in new tab`}
            >
              Open source
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </a>
          </div>
        )}
      </div>
    );
  },
);
Citation.displayName = 'Citation';

export { Citation, citationVariants };

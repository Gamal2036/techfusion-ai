import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { Skeleton } from './Skeleton';


type PromptCardVariant = 'default' | 'subtle' | 'outline' | 'glass';

export interface PromptCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof promptCardVariants> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  prompt?: string;
  category?: string;
  action?: () => void;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
  compact?: boolean;
}

const promptCardVariants = cva(
  'rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-border bg-card',
        subtle: 'border-border bg-surface-subtle',
        outline: 'border border-border bg-transparent',
        glass: 'border border-border bg-surface-subtle/60 backdrop-blur-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const PromptCard = React.forwardRef<HTMLDivElement, PromptCardProps>(
  (
    {
      className,
      title,
      description,
      icon,
      prompt,
      category,
      action,
      disabled = false,
      loading = false,
      selected = false,
      compact = false,
      variant = 'default' as PromptCardVariant,
      ...props
    },
    ref,
  ) => {
    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            'rounded-xl border border-border p-4 space-y-2',
            className,
          )}
          {...props}
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      );
    }

    const isInteractive = !!action && !disabled;

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (isInteractive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        action?.();
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          promptCardVariants({ variant }),
          compact && 'p-3',
          selected && 'border-primary/40 bg-primary/5 ring-1 ring-primary/20',
          isInteractive && 'cursor-pointer hover:border-border-strong hover:bg-surface-subtle/50',
          disabled && 'opacity-50 cursor-not-allowed',
          className,
        )}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-disabled={disabled || undefined}
        aria-pressed={selected || undefined}
        onClick={isInteractive ? action : undefined}
        onKeyDown={handleKeyDown}
        data-selected={selected}
        data-disabled={disabled}
        {...props}
      >
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {category && (
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                {category}
              </p>
            )}
            <p className={cn(
              'font-medium text-text-primary',
              compact ? 'text-xs' : 'text-sm',
            )}>
              {title}
            </p>
            {description && (
              <p className={cn(
                'text-text-muted mt-0.5',
                compact ? 'text-[10px]' : 'text-xs',
              )}>
                {description}
              </p>
            )}
          </div>
          {selected && (
            <svg
              className="h-5 w-5 text-primary shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </div>
      </div>
    );
  },
);
PromptCard.displayName = 'PromptCard';

export { PromptCard, promptCardVariants };

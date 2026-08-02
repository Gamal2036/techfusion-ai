import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { Skeleton } from './Skeleton';
import type { AIMessageType } from './data-types';

export interface AIMessageProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'content'>,
    VariantProps<typeof aiMessageVariants> {
  role: AIMessageType;
  content?: React.ReactNode;
  avatar?: React.ReactNode;
  author?: string;
  timestamp?: string;
  modelLabel?: string;
  status?: string;
  actions?: React.ReactNode;
  copyAction?: React.ReactNode;
  retryAction?: React.ReactNode;
  citationsSlot?: React.ReactNode;
  attachmentsSlot?: React.ReactNode;
  metadataSlot?: React.ReactNode;
  streaming?: boolean;
  loading?: boolean;
}

const aiMessageVariants = cva(
  'flex gap-3',
  {
    variants: {
      variant: {
        default: '',
        bubble: '',
        panel: '',
        minimal: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const roleStyles: Record<AIMessageType, { container: string; bubble: string; text: string }> = {
  user: {
    container: 'flex-row-reverse',
    bubble: 'bg-primary/10 border border-primary/20 rounded-2xl rounded-tr-sm',
    text: 'text-text-primary',
  },
  assistant: {
    container: '',
    bubble: 'bg-surface-subtle border border-border rounded-2xl rounded-tl-sm',
    text: 'text-text-primary',
  },
  system: {
    container: '',
    bubble: 'bg-info/5 border border-info/20 rounded-lg',
    text: 'text-info',
  },
  tool: {
    container: '',
    bubble: 'bg-surface-muted border border-border rounded-lg font-mono text-xs',
    text: 'text-text-secondary',
  },
  error: {
    container: '',
    bubble: 'bg-danger/5 border border-danger/20 rounded-lg',
    text: 'text-danger',
  },
};

const roleLabels: Record<AIMessageType, string> = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
  error: 'Error',
};

const AIMessage = React.forwardRef<HTMLDivElement, AIMessageProps>(
  (
    {
      className,
      role,
      content,
      avatar,
      author,
      timestamp,
      modelLabel,
      status,
      actions,
      copyAction,
      retryAction,
      citationsSlot,
      attachmentsSlot,
      metadataSlot,
      streaming = false,
      loading = false,
      variant = 'default',
      children,
      ...props
    },
    ref,
  ) => {
    const styles = roleStyles[role];
    const displayAuthor = author || roleLabels[role];

    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex gap-3',
            styles.container,
            variant === 'bubble' && 'px-2',
            className,
          )}
          data-role={role}
          {...props}
        >
          {avatar !== undefined && (
            <div className="shrink-0 h-8 w-8 rounded-full bg-surface-muted" />
          )}
          <div className="flex-1 space-y-2">
            {author !== undefined && <Skeleton className="h-3 w-20" />}
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          aiMessageVariants({ variant }),
          styles.container,
          variant === 'bubble' && 'px-2',
          variant === 'panel' && 'bg-surface-subtle/50 p-4 rounded-xl border border-border',
          variant === 'minimal' && 'py-1',
          className,
        )}
        data-role={role}
        data-variant={variant}
        data-streaming={streaming}
        {...props}
      >
        {avatar !== undefined && (
          <div className="shrink-0" aria-hidden="true">
            {avatar}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {(author !== undefined || timestamp !== undefined || modelLabel !== undefined) && (
            <div className="flex items-center gap-2 mb-1.5">
              {avatar === undefined && (
                <span className="text-xs font-semibold text-text-primary">{displayAuthor}</span>
              )}
              {avatar !== undefined && (
                <span className="text-xs font-semibold text-text-primary">{displayAuthor}</span>
              )}
              {modelLabel && (
                <span className="text-[10px] text-text-muted bg-surface-muted px-1.5 py-0.5 rounded-full">
                  {modelLabel}
                </span>
              )}
              {timestamp && (
                <time className="text-[10px] text-text-muted" dateTime={timestamp}>
                  {timestamp}
                </time>
              )}
              {status && (
                <span className="text-[10px] text-text-muted">{status}</span>
              )}
            </div>
          )}

          <div
            className={cn(
              'text-sm leading-relaxed',
              styles.text,
              variant === 'bubble' && styles.bubble && `p-3 ${styles.bubble}`,
              variant === 'minimal' && 'text-sm',
            )}
          >
            {content ?? children}
          </div>

          {streaming && (
            <span
              className="inline-block w-2 h-4 bg-primary-400 animate-pulse ml-0.5 align-middle"
              aria-label="Generating response"
            />
          )}

          {citationsSlot && <div className="mt-3">{citationsSlot}</div>}
          {attachmentsSlot && <div className="mt-2">{attachmentsSlot}</div>}
          {metadataSlot && <div className="mt-2">{metadataSlot}</div>}

          {(actions || copyAction || retryAction) && (
            <div className="flex items-center gap-2 mt-2">
              {copyAction}
              {retryAction}
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  },
);
AIMessage.displayName = 'AIMessage';

export { AIMessage, aiMessageVariants };

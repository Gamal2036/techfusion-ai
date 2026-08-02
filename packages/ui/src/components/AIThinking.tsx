import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import type { AIThinkingStatus } from './data-types';

export interface AIThinkingProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof aiThinkingVariants> {
  status?: AIThinkingStatus;
  label?: string;
  description?: string;
  steps?: string[];
  currentStep?: number;
  elapsedTime?: React.ReactNode;
  cancelAction?: React.ReactNode;
  compact?: boolean;
  expanded?: boolean;
  animated?: boolean;
}

const aiThinkingVariants = cva(
  'flex items-start gap-3',
  {
    variants: {
      layout: {
        dots: '',
        spinner: '',
        steps: '',
        pulse: '',
      },
    },
    defaultVariants: {
      layout: 'dots',
    },
  },
);

const statusLabels: Record<AIThinkingStatus, string> = {
  thinking: 'Thinking',
  searching: 'Searching',
  analyzing: 'Analyzing',
  generating: 'Generating',
  finalizing: 'Finalizing',
};

function AnimatedDots({ className }: { className?: string }) {
  const prefersReducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full bg-current',
            prefersReducedMotion ? 'opacity-60' : 'animate-pulse',
          )}
          style={prefersReducedMotion ? undefined : { animationDelay: `${i * 200}ms` }}
        />
      ))}
    </span>
  );
}

function PulseIndicator({ className }: { className?: string }) {
  const prefersReducedMotion =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  return (
    <div
      className={cn(
        'h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center',
        !prefersReducedMotion && 'animate-pulse',
        className,
      )}
      aria-hidden="true"
    >
      <div className="h-3 w-3 rounded-full bg-primary/60" />
    </div>
  );
}

const AIThinking = React.forwardRef<HTMLDivElement, AIThinkingProps>(
  (
    {
      className,
      status = 'thinking',
      label,
      description,
      steps,
      currentStep,
      elapsedTime,
      cancelAction,
      compact = false,
      expanded = false,
      animated = true,
      layout = 'dots',
      ...props
    },
    ref,
  ) => {
    const displayLabel = label || statusLabels[status];

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-label={displayLabel}
        className={cn(
          aiThinkingVariants({ layout }),
          compact && 'gap-2',
          className,
        )}
        {...props}
      >
        {layout === 'spinner' && (
          <LoadingSpinner size={compact ? 'xs' : 'sm'} label="" />
        )}
        {layout === 'dots' && <AnimatedDots className="mt-1" />}
        {layout === 'pulse' && <PulseIndicator />}
        {layout === 'steps' && (
          <div className="flex items-center gap-2">
            <LoadingSpinner size="xs" label="" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-medium text-text-primary',
              compact ? 'text-xs' : 'text-sm',
            )}>
              {displayLabel}
            </span>
            {animated && <AnimatedDots />}
          </div>

          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}

          {steps && steps.length > 0 && expanded && (
            <ol className="mt-2 space-y-1 text-xs list-none">
              {steps.map((step, i) => (
                <li
                  key={i}
                  className={cn(
                    'flex items-center gap-2',
                    i === currentStep && 'text-text-primary font-medium',
                    i !== currentStep && i < (currentStep ?? 0) && 'text-text-muted',
                    i !== currentStep && i > (currentStep ?? 0) && 'text-text-muted opacity-50',
                  )}
                >
                  {i < (currentStep ?? -1) ? (
                    <svg className="h-3 w-3 text-success shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i === currentStep ? (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-surface-muted shrink-0" aria-hidden="true" />
                  )}
                  {step}
                </li>
              ))}
            </ol>
          )}

          {(elapsedTime || cancelAction) && (
            <div className="flex items-center gap-3 mt-1.5">
              {elapsedTime && (
                <span className="text-[10px] text-text-muted">{elapsedTime}</span>
              )}
              {cancelAction}
            </div>
          )}
        </div>
      </div>
    );
  },
);
AIThinking.displayName = 'AIThinking';

export { AIThinking, aiThinkingVariants };

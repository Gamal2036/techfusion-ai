import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import type { TrendDirection } from './data-types';

export type TrendTone = 'automatic' | 'positive' | 'negative' | 'neutral';

export interface TrendIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof trendIndicatorVariants> {
  direction: TrendDirection;
  value?: string | number;
  label?: string;
  tone?: TrendTone;
  inverseMeaning?: boolean;
}

const trendIndicatorVariants = cva(
  'inline-flex items-center gap-1 text-xs font-medium tabular-nums',
  {
    variants: {
      layout: {
        inline: '',
        badge:
          'rounded-full px-2 py-0.5 border',
        compact: 'rounded-md px-1.5 py-0.5',
      },
    },
    defaultVariants: {
      layout: 'inline',
    },
  },
);

function getDirectionIcon(direction: TrendDirection) {
  if (direction === 'up') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function resolveTone(
  direction: TrendDirection,
  tone: TrendTone,
  inverseMeaning?: boolean,
): 'positive' | 'negative' | 'neutral' {
  if (tone !== 'automatic') return tone;

  if (direction === 'neutral') return 'neutral';

  const naturalPositive = direction === 'up';

  const effectivePositive = inverseMeaning ? !naturalPositive : naturalPositive;

  return effectivePositive ? 'positive' : 'negative';
}

function toneClasses(toneResult: 'positive' | 'negative' | 'neutral', layout: string | null) {
  if (toneResult === 'positive') {
    if (layout === 'badge') {
      return 'text-success border-success/20 bg-success/10';
    }
    return 'text-success';
  }
  if (toneResult === 'negative') {
    if (layout === 'badge') {
      return 'text-danger border-danger/20 bg-danger/10';
    }
    return 'text-danger';
  }
  if (layout === 'badge') {
    return 'text-text-muted border-border bg-surface-subtle';
  }
  return 'text-text-muted';
}

const TrendIndicator = React.forwardRef<HTMLDivElement, TrendIndicatorProps>(
  (
    {
      className,
      direction,
      value,
      label,
      tone = 'automatic',
      inverseMeaning,
      layout,
      ...props
    },
    ref,
  ) => {
    const resolvedTone = resolveTone(direction, tone, inverseMeaning);
    const icon = getDirectionIcon(direction);
    const displayLabel =
      label ??
      (direction === 'up'
        ? 'Increasing'
        : direction === 'down'
          ? 'Decreasing'
          : 'No change');

    return (
      <div
        ref={ref}
        className={cn(
          trendIndicatorVariants({ layout }),
          toneClasses(resolvedTone, layout ?? null),
          className,
        )}
        aria-label={`${displayLabel}${value != null ? `: ${value}` : ''}`}
        data-direction={direction}
        data-tone={resolvedTone}
        {...props}
      >
        {icon}
        {value != null && <span>{value}</span>}
      </div>
    );
  },
);
TrendIndicator.displayName = 'TrendIndicator';

export { TrendIndicator, trendIndicatorVariants };

import * as React from 'react';
import { cn } from '../lib/utils';

type ScoreVariant = 'health' | 'risk' | 'security';

interface ScorePillProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: number;
  variant: ScoreVariant;
}

const variantStyles: Record<ScoreVariant, { bg: string; text: string; bar: string }> = {
  health: {
    bg: 'bg-success/12',
    text: 'text-success',
    bar: 'bg-success',
  },
  risk: {
    bg: 'bg-warning/12',
    text: 'text-warning',
    bar: 'bg-warning',
  },
  security: {
    bg: 'bg-danger/12',
    text: 'text-danger',
    bar: 'bg-danger',
  },
};

function ScorePill({ label, value, variant, className, ...props }: ScorePillProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-2.5 border border-border',
        styles.bg,
        className,
      )}
      {...props}
    >
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <div className="h-1.5 flex-1 rounded-full bg-surface-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', styles.bar)}
            style={{ width: `${clamped}%` }}
          />
        </div>
        <span className={cn('text-sm font-semibold tabular-nums min-w-[2.5ch] text-right', styles.text)}>
          {clamped}
        </span>
      </div>
    </div>
  );
}

export { ScorePill };
export type { ScorePillProps, ScoreVariant };

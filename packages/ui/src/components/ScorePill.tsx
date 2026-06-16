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
    bg: 'bg-[rgba(34,197,94,0.12)]',
    text: 'text-green-400',
    bar: 'bg-green-500',
  },
  risk: {
    bg: 'bg-[rgba(234,179,8,0.12)]',
    text: 'text-amber-400',
    bar: 'bg-amber-500',
  },
  security: {
    bg: 'bg-[rgba(239,68,68,0.12)]',
    text: 'text-red-400',
    bar: 'bg-red-500',
  },
};

function ScorePill({ label, value, variant, className, ...props }: ScorePillProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-2.5 border border-white/[0.06]',
        styles.bg,
        className,
      )}
      {...props}
    >
      <span className="text-sm text-white/60">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
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

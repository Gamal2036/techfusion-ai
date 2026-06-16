'use client';

import { cn } from '@techfusion/ui';

interface ScoreGaugeProps {
  value: number;
  label?: string;
  variant: 'health' | 'performance' | 'risk';
  size?: 'sm' | 'md' | 'lg';
}

const config = {
  health: {
    label: 'Health',
    color: (v: number) => v >= 80 ? '#22c55e' : v >= 50 ? '#eab308' : '#ef4444',
    bg: 'rgba(34,197,94,0.08)',
    invert: false,
  },
  performance: {
    label: 'Performance',
    color: (v: number) => v >= 80 ? '#3b82f6' : v >= 50 ? '#eab308' : '#ef4444',
    bg: 'rgba(59,130,246,0.08)',
    invert: false,
  },
  risk: {
    label: 'Risk',
    color: (v: number) => v <= 20 ? '#22c55e' : v <= 50 ? '#eab308' : '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    invert: true,
  },
};

const sizes = {
  sm: { size: 80, stroke: 6, fontSize: 'text-lg' },
  md: { size: 100, stroke: 8, fontSize: 'text-2xl' },
  lg: { size: 140, stroke: 10, fontSize: 'text-3xl' },
};

export function ScoreGauge({ value, variant, size = 'md' }: ScoreGaugeProps) {
  const cfg = config[variant];
  const s = sizes[size];
  const radius = (s.size - s.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const displayValue = cfg.invert ? 100 - clamped : clamped;
  const offset = circumference - (displayValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: s.size, height: s.size }}>
        <svg width={s.size} height={s.size} className="-rotate-90">
          <circle
            cx={s.size / 2}
            cy={s.size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={s.stroke}
          />
          <circle
            cx={s.size / 2}
            cy={s.size / 2}
            r={radius}
            fill="none"
            stroke={cfg.color(clamped)}
            strokeWidth={s.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold tracking-tight', s.fontSize)} style={{ color: cfg.color(clamped) }}>
            {clamped}
          </span>
        </div>
      </div>
      <span className="text-xs text-white/50 font-medium uppercase tracking-wider">{cfg.label}</span>
    </div>
  );
}

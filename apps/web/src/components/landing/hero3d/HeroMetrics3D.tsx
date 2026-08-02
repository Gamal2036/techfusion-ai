'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Shield, Cpu, Activity, Zap } from 'lucide-react';
import type { QualityTier } from './config/hero3d.config';

interface Metric {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  gradient: string;
  position: string;
  delay: number;
  floatDuration: number;
  floatDelay: number;
  sparkline: number[];
}

const metrics: Metric[] = [
  {
    icon: <Cpu className="h-4 w-4" />,
    label: 'Active Devices',
    value: 2847,
    suffix: '',
    gradient: 'from-blue-500/15 to-cyan-500/15',
    position: 'left-[3%] top-[22%] hidden lg:flex',
    delay: 1.1,
    floatDuration: 7,
    floatDelay: 0,
    sparkline: [30, 45, 35, 55, 48, 62, 58, 72, 68, 80],
  },
  {
    icon: <Shield className="h-4 w-4" />,
    label: 'Threat Detection',
    value: 99.7,
    suffix: '%',
    gradient: 'from-emerald-500/15 to-green-500/15',
    position: 'right-[3%] top-[20%] hidden lg:flex',
    delay: 1.2,
    floatDuration: 8,
    floatDelay: 1.5,
    sparkline: [90, 92, 91, 94, 93, 96, 95, 98, 97, 99],
  },
  {
    icon: <Activity className="h-4 w-4" />,
    label: 'AI Analyses',
    value: 12,
    suffix: 'M+',
    gradient: 'from-purple-500/15 to-pink-500/15',
    position: 'left-[5%] bottom-[28%] hidden lg:flex',
    delay: 1.3,
    floatDuration: 7.5,
    floatDelay: 0.8,
    sparkline: [20, 35, 28, 45, 40, 55, 50, 65, 60, 72],
  },
  {
    icon: <Zap className="h-4 w-4" />,
    label: 'Response Time',
    value: 0.3,
    suffix: 'ms',
    gradient: 'from-amber-500/15 to-orange-500/15',
    position: 'right-[5%] bottom-[32%] hidden lg:flex',
    delay: 1.4,
    floatDuration: 6.5,
    floatDelay: 2.2,
    sparkline: [50, 42, 48, 35, 38, 30, 32, 25, 28, 20],
  },
];

function AnimatedCounter({
  value,
  suffix,
  duration = 1500,
}: {
  value: number;
  suffix: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const reducedMotion = useReducedMotion();
  const startTime = useRef<number | null>(null);
  const animFrame = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }

    const isDecimal = value % 1 !== 0;

    function tick(now: number) {
      if (!startTime.current) startTime.current = now;
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * value;
      setDisplay(
        isDecimal ? parseFloat(current.toFixed(1)) : Math.floor(current),
      );
      if (progress < 1) {
        animFrame.current = requestAnimationFrame(tick);
      }
    }

    animFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame.current);
  }, [value, duration, reducedMotion]);

  return (
    <span className="tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 60;
  const h = 20;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={w}
      height={h}
      className="opacity-40"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-400/60"
      />
    </svg>
  );
}

interface HeroMetrics3DProps {
  tier: QualityTier;
}

export function HeroMetrics3D({ tier }: HeroMetrics3DProps) {
  if (tier === 'reduced') return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      {metrics.map((metric) => (
        <motion.div
          key={metric.label}
          className={`absolute ${metric.position}`}
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.6,
            delay: metric.delay,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          <div
            className="pointer-events-auto transition-all duration-300 hover:scale-[1.03]"
            style={{
              animation: `float ${metric.floatDuration}s ease-in-out infinite ${metric.floatDelay}s`,
            }}
          >
            <div
              className={`flex items-center gap-3 rounded-xl border border-white/[0.06] bg-gradient-to-br ${metric.gradient} px-3.5 py-2.5 backdrop-blur-xl`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-white/50">
                {metric.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold text-white">
                    <AnimatedCounter
                      value={metric.value}
                      suffix={metric.suffix}
                    />
                  </div>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-medium text-white/35">
                    {metric.label}
                  </div>
                  <MiniSparkline data={metric.sparkline} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}

      <div className="absolute bottom-4 right-4 hidden sm:block">
        <span className="rounded-md border border-white/[0.05] bg-white/[0.03] px-2 py-1 text-[10px] font-medium text-white/20 backdrop-blur-sm">
          Demo data
        </span>
      </div>
    </div>
  );
}

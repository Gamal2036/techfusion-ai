'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Activity, Radar } from 'lucide-react';

/**
 * Visual specimen only — a mock command-center card rendered from static
 * demo data. Explicitly labeled SIMULATION; not wired to any real telemetry.
 */

const LATENCY_POINTS = [
  38, 32, 40, 28, 34, 24, 30, 20, 26, 18, 24, 16, 22, 14, 20, 12, 18, 14, 16, 10,
];

const NODES = [
  { x: 18, y: 30, tone: 'cyan' },
  { x: 42, y: 16, tone: 'cyan' },
  { x: 66, y: 34, tone: 'emerald' },
  { x: 84, y: 18, tone: 'cyan' },
  { x: 30, y: 62, tone: 'emerald' },
  { x: 56, y: 72, tone: 'cyan' },
  { x: 80, y: 60, tone: 'purple' },
] as const;

const LINKS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [0, 4],
  [4, 5],
  [5, 6],
  [2, 5],
] as const;

function sparklinePath(points: number[], width: number, height: number): string {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

const NODE_COLOR: Record<string, string> = {
  cyan: '#06b6d4',
  emerald: '#10b981',
  purple: '#8b5cf6',
};

export function HeroConsoleCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{ perspective: 1200 }}
      className="relative w-full max-w-lg"
    >
      {/* Glow bed */}
      <div
        aria-hidden="true"
        className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-cyan-500/15 via-transparent to-purple-500/15 blur-2xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/70 shadow-[0_0_60px_rgba(6,182,212,0.12)] backdrop-blur-xl">
        {/* Card header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-3">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-cyan-400" strokeWidth={1.5} />
            <span className="font-mono text-[11px] tracking-[0.18em] text-slate-300">
              DEFENSE GRID // SECTOR-07
            </span>
          </div>
          <span className="rounded border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.15em] text-purple-300">
            SIMULATION
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {/* Threat neutralization */}
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-[0.15em] text-slate-400">
                THREATS NEUTRALIZED
              </span>
            </div>
            <p className="mt-2 font-mono text-3xl font-bold text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]">
              1,284
            </p>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              LAST CYCLE · AUTO-RESPONSE 99.97%
            </p>
          </div>

          {/* Latency sparkline */}
          <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" strokeWidth={1.5} />
              <span className="font-mono text-[10px] tracking-[0.15em] text-slate-400">
                MESH LATENCY
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="font-mono text-3xl font-bold text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                10<span className="text-base text-slate-500">ms</span>
              </p>
              <svg
                viewBox="0 0 120 40"
                className="h-10 w-24 shrink-0"
                aria-hidden="true"
              >
                <path
                  d={sparklinePath(LATENCY_POINTS, 120, 40)}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.9"
                />
              </svg>
            </div>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              P99 TREND · 20 SAMPLES
            </p>
          </div>

          {/* Node map */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-4 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.15em] text-slate-400">
                NETWORK NODE MAP
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                7 NODES · MESH TOPOLOGY
              </span>
            </div>
            <svg viewBox="0 0 100 84" className="mt-3 h-28 w-full" aria-hidden="true">
              {LINKS.map(([a, b], i) => (
                <line
                  key={i}
                  x1={NODES[a].x}
                  y1={NODES[a].y}
                  x2={NODES[b].x}
                  y2={NODES[b].y}
                  stroke="#06b6d4"
                  strokeWidth="0.4"
                  opacity="0.35"
                />
              ))}
              {NODES.map((n, i) => (
                <g key={i}>
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r="4"
                    fill={NODE_COLOR[n.tone]}
                    opacity="0.15"
                  >
                    <animate
                      attributeName="r"
                      values="3;5;3"
                      dur={`${2 + i * 0.3}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle cx={n.x} cy={n.y} r="1.6" fill={NODE_COLOR[n.tone]} />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Scanline sweep */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <motion.div
            className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan-400/[0.06] to-transparent"
            animate={{ top: ['-10%', '110%'] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>
    </motion.div>
  );
}

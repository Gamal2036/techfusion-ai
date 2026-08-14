'use client';

import { motion } from 'framer-motion';
import { ShieldHalf, Network, Wrench, BrainCircuit } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Pillar {
  id: string;
  icon: LucideIcon;
  code: string;
  title: string;
  description: string;
  accent: 'cyan' | 'emerald' | 'purple';
  span: string;
}

const PILLARS: Pillar[] = [
  {
    id: 'cybersecurity',
    icon: ShieldHalf,
    code: 'MODULE // SEC-01',
    title: 'Cybersecurity',
    description:
      'Autonomous threat hunting with a zero-trust protocol at the core. Every packet interrogated, every anomaly neutralized before impact.',
    accent: 'cyan',
    span: 'lg:col-span-3',
  },
  {
    id: 'network',
    icon: Network,
    code: 'MODULE // NET-02',
    title: 'Network Architecture',
    description:
      'AI-driven mesh topology that reroutes around failure in real time, with instant diagnostics across every node.',
    accent: 'purple',
    span: 'lg:col-span-2',
  },
  {
    id: 'support',
    icon: Wrench,
    code: 'MODULE // OPS-03',
    title: 'IT Support',
    description:
      'A predictive self-healing maintenance agent that resolves incidents before your team ever files a ticket.',
    accent: 'emerald',
    span: 'lg:col-span-2',
  },
  {
    id: 'intelligence',
    icon: BrainCircuit,
    code: 'MODULE // AI-04',
    title: 'AI Intelligence',
    description:
      'A multi-agent neural assistant orchestrating security, network, and operations decisions as one coordinated mind.',
    accent: 'purple',
    span: 'lg:col-span-3',
  },
];

const ACCENT = {
  cyan: {
    border: 'hover:border-cyan-500/50',
    glow: 'group-hover:shadow-[0_0_40px_rgba(6,182,212,0.15)]',
    icon: 'text-cyan-400 group-hover:drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]',
    code: 'text-cyan-500/70',
    beam: 'from-cyan-500/60',
  },
  emerald: {
    border: 'hover:border-emerald-500/50',
    glow: 'group-hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]',
    icon: 'text-emerald-400 group-hover:drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]',
    code: 'text-emerald-500/70',
    beam: 'from-emerald-500/60',
  },
  purple: {
    border: 'hover:border-purple-500/50',
    glow: 'group-hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]',
    icon: 'text-purple-400 group-hover:drop-shadow-[0_0_12px_rgba(139,92,246,0.8)]',
    code: 'text-purple-500/70',
    beam: 'from-purple-500/60',
  },
} as const;

export function CorePillars() {
  return (
    <section id="pillars" className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="mb-14 max-w-2xl"
        >
          <p className="font-mono text-[11px] tracking-[0.25em] text-cyan-500/80">
            [ CORE PILLARS ]
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Four systems. One autonomous organism.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-slate-400">
            Each pillar is a capability platform engineered to operate alone —
            and designed to be unstoppable together.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {PILLARS.map((pillar, i) => {
            const a = ACCENT[pillar.accent];
            const Icon = pillar.icon;
            return (
              <motion.article
                key={pillar.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.08,
                  ease: [0.23, 1, 0.32, 1],
                }}
                className={`group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/50 p-6 backdrop-blur-sm transition-all duration-500 sm:col-span-1 ${pillar.span} ${a.border} ${a.glow}`}
              >
                {/* Top beam */}
                <div
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.beam} to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                />
                {/* Corner brackets */}
                <div
                  aria-hidden="true"
                  className="absolute right-3 top-3 h-3 w-3 border-r border-t border-slate-700 transition-colors duration-500 group-hover:border-slate-500"
                />
                <div
                  aria-hidden="true"
                  className="absolute bottom-3 left-3 h-3 w-3 border-b border-l border-slate-700 transition-colors duration-500 group-hover:border-slate-500"
                />

                <Icon
                  className={`h-8 w-8 transition-all duration-500 ${a.icon}`}
                  strokeWidth={1.25}
                />
                <p className={`mt-5 font-mono text-[10px] tracking-[0.2em] ${a.code}`}>
                  {pillar.code}
                </p>
                <h3 className="mt-2 text-lg font-bold tracking-tight text-slate-100">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {pillar.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

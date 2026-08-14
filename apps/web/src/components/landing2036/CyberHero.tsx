'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronRight, Terminal } from 'lucide-react';
import { HeroConsoleCard } from './HeroConsoleCard';

const EASE = [0.23, 1, 0.32, 1] as const;

export function CyberHero() {
  return (
    <section
      aria-label="Hero section"
      className="relative flex min-h-screen items-center px-4 pt-24 pb-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2">
        {/* Copy */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3.5 py-1.5"
          >
            <Terminal className="h-3.5 w-3.5 text-cyan-400" strokeWidth={1.5} />
            <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300">
              NEO-CYBERSECURITY OPERATIONS · 2036
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="mt-6 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-slate-50 sm:text-5xl lg:text-6xl"
          >
            Next-Gen{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(6,182,212,0.35)]">
              Autonomous Defense
            </span>{' '}
            &amp; Network Intelligence
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            One unified intelligence layer where AI-driven cybersecurity,
            self-healing IT support, and adaptive network infrastructure operate
            in seamless synergy — a command center for the machines that run
            your world.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: EASE }}
            className="mt-8 flex flex-col gap-4 sm:flex-row"
          >
            <Link
              href="/signup"
              className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg bg-cyan-500 px-7 py-3.5 font-mono text-sm font-bold tracking-[0.1em] text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.45)] transition-all duration-300 hover:bg-cyan-400 hover:shadow-[0_0_50px_rgba(6,182,212,0.65)]"
            >
              LAUNCH CONSOLE
              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#pillars"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/40 px-7 py-3.5 font-mono text-sm font-semibold tracking-[0.1em] text-slate-300 backdrop-blur-sm transition-all duration-300 hover:border-purple-500/50 hover:text-purple-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.25)]"
            >
              EXPLORE NODES
            </Link>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-[0.15em] text-slate-600"
          >
            <span>ZERO-TRUST NATIVE</span>
            <span aria-hidden="true" className="h-3 w-px bg-slate-800" />
            <span>MULTI-AGENT RUNTIME</span>
            <span aria-hidden="true" className="h-3 w-px bg-slate-800" />
            <span>SELF-HEALING MESH</span>
          </motion.div>
        </div>

        {/* Visual specimen */}
        <div className="flex justify-center lg:justify-end">
          <HeroConsoleCard />
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/**
 * Scripted CLI simulation for the marketing page. All log lines are static
 * demo copy replayed on a timer — explicitly labeled SIMULATION, never real
 * telemetry.
 */

interface LogLine {
  tag: 'SCAN' | 'THREAT' | 'FIX' | 'NET' | 'AI' | 'OK';
  text: string;
}

const SCRIPT: LogLine[] = [
  { tag: 'SCAN', text: 'perimeter sweep initiated · 4,096 endpoints queued' },
  { tag: 'NET', text: 'mesh topology re-balanced · path cost -12%' },
  { tag: 'THREAT', text: 'anomalous lateral movement detected · node K-42' },
  { tag: 'AI', text: 'agent SENTINEL dispatched · isolating segment 0x2F' },
  { tag: 'FIX', text: 'compromised session revoked · credentials rotated' },
  { tag: 'OK', text: 'threat neutralized in 340ms · zero data egress' },
  { tag: 'SCAN', text: 'firmware integrity check · 4,096/4,096 verified' },
  { tag: 'AI', text: 'predictive model flags disk D-7 · failure ETA 72h' },
  { tag: 'FIX', text: 'workload migrated off D-7 · replacement ticketed' },
  { tag: 'NET', text: 'latency spike on uplink B · rerouted via mesh-3' },
  { tag: 'OK', text: 'all systems nominal · defense grid at 100%' },
];

const TAG_STYLE: Record<LogLine['tag'], string> = {
  SCAN: 'text-cyan-400',
  THREAT: 'text-red-400',
  FIX: 'text-emerald-400',
  NET: 'text-purple-400',
  AI: 'text-cyan-300',
  OK: 'text-emerald-400',
};

function timestamp(offset: number): string {
  const s = (offset * 2.4) % 60;
  const m = Math.floor((offset * 2.4) / 60) % 60;
  return `04:${String(12 + m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}`;
}

export function TelemetryTerminal() {
  const [visibleCount, setVisibleCount] = useState(3);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((c) => (c >= SCRIPT.length ? 3 : c + 1));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const lines = SCRIPT.slice(0, visibleCount);

  return (
    <section id="telemetry" className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="mb-10 text-center"
        >
          <p className="font-mono text-[11px] tracking-[0.25em] text-emerald-500/80">
            [ LIVE TELEMETRY ]
          </p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Watch the grid defend itself
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden rounded-xl border border-slate-800 bg-[#02040a]/90 shadow-[0_0_50px_rgba(6,182,212,0.08)] backdrop-blur-xl"
        >
          {/* Terminal chrome */}
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-2.5">
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            </div>
            <span className="font-mono text-[10px] tracking-[0.18em] text-slate-500">
              tf-agent — defense.log — SIMULATION
            </span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[9px] tracking-[0.15em] text-emerald-400/80">
                STREAMING
              </span>
            </span>
          </div>

          {/* Log body */}
          <div
            ref={scrollRef}
            role="log"
            aria-label="Simulated system event log"
            className="h-64 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed sm:text-[13px]"
          >
            {lines.map((line, i) => (
              <motion.div
                key={`${line.tag}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-wrap gap-x-2 py-0.5"
              >
                <span className="text-slate-600">{timestamp(i)}</span>
                <span className={`font-bold ${TAG_STYLE[line.tag]}`}>
                  [{line.tag}]
                </span>
                <span className="text-slate-300">{line.text}</span>
              </motion.div>
            ))}
            <div className="flex items-center gap-1 py-0.5" aria-hidden="true">
              <span className="text-cyan-500">{'>'}</span>
              <motion.span
                className="inline-block h-3.5 w-2 bg-cyan-400/80"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

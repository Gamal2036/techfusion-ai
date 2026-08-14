import Link from 'next/link';
import { Hexagon } from 'lucide-react';

const FOOTER_LINKS = [
  { label: 'Console', href: '/login' },
  { label: 'Initialize', href: '/signup' },
  { label: 'Pillars', href: '#pillars' },
  { label: 'Telemetry', href: '#telemetry' },
];

const STATUS_NODES = [
  { label: 'SEC', tone: 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.9)]' },
  { label: 'NET', tone: 'bg-purple-400 shadow-[0_0_6px_rgba(139,92,246,0.9)]' },
  { label: 'OPS', tone: 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]' },
  { label: 'AI', tone: 'bg-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.9)]' },
];

export function CyberFooter() {
  return (
    <footer className="relative px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      {/* Glowing separator */}
      <div
        aria-hidden="true"
        className="mx-auto h-px max-w-7xl bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent shadow-[0_0_12px_rgba(6,182,212,0.4)]"
      />

      <div className="mx-auto mt-8 flex max-w-7xl flex-col items-center gap-6 md:flex-row md:justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2"
          aria-label="TechFusion AI - Home"
        >
          <Hexagon className="h-5 w-5 text-cyan-500/70" strokeWidth={1.25} />
          <span className="font-mono text-xs tracking-[0.2em] text-slate-400">
            TECHFUSION <span className="text-cyan-400">AI</span> · 2036
          </span>
        </Link>

        {/* Status nodes */}
        <div className="flex items-center gap-4" aria-label="Subsystem status">
          {STATUS_NODES.map((node) => (
            <span key={node.label} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${node.tone}`}
              />
              <span className="font-mono text-[10px] tracking-[0.15em] text-slate-500">
                {node.label}
              </span>
            </span>
          ))}
        </div>

        {/* Links */}
        <nav aria-label="Footer navigation" className="flex items-center gap-5">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="font-mono text-[11px] tracking-[0.12em] text-slate-500 transition-colors hover:text-cyan-300"
            >
              {link.label.toUpperCase()}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-8 text-center font-mono text-[10px] tracking-[0.15em] text-slate-700">
        © 2036 TECHFUSION AI — ALL NODES RESERVED
      </p>
    </footer>
  );
}

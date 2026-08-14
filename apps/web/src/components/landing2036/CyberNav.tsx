'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Hexagon } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Pillars', href: '#pillars' },
  { label: 'Telemetry', href: '#telemetry' },
  { label: 'Console', href: '/login' },
  { label: 'Docs', href: '#docs' },
];

export function CyberNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'border-b border-cyan-500/10 bg-[#030712]/80 shadow-[0_4px_30px_rgba(6,182,212,0.06)] backdrop-blur-2xl'
          : 'bg-transparent'
      }`}
      role="banner"
    >
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5"
          aria-label="TechFusion AI - Home"
        >
          <div className="relative flex h-9 w-9 items-center justify-center">
            <Hexagon
              className="h-9 w-9 text-cyan-400/80 transition-all duration-300 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]"
              strokeWidth={1}
            />
            <span className="absolute font-mono text-[10px] font-bold tracking-tighter text-cyan-300">
              TF
            </span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold tracking-[0.2em] text-slate-100">
              TECHFUSION
              <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.7)]">
                {' '}
                AI
              </span>
            </span>
            <span className="mt-1 hidden items-center gap-1.5 sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
              </span>
              <span className="font-mono text-[9px] tracking-[0.15em] text-emerald-400/90">
                SYSTEMS OPERATIONAL — VER 2036.4
              </span>
            </span>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md px-3.5 py-2 font-mono text-xs tracking-[0.12em] text-slate-400 transition-colors duration-200 hover:bg-cyan-500/5 hover:text-cyan-300"
            >
              {link.label.toUpperCase()}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/signup"
            className="group relative overflow-hidden rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 font-mono text-xs font-semibold tracking-[0.12em] text-cyan-300 transition-all duration-300 hover:border-cyan-400/60 hover:bg-cyan-500/20 hover:shadow-[0_0_24px_rgba(6,182,212,0.35)]"
          >
            <span className="relative z-10">INITIALIZE SYSTEM</span>
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-cyan-500/10 hover:text-cyan-300 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden border-t border-cyan-500/10 bg-[#030712]/95 backdrop-blur-2xl md:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                >
                  <Link
                    href={link.href}
                    onClick={closeMobile}
                    className="block rounded-md px-3 py-2.5 font-mono text-sm tracking-[0.12em] text-slate-400 transition-colors hover:bg-cyan-500/5 hover:text-cyan-300"
                  >
                    {link.label.toUpperCase()}
                  </Link>
                </motion.div>
              ))}
              <div className="pt-3">
                <Link
                  href="/signup"
                  onClick={closeMobile}
                  className="block rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-center font-mono text-xs font-semibold tracking-[0.12em] text-cyan-300"
                >
                  INITIALIZE SYSTEM
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

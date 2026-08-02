'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, cn } from '@techfusion/ui';
import { Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Features', href: '#features' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Documentation', href: '#docs' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-[#080b16]/80 backdrop-blur-2xl border-b border-white/[0.05] shadow-[0_1px_0_rgba(255,255,255,0.02),0_4px_20px_rgba(0,0,0,0.3)]'
          : 'bg-transparent',
      )}
      role="banner"
    >
      <nav
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white"
          aria-label="TechFusion AI - Home"
        >
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 opacity-90 transition-all duration-300 group-hover:opacity-100 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]" />
            <span className="relative text-sm font-bold text-white">TF</span>
          </div>
          <span className="hidden sm:inline">
            Tech<span className="text-blue-400">Fusion</span>
          </span>
        </Link>

        <div className="hidden items-center gap-0.5 md:flex" role="list">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="nav-link-underline rounded-lg px-3.5 py-2 text-[13px] font-medium text-white/45 transition-colors duration-200 hover:text-white/90 hover:bg-white/[0.03]"
              role="listitem"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/50 hover:text-white hover:bg-white/[0.05]"
            >
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="relative bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.25)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all duration-300 border border-white/[0.08]"
            >
              Get Started
            </Button>
          </Link>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/[0.05] hover:text-white md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden border-t border-white/[0.05] bg-[#080b16]/95 backdrop-blur-2xl md:hidden"
          >
            <div className="space-y-1 px-6 py-4">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                >
                  <Link
                    href={link.href}
                    onClick={closeMobile}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <div className="flex flex-col gap-3 pt-4">
                <Link href="/login" onClick={closeMobile}>
                  <Button
                    variant="ghost"
                    fullWidth
                    className="text-white/55 hover:text-white"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup" onClick={closeMobile}>
                  <Button
                    fullWidth
                    className="bg-blue-600 text-white hover:bg-blue-500"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

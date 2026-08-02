'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@techfusion/ui';
import { ArrowRight, Play } from 'lucide-react';

interface HeroCTAProps {
  onWatchDemo?: () => void;
}

export function HeroCTA({ onWatchDemo }: HeroCTAProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1.0, ease: [0.23, 1, 0.32, 1] }}
    >
      <Link href="/signup">
        <Button
          size="lg"
          className="group relative overflow-hidden bg-blue-600 text-white hover:bg-blue-500 px-8 shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-all duration-500 border border-white/[0.08]"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <span className="absolute inset-0 rounded-[inherit] border border-white/[0.1] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <span className="relative flex items-center gap-2.5">
            Get Started
            <ArrowRight className="h-4 w-4 transition-all duration-300 group-hover:translate-x-1 group-hover:scale-110" />
          </span>
        </Button>
      </Link>

      <Button
        variant="ghost"
        size="lg"
        className="group relative overflow-hidden text-white/50 hover:text-white border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all duration-400 px-8 backdrop-blur-sm"
        onClick={onWatchDemo}
      >
        <span className="flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-all duration-300 group-hover:border-blue-400/30 group-hover:bg-blue-500/[0.1] group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Play className="h-3 w-3 fill-current transition-transform duration-300 group-hover:scale-110" />
          </span>
          Watch Demo
        </span>
      </Button>
    </motion.div>
  );
}

'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2.0, duration: 0.6 }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/20">
          Scroll
        </span>
        <div className="relative flex flex-col items-center">
          <motion.div
            className="w-[1px] bg-gradient-to-b from-blue-400/30 to-transparent"
            animate={{ height: [30, 50, 30], opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-400/40"
            animate={{ opacity: [0.2, 0.6, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.5,
            }}
          />
        </div>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-3.5 w-3.5 text-white/15" />
        </motion.div>
      </div>
    </motion.div>
  );
}

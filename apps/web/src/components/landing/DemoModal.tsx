'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function DemoPreview() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/40 via-[#080b16] to-purple-950/30" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        <div className="relative">
          <div className="h-24 w-24 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm" />
          <motion.div
            className="absolute inset-0 rounded-2xl border border-blue-500/20"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">
            Real-time AI Dashboard
          </h3>
          <p className="text-sm text-white/40 max-w-sm">
            Monitor devices, detect threats, and manage your infrastructure
            with intelligent automation.
          </p>
        </div>

        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="h-16 w-32 rounded-lg border border-white/[0.05] bg-white/[0.02]"
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DemoModal({ isOpen, onClose }: DemoModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0d18]/95 shadow-2xl backdrop-blur-2xl"
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Product demo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
                <h2 className="text-base font-semibold text-white">
                  Experience TechFusion AI
                </h2>
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
                  aria-label="Close demo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="aspect-video overflow-hidden">
                <DemoPreview />
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.06] px-6 py-4">
                <p className="text-sm text-white/35">
                  Preview of the TechFusion AI dashboard experience.
                </p>
                <a
                  href="/signup"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                >
                  Get Started
                </a>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

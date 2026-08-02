'use client';

import { motion } from 'framer-motion';

export function SceneFallback() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="relative">
        <motion.div
          className="h-[280px] w-[280px] sm:h-[340px] sm:w-[340px] lg:h-[400px] lg:w-[400px] rounded-full"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(59,130,246,0.12) 0%, rgba(6,182,212,0.06) 40%, transparent 70%)',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5], scale: [0.98, 1.02, 0.98] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          <svg
            viewBox="0 0 120 160"
            className="h-[180px] w-[135px] sm:h-[220px] sm:w-[165px] lg:h-[260px] lg:w-[195px]"
          >
            <defs>
              <linearGradient id="headGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
                <stop offset="100%" stopColor="rgba(6,182,212,0.1)" />
              </linearGradient>
            </defs>
            <ellipse
              cx="60"
              cy="60"
              rx="38"
              ry="48"
              fill="none"
              stroke="url(#headGrad)"
              strokeWidth="1"
              opacity="0.6"
            />
            <ellipse
              cx="60"
              cy="55"
              rx="35"
              ry="42"
              fill="none"
              stroke="rgba(59,130,246,0.15)"
              strokeWidth="0.5"
            />
            <rect
              x="50"
              y="108"
              width="20"
              height="25"
              rx="8"
              fill="none"
              stroke="rgba(59,130,246,0.2)"
              strokeWidth="0.8"
            />
            <ellipse
              cx="48"
              cy="55"
              rx="6"
              ry="2.5"
              fill="none"
              stroke="rgba(96,165,250,0.4)"
              strokeWidth="0.8"
            />
            <ellipse
              cx="72"
              cy="55"
              rx="6"
              ry="2.5"
              fill="none"
              stroke="rgba(96,165,250,0.4)"
              strokeWidth="0.8"
            />
            {[20, 35, 50, 65, 80].map((y) => (
              <line
                key={y}
                x1={25}
                y1={y}
                x2={95}
                y2={y}
                stroke="rgba(59,130,246,0.06)"
                strokeWidth="0.3"
              />
            ))}
          </svg>
        </motion.div>
        <motion.div
          className="absolute -bottom-2 left-1/2 h-[1px] w-32 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

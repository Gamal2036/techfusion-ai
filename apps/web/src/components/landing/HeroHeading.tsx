'use client';

import { motion } from 'framer-motion';

const headingWords = ['AI', 'That', 'Understands', 'Your', 'Infrastructure'];

export function HeroHeading() {
  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-blue-500/20 bg-blue-500/[0.07] px-4 py-1.5 text-xs font-medium tracking-wide text-blue-300/80 backdrop-blur-sm"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
        </span>
        Enterprise AI Platform
      </motion.div>

      <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
        {headingWords.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            className={`mr-[0.28em] inline-block ${
              word === 'AI' ? 'hero-gradient-text text-glow-blue' : ''
            }`}
            initial={{ opacity: 0, y: 25, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{
              duration: 0.6,
              delay: 0.5 + i * 0.07,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {word}
          </motion.span>
        ))}
      </h1>

      <motion.p
        className="mx-auto mt-7 max-w-2xl text-base leading-[1.8] text-white/35 sm:text-lg md:text-xl"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.9, ease: [0.23, 1, 0.32, 1] }}
      >
        Unified device intelligence, real-time monitoring, and autonomous
        cybersecurity — powered by next-generation artificial intelligence.
      </motion.p>
    </div>
  );
}

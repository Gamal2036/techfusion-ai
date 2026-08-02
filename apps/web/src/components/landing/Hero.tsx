'use client';

import { useState, lazy, Suspense } from 'react';
import { HeroBackground } from './HeroBackground';
import { HeroHeading } from './HeroHeading';
import { HeroCTA } from './HeroCTA';
import { HeroMetrics3D } from './hero3d/HeroMetrics3D';
import { ScrollIndicator } from './ScrollIndicator';
import { DemoModal } from './DemoModal';
import { SceneFallback } from './hero3d/SceneFallback';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { detectQualityTier } from './hero3d/config/hero3d.config';

const Hero3DCanvas = lazy(() =>
  import('./hero3d/Hero3DCanvas').then((m) => ({ default: m.Hero3DCanvas })),
);

export function Hero() {
  const [demoOpen, setDemoOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const tier =
    typeof window !== 'undefined'
      ? detectQualityTier(window.innerWidth, reducedMotion)
      : 'high';

  return (
    <section
      className="relative flex h-screen min-h-[600px] w-full flex-col items-center justify-center overflow-hidden"
      aria-label="Hero section"
    >
      <HeroBackground />

      <div className="absolute inset-0" aria-hidden="true">
        <Suspense fallback={<SceneFallback />}>
          <Hero3DCanvas />
        </Suspense>
      </div>

      <div className="relative z-10 flex w-full max-w-7xl flex-col items-center px-6 lg:px-8">
        <HeroHeading />

        <div className="mt-8 md:mt-10">
          <HeroCTA onWatchDemo={() => setDemoOpen(true)} />
        </div>
      </div>

      <HeroMetrics3D tier={tier} />
      <ScrollIndicator />
      <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
    </section>
  );
}

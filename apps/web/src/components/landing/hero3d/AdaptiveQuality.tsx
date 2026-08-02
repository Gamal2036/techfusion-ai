'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import {
  detectQualityTier,
  type QualityTier,
} from './config/hero3d.config';

interface QualityContextValue {
  tier: QualityTier;
  setTier: (tier: QualityTier) => void;
}

const QualityContext = createContext<QualityContextValue>({
  tier: 'high',
  setTier: () => {},
});

export function useQualityTier() {
  return useContext(QualityContext);
}

interface AdaptiveQualityProps {
  prefersReducedMotion: boolean;
  children: React.ReactNode;
}

export function AdaptiveQuality({
  prefersReducedMotion,
  children,
}: AdaptiveQualityProps) {
  const [tier, setTier] = useState<QualityTier>('high');

  useEffect(() => {
    const width = window.innerWidth;
    setTier(detectQualityTier(width, prefersReducedMotion));
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setTier('reduced');
      return;
    }

    const handleResize = () => {
      const width = window.innerWidth;
      setTier(detectQualityTier(width, false));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const checkPerformance = () => {
      if (typeof navigator === 'undefined') return;
      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      };
      if (nav.connection?.saveData) {
        setTier((prev: QualityTier) => (prev === 'high' ? 'medium' : prev));
      }
      if (
        nav.connection?.effectiveType === 'slow-2g' ||
        nav.connection?.effectiveType === '2g'
      ) {
        setTier((prev: QualityTier) => (prev === 'high' ? 'low' : prev));
      }
    };

    checkPerformance();
  }, [prefersReducedMotion]);

  return (
    <QualityContext.Provider value={{ tier, setTier }}>
      {children}
    </QualityContext.Provider>
  );
}

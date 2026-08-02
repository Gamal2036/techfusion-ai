'use client';

import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { AdaptiveQuality, useQualityTier } from './AdaptiveQuality';
import { Hero3DScene } from './Hero3DScene';
import { SceneFallback } from './SceneFallback';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { getDprMax } from './config/hero3d.config';

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch {
    return false;
  }
}

function CanvasScene() {
  const { tier } = useQualityTier();
  const dprMax = getDprMax(tier);

  return (
    <Canvas
      dpr={[1, dprMax]}
      camera={{
        fov: 45,
        near: 0.1,
        far: 100,
        position: [0, 0.3, 5.5],
      }}
      gl={{
        antialias: tier !== 'low',
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden="true"
    >
      <Suspense fallback={null}>
        <Hero3DScene />
      </Suspense>
    </Canvas>
  );
}

interface Hero3DCanvasProps {
  className?: string;
}

export function Hero3DCanvas({ className = '' }: Hero3DCanvasProps) {
  const reducedMotion = useReducedMotion();
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setWebglSupported(checkWebGLSupport());
  }, []);

  if (webglSupported === null) {
    return (
      <div className={`absolute inset-0 ${className}`} aria-hidden="true">
        <SceneFallback />
      </div>
    );
  }

  if (!webglSupported) {
    return (
      <div className={`absolute inset-0 ${className}`} aria-hidden="true">
        <SceneFallback />
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-700 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      } ${className}`}
      aria-hidden="true"
    >
      <SceneErrorBoundary>
        <AdaptiveQuality prefersReducedMotion={reducedMotion}>
          <CanvasScene />
        </AdaptiveQuality>
      </SceneErrorBoundary>
      {!isLoaded && <SceneFallback />}
    </div>
  );
}

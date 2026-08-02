'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { AIHead } from './AIHead';
import { NeuralNetwork } from './NeuralNetwork';
import { FormationParticles } from './FormationParticles';
import { SceneEnvironment } from './SceneEnvironment';
import { SceneLighting } from './SceneLighting';
import { SceneCamera } from './SceneCamera';
import { useQualityTier } from './AdaptiveQuality';

export function Hero3DScene() {
  const { tier } = useQualityTier();
  const groupRef = useRef<Group>(null);
  const [formationProgress, setFormationProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const startTime = useRef<number | null>(null);

  useFrame(({ clock }) => {
    if (startTime.current === null) {
      startTime.current = clock.getElapsedTime();
    }

    const elapsed = (clock.getElapsedTime() - startTime.current) * 1000;
    const entranceDuration = 1600;
    const progress = Math.min(elapsed / entranceDuration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    setFormationProgress(eased);
  });

  useEffect(() => {
    const handleVisibility = () => {
      setIsVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return (
    <>
      <SceneCamera tier={tier} isVisible={isVisible} />
      <SceneLighting />
      <SceneEnvironment tier={tier} />

      <group ref={groupRef}>
        <AIHead formationProgress={formationProgress} tier={tier} />
        <NeuralNetwork formationProgress={formationProgress} tier={tier} />
        <FormationParticles
          formationProgress={formationProgress}
          tier={tier}
        />
      </group>
    </>
  );
}

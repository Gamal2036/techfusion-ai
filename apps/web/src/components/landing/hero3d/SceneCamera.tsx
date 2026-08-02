'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { hero3dConfig, type QualityTier } from './config/hero3d.config';

interface SceneCameraProps {
  tier: QualityTier;
  isVisible: boolean;
}

export function SceneCamera({ tier, isVisible }: SceneCameraProps) {
  const { camera } = useThree();
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetPos = useRef(
    new THREE.Vector3(...hero3dConfig.camera.initialPosition),
  );
  const entranceComplete = useRef(false);
  const entranceStart = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(({ clock }) => {
    if (!isVisible) return;

    const t = clock.getElapsedTime();

    if (entranceStart.current === null) {
      entranceStart.current = t;
    }

    const elapsed = (t - entranceStart.current) * 1000;
    const entranceDuration = 1200;
    const entranceProgress = Math.min(elapsed / entranceDuration, 1);
    const eased = 1 - Math.pow(1 - entranceProgress, 3);

    const initial = new THREE.Vector3(...hero3dConfig.camera.initialPosition);
    const target = new THREE.Vector3(...hero3dConfig.camera.targetPosition);
    const basePos = new THREE.Vector3().lerpVectors(initial, target, eased);

    if (entranceProgress >= 1 && !entranceComplete.current) {
      entranceComplete.current = true;
    }

    if (entranceComplete.current) {
      const parallaxStrength = hero3dConfig.camera.parallaxFactor;
      const parallaxX = mouseRef.current.x * parallaxStrength * 0.15;
      const parallaxY = -mouseRef.current.y * parallaxStrength * 0.08;

      basePos.x += parallaxX + Math.sin(t * 0.15) * 0.03;
      basePos.y += parallaxY + Math.sin(t * 0.12) * 0.02;
    }

    camera.position.lerp(basePos, 0.04);
    camera.lookAt(0, 0.15, 0);
  });

  return null;
}

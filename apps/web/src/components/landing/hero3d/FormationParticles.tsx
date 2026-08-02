'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hero3dConfig, type QualityTier } from './config/hero3d.config';

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface FormationParticlesProps {
  formationProgress: number;
  tier: QualityTier;
}

export function FormationParticles({
  formationProgress,
  tier,
}: FormationParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const particleCount =
    tier === 'high' ? 600 : tier === 'medium' ? 350 : tier === 'low' ? 150 : 0;

  const { geometry, targetPositions, startPositions } = useMemo(() => {
    const rand = seededRandom(123);
    const count = particleCount;
    const pos = new Float32Array(count * 3);
    const tgt = new Float32Array(count * 3);
    const start = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = 0.6 + rand() * 0.5;

      const tx = r * Math.sin(phi) * Math.cos(theta);
      const ty = r * Math.cos(phi) * 0.9 + 0.15;
      const tz = r * Math.sin(phi) * Math.sin(theta) * 0.85;

      tgt[i * 3] = tx;
      tgt[i * 3 + 1] = ty;
      tgt[i * 3 + 2] = tz;

      const spread = 4 + rand() * 6;
      const angle = rand() * Math.PI * 2;
      start[i * 3] = Math.cos(angle) * spread + (rand() - 0.5) * 3;
      start[i * 3 + 1] = (rand() - 0.5) * spread;
      start[i * 3 + 2] = Math.sin(angle) * spread + (rand() - 0.5) * 3;

      pos[i * 3] = start[i * 3];
      pos[i * 3 + 1] = start[i * 3 + 1];
      pos[i * 3 + 2] = start[i * 3 + 2];
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    return {
      geometry: geo,
      targetPositions: tgt,
      startPositions: start,
    };
  }, [particleCount]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uFormation;
        varying float vAlpha;
        void main() {
          float pulse = sin(uTime * 1.5 + position.x * 3.0 + position.y * 2.0) * 0.2 + 0.8;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (2.0 + pulse * 1.5) * (120.0 / -mv.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 8.0);
          vAlpha = pulse * 0.6 * smoothstep(0.0, 0.5, uFormation);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow = pow(glow, 2.0);
          gl_FragColor = vec4(uColor, glow * vAlpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
        uColor: {
          value: new THREE.Color(hero3dConfig.colors.neuralSecondary),
        },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    material.uniforms.uFormation.value = formationProgress;

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < arr.length / 3; i++) {
      const i3 = i * 3;
      const progress = formationProgress;

      arr[i3] = THREE.MathUtils.lerp(startPositions[i3], targetPositions[i3], progress);
      arr[i3 + 1] = THREE.MathUtils.lerp(
        startPositions[i3 + 1],
        targetPositions[i3 + 1],
        progress,
      );
      arr[i3 + 2] = THREE.MathUtils.lerp(
        startPositions[i3 + 2],
        targetPositions[i3 + 2],
        progress,
      );

      if (progress > 0.8) {
        const orbit = (1 - progress) * 0.5;
        arr[i3] += Math.sin(t * 0.5 + i * 0.1) * orbit;
        arr[i3 + 1] += Math.cos(t * 0.3 + i * 0.15) * orbit;
      }
    }
    posAttr.needsUpdate = true;

    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.02;
    }
  });

  if (particleCount === 0) return null;

  return (
    <points ref={pointsRef} geometry={geometry} material={material} />
  );
}

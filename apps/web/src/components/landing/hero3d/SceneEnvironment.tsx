'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hero3dConfig, type QualityTier } from './config/hero3d.config';

function PerspectiveGrid() {
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vDist = length(wp.xz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vDist;
        void main() {
          vec2 grid = abs(fract(vUv * 20.0 - 0.5) - 0.5) / fwidth(vUv * 20.0);
          float line = min(grid.x, grid.y);
          float gridAlpha = 1.0 - min(line, 1.0);
          float fade = exp(-vDist * 0.6);
          float pulse = sin(uTime * 0.3 + vDist * 0.5) * 0.1 + 0.9;
          vec3 col = vec3(0.1, 0.15, 0.27);
          float a = gridAlpha * fade * 0.12 * pulse;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} material={material}>
      <planeGeometry args={[20, 20, 1, 1]} />
    </mesh>
  );
}

function DepthParticles({ tier }: { tier: QualityTier }) {
  const pointsRef = useRef<THREE.Points>(null);

  const count =
    tier === 'high' ? 400 : tier === 'medium' ? 250 : tier === 'low' ? 100 : 0;

  const { geometry, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
      spd[i] = 0.1 + Math.random() * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geometry: geo, speeds: spd };
  }, [count]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec3 pos = position;
          pos.y += sin(uTime * 0.3 + position.x * 0.5) * 0.1;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = 1.5 * (100.0 / -mv.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 4.0);
          float dist = length(position.xz);
          vAlpha = 0.15 * (1.0 - smoothstep(2.0, 8.0, dist));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(0.4, 0.55, 0.85, glow * vAlpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.005;
    }
  });

  if (count === 0) return null;

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function AuroraBackground() {
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          float n1 = sin(uv.x * 3.0 + uTime * 0.15) * cos(uv.y * 2.0 + uTime * 0.1);
          float n2 = sin(uv.x * 5.0 - uTime * 0.12) * sin(uv.y * 4.0 + uTime * 0.08);
          float n3 = cos(uv.x * 2.0 + uTime * 0.1) * sin(uv.y * 3.0 - uTime * 0.15);
          float v = (n1 + n2 + n3) * 0.33;
          v = v * 0.5 + 0.5;
          vec3 blue = vec3(0.15, 0.35, 0.75);
          vec3 cyan = vec3(0.1, 0.5, 0.65);
          vec3 purple = vec3(0.3, 0.2, 0.6);
          vec3 col = mix(blue, cyan, n1 * 0.5 + 0.5);
          col = mix(col, purple, n2 * 0.3 + 0.3);
          float fade = smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.6, uv.y);
          fade *= smoothstep(0.0, 0.2, uv.x) * smoothstep(1.0, 0.8, uv.x);
          float a = v * 0.06 * fade;
          if (a < 0.005) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={ref} position={[0, 1, -6]} material={material}>
      <planeGeometry args={[20, 12, 1, 1]} />
    </mesh>
  );
}

function CentralGlow() {
  const ref = useRef<THREE.Mesh>(null);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float d = length(center);
          float glow = exp(-d * 5.0);
          float pulse = sin(uTime * 0.5) * 0.15 + 0.85;
          vec3 col = vec3(0.15, 0.35, 0.75);
          float a = glow * 0.15 * pulse;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={ref} position={[0, 0.15, -0.5]} material={material}>
      <planeGeometry args={[6, 6, 1, 1]} />
    </mesh>
  );
}

interface SceneEnvironmentProps {
  tier: QualityTier;
}

export function SceneEnvironment({ tier }: SceneEnvironmentProps) {
  return (
    <group>
      <PerspectiveGrid />
      <DepthParticles tier={tier} />
      {tier === 'high' && <AuroraBackground />}
      <CentralGlow />
      <fog attach="fog" args={[hero3dConfig.colors.fogColor, 5, 18]} />
    </group>
  );
}

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

interface NeuralNode {
  position: THREE.Vector3;
  size: number;
  phase: number;
  speed: number;
  type: number;
}

function generateNeuralNodes(count: number): NeuralNode[] {
  const rand = seededRandom(42);
  const nodes: NeuralNode[] = [];

  for (let i = 0; i < count; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = rand() * Math.PI;
    const r = 0.3 + rand() * 0.6;

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * 0.85 + 0.15;
    const z = r * Math.sin(phi) * Math.sin(theta) * 0.9;

    nodes.push({
      position: new THREE.Vector3(x, y, z),
      size: 1.5 + rand() * 3,
      phase: rand() * Math.PI * 2,
      speed: 0.5 + rand() * 2,
      type: rand() > 0.5 ? 1 : 0,
    });
  }
  return nodes;
}

interface NeuralNetworkProps {
  formationProgress: number;
  tier: QualityTier;
}

export function NeuralNetwork({ formationProgress, tier }: NeuralNetworkProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const nodeCount = tier === 'high' ? 80 : tier === 'medium' ? 50 : tier === 'low' ? 30 : 20;
  const connectionDist = tier === 'high' ? 1.8 : tier === 'medium' ? 1.5 : 1.2;

  const nodes = useMemo(() => generateNeuralNodes(nodeCount), [nodeCount]);

  const { pointsGeo, linesGeo } = useMemo(() => {
    const positions = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    const phases = new Float32Array(nodes.length);
    const speeds = new Float32Array(nodes.length);
    const types = new Float32Array(nodes.length);

    nodes.forEach((node, i) => {
      positions[i * 3] = node.position.x;
      positions[i * 3 + 1] = node.position.y;
      positions[i * 3 + 2] = node.position.z;
      sizes[i] = node.size;
      phases[i] = node.phase;
      speeds[i] = node.speed;
      types[i] = node.type;
    });

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    pGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    pGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    pGeo.setAttribute('aType', new THREE.BufferAttribute(types, 1));

    const linePositions: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < connectionDist) {
          linePositions.push(
            nodes[i].position.x,
            nodes[i].position.y,
            nodes[i].position.z,
            nodes[j].position.x,
            nodes[j].position.y,
            nodes[j].position.z,
          );
        }
      }
    }

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3),
    );

    return { pointsGeo: pGeo, linesGeo: lGeo };
  }, [nodes, connectionDist]);

  const pointsMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute float aSpeed;
        attribute float aType;
        uniform float uTime;
        uniform float uFormation;
        varying float vAlpha;
        varying float vType;
        void main() {
          vec3 pos = position;
          float pulse = sin(uTime * aSpeed + aPhase);
          float fs = smoothstep(0.0, 1.0, uFormation);
          pos *= fs;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          float sz = aSize * (0.8 + pulse * 0.4) * fs;
          gl_PointSize = sz * (150.0 / -mv.z);
          gl_PointSize = clamp(gl_PointSize, 0.5, 16.0);
          vAlpha = (0.4 + pulse * 0.35) * fs;
          vType = aType;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorPrimary;
        uniform vec3 uColorSecondary;
        varying float vAlpha;
        varying float vType;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float glow = 1.0 - smoothstep(0.0, 0.5, d);
          glow = pow(glow, 1.5);
          vec3 col = mix(uColorPrimary, uColorSecondary, vType);
          col += glow * 0.3;
          gl_FragColor = vec4(col, glow * vAlpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
        uColorPrimary: {
          value: new THREE.Color(hero3dConfig.colors.neuralPrimary),
        },
        uColorSecondary: {
          value: new THREE.Color(hero3dConfig.colors.neuralSecondary),
        },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const linesMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uFormation;
        varying float vAlpha;
        void main() {
          float fs = smoothstep(0.0, 1.0, uFormation);
          float pulse = sin(uTime * 0.8 + position.y * 3.0) * 0.2 + 0.8;
          vAlpha = 0.08 * fs * pulse;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position * fs, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.01) discard;
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
        uColor: { value: new THREE.Color(hero3dConfig.colors.neuralPrimary) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    pointsMaterial.uniforms.uTime.value = t;
    pointsMaterial.uniforms.uFormation.value = formationProgress;
    linesMaterial.uniforms.uTime.value = t;
    linesMaterial.uniforms.uFormation.value = formationProgress;

    if (pointsRef.current) {
      pointsRef.current.rotation.y = Math.sin(t * 0.05) * 0.02;
    }
  });

  return (
    <group position={[0, 0.15, 0]}>
      <points ref={pointsRef} geometry={pointsGeo} material={pointsMaterial} />
      <lineSegments ref={linesRef} geometry={linesGeo} material={linesMaterial} />
    </group>
  );
}

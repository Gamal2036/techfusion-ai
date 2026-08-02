'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { hero3dConfig, type QualityTier } from './config/hero3d.config';

function createHeadGeometry(segments: number) {
  const group = new THREE.Group();

  const craniumGeo = new THREE.SphereGeometry(0.72, segments, segments, 0, Math.PI * 2, 0, Math.PI * 0.65);
  const craniumMesh = new THREE.Mesh(craniumGeo);
  craniumMesh.position.set(0, 0.35, 0);
  craniumMesh.scale.set(1, 1.15, 0.95);
  group.add(craniumMesh);

  const faceGeo = new THREE.SphereGeometry(0.68, segments, segments, 0, Math.PI * 2, Math.PI * 0.15, Math.PI * 0.55);
  const faceMesh = new THREE.Mesh(faceGeo);
  faceMesh.position.set(0, 0.18, 0.08);
  faceMesh.scale.set(0.95, 1.0, 0.85);
  group.add(faceMesh);

  const jawGeo = new THREE.SphereGeometry(0.5, segments, segments, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.35);
  const jawMesh = new THREE.Mesh(jawGeo);
  jawMesh.position.set(0, -0.08, 0.12);
  jawMesh.scale.set(0.85, 0.55, 0.75);
  group.add(jawMesh);

  const neckGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.5, segments, 1);
  const neckMesh = new THREE.Mesh(neckGeo);
  neckMesh.position.set(0, -0.45, 0);
  group.add(neckMesh);

  const shoulderGeo = new THREE.CylinderGeometry(0.8, 0.55, 0.25, segments, 1, true, Math.PI * 0.15, Math.PI * 0.7);
  const shoulderMesh = new THREE.Mesh(shoulderGeo);
  shoulderMesh.position.set(0, -0.72, -0.05);
  shoulderMesh.rotation.x = Math.PI * 0.05;
  group.add(shoulderMesh);

  return group;
}

function mergeToBufferGeometry(group: THREE.Group): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const cloned = child.geometry.clone();
      child.updateWorldMatrix(true, false);
      cloned.applyMatrix4(child.matrixWorld);
      geometries.push(cloned);
    }
  });

  if (geometries.length === 0) return new THREE.BufferGeometry();

  const mergedGeo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let indexOffset = 0;

  for (const geo of geometries) {
    const posAttr = geo.getAttribute('position');
    const normAttr = geo.getAttribute('normal');
    const idxAttr = geo.getIndex();

    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      if (normAttr) {
        normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
      }
    }

    if (idxAttr) {
      for (let i = 0; i < idxAttr.count; i++) {
        indices.push(idxAttr.getX(i) + indexOffset);
      }
    }
    indexOffset += posAttr.count;
    geo.dispose();
  }

  mergedGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  if (normals.length > 0) {
    mergedGeo.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3),
    );
  }
  if (indices.length > 0) {
    mergedGeo.setIndex(indices);
  }

  return mergedGeo;
}

interface AIHeadProps {
  formationProgress: number;
  tier: QualityTier;
}

export function AIHead({ formationProgress, tier }: AIHeadProps) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const wireframeMatRef = useRef<THREE.ShaderMaterial>(null);

  const segments = tier === 'high' ? 64 : tier === 'medium' ? 48 : tier === 'low' ? 32 : 24;

  const { solidGeo, wireframeGeo, edgeGeo } = useMemo(() => {
    const group = createHeadGeometry(segments);
    const solid = mergeToBufferGeometry(group);

    const wireframe = solid.clone();
    const edges = new THREE.EdgesGeometry(solid, 20);

    return { solidGeo: solid, wireframeGeo: wireframe, edgeGeo: edges };
  }, [segments]);

  const solidMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uFormation;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying float vFresnel;
        varying float vScan;
        void main() {
          vec3 pos = position;
          float breathe = sin(uTime * 0.5) * 0.008;
          pos *= 1.0 + breathe;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWorldPos = wp.xyz;
          vNormal = normalize(normalMatrix * normal);
          vec3 vd = normalize(cameraPosition - wp.xyz);
          vFresnel = 1.0 - max(dot(vd, vNormal), 0.0);
          vScan = sin(wp.y * 8.0 - uTime * 2.0) * 0.5 + 0.5;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uFormation;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying float vFresnel;
        varying float vScan;
        void main() {
          vec3 coreColor = vec3(0.06, 0.15, 0.35);
          vec3 edgeColor = vec3(0.37, 0.65, 1.0);
          float fp = pow(vFresnel, 2.5);
          vec3 col = mix(coreColor, edgeColor, fp * 0.7);
          float scanLine = sin(vWorldPos.y * 40.0 - uTime * 3.0) * 0.5 + 0.5;
          scanLine = pow(scanLine, 8.0) * 0.12;
          col += edgeColor * scanLine;
          col += edgeColor * vScan * 0.15;
          float a = 0.88 * uFormation;
          a *= mix(0.45, 1.0, fp);
          a += scanLine * 0.3;
          a = clamp(a, 0.0, 1.0);
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
  }, []);

  const wireframeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uFormation;
        varying float vAlpha;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 vd = normalize(cameraPosition - wp.xyz);
          vec3 n = normalize(normalMatrix * normal);
          float fresnel = 1.0 - max(dot(vd, n), 0.0);
          vAlpha = pow(fresnel, 1.5) * 0.35 * uFormation;
          vAlpha *= 0.6 + sin(uTime * 0.8 + position.y * 3.0) * 0.2;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.02) discard;
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
        uColor: { value: new THREE.Color(hero3dConfig.colors.neuralPrimary) },
      },
      transparent: true,
      wireframe: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const edgeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform float uFormation;
        varying float vAlpha;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vec3 vd = normalize(cameraPosition - wp.xyz);
          vec3 n = normalize(normalMatrix * normal);
          float fresnel = 1.0 - max(dot(vd, n), 0.0);
          vAlpha = pow(fresnel, 2.0) * 0.5 * uFormation;
          vAlpha *= 0.7 + sin(uTime * 1.2 + position.y * 4.0) * 0.3;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.02) discard;
          gl_FragColor = vec4(uColor, vAlpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
        uColor: { value: new THREE.Color(hero3dConfig.colors.hologramEdge) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    solidMaterial.uniforms.uTime.value = t;
    solidMaterial.uniforms.uFormation.value = formationProgress;
    wireframeMaterial.uniforms.uTime.value = t;
    wireframeMaterial.uniforms.uFormation.value = formationProgress;
    edgeMaterial.uniforms.uTime.value = t;
    edgeMaterial.uniforms.uFormation.value = formationProgress;

    if (groupRef.current) {
      groupRef.current.rotation.y =
        Math.sin(t * hero3dConfig.head.idleRotationSpeed) * 0.04;
    }
  });

  return (
    <group ref={groupRef} position={hero3dConfig.head.position}>
      <mesh geometry={solidGeo} material={solidMaterial} />
      <lineSegments geometry={edgeGeo} material={edgeMaterial} />
      {tier !== 'low' && tier !== 'reduced' && (
        <mesh geometry={wireframeGeo} material={wireframeMaterial} />
      )}

      <AIHeadEyes formationProgress={formationProgress} />

      <ScanLines
        formationProgress={formationProgress}
        enabled={tier === 'high' || tier === 'medium'}
      />

      <EnergyRings
        formationProgress={formationProgress}
        enabled={tier === 'high' || tier === 'medium'}
      />
    </group>
  );
}

function AIHeadEyes({ formationProgress }: { formationProgress: number }) {
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const leftGlowRef = useRef<THREE.Mesh>(null);
  const rightGlowRef = useRef<THREE.Mesh>(null);

  const eyeMaterial = useMemo(() => {
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
        uniform float uFormation;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float d = length(center);
          float pulse = sin(uTime * 1.2) * 0.12 + 0.88;
          float inner = 1.0 - smoothstep(0.0, 0.25, d);
          float mid = 1.0 - smoothstep(0.15, 0.4, d);
          float outer = 1.0 - smoothstep(0.3, 0.5, d);
          vec3 innerCol = vec3(0.85, 0.93, 1.0) * inner * pulse;
          vec3 midCol = vec3(0.35, 0.65, 1.0) * mid * 0.6 * pulse;
          vec3 outerCol = vec3(0.15, 0.4, 0.8) * outer * 0.3;
          vec3 col = innerCol + midCol + outerCol;
          float a = outer * uFormation * pulse;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const glowMaterial = useMemo(() => {
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
        uniform float uFormation;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float d = length(center);
          float glow = exp(-d * 4.0);
          float pulse = sin(uTime * 0.8) * 0.15 + 0.85;
          vec3 col = vec3(0.35, 0.6, 1.0);
          float a = glow * 0.25 * uFormation * pulse;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    eyeMaterial.uniforms.uTime.value = t;
    eyeMaterial.uniforms.uFormation.value = formationProgress;
    glowMaterial.uniforms.uTime.value = t;
    glowMaterial.uniforms.uFormation.value = formationProgress;
  });

  return (
    <group position={[0, 0.32, 0.55]}>
      <mesh ref={leftEyeRef} position={[-0.18, 0, 0.06]} material={eyeMaterial}>
        <planeGeometry args={[0.16, 0.06, 1, 1]} />
      </mesh>
      <mesh ref={rightEyeRef} position={[0.18, 0, 0.06]} material={eyeMaterial}>
        <planeGeometry args={[0.16, 0.06, 1, 1]} />
      </mesh>
      <mesh ref={leftGlowRef} position={[-0.18, 0, 0.04]} material={glowMaterial}>
        <planeGeometry args={[0.4, 0.25, 1, 1]} />
      </mesh>
      <mesh ref={rightGlowRef} position={[0.18, 0, 0.04]} material={glowMaterial}>
        <planeGeometry args={[0.4, 0.25, 1, 1]} />
      </mesh>
    </group>
  );
}

function ScanLines({
  formationProgress,
  enabled,
}: {
  formationProgress: number;
  enabled: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

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
        uniform float uOffset;
        uniform float uFormation;
        varying vec2 vUv;
        void main() {
          float y = vUv.y;
          float scan = sin(y * 60.0 - uTime * 3.0 + uOffset) * 0.5 + 0.5;
          scan = pow(scan, 10.0);
          float sweep = sin(uTime * 0.5 + uOffset * 2.0) * 0.5 + 0.5;
          float line = 1.0 - smoothstep(0.0, 0.02, abs(y - sweep));
          vec3 col = vec3(0.37, 0.65, 1.0);
          float a = (scan * 0.1 + line * 0.4) * uFormation;
          if (a < 0.01) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uOffset: { value: 0 },
        uFormation: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
    material.uniforms.uFormation.value = formationProgress;
  });

  if (!enabled) return null;

  return (
    <group ref={groupRef}>
      {[0, 2.1, 4.2].map((offset, i) => (
        <mesh key={i} position={[0, 0.15, 0.7]} material={material.clone()}>
          <planeGeometry args={[1.5, 1.2, 1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function EnergyRings({
  formationProgress,
  enabled,
}: {
  formationProgress: number;
  enabled: boolean;
}) {
  const ringRefs = useRef<THREE.Mesh[]>([]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uFormation;
        varying vec3 vPos;
        void main() {
          float pulse = sin(uTime * 1.5 + vPos.x * 5.0) * 0.2 + 0.8;
          vec3 col = vec3(0.23, 0.51, 0.96);
          float a = 0.15 * uFormation * pulse;
          gl_FragColor = vec4(col, a);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uFormation: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    material.uniforms.uFormation.value = formationProgress;

    ringRefs.current.forEach((ring, i) => {
      if (ring) {
        ring.rotation.x = Math.sin(t * (0.3 + i * 0.1)) * 0.3;
        ring.rotation.z = t * (0.15 + i * 0.05) * (i % 2 === 0 ? 1 : -1);
      }
    });
  });

  if (!enabled) return null;

  const rings = [
    { rx: 1.1, ry: 0.3, pos: [0, 0.2, 0] as [number, number, number] },
    { rx: 1.3, ry: 0.35, pos: [0, 0.1, 0] as [number, number, number] },
    { rx: 0.95, ry: 0.25, pos: [0, 0.3, 0] as [number, number, number] },
  ];

  return (
    <group>
      {rings.map((ring, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) ringRefs.current[i] = el;
          }}
          position={ring.pos}
          material={material}
        >
          <torusGeometry args={[ring.rx, 0.003, 8, 100]} />
        </mesh>
      ))}
    </group>
  );
}

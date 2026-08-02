'use client';

import { hero3dConfig } from './config/hero3d.config';

export function SceneLighting() {
  const c = hero3dConfig.colors;
  const l = hero3dConfig.lighting;

  return (
    <group>
      <ambientLight intensity={l.ambientIntensity} color={c.keyLight} />

      <directionalLight
        position={[3, 4, 5]}
        intensity={l.keyIntensity}
        color={c.keyLight}
        castShadow={false}
      />

      <directionalLight
        position={[-4, 2, -3]}
        intensity={l.rimIntensity}
        color={c.rimLight}
      />

      <pointLight
        position={[0, 0.5, 2]}
        intensity={l.fillIntensity}
        color={c.fillLight}
        distance={10}
        decay={2}
      />

      <pointLight
        position={[0, 0.15, 0.3]}
        intensity={l.pointIntensity}
        color={c.neuralPrimary}
        distance={3}
        decay={2}
      />

      <spotLight
        position={[-2, 5, 3]}
        angle={0.4}
        penumbra={0.8}
        intensity={0.6}
        color={c.keyLight}
        distance={15}
        decay={2}
      />
    </group>
  );
}

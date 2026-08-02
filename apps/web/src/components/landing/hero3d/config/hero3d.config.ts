export type QualityTier = 'high' | 'medium' | 'low' | 'reduced';

interface QualityConfig {
  particleCount: number;
  neuralNodeCount: number;
  neuralConnectionDistance: number;
  headSegments: number;
  enablePostProcessing: boolean;
  enableScanLines: boolean;
  enableEnergyRings: boolean;
  enableFormationParticles: boolean;
  enableBackgroundParticles: boolean;
  backgroundParticleCount: number;
  dprMax: number;
  cameraParallaxStrength: number;
}

export const QUALITY_TIERS: Record<QualityTier, QualityConfig> = {
  high: {
    particleCount: 600,
    neuralNodeCount: 80,
    neuralConnectionDistance: 1.8,
    headSegments: 64,
    enablePostProcessing: true,
    enableScanLines: true,
    enableEnergyRings: true,
    enableFormationParticles: true,
    enableBackgroundParticles: true,
    backgroundParticleCount: 400,
    dprMax: 2,
    cameraParallaxStrength: 1.0,
  },
  medium: {
    particleCount: 350,
    neuralNodeCount: 50,
    neuralConnectionDistance: 1.5,
    headSegments: 48,
    enablePostProcessing: false,
    enableScanLines: true,
    enableEnergyRings: true,
    enableFormationParticles: true,
    enableBackgroundParticles: true,
    backgroundParticleCount: 250,
    dprMax: 1.5,
    cameraParallaxStrength: 0.7,
  },
  low: {
    particleCount: 150,
    neuralNodeCount: 30,
    neuralConnectionDistance: 1.2,
    headSegments: 32,
    enablePostProcessing: false,
    enableScanLines: false,
    enableEnergyRings: true,
    enableFormationParticles: true,
    enableBackgroundParticles: false,
    backgroundParticleCount: 100,
    dprMax: 1.2,
    cameraParallaxStrength: 0.4,
  },
  reduced: {
    particleCount: 0,
    neuralNodeCount: 20,
    neuralConnectionDistance: 1.0,
    headSegments: 24,
    enablePostProcessing: false,
    enableScanLines: false,
    enableEnergyRings: false,
    enableFormationParticles: false,
    enableBackgroundParticles: false,
    backgroundParticleCount: 0,
    dprMax: 1,
    cameraParallaxStrength: 0,
  },
};

export interface Hero3DConfig {
  camera: {
    fov: number;
    near: number;
    far: number;
    initialPosition: [number, number, number];
    targetPosition: [number, number, number];
    maxRotationX: number;
    maxRotationY: number;
    dampingFactor: number;
    parallaxFactor: number;
  };
  head: {
    position: [number, number, number];
    scale: number;
    breatheSpeed: number;
    breatheAmplitude: number;
    idleRotationSpeed: number;
  };
  entrance: {
    ambientDelay: number;
    ambientDuration: number;
    headDelay: number;
    headDuration: number;
    detailDelay: number;
    detailDuration: number;
    textDelay: number;
    textDuration: number;
  };
  colors: {
    background: string;
    keyLight: string;
    rimLight: string;
    fillLight: string;
    neuralPrimary: string;
    neuralSecondary: string;
    hologramCore: string;
    hologramEdge: string;
    eyeCore: string;
    fogColor: string;
    gridColor: string;
  };
  lighting: {
    keyIntensity: number;
    rimIntensity: number;
    fillIntensity: number;
    ambientIntensity: number;
    pointIntensity: number;
  };
}

export const hero3dConfig: Hero3DConfig = {
  camera: {
    fov: 45,
    near: 0.1,
    far: 100,
    initialPosition: [0, 0.3, 5.5],
    targetPosition: [0, 0, 4.2],
    maxRotationX: 0.08,
    maxRotationY: 0.12,
    dampingFactor: 0.05,
    parallaxFactor: 0.6,
  },
  head: {
    position: [0, 0.15, 0],
    scale: 1.0,
    breatheSpeed: 0.5,
    breatheAmplitude: 0.008,
    idleRotationSpeed: 0.08,
  },
  entrance: {
    ambientDelay: 0,
    ambientDuration: 500,
    headDelay: 200,
    headDuration: 900,
    detailDelay: 500,
    detailDuration: 1000,
    textDelay: 400,
    textDuration: 700,
  },
  colors: {
    background: '#050710',
    keyLight: '#c8d8ff',
    rimLight: '#4a8eff',
    fillLight: '#6366f1',
    neuralPrimary: '#3b82f6',
    neuralSecondary: '#06b6d4',
    hologramCore: '#1e40af',
    hologramEdge: '#60a5fa',
    eyeCore: '#93c5fd',
    fogColor: '#050710',
    gridColor: '#1a2744',
  },
  lighting: {
    keyIntensity: 1.2,
    rimIntensity: 2.0,
    fillIntensity: 0.4,
    ambientIntensity: 0.15,
    pointIntensity: 1.5,
  },
};

export function getDprMax(tier: QualityTier): number {
  return QUALITY_TIERS[tier].dprMax;
}

export function detectQualityTier(
  viewportWidth: number,
  prefersReducedMotion: boolean,
): QualityTier {
  if (prefersReducedMotion) return 'reduced';
  if (viewportWidth < 640) return 'low';
  if (viewportWidth < 1024) return 'medium';
  return 'high';
}

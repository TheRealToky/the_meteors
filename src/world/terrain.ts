import * as THREE from 'three';
import { fbm2D, simplex2D } from './noise';

export interface TerrainConfig {
  size: number;
  segments: number;
  maxHeight: number;
  terraceStep: number;
  terraceBlend: number;
}

const DEFAULT_CONFIG: TerrainConfig = {
  size: 240,
  segments: 160, // Smooth high-res mesh for dreamlike curves
  maxHeight: 19, // Believable, grounded mountain proportions
  terraceStep: 2.8,
  terraceBlend: 0.65, // Gentle stepped agricultural hills with organic transitions
};

/**
 * Calculates smooth, organic elevation at (x, z) using fractal simplex noise
 * and smooth stepped agricultural terraces (inspired by Rwanda's rolling green hills).
 */
export function calculateTerrainElevation(
  x: number,
  z: number,
  config: TerrainConfig = DEFAULT_CONFIG
): number {
  // Broad rolling hills
  const baseNoise = fbm2D(x * 0.0065, z * 0.0065, 3, 2.0, 0.45);
  // Gentle ridge and valley sculpting
  const ridgeNoise = simplex2D(x * 0.013, z * 0.013) * 0.25;
  // Subtle organic micro-variation
  const detailNoise = simplex2D(x * 0.035, z * 0.035) * 0.08;

  const rawH = (baseNoise + ridgeNoise + detailNoise) * config.maxHeight;

  // Smooth agricultural terrace function:
  // Instead of sharp discontinuous steps, use an S-curve for gentle terrace slopes
  const stepVal = rawH / config.terraceStep;
  const stepIdx = Math.floor(stepVal);
  const frac = stepVal - stepIdx;

  // S-curve terrace profile: broad flat agricultural beds with rounded banks
  const terraceFrac = frac * frac * (3 - 2 * frac);
  const steppedH = (stepIdx + terraceFrac) * config.terraceStep;

  // Blend natural slope with terracing
  return rawH * (1 - config.terraceBlend) + steppedH * config.terraceBlend;
}

/**
 * Direct height lookup helper for terrain elevation at any (x, z) coordinates.
 */
export const getHeightAt = calculateTerrainElevation;

export function createTerrain(config: TerrainConfig = DEFAULT_CONFIG): {
  mesh: THREE.Mesh;
  getHeight: (x: number, z: number) => number;
  dispose: () => void;
} {
  const { size, segments } = config;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const posAttr = geometry.attributes.position;
  const count = posAttr.count;

  // Prepare vertex colors for painterly, dreamy Rwandan landscape
  const colors = new Float32Array(count * 3);

  // Curated Sky-inspired Rwandan palette:
  // Deep misted valleys, vibrant tea terraces, warm ochre banks, golden-lit ridges
  const cValley    = new THREE.Color(0x356a38); // Deep valley green
  const cTerrace   = new THREE.Color(0x56a44f); // Rich emerald tea terrace
  const cMeadow    = new THREE.Color(0x76b864); // Sunlit grassy knoll
  const cRidge     = new THREE.Color(0x92cb7c); // Golden-tinged ridge
  const cTerracotta= new THREE.Color(0xa66f46); // Warm volcanic soil on terrace banks
  const cHighPeak  = new THREE.Color(0xa7d890); // Ethereal misted peak

  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    const y = calculateTerrainElevation(x, z, config);
    posAttr.setY(i, y);

    // Height ratio between base and peak
    const normH = THREE.MathUtils.clamp((y + 6) / (config.maxHeight + 8), 0, 1);

    // Calculate terrace riser effect for warm volcanic earth accents
    const stepFrac = Math.abs((y / config.terraceStep) % 1);
    const isRiser = stepFrac > 0.42 && stepFrac < 0.72;

    if (isRiser && normH > 0.18 && normH < 0.82) {
      // Warm terracotta soil on terrace edges, softly blended
      const blend = Math.sin((stepFrac - 0.42) / 0.3 * Math.PI);
      tempColor.lerpColors(cTerrace, cTerracotta, blend * 0.75);
    } else if (normH < 0.28) {
      tempColor.lerpColors(cValley, cTerrace, normH / 0.28);
    } else if (normH < 0.65) {
      tempColor.lerpColors(cTerrace, cMeadow, (normH - 0.28) / 0.37);
    } else if (normH < 0.88) {
      tempColor.lerpColors(cMeadow, cRidge, (normH - 0.65) / 0.23);
    } else {
      tempColor.lerpColors(cRidge, cHighPeak, (normH - 0.88) / 0.12);
    }

    colors[i * 3 + 0] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  // Smooth, velvety stylized material (Sky: Children of the Light aesthetic)
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: false, // Smooth shading for soft naturalistic forms
    roughness: 0.82,
    metalness: 0.01,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  return {
    mesh,
    getHeight: (x: number, z: number) => calculateTerrainElevation(x, z, config),
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}


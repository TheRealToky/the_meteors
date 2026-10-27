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
  segments: 100,
  maxHeight: 22,
  terraceStep: 2.4,
  terraceBlend: 0.78, // 78% stepped, 22% natural slope
};

/**
 * Calculates elevation at (x, z) using fractal simplex noise and terracing.
 */
export function calculateTerrainElevation(
  x: number,
  z: number,
  config: TerrainConfig = DEFAULT_CONFIG
): number {
  // Base rolling hills
  const baseNoise = fbm2D(x * 0.007, z * 0.007, 3, 2.0, 0.5);
  // Medium ridge features
  const ridgeNoise = simplex2D(x * 0.015, z * 0.015) * 0.3;
  const rawH = (baseNoise + ridgeNoise) * config.maxHeight;

  // Stepped terrace quantisation (signature Rwandan agricultural hills)
  const steppedH = Math.round(rawH / config.terraceStep) * config.terraceStep;
  return rawH * (1 - config.terraceBlend) + steppedH * config.terraceBlend;
}

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

  // Prepare vertex colors for low-poly stepped look
  const colors = new Float32Array(count * 3);

  // Rwanda palette:
  // Valley grass: #2e6930
  // Terrace flat: #438e44
  // Terrace edge / volcanic earth: #8b5a2b
  // Hilltop ridge: #64a350
  const cValley = new THREE.Color(0x2e6930);
  const cTerrace = new THREE.Color(0x438e44);
  const cSoil = new THREE.Color(0x8b5a2b);
  const cRidge = new THREE.Color(0x64a350);

  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);

    const y = calculateTerrainElevation(x, z, config);
    posAttr.setY(i, y);

    // Height ratio between -maxHeight and +maxHeight
    const normH = THREE.MathUtils.clamp((y + 6) / (config.maxHeight + 6), 0, 1);

    // Calculate slope / terrace riser effect for soil accents
    const stepOffset = Math.abs(y % config.terraceStep);
    const isEdge = stepOffset < 0.35 || stepOffset > config.terraceStep - 0.35;

    if (isEdge && normH > 0.15 && normH < 0.85) {
      tempColor.copy(cSoil);
    } else if (normH < 0.3) {
      tempColor.lerpColors(cValley, cTerrace, normH / 0.3);
    } else if (normH < 0.75) {
      tempColor.lerpColors(cTerrace, cRidge, (normH - 0.3) / 0.45);
    } else {
      tempColor.copy(cRidge);
    }

    colors[i * 3] = tempColor.r;
    colors[i * 3 + 1] = tempColor.g;
    colors[i * 3 + 2] = tempColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  // Low-poly flat shaded material as specified in CLAUDE.md
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.88,
    metalness: 0.05,
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

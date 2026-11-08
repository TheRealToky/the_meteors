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

/**
 * Adds a soft, painterly brightness variation to a ground material in the
 * fragment shader (world-space value noise at two scales). Vertex colours alone
 * are 1.5 m apart and look flat up close; this breaks them up for almost no cost.
 */
function addGroundNoise(material: THREE.Material): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vGroundXZ;
        float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(gHash(i), gHash(i + vec2(1.0, 0.0)), u.x),
                     mix(gHash(i + vec2(0.0, 1.0)), gHash(i + vec2(1.0, 1.0)), u.x), u.y);
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float gN = gNoise(vGroundXZ * 0.18) * 0.6 + gNoise(vGroundXZ * 0.9) * 0.4;
        diffuseColor.rgb *= 0.9 + 0.18 * gN;`
      );
  };
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

  for (let i = 0; i < count; i++) {
    posAttr.setY(i, calculateTerrainElevation(posAttr.getX(i), posAttr.getZ(i), config));
  }
  posAttr.needsUpdate = true;
  geometry.computeVertexNormals();

  // Bright, sunny meadow palette matching the reference art direction:
  // lime grass, golden patches, deeper green hollows, red Rwandan soil on terrace banks
  const cValley = new THREE.Color(0x6aa83a); // Deeper green hollows
  const cMeadow = new THREE.Color(0x8fc445); // Main lime meadow
  const cHigh = new THREE.Color(0xa8d052); // Sunny upper slopes
  const cGold = new THREE.Color(0xcfc04c); // Golden grass patches
  const cDeep = new THREE.Color(0x5c9c36); // Lush patches (under groves)
  const cSoil = new THREE.Color(0xb8834c); // Red-ochre terrace banks

  const colors = new Float32Array(count * 3);
  const normals = geometry.attributes.normal;
  const c = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const normH = THREE.MathUtils.clamp((y + 6) / (config.maxHeight + 8), 0, 1);

    // 1. Base colour by height
    if (normH < 0.45) c.lerpColors(cValley, cMeadow, normH / 0.45);
    else c.lerpColors(cMeadow, cHigh, (normH - 0.45) / 0.55);

    // 2. Large soft patches (same noise family as the props' masks, so golden
    //    grass tufts sit on golden ground)
    const gold = simplex2D(x * 0.03 - 40.2, z * 0.03 + 8.8);
    c.lerp(cGold, THREE.MathUtils.smoothstep(gold, 0.3, 0.75) * 0.6);
    const lush = simplex2D(x * 0.022 + 7.1, z * 0.022 - 3.4);
    c.lerp(cDeep, THREE.MathUtils.smoothstep(lush, 0.2, 0.7) * 0.45);

    // 3. Terrace banks show a little red soil (a Rwandan hillside signature)
    const stepFrac = Math.abs((y / config.terraceStep) % 1);
    if (stepFrac > 0.42 && stepFrac < 0.72 && normH > 0.16 && normH < 0.85) {
      const blend = Math.sin(((stepFrac - 0.42) / 0.3) * Math.PI);
      c.lerp(cSoil, blend * 0.45);
    }

    // 4. Steeper slopes slightly darker for readable landforms
    const ny = normals.getY(i);
    c.multiplyScalar(0.82 + 0.18 * THREE.MathUtils.smoothstep(ny, 0.75, 1.0));

    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Matte ground: Lambert matches the vegetation materials and is cheaper on phones
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  addGroundNoise(material);

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

/**
 * A ring of rolling hills around the playable terrain, so the world never ends
 * at a visible edge. It starts just under the terrain (hidden) and rises into
 * big soft hills that fade into the fog. About 6k triangles, one draw call.
 */
export function createBackdropHills(
  getHeight: (x: number, z: number) => number,
  terrainHalf = 120
): { mesh: THREE.Mesh; dispose: () => void } {
  const radial = 128;
  const radii: number[] = [];
  for (let r = 100; r < 200; r += 8) radii.push(r);
  for (let r = 200; r <= 350; r += 25) radii.push(r);

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cNear = new THREE.Color(0x8fc445);
  const cFar = new THREE.Color(0x9ec765);
  const cGold = new THREE.Color(0xcfc04c);
  const c = new THREE.Color();

  for (let ri = 0; ri < radii.length; ri++) {
    const r = radii[ri];
    for (let a = 0; a < radial; a++) {
      const ang = (a / radial) * Math.PI * 2;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const inside = Math.abs(x) < terrainHalf && Math.abs(z) < terrainHalf;
      // Height at the nearest terrain edge point, so the ring meets the terrain
      const edgeH = getHeight(
        THREE.MathUtils.clamp(x, -terrainHalf + 1, terrainHalf - 1),
        THREE.MathUtils.clamp(z, -terrainHalf + 1, terrainHalf - 1)
      );
      const hills =
        8 + fbm2D(x * 0.006 + 13.0, z * 0.006 - 5.0, 3, 2.0, 0.5) * 34 + (r - 150) * 0.12;
      const t = THREE.MathUtils.smoothstep(r, 135, 230);
      const y = inside ? edgeH - 2.5 : THREE.MathUtils.lerp(edgeH - 0.6, Math.max(hills, edgeH), t);
      positions.push(x, y, z);

      c.lerpColors(cNear, cFar, THREE.MathUtils.smoothstep(r, 140, 320));
      c.lerp(cGold, THREE.MathUtils.smoothstep(simplex2D(x * 0.01, z * 0.01), 0.2, 0.7) * 0.5);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let ri = 0; ri < radii.length - 1; ri++) {
    for (let a = 0; a < radial; a++) {
      const a2 = (a + 1) % radial;
      const i0 = ri * radial + a;
      const i1 = ri * radial + a2;
      const i2 = (ri + 1) * radial + a;
      const i3 = (ri + 1) * radial + a2;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = false;
  mesh.name = 'backdrop-hills';

  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

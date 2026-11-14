import * as THREE from 'three';
import { STATION_COORDINATES } from './path';
import { simplex2D } from './noise';
import {
  createBlobTreeGeometry,
  createGrassTuftGeometry,
  applyWindSway,
  loadFoliageParts,
  windUniforms,
  type FoliagePart,
} from './foliageAssets';
import { StreamedLayer } from './StreamedLayer';
import { isInsideBuilding } from './stationLayout';

export interface PropsManager {
  group: THREE.Group;
  load: () => Promise<void>;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * The natural landscape: groves of green and flame-orange trees, dense grass,
 * wildflower drifts, ferns, mushrooms, rock outcrops and pebbles.
 *
 * Layout rules (all deterministic, seeded, so every playthrough looks the same):
 *  - Density follows the path: the camera rides the path, so the 2-9 m band on
 *    each side is the densest; meadows thin out with distance.
 *  - Noise masks create natural clustering: groves, flower drifts, golden
 *    grass patches and a flame-tree (orange) region.
 *  - Station clearings stay open so the pavilions and UI moments read clearly.
 *
 * Rendering: every kind of object is a StreamedLayer (one draw call per model
 * part, only nearby instances uploaded). See StreamedLayer.ts.
 */

// Model URLs (Quaternius Stylized Nature MegaKit, CC0)
const M = '/models/nature/';

// Palettes (instance tints multiplied onto neutral grey textures)
const TREE_GREENS = [0x8cc63f, 0x7abb33, 0x9fd14a, 0x6aae36, 0xb0d95a];
const TREE_FLAME = [0xf59a2c, 0xf07a26, 0xf8b23a, 0xec6630, 0xf9cc48];
const GRASS_GREENS = [0x9ad442, 0x86c83a, 0xa9da4a, 0x78bd36];
const GRASS_GOLD = [0xd6c444, 0xe2b43c, 0xc8c94a];
const GRASS_RUST = [0xf08a3a, 0xe8703a];
const BUSH_GREENS = [0x5fae3c, 0x6fbf45, 0x55a236, 0x7ac64a];

// Clearances (metres)
const PATH_HALF_WIDTH = 1.6;
const STATION_CLEAR_TREES = 13;
const STATION_CLEAR_SMALL = 7;
const WORLD_HALF = 115;

/** Small seeded PRNG (mulberry32): same layout on every load. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPropsManager(
  scene: THREE.Scene,
  getHeight: (x: number, z: number) => number,
  pathCurve?: THREE.CatmullRomCurve3,
  camera?: THREE.Camera
): PropsManager {
  const group = new THREE.Group();
  group.name = 'nature-props';
  scene.add(group);

  const rand = mulberry32(2025);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
  const range = (a: number, b: number): number => a + rand() * (b - a);

  const layers: StreamedLayer[] = [];
  const ownedParts: FoliagePart[] = [];
  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  // Low-quality mode: phones, or ?quality=low. Shorter draw distances.
  const params = new URLSearchParams(window.location.search);
  const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 1;
  const distanceScale = params.get('quality') === 'low' || isMobile ? 0.65 : 1;

  // -------------------------------------------------------------------------
  // Distance-to-path field: a 1.5 m grid, sampled bilinearly. Computing the
  // exact distance for ~40k candidate positions would be ~20M operations.
  // -------------------------------------------------------------------------
  const GRID_STEP = 1.5;
  const GRID_HALF = 121.5;
  const GRID_N = Math.round((GRID_HALF * 2) / GRID_STEP) + 1;
  const distGrid = new Float32Array(GRID_N * GRID_N).fill(999);
  const pathX: number[] = [];
  const pathZ: number[] = [];
  const pathDirX: number[] = [];
  const pathDirZ: number[] = [];

  if (pathCurve) {
    const len = pathCurve.getLength();
    const n = Math.ceil(len);
    const p = new THREE.Vector3();
    const tan = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pathCurve.getPointAt(t, p);
      pathCurve.getTangentAt(t, tan);
      pathX.push(p.x);
      pathZ.push(p.z);
      const l = Math.hypot(tan.x, tan.z) || 1;
      pathDirX.push(tan.x / l);
      pathDirZ.push(tan.z / l);
    }
    for (let gz = 0; gz < GRID_N; gz++) {
      const z = -GRID_HALF + gz * GRID_STEP;
      for (let gx = 0; gx < GRID_N; gx++) {
        const x = -GRID_HALF + gx * GRID_STEP;
        let best = Infinity;
        for (let k = 0; k < pathX.length; k++) {
          const dx = pathX[k] - x;
          const dz = pathZ[k] - z;
          const d2 = dx * dx + dz * dz;
          if (d2 < best) best = d2;
        }
        distGrid[gz * GRID_N + gx] = Math.sqrt(best);
      }
    }
  }

  const distToPath = (x: number, z: number): number => {
    const fx = (x + GRID_HALF) / GRID_STEP;
    const fz = (z + GRID_HALF) / GRID_STEP;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    if (ix < 0 || iz < 0 || ix >= GRID_N - 1 || iz >= GRID_N - 1) return 999;
    const tx = fx - ix;
    const tz = fz - iz;
    const a = distGrid[iz * GRID_N + ix];
    const b = distGrid[iz * GRID_N + ix + 1];
    const c = distGrid[(iz + 1) * GRID_N + ix];
    const d = distGrid[(iz + 1) * GRID_N + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  };

  const distToStation = (x: number, z: number): number => {
    let best = Infinity;
    for (const s of STATION_COORDINATES) {
      const d = Math.hypot(x - s.x, z - s.z);
      if (d < best) best = d;
    }
    return best;
  };

  // Noise masks in [-1, 1] that cluster things naturally
  const groveMask = (x: number, z: number): number =>
    simplex2D(x * 0.022 + 7.1, z * 0.022 - 3.4) * 0.75 + simplex2D(x * 0.06, z * 0.06) * 0.25;
  const flameMask = (x: number, z: number): number => simplex2D(x * 0.013 + 31.7, z * 0.013 - 12.3);
  const goldMask = (x: number, z: number): number => simplex2D(x * 0.03 - 40.2, z * 0.03 + 8.8);
  const flowerMask = (x: number, z: number): number => simplex2D(x * 0.055 + 90.1, z * 0.055 + 2.5);

  /** A random point beside the path, `minD`..`maxD` metres from its centre line. */
  const pointBesidePath = (minD: number, maxD: number, out: THREE.Vector2): boolean => {
    if (pathX.length === 0) return false;
    const k = Math.floor(rand() * pathX.length);
    const side = rand() < 0.5 ? -1 : 1;
    const off = range(minD, maxD) * side;
    // Perpendicular to the path direction
    out.set(pathX[k] - pathDirZ[k] * off + range(-0.8, 0.8), pathZ[k] + pathDirX[k] * off + range(-0.8, 0.8));
    return Math.abs(out.x) < WORLD_HALF && Math.abs(out.y) < WORLD_HALF;
  };

  const randomPoint = (out: THREE.Vector2): void => {
    out.set(range(-WORLD_HALF, WORLD_HALF), range(-WORLD_HALF, WORLD_HALF));
  };

  // Shared scratch objects for building matrices (load time only)
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scl = new THREE.Vector3();
  const mat = new THREE.Matrix4();
  const col = new THREE.Color();
  const p2 = new THREE.Vector2();

  const place = (
    layer: StreamedLayer,
    x: number,
    z: number,
    scale: number,
    sink: number,
    tint?: number,
    tilt = 0.06,
    yScale = 1
  ): void => {
    // Never grow through a station building (small margin for walls and steps)
    if (isInsideBuilding(x, z, 0.6)) return;
    pos.set(x, getHeight(x, z) - sink, z);
    euler.set(range(-tilt, tilt), rand() * Math.PI * 2, range(-tilt, tilt));
    quat.setFromEuler(euler);
    scl.set(scale, scale * yScale, scale);
    mat.compose(pos, quat, scl);
    if (tint !== undefined) {
      // Small brightness jitter so neighbours never look copy-pasted
      col.setHex(tint).multiplyScalar(range(0.9, 1.08));
      layer.add(mat, col);
    } else {
      layer.add(mat);
    }
  };

  const makeLayer = (
    parts: FoliagePart[],
    opts: Omit<ConstructorParameters<typeof StreamedLayer>[0], 'parts'>
  ): StreamedLayer => {
    ownedParts.push(...parts, ...(opts.farParts ?? []));
    const layer = new StreamedLayer({ parts, ...opts });
    layers.push(layer);
    return layer;
  };

  const finish = (layer: StreamedLayer): void => {
    layer.build();
    group.add(layer.group);
  };

  // =========================================================================
  // LOAD
  // =========================================================================
  const load = async (): Promise<void> => {
    const [
      tree3, tree4, tree5,
      bush, bushFlowers, fern, bigPlant, clover,
      flowerA, flowerB, grassTall,
      mushroom, rock1, rock2, rock3, pebble1, pebble2, rockPath,
    ] = await Promise.all([
      loadFoliageParts(M + 'CommonTree_3.gltf', { sway: 0.0012, castShadow: true }),
      loadFoliageParts(M + 'CommonTree_4.gltf', { sway: 0.0012, castShadow: true }),
      loadFoliageParts(M + 'CommonTree_5.gltf', { sway: 0.0012, castShadow: true }),
      loadFoliageParts(M + 'Bush_Common.gltf', { sway: 0.01 }),
      loadFoliageParts(M + 'Bush_Common_Flowers.gltf', { sway: 0.01 }),
      loadFoliageParts(M + 'Fern_1.gltf', { sway: 0.02 }),
      loadFoliageParts(M + 'Plant_1_Big.gltf', { sway: 0.008 }),
      loadFoliageParts(M + 'Clover_1.gltf', { foliageNormals: 'up', sway: 0.04 }),
      loadFoliageParts(M + 'Flower_3_Single.gltf', { foliageNormals: 'up', sway: 0.05 }),
      loadFoliageParts(M + 'Flower_4_Single.gltf', { foliageNormals: 'up', sway: 0.05 }),
      loadFoliageParts(M + 'Grass_Common_Tall.gltf', { sway: 0.05 }),
      loadFoliageParts(M + 'Mushroom_Common.gltf'),
      loadFoliageParts(M + 'Rock_Medium_1.gltf'),
      loadFoliageParts(M + 'Rock_Medium_2.gltf'),
      loadFoliageParts(M + 'Rock_Medium_3.gltf'),
      loadFoliageParts(M + 'Pebble_Round_1.gltf'),
      loadFoliageParts(M + 'Pebble_Round_2.gltf'),
      loadFoliageParts(M + 'RockPath_Round_Small_1.gltf'),
    ]);

    // Rocks take a per-instance tint too (grey, mossy, warm) for variety
    for (const p of [...rock1, ...rock2, ...rock3]) {
      p.tinted = true;
      // The rock texture is painted dark for a PBR engine; lift it to the soft grey of the reference
      (p.material as THREE.MeshLambertMaterial).color.setScalar(1.9);
    }
    for (const p of [...pebble1, ...pebble2, ...rockPath]) {
      (p.material as THREE.MeshLambertMaterial).color.setScalar(1.5);
    }

    // ---------------------------------------------------------------------
    // 1. TREES: three models (CommonTree_2 skipped: 4.3k-triangle bark), blob LOD beyond 45 m
    // ---------------------------------------------------------------------
    const treeModels = [tree3, tree4, tree5].filter((m) => m.length > 0);
    const treeLayers = treeModels.map((parts) => {
      const leaf = parts.find((p) => p.tinted) ?? parts[0];
      const blobGeom = createBlobTreeGeometry(leaf.geometry);
      const blobMat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const far: FoliagePart = { geometry: blobGeom, material: blobMat, tinted: true, shadow: false };
      return makeLayer(parts, {
        farParts: [far],
        // Blob trees are ~170 triangles, so the whole forest can stay visible
        maxDistance: 260,
        lodDistance: 45,
        keepRadius: 28,
        coneCos: 0.1,
      });
    });

    if (treeLayers.length > 0) {
      const target = 560;
      let placed = 0;
      for (let i = 0; i < target * 12 && placed < target; i++) {
        randomPoint(p2);
        const d = distToPath(p2.x, p2.y);
        if (d < 4.8) continue;
        if (distToStation(p2.x, p2.y) < STATION_CLEAR_TREES) continue;
        if (isInsideBuilding(p2.x, p2.y, 3)) continue; // keep canopies off the roofs
        // Groves where the mask is high; a looser row of trees framing the path
        let prob = THREE.MathUtils.smoothstep(groveMask(p2.x, p2.y), -0.3, 0.4);
        if (d < 16) prob = Math.max(prob, 0.28);
        if (rand() > prob) continue;

        const flame = flameMask(p2.x, p2.y) > 0.2 || rand() < 0.07;
        const layer = treeLayers[Math.floor(rand() * treeLayers.length)];
        place(layer, p2.x, p2.y, range(0.62, 1.0), 0.25, pick(flame ? TREE_FLAME : TREE_GREENS), 0.04, range(0.9, 1.15));
        placed++;
      }
    }

    // ---------------------------------------------------------------------
    // 2. BUSHES (plain and flowering) along the path edges and grove borders
    // ---------------------------------------------------------------------
    const bushLayer = makeLayer(bush, { maxDistance: 40, keepRadius: 10 });
    const bushFlowerLayer = makeLayer(bushFlowers, { maxDistance: 36, keepRadius: 10 });
    for (let i = 0, placed = 0; i < 6000 && placed < 320; i++) {
      const nearPath = rand() < 0.55;
      if (nearPath) {
        if (!pointBesidePath(3.4, 12, p2)) continue;
      } else randomPoint(p2);
      if (distToPath(p2.x, p2.y) < 3.2 || distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL + 1) continue;
      if (!nearPath && rand() > THREE.MathUtils.smoothstep(groveMask(p2.x, p2.y), -0.5, 0.3)) continue;
      const flowering = rand() < 0.35;
      const flame = flameMask(p2.x, p2.y) > 0.3 && rand() < 0.5;
      place(
        flowering ? bushFlowerLayer : bushLayer,
        p2.x, p2.y, range(0.5, 1.0), 0.15,
        flame ? pick(TREE_FLAME) : pick(BUSH_GREENS)
      );
      placed++;
    }

    // ---------------------------------------------------------------------
    // 3. GRASS: thousands of cheap procedural tufts + kit grass accents
    // ---------------------------------------------------------------------
    const tuftGeoms = [createGrassTuftGeometry(7, 11), createGrassTuftGeometry(9, 29)];
    const tuftLayers = tuftGeoms.map((g) => {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      applyWindSway(m, 0.16);
      return makeLayer([{ geometry: g, material: m, tinted: true, shadow: false }], {
        maxDistance: 44,
        keepRadius: 8,
        coneCos: 0.3,
      });
    });

    const grassTint = (x: number, z: number): number => {
      const gold = goldMask(x, z);
      if (gold > 0.5) return pick(GRASS_GOLD);
      if (flameMask(x, z) > 0.35 && rand() < 0.1) return pick(GRASS_RUST);
      return pick(GRASS_GREENS);
    };

    // 3a. Thick fringe along the path (the area the camera sees most)
    for (let i = 0; i < 9500; i++) {
      if (!pointBesidePath(PATH_HALF_WIDTH + 0.3, 9, p2)) continue;
      if (distToPath(p2.x, p2.y) < PATH_HALF_WIDTH + 0.25) continue;
      if (distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL - 1) continue;
      place(pick(tuftLayers), p2.x, p2.y, range(0.8, 1.45), 0.05, grassTint(p2.x, p2.y), 0.12, range(0.8, 1.35));
    }
    // 3b. Meadow tufts further out, in patches
    for (let i = 0, placed = 0; i < 45000 && placed < 9000; i++) {
      randomPoint(p2);
      const d = distToPath(p2.x, p2.y);
      if (d < 9 || d > 70) continue;
      if (distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL) continue;
      if (rand() > 0.35 + 0.5 * goldMask(p2.x * 1.7, p2.y * 1.7)) continue;
      place(pick(tuftLayers), p2.x, p2.y, range(0.9, 1.6), 0.05, grassTint(p2.x, p2.y), 0.12, range(0.8, 1.4));
      placed++;
    }

    // 3c. Taller kit grass close to the path
    const grassTallLayer = makeLayer(grassTall, { maxDistance: 26, keepRadius: 8, coneCos: 0.3 });
    for (let i = 0; i < 650; i++) {
      if (!pointBesidePath(2.2, 8, p2)) continue;
      if (distToPath(p2.x, p2.y) < 2.1 || distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL) continue;
      place(grassTallLayer, p2.x, p2.y, range(0.55, 0.85), 0.05, grassTint(p2.x, p2.y), 0.1);
    }

    // ---------------------------------------------------------------------
    // 4. WILDFLOWER DRIFTS (clusters where the flower mask is high)
    // ---------------------------------------------------------------------
    const flowerLayers = [flowerA, flowerB].filter((m) => m.length > 0).map((parts) =>
      makeLayer(parts, { maxDistance: 26, keepRadius: 8, coneCos: 0.3 })
    );
    if (flowerLayers.length > 0) {
      for (let c = 0, clusters = 0; c < 4000 && clusters < 210; c++) {
        const besidePath = rand() < 0.7;
        if (besidePath) {
          if (!pointBesidePath(2.2, 14, p2)) continue;
        } else randomPoint(p2);
        if (flowerMask(p2.x, p2.y) < 0.05) continue;
        const cx = p2.x;
        const cz = p2.y;
        const layer = pick(flowerLayers);
        const n = 3 + Math.floor(rand() * 7);
        for (let k = 0; k < n; k++) {
          const x = cx + range(-1.6, 1.6);
          const z = cz + range(-1.6, 1.6);
          if (distToPath(x, z) < 2.0 || distToStation(x, z) < STATION_CLEAR_SMALL) continue;
          place(layer, x, z, range(0.45, 0.75), 0.02, 0x74bd3c, 0.12);
        }
        clusters++;
      }
    }

    // ---------------------------------------------------------------------
    // 5. GROUND PLANTS: ferns and big-leaf plants under groves, clover by the path
    // ---------------------------------------------------------------------
    const fernLayer = makeLayer(fern, { maxDistance: 60, keepRadius: 10 });
    for (let i = 0, placed = 0; i < 5000 && placed < 260; i++) {
      randomPoint(p2);
      const d = distToPath(p2.x, p2.y);
      if (d < 3 || d > 60 || distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL) continue;
      if (rand() > THREE.MathUtils.smoothstep(groveMask(p2.x, p2.y), -0.2, 0.5) + (d < 10 ? 0.2 : 0)) continue;
      place(fernLayer, p2.x, p2.y, range(0.18, 0.3), 0.05, pick(BUSH_GREENS), 0.08);
      placed++;
    }

    const bigPlantLayer = makeLayer(bigPlant, { maxDistance: 70, keepRadius: 10 });
    for (let i = 0, placed = 0; i < 4000 && placed < 150; i++) {
      randomPoint(p2);
      const d = distToPath(p2.x, p2.y);
      if (d < 3.5 || d > 55 || distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL) continue;
      if (groveMask(p2.x, p2.y) < -0.1) continue;
      place(bigPlantLayer, p2.x, p2.y, range(0.32, 0.55), 0.05, pick(GRASS_GREENS), 0.08);
      placed++;
    }

    const cloverLayer = makeLayer(clover, { maxDistance: 20, keepRadius: 8, coneCos: 0.3 });
    for (let i = 0; i < 450; i++) {
      if (!pointBesidePath(1.9, 10, p2)) continue;
      if (distToPath(p2.x, p2.y) < 1.9 || distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL - 2) continue;
      place(cloverLayer, p2.x, p2.y, range(0.6, 1.0), 0.03, pick(GRASS_GREENS), 0.1);
    }

    // ---------------------------------------------------------------------
    // 6. MUSHROOMS: little clusters on path edges and under trees
    // ---------------------------------------------------------------------
    const mushroomLayer = makeLayer(mushroom, { maxDistance: 18, keepRadius: 8, coneCos: 0.3 });
    for (let c = 0; c < 55; c++) {
      if (!pointBesidePath(2.0, 6.5, p2)) continue;
      if (distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL) continue;
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const x = p2.x + range(-0.6, 0.6);
        const z = p2.y + range(-0.6, 0.6);
        if (distToPath(x, z) < 1.9) continue;
        place(mushroomLayer, x, z, range(0.5, 0.95), 0.02, undefined, 0.15);
      }
    }

    // ---------------------------------------------------------------------
    // 7. ROCKS: scattered boulders + big hillside outcrops
    // ---------------------------------------------------------------------
    const rockModels = [rock1, rock2, rock3].filter((m) => m.length > 0);
    // Small boulders only near the camera; big outcrops are landmarks seen from far away.
    // The two layers share geometry and materials (one draw call each).
    const rockLayers = rockModels.map((parts) => makeLayer(parts, { maxDistance: 60, keepRadius: 12, coneCos: 0.2 }));
    const outcropLayers = rockModels.map((parts) =>
      makeLayer(parts, { maxDistance: 230, keepRadius: 20, coneCos: 0.1 })
    );
    const ROCK_TINTS = [0xffffff, 0xe6eed8, 0xd9dccf, 0xf0e8da];
    if (rockLayers.length > 0) {
      // Boulders near the path
      for (let i = 0, placed = 0; i < 3000 && placed < 150; i++) {
        if (!pointBesidePath(2.8, 30, p2)) continue;
        if (distToPath(p2.x, p2.y) < 2.8 || distToStation(p2.x, p2.y) < STATION_CLEAR_SMALL) continue;
        place(pick(rockLayers), p2.x, p2.y, range(0.22, 0.6), 0.1, pick(ROCK_TINTS), 0.3);
        placed++;
      }
      // Outcrops: clusters of big, half-buried rocks on the hillsides
      for (let c = 0, clusters = 0; c < 2000 && clusters < 34; c++) {
        randomPoint(p2);
        const d = distToPath(p2.x, p2.y);
        if (d < 16 || distToStation(p2.x, p2.y) < STATION_CLEAR_TREES + 4) continue;
        const n = 3 + Math.floor(rand() * 4);
        const base = range(1.4, 3.0);
        for (let k = 0; k < n; k++) {
          const s = base * range(0.45, 1.0);
          const x = p2.x + range(-1.6, 1.6) * base;
          const z = p2.y + range(-1.6, 1.6) * base;
          if (distToPath(x, z) < 6) continue;
          place(pick(outcropLayers), x, z, s, s * 0.45, pick(ROCK_TINTS), 0.35, range(0.8, 1.3));
        }
        clusters++;
      }
    }

    // ---------------------------------------------------------------------
    // 8. PEBBLES on and along the path, stepping stones at stations
    // ---------------------------------------------------------------------
    const pebbleLayers = [pebble1, pebble2].filter((m) => m.length > 0).map((parts) =>
      makeLayer(parts, { maxDistance: 34, keepRadius: 8, coneCos: 0.3 })
    );
    if (pebbleLayers.length > 0) {
      for (let i = 0; i < 650; i++) {
        if (!pointBesidePath(0.2, 4.5, p2)) continue;
        if (distToStation(p2.x, p2.y) < 4) continue;
        place(pick(pebbleLayers), p2.x, p2.y, range(0.6, 1.4), -0.08, undefined, 0.1, 0.8);
      }
    }

    const rockPathLayer = makeLayer(rockPath, { maxDistance: 50, keepRadius: 10 });
    STATION_COORDINATES.forEach((coord) => {
      for (let s = 1; s <= 4; s++) {
        const offsetDist = 2.0 + s * 1.1;
        const angle = coord.t * Math.PI * 2 + s * 0.2;
        const x = coord.x + Math.sin(angle) * offsetDist;
        const z = coord.z + Math.cos(angle) * offsetDist;
        place(rockPathLayer, x, z, 0.65, -0.04, undefined, 0, 0.75);
      }
    });

    // Upload everything and show the first frame's worth of instances
    layers.forEach(finish);
    forceRefresh = true;

    if (import.meta.env.DEV) {
      const total = layers.reduce((s, l) => s + l.size, 0);
      console.info(`[props] ${layers.length} layers, ${total} instances placed`);
    }

    createBreezeRibbons();
  };

  // =========================================================================
  // Breeze ribbons: thin white wind trails drifting over the meadows
  // =========================================================================
  const breezeGroup = new THREE.Group();
  group.add(breezeGroup);
  const breezeRibbons: Array<{ mesh: THREE.Mesh; speed: number; startX: number }> = [];

  const createBreezeRibbons = (): void => {
    const ribbonCount = 8;
    const ribbonMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffffff) },
        uOpacity: { value: 0.65 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          float fadeX = smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
          float fadeY = 1.0 - abs(vUv.y - 0.5) * 2.0;
          gl_FragColor = vec4(uColor, fadeX * fadeY * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    disposables.push(ribbonMat);

    for (let r = 0; r < ribbonCount; r++) {
      const points: THREE.Vector3[] = [];
      const ribbonLength = 18 + rand() * 12;
      const segs = 20;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        points.push(new THREE.Vector3((t - 0.5) * ribbonLength, Math.cos(t * Math.PI * 1.8) * 0.45, Math.sin(t * Math.PI * 2.2) * 1.8));
      }
      const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.06, 6, false);
      disposables.push(tubeGeo);
      const ribbonMesh = new THREE.Mesh(tubeGeo, ribbonMat);
      const startX = -70 + r * 18;
      const centerZ = -30 + (r % 3) * 25;
      ribbonMesh.position.set(startX, getHeight(startX, centerZ) + 1.8 + rand() * 1.8, centerZ);
      ribbonMesh.rotation.y = 0.2 + (rand() - 0.5) * 0.4;
      breezeGroup.add(ribbonMesh);
      breezeRibbons.push({ mesh: ribbonMesh, speed: 3.5 + rand() * 2.5, startX });
    }
  };

  // =========================================================================
  // UPDATE: wind time + streaming refresh when the camera moved or turned
  // =========================================================================
  const camPos = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  let lastX = Infinity;
  let lastZ = Infinity;
  let lastFx = 0;
  let lastFz = 0;
  let lastCone = true;
  let forceRefresh = false;

  const update = (dt: number, elapsed: number): void => {
    windUniforms.uWindTime.value = elapsed;

    if (camera) {
      camera.getWorldPosition(camPos);
      camera.getWorldDirection(camDir);
      const hLen = Math.hypot(camDir.x, camDir.z);
      // Steep aerial views: draw all directions (the cone would cut the ground below)
      const heightAboveGround = camPos.y - getHeight(camPos.x, camPos.z);
      const useCone = hLen > 0.45 && heightAboveGround < 30;
      const fx = hLen > 0.0001 ? camDir.x / hLen : 0;
      const fz = hLen > 0.0001 ? camDir.z / hLen : 1;
      const moved = Math.hypot(camPos.x - lastX, camPos.z - lastZ) > 2;
      const turned = fx * lastFx + fz * lastFz < 0.995;
      if (forceRefresh || moved || turned || useCone !== lastCone) {
        for (const layer of layers) layer.refresh(camPos.x, camPos.z, fx, fz, distanceScale, useCone);
        lastX = camPos.x;
        lastZ = camPos.z;
        lastFx = fx;
        lastFz = fz;
        lastCone = useCone;
        forceRefresh = false;
      }
    }

    for (const b of breezeRibbons) {
      b.mesh.position.x += b.speed * dt;
      b.mesh.position.y += Math.sin(elapsed * 1.5 + b.startX) * 0.005;
      if (b.mesh.position.x > 85) {
        b.mesh.position.x = -85;
        b.mesh.position.y = getHeight(b.mesh.position.x, b.mesh.position.z) + 1.8 + Math.random() * 1.5;
      }
    }
  };

  const dispose = (): void => {
    layers.forEach((l) => l.dispose());
    const seen = new Set<unknown>();
    for (const p of ownedParts) {
      for (const item of [p.geometry, p.material]) {
        if (seen.has(item)) continue;
        seen.add(item);
        item.dispose();
      }
      const map = (p.material as THREE.MeshLambertMaterial).map;
      if (map && !seen.has(map)) {
        seen.add(map);
        map.dispose();
      }
    }
    breezeRibbons.forEach((b) => breezeGroup.remove(b.mesh));
    disposables.forEach((item) => item.dispose());
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

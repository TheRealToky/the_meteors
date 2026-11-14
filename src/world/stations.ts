import * as THREE from 'three';
import { STATION_BUILDINGS } from './stationLayout';
import { buildStationGeometry, LANTERN_SPOTS } from './stationBuildings';
import { loadFoliageParts, type FoliagePart } from './foliageAssets';

export interface StationsManager {
  group: THREE.Group;
  load: () => Promise<void>;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Places one distinct building at each life station (see stationBuildings.ts
 * for the designs and stationLayout.ts for where they stand).
 *
 * Draw calls: one per building + one for all door lanterns + the ancestor tree.
 */
export function createStationsManager(
  scene: THREE.Scene,
  getHeight: (x: number, z: number) => number
): StationsManager {
  const group = new THREE.Group();
  group.name = 'stations';
  scene.add(group);

  const geometries: THREE.BufferGeometry[] = [];
  const ownedParts: FoliagePart[] = [];

  // One shared matte material: colours come from the vertices
  const buildingMat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide, // hand-made triangles (gables, Imigongo) are visible from both sides
  });

  // Warm door lanterns, all stations merged into one mesh
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
  const lanternBase = new THREE.Color(0xffe2a0);
  const lanternParts: THREE.BufferGeometry[] = [];

  const corner = new THREE.Vector3();

  for (const b of STATION_BUILDINGS) {
    // Sample the ground under the footprint: the floor sits at the highest point,
    // and the plinth reaches down to the lowest so it never floats on a slope
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    let maxY = -Infinity;
    let minY = Infinity;
    for (const lx of [-0.5, 0, 0.5]) {
      for (const lz of [-0.5, 0, 0.5]) {
        corner.set(lx * b.width, 0, lz * b.depth);
        const wx = b.x + corner.x * c + corner.z * s;
        const wz = b.z - corner.x * s + corner.z * c;
        const h = getHeight(wx, wz);
        maxY = Math.max(maxY, h);
        minY = Math.min(minY, h);
      }
    }
    const drop = maxY - minY + 0.4;
    const geom = buildStationGeometry(b.kind, b.width, b.depth, drop);
    geometries.push(geom);

    const mesh = new THREE.Mesh(geom, buildingMat);
    mesh.name = `station-${b.id}`;
    mesh.position.set(b.x, maxY - 0.05, b.z);
    mesh.rotation.y = b.yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Lanterns for this building, baked to world space
    mesh.updateMatrixWorld(true);
    for (const [lx, ly, lz] of LANTERN_SPOTS[b.kind]) {
      const g = new THREE.IcosahedronGeometry(0.16, 1);
      corner.set(lx, ly, lz).applyMatrix4(mesh.matrixWorld);
      g.translate(corner.x, corner.y, corner.z);
      lanternParts.push(g);
    }
  }

  let lanternMesh: THREE.Mesh | null = null;
  if (lanternParts.length > 0) {
    // Merge by concatenating positions (all parts share the same layout)
    const merged = new THREE.BufferGeometry();
    const nonIndexed = lanternParts.map((g) => g.toNonIndexed());
    const total = nonIndexed.reduce((n, g) => n + g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3);
    let o = 0;
    for (const g of nonIndexed) {
      pos.set(g.attributes.position.array as Float32Array, o);
      o += g.attributes.position.count * 3;
      g.dispose();
    }
    lanternParts.forEach((g) => g.dispose());
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometries.push(merged);
    lanternMesh = new THREE.Mesh(merged, lanternMat);
    lanternMesh.name = 'station-lanterns';
    group.add(lanternMesh);
  }

  const load = async (): Promise<void> => {
    // The ancestor tree beside the memorial garden (death station)
    const memorial = STATION_BUILDINGS.find((b) => b.kind === 'memorial');
    if (!memorial) return;
    const parts = await loadFoliageParts('/models/nature/DeadTree_1.gltf', { castShadow: true });
    ownedParts.push(...parts);
    const holder = new THREE.Group();
    const c = Math.cos(memorial.yaw);
    const s = Math.sin(memorial.yaw);
    const lx = memorial.width / 2 + 1.2;
    const lz = -memorial.depth / 4;
    const wx = memorial.x + lx * c + lz * s;
    const wz = memorial.z - lx * s + lz * c;
    holder.position.set(wx, getHeight(wx, wz) - 0.2, wz);
    holder.rotation.y = memorial.yaw + 0.7;
    holder.scale.setScalar(0.34);
    for (const p of parts) {
      const m = new THREE.Mesh(p.geometry, p.material);
      m.castShadow = true;
      m.receiveShadow = true;
      holder.add(m);
    }
    group.add(holder);
  };

  const update = (_dt: number, elapsed: number): void => {
    // Gentle, slow breathing glow on the lanterns (no allocations)
    const k = 0.88 + 0.12 * Math.sin(elapsed * 1.6);
    lanternMat.color.copy(lanternBase).multiplyScalar(k);
  };

  const dispose = (): void => {
    geometries.forEach((g) => g.dispose());
    buildingMat.dispose();
    lanternMat.dispose();
    for (const p of ownedParts) {
      p.geometry.dispose();
      p.material.dispose();
    }
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STATION_COORDINATES } from './path';

export interface PropsManager {
  group: THREE.Group;
  load: () => Promise<void>;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Creates a dense, lush, and colorful natural environment inspired by the reference image.
 * Features:
 * - Layered canopy trees with both lush emerald-green and warm golden-autumn foliage.
 * - Dense 3D grass tufts, ferns, and tropical broadleaf plants.
 * - Clusters of bright orange button mushrooms and shelf mushrooms along paths and rocks.
 * - Sweeping drifts of coral-pink and golden-yellow wildflowers.
 * - Stylized cliff rock formations and river pebbles.
 * - Dynamic animated breeze ribbons drifting across the meadows.
 * - High-performance instancing maintaining 60 FPS.
 */
export function createPropsManager(
  scene: THREE.Scene,
  getHeight: (x: number, z: number) => number,
  pathCurve?: THREE.CatmullRomCurve3
): PropsManager {
  const group = new THREE.Group();
  scene.add(group);

  const loader = new GLTFLoader();
  const instancedMeshes: THREE.InstancedMesh[] = [];
  const clonedGroups: THREE.Group[] = [];
  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  // Breeze ribbon system
  const breezeGroup = new THREE.Group();
  group.add(breezeGroup);
  const breezeRibbons: Array<{ mesh: THREE.Mesh; speed: number; startX: number; rangeX: number }> = [];

  // Pre-sample path points for proximity checking and path-side placement
  const pathSamplePoints: THREE.Vector3[] = [];
  if (pathCurve) {
    for (let t = 0; t <= 1; t += 0.006) {
      pathSamplePoints.push(pathCurve.getPointAt(t));
    }
  }

  // Ensure models never block the path, camera rail, or station circles
  const isClearOfPathAndStations = (x: number, z: number, minDist = 6.0): boolean => {
    // 1. Station clear zones
    for (const s of STATION_COORDINATES) {
      if (Math.hypot(x - s.x, z - s.z) < minDist + 2.5) return false;
    }
    // 2. Walking path clear corridor
    for (const pt of pathSamplePoints) {
      if (Math.hypot(x - pt.x, z - pt.z) < minDist) return false;
    }
    return true;
  };

  const loadGLTFScene = async (url: string): Promise<THREE.Group | null> => {
    try {
      const gltf = await loader.loadAsync(url);
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.geometry) child.geometry.computeVertexNormals();
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              if ('flatShading' in m) (m as THREE.MeshStandardMaterial).flatShading = false;
              if ('roughness' in m) (m as THREE.MeshStandardMaterial).roughness = 0.76;
            });
          }
        }
      });
      return gltf.scene;
    } catch (err) {
      console.warn(`Could not load GLTF from ${url}:`, err);
      return null;
    }
  };

  const loadModelMesh = async (url: string): Promise<THREE.Mesh | null> => {
    try {
      const gltf = await loader.loadAsync(url);
      let foundMesh: THREE.Mesh | null = null;
      gltf.scene.traverse((child) => {
        if (!foundMesh && child instanceof THREE.Mesh) {
          foundMesh = child;
        }
      });
      return foundMesh;
    } catch (err) {
      console.warn(`Could not load prop mesh from ${url}:`, err);
      return null;
    }
  };

  const getSmoothGeom = (mesh: THREE.Mesh): THREE.BufferGeometry => {
    const geom = mesh.geometry.clone();
    geom.computeVertexNormals();
    disposables.push(geom);
    return geom;
  };

  const getSmoothMaterial = (mesh: THREE.Mesh, fallbackColor: number): THREE.Material => {
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        return mesh.material.map((m) => {
          const clone = m.clone();
          if ('flatShading' in clone) (clone as THREE.MeshStandardMaterial).flatShading = false;
          if ('roughness' in clone) (clone as THREE.MeshStandardMaterial).roughness = 0.74;
          disposables.push(clone);
          return clone;
        })[0];
      } else {
        const clone = mesh.material.clone();
        if ('flatShading' in clone) (clone as THREE.MeshStandardMaterial).flatShading = false;
        if ('roughness' in clone) (clone as THREE.MeshStandardMaterial).roughness = 0.74;
        disposables.push(clone);
        return clone;
      }
    }
    const mat = new THREE.MeshStandardMaterial({
      color: fallbackColor,
      roughness: 0.75,
      metalness: 0.0,
      flatShading: false,
    });
    disposables.push(mat);
    return mat;
  };

  const load = async (): Promise<void> => {
    // =========================================================
    // 1. CANOPY TREES — GREEN & FIERY GOLDEN ORANGE (Reference Match)
    // =========================================================
    const [tree1Scene, tree2Scene, tree3Scene, tree4Scene, twistedTreeScene] = await Promise.all([
      loadGLTFScene('/models/nature/CommonTree_1.gltf'),
      loadGLTFScene('/models/nature/CommonTree_2.gltf'),
      loadGLTFScene('/models/nature/CommonTree_3.gltf'),
      loadGLTFScene('/models/nature/CommonTree_4.gltf'),
      loadGLTFScene('/models/nature/TwistedTree_1.gltf'),
    ]);

    const greenPrototypes = [tree1Scene, tree2Scene, tree3Scene, tree4Scene].filter(
      (t): t is THREE.Group => t !== null
    );

    // Create Warm Golden-Orange Autumn Tree Prototypes (Signature feature of Reference Image)
    const autumnPrototypes: THREE.Group[] = [];
    if (tree1Scene && tree2Scene) {
      [tree1Scene, tree2Scene].forEach((srcGroup) => {
        const autumnGroup = srcGroup.clone(true);
        autumnGroup.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              if (m.name.toLowerCase().includes('leave') || m.name.toLowerCase().includes('foliage') || !m.name.toLowerCase().includes('bark')) {
                const autumnMat = m.clone();
                // Warm vibrant orange/amber foliage
                autumnMat.color = new THREE.Color(0xf28b32);
                disposables.push(autumnMat);
                child.material = autumnMat;
              }
            });
          }
        });
        autumnPrototypes.push(autumnGroup);
      });
    }

    // Place 185 Canopy Trees across the terrain in dense natural groves and ridge lines
    const totalTreesToPlace = 185;
    let treesPlaced = 0;

    for (let i = 0; i < totalTreesToPlace * 6 && treesPlaced < totalTreesToPlace; i++) {
      // Natural clustered distribution using angle and radial variation
      const angle = (i / (totalTreesToPlace * 6)) * Math.PI * 2 * 9 + Math.random() * 0.4;
      const radius = 22 + Math.random() * 95;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (isClearOfPathAndStations(x, z, 7.5)) {
        const y = getHeight(x, z);
        if (y > 1.8 && y < 18.0) {
          // 35% chance of warm golden/orange autumn tree (especially on sunny ridges), 65% lush green
          const isAutumn = Math.random() < 0.36 && autumnPrototypes.length > 0;
          const pool = isAutumn ? autumnPrototypes : greenPrototypes;

          if (pool.length > 0) {
            const proto = pool[treesPlaced % pool.length];
            const clone = proto.clone(true);
            const scale = 0.36 + Math.random() * 0.22;
            clone.position.set(x, y - 0.12, z);
            clone.rotation.y = Math.random() * Math.PI * 2;
            clone.scale.set(scale, scale * (0.92 + Math.random() * 0.2), scale);
            group.add(clone);
            clonedGroups.push(clone);
            treesPlaced++;
          }
        }
      }
    }

    // Grand Ancient Terrace Feature Trees (TwistedTree_1)
    if (twistedTreeScene) {
      const grandCount = 16;
      let grandPlaced = 0;
      for (let i = 0; i < grandCount * 8 && grandPlaced < grandCount; i++) {
        const angle = (i / grandCount) * Math.PI * 2 + 0.35;
        const radius = 42 + Math.random() * 65;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (isClearOfPathAndStations(x, z, 10.0)) {
          const y = getHeight(x, z);
          if (y > 4.0 && y < 18.0) {
            const clone = twistedTreeScene.clone(true);
            const scale = 0.22 + Math.random() * 0.09;
            clone.position.set(x, y - 0.15, z);
            clone.rotation.y = Math.random() * Math.PI * 2;
            clone.scale.set(scale, scale, scale);
            group.add(clone);
            clonedGroups.push(clone);
            grandPlaced++;
          }
        }
      }
    }

    // =========================================================
    // 2. ORANGE BUTTON MUSHROOMS (Key Reference Image Highlight)
    // =========================================================
    const mushroomCommonMesh = await loadModelMesh('/models/nature/Mushroom_Common.gltf');
    if (mushroomCommonMesh) {
      // 170 mushroom clusters lining the path borders, boulder roots, and tree trunks
      const count = 170;
      const geom = getSmoothGeom(mushroomCommonMesh);
      const mat = getSmoothMaterial(mushroomCommonMesh, 0xf37f22);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      // Half along path borders (distance 1.8 to 4.2m)
      if (pathSamplePoints.length > 0) {
        for (let i = 0; i < pathSamplePoints.length && placed < count * 0.65; i += 3) {
          if (Math.random() < 0.68) {
            const pt = pathSamplePoints[i];
            const side = Math.random() > 0.5 ? 1 : -1;
            const offsetDist = 2.0 + Math.random() * 2.2;
            const ox = pt.x + (Math.random() - 0.5) * 1.5 + side * offsetDist;
            const oz = pt.z + (Math.random() - 0.5) * 1.5 + side * offsetDist;
            const oy = getHeight(ox, oz);

            const scale = 0.55 + Math.random() * 0.45;
            dummy.position.set(ox, oy, oz);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.15);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
        }
      }

      // Rest scattered in grassy meadows
      for (let i = 0; i < count * 4 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 160;
        const z = (Math.random() - 0.5) * 160;
        const y = getHeight(x, z);
        if (y > 1.0 && isClearOfPathAndStations(x, z, 3.0)) {
          const scale = 0.5 + Math.random() * 0.4;
          dummy.position.set(x, y, z);
          dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }

      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // Shelf Mushrooms on rocks & dead trunks (Mushroom_Laetiporus)
    const mushroomShelfMesh = await loadModelMesh('/models/nature/Mushroom_Laetiporus.gltf');
    if (mushroomShelfMesh) {
      const count = 45;
      const geom = getSmoothGeom(mushroomShelfMesh);
      const mat = getSmoothMaterial(mushroomShelfMesh, 0xe88a2a);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        const y = getHeight(x, z);
        if (y > 2.0 && isClearOfPathAndStations(x, z, 4.0)) {
          const scale = 0.65 + Math.random() * 0.45;
          dummy.position.set(x, y + 0.15, z);
          dummy.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI * 2, 0);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // =========================================================
    // 3. 3D GRASS TUFTS (Dense ground fringe lining the trail)
    // =========================================================
    const grassMesh = await loadModelMesh('/models/nature/Grass_Common_Short.gltf') || await loadModelMesh('/models/nature/Grass_Wispy_Short.gltf');
    if (grassMesh) {
      // 360 instanced grass tufts along path borders and under trees
      const count = 360;
      const geom = getSmoothGeom(grassMesh);
      const mat = getSmoothMaterial(grassMesh, 0x6dbf43);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = false; // keep perf lightning-fast
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      // Trail edge grass fringes
      if (pathSamplePoints.length > 0) {
        for (let i = 0; i < pathSamplePoints.length && placed < count * 0.72; i += 2) {
          const pt = pathSamplePoints[i];
          const side = (placed % 2 === 0 ? 1 : -1);
          const offsetDist = 1.8 + Math.random() * 1.8;
          const gx = pt.x + (Math.random() - 0.5) * 1.0 + side * offsetDist;
          const gz = pt.z + (Math.random() - 0.5) * 1.0 + side * offsetDist;
          const gy = getHeight(gx, gz) - 0.04;

          const scale = 0.45 + Math.random() * 0.35;
          dummy.position.set(gx, gy, gz);
          dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.1);
          dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.3), scale);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }

      // Meadow scatter
      for (let i = 0; i < count * 4 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 165;
        const z = (Math.random() - 0.5) * 165;
        const y = getHeight(x, z);
        if (y > 0.8 && isClearOfPathAndStations(x, z, 2.5)) {
          const scale = 0.4 + Math.random() * 0.35;
          dummy.position.set(x, y - 0.03, z);
          dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }

      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // =========================================================
    // 4. FERNS & BROADLEAF TROPICAL PLANTS (Foreground richness)
    // =========================================================
    const fernMesh = await loadModelMesh('/models/nature/Fern_1.gltf');
    if (fernMesh) {
      const count = 65;
      const geom = getSmoothGeom(fernMesh);
      const mat = getSmoothMaterial(fernMesh, 0x489635);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        if (isClearOfPathAndStations(x, z, 3.8)) {
          const y = getHeight(x, z);
          if (y > 1.2 && y < 16.5) {
            const scale = 0.22 + Math.random() * 0.12;
            dummy.position.set(x, y - 0.02, z);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.1);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    const tropicalPlantMesh = await loadModelMesh('/models/nature/Plant_1_Big.gltf') || await loadModelMesh('/models/nature/Plant_7_Big.gltf');
    if (tropicalPlantMesh) {
      const count = 55;
      const geom = getSmoothGeom(tropicalPlantMesh);
      const mat = getSmoothMaterial(tropicalPlantMesh, 0x5aa83e);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 155;
        const z = (Math.random() - 0.5) * 155;
        if (isClearOfPathAndStations(x, z, 4.0)) {
          const y = getHeight(x, z);
          if (y > 1.0) {
            const scale = 0.55 + Math.random() * 0.35;
            dummy.position.set(x, y - 0.05, z);
            dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
            dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.2), scale);
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // =========================================================
    // 5. WILDFLOWER MEADOW DRIFTS (Coral/Pink & Golden Blossom)
    // =========================================================
    const pinkFlowersMesh = await loadModelMesh('/models/nature/Flower_3_Group.gltf');
    if (pinkFlowersMesh) {
      const count = 150;
      const geom = getSmoothGeom(pinkFlowersMesh);
      const mat = getSmoothMaterial(pinkFlowersMesh, 0xf26477);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 160;
        const z = (Math.random() - 0.5) * 160;
        if (isClearOfPathAndStations(x, z, 2.2)) {
          const y = getHeight(x, z);
          if (y > 0.5 && y < 17.0) {
            const scale = 0.35 + Math.random() * 0.25;
            dummy.position.set(x, y, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    const yellowBlossomsMesh = await loadModelMesh('/models/nature/Flower_4_Group.gltf');
    if (yellowBlossomsMesh) {
      const count = 140;
      const geom = getSmoothGeom(yellowBlossomsMesh);
      const mat = getSmoothMaterial(yellowBlossomsMesh, 0xf9cb38);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 160;
        const z = (Math.random() - 0.5) * 160;
        if (isClearOfPathAndStations(x, z, 2.2)) {
          const y = getHeight(x, z);
          if (y > 0.5 && y < 17.0) {
            const scale = 0.32 + Math.random() * 0.22;
            dummy.position.set(x, y, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // =========================================================
    // 6. LUSH BUSHES & FLOWERING SHRUBS
    // =========================================================
    const bushMesh = await loadModelMesh('/models/nature/Bush_Common.gltf');
    if (bushMesh) {
      const count = 120;
      const geom = getSmoothGeom(bushMesh);
      const mat = getSmoothMaterial(bushMesh, 0x5ea64a);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 6 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 170;
        const z = (Math.random() - 0.5) * 170;
        if (isClearOfPathAndStations(x, z, 4.0)) {
          const y = getHeight(x, z);
          if (y > 0.8) {
            const scale = 0.42 + Math.random() * 0.35;
            dummy.position.set(x, y - 0.05, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale * (0.9 + Math.random() * 0.2), scale);
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    const bushFlowersMesh = await loadModelMesh('/models/nature/Bush_Common_Flowers.gltf');
    if (bushFlowersMesh) {
      const count = 90;
      const geom = getSmoothGeom(bushFlowersMesh);
      const mat = getSmoothMaterial(bushFlowersMesh, 0x6ab552);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 6 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 165;
        const z = (Math.random() - 0.5) * 165;
        if (isClearOfPathAndStations(x, z, 4.2)) {
          const y = getHeight(x, z);
          if (y > 1.0) {
            const scale = 0.4 + Math.random() * 0.3;
            dummy.position.set(x, y - 0.05, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            inst.setMatrixAt(placed, dummy.matrix);
            placed++;
          }
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // =========================================================
    // 7. BOULDERS, CLIFF FORMATIONS & PEBBLES
    // =========================================================
    const rock1Mesh = await loadModelMesh('/models/nature/Rock_Medium_1.gltf');
    const rock2Mesh = await loadModelMesh('/models/nature/Rock_Medium_2.gltf');
    const rockPrototypes = [rock1Mesh, rock2Mesh].filter((r): r is THREE.Mesh => r !== null);

    if (rockPrototypes.length > 0) {
      const count = 80;
      const primary = rockPrototypes[0];
      const geom = getSmoothGeom(primary);
      const mat = getSmoothMaterial(primary, 0x8a857b);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 175;
        const z = (Math.random() - 0.5) * 175;
        if (isClearOfPathAndStations(x, z, 3.6)) {
          const y = getHeight(x, z);
          const scale = 0.48 + Math.random() * 0.48;
          dummy.position.set(x, y - 0.15, z);
          dummy.rotation.set(Math.random() * 0.25, Math.random() * Math.PI * 2, Math.random() * 0.25);
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // River / Path Pebbles (Pebble_Round_1)
    const pebbleMesh = await loadModelMesh('/models/nature/Pebble_Round_1.gltf');
    if (pebbleMesh) {
      const count = 120;
      const geom = getSmoothGeom(pebbleMesh);
      const mat = getSmoothMaterial(pebbleMesh, 0x9c9489);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      if (pathSamplePoints.length > 0) {
        for (let i = 0; i < pathSamplePoints.length && placed < count; i += 2) {
          const pt = pathSamplePoints[i];
          const offsetDist = 1.6 + Math.random() * 2.0;
          const side = Math.random() > 0.5 ? 1 : -1;
          const px = pt.x + (Math.random() - 0.5) * 1.0 + side * offsetDist;
          const pz = pt.z + (Math.random() - 0.5) * 1.0 + side * offsetDist;
          const py = getHeight(px, pz) + 0.02;

          const scale = 0.6 + Math.random() * 0.5;
          dummy.position.set(px, py, pz);
          dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
          dummy.scale.set(scale, scale * 0.7, scale);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // Stepping Stones near Station Approaches
    const rockPathMesh = await loadModelMesh('/models/nature/RockPath_Round_Small_1.gltf');
    if (rockPathMesh) {
      const count = 35;
      const geom = getSmoothGeom(rockPathMesh);
      const mat = getSmoothMaterial(rockPathMesh, 0x9e988d);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      STATION_COORDINATES.forEach((coord) => {
        for (let s = 1; s <= 4 && placed < count; s++) {
          const offsetDist = 2.0 + s * 1.1;
          const angle = coord.t * Math.PI * 2 + s * 0.2;
          const px = coord.x + Math.sin(angle) * offsetDist;
          const pz = coord.z + Math.cos(angle) * offsetDist;
          const py = getHeight(px, pz) + 0.04;

          dummy.position.set(px, py, pz);
          dummy.rotation.set(0, angle, 0);
          dummy.scale.set(0.65, 0.5, 0.65);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      });

      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }

    // =========================================================
    // 8. DYNAMIC BREEZE RIBBONS / WIND TRAILS (From Reference Image)
    // =========================================================
    createBreezeRibbons();
  };

  /**
   * Creates delicate, curved translucent breeze ribbons flowing across the Rwandan meadows,
   * directly reproducing the atmospheric wind trails seen in the reference image.
   */
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
          // Fade at start and end of ribbon
          float fadeX = smoothstep(0.0, 0.25, vUv.x) * (1.0 - smoothstep(0.75, 1.0, vUv.x));
          // Fade at top and bottom edge
          float fadeY = 1.0 - abs(vUv.y - 0.5) * 2.0;
          float alpha = fadeX * fadeY * uOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    disposables.push(ribbonMat);

    for (let r = 0; r < ribbonCount; r++) {
      // Create a smooth sinuous ribbon geometry
      const points: THREE.Vector3[] = [];
      const ribbonLength = 18 + Math.random() * 12;
      const segs = 20;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const lx = (t - 0.5) * ribbonLength;
        const lz = Math.sin(t * Math.PI * 2.2) * 1.8;
        const ly = Math.cos(t * Math.PI * 1.8) * 0.45;
        points.push(new THREE.Vector3(lx, ly, lz));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.06, 6, false);
      disposables.push(tubeGeo);

      const ribbonMesh = new THREE.Mesh(tubeGeo, ribbonMat);

      // Distribute in different view sectors
      const startX = -70 + r * 18;
      const centerZ = -30 + (r % 3) * 25;
      const baseHeight = getHeight(startX, centerZ) + 1.8 + Math.random() * 1.8;

      ribbonMesh.position.set(startX, baseHeight, centerZ);
      ribbonMesh.rotation.y = 0.2 + (Math.random() - 0.5) * 0.4;
      breezeGroup.add(ribbonMesh);

      breezeRibbons.push({
        mesh: ribbonMesh,
        speed: 3.5 + Math.random() * 2.5,
        startX: startX,
        rangeX: 130,
      });
    }
  };

  const update = (dt: number, elapsed: number): void => {
    // 1. Gentle foliage breeze sway
    group.rotation.y = Math.sin(elapsed * 0.35) * 0.0015;

    // 2. Animate breeze ribbons across the landscape
    for (const b of breezeRibbons) {
      b.mesh.position.x += b.speed * dt;
      // Drift gently up and down
      b.mesh.position.y += Math.sin(elapsed * 1.5 + b.startX) * 0.005;

      // Wrap around when past boundary
      if (b.mesh.position.x > 85) {
        b.mesh.position.x = -85;
        const newY = getHeight(b.mesh.position.x, b.mesh.position.z) + 1.8 + Math.random() * 1.5;
        b.mesh.position.y = newY;
      }
    }
  };

  const dispose = (): void => {
    for (const inst of instancedMeshes) {
      inst.geometry.dispose();
      if (Array.isArray(inst.material)) {
        inst.material.forEach((m) => m.dispose());
      } else {
        inst.material.dispose();
      }
      group.remove(inst);
    }
    for (const cl of clonedGroups) {
      group.remove(cl);
    }
    breezeRibbons.forEach((b) => {
      breezeGroup.remove(b.mesh);
    });
    group.remove(breezeGroup);
    disposables.forEach((item) => item.dispose());
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

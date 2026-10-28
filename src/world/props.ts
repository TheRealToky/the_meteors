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
 * Loads Quaternius Stylized Nature MegaKit and Kenney environment assets,
 * scattering them across the terraced Rwandan landscape with natural proportions,
 * smooth shading, and scenic framing inspired by Sky: Children of the Light.
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

  // Pre-sample path points for proximity checking
  const pathSamplePoints: THREE.Vector3[] = [];
  if (pathCurve) {
    for (let t = 0; t <= 1; t += 0.012) {
      pathSamplePoints.push(pathCurve.getPointAt(t));
    }
  }

  // Ensure models never block the path, camera rail, or station circles
  const isClearOfPathAndStations = (x: number, z: number, minDist = 6.5): boolean => {
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
    // 1. Quaternius Common Highland Canopy Trees (CommonTree_1 & CommonTree_2)
    const tree1Scene = await loadGLTFScene('/models/nature/CommonTree_1.gltf');
    const tree2Scene = await loadGLTFScene('/models/nature/CommonTree_2.gltf');
    const treePlateau = await loadModelMesh('/models/tree_plateau.glb');

    const treePrototypes = [tree1Scene, tree2Scene].filter((t): t is THREE.Group => t !== null);

    if (treePrototypes.length > 0) {
      const count = 55;
      let placed = 0;
      for (let i = 0; i < count * 8 && placed < count; i++) {
        const angle = (i / (count * 8)) * Math.PI * 2 + Math.random() * 0.3;
        const radius = 24 + Math.random() * 86;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        if (isClearOfPathAndStations(x, z, 7.5)) {
          const y = getHeight(x, z);
          if (y > 2.0 && y < 17.5) {
            const proto = treePrototypes[placed % treePrototypes.length];
            const clone = proto.clone(true);
            const scale = 0.38 + Math.random() * 0.16; // Perfectly scaled to Rwandan hill contours
            clone.position.set(x, y - 0.1, z);
            clone.rotation.y = Math.random() * Math.PI * 2;
            clone.scale.set(scale, scale * (0.95 + Math.random() * 0.18), scale);
            group.add(clone);
            clonedGroups.push(clone);
            placed++;
          }
        }
      }
    } else if (treePlateau) {
      // Fallback to plateau tree if nature pack fails
      const count = 45;
      const geom = getSmoothGeom(treePlateau);
      const mat = getSmoothMaterial(treePlateau, 0x5da852);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;
      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 8 && placed < count; i++) {
        const angle = (i / (count * 8)) * Math.PI * 2 + Math.random() * 0.4;
        const radius = 22 + Math.random() * 88;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (isClearOfPathAndStations(x, z, 7.5)) {
          const y = getHeight(x, z);
          if (y > 2.0 && y < 17.5) {
            const scale = 1.45 + Math.random() * 0.75;
            dummy.position.set(x, y - 0.15, z);
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

    // 2. Grand Ancient Terraced Ridge Trees (TwistedTree_1)
    const twistedTreeScene = await loadGLTFScene('/models/nature/TwistedTree_1.gltf');
    if (twistedTreeScene) {
      const count = 10;
      let placed = 0;
      for (let i = 0; i < count * 10 && placed < count; i++) {
        const angle = (i / count) * Math.PI * 2 + 0.4;
        const radius = 45 + Math.random() * 55;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (isClearOfPathAndStations(x, z, 10.0)) {
          const y = getHeight(x, z);
          if (y > 4.5 && y < 18.0) {
            const clone = twistedTreeScene.clone(true);
            const scale = 0.22 + Math.random() * 0.08;
            clone.position.set(x, y - 0.15, z);
            clone.rotation.y = Math.random() * Math.PI * 2;
            clone.scale.set(scale, scale, scale);
            group.add(clone);
            clonedGroups.push(clone);
            placed++;
          }
        }
      }
    }

    // 3. Quaternius Lush Terrace Bushes (Bush_Common & Bush_Common_Flowers)
    const bushMesh = await loadModelMesh('/models/nature/Bush_Common.gltf') || await loadModelMesh('/models/plant_bush.glb');
    if (bushMesh) {
      const count = 65;
      const geom = getSmoothGeom(bushMesh);
      const mat = getSmoothMaterial(bushMesh, 0x62a850);
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
            const scale = 0.42 + Math.random() * 0.32;
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
      const count = 45;
      const geom = getSmoothGeom(bushFlowersMesh);
      const mat = getSmoothMaterial(bushFlowersMesh, 0x6bb556);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 6 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 155;
        const z = (Math.random() - 0.5) * 155;
        if (isClearOfPathAndStations(x, z, 4.5)) {
          const y = getHeight(x, z);
          if (y > 1.2 && y < 16.5) {
            const scale = 0.38 + Math.random() * 0.28;
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

    // 4. Wildflower Meadow Clumps (Flower_3_Group & Flower_4_Group)
    const flowerGroupMesh = await loadModelMesh('/models/nature/Flower_3_Group.gltf') || await loadModelMesh('/models/flower_redA.glb');
    if (flowerGroupMesh) {
      const count = 75;
      const geom = getSmoothGeom(flowerGroupMesh);
      const mat = getSmoothMaterial(flowerGroupMesh, 0xf06a78);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        if (isClearOfPathAndStations(x, z, 2.5)) {
          const y = getHeight(x, z);
          if (y > 0.5 && y < 16.5) {
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

    const yellowBlossomsMesh = await loadModelMesh('/models/nature/Flower_4_Group.gltf') || await loadModelMesh('/models/flower_yellowA.glb');
    if (yellowBlossomsMesh) {
      const count = 70;
      const geom = getSmoothGeom(yellowBlossomsMesh);
      const mat = getSmoothMaterial(yellowBlossomsMesh, 0xf8d048);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;
        if (isClearOfPathAndStations(x, z, 2.5)) {
          const y = getHeight(x, z);
          if (y > 0.5 && y < 16.5) {
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

    // 5. Stylized Volcanic Boulders (Rock_Medium_1)
    const rockMesh = await loadModelMesh('/models/nature/Rock_Medium_1.gltf') || await loadModelMesh('/models/rock_largeA.glb');
    if (rockMesh) {
      const count = 48;
      const geom = getSmoothGeom(rockMesh);
      const mat = getSmoothMaterial(rockMesh, 0x8a8479);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;
      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 170;
        const z = (Math.random() - 0.5) * 170;
        if (isClearOfPathAndStations(x, z, 3.8)) {
          const y = getHeight(x, z);
          const scale = 0.45 + Math.random() * 0.4;
          dummy.position.set(x, y - 0.12, z);
          dummy.rotation.set(
            Math.random() * 0.3,
            Math.random() * Math.PI * 2,
            Math.random() * 0.3
          );
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

    // 6. Natural Stone Pavers (RockPath_Round_Small_1) lining Station Approaches
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

    // 7. Rustic Boundary Fences (fence-low.glb) along high overlook drops
    const fenceMesh = await loadModelMesh('/models/props/fence-low.glb');
    if (fenceMesh) {
      const count = 30;
      const geom = getSmoothGeom(fenceMesh);
      const mat = getSmoothMaterial(fenceMesh, 0x6e4e30);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < count * 4 && placed < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 32 + (i % 3) * 18;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = getHeight(x, z);

        // Place on upper terrace ridges (steep viewpoint drops)
        if (y > 9.0 && isClearOfPathAndStations(x, z, 5.0)) {
          dummy.position.set(x, y - 0.04, z);
          dummy.rotation.y = angle + Math.PI / 2;
          dummy.scale.set(1.4, 1.4, 1.4);
          dummy.updateMatrix();
          inst.setMatrixAt(placed, dummy.matrix);
          placed++;
        }
      }

      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
      instancedMeshes.push(inst);
    }
  };

  const update = (_dt: number, elapsed: number): void => {
    // Gentle foliage breeze sway
    group.rotation.y = Math.sin(elapsed * 0.35) * 0.0015;
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
    disposables.forEach((item) => item.dispose());
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

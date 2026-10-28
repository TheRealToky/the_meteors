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
 * Loads CC0 nature assets and scatters them across the terraced Rwandan landscape
 * using InstancedMesh with natural proportions, smooth shading, and scenic framing.
 * Ensures clear pathways and open station areas (Sky: Children of the Light aesthetic).
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

  // Helper to pre-sample path points for fast proximity tests
  const pathSamplePoints: THREE.Vector3[] = [];
  if (pathCurve) {
    for (let t = 0; t <= 1; t += 0.015) {
      pathSamplePoints.push(pathCurve.getPointAt(t));
    }
  }

  // Check if a coordinate is too close to the walking path or any life station
  const isClearOfPathAndStations = (x: number, z: number, minDist = 6.5): boolean => {
    // 1. Keep station areas open and legible
    for (const s of STATION_COORDINATES) {
      if (Math.hypot(x - s.x, z - s.z) < minDist + 2.5) return false;
    }
    // 2. Keep the walking corridor open
    for (const pt of pathSamplePoints) {
      if (Math.hypot(x - pt.x, z - pt.z) < minDist) return false;
    }
    return true;
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
      console.warn(`Could not load prop from ${url}:`, err);
      return null;
    }
  };

  const load = async (): Promise<void> => {
    // Helper to get smooth geometry with smoothed normals
    const getSmoothGeom = (mesh: THREE.Mesh): THREE.BufferGeometry => {
      const geom = mesh.geometry.clone();
      geom.computeVertexNormals();
      return geom;
    };

    // Helper to prepare material with smooth shading and warm tones
    const getSmoothMaterial = (mesh: THREE.Mesh, fallbackColor: number): THREE.Material => {
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          return mesh.material.map((m) => {
            const clone = m.clone();
            if ('flatShading' in clone) (clone as THREE.MeshStandardMaterial).flatShading = false;
            if ('roughness' in clone) (clone as THREE.MeshStandardMaterial).roughness = 0.75;
            return clone;
          })[0];
        } else {
          const clone = mesh.material.clone();
          if ('flatShading' in clone) (clone as THREE.MeshStandardMaterial).flatShading = false;
          if ('roughness' in clone) (clone as THREE.MeshStandardMaterial).roughness = 0.75;
          return clone;
        }
      }
      return new THREE.MeshStandardMaterial({
        color: fallbackColor,
        roughness: 0.75,
        metalness: 0.0,
        flatShading: false,
      });
    };

    // 1. Highland Plateau / Acacia Trees (characteristic Rwandan ridge trees)
    const plateauMesh = await loadModelMesh('/models/tree_plateau.glb');
    if (plateauMesh) {
      const count = 55;
      const geom = getSmoothGeom(plateauMesh);
      const mat = getSmoothMaterial(plateauMesh, 0x5da852);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < count * 8 && placed < count; i++) {
        // Distribute along hilltops and terrace ridges
        const angle = (i / (count * 8)) * Math.PI * 2 + Math.random() * 0.4;
        const radius = 22 + Math.random() * 88;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        if (isClearOfPathAndStations(x, z, 7.5)) {
          const y = getHeight(x, z);
          // Plausible, natural tree scale (1.5 - 2.2 units tall)
          if (y > 2.0 && y < 17.5) {
            const scale = 1.45 + Math.random() * 0.75;
            dummy.position.set(x, y - 0.15, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale * (0.95 + Math.random() * 0.2), scale);
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

    // 2. Detailed Savannah / Highland Trees
    const detailedMesh = await loadModelMesh('/models/tree_detailed.glb') || await loadModelMesh('/models/tree_default.glb');
    if (detailedMesh) {
      const count = 45;
      const geom = getSmoothGeom(detailedMesh);
      const mat = getSmoothMaterial(detailedMesh, 0x4a9447);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < count * 8 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 180;
        const z = (Math.random() - 0.5) * 180;

        if (isClearOfPathAndStations(x, z, 7.5)) {
          const y = getHeight(x, z);
          if (y > 2.5 && y < 17.0) {
            const scale = 1.35 + Math.random() * 0.7;
            dummy.position.set(x, y - 0.15, z);
            dummy.rotation.y = Math.random() * Math.PI * 2;
            dummy.scale.set(scale, scale * (0.95 + Math.random() * 0.2), scale);
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

    // 3. Flowering Bushes (framing terrace steps without blocking path)
    const bushMesh = await loadModelMesh('/models/plant_bush.glb');
    if (bushMesh) {
      const count = 65;
      const geom = getSmoothGeom(bushMesh);
      const mat = getSmoothMaterial(bushMesh, 0x6bb556);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < count * 6 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 160;
        const z = (Math.random() - 0.5) * 160;

        if (isClearOfPathAndStations(x, z, 4.5)) {
          const y = getHeight(x, z);
          if (y > 1.0) {
            const scale = 0.85 + Math.random() * 0.55;
            dummy.position.set(x, y - 0.08, z);
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

    // 4. Wildflower Meadow Patches (Red & Yellow blossoms along meadow slopes)
    const flowerRedMesh = await loadModelMesh('/models/flower_redA.glb');
    if (flowerRedMesh) {
      const count = 75;
      const geom = getSmoothGeom(flowerRedMesh);
      const mat = getSmoothMaterial(flowerRedMesh, 0xf2586a);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;

        if (isClearOfPathAndStations(x, z, 2.8)) {
          const y = getHeight(x, z);
          if (y > 0.5 && y < 16.0) {
            const scale = 0.75 + Math.random() * 0.45;
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

    const flowerYellowMesh = await loadModelMesh('/models/flower_yellowA.glb');
    if (flowerYellowMesh) {
      const count = 75;
      const geom = getSmoothGeom(flowerYellowMesh);
      const mat = getSmoothMaterial(flowerYellowMesh, 0xf6cb44);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = false;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < count * 5 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 150;
        const z = (Math.random() - 0.5) * 150;

        if (isClearOfPathAndStations(x, z, 2.8)) {
          const y = getHeight(x, z);
          if (y > 0.5 && y < 16.0) {
            const scale = 0.75 + Math.random() * 0.45;
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

    // 5. Stylized Volcanic Boulders & Stones
    const rockMesh = await loadModelMesh('/models/rock_largeA.glb') || await loadModelMesh('/models/rock_smallA.glb');
    if (rockMesh) {
      const count = 45;
      const geom = getSmoothGeom(rockMesh);
      const mat = getSmoothMaterial(rockMesh, 0x8a8479);
      const inst = new THREE.InstancedMesh(geom, mat, count);
      inst.castShadow = true;
      inst.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let placed = 0;

      for (let i = 0; i < count * 4 && placed < count; i++) {
        const x = (Math.random() - 0.5) * 170;
        const z = (Math.random() - 0.5) * 170;

        if (isClearOfPathAndStations(x, z, 3.8)) {
          const y = getHeight(x, z);
          const scale = 0.95 + Math.random() * 0.85;
          dummy.position.set(x, y - 0.2, z);
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
  };

  const update = (_dt: number, elapsed: number): void => {
    // Subtle breeze sway on nature foliage
    group.rotation.y = Math.sin(elapsed * 0.35) * 0.002;
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
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

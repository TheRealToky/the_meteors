import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface PropsManager {
  group: THREE.Group;
  load: () => Promise<void>;
  dispose: () => void;
}

/**
 * Loads low-poly CC0 nature assets and scatters them across the terraced terrain
 * using InstancedMesh to keep draw calls minimal (< 10 draw calls).
 */
export function createPropsManager(
  scene: THREE.Scene,
  getHeight: (x: number, z: number) => number
): PropsManager {
  const group = new THREE.Group();
  scene.add(group);

  const loader = new GLTFLoader();
  const instancedMeshes: THREE.InstancedMesh[] = [];

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
    // Shared stylized low-poly material palette
    const treeMat = new THREE.MeshStandardMaterial({
      color: 0x3b8538,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: true,
    });

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x8a8479,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });

    // 1. Scatter plateau trees (typical of Rwandan ridges and savannah borders)
    const treeMesh = await loadModelMesh('/models/tree_plateau.glb');
    if (treeMesh) {
      const treeCount = 65;
      const geom = treeMesh.geometry.clone();
      const instTree = new THREE.InstancedMesh(geom, treeMat, treeCount);
      instTree.castShadow = true;
      instTree.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let index = 0;

      for (let i = 0; i < treeCount * 2 && index < treeCount; i++) {
        // Distribute within terrain bounds, avoiding the immediate path center
        const angle = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 85;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = getHeight(x, z);

        // Place on gentle elevations
        if (y > 1.0 && y < 18.0) {
          const scale = 0.9 + Math.random() * 0.7;
          dummy.position.set(x, y - 0.2, z);
          dummy.rotation.y = Math.random() * Math.PI * 2;
          dummy.scale.set(scale, scale, scale);
          dummy.updateMatrix();

          instTree.setMatrixAt(index, dummy.matrix);
          index++;
        }
      }

      instTree.instanceMatrix.needsUpdate = true;
      group.add(instTree);
      instancedMeshes.push(instTree);
    }

    // 2. Scatter boulders and rocks
    const rockMesh = await loadModelMesh('/models/rock_largeA.glb');
    if (rockMesh) {
      const rockCount = 45;
      const geom = rockMesh.geometry.clone();
      const instRock = new THREE.InstancedMesh(geom, rockMat, rockCount);
      instRock.castShadow = true;
      instRock.receiveShadow = true;

      const dummy = new THREE.Object3D();
      let index = 0;

      for (let i = 0; i < rockCount * 2 && index < rockCount; i++) {
        const x = (Math.random() - 0.5) * 160;
        const z = (Math.random() - 0.5) * 160;
        const y = getHeight(x, z);

        const scale = 0.7 + Math.random() * 0.9;
        dummy.position.set(x, y - 0.3, z);
        dummy.rotation.set(
          Math.random() * 0.4,
          Math.random() * Math.PI * 2,
          Math.random() * 0.4
        );
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();

        instRock.setMatrixAt(index, dummy.matrix);
        index++;
      }

      instRock.instanceMatrix.needsUpdate = true;
      group.add(instRock);
      instancedMeshes.push(instRock);
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
    scene.remove(group);
  };

  return { group, load, dispose };
}

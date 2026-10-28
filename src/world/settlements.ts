import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface SettlementsManager {
  group: THREE.Group;
  load: () => Promise<void>;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Creates stylized Rwandan rural settlements, homesteads, paved access road spurs,
 * community vehicles, and street furniture. Carefully integrated into the terraced landscape
 * with natural proportions, harmonious materials, and soft lighting.
 */
export function createSettlementsManager(
  scene: THREE.Scene,
  getHeight: (x: number, z: number) => number
): SettlementsManager {
  const group = new THREE.Group();
  scene.add(group);

  const loader = new GLTFLoader();
  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  const loadGLTFScene = async (url: string): Promise<THREE.Group | null> => {
    try {
      const gltf = await loader.loadAsync(url);
      gltf.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.geometry) {
            child.geometry.computeVertexNormals();
            disposables.push(child.geometry);
          }
          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => {
              if ('flatShading' in m) (m as THREE.MeshStandardMaterial).flatShading = false;
              if ('roughness' in m) (m as THREE.MeshStandardMaterial).roughness = 0.78;
              if ('metalness' in m) (m as THREE.MeshStandardMaterial).metalness = 0.02;
              disposables.push(m);
            });
          }
        }
      });
      return gltf.scene;
    } catch (err) {
      console.warn(`Could not load settlement GLTF from ${url}:`, err);
      return null;
    }
  };

  const placeModel = (
    model: THREE.Group,
    x: number,
    z: number,
    scale: number | [number, number, number],
    rotY: number = 0,
    yOffset: number = -0.05
  ): THREE.Group => {
    const clone = model.clone(true);
    const y = getHeight(x, z) + yOffset;
    clone.position.set(x, y, z);
    clone.rotation.y = rotY;
    if (typeof scale === 'number') {
      clone.scale.set(scale, scale, scale);
    } else {
      clone.scale.set(scale[0], scale[1], scale[2]);
    }
    group.add(clone);
    return clone;
  };

  const load = async (): Promise<void> => {
    // 1. Load Building Models (Kenney Suburban Kit)
    const [
      houseA,
      houseB,
      houseE,
      houseF,
      roadStraight,
      roadBend,
      roadCurve,
      van,
      truck,
      sedan,
      lampCurved,
      electricPole,
      fencePost,
      fence1x3,
      driveway,
      tableRound,
      boxCrate,
    ] = await Promise.all([
      loadGLTFScene('/models/props/building-type-a.glb'),
      loadGLTFScene('/models/props/building-type-b.glb'),
      loadGLTFScene('/models/props/building-type-e.glb'),
      loadGLTFScene('/models/props/building-type-f.glb'),
      loadGLTFScene('/models/props/road-straight.glb'),
      loadGLTFScene('/models/props/road-bend.glb'),
      loadGLTFScene('/models/props/road-curve.glb'),
      loadGLTFScene('/models/props/van.glb'),
      loadGLTFScene('/models/props/truck.glb'),
      loadGLTFScene('/models/props/sedan.glb'),
      loadGLTFScene('/models/props/light-curved.glb'),
      loadGLTFScene('/models/props/electricity-pole-single.glb'),
      loadGLTFScene('/models/props/fence.glb'),
      loadGLTFScene('/models/props/fence-1x3.glb'),
      loadGLTFScene('/models/props/driveway-short.glb'),
      loadGLTFScene('/models/props/tableRound.glb'),
      loadGLTFScene('/models/props/cardboardBoxClosed.glb'),
    ]);

    // -------------------------------------------------------------
    // Settlement 1: "Urugwiro Ridge Village" (Between Birth & Youth)
    // A terraced hillside Rwandan homestead cluster with rural transport
    // -------------------------------------------------------------
    if (houseA && houseB && houseE) {
      // Small village homesteads nestled along a gentle agricultural terrace
      placeModel(houseA, -31.5, -16.0, 1.85, 0.45);
      placeModel(houseE, -25.0, -20.5, 1.95, -0.35);
      placeModel(houseB, -18.5, -13.5, 1.75, 1.25);
    }

    // Paved Access Road Spur connecting village to the agricultural terrace
    if (roadStraight && roadBend) {
      // 3 road segments forming a connecting spur along the terrace shelf
      placeModel(roadStraight, -27.5, -12.5, [1.6, 0.25, 1.6], 0.4, 0.02);
      placeModel(roadBend,     -24.5, -10.5, [1.6, 0.25, 1.6], 1.95, 0.02);
      placeModel(roadStraight, -21.5,  -8.5, [1.6, 0.25, 1.6], 0.4, 0.02);
    }

    if (driveway) {
      // Stone driveway paving connecting homestead to the road
      placeModel(driveway, -28.5, -14.5, [1.4, 0.3, 1.4], 0.45, 0.03);
    }

    // Rwandan Transport Vehicles
    if (van) {
      // Minibus taxi (Matatu / Twegerane) parked along the village road
      placeModel(van, -26.0, -11.5, 0.95, 0.42, 0.05);
    }

    if (truck) {
      // Farm pickup truck transporting harvest
      placeModel(truck, -20.5, -7.5, 0.92, -2.65, 0.05);
    }

    // Village details: Wooden fences, crates, outdoor table, lamps
    if (fencePost && fence1x3) {
      // Homestead perimeter garden fence
      placeModel(fence1x3, -33.5, -14.5, 0.75, 0.45);
      placeModel(fencePost, -29.5, -17.5, 0.75, -1.1);
      placeModel(fence1x3, -22.5, -19.0, 0.75, 0.2);
    }

    if (boxCrate) {
      // Market harvest produce crates near the farm truck
      placeModel(boxCrate, -19.5, -6.8, 0.85, 0.2);
      placeModel(boxCrate, -19.0, -6.5, 0.75, 0.8);
      placeModel(boxCrate, -19.2, -6.6, 0.7, 0.4, 0.45); // stacked crate
    }

    if (tableRound) {
      // Outdoor village meeting table
      placeModel(tableRound, -29.0, -18.0, 1.1, 0.0);
    }

    if (lampCurved && electricPole) {
      // Rural infrastructure
      placeModel(lampCurved, -24.0, -9.5, 1.2, -1.2);
      placeModel(electricPole, -34.0, -18.5, 1.35, 0.1);
      placeModel(electricPole, -16.0, -6.0, 1.35, 0.3);
    }

    // -------------------------------------------------------------
    // Settlement 2: "Ubumwe Civil Sector" (Overlooking Marriage Station)
    // Modest community administrative and social center
    // -------------------------------------------------------------
    if (houseF && houseB) {
      // Administrative community buildings with shaded verandas
      placeModel(houseF, 8.5, -24.5, 2.05, 0.2);
      placeModel(houseB, 17.5, -27.0, 1.85, -0.6);
    }

    if (sedan) {
      // Civil registration staff vehicle parked near community center
      placeModel(sedan, 11.5, -21.0, 0.95, -1.4, 0.05);
    }

    if (roadStraight && roadCurve) {
      // Paved turnout for community center
      placeModel(roadStraight, 10.0, -22.5, [1.5, 0.25, 1.5], 0.2, 0.02);
      placeModel(roadCurve,    13.0, -24.0, [1.5, 0.25, 1.5], -1.35, 0.02);
    }

    if (lampCurved) {
      placeModel(lampCurved, 6.5, -23.0, 1.25, 0.4);
    }

    if (fence1x3) {
      placeModel(fence1x3, 6.0, -26.0, 0.8, 0.2);
      placeModel(fence1x3, 19.5, -25.5, 0.8, -0.6);
    }

    // -------------------------------------------------------------
    // Settlement 3: "Hillside Homesteads" (Between Marriage & Divorce)
    // Scenic outlying cottages nestled into agricultural slopes
    // -------------------------------------------------------------
    if (houseA && houseE) {
      placeModel(houseA, 29.5, 13.5, 1.7, 0.85);
      placeModel(houseE, 37.0, 4.5, 1.8, -0.45);
    }

    if (fence1x3) {
      placeModel(fence1x3, 27.5, 15.0, 0.75, 0.85);
      placeModel(fence1x3, 39.0, 3.0, 0.75, -0.45);
    }

    if (electricPole) {
      placeModel(electricPole, 33.0, 9.0, 1.35, 0.0);
    }
  };

  const update = (_dt: number, _elapsed: number): void => {
    // Static structures require no per-frame transformation
  };

  const dispose = (): void => {
    disposables.forEach((item) => item.dispose());
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

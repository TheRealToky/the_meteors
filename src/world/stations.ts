import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface StationsManager {
  group: THREE.Group;
  load: () => Promise<void>;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Creates traditional stylized Rwandan architecture and atmospheric landmarks at life stations.
 * Features conical thatched pavilions (Inzu / Urukari palace style), Imigongo geometric accents,
 * glowing spirit lanterns, and integrated furniture/props narrating the CRVS life journey.
 */
export function createStationsManager(
  scene: THREE.Scene,
  getHeight: (x: number, z: number) => number
): StationsManager {
  const group = new THREE.Group();
  scene.add(group);

  const loader = new GLTFLoader();
  const materialsToDispose: THREE.Material[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const animatedLanterns: Array<{ mesh: THREE.Mesh; baseIntensity: number; phase: number }> = [];

  // Shared Stylized Architectural Materials
  const thatchMat = new THREE.MeshStandardMaterial({
    color: 0xcca062, // Warm golden woven thatch
    roughness: 0.88,
    metalness: 0.0,
    flatShading: false,
  });
  materialsToDispose.push(thatchMat);

  const woodPostMat = new THREE.MeshStandardMaterial({
    color: 0x5a3d24, // Dark polished eucalyptus timber
    roughness: 0.75,
    metalness: 0.0,
    flatShading: false,
  });
  materialsToDispose.push(woodPostMat);

  const clayWallMat = new THREE.MeshStandardMaterial({
    color: 0xba8a63, // Traditional reddish-ochre mud plaster
    roughness: 0.85,
    metalness: 0.0,
    flatShading: false,
  });
  materialsToDispose.push(clayWallMat);

  const stonePlinthMat = new THREE.MeshStandardMaterial({
    color: 0x827d74, // Misted volcanic flagstone
    roughness: 0.9,
    metalness: 0.02,
    flatShading: false,
  });
  materialsToDispose.push(stonePlinthMat);

  // Glowing lantern material (Sky: Children of the Light soft warm glow)
  const lanternMat = new THREE.MeshBasicMaterial({
    color: 0xffe899,
  });
  materialsToDispose.push(lanternMat);

  const glowAuraMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0xffd566) },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - max(0.0, dot(vNormal, vViewDir)), 2.5);
        gl_FragColor = vec4(uColor, fresnel * 0.7);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  });
  materialsToDispose.push(glowAuraMat);

  /**
   * Builds a stylized traditional Rwandan round pavilion (Inzu y'Umwami style)
   */
  const buildRwandanPavilion = (
    x: number,
    z: number,
    scale = 1.0,
    withLantern = true
  ): THREE.Group => {
    const pavilion = new THREE.Group();
    const groundY = getHeight(x, z);
    pavilion.position.set(x, groundY, z);

    // 1. Stone platform base
    const baseRadius = 3.6 * scale;
    const baseHeight = 0.35 * scale;
    const baseGeo = new THREE.CylinderGeometry(baseRadius, baseRadius * 1.06, baseHeight, 24);
    geometriesToDispose.push(baseGeo);
    const baseMesh = new THREE.Mesh(baseGeo, stonePlinthMat);
    baseMesh.position.y = baseHeight * 0.5;
    baseMesh.receiveShadow = true;
    pavilion.add(baseMesh);

    // 2. Circular perimeter wooden posts
    const postCount = 8;
    const postRadius = baseRadius * 0.82;
    const postHeight = 2.4 * scale;
    const postGeo = new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, postHeight, 8);
    geometriesToDispose.push(postGeo);

    for (let i = 0; i < postCount; i++) {
      const angle = (i / postCount) * Math.PI * 2;
      if (Math.cos(angle) > 0.85) continue; // Entrance opening

      const px = Math.sin(angle) * postRadius;
      const pz = Math.cos(angle) * postRadius;
      const postMesh = new THREE.Mesh(postGeo, woodPostMat);
      postMesh.position.set(px, baseHeight + postHeight * 0.5, pz);
      postMesh.castShadow = true;
      pavilion.add(postMesh);
    }

    // 3. Low curved clay half-wall
    const wallGeo = new THREE.CylinderGeometry(
      postRadius,
      postRadius,
      1.1 * scale,
      24,
      1,
      true,
      0.8,
      Math.PI * 1.55
    );
    geometriesToDispose.push(wallGeo);
    const wallMesh = new THREE.Mesh(wallGeo, clayWallMat);
    wallMesh.position.y = baseHeight + 0.55 * scale;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    pavilion.add(wallMesh);

    // 4. Conical thatched roof
    const roofBaseY = baseHeight + postHeight;
    const roofRadius = baseRadius * 1.08;
    const roofHeight = 3.2 * scale;

    const roofGeo = new THREE.ConeGeometry(roofRadius, roofHeight, 24);
    geometriesToDispose.push(roofGeo);
    const roofMesh = new THREE.Mesh(roofGeo, thatchMat);
    roofMesh.position.y = roofBaseY + roofHeight * 0.5;
    roofMesh.castShadow = true;
    pavilion.add(roofMesh);

    // Top roof ring / finial
    const finialGeo = new THREE.SphereGeometry(0.24 * scale, 12, 12);
    geometriesToDispose.push(finialGeo);
    const finialMesh = new THREE.Mesh(finialGeo, woodPostMat);
    finialMesh.position.y = roofBaseY + roofHeight + 0.15 * scale;
    pavilion.add(finialMesh);

    // 5. Hanging warm celestial lantern
    if (withLantern) {
      const lanternGeo = new THREE.SphereGeometry(0.32 * scale, 16, 16);
      geometriesToDispose.push(lanternGeo);
      const lanternMesh = new THREE.Mesh(lanternGeo, lanternMat);
      lanternMesh.position.set(0, baseHeight + 1.6 * scale, 0);

      const auraGeo = new THREE.SphereGeometry(0.65 * scale, 16, 16);
      geometriesToDispose.push(auraGeo);
      const auraMesh = new THREE.Mesh(auraGeo, glowAuraMat);
      lanternMesh.add(auraMesh);

      pavilion.add(lanternMesh);
      animatedLanterns.push({
        mesh: lanternMesh,
        baseIntensity: 1.0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    return pavilion;
  };

  /**
   * Builds an ancient stone cairn / spirit beacon waypoint
   */
  const buildStoneCairn = (x: number, z: number, scale = 0.9): THREE.Group => {
    const cairn = new THREE.Group();
    const groundY = getHeight(x, z);
    cairn.position.set(x, groundY, z);

    const s1Geo = new THREE.DodecahedronGeometry(0.48 * scale, 1);
    const s2Geo = new THREE.DodecahedronGeometry(0.36 * scale, 1);
    const s3Geo = new THREE.DodecahedronGeometry(0.24 * scale, 1);
    geometriesToDispose.push(s1Geo, s2Geo, s3Geo);

    const m1 = new THREE.Mesh(s1Geo, stonePlinthMat);
    m1.position.y = 0.3 * scale;
    m1.scale.set(1.2, 0.7, 1.1);
    m1.castShadow = true;
    cairn.add(m1);

    const m2 = new THREE.Mesh(s2Geo, stonePlinthMat);
    m2.position.y = 0.65 * scale;
    m2.scale.set(1.1, 0.65, 1.0);
    m2.rotation.y = 0.8;
    m2.castShadow = true;
    cairn.add(m2);

    const m3 = new THREE.Mesh(s3Geo, stonePlinthMat);
    m3.position.y = 0.95 * scale;
    m3.scale.set(0.9, 0.6, 0.9);
    m3.rotation.y = 1.4;
    m3.castShadow = true;
    cairn.add(m3);

    const runeGeo = new THREE.OctahedronGeometry(0.18 * scale, 0);
    geometriesToDispose.push(runeGeo);
    const runeMesh = new THREE.Mesh(runeGeo, lanternMat);
    runeMesh.position.y = 1.35 * scale;
    cairn.add(runeMesh);

    animatedLanterns.push({
      mesh: runeMesh,
      baseIntensity: 1.0,
      phase: Math.random() * Math.PI * 2,
    });

    return cairn;
  };

  /**
   * Builds a stylized 3D Red Cross emblem for the Health Clinic
   */
  const buildMedicalCross = (scale = 1.0): THREE.Group => {
    const cross = new THREE.Group();
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    materialsToDispose.push(crossMat);

    const b1 = new THREE.BoxGeometry(0.35 * scale, 1.2 * scale, 0.15 * scale);
    const b2 = new THREE.BoxGeometry(1.2 * scale, 0.35 * scale, 0.15 * scale);
    geometriesToDispose.push(b1, b2);

    cross.add(new THREE.Mesh(b1, crossMat));
    cross.add(new THREE.Mesh(b2, crossMat));
    return cross;
  };

  /**
   * Builds a stylized 3D Scales of Justice emblem for the Courtroom
   */
  const buildCourtEmblem = (scale = 1.0): THREE.Group => {
    const emblem = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.25,
    });
    materialsToDispose.push(brassMat);

    // Pillar
    const stemGeo = new THREE.CylinderGeometry(0.06 * scale, 0.08 * scale, 1.2 * scale, 8);
    // Crossbar
    const barGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 1.1 * scale, 8);
    // Bowls
    const bowlGeo = new THREE.ConeGeometry(0.24 * scale, 0.14 * scale, 12);
    geometriesToDispose.push(stemGeo, barGeo, bowlGeo);

    const stem = new THREE.Mesh(stemGeo, brassMat);
    stem.position.y = 0.6 * scale;
    emblem.add(stem);

    const bar = new THREE.Mesh(barGeo, brassMat);
    bar.rotation.z = Math.PI * 0.5;
    bar.position.y = 1.15 * scale;
    emblem.add(bar);

    const leftBowl = new THREE.Mesh(bowlGeo, brassMat);
    leftBowl.position.set(-0.5 * scale, 0.95 * scale, 0);
    emblem.add(leftBowl);

    const rightBowl = new THREE.Mesh(bowlGeo, brassMat);
    rightBowl.position.set(0.5 * scale, 0.95 * scale, 0);
    emblem.add(rightBowl);

    return emblem;
  };

  // Place architectural landmarks at key stations
  const pavilions: Record<string, THREE.Group> = {};

  // Canonical House Centers
  const HOUSE_POSITIONS: Record<string, { x: number; z: number; scale: number }> = {
    intro:    { x: -72.0, z: -56.0, scale: 1.25 },
    birth:    { x: -36.0, z: -28.0, scale: 1.15 }, // District Maternity Health Center
    growing:  { x: -22.0, z:  -2.0, scale: 1.25 }, // The School of Life
    marriage: { x:  20.0, z:  -5.0, scale: 1.35 }, // Town Hall (Umurenge Civil Registry)
    divorce:  { x:  32.0, z:  26.0, scale: 1.20 }, // Community Justice Courtroom
    death:    { x:  68.0, z: -34.0, scale: 1.30 }, // Sunset Sanctuary & Memory Pavilion
    outro:    { x:  75.0, z:  32.0, scale: 1.40 }, // Panorama Ridge
  };

  Object.entries(HOUSE_POSITIONS).forEach(([id, cfg]) => {
    const pavilion = buildRwandanPavilion(cfg.x, cfg.z, cfg.scale);
    pavilions[id] = pavilion;
    group.add(pavilion);

    if (id === 'birth') {
      const cross = buildMedicalCross(0.9);
      cross.position.set(0, 3.8, 2.8);
      pavilion.add(cross);
      group.add(buildStoneCairn(cfg.x - 3.5, cfg.z - 2.0, 1.0));
    } else if (id === 'growing') {
      group.add(buildStoneCairn(cfg.x - 4.5, cfg.z - 1.5, 0.95));
    } else if (id === 'marriage') {
      group.add(buildStoneCairn(cfg.x - 4.5, cfg.z - 2.0, 1.1));
    } else if (id === 'divorce') {
      const courtEmblem = buildCourtEmblem(0.9);
      courtEmblem.position.set(0, 3.6, 2.7);
      pavilion.add(courtEmblem);
      group.add(buildStoneCairn(cfg.x + 4.0, cfg.z + 2.5, 1.0));
    } else if (id === 'death') {
      group.add(buildStoneCairn(cfg.x - 4.5, cfg.z - 2.0, 1.2));
      group.add(buildStoneCairn(cfg.x - 6.0, cfg.z + 1.5, 0.85));
    }
  });

  // Load and decorate stations with Kenney furniture & props
  const load = async (): Promise<void> => {
    const loadModel = async (url: string): Promise<THREE.Group | null> => {
      try {
        const gltf = await loader.loadAsync(url);
        gltf.scene.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.geometry) c.geometry.computeVertexNormals();
            if (c.material) {
              const mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach((m) => {
                if ('flatShading' in m) (m as THREE.MeshStandardMaterial).flatShading = false;
                if ('roughness' in m) (m as THREE.MeshStandardMaterial).roughness = 0.72;
              });
            }
          }
        });
        return gltf.scene;
      } catch (err) {
        console.warn(`Could not load station prop ${url}:`, err);
        return null;
      }
    };

    const benchModel = await loadModel('/models/props/bench.glb');
    const deskModel = await loadModel('/models/props/desk.glb');
    const booksModel = await loadModel('/models/props/books.glb');
    const chairModel = await loadModel('/models/props/chairRounded.glb');
    const planterModel = await loadModel('/models/props/planter.glb');
    const ambulanceModel = await loadModel('/models/props/ambulance.glb');
    const deadTreeModel = await loadModel('/models/nature/DeadTree_1.gltf');

    // Helper to position a model at (x, z) grounded on terrain
    const placeProp = (model: THREE.Group | null, x: number, z: number, scale = 1.0, rotY = 0): void => {
      if (!model) return;
      const clone = model.clone(true);
      const y = getHeight(x, z);
      clone.position.set(x, y + 0.02, z);
      clone.rotation.y = rotY;
      clone.scale.set(scale, scale, scale);
      group.add(clone);
    };

    // Helper to place prop inside or relative to a pavilion platform
    const placeInPavilion = (pavilion: THREE.Group | undefined, model: THREE.Group | null, localX: number, localZ: number, scale = 1.0, rotY = 0): void => {
      if (!pavilion || !model) return;
      const clone = model.clone(true);
      clone.position.set(localX, 0.38, localZ);
      clone.rotation.y = rotY;
      clone.scale.set(scale, scale, scale);
      pavilion.add(clone);
    };

    // 1. Birth Station (Maternity Clinic ambulance parked on arrival terrace, bench, and planters)
    if (ambulanceModel) {
      placeProp(ambulanceModel, -41.5, -24.5, 1.15, 0.4);
    }
    if (benchModel) {
      placeProp(benchModel, -32.5, -25.5, 1.8, 0.2);
    }
    if (planterModel) {
      placeProp(planterModel, -33.5, -23.5, 1.5, 0.1);
      placeProp(planterModel, -39.0, -23.5, 1.5, -0.3);
    }

    // 2. Growing Up / School of Life Station (Youth study desk, ledgers, rest bench, terrace planters)
    const schoolPavilion = pavilions['growing'];
    if (schoolPavilion) {
      if (deskModel) {
        placeInPavilion(schoolPavilion, deskModel, 0, 0, 1.6, 0.4);
      }
      if (booksModel) {
        const books = booksModel.clone(true);
        books.position.set(0.1, 1.05, 0.05);
        books.scale.set(2.0, 2.0, 2.0);
        schoolPavilion.add(books);
      }
    }
    if (benchModel) {
      placeProp(benchModel, -18.0, 1.5, 1.8, 1.4);
    }
    if (planterModel) {
      placeProp(planterModel, -25.5, 1.5, 1.5, 0.5);
    }

    // 3. Marriage Station (Civil Registration signing desk, ledgers, chairs inside pavilion)
    const marriagePavilion = pavilions['marriage'];
    if (marriagePavilion) {
      if (deskModel) {
        placeInPavilion(marriagePavilion, deskModel, 0, 0, 1.7, 0);
      }
      if (booksModel) {
        const books = booksModel.clone(true);
        books.position.set(0.15, 1.05, 0.05);
        books.scale.set(2.2, 2.2, 2.2);
        marriagePavilion.add(books);
      }
      if (chairModel) {
        placeInPavilion(marriagePavilion, chairModel, -0.75, -0.6, 1.7, 0.3);
        placeInPavilion(marriagePavilion, chairModel, 0.75, -0.6, 1.7, -0.3);
      }
    }
    if (planterModel) {
      placeProp(planterModel, 16.5, -1.0, 1.5, 0.2);
      placeProp(planterModel, 23.5, -1.0, 1.5, -0.4);
    }
    if (benchModel) {
      placeProp(benchModel, 24.5, -3.5, 1.8, -1.2);
    }

    // 4. Divorce Station (Contemplative wooden rest bench overlooking the valley)
    if (benchModel) {
      placeProp(benchModel, 28.0, 23.5, 1.8, 0.3);
    }
    if (planterModel) {
      placeProp(planterModel, 35.5, 23.5, 1.5, -0.6);
    }

    // 5. Death Station (Sacred ancestor tree on the cliff edge & reflection bench)
    if (deadTreeModel) {
      placeProp(deadTreeModel, 72.5, -36.5, 0.32, 0.7);
    }
    if (benchModel) {
      placeProp(benchModel, 65.0, -31.5, 1.8, 0.6);
    }

    // 6. Intro & Outro Stations
    if (benchModel) {
      placeProp(benchModel, -69.0, -53.5, 1.8, 0.2);
    }
    if (planterModel) {
      placeProp(planterModel, -74.5, -53.5, 1.5, 0.5);
    }
  };

  const update = (_dt: number, elapsed: number): void => {
    // Gentle floating and pulsing on lanterns and spirit runes
    for (const item of animatedLanterns) {
      const pulse = 1.0 + 0.18 * Math.sin(elapsed * 2.5 + item.phase);
      item.mesh.scale.setScalar(pulse);
      item.mesh.position.y += Math.sin(elapsed * 1.8 + item.phase) * 0.0015;
    }
  };

  const dispose = (): void => {
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

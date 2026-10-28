import * as THREE from 'three';
import { STATION_COORDINATES } from './path';

export interface StationsManager {
  group: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Creates traditional stylized Rwandan architecture and atmospheric landmarks at life stations.
 * Features conical thatched pavilions (Inzu / Urukari palace style), Imigongo geometric accents,
 * and glowing spirit lanterns inspired by Sky: Children of the Light.
 */
export function createStationsManager(
  scene: THREE.Scene,
  getHeight: (x: number, z: number) => number
): StationsManager {
  const group = new THREE.Group();
  scene.add(group);

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
      // Leave entrance opening at front (angle near 0)
      if (Math.cos(angle) > 0.85) continue;

      const px = Math.sin(angle) * postRadius;
      const pz = Math.cos(angle) * postRadius;
      const postMesh = new THREE.Mesh(postGeo, woodPostMat);
      postMesh.position.set(px, baseHeight + postHeight * 0.5, pz);
      postMesh.castShadow = true;
      pavilion.add(postMesh);
    }

    // 3. Low curved clay half-wall (open pavilion feel)
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

    // 4. Iconic conical thatched roof (layered woven reed look)
    const roofBaseY = baseHeight + postHeight;
    const roofRadius = baseRadius * 1.08;
    const roofHeight = 3.2 * scale;

    const roofGeo = new THREE.ConeGeometry(roofRadius, roofHeight, 24);
    geometriesToDispose.push(roofGeo);
    const roofMesh = new THREE.Mesh(roofGeo, thatchMat);
    roofMesh.position.y = roofBaseY + roofHeight * 0.5;
    roofMesh.castShadow = true;
    pavilion.add(roofMesh);

    // Top roof ring / finial (traditional woven peak)
    const finialGeo = new THREE.SphereGeometry(0.24 * scale, 12, 12);
    geometriesToDispose.push(finialGeo);
    const finialMesh = new THREE.Mesh(finialGeo, woodPostMat);
    finialMesh.position.y = roofBaseY + roofHeight + 0.15 * scale;
    pavilion.add(finialMesh);

    // 5. Hanging warm celestial lantern inside
    if (withLantern) {
      const lanternGeo = new THREE.SphereGeometry(0.32 * scale, 16, 16);
      geometriesToDispose.push(lanternGeo);
      const lanternMesh = new THREE.Mesh(lanternGeo, lanternMat);
      lanternMesh.position.set(0, baseHeight + 1.6 * scale, 0);

      // Outer glow aura
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

    // Stack of 3 smooth river stones
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

    // Floating glowing spirit crystal above the cairn
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

  // Place architectural landmarks at key stations
  STATION_COORDINATES.forEach((coord) => {
    if (coord.id === 'intro') {
      // Overlook pavilion
      const p = buildRwandanPavilion(coord.x - 7.0, coord.z + 5.0, 1.25);
      group.add(p);
    } else if (coord.id === 'birth') {
      // Birth shelter beside the path
      const p = buildRwandanPavilion(coord.x + 8.5, coord.z - 3.5, 1.1);
      group.add(p);
      group.add(buildStoneCairn(coord.x - 3.5, coord.z + 4.0, 1.0));
    } else if (coord.id === 'growing') {
      // Youth hill pavilion
      const p = buildRwandanPavilion(coord.x - 9.0, coord.z - 6.0, 1.2);
      group.add(p);
      group.add(buildStoneCairn(coord.x + 4.5, coord.z + 3.0, 0.9));
    } else if (coord.id === 'marriage') {
      // Ceremonial wedding pavilion with warm golden glow
      const p = buildRwandanPavilion(coord.x + 8.0, coord.z + 6.0, 1.35);
      group.add(p);
      group.add(buildStoneCairn(coord.x - 4.5, coord.z - 4.0, 1.1));
    } else if (coord.id === 'divorce') {
      // Contemplative stone sanctuary
      const p = buildRwandanPavilion(coord.x - 8.5, coord.z + 7.0, 1.15);
      group.add(p);
      group.add(buildStoneCairn(coord.x + 4.0, coord.z - 3.5, 1.0));
    } else if (coord.id === 'death') {
      // Peaceful sacred ancestor shrine
      const p = buildRwandanPavilion(coord.x + 9.5, coord.z - 6.0, 1.2);
      group.add(p);
      group.add(buildStoneCairn(coord.x - 5.0, coord.z + 3.5, 1.2));
      group.add(buildStoneCairn(coord.x - 7.0, coord.z - 2.0, 0.85));
    } else if (coord.id === 'outro') {
      // Grand summit pavilion overlooking the 1,000 hills
      const p = buildRwandanPavilion(coord.x + 7.5, coord.z + 5.0, 1.4);
      group.add(p);
    }
  });

  const update = (_dt: number, elapsed: number): void => {
    // Gentle floating and pulsing on lanterns and spirit runes
    for (const item of animatedLanterns) {
      const pulse = 1.0 + 0.18 * Math.sin(elapsed * 2.5 + item.phase);
      item.mesh.scale.setScalar(pulse);
      // Gentle vertical float
      item.mesh.position.y += Math.sin(elapsed * 1.8 + item.phase) * 0.0015;
    }
  };

  const dispose = (): void => {
    geometriesToDispose.forEach((g) => g.dispose());
    materialsToDispose.forEach((m) => m.dispose());
    scene.remove(group);
  };

  return { group, update, dispose };
}

import * as THREE from 'three';

export interface StationAnchor {
  id: string;
  t: number; // 0 to 1 along curve
  position: THREE.Vector3;
  lookTarget: THREE.Vector3;
  cameraOffset: THREE.Vector3;
}

/**
 * Key coordinates across the terrain for the 7 life stations:
 * 0: Intro, 1: Birth, 2: Growing, 3: Marriage, 4: Divorce, 5: Death, 6: Outro.
 */
export const STATION_COORDINATES: Array<{ id: string; t: number; x: number; z: number }> = [
  { id: 'intro',    t: 0.00, x: -70, z: -60 },
  { id: 'birth',    t: 0.16, x: -45, z: -25 },
  { id: 'growing',  t: 0.33, x: -15, z:   5 },
  { id: 'marriage', t: 0.50, x:  15, z: -10 },
  { id: 'divorce',  t: 0.67, x:  40, z:  20 },
  { id: 'death',    t: 0.84, x:  60, z: -30 },
  { id: 'outro',    t: 1.00, x:  75, z:  35 },
];

export function createPathCurve(getHeight: (x: number, z: number) => number): THREE.CatmullRomCurve3 {
  // Additional intermediate control points to make the path naturally wind through terraces
  const rawWaypoints: Array<[number, number]> = [
    [-75, -65],
    [-70, -60], // Intro
    [-58, -42],
    [-45, -25], // Birth
    [-30, -10],
    [-15,   5], // Growing
    [  0,  -5],
    [ 15, -10], // Marriage
    [ 28,   5],
    [ 40,  20], // Divorce
    [ 50,  -5],
    [ 60, -30], // Death
    [ 68,   5],
    [ 75,  35], // Outro
  ];

  const points = rawWaypoints.map(([x, z]) => {
    const y = getHeight(x, z) + 0.35; // slightly above ground
    return new THREE.Vector3(x, y, z);
  });

  return new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
}

export function createPathMesh(
  curve: THREE.CatmullRomCurve3,
  segments = 250,
  pathWidth = 2.4
): { mesh: THREE.Mesh; dispose: () => void } {
  // Generate a ribbon geometry along the curve
  const geom = new THREE.BufferGeometry();
  const vertexCount = (segments + 1) * 2;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Left vertex
    const pLeft = pt.clone().addScaledVector(normal, -pathWidth * 0.5);
    // Right vertex
    const pRight = pt.clone().addScaledVector(normal, pathWidth * 0.5);

    const vIdx = i * 2;
    positions[vIdx * 3]     = pLeft.x;
    positions[vIdx * 3 + 1] = pLeft.y;
    positions[vIdx * 3 + 2] = pLeft.z;

    positions[(vIdx + 1) * 3]     = pRight.x;
    positions[(vIdx + 1) * 3 + 1] = pRight.y;
    positions[(vIdx + 1) * 3 + 2] = pRight.z;

    uvs[vIdx * 2]     = 0;
    uvs[vIdx * 2 + 1] = t * 20;
    uvs[(vIdx + 1) * 2]     = 1;
    uvs[(vIdx + 1) * 2 + 1] = t * 20;

    if (i < segments) {
      const a = vIdx;
      const b = vIdx + 1;
      const c = vIdx + 2;
      const d = vIdx + 3;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // Warm clay/beaten earth path material
  const material = new THREE.MeshStandardMaterial({
    color: 0xc89d6e,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.receiveShadow = true;

  return {
    mesh,
    dispose: () => {
      geom.dispose();
      material.dispose();
    },
  };
}

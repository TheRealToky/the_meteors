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
  getHeight?: (x: number, z: number) => number,
  segments = 360,
  pathWidth = 3.2
): { mesh: THREE.Mesh; dispose: () => void } {
  // Generate an organic 5-strip crowned roadway along the curve
  // (Left Outer, Left Inner, Center, Right Inner, Right Outer)
  // Outer edges melt seamlessly into terrace grass; center is warm sunlit stone/sand
  const geom = new THREE.BufferGeometry();
  const ringCount = segments + 1;
  const vertsPerRing = 5;
  const vertexCount = ringCount * vertsPerRing;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);

  // Painterly Rwandan pathway colors
  const cCenter   = new THREE.Color(0xdcb582); // Sun-baked clay & sandstone
  const cShoulder = new THREE.Color(0xa77850); // Fertile reddish-ochre road shoulder
  const cEdge     = new THREE.Color(0x6ca458); // Melts into terrace grass

  const halfW = pathWidth * 0.5;
  const offsets = [-1.0, -0.5, 0.0, 0.5, 1.0];
  const colorPalette = [cEdge, cShoulder, cCenter, cShoulder, cEdge];
  const heightOffsets = [0.03, 0.08, 0.12, 0.08, 0.03];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const ringBase = i * vertsPerRing;

    for (let j = 0; j < vertsPerRing; j++) {
      const frac = offsets[j];
      const p = pt.clone().addScaledVector(normal, frac * halfW);
      const groundH = getHeight ? getHeight(p.x, p.z) : pt.y;
      const finalY = groundH + heightOffsets[j];

      const vIdx = ringBase + j;
      positions[vIdx * 3 + 0] = p.x;
      positions[vIdx * 3 + 1] = finalY;
      positions[vIdx * 3 + 2] = p.z;

      const c = colorPalette[j];
      colors[vIdx * 3 + 0] = c.r;
      colors[vIdx * 3 + 1] = c.g;
      colors[vIdx * 3 + 2] = c.b;

      uvs[vIdx * 2 + 0] = (frac + 1.0) * 0.5;
      uvs[vIdx * 2 + 1] = t * 28;
    }

    if (i < segments) {
      for (let j = 0; j < vertsPerRing - 1; j++) {
        const row1_a = ringBase + j;
        const row1_b = ringBase + j + 1;
        const row2_a = ringBase + vertsPerRing + j;
        const row2_b = ringBase + vertsPerRing + j + 1;

        indices.push(row1_a, row2_a, row1_b);
        indices.push(row1_b, row2_a, row2_b);
      }
    }
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // Velvety smooth path material (Sky: Children of the Light aesthetic)
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.0,
    flatShading: false,
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

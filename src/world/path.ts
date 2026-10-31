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
  { id: 'intro',    t: 0.024, x: -72.0, z: -53.0 },
  { id: 'birth',    t: 0.192, x: -36.0, z: -23.5 }, // Right in front of Clinic entrance
  { id: 'growing',  t: 0.299, x: -22.0, z:   2.5 }, // Right in front of School of Life
  { id: 'marriage', t: 0.455, x:  20.0, z:  -1.5 }, // Right in front of Town Hall
  { id: 'divorce',  t: 0.551, x:  32.0, z:  22.0 }, // Right in front of Courtroom
  { id: 'death',    t: 0.785, x:  68.0, z: -29.5 }, // Right in front of Sunset Sanctuary
  { id: 'outro',    t: 1.000, x:  75.0, z:  29.0 },
];

export function createPathCurve(getHeight: (x: number, z: number) => number): THREE.CatmullRomCurve3 {
  // Roadway spline that leads cleanly to the front doorstep of every milestone house
  const rawWaypoints: Array<[number, number]> = [
    [-76, -58],
    [-72, -53], // 0. Intro station
    [-55, -40],
    [-44, -32],
    [-36, -23.5], // 1. Birth station (District Maternity Health Clinic)
    [-30, -14],
    [-25, -6],
    [-22, 2.5], // 2. Youth station (The School of Life)
    [-12, 3],
    [2, 0],
    [12, -2],
    [20, -1.5], // 3. Marriage station (Town Hall / Umurenge Civil Registry)
    [24, 6],
    [28, 14],
    [32, 22.0], // 4. Divorce station (Community Justice Courtroom)
    [42, 16],
    [52, 2],
    [60, -16],
    [68, -29.5], // 5. Death station (Sunset Sanctuary & Memory Pavilion)
    [72, -10],
    [75, 12],
    [75, 29.0], // 6. Outro station (Panorama Ridge)
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
  // Outer edges melt naturally into terrace grass; center is warm sunlit stone/sand
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

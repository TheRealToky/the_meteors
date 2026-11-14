import * as THREE from 'three';
import type { BuildingKind } from './stationLayout';

/**
 * Procedural low-poly station buildings.
 *
 * Every building is assembled from simple shapes (boxes, cylinders, cones,
 * lathes) and MERGED into one geometry with per-vertex colours, so a whole
 * building is a single draw call (the old pavilions were ~20 meshes each).
 * Non-indexed geometry + computeVertexNormals() gives crisp flat shading,
 * matching the low-poly art direction.
 *
 * Cultural references (please review with a Rwandan teammate):
 *  - Inzu: the traditional round, dome-shaped thatched house; the royal style
 *    (King's Palace, Nyanza) has a tall roof and a pointed top.
 *  - Imigongo: black / white / terracotta geometric zigzag art from eastern Rwanda.
 *  - Rural public buildings: single-storey, plastered walls with a painted lower
 *    band, iron-sheet roofs, front verandas and rainwater tanks.
 *
 * Local space: floor at y = 0, front door faces +Z, footprint centred at origin.
 */

// Palette
const C = {
  stone: 0x9a958b,
  stoneDark: 0x7c776e,
  plasterCream: 0xf2e8d5,
  plasterWhite: 0xf6f3ec,
  teal: 0x3f9c9a,
  brick: 0xb5603e,
  terracotta: 0xa8492d,
  ironRust: 0xb5523a,
  ironRustDark: 0x9e4430,
  ironGrey: 0x8d9ba6,
  ironGreyDark: 0x7a8893,
  slate: 0x5d6b78,
  courtWall: 0xe3e8ec,
  doorBlue: 0x2f6fb3,
  doorLight: 0x5a8fc4,
  glass: 0x2c3e50,
  frame: 0xfaf8f2,
  wood: 0x6b4a2e,
  woodLight: 0x8d6a45,
  thatch: 0xcfa766,
  thatchDark: 0xb38c4e,
  reed: 0x9c7a4c,
  black: 0x24201c,
  white: 0xf4f0e6,
  green: 0x2e9b57,
  leaf: 0x4f9a3a,
  gold: 0xd2a84a,
  tank: 0x3a6e9e,
};

/** Collects transformed, coloured shapes and merges them into one geometry. */
class MeshBuilder {
  private positions: number[] = [];
  private colors: number[] = [];
  private readonly mat = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly col = new THREE.Color();

  /** Adds `geom` (consumed and disposed) with a flat colour and a transform. */
  add(
    geom: THREE.BufferGeometry,
    color: number,
    x = 0, y = 0, z = 0,
    rx = 0, ry = 0, rz = 0,
    sx = 1, sy = 1, sz = 1
  ): void {
    const g = geom.index ? geom.toNonIndexed() : geom;
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.p.set(x, y, z);
    this.s.set(sx, sy, sz);
    this.mat.compose(this.p, this.q, this.s);
    g.applyMatrix4(this.mat);
    const pos = g.attributes.position;
    this.col.setHex(color);
    for (let i = 0; i < pos.count; i++) {
      this.positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      this.colors.push(this.col.r, this.col.g, this.col.b);
    }
    if (g !== geom) g.dispose();
    geom.dispose();
  }

  box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): void {
    this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, color: number, x: number, y: number, z: number): void {
    this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y, z);
  }

  /** A single triangle, visible from both sides (the material is DoubleSide). */
  tri(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, color: number): void {
    this.positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.col.setHex(color);
    for (let i = 0; i < 3; i++) this.colors.push(this.col.r, this.col.g, this.col.b);
  }

  /** Quad on a plane (two triangles), corners in order. */
  quad(
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number], color: number
  ): void {
    this.tri(...a, ...b, ...c, color);
    this.tri(...a, ...c, ...d, color);
  }

  build(): THREE.BufferGeometry {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geom.computeVertexNormals(); // non-indexed => one normal per face => flat shading
    geom.computeBoundingSphere();
    return geom;
  }
}

// ---------------------------------------------------------------------------
// Reusable parts
// ---------------------------------------------------------------------------

/** Stone plinth that also covers the slope under the building (drop = extra depth below). */
function plinth(b: MeshBuilder, w: number, d: number, drop: number): void {
  const h = drop + 0.35;
  b.box(w + 0.6, h, d + 0.6, C.stone, 0, 0.35 - h / 2, 0);
  // A darker lip to read as dressed stone
  b.box(w + 0.7, 0.08, d + 0.7, C.stoneDark, 0, 0.31, 0);
}

/**
 * Corrugated iron gable roof, ridge along local X. Corrugation is suggested by
 * alternating strip colours running down the slope.
 */
function gableRoof(
  b: MeshBuilder, w: number, d: number, baseY: number, rise: number,
  colA: number, colB: number, overhang = 0.45, cx = 0, cz = 0
): void {
  const halfD = d / 2 + overhang;
  const slopeLen = Math.hypot(halfD, rise);
  const angle = Math.atan2(rise, halfD);
  const strips = Math.max(6, Math.round((w + overhang * 2) / 0.55));
  const stripW = (w + overhang * 2) / strips;
  for (const side of [-1, 1]) {
    for (let i = 0; i < strips; i++) {
      const x = cx - (w / 2 + overhang) + stripW * (i + 0.5);
      b.box(stripW + 0.01, 0.07, slopeLen, i % 2 ? colA : colB,
        x, baseY + rise / 2, cz + (side * halfD) / 2, 0, side * angle);
    }
  }
  // Ridge cap
  b.box(w + overhang * 2 + 0.1, 0.12, 0.3, colB, cx, baseY + rise + 0.02, cz);
}

/** Gable end triangles (wall colour) under a gable roof whose ridge runs along X. */
function gableEnds(b: MeshBuilder, w: number, d: number, baseY: number, rise: number, color: number, cx = 0, cz = 0): void {
  for (const side of [-1, 1]) {
    const x = cx + side * (w / 2);
    b.tri(x, baseY, cz - d / 2, x, baseY, cz + d / 2, x, baseY + rise, cz, color);
  }
}

/** Four-sided hip roof (a squashed pyramid). */
function hipRoof(b: MeshBuilder, w: number, d: number, baseY: number, rise: number, color: number, cx = 0, cz = 0): void {
  // Cone with 4 segments rotated 45 deg is a square pyramid; scale it to the footprint
  // (rotate the geometry first: add() scales before it rotates)
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
  b.add(g, color, cx, baseY + rise / 2, cz, 0, 0, 0, w, rise, d);
  // Fascia board along the eaves
  b.box(w + 0.05, 0.14, d + 0.05, C.frame, cx, baseY + 0.02, cz);
}

/** Window with frame and dark glass, set into a wall facing +Z at z. */
function windowFront(b: MeshBuilder, x: number, y: number, z: number, w = 1.0, h = 1.0, side: 1 | -1 = 1): void {
  b.box(w + 0.16, h + 0.16, 0.08, C.frame, x, y, z + side * 0.02);
  b.box(w, h, 0.1, C.glass, x, y, z + side * 0.04);
  b.box(0.05, h, 0.12, C.frame, x, y, z + side * 0.05); // mullion
}

function doorFront(b: MeshBuilder, x: number, z: number, color: number, w = 1.1, h = 2.1): void {
  b.box(w + 0.18, h + 0.12, 0.08, C.frame, x, h / 2 + 0.35, z + 0.02);
  b.box(w, h, 0.12, color, x, h / 2 + 0.35, z + 0.05);
}

/** Imigongo zigzag band: alternating up/down triangles on a wall facing +Z. */
function imigongoBand(
  b: MeshBuilder, x0: number, x1: number, y: number, h: number, z: number,
  colA = C.black, colB = C.white, colBg = C.terracotta
): void {
  const n = Math.max(2, Math.round((x1 - x0) / (h * 0.9)));
  const step = (x1 - x0) / n;
  // Background strip
  b.box(x1 - x0, h + 0.1, 0.04, colBg, (x0 + x1) / 2, y + h / 2, z);
  const zf = z + 0.03;
  for (let i = 0; i < n; i++) {
    const xa = x0 + i * step;
    const xb = xa + step;
    const xm = xa + step / 2;
    b.tri(xa, y, zf, xb, y, zf, xm, y + h, zf, i % 2 ? colA : colB);
    if (i < n - 1) b.tri(xm, y + h, zf, xb, y, zf, xm + step, y + h, zf, i % 2 ? colB : colA);
  }
}

/** Wooden bench facing +Z. */
function bench(b: MeshBuilder, x: number, z: number, ry = 0): void {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
  let p = at(0, 0);
  b.box(1.8, 0.08, 0.45, C.woodLight, p[0], 0.48, p[1], ry);
  p = at(0, -0.22);
  b.box(1.8, 0.4, 0.06, C.woodLight, p[0], 0.75, p[1], ry);
  for (const lx of [-0.75, 0.75]) {
    p = at(lx, 0);
    b.box(0.08, 0.48, 0.4, C.wood, p[0], 0.24, p[1], ry);
  }
}

/** Covered front veranda along the full width (posts + lean-to roof). */
function veranda(b: MeshBuilder, w: number, frontZ: number, depth: number, wallTop: number, postColor: number, roofA: number, roofB: number, posts: number): void {
  const postH = wallTop - 0.25;
  for (let i = 0; i < posts; i++) {
    const x = -w / 2 + 0.3 + (i * (w - 0.6)) / (posts - 1);
    b.box(0.22, postH, 0.22, postColor, x, postH / 2, frontZ + depth - 0.2);
  }
  // Lean-to roof sloping down away from the wall, in strips
  const drop = 0.45;
  const len = Math.hypot(depth + 0.3, drop);
  const angle = Math.atan2(drop, depth + 0.3);
  const strips = Math.round((w + 0.6) / 0.55);
  const sw = (w + 0.6) / strips;
  for (let i = 0; i < strips; i++) {
    b.box(sw + 0.01, 0.06, len, i % 2 ? roofA : roofB,
      -w / 2 - 0.3 + sw * (i + 0.5), wallTop - drop / 2 + 0.05, frontZ + (depth + 0.3) / 2, 0, angle);
  }
  // Tiled floor
  b.box(w, 0.06, depth, C.stoneDark, 0, 0.36, frontZ + depth / 2);
}

/**
 * Traditional round inzu: low reed wall, big dome of thatch and a pointed top.
 * `royal` makes the taller King's-Palace-style roof.
 */
function inzu(b: MeshBuilder, x: number, z: number, r: number, royal = false): void {
  const wallH = royal ? 1.4 : 1.1;
  b.add(new THREE.CylinderGeometry(r, r, wallH, 14), C.reed, x, wallH / 2 + 0.35, z);
  // Thatch dome profile (radius, height), revolved by a lathe
  const top = royal ? 5.8 : 4.2;
  const pts = [
    new THREE.Vector2(r * 1.22, 0),
    new THREE.Vector2(r * 1.18, top * 0.18),
    new THREE.Vector2(r * 1.02, top * 0.42),
    new THREE.Vector2(r * 0.72, top * 0.66),
    new THREE.Vector2(r * 0.34, top * 0.86),
    new THREE.Vector2(0.06, top),
  ];
  // Two tones of thatch as stacked rings for a woven look
  const ring = new THREE.LatheGeometry(pts, 14);
  b.add(ring, C.thatch, x, wallH + 0.15, z);
  b.add(new THREE.TorusGeometry(r * 1.12, 0.07, 4, 14), C.thatchDark, x, wallH + 0.15 + top * 0.2, z, Math.PI / 2);
  b.add(new THREE.TorusGeometry(r * 0.88, 0.06, 4, 14), C.thatchDark, x, wallH + 0.15 + top * 0.55, z, Math.PI / 2);
  // Pointed finial (royal houses have a tall decorated spire)
  b.add(new THREE.ConeGeometry(0.12, royal ? 1.6 : 0.9, 6), C.wood, x, wallH + 0.15 + top + (royal ? 0.7 : 0.35), z);
  // Entrance porch on the +Z side: a small thatched tunnel
  b.box(1.1, 1.6, 1.0, C.reed, x, 1.15, z + r + 0.3);
  b.box(0.7, 1.3, 0.1, C.black, x, 1.0, z + r + 0.81);
  // Half-cylinder rotated so its round side faces up and its axis points out of the door
  const porchRoof = new THREE.CylinderGeometry(0.8, 0.8, 1.3, 8, 1, false, 0, Math.PI)
    .rotateZ(Math.PI / 2)
    .rotateY(Math.PI / 2);
  b.add(porchRoof, C.thatch, x, 1.95, z + r + 0.3);
}

// ---------------------------------------------------------------------------
// Building designs
// ---------------------------------------------------------------------------

function buildClinic(b: MeshBuilder): void {
  // Health centre: cream walls, teal band, rust iron roof, veranda, rainwater tank
  const w = 9.4, d = 4.4, wallH = 2.8, front = d / 2 - 0.9;
  b.box(w, wallH, d, C.plasterCream, 0, 0.35 + wallH / 2, -0.9);
  b.box(w + 0.04, 0.95, d + 0.04, C.teal, 0, 0.35 + 0.475, -0.9);
  gableRoof(b, w, d, 0.35 + wallH, 1.3, C.ironRust, C.ironRustDark, 0.4, 0, -0.9);
  gableEnds(b, w, d, 0.35 + wallH, 1.3, C.plasterCream, 0, -0.9);
  veranda(b, w, front, 1.8, 0.35 + wallH, C.plasterWhite, C.ironRust, C.ironRustDark, 5);
  doorFront(b, 0, front, C.doorLight, 1.5);
  for (const x of [-3.4, -1.9, 1.9, 3.4]) windowFront(b, x, 1.85, front);
  // Sign with a green health cross (the red cross emblem is legally protected)
  b.box(2.2, 0.8, 0.08, C.plasterWhite, 0, 3.0, front + 0.1);
  b.box(0.18, 0.56, 0.1, C.green, 0, 3.0, front + 0.16);
  b.box(0.56, 0.18, 0.1, C.green, 0, 3.0, front + 0.16);
  // Rainwater tank on a stand
  b.box(1.3, 0.6, 1.3, C.stoneDark, -w / 2 - 1.0, 0.65, -1.2);
  b.add(new THREE.CylinderGeometry(0.62, 0.62, 1.6, 12), C.tank, -w / 2 - 1.0, 1.75, -1.2);
}

function buildSchool(b: MeshBuilder): void {
  // Primary school block: brick base, cream upper walls, blue doors, grey iron hip roof
  const w = 12.4, d = 3.8, wallH = 2.7, front = d / 2 - 1.0;
  b.box(w, wallH, d, C.plasterCream, 0, 0.35 + wallH / 2, -1.0);
  b.box(w + 0.04, 1.0, d + 0.04, C.brick, 0, 0.85, -1.0);
  veranda(b, w, front, 2.0, 0.35 + wallH, C.brick, C.ironGrey, C.ironGreyDark, 6);
  hipRoof(b, w + 0.8, d + 2.8, 0.35 + wallH, 1.5, C.ironGrey, 0, 0);
  for (const x of [-4.2, 0, 4.2]) doorFront(b, x, front, C.doorBlue);
  for (const x of [-5.6, -2.8, -1.4, 1.4, 2.8, 5.6]) windowFront(b, x, 1.9, front, 0.9, 1.0);
  // Flag pole and a chalkboard sign at the side
  b.cyl(0.05, 0.07, 6.5, 6, C.frame, w / 2 + 1.2, 3.6, 1.6);
  b.box(1.6, 1.0, 0.1, C.black, -w / 2 - 0.9, 1.6, 1.4, 0.4);
  b.box(0.1, 1.2, 0.1, C.wood, -w / 2 - 1.5, 0.95, 1.15, 0.4);
  b.box(0.1, 1.2, 0.1, C.wood, -w / 2 - 0.3, 0.95, 1.65, 0.4);
}

function buildOffice(b: MeshBuilder): void {
  // Sector office (civil registry): plastered walls, terracotta base, Imigongo
  // band under the eaves, columned porch, steps and a flower arch for weddings
  const w = 10.2, d = 4.6, wallH = 3.0, front = d / 2 - 1.0;
  b.box(w, wallH, d, C.plasterWhite, 0, 0.35 + wallH / 2, -1.0);
  b.box(w + 0.04, 0.8, d + 0.04, C.terracotta, 0, 0.75, -1.0);
  gableRoof(b, w, d, 0.35 + wallH, 1.4, C.ironRust, C.ironRustDark, 0.45, 0, -1.0);
  gableEnds(b, w, d, 0.35 + wallH, 1.4, C.plasterWhite, 0, -1.0);
  imigongoBand(b, -w / 2 + 0.2, -1.9, 2.75, 0.45, front);
  imigongoBand(b, 1.9, w / 2 - 0.2, 2.75, 0.45, front);
  // Porch: 4 columns + small gable roof with its ridge toward the path
  const pw = 3.6, pd = 2.2;
  for (const x of [-pw / 2 + 0.2, -0.6, 0.6, pw / 2 - 0.2]) b.cyl(0.16, 0.18, 2.9, 8, C.frame, x, 0.35 + 1.45, front + pd - 0.25);
  b.box(pw + 0.3, 0.25, pd + 0.2, C.frame, 0, 0.35 + 3.0, front + pd / 2);
  // Porch gable (ridge along Z): build along X then rotate by building the shape manually
  const baseY = 0.35 + 3.12;
  const rise = 1.0;
  const z0 = front - 0.1, z1 = front + pd + 0.15;
  b.quad([-pw / 2 - 0.3, baseY, z0], [0, baseY + rise, z0], [0, baseY + rise, z1], [-pw / 2 - 0.3, baseY, z1], C.ironRustDark);
  b.quad([pw / 2 + 0.3, baseY, z0], [0, baseY + rise, z0], [0, baseY + rise, z1], [pw / 2 + 0.3, baseY, z1], C.ironRust);
  b.tri(-pw / 2, baseY, z1 - 0.02, pw / 2, baseY, z1 - 0.02, 0, baseY + rise - 0.1, z1 - 0.02, C.plasterWhite);
  doorFront(b, 0, front, C.wood, 1.6, 2.3);
  for (const x of [-3.6, -2.4, 2.4, 3.6]) windowFront(b, x, 1.9, front, 0.8, 1.2);
  // Steps
  b.box(pw, 0.12, 0.5, C.stone, 0, 0.29, front + pd + 0.2);
  b.box(pw, 0.12, 0.5, C.stone, 0, 0.17, front + pd + 0.55);
  // Wedding flower arch in front of the porch
  const archZ = front + pd + 1.35;
  b.cyl(0.07, 0.07, 2.2, 6, C.frame, -1.3, 1.1, archZ);
  b.cyl(0.07, 0.07, 2.2, 6, C.frame, 1.3, 1.1, archZ);
  b.add(new THREE.TorusGeometry(1.3, 0.13, 6, 16, Math.PI), C.leaf, 0, 2.2, archZ);
  const flowerCols = [0xf6a5b8, 0xffffff, 0xf9d65c, 0xef7a8f];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    b.add(new THREE.IcosahedronGeometry(0.17, 0), flowerCols[i % flowerCols.length],
      Math.cos(a) * 1.3, 2.2 + Math.sin(a) * 1.3, archZ + 0.08);
  }
}

function buildCourt(b: MeshBuilder): void {
  // Community court / mediation hall: calm pale walls, slate hip roof,
  // classical porch with pediment and a gold scales-of-justice emblem
  const w = 9.4, d = 4.8, wallH = 3.0, front = d / 2 - 1.1;
  b.box(w, wallH, d, C.courtWall, 0, 0.35 + wallH / 2, -1.1);
  b.box(w + 0.04, 0.7, d + 0.04, C.slate, 0, 0.7, -1.1);
  hipRoof(b, w + 0.6, d + 0.6, 0.35 + wallH, 1.5, C.slate, 0, -1.1);
  // Porch: 4 columns, entablature, pediment
  const pw = 5.6, pd = 2.0;
  for (let i = 0; i < 4; i++) {
    const x = -pw / 2 + 0.35 + (i * (pw - 0.7)) / 3;
    b.cyl(0.2, 0.22, 2.9, 10, C.frame, x, 0.35 + 1.45, front + pd - 0.3);
  }
  b.box(pw + 0.3, 0.35, pd + 0.2, C.frame, 0, 0.35 + 3.05, front + pd / 2);
  const py = 0.35 + 3.22;
  b.tri(-pw / 2 - 0.15, py, front + pd + 0.11, pw / 2 + 0.15, py, front + pd + 0.11, 0, py + 1.1, front + pd + 0.11, C.frame);
  b.quad([-pw / 2 - 0.2, py, front], [0, py + 1.15, front], [0, py + 1.15, front + pd + 0.15], [-pw / 2 - 0.2, py, front + pd + 0.15], C.slate);
  b.quad([pw / 2 + 0.2, py, front], [0, py + 1.15, front], [0, py + 1.15, front + pd + 0.15], [pw / 2 + 0.2, py, front + pd + 0.15], C.slate);
  // Scales of justice in the pediment
  const ez = front + pd + 0.16;
  b.box(0.06, 0.6, 0.05, C.gold, 0, py + 0.45, ez);
  b.box(0.9, 0.05, 0.05, C.gold, 0, py + 0.72, ez);
  b.add(new THREE.ConeGeometry(0.16, 0.1, 8), C.gold, -0.42, py + 0.48, ez, Math.PI);
  b.add(new THREE.ConeGeometry(0.16, 0.1, 8), C.gold, 0.42, py + 0.48, ez, Math.PI);
  doorFront(b, 0, front, C.wood, 1.5, 2.3);
  for (const x of [-3.5, -2.2, 2.2, 3.5]) windowFront(b, x, 1.9, front, 0.75, 1.3);
  b.box(pw, 0.12, 0.5, C.stone, 0, 0.29, front + pd + 0.2);
  b.box(pw, 0.12, 0.5, C.stone, 0, 0.17, front + pd + 0.55);
  // Quiet benches beside the entrance
  bench(b, -3.6, front + 1.6);
  bench(b, 3.6, front + 1.6);
}

function buildMemorial(b: MeshBuilder): void {
  // Memorial garden: a traditional inzu at the back, a low curved stone wall,
  // white flowers and a bench facing the view. Calm and simple.
  inzu(b, 0, -1.8, 2.4);
  // Low curved stone wall (an open ring facing the path)
  const segs = 14;
  for (let i = 0; i <= segs; i++) {
    const a = Math.PI * 0.15 + (i / segs) * Math.PI * 1.7;
    const r = 4.3;
    b.add(new THREE.DodecahedronGeometry(0.42, 0), i % 2 ? C.stone : C.stoneDark,
      Math.sin(a) * r, 0.45, -0.4 - Math.cos(a) * r, 0, a, 0, 1.4, 0.8, 1.0);
  }
  // Flower beds with white and pale-yellow blossoms
  for (const [x, z] of [[-2.8, 1.6], [2.8, 1.6]]) {
    b.box(1.6, 0.3, 0.9, C.stoneDark, x, 0.5, z);
    for (let k = 0; k < 6; k++) {
      b.add(new THREE.IcosahedronGeometry(0.14, 0), k % 3 ? C.white : 0xf7e9a8,
        x - 0.6 + (k % 3) * 0.6, 0.8, z - 0.2 + Math.floor(k / 3) * 0.4);
    }
  }
  // Stone path to the hut and a bench facing the path/view
  for (let k = 0; k < 4; k++) b.box(0.9, 0.08, 0.6, C.stone, 0, 0.38, 2.6 - k * 0.9);
  bench(b, 0, 2.4, Math.PI);
}

function buildGateway(b: MeshBuilder): void {
  // Welcome gate: two pillars and a lintel covered in Imigongo patterns, a small
  // thatched cap, and a traditional inzu behind it
  const gx = 1.9, gz = 2.2, ph = 3.4;
  for (const x of [-gx, gx]) {
    b.box(0.8, ph, 0.8, C.terracotta, x, 0.35 + ph / 2, gz);
    imigongoBand(b, x - 0.38, x + 0.38, 0.9, 0.5, gz + 0.4);
    imigongoBand(b, x - 0.38, x + 0.38, 1.6, 0.5, gz + 0.4, C.white, C.black);
    imigongoBand(b, x - 0.38, x + 0.38, 2.3, 0.5, gz + 0.4);
  }
  b.box(gx * 2 + 1.2, 0.6, 0.9, C.terracotta, 0, 0.35 + ph + 0.3, gz);
  imigongoBand(b, -gx - 0.55, gx + 0.55, 0.35 + ph + 0.05, 0.5, gz + 0.46, C.black, C.white, C.terracotta);
  // Thatched cap on the lintel
  const cap = new THREE.CylinderGeometry(0.01, 0.9, 0.7, 4, 1).rotateY(Math.PI / 4);
  b.add(cap, C.thatch, 0, 0.35 + ph + 0.95, gz, 0, 0, 0, gx * 1.9, 1, 0.9);
  inzu(b, 0, -1.6, 2.0);
}

function buildLookout(b: MeshBuilder): void {
  // Panorama ridge: wooden deck with railings + a royal-style inzu
  inzu(b, -2.4, -1.0, 2.1, true);
  const dx = 2.4, dz = 0.6, dw = 4.6, dd = 4.6;
  b.box(dw, 0.3, dd, C.woodLight, dx, 0.5, dz);
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    b.box(0.18, 0.7, 0.18, C.wood, dx + px * (dw / 2 - 0.15), 0.2, dz + pz * (dd / 2 - 0.15));
  }
  // Railings on three sides (open toward the path)
  const railY = 1.35;
  for (const side of [-1, 1]) {
    b.box(0.08, 0.08, dd, C.wood, dx + side * (dw / 2 - 0.05), railY, dz);
    b.box(0.08, 0.08, dd, C.wood, dx + side * (dw / 2 - 0.05), railY - 0.4, dz);
  }
  b.box(dw, 0.08, 0.08, C.wood, dx, railY, dz - dd / 2 + 0.05);
  b.box(dw, 0.08, 0.08, C.wood, dx, railY - 0.4, dz - dd / 2 + 0.05);
  for (let i = 0; i <= 4; i++) {
    const t = -dd / 2 + 0.05 + (i * (dd - 0.1)) / 4;
    b.box(0.1, 0.75, 0.1, C.wood, dx - dw / 2 + 0.05, 1.0, dz + t);
    b.box(0.1, 0.75, 0.1, C.wood, dx + dw / 2 - 0.05, 1.0, dz + t);
    b.box(0.1, 0.75, 0.1, C.wood, dx - dw / 2 + 0.05 + (i * (dw - 0.1)) / 4, 1.0, dz - dd / 2 + 0.05);
  }
  bench(b, dx, dz - 0.9, Math.PI);
}

const BUILDERS: Record<BuildingKind, (b: MeshBuilder) => void> = {
  gateway: buildGateway,
  clinic: buildClinic,
  school: buildSchool,
  office: buildOffice,
  court: buildCourt,
  memorial: buildMemorial,
  lookout: buildLookout,
};

/** Door-light positions (local space) for each design, for small warm lanterns. */
export const LANTERN_SPOTS: Record<BuildingKind, Array<[number, number, number]>> = {
  gateway: [[-1.9, 4.35, 2.75], [1.9, 4.35, 2.75]],
  clinic: [[-1.1, 3.0, 0.5], [1.1, 3.0, 0.5]],
  school: [[-4.2, 2.8, 1.1], [0, 2.8, 1.1], [4.2, 2.8, 1.1]],
  office: [[-1.2, 2.9, 1.45]],
  court: [[-1.1, 2.9, 1.45], [1.1, 2.9, 1.45]],
  memorial: [[0, 1.9, 1.75]],
  lookout: [[-2.4, 1.9, 1.9]],
};

/**
 * Builds the merged geometry for one building. `drop` is how far the plinth
 * must extend below the floor to cover the terrain slope.
 */
export function buildStationGeometry(kind: BuildingKind, width: number, depth: number, drop: number): THREE.BufferGeometry {
  const b = new MeshBuilder();
  // The memorial, gateway and lookout stand on the ground; the rest on a plinth
  if (kind === 'clinic' || kind === 'school' || kind === 'office' || kind === 'court') {
    plinth(b, width - 0.6, depth - 0.6, drop);
  } else {
    // Packed-earth yard under the round houses (sits just above the levelled ground)
    b.box(width - 1.0, drop + 0.35, depth - 1.0, 0xc9a874, 0, 0.35 - (drop + 0.35) / 2 - 0.02, 0);
  }
  BUILDERS[kind](b);
  return b.build();
}

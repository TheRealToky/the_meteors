import * as THREE from 'three';
import type { FoliagePart } from './foliageAssets';

/**
 * One kind of scattered object (e.g. "CommonTree_3" or "grass tuft") drawn
 * with InstancedMesh, one draw call per model part.
 *
 * Why "streamed": three.js culls an InstancedMesh as a whole, so a field of
 * 5,000 grass tufts would always draw all 5,000. Instead we keep every
 * placement on the CPU and, when the camera has moved or turned enough,
 * copy only the instances that are near the camera and roughly in front of it
 * into the GPU buffers. Draw calls stay constant however dense the world is.
 *
 * Optional LOD: instances beyond `lodDistance` go into a second set of meshes
 * (`farParts`, e.g. a 180-triangle blob tree instead of a 5,000-triangle model).
 */
export interface StreamedLayerOptions {
  parts: FoliagePart[];
  farParts?: FoliagePart[];
  /** Instances further than this from the camera are not drawn */
  maxDistance: number;
  /** Beyond this distance use farParts (if given) */
  lodDistance?: number;
  /** Always draw instances closer than this, even behind the camera (shadows, turning) */
  keepRadius?: number;
  /** cos of the half-angle of the kept view cone; lower = wider */
  coneCos?: number;
}

interface MeshSet {
  meshes: THREE.InstancedMesh[];
  matrixAttr: THREE.InstancedBufferAttribute;
  colorAttr: THREE.InstancedBufferAttribute | null;
}

export class StreamedLayer {
  readonly group = new THREE.Group();

  private readonly opts: Required<Omit<StreamedLayerOptions, 'farParts'>> & { farParts?: FoliagePart[] };
  private pendingMatrices: number[] = [];
  private pendingColors: number[] = [];

  private count = 0;
  private xs = new Float32Array(0);
  private zs = new Float32Array(0);
  private matrices = new Float32Array(0);
  private colors = new Float32Array(0);
  private near: MeshSet | null = null;
  private far: MeshSet | null = null;

  constructor(opts: StreamedLayerOptions) {
    this.opts = {
      lodDistance: Infinity,
      keepRadius: 10,
      coneCos: 0.2,
      ...opts,
    };
  }

  get size(): number {
    return this.count + this.pendingMatrices.length / 16;
  }

  /** Queue one instance (build time only). */
  add(matrix: THREE.Matrix4, color?: THREE.Color): void {
    for (let i = 0; i < 16; i++) this.pendingMatrices.push(matrix.elements[i]);
    if (color) this.pendingColors.push(color.r, color.g, color.b);
    else this.pendingColors.push(1, 1, 1);
  }

  /** Create the GPU meshes once every instance has been added. */
  build(): void {
    const n = this.pendingMatrices.length / 16;
    this.count = n;
    this.matrices = new Float32Array(this.pendingMatrices);
    this.colors = new Float32Array(this.pendingColors);
    this.pendingMatrices = [];
    this.pendingColors = [];
    this.xs = new Float32Array(n);
    this.zs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.xs[i] = this.matrices[i * 16 + 12];
      this.zs[i] = this.matrices[i * 16 + 14];
    }
    if (n === 0) return;
    this.near = this.createSet(this.opts.parts, n, true);
    if (this.opts.farParts && this.opts.farParts.length > 0 && Number.isFinite(this.opts.lodDistance)) {
      this.far = this.createSet(this.opts.farParts, n, false);
    }
  }

  private createSet(parts: FoliagePart[], capacity: number, allowShadow: boolean): MeshSet {
    // All parts of one model share the same matrix buffer (uploaded once)
    const matrixAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
    matrixAttr.setUsage(THREE.DynamicDrawUsage);
    const needsColor = parts.some((p) => p.tinted);
    const colorAttr = needsColor
      ? new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
      : null;
    colorAttr?.setUsage(THREE.DynamicDrawUsage);

    const meshes = parts.map((part) => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
      mesh.instanceMatrix = matrixAttr;
      if (part.tinted && colorAttr) mesh.instanceColor = colorAttr;
      mesh.count = 0;
      // We do our own culling (see refresh); the auto bounding sphere would be stale
      mesh.frustumCulled = false;
      mesh.castShadow = allowShadow && part.shadow;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      return mesh;
    });
    return { meshes, matrixAttr, colorAttr };
  }

  /**
   * Refill the GPU buffers with the instances visible from (cx, cz) looking
   * along (fx, fz) (normalised, horizontal). No allocations.
   */
  refresh(cx: number, cz: number, fx: number, fz: number, distanceScale = 1, useCone = true): void {
    if (!this.near) return;
    const maxD = this.opts.maxDistance * distanceScale;
    const maxD2 = maxD * maxD;
    const lod = this.opts.lodDistance * distanceScale;
    const lod2 = this.far ? lod * lod : Infinity;
    // When the camera looks steeply down (aerial shots) the view cone is meaningless
    const keep2 = useCone ? this.opts.keepRadius * this.opts.keepRadius : Infinity;
    const coneCos = this.opts.coneCos;

    const nearM = this.near.matrixAttr.array as Float32Array;
    const nearC = this.near.colorAttr ? (this.near.colorAttr.array as Float32Array) : null;
    const farM = this.far ? (this.far.matrixAttr.array as Float32Array) : null;
    const farC = this.far?.colorAttr ? (this.far.colorAttr.array as Float32Array) : null;
    const src = this.matrices;
    const srcC = this.colors;

    let kn = 0;
    let kf = 0;
    for (let i = 0; i < this.count; i++) {
      const dx = this.xs[i] - cx;
      const dz = this.zs[i] - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > maxD2) continue;
      if (d2 > keep2) {
        // Behind the camera (outside a widened view cone)? skip
        const d = Math.sqrt(d2);
        if ((dx * fx + dz * fz) / d < coneCos) continue;
      }
      const useFar = d2 > lod2;
      const dstM = useFar ? farM! : nearM;
      const dstC = useFar ? farC : nearC;
      const k = useFar ? kf++ : kn++;
      const so = i * 16;
      const dO = k * 16;
      for (let j = 0; j < 16; j++) dstM[dO + j] = src[so + j];
      if (dstC) {
        dstC[k * 3] = srcC[i * 3];
        dstC[k * 3 + 1] = srcC[i * 3 + 1];
        dstC[k * 3 + 2] = srcC[i * 3 + 2];
      }
    }

    this.commit(this.near, kn);
    if (this.far) this.commit(this.far, kf);
  }

  private commit(set: MeshSet, k: number): void {
    for (const m of set.meshes) {
      m.count = k;
      m.visible = k > 0; // skips the draw call (and shadow pass) entirely when empty
    }
    // Only upload the part of the buffer we filled
    set.matrixAttr.clearUpdateRanges();
    set.matrixAttr.addUpdateRange(0, k * 16);
    set.matrixAttr.needsUpdate = true;
    if (set.colorAttr) {
      set.colorAttr.clearUpdateRanges();
      set.colorAttr.addUpdateRange(0, k * 3);
      set.colorAttr.needsUpdate = true;
    }
  }

  /** Number of instances currently drawn (debug stats). */
  visibleCount(): number {
    return (this.near?.meshes[0]?.count ?? 0) + (this.far?.meshes[0]?.count ?? 0);
  }

  dispose(): void {
    for (const set of [this.near, this.far]) {
      if (!set) continue;
      for (const m of set.meshes) {
        this.group.remove(m);
        m.dispose();
      }
    }
    this.near = null;
    this.far = null;
    this.group.removeFromParent();
  }
}

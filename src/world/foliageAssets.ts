import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Asset preparation for the landscape (trees, grass, flowers, rocks).
 *
 * The Quaternius nature kit is authored for a PBR engine, so we adapt it to our
 * simple look in four ways:
 *  1. Every mesh is baked into a world-space "part" (geometry + material), so a
 *     model with bark and leaves becomes two InstancedMeshes.
 *  2. Leaf textures are converted to a light grey "neutral" version that keeps
 *     the alpha cut-out. The hue then comes from per-instance colour, so one
 *     InstancedMesh can hold green AND orange trees (one draw call, many colours).
 *  3. Foliage normals are rebuilt (spherical for canopies, straight up for
 *     ground plants). Leaf cards with their own normals look black from many
 *     angles; spherical normals give the soft, bright "cotton ball" shading of
 *     the reference image.
 *  4. Materials become MeshLambertMaterial (matte, much cheaper on phones than
 *     MeshStandardMaterial and visually identical for rough foliage).
 */

export interface FoliagePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** true: this part takes its colour from the instance colour attribute */
  tinted: boolean;
  /** true: this part may cast shadows (bark, canopies, big rocks) */
  shadow: boolean;
}

export type NormalMode = 'keep' | 'sphere' | 'up';

export interface PartOptions {
  /** How to rebuild normals of foliage parts */
  foliageNormals?: NormalMode;
  /** Wind sway strength for foliage parts (0 = static) */
  sway?: number;
  /** Tint foliage parts per instance (default true) */
  tintFoliage?: boolean;
  /** Cast shadows for this model */
  castShadow?: boolean;
}

// ---------------------------------------------------------------------------
// Wind: one shared time uniform drives every swaying material
// ---------------------------------------------------------------------------

export const windUniforms = { uWindTime: { value: 0 } };

/**
 * Adds a gentle wind sway to a material's vertex shader. The sway grows with
 * the square of the local height, so roots stay planted and tips move.
 * The phase comes from the instance position so neighbours do not move in sync.
 */
export function applyWindSway(material: THREE.Material, strength: number): void {
  if (strength <= 0) return;
  const swayUniform = { value: strength };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.uniforms.uSway = swayUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uWindTime;\nuniform float uSway;'
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 swayPos = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        #else
          vec2 swayPos = vec2(0.0);
        #endif
        float swayH = max(position.y, 0.0);
        float swayPhase = swayPos.x * 0.21 + swayPos.y * 0.17;
        float swayW = sin(uWindTime * 1.6 + swayPhase) * 0.65 + sin(uWindTime * 2.9 + swayPhase * 1.7) * 0.35;
        transformed.x += swayW * uSway * swayH * swayH;
        transformed.z += swayW * uSway * 0.5 * swayH * swayH;`
      );
  };
}

// ---------------------------------------------------------------------------
// Neutral (grey) versions of leaf textures, cached per source image
// ---------------------------------------------------------------------------

const neutralCache = new Map<unknown, THREE.Texture>();

function makeNeutralTexture(src: THREE.Texture): THREE.Texture {
  const cached = neutralCache.get(src.image);
  if (cached) return cached;

  const img = src.image as CanvasImageSource & { width: number; height: number };
  // Downscale big leaf atlases to 1024 px: saves GPU memory, invisible at game distances
  const size = Math.min(1024, img.width);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round((img.height / img.width) * size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;

  // Mean luminance of the opaque pixels, so we can keep relative light/dark detail
  let sum = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 128) {
      sum += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
      n++;
    }
  }
  const mean = n > 0 ? sum / n : 128;

  for (let i = 0; i < px.length; i += 4) {
    const lum = px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
    // 0.85 average brightness, +/- painterly variation from the original strokes
    const v = THREE.MathUtils.clamp(0.85 + 0.4 * (lum / mean - 1), 0.55, 1.0) * 255;
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
    // alpha is kept as-is (the leaf cut-out)
  }
  ctx.putImageData(data, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = src.flipY; // glTF textures use flipY = false
  tex.wrapS = src.wrapS;
  tex.wrapT = src.wrapT;
  tex.anisotropy = 4;
  neutralCache.set(src.image, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Normal helpers
// ---------------------------------------------------------------------------

function setSphericalNormals(geom: THREE.BufferGeometry): void {
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Push the centre down a little so the canopy top is brightest
  center.y -= size.y * 0.15;
  const pos = geom.attributes.position;
  const normals = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(
      (pos.getX(i) - center.x) / Math.max(size.x, 0.001),
      (pos.getY(i) - center.y) / Math.max(size.y, 0.001),
      (pos.getZ(i) - center.z) / Math.max(size.z, 0.001)
    ).normalize();
    normals[i * 3] = v.x;
    normals[i * 3 + 1] = v.y;
    normals[i * 3 + 2] = v.z;
  }
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}

function setUpNormals(geom: THREE.BufferGeometry): void {
  const count = geom.attributes.position.count;
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) normals[i * 3 + 1] = 1;
  geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}

/** Root-to-tip brightness gradient as vertex colours (dark base, light tips). */
function setHeightGradient(geom: THREE.BufferGeometry, base = 0.58, tip = 1.0): void {
  geom.computeBoundingBox();
  const minY = geom.boundingBox!.min.y;
  const maxY = geom.boundingBox!.max.y;
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / Math.max(maxY - minY, 0.001);
    const c = base + (tip - base) * Math.pow(t, 0.8);
    colors[i * 3] = c;
    colors[i * 3 + 1] = c;
    colors[i * 3 + 2] = c;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ---------------------------------------------------------------------------
// glTF loading into parts
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();

/**
 * Loads a glTF model and returns its meshes as world-space parts with
 * converted materials. Returns [] if the file is missing (the scene still runs).
 */
export async function loadFoliageParts(url: string, opts: PartOptions = {}): Promise<FoliagePart[]> {
  const {
    foliageNormals = 'sphere',
    sway = 0,
    tintFoliage = true,
    castShadow = false,
  } = opts;

  let root: THREE.Group;
  try {
    root = (await loader.loadAsync(url)).scene;
  } catch (err) {
    console.warn(`[foliage] could not load ${url}`, err);
    return [];
  }
  root.updateMatrixWorld(true);

  const parts: FoliagePart[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const srcMat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const name = srcMat.name || '';
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);

    let material: THREE.Material;
    let tinted = false;
    let shadow = castShadow;

    if (name.startsWith('Leaves')) {
      // Leaf cards: neutral grey texture + per-instance hue, alpha cut-out
      if (foliageNormals === 'sphere') setSphericalNormals(geometry);
      else if (foliageNormals === 'up') setUpNormals(geometry);
      material = new THREE.MeshLambertMaterial({
        map: srcMat.map ? (tintFoliage ? makeNeutralTexture(srcMat.map) : srcMat.map) : null,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      tinted = tintFoliage;
      applyWindSway(material, sway);
    } else if (name === 'Flowers') {
      // Petals keep their painted colours (pink, yellow, red, peach, violet)
      if (foliageNormals !== 'keep') setUpNormals(geometry);
      material = new THREE.MeshLambertMaterial({
        map: srcMat.map,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      applyWindSway(material, sway);
    } else if (name === 'Grass') {
      // Kit grass: replace the palette-strip texture with a root-to-tip gradient
      setUpNormals(geometry);
      setHeightGradient(geometry);
      material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      tinted = true;
      shadow = false;
      applyWindSway(material, sway);
    } else if (name.startsWith('Bark')) {
      // Bark keeps its texture; the normal map is dropped (invisible at this scale, costs a texture fetch)
      material = new THREE.MeshLambertMaterial({ map: srcMat.map, side: THREE.FrontSide });
      // Bark is up to 4k triangles per tree; its shadow is hidden under the canopy shadow anyway
      shadow = false;
    } else {
      // Rocks, pebbles, mushrooms: keep painted texture, matte
      material = new THREE.MeshLambertMaterial({ map: srcMat.map });
    }
    material.name = name;
    parts.push({ geometry, material, tinted, shadow });
  });

  // The source glTF materials and textures we did not reuse are released by GC;
  // the source geometries are dropped because we cloned them.
  return parts;
}

// ---------------------------------------------------------------------------
// Procedural geometry: grass tufts and distant "blob" trees
// ---------------------------------------------------------------------------

/**
 * A cheap stylized grass tuft: `blades` tapered, slightly curved blades
 * (3 triangles each, about 21 triangles per tuft versus 155-620 for the kit grass).
 * Used for the dense ground cover; the kit grass is kept for close-up accents.
 */
export function createGrassTuftGeometry(blades = 7, seed = 1): THREE.BufferGeometry {
  let s = seed;
  const rand = (): number => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let b = 0; b < blades; b++) {
    const angle = (b / blades) * Math.PI * 2 + rand() * 0.6;
    const lean = 0.25 + rand() * 0.35;
    const h = 0.55 + rand() * 0.5;
    const w = 0.07 + rand() * 0.04;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    // Blade faces sideways to its lean direction
    const px = -dz;
    const pz = dx;
    const r0 = rand() * 0.12; // spread the roots a little
    const bx = dx * r0;
    const bz = dz * r0;
    const base = positions.length / 3;

    // base L, base R, mid L, mid R, tip
    const midOff = lean * h * 0.35;
    const tipOff = lean * h;
    positions.push(
      bx - px * w, 0, bz - pz * w,
      bx + px * w, 0, bz + pz * w,
      bx + dx * midOff - px * w * 0.7, h * 0.55, bz + dz * midOff - pz * w * 0.7,
      bx + dx * midOff + px * w * 0.7, h * 0.55, bz + dz * midOff + pz * w * 0.7,
      bx + dx * tipOff, h, bz + dz * tipOff
    );
    colors.push(0.55, 0.55, 0.55, 0.55, 0.55, 0.55, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1, 1, 1);
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  setUpNormals(geom);
  return geom;
}

/**
 * A low-poly stand-in for a tree, matching the size of the given leaf part.
 * Used beyond the LOD distance where the real model (3-6k triangles) would be
 * wasted: about 180 triangles. Trunk is darkened through vertex colours so the
 * instance tint (green or orange) mostly shows on the canopy.
 */
export function createBlobTreeGeometry(leafGeom: THREE.BufferGeometry): THREE.BufferGeometry {
  leafGeom.computeBoundingBox();
  const box = leafGeom.boundingBox!;
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const canopyA = new THREE.IcosahedronGeometry(0.5, 1);
  canopyA.scale(size.x * 0.95, size.y * 0.8, size.z * 0.95);
  canopyA.translate(center.x, center.y - size.y * 0.05, center.z);
  const canopyB = new THREE.IcosahedronGeometry(0.5, 1);
  canopyB.scale(size.x * 0.65, size.y * 0.55, size.z * 0.65);
  canopyB.translate(center.x + size.x * 0.12, center.y + size.y * 0.25, center.z - size.z * 0.08);

  const trunkH = Math.max(box.min.y, 0.5) + size.y * 0.2;
  const trunk = new THREE.CylinderGeometry(size.x * 0.035, size.x * 0.06, trunkH, 6, 1, true);
  trunk.translate(center.x, trunkH / 2, center.z);

  const paint = (g: THREE.BufferGeometry, r: number, gg: number, b: number): THREE.BufferGeometry => {
    const g2 = g.index ? g.toNonIndexed() : g;
    const n = g2.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = r;
      c[i * 3 + 1] = gg;
      c[i * 3 + 2] = b;
    }
    g2.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g2.deleteAttribute('uv');
    return g2;
  };

  const merged = mergeGeometries([
    paint(canopyA, 0.85, 0.85, 0.85),
    paint(canopyB, 0.95, 0.95, 0.95),
    paint(trunk, 0.55, 0.42, 0.38),
  ]);
  setSphericalNormals(merged);
  [canopyA, canopyB, trunk].forEach((g) => g.dispose());
  return merged;
}

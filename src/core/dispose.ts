import * as THREE from 'three';

/**
 * Recursively disposes of Three.js objects, geometries, materials, and textures
 * to prevent memory leaks as required by the CLAUDE.md specification.
 */
export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => disposeMaterial(mat));
        } else {
          disposeMaterial(child.material);
        }
      }
    } else if (child instanceof THREE.Points) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => disposeMaterial(mat));
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });

  if (obj.parent) {
    obj.parent.remove(obj);
  }
}

function disposeMaterial(mat: THREE.Material): void {
  // Dispose all potential texture maps on the material
  const record = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (val && typeof val === 'object' && val instanceof THREE.Texture) {
      val.dispose();
    }
  }
  mat.dispose();
}

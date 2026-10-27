import * as THREE from 'three';

export interface ResizeHandler {
  dispose: () => void;
  trigger: () => void;
}

export function setupResize(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  onResizeCustom?: (width: number, height: number) => void
): ResizeHandler {
  const onWindowResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height);

    if (onResizeCustom) {
      onResizeCustom(width, height);
    }
  };

  window.addEventListener('resize', onWindowResize, false);

  return {
    dispose: () => window.removeEventListener('resize', onWindowResize),
    trigger: onWindowResize,
  };
}

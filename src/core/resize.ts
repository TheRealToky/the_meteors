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

    const isMobile = width < 768 || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
    const maxDpr = isMobile ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
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

import * as THREE from 'three';

export interface RendererOptions {
  canvas?: HTMLCanvasElement;
  container?: HTMLElement;
  antialias?: boolean;
}

/**
 * Creates and configures the core WebGLRenderer.
 * Enforces DPR cap of 2 for mobile and desktop performance.
 */
export function createRenderer(options: RendererOptions = {}): {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} {
  const canvas = options.canvas ?? (document.createElement('canvas'));
  if (!options.canvas && options.container) {
    options.container.appendChild(canvas);
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: options.antialias ?? true,
    powerPreference: 'high-performance',
    alpha: false,
  });

  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || navigator.maxTouchPoints > 1);
  const maxDpr = isMobile ? 1.5 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd7ecf8); // Soft Rwandan highland sky

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 15, 30);

  return { renderer, scene, camera };
}

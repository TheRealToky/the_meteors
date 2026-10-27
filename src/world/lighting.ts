import * as THREE from 'three';

export interface LightingSetup {
  sunLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  dispose: () => void;
}

/**
 * Sets up lighting and atmospheric fog for the low-poly Rwanda landscape.
 * Single directional sun light with shadows + soft warm ambient bounce + distance fog.
 */
export function setupLighting(scene: THREE.Scene): LightingSetup {
  // Soft atmospheric sky fog
  const skyColor = new THREE.Color(0xd7ecf8);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 70, 220);

  // Hemisphere light: subtle blue sky down to warm earth tone
  const hemiLight = new THREE.HemisphereLight(0xe8f4fa, 0x7e5c3e, 0.65);
  scene.add(hemiLight);

  // Soft ambient fill
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);

  // Warm equatorial African sun
  const sunLight = new THREE.DirectionalLight(0xfffae8, 1.25);
  sunLight.position.set(60, 90, 50);
  sunLight.castShadow = true;

  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 250;

  const shadowDist = 80;
  sunLight.shadow.camera.left = -shadowDist;
  sunLight.shadow.camera.right = shadowDist;
  sunLight.shadow.camera.top = shadowDist;
  sunLight.shadow.camera.bottom = -shadowDist;
  sunLight.shadow.bias = -0.0005;

  scene.add(sunLight);

  return {
    sunLight,
    ambientLight,
    hemiLight,
    dispose: () => {
      scene.remove(hemiLight);
      scene.remove(ambientLight);
      scene.remove(sunLight);
      sunLight.dispose();
      ambientLight.dispose();
      hemiLight.dispose();
    },
  };
}

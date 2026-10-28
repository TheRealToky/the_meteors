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
  // Soft dreamlike atmospheric fog matching the Sky dome horizon
  // Exponential fog creates velvety depth separation without harsh distance cutoffs
  const horizonFogColor = new THREE.Color(0xe6daf0);
  scene.fog = new THREE.FogExp2(horizonFogColor, 0.0075);

  // Hemisphere light: soft ethereal sky cyan down to warm Rwandan hillside bounce
  const hemiLight = new THREE.HemisphereLight(0xe8f2fc, 0x6e8f5b, 0.75);
  scene.add(hemiLight);

  // Soft ambient fill light to keep shadowed valleys readable and inviting
  const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.45);
  scene.add(ambientLight);

  // Warm equatorial golden sun (cinematic 3/4 angle)
  const sunLight = new THREE.DirectionalLight(0xfff3db, 1.35);
  sunLight.position.set(65, 85, 45);
  sunLight.castShadow = true;

  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 260;

  const shadowDist = 95;
  sunLight.shadow.camera.left = -shadowDist;
  sunLight.shadow.camera.right = shadowDist;
  sunLight.shadow.camera.top = shadowDist;
  sunLight.shadow.camera.bottom = -shadowDist;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.025; // Clean shadow contact without acne
  sunLight.shadow.radius = 2.5; // Soft cinematic shadow penumbra

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

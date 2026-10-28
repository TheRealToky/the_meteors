import * as THREE from 'three';
import gsap from 'gsap';

export interface SkySystem {
  group: THREE.Group;
  update: (dt: number, elapsed: number) => void;
  setMood: (sceneId: string, duration?: number) => void;
  dispose: () => void;
}

export interface SkyPalette {
  topColor: THREE.Color;
  midColor: THREE.Color;
  bottomColor: THREE.Color;
  fogColor: THREE.Color;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
}

// Curated Sky: Children of the Light color palettes for each life station
export const STATION_MOODS: Record<string, SkyPalette> = {
  intro: {
    topColor: new THREE.Color(0x6a9fd8),
    midColor: new THREE.Color(0xd2b8dc),
    bottomColor: new THREE.Color(0xffdfb8),
    fogColor: new THREE.Color(0xe6daf0),
    sunColor: new THREE.Color(0xfff3db),
    sunIntensity: 1.35,
    hemiSkyColor: new THREE.Color(0xe8f2fc),
    hemiGroundColor: new THREE.Color(0x6e8f5b),
  },
  birth: {
    // Dawn of life: hopeful blush, soft golden dew, ethereal warmth
    topColor: new THREE.Color(0x73a6dc),
    midColor: new THREE.Color(0xe0b8cc),
    bottomColor: new THREE.Color(0xffe1bd),
    fogColor: new THREE.Color(0xf2e0e5),
    sunColor: new THREE.Color(0xffedd4),
    sunIntensity: 1.4,
    hemiSkyColor: new THREE.Color(0xfcf2eb),
    hemiGroundColor: new THREE.Color(0x6a8c54),
  },
  growing: {
    // Vibrant youth: crystal blue highland sky, sunny emerald vitality
    topColor: new THREE.Color(0x569ee2),
    midColor: new THREE.Color(0xa7cbf3),
    bottomColor: new THREE.Color(0xf8ebd6),
    fogColor: new THREE.Color(0xdfeaf5),
    sunColor: new THREE.Color(0xfffaea),
    sunIntensity: 1.45,
    hemiSkyColor: new THREE.Color(0xf0f7ff),
    hemiGroundColor: new THREE.Color(0x62914c),
  },
  marriage: {
    // Connection & warmth: romantic golden hour sunset over the rolling terraces
    topColor: new THREE.Color(0x6280b8),
    midColor: new THREE.Color(0xd89297),
    bottomColor: new THREE.Color(0xffc184),
    fogColor: new THREE.Color(0xedd0c0),
    sunColor: new THREE.Color(0xffcb85),
    sunIntensity: 1.5,
    hemiSkyColor: new THREE.Color(0xfce8d7),
    hemiGroundColor: new THREE.Color(0x75674c),
  },
  divorce: {
    // Reflection & calm: peaceful twilight lavender, serene and dignified
    topColor: new THREE.Color(0x5b6894),
    midColor: new THREE.Color(0x9d90b8),
    bottomColor: new THREE.Color(0xd8cadc),
    fogColor: new THREE.Color(0xcac0d4),
    sunColor: new THREE.Color(0xf5e3d8),
    sunIntensity: 1.15,
    hemiSkyColor: new THREE.Color(0xdfe1f0),
    hemiGroundColor: new THREE.Color(0x58586b),
  },
  death: {
    // Contemplation & eternity: peaceful starlit indigo, serene celestial aurora
    topColor: new THREE.Color(0x273552),
    midColor: new THREE.Color(0x4a4f78),
    bottomColor: new THREE.Color(0x8a84a6),
    fogColor: new THREE.Color(0x4d5370),
    sunColor: new THREE.Color(0xecd4d0),
    sunIntensity: 0.9,
    hemiSkyColor: new THREE.Color(0x5a6a8c),
    hemiGroundColor: new THREE.Color(0x38394a),
  },
  outro: {
    // Sunrise of renewal: radiant dawn overlooking Rwanda's thousand hills
    topColor: new THREE.Color(0x6396d1),
    midColor: new THREE.Color(0xd3aed4),
    bottomColor: new THREE.Color(0xffdeb8),
    fogColor: new THREE.Color(0xebdce8),
    sunColor: new THREE.Color(0xfff1dc),
    sunIntensity: 1.4,
    hemiSkyColor: new THREE.Color(0xfdf4ec),
    hemiGroundColor: new THREE.Color(0x6b8f58),
  },
};

export function createSkySystem(
  scene: THREE.Scene,
  sunLight?: THREE.DirectionalLight,
  hemiLight?: THREE.HemisphereLight
): SkySystem {
  const group = new THREE.Group();
  scene.add(group);

  // 1. Dreamlike Inverted Sky Hemisphere Dome
  const skyGeo = new THREE.SphereGeometry(380, 32, 24);
  // Invert inside
  skyGeo.scale(-1, 1, 1);

  const initialMood = STATION_MOODS.intro;

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uTopColor:    { value: initialMood.topColor.clone() },
      uMidColor:    { value: initialMood.midColor.clone() },
      uBottomColor: { value: initialMood.bottomColor.clone() },
      uTime:        { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uBottomColor;
      uniform float uTime;
      varying vec3 vWorldPos;

      void main() {
        // Normalized elevation: -10 to +300
        float h = normalize(vWorldPos).y;
        vec3 color;
        if (h > 0.0) {
          // Smooth blend from horizon (bottom) through mid to zenith (top)
          float tTop = smoothstep(0.08, 0.75, h);
          vec3 lower = mix(uBottomColor, uMidColor, smoothstep(0.0, 0.25, h));
          color = mix(lower, uTopColor, tTop);
        } else {
          // Below horizon mist
          color = mix(uBottomColor, uMidColor * 0.8, clamp(-h * 3.0, 0.0, 1.0));
        }

        // Subtle horizon atmospheric glow
        float horizonGlow = exp(-abs(h) * 8.0) * 0.12;
        color += uBottomColor * horizonGlow;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });

  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyMesh);

  // 2. Floating Ethereal Light Motes / Dandelion Spores (Sky signature particle atmosphere)
  const moteCount = 380;
  const motePositions = new Float32Array(moteCount * 3);
  const motePhases    = new Float32Array(moteCount);
  const moteScales    = new Float32Array(moteCount);

  for (let i = 0; i < moteCount; i++) {
    // Distribute across play area
    motePositions[i * 3 + 0] = (Math.random() - 0.5) * 220;
    motePositions[i * 3 + 1] = 2.0 + Math.random() * 26.0;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 220;

    motePhases[i] = Math.random() * Math.PI * 2;
    moteScales[i] = 0.6 + Math.random() * 1.2;
  }

  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  moteGeo.setAttribute('aPhase', new THREE.BufferAttribute(motePhases, 1));
  moteGeo.setAttribute('aScale', new THREE.BufferAttribute(moteScales, 1));

  const pixelRatio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2.0);

  const moteMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xfff6de) },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        vec3 pos = position;
        // Gentle undulating breeze drift
        pos.x += sin(uTime * 0.45 + aPhase) * 2.5;
        pos.y += sin(uTime * 0.75 + aPhase * 2.0) * 1.2;
        pos.z += cos(uTime * 0.35 + aPhase) * 2.5;

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // Size attenuation with soft pulsing
        float pulse = 0.75 + 0.25 * sin(uTime * 2.0 + aPhase * 3.0);
        gl_PointSize = (aScale * pulse * 14.0 * (120.0 / -mvPos.z)) * uPixelRatio;
        gl_PointSize = clamp(gl_PointSize, 1.0, 36.0);

        vAlpha = pulse * 0.85;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        // Soft celestial bloom circle with warm core
        float core = smoothstep(0.2, 0.0, d);
        float glow = smoothstep(0.5, 0.05, d) * 0.65;
        float alpha = (core + glow) * vAlpha;

        vec3 finalColor = mix(uColor, vec3(1.0), core * 0.6);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const motesMesh = new THREE.Points(moteGeo, moteMat);
  group.add(motesMesh);

  // 3. Smooth Mood Transitioning
  const currentMood = {
    topR: initialMood.topColor.r, topG: initialMood.topColor.g, topB: initialMood.topColor.b,
    midR: initialMood.midColor.r, midG: initialMood.midColor.g, midB: initialMood.midColor.b,
    botR: initialMood.bottomColor.r, botG: initialMood.bottomColor.g, botB: initialMood.bottomColor.b,
    fogR: initialMood.fogColor.r, fogG: initialMood.fogColor.g, fogB: initialMood.fogColor.b,
    sunR: initialMood.sunColor.r, sunG: initialMood.sunColor.g, sunB: initialMood.sunColor.b,
    sunIntensity: initialMood.sunIntensity,
    hemiSkyR: initialMood.hemiSkyColor.r, hemiSkyG: initialMood.hemiSkyColor.g, hemiSkyB: initialMood.hemiSkyColor.b,
    hemiGndR: initialMood.hemiGroundColor.r, hemiGndG: initialMood.hemiGroundColor.g, hemiGndB: initialMood.hemiGroundColor.b,
  };

  const setMood = (sceneId: string, duration = 2.4): void => {
    const target = STATION_MOODS[sceneId] || STATION_MOODS.intro;

    gsap.to(currentMood, {
      topR: target.topColor.r, topG: target.topColor.g, topB: target.topColor.b,
      midR: target.midColor.r, midG: target.midColor.g, midB: target.midColor.b,
      botR: target.bottomColor.r, botG: target.bottomColor.g, botB: target.bottomColor.b,
      fogR: target.fogColor.r, fogG: target.fogColor.g, fogB: target.fogColor.b,
      sunR: target.sunColor.r, sunG: target.sunColor.g, sunB: target.sunColor.b,
      sunIntensity: target.sunIntensity,
      hemiSkyR: target.hemiSkyColor.r, hemiSkyG: target.hemiSkyColor.g, hemiSkyB: target.hemiSkyColor.b,
      hemiGndR: target.hemiGroundColor.r, hemiGndG: target.hemiGroundColor.g, hemiGndB: target.hemiGroundColor.b,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        // Update sky dome shader
        skyMat.uniforms.uTopColor.value.setRGB(currentMood.topR, currentMood.topG, currentMood.topB);
        skyMat.uniforms.uMidColor.value.setRGB(currentMood.midR, currentMood.midG, currentMood.midB);
        skyMat.uniforms.uBottomColor.value.setRGB(currentMood.botR, currentMood.botG, currentMood.botB);

        // Update fog
        if (scene.fog) {
          scene.fog.color.setRGB(currentMood.fogR, currentMood.fogG, currentMood.fogB);
        }

        // Update sunlight
        if (sunLight) {
          sunLight.color.setRGB(currentMood.sunR, currentMood.sunG, currentMood.sunB);
          sunLight.intensity = currentMood.sunIntensity;
        }

        // Update hemisphere light
        if (hemiLight) {
          hemiLight.color.setRGB(currentMood.hemiSkyR, currentMood.hemiSkyG, currentMood.hemiSkyB);
          hemiLight.groundColor.setRGB(currentMood.hemiGndR, currentMood.hemiGndG, currentMood.hemiGndB);
        }
      },
    });
  };

  const update = (_dt: number, elapsed: number): void => {
    skyMat.uniforms.uTime.value = elapsed;
    moteMat.uniforms.uTime.value = elapsed;
    // Slow majestic celestial rotation
    skyMesh.rotation.y = elapsed * 0.008;
  };

  const dispose = (): void => {
    skyGeo.dispose();
    skyMat.dispose();
    moteGeo.dispose();
    moteMat.dispose();
    scene.remove(group);
  };

  return { group, update, setMood, dispose };
}

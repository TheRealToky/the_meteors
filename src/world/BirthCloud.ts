import * as THREE from 'three';
import { getHeightAt } from './terrain';

export interface BirthData {
  id: string;
  source: {
    sheet: string;
    title: string;
    note: string;
  };
  indicators: {
    registered_births: number;
    male_births?: number;
    female_births?: number;
    sex_ratio_at_birth?: number;
    registration_completeness?: number;
    fertility_rate?: number;
    fertility_statement?: string;
  };
  checks?: {
    registered_births: number;
  };
}

export interface BirthCloudConfig {
  birthData: BirthData;
  playerSex?: 'male' | 'female';
  seed?: number;
  lowQuality?: boolean;
}

/**
 * Deterministic PRNG (Mulberry32) for reproducible point cloud generation.
 */
function createMulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class BirthCloud {
  public group: THREE.Group = new THREE.Group();

  private totalCount: number;
  private pointsMesh: THREE.Points | null = null;
  private cloudGeometry: THREE.BufferGeometry | null = null;
  private cloudMaterial: THREE.ShaderMaterial | null = null;

  // "You" marker (1 draw call)
  private youMarkerMesh: THREE.Mesh | null = null;
  private youMarkerMaterial: THREE.ShaderMaterial | null = null;
  private youMarkerGeometry: THREE.BufferGeometry | null = null;

  // Positions and info
  private youIndex: number = 0;
  private youSex: 'male' | 'female' = 'female';
  private youPosition: THREE.Vector3 = new THREE.Vector3();
  private centerPosition: THREE.Vector3 = new THREE.Vector3();

  constructor(config: BirthCloudConfig) {
    this.totalCount = config.birthData.indicators.registered_births;
    this.init(config);
  }

  private init(config: BirthCloudConfig): void {
    const { birthData, playerSex = 'female', seed = 2025, lowQuality = false } = config;
    const rng = createMulberry32(seed);

    // Birth station anchor coordinates (-45, -25)
    const stationX = -45;
    const stationZ = -25;
    const groundY = getHeightAt(stationX, stationZ);
    // Cloud floats gently above the hill terrace
    const stationY = groundY + 11.5;
    this.centerPosition.set(stationX, stationY, stationZ);

    const N = this.totalCount;
    const positions = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const phases = new Float32Array(N);
    const progressIndices = new Float32Array(N);

    // Sex statistics from verified JSON indicators
    const maleTotal = birthData.indicators.male_births || 0;
    const femaleTotal = birthData.indicators.female_births || 0;
    const hasSexSplit = maleTotal > 0 && femaleTotal > 0;
    let malesRemaining = maleTotal;
    let totalRemaining = N;

    // Palette: Sky Cyan for boys, Rose Coral for girls, Slate for neutral
    const cMale = new THREE.Color(0x38bdf8);
    const cFemale = new THREE.Color(0xfb7185);
    const cNeutral = new THREE.Color(0xe2e8f0);

    // Golden angle phyllotaxis disc: r = c * sqrt(i), theta = i * 2.39996
    const goldenAngle = 2.399963229728653;
    const c = 0.048; // Results in radius ~28.6 units, fitting gracefully in scene

    const sexAssignments: Uint8Array = new Uint8Array(N); // 0 = female, 1 = male

    for (let i = 0; i < N; i++) {
      const r = c * Math.sqrt(i);
      const theta = i * goldenAngle;

      const px = stationX + r * Math.cos(theta);
      const pz = stationZ + r * Math.sin(theta);
      // Gentle dome curvature for 3D depth
      const py = stationY + Math.sin(r * 0.12) * 1.4;

      positions[i * 3 + 0] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;

      // Color assignment
      if (hasSexSplit) {
        const pMale = malesRemaining / totalRemaining;
        const isMale = rng() < pMale;
        if (isMale) {
          colors[i * 3 + 0] = cMale.r;
          colors[i * 3 + 1] = cMale.g;
          colors[i * 3 + 2] = cMale.b;
          sexAssignments[i] = 1;
          malesRemaining--;
        } else {
          colors[i * 3 + 0] = cFemale.r;
          colors[i * 3 + 1] = cFemale.g;
          colors[i * 3 + 2] = cFemale.b;
          sexAssignments[i] = 0;
        }
        totalRemaining--;
      } else {
        colors[i * 3 + 0] = cNeutral.r;
        colors[i * 3 + 1] = cNeutral.g;
        colors[i * 3 + 2] = cNeutral.b;
        sexAssignments[i] = 0;
      }

      // Random phase for twinkle animation
      phases[i] = rng() * Math.PI * 2.0;

      // Normalized index for progressive bloom reveal
      progressIndices[i] = i / N;
    }

    // Pick "you" index matching chosen sex with seeded RNG
    const targetSexNum = playerSex === 'male' ? 1 : 0;
    const candidateOffset = Math.floor(rng() * N);
    let chosenIdx = -1;

    for (let offset = 0; offset < N; offset++) {
      const testIdx = (candidateOffset + offset) % N;
      if (hasSexSplit) {
        if (sexAssignments[testIdx] === targetSexNum) {
          chosenIdx = testIdx;
          break;
        }
      } else {
        chosenIdx = testIdx;
        break;
      }
    }

    if (chosenIdx === -1) chosenIdx = candidateOffset;
    this.youIndex = chosenIdx;
    this.youSex = sexAssignments[chosenIdx] === 1 ? 'male' : 'female';
    this.youPosition.set(
      positions[chosenIdx * 3 + 0],
      positions[chosenIdx * 3 + 1],
      positions[chosenIdx * 3 + 2]
    );

    // 1. Build Cloud Geometry and ShaderMaterial
    this.cloudGeometry = new THREE.BufferGeometry();
    this.cloudGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.cloudGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.cloudGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.cloudGeometry.setAttribute('aProgress', new THREE.BufferAttribute(progressIndices, 1));

    const pixelRatio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2.0);

    this.cloudMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uBaseSize: { value: 16.0 },
        uPixelRatio: { value: pixelRatio },
        uTwinkleEnabled: { value: lowQuality ? 0.0 : 1.0 },
        uRevealProgress: { value: 0.0 }, // 0.0 to 1.0 (animated during count-up)
      },
      vertexShader: `
        attribute float aPhase;
        attribute float aProgress;
        uniform float uTime;
        uniform float uBaseSize;
        uniform float uPixelRatio;
        uniform float uTwinkleEnabled;
        uniform float uRevealProgress;
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vColor = color;
          // Twinkle effect (subtle sine oscillation)
          vTwinkle = uTwinkleEnabled > 0.5 ? 0.72 + 0.28 * sin(uTime * 2.4 + aPhase) : 1.0;

          // Reveal bloom
          float isVisible = step(aProgress, uRevealProgress);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          // Distance attenuation scaled by devicePixelRatio
          gl_PointSize = isVisible * uBaseSize * (155.0 / -mvPosition.z) * uPixelRatio;
          gl_PointSize = clamp(gl_PointSize, 0.0, 42.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;

          // Soft round point falloff
          float alpha = smoothstep(0.5, 0.1, dist) * vTwinkle;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.pointsMesh = new THREE.Points(this.cloudGeometry, this.cloudMaterial);
    this.group.add(this.pointsMesh);

    // 2. Build "You" Marker (1 draw call, billboarded with distinct pulsing halo ring + diamond core)
    const youColor = this.youSex === 'male' ? cMale : cFemale;
    this.youMarkerGeometry = new THREE.PlaneGeometry(3.6, 3.6);

    this.youMarkerMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uColor: { value: new THREE.Color(youColor) },
        uHaloScale: { value: 1.0 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uHaloScale;
        uniform float uOpacity;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv - vec2(0.5);
          float dist = length(p);

          // Pulsing halo ring: oscillates outward
          float ringRadius = 0.36 + 0.06 * sin(uTime * 4.0);
          float ring = smoothstep(0.045, 0.01, abs(dist - ringRadius));

          // Expanding outer pulse ring
          float pulseWave = fract(uTime * 0.8) * 0.45;
          float outerRing = smoothstep(0.03, 0.005, abs(dist - pulseWave)) * (1.0 - pulseWave / 0.45);

          // Central diamond shape: |x| + |y| < 0.11 (distinguishable by shape and size, not color alone)
          float diamond = 1.0 - smoothstep(0.08, 0.12, abs(p.x) + abs(p.y));

          float totalShape = clamp((ring * 0.95 + outerRing * 0.7 + diamond * 1.0) * uOpacity, 0.0, 1.0);
          if (totalShape < 0.01) discard;

          // Core diamond is bright white, ring has sex color
          vec3 finalColor = mix(uColor, vec3(1.0, 1.0, 1.0), diamond * 0.75);
          gl_FragColor = vec4(finalColor, totalShape);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.youMarkerMesh = new THREE.Mesh(this.youMarkerGeometry, this.youMarkerMaterial);
    this.youMarkerMesh.position.copy(this.youPosition);
    this.group.add(this.youMarkerMesh);
  }

  public getPointCount(): number {
    return this.totalCount;
  }

  public getCenterPosition(): THREE.Vector3 {
    return this.centerPosition;
  }

  public getYouPosition(): THREE.Vector3 {
    return this.youPosition;
  }

  public getYouInfo(): { index: number; sex: 'male' | 'female' } {
    return {
      index: this.youIndex,
      sex: this.youSex,
    };
  }

  public setRevealProgress(progress: number): void {
    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.uRevealProgress.value = THREE.MathUtils.clamp(progress, 0.0, 1.0);
    }
  }

  public setTwinkleEnabled(enabled: boolean): void {
    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.uTwinkleEnabled.value = enabled ? 1.0 : 0.0;
    }
  }

  public setMarkerExpansion(scale: number, opacity: number): void {
    if (this.youMarkerMaterial) {
      this.youMarkerMaterial.uniforms.uHaloScale.value = scale;
      this.youMarkerMaterial.uniforms.uOpacity.value = opacity;
    }
    if (this.youMarkerMesh) {
      this.youMarkerMesh.scale.setScalar(scale);
    }
  }

  /**
   * Update loop: zero allocations per frame.
   */
  public update(_dt: number, elapsed: number, camera?: THREE.Camera): void {
    if (this.cloudMaterial) {
      this.cloudMaterial.uniforms.uTime.value = elapsed;
    }

    if (this.youMarkerMaterial) {
      this.youMarkerMaterial.uniforms.uTime.value = elapsed;
    }

    // Billboard the "you" marker directly toward camera
    if (this.youMarkerMesh && camera) {
      this.youMarkerMesh.quaternion.copy(camera.quaternion);
    }
  }

  public dispose(): void {
    if (this.pointsMesh) {
      this.group.remove(this.pointsMesh);
      this.pointsMesh = null;
    }
    if (this.cloudGeometry) {
      this.cloudGeometry.dispose();
      this.cloudGeometry = null;
    }
    if (this.cloudMaterial) {
      this.cloudMaterial.dispose();
      this.cloudMaterial = null;
    }

    if (this.youMarkerMesh) {
      this.group.remove(this.youMarkerMesh);
      this.youMarkerMesh = null;
    }
    if (this.youMarkerGeometry) {
      this.youMarkerGeometry.dispose();
      this.youMarkerGeometry = null;
    }
    if (this.youMarkerMaterial) {
      this.youMarkerMaterial.dispose();
      this.youMarkerMaterial = null;
    }

    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}

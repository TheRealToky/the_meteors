import * as THREE from 'three';

/**
 * A trickle of soft golden lights that drift along the path from the traveller
 * to the next station, like fireflies showing the way. Visible only while the
 * player is walking. One Points draw call, positions updated on the CPU from
 * pre-sampled path points (no allocations per frame).
 */
export class PathGuide {
  private readonly count = 60;
  private readonly speed = 7; // metres per second along the path
  private readonly samples: Float32Array;
  private readonly sampleCount: number;
  private readonly pathLength: number;

  private readonly points: THREE.Points;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly alphas: Float32Array;

  private fromT = 0;
  private toT = 0;
  private fade = 0;
  private targetFade = 0;

  constructor(private scene: THREE.Scene, curve: THREE.CatmullRomCurve3) {
    // Sample the path every ~0.5 m once, so per-frame lookups are cheap
    this.pathLength = curve.getLength();
    this.sampleCount = Math.max(2, Math.ceil(this.pathLength / 0.5));
    this.samples = new Float32Array(this.sampleCount * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < this.sampleCount; i++) {
      curve.getPointAt(i / (this.sampleCount - 1), p);
      this.samples[i * 3] = p.x;
      this.samples[i * 3 + 1] = p.y;
      this.samples[i * 3 + 2] = p.z;
    }

    this.positions = new Float32Array(this.count * 3);
    this.alphas = new Float32Array(this.count);
    const phases = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) phases[i] = Math.random() * Math.PI * 2;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffe6a8) },
        uPixelRatio: { value: dpr },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float aAlpha;
        attribute float aPhase;
        uniform float uPixelRatio;
        uniform float uTime;
        varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float twinkle = 0.75 + 0.25 * sin(uTime * 3.0 + aPhase);
          gl_PointSize = clamp(5.5 * twinkle * (60.0 / -mv.z) * uPixelRatio, 1.5, 22.0);
          vAlpha = aAlpha * twinkle;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(mix(uColor, vec3(1.0), glow * 0.5), glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false; // positions move every frame
    this.points.visible = false;
    this.scene.add(this.points);
  }

  /** Show the guide from path progress `fromT` to `toT` (both 0..1). */
  public setRoute(fromT: number, toT: number): void {
    this.fromT = fromT;
    this.toT = toT;
    this.targetFade = toT - fromT > 0.004 ? 1 : 0;
    if (this.targetFade > 0) this.points.visible = true;
  }

  public hide(): void {
    this.targetFade = 0;
  }

  public update(dt: number, elapsed: number): void {
    this.fade = THREE.MathUtils.lerp(this.fade, this.targetFade, Math.min(dt * 3, 1));
    if (this.fade < 0.01 && this.targetFade === 0) {
      this.points.visible = false;
      return;
    }
    this.material.uniforms.uTime.value = elapsed;

    const span = this.toT - this.fromT;
    const routeLen = Math.max(span * this.pathLength, 1);
    const cycle = (elapsed * this.speed) / routeLen;
    const last = this.sampleCount - 1;

    for (let i = 0; i < this.count; i++) {
      const travel = (i / this.count + cycle) % 1;
      const t = this.fromT + span * travel;
      const f = THREE.MathUtils.clamp(t, 0, 1) * last;
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, last);
      const k = f - i0;
      const x = this.samples[i0 * 3] * (1 - k) + this.samples[i1 * 3] * k;
      const y = this.samples[i0 * 3 + 1] * (1 - k) + this.samples[i1 * 3 + 1] * k;
      const z = this.samples[i0 * 3 + 2] * (1 - k) + this.samples[i1 * 3 + 2] * k;
      // Gentle wandering around the path line
      const w = elapsed * 1.3 + i * 2.17;
      this.positions[i * 3] = x + Math.sin(w) * 0.45;
      this.positions[i * 3 + 1] = y + 0.55 + Math.sin(w * 1.7) * 0.2;
      this.positions[i * 3 + 2] = z + Math.cos(w * 0.9) * 0.45;
      // Fade in after leaving the traveller, fade out on arrival
      const a = THREE.MathUtils.smoothstep(travel, 0.0, 0.12) * (1 - THREE.MathUtils.smoothstep(travel, 0.85, 1.0));
      this.alphas[i] = a * this.fade;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.scene.remove(this.points);
  }
}

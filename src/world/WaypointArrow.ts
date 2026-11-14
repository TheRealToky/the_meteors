import * as THREE from 'three';

export interface WaypointArrowOptions {
  scene: THREE.Scene;
  getHeight?: (x: number, z: number) => number;
}

/**
 * Marks the next station: a soft golden pillar of light rising from the
 * building, a slowly turning gem floating above the roof, and a ring of light
 * on the ground that ripples outward.
 *
 * Calm on purpose (the journey includes divorce and death), visible from far
 * away (the pillar is 40 m tall), and cheap: 3 draw calls, no extra light
 * (a PointLight would add a light to every material's shader).
 */
export class WaypointArrow {
  private scene: THREE.Scene;
  private getHeight?: (x: number, z: number) => number;

  private group = new THREE.Group();
  private gem: THREE.Mesh;
  private pillarMat: THREE.ShaderMaterial;
  private ringMat: THREE.ShaderMaterial;

  private gemBaseY = 0;
  private isVisible = false;
  private currentScale = 0;
  private targetScale = 0;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(options: WaypointArrowOptions) {
    this.scene = options.scene;
    this.getHeight = options.getHeight;

    const gold = new THREE.Color(0xffd27a);

    // 1. Light pillar: open cylinder, brightest at the base, fading upward,
    //    with soft edges (fresnel-like) so it reads as light, not as a tube
    const pillarGeo = new THREE.CylinderGeometry(1.4, 1.9, 40, 24, 1, true);
    pillarGeo.translate(0, 20, 0);
    this.pillarMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: gold }, uTime: { value: 0 }, uFade: { value: 1 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vNormalV = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uFade;
        varying vec2 vUv;
        varying vec3 vNormalV;
        varying vec3 vViewDir;
        void main() {
          float edge = abs(dot(normalize(vNormalV), normalize(vViewDir)));
          float soft = pow(edge, 1.5);
          float rise = pow(1.0 - vUv.y, 2.2);
          float shimmer = 0.85 + 0.15 * sin(vUv.y * 40.0 - uTime * 2.0);
          gl_FragColor = vec4(uColor, soft * rise * shimmer * 0.45 * uFade);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.geometries.push(pillarGeo);
    this.materials.push(this.pillarMat);
    this.group.add(new THREE.Mesh(pillarGeo, this.pillarMat));

    // 2. Floating gem (octahedron) above the roof
    const gemGeo = new THREE.OctahedronGeometry(0.75, 0);
    gemGeo.scale(1, 1.5, 1);
    const gemMat = new THREE.MeshBasicMaterial({ color: 0xffe3a3 });
    this.geometries.push(gemGeo);
    this.materials.push(gemMat);
    this.gem = new THREE.Mesh(gemGeo, gemMat);
    this.group.add(this.gem);

    // 3. Ground ring rippling outward
    const ringGeo = new THREE.RingGeometry(0.2, 1, 48, 1);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: gold }, uTime: { value: 0 }, uFade: { value: 1 } },
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uFade;
        varying vec2 vPos;
        void main() {
          float r = length(vPos);
          float wave = fract(r * 1.2 - uTime * 0.35);
          float band = smoothstep(0.0, 0.12, wave) * (1.0 - smoothstep(0.12, 0.3, wave));
          float fade = 1.0 - smoothstep(0.55, 1.0, r);
          gl_FragColor = vec4(uColor, band * fade * 0.55 * uFade);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.geometries.push(ringGeo);
    this.materials.push(this.ringMat);
    const ring = new THREE.Mesh(ringGeo, this.ringMat);
    ring.scale.setScalar(9);
    ring.position.y = 0.25;
    this.group.add(ring);

    this.group.visible = false;
    this.scene.add(this.group);
  }

  /**
   * Places the beacon on a station building. `heightOffset` is the height
   * of the gem above the ground (roof height + a little).
   */
  public setTarget(x: number, z: number, heightOffset = 8.5): void {
    const groundY = this.getHeight ? this.getHeight(x, z) : 0;
    this.group.position.set(x, groundY, z);
    this.gemBaseY = heightOffset;
    this.gem.position.y = heightOffset;
    this.show();
  }

  public setTargetVector(pos: THREE.Vector3, heightOffset = 8.5): void {
    this.setTarget(pos.x, pos.z, heightOffset);
  }

  public show(): void {
    this.isVisible = true;
    this.targetScale = 1.0;
    this.group.visible = true;
  }

  public hide(): void {
    this.isVisible = false;
    this.targetScale = 0.0;
  }

  public update(dt: number, elapsed: number): void {
    if (!this.group.visible) return;

    // Fade in/out instead of popping
    this.currentScale = THREE.MathUtils.lerp(this.currentScale, this.targetScale, Math.min(dt * 4.0, 1.0));
    if (this.currentScale <= 0.01 && !this.isVisible) {
      this.group.visible = false;
      return;
    }
    this.pillarMat.uniforms.uFade.value = this.currentScale;
    this.ringMat.uniforms.uFade.value = this.currentScale;
    this.pillarMat.uniforms.uTime.value = elapsed;
    this.ringMat.uniforms.uTime.value = elapsed;

    // Slow turn and gentle float
    this.gem.rotation.y += dt * 0.8;
    this.gem.position.y = this.gemBaseY + Math.sin(elapsed * 1.6) * 0.35;
    this.gem.scale.setScalar(Math.max(this.currentScale, 0.001));
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.scene.remove(this.group);
  }
}

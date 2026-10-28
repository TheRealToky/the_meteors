import * as THREE from 'three';
import { getHeightAt } from './terrain';

// Visual life-stage scale mapping: newborn → youth → adult → elder
const STAGE_SCALE: Array<{ maxAge: number; scale: number }> = [
  { maxAge: 2,   scale: 0.72 }, // infant / newborn (clear, charming presence)
  { maxAge: 12,  scale: 0.88 }, // child / youth traveler
  { maxAge: 25,  scale: 1.05 }, // young adult
  { maxAge: 60,  scale: 1.08 }, // full adult
  { maxAge: 120, scale: 0.98 }, // elder traveler
];

function scaleForAge(age: number): number {
  for (const entry of STAGE_SCALE) {
    if (age <= entry.maxAge) return entry.scale;
  }
  return STAGE_SCALE[STAGE_SCALE.length - 1].scale;
}

export interface CharacterRigConfig {
  curve: THREE.CatmullRomCurve3;
  scene: THREE.Scene;
  sex?: 'male' | 'female';
}

/**
 * A stylized 3D traveler inspired by the visual language of Sky: Children of the Light.
 * Features a charming silhouette with a flowing, animated celestial cape,
 * soft cowl with glowing eyes, smooth procedural walk/idle cycles, and life-stage transitions.
 */
export class CharacterRig {
  private curve: THREE.CatmullRomCurve3;
  private scene: THREE.Scene;
  private sex: 'male' | 'female';

  private root: THREE.Group = new THREE.Group();
  private modelRoot: THREE.Group = new THREE.Group();
  private bodyGroup: THREE.Group = new THREE.Group();

  // Procedural limbs & cape for fluid physically convincing motion
  private capeMesh: THREE.Mesh | null = null;
  private capeOriginalPositions: Float32Array | null = null;
  private leftArm: THREE.Group = new THREE.Group();
  private rightArm: THREE.Group = new THREE.Group();
  private leftLeg: THREE.Group = new THREE.Group();
  private rightLeg: THREE.Group = new THREE.Group();
  private headGroup: THREE.Group = new THREE.Group();

  // Footstep trail particles
  private footstepGroup: THREE.Points | null = null;
  private footstepPositions: Float32Array | null = null;
  private footstepAlphas: Float32Array | null = null;

  // Clean disposal tracking
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  private isLoaded: boolean = false;
  private progress: number = 0;
  private isMoving: boolean = false;
  private walkCycleTime: number = 0;
  private lastProgress: number = 0;

  // Zero-allocation cached vectors
  private _pathPoint   = new THREE.Vector3();
  private _pathTangent = new THREE.Vector3();
  private _alignQuat   = new THREE.Quaternion();

  constructor(config: CharacterRigConfig) {
    this.curve = config.curve;
    this.scene = config.scene;
    this.sex   = config.sex ?? 'female';

    this.modelRoot.add(this.bodyGroup);
    this.root.add(this.modelRoot);
    this.scene.add(this.root);
  }

  public async load(): Promise<void> {
    this.buildSkyTraveler();
    this.buildFootstepTrail();
    this.isLoaded = true;
    this.applyProgress(this.progress, true);
  }

  /**
   * Constructs the stylized Sky: Children of the Light traveler.
   */
  private buildSkyTraveler(): void {
    const isFemale = this.sex === 'female';

    // Curated Sky: Children of the Light Color Palette:
    // Female: Warm sunrise coral robe with flowing sunset amber/gold cape
    // Male: Celestial twilight sapphire robe with ethereal sky blue cape
    const robeColor = isFemale ? 0xe58b76 : 0x4a7eb0;
    const capeColor = isFemale ? 0xdf6a44 : 0x2e5f96;
    const capeTrimColor = isFemale ? 0xffdf80 : 0x8ce3ff;
    const eyeGlowColor  = isFemale ? 0xfff6cf : 0xe0f7ff;

    // Materials
    const robeMat = new THREE.MeshStandardMaterial({
      color: robeColor,
      roughness: 0.72,
      metalness: 0.02,
      flatShading: false,
    });
    this.disposables.push(robeMat);

    const cowlMat = new THREE.MeshStandardMaterial({
      color: 0x282329, // Soft charcoal mask/cowl interior
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false,
    });
    this.disposables.push(cowlMat);

    const eyeMat = new THREE.MeshBasicMaterial({
      color: eyeGlowColor,
    });
    this.disposables.push(eyeMat);

    const capeMat = new THREE.MeshStandardMaterial({
      color: capeColor,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.DoubleSide,
      flatShading: false,
    });
    this.disposables.push(capeMat);

    const trimMat = new THREE.MeshBasicMaterial({
      color: capeTrimColor,
      side: THREE.DoubleSide,
    });
    this.disposables.push(trimMat);

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x9e6c4c, // Warm Rwandan skin tone
      roughness: 0.8,
      metalness: 0.0,
      flatShading: false,
    });
    this.disposables.push(skinMat);

    // 1. Torso / Robe Body
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.95, 16);
    this.disposables.push(torsoGeo);
    const torsoMesh = new THREE.Mesh(torsoGeo, robeMat);
    torsoMesh.position.y = 0.85;
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.bodyGroup.add(torsoMesh);

    // 2. Head with Cowl & Glowing Eyes
    const headGeo = new THREE.SphereGeometry(0.26, 16, 16);
    this.disposables.push(headGeo);
    const headMesh = new THREE.Mesh(headGeo, robeMat);
    headMesh.castShadow = true;

    // Soft dark face mask
    const faceGeo = new THREE.SphereGeometry(0.22, 12, 12, 0, Math.PI);
    this.disposables.push(faceGeo);
    const faceMesh = new THREE.Mesh(faceGeo, cowlMat);
    faceMesh.rotation.y = -Math.PI / 2;
    faceMesh.position.set(0, 0, 0.06);
    headMesh.add(faceMesh);

    // Glowing eyes (Sky signature celestial dots)
    const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
    this.disposables.push(eyeGeo);

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.075, 0.03, 0.23);
    headMesh.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.075, 0.03, 0.23);
    headMesh.add(rightEye);

    this.headGroup.position.set(0, 1.48, 0);
    this.headGroup.add(headMesh);
    this.bodyGroup.add(this.headGroup);

    // 3. Flowing Signature Cape (Multi-segmented cloth mesh that ripples in wind)
    const capeWidth = 0.95;
    const capeLength = 1.15;
    const capeSegW = 10;
    const capeSegH = 14;
    const capeGeo = new THREE.PlaneGeometry(capeWidth, capeLength, capeSegW, capeSegH);
    this.disposables.push(capeGeo);

    // Arch the top of the cape over shoulders
    const posAttr = capeGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = posAttr.getX(i);
      const v = posAttr.getY(i);
      // Gentle conical curve around back
      const curveZ = -Math.pow(u / (capeWidth * 0.5), 2) * 0.12;
      posAttr.setZ(i, curveZ);
      // Taper at shoulders
      if (v > 0) {
        posAttr.setX(i, u * (0.6 + (0.4 * (1.0 - v / (capeLength * 0.5)))));
      }
    }
    capeGeo.computeVertexNormals();

    this.capeOriginalPositions = new Float32Array(posAttr.array);

    this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
    this.capeMesh.position.set(0, 1.25, -0.22);
    this.capeMesh.rotation.x = 0.15; // Sweep back naturally
    this.capeMesh.castShadow = true;
    this.bodyGroup.add(this.capeMesh);

    // Glowing trim hem along bottom of cape
    const trimGeo = new THREE.PlaneGeometry(capeWidth * 0.95, 0.06);
    this.disposables.push(trimGeo);
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(0, -capeLength * 0.48, 0.02);
    this.capeMesh.add(trimMesh);

    // 4. Stylized Arms
    const armGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.55, 10);
    this.disposables.push(armGeo);

    // Left Arm
    const leftArmMesh = new THREE.Mesh(armGeo, robeMat);
    leftArmMesh.position.y = -0.24;
    leftArmMesh.castShadow = true;
    this.leftArm.position.set(-0.32, 1.25, 0);
    this.leftArm.add(leftArmMesh);
    this.bodyGroup.add(this.leftArm);

    // Right Arm
    const rightArmMesh = new THREE.Mesh(armGeo, robeMat);
    rightArmMesh.position.y = -0.24;
    rightArmMesh.castShadow = true;
    this.rightArm.position.set(0.32, 1.25, 0);
    this.rightArm.add(rightArmMesh);
    this.bodyGroup.add(this.rightArm);

    // 5. Stylized Legs
    const legGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.5, 10);
    this.disposables.push(legGeo);

    const leftLegMesh = new THREE.Mesh(legGeo, skinMat);
    leftLegMesh.position.y = -0.22;
    leftLegMesh.castShadow = true;
    this.leftLeg.position.set(-0.13, 0.45, 0);
    this.leftLeg.add(leftLegMesh);
    this.bodyGroup.add(this.leftLeg);

    const rightLegMesh = new THREE.Mesh(legGeo, skinMat);
    rightLegMesh.position.y = -0.22;
    rightLegMesh.castShadow = true;
    this.rightLeg.position.set(0.13, 0.45, 0);
    this.rightLeg.add(rightLegMesh);
    this.bodyGroup.add(this.rightLeg);
  }

  /**
   * Footstep glowing dust motes that float behind the character.
   */
  private buildFootstepTrail(): void {
    const count = 35;
    this.footstepPositions = new Float32Array(count * 3);
    this.footstepAlphas    = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.footstepPositions[i * 3 + 0] = 0;
      this.footstepPositions[i * 3 + 1] = -100; // hidden until spawned
      this.footstepPositions[i * 3 + 2] = 0;
      this.footstepAlphas[i] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.footstepPositions, 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.footstepAlphas, 1));
    this.disposables.push(geo);

    const pixelRatio = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2.0);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xfff1cc) },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: `
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          gl_PointSize = (22.0 / -mvPos.z) * uPixelRatio * 30.0;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float d = length(coord);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.05, d) * vAlpha;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.disposables.push(mat);

    this.footstepGroup = new THREE.Points(geo, mat);
    this.scene.add(this.footstepGroup);
  }

  public setProgress(t: number): void {
    const newProgress = THREE.MathUtils.clamp(t, 0, 1);
    const moved = Math.abs(newProgress - this.lastProgress) > 0.0001;
    this.setMoving(moved);
    this.progress = newProgress;
    this.lastProgress = newProgress;

    if (this.isLoaded) {
      this.applyProgress(this.progress, false);
    }
  }

  public setMoving(moving: boolean): void {
    this.isMoving = moving;
  }

  public setLifeStage(age: number): void {
    const s = scaleForAge(age);
    this.modelRoot.scale.setScalar(s);
  }

  /**
   * Per-frame animation update: zero allocations.
   */
  public update(dt: number): void {
    if (!this.isLoaded) return;

    if (this.isMoving) {
      this.walkCycleTime += dt * 8.5;
    } else {
      this.walkCycleTime += dt * 2.2;
    }

    const t = this.walkCycleTime;

    // 1. Procedural Walk & Idle Motion
    if (this.isMoving) {
      // Natural walking stride
      const stride = Math.sin(t);
      this.leftLeg.rotation.x  = stride * 0.55;
      this.rightLeg.rotation.x = -stride * 0.55;

      this.leftArm.rotation.x  = -stride * 0.45;
      this.rightArm.rotation.x = stride * 0.45;

      // Vertical bobbing
      this.bodyGroup.position.y = Math.abs(Math.sin(t)) * 0.08;
      // Gentle torso sway
      this.bodyGroup.rotation.y = Math.sin(t * 0.5) * 0.05;
      this.headGroup.rotation.x = -0.05;
    } else {
      // Gentle breathing idle
      const breath = Math.sin(t);
      this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.15);
      this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.15);
      this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0.1, 0.15);
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0.1, 0.15);

      this.bodyGroup.position.y = breath * 0.025;
      this.bodyGroup.rotation.y = THREE.MathUtils.lerp(this.bodyGroup.rotation.y, 0, 0.1);
      this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, breath * 0.02, 0.1);
    }

    // 2. Cloth Wave Simulation on Cape (Sky: Children of the Light signature flutter)
    if (this.capeMesh && this.capeOriginalPositions) {
      const posAttr = this.capeMesh.geometry.attributes.position as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const count = posAttr.count;

      const waveSpeed = this.isMoving ? 12.0 : 3.5;
      const waveFreq  = this.isMoving ? 4.5 : 2.5;
      const waveAmp   = this.isMoving ? 0.22 : 0.06;
      const liftAngle = this.isMoving ? 0.38 : 0.08;

      for (let i = 0; i < count; i++) {
        const origX = this.capeOriginalPositions[i * 3 + 0];
        const origY = this.capeOriginalPositions[i * 3 + 1];
        const origZ = this.capeOriginalPositions[i * 3 + 2];

        // Free bottom of cape lifts and ripples; pinned top stays near shoulders
        const normY = THREE.MathUtils.clamp(1.0 - (origY + 0.6) / 1.2, 0.0, 1.0);
        const wave = Math.sin(t * waveSpeed * 0.5 + normY * waveFreq) * waveAmp * normY;
        const lift = normY * liftAngle;

        posArr[i * 3 + 0] = origX;
        posArr[i * 3 + 1] = origY;
        posArr[i * 3 + 2] = origZ - wave - lift;
      }
      posAttr.needsUpdate = true;
      this.capeMesh.geometry.computeVertexNormals();
    }
  }

  private applyProgress(t: number, snap: boolean): void {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);

    // 1. Position along rail curve
    this.curve.getPointAt(clamped, this._pathPoint);

    // 2. Snap cleanly to terrain surface
    this._pathPoint.y = getHeightAt(this._pathPoint.x, this._pathPoint.z) + 0.08;
    this.root.position.copy(this._pathPoint);

    // 3. Smooth forward orientation along path tangent
    const epsilon = 0.002;
    this.curve.getTangentAt(THREE.MathUtils.clamp(clamped + epsilon, 0, 1), this._pathTangent);
    this._pathTangent.y = 0;
    this._pathTangent.normalize();

    this._alignQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this._pathTangent);

    if (snap) {
      this.root.quaternion.copy(this._alignQuat);
    } else {
      this.root.quaternion.slerp(this._alignQuat, 0.14);
    }
  }

  public getRoot(): THREE.Group {
    return this.root;
  }

  public dispose(): void {
    this.disposables.forEach((item) => item.dispose());

    if (this.footstepGroup) {
      this.scene.remove(this.footstepGroup);
    }

    this.scene.remove(this.root);
  }
}

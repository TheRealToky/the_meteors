import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getHeightAt } from './terrain';

// Visual life-stage scale mapping: newborn → youth → adult → elder
const STAGE_SCALE: Array<{ maxAge: number; scale: number }> = [
  { maxAge: 2,   scale: 0.65 }, // infant / newborn (small charming presence)
  { maxAge: 12,  scale: 0.82 }, // child / youth traveler
  { maxAge: 25,  scale: 1.0 },  // young adult
  { maxAge: 60,  scale: 1.04 }, // full adult
  { maxAge: 120, scale: 0.94 }, // elder traveler
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
 * Uses KayKit Rogue Hooded character with Rig_Medium skeletal animations (Walking, Idle, Death),
 * signature celestial glowing eyes, graceful life-stage transitions,
 * and glowing golden footstep motes that float along the Rwandan trail.
 */
export class CharacterRig {
  private curve: THREE.CatmullRomCurve3;
  private scene: THREE.Scene;
  private sex: 'male' | 'female';

  private root: THREE.Group = new THREE.Group();
  private modelRoot: THREE.Group = new THREE.Group();
  private proceduralBodyGroup: THREE.Group = new THREE.Group();

  // GLTF Animated Character Model & Mixer
  private mixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private deathAction: THREE.AnimationAction | null = null;
  private currentAction: THREE.AnimationAction | null = null;

  // Material tracking for dynamic gender recoloring
  private gltfClothingMeshes: THREE.Mesh[] = [];
  private gltfLimbMeshes: THREE.Mesh[] = [];
  private gltfEyeMaterial: THREE.MeshBasicMaterial | null = null;

  // Procedural fallback limbs & cape
  private capeMesh: THREE.Mesh | null = null;
  private capeOriginalPositions: Float32Array | null = null;
  private leftArm: THREE.Group = new THREE.Group();
  private rightArm: THREE.Group = new THREE.Group();
  private leftLeg: THREE.Group = new THREE.Group();
  private rightLeg: THREE.Group = new THREE.Group();
  private headGroup: THREE.Group = new THREE.Group();

  // Procedural material tracking
  private proceduralRobeMat: THREE.MeshStandardMaterial | null = null;
  private proceduralCapeMat: THREE.MeshStandardMaterial | null = null;
  private proceduralTrimMat: THREE.MeshBasicMaterial | null = null;
  private proceduralEyeMat: THREE.MeshBasicMaterial | null = null;

  // Footstep trail particles
  private footstepGroup: THREE.Points | null = null;
  private footstepPositions: Float32Array | null = null;
  private footstepAlphas: Float32Array | null = null;
  private footstepSpawnIndex: number = 0;
  private footstepTimer: number = 0;
  private footstepMaterial: THREE.ShaderMaterial | null = null;

  // Clean disposal tracking
  private disposables: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];

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

    this.root.add(this.modelRoot);
    this.scene.add(this.root);
  }

  public async load(): Promise<void> {
    const gltfLoaded = await this.loadGLTFCharacter();

    if (!gltfLoaded) {
      // Graceful fallback to procedural Sky traveler
      this.buildSkyTravelerFallback();
    }

    this.buildFootstepTrail();
    this.isLoaded = true;
    this.applySexColors();
    this.applyProgress(this.progress, true);
  }

  /**
   * Set character sex / gender and immediately update all visual materials
   * without modifying model shape, geometry, scale or animations.
   */
  public setSex(sex: 'male' | 'female'): void {
    this.sex = sex;
    this.applySexColors();
  }

  public getSex(): 'male' | 'female' {
    return this.sex;
  }

  /**
   * Applies the signature Pink (female) or Blue (male) palette across
   * the character's clothing, eyes, and footstep particles.
   */
  private applySexColors(): void {
    const isFemale = this.sex === 'female';

    // Pink (female) vs Blue (male) color tokens:
    // Rwandan CRVS palette aligned: Female #FB7185 / #FF6B8B, Male #38BDF8 / #4DA8DA
    const clothingColor = isFemale ? new THREE.Color('#fb7185') : new THREE.Color('#38bdf8');
    const clothingEmissive = isFemale ? new THREE.Color('#ff3366') : new THREE.Color('#0284c7');
    const limbColor = isFemale ? new THREE.Color('#ffb3c1') : new THREE.Color('#bae6fd');
    const limbEmissive = isFemale ? new THREE.Color('#ff6688') : new THREE.Color('#0ea5e9');
    const eyeColor = isFemale ? new THREE.Color('#ffd6e0') : new THREE.Color('#e0f2fe');
    const footstepColor = isFemale ? new THREE.Color('#fb7185') : new THREE.Color('#38bdf8');

    // 1. Update GLTF Clothing Meshes (Cape, Hood, Body)
    for (const mesh of this.gltfClothingMeshes) {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.copy(clothingColor);
        mesh.material.emissive.copy(clothingEmissive);
        mesh.material.emissiveIntensity = 0.22;
        mesh.material.needsUpdate = true;
      }
    }

    // 2. Update GLTF Limbs (Arms, Legs)
    for (const mesh of this.gltfLimbMeshes) {
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.copy(limbColor);
        mesh.material.emissive.copy(limbEmissive);
        mesh.material.emissiveIntensity = 0.10;
        mesh.material.needsUpdate = true;
      }
    }

    // 3. Update GLTF Eyes
    if (this.gltfEyeMaterial) {
      this.gltfEyeMaterial.color.copy(eyeColor);
      this.gltfEyeMaterial.needsUpdate = true;
    }

    // 4. Update Procedural Materials
    if (this.proceduralRobeMat) {
      this.proceduralRobeMat.color.copy(clothingColor);
      this.proceduralRobeMat.needsUpdate = true;
    }
    if (this.proceduralCapeMat) {
      this.proceduralCapeMat.color.copy(isFemale ? new THREE.Color('#f43f5e') : new THREE.Color('#0284c7'));
      this.proceduralCapeMat.needsUpdate = true;
    }
    if (this.proceduralTrimMat) {
      this.proceduralTrimMat.color.copy(isFemale ? new THREE.Color('#ffe4e6') : new THREE.Color('#e0f2fe'));
      this.proceduralTrimMat.needsUpdate = true;
    }
    if (this.proceduralEyeMat) {
      this.proceduralEyeMat.color.copy(eyeColor);
      this.proceduralEyeMat.needsUpdate = true;
    }

    // 5. Update Footstep Particle Motes
    if (this.footstepMaterial && this.footstepMaterial.uniforms?.uColor) {
      this.footstepMaterial.uniforms.uColor.value.copy(footstepColor);
    }
  }

  /**
   * Loads the KayKit Rogue Hooded model and binds skeletal animations from Rig_Medium.
   */
  private async loadGLTFCharacter(): Promise<boolean> {
    const loader = new GLTFLoader();

    try {
      // 1. Load Character Mesh and Rig Animations concurrently
      const [charGltf, animMoveGltf, animGenGltf] = await Promise.all([
        loader.loadAsync('/models/characters/Rogue_Hooded.glb'),
        loader.loadAsync('/models/characters/Rig_Medium_MovementBasic.glb'),
        loader.loadAsync('/models/characters/Rig_Medium_General.glb'),
      ]);

      const characterScene = charGltf.scene;
      // Scale model to ~1.7m tall (KayKit base height is ~2.17m)
      characterScene.scale.setScalar(0.78);

      this.gltfClothingMeshes = [];
      this.gltfLimbMeshes = [];

      // Enhance materials for soft stylized look and track clothing meshes for tinting
      characterScene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            // Clone so individual meshes can be uniquely colored
            const originalMat = Array.isArray(child.material) ? child.material[0] : child.material;
            const clonedMat = originalMat.clone() as THREE.Material;

            if (clonedMat instanceof THREE.MeshStandardMaterial) {
              clonedMat.roughness = 0.68;
              clonedMat.metalness = 0.04;
              if (clonedMat.map) {
                clonedMat.map.colorSpace = THREE.SRGBColorSpace;
              }
            }
            child.material = clonedMat;
            this.disposables.push(clonedMat);

            const name = child.name;
            if (name.includes('Cape') || name.includes('Head') || name.includes('Body')) {
              this.gltfClothingMeshes.push(child);
            } else if (name.includes('Arm') || name.includes('Leg')) {
              this.gltfLimbMeshes.push(child);
            }
          }
          if (child.geometry) {
            child.geometry.computeVertexNormals();
            this.disposables.push(child.geometry);
          }
        }
      });

      // Find the head bone to attach glowing celestial eyes
      let headBone: THREE.Object3D | null = null;
      characterScene.traverse((node) => {
        if (node.name === 'head') {
          headBone = node;
        }
      });

      if (headBone) {
        const eyeGeo = new THREE.SphereGeometry(0.042, 8, 8);
        this.disposables.push(eyeGeo);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.disposables.push(eyeMat);
        this.gltfEyeMaterial = eyeMat;

        const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
        leftEye.position.set(-0.065, 0.09, 0.19);
        (headBone as THREE.Object3D).add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
        rightEye.position.set(0.065, 0.09, 0.19);
        (headBone as THREE.Object3D).add(rightEye);
      }

      // Setup Animation Mixer
      this.mixer = new THREE.AnimationMixer(characterScene);

      // Find clips
      const moveAnimations = animMoveGltf.animations || [];
      const genAnimations = animGenGltf.animations || [];

      const walkClip = moveAnimations.find((a) => a.name === 'Walking_B' || a.name === 'Walking_A') || moveAnimations[0];
      const idleClip = genAnimations.find((a) => a.name === 'Idle_A' || a.name === 'Idle_B') || genAnimations[0];
      const deathClip = genAnimations.find((a) => a.name === 'Death_A' || a.name === 'Death_B');

      if (walkClip) {
        this.walkAction = this.mixer.clipAction(walkClip);
        this.walkAction.setEffectiveTimeScale(1.05);
      }
      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setEffectiveTimeScale(0.85);
      }
      if (deathClip) {
        this.deathAction = this.mixer.clipAction(deathClip);
        this.deathAction.setLoop(THREE.LoopOnce, 1);
        this.deathAction.clampWhenFinished = true;
      }

      // Initial state: play idle
      if (this.idleAction) {
        this.idleAction.play();
        this.currentAction = this.idleAction;
      }

      this.modelRoot.add(characterScene);
      this.applySexColors();
      return true;
    } catch (err) {
      console.warn('[CharacterRig] Failed to load GLTF character model, falling back to procedural:', err);
      return false;
    }
  }

  /**
   * Procedural Sky: Children of the Light traveler fallback.
   */
  private buildSkyTravelerFallback(): void {
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.02,
      flatShading: false,
    });
    this.disposables.push(robeMat);
    this.proceduralRobeMat = robeMat;

    const cowlMat = new THREE.MeshStandardMaterial({
      color: 0x282329,
      roughness: 0.85,
      metalness: 0.0,
      flatShading: false,
    });
    this.disposables.push(cowlMat);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.disposables.push(eyeMat);
    this.proceduralEyeMat = eyeMat;

    const capeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.65,
      metalness: 0.04,
      side: THREE.DoubleSide,
      flatShading: false,
    });
    this.disposables.push(capeMat);
    this.proceduralCapeMat = capeMat;

    const trimMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    this.disposables.push(trimMat);
    this.proceduralTrimMat = trimMat;

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x9e6c4c,
      roughness: 0.8,
      metalness: 0.0,
      flatShading: false,
    });
    this.disposables.push(skinMat);

    // 1. Torso
    const torsoGeo = new THREE.CylinderGeometry(0.24, 0.38, 0.95, 16);
    this.disposables.push(torsoGeo);
    const torsoMesh = new THREE.Mesh(torsoGeo, robeMat);
    torsoMesh.position.y = 0.85;
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.proceduralBodyGroup.add(torsoMesh);

    // 2. Head with Cowl & Glowing Eyes
    const headGeo = new THREE.SphereGeometry(0.26, 16, 16);
    this.disposables.push(headGeo);
    const headMesh = new THREE.Mesh(headGeo, robeMat);
    headMesh.castShadow = true;

    const faceGeo = new THREE.SphereGeometry(0.22, 12, 12, 0, Math.PI);
    this.disposables.push(faceGeo);
    const faceMesh = new THREE.Mesh(faceGeo, cowlMat);
    faceMesh.rotation.y = -Math.PI / 2;
    faceMesh.position.set(0, 0, 0.06);
    headMesh.add(faceMesh);

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
    this.proceduralBodyGroup.add(this.headGroup);

    // 3. Flowing Cape
    const capeWidth = 0.95;
    const capeLength = 1.15;
    const capeGeo = new THREE.PlaneGeometry(capeWidth, capeLength, 10, 14);
    this.disposables.push(capeGeo);

    const posAttr = capeGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const u = posAttr.getX(i);
      const v = posAttr.getY(i);
      const curveZ = -Math.pow(u / (capeWidth * 0.5), 2) * 0.12;
      posAttr.setZ(i, curveZ);
      if (v > 0) {
        posAttr.setX(i, u * (0.6 + (0.4 * (1.0 - v / (capeLength * 0.5)))));
      }
    }
    capeGeo.computeVertexNormals();
    this.capeOriginalPositions = new Float32Array(posAttr.array);

    this.capeMesh = new THREE.Mesh(capeGeo, capeMat);
    this.capeMesh.position.set(0, 1.25, -0.22);
    this.capeMesh.rotation.x = 0.15;
    this.capeMesh.castShadow = true;
    this.proceduralBodyGroup.add(this.capeMesh);

    const trimGeo = new THREE.PlaneGeometry(capeWidth * 0.95, 0.06);
    this.disposables.push(trimGeo);
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(0, -capeLength * 0.48, 0.02);
    this.capeMesh.add(trimMesh);

    // 4. Arms
    const armGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.55, 10);
    this.disposables.push(armGeo);

    const leftArmMesh = new THREE.Mesh(armGeo, robeMat);
    leftArmMesh.position.y = -0.24;
    leftArmMesh.castShadow = true;
    this.leftArm.position.set(-0.32, 1.25, 0);
    this.leftArm.add(leftArmMesh);
    this.proceduralBodyGroup.add(this.leftArm);

    const rightArmMesh = new THREE.Mesh(armGeo, robeMat);
    rightArmMesh.position.y = -0.24;
    rightArmMesh.castShadow = true;
    this.rightArm.position.set(0.32, 1.25, 0);
    this.rightArm.add(rightArmMesh);
    this.proceduralBodyGroup.add(this.rightArm);

    // 5. Legs
    const legGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.5, 10);
    this.disposables.push(legGeo);

    const leftLegMesh = new THREE.Mesh(legGeo, skinMat);
    leftLegMesh.position.y = -0.22;
    leftLegMesh.castShadow = true;
    this.leftLeg.position.set(-0.13, 0.45, 0);
    this.leftLeg.add(leftLegMesh);
    this.proceduralBodyGroup.add(this.leftLeg);

    const rightLegMesh = new THREE.Mesh(legGeo, skinMat);
    rightLegMesh.position.y = -0.22;
    rightLegMesh.castShadow = true;
    this.rightLeg.position.set(0.13, 0.45, 0);
    this.rightLeg.add(rightLegMesh);
    this.proceduralBodyGroup.add(this.rightLeg);

    this.modelRoot.add(this.proceduralBodyGroup);
  }

  /**
   * Footstep glowing dust motes that float behind the character.
   */
  private buildFootstepTrail(): void {
    const count = 40;
    this.footstepPositions = new Float32Array(count * 3);
    this.footstepAlphas    = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.footstepPositions[i * 3 + 0] = 0;
      this.footstepPositions[i * 3 + 1] = -100; // hidden initially
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
        uColor: { value: new THREE.Color(0xffe6a3) },
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
          gl_PointSize = (26.0 / -mvPos.z) * uPixelRatio * 28.0;
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
    this.footstepMaterial = mat;

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
    if (this.isMoving === moving) return;
    this.isMoving = moving;

    // Cross-fade animation actions
    if (this.mixer) {
      if (moving && this.walkAction) {
        if (this.currentAction && this.currentAction !== this.walkAction) {
          this.currentAction.fadeOut(0.2);
        }
        this.walkAction.reset().fadeIn(0.2).play();
        this.currentAction = this.walkAction;
      } else if (!moving && this.idleAction) {
        if (this.currentAction && this.currentAction !== this.idleAction) {
          this.currentAction.fadeOut(0.25);
        }
        this.idleAction.reset().fadeIn(0.25).play();
        this.currentAction = this.idleAction;
      }
    }
  }

  public playDeath(): void {
    if (this.mixer && this.deathAction) {
      if (this.currentAction) {
        this.currentAction.fadeOut(0.4);
      }
      this.deathAction.reset().fadeIn(0.4).play();
      this.currentAction = this.deathAction;
    }
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

    // 1. Update Skeletal Animation or Procedural Stride
    if (this.mixer) {
      this.mixer.update(dt);
    } else {
      // Procedural walk/idle fallback
      if (this.isMoving) {
        this.walkCycleTime += dt * 8.5;
      } else {
        this.walkCycleTime += dt * 2.2;
      }

      const t = this.walkCycleTime;
      if (this.isMoving) {
        const stride = Math.sin(t);
        this.leftLeg.rotation.x  = stride * 0.55;
        this.rightLeg.rotation.x = -stride * 0.55;
        this.leftArm.rotation.x  = -stride * 0.45;
        this.rightArm.rotation.x = stride * 0.45;
        this.proceduralBodyGroup.position.y = Math.abs(Math.sin(t)) * 0.08;
        this.proceduralBodyGroup.rotation.y = Math.sin(t * 0.5) * 0.05;
        this.headGroup.rotation.x = -0.05;
      } else {
        const breath = Math.sin(t);
        this.leftLeg.rotation.x = THREE.MathUtils.lerp(this.leftLeg.rotation.x, 0, 0.15);
        this.rightLeg.rotation.x = THREE.MathUtils.lerp(this.rightLeg.rotation.x, 0, 0.15);
        this.leftArm.rotation.x = THREE.MathUtils.lerp(this.leftArm.rotation.x, 0.1, 0.15);
        this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, 0.1, 0.15);
        this.proceduralBodyGroup.position.y = breath * 0.025;
        this.proceduralBodyGroup.rotation.y = THREE.MathUtils.lerp(this.proceduralBodyGroup.rotation.y, 0, 0.1);
        this.headGroup.rotation.x = THREE.MathUtils.lerp(this.headGroup.rotation.x, breath * 0.02, 0.1);
      }

      // Cape flutter simulation
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

    // 2. Footstep Glowing Trail Motes
    if (this.footstepGroup && this.footstepPositions && this.footstepAlphas) {
      const count = this.footstepAlphas.length;
      let needsUpdate = false;

      // Spawn motes while moving along path
      if (this.isMoving) {
        this.footstepTimer += dt;
        if (this.footstepTimer > 0.14) {
          this.footstepTimer = 0;
          const idx = this.footstepSpawnIndex;
          this.footstepPositions[idx * 3 + 0] = this.root.position.x + (Math.random() - 0.5) * 0.25;
          this.footstepPositions[idx * 3 + 1] = this.root.position.y + 0.12 + Math.random() * 0.15;
          this.footstepPositions[idx * 3 + 2] = this.root.position.z + (Math.random() - 0.5) * 0.25;
          this.footstepAlphas[idx] = 0.95;
          this.footstepSpawnIndex = (this.footstepSpawnIndex + 1) % count;
          needsUpdate = true;
        }
      }

      // Drift upward and fade out
      for (let i = 0; i < count; i++) {
        if (this.footstepAlphas[i] > 0.01) {
          this.footstepAlphas[i] -= dt * 0.65;
          this.footstepPositions[i * 3 + 1] += dt * 0.22; // gently float up
          needsUpdate = true;
        } else {
          this.footstepAlphas[i] = 0;
        }
      }

      if (needsUpdate) {
        const geo = this.footstepGroup.geometry;
        (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      }
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
    if (this.mixer) {
      this.mixer.stopAllAction();
    }

    this.disposables.forEach((item) => item.dispose());

    if (this.footstepGroup) {
      this.scene.remove(this.footstepGroup);
    }

    this.scene.remove(this.root);
  }
}

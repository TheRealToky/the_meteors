import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getHeightAt } from './terrain';

// Visual life-stage scale mapping: child → teen → adult
// Day 3 growing-up scene will tween these smoothly
const STAGE_SCALE: Array<{ maxAge: number; scale: number }> = [
  { maxAge: 4,  scale: 0.52 }, // infant / toddler
  { maxAge: 12, scale: 0.72 }, // child
  { maxAge: 17, scale: 0.88 }, // teen
  { maxAge: 25, scale: 1.00 }, // young adult
  { maxAge: 60, scale: 1.00 }, // adult
  { maxAge: 120, scale: 0.95 }, // elder (slight stoop)
];

function scaleForAge(age: number): number {
  for (const entry of STAGE_SCALE) {
    if (age <= entry.maxAge) return entry.scale;
  }
  return STAGE_SCALE[STAGE_SCALE.length - 1].scale;
}

export interface CharacterRigConfig {
  /** CatmullRomCurve3 the character walks along */
  curve: THREE.CatmullRomCurve3;
  /** THREE.Scene to add the rig into */
  scene: THREE.Scene;
  /** 'male' | 'female' selects the correct CC0 Kenney GLB */
  sex?: 'male' | 'female';
}

export class CharacterRig {
  private curve: THREE.CatmullRomCurve3;
  private scene: THREE.Scene;
  private sex: 'male' | 'female';

  private root: THREE.Group = new THREE.Group();
  private modelRoot: THREE.Group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private isLoaded: boolean = false;

  // Progress along the rail [0..1], owned by Director
  private progress: number = 0;
  private isMoving: boolean = false;
  // Cached vectors — no allocations in update()
  private _pathPoint   = new THREE.Vector3();
  private _pathTangent = new THREE.Vector3();
  // _upVector is used via new Vector3(0,1,0) inline to avoid allocations at module level
  private _alignQuat   = new THREE.Quaternion();

  constructor(config: CharacterRigConfig) {
    this.curve = config.curve;
    this.scene = config.scene;
    this.sex   = config.sex ?? 'female';

    this.root.add(this.modelRoot);
    this.scene.add(this.root);
  }

  /**
   * Async loader. Tries the CC0 Kenney GLB; falls back to a capsule placeholder.
   */
  async load(): Promise<void> {
    const modelPath = this.sex === 'male'
      ? '/models/character-male-a.glb'
      : '/models/character-female-a.glb';

    try {
      const loader = new GLTFLoader();
      const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
        loader.load(modelPath, (g) => resolve(g as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] }), undefined, reject);
      });

      // Override all materials to match the low-poly flat-shaded project style
      gltf.scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = false;
          // Flat-shade to match terrain / assets visual style (CLAUDE.md)
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m: THREE.Material) => {
              (m as THREE.MeshStandardMaterial).flatShading = true;
              m.needsUpdate = true;
            });
          } else {
            (mesh.material as THREE.MeshStandardMaterial).flatShading = true;
            mesh.material.needsUpdate = true;
          }
        }
      });

      this.modelRoot.add(gltf.scene);

      // Wire up AnimationMixer if the GLB has clips
      if (gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(gltf.scene);

        // Walk clip: prefer a clip named "Walk", fall back to clip index 0
        const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walk')
          || THREE.AnimationClip.findByName(gltf.animations, 'walk')
          || gltf.animations[0];

        this.walkAction = this.mixer.clipAction(walkClip);
        this.walkAction.setLoop(THREE.LoopRepeat, Infinity);

        // Idle clip: prefer "Idle", fall back to same clip at a slow time scale
        const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle')
          || THREE.AnimationClip.findByName(gltf.animations, 'idle')
          || gltf.animations[Math.min(1, gltf.animations.length - 1)];

        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity);

        this.idleAction.play();
      }

      this.isLoaded = true;
    } catch (_err) {
      // GLB not available — build a simple capsule placeholder with the same interface
      console.warn('[CharacterRig] GLB load failed, using capsule placeholder. See ATTRIBUTION.md.');
      this.buildPlaceholder();
    }

    // Snap immediately to current progress
    this.applyProgress(this.progress, true);
  }

  /** Builds a recognisable placeholder so plumbing is testable without assets. */
  private buildPlaceholder(): void {
    const bodyGeo  = new THREE.CapsuleGeometry(0.22, 0.75, 4, 8);
    const headGeo  = new THREE.SphereGeometry(0.22, 6, 6);
    const mat      = new THREE.MeshStandardMaterial({
      color: this.sex === 'male' ? 0x38bdf8 : 0xfb7185,
      flatShading: true,
      roughness: 0.8,
    });

    const body = new THREE.Mesh(bodyGeo, mat);
    body.position.y = 0.6;
    body.castShadow = true;

    const head = new THREE.Mesh(headGeo, mat);
    head.position.y = 1.35;
    head.castShadow = true;

    this.modelRoot.add(body, head);
    this.isLoaded = true;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Set normalised rail progress [0..1].
   * Director owns this value; CharacterRig only reads it.
   */
  public setProgress(t: number): void {
    this.progress = THREE.MathUtils.clamp(t, 0, 1);
    if (this.isLoaded) {
      this.applyProgress(this.progress, false);
    }
  }

  /** Switch walk / idle animation states. */
  public setMoving(moving: boolean): void {
    if (this.isMoving === moving) return;
    this.isMoving = moving;

    if (!this.mixer) return;

    if (moving) {
      this.idleAction?.fadeOut(0.25);
      this.walkAction?.reset().fadeIn(0.25).play();
    } else {
      this.walkAction?.fadeOut(0.25);
      this.idleAction?.reset().fadeIn(0.25).play();
    }
  }

  /**
   * Scales the model to represent the current life stage.
   * Called once on scene enter; Day 3 scene will tween this live.
   */
  public setLifeStage(age: number): void {
    const s = scaleForAge(age);
    this.modelRoot.scale.setScalar(s);
  }

  // -------------------------------------------------------------------------
  // Per-frame update — ZERO allocations
  // -------------------------------------------------------------------------

  public update(dt: number): void {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private applyProgress(t: number, snap: boolean): void {
    const clamped = THREE.MathUtils.clamp(t, 0, 1);

    // 1. Position from curve
    this.curve.getPointAt(clamped, this._pathPoint);

    // 2. Snap Y to terrain (same noise function, no raycast)
    this._pathPoint.y = getHeightAt(this._pathPoint.x, this._pathPoint.z) + 0.02;

    this.root.position.copy(this._pathPoint);

    // 3. Orientation: face along tangent, smoothed with slerp
    const epsilon = 0.001; // avoid degenerate tangent at endpoints
    this.curve.getTangentAt(
      THREE.MathUtils.clamp(clamped + epsilon, 0, 1),
      this._pathTangent
    );
    this._pathTangent.y = 0; // keep character upright
    this._pathTangent.normalize();

    // Quaternion pointing in the +Z-forward convention
    this._alignQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this._pathTangent);

    if (snap) {
      this.root.quaternion.copy(this._alignQuat);
    } else {
      // Slerp for smooth turning (0.12 per frame ≈ ~4–5 frame settling at 60 fps)
      this.root.quaternion.slerp(this._alignQuat, 0.12);
    }
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  public getRoot(): THREE.Group {
    return this.root;
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }

    this.walkAction = null;
    this.idleAction = null;

    // Dispose geometries and materials in the model tree
    this.modelRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          (mesh.material as THREE.Material)?.dispose();
        }
      }
    });

    while (this.modelRoot.children.length > 0) {
      this.modelRoot.remove(this.modelRoot.children[0]);
    }

    this.scene.remove(this.root);
    while (this.root.children.length > 0) {
      this.root.remove(this.root.children[0]);
    }
  }
}

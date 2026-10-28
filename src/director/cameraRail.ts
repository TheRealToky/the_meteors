import * as THREE from 'three';
import gsap from 'gsap';
import { STATION_COORDINATES } from '../world/path';
import { getHeightAt } from '../world/terrain';

export interface StationCameraPose {
  t: number;
  camOffset: THREE.Vector3;
  lookOffset: THREE.Vector3;
}

export class CameraRail {
  private groundCurve: THREE.CatmullRomCurve3;
  private camera: THREE.PerspectiveCamera;
  private progress: number = 0;

  // Cached vector math objects to avoid per-frame allocations
  private currentCamPos = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();
  private targetCamPos = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private pathPoint = new THREE.Vector3();
  private pathTangent = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  // Active GSAP tween
  private currentTween: gsap.core.Tween | null = null;

  constructor(camera: THREE.PerspectiveCamera, groundCurve: THREE.CatmullRomCurve3) {
    this.camera = camera;
    this.groundCurve = groundCurve;
    this.init();
  }

  private init(): void {
    this.evaluateTargetPose(0, this.currentCamPos, this.currentLookAt);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * Computes the ideal camera position and lookAt point for a given progress t in [0, 1].
   * Framed cinematically to showcase both the traveler and the panoramic Rwandan landscape.
   */
  public evaluateTargetPose(
    t: number,
    outCamPos: THREE.Vector3,
    outLookAt: THREE.Vector3
  ): void {
    const clampedT = THREE.MathUtils.clamp(t, 0, 1);
    this.groundCurve.getPointAt(clampedT, this.pathPoint);
    this.groundCurve.getTangentAt(clampedT, this.pathTangent).normalize();

    // Side normal vector (perpendicular to path)
    const sideNormal = new THREE.Vector3().crossVectors(this.pathTangent, this.up).normalize();

    // Intimate, cinematic 3/4 perspective (Sky: Children of the Light style)
    const elevation = 2.4;
    const distanceBehind = 6.2;
    const sideOffset = 2.2;

    outCamPos.copy(this.pathPoint)
      .addScaledVector(this.pathTangent, -distanceBehind)
      .addScaledVector(sideNormal, sideOffset);
    outCamPos.y = this.pathPoint.y + elevation;

    // Soft terrain clearance: avoid clipping through local slope while preserving horizon
    const terrainHeight = getHeightAt(outCamPos.x, outCamPos.z);
    if (outCamPos.y < terrainHeight + 1.2) {
      outCamPos.y = terrainHeight + 1.2;
    }

    // Look forward along the path towards the rolling horizon
    outLookAt.copy(this.pathPoint)
      .addScaledVector(this.pathTangent, 4.8);
    outLookAt.y = this.pathPoint.y + 1.4;
  }

  public setProgress(t: number): void {
    this.progress = THREE.MathUtils.clamp(t, 0, 1);
    this.evaluateTargetPose(this.progress, this.currentCamPos, this.currentLookAt);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
  }

  public getProgress(): number {
    return this.progress;
  }

  /**
   * Animates camera smoothly along the rail using GSAP.
   */
  public animateTo(
    targetT: number,
    duration = 2.4,
    ease = 'power2.inOut',
    onComplete?: () => void
  ): gsap.core.Tween {
    if (this.currentTween) {
      this.currentTween.kill();
    }

    const state = { t: this.progress };
    this.currentTween = gsap.to(state, {
      t: targetT,
      duration,
      ease,
      onUpdate: () => {
        this.progress = state.t;
      },
      onComplete: () => {
        this.currentTween = null;
        if (onComplete) onComplete();
      },
    });

    return this.currentTween;
  }

  /**
   * Frame update with gentle camera damping for natural motion.
   */
  public update(dt: number): void {
    this.evaluateTargetPose(this.progress, this.targetCamPos, this.targetLookAt);

    // Smooth lerp camera to target pose
    const damping = Math.min(dt * 6.0, 1.0);
    this.currentCamPos.lerp(this.targetCamPos, damping);
    this.currentLookAt.lerp(this.targetLookAt, damping);

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * Helper to look up station t value by ID
   */
  public getStationT(sceneId: string): number {
    const found = STATION_COORDINATES.find((s) => s.id === sceneId);
    return found ? found.t : 0;
  }

  public dispose(): void {
    if (this.currentTween) {
      this.currentTween.kill();
      this.currentTween = null;
    }
  }
}

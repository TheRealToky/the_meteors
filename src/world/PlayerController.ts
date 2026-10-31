import * as THREE from 'three';
import gsap from 'gsap';
import { CameraRail } from '../director/cameraRail';
import { CharacterRig } from './CharacterRig';
import { Milestone, MILESTONES } from './milestones';

export interface PlayerControllerOptions {
  curve: THREE.CatmullRomCurve3;
  cameraRail: CameraRail;
  characterRig: CharacterRig;
  getHeight?: (x: number, z: number) => number;
  onMilestoneReached?: (milestone: Milestone) => void;
  onProgressChange?: (progress: number) => void;
}

export class PlayerController {
  private curve: THREE.CatmullRomCurve3;
  private cameraRail: CameraRail;
  private characterRig: CharacterRig;

  private progress: number = 0;
  private velocity: number = 0;
  private maxSpeed: number = 0.042; // progress units per second (~4-5 sec between stations)
  private acceleration: number = 10.0;
  private damping: number = 8.0;

  private isLocked: boolean = false;
  private isGliding: boolean = false;
  private glideTween: gsap.core.Tween | null = null;

  // Active milestone tracking
  private activeMilestone: Milestone | null = null;
  private hasTriggeredActive: boolean = false;
  private onMilestoneReachedCallback?: (milestone: Milestone) => void;
  private onProgressChangeCallback?: (progress: number) => void;

  // Key states
  private keys = {
    forward: false,
    backward: false,
  };

  // Pre-allocated vectors for distance calculation
  private _charPos = new THREE.Vector3();

  // Listeners
  private keyDownHandler: (e: KeyboardEvent) => void;
  private keyUpHandler: (e: KeyboardEvent) => void;

  constructor(options: PlayerControllerOptions) {
    this.curve = options.curve;
    this.cameraRail = options.cameraRail;
    this.characterRig = options.characterRig;
    this.onMilestoneReachedCallback = options.onMilestoneReached;
    this.onProgressChangeCallback = options.onProgressChange;

    this.progress = this.cameraRail.getProgress();

    // Default to first milestone (Birth)
    this.activeMilestone = MILESTONES[0];

    // Wire keyboard event handlers
    this.keyDownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.keyUpHandler = (e: KeyboardEvent) => this.handleKeyUp(e);

    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore input if typing in an input or textarea
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      this.keys.forward = true;
    } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      this.keys.backward = true;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      this.keys.forward = false;
    } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      this.keys.backward = false;
    }
  }

  public lock(): void {
    this.isLocked = true;
    this.keys.forward = false;
    this.keys.backward = false;
    this.velocity = 0;
    this.characterRig.setMoving(false);
  }

  public unlock(): void {
    this.isLocked = false;
  }

  public isInputLocked(): boolean {
    return this.isLocked || this.isGliding;
  }

  public setActiveMilestone(milestone: Milestone | null): void {
    this.activeMilestone = milestone;
    this.hasTriggeredActive = false;
  }

  public getActiveMilestone(): Milestone | null {
    return this.activeMilestone;
  }

  public getProgress(): number {
    return this.progress;
  }

  public setProgress(t: number): void {
    this.progress = THREE.MathUtils.clamp(t, 0, 1);
    this.velocity = 0;
    this.characterRig.setProgress(this.progress);
    this.cameraRail.setProgress(this.progress);
  }

  /**
   * Smoothly slides the player to a target progress t (e.g. when clicking station buttons).
   */
  public glideTo(targetT: number, duration = 2.2, onComplete?: () => void): void {
    if (this.glideTween) {
      this.glideTween.kill();
    }

    this.isGliding = true;
    const clampedT = THREE.MathUtils.clamp(targetT, 0, 1);
    const state = { t: this.progress };

    this.glideTween = gsap.to(state, {
      t: clampedT,
      duration,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.progress = state.t;
        this.characterRig.setProgress(this.progress);
        this.cameraRail.setProgress(this.progress);
        if (this.onProgressChangeCallback) {
          this.onProgressChangeCallback(this.progress);
        }
      },
      onComplete: () => {
        this.progress = clampedT;
        this.isGliding = false;
        this.glideTween = null;
        this.characterRig.setMoving(false);
        if (onComplete) onComplete();
      },
    });
  }

  /**
   * Calculates current distance (in meters) to the active milestone house.
   */
  public getDistanceToActiveMilestone(): number {
    if (!this.activeMilestone) return 0;
    this.curve.getPointAt(this.progress, this._charPos);
    
    // Distance in XZ plane
    const dx = this._charPos.x - this.activeMilestone.housePosition.x;
    const dz = this._charPos.z - this.activeMilestone.housePosition.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Main per-frame physics & input update.
   */
  public update(dt: number): void {
    if (this.isGliding) return;

    // 1. Process movement inputs if not locked
    let inputDir = 0;
    if (!this.isLocked) {
      if (this.keys.forward) inputDir += 1;
      if (this.keys.backward) inputDir -= 1;
    }

    // 2. Accelerate or damp velocity
    if (inputDir !== 0) {
      const targetVel = inputDir * this.maxSpeed;
      this.velocity = THREE.MathUtils.lerp(this.velocity, targetVel, Math.min(dt * this.acceleration, 1.0));
    } else {
      this.velocity = THREE.MathUtils.lerp(this.velocity, 0, Math.min(dt * this.damping, 1.0));
      if (Math.abs(this.velocity) < 0.0001) {
        this.velocity = 0;
      }
    }

    // 3. Advance progress
    if (this.velocity !== 0) {
      const prev = this.progress;
      this.progress = THREE.MathUtils.clamp(this.progress + this.velocity * dt, 0, 1);
      
      if (Math.abs(this.progress - prev) > 0.00001) {
        // Update character and camera
        this.characterRig.setProgress(this.progress);
        this.cameraRail.setProgress(this.progress);

        if (this.onProgressChangeCallback) {
          this.onProgressChangeCallback(this.progress);
        }
      }
    } else if (!this.isLocked) {
      this.characterRig.setMoving(false);
    }

    // 4. Proximity detection for active milestone
    if (this.activeMilestone && !this.hasTriggeredActive && !this.isLocked) {
      const dist = this.getDistanceToActiveMilestone();
      const progressDiff = Math.abs(this.progress - this.activeMilestone.pathT);

      // Trigger if within triggerRadius OR closely aligned along path
      if (dist <= this.activeMilestone.triggerRadius || progressDiff <= 0.016) {
        this.hasTriggeredActive = true;
        this.lock();
        if (this.onMilestoneReachedCallback) {
          this.onMilestoneReachedCallback(this.activeMilestone);
        }
      }
    }
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
    if (this.glideTween) {
      this.glideTween.kill();
      this.glideTween = null;
    }
  }
}

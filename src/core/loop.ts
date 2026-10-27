import * as THREE from 'three';

export type TickCallback = (dt: number, elapsed: number) => void;

export class AnimationLoop {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private callbacks: Set<TickCallback> = new Set();
  private isRunning: boolean = false;
  private beforeRenderHooks: Array<() => void> = [];
  private afterRenderHooks: Array<() => void> = [];

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.clock = new THREE.Clock(false);
  }

  public addCallback(cb: TickCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  public removeCallback(cb: TickCallback): void {
    this.callbacks.delete(cb);
  }

  public addBeforeRenderHook(hook: () => void): void {
    this.beforeRenderHooks.push(hook);
  }

  public addAfterRenderHook(hook: () => void): void {
    this.afterRenderHooks.push(hook);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();

    this.renderer.setAnimationLoop((_time) => {
      // Delta time capped at 0.1s to prevent huge physics/camera leaps when tab is inactive
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.1);
      const elapsed = this.clock.getElapsedTime();

      // Run registered frame updates
      for (const cb of this.callbacks) {
        cb(dt, elapsed);
      }

      for (const hook of this.beforeRenderHooks) {
        hook();
      }

      this.renderer.render(this.scene, this.camera);

      for (const hook of this.afterRenderHooks) {
        hook();
      }
    });
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.clock.stop();
    this.renderer.setAnimationLoop(null);
  }
}

import { SceneBase, SceneContext, SceneId } from '../director/types';

export abstract class BaseScene implements SceneBase {
  abstract id: SceneId;
  protected ctx: SceneContext | null = null;
  protected isLoaded: boolean = false;

  async load(): Promise<void> {
    this.isLoaded = true;
  }

  async enter(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
  }

  update(_dt: number, _elapsed: number): void {
    // Override in derived classes
  }

  async exit(): Promise<void> {
    this.ctx = null;
  }

  onLanguageChange(): void {
    // Override in derived classes to re-render strings without restarting
  }

  dispose(): void {
    // Override in derived classes to clean up GPU resources and tweens
  }
}

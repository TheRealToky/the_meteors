import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';

export class OutroScene extends BaseScene {
  id: SceneId = 'outro';
  private group: THREE.Group = new THREE.Group();

  async load(): Promise<void> {
    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);
    ctx.scene.add(this.group);
  }

  update(_dt: number, _elapsed: number): void {}

  async exit(): Promise<void> {
    if (this.ctx) {
      this.ctx.scene.remove(this.group);
    }
    await super.exit();
  }

  dispose(): void {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}

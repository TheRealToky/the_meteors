import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { PopulationPyramid, PyramidData } from '../ui/PopulationPyramid';

export class IntroScene extends BaseScene {
  id: SceneId = 'intro';
  private group: THREE.Group = new THREE.Group();
  private pyramidData: PyramidData | null = null;
  private pyramid: PopulationPyramid | null = null;

  async load(): Promise<void> {
    if (this.pyramidData) return;

    try {
      const response = await fetch('/data/intro.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading /data/intro.json`);
      }
      this.pyramidData = await response.json();
    } catch (err) {
      console.error('[IntroScene] Failed to load /data/intro.json:', err);
    }

    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);
    ctx.scene.add(this.group);

    if (this.pyramidData && ctx.uiContainer) {
      // Clear container and mount D3 population pyramid
      ctx.uiContainer.innerHTML = '';
      this.pyramid = new PopulationPyramid({
        data: this.pyramidData,
        container: ctx.uiContainer,
        selectedSex: ctx.state.sex,
        onSelectSex: (sex) => {
          ctx.updateState({ sex });
        },
        onStart: () => {
          ctx.goToScene('birth');
        },
      });
    }
  }

  update(_dt: number, _elapsed: number): void {
    // Subtle rotation or 3D world animation if needed
  }

  onLanguageChange(): void {
    if (this.pyramid) {
      this.pyramid.updateLanguage();
    }
  }

  async exit(): Promise<void> {
    if (this.ctx) {
      this.ctx.scene.remove(this.group);
      if (this.ctx.uiContainer) {
        this.ctx.uiContainer.innerHTML = '';
      }
    }
    if (this.pyramid) {
      this.pyramid.dispose();
      this.pyramid = null;
    }
    await super.exit();
  }

  dispose(): void {
    if (this.pyramid) {
      this.pyramid.dispose();
      this.pyramid = null;
    }
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
  }
}

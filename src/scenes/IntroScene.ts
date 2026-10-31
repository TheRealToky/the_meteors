import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { StartScreen } from '../ui/StartScreen';
import { setLanguage } from '../i18n';

export class IntroScene extends BaseScene {
  id: SceneId = 'intro';
  private group: THREE.Group = new THREE.Group();
  private startScreen: StartScreen | null = null;
  private cameraTween: gsap.core.Tween | null = null;

  // Cached vector objects to avoid per-frame allocations
  private targetCamPos = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);
    ctx.scene.add(this.group);

    // Initial overview camera position and descent
    const cam = ctx.camera;
    ctx.cameraRail.evaluateTargetPose(0, this.targetCamPos, this.targetLookAt);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      cam.position.copy(this.targetCamPos);
      cam.lookAt(this.targetLookAt);
    } else {
      cam.position.set(-70, 80, -60);
      cam.lookAt(this.targetLookAt);
      this.cameraTween = gsap.to(cam.position, {
        x: this.targetCamPos.x,
        y: this.targetCamPos.y,
        z: this.targetCamPos.z,
        duration: 2.5,
        ease: 'power2.inOut',
        onUpdate: () => {
          cam.lookAt(this.targetLookAt);
        },
      });
    }

    if (ctx.uiContainer) {
      ctx.uiContainer.innerHTML = '';
      this.startScreen = new StartScreen({
        container: ctx.uiContainer,
        initialState: ctx.state,
        onSexChange: (sex) => {
          ctx.updateState({ sex });
          window.dispatchEvent(new CustomEvent('lifepath:setSex', { detail: { sex } }));
        },
        onStart: (lang, sex) => {
          ctx.updateState({ lang, sex });
          window.dispatchEvent(new CustomEvent('lifepath:setSex', { detail: { sex } }));
          setLanguage(lang).then(() => {
            if (ctx.uiContainer) {
              ctx.uiContainer.innerHTML = '';
            }
            window.dispatchEvent(new CustomEvent('lifepath:walkToMilestone', { detail: { id: 'birth' } }));
          });
        },
        onLanguageChange: async (lang) => {
          await setLanguage(lang);
          ctx.updateState({ lang });
          this.startScreen?.updateLabels();
        },
      });
    }
  }

  update(_dt: number, _elapsed: number): void {
    // Subtle rotation or 3D world animation if needed
  }

  onLanguageChange(): void {
    if (this.startScreen) {
      this.startScreen.updateLabels();
    }
  }

  async exit(): Promise<void> {
    if (this.cameraTween) {
      this.cameraTween.kill();
      this.cameraTween = null;
    }
    if (this.startScreen) {
      this.startScreen.dispose();
      this.startScreen = null;
    }
    if (this.ctx) {
      this.ctx.scene.remove(this.group);
      if (this.ctx.uiContainer) {
        this.ctx.uiContainer.innerHTML = '';
      }
    }
    await super.exit();
  }

  dispose(): void {
    if (this.cameraTween) {
      this.cameraTween.kill();
      this.cameraTween = null;
    }
    if (this.startScreen) {
      this.startScreen.dispose();
      this.startScreen = null;
    }
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
  }
}

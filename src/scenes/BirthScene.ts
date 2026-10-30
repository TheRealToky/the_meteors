import * as THREE from 'three';
import gsap from 'gsap';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { BirthCloud, BirthData } from '../world/BirthCloud';
import { BirthOverlays } from '../ui/BirthOverlays';
import { t, formatNumber, getLanguage } from '../i18n';

export class BirthScene extends BaseScene {
  id: SceneId = 'birth';
  private group: THREE.Group = new THREE.Group();
  private birthData: BirthData | null = null;
  private birthCloud: BirthCloud | null = null;

  // DOM elements
  private overlayContainer: HTMLElement | null = null;
  private captionEl: HTMLElement | null = null;
  private promptEl: HTMLElement | null = null;
  private ariaLiveEl: HTMLElement | null = null;
  private overlaySlotEl: HTMLElement | null = null;
  private birthOverlays: BirthOverlays | null = null;

  // Animation & Tweens
  private countTween: gsap.core.Tween | null = null;
  private diveTween: gsap.core.Tween | null = null;
  private pulseTimeoutId: number | null = null;
  private isBorn: boolean = false;
  private isCounting: boolean = true;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private clickListener: ((e: MouseEvent | TouchEvent) => void) | null = null;

  // Pre-allocated vectors for camera animation (zero allocations in update)
  private initialCamPos = new THREE.Vector3();
  private initialLookAt = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();

  async load(): Promise<void> {
    if (this.birthData) return;

    try {
      const response = await fetch('/data/birth.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading /data/birth.json`);
      }
      this.birthData = await response.json();
    } catch (err) {
      console.error('[BirthScene] Failed to load /data/birth.json:', err);
    }

    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);
    this.isBorn = false;
    this.isCounting = true;

    if (!this.birthData) {
      await this.load();
    }

    if (!this.birthData) {
      console.error('[BirthScene] Cannot initialize without birthData');
      return;
    }

    // 1. Initialize Birth Point Cloud
    this.birthCloud = new BirthCloud({
      birthData: this.birthData,
      playerSex: ctx.state.sex,
      seed: 2025,
      lowQuality: false,
    });
    this.group.add(this.birthCloud.group);
    ctx.scene.add(this.group);

    // 2. Setup Initial Wide Camera Shot
    const center = this.birthCloud.getCenterPosition();
    this.initialCamPos.set(center.x, center.y + 24.0, center.z + 36.0);
    this.initialLookAt.copy(center);
    this.currentLookAt.copy(this.initialLookAt);

    ctx.camera.position.copy(this.initialCamPos);
    ctx.camera.lookAt(this.initialLookAt);

    // 3. Setup DOM Overlays & Accessibility
    this.createDomOverlay(ctx.uiContainer);

    // 4. Begin Wide Shot Count-up (0 to 356,838 over 3s)
    this.startCountUp();
  }

  private createDomOverlay(container: HTMLElement): void {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.className = 'birth-scene-overlay';

    // Accessible aria-live polite region
    this.ariaLiveEl = document.createElement('div');
    this.ariaLiveEl.className = 'sr-only';
    this.ariaLiveEl.setAttribute('aria-live', 'polite');
    this.ariaLiveEl.setAttribute('aria-atomic', 'true');
    this.overlayContainer.appendChild(this.ariaLiveEl);

    // Station Title & Count Caption
    const hudBox = document.createElement('div');
    hudBox.className = 'birth-hud-box glass-panel';

    const titleEl = document.createElement('h2');
    titleEl.className = 'birth-title';
    titleEl.textContent = t('birth.title');
    hudBox.appendChild(titleEl);

    this.captionEl = document.createElement('p');
    this.captionEl.className = 'birth-caption-text';
    this.captionEl.textContent = t('birth.count_caption', { count: formatNumber(0, getLanguage()) });
    hudBox.appendChild(this.captionEl);

    this.overlayContainer.appendChild(hudBox);

    // Interaction prompt (initially hidden)
    this.promptEl = document.createElement('button');
    this.promptEl.className = 'birth-prompt-btn primary-btn hidden';
    this.promptEl.setAttribute('tabindex', '0');
    this.promptEl.textContent = t('birth.tap_to_be_born');
    this.promptEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerBirth();
    });
    this.overlayContainer.appendChild(this.promptEl);

    // Person A's reserved slot for overlays tomorrow
    this.overlaySlotEl = document.createElement('div');
    this.overlaySlotEl.id = 'birth-overlay-slot';
    this.overlayContainer.appendChild(this.overlaySlotEl);

    container.appendChild(this.overlayContainer);
  }

  private startCountUp(): void {
    if (!this.birthData || !this.birthCloud) return;

    const totalCount = this.birthCloud.getPointCount();
    const countState = { val: 0 };
    const locale = getLanguage();

    this.countTween = gsap.to(countState, {
      val: totalCount,
      duration: 3.0,
      ease: 'power2.out',
      onUpdate: () => {
        const currentCount = Math.floor(countState.val);
        const formatted = formatNumber(currentCount, locale);
        if (this.captionEl) {
          this.captionEl.textContent = t('birth.count_caption', { count: formatted });
        }
        if (this.birthCloud) {
          this.birthCloud.setRevealProgress(currentCount / totalCount);
        }
      },
      onComplete: () => {
        this.isCounting = false;
        const finalFormatted = formatNumber(totalCount, locale);
        if (this.captionEl) {
          this.captionEl.textContent = t('birth.count_caption', { count: finalFormatted });
        }

        // Accessibility announcement
        const youInfo = this.birthCloud!.getYouInfo();
        const youSexLabel = t(`common.${youInfo.sex}`);
        if (this.ariaLiveEl) {
          this.ariaLiveEl.textContent = t('birth.aria_announcement', {
            count: finalFormatted,
            index: youInfo.index + 1,
            sex: youSexLabel,
          });
        }

        // Emit Person A's first contract event
        window.dispatchEvent(
          new CustomEvent('birth:cloudRevealed', {
            detail: { count: totalCount },
          })
        );

        this.showPrompt();
      },
    });
  }

  private showPrompt(): void {
    if (!this.promptEl) return;
    this.promptEl.classList.remove('hidden');
    this.promptEl.focus();

    // Setup input listeners (tap, click, Space, Enter)
    this.keyListener = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.triggerBirth();
      }
    };
    window.addEventListener('keydown', this.keyListener);

    this.clickListener = (_e: MouseEvent | TouchEvent) => {
      this.triggerBirth();
    };
    window.addEventListener('click', this.clickListener, { once: true });

    // 10s idle pulse trigger (never auto-advance!)
    this.pulseTimeoutId = window.setTimeout(() => {
      if (!this.isBorn && this.promptEl) {
        this.promptEl.classList.add('pulse-attention');
      }
    }, 10000);
  }

  private triggerBirth(): void {
    if (this.isBorn || !this.birthCloud || !this.ctx) return;
    this.isBorn = true;

    // Clean up prompt & timers
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
      this.pulseTimeoutId = null;
    }
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    if (this.clickListener) {
      window.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }
    if (this.promptEl) {
      this.promptEl.remove();
      this.promptEl = null;
    }

    const youInfo = this.birthCloud.getYouInfo();
    const youPos = this.birthCloud.getYouPosition();

    // Emit event: birth:youChosen
    window.dispatchEvent(
      new CustomEvent('birth:youChosen', {
        detail: {
          index: youInfo.index + 1,
          sex: youInfo.sex,
        },
      })
    );

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Accessible immediate cross-fade
      this.finishBorn(youInfo);
    } else {
      // 3.2s GSAP Dive: camera zooms into the "you" marker while halo expands
      const cam = this.ctx.camera;
      const targetCamPos = new THREE.Vector3(youPos.x, youPos.y + 0.9, youPos.z + 1.8);

      const diveObj = {
        cx: cam.position.x,
        cy: cam.position.y,
        cz: cam.position.z,
        lx: this.currentLookAt.x,
        ly: this.currentLookAt.y,
        lz: this.currentLookAt.z,
        haloScale: 1.0,
      };

      this.diveTween = gsap.to(diveObj, {
        cx: targetCamPos.x,
        cy: targetCamPos.y,
        cz: targetCamPos.z,
        lx: youPos.x,
        ly: youPos.y,
        lz: youPos.z,
        haloScale: 3.5,
        duration: 3.2,
        ease: 'power3.inOut',
        onUpdate: () => {
          cam.position.set(diveObj.cx, diveObj.cy, diveObj.cz);
          this.currentLookAt.set(diveObj.lx, diveObj.ly, diveObj.lz);
          cam.lookAt(this.currentLookAt);
          if (this.birthCloud) {
            this.birthCloud.setMarkerExpansion(diveObj.haloScale, 1.0);
          }
        },
        onComplete: () => {
          this.finishBorn(youInfo);
        },
      });
    }
  }

  private finishBorn(youInfo: { index: number; sex: 'male' | 'female' }): void {
    // Fade into the baby character on the rail
    if (this.ctx) {
      // Position camera rail smoothly to birth station (t = 0.16)
      this.ctx.cameraRail.animateTo(0.16, 1.8, 'power2.inOut');
    }

    // Mount Person A's BirthOverlays into overlaySlotEl
    if (this.overlaySlotEl && this.birthData && this.ctx) {
      this.birthOverlays = new BirthOverlays({
        container: this.overlaySlotEl,
        birthData: this.birthData as any,
        playerSex: this.ctx.state.sex,
        existingName: this.ctx.state.name,
        onNameAssigned: (name) => {
          this.ctx?.updateState({ name });
        },
        onContinue: () => {
          this.ctx?.goToScene('growing');
        },
      });
    }

    // Emit event: birth:bornComplete
    window.dispatchEvent(
      new CustomEvent('birth:bornComplete', {
        detail: {
          index: youInfo.index + 1,
          sex: youInfo.sex,
        },
      })
    );
  }

  update(dt: number, elapsed: number): void {
    if (this.birthCloud && this.ctx) {
      this.birthCloud.update(dt, elapsed, this.ctx.camera);
    }
  }

  onLanguageChange(): void {
    const locale = getLanguage();
    if (this.captionEl && this.birthCloud) {
      const count = this.isCounting ? 0 : this.birthCloud.getPointCount();
      this.captionEl.textContent = t('birth.count_caption', {
        count: formatNumber(count, locale),
      });
    }
    if (this.promptEl) {
      this.promptEl.textContent = t('birth.tap_to_be_born');
    }
    if (this.birthOverlays) {
      this.birthOverlays.updateLanguage();
    }
  }

  async exit(): Promise<void> {
    if (this.birthOverlays) {
      this.birthOverlays.dispose();
      this.birthOverlays = null;
    }
    if (this.countTween) {
      this.countTween.kill();
      this.countTween = null;
    }
    if (this.diveTween) {
      this.diveTween.kill();
      this.diveTween = null;
    }
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
      this.pulseTimeoutId = null;
    }
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    if (this.clickListener) {
      window.removeEventListener('click', this.clickListener);
      this.clickListener = null;
    }

    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }

    if (this.ctx) {
      this.ctx.scene.remove(this.group);
    }

    this.dispose();
    await super.exit();
  }

  dispose(): void {
    if (this.birthOverlays) {
      this.birthOverlays.dispose();
      this.birthOverlays = null;
    }
    if (this.countTween) {
      this.countTween.kill();
      this.countTween = null;
    }
    if (this.diveTween) {
      this.diveTween.kill();
      this.diveTween = null;
    }

    if (this.birthCloud) {
      this.birthCloud.dispose();
      this.birthCloud = null;
    }

    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}

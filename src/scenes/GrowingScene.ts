import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { t, onLanguageChange } from '../i18n';

type Tween = { kill: () => void };

export class GrowingScene extends BaseScene {
  id: SceneId = 'growing';
  private group: THREE.Group = new THREE.Group();

  // Overlay DOM
  private overlayContainer: HTMLElement | null = null;
  private cardEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private captionEl: HTMLElement | null = null;

  // Animations & Timers
  private timelineTween: Tween | null = null;
  private autoAdvanceTimer: number | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private unregisterI18n: (() => void) | null = null;

  async load(): Promise<void> {
    // Preload next scene (marriage) in background
    try {
      await fetch('/data/marriage.json');
    } catch (e) {
      console.warn('[GrowingScene] Preload marriage.json warning:', e);
    }
    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);
    ctx.scene.add(this.group);

    // 1. Build Overlay Card
    this.createDomOverlay(ctx.uiContainer);

    // 2. Position camera rail at School of Life station (t = 0.33)
    const targetT = 0.33;
    ctx.cameraRail.setProgress(targetT);

    // Wire Keyboard Listener (Enter or Space to continue)
    this.keyListener = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target && target.tagName === 'BUTTON') return; // let button handler run
        e.preventDefault();
        this.finishAndAdvance();
      }
    };
    window.addEventListener('keydown', this.keyListener);

    // Reactive i18n
    this.unregisterI18n = onLanguageChange(() => {
      this.updateLabels();
    });
  }

  private createDomOverlay(container: HTMLElement): void {
    this.overlayContainer = document.createElement('div');
    this.overlayContainer.className = 'growing-overlay-wrapper';

    this.cardEl = document.createElement('div');
    this.cardEl.className = 'growing-card glass-panel';
    this.cardEl.setAttribute('role', 'region');
    this.cardEl.setAttribute('aria-label', "The School of Life");

    this.cardEl.innerHTML = `
      <div class="growing-card-header">
        <span class="station-tag">Station 2 · The School of Life</span>
      </div>

      <h2 class="growing-title">The School of Life</h2>
      <p class="growing-subtitle">Growing up across the terraced hills — inclusive learning through formal education, crafts, and community life.</p>
      
      <div class="growing-milestone-pills">
        <span class="pill-badge">Primary & Vocational Education</span>
        <span class="pill-badge">Agricultural Wisdom</span>
        <span class="pill-badge">Youth Median Age: 19 Yrs</span>
      </div>

      <div class="growing-caption-box">
        <p class="growing-caption">${t('growing.caption')}</p>
      </div>

      <div class="growing-actions" style="margin-top: 1.25rem; display: flex; justify-content: flex-end;">
        <button id="btn-continue-marriage" class="primary-btn" tabindex="0">
          Continue to Town Hall (Marriage) →
        </button>
      </div>
    `;

    const continueBtn = this.cardEl.querySelector('#btn-continue-marriage');
    if (continueBtn) {
      continueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.finishAndAdvance();
      });
    }

    this.titleEl = this.cardEl.querySelector('.growing-title');
    this.captionEl = this.cardEl.querySelector('.growing-caption');

    this.overlayContainer.appendChild(this.cardEl);
    container.appendChild(this.overlayContainer);
  }

  private updateLabels(): void {
    if (this.titleEl) this.titleEl.textContent = "The School of Life";
    if (this.captionEl) this.captionEl.textContent = t('growing.caption');
  }

  public skip(): void {
    this.finishAndAdvance();
  }

  private finishAndAdvance(): void {
    if (this.ctx) {
      this.ctx.goToScene('marriage');
    }
  }

  update(_dt: number, _elapsed: number): void {}

  onLanguageChange(): void {
    this.updateLabels();
  }

  async exit(): Promise<void> {
    if (this.timelineTween) {
      this.timelineTween.kill();
      this.timelineTween = null;
    }
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    if (this.unregisterI18n) {
      this.unregisterI18n();
      this.unregisterI18n = null;
    }

    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
    if (this.ctx) {
      this.ctx.scene.remove(this.group);
    }
    await super.exit();
  }

  dispose(): void {
    if (this.timelineTween) {
      this.timelineTween.kill();
      this.timelineTween = null;
    }
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}

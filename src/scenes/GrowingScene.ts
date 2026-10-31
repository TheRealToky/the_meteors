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
  private skipBtn: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private subtitleEl: HTMLElement | null = null;
  private captionEl: HTMLElement | null = null;

  // Animations & Timers
  private timelineTween: Tween | null = null;
  private autoAdvanceTimer: number | null = null;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private isSkipped: boolean = false;
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
    this.isSkipped = false;
    ctx.scene.add(this.group);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Build Overlay Card
    this.createDomOverlay(ctx.uiContainer);

    // 2. Start Rail Motion & Timelapse Sequence
    const startT = 0.16; // birth station
    const targetT = 0.33; // growing station
    const duration = prefersReducedMotion ? 2.5 : 14.0;

    // Camera rail motion
    ctx.cameraRail.setProgress(startT);
    this.timelineTween = ctx.cameraRail.animateTo(targetT, duration, 'power1.inOut', () => {
      if (!this.isSkipped) {
        this.finishAndAdvance();
      }
    });

    // Wire Keyboard Listener for Skip (Space, Enter, ArrowRight)
    this.keyListener = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.skip();
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
    this.cardEl.setAttribute('aria-label', t('growing.title'));

    this.cardEl.innerHTML = `
      <div class="growing-card-header">
        <span class="station-tag">Station 2 · Youth</span>
        <button id="btn-skip-timelapse" class="skip-btn" tabindex="0" title="Skip animation">
          ${t('growing.skip')}
        </button>
      </div>

      <h2 class="growing-title">${t('growing.title')}</h2>
      <p class="growing-subtitle">${t('growing.subtitle')}</p>
      
      <div class="growing-milestone-pills">
        <span class="pill-badge">Primary Education</span>
        <span class="pill-badge">Terraced Agriculture</span>
        <span class="pill-badge">Community Health</span>
      </div>

      <div class="growing-caption-box">
        <p class="growing-caption">${t('growing.caption')}</p>
      </div>
    `;

    this.skipBtn = this.cardEl.querySelector('#btn-skip-timelapse');
    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.skip();
      });
    }

    this.titleEl = this.cardEl.querySelector('.growing-title');
    this.subtitleEl = this.cardEl.querySelector('.growing-subtitle');
    this.captionEl = this.cardEl.querySelector('.growing-caption');

    this.overlayContainer.appendChild(this.cardEl);
    container.appendChild(this.overlayContainer);
  }

  private updateLabels(): void {
    if (this.titleEl) this.titleEl.textContent = t('growing.title');
    if (this.subtitleEl) this.subtitleEl.textContent = t('growing.subtitle');
    if (this.captionEl) this.captionEl.textContent = t('growing.caption');
    if (this.skipBtn) this.skipBtn.textContent = `${t('growing.skip')} ⏩`;
  }

  public skip(): void {
    if (this.isSkipped) return;
    this.isSkipped = true;

    if (this.timelineTween) {
      this.timelineTween.kill();
      this.timelineTween = null;
    }
    if (this.ctx) {
      this.ctx.cameraRail.setProgress(0.33);
    }
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

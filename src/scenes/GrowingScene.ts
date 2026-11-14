import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { t, onLanguageChange } from '../i18n';

type Tween = { kill: () => void };

export class GrowingScene extends BaseScene {
  id: SceneId = 'growing';
  private group: THREE.Group = new THREE.Group();

  // Overlay DOM
  private cardEl: HTMLElement | null = null;
  private tagEl: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private subtitleEl: HTMLElement | null = null;
  private captionEl: HTMLElement | null = null;
  private continueBtnEl: HTMLElement | null = null;

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

    // 2. Position camera rail at School of Life station
    const targetT = ctx.cameraRail.getStationT('growing');
    ctx.cameraRail.setProgress(targetT);

    // Wire Keyboard Listener (Enter or Space to continue)
    this.keyListener = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target && target.tagName === 'BUTTON') return; // let button handler run
        e.preventDefault();
        this.startWalkToMarriage();
      }
    };
    window.addEventListener('keydown', this.keyListener);

    // Reactive i18n
    this.unregisterI18n = onLanguageChange(() => {
      this.updateLabels();
    });
  }

  private createDomOverlay(container: HTMLElement): void {
    this.cardEl = document.createElement('div');
    this.cardEl.className = 'growing-card glass-panel';
    this.cardEl.setAttribute('role', 'region');
    this.cardEl.setAttribute('aria-label', t('growing.title'));

    // Structure only: text is filled in by updateLabels() so a language change re-renders it
    this.cardEl.innerHTML = `
      <div class="growing-card-header">
        <span class="station-tag"></span>
      </div>

      <h2 class="growing-title"></h2>
      <p class="growing-subtitle"></p>

      <div class="growing-caption-box">
        <p class="growing-caption"></p>
      </div>

      <div class="growing-actions">
        <button id="btn-continue-marriage" class="primary-btn stage-action-btn" tabindex="0"></button>
      </div>
    `;

    const continueBtn = this.cardEl.querySelector('#btn-continue-marriage');
    if (continueBtn) {
      continueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startWalkToMarriage();
      });
    }

    this.tagEl = this.cardEl.querySelector('.station-tag');
    this.subtitleEl = this.cardEl.querySelector('.growing-subtitle');
    this.continueBtnEl = continueBtn as HTMLElement | null;
    this.titleEl = this.cardEl.querySelector('.growing-title');
    this.captionEl = this.cardEl.querySelector('.growing-caption');

    this.updateLabels();
    container.appendChild(this.cardEl);
  }

  private updateLabels(): void {
    if (this.cardEl) this.cardEl.setAttribute('aria-label', t('growing.title'));
    if (this.tagEl) this.tagEl.textContent = t('growing.station_tag');
    if (this.titleEl) this.titleEl.textContent = t('growing.title');
    if (this.subtitleEl) this.subtitleEl.textContent = t('growing.subtitle');
    if (this.captionEl) this.captionEl.textContent = t('growing.caption');
    if (this.continueBtnEl) this.continueBtnEl.textContent = t('growing.continue_btn');
  }

  /** Skip (e.g. the nav "Next" button) still fast-travels straight to marriage. */
  public skip(): void {
    this.finishAndAdvance();
  }

  /**
   * Close the card and let the player walk the path to the sector office,
   * like every other stage hand-off. Arriving at the door opens the marriage
   * scene (main.ts listens for 'lifepath:walkToMilestone').
   */
  private startWalkToMarriage(): void {
    if (this.keyListener) {
      // Space / Enter now belong to the walk button, not this card
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    if (this.cardEl) {
      this.cardEl.remove();
      this.cardEl = null;
      this.tagEl = this.titleEl = this.subtitleEl = this.captionEl = this.continueBtnEl = null;
    }
    window.dispatchEvent(new CustomEvent('lifepath:walkToMilestone', { detail: { id: 'marriage' } }));
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

    if (this.cardEl) {
      this.cardEl.remove();
      this.cardEl = null;
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

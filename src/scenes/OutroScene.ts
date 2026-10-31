import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { t, onLanguageChange } from '../i18n';

export class OutroScene extends BaseScene {
  id: SceneId = 'outro';
  private group: THREE.Group = new THREE.Group();
  private unregisterI18n: (() => void) | null = null;
  private outroCardEl: HTMLElement | null = null;
  private methodologyModalEl: HTMLElement | null = null;
  private isMethodologyOpen: boolean = false;
  private prefersReducedMotion: boolean = false;

  // 3D Visual Props: Summit overlook marker & sunrise beacon
  private propsGroup: THREE.Group = new THREE.Group();
  private beaconLight: THREE.PointLight | null = null;

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isMethodologyOpen) {
      this.closeMethodology();
    }
  };

  async load(): Promise<void> {
    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);

    this.prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Move camera rail to Outro station (t = 1.00 on rail)
    ctx.cameraRail.setProgress(1.00);

    // 2. Setup 3D Sunrise Props
    this.create3DProps();
    ctx.scene.add(this.group);

    // 3. Render Outro UI Overlay
    this.renderOutroUI(ctx);

    window.addEventListener('keydown', this.onKeyDown);

    this.unregisterI18n = onLanguageChange(() => {
      this.renderOutroUI(ctx);
      if (this.isMethodologyOpen) {
        this.openMethodology();
      }
    });
  }

  private create3DProps(): void {
    this.propsGroup.clear();

    // Sunrise summit stone marker
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.8,
      metalness: 0.1,
    });

    const markerGeom = new THREE.CylinderGeometry(0.8, 1.1, 1.8, 8);
    const markerMesh = new THREE.Mesh(markerGeom, stoneMat);
    markerMesh.position.set(0, 0.9, 0);
    this.propsGroup.add(markerMesh);

    // Radiant dawn crystal beacon
    const crystalGeom = new THREE.OctahedronGeometry(0.45, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
    });
    const crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
    crystalMesh.position.set(0, 2.2, 0);
    this.propsGroup.add(crystalMesh);

    this.beaconLight = new THREE.PointLight(0xfef08a, 1.8, 12.0);
    this.beaconLight.position.set(0, 2.3, 0);
    this.propsGroup.add(this.beaconLight);

    // Position props near Outro station (x: 75, z: 35)
    this.propsGroup.position.set(75, 3.0, 35);
    this.group.add(this.propsGroup);
  }

  private renderOutroUI(ctx: SceneContext): void {
    if (this.outroCardEl) {
      this.outroCardEl.remove();
      this.outroCardEl = null;
    }

    const state = ctx.state;
    const travelerName = state.name ?? (state.sex === 'male' ? 'Kwizera' : 'Ineza');
    const sexLabel = state.sex === 'male' ? t('common.male') : t('common.female');
    const otherSexLabel = state.sex === 'male' ? t('common.female') : t('common.male');
    const otherSexVal = state.sex === 'male' ? 'female' : 'male';

    const weddingAgeGuess = state.guesses.marriageAge
      ? `${state.guesses.marriageAge} yrs`
      : t('outro.not_specified');

    const divorceYearsGuess = state.guesses.divorceYears
      ? `${state.guesses.divorceYears} yrs`
      : t('outro.not_specified');

    this.outroCardEl = document.createElement('div');
    this.outroCardEl.className = 'outro-overlay-card glass-panel';
    this.outroCardEl.setAttribute('role', 'region');
    this.outroCardEl.setAttribute('aria-label', t('outro.title'));
    this.outroCardEl.innerHTML = `
      <div class="outro-header">
        <span class="station-badge-gold">${t('outro.station_tag')}</span>
        <h2 class="outro-title">${t('outro.title')}</h2>
        <p class="outro-subtitle">${t('outro.subtitle')}</p>
      </div>

      <!-- Recap of Player's Chosen Run -->
      <div class="outro-recap-grid" aria-label="${t('outro.journey_recap_title')}">
        <div class="outro-recap-card">
          <span class="outro-recap-label">${t('outro.identity_label')}</span>
          <span class="outro-recap-value">${travelerName} (${sexLabel})</span>
        </div>
        <div class="outro-recap-card">
          <span class="outro-recap-label">${t('outro.marriage_guess_label')}</span>
          <span class="outro-recap-value">${weddingAgeGuess}</span>
        </div>
        <div class="outro-recap-card">
          <span class="outro-recap-label">${t('outro.divorce_guess_label')}</span>
          <span class="outro-recap-value">${divorceYearsGuess}</span>
        </div>
      </div>

      <!-- Official CRVS Sources & Principles -->
      <div class="outro-sections-grid">
        <div class="outro-info-box">
          <span class="outro-info-title">📚 ${t('outro.sources_title')}</span>
          <p class="outro-citation-intro">${t('outro.nisr_citation')}</p>
          <ul class="outro-citations-list">
            <li>${t('outro.citation_pyramid')}</li>
            <li>${t('outro.citation_births')}</li>
            <li>${t('outro.citation_marriages')}</li>
            <li>${t('outro.citation_divorces')}</li>
            <li>${t('outro.citation_deaths')}</li>
          </ul>
        </div>

        <div class="outro-info-box">
          <span class="outro-info-title">⚖️ ${t('outro.data_principles_title')}</span>
          <p>${t('caveat.composite_life')}</p>
          <p>${t('caveat.divorce_not_rate')}</p>
          <p>${t('caveat.registered_deaths_completeness')}</p>
        </div>
      </div>

      <!-- Actions: Methodology & Restart -->
      <div class="outro-footer-actions">
        <button id="btn-open-methodology" class="outro-methodology-btn" type="button" aria-haspopup="dialog" aria-expanded="false">
          📖 ${t('outro.methodology_btn')}
        </button>
        <button id="btn-outro-restart" class="outro-restart-btn" type="button">
          ${t('outro.play_again_btn', { otherSex: otherSexLabel })}
        </button>
      </div>
    `;

    const restartBtn = this.outroCardEl.querySelector('#btn-outro-restart');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        ctx.updateState({
          sex: otherSexVal,
          guesses: {},
        });
        ctx.goToScene('intro');
      });
    }

    const methodologyBtn = this.outroCardEl.querySelector('#btn-open-methodology') as HTMLButtonElement | null;
    if (methodologyBtn) {
      methodologyBtn.addEventListener('click', () => {
        this.openMethodology();
      });
    }

    ctx.uiContainer.appendChild(this.outroCardEl);
  }

  private openMethodology(): void {
    if (!this.ctx) return;
    this.closeMethodology();
    this.isMethodologyOpen = true;

    const triggerBtn = this.outroCardEl?.querySelector('#btn-open-methodology');
    if (triggerBtn) {
      triggerBtn.setAttribute('aria-expanded', 'true');
    }

    this.methodologyModalEl = document.createElement('div');
    this.methodologyModalEl.className = 'methodology-modal-backdrop';
    this.methodologyModalEl.innerHTML = `
      <div class="methodology-modal-card glass-panel" role="dialog" aria-modal="true" aria-labelledby="methodology-modal-title">
        <div class="methodology-modal-header">
          <div class="methodology-title-group">
            <span class="station-badge-gold">CRVS 2025</span>
            <h3 id="methodology-modal-title" class="methodology-title">${t('outro.methodology_title')}</h3>
          </div>
          <button id="btn-close-methodology" class="methodology-close-btn" type="button" aria-label="${t('outro.methodology_close')}">
            ✕
          </button>
        </div>

        <p class="methodology-lead">${t('outro.methodology_intro')}</p>

        <div class="methodology-items-grid">
          <div class="methodology-card">
            <h4 class="methodology-card-title">🧩 ${t('outro.methodology_composite_title')}</h4>
            <p class="methodology-card-text">${t('outro.methodology_composite_desc')}</p>
          </div>

          <div class="methodology-card">
            <h4 class="methodology-card-title">📋 ${t('outro.methodology_completeness_title')}</h4>
            <p class="methodology-card-text">${t('outro.methodology_completeness_desc')}</p>
          </div>

          <div class="methodology-card">
            <h4 class="methodology-card-title">💍 ${t('outro.methodology_divorce_title')}</h4>
            <p class="methodology-card-text">${t('outro.methodology_divorce_desc')}</p>
          </div>

          <div class="methodology-card">
            <h4 class="methodology-card-title">🏥 ${t('outro.methodology_causes_title')}</h4>
            <p class="methodology-card-text">${t('outro.methodology_causes_desc')}</p>
          </div>
        </div>

        <div class="methodology-citations-section">
          <h4 class="methodology-card-title">📊 ${t('outro.sources_title')}</h4>
          <ul class="methodology-citations-list">
            <li>${t('outro.citation_pyramid')}</li>
            <li>${t('outro.citation_births')}</li>
            <li>${t('outro.citation_marriages')}</li>
            <li>${t('outro.citation_divorces')}</li>
            <li>${t('outro.citation_deaths')}</li>
          </ul>
        </div>

        <div class="methodology-footer">
          <p class="methodology-credits"><strong>${t('outro.credits_title')}:</strong> ${t('outro.credits_text')}</p>
          <button id="btn-close-methodology-footer" class="methodology-done-btn" type="button">
            ${t('outro.methodology_close')}
          </button>
        </div>
      </div>
    `;

    // Handle clicks to close
    this.methodologyModalEl.addEventListener('click', (e) => {
      if (e.target === this.methodologyModalEl) {
        this.closeMethodology();
      }
    });

    const closeHeaderBtn = this.methodologyModalEl.querySelector('#btn-close-methodology');
    if (closeHeaderBtn) {
      closeHeaderBtn.addEventListener('click', () => this.closeMethodology());
    }

    const closeFooterBtn = this.methodologyModalEl.querySelector('#btn-close-methodology-footer');
    if (closeFooterBtn) {
      closeFooterBtn.addEventListener('click', () => this.closeMethodology());
    }

    this.ctx.uiContainer.appendChild(this.methodologyModalEl);

    // Set focus to the modal close button for accessibility
    const firstFocusable = this.methodologyModalEl.querySelector('#btn-close-methodology') as HTMLElement | null;
    firstFocusable?.focus();
  }

  private closeMethodology(): void {
    if (this.methodologyModalEl) {
      this.methodologyModalEl.remove();
      this.methodologyModalEl = null;
    }
    this.isMethodologyOpen = false;

    const triggerBtn = this.outroCardEl?.querySelector('#btn-open-methodology') as HTMLElement | null;
    if (triggerBtn) {
      triggerBtn.setAttribute('aria-expanded', 'false');
      triggerBtn.focus();
    }
  }

  update(_dt: number, elapsed: number): void {
    if (this.beaconLight) {
      if (this.prefersReducedMotion) {
        this.beaconLight.intensity = 1.6;
      } else {
        this.beaconLight.intensity = 1.5 + Math.sin(elapsed * 2.5) * 0.3;
      }
    }
  }

  onLanguageChange(): void {
    if (this.ctx) {
      this.renderOutroUI(this.ctx);
    }
  }

  async exit(): Promise<void> {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.unregisterI18n) {
      this.unregisterI18n();
      this.unregisterI18n = null;
    }
    this.closeMethodology();
    if (this.outroCardEl) {
      this.outroCardEl.remove();
      this.outroCardEl = null;
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
    window.removeEventListener('keydown', this.onKeyDown);
    this.closeMethodology();
    if (this.outroCardEl) {
      this.outroCardEl.remove();
      this.outroCardEl = null;
    }
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}


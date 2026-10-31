import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { t, onLanguageChange } from '../i18n';

export class OutroScene extends BaseScene {
  id: SceneId = 'outro';
  private group: THREE.Group = new THREE.Group();
  private unregisterI18n: (() => void) | null = null;
  private outroCardEl: HTMLElement | null = null;

  // 3D Visual Props: Summit overlook marker & sunrise beacon
  private propsGroup: THREE.Group = new THREE.Group();
  private beaconLight: THREE.PointLight | null = null;

  async load(): Promise<void> {
    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);

    // 1. Move camera rail to Outro station (t = 1.00 on rail)
    ctx.cameraRail.setProgress(1.00);

    // 2. Setup 3D Sunrise Props
    this.create3DProps();
    ctx.scene.add(this.group);

    // 3. Render Outro UI Overlay
    this.renderOutroUI(ctx);

    this.unregisterI18n = onLanguageChange(() => {
      this.renderOutroUI(ctx);
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
    this.outroCardEl.innerHTML = `
      <div class="outro-header">
        <span class="station-badge-gold">${t('outro.station_tag')}</span>
        <h2 class="outro-title">${t('outro.title')}</h2>
        <p class="outro-subtitle">${t('outro.subtitle')}</p>
      </div>

      <!-- Recap of Player's Chosen Run -->
      <div class="outro-recap-grid">
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

      <!-- Official CRVS Sources & Methodology Decisions -->
      <div class="outro-sections-grid">
        <div class="outro-info-box">
          <span class="outro-info-title">📚 ${t('outro.sources_title')}</span>
          <p>${t('outro.nisr_citation')}</p>
          <ul class="outro-citations-list">
            <li><strong>Population Pyramid:</strong> Figure 1 & Annex 1 (14,108,217 total)</li>
            <li><strong>Registered Births:</strong> Sheet 10.3 & Annex 2 (356,838 births)</li>
            <li><strong>Marriages:</strong> Table 18 & Figure 30 (50,256 marriages)</li>
            <li><strong>Divorces:</strong> Tables 27 & 28 (4,479 registered divorces)</li>
            <li><strong>Mortality & Causes:</strong> Figure 19 & Table 17 (39,355 deaths)</li>
          </ul>
        </div>

        <div class="outro-info-box">
          <span class="outro-info-title">⚖️ ${t('outro.data_principles_title')}</span>
          <p>${t('caveat.composite_life')}</p>
          <p>${t('caveat.divorce_not_rate')}</p>
          <p>${t('caveat.registered_deaths_completeness')}</p>
        </div>
      </div>

      <!-- Restart Flow Button -->
      <div class="outro-footer-actions">
        <button id="btn-outro-restart" class="outro-restart-btn">
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

    ctx.uiContainer.appendChild(this.outroCardEl);
  }

  update(_dt: number, elapsed: number): void {
    if (this.beaconLight) {
      this.beaconLight.intensity = 1.5 + Math.sin(elapsed * 2.5) * 0.3;
    }
  }

  onLanguageChange(): void {
    if (this.ctx) {
      this.renderOutroUI(this.ctx);
    }
  }

  async exit(): Promise<void> {
    if (this.unregisterI18n) {
      this.unregisterI18n();
      this.unregisterI18n = null;
    }
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
    if (this.outroCardEl) {
      this.outroCardEl.remove();
      this.outroCardEl = null;
    }
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}

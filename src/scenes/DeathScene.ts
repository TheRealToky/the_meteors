import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { GuessReveal, GuessRevealSeries } from '../ui/GuessReveal';
import { t, formatNumber, getLanguage, onLanguageChange } from '../i18n';

export interface DeathCauseItem {
  rank: number;
  cause: string;
  percentage: number;
}

export interface DeathData {
  id: string;
  source: {
    sheet: string;
    table_sheet: string;
    causes_sheet: string;
    location_sheet: string;
    title: string;
    note: string;
  };
  unit: string;
  labels: string[];
  last_bucket_label_key: string;
  series: {
    male: number[];
    female: number[];
    total: number[];
  };
  indicators: {
    total_registered_deaths: number;
    male_deaths: number;
    female_deaths: number;
    sex_ratio_at_death: number;
    completeness: number;
    community_share_percent: number;
    facility_share_percent: number;
    under_5_deaths: number;
    leading_facility_cause: string;
  };
  top_causes: {
    facility: DeathCauseItem[];
    community: DeathCauseItem[];
  };
  caption_key: string;
  caveat_key: string;
  checks: {
    sum_total: number;
  };
}

export class DeathScene extends BaseScene {
  id: SceneId = 'death';
  private group: THREE.Group = new THREE.Group();
  private deathData: DeathData | null = null;
  private guessReveal: GuessReveal | null = null;
  private unregisterI18n: (() => void) | null = null;

  // 3D Visual Props: Starlit memorial monolith, circular plinth & candle lanterns
  private propsGroup: THREE.Group = new THREE.Group();
  private candleLights: THREE.PointLight[] = [];
  private dualCausesCardEl: HTMLElement | null = null;

  async load(): Promise<void> {
    if (this.deathData) return;

    try {
      const response = await fetch('/data/death.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading /data/death.json`);
      }
      this.deathData = await response.json();
    } catch (err) {
      console.error('[DeathScene] Error loading /data/death.json:', err);
    }

    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);

    if (!this.deathData) {
      await this.load();
    }

    // 1. Move camera rail to Death station
    ctx.cameraRail.setProgress(ctx.cameraRail.getStationT('death'));

    // 2. Setup 3D Station Props
    this.create3DProps();
    ctx.scene.add(this.group);

    // 3. Build Dual Causes of Death Card (Table 17 & 14)
    this.dualCausesCardEl = this.createDualCausesCard();

    // 4. Initialize Reusable GuessReveal Component
    const series: GuessRevealSeries[] = [
      {
        id: 'male',
        labelKey: 'common.male',
        values: this.deathData?.series.male ?? [],
        color: '#0284c7', // Sky blue for males
      },
      {
        id: 'female',
        labelKey: 'common.female',
        values: this.deathData?.series.female ?? [],
        color: '#10b981', // Emerald green for females
      },
    ];

    // Initial guess defaults to 0-4 age bucket (index 0)
    const initialIdx = 0;

    this.guessReveal = new GuessReveal({
      id: 'death-guess',
      container: ctx.uiContainer,
      stationTag: t('death.station_tag'),
      titleKey: 'death.title',
      instructionKey: 'death.instruction',
      guessFormatKey: 'death.your_guess',
      labels: this.deathData?.labels ?? [
        '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39',
        '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70-74', '75-79', '80+',
      ],
      series,
      unit: 'deaths',
      markerIcon: '●',
      initialGuessIndex: initialIdx,
      insights: [
        {
          type: 'general',
          title: t('death.sex_ratio_callout'),
          text: t('death.caption'),
        },
      ],
      extraContent: this.dualCausesCardEl,
      caveatKey: this.deathData?.caveat_key ?? 'caveat.registered_deaths_completeness',
      sourceSheet: 'Figure 19, Table 12, Table 14 & Table 17',
      continueBtnKey: 'death.continue_btn',
      onGuessSubmitted: () => {},
      onContinue: () => {
        if (ctx.uiContainer) {
          ctx.uiContainer.innerHTML = '';
        }
        window.dispatchEvent(new CustomEvent('lifepath:walkToMilestone', { detail: { id: 'outro' } }));
      },
    });

    this.unregisterI18n = onLanguageChange(() => {
      if (this.dualCausesCardEl) {
        this.updateDualCausesCard(this.dualCausesCardEl);
      }
    });
  }

  private create3DProps(): void {
    this.propsGroup.clear();
    this.candleLights = [];

    // Weathered dark volcanic stone for memorial monolith
    const obeliskMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.15,
    });

    // Circular stone terrace base
    const baseGeom = new THREE.CylinderGeometry(2.4, 2.6, 0.3, 16);
    const baseMesh = new THREE.Mesh(baseGeom, obeliskMat);
    baseMesh.position.set(0, 0.15, 0);
    this.propsGroup.add(baseMesh);

    // Central memorial obelisk
    const obeliskGeom = new THREE.CylinderGeometry(0.3, 0.55, 3.8, 4);
    const obelisk = new THREE.Mesh(obeliskGeom, obeliskMat);
    obelisk.position.set(0, 2.05, 0);
    obelisk.rotation.y = Math.PI / 4;
    this.propsGroup.add(obelisk);

    // Soft celestial beacon atop obelisk
    const beaconGeom = new THREE.SphereGeometry(0.18, 12, 12);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xfed7aa,
      emissiveIntensity: 0.9,
    });
    const beaconMesh = new THREE.Mesh(beaconGeom, beaconMat);
    beaconMesh.position.set(0, 4.05, 0);
    this.propsGroup.add(beaconMesh);

    const beaconLight = new THREE.PointLight(0xffedd5, 1.5, 8.0);
    beaconLight.position.set(0, 4.1, 0);
    this.propsGroup.add(beaconLight);
    this.candleLights.push(beaconLight);

    // 4 quiet candle lanterns arranged around the circular terrace
    const candlePositions = [
      [-1.4, 0.35, -1.4],
      [1.4, 0.35, -1.4],
      [-1.4, 0.35, 1.4],
      [1.4, 0.35, 1.4],
    ];

    const candleGeom = new THREE.CylinderGeometry(0.12, 0.15, 0.3, 8);
    const candleMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.8,
    });

    candlePositions.forEach(([x, y, z]) => {
      const cMesh = new THREE.Mesh(candleGeom, candleMat);
      cMesh.position.set(x, y, z);
      this.propsGroup.add(cMesh);

      const cLight = new THREE.PointLight(0xf59e0b, 0.9, 4.5);
      cLight.position.set(x, y + 0.25, z);
      this.propsGroup.add(cLight);
      this.candleLights.push(cLight);
    });

    // Position props near Death station coordinates (x: 60, z: -30)
    this.propsGroup.position.set(60, 2.0, -30);
    this.group.add(this.propsGroup);
  }

  private createDualCausesCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'death-causes-container';
    this.updateDualCausesCard(card);
    return card;
  }

  private updateDualCausesCard(card: HTMLElement): void {
    if (!this.deathData) return;
    const topFacility = this.deathData.top_causes.facility.slice(0, 6);
    const topCommunity = this.deathData.top_causes.community.slice(0, 6);
    const lang = getLanguage();

    card.innerHTML = `
      <div class="death-causes-header">
        <h3 class="death-causes-title">${t('death.causes_dual_title')}</h3>
        <p class="death-causes-sub">${t('death.causes_dual_subtitle')}</p>
      </div>



      <div class="death-dual-columns">
        <!-- Facility Causes Column (44.1%) -->
        <div class="death-column">
          <div class="death-column-header">
            <span class="death-column-title">${t('death.facility_heading')}</span>
            <span class="death-column-share-badge badge-facility">${t('death.facility_badge')}</span>
          </div>
          <div class="cause-list">
            ${topFacility.map((item) => `
              <div class="cause-item">
                <div class="cause-item-top">
                  <div class="cause-rank-name">
                    <span class="cause-rank">#${item.rank}</span>
                    <span title="${item.cause}">${item.cause}</span>
                  </div>
                  <span class="cause-pct">${formatNumber(item.percentage, lang)}%</span>
                </div>
                <div class="cause-meter-track">
                  <div class="cause-meter-fill fill-facility" style="width: ${Math.min(100, item.percentage * 5)}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Community Causes Column (55.9%) -->
        <div class="death-column">
          <div class="death-column-header">
            <span class="death-column-title">${t('death.community_heading')}</span>
            <span class="death-column-share-badge badge-community">${t('death.community_badge')}</span>
          </div>
          <div class="cause-list">
            ${topCommunity.map((item) => `
              <div class="cause-item">
                <div class="cause-item-top">
                  <div class="cause-rank-name">
                    <span class="cause-rank">#${item.rank}</span>
                    <span title="${item.cause}">${item.cause}</span>
                  </div>
                  <span class="cause-pct">${formatNumber(item.percentage, lang)}%</span>
                </div>
                <div class="cause-meter-track">
                  <div class="cause-meter-fill fill-community" style="width: ${Math.min(100, item.percentage * 5)}%;"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  update(_dt: number, elapsed: number): void {
    // Gentle candle flicker
    this.candleLights.forEach((light, i) => {
      light.intensity = 0.8 + Math.sin(elapsed * 3.0 + i * 1.5) * 0.15;
    });
  }

  onLanguageChange(): void {
    if (this.guessReveal) {
      this.guessReveal.updateLanguage();
    }
  }

  async exit(): Promise<void> {
    if (this.guessReveal) {
      this.guessReveal.dispose();
      this.guessReveal = null;
    }
    if (this.unregisterI18n) {
      this.unregisterI18n();
      this.unregisterI18n = null;
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
    if (this.guessReveal) {
      this.guessReveal.dispose();
      this.guessReveal = null;
    }
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}

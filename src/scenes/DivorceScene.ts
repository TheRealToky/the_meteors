import * as THREE from 'three';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { GuessReveal, GuessRevealSeries } from '../ui/GuessReveal';
import { t, formatNumber, getLanguage, onLanguageChange } from '../i18n';

export interface DivorceData {
  id: string;
  source: {
    sheet: string;
    indicators_sheet: string;
    title: string;
    note: string;
  };
  unit: string;
  labels: string[];
  series: {
    granted_before: number[];
    granted_2025: number[];
    total: number[];
  };
  indicators: {
    total_registered: number;
    granted_before_count: number;
    granted_before_percent: number;
    granted_in_2025_count: number;
    male_average_age: number;
    female_average_age: number;
    crude_rate: number;
    peak_duration_bracket: string;
    peak_duration_count: number;
  };
  caption_key: string;
  caveat_key: string;
  checks: {
    sum_total: number;
  };
}

export class DivorceScene extends BaseScene {
  id: SceneId = 'divorce';
  private group: THREE.Group = new THREE.Group();
  private divorceData: DivorceData | null = null;
  private guessReveal: GuessReveal | null = null;
  private unregisterI18n: (() => void) | null = null;

  // 3D Visual Props: Parting paths, stone arch & twilight lanterns
  private propsGroup: THREE.Group = new THREE.Group();
  private lanterns: THREE.PointLight[] = [];
  private breakdownCardEl: HTMLElement | null = null;

  async load(): Promise<void> {
    if (this.divorceData) return;

    try {
      const response = await fetch('/data/divorce.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading /data/divorce.json`);
      }
      this.divorceData = await response.json();
    } catch (err) {
      console.error('[DivorceScene] Error loading /data/divorce.json:', err);
    }

    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);

    if (!this.divorceData) {
      await this.load();
    }

    // 1. Move camera rail to Divorce Station (t = 0.67 on rail)
    ctx.cameraRail.setProgress(0.67);

    // 2. Setup 3D Station Props
    this.create3DProps();
    ctx.scene.add(this.group);

    // 3. Build Cohort Breakdown & Indicators Card
    this.breakdownCardEl = this.createBreakdownCard();

    // 4. Initialize Reusable GuessReveal Component
    const series: GuessRevealSeries[] = [
      {
        id: 'granted_2025',
        labelKey: 'divorce.granted_2025',
        values: this.divorceData?.series.granted_2025 ?? [],
        color: '#818cf8', // Soft periwinkle indigo
      },
      {
        id: 'granted_before',
        labelKey: 'divorce.granted_before',
        values: this.divorceData?.series.granted_before ?? [],
        color: '#fb923c', // Warm peach/amber
      },
    ];

    // Initial guess defaults to 5-9 bracket (index 1)
    const initialIdx = 1;

    this.guessReveal = new GuessReveal({
      id: 'divorce-guess',
      container: ctx.uiContainer,
      stationTag: t('divorce.station_tag'),
      titleKey: 'divorce.title',
      instructionKey: 'divorce.instruction',
      guessFormatKey: 'divorce.your_guess',
      labels: this.divorceData?.labels ?? [
        '0-4', '5-9', '10-14', '15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50+',
      ],
      series,
      unit: 'divorces',
      markerIcon: '●',
      initialGuessIndex: initialIdx,
      insights: [
        {
          type: 'general',
          title: t('divorce.peak_title'),
          text: t('divorce.peak_duration'),
        },
        {
          type: 'general',
          title: t('divorce.avg_ages_title'),
          text: `${t('divorce.avg_age_men')} ${t('divorce.avg_age_women')}`,
        },
        {
          type: 'general',
          title: t('divorce.cohort_split_title'),
          text: t('divorce.cohort_insight'),
        },
      ],
      extraContent: this.breakdownCardEl,
      caveatKey: this.divorceData?.caveat_key ?? 'caveat.divorce_not_rate',
      sourceSheet: 'Table 27 & Table 28',
      continueBtnKey: 'divorce.continue_btn',
      onGuessSubmitted: (idx, _label) => {
        // Approximate midpoint in years
        const yearsMap = [2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52];
        const approxYears = yearsMap[idx] ?? 7;
        ctx.updateState({
          guesses: {
            ...ctx.state.guesses,
            divorceYears: approxYears,
          },
        });
      },
      onContinue: () => {
        ctx.goToScene('death');
      },
    });

    this.unregisterI18n = onLanguageChange(() => {
      if (this.breakdownCardEl) {
        this.updateBreakdownCard(this.breakdownCardEl);
      }
    });
  }

  private create3DProps(): void {
    this.propsGroup.clear();
    this.lanterns = [];

    // Quiet, dignified weathered volcanic stone plinth and arch
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.1,
    });

    // Left parting arch pillar
    const pillarGeom = new THREE.BoxGeometry(0.5, 3.2, 0.5);
    const leftPillar = new THREE.Mesh(pillarGeom, stoneMat);
    leftPillar.position.set(-1.2, 1.6, 0);
    leftPillar.rotation.z = -0.06;
    this.propsGroup.add(leftPillar);

    // Right parting arch pillar
    const rightPillar = new THREE.Mesh(pillarGeom, stoneMat);
    rightPillar.position.set(1.2, 1.6, 0);
    rightPillar.rotation.z = 0.06;
    this.propsGroup.add(rightPillar);

    // Stone lintel above
    const lintelGeom = new THREE.BoxGeometry(3.0, 0.35, 0.6);
    const lintel = new THREE.Mesh(lintelGeom, stoneMat);
    lintel.position.set(0, 3.25, 0);
    this.propsGroup.add(lintel);

    // Two serene twilight lanterns with soft gentle glow
    const lanternGeom = new THREE.CylinderGeometry(0.18, 0.22, 0.45, 8);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xc4b5fd,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });

    const lantern1 = new THREE.Mesh(lanternGeom, lanternMat);
    lantern1.position.set(-1.2, 3.65, 0);
    this.propsGroup.add(lantern1);

    const light1 = new THREE.PointLight(0xc4b5fd, 1.2, 7.0);
    light1.position.set(-1.2, 3.7, 0);
    this.propsGroup.add(light1);
    this.lanterns.push(light1);

    const lantern2 = new THREE.Mesh(lanternGeom, lanternMat);
    lantern2.position.set(1.2, 3.65, 0);
    this.propsGroup.add(lantern2);

    const light2 = new THREE.PointLight(0xfcd34d, 1.2, 7.0);
    light2.position.set(1.2, 3.7, 0);
    this.propsGroup.add(light2);
    this.lanterns.push(light2);

    // Position entire group near Divorce station coordinate (x: 40, z: 20)
    this.propsGroup.position.set(40, 2.5, 20);
    this.group.add(this.propsGroup);
  }

  private createBreakdownCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'divorce-breakdown-card';
    this.updateBreakdownCard(card);
    return card;
  }

  private updateBreakdownCard(card: HTMLElement): void {
    if (!this.divorceData) return;
    const ind = this.divorceData.indicators;
    const lang = getLanguage();

    card.innerHTML = `
      <div class="divorce-indicators-row">
        <div class="indicator-chip">
          <span class="indicator-chip-label">${t('divorce.total_registered_label')}</span>
          <span class="indicator-chip-value">${formatNumber(ind.total_registered, lang)}</span>
          <span class="indicator-chip-sub">Table 27 (2025)</span>
        </div>
        <div class="indicator-chip">
          <span class="indicator-chip-label">${t('divorce.crude_rate_label')}</span>
          <span class="indicator-chip-value">${formatNumber(ind.crude_rate, lang)}</span>
          <span class="indicator-chip-sub">${t('divorce.per_thousand')}</span>
        </div>
        <div class="indicator-chip">
          <span class="indicator-chip-label">${t('divorce.avg_ages_title')}</span>
          <span class="indicator-chip-value">${t('common.male')}: ${formatNumber(ind.male_average_age, lang)} · ${t('common.female')}: ${formatNumber(ind.female_average_age, lang)}</span>
          <span class="indicator-chip-sub">Table 28 (Men vs Women)</span>
        </div>
      </div>

      <div class="cohort-bar-wrapper">
        <div class="cohort-bar-labels">
          <span style="color: #818cf8;">● ${t('divorce.granted_2025')}: ${formatNumber(ind.granted_in_2025_count, lang)}</span>
          <span style="color: #fb923c;">● ${t('divorce.granted_before')}: ${formatNumber(ind.granted_before_count, lang)}</span>
        </div>
        <div class="cohort-bar-track" title="58.7% in 2025, 41.3% prior to 2025">
          <div class="cohort-bar-fill-2025" style="width: ${100 - ind.granted_before_percent}%;"></div>
          <div class="cohort-bar-fill-before" style="width: ${ind.granted_before_percent}%;"></div>
        </div>
      </div>
    `;
  }

  update(_dt: number, elapsed: number): void {
    // Subtle gentle pulsation of the quiet lanterns
    this.lanterns.forEach((light, i) => {
      light.intensity = 1.0 + Math.sin(elapsed * 2.0 + i * Math.PI) * 0.2;
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

import * as THREE from 'three';
import * as d3 from 'd3';
import { BaseScene } from './SceneBase';
import { SceneContext, SceneId } from '../director/types';
import { GuessReveal, GuessRevealSeries } from '../ui/GuessReveal';
import { t, formatNumber, getLanguage, onLanguageChange } from '../i18n';

export interface MarriageData {
  id: string;
  source: {
    sheet: string;
    table_sheet: string;
    title: string;
    note: string;
  };
  unit: string;
  labels: string[];
  series: {
    male: number[];
    female: number[];
    total: number[];
  };
  peaks: {
    female_peak_bracket: string;
    female_peak_count: number;
    male_peak_bracket: string;
    male_peak_count: number;
  };
  trend_2019_2025: Array<{
    year: number;
    marriages: number;
    population: number;
    crude_rate: number;
  }>;
  caption_key: string;
  caveat_key: string;
}

export class MarriageScene extends BaseScene {
  id: SceneId = 'marriage';
  private group: THREE.Group = new THREE.Group();
  private marriageData: MarriageData | null = null;
  private guessReveal: GuessReveal | null = null;
  private unregisterI18n: (() => void) | null = null;

  // 3D Visuals: Golden Ceremonial Rings
  private ringsGroup: THREE.Group = new THREE.Group();
  private ringMesh1: THREE.Mesh | null = null;
  private ringMesh2: THREE.Mesh | null = null;

  async load(): Promise<void> {
    if (this.marriageData) return;

    try {
      const response = await fetch('/data/marriage.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading /data/marriage.json`);
      }
      this.marriageData = await response.json();
    } catch (err) {
      console.error('[MarriageScene] Error loading /data/marriage.json:', err);
    }

    await super.load();
  }

  async enter(ctx: SceneContext): Promise<void> {
    await super.enter(ctx);

    if (!this.marriageData) {
      await this.load();
    }

    // 1. Position camera at Marriage station (t = 0.50 on rail)
    ctx.cameraRail.setProgress(0.50);

    // 2. Setup 3D Ceremonial Wedding Rings
    this.create3DProps();
    ctx.scene.add(this.group);

    // 3. Build Historical Trend Card (Table 18)
    const trendCard = this.createTrendCard();

    // 4. Initialize Reusable GuessReveal Component
    const series: GuessRevealSeries[] = [
      {
        id: 'male',
        labelKey: 'common.male',
        values: this.marriageData?.series.male ?? [],
        color: '#0284c7', // Cyan/Sky blue for grooms
      },
      {
        id: 'female',
        labelKey: 'common.female',
        values: this.marriageData?.series.female ?? [],
        color: '#10b981', // Emerald green for brides
      },
    ];

    const initialIdx = 2; // "25-29"

    this.guessReveal = new GuessReveal({
      id: 'marriage-guess',
      container: ctx.uiContainer,
      stationTag: 'Station 3 · Marriage',
      titleKey: 'marriage.title',
      instructionKey: 'marriage.instruction',
      guessFormatKey: 'marriage.your_guess',
      labels: this.marriageData?.labels ?? ['Below 21', '21-24', '25-29', '30-34', '35-39', '40+'],
      series,
      unit: 'marriages',
      markerIcon: '💍',
      initialGuessIndex: initialIdx,
      insights: [
        {
          type: 'bride',
          title: t('common.female'),
          text: t('marriage.bride_peak'),
        },
        {
          type: 'groom',
          title: t('common.male'),
          text: t('marriage.groom_peak'),
        },
      ],
      extraContent: trendCard,
      caveatKey: this.marriageData?.caveat_key ?? 'caveat.marriage_registration',
      sourceSheet: 'Figure 30 & Table 18',
      continueBtnKey: 'marriage.continue_btn',
      onGuessSubmitted: (idx, _label) => {
        // Save guess in GameState
        const approxAge = idx === 0 ? 19 : idx === 1 ? 23 : idx === 2 ? 27 : idx === 3 ? 32 : idx === 4 ? 37 : 42;
        ctx.updateState({
          guesses: {
            ...ctx.state.guesses,
            marriageAge: approxAge,
          },
        });
      },
      onContinue: () => {
        ctx.goToScene('divorce');
      },
    });

    this.unregisterI18n = onLanguageChange(() => {
      this.updateTrendCard(trendCard);
    });
  }

  private create3DProps(): void {
    this.ringsGroup.clear();

    // Golden wedding ring material
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.92,
      roughness: 0.22,
      emissive: 0x78350f,
      emissiveIntensity: 0.2,
    });

    const ringGeom = new THREE.TorusGeometry(0.7, 0.12, 16, 40);

    this.ringMesh1 = new THREE.Mesh(ringGeom, goldMat);
    this.ringMesh1.position.set(-0.35, 1.8, -0.2);
    this.ringMesh1.rotation.set(Math.PI / 4, Math.PI / 6, 0);

    this.ringMesh2 = new THREE.Mesh(ringGeom, goldMat);
    this.ringMesh2.position.set(0.35, 1.8, 0.2);
    this.ringMesh2.rotation.set(-Math.PI / 4, -Math.PI / 6, 0);

    this.ringsGroup.add(this.ringMesh1);
    this.ringsGroup.add(this.ringMesh2);

    // Warm golden station light
    const ringLight = new THREE.PointLight(0xfef08a, 1.5, 8.0);
    ringLight.position.set(0, 2.2, 0);
    this.ringsGroup.add(ringLight);

    // Position group in front of marriage station overlook
    this.ringsGroup.position.set(15, 4.5, -10);
    this.group.add(this.ringsGroup);
  }

  private createTrendCard(): HTMLElement {
    const card = document.createElement('div');
    card.className = 'marriage-trend-card';
    this.updateTrendCard(card);
    return card;
  }

  private updateTrendCard(card: HTMLElement): void {
    if (!this.marriageData) return;
    const trend = this.marriageData.trend_2019_2025;
    const lang = getLanguage();

    card.innerHTML = `
      <h3 class="trend-card-title">${t('marriage.trend_title')}</h3>
      <p class="trend-card-caption">${t('marriage.trend_caption')}</p>
      <div class="trend-chart-slot"></div>
    `;

    const slot = card.querySelector('.trend-chart-slot') as HTMLElement;
    if (!slot) return;

    const width = 720;
    const height = 150;
    const margin = { top: 18, right: 25, bottom: 25, left: 55 };

    const svg = d3.select(slot)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'trend-chart-svg');

    const x = d3.scaleLinear()
      .domain([2019, 2025])
      .range([margin.left, width - margin.right]);

    const maxMarriages = d3.max(trend, (d) => d.marriages) || 60000;
    const y = d3.scaleLinear()
      .domain([25000, maxMarriages * 1.08])
      .range([height - margin.bottom, margin.top]);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(7).tickFormat(d3.format('d')))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    // Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat((d) => formatNumber(d as number, lang)))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px');

    svg.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.12)');
    svg.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.06)');

    // Gradient fill under the line
    const area = d3.area<any>()
      .x((d) => x(d.year))
      .y0(height - margin.bottom)
      .y1((d) => y(d.marriages))
      .curve(d3.curveMonotoneX);

    const line = d3.line<any>()
      .x((d) => x(d.year))
      .y((d) => y(d.marriages))
      .curve(d3.curveMonotoneX);

    const gradId = 'trend-area-grad';
    const defs = svg.append('defs');
    const grad = defs.append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#fbbf24').attr('stop-opacity', 0.45);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#fbbf24').attr('stop-opacity', 0.0);

    svg.append('path')
      .datum(trend)
      .attr('fill', `url(#${gradId})`)
      .attr('d', area);

    svg.append('path')
      .datum(trend)
      .attr('fill', 'none')
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 2.5)
      .attr('d', line);

    // Data points & callouts
    trend.forEach((d) => {
      const cx = x(d.year);
      const cy = y(d.marriages);

      svg.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 4)
        .attr('fill', '#ffffff')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2);

      // Label 2020 dip and 2023 peak
      if (d.year === 2020 || d.year === 2023 || d.year === 2025) {
        svg.append('text')
          .attr('x', cx)
          .attr('y', cy - 8)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fef08a')
          .attr('font-size', '9px')
          .attr('font-weight', '700')
          .text(formatNumber(d.marriages, lang));
      }
    });
  }

  update(dt: number, elapsed: number): void {
    // Gentle rotation of the ceremonial 3D rings
    if (this.ringMesh1 && this.ringMesh2) {
      this.ringMesh1.rotation.y += dt * 0.4;
      this.ringMesh2.rotation.y -= dt * 0.4;
      this.ringsGroup.position.y = 4.5 + Math.sin(elapsed * 1.5) * 0.12;
    }
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

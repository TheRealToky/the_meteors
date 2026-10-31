import * as d3 from 'd3';
import { t, formatNumber, formatPercent, getLanguage, onLanguageChange } from '../i18n';

export interface PyramidData {
  id: string;
  source: {
    sheet: string;
    title: string;
    table_ref?: string;
    note?: string;
  };
  unit: string;
  labels: string[];
  series: {
    male: number[];
    female: number[];
    total: number[];
  };
  indicators: {
    total_population: number;
    male_population: number;
    female_population: number;
    sex_ratio: number;
  };
  caption_key: string;
  caveat_key: string;
}

export interface PopulationPyramidOptions {
  data: PyramidData;
  container: HTMLElement;
  selectedSex: 'male' | 'female';
  onSelectSex?: (sex: 'male' | 'female') => void;
  onStart?: () => void;
}

export class PopulationPyramid {
  private container: HTMLElement;
  private data: PyramidData;
  private selectedSex: 'male' | 'female';
  private onSelectSex?: (sex: 'male' | 'female') => void;
  private onStart?: () => void;

  private rootElement: HTMLElement;
  private svgContainer: HTMLElement;
  private tableContainer: HTMLElement;
  private tooltipElement: HTMLElement;
  private isTableView: boolean = false;
  private unregisterI18n?: () => void;

  constructor(options: PopulationPyramidOptions) {
    this.container = options.container;
    this.data = options.data;
    this.selectedSex = options.selectedSex;
    this.onSelectSex = options.onSelectSex;
    this.onStart = options.onStart;

    this.rootElement = document.createElement('div');
    this.rootElement.className = 'pyramid-view-wrapper glass-panel';

    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = 'pyramid-tooltip';
    this.tooltipElement.style.display = 'none';

    this.svgContainer = document.createElement('div');
    this.svgContainer.className = 'pyramid-svg-container';

    this.tableContainer = document.createElement('div');
    this.tableContainer.className = 'pyramid-table-container';
    this.tableContainer.style.display = 'none';

    this.render();

    this.unregisterI18n = onLanguageChange(() => {
      this.updateLanguage();
    });
  }

  public getElement(): HTMLElement {
    return this.rootElement;
  }

  public setSelectedSex(sex: 'male' | 'female'): void {
    this.selectedSex = sex;
    this.updateSexSelector();
  }

  public render(): void {
    this.rootElement.innerHTML = '';

    // 1. Header with title & badges
    const header = document.createElement('div');
    header.className = 'pyramid-header';
    header.innerHTML = `
      <div class="pyramid-header-top">
        <div class="pyramid-badge-row">
          <span class="pyramid-badge highlight">Figure 1</span>
          <span class="pyramid-badge">${t('pyramid.total_population')}</span>
          <span class="pyramid-badge">${t('pyramid.median_age')}</span>
        </div>
        <button class="pyramid-toggle-btn" id="btn-toggle-table" aria-expanded="${this.isTableView}">
          <span class="toggle-icon" aria-hidden="true">${this.isTableView ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>'}</span>
          <span class="toggle-text">${this.isTableView ? t('common.view_chart') : t('common.view_table')}</span>
        </button>
      </div>
      <h2 class="pyramid-title">${t('intro.pyramid_title')}</h2>
      <p class="pyramid-subtitle">${t('intro.subtitle')}</p>
    `;
    this.rootElement.appendChild(header);

    // 2. Legend & Sex Selection Card
    const controlCard = document.createElement('div');
    controlCard.className = 'pyramid-controls-card';
    controlCard.innerHTML = `
      <div class="pyramid-legend">
        <div class="legend-item legend-male">
          <span class="legend-swatch male-swatch"></span>
          <span class="legend-text"><strong>${t('pyramid.male')}</strong>: ${formatNumber(this.data.indicators.male_population, getLanguage())} (${formatPercent((this.data.indicators.male_population / this.data.indicators.total_population) * 100, getLanguage(), 1)})</span>
        </div>
        <div class="legend-item legend-female">
          <span class="legend-swatch female-swatch"></span>
          <span class="legend-text"><strong>${t('pyramid.female')}</strong>: ${formatNumber(this.data.indicators.female_population, getLanguage())} (${formatPercent((this.data.indicators.female_population / this.data.indicators.total_population) * 100, getLanguage(), 1)})</span>
        </div>
      </div>

      <!-- avoid-ai-design-ignore: I2 -->
      <div class="sex-selector-group">
        <span class="sex-selector-label">${t('intro.pick_sex')}</span>
        <div class="sex-buttons" role="radiogroup" aria-label="${t('intro.pick_sex')}">
          <button class="sex-btn ${this.selectedSex === 'female' ? 'active' : ''}" data-sex="female" role="radio" aria-checked="${this.selectedSex === 'female'}">
            <span class="sex-icon" aria-hidden="true">♀</span>
            <span>${t('common.female')}</span>
          </button>
          <button class="sex-btn ${this.selectedSex === 'male' ? 'active' : ''}" data-sex="male" role="radio" aria-checked="${this.selectedSex === 'male'}">
            <span class="sex-icon" aria-hidden="true">♂</span>
            <span>${t('common.male')}</span>
          </button>
        </div>
        <button class="btn-start-life primary-btn" id="btn-start-journey">
          <span>${t('intro.start_button')}</span>
        </button>
      </div>
    `;
    this.rootElement.appendChild(controlCard);

    // 3. Visualization Container (D3 SVG + Table)
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'pyramid-content-wrapper';
    contentWrapper.appendChild(this.svgContainer);
    contentWrapper.appendChild(this.tableContainer);
    contentWrapper.appendChild(this.tooltipElement);
    this.rootElement.appendChild(contentWrapper);

    // 4. Footer Note & Caveat
    const footer = document.createElement('div');
    footer.className = 'pyramid-footer';
    footer.innerHTML = `
      <div class="caption-bubble">
        <span class="caption-icon" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg></span>
        <p class="caption-text">${t(this.data.caption_key)}</p>
      </div>
      <div class="caveat-bubble">
        <span class="caveat-label">${t('common.caveat')}:</span>
        <span class="caveat-text">${t(this.data.caveat_key)}</span>
      </div>
    `;
    this.rootElement.appendChild(footer);

    this.container.appendChild(this.rootElement);

    // Bind event handlers
    this.bindUIEvents();

    // Render D3 Pyramid and Table
    this.renderD3Pyramid();
    this.renderTable();
  }

  private bindUIEvents(): void {
    // Table toggle
    const toggleBtn = this.rootElement.querySelector('#btn-toggle-table') as HTMLButtonElement;
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.isTableView = !this.isTableView;
        if (this.isTableView) {
          this.svgContainer.style.display = 'none';
          this.tableContainer.style.display = 'block';
          toggleBtn.querySelector('.toggle-icon')!.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>';
          toggleBtn.querySelector('.toggle-text')!.textContent = t('common.view_chart');
          toggleBtn.setAttribute('aria-expanded', 'true');
        } else {
          this.svgContainer.style.display = 'block';
          this.tableContainer.style.display = 'none';
          toggleBtn.querySelector('.toggle-icon')!.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>';
          toggleBtn.querySelector('.toggle-text')!.textContent = t('common.view_table');
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Sex selector buttons
    this.rootElement.querySelectorAll('.sex-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sex = (btn as HTMLElement).dataset.sex as 'male' | 'female';
        if (sex) {
          this.selectedSex = sex;
          this.updateSexSelector();
          if (this.onSelectSex) {
            this.onSelectSex(sex);
          }
        }
      });
    });

    // Start button
    const startBtn = this.rootElement.querySelector('#btn-start-journey') as HTMLButtonElement;
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (this.onStart) {
          this.onStart();
        }
      });
    }
  }

  private updateSexSelector(): void {
    this.rootElement.querySelectorAll('.sex-btn').forEach((btn) => {
      const sex = (btn as HTMLElement).dataset.sex;
      if (sex === this.selectedSex) {
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
      }
    });
  }

  private renderD3Pyramid(): void {
    this.svgContainer.innerHTML = '';

    const width = 760;
    const height = 400;
    const margin = { top: 30, right: 35, bottom: 35, left: 35 };
    const centerGap = 64; // Space in center for age labels

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const halfWidth = (chartWidth - centerGap) / 2;

    const maxVal = d3.max([
      ...this.data.series.male,
      ...this.data.series.female,
    ]) ?? 1000000;

    // SVG container with viewBox for responsive scaling
    const svg = d3
      .select(this.svgContainer)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('class', 'pyramid-svg')
      .attr('role', 'img')
      .attr('aria-label', t('pyramid.aria_label'));

    // Defs for gradients & patterns
    const defs = svg.append('defs');

    // Male gradient (Teal-Cyan / ocean)
    const maleGrad = defs
      .append('linearGradient')
      .attr('id', 'maleGrad')
      .attr('x1', '100%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '0%');
    maleGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0284c7');
    maleGrad.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8');

    // Female gradient (Amber-Gold / sunset)
    const femaleGrad = defs
      .append('linearGradient')
      .attr('id', 'femaleGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');
    femaleGrad.append('stop').attr('offset', '0%').attr('stop-color', '#d97706');
    femaleGrad.append('stop').attr('offset', '100%').attr('stop-color', '#fbbf24');

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Y scale (Age bands)
    const yScale = d3
      .scaleBand()
      .domain(this.data.labels)
      .range([chartHeight, 0])
      .padding(0.2);

    // X scale
    const xScale = d3.scaleLinear().domain([0, maxVal * 1.05]).range([0, halfWidth]);

    // Subtle background guidelines
    const ticks = [200000, 400000, 600000, 800000];
    ticks.forEach((tickVal) => {
      if (tickVal <= maxVal) {
        const xOffset = xScale(tickVal);

        // Male side guideline
        g.append('line')
          .attr('x1', halfWidth - xOffset)
          .attr('x2', halfWidth - xOffset)
          .attr('y1', 0)
          .attr('y2', chartHeight)
          .attr('stroke', 'rgba(255, 255, 255, 0.07)')
          .attr('stroke-dasharray', '2,2');

        // Female side guideline
        g.append('line')
          .attr('x1', halfWidth + centerGap + xOffset)
          .attr('x2', halfWidth + centerGap + xOffset)
          .attr('y1', 0)
          .attr('y2', chartHeight)
          .attr('stroke', 'rgba(255, 255, 255, 0.07)')
          .attr('stroke-dasharray', '2,2');
      }
    });

    // Rows for each age band
    this.data.labels.forEach((label, i) => {
      const maleCount = this.data.series.male[i];
      const femaleCount = this.data.series.female[i];
      const totalCount = this.data.series.total[i];
      const y = yScale(label) ?? 0;
      const barHeight = yScale.bandwidth();

      const rowG = g
        .append('g')
        .attr('class', 'pyramid-row')
        .style('cursor', 'pointer');

      // Male bar (expands leftwards from halfWidth)
      const maleBarWidth = xScale(maleCount);
      rowG
        .append('rect')
        .attr('class', 'bar bar-male')
        .attr('x', halfWidth - maleBarWidth)
        .attr('y', y)
        .attr('width', maleBarWidth)
        .attr('height', barHeight)
        .attr('rx', 3)
        .attr('fill', 'url(#maleGrad)')
        .attr('opacity', 0.9);

      // Female bar (expands rightwards from halfWidth + centerGap)
      const femaleBarWidth = xScale(femaleCount);
      rowG
        .append('rect')
        .attr('class', 'bar bar-female')
        .attr('x', halfWidth + centerGap)
        .attr('y', y)
        .attr('width', femaleBarWidth)
        .attr('height', barHeight)
        .attr('rx', 3)
        .attr('fill', 'url(#femaleGrad)')
        .attr('opacity', 0.9);

      // Age band center label (ID localized if last bucket)
      const displayLabel = label === '80+' ? t('age.last_bucket') : label;
      rowG
        .append('text')
        .attr('class', 'pyramid-label')
        .attr('x', halfWidth + centerGap / 2)
        .attr('y', y + barHeight / 2 + 3.5)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255, 255, 255, 0.85)')
        .attr('font-size', '10px')
        .attr('font-weight', '600')
        .text(displayLabel);

      // Invisible hit area for smooth hovering across the entire age row
      rowG
        .append('rect')
        .attr('x', 0)
        .attr('y', y)
        .attr('width', chartWidth)
        .attr('height', barHeight)
        .attr('fill', 'transparent')
        .on('mouseenter', (event: MouseEvent) => {
          rowG.selectAll('.bar').attr('opacity', 1).attr('filter', 'brightness(1.2)');

          const totalPop = this.data.indicators.total_population;
          const share = ((totalCount / totalPop) * 100).toFixed(1);

          this.tooltipElement.innerHTML = `
            <div class="tip-age"><strong>${t('common.age', { age: displayLabel })}</strong></div>
            <div class="tip-row tip-male">
              <span>${t('common.male')}:</span>
              <strong>${formatNumber(maleCount, getLanguage())}</strong>
            </div>
            <div class="tip-row tip-female">
              <span>${t('common.female')}:</span>
              <strong>${formatNumber(femaleCount, getLanguage())}</strong>
            </div>
            <div class="tip-divider"></div>
            <div class="tip-total">
              <span>${t('common.both_sexes')}:</span>
              <strong>${formatNumber(totalCount, getLanguage())}</strong>
            </div>
            <div class="tip-share">${t('pyramid.share_of_total', { percent: share })}</div>
          `;
          this.tooltipElement.style.display = 'block';
          this.positionTooltip(event);
        })
        .on('mousemove', (event: MouseEvent) => {
          this.positionTooltip(event);
        })
        .on('mouseleave', () => {
          rowG.selectAll('.bar').attr('opacity', 0.9).attr('filter', 'none');
          this.tooltipElement.style.display = 'none';
        });
    });

    // Axis headers (Male side / Female side)
    g.append('text')
      .attr('x', halfWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#38bdf8')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .text(t('pyramid.male').toUpperCase());

    g.append('text')
      .attr('x', halfWidth + centerGap + halfWidth / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fbbf24')
      .attr('font-size', '11px')
      .attr('font-weight', '700')
      .text(t('pyramid.female').toUpperCase());
  }

  private positionTooltip(event: MouseEvent): void {
    const bounds = this.svgContainer.getBoundingClientRect();
    const x = event.clientX - bounds.left + 15;
    const y = event.clientY - bounds.top - 15;

    this.tooltipElement.style.left = `${Math.min(x, bounds.width - 200)}px`;
    this.tooltipElement.style.top = `${Math.max(10, y)}px`;
  }

  private renderTable(): void {
    const totalPop = this.data.indicators.total_population;

    let rowsHtml = '';
    this.data.labels.forEach((label, i) => {
      const male = this.data.series.male[i];
      const female = this.data.series.female[i];
      const total = this.data.series.total[i];
      const displayLabel = label === '80+' ? t('age.last_bucket') : label;
      const share = ((total / totalPop) * 100).toFixed(1);

      rowsHtml += `
        <tr>
          <td class="col-age">${displayLabel}</td>
          <td class="col-num male-text">${formatNumber(male, getLanguage())}</td>
          <td class="col-num female-text">${formatNumber(female, getLanguage())}</td>
          <td class="col-num total-text">${formatNumber(total, getLanguage())}</td>
          <td class="col-num">${formatPercent(parseFloat(share), getLanguage(), 1)}</td>
        </tr>
      `;
    });

    const totalMale = this.data.indicators.male_population;
    const totalFemale = this.data.indicators.female_population;

    this.tableContainer.innerHTML = `
      <div class="table-scroll-wrapper">
        <table class="pyramid-data-table" aria-label="${t('pyramid.table_caption')}">
          <caption>${t('pyramid.table_caption')}</caption>
          <thead>
            <tr>
              <th scope="col">${t('pyramid.age_group')}</th>
              <th scope="col">${t('common.male')}</th>
              <th scope="col">${t('common.female')}</th>
              <th scope="col">${t('common.both_sexes')}</th>
              <th scope="col">%</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr class="table-total-row">
              <th scope="row">${t('pyramid.total_population')}</th>
              <td class="col-num male-text">${formatNumber(totalMale, getLanguage())}</td>
              <td class="col-num female-text">${formatNumber(totalFemale, getLanguage())}</td>
              <td class="col-num total-text">${formatNumber(totalPop, getLanguage())}</td>
              <td class="col-num">100.0%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  public updateLanguage(): void {
    // Re-render completely with active language translations and locale number formatting
    this.render();
  }

  public dispose(): void {
    if (this.unregisterI18n) {
      this.unregisterI18n();
    }
    if (this.rootElement.parentElement) {
      this.rootElement.parentElement.removeChild(this.rootElement);
    }
  }
}

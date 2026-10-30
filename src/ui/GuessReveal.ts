import * as d3 from 'd3';
import { t, formatNumber, getLanguage, onLanguageChange } from '../i18n';

export interface GuessRevealSeries {
  id: string;
  labelKey: string;
  values: number[];
  color: string;
}

export interface GuessRevealInsight {
  type?: 'bride' | 'groom' | 'general';
  title?: string;
  text: string;
}

export interface GuessRevealConfig {
  id: string;
  container: HTMLElement;
  stationTag?: string;
  titleKey: string;
  instructionKey: string;
  guessFormatKey: string;
  labels: string[];
  series: GuessRevealSeries[];
  unit: string;
  markerIcon?: string;
  initialGuessIndex?: number;
  insights?: GuessRevealInsight[];
  extraContent?: HTMLElement;
  caveatKey?: string;
  sourceSheet?: string;
  onGuessSubmitted?: (guessIndex: number, guessLabel: string) => void;
  onContinue?: () => void;
  continueBtnKey?: string;
}

export class GuessReveal {
  private config: GuessRevealConfig;
  private root: HTMLElement | null = null;
  private currentIndex: number;
  private isRevealed: boolean = false;
  private isTableView: boolean = false;

  private unregisterI18n: (() => void) | null = null;

  // DOM references
  private thumbEl: HTMLElement | null = null;
  private fillEl: HTMLElement | null = null;
  private activeGuessEl: HTMLElement | null = null;
  private revealContainerEl: HTMLElement | null = null;

  constructor(config: GuessRevealConfig) {
    this.config = config;
    this.currentIndex = config.initialGuessIndex ?? Math.floor(config.labels.length / 2);

    this.render();

    this.unregisterI18n = onLanguageChange(() => {
      this.updateLanguage();
    });
  }

  public getElement(): HTMLElement | null {
    return this.root;
  }

  public getGuessedIndex(): number {
    return this.currentIndex;
  }

  public getGuessedLabel(): string {
    return this.config.labels[this.currentIndex];
  }

  public render(): void {
    if (this.root) {
      this.root.remove();
    }

    const c = this.config;

    this.root = document.createElement('div');
    this.root.className = 'guess-reveal-card glass-panel';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', t(c.titleKey));

    this.root.innerHTML = `
      <div class="guess-reveal-header">
        <div class="guess-badge-row">
          <span class="station-badge-gold">${c.stationTag ?? 'Interactive Data Guess'}</span>
          ${c.sourceSheet ? `<span class="pill-badge">Source: ${c.sourceSheet}</span>` : ''}
        </div>
        <h2 class="guess-title">${t(c.titleKey)}</h2>
        <p class="guess-instruction">${t(c.instructionKey)}</p>
      </div>

      <!-- Guess Interactive Slider Area -->
      <div class="guess-interactive-area" id="guess-area">
        <div class="guess-feedback-row">
          <div class="guess-active-display">
            <span class="guess-marker-icon">${c.markerIcon ?? '📍'}</span>
            <span id="guess-active-text">${this.formatGuessText(this.currentIndex)}</span>
          </div>
          <button id="btn-submit-guess" class="guess-submit-btn" tabindex="0">
            ${this.isRevealed ? t('guess_reveal.actual_peak_badge') : t('guess_reveal.reveal_button')}
          </button>
        </div>

        <div class="guess-slider-track" id="slider-track" role="slider"
             aria-valuemin="0" aria-valuemax="${c.labels.length - 1}"
             aria-valuenow="${this.currentIndex}"
             aria-valuetext="${c.labels[this.currentIndex]}"
             tabindex="0"
             aria-label="${t('guess_reveal.drag_instruction')}">
          <div class="slider-base-line"></div>
          <div class="slider-active-fill" id="slider-fill"></div>
          <div class="guess-thumb" id="slider-thumb">${c.markerIcon ?? '●'}</div>
          <div class="guess-ticks-row">
            ${c.labels.map((l, i) => `
              <span class="guess-tick-label ${i === this.currentIndex ? 'active' : ''}" data-idx="${i}">
                ${l}
              </span>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Container for Revealed Data -->
      <div id="reveal-content-slot" class="reveal-content-section" style="${this.isRevealed ? '' : 'display: none;'}">
      </div>
    `;

    this.thumbEl = this.root.querySelector('#slider-thumb');
    this.fillEl = this.root.querySelector('#slider-fill');
    this.activeGuessEl = this.root.querySelector('#guess-active-text');
    this.revealContainerEl = this.root.querySelector('#reveal-content-slot');

    this.updateThumbPosition();
    this.bindSliderEvents();

    const submitBtn = this.root.querySelector('#btn-submit-guess') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.reveal();
      });
    }

    if (this.isRevealed) {
      this.renderRevealedContent();
    }

    this.config.container.appendChild(this.root);
  }

  private formatGuessText(index: number): string {
    const label = this.config.labels[index];
    // Check if label contains an age or year
    return t(this.config.guessFormatKey, {
      age: label,
      years: label,
    });
  }

  private setIndex(idx: number): void {
    const clamped = Math.max(0, Math.min(this.config.labels.length - 1, idx));
    if (clamped !== this.currentIndex) {
      this.currentIndex = clamped;
      this.updateThumbPosition();
      if (this.activeGuessEl) {
        this.activeGuessEl.textContent = this.formatGuessText(this.currentIndex);
      }
      const track = this.root?.querySelector('#slider-track');
      if (track) {
        track.setAttribute('aria-valuenow', this.currentIndex.toString());
        track.setAttribute('aria-valuetext', this.config.labels[this.currentIndex]);
      }
      this.root?.querySelectorAll('.guess-tick-label').forEach((el, i) => {
        if (i === this.currentIndex) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });
    }
  }

  private updateThumbPosition(): void {
    if (!this.thumbEl || !this.fillEl) return;
    const count = this.config.labels.length;
    const ratio = count > 1 ? this.currentIndex / (count - 1) : 0;
    const percent = ratio * 100;
    this.thumbEl.style.left = `${percent}%`;
    this.fillEl.style.width = `${percent}%`;
  }

  private bindSliderEvents(): void {
    const track = this.root?.querySelector('#slider-track') as HTMLElement;
    if (!track) return;

    // Click on ticks
    this.root?.querySelectorAll('.guess-tick-label').forEach((el) => {
      el.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.idx || '0', 10);
        this.setIndex(idx);
      });
    });

    // Keyboard controls on slider
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.setIndex(this.currentIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.setIndex(this.currentIndex - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.reveal();
      }
    });

    // Mouse and Touch Dragging
    const handleMove = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      const norm = (clientX - rect.left) / rect.width;
      const count = this.config.labels.length;
      const idx = Math.round(norm * (count - 1));
      this.setIndex(idx);
    };

    let isDragging = false;

    track.addEventListener('mousedown', (e) => {
      isDragging = true;
      handleMove(e.clientX);

      const onMouseMove = (ev: MouseEvent) => {
        if (isDragging) handleMove(ev.clientX);
      };
      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    track.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        isDragging = true;
        handleMove(e.touches[0].clientX);
      }
    }, { passive: true });

    track.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches.length > 0) {
        handleMove(e.touches[0].clientX);
      }
    }, { passive: true });

    track.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  public reveal(): void {
    if (this.isRevealed) return;
    this.isRevealed = true;

    if (this.config.onGuessSubmitted) {
      this.config.onGuessSubmitted(this.currentIndex, this.config.labels[this.currentIndex]);
    }

    if (this.revealContainerEl) {
      this.revealContainerEl.style.display = 'flex';
      this.renderRevealedContent();
    }

    const submitBtn = this.root?.querySelector('#btn-submit-guess') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.textContent = '✓ Revealed';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';
    }
  }

  private renderRevealedContent(): void {
    if (!this.revealContainerEl) return;
    this.revealContainerEl.innerHTML = '';

    const c = this.config;

    // Controls bar: Legend + Table View Toggle
    const controlsBar = document.createElement('div');
    controlsBar.className = 'chart-controls-bar';

    const legendDiv = document.createElement('div');
    legendDiv.className = 'chart-legend';
    legendDiv.innerHTML = c.series.map((s) => `
      <div class="legend-item">
        <span class="legend-color-box" style="background: ${s.color};"></span>
        <span>${t(s.labelKey)}</span>
      </div>
    `).join('') + `
      <div class="legend-item">
        <span class="guess-marker-icon" style="font-size: 1rem;">${c.markerIcon ?? '📍'}</span>
        <span style="color: #fef08a;">${t('guess_reveal.your_guess_badge')}</span>
      </div>
    `;
    controlsBar.appendChild(legendDiv);

    const toggleTableBtn = document.createElement('button');
    toggleTableBtn.className = 'table-toggle-btn';
    toggleTableBtn.textContent = this.isTableView ? t('common.view_chart') : t('common.view_table');
    toggleTableBtn.addEventListener('click', () => {
      this.isTableView = !this.isTableView;
      toggleTableBtn.textContent = this.isTableView ? t('common.view_chart') : t('common.view_table');
      if (chartContainer && tableContainer) {
        chartContainer.style.display = this.isTableView ? 'none' : 'block';
        tableContainer.style.display = this.isTableView ? 'block' : 'none';
      }
    });
    controlsBar.appendChild(toggleTableBtn);
    this.revealContainerEl.appendChild(controlsBar);

    // Chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'd3-chart-wrapper';
    chartContainer.style.display = this.isTableView ? 'none' : 'block';
    this.revealContainerEl.appendChild(chartContainer);

    this.renderD3BarChart(chartContainer);

    // Table view container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'guess-data-table-wrapper';
    tableContainer.style.display = this.isTableView ? 'block' : 'none';
    tableContainer.innerHTML = this.renderAccessibleTable();
    this.revealContainerEl.appendChild(tableContainer);

    // Insight callouts (if provided)
    if (c.insights && c.insights.length > 0) {
      const insightsGrid = document.createElement('div');
      insightsGrid.className = 'reveal-insights-grid';
      insightsGrid.innerHTML = c.insights.map((ins) => `
        <div class="insight-card ${ins.type === 'bride' ? 'highlight-bride' : ins.type === 'groom' ? 'highlight-groom' : ''}">
          ${ins.title ? `<span class="insight-title">${ins.title}</span>` : ''}
          <p class="insight-text">${ins.text}</p>
        </div>
      `).join('');
      this.revealContainerEl.appendChild(insightsGrid);
    }

    // Extra custom station content (e.g. Marriage historical trend line chart)
    if (c.extraContent) {
      this.revealContainerEl.appendChild(c.extraContent);
    }

    // Card footer: Caveat + Continue Button
    const footer = document.createElement('div');
    footer.className = 'guess-card-footer';

    if (c.caveatKey) {
      const caveatEl = document.createElement('p');
      caveatEl.className = 'caveat-text';
      caveatEl.innerHTML = `⚠️ <strong>${t('common.caveat')}:</strong> ${t(c.caveatKey)}`;
      footer.appendChild(caveatEl);
    }

    if (c.onContinue) {
      const continueBtn = document.createElement('button');
      continueBtn.className = 'marriage-next-btn primary-btn';
      continueBtn.textContent = c.continueBtnKey ? t(c.continueBtnKey) : t('nav.next');
      continueBtn.addEventListener('click', () => {
        c.onContinue?.();
      });
      footer.appendChild(continueBtn);
    }

    this.revealContainerEl.appendChild(footer);
  }

  private renderD3BarChart(container: HTMLElement): void {
    const c = this.config;
    const labels = c.labels;
    const seriesList = c.series;
    const guessIdx = this.currentIndex;

    const width = 760;
    const height = 240;
    const margin = { top: 28, right: 20, bottom: 35, left: 55 };

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('class', 'd3-chart-svg');

    const x0 = d3.scaleBand()
      .domain(labels)
      .range([margin.left, width - margin.right])
      .paddingInner(0.2);

    const x1 = d3.scaleBand()
      .domain(seriesList.map((s) => s.id))
      .range([0, x0.bandwidth()])
      .padding(0.08);

    const maxVal = d3.max(seriesList.flatMap((s) => s.values)) || 1000;
    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.15])
      .range([height - margin.bottom, margin.top]);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x0).tickSizeOuter(0))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '11px')
      .attr('font-weight', '600');

    // Y Axis
    svg.append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => formatNumber(d as number, getLanguage())))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px');

    svg.selectAll('.domain').attr('stroke', 'rgba(255,255,255,0.15)');
    svg.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.08)');

    // Bars
    const group = svg.append('g')
      .selectAll('g')
      .data(labels)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${x0(d)}, 0)`);

    seriesList.forEach((s) => {
      group.append('rect')
        .attr('class', 'bar-rect')
        .attr('x', () => x1(s.id) || 0)
        .attr('width', x1.bandwidth())
        .attr('y', height - margin.bottom)
        .attr('height', 0)
        .attr('fill', s.color)
        .attr('rx', 3)
        .transition()
        .duration(800)
        .delay((_, i) => i * 60)
        .attr('y', (_, i) => y(s.values[i]))
        .attr('height', (_, i) => height - margin.bottom - y(s.values[i]));
    });

    // Pinned Guess Marker Pin
    const guessX = (x0(labels[guessIdx]) || 0) + x0.bandwidth() / 2;
    const pinG = svg.append('g')
      .attr('transform', `translate(${guessX}, 14)`);

    pinG.append('circle')
      .attr('r', 10)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    pinG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .text(c.markerIcon ?? '📍');

    pinG.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -12)
      .attr('fill', '#fef08a')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .text(t('guess_reveal.your_guess_badge'));
  }

  private renderAccessibleTable(): string {
    const c = this.config;
    const lang = getLanguage();

    const headers = [
      `<th>Category</th>`,
      ...c.series.map((s) => `<th>${t(s.labelKey)}</th>`),
    ].join('');

    const rows = c.labels.map((label, idx) => {
      const isUserGuess = idx === this.currentIndex;
      const cells = [
        `<td><strong>${label}</strong> ${isUserGuess ? `<span style="color:#fef08a;">(${t('guess_reveal.your_guess_badge')})</span>` : ''}</td>`,
        ...c.series.map((s) => `<td>${formatNumber(s.values[idx], lang)}</td>`),
      ].join('');
      return `<tr>${cells}</tr>`;
    }).join('');

    return `
      <table class="guess-table" role="table" aria-label="${t(c.titleKey)}">
        <thead>
          <tr>${headers}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  public updateLanguage(): void {
    if (this.root) {
      this.render();
    }
  }

  public dispose(): void {
    if (this.unregisterI18n) {
      this.unregisterI18n();
      this.unregisterI18n = null;
    }
    if (this.root) {
      this.root.remove();
      this.root = null;
    }
  }
}

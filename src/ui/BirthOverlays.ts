import { t, formatNumber, getLanguage, onLanguageChange } from '../i18n';

export interface BirthNameEntry {
  name: string;
  count: number;
}

export interface BirthOverlaysOptions {
  container: HTMLElement;
  birthData: {
    indicators: {
      registered_births: number;
      male_births?: number;
      female_births?: number;
      sex_ratio_at_birth?: number;
      registration_completeness?: number;
      fertility_rate?: number;
      fertility_statement?: string;
    };
    top_names: {
      female: BirthNameEntry[];
      male: BirthNameEntry[];
    };
  };
  playerSex: 'male' | 'female';
  existingName?: string;
  onContinue: () => void;
  onNameAssigned?: (name: string) => void;
}

export class BirthOverlays {
  private container: HTMLElement;
  private options: BirthOverlaysOptions;
  private root: HTMLElement | null = null;
  private unregisterI18n: (() => void) | null = null;

  private selectedName: string;
  private selectedNameCount: number = 0;

  constructor(options: BirthOverlaysOptions) {
    this.container = options.container;
    this.options = options;

    // 1. Determine player baby name
    if (options.existingName) {
      this.selectedName = options.existingName;
    } else {
      this.selectedName = this.drawWeightedName(options.playerSex);
      if (options.onNameAssigned) {
        options.onNameAssigned(this.selectedName);
      }
    }

    const list = this.options.birthData.top_names[options.playerSex] || [];
    const match = list.find((item) => item.name === this.selectedName);
    this.selectedNameCount = match ? match.count : (list[0]?.count ?? 1500);

    this.render();

    this.unregisterI18n = onLanguageChange(() => {
      this.updateLanguage();
    });
  }

  private drawWeightedName(sex: 'male' | 'female'): string {
    const list = this.options.birthData.top_names[sex] || [];
    if (!list || list.length === 0) return sex === 'female' ? 'INEZA' : 'ISHIMWE';

    const totalWeight = list.reduce((sum, item) => sum + item.count, 0);
    let randomNum = Math.random() * totalWeight;

    for (const item of list) {
      randomNum -= item.count;
      if (randomNum <= 0) {
        return item.name;
      }
    }
    return list[0].name;
  }

  public getSelectedName(): string {
    return this.selectedName;
  }

  public render(): void {
    if (this.root) {
      this.root.remove();
    }

    const lang = getLanguage();
    const ind = this.options.birthData.indicators;
    const totalBirthsFormatted = formatNumber(ind.registered_births, lang);
    const nameCountFormatted = formatNumber(this.selectedNameCount, lang);

    this.root = document.createElement('div');
    this.root.className = 'birth-milestone-panel glass-panel';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', t('birth.title'));

    const fertilityRate = ind.fertility_rate ?? 3.5;
    const sexRatio = ind.sex_ratio_at_birth ?? 102.7;
    const malePct = (sexRatio / (sexRatio + 100) * 100).toFixed(1);
    const femalePct = (100 - parseFloat(malePct)).toFixed(1);

    this.root.innerHTML = `
      <div class="birth-milestone-header">
        <div class="birth-status-badge">
          <span class="badge-dot"></span>
          <span>${t('birth.completeness')}</span>
        </div>
        <h3 class="birth-name-heading">
          <span class="name-prefix">${t('common.registered_count')}: 1 / ${totalBirthsFormatted}</span>
          <span class="drawn-name">${this.selectedName}</span>
        </h3>
        <p class="birth-name-note">
          ${t('birth.name_draw', { name: `<strong>${this.selectedName}</strong>` })}
          <span class="birth-name-sub">(${t('birth.name_share', { count: nameCountFormatted })})</span>
        </p>
      </div>

      <div class="birth-metrics-grid">
        <!-- 1. Fertility Rate Card (3.5 children per woman icons) -->
        <div class="birth-metric-card">
          <div class="metric-card-top">
            <span class="metric-tag">${t('birth.fertility_badge')}</span>
            <span class="metric-highlight">${formatNumber(fertilityRate, lang)}</span>
          </div>
          <p class="metric-statement">${t('birth.tfr_statement')}</p>
          
          <div class="fertility-icons-row" aria-label="${t('birth.tfr_statement')}">
            <div class="baby-icon-wrapper full" title="1">
              ${this.getBabySvg(1)}
            </div>
            <div class="baby-icon-wrapper full" title="2">
              ${this.getBabySvg(1)}
            </div>
            <div class="baby-icon-wrapper full" title="3">
              ${this.getBabySvg(1)}
            </div>
            <div class="baby-icon-wrapper half" title="0.5">
              ${this.getBabySvg(fertilityRate - Math.floor(fertilityRate) > 0 ? (fertilityRate - Math.floor(fertilityRate)) : 1)}
            </div>
          </div>
        </div>

        <!-- 2. Sex Ratio at Birth Card -->
        <div class="birth-metric-card">
          <div class="metric-card-top">
            <span class="metric-tag">${t('birth.sex_ratio_badge')}</span>
            <span class="metric-highlight">${formatNumber(sexRatio, lang)} : 100</span>
          </div>
          <p class="metric-statement">${t('birth.sex_ratio')}</p>
          
          <div class="sex-ratio-bar-wrapper">
            <div class="sex-ratio-bar">
              <div class="ratio-segment male-segment" style="width: ${malePct}%;" title="Boys: ${malePct}% (${sexRatio} per 100)">
                <span>${t('common.male')} ${malePct}%</span>
              </div>
              <div class="ratio-segment female-segment" style="width: ${femalePct}%;" title="Girls: ${femalePct}% (100 per ${sexRatio})">
                <span>${t('common.female')} ${femalePct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Call-to-action button -->
      <div class="birth-milestone-footer">
        <button id="btn-birth-continue" class="primary-btn birth-continue-btn" tabindex="0">
          ${t('birth.grow_up_btn')}
        </button>
      </div>
    `;

    const continueBtn = this.root.querySelector('#btn-birth-continue') as HTMLButtonElement;
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        this.options.onContinue();
      });
      continueBtn.focus();
    }

    this.container.appendChild(this.root);
  }

  private getBabySvg(fillRatio: number): string {
    const isHalf = fillRatio < 1;
    const clipId = `half-fill-${Math.random().toString(36).slice(2, 7)}`;
    return `
      <svg viewBox="0 0 24 24" class="baby-svg" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
        ${isHalf ? `
          <defs>
            <linearGradient id="${clipId}" x1="0" y1="0" x2="1" y2="0">
              <stop offset="50%" stop-color="#22c55e" />
              <stop offset="50%" stop-color="rgba(255,255,255,0.2)" />
            </linearGradient>
          </defs>
        ` : ''}
        <!-- Stylized newborn head & body -->
        <circle cx="12" cy="7" r="4.5" fill="${isHalf ? `url(#${clipId})` : '#22c55e'}" />
        <path d="M6 18C6 14.6863 8.68629 12 12 12C15.3137 12 18 14.6863 18 18V20H6V18Z" fill="${isHalf ? `url(#${clipId})` : '#22c55e'}" />
      </svg>
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


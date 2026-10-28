/**
 * src/ui/StartScreen.ts
 *
 * Full-screen DOM overlay for the intro scene.
 * - Language selector (English / Kinyarwanda / Français) — plain text labels,
 *   no flag icons to avoid cultural assumptions.
 * - Sex selector: two text-labelled buttons, NOT colour-coded alone.
 * - Start button disabled until both choices are made.
 * - Reads ?lang= and ?sex= query params to pre-select.
 * - Flexible containers so French ~20% longer strings don't overflow.
 * - All touch targets ≥ 44px per WCAG 2.5.5.
 * - Fully keyboard-operable (Tab, Enter, Space).
 */

import { t, SupportedLocale } from '../i18n';
import { GameState } from '../director/types';

export type SexChoice = 'male' | 'female';

export interface StartScreenOptions {
  /** DOM container provided by the director (scene-container) */
  container: HTMLElement;
  /** Initial game state to read defaults from */
  initialState: GameState;
  /**
   * Called when the user presses Start with (lang, sex).
   * The caller should write GameState and call goToScene('birth').
   */
  onStart: (lang: SupportedLocale, sex: SexChoice) => void;
  /** Called whenever the language changes so the caller can reload i18n */
  onLanguageChange: (lang: SupportedLocale) => Promise<void>;
}

const LANGUAGES: Array<{ code: SupportedLocale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'fr', label: 'Français' },
];

export class StartScreen {
  private container: HTMLElement;
  private options: StartScreenOptions;

  private chosenLang: SupportedLocale;
  private chosenSex: SexChoice | null;

  // DOM references (retained to avoid re-querying in update)
  private root: HTMLElement | null = null;
  private langBtns: Map<SupportedLocale, HTMLButtonElement> = new Map();
  private sexBtns: Map<SexChoice, HTMLButtonElement> = new Map();
  private startBtn: HTMLButtonElement | null = null;
  private subtitleEl: HTMLElement | null = null;
  private pickLangLabelEl: HTMLElement | null = null;
  private pickSexLabelEl: HTMLElement | null = null;

  constructor(options: StartScreenOptions) {
    this.container = options.container;
    this.options = options;

    // Read pre-selection from URL params
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get('lang') as SupportedLocale | null;
    const urlSex  = params.get('sex') as SexChoice | null;

    this.chosenLang = (urlLang === 'en' || urlLang === 'rw' || urlLang === 'fr')
      ? urlLang
      : options.initialState.lang;

    this.chosenSex = (urlSex === 'male' || urlSex === 'female')
      ? urlSex
      : null;

    // ?scene=birth deep-link — skip the screen entirely; caller handles this
    // before constructing StartScreen, so we don't need to handle it here.

    this.build();
  }

  // ---------------------------------------------------------------------------
  // Build DOM
  // ---------------------------------------------------------------------------

  private build(): void {
    this.root = document.createElement('div');
    this.root.id = 'start-screen';
    this.root.className = 'start-screen-overlay';
    this.root.setAttribute('role', 'main');
    this.root.setAttribute('aria-label', t('intro.title'));

    this.root.innerHTML = `
      <div class="start-card glass-panel" role="dialog" aria-modal="true">
        <h1 class="start-title">${t('intro.title')}</h1>
        <p class="start-subtitle" id="start-subtitle">${t('intro.subtitle')}</p>

        <!-- Population pyramid slot reserved for Person A -->
        <div id="pyramid-slot" aria-hidden="true"></div>

        <!-- Language selector -->
        <section class="start-section" aria-labelledby="start-lang-label">
          <p class="start-label" id="start-lang-label">${t('intro.pick_language')}</p>
          <div class="start-lang-group" role="group" aria-labelledby="start-lang-label">
          </div>
        </section>

        <!-- Sex selector -->
        <section class="start-section" aria-labelledby="start-sex-label">
          <p class="start-label" id="start-sex-label">${t('intro.pick_sex')}</p>
          <div class="start-sex-group" role="group" aria-labelledby="start-sex-label">
          </div>
        </section>

        <!-- Start button -->
        <button id="start-btn" class="start-btn" disabled
          aria-describedby="start-hint">
          ${t('intro.start_button')}
        </button>
        <p id="start-hint" class="start-hint sr-only-when-enabled">
          ${t('intro.start_disabled_hint')}
        </p>
      </div>
    `;

    // Mount language buttons
    const langGroup = this.root.querySelector('.start-lang-group')!;
    for (const { code, label } of LANGUAGES) {
      const btn = document.createElement('button');
      btn.className = 'lang-choice-btn';
      btn.setAttribute('data-lang', code);
      btn.textContent = label;
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', String(code === this.chosenLang));
      if (code === this.chosenLang) btn.classList.add('active');

      btn.addEventListener('click', () => this.selectLanguage(code));
      langGroup.appendChild(btn);
      this.langBtns.set(code, btn);
    }

    // Mount sex buttons
    const sexGroup = this.root.querySelector('.start-sex-group')!;
    const sexChoices: Array<{ val: SexChoice; key: string; icon: string }> = [
      { val: 'female', key: 'intro.sex_female_label', icon: '♀' },
      { val: 'male',   key: 'intro.sex_male_label',   icon: '♂' },
    ];

    for (const { val, key, icon } of sexChoices) {
      const btn = document.createElement('button');
      btn.className = 'sex-choice-btn';
      btn.setAttribute('data-sex', val);
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', String(this.chosenSex === val));
      // Icon + text — both carry meaning so colour-blind users can tell them apart
      btn.innerHTML = `<span class="sex-icon" aria-hidden="true">${icon}</span><span class="sex-label">${t(key)}</span>`;
      if (this.chosenSex === val) btn.classList.add('active');

      btn.addEventListener('click', () => this.selectSex(val));
      sexGroup.appendChild(btn);
      this.sexBtns.set(val, btn);
    }

    // Cache DOM refs
    this.startBtn       = this.root.querySelector('#start-btn');
    this.subtitleEl     = this.root.querySelector('#start-subtitle');
    this.pickLangLabelEl = this.root.querySelector('#start-lang-label');
    this.pickSexLabelEl  = this.root.querySelector('#start-sex-label');

    // Wire Start
    this.startBtn?.addEventListener('click', () => this.triggerStart());

    // Initial state check (both might already be set from URL params)
    this.syncStartButton();

    this.container.appendChild(this.root);

    // If lang was pre-selected from URL, apply it immediately
    this.options.onLanguageChange(this.chosenLang).catch(console.error);
  }

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------

  private selectLanguage(lang: SupportedLocale): void {
    this.chosenLang = lang;

    for (const [code, btn] of this.langBtns) {
      const active = code === lang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    }

    // Switch i18n and re-render all text in the overlay
    this.options.onLanguageChange(lang)
      .then(() => this.updateLabels())
      .catch(console.error);

    this.syncStartButton();
  }

  private selectSex(sex: SexChoice): void {
    this.chosenSex = sex;

    for (const [val, btn] of this.sexBtns) {
      const active = val === sex;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    }

    this.syncStartButton();
  }

  private triggerStart(): void {
    if (!this.chosenSex) return;
    this.options.onStart(this.chosenLang, this.chosenSex);
  }

  // ---------------------------------------------------------------------------
  // State helpers
  // ---------------------------------------------------------------------------

  private syncStartButton(): void {
    if (!this.startBtn) return;
    const ready = this.chosenSex !== null;
    this.startBtn.disabled = !ready;
    this.startBtn.textContent = ready
      ? t('intro.start_btn_ready')
      : t('intro.start_button');

    const hint = this.root?.querySelector('#start-hint');
    if (hint) {
      hint.textContent = ready ? '' : t('intro.start_disabled_hint');
    }
  }

  /** Re-render all user-visible labels without rebuilding DOM. */
  public updateLabels(): void {
    if (this.subtitleEl)     this.subtitleEl.textContent     = t('intro.subtitle');
    if (this.pickLangLabelEl) this.pickLangLabelEl.textContent = t('intro.pick_language');
    if (this.pickSexLabelEl)  this.pickSexLabelEl.textContent  = t('intro.pick_sex');

    // Update sex button labels
    const sexLabelKeys: Record<SexChoice, string> = {
      female: 'intro.sex_female_label',
      male:   'intro.sex_male_label',
    };
    const sexIcons: Record<SexChoice, string> = { female: '♀', male: '♂' };

    for (const [val, btn] of this.sexBtns) {
      const labelEl = btn.querySelector('.sex-label');
      if (labelEl) labelEl.textContent = t(sexLabelKeys[val]);
      const iconEl = btn.querySelector('.sex-icon');
      if (iconEl) iconEl.textContent = sexIcons[val];
    }

    this.syncStartButton();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public dispose(): void {
    this.langBtns.clear();
    this.sexBtns.clear();
    this.startBtn = null;
    if (this.root?.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    this.root = null;
  }
}

import { SupportedLocale, getLanguage, setLanguage, onLanguageChange } from '../i18n';

export interface LanguagePickerOptions {
  container?: HTMLElement;
  onChange?: (lang: SupportedLocale) => void;
}

export class LanguagePicker {
  private element: HTMLElement;
  private unregisterListener?: () => void;
  private onChangeCallback?: (lang: SupportedLocale) => void;

  constructor(options?: LanguagePickerOptions) {
    this.onChangeCallback = options?.onChange;
    if (options?.container) {
      this.element = options.container;
    } else {
      this.element = document.createElement('div');
      this.element.className = 'lang-selector';
      this.element.innerHTML = `
        <button class="lang-btn" data-lang="en" aria-label="Switch to English">EN</button>
        <button class="lang-btn" data-lang="rw" aria-label="Hindura mu Kinyarwanda">RW</button>
        <button class="lang-btn" data-lang="fr" aria-label="Passer en Français">FR</button>
      `;
    }

    this.bindEvents();
    this.syncActiveButton(getLanguage());

    this.unregisterListener = onLanguageChange((newLang) => {
      this.syncActiveButton(newLang);
      if (this.onChangeCallback) {
        this.onChangeCallback(newLang);
      }
    });
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  private bindEvents(): void {
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.lang-btn');
    buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetLang = btn.dataset.lang as SupportedLocale;
        if (targetLang && targetLang !== getLanguage()) {
          setLanguage(targetLang);
        }
      });
    });
  }

  private syncActiveButton(activeLang: SupportedLocale): void {
    const buttons = this.element.querySelectorAll<HTMLButtonElement>('.lang-btn');
    buttons.forEach((btn) => {
      if (btn.dataset.lang === activeLang) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  public dispose(): void {
    if (this.unregisterListener) {
      this.unregisterListener();
    }
  }
}

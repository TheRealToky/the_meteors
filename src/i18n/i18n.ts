import { formatNumber, formatPercent, SupportedLocale } from './format';

export type { SupportedLocale };

type TranslationDictionary = Record<string, string>;

class I18nManager {
  private currentLocale: SupportedLocale = 'en';
  private dictionaries: Partial<Record<SupportedLocale, TranslationDictionary>> = {};
  private listeners: Set<(locale: SupportedLocale) => void> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    this.currentLocale = this.detectInitialLocale();
  }

  private detectInitialLocale(): SupportedLocale {
    // 1. Check URL query parameter (?lang=rw)
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get('lang');
      if (urlLang === 'en' || urlLang === 'rw' || urlLang === 'fr') {
        return urlLang;
      }
    } catch (_e) {
      // Ignore URL parsing errors
    }

    // 2. Check localStorage (always wrapped in try/catch)
    try {
      const savedLang = localStorage.getItem('lifepath_lang');
      if (savedLang === 'en' || savedLang === 'rw' || savedLang === 'fr') {
        return savedLang;
      }
    } catch (_e) {
      // LocalStorage might be restricted
    }

    // 3. Check browser navigator language
    try {
      const navLang = (navigator.language || navigator.languages?.[0] || '').toLowerCase();
      if (navLang.startsWith('rw') || navLang.startsWith('kin')) {
        return 'rw';
      }
      if (navLang.startsWith('fr')) {
        return 'fr';
      }
    } catch (_e) {
      // Ignore navigator errors
    }

    return 'en';
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    // Load active locale and English (as fallback dictionary)
    await Promise.all([
      this.loadLocale('en'),
      this.currentLocale !== 'en' ? this.loadLocale(this.currentLocale) : Promise.resolve(),
    ]);

    this.applyHtmlLang();
    this.isInitialized = true;
  }

  public async loadLocale(locale: SupportedLocale): Promise<void> {
    if (this.dictionaries[locale]) return;

    try {
      const response = await fetch(`/i18n/${locale}.json`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} loading /i18n/${locale}.json`);
      }
      const data = await response.json();
      this.dictionaries[locale] = data;
    } catch (err) {
      console.warn(`[i18n] Failed to fetch /i18n/${locale}.json:`, err);
      // Empty dict fallback
      if (!this.dictionaries[locale]) {
        this.dictionaries[locale] = {};
      }
    }
  }

  public async setLanguage(locale: SupportedLocale): Promise<void> {
    if (!this.dictionaries[locale]) {
      await this.loadLocale(locale);
    }

    this.currentLocale = locale;
    this.applyHtmlLang();

    // Persist choice to localStorage safely
    try {
      localStorage.setItem('lifepath_lang', locale);
    } catch (_e) {
      // LocalStorage access might fail in private windows
    }

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(locale);
      } catch (err) {
        console.error('[i18n] Listener error:', err);
      }
    }
  }

  public getLanguage(): SupportedLocale {
    return this.currentLocale;
  }

  public onLanguageChange(callback: (locale: SupportedLocale) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private applyHtmlLang(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.currentLocale;
    }
  }

  public t(key: string, vars?: Record<string, string | number>): string {
    const currentDict = this.dictionaries[this.currentLocale];
    let template = currentDict?.[key];

    // Fallback to English if key missing in rw or fr
    if (template === undefined) {
      const fallbackDict = this.dictionaries['en'];
      template = fallbackDict?.[key];

      if (template === undefined) {
        if (import.meta.env.DEV) {
          console.warn(`[i18n] Missing translation key: "${key}" across all locales.`);
        }
        return key;
      }

      if (this.currentLocale !== 'en' && import.meta.env.DEV) {
        console.warn(`[i18n] Key "${key}" missing in "${this.currentLocale}", fallback to "en".`);
      }
    }

    if (!vars) {
      return template;
    }

    // Interpolate {placeholder}
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, varName) => {
      if (varName in vars) {
        const val = vars[varName];
        return typeof val === 'number'
          ? formatNumber(val, this.currentLocale)
          : String(val);
      }
      return match;
    });
  }
}

export const i18n = new I18nManager();
export const t = (key: string, vars?: Record<string, string | number>) => i18n.t(key, vars);
export const setLanguage = (locale: SupportedLocale) => i18n.setLanguage(locale);
export const getLanguage = () => i18n.getLanguage();
export const onLanguageChange = (callback: (locale: SupportedLocale) => void) => i18n.onLanguageChange(callback);
export { formatNumber, formatPercent };

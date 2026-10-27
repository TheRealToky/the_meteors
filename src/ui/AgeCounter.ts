import gsap from 'gsap';
import { t, formatNumber, onLanguageChange, getLanguage } from '../i18n';

export interface AgeCounterOptions {
  initialAge?: number;
  container?: HTMLElement;
}

export class AgeCounter {
  private element: HTMLElement;
  private valueElement: HTMLElement;
  private labelElement: HTMLElement;
  private currentAge: number = 0;
  private displayedAge: { val: number } = { val: 0 };
  private tween: gsap.core.Tween | null = null;
  private unregisterListener?: () => void;

  constructor(options?: AgeCounterOptions) {
    this.currentAge = options?.initialAge ?? 0;
    this.displayedAge.val = this.currentAge;

    if (options?.container) {
      this.element = options.container;
    } else {
      this.element = document.createElement('div');
      this.element.className = 'hud-age-counter glass-panel';
    }

    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');

    this.element.innerHTML = `
      <div class="age-icon-wrapper" aria-hidden="true">
        <span class="age-icon">🌱</span>
      </div>
      <div class="age-content">
        <span class="age-label">${t('hud.age_label')}</span>
        <span class="age-number">${formatNumber(this.currentAge, getLanguage())}</span>
      </div>
    `;

    this.labelElement = this.element.querySelector('.age-label') as HTMLElement;
    this.valueElement = this.element.querySelector('.age-number') as HTMLElement;

    this.updateIcon(this.currentAge);

    this.unregisterListener = onLanguageChange(() => {
      this.updateText();
    });
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public getAge(): number {
    return this.currentAge;
  }

  public setAge(targetAge: number, duration: number = 1.2): void {
    if (this.currentAge === targetAge && this.displayedAge.val === targetAge) {
      return;
    }

    this.currentAge = targetAge;
    this.updateIcon(targetAge);

    if (this.tween) {
      this.tween.kill();
    }

    if (duration <= 0) {
      this.displayedAge.val = targetAge;
      this.renderNumber();
      return;
    }

    this.tween = gsap.to(this.displayedAge, {
      val: targetAge,
      duration,
      ease: 'power1.out',
      onUpdate: () => {
        this.renderNumber();
      },
      onComplete: () => {
        this.displayedAge.val = targetAge;
        this.renderNumber();
        this.tween = null;
      },
    });
  }

  private renderNumber(): void {
    if (this.valueElement) {
      const rounded = Math.round(this.displayedAge.val);
      this.valueElement.textContent = formatNumber(rounded, getLanguage());
    }
  }

  private updateText(): void {
    if (this.labelElement) {
      this.labelElement.textContent = t('hud.age_label');
    }
    this.renderNumber();
  }

  private updateIcon(age: number): void {
    const iconSpan = this.element.querySelector('.age-icon');
    if (!iconSpan) return;

    if (age <= 0) {
      iconSpan.textContent = '🍼'; // Newborn
    } else if (age < 18) {
      iconSpan.textContent = '🎒'; // Youth / Student
    } else if (age < 35) {
      iconSpan.textContent = '💍'; // Young adult / Marriage
    } else if (age < 60) {
      iconSpan.textContent = '💼'; // Middle adult
    } else {
      iconSpan.textContent = '👴'; // Elder
    }
  }

  public dispose(): void {
    if (this.tween) {
      this.tween.kill();
    }
    if (this.unregisterListener) {
      this.unregisterListener();
    }
    if (this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }
}

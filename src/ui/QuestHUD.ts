import { Milestone, MILESTONES } from '../world/milestones';
import { onLanguageChange, t, formatNumber, getLanguage } from '../i18n';

export interface QuestHUDOptions {
  container: HTMLElement;
  initialMilestone?: Milestone;
  /** Called with true while the "hold to walk" button is pressed, false on release */
  onWalkHold?: (active: boolean) => void;
}

/**
 * The quest card (top left) shown between stations: which stage is next,
 * a row of stage dots, distance left along the path, and how to walk.
 * Also owns the large "hold to walk" button for touch and mouse players.
 * All text comes from i18n.
 */
export class QuestHUD {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private levelBadgeEl: HTMLElement;
  private titleEl: HTMLElement;
  private guideTextEl: HTMLElement;
  private distanceEl: HTMLElement;
  private toggleBtnEl: HTMLElement;
  private toggleLabelEl: HTMLElement;
  private stepsEl: HTMLElement;
  private walkKeyLabelEl: HTMLElement;
  private backKeyLabelEl: HTMLElement;
  private walkBtnEl: HTMLButtonElement;
  private walkBtnLabelEl: HTMLElement;

  private currentMilestone: Milestone | null = null;
  private unregisterI18n: (() => void) | null = null;
  private lastDistance: number = -1;
  private isCollapsed: boolean = false;
  private isWalking: boolean = false;
  private onWalkHold?: (active: boolean) => void;
  private listeners: Array<{ el: EventTarget; type: string; fn: EventListener }> = [];

  constructor(options: QuestHUDOptions) {
    this.container = options.container;
    this.onWalkHold = options.onWalkHold;

    this.rootEl = document.createElement('div');
    this.rootEl.id = 'quest-hud';
    this.rootEl.className = 'quest-hud glass-panel hidden';
    this.rootEl.setAttribute('role', 'region');

    // Structure only: every visible string is filled in by renderText()
    this.rootEl.innerHTML = `
      <div class="quest-hud-top">
        <div class="quest-hud-pill-group">
          <span class="quest-badge" id="quest-level-badge"></span>
          <span class="quest-distance" id="quest-distance-badge">
            <svg class="quest-compass-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            <span id="quest-distance-text" aria-live="polite"></span>
          </span>
        </div>

        <button id="quest-collapse-btn" class="quest-toggle-btn" aria-expanded="true" aria-controls="quest-body">
          <span class="quest-toggle-label" id="quest-toggle-label"></span>
          <svg class="quest-chevron-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      </div>

      <div id="quest-body" class="quest-body">
        <ol class="quest-steps" id="quest-steps"></ol>
        <h3 class="quest-title" id="quest-title-text"></h3>
        <p class="quest-guide-text" id="quest-guide-text"></p>

        <div class="quest-controls-row">
          <div class="quest-key-badge">
            <kbd class="key-cap">W</kbd> / <kbd class="key-cap">↑</kbd>
            <span class="key-label" id="quest-key-walk"></span>
          </div>
          <div class="quest-key-badge">
            <kbd class="key-cap">S</kbd> / <kbd class="key-cap">↓</kbd>
            <span class="key-label" id="quest-key-back"></span>
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(this.rootEl);

    const q = <T extends HTMLElement>(sel: string) => this.rootEl.querySelector(sel) as T;
    this.levelBadgeEl = q('#quest-level-badge');
    this.titleEl = q('#quest-title-text');
    this.guideTextEl = q('#quest-guide-text');
    this.distanceEl = q('#quest-distance-text');
    this.toggleBtnEl = q('#quest-collapse-btn');
    this.toggleLabelEl = q('#quest-toggle-label');
    this.stepsEl = q('#quest-steps');
    this.walkKeyLabelEl = q('#quest-key-walk');
    this.backKeyLabelEl = q('#quest-key-back');

    // One dot per stage; the current one glows, finished ones are filled
    for (let i = 0; i < MILESTONES.length; i++) {
      const li = document.createElement('li');
      li.className = 'quest-step';
      this.stepsEl.appendChild(li);
    }

    // Large "hold to walk" button: pointer events cover mouse, touch and pen.
    // Keyboard players can also focus it and hold Space or Enter.
    this.walkBtnEl = document.createElement('button');
    this.walkBtnEl.type = 'button';
    this.walkBtnEl.className = 'walk-hold-btn hidden';
    this.walkBtnEl.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>
      </svg>
      <span class="walk-hold-label"></span>
    `;
    this.walkBtnLabelEl = this.walkBtnEl.querySelector('.walk-hold-label') as HTMLElement;
    this.container.appendChild(this.walkBtnEl);

    const press = (e: Event) => {
      e.preventDefault();
      if (e instanceof PointerEvent) this.walkBtnEl.setPointerCapture(e.pointerId);
      this.setHold(true);
    };
    const release = () => this.setHold(false);
    const keyDown = (e: Event) => {
      const k = (e as KeyboardEvent).code;
      if (k === 'Space' || k === 'Enter') {
        e.preventDefault();
        this.setHold(true);
      }
    };
    const keyUp = (e: Event) => {
      const k = (e as KeyboardEvent).code;
      if (k === 'Space' || k === 'Enter') this.setHold(false);
    };
    this.listen(this.walkBtnEl, 'pointerdown', press);
    this.listen(this.walkBtnEl, 'pointerup', release);
    this.listen(this.walkBtnEl, 'pointercancel', release);
    this.listen(this.walkBtnEl, 'lostpointercapture', release);
    this.listen(this.walkBtnEl, 'keydown', keyDown);
    this.listen(this.walkBtnEl, 'keyup', keyUp);
    this.listen(this.walkBtnEl, 'blur', release);
    this.listen(this.walkBtnEl, 'contextmenu', (e) => e.preventDefault()); // long-press menu on phones

    this.listen(this.toggleBtnEl, 'click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });

    // Clicking the top pill area when collapsed expands it
    const topArea = q('.quest-hud-top');
    this.listen(topArea, 'click', (e) => {
      if (this.isCollapsed && e.target !== this.toggleBtnEl) this.toggleCollapse();
    });

    if (options.initialMilestone) this.setMilestone(options.initialMilestone);
    this.renderText();

    this.unregisterI18n = onLanguageChange(() => this.renderText());
  }

  private listen(el: EventTarget, type: string, fn: EventListener): void {
    el.addEventListener(type, fn);
    this.listeners.push({ el, type, fn });
  }

  private setHold(active: boolean): void {
    this.walkBtnEl.classList.toggle('pressed', active);
    this.onWalkHold?.(active);
  }

  /** Re-renders every string in the current language (never restarts anything). */
  private renderText(): void {
    this.rootEl.setAttribute('aria-label', t('quest.aria_label'));
    this.walkKeyLabelEl.textContent = t('quest.key_walk');
    this.backKeyLabelEl.textContent = t('quest.key_back');
    this.walkBtnLabelEl.textContent = t('quest.hold_to_walk');
    this.walkBtnEl.setAttribute('aria-label', t('quest.hold_to_walk_aria'));
    this.updateToggleLabel();
    if (this.currentMilestone) this.renderMilestone(this.currentMilestone);
    const d = this.lastDistance;
    this.lastDistance = -1;
    if (d >= 0) this.updateDistance(d);
  }

  private updateToggleLabel(): void {
    this.toggleLabelEl.textContent = this.isCollapsed ? t('quest.show') : t('quest.hide');
    this.toggleBtnEl.setAttribute('title', this.isCollapsed ? t('quest.expand_title') : t('quest.collapse_title'));
  }

  public toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.rootEl.classList.toggle('collapsed', this.isCollapsed);
    this.toggleBtnEl.setAttribute('aria-expanded', this.isCollapsed ? 'false' : 'true');
    this.updateToggleLabel();
  }

  public setMilestone(milestone: Milestone | null): void {
    this.currentMilestone = milestone;
    if (!milestone) {
      this.rootEl.classList.add('hidden');
      return;
    }
    this.renderMilestone(milestone);
  }

  private renderMilestone(milestone: Milestone): void {
    this.levelBadgeEl.textContent = t('quest.stage', { n: milestone.order, total: MILESTONES.length });
    this.titleEl.textContent = t(milestone.titleKey);
    this.guideTextEl.textContent = t(milestone.guideKey);

    const dots = this.stepsEl.children;
    for (let i = 0; i < dots.length; i++) {
      const order = i + 1;
      const dot = dots[i] as HTMLElement;
      dot.classList.toggle('done', order < milestone.order);
      dot.classList.toggle('current', order === milestone.order);
      dot.setAttribute('aria-label', t(MILESTONES[i].titleKey));
    }
  }

  /** Shows or hides the hold-to-walk button (only while walking between stations). */
  public setWalking(walking: boolean): void {
    this.isWalking = walking;
    this.walkBtnEl.classList.toggle('hidden', !walking);
    if (!walking) this.setHold(false);
  }

  /** Updates the distance pill; only touches the DOM when the rounded value changes. */
  public updateDistance(meters: number): void {
    const rounded = Math.max(0, Math.round(meters));
    if (rounded === this.lastDistance) return;
    this.lastDistance = rounded;

    if (rounded <= 7) {
      this.distanceEl.textContent = t('quest.arrived');
      this.distanceEl.className = 'arrived-pulse';
    } else {
      this.distanceEl.textContent = t('quest.distance', { m: formatNumber(rounded, getLanguage()) });
      this.distanceEl.className = '';
    }
  }

  public show(): void {
    this.rootEl.classList.remove('hidden');
    if (this.isWalking) this.walkBtnEl.classList.remove('hidden');
  }

  public hide(): void {
    this.rootEl.classList.add('hidden');
    this.walkBtnEl.classList.add('hidden');
    this.setHold(false);
  }

  public dispose(): void {
    this.unregisterI18n?.();
    this.unregisterI18n = null;
    for (const { el, type, fn } of this.listeners) el.removeEventListener(type, fn);
    this.listeners = [];
    this.rootEl.remove();
    this.walkBtnEl.remove();
  }
}

import { Milestone } from '../world/milestones';
import { onLanguageChange } from '../i18n';

export interface QuestHUDOptions {
  container: HTMLElement;
  initialMilestone?: Milestone;
}

export class QuestHUD {
  private container: HTMLElement;
  private rootEl: HTMLElement;
  private levelBadgeEl: HTMLElement;
  private titleEl: HTMLElement;
  private guideTextEl: HTMLElement;
  private distanceEl: HTMLElement;

  private currentMilestone: Milestone | null = null;
  private unregisterI18n: (() => void) | null = null;
  private lastDistance: number = -1;

  constructor(options: QuestHUDOptions) {
    this.container = options.container;

    // Build DOM structure
    this.rootEl = document.createElement('div');
    this.rootEl.id = 'quest-hud';
    this.rootEl.className = 'quest-hud glass-panel';
    this.rootEl.setAttribute('role', 'region');
    this.rootEl.setAttribute('aria-label', 'Current Quest Objective');

    this.rootEl.innerHTML = `
      <div class="quest-hud-top">
        <span class="quest-badge" id="quest-level-badge">Stage 1 of 5</span>
        <span class="quest-distance" id="quest-distance-badge">
          <svg class="quest-compass-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
          </svg>
          <span id="quest-distance-text">Looking for path...</span>
        </span>
      </div>

      <h3 class="quest-title" id="quest-title-text">District Maternity Health Center</h3>
      <p class="quest-guide-text" id="quest-guide-text">
        Guide your parents to the Health Center to register your birth among 356,838 newborns.
      </p>

      <div class="quest-controls-row">
        <div class="quest-key-badge">
          <kbd class="key-cap">W</kbd> / <kbd class="key-cap">↑</kbd>
          <span class="key-label">Walk Forward</span>
        </div>
        <div class="quest-key-badge">
          <kbd class="key-cap">S</kbd> / <kbd class="key-cap">↓</kbd>
          <span class="key-label">Step Back</span>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    this.levelBadgeEl = this.rootEl.querySelector('#quest-level-badge') as HTMLElement;
    this.titleEl = this.rootEl.querySelector('#quest-title-text') as HTMLElement;
    this.guideTextEl = this.rootEl.querySelector('#quest-guide-text') as HTMLElement;
    this.distanceEl = this.rootEl.querySelector('#quest-distance-text') as HTMLElement;

    if (options.initialMilestone) {
      this.setMilestone(options.initialMilestone);
    }

    this.unregisterI18n = onLanguageChange(() => {
      if (this.currentMilestone) {
        this.renderMilestone(this.currentMilestone);
      }
    });
  }

  public setMilestone(milestone: Milestone | null): void {
    this.currentMilestone = milestone;
    if (!milestone) {
      this.rootEl.classList.add('hidden');
      return;
    }

    this.rootEl.classList.remove('hidden');
    this.renderMilestone(milestone);
  }

  private renderMilestone(milestone: Milestone): void {
    if (this.levelBadgeEl) {
      this.levelBadgeEl.textContent = `Stage ${milestone.order} of 5`;
    }
    if (this.titleEl) {
      this.titleEl.textContent = milestone.buildingName;
    }
    if (this.guideTextEl) {
      this.guideTextEl.textContent = milestone.guideStep;
    }
  }

  /**
   * Updates distance indicator smoothly.
   */
  public updateDistance(meters: number): void {
    const rounded = Math.max(0, Math.round(meters));
    if (rounded === this.lastDistance) return;
    this.lastDistance = rounded;

    if (this.distanceEl) {
      if (rounded <= 4) {
        this.distanceEl.innerHTML = `<span class="arrived-pulse">Arrived at Milestone!</span>`;
      } else {
        this.distanceEl.textContent = `${rounded}m ahead`;
      }
    }
  }

  public show(): void {
    this.rootEl.classList.remove('hidden');
  }

  public hide(): void {
    this.rootEl.classList.add('hidden');
  }

  public dispose(): void {
    if (this.unregisterI18n) {
      this.unregisterI18n();
      this.unregisterI18n = null;
    }
    this.rootEl.remove();
  }
}

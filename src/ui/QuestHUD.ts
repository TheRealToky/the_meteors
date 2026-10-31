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
  private toggleBtnEl: HTMLElement;
  private toggleLabelEl: HTMLElement;

  private currentMilestone: Milestone | null = null;
  private unregisterI18n: (() => void) | null = null;
  private lastDistance: number = -1;
  private isCollapsed: boolean = false;

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
        <div class="quest-hud-pill-group">
          <span class="quest-badge" id="quest-level-badge">Stage 1 of 5</span>
          <span class="quest-distance" id="quest-distance-badge">
            <svg class="quest-compass-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            <span id="quest-distance-text">Finding path...</span>
          </span>
        </div>

        <button id="quest-collapse-btn" class="quest-toggle-btn" aria-expanded="true" aria-controls="quest-body" title="Collapse objective card">
          <span class="quest-toggle-label" id="quest-toggle-label">Hide</span>
          <svg class="quest-chevron-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      </div>

      <div id="quest-body" class="quest-body">
        <h3 class="quest-title" id="quest-title-text">District Maternity Health Center</h3>
        <p class="quest-guide-text" id="quest-guide-text">
          Guide your parents to the Health Center to register your birth among 356,838 newborns.
        </p>

        <div class="quest-controls-row">
          <div class="quest-key-badge">
            <kbd class="key-cap">W</kbd> / <kbd class="key-cap">↑</kbd>
            <span class="key-label">Walk</span>
          </div>
          <div class="quest-key-badge">
            <kbd class="key-cap">S</kbd> / <kbd class="key-cap">↓</kbd>
            <span class="key-label">Back</span>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(this.rootEl);

    this.levelBadgeEl = this.rootEl.querySelector('#quest-level-badge') as HTMLElement;
    this.titleEl = this.rootEl.querySelector('#quest-title-text') as HTMLElement;
    this.guideTextEl = this.rootEl.querySelector('#quest-guide-text') as HTMLElement;
    this.distanceEl = this.rootEl.querySelector('#quest-distance-text') as HTMLElement;
    this.toggleBtnEl = this.rootEl.querySelector('#quest-collapse-btn') as HTMLElement;
    this.toggleLabelEl = this.rootEl.querySelector('#quest-toggle-label') as HTMLElement;

    // Wire collapse toggle
    this.toggleBtnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });

    // Clicking top pill area when collapsed expands it
    const topArea = this.rootEl.querySelector('.quest-hud-top') as HTMLElement;
    if (topArea) {
      topArea.addEventListener('click', (e) => {
        if (this.isCollapsed && e.target !== this.toggleBtnEl) {
          this.toggleCollapse();
        }
      });
    }

    if (options.initialMilestone) {
      this.setMilestone(options.initialMilestone);
    }

    this.unregisterI18n = onLanguageChange(() => {
      if (this.currentMilestone) {
        this.renderMilestone(this.currentMilestone);
      }
      this.updateToggleLabel();
    });
  }

  private updateToggleLabel(): void {
    if (this.toggleLabelEl) {
      this.toggleLabelEl.textContent = this.isCollapsed ? 'Details' : 'Hide';
    }
  }

  public toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) {
      this.rootEl.classList.add('collapsed');
      this.toggleBtnEl.setAttribute('aria-expanded', 'false');
      this.toggleBtnEl.setAttribute('title', 'Expand objective details');
    } else {
      this.rootEl.classList.remove('collapsed');
      this.toggleBtnEl.setAttribute('aria-expanded', 'true');
      this.toggleBtnEl.setAttribute('title', 'Collapse objective card');
    }
    this.updateToggleLabel();
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
        this.distanceEl.innerHTML = `<span class="arrived-pulse">Arrived!</span>`;
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

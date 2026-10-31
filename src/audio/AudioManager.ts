/**
 * src/audio/AudioManager.ts
 *
 * Ambient audio system powered by Howler.js.
 * Features:
 * - Default Track: Slower, dreamy, nostalgic solo piano ("Gymnopédie No. 1" in the style of Minecraft / C418).
 * - Alternate Track: Warm, relaxing lo-fi beat ("Relaxed City").
 * - Custom NCS song / audio file upload with instant loop playback.
 * - Mute / Unmute and Volume slider with localStorage persistence.
 * - Floating HUD widget with animated sound wave bars.
 * - Keyboard shortcut (M) to toggle mute.
 * - Zero CPU impact when muted, HTML5 streaming mode to avoid memory bloat on mobile.
 */

import { Howl } from 'howler';
import { t, onLanguageChange } from '../i18n';

export type BuiltinTrackKey = 'piano' | 'lofi';

export interface AudioManagerOptions {
  defaultSrc?: string;
  defaultVolume?: number;
}

export class AudioManager {
  private static instance: AudioManager | null = null;

  private sound: Howl | null = null;
  private currentTrackKey: BuiltinTrackKey | 'custom' = 'piano';
  private currentSrc: string = '/audio/dreamy_piano.mp3';
  private customTrackTitle: string = '';
  private customObjectUrl: string | null = null;

  private isMuted: boolean = false;
  private volume: number = 0.35;
  private isUserInteracted: boolean = false;

  // Widget DOM elements
  private widgetEl: HTMLElement | null = null;
  private toggleBtn: HTMLButtonElement | null = null;
  private panelEl: HTMLElement | null = null;
  private volumeSlider: HTMLInputElement | null = null;
  private trackTitleEl: HTMLElement | null = null;
  private statusBadgeEl: HTMLElement | null = null;
  private unregisterI18n: (() => void) | null = null;

  private constructor(options: AudioManagerOptions = {}) {
    // Read user preferences safely from localStorage
    try {
      const savedMuted = localStorage.getItem('lifepath_audio_muted');
      if (savedMuted !== null) {
        this.isMuted = savedMuted === 'true';
      } else {
        this.isMuted = false;
      }

      const savedVol = localStorage.getItem('lifepath_audio_vol');
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.volume = parsed;
        }
      } else if (options.defaultVolume !== undefined) {
        this.volume = options.defaultVolume;
      }

      const savedTrack = localStorage.getItem('lifepath_audio_track') as BuiltinTrackKey | null;
      if (savedTrack === 'lofi') {
        this.currentTrackKey = 'lofi';
        this.currentSrc = '/audio/lofi_calm.mp3';
      } else {
        this.currentTrackKey = 'piano';
        this.currentSrc = options.defaultSrc ?? '/audio/dreamy_piano.mp3';
      }
    } catch (e) {
      console.warn('[AudioManager] localStorage access restricted:', e);
      this.currentSrc = options.defaultSrc ?? '/audio/dreamy_piano.mp3';
    }

    this.createHowl();

    // Setup global interaction listener to unlock audio on first gesture
    const unlockAudio = () => {
      this.isUserInteracted = true;
      if (!this.isMuted && this.sound && !this.sound.playing()) {
        this.sound.play();
        this.updateWidgetUI();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { once: false });
    window.addEventListener('touchstart', unlockAudio, { once: false });
    window.addEventListener('keydown', unlockAudio, { once: false });

    // Global keyboard shortcut: M to toggle mute
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'm' || e.key === 'M') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        this.toggleMute();
      }
    });

    this.unregisterI18n = onLanguageChange(() => {
      this.updateLanguage();
    });
  }

  public static getInstance(options?: AudioManagerOptions): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager(options);
    }
    return AudioManager.instance;
  }

  private createHowl(): void {
    if (this.sound) {
      this.sound.unload();
      this.sound = null;
    }

    this.sound = new Howl({
      src: [this.currentSrc],
      html5: true, // Stream audio to preserve RAM on mobile devices
      loop: true,
      volume: this.isMuted ? 0 : this.volume,
      autoplay: !this.isMuted && this.isUserInteracted,
      onloaderror: (_id, err) => {
        console.warn('[AudioManager] Audio load notice:', err);
      },
      onplay: () => {
        this.updateWidgetUI();
      },
      onpause: () => {
        this.updateWidgetUI();
      },
      onstop: () => {
        this.updateWidgetUI();
      },
      onend: () => {
        this.updateWidgetUI();
      },
    });
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('lifepath_audio_muted', String(this.isMuted));
    } catch {}

    if (this.sound) {
      if (this.isMuted) {
        this.sound.fade(this.sound.volume(), 0, 300);
        setTimeout(() => {
          this.sound?.pause();
          this.updateWidgetUI();
        }, 320);
      } else {
        if (!this.sound.playing()) {
          this.sound.play();
        }
        this.sound.fade(0, this.volume, 400);
        this.updateWidgetUI();
      }
    } else {
      this.createHowl();
      this.updateWidgetUI();
    }
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    try {
      localStorage.setItem('lifepath_audio_vol', String(clamped));
    } catch {}

    if (this.sound && !this.isMuted) {
      this.sound.volume(clamped);
    }

    if (this.isMuted && clamped > 0) {
      this.toggleMute(); // Unmute if user moves volume slider
    }

    this.updateWidgetUI();
  }

  public setBuiltinTrack(trackKey: BuiltinTrackKey): void {
    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
      this.customObjectUrl = null;
    }

    this.currentTrackKey = trackKey;
    this.currentSrc = trackKey === 'piano' ? '/audio/dreamy_piano.mp3' : '/audio/lofi_calm.mp3';
    this.customTrackTitle = '';

    try {
      localStorage.setItem('lifepath_audio_track', trackKey);
    } catch {}

    this.createHowl();
    if (!this.isMuted && this.sound) {
      this.sound.play();
    }
    this.updateWidgetUI();
  }

  public loadUserFile(file: File): void {
    if (!file) return;

    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
      this.customObjectUrl = null;
    }

    this.customObjectUrl = URL.createObjectURL(file);
    this.currentSrc = this.customObjectUrl;
    this.customTrackTitle = file.name.replace(/\.[^/.]+$/, '');
    this.currentTrackKey = 'custom';

    this.createHowl();
    if (!this.isMuted && this.sound) {
      this.sound.play();
    }
    this.updateWidgetUI();
  }

  private getTrackDisplayName(): string {
    if (this.currentTrackKey === 'custom') {
      return this.customTrackTitle || t('audio.custom_track');
    }
    if (this.currentTrackKey === 'piano') {
      return t('audio.default_track');
    }
    return t('audio.track_lofi');
  }

  /**
   * Mounts the audio widget into the HUD header or specified container.
   */
  public mountWidget(container: HTMLElement): HTMLElement {
    if (this.widgetEl) {
      this.widgetEl.remove();
    }

    this.widgetEl = document.createElement('div');
    this.widgetEl.className = 'audio-hud-widget';
    this.widgetEl.setAttribute('role', 'region');
    this.widgetEl.setAttribute('aria-label', t('audio.title'));

    this.widgetEl.innerHTML = `
      <button class="audio-toggle-btn ${this.isMuted ? 'muted' : 'playing'}" 
              id="audio-toggle-btn" 
              type="button" 
              title="${t('audio.toggle_mute')}"
              aria-label="${t('audio.toggle_mute')}"
              aria-expanded="false">
        <div class="audio-waves" aria-hidden="true">
          <span class="bar bar-1"></span>
          <span class="bar bar-2"></span>
          <span class="bar bar-3"></span>
        </div>
        <span class="audio-icon-muted" aria-hidden="true">🔇</span>
      </button>

      <div class="audio-popover-panel glass-panel" id="audio-panel" style="display: none;">
        <div class="audio-popover-header">
          <div class="audio-header-left">
            <span class="audio-label">${t('audio.title')}</span>
            <span class="audio-status-tag" id="audio-status-tag">${this.isMuted ? t('audio.muted') : t('audio.playing')}</span>
          </div>
          <button class="audio-panel-close-btn" id="audio-close-btn" type="button" aria-label="Close">✕</button>
        </div>

        <div class="audio-track-info">
          <span class="audio-track-icon">${this.currentTrackKey === 'piano' ? '🎹' : '🎵'}</span>
          <div class="audio-track-meta">
            <span class="audio-track-name" id="audio-track-name">
              ${this.getTrackDisplayName()}
            </span>
            <span class="audio-track-sub" id="audio-track-sub">
              ${this.currentTrackKey === 'piano' ? 'Minecraft / C418 Style (Gymnopédie No. 1)' : this.currentTrackKey === 'lofi' ? 'Relaxed Lo-Fi Loop' : t('audio.custom_track')}
            </span>
          </div>
        </div>

        <!-- Builtin preset selector buttons -->
        <div class="audio-preset-selector">
          <button type="button" class="audio-preset-btn ${this.currentTrackKey === 'piano' ? 'active' : ''}" id="btn-preset-piano">
            ${t('audio.track_piano')}
          </button>
          <button type="button" class="audio-preset-btn ${this.currentTrackKey === 'lofi' ? 'active' : ''}" id="btn-preset-lofi">
            ${t('audio.track_lofi')}
          </button>
        </div>

        <div class="audio-controls-group">
          <div class="audio-slider-row">
            <span class="slider-vol-icon">🔉</span>
            <input type="range" 
                   id="audio-volume-slider" 
                   class="audio-slider" 
                   min="0" 
                   max="100" 
                   value="${Math.round(this.volume * 100)}" 
                   aria-label="${t('audio.volume_label', { percent: Math.round(this.volume * 100) })}" />
            <span class="audio-vol-percent" id="audio-vol-percent">${Math.round(this.volume * 100)}%</span>
          </div>

          <div class="audio-action-row">
            <label class="audio-upload-label" for="audio-file-input">
              <span class="upload-icon">📂</span>
              <span class="upload-text">${t('audio.upload_btn')}</span>
            </label>
            <input type="file" id="audio-file-input" class="sr-only" accept="audio/*" />
          </div>
        </div>
      </div>
    `;

    this.toggleBtn = this.widgetEl.querySelector('#audio-toggle-btn');
    this.panelEl = this.widgetEl.querySelector('#audio-panel');
    this.volumeSlider = this.widgetEl.querySelector('#audio-volume-slider');
    this.trackTitleEl = this.widgetEl.querySelector('#audio-track-name');
    this.statusBadgeEl = this.widgetEl.querySelector('#audio-status-tag');

    // Toggle popover panel on sound button click
    this.toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePanel();
    });

    const closeBtn = this.widgetEl.querySelector('#audio-close-btn');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closePanel();
    });

    // Preset buttons
    const btnPiano = this.widgetEl.querySelector('#btn-preset-piano');
    btnPiano?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setBuiltinTrack('piano');
    });

    const btnLofi = this.widgetEl.querySelector('#btn-preset-lofi');
    btnLofi?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setBuiltinTrack('lofi');
    });

    // Volume slider event
    this.volumeSlider?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.setVolume(val / 100);
    });

    // File input event
    const fileInput = this.widgetEl.querySelector('#audio-file-input') as HTMLInputElement | null;
    fileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        this.loadUserFile(files[0]);
      }
    });

    // Close panel on click outside
    window.addEventListener('click', (e) => {
      if (this.panelEl && this.panelEl.style.display !== 'none') {
        if (!this.widgetEl?.contains(e.target as Node)) {
          this.closePanel();
        }
      }
    });

    container.appendChild(this.widgetEl);
    this.updateWidgetUI();
    return this.widgetEl;
  }

  private togglePanel(): void {
    if (!this.panelEl) return;
    const isClosed = this.panelEl.style.display === 'none';
    if (isClosed) {
      this.panelEl.style.display = 'flex';
      this.toggleBtn?.setAttribute('aria-expanded', 'true');
    } else {
      this.closePanel();
    }
  }

  private closePanel(): void {
    if (this.panelEl) {
      this.panelEl.style.display = 'none';
      this.toggleBtn?.setAttribute('aria-expanded', 'false');
    }
  }

  private updateWidgetUI(): void {
    const isPlaying = !this.isMuted && (this.sound?.playing() ?? false);

    if (this.toggleBtn) {
      this.toggleBtn.classList.toggle('muted', this.isMuted || !isPlaying);
      this.toggleBtn.classList.toggle('playing', isPlaying);
      this.toggleBtn.setAttribute('title', `${t('audio.toggle_mute')} (${isPlaying ? t('audio.playing') : t('audio.muted')})`);
    }

    if (this.statusBadgeEl) {
      this.statusBadgeEl.textContent = isPlaying ? t('audio.playing') : t('audio.muted');
      this.statusBadgeEl.classList.toggle('active', isPlaying);
    }

    if (this.trackTitleEl) {
      this.trackTitleEl.textContent = this.getTrackDisplayName();
    }

    const subEl = this.widgetEl?.querySelector('#audio-track-sub');
    if (subEl) {
      subEl.textContent = this.currentTrackKey === 'piano'
        ? 'Minecraft / C418 Style (Gymnopédie No. 1)'
        : this.currentTrackKey === 'lofi'
        ? 'Relaxed Lo-Fi Loop'
        : t('audio.custom_track');
    }

    const iconEl = this.widgetEl?.querySelector('.audio-track-icon');
    if (iconEl) {
      iconEl.textContent = this.currentTrackKey === 'piano' ? '🎹' : '🎵';
    }

    const btnPiano = this.widgetEl?.querySelector('#btn-preset-piano');
    btnPiano?.classList.toggle('active', this.currentTrackKey === 'piano');

    const btnLofi = this.widgetEl?.querySelector('#btn-preset-lofi');
    btnLofi?.classList.toggle('active', this.currentTrackKey === 'lofi');

    if (this.volumeSlider) {
      this.volumeSlider.value = String(Math.round(this.volume * 100));
    }

    const volPercentEl = this.widgetEl?.querySelector('#audio-vol-percent');
    if (volPercentEl) {
      volPercentEl.textContent = `${Math.round(this.volume * 100)}%`;
    }
  }

  public updateLanguage(): void {
    this.updateWidgetUI();
  }

  public dispose(): void {
    if (this.unregisterI18n) {
      this.unregisterI18n();
      this.unregisterI18n = null;
    }
    if (this.sound) {
      this.sound.unload();
      this.sound = null;
    }
    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
      this.customObjectUrl = null;
    }
    if (this.widgetEl) {
      this.widgetEl.remove();
      this.widgetEl = null;
    }
  }
}

import * as THREE from 'three';
import GUI from 'lil-gui';
import Stats from 'stats.js';
import { CameraRail } from './cameraRail';
import { GameState, SceneBase, SceneContext, SceneId } from './types';
import { IntroScene } from '../scenes/IntroScene';
import { BirthScene } from '../scenes/BirthScene';
import { GrowingScene } from '../scenes/GrowingScene';
import { MarriageScene } from '../scenes/MarriageScene';
import { DivorceScene } from '../scenes/DivorceScene';
import { DeathScene } from '../scenes/DeathScene';
import { OutroScene } from '../scenes/OutroScene';
import { getLanguage, setLanguage as i18nSetLanguage } from '../i18n';

export interface DirectorConfig {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cameraRail: CameraRail;
  uiContainer: HTMLElement;
  onSceneChange?: (sceneId: SceneId) => void;
}

export class Director {
  private threeScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraRail: CameraRail;
  private uiContainer: HTMLElement;
  private onSceneChangeCallback?: (sceneId: SceneId) => void;

  private state: GameState = {
    lang: 'en',
    sex: 'female',
    guesses: {},
  };

  private scenes: Map<SceneId, SceneBase> = new Map();
  private currentSceneId: SceneId = 'intro';
  private currentScene: SceneBase | null = null;
  private isTransitioning: boolean = false;

  // Debug tools
  private stats: Stats | null = null;
  private gui: GUI | null = null;

  constructor(config: DirectorConfig) {
    this.threeScene = config.scene;
    this.camera = config.camera;
    this.cameraRail = config.cameraRail;
    this.uiContainer = config.uiContainer;
    this.onSceneChangeCallback = config.onSceneChange;

    this.registerScenes();
    this.parseQueryParams();
    this.initDebugIfNeeded();
  }

  private registerScenes(): void {
    this.scenes.set('intro', new IntroScene());
    this.scenes.set('birth', new BirthScene());
    this.scenes.set('growing', new GrowingScene());
    this.scenes.set('marriage', new MarriageScene());
    this.scenes.set('divorce', new DivorceScene());
    this.scenes.set('death', new DeathScene());
    this.scenes.set('outro', new OutroScene());
  }

  private parseQueryParams(): void {
    this.state.lang = getLanguage();
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get('lang');
    if (langParam === 'rw' || langParam === 'fr' || langParam === 'en') {
      this.state.lang = langParam;
      i18nSetLanguage(langParam);
    }

    const sexParam = params.get('sex');
    if (sexParam === 'male' || sexParam === 'female') {
      this.state.sex = sexParam;
    }

    const sceneParam = params.get('scene') as SceneId | null;
    if (sceneParam && this.scenes.has(sceneParam)) {
      this.currentSceneId = sceneParam;
    }
  }

  private initDebugIfNeeded(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1' || import.meta.env.DEV) {
      this.stats = new Stats();
      this.stats.showPanel(0); // 0: fps
      this.stats.dom.style.position = 'fixed';
      this.stats.dom.style.top = '10px';
      this.stats.dom.style.left = '10px';
      this.stats.dom.style.zIndex = '9999';
      document.body.appendChild(this.stats.dom);

      this.gui = new GUI({ title: 'Life Path Debug' });
      this.gui.domElement.style.position = 'fixed';
      this.gui.domElement.style.top = '10px';
      this.gui.domElement.style.right = '10px';
      this.gui.domElement.style.zIndex = '9999';

      const navFolder = this.gui.addFolder('Scene Navigation');
      const sceneList: SceneId[] = [
        'intro',
        'birth',
        'growing',
        'marriage',
        'divorce',
        'death',
        'outro',
      ];

      const sceneObj = {
        active: this.currentSceneId,
        railProgress: this.cameraRail.getProgress(),
      };

      navFolder
        .add(sceneObj, 'active', sceneList)
        .name('Jump to Scene')
        .onChange((val: SceneId) => {
          this.goToScene(val);
        });

      const railFolder = this.gui.addFolder('Camera Rail');
      railFolder
        .add(sceneObj, 'railProgress', 0, 1, 0.001)
        .name('Rail t')
        .listen()
        .onChange((val: number) => {
          this.cameraRail.setProgress(val);
        });
    }
  }

  public async start(): Promise<void> {
    const targetT = this.cameraRail.getStationT(this.currentSceneId);
    this.cameraRail.setProgress(targetT);

    const scene = this.scenes.get(this.currentSceneId);
    if (!scene) return;

    await scene.load();
    this.currentScene = scene;

    const ctx = this.createContext();
    await scene.enter(ctx);

    if (this.onSceneChangeCallback) {
      this.onSceneChangeCallback(this.currentSceneId);
    }
  }

  public async goToScene(targetId: SceneId, duration = 2.2): Promise<void> {
    if (this.isTransitioning || targetId === this.currentSceneId) {
      if (targetId === this.currentSceneId && !this.currentScene) {
        // First start
      } else {
        return;
      }
    }

    const nextScene = this.scenes.get(targetId);
    if (!nextScene) return;

    this.isTransitioning = true;

    // 1. Exit current scene
    if (this.currentScene) {
      await this.currentScene.exit();
    }

    // 2. Preload next scene in parallel with rail animation
    const loadPromise = nextScene.load();

    // 3. Move camera rail along the path to the station
    const targetT = this.cameraRail.getStationT(targetId);
    await new Promise<void>((resolve) => {
      this.cameraRail.animateTo(targetT, duration, 'power2.inOut', () => {
        resolve();
      });
    });

    await loadPromise;

    // 4. Enter next scene
    this.currentSceneId = targetId;
    this.currentScene = nextScene;
    const ctx = this.createContext();
    await nextScene.enter(ctx);

    this.isTransitioning = false;

    // Notify listeners
    if (this.onSceneChangeCallback) {
      this.onSceneChangeCallback(this.currentSceneId);
    }
  }

  public nextScene(): Promise<void> {
    const order: SceneId[] = [
      'intro',
      'birth',
      'growing',
      'marriage',
      'divorce',
      'death',
      'outro',
    ];
    const currentIndex = order.indexOf(this.currentSceneId);
    if (currentIndex < order.length - 1) {
      return this.goToScene(order[currentIndex + 1]);
    }
    return Promise.resolve();
  }

  public prevScene(): Promise<void> {
    const order: SceneId[] = [
      'intro',
      'birth',
      'growing',
      'marriage',
      'divorce',
      'death',
      'outro',
    ];
    const currentIndex = order.indexOf(this.currentSceneId);
    if (currentIndex > 0) {
      return this.goToScene(order[currentIndex - 1]);
    }
    return Promise.resolve();
  }

  public update(dt: number, elapsed: number): void {
    if (this.stats) {
      this.stats.begin();
    }

    this.cameraRail.update(dt);

    if (this.currentScene) {
      this.currentScene.update(dt, elapsed);
    }

    if (this.stats) {
      this.stats.end();
    }
  }

  public setLanguage(lang: 'en' | 'rw' | 'fr'): void {
    this.state.lang = lang;
    i18nSetLanguage(lang).catch((err) => console.error('[Director] setLanguage error:', err));
    if (this.currentScene) {
      this.currentScene.onLanguageChange();
    }
  }

  public getState(): Readonly<GameState> {
    return this.state;
  }

  public getCurrentSceneId(): SceneId {
    return this.currentSceneId;
  }

  private createContext(): SceneContext {
    return {
      state: this.state,
      scene: this.threeScene,
      camera: this.camera,
      cameraRail: this.cameraRail,
      uiContainer: this.uiContainer,
      goToScene: (id: SceneId) => this.goToScene(id),
      updateState: (partial: Partial<GameState>) => {
        Object.assign(this.state, partial);
      },
    };
  }

  public dispose(): void {
    if (this.stats && this.stats.dom.parentElement) {
      this.stats.dom.parentElement.removeChild(this.stats.dom);
    }
    if (this.gui) {
      this.gui.destroy();
    }
    for (const scene of this.scenes.values()) {
      scene.dispose();
    }
  }
}

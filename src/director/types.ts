import * as THREE from 'three';
import { CameraRail } from './cameraRail';

export type SceneId = 'intro' | 'birth' | 'growing' | 'marriage' | 'divorce' | 'death' | 'outro';

export interface GameState {
  lang: 'en' | 'rw' | 'fr';
  sex: 'male' | 'female';
  name?: string;
  guesses: {
    marriageAge?: number;
    divorceYears?: number;
  };
}

export interface SceneContext {
  state: GameState;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cameraRail: CameraRail;
  uiContainer: HTMLElement;
  goToScene: (id: SceneId) => Promise<void>;
  updateState: (partial: Partial<GameState>) => void;
}

export interface SceneBase {
  id: SceneId;
  load(): Promise<void>;
  enter(ctx: SceneContext): Promise<void>;
  update(dt: number, elapsed: number): void;
  exit(): Promise<void>;
  onLanguageChange(): void;
  dispose(): void;
}

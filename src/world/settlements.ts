import * as THREE from 'three';

export interface SettlementsManager {
  group: THREE.Group;
  load: () => Promise<void>;
  update: (dt: number, elapsed: number) => void;
  dispose: () => void;
}

/**
 * Placeholder settlements manager. All Kenney suburban-kit props (buildings,
 * roads, vehicles, fences, lamps, poles) have been removed because they
 * rendered as plain white in the scene — they carry no embedded material colours.
 * The terrain, natural props, and hand-built Rwandan pavilions now give the
 * settlements their full visual character.
 */
export function createSettlementsManager(
  scene: THREE.Scene,
  _getHeight: (x: number, z: number) => number
): SettlementsManager {
  const group = new THREE.Group();
  scene.add(group);

  const load = async (): Promise<void> => {
    // No assets to load — all white Kenney props removed.
  };

  const update = (_dt: number, _elapsed: number): void => {
    // Nothing to update.
  };

  const dispose = (): void => {
    scene.remove(group);
  };

  return { group, load, update, dispose };
}

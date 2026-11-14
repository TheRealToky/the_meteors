import * as THREE from 'three';
import { SceneId } from '../director/types';
import { STATION_COORDINATES } from './path';
import { getStationBuilding } from './stationLayout';

export interface Milestone {
  id: SceneId;
  order: number; // 1 to 5 (0 = intro, 6 = outro)
  /** i18n keys for the quest card (text lives in /public/i18n) */
  titleKey: string;
  guideKey: string;
  pathT: number;
  /** Centre of the station building (world x, z; y unused) */
  housePosition: THREE.Vector3;
  /** Height of the beacon gem above the ground (roof top + a little) */
  arrowHeight: number;
  triggerRadius: number;
  targetAge: number;
}

const ORDERED: Array<{ id: SceneId; targetAge: number }> = [
  { id: 'birth', targetAge: 0 },
  { id: 'growing', targetAge: 15 },
  { id: 'marriage', targetAge: 24 },
  { id: 'divorce', targetAge: 41 },
  { id: 'death', targetAge: 75 },
];

/**
 * The 5 life milestones the player walks between. Positions come from the
 * path stations and the station buildings, so they can never drift apart.
 */
export const MILESTONES: Milestone[] = ORDERED.map(({ id, targetAge }, i) => {
  const station = STATION_COORDINATES.find((s) => s.id === id);
  const building = getStationBuilding(id);
  return {
    id,
    order: i + 1,
    titleKey: `quest.${id}.title`,
    guideKey: `quest.${id}.guide`,
    pathT: station?.t ?? 0,
    housePosition: new THREE.Vector3(building?.x ?? station?.x ?? 0, 0, building?.z ?? station?.z ?? 0),
    arrowHeight: (building?.height ?? 6) + 2.8,
    triggerRadius: 6.5,
    targetAge,
  };
});

export function getMilestoneById(id: SceneId): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}

export function getMilestoneByOrder(order: number): Milestone | undefined {
  return MILESTONES.find((m) => m.order === order);
}

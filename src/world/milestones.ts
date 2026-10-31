import * as THREE from 'three';
import { SceneId } from '../director/types';

export interface Milestone {
  id: SceneId;
  order: number; // 1 to 5 (0 = intro, 6 = outro)
  title: string;
  buildingName: string;
  guideStep: string;
  pathT: number;
  housePosition: THREE.Vector3;
  arrowHeight: number;
  triggerRadius: number;
  targetAge: number;
}

/**
 * 5 primary life milestones corresponding to real architectural houses/pavilions along the Rwandan path.
 * 
 * 1. Birth -> Maternity Health Center (Guide parents)
 * 2. Youth -> The School of Life (Inclusive education & trade wisdom)
 * 3. Marriage -> Town Hall (Umurenge civil registry)
 * 4. Divorce -> Community Justice Courtroom (Civil mediation & records)
 * 5. Death -> Sunset Sanctuary & Memory Pavilion (Honoring life completion & mortality stats)
 */
export const MILESTONES: Milestone[] = [
  {
    id: 'birth',
    order: 1,
    title: 'Newborn Registration',
    buildingName: 'District Maternity Health Center',
    guideStep: 'Guide your parents to the Health Center to register your birth among 356,838 newborns.',
    pathT: 0.192,
    housePosition: new THREE.Vector3(-36.0, 0, -28.0),
    arrowHeight: 8.5,
    triggerRadius: 6.5,
    targetAge: 0,
  },
  {
    id: 'growing',
    order: 2,
    title: 'Youth & Growing Up',
    buildingName: 'The School of Life',
    guideStep: 'Walk to the School of Life pavilion to explore youth milestones, education, and vocational beginnings.',
    pathT: 0.299,
    housePosition: new THREE.Vector3(-22.0, 0, -2.0),
    arrowHeight: 8.5,
    triggerRadius: 6.5,
    targetAge: 15,
  },
  {
    id: 'marriage',
    order: 3,
    title: 'Civil Marriage',
    buildingName: 'Town Hall (Umurenge Civil Registry)',
    guideStep: 'Head to the Town Hall to register civil marriage ceremonies and discover wedding age patterns.',
    pathT: 0.455,
    housePosition: new THREE.Vector3(20.0, 0, -5.0),
    arrowHeight: 9.0,
    triggerRadius: 6.5,
    targetAge: 24,
  },
  {
    id: 'divorce',
    order: 4,
    title: 'Marital Transition',
    buildingName: 'Community Justice Courtroom',
    guideStep: 'Proceed to the Justice Courtroom to examine marital transitions and divorce duration records.',
    pathT: 0.551,
    housePosition: new THREE.Vector3(32.0, 0, 26.0),
    arrowHeight: 8.5,
    triggerRadius: 6.5,
    targetAge: 41,
  },
  {
    id: 'death',
    order: 5,
    title: 'The Final Horizon & Legacy',
    buildingName: 'Sunset Sanctuary & Memory Pavilion',
    guideStep: 'Journey to the Sunset Sanctuary to honor a completed life and review vital mortality statistics.',
    pathT: 0.785,
    housePosition: new THREE.Vector3(68.0, 0, -34.0),
    arrowHeight: 9.0,
    triggerRadius: 6.5,
    targetAge: 75,
  },
];

export function getMilestoneById(id: SceneId): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}

export function getMilestoneByOrder(order: number): Milestone | undefined {
  return MILESTONES.find((m) => m.order === order);
}

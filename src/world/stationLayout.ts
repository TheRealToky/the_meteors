import { STATION_COORDINATES } from './path';

/**
 * Where each station building stands. Pure data + math (no three.js objects),
 * shared by the buildings, the vegetation (to keep clear of walls), the camera
 * (to frame the house on arrival) and the waypoint beacon.
 *
 * Each building sits beside its path station, set back from the path, with its
 * front door (local +Z) facing the path.
 */

export type BuildingKind =
  | 'gateway'   // intro: welcome gate with Imigongo patterns + small traditional hut
  | 'clinic'    // birth: health centre
  | 'school'    // growing: primary school block
  | 'office'    // marriage: sector office (civil registry) with a flower arch
  | 'court'     // divorce: community court / mediation hall
  | 'memorial'  // death: quiet memorial garden with a traditional inzu
  | 'lookout';  // outro: ridge lookout deck with a royal-style inzu

export interface StationBuilding {
  id: string;
  kind: BuildingKind;
  /** Centre of the footprint (world x, z) */
  x: number;
  z: number;
  /** Rotation around Y so the local +Z (front) faces the path */
  yaw: number;
  /** Footprint size in local X (width) and Z (depth), metres */
  width: number;
  depth: number;
  /** Approximate roof top above the floor, for the beacon */
  height: number;
  /** Unit vector from the path station toward the building (world x, z) */
  dirX: number;
  dirZ: number;
  /** Path station position (world x, z) */
  pathX: number;
  pathZ: number;
}

// Direction hints: which side of the path each building stands on (from the
// original pavilion positions), plus the footprint of each design.
const SPECS: Record<string, { kind: BuildingKind; hintX: number; hintZ: number; width: number; depth: number; height: number }> = {
  intro:    { kind: 'gateway',  hintX: -72.0, hintZ: -56.0, width: 9,  depth: 7, height: 5.5 },
  birth:    { kind: 'clinic',   hintX: -36.0, hintZ: -28.0, width: 10, depth: 6, height: 4.6 },
  growing:  { kind: 'school',   hintX: -22.0, hintZ: -2.0,  width: 13, depth: 6, height: 4.4 },
  marriage: { kind: 'office',   hintX: 20.0,  hintZ: -5.0,  width: 11, depth: 7, height: 5.0 },
  divorce:  { kind: 'court',    hintX: 32.0,  hintZ: 26.0,  width: 10, depth: 7, height: 5.2 },
  death:    { kind: 'memorial', hintX: 68.0,  hintZ: -34.0, width: 10, depth: 9, height: 6.2 },
  outro:    { kind: 'lookout',  hintX: 75.0,  hintZ: 32.0,  width: 10, depth: 7, height: 6.8 },
};

/** Gap between the path centre line and the building front (path half-width is 1.6 m) */
const SETBACK = 3.4;

export const STATION_BUILDINGS: StationBuilding[] = STATION_COORDINATES.map((s) => {
  const spec = SPECS[s.id];
  let dx = spec.hintX - s.x;
  let dz = spec.hintZ - s.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const dist = SETBACK + spec.depth / 2;
  return {
    id: s.id,
    kind: spec.kind,
    x: s.x + dx * dist,
    z: s.z + dz * dist,
    // rotation.y maps local +Z to (sin yaw, cos yaw); we want it to point back at the path (-dir)
    yaw: Math.atan2(-dx, -dz),
    width: spec.width,
    depth: spec.depth,
    height: spec.height,
    dirX: dx,
    dirZ: dz,
    pathX: s.x,
    pathZ: s.z,
  };
});

export function getStationBuilding(id: string): StationBuilding | undefined {
  return STATION_BUILDINGS.find((b) => b.id === id);
}

/**
 * True if (x, z) lies inside a building footprint grown by `margin` metres.
 * Used by the vegetation scatter so grass and trees never grow through walls.
 */
export function isInsideBuilding(x: number, z: number, margin = 0): boolean {
  for (const b of STATION_BUILDINGS) {
    // Rotate the point into the building's local frame
    const px = x - b.x;
    const pz = z - b.z;
    const c = Math.cos(-b.yaw);
    const s = Math.sin(-b.yaw);
    const lx = px * c + pz * s;
    const lz = -px * s + pz * c;
    if (Math.abs(lx) <= b.width / 2 + margin && Math.abs(lz) <= b.depth / 2 + margin) return true;
  }
  return false;
}

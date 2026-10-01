// Out of sight, out of work. An animal that only wanders about, or a plant
// that sways, is simulated only while it is within sight: on screen, or less
// than SIGHT_MARGIN px past its edges at its own depth (a phone held upright
// sees about 200 px on each side of the swimmer, where the animals were
// simulated up to 1 100 px). Out of sight it waits where it is, and goes on
// when it comes back into view. Those that follow the swimmer or play a scene
// (vie-jeu.ts) are always simulated near it.

/** beyond the edge of the screen, in world px at the depth of the animal; more than what is drawn (200 px, main.ts) */
export const SIGHT_MARGIN = 300;

/** the kinds of animals that live on their own, without the swimmer */
const WANDERERS = new Set(['swim', 'floor', 'surface']);

/** what the rule needs of the camera: the world x seen at depth z, with a margin (View.xRange) */
export interface Sight { xRange(z: number, margin?: number): [number, number]; }

/** x at depth z is on screen or less than `margin` px past its edges */
export function inSight(view: Sight, x: number, z: number, margin = SIGHT_MARGIN): boolean {
  const [x0, x1] = view.xRange(z, margin);
  return x >= x0 && x <= x1;
}

/** an animal of this kind, busy or not with something of the game, is simulated even out of sight */
export function awakeOutOfSight(kind: string, busy: boolean): boolean {
  return busy || !WANDERERS.has(kind);
}

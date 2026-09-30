// The ends of the world (docs/chapitres.md): it starts at the surface of the
// Nurserie and ends at the bottom of the Remontée, past its well of light. The
// bottom of the Fosse is guarded by its obstacle. Each chapter with an obstacle
// bars the way down at its end, until the obstacle is crossed: nothing hurts,
// the water just holds the swimmer back (zero danger). Who may cross which
// obstacle is the rule `CanCross` (the traits of the body: obstacles.ts).

import { clamp } from '../engine';
import { BIOMES, X1, span, type ChapterId } from './biomes';

/** the chapters whose obstacle bars the way down (docs/chapitres.md, overview) */
export const OBSTACLES: ChapterId[] = ['recif', 'foret', 'grotte', 'sources', 'glacier', 'jardin', 'fosse'];

export interface Gate {
  /** the chapter whose obstacle it is */
  chapter: ChapterId;
  /** where it bars the way, along x */
  x: number;
}

/** how far before a border the water starts holding the swimmer back (px) */
export const SOFT = 420;
/** the start of the world: the surface of the Nurserie */
export const WORLD_START = BIOMES[0].x0 + 200;
/** the bottom of the Fosse, before the light of the Remontée: its obstacle guards it */
export const FOSSE_BOTTOM = span('fosse')[1] - 800;
/** the end of the world: the bottom of the Remontée, a little past its well of light (remontee.ts) */
export const WORLD_END = span('remontee')[0] + 1400;

/** the obstacles along the descent, one at the end of each chapter that has one; the Fosse's guards its bottom */
export const GATES: Gate[] = OBSTACLES.map((chapter) => ({ chapter, x: Math.min(span(chapter)[1], FOSSE_BOTTOM) }));

export interface Limits {
  /** the obstacles already crossed */
  crossed: Set<ChapterId>;
  /** the travel of the tests went beyond the end: the whole map is open */
  beyond: boolean;
}

export function newLimits(): Limits {
  return { crossed: new Set(), beyond: false };
}

/** whether the swimmer may cross this obstacle (obstacles.ts asks its traits); by default, everyone may */
export type CanCross = (chapter: ChapterId) => boolean;
export const everyone: CanCross = () => true;

/** how far the swimmer may go along x: from the start to the first obstacle it may not cross, or the end */
export function reach(l: Limits, can: CanCross = everyone): [number, number] {
  if (l.beyond) return [WORLD_START, X1 - 200];
  for (const g of GATES) if (!l.crossed.has(g.chapter) && !can(g.chapter)) return [WORLD_START, g.x];
  return [WORLD_START, WORLD_END];
}

/** the swimmer at x: remember the obstacles it has gone past */
export function pass(l: Limits, x: number): void {
  for (const g of GATES) if (x > g.x && g.x < WORLD_END) l.crossed.add(g.chapter);
}

/** the travel of the tests to x: every obstacle before it counts as crossed, and past the end the whole map opens */
export function travel(l: Limits, x: number): void {
  for (const g of GATES) if (g.x <= x) l.crossed.add(g.chapter);
  if (x > WORLD_END) l.beyond = true;
}

/**
 * The swimming speed along x the swimmer gets near a border: the closer, the
 * less it moves outward, and a gentle current pushes it back in.
 */
export function holdBack(x: number, dvx: number, [lo, hi]: [number, number]): number {
  const u = clamp((x - (hi - SOFT)) / SOFT, 0, 1), w = clamp((lo + SOFT - x) / SOFT, 0, 1);
  if (u > 0 && dvx > 0) dvx *= 1 - u;
  if (w > 0 && dvx < 0) dvx *= 1 - w;
  return dvx - 0.5 * u * u + 0.5 * w * w;
}

/** the travel of the settings panel is for the tests: shown with ?dev only */
export function travelShown(search: string): boolean {
  return new URLSearchParams(search).has('dev');
}

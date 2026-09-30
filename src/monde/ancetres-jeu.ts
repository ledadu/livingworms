// The ancestors of the saved game in the world (ancetres.ts), with the map of the game: which ones can live
// in it, with their species, and where. main.ts makes them parents left behind (adieu-jeu.ts).

import { spec as makeSpec, type Spec } from '../engine';
import { BIOMES, X1, floorAt, liftAt, openFloor, span } from './biomes';
import { ceilAt } from './grotte';
import { WORLD_START } from './limites';
import { meetRange } from './partenaires';
import { homesOf, type Chapter, type Pt, type Sea } from './ancetres';
import type { Ancestor } from './partie';

export const CHAPTERS: Chapter[] = BIOMES.map((b, i) => {
  const [a, c] = span(b.id);
  return { id: b.id, x0: b.x0, span: [Math.max(a, WORLD_START), Math.min(c, X1 - 200)], meet: meetRange(i) };
});

export const SEA: Sea = {
  water: (x) => [Math.max(40, ceilAt(x, 0) + 50), floorAt(x, 0) - 70],
  // as high as the swimmer arrives in a chapter (arrival, biomes.ts)
  mid: (x) => Math.max(120, openFloor(x, 0) - 260 - liftAt(x))
};

/** the ancestors of a lineage that live in the world, the oldest first: their species, their home, and their rank in the lineage */
export function ancestorsIn(lineage: readonly Ancestor[]): { spec: Spec; home: Pt; k: number }[] {
  const homes = homesOf(lineage, CHAPTERS, SEA), out: { spec: Spec; home: Pt; k: number }[] = [];
  lineage.forEach((a, k) => {
    const home = homes[k];
    if (!home) return;
    try { out.push({ spec: makeSpec(a.creature as Parameters<typeof makeSpec>[0]), home, k }); } catch { /* a creature that no longer reads */ }
  });
  return out;
}

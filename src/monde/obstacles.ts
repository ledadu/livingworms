// The key obstacles (docs/chapitres.md, overview): one per chapter, at its end,
// that bars the way down until the swimmer has one of the traits that cross it.
// Nothing hurts (zero danger): the obstacle pushes back, slows down or hides
// the way. With a key, it is still felt, but lets the swimmer through.

import { clamp } from '../engine';
import type { ChapterId } from './biomes';
import type { CanCross } from './limites';

/** the traits of the body that open the way (docs/mecaniques.md); the song is step 5 */
export type Trait = 'nageoires' | 'lanterne' | 'pinces' | 'corpsFin' | 'carapace' | 'pulsation' | 'filaments' | 'cils' | 'chant';

/** how an obstacle holds the swimmer back: a current that pushes, a thickness that slows, a dark that hides */
export type Hold = 'push' | 'slow' | 'hide';

export interface Obstacle {
  /** what it is, in the words of the game */
  name: string;
  /** the traits that cross it: at least two */
  keys: Trait[];
  hold: Hold;
  /** how far before it the swimmer starts to feel it (px) */
  soft: number;
}

export const OBSTACLE: Partial<Record<ChapterId, Obstacle>> = {
  recif: { name: 'le courant de passe', keys: ['nageoires', 'pulsation'], hold: 'push', soft: 900 },
  foret: { name: 'le mur d’algues', keys: ['pinces', 'corpsFin'], hold: 'slow', soft: 700 },
  grotte: { name: 'la galerie noire', keys: ['corpsFin', 'lanterne'], hold: 'hide', soft: 800 },
  sources: { name: 'le couloir brûlant', keys: ['carapace', 'cils'], hold: 'push', soft: 800 },
  glacier: { name: 'l’eau glacée', keys: ['carapace', 'filaments'], hold: 'slow', soft: 900 },
  jardin: { name: 'le vide', keys: ['pulsation', 'filaments'], hold: 'push', soft: 900 },
  fosse: { name: 'le noir et le silence', keys: ['lanterne', 'chant'], hold: 'hide', soft: 700 }
};

/** the traits that cross the obstacle of each chapter that has one */
export const KEYS: Partial<Record<ChapterId, Trait[]>> = Object.fromEntries(Object.entries(OBSTACLE).map(([c, o]) => [c, o!.keys]));

/** whether a body with these traits crosses the obstacle of this chapter (a chapter without one lets everyone through) */
export function crosses(chapter: ChapterId, traits: Iterable<string>): boolean {
  const keys = OBSTACLE[chapter]?.keys;
  if (!keys) return true;
  for (const t of traits) if ((keys as string[]).includes(t)) return true;
  return false;
}

/** the rule of limites.ts for a body with these traits */
export function crossWith(traits: Iterable<string>): CanCross {
  const has = [...traits];
  return (chapter) => crosses(chapter, has);
}

/** the key of the obstacle this body crosses it with, if any */
export function keyOf(chapter: ChapterId, traits: Iterable<string>): Trait | null {
  const keys = OBSTACLE[chapter]?.keys ?? [];
  for (const t of traits) if ((keys as string[]).includes(t)) return t as Trait;
  return null;
}

/**
 * The swimming speed near an obstacle at x = gate, the swimmer at x going dvx, dvy:
 * u is how deep in its reach (0..1). Barred, it holds the swimmer back its own way;
 * crossed, it is only felt a little.
 */
export function feel(o: Obstacle, gate: number, x: number, dvx: number, dvy: number, open: boolean): [number, number] {
  const u = clamp((x - (gate - o.soft)) / o.soft, 0, 1);
  if (u <= 0 || x > gate + 60) return [dvx, dvy];
  if (open) {
    // a key: the current still pulls a little, the thickness still drags a little
    if (o.hold === 'push') return [dvx - 0.35 * u, dvy];
    if (o.hold === 'slow') return [dvx * (1 - 0.35 * u), dvy * (1 - 0.25 * u)];
    return [dvx, dvy];
  }
  if (o.hold === 'push') {
    // the current grows until it is stronger than any swimming, and carries back
    const k = u * u;
    return [(dvx > 0 ? dvx * (1 - 0.6 * k) : dvx) - 2.6 * k, dvy];
  }
  if (o.hold === 'slow') {
    // thick water: every stroke goes less far, forward most
    const k = Math.sqrt(u);
    return [(dvx > 0 ? dvx * (1 - k) : dvx * (1 - 0.4 * k)) - 0.3 * u * u, dvy * (1 - 0.6 * k)];
  }
  // hidden: the way is lost in the dark; the water turns the swimmer gently back
  return [(dvx > 0 ? dvx * (1 - u) : dvx) - 0.8 * u * u, dvy];
}

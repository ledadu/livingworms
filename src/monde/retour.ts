// Going back to an earlier species of the lineage (docs/mecaniques.md, « Reprendre une espèce »): from the tree, the
// swimmer takes again the form of one of its ancestors, here, in the chapter where it is. Nothing is undone: the one
// it was joins the lineage like a parent left behind (with where it was left), marked with the ancestor it went back
// to (`back`), and stays there in the world; the next generation is a copy of that ancestor. Pure: the scene is
// retour-jeu.ts.

import { growth } from '../engine3/grow';
import type { Ancestor, Partie, Place } from './partie';

/** the i-th of the lineage went back to an earlier one: its index (the oldest is 0), else null (a birth, or broken) */
export function backOf(lineage: readonly Ancestor[], i: number): number | null {
  const k = lineage[i]?.back;
  return Number.isInteger(k) && k! >= 0 && k! < i ? k! : null;
}

/** the swimmer takes again the form of the k-th ancestor, in this chapter, the one it was left at this place */
export function returnTo(p: Partie, k: number, chapter: string, at?: Place): Partie {
  const a = p.lineage[k];
  if (!a || !p.creature) return p;
  const left: Ancestor = { creature: p.creature, chapter, back: k, ...(at && { at }) };
  return { ...p, chapter, creature: { ...a.creature }, lineage: [...p.lineage, left] };
}

/** how long the scene lasts (s): the lights flow from the one we were to the new body, which grows from small */
export const FLOW = 1.8, GROW = 2.4, SMALL = 0.3;
/** the lights of the scene */
export const MOTES = 14;

/** the size of the new body at s seconds of the scene (× its own) */
export const sizeAt = (s: number) => growth(s, SMALL, GROW);

export interface Pt { x: number; y: number }

/**
 * The lights at s seconds of the scene, going from the one we were to the new body, each on its own curl around the
 * line between them: x, y, size (0..1), alpha, for those alive now.
 */
export function motesAt(s: number, from: Pt, to: Pt, n = MOTES): number[] {
  const out: number[] = [];
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * (FLOW - 0.9), u = (s - t0) / 0.9;
    if (u <= 0 || u >= 1) continue;
    // ease along the line, and a curl to one side or the other, wider in the middle of the way
    const e = u * u * (3 - 2 * u), side = (i % 2 ? 1 : -1) * (24 + 10 * ((i * 7) % 5)) * Math.sin(Math.PI * u);
    out.push(from.x + dx * e + nx * side, from.y + dy * e + ny * side, 0.5 + 0.5 * Math.sin(Math.PI * u), Math.sin(Math.PI * u));
  }
  return out;
}

/** the words of the lineage when it takes again an earlier form */
export const WORDS = ['Nous reprenons une forme d’autrefois.', 'Celle que nous étions nage ici, parmi les nôtres.'];

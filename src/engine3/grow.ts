// Growing a creature: a newborn comes out of its egg small and grows to its size within a few seconds
// (docs/mecaniques.md, « L'éclosion »). The engine fixes the size of each part when the creature is built; this
// changes it while it lives, every length and width of every part by the same factor, around its root, so the
// creature swims on without a jump. Nothing else of the engine changes: a creature that never grows is the same.

import type { Creature3 } from './creature3';

/** makes the creature k times bigger (k < 1: smaller), at once, around its root */
export function rescale(cr: Creature3, k: number): void {
  if (!(k > 0) || k === 1) return;
  const r = cr.root, x0 = r.x[0], y0 = r.y[0], z0 = r.z[0];
  for (const s of cr.list) {
    s.scale *= k; s.len *= k; s.maxRad *= k;
    for (let i = 0; i <= s.n; i++) {
      s.rad[i] *= k; s.lens[i] *= k;
      s.x[i] = x0 + (s.x[i] - x0) * k; s.y[i] = y0 + (s.y[i] - y0) * k; s.z[i] = z0 + (s.z[i] - z0) * k;
      s.ox[i] = x0 + (s.ox[i] - x0) * k; s.oy[i] = y0 + (s.oy[i] - y0) * k; s.oz[i] = z0 + (s.oz[i] - z0) * k;
    }
  }
}

/** how big a newborn is at `t` seconds out of its egg, from `from` to 1 in `time` s: quick first, then slower */
export function growth(t: number, from: number, time: number): number {
  const u = Math.min(1, Math.max(0, t / time));
  return from + (1 - from) * (1 - (1 - u) * (1 - u) * (1 - u));
}

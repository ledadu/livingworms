// The passage from one chapter to the next. The light already turns across
// the border (biomes.moodAt); here the animals mingle there the same way, and
// the opening title waits until the new light has mostly won.

import { BIOMES, BLEND, X0, X1, biomeIndex, presence } from './biomes';

/** an x for an animal of chapter `bi`: across its span and into the blend on both sides, as much as its light is there */
export function faunaX(bi: number, R: () => number): number {
  const a = Math.max(X0 + 300, BIOMES[bi].x0 - BLEND / 2), b = Math.min(X1 - 200, (BIOMES[bi + 1]?.x0 ?? X1) + BLEND / 2);
  for (let k = 0; k < 12; k++) {
    const x = a + R() * (b - a);
    if (R() < presence(x, bi)) return x;
  }
  return (Math.max(a, BIOMES[bi].x0) + Math.min(b, BIOMES[bi + 1]?.x0 ?? X1)) / 2;
}

/** how far the new light must have won before its title shows */
export const TITLE_AT = 0.85;

/**
 * When to show a chapter's opening: once its light has mostly won (not at the
 * line itself), and not again for a chapter just left and come back to, so
 * that swimming to and fro across a border does not repeat titles.
 */
export class ChapterWatch {
  shown = -1;
  private prev = -1;
  /** the chapter to announce now at x, or -1 */
  step(x: number): number {
    const i = biomeIndex(x);
    if (i === this.shown || presence(x, i) < TITLE_AT) return -1;
    if (i === this.prev) { this.prev = this.shown; this.shown = i; return -1; }
    this.prev = this.shown; this.shown = i;
    return i;
  }
  /** a jump (a new game, a teleport): announce where we land at once */
  jump(x: number): number {
    this.prev = -1; this.shown = biomeIndex(x);
    return this.shown;
  }
}

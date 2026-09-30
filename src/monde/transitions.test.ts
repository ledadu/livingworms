import { describe, expect, it } from 'vitest';
import { BIOMES, BLEND, presence } from './biomes';
import { ChapterWatch, TITLE_AT, faunaX } from './transitions';
import { rng } from '../engine';

describe('the passage between chapters', () => {
  it('lets the animals of a chapter spill into the blend, thinning out past the border', () => {
    const R = rng(5), bi = 3, a = BIOMES[bi].x0, b = BIOMES[bi + 1].x0;
    const xs = Array.from({ length: 4000 }, () => faunaX(bi, R));
    for (const x of xs) { expect(x).toBeGreaterThan(a - BLEND / 2 - 1); expect(x).toBeLessThan(b + BLEND / 2 + 1); }
    const before = xs.filter((x) => x < a).length, after = xs.filter((x) => x > b).length;
    expect(before).toBeGreaterThan(40); expect(after).toBeGreaterThan(40);
    expect(before + after).toBeLessThan(xs.length * 0.3);
  });

  it('announces a chapter once its light has mostly won, and not again when swimming back and forth', () => {
    const w = new ChapterWatch(), b = BIOMES[4].x0;
    expect(w.jump(BIOMES[3].x0 + 1500)).toBe(3);
    let at = -1, got: number[] = [];
    for (let x = b - 1000; x < b + 1000; x += 10) { const i = w.step(x); if (i >= 0) { got.push(i); at = x; } }
    expect(got).toEqual([4]);
    expect(presence(at, 4)).toBeGreaterThanOrEqual(TITLE_AT);
    expect(at).toBeGreaterThan(b + 300);
    got = [];
    for (let k = 0; k < 3; k++) for (const x of [b - 900, b + 900]) { const i = w.step(x); if (i >= 0) got.push(i); }
    expect(got).toEqual([]);
    for (const x of [BIOMES[5].x0 + 900, b + 900]) { const i = w.step(x); if (i >= 0) got.push(i); }
    expect(got).toEqual([5]);
  });
});

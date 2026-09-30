import { describe, expect, it } from 'vitest';
import { BIOMES, floorAt } from './biomes';
import { BACK_Z, CAVE_A, CAVE_B, caveCover, caveDark, caveKeeps, caveRepel, caveSpan, ceilAt, makeGlimmers, makePillars, makeWells } from './grotte';

const inside = (n: number) => Array.from({ length: n }, (_, i) => CAVE_A + ((CAVE_B - CAVE_A) * (i + 0.5)) / n);

describe('la Grotte', () => {
  it('runs along the Grotte chapter when the map has one', () => {
    const map = [{ ...BIOMES[0], x0: 0 }, { ...BIOMES[1], id: 'grotte' as const, x0: 5000 }, { ...BIOMES[2], x0: 9000 }];
    expect(caveSpan(map)).toEqual([5250, 8850]);
    expect(CAVE_B - CAVE_A).toBeGreaterThan(2000);
  });

  it('has no vault outside, a closed one in the middle', () => {
    expect(caveCover(CAVE_A - 10)).toBe(0);
    expect(caveCover(CAVE_B + 10)).toBe(0);
    expect(ceilAt(CAVE_A - 10, 0)).toBe(-Infinity);
    expect(caveCover((CAVE_A + CAVE_B) / 2)).toBe(1);
  });

  it('leaves room to swim under the vault, and closes on the floor at the back', () => {
    for (const x of inside(200)) {
      if (caveCover(x) < 1) continue;
      expect(floorAt(x, 0) - ceilAt(x, 0)).toBeGreaterThan(150);
      expect(Math.abs(floorAt(x, BACK_Z) - ceilAt(x, BACK_Z))).toBeLessThan(12);
    }
  });

  it('is lit first, then dark', () => {
    const d = inside(20).map(caveDark);
    expect(d[2]).toBeLessThan(0.5);
    expect(d[17]).toBeGreaterThan(0.9);
    for (let i = 1; i < 17; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1] - 1e-9);
  });

  it('keeps its pillars out of the swimming plane and its wells over the lit halls', () => {
    for (const p of makePillars()) {
      expect(p.z).toBeGreaterThan(100);
      expect(p.x).toBeGreaterThan(CAVE_A);
      expect(p.x).toBeLessThan(CAVE_B);
    }
    const wells = makeWells();
    expect(wells.length).toBeGreaterThan(2);
    for (const w of wells) expect(caveDark(w.x)).toBeLessThan(0.6);
    const g = makeGlimmers();
    expect(g.length / 5).toBeGreaterThan(10);
    for (let i = 0; i < g.length; i += 5) expect(caveDark(g[i])).toBeGreaterThan(0.6);
  });

  it('turns the schools back at the mouths and keeps the kelp outside', () => {
    expect(caveRepel(CAVE_A + 100)).toBeLessThan(0);
    expect(caveRepel(CAVE_B - 100)).toBeGreaterThan(0);
    expect(caveRepel(CAVE_A - 100)).toBe(0);
    const mid = (CAVE_A + CAVE_B) / 2;
    expect(caveKeeps({ x: mid, kind: 'kelp' })).toBe(false);
    expect(caveKeeps({ x: mid, kind: 'anemone' })).toBe(true);
    expect(caveKeeps({ x: CAVE_A - 400, kind: 'kelp' })).toBe(true);
  });
});

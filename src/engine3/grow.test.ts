import { describe, expect, it } from 'vitest';
import { SPECIES } from '../content/species';
import { STEP } from '../engine/util';
import { Creature3 } from './creature3';
import { growth, rescale } from './grow';

const swim = (cr: Creature3, from: number, n: number) => { for (let i = 0; i < n; i++) cr.steer((from + i) * STEP, 1, 0, 0, 0.1); };
const width = (cr: Creature3) => cr.box[3] - cr.box[0];

describe('a newborn that grows', () => {
  it('is, once grown, as big as the same creature born big', () => {
    for (const id of ['larve', 'poissonClown', 'meduse', 'crabe', 'poulpe']) {
      const small = new Creature3(SPECIES[id](), 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 0.8 * 0.3, phase: 0 });
      const big = new Creature3(SPECIES[id](), 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 0.8, phase: 0 });
      swim(small, 0, 60); swim(big, 0, 60);
      rescale(small, 1 / 0.3);
      swim(small, 60, 120); swim(big, 60, 120);
      expect(width(small) / width(big)).toBeGreaterThan(0.85);
      expect(width(small) / width(big)).toBeLessThan(1.15);
      for (const s of small.list) for (let i = 0; i <= s.n; i++) expect(Number.isFinite(s.x[i])).toBe(true);
    }
  });

  it('grows around its root, without a jump', () => {
    const cr = new Creature3(SPECIES.poissonClown(), 100, 50, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 0.3 });
    swim(cr, 0, 30);
    const x = cr.root.x[0], y = cr.root.y[0], w = width(cr);
    rescale(cr, 1.1);
    cr.steer(30 * STEP, 1, 0, 0, 0.1);
    expect(Math.hypot(cr.root.x[0] - x, cr.root.y[0] - y)).toBeLessThan(3);
    expect(width(cr)).toBeGreaterThan(w * 1.05);
    expect(width(cr)).toBeLessThan(w * 1.2);
  });

  it('grows quickly at first, then slower, to its size', () => {
    expect(growth(0, 0.3, 5)).toBeCloseTo(0.3);
    expect(growth(5, 0.3, 5)).toBeCloseTo(1);
    expect(growth(9, 0.3, 5)).toBeCloseTo(1);
    expect(growth(1, 0.3, 5) - growth(0, 0.3, 5)).toBeGreaterThan(growth(5, 0.3, 5) - growth(4, 0.3, 5));
  });
});

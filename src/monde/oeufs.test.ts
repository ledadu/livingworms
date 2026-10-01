import { describe, expect, it } from 'vitest';
import { STEP, rng } from '../engine';
import { CRACK, EGG_R, LAY_GAP, SHELL, SPLIT, gone, hatchEggs, laid, layEggs, middle, stepEggs, type Eggs } from './oeufs';

const run = (eg: Eggs, s: number, water?: (x: number, y: number) => { x: number; y: number }, shake = 0) => {
  const opened: number[] = [];
  for (let i = 0; i < Math.round(s / STEP); i++) opened.push(...stepEggs(eg, water, shake));
  return opened;
};
const fresh = (seed = 1) => layEggs({ x: 0, y: 0 }, { x: 0, y: 0 }, 4, rng(seed));

describe('the eggs laid in the water', () => {
  it('come one after the other', () => {
    const eg = fresh();
    run(eg, 0.05);
    expect(eg.list.filter(laid).length).toBe(1);
    run(eg, LAY_GAP * 3);
    expect(eg.list.filter(laid).length).toBe(4);
  });

  it('gather in a small heap, held by their jelly, never through one another', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const eg = fresh(seed);
      run(eg, 5);
      const m = middle(eg);
      for (const e of eg.list) expect(Math.hypot(e.x - m.x, e.y - m.y)).toBeLessThan(EGG_R * 3.2);
      for (const a of eg.list) for (const b of eg.list) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan((a.r + b.r) * 0.85);
    }
  });

  it('drift with the water, stretched by it, and come back to rest round where they were laid', () => {
    const eg = fresh();
    run(eg, 4);
    const m0 = middle(eg);
    run(eg, 1, () => ({ x: 1.2, y: 0 }));
    expect(middle(eg).x).toBeGreaterThan(m0.x + 20);
    expect(Math.max(...eg.list.map((e) => e.squash))).toBeGreaterThan(1.05);
    run(eg, 12);
    expect(Math.hypot(middle(eg).x - m0.x, middle(eg).y - m0.y)).toBeLessThan(25);
    for (const e of eg.list) expect(Math.abs(e.squash - 1)).toBeLessThan(0.05);
  });

  it('tremble when we stay by them', () => {
    const eg = fresh();
    run(eg, 3);
    const shapes: number[] = [];
    for (let i = 0; i < 60; i++) { stepEggs(eg, undefined, 1); shapes.push(eg.list[0].squash); }
    expect(Math.max(...shapes) - Math.min(...shapes)).toBeGreaterThan(0.08);
  });
});

describe('the hatching', () => {
  it('opens the chosen egg first, then each of the others once, and nothing is left after', () => {
    const eg = fresh();
    run(eg, 3);
    hatchEggs(eg, 2);
    const opened = run(eg, SPLIT[3] + CRACK + 0.1);
    expect(opened[0]).toBe(2);
    expect([...opened].sort()).toEqual([0, 1, 2, 3]);
    expect(gone(eg)).toBe(false);
    run(eg, SHELL);
    expect(gone(eg)).toBe(true);
  });

  it('without a choice, opens them in their order, and a second word changes nothing', () => {
    const eg = fresh();
    run(eg, 3);
    hatchEggs(eg);
    hatchEggs(eg, 3);
    const opened = run(eg, 2);
    expect(opened).toEqual([0, 1, 2, 3]);
  });
});

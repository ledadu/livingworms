import { describe, expect, it } from 'vitest';
import { CLEAR, REACH, hear, panOnScreen } from './ecoute';

describe('the distance of sounds', () => {
  it('near: loud, clear, dry; farther: quieter, duller, more in the reverb', () => {
    const near = hear(0, 0);
    expect(near.g).toBe(1);
    expect(near.cut).toBeGreaterThanOrEqual(CLEAR);
    expect(near.wet).toBe(0);
    let last = near;
    for (const d of [100, 300, 600, 1200, 2400]) {
      const h = hear(d * 0.6, d * 0.8);
      expect(h.g).toBeLessThan(last.g);
      expect(h.cut).toBeLessThan(last.cut);
      expect(h.wet).toBeGreaterThan(last.wet);
      last = h;
    }
    expect(last.g).toBeLessThan(0.3);
    expect(last.cut).toBeLessThan(1500);
    expect(last.wet).toBeLessThanOrEqual(1.5);
  });

  it('carries as far as its reach: half as loud there', () => {
    for (const reach of Object.values(REACH)) expect(hear(reach, 0, 0, reach).g).toBeCloseTo(0.5, 6);
    expect(hear(800, 0, 0, REACH.small).g).toBeLessThan(hear(800, 0, 0, REACH.big).g);
  });

  it('from its side, a little in both ears, less to the side behind the swimming plane', () => {
    expect(hear(0, 300).pan).toBe(0);
    expect(hear(-600, 0).pan).toBeLessThan(0);
    expect(hear(600, 0).pan).toBeGreaterThan(0);
    expect(Math.abs(hear(5000, 0).pan)).toBeLessThanOrEqual(0.85);
    expect(hear(600, 0, 900).pan).toBeLessThan(hear(600, 0).pan);
  });

  it('from where it is on the screen, when that is known', () => {
    expect(hear(-600, 0, 0, REACH.mid, 0.4).pan).toBe(0.4);
    expect(hear(0, 0, 0, REACH.mid, -3).pan).toBe(-0.85);
    expect(panOnScreen(0, 400)).toBe(-1);
    expect(panOnScreen(200, 400)).toBe(0);
    expect(panOnScreen(400, 400)).toBe(1);
    expect(panOnScreen(100, 0)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { STEP } from '../engine';
import { EGG_DELAY, EGG_HOLD, EGG_NEAR, EGG_REARM, hatching, leaveClutch, newClutch, stepClutch } from './ponte';

/** steps until the brood opens with the swimmer at (px, py), at most n */
function stayBy(c: ReturnType<typeof newClutch>, px: number, py: number, n = 600): number {
  for (let i = 1; i <= n; i++) if (stepClutch(c, px, py)) return i;
  return -1;
}

describe('the eggs in the water', () => {
  it('open their brood when we stay by them, once the burst of light is over', () => {
    const c = newClutch(0, 0), steps = stayBy(c, 30, 20);
    expect(steps * STEP).toBeCloseTo(EGG_DELAY + EGG_HOLD, 1);
  });

  it('never open while we swim on, away from them', () => {
    expect(stayBy(newClutch(0, 0), EGG_NEAR + 40, 0)).toBe(-1);
  });

  it('tremble and glow more as we stay, and calm down when we leave', () => {
    const c = newClutch(0, 0);
    for (let i = 0; i < (EGG_DELAY + EGG_HOLD / 2) / STEP; i++) stepClutch(c, 0, 0);
    expect(hatching(c)).toBeGreaterThan(0.4);
    expect(hatching(c)).toBeLessThan(0.6);
    for (let i = 0; i < 60; i++) stepClutch(c, 400, 0);
    expect(hatching(c)).toBe(0);
  });

  it('left for later, wait until we have gone away and come back', () => {
    const c = newClutch(0, 0);
    expect(stayBy(c, 0, 0)).toBeGreaterThan(0);
    leaveClutch(c);
    // staying there after « Plus tard » does not open it again
    expect(stayBy(c, 0, 0)).toBe(-1);
    // away, then back
    stepClutch(c, EGG_REARM + 10, 0);
    expect(stayBy(c, 20, 0) * STEP).toBeCloseTo(EGG_HOLD, 1);
  });
});

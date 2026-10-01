import { describe, expect, it } from 'vitest';
import { View } from '../engine3/view';
import { SIGHT_MARGIN, awakeOutOfSight, inSight } from './hors-champ';

/** the camera of a phone held upright, at the distance of the game, on the swimmer at (0, 300) */
function phone(): View {
  const v = new View();
  v.resize(412, 870, 52);
  v.aim(0, 300, 900, (7 * Math.PI) / 180);
  return v;
}

describe('out of sight', () => {
  it('keeps what is on screen and just past its edges', () => {
    const v = phone(), P = { x: 0, y: 0, s: 0, d: 0 };
    expect(inSight(v, 0, 0)).toBe(true);
    // the edge of the screen in the swimming plane, then a little past it
    const [x0, x1] = v.xRange(0, 0);
    v.project(x1, 300, 0, P);
    expect(Math.abs(P.x - 412)).toBeLessThan(20);
    expect(inSight(v, x1 + SIGHT_MARGIN - 1, 0)).toBe(true);
    expect(inSight(v, x0 - SIGHT_MARGIN + 1, 0)).toBe(true);
    expect(inSight(v, x1 + SIGHT_MARGIN + 1, 0)).toBe(false);
    expect(inSight(v, x0 - SIGHT_MARGIN - 1, 0)).toBe(false);
  });

  it('sees wider far behind the swimming plane', () => {
    const v = phone(), x = v.xRange(0, SIGHT_MARGIN)[1] + 50;
    expect(inSight(v, x, 0)).toBe(false);
    expect(inSight(v, x, 1000)).toBe(true);
  });

  it('leaves out on a phone what was simulated before (1 100 px around the swimmer)', () => {
    const v = phone();
    expect(inSight(v, 1000, 0)).toBe(false);
    expect(inSight(v, -1000, 0)).toBe(false);
  });

  it('always simulates those that follow the swimmer or play a scene', () => {
    for (const k of ['swim', 'floor', 'surface']) {
      expect(awakeOutOfSight(k, false)).toBe(false);
      expect(awakeOutOfSight(k, true)).toBe(true);
    }
    for (const k of ['player', 'sib', 'parent', 'rival', 'answer', 'ancestor']) expect(awakeOutOfSight(k, false)).toBe(true);
  });
});

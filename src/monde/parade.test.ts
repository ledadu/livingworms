import { describe, expect, it } from 'vitest';
import { FIG_H, FIG_W, LEAVE_FAR, LEAVE_TIME, PARADE_TIME, START_HOLD, START_NEAR, along, approach, away, figure, newParade, partsOf, quality, stepParade, type Mover } from './parade';
import { STEP } from '../engine';

/** a whole parade; the partner goes where it is led, the swimmer is moved by `swim` */
function dance(swim: (partner: Mover, history: Mover[], me: Mover) => void, start = { x: 0, y: 0 }) {
  const partner: Mover = { x: 1000, y: 500, vx: 0, vy: 0 }, me: Mover = { vx: 0, vy: 0, ...start };
  me.x += 1000; me.y += 500;
  const p = newParade(partner, me, 1.6), history: Mover[] = [];
  let steps = 0;
  while (!p.done && steps < 5000) {
    const v = stepParade(p, partner, me);
    partner.vx += (v.x - partner.vx) * 0.1; partner.vy += (v.y - partner.vy) * 0.1;
    partner.x += partner.vx; partner.y += partner.vy;
    history.push({ ...partner });
    swim(partner, history, me);
    steps++;
  }
  return { p, steps, partner };
}

describe('the parade', () => {
  it('lasts about twenty seconds, whatever we do', () => {
    for (const swim of [() => {}, (_: Mover, h: Mover[], me: Mover) => Object.assign(me, h[Math.max(0, h.length - 30)])]) {
      const { p, steps } = dance(swim, { x: -80, y: 0 });
      expect(p.done).toBe(true);
      expect(steps * STEP).toBeCloseTo(PARADE_TIME, 1);
      expect(quality(p)).toBeGreaterThanOrEqual(0);
      expect(quality(p)).toBeLessThanOrEqual(1);
    }
  });

  it('dances a figure of eight that starts where we met and comes back there', () => {
    const f = figure(1);
    expect(f[0].x).toBeCloseTo(0); expect(f[0].y).toBeCloseTo(0);
    expect(f[f.length - 1].x).toBeCloseTo(0); expect(f[f.length - 1].y).toBeCloseTo(0);
    expect(f[1].x).toBeGreaterThan(0); expect(f[1].y).toBeLessThan(0);
    expect(figure(-1)[1].x).toBeLessThan(0);
    for (const q of f) { expect(Math.abs(q.x)).toBeLessThanOrEqual(FIG_W + 1e-6); expect(Math.abs(q.y)).toBeLessThanOrEqual(FIG_H + 1e-6); }
    const len = 1000;
    expect(along(f, len, len + 1).x).toBeCloseTo(along(f, len, 1).x);
  });

  it('starts away from us, so that we find ourselves behind the partner', () => {
    expect(newParade({ x: 100, y: 0 }, { x: 0, y: 0 }, 1).dir).toBe(1);
    expect(newParade({ x: 100, y: 0 }, { x: 300, y: 0 }, 1).dir).toBe(-1);
  });

  it('rates highly the one who follows in its wake and turns with it', () => {
    const { p } = dance((_, h, me) => Object.assign(me, h[Math.max(0, h.length - 30)]), { x: -80, y: 0 });
    expect(quality(p)).toBeGreaterThan(0.85);
    const parts = partsOf(p);
    expect(parts.wake).toBeGreaterThan(0.8);
    expect(parts.turn).toBeGreaterThan(0.8);
  });

  it('rates in between the one who stays near without dancing, and low the one who swims away', () => {
    const idle = quality(dance(() => {}, { x: -80, y: 0 }).p);
    const away = quality(dance((_, __, me) => { me.x -= 2.6; me.vx = -2.6; }, { x: -80, y: 0 }).p);
    const follow = quality(dance((_, h, me) => Object.assign(me, h[Math.max(0, h.length - 30)]), { x: -80, y: 0 }).p);
    expect(away).toBeLessThan(0.15);
    expect(idle).toBeGreaterThan(away);
    expect(idle).toBeLessThan(follow - 0.3);
  });

  it('waits for us when we fall behind', () => {
    const near = dance((_, h, me) => Object.assign(me, h[Math.max(0, h.length - 30)]), { x: -80, y: 0 }).p;
    const far = dance(() => {}, { x: -700, y: 0 }).p;
    expect(far.s).toBeLessThan(near.s * 0.4);
  });

  it('notices us when we stay near it a moment', () => {
    let hold = 0, steps = 0;
    while (hold < START_HOLD) { hold = approach(hold, START_NEAR - 10); steps++; }
    expect(steps * STEP).toBeCloseTo(START_HOLD, 1);
    // going away, it forgets us twice as fast
    steps = 0;
    while (hold > 0) { hold = approach(hold, START_NEAR + 10); steps++; }
    expect(steps * STEP).toBeCloseTo(START_HOLD / 2, 1);
  });

  it('takes a while near it to start: swimming past a partner is no yes', () => {
    expect(START_HOLD).toBeGreaterThanOrEqual(1.8);
  });

  it('lets us go when we swim away from the partner a while, and not when we only fall behind', () => {
    let t = 0, steps = 0;
    while (t < LEAVE_TIME) { t = away(t, LEAVE_FAR + 50); steps++; }
    expect(steps * STEP).toBeCloseTo(LEAVE_TIME, 1);
    // back near it before that: the time away fades
    t = away(0, LEAVE_FAR + 50, 1.5);
    for (let i = 0; i < 60; i++) t = away(t, 200);
    expect(t).toBe(0);
    // the figure of eight takes it at most this far from where we lag behind it
    expect(FIG_W * 2).toBeLessThan(LEAVE_FAR);
  });
});

import { describe, expect, it } from 'vitest';
import { SPECIES, firstAncestor } from '../content/species';
import { brood } from '../content/portee';
import type { Spec } from '../engine/types';
import { STEP, TAU, clamp } from '../engine/util';
import { Creature3, crawlRise } from './creature3';
import { SURGE, hover, surge, turnPace } from './pilot';

const FLOOR = 900;

/** a creature in open water, the floor far below, steered by the player or not */
function swimmer(sp: Spec, pilot: boolean): Creature3 {
  const cr = new Creature3(sp, 0, 500, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 0.8, phase: 0 });
  cr.ground(sp.swim.mode === 'crawl');
  cr.pilot = pilot;
  return cr;
}

/** one step as the game steers the swimmer toward (tx, ty) (main.ts), or leaves it alone (null) */
function step(cr: Creature3, t: number, to: [number, number] | null): void {
  const r = cr.root, dz = clamp(-r.z[0] * 0.035, -0.5, 0.5);
  if (to) {
    const dx = to[0] - r.x[0], dy = to[1] - r.y[0], d = Math.hypot(dx, dy) || 1, s = 2.6 * Math.min(1, d / 70);
    cr.steer(t, (dx / d) * s, (dy / d) * s, dz, 0.08);
  } else cr.steer(t, 0, 0, dz, 0.03);
  cr.stand(FLOOR);
  const fy = FLOOR - r.rad[0] - 3;
  if (r.y[0] > fy) { r.y[0] = fy; if (cr.vy > 0) cr.vy *= -0.3; }
}

/** steered toward a point 300 px away on each side in turn: the seconds to reach each, and how far its course strays from the finger (degrees, on average) */
function square(sp: Spec, pilot: boolean): { worst: number; stray: number } {
  const cr = swimmer(sp, pilot);
  let t = 0, worst = 0, stray = 0, n = 0;
  for (const [ox, oy] of [[300, 0], [300, 300], [0, 300], [0, 0]]) {
    const to: [number, number] = [ox, 500 + oy - 150];
    let k = 0;
    for (; k < 600; k++) {
      const r = cr.root, x = r.x[0], y = r.y[0], dx = to[0] - x, dy = to[1] - y, d = Math.hypot(dx, dy);
      if (d < 30) break;
      step(cr, (t += STEP), to);
      const mx = r.x[0] - x, my = r.y[0] - y, m = Math.hypot(mx, my);
      if (d > 100 && m > 0.05) { stray += Math.acos(clamp((mx * dx + my * dy) / (m * d), -1, 1)); n++; }
    }
    worst = Math.max(worst, k * STEP);
  }
  return { worst, stray: ((stray / (n || 1)) * 180) / Math.PI };
}

/** told straight right for 3 s: how far it strays up or down, and how uneven its pace is (deviation / mean) */
function level(sp: Spec, pilot: boolean): { drift: number; jerk: number } {
  const cr = swimmer(sp, pilot), sps: number[] = [];
  let drift = 0;
  for (let k = 0; k < 180; k++) {
    const r = cr.root, x = r.x[0], y = r.y[0];
    step(cr, k * STEP, [r.x[0] + 1000, 500]);
    drift = Math.max(drift, Math.abs(r.y[0] - 500));
    if (k > 40) sps.push(Math.hypot(r.x[0] - x, r.y[0] - y));
  }
  const mean = sps.reduce((a, b) => a + b, 0) / sps.length;
  return { drift, jerk: Math.sqrt(sps.reduce((a, b) => a + (b - mean) ** 2, 0) / sps.length) / mean };
}

const BELLS = Object.keys(SPECIES).filter((id) => SPECIES[id]().swim.mode === 'bell');
/** children of a jellyfish, some with its bell way of swimming on another body (fuse() takes one or the other) */
const JELLY_KIDS = BELLS.flatMap((id) => [firstAncestor(), SPECIES.poissonClown(), SPECIES.crabe()]
  .flatMap((par) => brood(par, SPECIES[id](), { seed: 7 }).map((c) => c.spec)));

describe('the pace of a piloted bell or jet', () => {
  // the power stroke of a bell over a beat (beat() in creature3.ts)
  const beat = Array.from({ length: 600 }, (_, i) => { const c = -Math.cos((TAU * i) / 600); return c > 0 ? c * c : 0; });

  it('is about 1 over a beat, a little more on the stroke', () => {
    const mean = beat.reduce((a, s) => a + surge(s), 0) / beat.length;
    expect(mean).toBeCloseTo(1, 2);
    expect(surge(0)).toBeCloseTo(1 - SURGE);
    expect(surge(1)).toBeCloseTo(1 + 3 * SURGE);
    expect(surge(0)).toBeGreaterThan(0.5);
  });

  it('hovers on the spot, left alone', () => {
    expect(Math.abs(beat.reduce((a, s) => a + hover(s), 0) / beat.length)).toBeLessThan(0.005);
  });

  it('slows a little while it turns round, never to a stop', () => {
    expect(turnPace(1)).toBe(1);
    expect(turnPace(0)).toBeGreaterThan(0.5);
  });
});

describe('a walker steered in open water', () => {
  it('goes where it is told, and sinks back only when left alone or on the floor', () => {
    expect(crawlRise(0, 200, true)).toBe(0);
    expect(crawlRise(-0.2, 200, true)).toBe(-0.2);
    expect(crawlRise(2, 200, true)).toBe(2);
    expect(crawlRise(0, 200, false)).toBe(0.5);
    expect(crawlRise(0, 0, true)).toBe(0.5);
    expect(crawlRise(-2, 0, true)).toBe(-2);
  });
});

describe('steered by the player', () => {
  it('every species and every child of a jellyfish goes where it is told, soon (a glider, head first, strays the most)', () => {
    const slow: string[] = [];
    for (const sp of [...Object.values(SPECIES).map((f) => f()), ...JELLY_KIDS]) {
      const { worst, stray } = square(sp, true);
      if (worst > 3 || stray > 25) slow.push(`${sp.name} (${sp.swim.mode}): ${worst.toFixed(1)} s, ${stray.toFixed(0)}°`);
    }
    expect(slow).toEqual([]);
  });

  it('a bell or a jet swims level when told to, at an even pace, unlike a free one', () => {
    for (const id of [...BELLS, 'poulpe', 'nautile', 'calmar']) {
      const free = level(SPECIES[id](), false), piloted = level(SPECIES[id](), true);
      expect(piloted.drift, id).toBeLessThan(20);
      expect(piloted.jerk, id).toBeLessThan(0.3);
      expect(piloted.jerk, id).toBeLessThan(free.jerk);
    }
  });

  it('a bell left alone stays where it is', () => {
    for (const id of BELLS) {
      const cr = swimmer(SPECIES[id](), true);
      for (let k = 0; k < 240; k++) step(cr, k * STEP, null);
      const x = cr.root.x[0], y = cr.root.y[0];
      for (let k = 240; k < 480; k++) step(cr, k * STEP, null);
      expect(Math.hypot(cr.root.x[0] - x, cr.root.y[0] - y), id).toBeLessThan(15);
    }
  });

  it('changes nothing for a glider, already easy to steer', () => {
    for (const id of ['poissonClown', 'anguille', 'hippocampe', 'copepode']) {
      const a = swimmer(SPECIES[id](), false), b = swimmer(SPECIES[id](), true);
      for (let k = 0; k < 120; k++) { step(a, k * STEP, [300, 300]); step(b, k * STEP, [300, 300]); }
      expect(b.root.x[0], id).toBe(a.root.x[0]);
      expect(b.root.y[0], id).toBe(a.root.y[0]);
    }
  });
});

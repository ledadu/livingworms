import { describe, expect, it } from 'vitest';
import { STEP, rng } from '../engine';
import { HIDINGS, JEUX, ROUNDS, SHOW, chooseJeu, goalOf, newJeu, stepJeu, type Jeu, type JeuEvent, type JeuWorld } from './jeux';
import type { Being, Swimmer } from './vie';

const FLOOR = 600;
const world: JeuWorld = {
  floor: () => FLOOR,
  keep: (x, y) => ({ x, y: Math.max(40, Math.min(FLOOR - 40, y)) }),
  nook: (x, dir) => ({ x: x + dir * 700, y: FLOOR - 60 })
};

function being(o: Partial<Being> = {}): Being {
  return {
    x: 0, y: 400, z: 0, vx: 0, vy: 0, hx: 1, hy: 0, floor: FLOOR, len: 60, speed: 1.6, gait: 'glide', ai: 'prey', legs: false,
    sp: 'poisson', home: o.x ?? 0, plane: 0, ...o
  };
}
const octopus = (o: Partial<Being> = {}) => being({ gait: 'jet', sp: 'poulpe', speed: 1.8, len: 70, ai: 'hunter', ...o });

/** how the swimmer swims this step: its velocity, from the game */
type Pilot = (s: Swimmer, j: Jeu, t: number) => { vx: number; vy: number };
const idle: Pilot = () => ({ vx: 0, vy: 0 });
/** straight at a point, at the swimmer's top speed */
const toward = (p: { x: number; y: number }, s: Swimmer, sp = 2.6) => {
  const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1, k = sp * Math.min(1, d / 30);
  return { vx: (dx / d) * k, vy: (dy / d) * k };
};

/** plays a game for at most `secs`: each animal goes the way its goal says (a rough body), the swimmer as `pilot` says */
function play(j: Jeu, s: Swimmer, pilot: Pilot, secs: number): { t: number; events: JeuEvent[] } {
  const R = rng(3), events: JeuEvent[] = [];
  let t = j.t0;
  for (let k = 0; k < secs / STEP && !j.done; k++) {
    t += STEP;
    const v = pilot(s, j, t);
    s.vx = v.vx; s.vy = v.vy; s.x += v.vx; s.y += v.vy;
    events.push(...stepJeu(j, t, R, world, s));
    const goals = j.who.map((_, i) => goalOf(j, i, t, R, world, s));
    j.who.forEach((b, i) => {
      const g = goals[i];
      b.vx = g.x; b.vy = b.gait === 'crawl' ? 0 : g.y;
      b.x += b.vx; b.y += b.vy;
      if (g.z !== undefined) b.z += Math.max(-0.5, Math.min(0.5, g.z - b.z));
      const m = Math.hypot(b.vx, b.vy);
      if (m > 0.05) { b.hx = b.vx / m; b.hy = b.vy / m; }
    });
  }
  return { t, events };
}
const count = (ev: JeuEvent[], k: JeuEvent['k']) => ev.filter((e) => e.k === k).length;

describe('who can play what', () => {
  it('a quick fish plays tag, a cephalopod or a walker on legs hides, three of a kind make a shoal', () => {
    expect(JEUX.chat.fits(being())).toBe(true);
    expect(JEUX.chat.fits(being({ speed: 0.6 }))).toBe(false);
    expect(JEUX.cache.fits(octopus())).toBe(true);
    expect(JEUX.cache.fits(being({ gait: 'crawl', legs: true, len: 40 }))).toBe(true);
    expect(JEUX.cache.fits(being())).toBe(false);
    expect(JEUX.banc.fits(being({ gait: 'crawl' }))).toBe(false);
  });

  it('offers only what the animals near the swimmer can play', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const R = rng(1);
    expect(chooseJeu(s, [being({ x: 2000 })], R)).toBeNull();
    expect(chooseJeu(s, [being({ x: 100, plane: 400 })], R)).toBeNull();
    expect(chooseJeu(s, [octopus({ x: 100 })], R)?.id).toBe('cache');
    for (let k = 0; k < 20; k++) {
      const c = chooseJeu(s, [being({ x: 100, speed: 0.8 }), being({ x: 140, speed: 0.8 }), being({ x: 180, speed: 0.8 })], R);
      expect(c?.id).toBe('banc');
      expect(c?.who).toHaveLength(3);
    }
    // two of a kind are no shoal
    expect(chooseJeu(s, [being({ x: 100, speed: 0.8 }), being({ x: 140, speed: 0.8 })], R)).toBeNull();
  });
});

describe('tag', () => {
  it('the fish touches us; chased and caught a few times, it gives its glow', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('chat', [being({ x: 300, y: 380 })], 0, rng(2), world, s);
    let lead = 0;
    const { events } = play(j, s, (sw, g, t) => {
      // a moment to see it go, then after it
      if (g.stage !== 'file' || t - g.ts < 0.8) return { vx: 0, vy: 0 };
      lead = Math.max(lead, Math.hypot(g.who[0].x - sw.x, g.who[0].y - sw.y));
      return toward(g.who[0], sw);
    }, 120);
    // it got away from us before we caught it
    expect(lead).toBeGreaterThan(100);
    expect(count(events, 'touche')).toBeGreaterThanOrEqual(ROUNDS);
    expect(count(events, 'attrape')).toBe(ROUNDS);
    expect(j.gift).toBe('lueur');
    expect(count(events, 'cadeau')).toBe(1);
    expect(j.done).toBe(true);
  });

  it('it flees slower than we swim, and waits for us when we lag', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('chat', [being({ x: 200, y: 400, speed: 2.4 })], 0, rng(4), world, s);
    let fastest = 0, far = 0;
    play(j, s, (sw, g) => {
      if (g.stage === 'file') { fastest = Math.max(fastest, Math.hypot(g.who[0].vx, g.who[0].vy)); far = Math.max(far, Math.hypot(g.who[0].x - sw.x, g.who[0].y - sw.y)); }
      return { vx: 0, vy: 0 };
    }, 30);
    expect(fastest).toBeLessThan(2.6);
    expect(far).toBeLessThan(700);
  });

  it('left alone, it touches us again, then goes back to its life without a gift', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('chat', [being({ x: 200, y: 400 })], 0, rng(6), world, s);
    const { events } = play(j, s, idle, 120);
    expect(count(events, 'touche')).toBe(2);
    expect(j.done).toBe(true);
    expect(j.gift).toBeNull();
  });
});

describe('the shoal', () => {
  const troop = () => [0, 1, 2, 3].map((k) => being({ x: -300 - k * 40, y: 380 + (k % 2) * 30, speed: 1.6, sp: 'sardine', home: 0 }));

  it('swimming at its pace, alongside it, we are taken in and led to its corner, where there is food for us', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('banc', troop(), 0, rng(2), world, s);
    const { events } = play(j, s, (sw, g) => {
      const l = g.who[0];
      // keep beside the leader, at its speed
      return { vx: l.vx + (l.x - l.hx * 50 - sw.x) * 0.05, vy: l.vy + (l.y + 30 - sw.y) * 0.05 };
    }, 120);
    expect(count(events, 'accepte')).toBe(1);
    expect(count(events, 'arrive')).toBe(1);
    expect(j.gift).toBe('bouchee');
    expect(count(events, 'miette')).toBeGreaterThan(0);
    expect(j.done).toBe(true);
  });

  it('a swimmer that rushes about does not keep its pace: the troop passes by, then goes', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('banc', troop(), 0, rng(2), world, s);
    const { events } = play(j, s, (sw, g, t) => toward({ x: g.who[0].x + Math.sin(t * 3) * 200, y: 300 + Math.cos(t * 3) * 150 }, sw), 120);
    expect(count(events, 'accepte')).toBe(0);
    expect(j.done).toBe(true);
    expect(j.gift).toBeNull();
  });
});

describe('hide-and-seek', () => {
  it('found each time, the octopus leaves us its treasure', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('cache', [octopus({ x: 250, y: 560 })], 0, rng(2), world, s);
    const { events, t } = play(j, s, (sw, g) => (g.stage === 'cache' ? toward(g.who[0], sw) : { vx: 0, vy: 0 }), 120);
    expect(count(events, 'encre')).toBe(HIDINGS);
    expect(count(events, 'trouve')).toBe(HIDINGS);
    expect(j.gift).toBe('tresor');
    expect(t).toBeLessThan(HIDINGS * SHOW);
  });

  it('it hides further back in depth, and comes back into the swimming plane once found', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('cache', [octopus({ x: 250, y: 560 })], 0, rng(2), world, s);
    let deepest = 0;
    play(j, s, (_, g) => { if (g.stage === 'cache') deepest = Math.max(deepest, g.who[0].z); return { vx: 0, vy: 0 }; }, 40);
    expect(deepest).toBeGreaterThan(80);
  });

  it('never a failure: looked for in the wrong places, it gives hints and shows itself, and the treasure comes all the same', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('cache', [octopus({ x: 250, y: 560 })], 0, rng(5), world, s);
    // the swimmer searches around, never quite where it is
    const { events } = play(j, s, (sw, g, t) => (g.stage === 'cache' ? toward({ x: g.who[0].x + 260 * Math.sin(t * 0.7), y: 300 }, sw, 1) : idle(sw, g, t)), 200);
    expect(count(events, 'indice')).toBeGreaterThan(2);
    expect(count(events, 'trouve')).toBe(HIDINGS);
    expect(j.gift).toBe('tresor');
  });

  it('a swimmer that does not look for it: it shows itself, then goes back to its life', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('cache', [octopus({ x: 250, y: 560 })], 0, rng(5), world, s);
    play(j, s, (sw, g, t) => (g.stage === 'cache' && Math.abs(sw.x - g.who[0].x) < 700 ? { vx: g.who[0].x > sw.x ? -1 : 1, vy: 0 } : idle(sw, g, t)), 200);
    expect(j.done).toBe(true);
    expect(j.gift).toBeNull();
  });

  it('a swimmer gone far away ends the game, without a gift', () => {
    const s: Swimmer = { x: 0, y: 400, vx: 0, vy: 0, len: 60 };
    const j = newJeu('cache', [octopus({ x: 250, y: 560 })], 0, rng(5), world, s);
    play(j, s, (_, g) => (g.stage === 'cache' ? { vx: -2.6, vy: 0 } : { vx: 0, vy: 0 }), 60);
    expect(j.done).toBe(true);
    expect(j.gift).toBeNull();
  });
});

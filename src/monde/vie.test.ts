import { describe, expect, it } from 'vitest';
import { STEP, rng } from '../engine';
import { GESTES, SCATTER, choose, cleaner, client, eat, feed, newAct, over, steerOf, stepFood, type Act, type Being, type GesteId, type Goal, type Swimmer, type World } from './vie';

const FLOOR = 600;
const world: World = { floor: () => FLOOR };

function being(o: Partial<Being> = {}): Being {
  return {
    x: 0, y: 400, z: 0, vx: 0, vy: 0, hx: 1, hy: 0, floor: FLOOR, len: 60, speed: 1.5, gait: 'glide', ai: 'prey', legs: false,
    sp: 'poisson', home: o.x ?? 0, plane: 0, ...o
  };
}
const fish = (o: Partial<Being> = {}) => being(o);
const walker = (o: Partial<Being> = {}) => being({ gait: 'crawl', y: FLOOR - 10, legs: true, sp: 'homard', speed: 1.6, len: 90, ai: 'hunter', ...o });
const shrimp = (o: Partial<Being> = {}) => being({ gait: 'crawl', y: FLOOR - 10, legs: true, sp: 'crevette', speed: 2, len: 84, ai: 'prey', ...o });
const still: Swimmer = { x: 0, y: 300, vx: 0, vy: 0, len: 60 };

/** plays a scene for `secs`: each animal goes the way its goal says (a rough body), and into its plane in depth */
function play(a: Act, secs: number, t0 = 0, swimmer: Swimmer | null = null, each?: (t: number, goals: Goal[]) => void): number {
  const R = rng(5);
  let t = t0;
  for (let k = 0; k < secs / STEP; k++) {
    t += STEP;
    if (over(a, t, swimmer)) break;
    stepFood(a.food, world, t);
    const goals = a.who.map((_, i) => steerOf(a, i, t, R, world, swimmer));
    a.who.forEach((b, i) => {
      const g = goals[i];
      b.vx = g.x; b.vy = b.gait === 'crawl' && !g.swim ? 0 : g.y;
      b.x += b.vx; b.y += b.vy;
      if (g.z !== undefined) b.z += Math.max(-0.5, Math.min(0.5, g.z - b.z));
      const m = Math.hypot(b.vx, b.vy);
      if (m > 0.05) { b.hx = b.vx / m; b.hy = b.vy / m; }
    });
    each?.(t, goals);
  }
  return t;
}

/** every scene chosen for this animal among these others, over many draws */
function chosen(me: Being, free: Being[], swimmer: Swimmer | null = null, look = true): Set<GesteId> {
  const ids = new Set<GesteId>(), R = rng(11);
  for (let k = 0; k < 400; k++) { const c = choose(me, free, R, swimmer, look); if (c) ids.add(c.id); }
  return ids;
}

describe('who can do what', () => {
  it('a shrimp on legs cleans, a big fish near the floor comes to be cleaned, a lobster does not clean', () => {
    expect(cleaner(shrimp())).toBe(true);
    expect(cleaner(walker())).toBe(false);
    expect(client(fish({ len: 78, y: 450 }))).toBe(true);
    expect(client(fish({ len: 39, y: 450 }))).toBe(false);
    expect(client(fish({ len: 78, y: 100 }))).toBe(false);
  });

  it('a jellyfish never walks in file nor greets, a walker never joins a troop', () => {
    const bell = being({ gait: 'bell' });
    expect(GESTES.salut.fits(bell)).toBe(false);
    expect(GESTES.file.fits(bell)).toBe(false);
    expect(GESTES.banc.fits(walker())).toBe(false);
    expect(GESTES.file.fits(walker())).toBe(true);
  });
});

describe('choose', () => {
  it('pairs and groups are of one species; alone, an animal still finds something to do', () => {
    const me = fish({ sp: 'koi' }), other = fish({ sp: 'clown', x: 50 });
    const ids = chosen(me, [me, other]);
    for (const id of ['ronde', 'poursuite', 'cote', 'salut', 'banc'] as GesteId[]) expect(ids.has(id)).toBe(false);
    expect(ids.size).toBeGreaterThan(0);
    const mate = fish({ sp: 'koi', x: 80 });
    expect(chosen(me, [me, mate]).has('ronde')).toBe(true);
  });

  it('a troop needs three, and takes at most six', () => {
    const koi = Array.from({ length: 9 }, (_, i) => fish({ sp: 'koi', x: i * 30 }));
    const R = rng(3);
    let troop = null;
    for (let k = 0; k < 400 && !troop; k++) { const c = choose(koi[0], koi, R, null); if (c?.id === 'banc') troop = c; }
    expect(troop!.who.length).toBeGreaterThanOrEqual(3);
    expect(troop!.who.length).toBeLessThanOrEqual(6);
    expect(troop!.who[0]).toBe(koi[0]);
    expect(chosen(koi[0], koi.slice(0, 2)).has('banc')).toBe(false);
  });

  it('mates too far away, or in another plane, are not taken', () => {
    const me = fish({ sp: 'koi' });
    expect(chosen(me, [me, fish({ sp: 'koi', x: 900 })]).has('ronde')).toBe(false);
    expect(chosen(me, [me, fish({ sp: 'koi', x: 40, plane: 150 })]).has('ronde')).toBe(false);
  });

  it('an animal comes to look at the swimmer only when it is near and calm', () => {
    const me = fish({ x: 200 });
    expect(chosen(me, [me], still).has('curieux')).toBe(true);
    expect(chosen(me, [me], { ...still, vx: 2 }).has('curieux')).toBe(false);
    expect(chosen(me, [me], { ...still, x: -800 }).has('curieux')).toBe(false);
    expect(chosen(me, [me], still, false).has('curieux')).toBe(false);
    expect(chosen(me, [me], null).has('curieux')).toBe(false);
  });

  it('the cleaning puts the fish first and the shrimp second, whoever starts it', () => {
    const s = shrimp({ x: 0 }), f = fish({ len: 78, x: 150, y: 480, sp: 'rascasse' }), R = rng(2);
    for (const me of [s, f]) {
      let c = null;
      for (let k = 0; k < 400 && !c; k++) { const o = choose(me, [s, f], R, null); if (o?.id === 'nettoyage') c = o; }
      expect(c!.who).toEqual([f, s]);
    }
  });
});

describe('the scenes', () => {
  it('foraging: the swimmer goes down nose to the sand, and each peck stirs one puff', () => {
    const b = fish({ y: 420 }), a = newAct('fouille', [b], 0, rng(1), world);
    let puffs = 0, low = Infinity;
    play(a, 9, 0, null, (_, g) => { if (g[0].puff) puffs++; low = Math.min(low, FLOOR - b.y); });
    expect(low).toBeLessThan(40);
    expect(puffs).toBeGreaterThan(1);
    expect(puffs).toBeLessThan(9 / 1.8 + 2);
  });

  it('the round dance: the two circle each other in depth around their middle, in finery', () => {
    const p = fish({ sp: 'clown', x: -60 }), q = fish({ sp: 'clown', x: 60 }), a = newAct('ronde', [p, q], 0, rng(4), world);
    const zs: number[] = [];
    let dress = 0;
    play(a, 8, 0, null, (_, g) => { zs.push(p.z); dress = g[0].dress; });
    expect(a.stage).toBe(1);
    expect(dress).toBe(1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(30);
    expect(Math.hypot(p.x - a.at.x, p.y - a.at.y)).toBeLessThan(120);
  });

  it('a single file: the one ahead leads, the others follow behind in order, never through each other', () => {
    const ls = [0, -150, -300, 120].map((x) => walker({ x, home: 0 }));
    const a = newAct('file', ls, 0, rng(2), world);
    expect(a.who[0]).toBe(ls[3]);
    play(a, 10);
    const xs = a.who.map((b) => b.x * a.dir);
    for (let k = 1; k < xs.length; k++) {
      expect(xs[k]).toBeLessThan(xs[k - 1]);
      expect(xs[k - 1] - xs[k]).toBeGreaterThan(30);
    }
  });

  it('the greeting: they stop face to face, then go their ways', () => {
    const p = walker({ sp: 'crabe', x: -120, len: 51 }), q = walker({ sp: 'crabe', x: 110, len: 51 }), a = newAct('salut', [p, q], 0, rng(3), world);
    let faced = false;
    play(a, 14, 0, null, (_, [g0, g1]) => {
      // the one on the left faces right, the other left (both a little toward the eye)
      if (a.stage === 1 && g0.yaw! < 0 && g1.yaw! > Math.PI / 2) faced = true;
    });
    expect(faced).toBe(true);
    expect(Math.abs(p.x - q.x)).toBeGreaterThan(150);
  });

  it('the cleaning: the fish waits pale and still, the shrimp swims up under it', () => {
    const f = fish({ len: 78, x: -150, y: 470 }), s = shrimp({ x: 60 }), a = newAct('nettoyage', [f, s], 0, rng(6), world);
    let seen = false;
    play(a, 12, 0, null, (t, [gf, gs]) => {
      if (a.stage === 1 && t - a.ts > 3 && gf.dress === -1 && gs.swim && s.y < FLOOR - 30) seen = true;
    });
    expect(seen).toBe(true);
  });

  it('the troop: the others keep close to their leader all along', () => {
    const koi = [0, -50, 40, -90, 80].map((x) => fish({ sp: 'koi', x, y: 380 + x * 0.2 }));
    const a = newAct('banc', koi, 0, rng(8), world);
    play(a, 12);
    for (const b of koi.slice(1)) expect(Math.hypot(b.x - koi[0].x, b.y - koi[0].y)).toBeLessThan(200);
  });

  it('a rushing swimmer scatters a scene; a calm one may watch from close', () => {
    const p = fish({ sp: 'koi', x: 0 }), q = fish({ sp: 'koi', x: 70 }), a = newAct('ronde', [p, q], 0, rng(4), world);
    expect(over(a, 1, { x: 10, y: 400, vx: 0.5, vy: 0, len: 60 })).toBe(false);
    expect(a.stage).not.toBe(SCATTER);
    expect(over(a, 1, { x: 10, y: 400, vx: 2.5, vy: 0, len: 60 })).toBe(false);
    expect(a.stage).toBe(SCATTER);
    const g = steerOf(a, 0, 1.1, rng(1), world, { x: 10, y: 400, vx: 2.5, vy: 0, len: 60 });
    expect(g.x).toBeLessThan(0);
    expect(over(a, 2, null)).toBe(true);
  });

  it('nobody in a scene swims into the swimmer', () => {
    const p = fish({ sp: 'koi', x: 0 }), q = fish({ sp: 'koi', x: 300 }), sw: Swimmer = { x: 5, y: 400, vx: 0, vy: 0, len: 60 };
    const a = newAct('cote', [p, q], 0, rng(4), world, sw);
    const g = steerOf(a, 0, 0.1, rng(1), world, sw), h = steerOf(a, 0, 0.1, rng(1), world, null);
    expect(g.x).toBeLessThan(h.x);
  });

  it('a game of chase keeps away from where the swimmer is', () => {
    const p = fish({ sp: 'koi', x: -40 }), q = fish({ sp: 'koi', x: 40 });
    const a = newAct('poursuite', [p, q], 0, rng(4), world, { ...still, y: 400 });
    expect(Math.hypot(a.at.x - still.x, a.at.y - 400)).toBeGreaterThanOrEqual(259);
  });
});

describe('the feast', () => {
  it('the flakes sink, settle on the floor, and are eaten by whoever comes', () => {
    const food = feed(rng(1), 0, 100, 0, 10);
    for (let t = 0; t < 40; t += STEP) stepFood(food, world, t);
    expect(food.every((f) => f.landed && f.y === FLOOR - 2)).toBe(true);
    const b = walker({ x: food[0].x, y: FLOOR - 2 });
    expect(eat(food, b)).toBeGreaterThan(0);
    expect(food[0].eaten).toBe(true);
  });

  it('the swimmers snap the flakes as they fall, the walkers wait for them; the feast ends when all is eaten', () => {
    const who = [fish({ sp: 'anguille', x: -200, y: 300 }), fish({ sp: 'anguille', x: 220, y: 280 }), walker({ sp: 'crabe', x: 150, len: 51 })];
    const a = newAct('festin', who, 0, rng(9), world, null, { x: 0, y: 150 });
    expect(a.food.length).toBeGreaterThan(10);
    let walkerAte = false, bitInWater = false;
    const t = play(a, 60, 0, null, () => {
      if (a.food.some((f) => f.eaten && !f.landed)) bitInWater = true;
      if (Math.abs(who[2].x - a.at.x) < 60) walkerAte = true;
    });
    expect(bitInWater).toBe(true);
    expect(walkerAte).toBe(true);
    expect(a.food.every((f) => f.eaten)).toBe(true);
    expect(t).toBeLessThan(40);
  });

  it('snapping at plankton: specks appear just ahead and are gone at once', () => {
    const b = fish({ y: 300 }), a = newAct('gobe', [b], 0, rng(2), world);
    let eaten = 0;
    play(a, 6, 0, null, () => { eaten = Math.max(eaten, a.food.filter((f) => f.eaten).length); });
    expect(eaten).toBeGreaterThan(1);
  });
});

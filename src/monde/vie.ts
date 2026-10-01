// The life of the animals, besides wandering: short scenes (« gestes ») played alone, in twos or in groups, with
// the swimmer looking on. Alone: forage nose to the sand, rest, come and look at us, snap at plankton. In twos:
// circle each other, play at chasing, swim side by side, meet nose to nose, and the cleaning station (a shrimp
// grooms a fish that hovers for it). In groups: a little troop, a single file of walkers, and the feast when food
// falls. Each scene steers its animals and hooks into their bodies (vie-jeu.ts): where they go, where they look,
// how they hold their head, the tempo of their body, their colours, a walker that swims a moment; and into the
// world: puffs of sand, bits of food. Rushing at them scatters them; a calm swimmer can watch from close by.
//
// This module is pure: the animals are plain data (Being), the world a floor, chance a function.

import { STEP, TAU, clamp, type Ai } from '../engine';

export type Gait = 'glide' | 'bell' | 'jet' | 'crawl';
export type GesteId = 'fouille' | 'repos' | 'curieux' | 'gobe' | 'ronde' | 'poursuite' | 'cote' | 'salut' | 'nettoyage' | 'banc' | 'file' | 'festin';

export interface Pt { x: number; y: number }

/** an animal as the life of the sea sees it (refreshed every step by the game) */
export interface Being {
  /** its head (the root of the body) */
  x: number; y: number; z: number;
  vx: number; vy: number;
  /** the way its head points, in the plane of the screen (unit, or 0, 0) */
  hx: number; hy: number;
  /** the floor under its head */
  floor: number;
  /** its length (px) */
  len: number;
  /** its species' speed (swim.speed) */
  speed: number;
  gait: Gait;
  ai: Ai;
  /** it walks on legs */
  legs: boolean;
  /** its species: only the same species pair up and gather (the cleaning and the feast mix them) */
  sp: string;
  /** where it lives along x: no scene takes it far from there */
  home: number;
  /** its plane in depth, out of any scene */
  plane: number;
}

/** the swimmer, for the animals that come to look at it and those it scatters */
export interface Swimmer { x: number; y: number; vx: number; vy: number; len: number }

export interface World { floor(x: number, z: number): number }

/** what an animal in a scene does this step */
export interface Goal {
  /** the velocity it steers toward (px per step) */
  x: number; y: number;
  accel: number;
  /** the heading to turn to while it hardly moves: 0 faces right, π left, −π/2 the eye */
  yaw?: number;
  /** its plane in depth while the scene lasts */
  z?: number;
  /** how fast its body moves: 1 as always, less at rest, more when it plays */
  tempo: number;
  /** its colours: +1 brighter (finery), −1 paler (rest), 0 its own */
  dress: number;
  /** a walker swims a moment (the shrimp that climbs onto its fish) */
  swim?: boolean;
  /** it stirs the sand at its head this step */
  puff?: boolean;
}

/** a bit of food: a flake that sinks (the feast), or a speck of plankton that drifts and fades (snapping) */
export interface Flake { x: number; y: number; z: number; vx: number; vy: number; r: number; life: number; landed: boolean; eaten: boolean }

export interface Act {
  id: GesteId;
  /** the animals in it, in their roles: the leader first; the client, then the cleaner */
  who: Being[];
  t0: number; end: number;
  /** its centre: the middle of the dance, the cleaning station, the food, the spot dug */
  at: Pt;
  /** where it goes, or the next spot */
  to: Pt;
  /** who leads now (the chase swaps) */
  lead: number;
  stage: number;
  /** when the stage began */
  ts: number;
  /** a side or a way round: ±1 */
  dir: number;
  /** each member's own clock or counter */
  k: number[];
  /** the food of the feast, the plankton snapped at */
  food: Flake[];
}

/** the last stage of any scene: the animals scatter from a swimmer that rushes at them */
export const SCATTER = 9;
/** how fast the swimmer must go to scatter them (px per step; it swims at 2.6 at most) */
export const RUSH = 1.9;

// ----- who can do what ----- //

const near = (b: Being, d: number) => b.floor - b.y < d;
const notBell = (b: Being) => b.gait !== 'bell';
/** a little walker on legs that grooms the fish (a shrimp) */
export const cleaner = (b: Being) => b.gait === 'crawl' && b.legs && b.ai === 'prey';
/** a fish big enough to come to the cleaning station, not too high above it */
export const client = (b: Being) => b.gait === 'glide' && b.len >= 55 && near(b, 380);

interface Geste {
  /** how many take part: least, most */
  n: [number, number];
  fits(b: Being): boolean;
  /** how long it lasts (s) */
  dur: [number, number];
  /** how often it is chosen among those that fit */
  weight: number;
  /** the others are of its species */
  kin?: boolean;
}

export const GESTES: Record<GesteId, Geste> = {
  fouille: { n: [1, 1], fits: (b) => b.gait === 'crawl' || (b.gait === 'glide' && near(b, 320)), dur: [7, 13], weight: 3 },
  repos: { n: [1, 1], fits: () => true, dur: [6, 12], weight: 2 },
  curieux: { n: [1, 1], fits: notBell, dur: [9, 16], weight: 3 },
  gobe: { n: [1, 1], fits: (b) => b.gait === 'glide' && !near(b, 60), dur: [6, 10], weight: 2 },
  ronde: { n: [2, 2], fits: () => true, dur: [10, 16], weight: 2.5, kin: true },
  poursuite: { n: [2, 2], fits: (b) => (b.gait === 'glide' || b.gait === 'jet') && b.speed >= 0.9, dur: [9, 14], weight: 2, kin: true },
  cote: { n: [2, 2], fits: () => true, dur: [10, 16], weight: 2, kin: true },
  salut: { n: [2, 2], fits: notBell, dur: [9, 12], weight: 2, kin: true },
  nettoyage: { n: [2, 2], fits: (b) => cleaner(b) || client(b), dur: [12, 17], weight: 4 },
  banc: { n: [3, 6], fits: (b) => b.gait !== 'crawl', dur: [13, 20], weight: 4, kin: true },
  file: { n: [3, 6], fits: (b) => b.gait === 'crawl' && b.speed >= 0.9, dur: [16, 26], weight: 4, kin: true },
  festin: { n: [3, 6], fits: (b) => notBell(b) && b.speed >= 0.6, dur: [30, 36], weight: 0 }
};

/** how far mates may be to meet (px along x, along y, in depth) */
const MEET_X = 520, MEET_Y = 320;
/** how near the swimmer must be, and how slow, for an animal to come and look at it */
const LOOK_NEAR = 420, LOOK_CALM = 1.2;

function mates(me: Being, free: readonly Being[], g: Geste, dz: number): Being[] {
  return free.filter((o) => o !== me && (!g.kin || o.sp === me.sp) && g.fits(o)
    && Math.abs(o.x - me.x) < MEET_X && Math.abs(o.y - me.y) < MEET_Y && Math.abs(o.plane - me.plane) < dz)
    .sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
}

/**
 * A scene for this animal now, with the others it needs among the free ones (nearest first), or null. The swimmer
 * may be looked at when it is near and calm and `look` allows it (no parade, no farewell, not too many already).
 */
export function choose(me: Being, free: readonly Being[], R: () => number, swimmer: Swimmer | null, look = true): { id: GesteId; who: Being[] } | null {
  const opts: { id: GesteId; who: Being[]; w: number }[] = [];
  for (const id of Object.keys(GESTES) as GesteId[]) {
    const g = GESTES[id];
    if (!g.weight || !g.fits(me)) continue;
    if (id === 'curieux') {
      if (!swimmer || !look || Math.hypot(swimmer.vx, swimmer.vy) > LOOK_CALM || Math.abs(me.plane) > 160) continue;
      if (Math.hypot(swimmer.x - me.x, swimmer.y - me.y) > LOOK_NEAR) continue;
      opts.push({ id, who: [me], w: g.weight });
      continue;
    }
    if (id === 'nettoyage') {
      const other = mates(me, free, g, 200).filter((o) => cleaner(me) ? client(o) : cleaner(o))[0];
      if (!other) continue;
      opts.push({ id, who: cleaner(me) ? [other, me] : [me, other], w: g.weight });
      continue;
    }
    if (g.n[1] === 1) { opts.push({ id, who: [me], w: g.weight }); continue; }
    const m = mates(me, free, g, g.n[1] > 2 ? 90 : 45);
    if (m.length + 1 < g.n[0]) continue;
    opts.push({ id, who: [me, ...m.slice(0, g.n[1] - 1)], w: g.weight });
  }
  if (!opts.length) return null;
  let u = R() * opts.reduce((s, o) => s + o.w, 0);
  for (const o of opts) if ((u -= o.w) <= 0) return { id: o.id, who: o.who };
  return { id: opts[opts.length - 1].id, who: opts[opts.length - 1].who };
}

// ----- the scenes ----- //

const cruise = (b: Being) => clamp(b.speed * 0.45, 0.3, 1.1);
/** the height a swimmer keeps above the floor when it works there */
const hover = (b: Being) => (b.gait === 'crawl' ? 0 : b.len * 0.22 + 8);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** a point the scene may take this animal to: near its home, in the water, above the floor */
function keep(b: Being, w: World, x: number, y: number, z = b.plane): Pt {
  x = clamp(x, b.home - 380, b.home + 380);
  const f = w.floor(x, z);
  return { x, y: b.gait === 'crawl' ? f : clamp(y, 40, f - Math.max(30, hover(b) + 12)) };
}

/**
 * A scene for these animals from now (`who` in their roles, as choose gives them; a file puts them in the order they
 * walk in, act.who); `spot`: where the feast's food falls from.
 */
export function newAct(id: GesteId, who: Being[], t: number, R: () => number, w: World, swimmer: Swimmer | null = null, spot?: Pt): Act {
  const g = GESTES[id], b = who[0];
  const a: Act = {
    id, who: [...who], t0: t, end: t + lerp(g.dur[0], g.dur[1], R()), at: { x: b.x, y: b.y }, to: { x: b.x, y: b.y },
    lead: 0, stage: 0, ts: t, dir: R() < 0.5 ? -1 : 1, k: who.map(() => 0), food: []
  };
  const mid = { x: who.reduce((s, o) => s + o.x, 0) / who.length, y: who.reduce((s, o) => s + o.y, 0) / who.length };
  // a dance or a game in one place keeps clear of the swimmer
  if (swimmer && (id === 'ronde' || id === 'salut' || id === 'poursuite')) {
    const dx = mid.x - swimmer.x, dy = mid.y - swimmer.y, d = Math.hypot(dx, dy), m = id === 'poursuite' ? 260 : 140;
    if (d < m) { mid.x = swimmer.x + (d > 1 ? dx / d : b.x < swimmer.x ? -1 : 1) * m; if (d > 1) mid.y = swimmer.y + (dy / d) * m; }
  }
  switch (id) {
    case 'fouille':
      a.dir = b.hx < 0 ? -1 : 1;
      a.at = keep(b, w, b.x + a.dir * 24, w.floor(b.x, b.z) - hover(b));
      a.k = [-1, 1];
      break;
    case 'ronde': case 'salut':
      a.at = keep(b, w, mid.x, mid.y);
      // the angle the dance starts from
      a.k = [R() * TAU, 0];
      break;
    case 'poursuite':
      a.at = keep(b, w, mid.x, mid.y);
      a.to = a.at;
      // k[0]: when the leader picks its next spot
      a.k = [t, 0];
      break;
    case 'cote': case 'banc': case 'file':
      a.at = mid;
      // the leader goes on the way it is ahead of the others (a file never walks through itself), else back home
      a.dir = Math.abs(b.x - mid.x) > 10 ? Math.sign(b.x - mid.x) : b.x < b.home - 40 ? 1 : b.x > b.home + 40 ? -1 : a.dir;
      // a file: the one most ahead leads, the others behind it in their order
      if (id === 'file') a.who.sort((p, q) => (q.x - p.x) * a.dir);
      a.to = keep(a.who[0], w, a.who[0].x + a.dir * (300 + R() * 160), mid.y + (R() - 0.5) * 120);
      break;
    case 'nettoyage': {
      const c = who[1];
      a.dir = b.x < c.x ? 1 : -1;
      a.at = { x: c.x, y: c.floor };
      break;
    }
    case 'festin': {
      // the food falls from above the spot (above the swimmer by default), in the swimming plane
      const s = spot ?? { x: swimmer ? swimmer.x : b.x, y: Math.max(40, (swimmer ? swimmer.y : b.y) - 260) };
      a.food = feed(R, s.x, s.y, 0, 22);
      a.at = { x: s.x, y: w.floor(s.x, 0) };
      a.k = who.map(() => 0);
      break;
    }
    case 'gobe':
      a.ts = t - 1;
      break;
  }
  return a;
}

/** a clump of food at x, y: flakes that sink slowly, a little apart */
export function feed(R: () => number, x: number, y: number, z: number, n: number): Flake[] {
  return Array.from({ length: n }, () => ({
    x: x + (R() - 0.5) * 70, y: y + (R() - 0.5) * 50, z: z + (R() - 0.5) * 30,
    vx: (R() - 0.5) * 0.08, vy: 0.3 + R() * 0.16, r: 1.6 + R() * 1.2, life: 1, landed: false, eaten: false
  }));
}

/** the food moves: flakes sink and settle on the floor, specks of plankton fade (`fade`: life lost per step) */
export function stepFood(food: Flake[], w: World, t: number): void {
  for (let i = 0; i < food.length; i++) {
    const f = food[i];
    if (f.eaten) continue;
    if (f.vy === 0) { f.life -= STEP / 1.4; if (f.life <= 0) f.eaten = true; f.x += Math.sin(t * 2 + i) * 0.05; continue; }
    if (f.landed) continue;
    f.x += f.vx + Math.sin(t * 1.3 + i * 1.7) * 0.12;
    f.y += f.vy;
    const fl = w.floor(f.x, f.z) - 2;
    if (f.y >= fl) { f.y = fl; f.landed = true; }
  }
}

/** the food left, nearest to (x, y) first; walkers only reach what has landed */
function nearestFood(food: Flake[], b: Being): Flake | null {
  let best: Flake | null = null, bd = Infinity;
  for (const f of food) {
    if (f.eaten || (b.gait === 'crawl' && !f.landed)) continue;
    const d = Math.hypot(f.x - b.x, f.y - b.y);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}

/** eat what is within reach of the head: how many */
export function eat(food: Flake[], b: Being): number {
  let n = 0;
  const reach = 12 + b.len * 0.06;
  for (const f of food) if (!f.eaten && Math.hypot(f.x - b.x, f.y - b.y) < reach) { f.eaten = true; n++; }
  return n;
}

const left = (food: Flake[]) => food.some((f) => !f.eaten);

function goal(x: number, y: number, tempo = 1, accel = 0.05): Goal { return { x, y, accel, tempo, dress: 0 }; }

/** steer toward (x, y) at speed sp, slowing within `slow` px; a walker only goes along the floor unless it flies */
function seek(b: Being, x: number, y: number, sp: number, slow = 50, tempo = 1, fly = b.gait !== 'crawl'): Goal {
  const dx = x - b.x, dy = fly ? y - b.y : 0, d = Math.hypot(dx, dy) || 1, k = sp * Math.min(1, d / slow);
  return goal((dx / d) * k, (dy / d) * k, tempo);
}

/** a heading 3/4 toward the eye, facing right (+1) or left (−1) */
export const facing = (side: number) => (side >= 0 ? -0.5 : Math.PI + 0.5);

/**
 * Has the scene ended: its time is over, its food eaten, or it scattered a moment ago. A swimmer that rushes at
 * one of its animals scatters it (stage SCATTER).
 */
export function over(a: Act, t: number, swimmer: Swimmer | null): boolean {
  if (a.stage === SCATTER) return t - a.ts > 0.9;
  if (t > a.end) return true;
  if (a.id === 'festin' && t - a.t0 > 3 && !left(a.food)) return true;
  if (a.id === 'curieux' && swimmer && Math.hypot(swimmer.x - a.who[0].x, swimmer.y - a.who[0].y) > 640) return true;
  if (swimmer && Math.hypot(swimmer.vx, swimmer.vy) > RUSH) {
    for (const b of a.who) if (Math.hypot(swimmer.x - b.x, swimmer.y - b.y, b.z * 0.6) < b.len * 0.5 + 60) { a.stage = SCATTER; a.ts = t; break; }
  }
  return false;
}

/** what member i of the scene does this step */
export function steerOf(a: Act, i: number, t: number, R: () => number, w: World, swimmer: Swimmer | null): Goal {
  const b = a.who[i];
  if (a.stage === SCATTER) {
    const sx = swimmer ? b.x - swimmer.x : b.hx, sy = swimmer ? b.y - swimmer.y : 0, d = Math.hypot(sx, sy) || 1, k = cruise(b) * 2.8;
    return goal((sx / d) * k, (sy / d) * k, 1.6, 0.1);
  }
  const g = scene(a, i, b, t, R, w, swimmer);
  // never into the swimmer (only the curious come close, and they stop short)
  if (swimmer && a.id !== 'curieux' && Math.abs(b.z) < 60) {
    const dx = b.x - swimmer.x, dy = b.y - swimmer.y, d = Math.hypot(dx, dy) || 1, m = (b.len + swimmer.len) * 0.5 + 16;
    if (d < m) { g.x += (dx / d) * (m - d) * 0.04; g.y += (dy / d) * (m - d) * 0.04; }
  }
  return g;
}

function scene(a: Act, i: number, b: Being, t: number, R: () => number, w: World, swimmer: Swimmer | null): Goal {
  switch (a.id) {
    case 'fouille': return fouille(a, b, t, R, w);
    case 'repos': return repos(a, b, t, w);
    case 'curieux': return curieux(a, b, t, swimmer);
    case 'gobe': return gobe(a, b, t, R, w);
    case 'ronde': return ronde(a, i, t, w);
    case 'poursuite': return poursuite(a, i, t, R, w);
    case 'cote': return cote(a, i, R, w);
    case 'salut': return salut(a, i, t);
    case 'nettoyage': return nettoyage(a, i, t);
    case 'banc': return banc(a, i, t, R, w);
    case 'file': return file(a, i, t);
    case 'festin': return festin(a, i, t, w);
  }
}

/** nose to the sand, a peck, a few px further, and again: each peck stirs a puff of sand */
function fouille(a: Act, b: Being, t: number, R: () => number, w: World): Goal {
  if (a.stage === 0) {
    if (Math.hypot(a.at.x - b.x, a.at.y - b.y) < 16 || t - a.t0 > 6) { a.stage = 1; a.ts = t; }
    return seek(b, a.at.x, a.at.y, cruise(b), 40);
  }
  // k[0]: the last peck that puffed, k[1]: the next cycle that needs a new spot
  const per = b.gait === 'crawl' ? 1.5 : 1.8, u = (t - a.ts) / per, c = Math.floor(u), f = u - c;
  if (f < 0.45) {
    const g = b.gait === 'crawl' ? goal(0, 0, 1.2) : goal(a.dir * 0.06, 0.55, 1.2);
    if (f > 0.28 && a.k[0] < c) { a.k[0] = c; g.puff = true; }
    return g;
  }
  if (a.k[1] <= c) {
    // the next spot: a few px along, back the other way now and then
    a.k[1] = c + 1;
    if (R() < 0.22) a.dir = -a.dir;
    a.at = keep(b, w, b.x + a.dir * (6 + R() * 12), w.floor(b.x, b.z) - hover(b));
  }
  return seek(b, a.at.x, a.at.y, 0.45, 20, 1.1);
}

/** still, nearly: near the floor it settles a little above it; its body slows down and its colours pale */
function repos(a: Act, b: Being, t: number, w: World): Goal {
  if (b.gait === 'bell') return { ...goal(0, 0, 0.45), dress: -1 };
  if (a.stage === 0) {
    a.stage = 1;
    a.dir = b.hx < 0 ? -1 : 1;
    const f = w.floor(b.x, b.z);
    a.at = b.gait === 'crawl' ? { x: b.x, y: f } : { x: b.x, y: f - b.y < 220 ? f - (b.len * 0.3 + 10) : b.y };
  }
  const d = Math.hypot(a.at.x - b.x, a.at.y - b.y);
  const g = d > 8 && b.gait !== 'crawl' ? seek(b, a.at.x, a.at.y, 0.3, 40, 0.5) : goal(0, 0, 0.35, 0.03);
  if (d <= 8 || b.gait === 'crawl') g.yaw = facing(a.dir);
  g.dress = t - a.t0 > 1 ? -1 : 0;
  return g;
}

/** it comes to look at the swimmer, a little apart (a hunter further away), and turns to face it */
function curieux(a: Act, b: Being, t: number, s: Swimmer | null): Goal {
  if (!s) return goal(0, 0);
  const gap = s.len * 0.5 + b.len * 0.5 + (b.ai === 'hunter' ? 170 : 60);
  let dx = b.x - s.x, dy = (b.y - s.y) * 0.6;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;
  const cx = b.gait === 'crawl' ? s.x + (dx < 0 ? -1 : 1) * gap * 0.8 : s.x + dx * gap, cy = b.gait === 'crawl' ? b.floor : s.y + dy * gap;
  const off = Math.hypot(cx - b.x, cy - b.y);
  if (a.stage === 0 && off < 24) { a.stage = 1; a.ts = t; }
  if (a.stage === 0 || off > 60) return seek(b, cx, cy, cruise(b) * (a.stage === 0 ? 1.3 : 1), 40, 1.2);
  const g = goal(0, 0, 1.15, 0.04);
  g.yaw = facing(s.x - b.x);
  return g;
}

/** quick darts at specks of plankton just ahead, each one gone in a snap */
function gobe(a: Act, b: Being, t: number, R: () => number, w: World): Goal {
  if (a.stage === 0) {
    if (t - a.ts < a.k[0]) return goal(b.vx * 0.5, b.vy * 0.5, 1.1, 0.03);
    // a speck ahead, a little up or down
    const ang = Math.atan2(b.hy, b.hx || 1) + (R() - 0.5) * 1.6, d = 40 + R() * 30;
    a.to = keep(b, w, b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d * 0.7);
    a.food = a.food.filter((f) => !f.eaten);
    for (let k = 0; k < 2; k++) a.food.push({ x: a.to.x + (R() - 0.5) * 8, y: a.to.y + (R() - 0.5) * 8, z: b.z, vx: 0, vy: 0, r: 1 + R() * 0.5, life: 1, landed: false, eaten: false });
    a.stage = 1; a.ts = t;
  }
  eat(a.food, b);
  if (t - a.ts > 0.9 || !a.food.some((f) => !f.eaten && Math.hypot(f.x - a.to.x, f.y - a.to.y) < 12)) {
    a.stage = 0; a.ts = t; a.k[0] = 0.6 + R() * 0.9;
  }
  return seek(b, a.to.x, a.to.y, cruise(b) * 2.6, 10, 1.4);
}

/** the two circle each other round their middle, in depth; their colours brighten */
function ronde(a: Act, i: number, t: number, w: World): Goal {
  const b = a.who[i], o = a.who[1 - i];
  const rad = Math.max(b.len, o.len) * 0.5 + 26, om = (b.gait === 'crawl' ? 0.5 : b.gait === 'bell' ? 0.3 : 0.9) * a.dir;
  const z0 = (b.plane + o.plane) / 2;
  const th = a.k[0] + om * (t - a.t0) + i * Math.PI + (a.stage ? 0.4 * Math.sign(om) : 0);
  const x = a.at.x + rad * Math.cos(th), z = z0 + rad * 0.9 * Math.sin(th);
  const y = b.gait === 'crawl' ? w.floor(x, z) : a.at.y + 10 * Math.sin(2 * th + i);
  if (a.stage === 0 && (t - a.t0 > 6 || a.who.every((m, k) => Math.hypot(m.x - (a.at.x + rad * Math.cos(th + (k - i) * Math.PI)), m.y - a.at.y) < rad * 1.6))) a.stage = 1;
  const sp = a.stage ? clamp((rad * Math.abs(om) * STEP) * 1.4, 0.25, cruise(b) * 1.6) : cruise(b) * 1.4;
  const g = seek(b, x, y, sp, 20, a.stage ? 1.15 : 1);
  g.z = a.stage ? z : b.plane;
  g.dress = a.stage ? 1 : 0;
  return g;
}

/** play: one darts here and there, the other follows close behind without ever touching; then they swap */
function poursuite(a: Act, i: number, t: number, R: () => number, w: World): Goal {
  const b = a.who[i], o = a.who[1 - i];
  if (t - a.ts > 3.4) {
    // the one that was caught up turns and runs: the other way
    a.lead = 1 - a.lead; a.ts = t; a.k[0] = t + 1.2;
    const n = a.who[a.lead], m = a.who[1 - a.lead], dx = n.x - m.x || 1, dy = n.y - m.y, d = Math.hypot(dx, dy);
    a.to = keep(n, w, a.at.x + (dx / d) * 150, a.at.y + (dy / d) * 90);
  }
  if (i === a.lead) {
    if (Math.hypot(a.to.x - b.x, a.to.y - b.y) < 24 || a.k[0] < t) {
      a.k[0] = t + 1 + R() * 0.6;
      const ang = R() * TAU;
      a.to = keep(b, w, a.at.x + Math.cos(ang) * 170, a.at.y + Math.sin(ang) * 90);
    }
    return seek(b, a.to.x, a.to.y, cruise(b) * 1.9, 30, 1.5);
  }
  const close = Math.hypot(o.x - b.x, o.y - b.y) < (o.len + b.len) * 0.45 + 12;
  if (close) return goal(o.vx * 0.8, o.vy * 0.8, 1.5, 0.08);
  return seek(b, o.x - o.vx * 10, o.y - o.vy * 10, cruise(b) * 2.1, 30, 1.5);
}

/** the two go along together, one beside the other in depth, matching its pace */
function cote(a: Act, i: number, R: () => number, w: World): Goal {
  const l = a.who[0];
  if (i === 0) {
    if (Math.hypot(a.to.x - l.x, a.to.y - l.y) < 30) {
      a.dir = -a.dir;
      a.to = keep(l, w, l.x + a.dir * (260 + R() * 160), l.y + (R() - 0.5) * 100);
    }
    return seek(l, a.to.x, a.to.y, cruise(l) * 0.95, 60);
  }
  const b = a.who[i], tx = l.x - l.hx * 10, ty = l.y - 12;
  let x = l.vx + (tx - b.x) * 0.04, y = l.vy + (ty - b.y) * 0.04;
  const m = Math.hypot(x, y), cap = cruise(b) * 1.8;
  if (m > cap) { x *= cap / m; y *= cap / m; }
  const g = goal(x, y);
  g.z = l.z + 34 * (l.plane > 200 ? -1 : 1);
  return g;
}

/** they meet face to face, stay a moment nose to nose with a nudge or two, then go their ways */
function salut(a: Act, i: number, t: number): Goal {
  const b = a.who[i], o = a.who[1 - i], side = b.x < o.x || (b.x === o.x && i === 0) ? -1 : 1;
  const gap = (b.len + o.len) * 0.5 + 10, sx = a.at.x + side * gap * 0.5, sy = b.gait === 'crawl' ? b.floor : a.at.y;
  if (a.stage === 0) {
    if (t - a.t0 > 7 || a.who.every((m) => Math.abs(m.x - a.at.x) < gap * 0.5 + 16 && (m.gait === 'crawl' || Math.abs(m.y - a.at.y) < 20))) { a.stage = 1; a.ts = t; a.end = Math.max(a.end, t + 6); }
    return seek(b, sx, sy, cruise(b), 30);
  }
  if (a.stage === 1) {
    const u = t - a.ts;
    if (u > 3.2) { a.stage = 2; a.ts = t; }
    // a nudge toward the other now and then
    const nudge = (u % 1.1) < 0.18 ? -side * 0.18 : 0;
    const g = goal(nudge + (sx - b.x) * 0.02, b.gait === 'crawl' ? 0 : (sy - b.y) * 0.02, 1.1, 0.06);
    g.yaw = facing(-side);
    return g;
  }
  if (t - a.ts > 3) a.end = Math.min(a.end, t);
  return seek(b, b.x + side * 120, sy + (i ? -30 : 30), cruise(b), 30);
}

/** the fish hovers above the shrimp's spot, pale and still; the shrimp swims up and picks along its belly */
function nettoyage(a: Act, i: number, t: number): Goal {
  const c = a.who[0], hx = a.at.x + a.dir * c.len * 0.35, hy = a.at.y - (c.len * 0.12 + 62);
  if (a.stage === 0 && (Math.hypot(hx - c.x, hy - c.y) < 18 || t - a.t0 > 8)) { a.stage = 1; a.ts = t; a.end = Math.max(a.end, t + 11); }
  if (a.stage === 1 && t > a.end - 2.5) a.stage = 2;
  if (i === 0) {
    if (a.stage === 2) return seek(c, hx + a.dir * 220, hy - 50, cruise(c), 40);
    if (a.stage === 0) return seek(c, hx, hy, cruise(c) * 1.4, 50);
    // still, turned a little toward us; back to its spot if it drifted off
    const g = Math.hypot(hx - c.x, hy - c.y) > 34 ? seek(c, hx, hy, cruise(c) * 0.6, 30, 0.6) : goal(0, 0, 0.5, 0.04);
    if (!g.x) g.yaw = facing(a.dir);
    g.dress = -1;
    return g;
  }
  const s = a.who[1];
  if (a.stage !== 1) return seek(s, a.at.x, a.at.y, cruise(s), 30);
  // under the belly, from behind the head back to the middle, a spot every two seconds
  const u = [0.08, 0.25, 0.45, 0.25][Math.floor((t - a.ts) / 2) % 4];
  const px = c.x - c.hx * c.len * u, py = c.y - c.hy * c.len * u + c.len * 0.12 + 8, d = Math.hypot(px - s.x, py - s.y);
  // there: it noses up into the belly, facing the head, and picks (its legs go fast)
  const g = d > 12 ? seek(s, px, py, cruise(s) * 1.1, 26, 1.3, true) : goal((px - s.x) * 0.004, -0.06, 1.7, 0.08);
  if (d <= 12) g.yaw = facing(c.hx);
  g.swim = true;
  return g;
}

/** a little troop: the leader goes, the others keep a loose place behind it, staggered in depth */
function banc(a: Act, i: number, t: number, R: () => number, w: World): Goal {
  const l = a.who[0];
  if (i === 0) {
    if (Math.hypot(a.to.x - l.x, a.to.y - l.y) < 40) {
      a.dir = -a.dir;
      a.to = keep(l, w, l.x + a.dir * (280 + R() * 180), l.y + (R() - 0.5) * 140);
    }
    return seek(l, a.to.x, a.to.y, cruise(l) * 0.85, 60);
  }
  const b = a.who[i], row = Math.ceil(i / 2), side = i % 2 ? 1 : -1, wob = Math.sin(t * 0.7 + i * 1.9);
  let tx: number, ty: number, tz: number;
  if (l.gait === 'bell') {
    const ang = (i * TAU) / (a.who.length - 1) + t * 0.1;
    tx = l.x + Math.cos(ang) * (l.len * 0.8 + 20); ty = l.y + Math.sin(ang) * 30 + wob * 8; tz = l.z + Math.sin(ang) * 40;
  } else {
    const back = row * (l.len * 0.45 + 18);
    tx = l.x - l.hx * back; ty = l.y - l.hy * back + side * row * 12 + wob * 9; tz = l.z + side * row * 26;
  }
  let x = l.vx * 0.9 + (tx - b.x) * 0.035, y = l.vy * 0.9 + (ty - b.y) * 0.035;
  // never into each other
  for (const o of a.who) {
    if (o === b) continue;
    const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy, (b.z - o.z) * 0.5) || 1, m = (b.len + o.len) * 0.35 + 8;
    if (d < m) { x += (dx / d) * (m - d) * 0.02; y += (dy / d) * (m - d) * 0.02; }
  }
  const mm = Math.hypot(x, y), cap = cruise(b) * 1.9;
  if (mm > cap) { x *= cap / mm; y *= cap / mm; }
  const g = goal(x, y);
  g.z = tz;
  return g;
}

/** walkers in single file across the floor, each one close behind the one before (lobsters do it) */
function file(a: Act, i: number, t: number): Goal {
  const l = a.who[0];
  if (i === 0) {
    if (Math.abs(a.to.x - l.x) < 30) a.end = Math.min(a.end, t + 1.5);
    const g = seek(l, a.to.x, a.to.y, cruise(l) * 0.9, 40);
    // a little dust under the leader now and then
    if (t - a.ts > 1.3) { a.ts = t; g.puff = true; }
    g.z = l.plane;
    return g;
  }
  const b = a.who[i], p = a.who[i - 1], gap = (p.len + b.len) * 0.36 + 4;
  const dx = p.x - b.x, d = Math.abs(dx);
  // behind the one before, along the way the file goes
  const tx = p.x - Math.sign(a.to.x - l.x || 1) * gap;
  const g = d < gap * 0.9 && Math.sign(dx) === Math.sign(a.to.x - l.x) ? goal(0, 0) : seek(b, tx, b.floor, cruise(b) * 1.4, 30);
  g.z = l.plane;
  return g;
}

/** food falls: the swimmers snap the flakes as they sink, the walkers wait where they land; each bite there stirs the sand */
function festin(a: Act, i: number, t: number, w: World): Goal {
  const b = a.who[i];
  if (a.k[i] > t) {
    // a bite: a moment still, nose down when it was on the floor
    const g = b.gait === 'crawl' || b.floor - b.y > 50 ? goal(0, 0, 1.3) : goal(0.04, 0.5, 1.3);
    g.z = 0;
    return g;
  }
  const f = nearestFood(a.food, b);
  if (!f) {
    const x = a.at.x + (i - (a.who.length - 1) / 2) * 22, g = seek(b, x, b.gait === 'crawl' ? w.floor(x, 0) : a.at.y - 60, cruise(b), 40);
    g.z = 0;
    return g;
  }
  if (eat(a.food, b)) {
    a.k[i] = t + 0.5;
    const g = goal(0, 0, 1.3);
    if (f.landed) g.puff = true;
    g.z = 0;
    return g;
  }
  // into the plane of the food
  const g = seek(b, f.x, f.landed && b.gait !== 'crawl' ? f.y - hover(b) * 0.5 : f.y, cruise(b) * 1.8, 16, 1.3);
  g.z = 0;
  return g;
}

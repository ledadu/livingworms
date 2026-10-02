// The little games of the animals: now and then one of them plays with the swimmer, for nothing, and nobody loses.
// A fish plays tag (« chat »): it touches us and darts off, we catch it up, it comes back for more. A little shoal
// (« banc ») takes us in if we swim at its pace, and leads us to its hidden corner. An octopus plays hide-and-seek
// (« cache »): it hides, the colour of the sand, and we look for it. Each game ends with a small gift: a glow, a bite,
// a treasure. An animal left alone goes back to its life; a hider not found shows itself.
//
// This module is pure, like vie.ts, whose animals (Being) and goals it shares; jeux-jeu.ts puts it in the world.

import { STEP, TAU, clamp } from '../engine';
import { facing, feed, stepFood, type Being, type Flake, type Goal, type Pt, type Swimmer, type World } from './vie';

export type JeuId = 'chat' | 'banc' | 'cache';
export type Gift = 'lueur' | 'bouchee' | 'tresor';
export type Stage = 'vient' | 'file' | 'tourne' | 'passe' | 'mene' | 'coin' | 'salue' | 'cache' | 'sort' | 'fin' | 'part';

export interface JeuWorld extends World {
  /** the nearest point in the open water where a game may go: inside the world's bounds, below the ceiling */
  keep(x: number, y: number): Pt;
  /** the hidden corner a shoal leads to from x, going this way (±1) */
  nook(x: number, dir: number): Pt;
}

/** what a game does that shows: a touch, a catch, the shoal that takes us, ink, a hint, a hider found, a gift */
export type JeuEventKind = 'touche' | 'attrape' | 'accepte' | 'arrive' | 'encre' | 'indice' | 'trouve' | 'cadeau' | 'miette';
export interface JeuEvent { k: JeuEventKind; x: number; y: number; z: number }

/** a goal of vie.ts, and the camouflage of a hider */
export interface JeuGoal extends Goal { hide?: boolean }

export interface Jeu {
  id: JeuId;
  /** the animals: the fish; the shoal, its leader first; the hider */
  who: Being[];
  stage: Stage;
  t0: number;
  /** when the stage began */
  ts: number;
  /** catches, hiders found */
  round: number;
  /** touches nobody chased */
  tries: number;
  /** where it is going: a spot to dart to, the corner, the hideout; and the gift's place */
  to: Pt;
  at: Pt;
  /** a side or a way: ±1 */
  dir: number;
  /** when something is due: a new spot to dart to, a hint */
  next: number;
  /** the shoal: how well the swimmer keeps to its pace, 0 to 1 */
  accord: number;
  /** the hider's plane in depth while it hides */
  z: number;
  gift: Gift | null;
  /** the bites of the hidden corner */
  food: Flake[];
  /** each member's clock (a bite) */
  k: number[];
  done: boolean;
}

interface Game {
  /** how many animals: least, most */
  n: [number, number];
  fits(b: Being): boolean;
  /** the others are of its species */
  kin?: boolean;
  gift: Gift;
  /** how often it is chosen among those that can be played */
  weight: number;
}

export const JEUX: Record<JeuId, Game> = {
  chat: { n: [1, 1], fits: (b) => b.gait === 'glide' && b.speed >= 1 && b.len < 160, gift: 'lueur', weight: 1 },
  banc: { n: [3, 6], fits: (b) => b.gait !== 'crawl' && b.len < 160, kin: true, gift: 'bouchee', weight: 1 },
  cache: { n: [1, 1], fits: (b) => b.gait === 'jet' || (b.gait === 'crawl' && b.legs && b.len >= 24), gift: 'tresor', weight: 1.4 }
};

/** a game is offered by animals this near the swimmer (px), in the swimming plane or close to it */
export const NEAR = 600, PLANE = 160;
/** the swimmer far away: the game ends, the animals go back to their life */
export const AWAY = 1100;
/** tag: the catches before the gift; the time a fish waits to be chased before it comes back to touch us (s) */
export const ROUNDS = 3, CHASE = 14;
/** the shoal: the seconds swum at its pace for it to take us; how long it passes by before it goes (s) */
export const ACCORD = 3.5, PASSING = 45;
/** hide-and-seek: the hidings found before the gift; the first hint, the time between hints, when it shows itself (s);
 * a swimmer further than LOOKING when it shows itself was not looking for it: the hider goes back to its life */
export const HIDINGS = 2, HINT = 9, HINTS = 5, SHOW = 30, LOOKING = 500;

const cruise = (b: Being) => clamp(b.speed * 0.45, 0.3, 1.1);
const dist = (b: Pt, s: Pt) => Math.hypot(b.x - s.x, b.y - s.y);
/** close enough to touch */
const reach = (b: Being, s: Swimmer) => (b.len + s.len) * 0.3 + 16;
/** the height a swimmer keeps above the floor */
const hover = (b: Being) => (b.gait === 'crawl' ? 0 : b.len * 0.22 + 10);
const mid = (bs: readonly Being[]): Pt => ({ x: bs.reduce((s, b) => s + b.x, 0) / bs.length, y: bs.reduce((s, b) => s + b.y, 0) / bs.length });

/** a point a game may take this animal to: in the open water, not too far from where it lives */
function keep(b: Being, w: JeuWorld, x: number, y: number, span = 700): Pt {
  return w.keep(clamp(x, b.home - span, b.home + span), y);
}

function goal(x: number, y: number, tempo = 1, accel = 0.05): JeuGoal { return { x, y, accel, tempo, dress: 0 }; }

/** steer toward (x, y) at speed sp, slowing within `slow` px; a walker only along the floor */
function seek(b: Being, x: number, y: number, sp: number, slow = 40, tempo = 1): JeuGoal {
  const dx = x - b.x, dy = b.gait === 'crawl' ? 0 : y - b.y, d = Math.hypot(dx, dy) || 1, k = sp * Math.min(1, d / slow);
  return goal((dx / d) * k, (dy / d) * k, tempo);
}

// ----- which game, with whom ----- //

/**
 * A game the swimmer may be offered now by the free animals near it (nearest first), or null. A shoal needs at least
 * three of a kind, close together.
 */
export function chooseJeu(s: Swimmer, free: readonly Being[], R: () => number): { id: JeuId; who: Being[] } | null {
  const near = free.filter((b) => Math.abs(b.plane) < PLANE && Math.abs(b.z) < PLANE && dist(b, s) < NEAR)
    .sort((p, q) => dist(p, s) - dist(q, s));
  const opts: { id: JeuId; who: Being[]; w: number }[] = [];
  for (const id of Object.keys(JEUX) as JeuId[]) {
    const g = JEUX[id], fit = near.filter(g.fits);
    if (!fit.length) continue;
    // an octopus or a cuttlefish hides rather than a walker
    if (id === 'cache') fit.sort((p, q) => +(q.gait === 'jet') - +(p.gait === 'jet'));
    if (!g.kin) { opts.push({ id, who: [fit[0]], w: g.weight }); continue; }
    for (const b of fit) {
      const kin = fit.filter((o) => o.sp === b.sp && dist(o, b) < 360);
      if (kin.length >= g.n[0]) { opts.push({ id, who: kin.slice(0, g.n[1]), w: g.weight }); break; }
    }
  }
  if (!opts.length) return null;
  let u = R() * opts.reduce((a, o) => a + o.w, 0);
  for (const o of opts) if ((u -= o.w) <= 0) return { id: o.id, who: o.who };
  return opts[opts.length - 1];
}

/** a game from now with these animals (as chooseJeu gives them) */
export function newJeu(id: JeuId, who: Being[], t: number, R: () => number, w: JeuWorld, s: Swimmer): Jeu {
  const b = who[0], m = mid(who);
  const j: Jeu = {
    id, who: [...who], stage: 'vient', t0: t, ts: t, round: 0, tries: 0, to: { x: b.x, y: b.y }, at: m, dir: 1, next: t,
    accord: 0, z: 0, gift: null, food: [], k: who.map(() => 0), done: false
  };
  if (id === 'banc') {
    // the troop comes past the swimmer, from where it is to the other side
    j.stage = 'passe';
    j.dir = s.x > m.x ? 1 : -1;
    j.to = keep(b, w, s.x + j.dir * 380, s.y + (R() - 0.5) * 60);
  }
  return j;
}

// ----- the games ----- //

/** the game moves on: its stages, its rounds, its gift; what shows (events) */
export function stepJeu(j: Jeu, t: number, R: () => number, w: JeuWorld, s: Swimmer): JeuEvent[] {
  const ev: JeuEvent[] = [];
  const b = j.who[0], u = t - j.ts;
  const at = (k: JeuEventKind, p: Pt, z = 0) => ev.push({ k, x: p.x, y: p.y, z });
  const stage = (st: Stage) => { j.stage = st; j.ts = t; };
  if (j.done) return ev;
  if (j.stage === 'part') { if (u > 2.5) j.done = true; return ev; }
  if (j.stage === 'fin') { if (u > 5) j.done = true; return ev; }
  // a swimmer gone far away: the game is over, nobody lost
  if (dist(j.id === 'banc' ? mid(j.who) : b, s) > AWAY) { stage('part'); return ev; }
  const gift = (p: Pt) => { j.gift = JEUX[j.id].gift; j.at = p; at('cadeau', p); };

  switch (j.id) {
    case 'chat':
      if (j.stage === 'vient') {
        if (dist(b, s) < reach(b, s)) { at('touche', { x: (b.x + s.x) / 2, y: (b.y + s.y) / 2 }); stage('file'); j.next = t; }
        // a swimmer that keeps away from it: it lets go
        else if (u > 10) stage('part');
      } else if (j.stage === 'file') {
        // caught: it got away first, and we came to it (a swimmer that stays still does not catch)
        if (u > 1.2 && dist(b, s) < reach(b, s) && Math.hypot(s.vx, s.vy) > 0.8) { at('attrape', b, b.z); j.round++; j.tries = 0; stage('tourne'); }
        else if (u > CHASE) { j.tries++; stage(j.tries >= 2 && !j.round ? 'part' : 'vient'); }
      } else if (j.stage === 'tourne' && u > 1.2) {
        if (j.round >= ROUNDS) { stage('fin'); gift({ x: (b.x + s.x) / 2, y: (b.y + s.y) / 2 }); } else stage('vient');
      }
      break;

    case 'banc': {
      const l = b;
      if (j.stage === 'passe') {
        const m = mid(j.who), spread = j.who.length * l.len * 0.3;
        const along = dist(m, s) < 170 + spread && Math.hypot(s.vx - l.vx, s.vy - l.vy) < 0.6 && Math.hypot(s.vx, s.vy) > 0.25;
        j.accord = along ? Math.min(1, j.accord + STEP / ACCORD) : Math.max(0, j.accord - STEP / 12);
        if (j.accord >= 1) {
          at('accepte', m);
          stage('mene');
          j.to = w.nook(l.x, j.dir);
        } else if (t - j.t0 > PASSING) stage('part');
        else if (dist(l, j.to) < 40) {
          // the troop turns and passes by again
          j.dir = -j.dir;
          j.to = keep(l, w, l.x + j.dir * (380 + R() * 160), l.y + (R() - 0.5) * 100);
        }
      } else if (j.stage === 'mene') {
        // (a corner it cannot reach: the place where it is will do)
        if (dist(l, j.to) < 50 || u > 40) {
          if (u > 40) j.to = { x: l.x, y: l.y };
          at('arrive', j.to);
          stage('coin');
          j.food = feed(R, j.to.x, j.to.y - 60, 0, 16);
          gift(j.to);
        }
      } else if (j.stage === 'coin') {
        stepFood(j.food, w, t);
        const n = bite(j.food, s.x, s.y, 14 + s.len * 0.12);
        for (let k = 0; k < n; k++) at('miette', s);
        if ((u > 3 && !j.food.some((f) => !f.eaten)) || u > 24) { j.done = true; j.food.length = 0; }
      }
      break;
    }

    case 'cache':
      if (j.stage === 'vient') {
        if (dist(b, s) < (b.len + s.len) * 0.5 + 80 || u > 8) stage('salue');
      } else if (j.stage === 'salue') {
        if (u > 1.4) hide(j, R, w, s, t, ev);
      } else if (j.stage === 'file') {
        if (dist(b, j.to) < 20 || u > 7) { stage('cache'); j.next = t + HINT; }
      } else if (j.stage === 'cache') {
        // found (the swimmer comes over it, as low as its own floor lets it), or it shows itself: nobody loses here
        const low = Math.min(b.y, w.floor(b.x, 0) - 30);
        if (Math.hypot(b.x - s.x, low - s.y) < 110 + b.len * 0.5 || (u > SHOW && dist(b, s) < LOOKING)) { at('trouve', b, b.z); j.round++; stage('sort'); }
        else if (u > SHOW) stage('part');
        else if (t >= j.next) { at('indice', b, b.z); j.next = t + HINTS; }
      } else if (j.stage === 'sort' && u > 1.5) {
        // the gift: a pearl where it was hiding, on the sand of the swimming plane
        if (j.round >= HIDINGS) { stage('fin'); gift({ x: j.to.x, y: w.floor(j.to.x, 0) - 5 }); }
        else hide(j, R, w, s, t, ev);
      }
      break;
  }
  return ev;
}

/** the hider squirts a little ink and goes to hide, on the other side, further back in depth, near the floor */
function hide(j: Jeu, R: () => number, w: JeuWorld, s: Swimmer, t: number, ev: JeuEvent[]): void {
  const b = j.who[0];
  ev.push({ k: 'encre', x: b.x, y: b.y, z: b.z });
  j.dir = j.round ? -j.dir : b.x < s.x ? -1 : 1;
  j.z = 110 + R() * 90;
  const x = keep(b, w, b.x + j.dir * (260 + R() * 180), b.y).x;
  j.to = { x, y: w.floor(x, j.z) - hover(b) };
  j.stage = 'file'; j.ts = t;
}

/** the bites within reach of a mouth at (x, y): how many it ate */
export function bite(food: Flake[], x: number, y: number, r: number): number {
  let n = 0;
  for (const f of food) if (!f.eaten && Math.hypot(f.x - x, f.y - y) < r) { f.eaten = true; n++; }
  return n;
}

/** what member i of the game does this step */
export function goalOf(j: Jeu, i: number, t: number, R: () => number, w: JeuWorld, s: Swimmer): JeuGoal {
  const b = j.who[i];
  if (j.stage === 'part') return seek(b, b.home, b.y, cruise(b), 60);
  const g = j.id === 'chat' ? chat(j, b, t, R, w, s) : j.id === 'banc' ? banc(j, i, t, R, s) : cache(j, b, t, s);
  // never into the swimmer, but the fish that touches it and the one we catch
  if (j.id !== 'chat' && Math.abs(b.z) < 60) {
    const dx = b.x - s.x, dy = b.y - s.y, d = Math.hypot(dx, dy) || 1, m = (b.len + s.len) * 0.3 + 12;
    if (d < m) { g.x += (dx / d) * (m - d) * 0.04; g.y += (dy / d) * (m - d) * 0.04; }
  }
  return g;
}

/** tag: it comes to touch us, darts off within our reach, waits when we lag, turns a loop when caught */
function chat(j: Jeu, b: Being, t: number, R: () => number, w: JeuWorld, s: Swimmer): JeuGoal {
  const flee = clamp(b.speed * 1.2, 1.6, 2.3), gap = dist(b, s);
  let g: JeuGoal;
  if (j.stage === 'vient') g = seek(b, s.x, s.y, clamp(b.speed * 1.2, 1.2, 2.2), 10, 1.4);
  else if (j.stage === 'tourne') {
    const a = ((t - j.ts) / 1.2) * TAU * j.dir;
    g = goal(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 1.7, 0.1);
  } else if (j.stage === 'fin') {
    const x = s.x + (b.x < s.x ? -1 : 1) * (s.len * 0.5 + b.len * 0.5 + 30);
    g = Math.hypot(x - b.x, s.y - b.y) > 20 ? seek(b, x, s.y, cruise(b), 30) : goal(0, 0, 1.2, 0.04);
    if (!g.x) g.yaw = facing(s.x - b.x);
  } else {
    // a new spot away from us now and then, sooner when we are on its tail
    if (t >= j.next || dist(b, j.to) < 24 || (gap < 70 && j.next - t > 0.4)) {
      const ang = Math.atan2(b.y - s.y, b.x - s.x) + (R() - 0.5) * 1.8, d = 200 + R() * 120;
      j.to = keep(b, w, b.x + Math.cos(ang) * d, b.y + Math.sin(ang) * d * 0.7);
      j.next = t + 1.1 + R() * 0.8;
      j.dir = R() < 0.5 ? -1 : 1;
    }
    if (gap > 520) g = seek(b, s.x, s.y, cruise(b) * 1.5, 60, 1.3);
    else if (gap > 320) { g = goal(b.vx * 0.9, b.vy * 0.9, 1.3, 0.04); if (Math.hypot(b.vx, b.vy) < 0.3) g.yaw = facing(s.x - b.x); }
    else g = seek(b, j.to.x, j.to.y, gap < 160 ? flee : flee * 0.7, 30, 1.6);
  }
  g.dress = j.stage === 'vient' && !j.round ? 0 : 1;
  return g;
}

/** the shoal: the leader goes, the others in chevron behind it; once we keep its pace, a place among them is ours */
function banc(j: Jeu, i: number, t: number, R: () => number, s: Swimmer): JeuGoal {
  const l = j.who[0], pace = clamp(cruise(l), 0.55, 0.95), b = j.who[i];
  const dress = j.stage === 'passe' ? Math.round(j.accord * 3) / 3 : 1;
  if (j.stage === 'coin') {
    // they nibble at the corner, a pause after each bite: there is enough for the swimmer too
    if (j.k[i] > t) return { ...goal(0, 0, 1.2), dress };
    let f: Flake | null = null, fd = Infinity;
    for (const o of j.food) if (!o.eaten) { const d = dist(o, b); if (d < fd) { fd = d; f = o; } }
    if (!f) return { ...seek(b, j.to.x + (i - j.who.length / 2) * 26, j.to.y - 40, cruise(b), 40), dress };
    if (fd < 12 + b.len * 0.06) { f.eaten = true; j.k[i] = t + 1.6 + R(); return { ...goal(0, 0, 1.3), dress }; }
    return { ...seek(b, f.x, f.y, cruise(b) * 1.3, 16, 1.2), dress, z: 0 };
  }
  if (i === 0) {
    // it waits for a swimmer that lags behind on the way to its corner
    const sp = j.stage === 'mene' && dist(l, s) > 240 ? 0.15 : j.stage === 'mene' ? pace * 1.15 : pace;
    return { ...seek(l, j.to.x, j.to.y, sp, 60), dress };
  }
  // the slot behind the leader is the swimmer's once the shoal takes it in
  const slot = i + (j.stage === 'mene' || j.accord > 0.35 ? 1 : 0);
  const row = Math.ceil(slot / 2), side = slot % 2 ? 1 : -1, wob = Math.sin(t * 0.7 + i * 1.9);
  let tx: number, ty: number, tz: number;
  if (l.gait === 'bell') {
    const ang = (slot * TAU) / j.who.length + t * 0.1;
    tx = l.x + Math.cos(ang) * (l.len * 0.8 + 20); ty = l.y + Math.sin(ang) * 30 + wob * 8; tz = l.z + Math.sin(ang) * 40;
  } else {
    const back = row * (l.len * 0.45 + 18);
    tx = l.x - l.hx * back; ty = l.y - l.hy * back + side * row * 12 + wob * 9; tz = l.z + side * row * 26;
  }
  let x = l.vx * 0.9 + (tx - b.x) * 0.035, y = l.vy * 0.9 + (ty - b.y) * 0.035;
  for (const o of j.who) {
    if (o === b) continue;
    const dx = b.x - o.x, dy = b.y - o.y, d = Math.hypot(dx, dy, (b.z - o.z) * 0.5) || 1, m = (b.len + o.len) * 0.35 + 8;
    if (d < m) { x += (dx / d) * (m - d) * 0.02; y += (dy / d) * (m - d) * 0.02; }
  }
  const mm = Math.hypot(x, y), cap = cruise(b) * 1.9;
  if (mm > cap) { x *= cap / mm; y *= cap / mm; }
  return { ...goal(x, y), z: tz, dress };
}

/** hide-and-seek: it comes, wriggles at us, squirts ink and hides, still and sand-coloured; found, it springs out */
function cache(j: Jeu, b: Being, t: number, s: Swimmer): JeuGoal {
  const gap = (b.len + s.len) * 0.5 + 60;
  switch (j.stage) {
    case 'vient': {
      const side = b.x < s.x ? -1 : 1, y = b.gait === 'crawl' ? b.floor : s.y;
      return seek(b, s.x + side * gap, y, cruise(b) * 1.4, 40, 1.2);
    }
    case 'salue': {
      // it faces us and wriggles: come and find me
      const g = goal(0, 0, 2, 0.05);
      g.yaw = facing(s.x - b.x);
      g.dress = 1;
      return g;
    }
    case 'file': {
      const g = seek(b, j.to.x, j.to.y, clamp(b.speed * 1.4, 1.4, 2.4), 30, 1.5);
      g.z = j.z;
      g.hide = t - j.ts > 0.8;
      return g;
    }
    case 'cache': {
      const g = dist(b, j.to) > 10 ? seek(b, j.to.x, j.to.y, 0.3, 20, 0.4) : goal(0, 0, 0.35, 0.03);
      // a hint: it stirs a little
      if (t < j.next - HINTS + 0.6 && t - j.ts > HINT - 1) g.tempo = 1.6;
      g.yaw = facing(j.dir);
      g.z = j.z;
      g.hide = true;
      return g;
    }
    case 'sort': {
      // it springs out toward us, back into the swimming plane, in its brightest colours
      const g = seek(b, (b.x + s.x) / 2, s.y - 20, clamp(b.speed * 1.2, 1.2, 2), 30, 1.7);
      g.z = 0;
      g.dress = 1;
      return g;
    }
    default: {
      // the gift: it stays by its treasure a moment, turned to us
      const x = j.at.x + (b.x < j.at.x ? -1 : 1) * (b.len * 0.5 + 24);
      const g = Math.hypot(x - b.x, j.at.y - 30 - b.y) > 16 ? seek(b, x, j.at.y - 30, cruise(b), 30) : goal(0, 0, 1.1, 0.04);
      if (!g.x) g.yaw = facing(s.x - b.x);
      g.z = 0;
      g.dress = 1;
      return g;
    }
  }
}

// The eggs as things of the water (docs/mecaniques.md, « La ponte » and « L'éclosion »): laid one by one where the
// parade closed, each a small soft ball. They drift with the water the dancers stir, keep together in their jelly
// as frogspawn does, bob, stretch a little as they move and round again when still. When they hatch, each in its
// turn trembles, stretches and splits in two, and a child swims out. Pure: ponte-jeu.ts lays them, draws them and
// makes the children.

import { STEP } from '../engine';

export interface Pt { x: number; y: number; }

/** the radius of an egg (px): big enough for a newborn curled inside */
export const EGG_R = 12;
/** seconds between two eggs laid */
export const LAY_GAP = 0.3;
/** seconds an egg takes to split once it begins, and its two halves to drift apart and fade */
export const CRACK = 0.55, SHELL = 1.3;
/** when each egg begins to split, from the moment the brood is decided (s): the chosen one first */
export const SPLIT = [0.1, 0.5, 0.75, 1.0];
/** how big a child is when it comes out of its egg (× its size), and the seconds it takes to grow to its size */
export const NEWBORN = 0.3, GROW_TIME = 7;

export interface Egg {
  x: number; y: number; vx: number; vy: number;
  r: number;
  /** its shape: how stretched it is (1: round), how fast that changes, and along which way */
  squash: number; sv: number; ang: number;
  /** seconds before it is laid (> 0), then its age */
  wait: number; age: number;
  /** its own rhythm */
  phase: number;
  /** when it begins to split (s from the hatching, Infinity: not hatching), how far it has split (0..1), and the time since it opened */
  at: number; crack: number; open: number;
}

export interface Eggs {
  list: Egg[];
  /** where they rest: the jelly keeps them around it */
  home: Pt;
  time: number;
  /** seconds since the hatching began, or -1 */
  hatch: number;
}

/** four eggs laid from `from` (between the two dancers), one after the other, to rest around `home` */
export function layEggs(from: Pt, home: Pt, n = 4, rnd: () => number = Math.random): Eggs {
  const list: Egg[] = [];
  const turn = rnd() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const u = turn + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.6;
    list.push({
      x: from.x, y: from.y, vx: Math.cos(u) * 1.3, vy: Math.sin(u) * 1.3,
      r: EGG_R * (0.92 + 0.16 * rnd()), squash: 1, sv: 0, ang: u,
      wait: i * LAY_GAP, age: 0, phase: rnd() * Math.PI * 2, at: Infinity, crack: 0, open: 0
    });
  }
  return { list, home: { ...home }, time: 0, hatch: -1 };
}

/** has this egg been laid */
export const laid = (e: Egg) => e.wait <= 0;
/** is it still there: laid and not yet faded away once open */
export const shown = (e: Egg) => laid(e) && e.open < SHELL;

/** the middle of the eggs laid, or their home */
export function middle(eg: Eggs): Pt {
  let x = 0, y = 0, n = 0;
  for (const e of eg.list) if (shown(e)) { x += e.x; y += e.y; n++; }
  return n ? { x: x / n, y: y / n } : { ...eg.home };
}

/** the hatching begins: the chosen egg first (-1: none chosen, in their order) */
export function hatchEggs(eg: Eggs, chosen = -1): void {
  if (eg.hatch >= 0) return;
  eg.hatch = 0;
  const order = eg.list.map((_, i) => i);
  if (chosen >= 0 && chosen < order.length) { order.splice(chosen, 1); order.unshift(chosen); }
  order.forEach((i, k) => { eg.list[i].at = SPLIT[Math.min(k, SPLIT.length - 1)]; });
}

/** every egg has opened and its shell faded: nothing is left */
export const gone = (eg: Eggs) => eg.hatch >= 0 && eg.list.every((e) => e.open >= SHELL);

/**
 * One step: the water carries them (`water`: its velocity at a point, px per step), the jelly keeps them together and
 * near their home, they bob, and stretch with their speed; `shake` (0..1) makes them tremble (we stay by them).
 * Returns the eggs that opened during this step (their index): a child comes out of each.
 */
export function stepEggs(eg: Eggs, water?: (x: number, y: number) => Pt, shake = 0, dt = STEP): number[] {
  eg.time += dt;
  if (eg.hatch >= 0) eg.hatch += dt;
  const list = eg.list, t = eg.time, opened: number[] = [];
  const free = (e: Egg) => laid(e) && e.open === 0;
  // the others, all from where they are now: never through one another, and held together by their jelly
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!free(e)) continue;
    for (let j = i + 1; j < list.length; j++) {
      const o = list[j];
      if (!free(o)) continue;
      const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01, touch = e.r + o.r, gap = d - touch;
      // pushed apart when they touch, drawn together a little farther, and no more beyond twice that
      const f = gap < 0 ? -gap * 0.05 : -gap * 0.004 * Math.max(0, 1 - gap / touch) ** 2;
      e.vx += (dx / d) * f; e.vy += (dy / d) * f;
      o.vx -= (dx / d) * f; o.vy -= (dy / d) * f;
    }
  }
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!laid(e)) {
      e.wait -= dt;
      continue;
    }
    e.age += dt;
    if (e.open > 0) { e.open += dt; continue; }
    // the water takes it along
    if (water) { const w = water(e.x, e.y); e.vx += (w.x - e.vx) * 0.06; e.vy += (w.y - e.vy) * 0.06; }
    // home, gently; a slow bob of its own
    e.vx += (eg.home.x - e.x) * 0.0012 + Math.cos(t * 0.9 + e.phase) * 0.002;
    e.vy += (eg.home.y - e.y) * 0.0012 + Math.sin(t * 1.3 + e.phase) * 0.004;
    e.vx *= 0.95; e.vy *= 0.95;
    e.x += e.vx; e.y += e.vy;
    // its shape: stretched along its way by its speed, trembling when we stay, stretching before it splits
    const sp = Math.hypot(e.vx, e.vy);
    if (e.at < Infinity && eg.hatch >= e.at) e.crack = Math.min(1, e.crack + dt / CRACK);
    const tremble = (shake * 0.1 + e.crack * 0.16) * Math.sin(t * 31 + e.phase * 3);
    const want = 1 + Math.min(0.28, sp * 0.14) + e.crack * 0.32 + tremble;
    e.sv = (e.sv + (want - e.squash) * 0.25) * 0.75;
    e.squash += e.sv;
    if (sp > 0.06 && e.crack === 0) e.ang += Math.atan2(Math.sin(Math.atan2(e.vy, e.vx) - e.ang), Math.cos(Math.atan2(e.vy, e.vx) - e.ang)) * 0.08;
    if (e.crack >= 1) { e.open = dt; opened.push(i); }
  }
  return opened;
}

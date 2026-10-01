// La danse à deux (docs/mecaniques.md, « La parade »): once the player has chosen to mate, the two dance on their
// own for a few seconds, and we watch: they turn around each other, coil, rise in a spiral, brush past, and end face
// to face, where the eggs are laid. Each dance strings a few figures drawn by chance among those the two bodies can
// do (a walker keeps to the floor, a bell drifts slowly), so that no two are quite alike. Pure: positions in, wished
// velocities out; the game drives both bodies (parade-jeu.ts).

import { STEP, clamp } from '../engine';

export interface Pt { x: number; y: number }

/** how a body dances: swims freely, walks on the floor, or drifts like a bell */
export type Style = 'swim' | 'walk' | 'drift';
export type Figure = 'tour' | 'halo' | 'enroule' | 'spirale' | 'frole' | 'balance' | 'face';

export const styleOf = (mode: string, floor: boolean): Style =>
  floor || mode === 'crawl' ? 'walk' : mode === 'bell' || mode === 'pulse' ? 'drift' : 'swim';

/** the figures between the opening and the last one, and how much each pair of styles likes them (0: cannot) */
const MIDDLE: Record<'enroule' | 'spirale' | 'frole' | 'balance' | 'tour', (walk: number, drift: number) => number> = {
  tour: (w) => (w === 1 ? 0.5 : 0),
  enroule: (w, d) => (w === 2 ? 0.6 : 1 + 0.3 * d),
  spirale: (w, d) => (w ? 0 : 1.2 + 0.4 * d),
  frole: (w) => (w === 1 ? 0.8 : 1),
  balance: (w) => (w === 2 ? 1.3 : 0.6)
};
/** figures in the middle of a dance */
export const MIDDLE_COUNT = 2;
/** the first figure eases in from where the two were, the others from the end of the one before (s) */
const BLEND_IN = 0.9, BLEND = 0.8;
/** the highest a dance with a spiral climbs */
export const RISE = 110;
/** the fastest a dancer goes (px per step) */
const MAX: Record<Style, number> = { swim: 3, walk: 2.2, drift: 2.1 };

interface Step { fig: Figure; t0: number; t1: number; turn: 1 | -1; ang: number; rise: number; }

export interface Danse {
  /** where the dance is centred at its start (the walker, when only one walks) */
  c: Pt;
  /** its radius, from the sizes of the two */
  r: number;
  styles: [Style, Style];
  /** in a dance of a walker and a swimmer, which one walks (0: the partner, 1: the swimmer), else -1 */
  walker: -1 | 0 | 1;
  /** where the two were, from the centre, when it began */
  a0: Pt; b0: Pt;
  steps: Step[];
  /** its length (s) */
  time: number;
}

const ease = (u: number) => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

function pick<T extends string>(w: Record<T, number>, R: () => number): T | null {
  const keys = (Object.keys(w) as T[]).filter((k) => w[k] > 0);
  let s = 0;
  for (const k of keys) s += w[k];
  let r = R() * s;
  for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
  return keys[keys.length - 1] ?? null;
}

/**
 * A dance for two: a (the partner) and b (the swimmer) where they are now, their styles, and the length of their
 * bodies. An opening (they turn around each other, or the swimmer around the walker), a few figures drawn by chance,
 * then face to face.
 */
export function newDanse(a: Pt, b: Pt, styles: [Style, Style], size: number, R: () => number = Math.random): Danse {
  const walk = styles.filter((s) => s === 'walk').length, drift = styles.filter((s) => s === 'drift').length;
  const walker: -1 | 0 | 1 = walk === 1 ? (styles[0] === 'walk' ? 0 : 1) : -1;
  const c = walker === 0 ? { ...a } : walker === 1 ? { ...b } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const r = clamp(size * 0.8 + 45, 70, 150);
  const a0 = { x: a.x - c.x, y: a.y - c.y }, b0 = { x: b.x - c.x, y: b.y - c.y };
  const slow = drift ? 1.15 : walk === 2 ? 1.2 : 1;
  const figs: Figure[] = [walker >= 0 ? 'halo' : 'tour'];
  const w = {} as Record<keyof typeof MIDDLE, number>;
  for (const k of Object.keys(MIDDLE) as (keyof typeof MIDDLE)[]) w[k] = MIDDLE[k](walk, drift);
  for (let i = 0; i < MIDDLE_COUNT; i++) {
    const f = pick(w, R);
    if (!f) break;
    figs.push(f); w[f] = 0;
  }
  figs.push('face');
  const first: 1 | -1 = R() < 0.5 ? 1 : -1;
  const steps: Step[] = [];
  let t = 0, ang = Math.atan2(a0.y, a0.x || 1e-6), rise = 0;
  for (const fig of figs) {
    const len = (fig === 'face' ? 2.2 : 1.9 + R() * 0.5) * slow;
    const turn: 1 | -1 = R() < 0.25 ? (-first as 1 | -1) : first;
    const st: Step = { fig, t0: t, t1: t + len, turn, ang, rise };
    steps.push(st);
    ang = endAngle(st, walker, walker === 0 ? b0 : a0);
    if (fig === 'spirale') rise += RISE * (0.65 + 0.35 * R());
    t += len;
  }
  return { c, r, styles, walker, a0, b0, steps, time: t };
}

/** the angle of the partner around the centre at the end of a figure (the next one starts from there); after the
 * halo, the swimmer is on the other side of the walker, above it */
function endAngle(s: Step, walker: number, swimmer: Pt): number {
  const side = swimmer.x >= 0 ? 1 : -1;
  switch (s.fig) {
    case 'tour': return s.ang + s.turn * Math.PI;
    case 'halo': return walker === 1 ? Math.atan2(-0.5, -side) : Math.atan2(0.5, side);
    case 'enroule': return s.ang + s.turn * Math.PI * 1.5;
    case 'spirale': return s.ang + s.turn * Math.PI * 1.5;
    case 'frole': return s.ang + Math.PI;
    default: return s.ang;
  }
}

/** where the two are in a figure, from its centre (before the walker is put back on the floor), u from 0 to 1 */
function inFigure(d: Danse, s: Step, u: number): { a: Pt; b: Pt; rise: number } {
  const R = d.r, flat = d.styles[0] === 'walk' && d.styles[1] === 'walk' ? 0.12 : 0.55, e = ease(u);
  let a: Pt, b: Pt | null = null, rise = s.rise;
  switch (s.fig) {
    case 'tour': {
      const t = s.ang + s.turn * Math.PI * e;
      a = { x: R * Math.cos(t), y: R * flat * Math.sin(t) };
      break;
    }
    case 'enroule': {
      // closer and closer, faster and faster: they wind around each other
      const t = s.ang + s.turn * Math.PI * 1.5 * (u * u * 0.5 + e * 0.5), rho = R * (1 - 0.6 * e);
      a = { x: rho * Math.cos(t), y: rho * flat * 1.1 * Math.sin(t) };
      break;
    }
    case 'spirale': {
      const t = s.ang + s.turn * Math.PI * 1.5 * e, rho = R * 0.62;
      a = { x: rho * Math.cos(t), y: rho * 0.45 * Math.sin(t) };
      rise = s.rise + RISE * 0.82 * e;
      break;
    }
    case 'frole': {
      // they swap places, brushing past each other on the way
      const ax = Math.cos(s.ang), ay = Math.sin(s.ang) * flat, px = -ay, py = ax;
      const along = R * (1 - 2 * e), gap = R * (0.1 + 0.16 * Math.sin(Math.PI * u));
      a = { x: ax * along + px * gap, y: ay * along + py * gap };
      b = { x: -ax * along - px * gap, y: -ay * along - py * gap };
      break;
    }
    case 'balance': {
      // side by side, rocking: up and down in turn, or for two walkers, one step aside together
      const side = Math.cos(s.ang) >= 0 ? 1 : -1, w = Math.sin(Math.PI * 2 * 1.5 * u) * (1 - 0.3 * u);
      if (flat < 0.5) { a = { x: side * R * 0.42 + w * R * 0.22, y: 0 }; b = { x: -side * R * 0.42 + w * R * 0.22, y: 0 }; }
      else { a = { x: side * R * 0.45, y: w * R * 0.28 }; b = { x: -side * R * 0.45, y: -w * R * 0.28 }; }
      break;
    }
    case 'halo': {
      // the swimmer arches over the walker from its side to the other, the walker turns on the spot
      const from = d.walker === 0 ? d.b0 : d.a0, side = from.x >= 0 ? 1 : -1, t = Math.PI / 2 - side * Math.PI * (0.35 - 0.7 * e);
      const swim = { x: R * Math.cos(t), y: -R * 0.35 - R * 0.55 * Math.sin(t) }, walk = { x: Math.sin(Math.PI * 2 * u) * R * 0.12, y: 0 };
      return d.walker === 0 ? { a: walk, b: swim, rise } : { a: swim, b: walk, rise };
    }
    default: {
      // face to face, closer and closer, nodding to each other
      const side = Math.cos(s.ang) >= 0 ? 1 : -1, gap = R * (0.75 - 0.42 * e), bob = Math.sin(Math.PI * 2 * u) * R * 0.06;
      a = { x: side * gap, y: bob };
      b = { x: -side * gap, y: -bob };
    }
  }
  return { a, b: b ?? { x: -a.x, y: -a.y }, rise };
}

/** where the two dancers want to be at time s of the dance, and the centre (that rises with a spiral) */
export function pose(d: Danse, s: number): { a: Pt; b: Pt; c: Pt } {
  const t = clamp(s, 0, d.time);
  let i = d.steps.findIndex((st) => t < st.t1);
  if (i < 0) i = d.steps.length - 1;
  const st = d.steps[i], u = (t - st.t0) / (st.t1 - st.t0);
  let { a, b, rise } = inFigure(d, st, u);
  // ease in from where they were: the start, or the end of the figure before
  const span = i ? BLEND : BLEND_IN, k = ease((t - st.t0) / span);
  if (k < 1) {
    const from = i ? inFigure(d, d.steps[i - 1], 1) : { a: d.a0, b: d.b0, rise: 0 };
    a = lerp(from.a, a, k); b = lerp(from.b, b, k); rise = from.rise + (rise - from.rise) * k;
  }
  // with one walker, it keeps to the floor where the dance began, steps less far, and the swimmer keeps above it
  if (d.walker === 0) { a = { x: a.x * 0.5, y: 0 }; b = { x: b.x, y: Math.min(b.y, -d.r * 0.3) }; }
  else if (d.walker === 1) { b = { x: b.x * 0.5, y: 0 }; a = { x: a.x, y: Math.min(a.y, -d.r * 0.3) }; }
  const c = { x: d.c.x, y: d.c.y - (d.walker >= 0 ? 0 : rise) };
  return { a: { x: c.x + a.x, y: c.y + a.y }, b: { x: c.x + b.x, y: c.y + b.y }, c };
}

/** the figures of a dance, in order (tests, captures) */
export const figuresOf = (d: Danse): Figure[] => d.steps.map((s) => s.fig);

/** the dance is over: the eggs are laid between the two */
export const over = (d: Danse, s: number) => s >= d.time;

/**
 * The velocities the two dancers steer toward at time s, from where they are: they go with their place in the dance
 * and catch up with it, never faster than their style allows. keep: where each (0: the partner, 1: the swimmer) may
 * go instead of a place (in the water, on the floor for a walker).
 */
export function wished(d: Danse, s: number, a: Pt, b: Pt, keep: (p: Pt, who: 0 | 1) => Pt = (p) => p): { a: Pt; b: Pt } {
  const now = pose(d, s), next = pose(d, s + STEP);
  now.a = keep(now.a, 0); now.b = keep(now.b, 1); next.a = keep(next.a, 0); next.b = keep(next.b, 1);
  const go = (from: Pt, to: Pt, ahead: Pt, max: number): Pt => {
    let x = ahead.x - to.x + (to.x - from.x) * 0.12, y = ahead.y - to.y + (to.y - from.y) * 0.12;
    const v = Math.hypot(x, y);
    if (v > max) { x *= max / v; y *= max / v; }
    return { x, y };
  };
  return { a: go(a, now.a, next.a, MAX[d.styles[0]]), b: go(b, now.b, next.b, MAX[d.styles[1]]) };
}

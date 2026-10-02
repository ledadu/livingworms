// La danse à deux (docs/mecaniques.md, « La parade »): once the player has chosen to mate, the two dance on their
// own for a few seconds, and we watch: they turn around each other, coil, rise in a spiral, brush past, dance one or
// two real dances (the twist, the crab step, a waltz… engine3/dance.ts) and end face to face, where the eggs are laid.
// Each dance strings a few figures drawn by chance among those the two bodies can do (a walker keeps to the floor, a
// bell drifts slowly), never the same as the time before. Pure: positions in, wished velocities out; the game drives
// both bodies and plays the steps of the real dances on them (parade-jeu.ts).

import { STEP, clamp } from '../engine';
import { DANCES, DANCE_IDS, type DanceId } from '../engine3/dance';

export interface Pt { x: number; y: number }

/** how a body dances: swims freely, walks on the floor, or drifts like a bell */
export type Style = 'swim' | 'walk' | 'drift';
/** the rounds, the last figure (face to face), and a real dance (which one: Step.dance) */
export type Figure = 'tour' | 'halo' | 'enroule' | 'spirale' | 'frole' | 'balance' | 'face' | 'danse';

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
/** a beat (s) when the music gives none */
export const BEAT = 0.55;
/** the tempo of the dances: a beat between these (s) */
export const BEATS: [number, number] = [0.42, 0.72];

/** the beat of the dances on the music of a chapter whose notes go `step` s apart (musique.ts, motif.step): that pace
 * taken two, three or four times, or divided as much, whichever is nearest to a dance's (BEAT), within BEATS */
export function beatOf(step: number): number {
  let best = step;
  for (const k of [1 / 4, 1 / 3, 1 / 2, 2, 3, 4]) {
    const b = step * k;
    if (Math.abs(Math.log(b / BEAT)) < Math.abs(Math.log(best / BEAT))) best = b;
  }
  return clamp(best, BEATS[0], BEATS[1]);
}
/** the longest a dance for two with two real dances may last (s): longer, it keeps one */
export const LONGEST = 16.5;
/** the bars a waltz takes to turn once */
const WALTZ_BARS = 3;

interface Step { fig: Figure; t0: number; t1: number; turn: 1 | -1; ang: number; rise: number; dance?: DanceId }

export interface DanseOptions {
  /** the length of a beat (s): the tempo of the chapter's music */
  beat?: number;
  /** the dance before (signature): this one is not the same */
  last?: string | null;
  /** the real dances to dance, in this order (tests, captures) */
  dances?: DanceId[];
}

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
  /** its length (s), and the length of a beat of its real dances (s) */
  time: number; beat: number;
}

const ease = (u: number) => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

const soft = (u: number) => { const k = clamp(u, 0, 1); return k - Math.sin(2 * Math.PI * k) / (2 * Math.PI); };

function pick<T extends string>(w: Record<T, number>, R: () => number): T | null {
  const keys = (Object.keys(w) as T[]).filter((k) => w[k] > 0);
  let s = 0;
  for (const k of keys) s += w[k];
  let r = R() * s;
  for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
  return keys[keys.length - 1] ?? null;
}

/**
 * The figures between the opening and the last one: one or two real dances drawn by how much the two bodies like
 * them (the dances of the time before less often), and with only one, a round of before once in a while, before or
 * after it.
 */
function middle(walk: number, drift: number, R: () => number, before: string[], forced?: DanceId[]): (Figure | DanceId)[] {
  const likes = {} as Record<DanceId, number>;
  for (const id of DANCE_IDS) likes[id] = DANCES[id].likes(walk, drift) * (before.includes(id) ? 0.25 : 1);
  const dances: DanceId[] = forced ? [...forced] : [];
  if (!forced) for (let i = 0, n = R() < 0.45 ? 2 : 1; i < n; i++) {
    const d = pick(likes, R);
    if (!d) break;
    dances.push(d); likes[d] = 0;
  }
  if (dances.length > 1 || R() >= 0.6) return dances;
  const w = {} as Record<keyof typeof MIDDLE, number>;
  for (const k of Object.keys(MIDDLE) as (keyof typeof MIDDLE)[]) w[k] = MIDDLE[k](walk, drift);
  const f = pick(w, R);
  return !f ? dances : R() < 0.5 ? [f, ...dances] : [...dances, f];
}

/**
 * A dance for two: a (the partner) and b (the swimmer) where they are now, their styles, and the length of their
 * bodies. An opening (they turn around each other, or the swimmer around the walker), one or two real dances and
 * maybe one more round, then face to face. Never the same as the one before (o.last).
 */
export function newDanse(a: Pt, b: Pt, styles: [Style, Style], size: number, R: () => number = Math.random, o: DanseOptions = {}): Danse {
  const walk = styles.filter((s) => s === 'walk').length, drift = styles.filter((s) => s === 'drift').length;
  const walker: -1 | 0 | 1 = walk === 1 ? (styles[0] === 'walk' ? 0 : 1) : -1;
  const c = walker === 0 ? { ...a } : walker === 1 ? { ...b } : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const r = clamp(size * 0.8 + 45, 70, 150);
  const a0 = { x: a.x - c.x, y: a.y - c.y }, b0 = { x: b.x - c.x, y: b.y - c.y };
  const slow = drift ? 1.15 : walk === 2 ? 1.2 : 1, beat = o.beat ?? BEAT, before = o.last?.split(' ') ?? [];
  let d: Danse | null = null;
  for (let tries = 0; tries < 12 && (!d || (!o.dances && signature(d) === o.last)); tries++) {
    let figs: (Figure | DanceId)[] = [walker >= 0 ? 'halo' : 'tour', ...middle(walk, drift, R, before, o.dances), 'face'];
    const first: 1 | -1 = R() < 0.5 ? 1 : -1;
    for (let pass = 0; pass < 2; pass++) {
      const steps: Step[] = [];
      let t = 0, ang = Math.atan2(a0.y, a0.x || 1e-6), rise = 0;
      for (const f of figs) {
        const dance = f in DANCES ? (f as DanceId) : undefined, fig: Figure = dance ? 'danse' : (f as Figure);
        const len = dance ? DANCES[dance].beats * beat : (fig === 'face' ? 2.2 : 1.9 + R() * 0.5) * slow;
        const turn: 1 | -1 = R() < 0.25 ? (-first as 1 | -1) : first;
        const st: Step = { fig, t0: t, t1: t + len, turn, ang, rise, dance };
        steps.push(st);
        ang = endAngle(st, walker, walker === 0 ? b0 : a0, beat);
        if (fig === 'spirale') rise += RISE * (0.65 + 0.35 * R());
        t += len;
      }
      d = { c, r, styles, walker, a0, b0, steps, time: t, beat };
      // two real dances that would go on too long: one only
      const ds = figs.filter((f) => f in DANCES);
      if (o.dances || ds.length < 2 || t <= LONGEST) break;
      figs = figs.filter((f) => f !== ds[1]);
    }
  }
  return d!;
}

/** how many times a waltz turns (once every few bars) */
const turnsOf = (s: Step, beat: number) => (s.t1 - s.t0) / beat / (DANCES[s.dance!].bar * WALTZ_BARS);

/** the angle of the partner around the centre at the end of a figure (the next one starts from there); after the
 * halo, the swimmer is on the other side of the walker, above it */
function endAngle(s: Step, walker: number, swimmer: Pt, beat: number): number {
  const side = swimmer.x >= 0 ? 1 : -1;
  switch (s.fig) {
    case 'danse': return DANCES[s.dance!].floor === 'turn' ? s.ang + s.turn * 2 * Math.PI * turnsOf(s, beat) : s.ang;
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
    case 'danse': {
      const dc = DANCES[s.dance!];
      if (dc.floor === 'turn') {
        // close, turning about each other, once every few bars
        const t = s.ang + s.turn * 2 * Math.PI * turnsOf(s, d.beat) * soft(u), rho = R * 0.45;
        a = { x: rho * Math.cos(t), y: rho * flat * Math.sin(t) };
      } else {
        // face to face (close for a tango), coming closer over the first bar, then dancing where they are
        const side = Math.cos(s.ang) >= 0 ? 1 : -1, gap = R * ((dc.floor === 'close' ? 0.3 : 0.62) + 0.3 * (1 - ease((u * dc.beats) / dc.bar)));
        a = { x: side * gap, y: 0 };
      }
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

/** the figures of a dance, in order, a real dance by its name (tests, captures) */
export const figuresOf = (d: Danse): (Figure | DanceId)[] => d.steps.map((s) => s.dance ?? s.fig);
/** the figures of a dance in one string: the next one is never the same */
export const signature = (d: Danse): string => figuresOf(d).join(' ');

/** the figure at time s of the dance */
export function stepAt(d: Danse, s: number): Step {
  const i = d.steps.findIndex((st) => s < st.t1);
  return d.steps[i < 0 ? d.steps.length - 1 : i];
}

/** at time s, the real dance being danced and when it began, or null */
export function danceAt(d: Danse, s: number): { id: DanceId; t0: number } | null {
  const st = stepAt(d, s);
  return st.dance ? { id: st.dance, t0: st.t0 } : null;
}

/** the gap across under which two dancers, one above the other, need not turn to each other (px) */
const ABOVE = 12;

/** in a real dance face to face, once begun (after its blend), the two where they are: the way each faces (1: right),
 * toward the other; else null */
export function facing(d: Danse, s: number, a: Pt, b: Pt): { a: 1 | -1; b: 1 | -1 } | null {
  const st = stepAt(d, s);
  if (!st.dance || DANCES[st.dance].floor === 'turn' || s - st.t0 < BLEND || Math.abs(b.x - a.x) < ABOVE) return null;
  const right = b.x > a.x;
  return { a: right ? 1 : -1, b: right ? -1 : 1 };
}

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
  const va = go(a, now.a, next.a, MAX[d.styles[0]]), vb = go(b, now.b, next.b, MAX[d.styles[1]]);
  // in a real dance face to face, neither is told to go away from the other: it would turn its back on it
  const f = facing(d, s, a, b);
  if (f) {
    if (va.x * f.a < 0) va.x = 0;
    if (vb.x * f.b < 0) vb.x = 0;
  }
  return { a: va, b: vb };
}

// The dance engine (docs/mecaniques.md, « Les danses »): steps described once on what every body has, and dances
// made of them. A step moves the trunk (wiggle, undulate, arch, curl up), the head (nod, shake, look at us), the tail
// (wag, beat time), the limbs by kind and side (lift, flap, the wave from front to back, left and right in turn,
// point) or the whole body (bounce, sway, slide, pivot, spin). What a body lacks it skips or does its own way: a
// jellyfish with no legs waves its threads, a worm with no limbs wiggles harder, a bell sways where a trunk would bend.
// A dance strings steps on a beat, with strong beats, gestures mirrored or in canon between two dancers (one does,
// the other answers), and a last pose. Pure: a few numbers per step into the groove of a creature (groove.ts), that
// its swim reads (creature3.ts); no simulation of its own.

import { clamp } from '../engine/util';
import type { Creature3 } from './creature3';
import { ARM, FEELER, FIN, FRILL, LEG, LIMBS, ROW, THREAD, TRUNK, clearGroove, slot, type Groove } from './groove';

const TAU = Math.PI * 2;

// ----- what a body has ----- //

export interface Kit {
  /** the length of each kind of limb, all its copies together (px); 0: it has none */
  limbs: number[];
  /** the length of the trunk (px), and how far it bends (stiff 0.25 to supple 1.2) */
  trunk: number; bendy: number;
  /** a bell (it sways where a trunk would bend), a walker (it dances on the floor) */
  bell: boolean; walker: boolean;
  /** which way it faces now: 1 right, -1 left (kept up to date by whoever plays the dance) */
  face: number;
}

export function kitOf(cr: Creature3): Kit {
  const limbs = LIMBS.map(() => 0), r = cr.root, sw = cr.spec.swim;
  for (const s of cr.list) if (s.limb >= 0) limbs[s.limb] += s.len * s.n;
  // (a supple walker lies on the floor: it bends less, or it would stand on its tail and tie itself in knots)
  const walker = sw.mode === 'crawl' || !!sw.walk, bendy = clamp(r.def.flex * 3.2, 0.35, 1.2) * (sw.mode === 'crawl' ? 0.7 : 1);
  return { limbs, trunk: r.len * r.n, bendy, bell: sw.mode === 'bell', walker, face: Math.cos(cr.yaw) < 0 ? -1 : 1 };
}

/** the kind of limb that does a step wanting these, in this order: the first the body shows enough of, else the
 * largest it has of them; -1: none, the trunk does the step instead */
export function pick(k: Kit, want: readonly number[]): number {
  let best = -1;
  for (const l of want) {
    if (k.limbs[l] >= k.trunk * 0.3) return l;
    if (k.limbs[l] > 0 && (best < 0 || k.limbs[l] > k.limbs[best])) best = l;
  }
  return best;
}

/** limbs to lift, to beat like wings, to make a wave along, to point and clap with, to step with */
const ANY = [ARM, FIN, LEG, THREAD, FEELER, FRILL], WINGS = [FIN, ARM, THREAD, FRILL, LEG];
const ROWS = [LEG, FIN, THREAD, ARM, FRILL], HANDS = [ARM, FIN, FEELER, LEG, THREAD, FRILL], FEET = [LEG, FIN, THREAD, ARM, FRILL];
const FEELERS = [FEELER, ARM, FIN, THREAD, FRILL];

// ----- the steps ----- //

/** what a step writes into: the groove, the body, how much (the blend of the steps, the dance's own weight) and its
 * side (-1: mirrored, the other side and the other way) */
interface Ctx { g: Groove; k: Kit; w: number; m: number }
const ctx: Ctx = { g: null as unknown as Groove, k: null as unknown as Kit, w: 0, m: 1 };

const ease = (u: number) => { const k = clamp(u, 0, 1); return k * k * (3 - 2 * k); };
/** a soft stroke on each beat: 1 on it, 0 between */
const hit = (b: number) => { const c = 0.5 + 0.5 * Math.cos(TAU * b); return c * c * c; };
/** up between the beats, down on them (0..1) */
const hop = (b: number) => Math.abs(Math.sin(Math.PI * b));
/** turned on the first beat of four, back on the third */
const turned = (b: number, sharp: number) => { const f = ((b % 4) + 4) % 4; return f < 2 ? ease(f * sharp) : 1 - ease((f - 2) * sharp); };
/** the walk of a tango over a step: slow, slow, quick, quick, and still */
const tangoWalk = (u: number) => { const b = u * 4; return b < 2 ? ease(b / 2) * 0.5 : b < 3 ? 0.5 + ease((b - 2) * 2) * 0.25 + (b > 2.5 ? ease((b - 2.5) * 2) * 0.25 : 0) : 1; };

function bend(c: Ctx, f: (u: number) => number): void {
  const k = c.w * c.k.bendy;
  for (let p = 0; p < TRUNK; p++) c.g.bend[p] += k * f(p / (TRUNK - 1));
}

/** pitch (+: nose down), yaw and roll, the last two the other way for a mirrored dancer */
function head(c: Ctx, pitch: number, yaw: number, roll: number): void {
  c.g.pitch += c.w * pitch; c.g.yaw += c.w * c.m * yaw; c.g.roll += c.w * c.m * roll;
}

function shift(c: Ctx, x: number, y: number): void { c.g.x += c.w * c.m * x; c.g.y += c.w * y; }

/** how far each kind of limb goes for the same step: stiff legs a little less, arms and feelers more */
const REACH = [1, 0.8, 1.35, 1.15, 1.3, 1];

/** the limbs fore and aft, or up: f(side, place in the row) for the kind of limb picked; returns it (-1: none) */
function limbs(c: Ctx, into: Float32Array, want: readonly number[], f: (s: number, v: number) => number): number {
  const l = pick(c.k, want);
  if (l < 0) return l;
  const w = c.w * REACH[l];
  for (let s = 0; s < 2; s++) {
    const o = slot(l, c.m < 0 ? 1 - s : s, 0);
    for (let p = 0; p < ROW; p++) into[o + p] += w * f(s, p / (ROW - 1));
  }
  return l;
}
const swing = (c: Ctx, want: readonly number[], f: (s: number, v: number) => number) => limbs(c, c.g.swing, want, f);
const raise = (c: Ctx, want: readonly number[], f: (s: number, v: number) => number) => limbs(c, c.g.raise, want, f);
function curl(c: Ctx, l: number, s: number, v: number): void { if (l >= 0) c.g.curl[l * 2 + (c.m < 0 ? 1 - s : s)] += c.w * v; }

/** a wave down the trunk: amp (rad over the body), freq (a beat), waves along the body, toward the tail (0: even,
 * 1: the tail only); a bell sways instead */
function wave(c: Ctx, amp: number, freq: number, waves: number, b: number, tail: number): void {
  if (c.k.bell) { head(c, 0.1 * amp * Math.sin(TAU * freq * b), 0, 0); return; }
  bend(c, (u) => amp * Math.sin(TAU * (freq * b - waves * u)) * (1 - tail + tail * 2 * u));
}

/** a step: into the groove at beat b of the dance, u through the step (0..1), with its two numbers (a slide from, to) */
type Move = (c: Ctx, b: number, u: number, p0: number, p1: number) => void;

export const MOVES = {
  // the trunk: wiggle, undulate, arch the back, curl up in a ball; the tail: wag, beat time
  wiggle: (c, b) => wave(c, 1.3, 2, 1.1, b, 0.4),
  undulate: (c, b) => { wave(c, 1.1, 0.5, 1, b, 0); shift(c, 0, 5 * Math.sin(TAU * b * 0.5)); },
  arch: (c, b) => { bend(c, () => -0.9 - 0.2 * hit(b)); head(c, -0.25, 0, 0); },
  ball: (c, b) => { bend(c, () => 3.6 + 0.3 * hit(b)); head(c, 0.3, 0, 0); },
  wag: (c, b) => wave(c, 1.5, 2, 0.8, b, 1),
  tap: (c, b) => { if (c.k.bell) head(c, 0.25 * hit(b), 0, 0); else bend(c, (u) => 1.6 * u * u * hit(b)); },
  // the head: nod, shake, look at us
  nod: (c, b) => head(c, 0.42 * hit(b), 0, 0),
  shake: (c, b) => { const s = Math.sin(TAU * 2 * b); head(c, 0, 0.35 * s, 0.15 * s); },
  look: (c, _b, u) => head(c, 0, -c.k.face * c.m * 1.1 * ease(u * 3), 0),
  // the limbs: lift, flap, the wave from front to back, left and right in turn, point up then down, clap, peck, step
  lift: (c, b) => { if (raise(c, ANY, () => 0.9 + 0.15 * hit(b)) < 0) bend(c, () => -0.8); },
  flap: (c, b) => { if (swing(c, WINGS, () => 0.7 * Math.sin(TAU * 2 * b)) < 0) wave(c, 1.8, 2, 1, b, 0.5); },
  ola: (c, b) => {
    const at = (v: number) => Math.sin(TAU * (b * 0.5 - v * 0.9)), l = swing(c, ROWS, (_s, v) => 0.75 * at(v));
    if (l >= 0) raise(c, [l], (_s, v) => 0.5 * Math.max(0, at(v)));
    else wave(c, 1.4, 0.5, 1, b, 0);
  },
  alternate: (c, b) => {
    const s = Math.sin(Math.PI * b);
    if (raise(c, ANY, (side) => 0.95 * Math.max(0, side ? s : -s)) < 0) bend(c, (u) => 1.2 * s * (u - 0.3));
    head(c, 0, 0, 0.18 * s);
  },
  point: (c, b) => {
    const q = Math.cos((Math.PI * b) / 2), l = raise(c, HANDS, (s) => (s ? 0.35 + 1.05 * q : -0.15));
    curl(c, l, 0, 1);
    if (l < 0) bend(c, (u) => -1 * q * (1 - u));
    head(c, -0.2 * q, 0, 0.25 * q);
  },
  star: (c, _b, u) => {
    const k = ease(u * 3), l = raise(c, HANDS, (s) => (s ? 1.4 : -0.2) * k);
    curl(c, l, 0, k);
    if (l < 0) bend(c, () => -0.9 * k);
    head(c, -0.2 * k, 0, 0.25 * k);
  },
  clap: (c, b) => {
    const l = swing(c, HANDS, () => 0.55 * Math.sin(TAU * 2 * b));
    if (l >= 0) raise(c, [l], () => 0.4); else wave(c, 1.6, 2, 1, b, 0.5);
  },
  beak: (c, b) => {
    if (swing(c, FEELERS, () => 0.5 * hit(2 * b)) < 0) bend(c, (u) => 1 * hit(2 * b) * (1 - u));
    head(c, 0.25 * hit(2 * b), 0, 0);
  },
  steps: (c, b) => {
    const s = Math.sin(TAU * b), l = swing(c, FEET, (side) => (side ? 0.55 : -0.55) * s);
    if (l === LEG) raise(c, [LEG], (side) => 0.25 * Math.max(0, side ? s : -s));
    if (l < 0) wave(c, 1.1, 2, 1, b, 0.3);
    shift(c, 0, -2.5 * hop(2 * b));
  },
  // the whole body: bounce, sway from side to side, pivot to face us, spin, slide aside, glide back, go low, rise
  bounce: (c, b) => { shift(c, 0, -12 * hop(b)); if (c.k.walker) raise(c, [LEG], () => -0.35 * hop(b)); },
  sway: (c, b) => { const s = Math.sin(Math.PI * b); shift(c, 11 * s, 0); head(c, 0, 0.12 * s, 0.3 * s); bend(c, (u) => 0.5 * s * (u - 0.5)); },
  pivot: (c, b) => head(c, 0, -c.k.face * c.m * 1.2 * turned(b, 3), 0),
  spin: (c, _b, u) => {
    // all the way round, done a little before the end of the step (a whole turn is no turn: nothing jumps)
    const a = u < 0.85 ? TAU * ease(u / 0.85) : 0;
    if (c.k.bell) head(c, a, 0, 0); else head(c, 0, c.k.face * a, 0);
  },
  slide: (c, _b, u, p0, p1) => shift(c, 46 * (p0 + (p1 - p0) * ease(u)), 0),
  back: (c, _b, u, p0, p1) => shift(c, -c.k.face * c.m * 52 * (p0 + (p1 - p0) * (0.6 * u + 0.4 * ease(u))), 0),
  promenade: (c, b, u, p0, p1) => { shift(c, 40 * (p0 + (p1 - p0) * tangoWalk(u)), 0); head(c, 0.08 * hit(b), 0, 0); },
  low: (c, _b, u) => { shift(c, 0, 16 * Math.sin(Math.PI * clamp(u, 0, 1))); raise(c, HANDS, () => 0.5 * Math.sin(Math.PI * clamp(u, 0, 1))); },
  toe: (c, _b, u) => { const k = ease(u * 3); head(c, -0.35 * k, 0, 0); shift(c, 0, -8 * k); raise(c, FEET, () => -0.3 * k); },
  // dances of their own: the twist of the hips, the one-two-three of a waltz, the tango's head, lean and dip, a bow
  twist: (c, b) => {
    const s = Math.sin(Math.PI * b), l = swing(c, HANDS, () => -0.45 * s);
    if (l >= 0) raise(c, [l], () => 0.35);
    head(c, 0, 0.2 * s, 0.4 * s);
  },
  waltz: (c, b) => {
    const f = ((b % 3) + 3) % 3 / 3, q = 0.5 + 0.5 * Math.cos(TAU * f);
    shift(c, 0, 9 * q * q - 3);
    head(c, 0.1 * q, 0, 0.22 * Math.sin((TAU * b) / 6));
    raise(c, HANDS, () => 0.45);
  },
  snap: (c, b) => head(c, 0, -c.k.face * c.m * 0.9 * turned(b, 6), 0),
  lean: (c, _b, u) => { const k = ease(u * 2); head(c, 0.45 * k, 0, 0); bend(c, () => 0.5 * k); },
  dip: (c, _b, u) => { const k = ease(u * 2); head(c, -0.95 * k, 0, 0); bend(c, () => -1.2 * k); raise(c, ANY, () => 0.7 * k); shift(c, 0, 10 * k); },
  bow: (c, _b, u) => { const k = ease(u * 2.5); head(c, 0.6 * k, 0, 0); bend(c, () => 0.45 * k); raise(c, ANY, () => -0.35 * k); }
} satisfies Record<string, Move>;

export type MoveId = keyof typeof MOVES;

// ----- the dances ----- //

/** a step and how much (1), with its two numbers (a slide: from, to, in steps aside) */
export type Call = [MoveId, number?, number?, number?];
/** what the second dancer does in a bar: the same, mirrored, the first's steps some beats later, or its own */
export type Answer = 'same' | 'mirror' | { canon: number } | Call[];
export interface Bar { n: number; a: Call[]; b?: Answer }
export type DanceId = 'twist' | 'vague' | 'crabe' | 'moonwalk' | 'tango' | 'valse' | 'disco' | 'canards' | 'salut';

export interface Choreo {
  id: DanceId; name: string;
  /** beats to the bar */
  bar: 3 | 4;
  /** where the two stand: face to face, close together, or turning about each other */
  floor: 'face' | 'close' | 'turn';
  /** the bars, the last one the pose it ends on */
  steps: Bar[];
  /** how much two bodies like it, from how many of them walk and drift (0: never) */
  likes(walk: number, drift: number): number;
  /** its length in beats, and where each bar starts */
  beats: number; at: number[];
}

function dance(c: Omit<Choreo, 'beats' | 'at'>): Choreo {
  const at: number[] = [];
  let t = 0;
  for (const s of c.steps) { at.push(t); t += s.n; }
  return { ...c, beats: t, at };
}

export const DANCES: Record<DanceId, Choreo> = {
  // the hips one way, the arms the other, down low and back up, then arms up
  twist: dance({
    id: 'twist', name: 'Le twist', bar: 4, floor: 'face', likes: (w, d) => (d ? 0.5 : w ? 0.6 : 1),
    steps: [
      { n: 4, a: [['wiggle'], ['twist']], b: 'mirror' },
      { n: 4, a: [['wiggle'], ['twist'], ['low']], b: 'mirror' },
      { n: 2, a: [['lift', 1.2], ['arch', 0.8], ['look']], b: 'mirror' }
    ]
  }),
  // a wave along the limbs from front to back, then along the body, passing from one dancer to the other
  vague: dance({
    id: 'vague', name: 'La vague', bar: 4, floor: 'face', likes: (w, d) => (d ? 1 + 1.5 * d : w === 1 ? 0.5 : 1),
    steps: [
      { n: 4, a: [['ola'], ['tap', 0.5]], b: { canon: 1 } },
      { n: 4, a: [['undulate', 1.2], ['lift', 0.4]], b: { canon: 2 } },
      { n: 2, a: [['lift'], ['arch', 0.6]], b: 'same' }
    ]
  }),
  // side by side to one side, to the other, and back, the claws clapping, then up
  crabe: dance({
    id: 'crabe', name: 'Le pas de crabe', bar: 4, floor: 'face', likes: (w, d) => (w ? 2.2 + 0.4 * w : d ? 0.2 : 0.4),
    steps: [
      { n: 4, a: [['slide', 1, 0, 1], ['steps'], ['clap', 0.7]], b: 'same' },
      { n: 4, a: [['slide', 1, 1, -1], ['steps'], ['clap', 0.7]], b: 'same' },
      { n: 2, a: [['slide', 1, -1, 0], ['steps'], ['alternate', 0.8]], b: 'same' },
      { n: 2, a: [['lift', 1.2], ['bounce', 0.4]], b: 'mirror' }
    ]
  }),
  // gliding back while stepping forward, one after the other; a spin, back to its place, on its toes
  moonwalk: dance({
    id: 'moonwalk', name: 'Le moonwalk', bar: 4, floor: 'face', likes: (w, d) => (w ? 1.8 + 0.3 * w : d ? 0.3 : 0.8),
    steps: [
      { n: 4, a: [['back', 1, 0, 1], ['steps'], ['nod', 0.6]], b: { canon: 2 } },
      { n: 2, a: [['spin'], ['back', 1, 1, 1]], b: { canon: 1 } },
      { n: 2, a: [['back', 1, 1, 0], ['steps', 0.6]], b: 'same' },
      { n: 2, a: [['toe'], ['star', 0.8]], b: 'mirror' }
    ]
  }),
  // close together: slow, slow, quick, quick and the head that snaps; then one leans and the other plunges back
  tango: dance({
    id: 'tango', name: 'Le tango', bar: 4, floor: 'close', likes: (w, d) => (d ? 0.3 : w ? 0.6 : 1),
    steps: [
      { n: 4, a: [['promenade', 1, 0, 1], ['snap']], b: 'same' },
      { n: 4, a: [['promenade', 1, 1, 0], ['snap']], b: 'same' },
      { n: 2, a: [['lean']], b: [['dip']] }
    ]
  }),
  // one, two, three, turning about each other; one spins, the other after it; a bow
  valse: dance({
    id: 'valse', name: 'La valse', bar: 3, floor: 'turn', likes: (w, d) => (w === 1 ? 0.4 : w ? 0.3 : d ? 1 + 0.8 * d : 1),
    steps: [
      { n: 6, a: [['waltz'], ['lift', 0.5]], b: 'mirror' },
      { n: 3, a: [['spin'], ['waltz', 0.5]], b: { canon: 1 } },
      { n: 3, a: [['bow']], b: 'same' }
    ]
  }),
  // a limb pointed up, then down, on the beat; the other answers; up for the end
  disco: dance({
    id: 'disco', name: 'Le disco', bar: 4, floor: 'face', likes: (_w, d) => (d ? 0.5 : 1),
    steps: [
      { n: 4, a: [['point'], ['bounce', 0.5], ['tap', 0.6]], b: 'mirror' },
      { n: 4, a: [['point'], ['pivot', 0.6], ['sway', 0.5]], b: { canon: 2 } },
      { n: 2, a: [['star'], ['arch', 0.4]], b: 'mirror' }
    ]
  }),
  // the beak, the wings, the tail going down, the claps, a turn, and up
  canards: dance({
    id: 'canards', name: 'La danse des canards', bar: 4, floor: 'face', likes: (w, d) => (d ? 0.5 : w ? 0.9 : 1),
    steps: [
      { n: 2, a: [['beak']], b: 'same' },
      { n: 2, a: [['flap']], b: 'same' },
      { n: 2, a: [['wag'], ['low']], b: 'same' },
      { n: 2, a: [['clap'], ['bounce', 0.6]], b: 'same' },
      { n: 2, a: [['spin']], b: 'mirror' },
      { n: 2, a: [['lift'], ['wag', 0.5]], b: 'same' }
    ]
  }),
  // face to face at the end of the dance for two: each greets the other, one after the other (not drawn among the dances)
  salut: dance({
    id: 'salut', name: 'Le salut', bar: 4, floor: 'face', likes: () => 0,
    steps: [
      { n: 2, a: [['nod', 0.8]], b: { canon: 1 } },
      { n: 2, a: [['bow', 0.6]], b: 'same' }
    ]
  })
};

/** the dances one may play (the greeting is only for the end of the dance for two) */
export const DANCE_IDS = (Object.keys(DANCES) as DanceId[]).filter((id) => DANCES[id].likes(0, 0) > 0 || DANCES[id].likes(2, 0) > 0);

// ----- playing a dance ----- //

/** the blend between two bars, on each side of their border (beats) */
const BLEND = 0.2;
/** the beats a dance takes to come into the body, and to let go of it after its last pose */
export const EASE_IN = 0.5, FADE = 0.6;

/**
 * The groove of a dancer (role 0: the one who leads, 1: the one who answers) at beat b of dance d: its steps, blended
 * across the borders of the bars, coming in at the start and letting go after the last pose. amp scales it all.
 */
export function perform(g: Groove, d: Choreo, role: 0 | 1, b: number, k: Kit, amp = 1): void {
  clearGroove(g);
  const w = amp * ease(b / EASE_IN) * (1 - ease((b - d.beats) / FADE));
  if (w > 0) track(g, d, role, Math.min(b, d.beats), k, w);
}

/** the dance is over and has let go of the body */
export const done = (d: Choreo, b: number): boolean => b >= d.beats + FADE;

function track(g: Groove, d: Choreo, role: 0 | 1, b: number, k: Kit, w: number): void {
  const n = d.steps.length;
  let i = 0;
  while (i < n - 1 && b >= d.at[i + 1]) i++;
  const t0 = d.at[i], t1 = t0 + d.steps[i].n;
  if (i > 0 && b < t0 + BLEND) {
    const e = ease((b - t0 + BLEND) / (2 * BLEND));
    bar(g, d, i - 1, role, b, k, w * (1 - e)); bar(g, d, i, role, b, k, w * e);
  } else if (i < n - 1 && b > t1 - BLEND) {
    const e = ease((b - t1 + BLEND) / (2 * BLEND));
    bar(g, d, i, role, b, k, w * (1 - e)); bar(g, d, i + 1, role, b, k, w * e);
  } else bar(g, d, i, role, b, k, w);
}

function bar(g: Groove, d: Choreo, i: number, role: 0 | 1, b: number, k: Kit, w: number): void {
  if (w <= 0) return;
  const s = d.steps[i], how: Answer | 'lead' = role ? s.b ?? 'same' : 'lead';
  if (typeof how === 'object' && !Array.isArray(how)) {
    // in canon: what the first did some beats ago (nothing yet at the start)
    const at = b - how.canon;
    if (at > 0) track(g, d, 0, at, k, w * ease(at / EASE_IN));
    return;
  }
  const calls = Array.isArray(how) ? how : s.a, u = (b - d.at[i]) / s.n;
  ctx.g = g; ctx.k = k; ctx.m = how === 'mirror' ? -1 : 1;
  for (const [id, a = 1, p0 = 0, p1 = 0] of calls) {
    ctx.w = w * a;
    (MOVES[id] as Move)(ctx, b, u, p0, p1);
  }
}

/** the sound of a strong beat: the first of a bar, the third of a bar of four, the last pose */
export type Accent = 'down' | 'beat' | 'pose';

/** the strong beat crossed going from beat b0 (excluded) to b1 (included), if any */
export function accentAt(d: Choreo, b0: number, b1: number): Accent | null {
  const n = Math.floor(b1);
  if (n <= b0 || n < 0 || n >= d.beats) return null;
  if (n === d.at[d.at.length - 1]) return 'pose';
  if (n % d.bar === 0) return 'down';
  return d.bar === 4 && n % 4 === 2 ? 'beat' : null;
}

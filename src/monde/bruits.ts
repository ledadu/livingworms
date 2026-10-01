// The noises of the sea (docs/direction-artistique.md, « Le son »): the water all around, the waves overhead, the
// rush of water along the body and the currents, bubbles, whales far away, the drops and the resonance of the Grotte,
// the ice of the Glacier that cracks and tinkles. What each chapter sounds like and the shape of each noise, pure and
// tested; bruits-son.ts plays them with the Web Audio API into the noises' bus of son.ts.

import { clamp, lerp, rng } from '../engine';
import { BIOMES, presence, type ChapterId } from './biomes';
import { caveCover } from './grotte';
import { REACH, hear, type Heard } from './ecoute';
import { hz, pentaIn } from './musique';

/** what a chapter sounds like */
export interface Bed {
  /** the breath of the water all around: how loud, and its low-pass (Hz) */
  water: number; lp: number;
  /** bubbles rising here and there, how many bursts a second */
  bubbles: number;
  /** a whale far away now and then, how many calls a minute */
  whales: number;
  /** drops falling from the vault, a second */
  drips: number;
  /** the ice cracking, how many times a minute */
  cracks: number;
  /** crystals tinkling, a second */
  tinkles: number;
  /** how much of the noises goes to the reverb */
  space: number;
}

export const BEDS: Record<ChapterId, Bed> = {
  // the light: the waves overhead, bubbles, the whales singing far out in the open sea
  nurserie: { water: 0.8, lp: 900, bubbles: 0.35, whales: 1.4, drips: 0, cracks: 0, tinkles: 0, space: 0.25 },
  // the city of coral, busy with bubbles
  recif: { water: 0.85, lp: 800, bubbles: 0.4, whales: 1, drips: 0, cracks: 0, tinkles: 0, space: 0.22 },
  // the kelp: deeper, quieter
  foret: { water: 0.8, lp: 600, bubbles: 0.3, whales: 0.8, drips: 0, cracks: 0, tinkles: 0, space: 0.4 },
  // the galleries: no whale reaches them; drops fall from the vault and everything comes back from the walls
  grotte: { water: 0.55, lp: 420, bubbles: 0.08, whales: 0, drips: 0.55, cracks: 0, tinkles: 0, space: 0.75 },
  // the whale fall: the whales still pass far above it
  carcasse: { water: 0.6, lp: 450, bubbles: 0.15, whales: 1.4, drips: 0, cracks: 0, tinkles: 0, space: 0.4 },
  // the chimneys rumble and bubble (their own bubbles come from them)
  sources: { water: 0.75, lp: 380, bubbles: 0.15, whales: 0.3, drips: 0, cracks: 0, tinkles: 0, space: 0.3 },
  // the ice: it cracks far away, crystals tinkle near
  glacier: { water: 0.5, lp: 520, bubbles: 0.08, whales: 0.5, drips: 0, cracks: 2.5, tinkles: 0.3, space: 0.55 },
  // floating: hushed
  jardin: { water: 0.5, lp: 400, bubbles: 0.06, whales: 0.4, drips: 0, cracks: 0, tinkles: 0, space: 0.5 },
  // the dark and the silence: almost nothing, a whale from very far now and then
  fosse: { water: 0.35, lp: 260, bubbles: 0, whales: 0.25, drips: 0, cracks: 0, tinkles: 0, space: 0.65 },
  // going up: the water opens again
  remontee: { water: 0.7, lp: 700, bubbles: 0.5, whales: 0.8, drips: 0, cracks: 0, tinkles: 0, space: 0.45 }
};

const KEYS = Object.keys(BEDS.nurserie) as (keyof Bed)[];

/** what is heard at x: the chapters blended at their borders like the light (biomes.presence) */
export function bedAt(x: number): Bed {
  const out = Object.fromEntries(KEYS.map((k) => [k, 0])) as unknown as Bed;
  let sum = 0;
  BIOMES.forEach((b, i) => {
    const p = presence(x, i);
    if (p <= 0.001) return;
    sum += p;
    for (const k of KEYS) out[k] += BEDS[b.id][k] * p;
  });
  if (sum > 0) for (const k of KEYS) out[k] /= sum;
  return out;
}

// ----- the beds, all along ----- //

/** how much the swimmer hears the walls of the Grotte (0..1): under its vault only */
export const caveAt = (x: number): number => caveCover(x);

/** the waves overhead, heard under the surface and fading as it deepens (metres): gone below 60 m */
export function surfAt(metres: number): number {
  const m = Math.max(0, metres);
  return m >= 60 ? 0 : Math.exp(-m / 16) * (1 - m / 60);
}

/** how loud the waves overhead are at t (s): they break now and then, a slow swell between */
export function wavesAt(t: number): number {
  const a = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 7.3), b = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 11.9 + 1.7);
  return 0.25 + 0.75 * Math.pow(a, 3) * (0.55 + 0.45 * b);
}

/** the water breathes: a slow swell of its level at t (s), 0.75..1 */
export function swellAt(t: number): number {
  return 0.875 + 0.125 * (0.6 * Math.sin((2 * Math.PI * t) / 13) + 0.4 * Math.sin((2 * Math.PI * t) / 5.3 + 2.1));
}

/**
 * The rush of the water along the body: how loud (0..1) and how high (the centre of its band, Hz), for a swimmer
 * going `speed` px a step, in a current of this strength (0..1). Nothing at rest; carried fast, a hiss.
 */
export function rushOf(speed: number, current = 0): { g: number; f: number } {
  const s = clamp((speed - 0.3) / 4.5, 0, 1), k = Math.max(s * s * (3 - 2 * s), clamp(current, 0, 1));
  return { g: k, f: 260 + 1300 * k };
}

/**
 * The current of an obstacle that pushes (the pass of the Récif, the burning corridor, the void), u how deep the
 * swimmer is in its reach (0..1): strong while it bars the way, a murmur once it lets the swimmer through.
 */
export function currentOf(u: number, open: boolean): number {
  const k = clamp(u, 0, 1);
  return open ? 0.35 * k : k * k;
}

/** the current felt at x near an obstacle (obstacles-jeu.ts `near`): only one that pushes is a current */
export function currentNear(n: { gate: number; open: boolean; o: { hold: string; soft: number } } | null, x: number): number {
  return n && n.o.hold === 'push' ? currentOf((x - (n.gate - n.o.soft)) / n.o.soft, n.open) : 0;
}

/** the chimneys of the Sources rumble: how loud, for the nearest at this distance (px) */
export function roarAt(dist: number): number {
  return dist >= 900 ? 0 : Math.pow(1 - dist / 900, 2);
}

/** how loud the noises are in a moment of the story: they step back for the words of a farewell */
export function hushIn(moment: 'adieu' | 'parade' | null): number {
  return moment === 'adieu' ? 0.5 : 1;
}

// ----- where a noise comes from ----- //

/**
 * A noise `dx`, `dy` px from the swimmer, `dz` behind the swimming plane (ecoute.ts): how loud (0..1), from which side
 * (-1 left .. 1 right), how muffled (the cut-off of its low-pass, Hz) and how far in the reverb. The far ones are dull,
 * quiet and distant.
 */
export function heard(dx: number, dy: number, dz = 0, reach: number = REACH.mid, pan?: number): Heard {
  return hear(dx, dy, dz, reach, pan);
}

/** the time until the next of a noise that comes `perSecond` times a second, at random (s); Infinity for never */
export function waitFor(r: () => number, perSecond: number): number {
  return perSecond > 1e-6 ? -Math.log(1 - r() * 0.999) / perSecond : Infinity;
}

// ----- the bubbles ----- //

/** a bubble: its pitch from where it starts to where it ends (Hz), its length (s), how loud (0..1), when (s) */
export interface Bubble { at: number; f0: number; f1: number; len: number; g: number; }

/**
 * A bubble that rises rings at the pitch of its size (Minnaert: about 3.3 kHz for a radius of a millimetre) and
 * rises in pitch as it leaves; the small ones are many, the big ones rare and low.
 */
export function bubble(r: () => number, at = 0, big = 1): Bubble {
  const radius = (0.6 + 3.4 * Math.pow(r(), 2.2)) * big, f0 = 3260 / radius;
  return { at, f0, f1: f0 * (1.25 + 0.5 * r()), len: 0.035 + 0.02 * radius, g: 0.35 + 0.15 * radius + 0.2 * r() };
}

/** a few bubbles in a row (a puff from a seep, from the sand), `n` of them at most */
export function burst(r: () => number, n = 6, big = 1): Bubble[] {
  const k = 1 + Math.floor(r() * n), out: Bubble[] = [];
  let t = 0;
  for (let i = 0; i < k; i++) {
    out.push(bubble(r, t, big));
    t += 0.03 + 0.11 * r();
  }
  return out;
}

/**
 * Bubbles come in trains from one place: bursts `pace` times a second for `len` s, then a silence of `rest` s. A seep
 * puffs now and then, a chimney longer and more often, and a train here and there is short.
 */
export interface Train { len: number; rest: number; pace: number; }

export function train(r: () => number, kind: 'seep' | 'vent' | 'free'): Train {
  const a = r(), b = r(), c = r();
  if (kind === 'vent') return { len: 1 + 4 * a * a, rest: 2.5 + 7 * Math.pow(b, 1.5), pace: 1.9 + c };
  if (kind === 'seep') return { len: 0.3 + 3.5 * a * a, rest: 2.5 + 10 * Math.pow(b, 1.5), pace: 1.6 + c };
  return { len: 1.6 * a * a, rest: 0, pace: 2 + 1.5 * c };
}

/** the trains of a seep or a chimney, from its seed, over a cycle that comes back: [start, end, pace] (s) */
export interface Trains { period: number; on: [number, number, number][]; }

export function trainsOf(seed: number, kind: 'seep' | 'vent', period = 150): Trains {
  const r = rng(seed * 31 + (kind === 'vent' ? 1 : 2)), on: [number, number, number][] = [];
  for (let t = r() * 5; ;) {
    const tr = train(r, kind);
    if (t + tr.len > period) break;
    on.push([t, t + tr.len, tr.pace]);
    t += tr.len + tr.rest;
  }
  return { period, on };
}

const known = new Map<string, Trains>();
/** the trains of a seep or a chimney (made once): the sound and the bubbles one sees follow them alike */
export function springTrains(seed: number, kind: 'seep' | 'vent'): Trains {
  const k = `${kind}${seed}`;
  let tr = known.get(k);
  if (!tr) known.set(k, (tr = trainsOf(seed, kind)));
  return tr;
}

/** how many bursts a second these trains let out at t (s, on the clock of the page): 0 in a silence */
export function bubblingAt(tr: Trains, t: number): number {
  const u = ((t % tr.period) + tr.period) % tr.period;
  for (const [a, b, pace] of tr.on) {
    if (u < a) return 0;
    if (u < b) return pace;
  }
  return 0;
}

// ----- the Grotte ----- //

/** a drop that falls from the vault: a plink that rises (Hz, s), and now and then a smaller one after it */
export interface Drip { at: number; f0: number; f1: number; rise: number; fade: number; g: number; }

export function drips(r: () => number): Drip[] {
  const f0 = 900 + 1600 * r(), one: Drip = { at: 0, f0, f1: f0 * (1.5 + 0.7 * r()), rise: 0.018 + 0.02 * r(), fade: 0.03 + 0.04 * r(), g: 0.5 + 0.5 * r() };
  if (r() > 0.35) return [one];
  const f = f0 * (1.2 + 0.4 * r());
  return [one, { at: 0.1 + 0.25 * r(), f0: f, f1: f * 1.6, rise: 0.015, fade: 0.025, g: one.g * 0.45 }];
}

/** the echo of the walls of the Grotte: its delays (s), each fed back this much, and its low-pass (Hz) */
export const CAVE_ECHO = { delays: [0.137, 0.211, 0.293], feedback: 0.55, cross: 0.12, lp: 2400 };

/** the galleries ring at a few low notes of their own (Hz), the water's breath brought out by them */
export const CAVE_MODES = [73, 110, 164, 247];

// ----- the Glacier ----- //

/** a click of ice: a short burst of noise through a band (Hz, its sharpness), when (s), how long (s), how loud */
export interface Click { at: number; f: number; q: number; len: number; g: number; }

/** the ice cracks: a run of clicks, sometimes after a low groan of the ice under strain, sometimes a far boom */
export interface Crack {
  clicks: Click[];
  /** the groan: a low creak (Hz along its length), how long (s) */
  groan: { f: number[]; len: number } | null;
  /** a deep thump of a block that settles (Hz), when (s) */
  boom: { f: number; at: number } | null;
}

export function crack(r: () => number): Crack {
  const groan = r() < 0.3 ? { f: Array.from({ length: 6 }, () => 55 + 55 * r()), len: 0.8 + 0.8 * r() } : null;
  const start = groan ? groan.len * (0.55 + 0.3 * r()) : 0, n = 4 + Math.floor(r() * 11), band = 1600 + 3600 * r();
  const clicks: Click[] = [];
  let t = start, gap = 0.012 + 0.04 * r();
  for (let i = 0; i < n; i++) {
    // stick and slip: the gaps shorten as the crack runs, and now and then it catches
    clicks.push({ at: t, f: band * (0.7 + 0.6 * r()), q: 3 + 5 * r(), len: 0.004 + 0.011 * r(), g: (i === 0 ? 1 : 0.35 + 0.65 * r()) * (1 - (0.4 * i) / n) });
    gap *= 0.82 + 0.25 * r();
    t += gap * (r() < 0.15 ? 4 : 1);
  }
  const boom = r() < 0.15 ? { f: 38 + 14 * r(), at: t + 0.05 } : null;
  return { clicks, groan, boom };
}

/** crystals that tinkle: one to three high notes of the song's scale (Hz), close together */
export function tinkle(r: () => number): { at: number; f: number; g: number }[] {
  const pool = pentaIn(96, 108), n = 1 + Math.floor(r() * 3), out: { at: number; f: number; g: number }[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    out.push({ at: t, f: hz(pool[Math.floor(r() * pool.length)]), g: 0.5 + 0.5 * r() });
    t += 0.07 + 0.16 * r();
  }
  return out;
}

// ----- the whales ----- //

/** a cry of a whale: its pitch along it ([share of its length, Hz]), how long (s), its timbre, when (s), how loud */
export interface Unit { at: number; len: number; pts: [number, number][]; wave: 'sawtooth' | 'triangle'; formant: number; g: number; }

/** the shapes of the cries, as ratios to the voice's pitch: a moan that swells, a whoop up, a high cry down, a groan */
const SHAPES: { pts: [number, number][]; len: [number, number]; wave: Unit['wave']; formant: number }[] = [
  { pts: [[0, 0.8], [0.4, 1.15], [0.75, 1], [1, 0.7]], len: [1.6, 3], wave: 'sawtooth', formant: 4 },
  { pts: [[0, 0.7], [0.7, 1.9], [1, 2.2]], len: [0.5, 0.9], wave: 'triangle', formant: 3 },
  { pts: [[0, 2.6], [0.3, 2.4], [1, 1.4]], len: [0.8, 1.4], wave: 'triangle', formant: 2.5 },
  { pts: [[0, 0.62], [0.5, 0.58], [1, 0.5]], len: [1.5, 2.5], wave: 'sawtooth', formant: 6 }
];

/** the pitch of a big animal's voice (Hz) from its size (its scale): the bigger, the lower */
export const voiceOf = (size: number): number => clamp(260 / Math.sqrt(Math.max(0.5, size)), 55, 220);

/**
 * A call of `n` cries one after the other, in a voice of this pitch (Hz). A big animal seen far away cries twice, the
 * second a little lower, as its two waves leave (ondes.ts, 1.6 s apart); a whale unseen sings a few in a row.
 */
export function call(r: () => number, voice: number, n: number, apart?: number): Unit[] {
  const out: Unit[] = [];
  let t = 0;
  for (let i = 0; i < n; i++) {
    const s = SHAPES[Math.floor(r() * SHAPES.length)], len = lerp(s.len[0], s.len[1], r()), v = voice * (i && apart ? 0.88 : 0.9 + 0.2 * r());
    out.push({ at: apart ? i * apart : t, len, pts: s.pts.map(([u, k]) => [u, v * k]), wave: s.wave, formant: s.formant, g: i && apart ? 0.7 : 0.8 + 0.2 * r() });
    t += len + 0.4 + 1.6 * r();
  }
  return out;
}

/** a whale unseen: its voice, a few cries, and from where (very far, to one side) */
export function farWhale(r: () => number): { units: Unit[]; dx: number; dz: number } {
  return { units: call(r, voiceOf(4 + 8 * r()), 2 + Math.floor(r() * 3)), dx: (r() < 0.5 ? -1 : 1) * (500 + 1500 * r()), dz: 2500 + 3000 * r() };
}

// ----- the noise itself ----- //

/**
 * A loop of noise `n` samples long: white, pink (softer highs) or brown (a rumble), its peak at 1, its end faded into
 * its start so that it loops without a click.
 */
export function noiseLoop(kind: 'white' | 'pink' | 'brown', n: number, r: () => number): Float32Array {
  const d = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const w = r() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = b0 + b1 + b2 + w * 0.1848;
    } else d[i] = br = (br + w * 0.04) * 0.996;
  }
  // the last tenth fades into the first
  const m = Math.floor(n / 10);
  for (let i = 0; i < m; i++) {
    const u = i / m;
    d[i] = d[i] * u + d[n - m + i] * (1 - u);
  }
  const out = d.subarray(0, n - m), mean = out.reduce((s, v) => s + v, 0) / out.length;
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs((out[i] -= mean)));
  for (let i = 0; i < out.length; i++) out[i] /= peak || 1;
  return out.slice();
}

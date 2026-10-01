// La lueur de l'accouplement (docs/mecaniques.md, « La lueur de l'accouplement »): the lights of a parade, never
// quite the same twice. Each parade draws its own from the genes of the two dancers (their colours, their traits, the
// way they swim) and a little chance: how the wakes shine, the figure of light that closes the dance, and in which
// colours. The lights are soft and share their strength where they gather, so they never burn to white. Pure:
// parade-jeu.ts emits them and draws them.

import { STEP, palette, type Spec, type SwimMode } from '../engine';
import { traitsOf, type Trait } from '../content/traits';

/** how the wakes shine during the dance */
export type Wake = 'poussiere' | 'bulles' | 'etincelles' | 'ruban' | 'volutes' | 'pouls' | 'lucioles';
/** the figure of light that closes the dance */
export type Burst = 'corolle' | 'spirale' | 'pluie' | 'lucioles' | 'anneaux' | 'helice' | 'fontaine';
/** what calls a figure: a trait of the body, a way of swimming, or glowing parts */
export type Gene = Trait | SwimMode | 'lueur';

export const WAKES: Record<Wake, readonly Gene[]> = {
  poussiere: [],
  bulles: ['nageoires', 'pulse', 'jet'],
  etincelles: ['carapace', 'pinces', 'dart'],
  ruban: ['corpsFin', 'filaments', 'steady'],
  volutes: ['nageoires', 'cils', 'jet'],
  pouls: ['pulsation', 'bell'],
  lucioles: ['lanterne', 'lueur']
};

export const BURSTS: Record<Burst, readonly Gene[]> = {
  corolle: ['nageoires', 'pinces'],
  spirale: ['cils', 'jet', 'nageoires'],
  pluie: ['filaments', 'bell'],
  lucioles: ['lanterne', 'lueur'],
  anneaux: ['pulsation', 'bell'],
  helice: ['corpsFin', 'steady'],
  fontaine: ['carapace', 'crawl', 'pinces']
};

/** what a dancer brings to the light */
export interface Genes {
  /** its colours: the glowing parts first, then its palette */
  hues: number[];
  genes: Gene[];
  /** the order of its radial symmetry (the arms of a star, the tentacles of a bell), 0 without */
  sym: number;
}

/** a part as the live creature has it (Creature3.list), for the colour of what glows */
export interface GlowPart { def: { color: { glow: string } }; hue: number; }

export function genesOf(sp: Spec, parts: readonly GlowPart[] = []): Genes {
  const glows = parts.filter((s) => s.def.color.glow !== 'none').map((s) => s.hue);
  const pal = palette(sp.palette).map((s) => s.h);
  const hues = dedupe([...glows.slice(0, 2), pal[0], pal[1]]);
  const genes: Gene[] = [...traitsOf(sp), sp.swim.mode];
  if (glows.length) genes.push('lueur');
  // a ring of arms, or a fan of limbs around the body (a bell's tentacles); halved down to a figure of 8 at most
  let sym = 0;
  for (const a of sp.body.attach) if (a.pattern === 'ring' || (a.pattern === 'fan' && a.node.role !== 'deco')) sym = Math.max(sym, a.count);
  while (sym > 8) sym = Math.round(sym / 2);
  return { hues, genes, sym: sym >= 3 ? sym : 0 };
}

/** hues closer than 12° count as one */
function dedupe(hues: number[]): number[] {
  const out: number[] = [];
  for (const h of hues) {
    const w = ((h % 360) + 360) % 360;
    if (!out.some((o) => Math.abs(((w - o + 540) % 360) - 180) < 12)) out.push(w);
  }
  return out;
}

export interface Lueur {
  /** its colours: the partner's first, then ours, then the rest of both */
  hues: number[];
  wake: Wake; burst: Burst;
  /** a second, smaller figure from our own genes, or none */
  echo: Burst | null;
  /** the symmetry of the figures (petals of a corolla, beads of a ring) */
  arms: number;
  /** which way the figures turn */
  spin: 1 | -1;
  /** size of the lights, and pace of the figures (×) */
  size: number; pace: number;
}

/** the weight of each figure: the partner's genes count double, ours once; the last one danced comes back rarely */
function pick<K extends string>(table: Record<K, readonly Gene[]>, theirs: readonly Gene[], ours: readonly Gene[], rnd: () => number, last?: K | null): K {
  const keys = Object.keys(table) as K[];
  const w = keys.map((k) => {
    const g = table[k];
    const v = 1 + 2 * theirs.filter((x) => g.includes(x)).length + ours.filter((x) => g.includes(x)).length;
    return k === last ? v * 0.15 : v;
  });
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length; i++) { r -= w[i]; if (r < 0) return keys[i]; }
  return keys[keys.length - 1];
}

/**
 * The light of a parade between their species and ours. `last`: the light of the parade before, whose figures come
 * back rarely.
 */
export function lueurOf(theirs: Genes, ours: Genes, rnd: () => number = Math.random, last: Lueur | null = null): Lueur {
  const tint = () => (rnd() - 0.5) * 16;
  const hues = dedupe([theirs.hues[0], ours.hues[0], ...theirs.hues.slice(1), ...ours.hues.slice(1)].map((h) => h + tint()));
  const wake = pick(WAKES, theirs.genes, ours.genes, rnd, last?.wake);
  const burst = pick(BURSTS, theirs.genes, ours.genes, rnd, last?.burst);
  const mine = pick(BURSTS, ours.genes, [], rnd, burst);
  const echo = rnd() < 0.5 && mine !== burst ? mine : null;
  const sym = theirs.sym || ours.sym;
  const arms = sym ? Math.max(3, Math.min(8, sym)) : 3 + Math.floor(rnd() * 5);
  const fast = [...theirs.genes, ...ours.genes].some((g) => g === 'dart' || g === 'jet');
  return {
    hues, wake, burst, echo, arms, spin: rnd() < 0.5 ? 1 : -1,
    size: 1.6 + 0.6 * rnd(), pace: (fast ? 1.15 : 0.85) + 0.3 * rnd()
  };
}

// ----- the lights ----- //

/**
 * A light: a centre that drifts (x, y, speed), an offset around it that turns (radius, radial speed, angle, turn;
 * `flat` 0 keeps it on a horizontal line), then age, life, hue, size, drag, lift (added to its speed each step, < 0
 * rises), twinkle (Hz, 0 for a steady light), phase, grow (its size at the end of its life, ×), peak (its alpha).
 * A light with a negative age waits, unseen, before it starts.
 */
export interface Mote {
  x: number; y: number; vx?: number; vy?: number;
  r?: number; dr?: number; a?: number; turn?: number; flat?: number;
  delay?: number; life: number; hue: number; size: number;
  drag?: number; lift?: number; twinkle?: number; phase?: number; grow?: number; peak?: number;
}

const F = 19;
export const MAX_MOTES = 400;
/** the lights of one cell of this size (world px) never add up to more than CELL_CAP of alpha */
export const CELL = 32, CELL_CAP = 1.8;
/** no light is stronger than this */
export const PEAK_MAX = 0.7;

export class Motes {
  private d: number[] = [];
  private sums = new Map<number, number>();
  private raw: number[] = [];

  get count(): number { return this.d.length / F; }

  add(m: Mote): void {
    if (this.d.length >= MAX_MOTES * F) return;
    this.d.push(m.x, m.y, m.vx ?? 0, m.vy ?? 0, m.r ?? 0, m.dr ?? 0, m.a ?? 0, m.turn ?? 0, m.flat ?? 1,
      -(m.delay ?? 0), m.life, m.hue, m.size, m.drag ?? 0.97, m.lift ?? -0.004, m.twinkle ?? 0, m.phase ?? 0, m.grow ?? 0.6,
      Math.min(PEAK_MAX, m.peak ?? 0.5));
  }

  /** one step; `water`: the velocity of the water at a point (px per step), which carries the lights along */
  step(dt = STEP, water?: (x: number, y: number) => Pt): void {
    const d = this.d;
    for (let i = 0; i < d.length; i += F) {
      if (d[i + 9] < 0) { d[i + 9] += dt; continue; }
      const drag = d[i + 13];
      d[i] += d[i + 2]; d[i + 1] += d[i + 3];
      if (water) { const w = water(d[i], d[i + 1]); d[i] += w.x; d[i + 1] += w.y; }
      d[i + 2] *= drag; d[i + 3] = d[i + 3] * drag + d[i + 14];
      d[i + 4] += d[i + 5]; d[i + 5] *= drag; d[i + 6] += d[i + 7];
      d[i + 9] += dt;
    }
    for (let i = d.length - F; i >= 0; i -= F) {
      if (d[i + 9] < d[i + 10]) continue;
      const j = d.length - F;
      if (i !== j) for (let k = 0; k < F; k++) d[i + k] = d[j + k];
      d.length = j;
    }
  }

  /**
   * Each light as it shows now: x, y (world), size, hue, alpha. `gain` makes them stronger (in clear water, where an
   * added light shows less), never beyond PEAK_MAX; where many gather, they share their strength.
   */
  each(fn: (x: number, y: number, size: number, hue: number, alpha: number) => void, gain = 1): void {
    const d = this.d, sums = this.sums, raw = this.raw;
    sums.clear(); raw.length = 0;
    for (let i = 0; i < d.length; i += F) {
      const age = d[i + 9];
      if (age < 0) { raw.push(0, 0, 0, 0); continue; }
      const k = age / d[i + 10], tw = d[i + 15];
      const x = d[i] + d[i + 4] * Math.cos(d[i + 6]), y = d[i + 1] + d[i + 4] * Math.sin(d[i + 6]) * d[i + 8];
      let al = d[i + 18] * gain * Math.min(1, age * 8) * (1 - k);
      if (tw) al *= 0.55 + 0.45 * Math.sin(Math.PI * 2 * tw * age + d[i + 16]);
      al = Math.min(PEAK_MAX, al);
      const key = cellKey(x, y);
      raw.push(x, y, al, key);
      sums.set(key, (sums.get(key) || 0) + al);
    }
    for (let i = 0, j = 0; i < d.length; i += F, j += 4) {
      const al = raw[j + 2];
      if (al <= 0.003) continue;
      const s = sums.get(raw[j + 3])!, k = d[i + 9] / d[i + 10];
      fn(raw[j], raw[j + 1], d[i + 12] * (1 + (d[i + 17] - 1) * k), d[i + 11], s > CELL_CAP ? (al * CELL_CAP) / s : al);
    }
  }
}

const cellKey = (x: number, y: number) => Math.floor(x / CELL) * 65536 + Math.floor(y / CELL);

// ----- what the lights draw ----- //

export interface Pt { x: number; y: number; }

const TAU = Math.PI * 2;
const hueAt = (l: Lueur, i: number) => l.hues[((i % l.hues.length) + l.hues.length) % l.hues.length];
const around = (rnd: () => number, s: number) => (rnd() - 0.5) * 2 * s;

/**
 * During the dance, each step (`tick` counts them): the partner's wake shines in the colours of the light, and ours
 * joins it as we dance in time (sync, 0..1).
 */
export function wake(m: Motes, l: Lueur, tick: number, them: Pt, us: Pt, sync: number, rnd: () => number = Math.random): void {
  const z = l.size, ourTurn = sync > 0.35;
  const at = (every: number, off: number, ours: boolean) => (tick + off) % Math.max(1, Math.round(every * (ours ? 2 : 1))) === 0;
  const both: [Pt, boolean][] = ourTurn ? [[them, false], [us, true]] : [[them, false]];
  for (const [p, ours] of both) {
    // ours shines in their colours, now and then in our own
    const hue = ours ? hueAt(l, rnd() < 0.7 ? 0 : 1) : hueAt(l, Math.floor(tick / 40) % 2 ? 2 : 0);
    const k = ours ? sync : 1, off = ours ? 1 : 0;
    switch (l.wake) {
      case 'poussiere':
        if (at(3, off, false)) m.add({ x: p.x + around(rnd, 4), y: p.y + around(rnd, 4), vy: -0.05, life: 1.4 * k + 0.2, hue, size: (3.5 + 2.5 * sync) * z, peak: 0.57 });
        break;
      case 'bulles':
        if (at(5, off, ours)) m.add({ x: p.x + around(rnd, 5), y: p.y + around(rnd, 5), vy: -0.2, lift: -0.012, drag: 0.985, r: 2 + 2 * rnd(), a: rnd() * TAU, turn: 0.14, life: 1.9 * k + 0.3, hue, size: (3 + 2 * rnd()) * z, grow: 1.1, peak: 0.61 });
        break;
      case 'etincelles':
        if (at(2, off, ours)) {
          const u = rnd() * TAU, v = 0.5 + 0.7 * rnd();
          m.add({ x: p.x, y: p.y, vx: Math.cos(u) * v, vy: Math.sin(u) * v, drag: 0.9, lift: 0, life: 0.4 + 0.4 * rnd() * k, hue, size: (2.5 + 1.5 * rnd()) * z, twinkle: 9, phase: rnd() * TAU, grow: 0.4, peak: 0.7 });
        }
        break;
      case 'ruban':
        if (at(1, 0, ours)) m.add({ x: p.x, y: p.y, lift: 0, life: 1.9 * k + 0.2, hue: hueAt(l, Math.floor(tick / 18) % 2 ? 1 : 0), size: 3.2 * z * (ours ? 0.8 : 1), grow: 0.5, peak: 0.38 });
        break;
      case 'volutes':
        if (at(4, off, ours)) m.add({ x: p.x, y: p.y, vy: -0.03, dr: 0.35 * l.pace, drag: 0.985, a: rnd() * TAU, turn: 0.1 * l.spin * l.pace, life: 1.3 * k + 0.2, hue, size: (3.5 + 2 * rnd()) * z, grow: 0.5, peak: 0.61 });
        break;
      case 'pouls': {
        const every = Math.round(36 / l.pace);
        if (!ours && tick % every === 0) {
          const n = Math.min(12, l.arms * 2);
          for (let i = 0; i < n; i++) m.add({ x: p.x, y: p.y, r: 4, dr: 2.4 * l.pace, drag: 0.96, lift: 0, a: (i / n) * TAU, life: 1, hue, size: 3 * z, grow: 0.8, peak: 0.49 });
        }
        if (at(6, off, ours)) m.add({ x: p.x + around(rnd, 4), y: p.y + around(rnd, 4), vy: -0.04, life: 1.1 * k + 0.2, hue, size: 4.5 * z, peak: 0.41 });
        break;
      }
      case 'lucioles':
        if (at(7, off, ours)) m.add({ x: p.x + around(rnd, 26), y: p.y + around(rnd, 26), vx: around(rnd, 0.08), vy: around(rnd, 0.08), lift: -0.001, life: (2.4 + rnd()) * (0.4 + 0.6 * k), hue, size: (4 + 2 * rnd()) * z, twinkle: 1.2 + rnd(), phase: rnd() * TAU, grow: 0.8, peak: 0.7 });
        break;
    }
  }
}

/** a partner notices us: a few lights rise from it */
export function notice(m: Motes, at: Pt, hue: number, held: number, rnd: () => number = Math.random): void {
  m.add({ x: at.x, y: at.y, vx: around(rnd, 0.3), vy: -0.1 - 0.4 * rnd(), life: 1.2, hue, size: 6 + 8 * held, peak: 0.61 });
}

/**
 * The figure of light that closes the dance, around the two dancers (`at`), as rich as the parade was good
 * (q, 0..1): more lights, a wider figure; never brighter. Then, if the light has one, its echo, smaller.
 */
export function burst(m: Motes, l: Lueur, at: Pt, q: number, rnd: () => number = Math.random): void {
  // a soft bloom where they met
  m.add({ x: at.x, y: at.y, lift: 0, life: 0.9, hue: hueAt(l, 0), size: 14 * l.size, grow: 1.6, peak: 0.41 });
  figure(m, l, l.burst, at, 0.5 + q, 1, rnd);
  if (l.echo) figure(m, l, l.echo, at, (0.5 + q) * 0.5, 0.65, rnd, 0.35);
}

/** one figure: rich (the amount of lights, ×), wide (its size, ×), after a wait (s) */
function figure(m: Motes, l: Lueur, f: Burst, c: Pt, rich: number, wide: number, rnd: () => number, wait = 0): void {
  const z = l.size, pace = l.pace, spin = l.spin, arms = l.arms;
  const n = (base: number) => Math.max(3, Math.round(base * rich));
  switch (f) {
    case 'corolle': {
      // petals: each a line of lights flung out, curving the same way
      const per = n(6), rot = rnd() * TAU;
      for (let a = 0; a < arms; a++) for (let i = 0; i < per; i++) {
        const u = rot + (a / arms) * TAU + around(rnd, 0.08), v = (1 + (3.2 * (i + 1)) / per) * wide * pace;
        m.add({ x: c.x, y: c.y, vx: Math.cos(u) * v, vy: Math.sin(u) * v, drag: 0.965, lift: 0, delay: wait + i * 0.012, life: 1.5 + 0.4 * rnd(), hue: hueAt(l, a), size: (3.5 + 2.5 * (1 - i / per)) * z, grow: 0.5, peak: 0.61 });
      }
      break;
    }
    case 'spirale': {
      // two arms, one in their colour, one in ours, unrolling from the centre
      const per = n(22);
      for (let arm = 0; arm < 2; arm++) for (let i = 0; i < per; i++) {
        const u = arm * Math.PI + spin * i * 0.28, v = 3.2 * wide * pace;
        m.add({ x: c.x, y: c.y, vx: Math.cos(u) * v, vy: Math.sin(u) * v, drag: 0.97, lift: 0, delay: wait + i * 0.025, life: 1.5, hue: hueAt(l, arm), size: 4 * z, grow: 0.5, peak: 0.61 });
      }
      break;
    }
    case 'pluie': {
      // lights fall softly from above them, each with a short trail, swaying
      const drops = n(16);
      for (let i = 0; i < drops; i++) {
        const x = c.x + around(rnd, 110 * wide), y = c.y - 70 - 70 * rnd(), t0 = wait + rnd() * 0.9, hue = hueAt(l, i);
        for (let k = 0; k < 3; k++) m.add({ x, y, vy: 0.35 * pace, lift: 0.004, drag: 0.995, r: 5, a: rnd() * TAU, turn: 0.06, flat: 0, delay: t0 + k * 0.05, life: 2, hue, size: (4 - k) * z, grow: 0.7, peak: 0.6 - k * 0.15 });
      }
      break;
    }
    case 'lucioles': {
      // lights that wake up one by one around them, and blink
      const count = n(24);
      for (let i = 0; i < count; i++) {
        const u = rnd() * TAU, r = (20 + 110 * Math.sqrt(rnd())) * wide;
        m.add({ x: c.x + Math.cos(u) * r, y: c.y + Math.sin(u) * r * 0.8, vx: around(rnd, 0.1), vy: around(rnd, 0.1), lift: -0.002, delay: wait + rnd() * 1.1, life: 1.4 + rnd(), hue: hueAt(l, i), size: (3 + 2 * rnd()) * z, twinkle: 1.5 + 1.5 * rnd(), phase: rnd() * TAU, grow: 0.8, peak: 0.65 });
      }
      break;
    }
    case 'anneaux': {
      // rings of light that widen one after the other, like a bell's beat
      const rings = 2 + Math.round(rich), beads = Math.min(24, arms * 3);
      for (let k = 0; k < rings; k++) for (let i = 0; i < beads; i++) {
        m.add({ x: c.x, y: c.y, r: 6, dr: 3.8 * wide * pace, drag: 0.962, lift: 0, a: (i / beads) * TAU + k * 0.3, delay: wait + k * 0.28, life: 1.2, hue: hueAt(l, k), size: 3.4 * z, grow: 0.7, peak: 0.57 });
      }
      break;
    }
    case 'helice': {
      // two strands of light, theirs and ours, twisting upward together
      const per = n(20);
      for (let s = 0; s < 2; s++) for (let i = 0; i < per; i++) {
        m.add({ x: c.x, y: c.y, vy: -2.2 * wide * pace, drag: 1, lift: 0, r: 34 * wide, a: s * Math.PI + i * 0.45 * spin, turn: 0.05 * spin, flat: 0, delay: wait + i * 0.035, life: 1.5, hue: hueAt(l, s), size: 4 * z, grow: 0.6, peak: 0.61 });
      }
      break;
    }
    case 'fontaine': {
      // a fountain of lights that rise, open and fall back
      const count = n(34);
      for (let i = 0; i < count; i++) {
        m.add({ x: c.x + around(rnd, 8), y: c.y, vx: around(rnd, 0.9) * wide, vy: -(2.8 + 1.2 * rnd()) * wide * pace, drag: 0.99, lift: 0.05, delay: wait + rnd() * 0.6, life: 1.4 + 0.4 * rnd(), hue: hueAt(l, i), size: (3 + 2 * rnd()) * z, grow: 0.6, peak: 0.61 });
      }
      break;
    }
  }
}

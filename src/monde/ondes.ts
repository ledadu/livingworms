// The water that bends (docs/direction-artistique.md, « L'eau qui se déforme »): what the lens (ondes-gl.ts) bends,
// as plain data. A song, an answer, a cry sends a wave through the water from the one that sings: a ring that leaves
// with the light of its note and spreads, the scene behind it bending as through a lens. Hot water shimmers up from
// the chimneys and the burning corridor, the freezing brine sinks, the current of the pass streams back, the surface
// ripples overhead. Each frame these become shapes of the screen (ripples and flows, css px), and the few regions of
// the screen the lens redraws.

import type { ChapterId } from './biomes';

export type RingKind = 'song' | 'answer' | 'learn' | 'rise' | 'light' | 'call';

/** what a kind of ring looks like */
export interface RingLook {
  /** how far it spreads (world px) */
  size: number;
  /** how long it lasts (s) */
  dur: number;
  /** how far it moves the scene at its strongest (css px, on the swimming plane) */
  amp: number;
  /** the thickness of its wave (world px) */
  width: number;
  /** its crests */
  crests: number;
  /** how much light its crests catch (0..1) */
  glint: number;
}

export const RINGS: Record<RingKind, RingLook> = {
  // a note of the swimmer, with its ring of light (chant-jeu.ts: 250 px in 2.4 s), a little further
  song: { size: 340, dur: 2.8, amp: 11, width: 34, crests: 2, glint: 0.5 },
  // an animal answers: about its ring of light (90 px and its body)
  answer: { size: 160, dur: 2.8, amp: 7, width: 22, crests: 2, glint: 0.45 },
  // a note learned: wide and slow
  learn: { size: 320, dur: 3.6, amp: 12, width: 44, crests: 3, glint: 0.55 },
  // the whole song in the well of light (the Remontée)
  rise: { size: 460, dur: 3.2, amp: 12, width: 46, crests: 2, glint: 0.55 },
  // each flash of a light that answers in the dark of the Fosse
  light: { size: 260, dur: 3, amp: 8, width: 30, crests: 2, glint: 0.9 },
  // a big animal cries far away: a long, slow wave
  call: { size: 1700, dur: 8, amp: 12, width: 120, crests: 3, glint: 0.25 }
};

/** a wave in the water, from where it was sung (world px), with the colour its crests catch (r, g, b in 0..1) */
export interface Ring { kind: RingKind; x: number; y: number; z: number; t0: number; size: number; rgb: readonly number[]; }

const ease = (u: number) => 1 - Math.pow(1 - u, 3);

/**
 * A ring `age` seconds after it was sung: its radius and the thickness of its wave (world px), and its strength
 * (0..1). It grows like the ring of light of its note, fast then slower, and fades as it goes; null when gone.
 */
export function ringAt(look: RingLook, age: number, size = look.size): { r: number; w: number; k: number } | null {
  if (!(age >= 0 && age < look.dur)) return null;
  const u = age / look.dur;
  return { r: size * (0.08 + 0.92 * ease(u)), w: look.width * (0.7 + 0.6 * u), k: Math.min(1, u * 14) * Math.pow(1 - u, 1.5) };
}

/** drops from the list the rings gone at time t */
export function pruneRings(rings: Ring[], t: number): void {
  for (let i = rings.length - 1; i >= 0; i--) if (t - rings[i].t0 >= RINGS[rings[i].kind].dur) rings.splice(i, 1);
}

/** the `n` rings that bend the most at time t, among those started (the gone ones are dropped from the list) */
export function liveRings(rings: Ring[], t: number, n: number): Ring[] {
  pruneRings(rings, t);
  const on = rings.filter((r) => t >= r.t0);
  if (on.length <= n) return on;
  const k = (r: Ring) => (ringAt(RINGS[r.kind], t - r.t0, r.size)?.k ?? 0) * RINGS[r.kind].amp;
  return on.sort((a, b) => k(b) - k(a)).slice(0, n);
}

// ----- the shapes of the screen ----- //

/**
 * A ring on the screen (css px): centre, radius, thickness, how far it moves the scene, its crests, the light they
 * catch (added, in this colour) and how much they brighten and darken the scene (a share of its colour)
 */
export interface Ripple { x: number; y: number; r: number; w: number; amp: number; crests: number; glint: number; shade: number; rgb: readonly number[]; }

/**
 * A flow on the screen (css px): a band from its base (x, y) along the unit direction (ux, uy) the water streams in,
 * `len` long, `hw` half wide at its base and `widen` times that at its end. It shimmers with waves of `lambda` px
 * that move `amp` px and go `speed` px/s; its strength fades along it by `fade` (0: even, 1: none at its end) and
 * across by `ramp` (1: from none on its left to all on its right, looking down the stream; −1: the other way). Its
 * edges soften over `softA` of its length and `softB` of its width (0..0.5). Where it squeezes the scene, streaks
 * of light: `glint` of this colour added, `shade` of the scene's own.
 */
export interface Flow {
  x: number; y: number; ux: number; uy: number; len: number; hw: number; widen: number;
  amp: number; lambda: number; speed: number; fade: number; ramp: number; softA: number; softB: number; seed: number;
  glint: number; shade: number; rgb: readonly number[];
}

export interface Rect { x0: number; y0: number; x1: number; y1: number; }

/** the rectangle a ripple bends, with the room its pixels move */
export function rippleBox(p: Ripple): Rect {
  const e = p.r + p.w * 2.6 + p.amp + 2;
  return { x0: p.x - e, y0: p.y - e, x1: p.x + e, y1: p.y + e };
}

/** the rectangle a flow bends */
export function flowBox(f: Flow): Rect {
  const vx = -f.uy, vy = f.ux, w0 = f.hw, w1 = f.hw * f.widen, ex = f.x + f.ux * f.len, ey = f.y + f.uy * f.len, m = f.amp + 2;
  const xs = [f.x + vx * w0, f.x - vx * w0, ex + vx * w1, ex - vx * w1], ys = [f.y + vy * w0, f.y - vy * w0, ey + vy * w1, ey - vy * w1];
  return { x0: Math.min(...xs) - m, y0: Math.min(...ys) - m, x1: Math.max(...xs) + m, y1: Math.max(...ys) + m };
}

/**
 * The regions of a w × h screen to redraw: these rectangles scaled by k (css to device px), on whole pixels, clipped
 * to the screen, the empty ones dropped and those that touch merged until none do (each effect then lies whole in
 * one region, where its pixels are read). Past `full` of the screen, one region: the whole screen.
 */
export function regions(rs: readonly Rect[], w: number, h: number, k = 1, full = 0.6): Rect[] {
  const out: Rect[] = [];
  for (const r of rs) {
    const c = { x0: Math.max(0, Math.floor(r.x0 * k)), y0: Math.max(0, Math.floor(r.y0 * k)), x1: Math.min(w, Math.ceil(r.x1 * k)), y1: Math.min(h, Math.ceil(r.y1 * k)) };
    if (c.x1 - c.x0 >= 1 && c.y1 - c.y0 >= 1) out.push(c);
  }
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i], b = out[j];
      if (a.x0 > b.x1 || b.x0 > a.x1 || a.y0 > b.y1 || b.y0 > a.y1) continue;
      out[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
      out.splice(j, 1);
      // the grown one may touch those already passed
      i = -1;
      break;
    }
  }
  let area = 0;
  for (const r of out) area += (r.x1 - r.x0) * (r.y1 - r.y0);
  return area > full * w * h ? [{ x0: 0, y0: 0, x1: w, y1: h }] : out;
}

// ----- what shimmers ----- //

const WARM = [1, 0.62, 0.32], PALE = [0.75, 0.92, 1];

/** the hot water over a chimney's mouth at (x, y) on the screen, s px per world px */
export function plume(x: number, y: number, s: number, seed: number): Flow {
  return { x, y: y + 10 * s, ux: 0, uy: -1, len: 520 * s, hw: 34 * s, widen: 3.2, amp: 5.5 * s, lambda: 34 * s, speed: 80 * s, fade: 0.75, ramp: 0, softA: 0.1, softB: 0.35, seed, glint: 0.06, shade: 0.16, rgb: WARM };
}

export type Haze = 'heat' | 'cold' | 'current';

/** the obstacles whose water bends (obstacles.ts): the burning corridor shimmers up, the freezing water sinks, the current of the pass streams back */
export const HAZE: Partial<Record<ChapterId, Haze>> = { sources: 'heat', glacier: 'cold', recif: 'current' };

/**
 * The water of an obstacle on a screen h px high: from x0 to x1 (css px, the start of its reach and just past its
 * gate), strongest at the gate; s px per world px; `on` how much of it shows (0..1).
 */
export function haze(look: Haze, x0: number, x1: number, h: number, s: number, on: number): Flow {
  const mid = (x0 + x1) / 2, hw = Math.max(1, (x1 - x0) / 2);
  if (look === 'current') return { x: x1, y: h / 2, ux: -1, uy: 0, len: x1 - x0, hw: h / 2 + 40, widen: 1, amp: 3 * s * on, lambda: 90 * s, speed: 160 * s, fade: 0.9, ramp: 0, softA: 0.1, softB: 0, seed: 3, glint: 0.04, shade: 0.1, rgb: PALE };
  if (look === 'cold') return { x: mid, y: -40, ux: 0, uy: 1, len: h + 80, hw, widen: 1, amp: 3.5 * s * on, lambda: 70 * s, speed: 14 * s, fade: 0, ramp: -0.9, softA: 0, softB: 0.25, seed: 5, glint: 0.04, shade: 0.12, rgb: PALE };
  return { x: mid, y: h + 40, ux: 0, uy: -1, len: h + 80, hw, widen: 1, amp: 4.5 * s * on, lambda: 32 * s, speed: 60 * s, fade: 0.3, ramp: 0.9, softA: 0, softB: 0.25, seed: 1, glint: 0.035, shade: 0.12, rgb: WARM };
}

/** the surface seen from below, from above the screen down to y (css px) on a screen w px wide: its waves bend the light overhead */
export function surface(y: number, w: number): Flow {
  return { x: -40, y: (y - 80) / 2, ux: 1, uy: 0, len: w + 80, hw: (y + 80) / 2, widen: 1, amp: 3, lambda: 80, speed: 38, fade: 0, ramp: -0.7, softA: 0, softB: 0.3, seed: 7, glint: 0.05, shade: 0.1, rgb: PALE };
}

/** seconds until a big animal cries again: now and then, never twice in a row at the same pace */
export function callGap(seed: number, k: number): number {
  const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return 30 + 45 * (v - Math.floor(v));
}

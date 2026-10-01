// What the parade does to the water (docs/mecaniques.md, « L'eau de la parade »): the beats of the dancers and the
// figure that closes the dance, as gusts given to the water of fluide.ts. Nothing is drawn here: a fish's tail sheds
// a puff at the end of each stroke, to the side it swept, and the eddies of these puffs make the wake; a bell or a
// mantle pushes a jet behind it at each beat, which rolls into a ring; the figure of the parade is a set of jets,
// eddies and wells whose water carries the light out into petals, spirals, clouds, mushrooms. Pure: parade-eau.ts
// gives these gusts to the water.

import type { SwimMode } from '../engine';
import type { Burst, Lueur } from './lueur';

export interface Pt { x: number; y: number; }

/**
 * A gust given to the water, `t` seconds after its figure began, at (x, y) (relative to the figure, or in the world
 * for a beat): a push (vx, vy, px per step), water welling out (rate, cells per step), light poured (a: the partner's
 * ink, b: ours), all within r px.
 */
export interface Gust {
  t: number; x: number; y: number; r: number;
  vx?: number; vy?: number; rate?: number;
  a?: number; b?: number;
}

/** a figure in the water: its gusts, and how its light rises (< 0 sinks) while it lasts (s) */
export interface WaterFigure { gusts: Gust[]; lift: number; lasts: number; }

const TAU = Math.PI * 2;
/** the water runs 60 steps a second: the gusts of a jet come every step */
const S = 1 / 60;

/** the light of a figure: its arms, or its strands, take the partner's ink and ours in turn */
const inkOf = (i: number, k: number): { a: number; b: number } => (i % 2 ? { a: 0, b: k } : { a: k, b: 0 });

/**
 * The figure of the parade in the water, around its middle (0, 0): `rich` (0.5 after a poor parade, 1.5 after a
 * perfect one) gives it more light and a little more room, never more force. `rnd` for what chance decides.
 */
export function waterFigure(f: Burst, l: Pick<Lueur, 'arms' | 'spin' | 'pace'>, rich: number, rnd: () => number = Math.random, wide = 1): WaterFigure {
  const g: Gust[] = [], pace = l.pace, spin = l.spin, arms = l.arms;
  const w = wide * (0.85 + 0.15 * rich), ink = 0.75 + 0.25 * rich;
  let lift = 0, lasts = 3;
  switch (f) {
    case 'corolle': {
      // petals: a jet out along each arm, turning slowly, from a well in the middle; each jet head curls
      const rot = rnd() * TAU;
      for (let s = 0; s < 34; s++) {
        if (s < 8) g.push({ t: s * S, x: 0, y: 0, r: 14, rate: 26 * w });
        for (let a = 0; a < arms; a++) {
          const u = rot + (a / arms) * TAU + spin * s * 0.012, dx = Math.cos(u), dy = Math.sin(u);
          g.push({ t: s * S, x: dx * 30 * w, y: dy * 30 * w, r: 9, vx: dx * 6 * pace, vy: dy * 6 * pace });
          g.push({ t: s * S, x: dx * 24 * w, y: dy * 24 * w, r: 7, ...inkOf(a, 0.5 * ink) });
        }
      }
      break;
    }
    case 'spirale': {
      // an eddy: the water turns, and two arms of light, theirs and ours, are wound in
      for (let s = 0; s < 50; s++) {
        if (s < 14) for (let k = 0; k < 20; k++) {
          const u = (k / 20) * TAU, r = 70 * w;
          g.push({ t: s * S, x: Math.cos(u) * r, y: Math.sin(u) * r, r: 24, vx: -Math.sin(u) * 2 * spin * pace, vy: Math.cos(u) * 2 * spin * pace });
        }
        const u = s * 0.09 * spin;
        for (let arm = 0; arm < 2; arm++) {
          const v = u + arm * Math.PI;
          g.push({ t: s * S, x: Math.cos(v) * 90 * w, y: Math.sin(v) * 90 * w, r: 11, ...inkOf(arm, 0.4 * ink) });
        }
      }
      break;
    }
    case 'anneaux': {
      // rings: the water wells out of the middle in beats, as a bell's, and pushes rings of light that crumple
      const rings = 2 + Math.round(rich);
      for (let k = 0; k < rings; k++) {
        const t0 = k * 26;
        for (let s = 0; s < 5; s++) g.push({ t: (t0 + s) * S, x: 0, y: 0, r: 12, rate: 90 * w * pace });
        for (let i = 0; i < 24; i++) {
          const u = (i / 24) * TAU;
          g.push({ t: t0 * S, x: Math.cos(u) * 12, y: Math.sin(u) * 12, r: 7, ...inkOf(k, 0.9 * ink) });
        }
      }
      lasts = rings * 26 * S + 2.5;
      break;
    }
    case 'fontaine': {
      // a fountain: a jet rises from under them, opens, and its light falls back around it
      lift = -0.006;
      for (let s = 0; s < 40; s++) {
        g.push({ t: s * S, x: 0, y: 60 * w, r: 15, vx: 0, vy: -6 * pace });
        g.push({ t: s * S, x: 0, y: 58 * w, r: 11, a: 0.6 * ink, b: s % 10 < 5 ? 0.4 * ink : 0 });
      }
      break;
    }
    case 'pluie': {
      // drops of light falling from above them, each rolling into a small mushroom as ink does in water
      const drops = Math.max(3, Math.round(4 * rich + 1));
      for (let d = 0; d < drops; d++) {
        const x = (rnd() - 0.5) * 300 * w, y = -(90 + 110 * rnd()) * w, t0 = d * 10;
        for (let s = 0; s < 10; s++) g.push({ t: (t0 + s) * S, x, y: y + s * 3, r: 14, vx: 0, vy: 4.5 * pace });
        for (let s = 0; s < 3; s++) g.push({ t: (t0 + s) * S, x, y: y + s * 3, r: 13, ...inkOf(d, 0.9 * ink) });
      }
      lasts = drops * 10 * S + 3;
      break;
    }
    case 'helice': {
      // two strands winding up together: a jet rising that swings from side to side
      for (let s = 0; s < 70; s++) {
        const side = Math.sin(s * 0.28 * spin);
        g.push({ t: s * S, x: side * 16 * w, y: 100 * w, r: 13, vx: side * 3 * pace, vy: -5 * pace });
        g.push({ t: s * S, x: side * 16 * w, y: 100 * w, r: 10, ...inkOf(side > 0 ? 0 : 1, 0.7 * ink) });
      }
      break;
    }
    case 'lucioles': {
      // specks of light waking up all around them, each with a small stir of its own
      const count = Math.max(8, Math.round(22 * rich));
      for (let i = 0; i < count; i++) {
        const u = rnd() * TAU, r = (20 + 120 * Math.sqrt(rnd())) * w, t = rnd() * 1.1, v = rnd() * TAU;
        const x = Math.cos(u) * r, y = Math.sin(u) * r * 0.8;
        g.push({ t, x, y, r: 9, vx: Math.cos(v) * 1.6, vy: Math.sin(v) * 1.6 });
        for (let s = 0; s < 4; s++) g.push({ t: t + s * S, x, y, r: 8, ...inkOf(i, 0.45 * ink) });
      }
      lasts = 4;
      break;
    }
  }
  return { gusts: g, lift, lasts };
}

/** the whole figure of a parade: a soft cloud where they met, the figure, then its echo, smaller and later */
export function paradeFigure(l: Lueur, q: number, rnd: () => number = Math.random): WaterFigure {
  const rich = 0.5 + q;
  const main = waterFigure(l.burst, l, rich, rnd);
  const gusts: Gust[] = [{ t: 0, x: 0, y: 0, r: 16, rate: 16 }, { t: 0, x: 0, y: 0, r: 14, a: 0.35, b: 0.35 }, ...main.gusts];
  let lasts = main.lasts;
  if (l.echo) {
    const echo = waterFigure(l.echo, l, rich * 0.5, rnd, 0.65);
    for (const e of echo.gusts) gusts.push({ ...e, t: e.t + 0.35, a: e.a && e.a * 0.6, b: e.b && e.b * 0.6 });
    lasts = Math.max(lasts, echo.lasts + 0.35);
  }
  return { gusts, lift: main.lift, lasts };
}

// ----- the beats of the dancers ----- //

/** a dancer, as the water feels it: where it is and goes (px per step), where its tail is and goes, how it beats */
export interface Beater {
  mode: SwimMode;
  x: number; y: number; vx: number; vy: number;
  /** the tip of its trunk */
  tx: number; ty: number; tvx: number; tvy: number;
  /** its power stroke (jets and bells, 0..1) */
  stroke: number;
  /** its length (px) */
  size: number;
}

/** what a dancer remembers of its last beat */
export interface Beat { side: number; stroke: number; sweep: Pt; wait: number; }
export const newBeat = (): Beat => ({ side: 0, stroke: 0, sweep: { x: 0, y: 0 }, wait: 0 });

/** a beat: its push, and how much light it stirs (the dancer's own ink or the other's is for the caller to say) */
export interface Stroke extends Gust { light: number; }

/**
 * One step of a dancer: a gust when a stroke has just ended, else null. A tail sheds a puff to the side it swept,
 * and a little backward, at the end of each sweep; a bell or a mantle, a jet behind it when its stroke begins; a
 * walker, a puff off the floor now and then as it goes. `k`: how strongly (0..1).
 */
export function beat(d: Beater, st: Beat, k = 1): Stroke | null {
  const sp = Math.hypot(d.vx, d.vy);
  st.wait = Math.max(0, st.wait - 1);
  // its heading: where it goes, or the way its tail trails
  let hx = d.x - d.tx, hy = d.y - d.ty;
  const hl = Math.hypot(hx, hy) || 1;
  hx /= hl; hy /= hl;
  if (d.mode === 'bell' || d.mode === 'jet') {
    const begins = d.stroke > 0.35 && st.stroke <= 0.35;
    st.stroke = d.stroke;
    if (!begins || st.wait) return null;
    st.wait = 12;
    // the jet leaves the back of the bell, the way it does not go
    const r = Math.max(10, Math.min(24, d.size * 0.35)), v = (2.2 + 1.4 * Math.min(1, sp / 2)) * k;
    return { t: 0, x: d.x - hx * d.size * 0.4, y: d.y - hy * d.size * 0.4, r, vx: -hx * v, vy: -hy * v, light: 0.3 * k };
  }
  if (d.mode === 'crawl') {
    if (st.wait || sp < 0.3) return null;
    st.wait = 24;
    return { t: 0, x: d.x - hx * d.size * 0.3, y: d.y + d.size * 0.2, r: 12, vx: -hx * 0.8 * k, vy: -1.2 * k, light: 0.25 * k };
  }
  // a tail: the side it sweeps across the heading
  const rx = d.tvx - d.vx, ry = d.tvy - d.vy, lat = rx * -hy + ry * hx;
  const side = lat > 0.05 ? 1 : lat < -0.05 ? -1 : st.side;
  // the sweep so far (px per step), which the puff carries on
  st.sweep.x = st.sweep.x * 0.8 + rx * 0.2; st.sweep.y = st.sweep.y * 0.8 + ry * 0.2;
  const turned = side !== st.side && st.side !== 0;
  const was = st.side;
  st.side = side;
  if (!turned || st.wait) return null;
  st.wait = 6;
  // to the side it swept (the side it came from), and a little backward: a fish's wake goes the other way
  const v = Math.min(3, 0.6 + Math.hypot(st.sweep.x, st.sweep.y) * 1.5 + sp * 0.5) * k;
  const lx = -hy * was, ly = hx * was;
  return { t: 0, x: d.tx, y: d.ty, r: Math.max(8, Math.min(16, d.size * 0.2)), vx: (lx * 0.9 - hx * 0.6) * v, vy: (ly * 0.9 - hy * 0.6) * v, light: 0.2 * k };
}

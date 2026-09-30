// La parade (docs/mecaniques.md, « La parade »): about twenty seconds of swimming together with a partner of the
// chapter. The partner leads a figure of eight around where we met; we follow it without losing it, pass in its
// wake, turn with it. It never fails: it lasts its time, the partner waits for us when we fall behind, and it gives
// a quality from 0 to 1 that the litter reads. Pure: the game drives it (parade-jeu.ts).

import { STEP, clamp } from '../engine';

/** length of the parade (s) */
export const PARADE_TIME = 20;
/** closer than this to a partner, and it notices us */
export const START_NEAR = 130;
/** time to stay near it before it starts to dance (s) */
export const START_HOLD = 1.2;
/** the figure of eight: half width and half height */
export const FIG_W = 240, FIG_H = 95;
/** how much of the partner's recent path counts as its wake (steps) */
const TRAIL = 90, WAKE_FROM = 18, HEADING = 12;
/** weights of the three ways of dancing well */
export const WEIGHTS = { follow: 0.4, wake: 0.3, turn: 0.3 };

export interface Pt { x: number; y: number; }
export interface Mover extends Pt { vx: number; vy: number; }
export interface Parts { follow: number; wake: number; turn: number; }

export interface Parade {
  /** time since it started (s) */
  time: number;
  /** where the figure is centred, and which way it starts */
  ax: number; ay: number; dir: 1 | -1;
  /** the figure, relative to its centre, and the distance along it where the partner is led */
  fig: Pt[]; len: number; s: number;
  /** distance along the figure per step, at full pace */
  pace: number;
  /** the partner's last positions (a ring of x, y) */
  trail: Float32Array; head: number; filled: number;
  /** sums of the samples: the score and each part */
  sum: number; n: number; parts: Parts;
  /** the score of the last moments (0..1), for the lights */
  sync: number;
  done: boolean;
}

const smooth = (a: number, b: number, x: number) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

/** a figure of eight around (0, 0), starting at its crossing, toward dir and upward; closed (last point = first) */
export function figure(dir: 1 | -1, w = FIG_W, h = FIG_H, n = 120): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * Math.PI * 2;
    pts.push({ x: dir * w * Math.sin(u), y: -h * Math.sin(2 * u) });
  }
  return pts;
}

function pathLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return l;
}

/** the point at distance s along a closed polyline of length len (s wraps) */
export function along(pts: Pt[], len: number, s: number): Pt {
  let r = ((s % len) + len) % len;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y);
    if (r <= d) { const k = d ? r / d : 0; return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; }
    r -= d;
  }
  return { ...pts[pts.length - 1] };
}

/**
 * A parade begins where the partner is; its figure starts away from the swimmer, so that we find ourselves behind it.
 * pace: the partner's own ease (distance along the figure per step).
 */
export function newParade(partner: Pt, swimmer: Pt, pace: number): Parade {
  const dir: 1 | -1 = partner.x >= swimmer.x ? 1 : -1, fig = figure(dir);
  const trail = new Float32Array(TRAIL * 2);
  return {
    time: 0, ax: partner.x, ay: partner.y, dir, fig, len: pathLength(fig), s: 0, pace,
    trail, head: 0, filled: 0, sum: 0, n: 0, parts: { follow: 0, wake: 0, turn: 0 }, sync: 0, done: false
  };
}

/** where the partner is led now */
export function lead(p: Parade): Pt {
  const q = along(p.fig, p.len, p.s);
  return { x: p.ax + q.x, y: p.ay + q.y };
}

/** the partner's position k steps ago (k < filled) */
function trailAt(p: Parade, k: number): Pt {
  const i = (p.head - 1 - k + TRAIL) % TRAIL;
  return { x: p.trail[i * 2], y: p.trail[i * 2 + 1] };
}

/**
 * How well we dance with it right now, each part from 0 to 1:
 * follow, near it without losing it; wake, where it passed a moment ago; turn, going the way it goes.
 */
export function sample(p: Parade, partner: Mover, swimmer: Mover): Parts {
  const d = Math.hypot(partner.x - swimmer.x, partner.y - swimmer.y);
  const follow = 1 - smooth(120, 360, d);
  let dmin = Infinity;
  for (let k = WAKE_FROM; k < p.filled; k += 3) {
    const q = trailAt(p, k);
    dmin = Math.min(dmin, Math.hypot(q.x - swimmer.x, q.y - swimmer.y));
  }
  const wake = 1 - smooth(35, 120, dmin);
  // its heading over the last moments (a walker's body sways from step to step)
  let pvx = partner.vx, pvy = partner.vy;
  if (p.filled > HEADING) { const q = trailAt(p, HEADING - 1); pvx = (partner.x - q.x) / HEADING; pvy = (partner.y - q.y) / HEADING; }
  const sp = Math.hypot(pvx, pvy), ss = Math.hypot(swimmer.vx, swimmer.vy);
  // when it hardly moves there is no way to turn with it: being near is enough
  const turn = sp < 0.25 ? follow
    : clamp((pvx * swimmer.vx + pvy * swimmer.vy) / (sp * ss + 1e-6), 0, 1) * clamp(ss / (0.5 * sp), 0, 1);
  return { follow, wake, turn };
}

export const scoreOf = (s: Parts) => WEIGHTS.follow * s.follow + WEIGHTS.wake * s.wake + WEIGHTS.turn * s.turn;

/**
 * One step of the parade: scores the moment, then leads the partner on. Returns the velocity the partner steers
 * toward. The lead waits when the partner lags behind it, and slows down when we are far: we can always catch up.
 */
export function stepParade(p: Parade, partner: Mover, swimmer: Mover, dt = STEP): Pt {
  if (p.done) return { x: 0, y: 0 };
  p.time += dt;
  const s = sample(p, partner, swimmer), sc = scoreOf(s);
  p.sum += sc; p.n++;
  p.parts.follow += s.follow; p.parts.wake += s.wake; p.parts.turn += s.turn;
  p.sync += (sc - p.sync) * 0.05;
  p.trail[p.head * 2] = partner.x; p.trail[p.head * 2 + 1] = partner.y;
  p.head = (p.head + 1) % TRAIL; p.filled = Math.min(TRAIL, p.filled + 1);
  if (p.time >= PARADE_TIME) p.done = true;

  let g = lead(p);
  const lag = Math.hypot(g.x - partner.x, g.y - partner.y), far = Math.hypot(partner.x - swimmer.x, partner.y - swimmer.y);
  const k = (lag > 90 ? 0.15 : 1) * (1 - 0.85 * smooth(260, 520, far));
  p.s += p.pace * k * (dt / STEP);
  g = lead(p);
  const dx = g.x - partner.x, dy = g.y - partner.y, d = Math.hypot(dx, dy) || 1, v = p.pace * 1.3 * Math.min(1, d / 50);
  return { x: (dx / d) * v, y: (dy / d) * v };
}

/** the quality of the parade so far, from 0 to 1 */
export function quality(p: Parade): number {
  return p.n ? clamp(p.sum / p.n, 0, 1) : 0;
}

/** the mean of each part so far */
export function partsOf(p: Parade): Parts {
  const n = p.n || 1;
  return { follow: p.parts.follow / n, wake: p.parts.wake / n, turn: p.parts.turn / n };
}

/** the partner notices us: time spent near it, that fades when we leave (s) */
export function approach(hold: number, dist: number, dt = STEP): number {
  return dist < START_NEAR ? hold + dt : Math.max(0, hold - dt * 2);
}

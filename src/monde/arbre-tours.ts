// The tricks of the living portraits of the lineage tree (arbre-vivant.ts): gentle and a little silly, nothing the
// animals do in the sea (vie.ts). A somersault, a cartoon hop that squashes and stretches, a peekaboo out of the
// medallion and back in from the other side, bubbles blown at us, a pose for the photo, a nap with a start,
// a pirouette, the giggle of a portrait touched, and the hop of the wave of light that runs down the thread. Now
// and then the whole family on screen poses together for the photo.
//
// Each trick is a pose over its own time u (0..1) that starts and ends at rest. Pure: the screen is arbre-vivant.ts.

import { TAU, clamp } from '../engine';

export type Gait = 'glide' | 'bell' | 'jet' | 'crawl';
export type TourId = 'culbute' | 'bond' | 'coucou' | 'bulles' | 'pose' | 'sieste' | 'toupie' | 'rire' | 'vague';

export interface Pose {
  /** how fast it swims on the spot (the portrait follows it): 1 as at rest, 0 still, more to dash */
  swim: number;
  /** the heading it turns to on the spot (0 faces right, −π/2 the eye); none: it swims its own way */
  yaw?: number;
  /** the drawing in its medallion: offset (fractions of its width and height), roll (rad), squash and stretch */
  dx: number; dy: number; roll: number; sx: number; sy: number;
  /** how fast its body moves: 1 as in the sea */
  tempo: number;
}

export interface Tour {
  /** seconds */
  dur: number;
  pose(u: number, g: Gait): Pose;
  /** the bubbles it blows from its mouth: when (u) and how big (px, in a portrait of 88 px) */
  puffs?: readonly (readonly [number, number])[];
}

export const REST: Readonly<Pose> = { swim: 1, dx: 0, dy: 0, roll: 0, sx: 1, sy: 1, tempo: 1 };

const ease = (x: number) => { const v = clamp(x, 0, 1); return v * v * (3 - 2 * v); };
/** 0 at a, rising to 1, back to 0 at b */
const hump = (u: number, a: number, b: number) => (u <= a || u >= b ? 0 : Math.sin((Math.PI * (u - a)) / (b - a)));
const ramp = (u: number, a: number, b: number) => ease((u - a) / (b - a));
const rest = (o: Partial<Pose>): Pose => ({ ...REST, ...o });

/** a hop: crouch, take off stretched, fly, land squashed, wobble; `h` its height (fraction of the medallion) */
function hop(u: number, h: number, a = 0.22, b = 0.72): Pose {
  const air = u > a && u < b ? (u - a) / (b - a) : -1;
  const up = air >= 0 ? 4 * air * (1 - air) : 0;
  const crouch = hump(u, 0, a + 0.04), stretch = hump(u, a - 0.02, a + 0.2), land = hump(u, b - 0.04, b + 0.14);
  const w = u > b + 0.14 ? (u - b - 0.14) / (1 - b - 0.14) : 0;
  const wobble = w > 0 ? 0.04 * Math.sin(w * 3 * Math.PI) * (1 - w) : 0;
  const sy = 1 - 0.14 * crouch + 0.12 * stretch - 0.16 * land + wobble;
  return rest({ swim: 0.6, dy: 0.04 * (crouch + land) - h * up, sy, sx: 1 + (1 - sy) * 0.7, tempo: 1 + 0.5 * up });
}

export const TOURS: Record<TourId, Tour> = {
  /** a slow loop on itself, nose up first; it rises a little and swims into it */
  culbute: {
    dur: 2.6,
    pose: (u) => rest({ swim: 1 + 1.4 * hump(u, 0.1, 0.85), dy: -0.1 * hump(u, 0.05, 0.95), roll: -TAU * ramp(u, 0.1, 0.85), tempo: 1.2 }),
    puffs: [[0.9, 3.5]]
  },
  /** a cartoon hop: squashes, stretches, lands with a puff */
  bond: { dur: 1.8, pose: (u) => hop(u, 0.3), puffs: [[0.72, 2.8], [0.75, 2.2]] },
  /** off the medallion on its side, back in from the other: it peeks a moment, turned to us, then comes home */
  coucou: {
    dur: 4.6,
    pose: (u) => {
      if (u < 0.3) { const x = u / 0.3; return rest({ swim: 1 + 2 * x, dx: 1.05 * x * x }); }
      if (u < 0.42) return rest({ swim: 2, dx: 1.05 });
      if (u < 0.6) return rest({ swim: 1, dx: -1.05 + 0.72 * ease((u - 0.42) / 0.18) });
      if (u < 0.76) return rest({ swim: 0, dx: -0.33, yaw: -0.6 * hump(u, 0.6, 0.76) });
      return rest({ swim: 1, dx: -0.33 * (1 - ease((u - 0.76) / 0.24)) });
    }
  },
  /** turned a little to us, it blows bubbles, the last one bigger */
  bulles: {
    dur: 3,
    pose: (u, g) => {
      const blow = [0.25, 0.38, 0.5, 0.62, 0.78].reduce((s, p) => s + hump(u, p - 0.05, p + 0.05), 0);
      return rest({ swim: 0.3, yaw: u > 0.06 && u < 0.9 && g !== 'bell' ? -0.7 : undefined, sx: 1 + 0.05 * blow, sy: 1 - 0.04 * blow, tempo: 0.8 });
    },
    puffs: [[0.25, 2.2], [0.38, 2.6], [0.5, 3.2], [0.62, 2.2], [0.78, 4.6]]
  },
  /** the family photo: it faces us, a little bounce for the picture, then back to its own way */
  pose: {
    dur: 3.4,
    pose: (u) => {
      const smile = hump(u, 0.45, 0.62);
      return rest({ swim: 0.2, yaw: u > 0.05 && u < 0.85 ? -Math.PI / 2 : undefined, dy: -0.04 * smile, sx: 1 + 0.06 * smile, sy: 1 - 0.05 * smile });
    }
  },
  /** it dozes off, head drooping, sinks a little and breathes slowly; then wakes with a start */
  sieste: {
    dur: 7,
    pose: (u) => {
      const doze = ramp(u, 0, 0.18) * (1 - ramp(u, 0.8, 0.86)), start = hump(u, 0.8, 0.9);
      const breath = 0.03 * Math.sin(TAU * 3 * u) * doze;
      return rest({
        swim: 1 - 0.85 * doze, dy: 0.1 * doze - 0.08 * start, roll: 0.3 * doze, tempo: 1 - 0.7 * doze + 1.2 * start,
        sy: 1 + breath + 0.1 * start, sx: 1 - breath * 0.6 - 0.06 * start
      });
    },
    puffs: [[0.3, 1.8], [0.45, 2.2], [0.6, 1.8], [0.72, 2.4]]
  },
  /** a pirouette on the spot; a bell, which has no side to turn, sways instead */
  toupie: {
    dur: 3,
    pose: (u, g) => g === 'bell'
      ? rest({ swim: 0.6, roll: 0.3 * Math.sin(TAU * 2 * u) * hump(u, 0, 1), dy: -0.05 * hump(u, 0, 1), tempo: 1.2 })
      : rest({ swim: 0.2, yaw: u < 0.95 ? -TAU * ramp(u, 0.05, 0.9) : undefined, dy: -0.06 * hump(u, 0.05, 0.9), tempo: 1.2 })
  },
  /** touched: it giggles, wriggling fast, a little shake and a little hop */
  rire: {
    dur: 1.6,
    pose: (u) => {
      const sq = hump(u, 0, 0.2);
      return rest({
        swim: 0.5, tempo: 1 + 2.2 * (1 - ramp(u, 0.4, 1)), dx: 0.035 * Math.sin(TAU * 7 * u) * (1 - u), dy: -0.07 * hump(u, 0.05, 0.45),
        sx: 1 + 0.08 * sq, sy: 1 - 0.08 * sq
      });
    },
    puffs: [[0.1, 2], [0.18, 2.5], [0.3, 2]]
  },
  /** the light runs down the thread: each one hops as it passes */
  vague: { dur: 1.1, pose: (u) => hop(u, 0.14, 0.18, 0.7), puffs: [[0.72, 2]] }
};

/** the tricks each plays by itself (the giggle and the wave come from outside) */
export const REPERTOIRE: Record<Gait, readonly TourId[]> = {
  glide: ['culbute', 'bond', 'coucou', 'bulles', 'pose', 'sieste', 'toupie'],
  jet: ['culbute', 'bond', 'coucou', 'bulles', 'pose', 'sieste', 'toupie'],
  bell: ['culbute', 'bond', 'coucou', 'bulles', 'sieste', 'toupie'],
  crawl: ['bond', 'coucou', 'bulles', 'pose', 'sieste', 'toupie', 'culbute']
};

/** how a species moves, for its tricks */
export function gaitOf(mode: string): Gait {
  return mode === 'bell' || mode === 'jet' || mode === 'crawl' ? mode : 'glide';
}

/** the next trick of a portrait: one of its repertoire, never the one it just played */
export function nextTour(g: Gait, last: TourId | null, rnd: () => number): TourId {
  const list = REPERTOIRE[g].filter((t) => t !== last);
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}

/** seconds of rest before a portrait's next trick */
export const restBetween = (rnd: () => number) => 5 + rnd() * 7;

/** at most this many tricks at once among the portraits on screen: the tree stays calm */
export const MAX_BUSY = 2;

/** seconds before the family photo: soon after the tree opens, then now and then */
export const photoAfter = (first: boolean, rnd: () => number) => (first ? 14 + rnd() * 6 : 40 + rnd() * 30);

/** what each does for the family photo: it faces us; a bell, which has no face to turn, hops */
export const photoTour = (g: Gait): TourId => (g === 'bell' ? 'vague' : 'pose');

/** when the family faces us, in the photo trick (s): the flash */
export const PHOTO_FLASH = TOURS.pose.dur * 0.5;

/** the pose of a trick under way (u past 1: at rest) */
export function poseOf(id: TourId, u: number, g: Gait): Pose {
  return u >= 1 || u < 0 ? { ...REST } : TOURS[id].pose(u, g);
}

/** seconds for the light to run down a thread of this many medallions: quick for a short lineage, never long */
export const olaDuration = (n: number) => clamp(0.35 * n, 1, 4.5);

/** when the light reaches a medallion at height y, running from y0 to y1 in `dur` seconds */
export function olaAt(y: number, y0: number, y1: number, dur: number): number {
  return y1 > y0 ? dur * clamp((y - y0) / (y1 - y0), 0, 1) : 0;
}

/**
 * How much smaller a drawing of bw × bh, fitted to w × h, must be to stay inside once rolled by `roll`
 * (1: as it is).
 */
export function rollFit(bw: number, bh: number, w: number, h: number, roll: number): number {
  const c = Math.abs(Math.cos(roll)), s = Math.abs(Math.sin(roll));
  const fit0 = Math.min(w / bw, h / bh), fit = Math.min(w / (c * bw + s * bh), h / (s * bw + c * bh));
  return Math.min(1, fit / fit0);
}

// Defaults, normalisation, palettes and attachment patterns.

import type {
  AttDef, AttInput, ColorDef, MotionDef, NodeDef, NodeInput, PaletteDef, PaletteSlot, Spec, SpecInput, Harmony
} from './types';
import { TAU, clamp, hash, lerp } from './util';

// profiles: radius along the chain, t = 0 (base) → 1 (tip), max ≈ 1
// the first ones come from whip.js, normalised so that "width" is the max radius
export const SHAPES: Record<string, (w: number, t: number) => number> = {
  constant: (w) => w,
  linear: (w, t) => w * (1 - t * 0.9),
  worm: (w, t) => (w * (Math.sin(t * Math.PI) / 3 + 1)) / 1.334,
  virgule: (w, t) => (w * (Math.cos(t * Math.PI) + 1)) / 2,
  sansue: (w, t) => (w * (Math.sin(-0.5 + t * Math.PI * 1.5) + 1)) / 2,
  sansueBigHead: (w, t) => (w * (Math.sin(t * Math.PI * 1.5) + 1)) / 2,
  bloby: (w, t) => (w * (Math.sin(t) / 3 + 1)) / 1.281,
  spindle: (w, t) => w * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * t)), 0.7),
  tadpole: (w, t) => w * Math.max(0.1, 1 - 0.9 * Math.pow(t, 0.8)),
  leaf: (w, t) => w * Math.sin(Math.PI * (0.1 + 0.9 * t)),
  bell: (w, t) => w * (0.3 + 0.7 * Math.sqrt(t)),
  carapace: (w, t) => (t < 0.35 ? w * (0.8 + 0.2 * Math.sin(((t / 0.35) * Math.PI) / 2)) : w * (1 - (0.62 * (t - 0.35)) / 0.65)),
  frill: (w, t) => w * (0.62 + 0.38 * Math.sin(t * Math.PI * 7)) * (1 - 0.5 * t),
  club: (w, t) => w * (0.3 + 0.8 * Math.exp(-Math.pow((t - 0.86) / 0.1, 2))),
  bulb: (w, t) => w * (0.22 + 0.9 * Math.exp(-Math.pow((1 - t) / 0.16, 2))),
  gourd: (w, t) =>
    w * Math.max(0.12, 0.7 * Math.exp(-Math.pow(t / 0.09, 2)) + 0.9 * Math.exp(-Math.pow((t - 0.32) / 0.15, 2)) + 0.25 * (1 - t))
};

const NODE_DEFAULTS = {
  name: 'Partie', role: 'deco', drive: 'none', links: 8, len: 6, width: 3, shape: 'worm', style: 'ribbon',
  flex: 0.5, spring: 0.1, curl: 0, curlBias: 0, drag: 0.84, gravity: 0, lenTo: 1
} as const;
const COLOR_DEFAULTS: ColorDef = {
  slot: 0, shift: 0, light: 0, grad: 0, alpha: 1, fade: 0, glow: 'none', add: false,
  pattern: 'none', pslot: 3, plight: 0, pdensity: 6, pscale: 1
};
const MOTION_DEFAULTS: MotionDef = { type: 'none', amp: 0.3, freq: 1, wave: 1 };
const ATT_DEFAULTS = {
  pattern: 'single', at: 0.5, to: 0.9, count: 4, angle: 1.2, angleTo: null, spread: 0.8,
  edge: 0, scale: 1, scaleTo: 1, phaseStep: 0.5, mirror: true, front: false,
  alternate: false, jitter: 0, web: 0, hueStep: 0
} as const;

export function node(o: NodeInput = {}): NodeDef {
  const n = { ...NODE_DEFAULTS, ...o } as NodeDef;
  n.color = { ...COLOR_DEFAULTS, ...o.color };
  n.motion = { ...MOTION_DEFAULTS, ...o.motion };
  n.attach = (o.attach || []).map(att);
  n.links = clamp(Math.round(n.links), 1, 60);
  return n;
}

export function att(o: AttInput = {}): AttDef {
  const a = { ...ATT_DEFAULTS, ...o } as AttDef;
  a.node = node(o.node);
  if (a.angleTo === undefined) a.angleTo = null;
  a.count = clamp(Math.round(a.count), 1, 40);
  return a;
}

export function spec(o: SpecInput = {}): Spec {
  const s: Spec = {
    v: 2,
    name: o.name || 'Espèce',
    size: o.size || 1,
    palette: { hue: 180, harmony: 'analog', sat: 70, light: 55, ...o.palette },
    swim: { mode: 'steady', speed: 2, freq: 1, ...o.swim },
    ai: o.ai || 'hunter',
    eyes: { on: true, size: 1, spread: 0.55, fwd: 0.35, ...o.eyes },
    body: node({ role: 'body', ...o.body })
  };
  if (o.gen) s.gen = { ...o.gen };
  return s;
}

export function walkNodes(n: NodeDef, fn: (n: NodeDef, depth: number, parent: AttDef | null) => void, depth = 0, parentAtt: AttDef | null = null): void {
  fn(n, depth, parentAtt);
  n.attach.forEach((a) => walkNodes(a.node, fn, depth + 1, a));
}

// ----- palette: 4 harmonious slots per species ----- //

export const HARMONIES: Record<Harmony, number[]> = {
  analog: [0, 28, -28, 56],
  complement: [0, 180, 24, 204],
  triad: [0, 120, 240, 60],
  split: [0, 150, 210, 30],
  mono: [0, 0, 0, 0]
};

export function palette(p: PaletteDef): PaletteSlot[] {
  const off = HARMONIES[p.harmony] || HARMONIES.analog, mono = p.harmony === 'mono';
  return off.map((o, i) => ({
    h: (((p.hue + o) % 360) + 360) % 360,
    s: clamp(p.sat - (mono ? 0 : i * 5), 0, 100),
    l: clamp(p.light + (mono ? [0, 14, -14, 26] : [0, 6, -6, 10])[i], 4, 96)
  }));
}

// ----- patterns → copies ----- //

export interface Slot {
  at: number; angle: number; scale: number; phase: number; side: number; edge: number;
  k: number; hue: number; radial: boolean;
}

export const ROOT_SLOT: Slot = { at: 0, angle: 0, scale: 1, phase: 0, side: 1, edge: 0, k: 0, hue: 0, radial: false };

export function expand(a: AttDef, n: number): Slot[] {
  const out: Slot[] = [], c = Math.max(1, a.count), j = a.jitter || 0;
  const angleTo = a.angleTo === null ? a.angle : a.angleTo;
  // hk, hs: the key and the side of the variation (a centered fan varies by mirror pairs, about its middle)
  const push = (t: number, angle: number, scale: number, phase: number, side: number, edge: number, k: number, hk = k, hs = side) => {
    if (j) {
      // natural variation, identical on both sides of a mirror
      angle += hs * (hash(hk, 1) - 0.5) * 0.7 * j;
      scale *= 1 + (hash(hk, 2) - 0.5) * 0.5 * j;
      phase += hash(hk, 3) * TAU * j;
    }
    out.push({ at: clamp(Math.round(t * n), 0, n), angle, scale, phase, side, edge, k, hue: k * (a.hueStep || 0), radial: a.pattern === 'ring' });
  };
  if (a.pattern === 'pair') {
    push(a.at, a.angle, a.scale, 0, 1, a.edge, 0);
    push(a.at, -a.angle, a.scale, 0, -1, -a.edge, 0);
  } else if (a.pattern === 'fan') {
    const mirrored = fanMirrored(a);
    for (let k = 0; k < c; k++) {
      const f = c === 1 ? 0.5 : k / (c - 1);
      const sc = lerp(a.scale, a.scaleTo, Math.abs(f - 0.5) * 2);
      const an = a.angle + a.spread * (f - 0.5), ed = a.edge * (f - 0.5) * 2;
      if (mirrored) {
        push(a.at, an, sc, k * a.phaseStep, 1, ed, k);
        push(a.at, -an, sc, k * a.phaseStep, -1, -ed, k);
      } else push(a.at, an, sc, k * a.phaseStep, 1, ed, k, pairOf(c, k), Math.sign(f - 0.5));
    }
  } else if (a.pattern === 'ring') {
    for (let k = 0; k < c; k++) {
      const ra = (k * TAU) / c;
      push(a.at, a.angle + ra, lerp(a.scale, a.scaleTo, (1 - Math.cos(ra)) / 2), k * a.phaseStep, 1, a.edge, k);
    }
  } else if (a.pattern === 'series') {
    for (let k = 0; k < c; k++) {
      const f = c === 1 ? 0 : k / (c - 1);
      const t = lerp(a.at, a.to, f), s = lerp(a.scale, a.scaleTo, f), g = lerp(a.angle, angleTo, f);
      if (a.alternate) {
        const sd = k % 2 ? -1 : 1;
        push(t, sd * g, s, k * a.phaseStep, sd, sd * a.edge, k);
      } else {
        push(t, g, s, k * a.phaseStep, 1, a.edge, k);
        if (a.mirror) push(t, -g, s, k * a.phaseStep, -1, -a.edge, k);
      }
    }
  } else {
    push(a.at, a.angle, a.scale, 0, 1, a.edge, 0);
  }
  return out;
}

/** a fan copied on both sides of its parent; otherwise it is centered on its angle, symmetric about its middle */
export const fanMirrored = (a: AttDef) => a.mirror && Math.abs(Math.sin(a.angle)) > 0.05;

/** the rank of copy k of a row of c from the nearest end: the two copies of a mirror pair of a centered fan share it */
export const pairOf = (c: number, k: number) => Math.min(k, c - 1 - k);

/**
 * The copies left out when a long row is thinned out (the smallest level of
 * detail): every other one, by mirror pairs so that what stays is as
 * symmetric as the whole: both ends of a centered fan, both sides of an
 * alternate row.
 */
export function thinnedOut(a: AttDef, k: number): boolean {
  if (a.pattern === 'fan' && !fanMirrored(a)) return pairOf(Math.max(1, a.count), k) % 2 === 1;
  if (a.pattern === 'series' && a.alternate) return (k >> 1) % 2 === 1;
  return k % 2 === 1;
}

/** a centered fan hanging from a bell, down its axis: it hangs all round the rim (see rimOf) */
export const onRim = (parent: NodeDef, a: AttDef) =>
  parent.shape === 'bell' && a.pattern === 'fan' && !fanMirrored(a) && Math.abs(Math.sin(a.angle)) <= 0.05 && Math.cos(a.angle) > 0;

/**
 * Copy k of a centered fan that hangs from the rim of a bell: a cone. It sits
 * on the rim where it shows at its place across the fan when the bell is seen
 * from the side (u, -1..1), in front of the bell (back -1) or behind it (back
 * 1) by mirror pairs, and opens outward by half the spread: from the side it
 * is the fan as drawn, and it stays symmetric whichever way the bell leans.
 */
export function rimOf(a: AttDef, k: number): { u: number; back: number; open: number } {
  const c = Math.max(1, a.count), d = pairOf(c, k);
  // pairs in front and behind in turn, two by two, so that thinning out every other pair keeps both
  return { u: c === 1 ? 0 : (2 * k) / (c - 1) - 1, back: ((d + 1) >> 1) % 2 ? -1 : 1, open: a.spread / 2 };
}

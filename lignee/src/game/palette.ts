// Chapter moods: every colour of the scene comes from here, blended along x
// so that one chapter flows into the next.

import { clamp, lerp, lerpHue } from '../engine';

export interface HSL { h: number; s: number; l: number; }

export interface Mood {
  name: string;
  /** water just under the surface, and far down */
  top: HSL; deep: HSL;
  /** light coming through the surface */
  sky: HSL;
  sand: HSL; rock: HSL;
  /** accents painted on the terrain (coralline, sponges, polyps) */
  accents: HSL[];
  /** blades of the carpet vegetation */
  blades: HSL[];
  rays: number; caustics: number; plankton: HSL;
}

export const MOODS: Mood[] = [
  {
    name: 'La Nurserie',
    top: { h: 178, s: 70, l: 58 }, deep: { h: 200, s: 75, l: 20 },
    sky: { h: 52, s: 95, l: 86 },
    sand: { h: 44, s: 55, l: 70 }, rock: { h: 30, s: 18, l: 44 },
    accents: [{ h: 88, s: 45, l: 42 }, { h: 44, s: 70, l: 58 }, { h: 160, s: 40, l: 45 }],
    blades: [{ h: 78, s: 50, l: 42 }, { h: 92, s: 45, l: 36 }, { h: 60, s: 55, l: 48 }, { h: 110, s: 35, l: 32 }],
    rays: 1, caustics: 1, plankton: { h: 50, s: 80, l: 85 }
  },
  {
    name: 'Le Récif',
    top: { h: 192, s: 78, l: 50 }, deep: { h: 214, s: 80, l: 16 },
    sky: { h: 190, s: 80, l: 88 },
    sand: { h: 38, s: 40, l: 72 }, rock: { h: 14, s: 22, l: 40 },
    accents: [{ h: 340, s: 70, l: 62 }, { h: 18, s: 85, l: 60 }, { h: 280, s: 55, l: 58 }, { h: 48, s: 90, l: 60 }, { h: 170, s: 60, l: 50 }],
    blades: [{ h: 330, s: 65, l: 60 }, { h: 20, s: 80, l: 58 }, { h: 285, s: 50, l: 60 }, { h: 160, s: 45, l: 45 }],
    rays: 0.8, caustics: 0.9, plankton: { h: 190, s: 60, l: 88 }
  }
];

/** where each chapter starts along x (world px) */
export const CHAPTER_X = [0, 7000];
const BLEND = 1400;

function mixHSL(a: HSL, b: HSL, t: number): HSL {
  return { h: lerpHue(a.h, b.h, t), s: lerp(a.s, b.s, t), l: lerp(a.l, b.l, t) };
}

/** chapter index and blend factor toward the next one */
export function chapterAt(x: number): { i: number; t: number } {
  for (let k = 1; k < CHAPTER_X.length; k++) {
    if (Math.abs(x - CHAPTER_X[k]) < BLEND / 2) {
      const t = (x - CHAPTER_X[k] + BLEND / 2) / BLEND;
      return { i: k - 1, t: t * t * (3 - 2 * t) };
    }
  }
  let i = 0;
  while (i + 1 < CHAPTER_X.length && x >= CHAPTER_X[i + 1]) i++;
  return { i, t: 0 };
}

export function moodAt(x: number): Mood {
  const { i, t } = chapterAt(x);
  const a = MOODS[i];
  if (!t) return a;
  const b = MOODS[Math.min(MOODS.length - 1, i + 1)];
  const pick = (k: number, la: HSL[], lb: HSL[]) => mixHSL(la[k % la.length], lb[k % lb.length], t);
  const n = Math.max(a.accents.length, b.accents.length), m = Math.max(a.blades.length, b.blades.length);
  return {
    name: t < 0.5 ? a.name : b.name,
    top: mixHSL(a.top, b.top, t), deep: mixHSL(a.deep, b.deep, t), sky: mixHSL(a.sky, b.sky, t),
    sand: mixHSL(a.sand, b.sand, t), rock: mixHSL(a.rock, b.rock, t),
    accents: Array.from({ length: n }, (_, k) => pick(k, a.accents, b.accents)),
    blades: Array.from({ length: m }, (_, k) => pick(k, a.blades, b.blades)),
    rays: lerp(a.rays, b.rays, t), caustics: lerp(a.caustics, b.caustics, t),
    plankton: mixHSL(a.plankton, b.plankton, t)
  };
}

/** colour of the open water at depth y (world px) */
export function waterAt(m: Mood, y: number): HSL {
  const t = 1 - Math.exp(-Math.max(0, y) / 620);
  return mixHSL(m.top, m.deep, t);
}

export function css(c: HSL, a = 1, dl = 0): string {
  return `hsla(${c.h.toFixed(0)},${c.s.toFixed(0)}%,${clamp(c.l + dl, 0, 100).toFixed(1)}%,${a.toFixed(3)})`;
}

function toRgb(c: HSL): [number, number, number] {
  const s = c.s / 100, l = c.l / 100, k = (n: number) => (n + c.h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function toHsl([r, g, b]: [number, number, number]): HSL {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

/** mix in RGB: fog never swings through unrelated hues */
export function mixRgb(a: HSL, b: HSL, t: number): HSL {
  const x = toRgb(a), y = toRgb(b);
  return toHsl([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]);
}

/** c seen through the water at depth y: pulled toward the water colour */
export function fogged(m: Mood, c: HSL, y: number, amount: number): HSL {
  return mixRgb(c, waterAt(m, y), clamp(amount, 0, 1));
}

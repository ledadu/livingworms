// Colours of the water: every biome's mood (biomes.ts) is a set of these, and
// everything far away is pulled toward the colour of the water around it.

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


function mixHSL(a: HSL, b: HSL, t: number): HSL {
  return { h: lerpHue(a.h, b.h, t), s: lerp(a.s, b.s, t), l: lerp(a.l, b.l, t) };
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

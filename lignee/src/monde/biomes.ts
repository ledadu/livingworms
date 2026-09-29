// The big test world of the 2.5D line: six biomes one after the other along x,
// from the sunny Nurserie down the Tombant to the Abysses. Each biome has its
// light (a Mood), its floor, what grows there and who lives there.

import { clamp, lerp, lerpHue, noise1 } from '../engine';
import type { HSL, Mood } from '../game/palette';

export interface Biome extends Mood {
  id: string;
  /** a line under the name when you enter it */
  sub: string;
  /** where it starts along x */
  x0: number;
  /** how dark the water closes around the swimmer (0 = never) */
  dark: number;
  /** marine snow falling (0 = plankton only drifts) */
  snow: number;
  /** how much the rocks are covered with life (the reef look above 0.5) */
  encrust: number;
  /** rocks: mean spacing along x, radius range */
  rocks: { every: number; r: [number, number] };
  /** plants: mean spacing along x, and kinds with their weights */
  flora: { every: number; kinds: [string, number][]; front: [string, number][] };
  /** animals: [species id, 'swim' | 'floor' | 'surface', weight, scale] */
  fauna: [string, 'swim' | 'floor' | 'surface', number, number][];
  /** how many animals live there */
  pop: number;
  /** fish schools: body, belly, count, glowing dots */
  schools: { body: HSL; belly: HSL; n: number; size: number; glow?: boolean }[];
}

export const BIOMES: Biome[] = [
  {
    id: 'nurserie', name: 'La Nurserie', sub: 'herbiers et lumière', x0: -800,
    top: { h: 178, s: 70, l: 58 }, deep: { h: 200, s: 75, l: 20 }, sky: { h: 52, s: 95, l: 86 },
    sand: { h: 44, s: 55, l: 70 }, rock: { h: 30, s: 18, l: 44 },
    accents: [{ h: 88, s: 45, l: 42 }, { h: 44, s: 70, l: 58 }, { h: 160, s: 40, l: 45 }],
    blades: [{ h: 78, s: 50, l: 42 }, { h: 92, s: 45, l: 36 }, { h: 60, s: 55, l: 48 }, { h: 110, s: 35, l: 32 }],
    rays: 1, caustics: 1, plankton: { h: 50, s: 80, l: 85 },
    dark: 0, snow: 0, encrust: 0.1,
    rocks: { every: 240, r: [12, 30] },
    flora: { every: 26, kinds: [['posidonie', 6], ['anemone', 0.4], ['kelp', 0.3]], front: [['posidonie', 5], ['anemone', 0.3]] },
    fauna: [['larve', 'swim', 3, 0.8], ['copepode', 'swim', 2, 0.8], ['krill', 'swim', 2, 0.8], ['meduse', 'swim', 2, 0.7],
      ['ctenophore', 'swim', 1.5, 0.8], ['hippocampe', 'swim', 1.5, 0.8], ['axolotl', 'floor', 1, 0.8], ['tardigrade', 'floor', 1, 0.8],
      ['anguille', 'swim', 1, 0.8]],
    pop: 26,
    schools: [{ body: { h: 200, s: 45, l: 70 }, belly: { h: 210, s: 30, l: 88 }, n: 50, size: 1 }]
  },
  {
    id: 'kelp', name: 'La Forêt de kelp', sub: 'cathédrale d’algues', x0: 3400,
    top: { h: 158, s: 52, l: 46 }, deep: { h: 190, s: 62, l: 15 }, sky: { h: 72, s: 80, l: 80 },
    sand: { h: 40, s: 28, l: 54 }, rock: { h: 95, s: 12, l: 34 },
    accents: [{ h: 350, s: 50, l: 55 }, { h: 80, s: 50, l: 38 }, { h: 45, s: 60, l: 50 }],
    blades: [{ h: 70, s: 45, l: 34 }, { h: 55, s: 50, l: 40 }, { h: 90, s: 40, l: 30 }],
    rays: 1.25, caustics: 0.7, plankton: { h: 70, s: 60, l: 82 },
    dark: 0.05, snow: 0.05, encrust: 0.35,
    rocks: { every: 110, r: [18, 46] },
    flora: { every: 22, kinds: [['kelp', 6], ['posidonie', 1.5], ['anemone', 0.6], ['eponge', 0.6], ['seapen', 0.3]], front: [['posidonie', 2], ['anemone', 0.5], ['eponge', 0.4]] },
    fauna: [['seiche', 'swim', 2, 0.8], ['poulpe', 'floor', 1.5, 0.8], ['homard', 'floor', 1.5, 0.8], ['crabe', 'floor', 2, 0.8],
      ['etoile', 'floor', 1.5, 0.8], ['oursin', 'floor', 1.5, 0.8], ['koi', 'swim', 1.5, 0.8], ['anguille', 'swim', 1.5, 0.8],
      ['verPlat', 'floor', 1, 0.8], ['plumeau', 'floor', 1, 0.8], ['tortue', 'swim', 0.5, 1.2]],
    pop: 30,
    schools: [
      { body: { h: 45, s: 55, l: 58 }, belly: { h: 50, s: 40, l: 80 }, n: 40, size: 1.2 },
      { body: { h: 205, s: 25, l: 72 }, belly: { h: 205, s: 20, l: 90 }, n: 60, size: 0.9 }
    ]
  },
  {
    id: 'recif', name: 'Le Récif', sub: 'la ville de corail', x0: 7400,
    top: { h: 192, s: 78, l: 50 }, deep: { h: 214, s: 80, l: 16 }, sky: { h: 190, s: 80, l: 88 },
    sand: { h: 38, s: 40, l: 72 }, rock: { h: 14, s: 22, l: 40 },
    accents: [{ h: 340, s: 70, l: 62 }, { h: 18, s: 85, l: 60 }, { h: 280, s: 55, l: 58 }, { h: 48, s: 90, l: 60 }, { h: 170, s: 60, l: 50 }],
    blades: [{ h: 330, s: 65, l: 60 }, { h: 20, s: 80, l: 58 }, { h: 285, s: 50, l: 60 }, { h: 160, s: 45, l: 45 }],
    rays: 0.8, caustics: 0.9, plankton: { h: 190, s: 60, l: 88 },
    dark: 0, snow: 0, encrust: 1,
    rocks: { every: 90, r: [16, 44] },
    flora: { every: 22, kinds: [['coral', 3], ['fan', 1.4], ['softcoral', 1.4], ['anemone', 1], ['tubes', 0.8], ['eponge', 0.8], ['seapen', 0.3], ['kelp', 0.2]],
      front: [['coral', 3], ['softcoral', 1.5], ['fan', 1], ['anemone', 0.7], ['tubes', 0.6]] },
    fauna: [['poissonClown', 'swim', 2.5, 0.8], ['poissonLion', 'swim', 1.5, 0.8], ['nudibranche', 'floor', 2, 0.8], ['crevette', 'floor', 2, 0.8],
      ['crevetteMante', 'floor', 1, 0.8], ['combattant', 'swim', 1.2, 0.8], ['dragonFeuillu', 'swim', 1, 0.8], ['hippocampe', 'swim', 1, 0.8],
      ['verDeFeu', 'floor', 1, 0.8], ['etoile', 'floor', 1, 0.8], ['koi', 'swim', 1, 0.8]],
    pop: 34,
    schools: [
      { body: { h: 50, s: 90, l: 58 }, belly: { h: 210, s: 70, l: 60 }, n: 45, size: 1 },
      { body: { h: 195, s: 80, l: 55 }, belly: { h: 190, s: 50, l: 85 }, n: 35, size: 0.8 }
    ]
  },
  {
    id: 'tombant', name: 'Le Tombant', sub: 'le grand bleu s’ouvre', x0: 11400,
    top: { h: 204, s: 85, l: 42 }, deep: { h: 222, s: 85, l: 10 }, sky: { h: 200, s: 80, l: 85 },
    sand: { h: 215, s: 16, l: 44 }, rock: { h: 220, s: 14, l: 30 },
    accents: [{ h: 300, s: 45, l: 52 }, { h: 25, s: 70, l: 55 }, { h: 190, s: 50, l: 52 }],
    blades: [{ h: 200, s: 30, l: 40 }, { h: 280, s: 30, l: 45 }],
    rays: 0.6, caustics: 0.3, plankton: { h: 200, s: 40, l: 86 },
    dark: 0.3, snow: 0.35, encrust: 0.6,
    rocks: { every: 140, r: [18, 56] },
    flora: { every: 40, kinds: [['fan', 3], ['eponge', 2], ['crinoide', 1.6], ['softcoral', 1], ['seapen', 0.8]], front: [['fan', 1], ['eponge', 1]] },
    fauna: [['calmar', 'swim', 2, 0.8], ['chrysaora', 'swim', 2, 0.8], ['physalie', 'surface', 1.2, 0.8], ['siphonophore', 'swim', 1.2, 0.8],
      ['meduse', 'swim', 1.5, 0.7], ['seiche', 'swim', 1, 0.8], ['nautile', 'swim', 1, 0.8], ['manta', 'swim', 0.6, 1.1]],
    pop: 24,
    schools: [
      { body: { h: 210, s: 20, l: 72 }, belly: { h: 210, s: 15, l: 92 }, n: 80, size: 1 },
      { body: { h: 220, s: 50, l: 40 }, belly: { h: 60, s: 60, l: 70 }, n: 30, size: 1.6 }
    ]
  },
  {
    id: 'crepuscule', name: 'Le Crépuscule', sub: 'là où la lumière s’éteint', x0: 14600,
    top: { h: 225, s: 68, l: 22 }, deep: { h: 240, s: 70, l: 5 }, sky: { h: 215, s: 60, l: 55 },
    sand: { h: 230, s: 14, l: 26 }, rock: { h: 240, s: 12, l: 20 },
    accents: [{ h: 190, s: 80, l: 55 }, { h: 280, s: 60, l: 55 }, { h: 330, s: 60, l: 50 }],
    blades: [{ h: 200, s: 40, l: 30 }, { h: 250, s: 30, l: 34 }],
    rays: 0, caustics: 0, plankton: { h: 190, s: 70, l: 82 },
    dark: 0.72, snow: 0.7, encrust: 0.2,
    rocks: { every: 200, r: [16, 40] },
    flora: { every: 48, kinds: [['crinoide', 3], ['seapen', 2.5], ['eponge', 1.5], ['fan', 1]], front: [['seapen', 1], ['crinoide', 1]] },
    fauna: [['grandGosier', 'swim', 1.5, 0.8], ['baudroie', 'swim', 1.5, 0.8], ['meduseBoite', 'swim', 1.5, 0.8], ['clione', 'swim', 2, 0.8],
      ['nautile', 'swim', 1, 0.8], ['krill', 'swim', 2, 0.8], ['ctenophore', 'swim', 1.5, 0.8], ['siphonophore', 'swim', 1, 0.8],
      ['calmar', 'swim', 1, 0.8], ['serpentCilie', 'floor', 1, 0.8], ['ophiure', 'floor', 1, 0.8]],
    pop: 26,
    schools: [{ body: { h: 225, s: 30, l: 35 }, belly: { h: 200, s: 30, l: 55 }, n: 40, size: 0.9, glow: true }]
  },
  {
    id: 'abysses', name: 'Les Abysses', sub: 'fumeurs noirs et silence', x0: 18200,
    top: { h: 250, s: 40, l: 10 }, deep: { h: 258, s: 50, l: 3 }, sky: { h: 20, s: 70, l: 50 },
    sand: { h: 25, s: 12, l: 20 }, rock: { h: 15, s: 10, l: 13 },
    accents: [{ h: 22, s: 90, l: 55 }, { h: 50, s: 20, l: 85 }, { h: 0, s: 80, l: 45 }],
    blades: [{ h: 40, s: 20, l: 60 }, { h: 20, s: 50, l: 45 }],
    rays: 0, caustics: 0, plankton: { h: 40, s: 30, l: 88 },
    dark: 0.86, snow: 1, encrust: 0,
    rocks: { every: 170, r: [18, 44] },
    flora: { every: 56, kinds: [['eponge', 2], ['crinoide', 2], ['anemone', 1], ['seapen', 1]], front: [['anemone', 0.6], ['eponge', 0.6]] },
    fauna: [['ophiure', 'floor', 2, 0.8], ['oursin', 'floor', 1.5, 0.8], ['verDeFeu', 'floor', 1.5, 0.8], ['serpentCilie', 'swim', 1.5, 0.8],
      ['hydre', 'swim', 1.5, 0.8], ['dragonAbyssal', 'swim', 1.2, 0.8], ['baudroie', 'swim', 1, 0.8], ['tardigrade', 'floor', 1, 0.8],
      ['meduseBoite', 'swim', 1, 0.8]],
    pop: 24,
    schools: [{ body: { h: 260, s: 20, l: 30 }, belly: { h: 250, s: 20, l: 50 }, n: 24, size: 1.1, glow: true }]
  }
];

export const X0 = -800, X1 = 22000;
const BLEND = 1400;

function mixHSL(a: HSL, b: HSL, t: number): HSL {
  return { h: lerpHue(a.h, b.h, t), s: lerp(a.s, b.s, t), l: lerp(a.l, b.l, t) };
}

/** biome index at x */
export function biomeIndex(x: number): number {
  let i = 0;
  while (i + 1 < BIOMES.length && x >= BIOMES[i + 1].x0) i++;
  return i;
}
export const biomeAt = (x: number): Biome => BIOMES[biomeIndex(x)];

/** centre of a biome, along x */
export function biomeMid(i: number): number {
  const a = BIOMES[i].x0, b = i + 1 < BIOMES.length ? BIOMES[i + 1].x0 : X1;
  return (Math.max(a, X0 + 400) + b) / 2;
}

/** how much of `id` is at x (0..1), with the same blend as the light */
export function presence(x: number, i: number): number {
  const a = BIOMES[i].x0, b = i + 1 < BIOMES.length ? BIOMES[i + 1].x0 : Infinity;
  const s = (u: number) => clamp(u / BLEND + 0.5, 0, 1);
  return (i === 0 ? 1 : s(x - a)) * (1 - s(x - b));
}

const moodCache = new Map<number, Mood & { dark: number; snow: number }>();

/** the light at x, blended from one biome into the next (cached by 8 px) */
export function moodAt(x: number): Mood & { dark: number; snow: number } {
  const key = Math.round(x / 8);
  let m = moodCache.get(key);
  if (m) return m;
  const i = biomeIndex(x), a = BIOMES[i];
  let j = -1, t = 0;
  if (i + 1 < BIOMES.length && BIOMES[i + 1].x0 - x < BLEND / 2) { j = i + 1; t = 0.5 - (BIOMES[j].x0 - x) / BLEND; }
  else if (i > 0 && x - a.x0 < BLEND / 2) { j = i - 1; t = 0.5 - (x - a.x0) / BLEND; }
  if (j < 0 || t <= 0) m = a;
  else {
    const b = BIOMES[j];
    t = t * t * (3 - 2 * t);
    const n = Math.max(a.accents.length, b.accents.length), k = Math.max(a.blades.length, b.blades.length);
    m = {
      name: t < 0.5 ? a.name : b.name,
      top: mixHSL(a.top, b.top, t), deep: mixHSL(a.deep, b.deep, t), sky: mixHSL(a.sky, b.sky, t),
      sand: mixHSL(a.sand, b.sand, t), rock: mixHSL(a.rock, b.rock, t),
      accents: Array.from({ length: n }, (_, q) => mixHSL(a.accents[q % a.accents.length], b.accents[q % b.accents.length], t)),
      blades: Array.from({ length: k }, (_, q) => mixHSL(a.blades[q % a.blades.length], b.blades[q % b.blades.length], t)),
      rays: lerp(a.rays, b.rays, t), caustics: lerp(a.caustics, b.caustics, t), plankton: mixHSL(a.plankton, b.plankton, t),
      dark: lerp(a.dark, b.dark, t), snow: lerp(a.snow, b.snow, t)
    };
  }
  if (moodCache.size > 6000) moodCache.clear();
  moodCache.set(key, m);
  return m;
}

// ----- the shape of the floor ----- //

/** depth of the floor along the swimming plane: [x, depth] control points, eased between */
const PROFILE: [number, number][] = [
  [X0, 600], [2800, 620], [3800, 690], [7000, 700], [7800, 450], [11100, 440], [11700, 470],
  [12250, 1480], [12900, 1820], [14600, 1980], [17600, 2280], [18600, 2520], [X1, 2560]
];
const smooth = (t: number) => t * t * (3 - 2 * t);

function baseDepth(x: number): number {
  let k = 0;
  while (k + 2 < PROFILE.length && x > PROFILE[k + 1][0]) k++;
  const [xa, ya] = PROFILE[k], [xb, yb] = PROFILE[k + 1];
  return lerp(ya, yb, smooth(clamp((x - xa) / (xb - xa), 0, 1)));
}

/** relief amplitude by biome: dunes, boulder fields, reef heads, ledges, plains */
const HILLS = [60, 90, 70, 110, 80, 50], BUMPS = [10, 30, 60, 50, 30, 36], DUNES = [3, 2, 0, 0, 0, 0];

/** a per-biome value at x, blended across the borders so that nothing steps */
export function blendOf(x: number, v: number[]): number {
  const i = biomeIndex(x);
  let s = 0, w = 0;
  for (let k = Math.max(0, i - 1); k <= Math.min(BIOMES.length - 1, i + 1); k++) { const p = presence(x, k); s += p * v[k]; w += p; }
  return w > 0 ? s / w : v[i];
}

/** depth of the floor (y down) at x and at depth z */
export function floorAt(x: number, z: number): number {
  const hills = (noise1(x / 1300, 1789) - 0.5) * blendOf(x, HILLS) * 2;
  const mid = (noise1(x / 330, 1790) - 0.5) * blendOf(x, BUMPS) * 2;
  // sand ripples in the shallows
  const dunes = Math.sin(x * 0.045 + z * 0.02) * blendOf(x, DUNES);
  const back = smooth(clamp((z - 250) / 700, 0, 1)) * (180 + 240 * noise1(x / 520 + z / 400, 77));
  const front = z < 0 ? -z * 0.12 : 0;
  const ripple = (noise1(x / 170 + z / 90, 78) - 0.5) * 30 * clamp(z / 400, 0, 1);
  return baseDepth(x) + hills + mid + dunes + front - back + ripple;
}

/** metres under the surface: 20 px per metre in the shallows, then the scale opens up (the abyss is squeezed into the map) */
export const metres = (y: number) => Math.round(y < 600 ? y / 20 : 30 + (y - 600) * 1.05);

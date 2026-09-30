// The big world, laid out like the story: the ten chapters one after the other
// along x (docs/chapitres.md), from the sunny Nurserie down to the bottom of the
// Fosse where the Remontée starts. Each chapter has its light (a Mood, with the
// palette of docs/direction-artistique.md), its floor, what grows there and who
// lives there. The Grotte, the Carcasse, the Glacier, the Jardin and the Fosse
// wear a provisional set made of what already exists until they get their own.

import { clamp, lerp, lerpHue, noise1 } from '../engine';
import type { HSL, Mood } from './palette';
import { carve } from './relief';

/** the chapters, in the order of the descent */
export type ChapterId = 'nurserie' | 'recif' | 'foret' | 'grotte' | 'carcasse' | 'sources' | 'glacier' | 'jardin' | 'fosse' | 'remontee';

export interface Biome extends Mood {
  id: ChapterId;
  /** a line under the name when you enter it */
  sub: string;
  /** where it starts along x */
  x0: number;
  /** depth range of the chapter in metres (docs/chapitres.md), read by the depth gauge on its floor */
  depth: [number, number];
  /** how dark the water closes around the swimmer (0 = never) */
  dark: number;
  /** marine snow falling (0 = plankton only drifts) */
  snow: number;
  /** how much the rocks are covered with life (the reef look above 0.5) */
  encrust: number;
  /** the plants lose their colour (the deep, the cold) */
  pale?: boolean;
  /** swimmers and schools live this much higher above the floor (open water, where the floor is out of sight) */
  lift?: number;
  /** relief of the floor: long hills, boulder bumps, sand ripples */
  ground: { hills: number; bumps: number; dunes: number };
  /** rocks: mean spacing along x, radius range */
  rocks: { every: number; r: [number, number] };
  /** plants: mean spacing along x, and kinds with their weights */
  flora: { every: number; kinds: [string, number][]; front: [string, number][] };
  /** animals: [species id, 'swim' | 'floor' | 'surface', weight, scale]; the partners of the chapter first */
  fauna: [string, 'swim' | 'floor' | 'surface', number, number][];
  /** how many animals live there */
  pop: number;
  /** fish schools: body, belly, count, glowing dots */
  schools: { body: HSL; belly: HSL; n: number; size: number; glow?: boolean }[];
  /** big animals passing far away across the chapter: [species id, y, z, scale] */
  visitors: [string, number, number, number][];
}

export const BIOMES: Biome[] = [
  {
    // turquoise and gold
    id: 'nurserie', name: 'La Nurserie', sub: 'herbiers et lumière', x0: -800, depth: [0, 40],
    top: { h: 178, s: 70, l: 58 }, deep: { h: 200, s: 75, l: 20 }, sky: { h: 52, s: 95, l: 86 },
    sand: { h: 44, s: 55, l: 70 }, rock: { h: 30, s: 18, l: 44 },
    accents: [{ h: 88, s: 45, l: 42 }, { h: 44, s: 70, l: 58 }, { h: 160, s: 40, l: 45 }],
    blades: [{ h: 78, s: 50, l: 42 }, { h: 92, s: 45, l: 36 }, { h: 60, s: 55, l: 48 }, { h: 110, s: 35, l: 32 }],
    rays: 1, caustics: 1, plankton: { h: 50, s: 80, l: 85 },
    dark: 0, snow: 0, encrust: 0.1,
    ground: { hills: 60, bumps: 10, dunes: 3 },
    rocks: { every: 240, r: [12, 30] },
    flora: { every: 26, kinds: [['posidonie', 6], ['anemone', 0.4], ['kelp', 0.3]], front: [['posidonie', 5], ['anemone', 0.3]] },
    fauna: [['copepode', 'swim', 2.5, 0.8], ['larve', 'swim', 3, 0.8], ['krill', 'swim', 2, 0.8], ['meduse', 'swim', 1.5, 0.7],
      ['ctenophore', 'swim', 1, 0.8], ['physalie', 'surface', 1, 0.8], ['axolotl', 'floor', 1, 0.8], ['tardigrade', 'floor', 1, 0.8]],
    pop: 24,
    schools: [{ body: { h: 200, s: 45, l: 70 }, belly: { h: 210, s: 30, l: 88 }, n: 50, size: 1 }],
    visitors: [['manta', 250, 1500, 2.4]]
  },
  {
    // coral and blue
    id: 'recif', name: 'Le Récif', sub: 'la ville de corail', x0: 3400, depth: [40, 90],
    top: { h: 192, s: 78, l: 50 }, deep: { h: 214, s: 80, l: 16 }, sky: { h: 190, s: 80, l: 88 },
    sand: { h: 24, s: 45, l: 74 }, rock: { h: 12, s: 26, l: 42 },
    accents: [{ h: 340, s: 70, l: 62 }, { h: 12, s: 85, l: 62 }, { h: 280, s: 55, l: 58 }, { h: 48, s: 90, l: 60 }, { h: 200, s: 70, l: 55 }],
    blades: [{ h: 350, s: 65, l: 62 }, { h: 16, s: 80, l: 60 }, { h: 285, s: 50, l: 60 }, { h: 195, s: 55, l: 50 }],
    rays: 0.8, caustics: 0.9, plankton: { h: 190, s: 60, l: 88 },
    dark: 0, snow: 0, encrust: 1,
    ground: { hills: 70, bumps: 60, dunes: 0 },
    rocks: { every: 90, r: [16, 44] },
    flora: { every: 22, kinds: [['coral', 3], ['fan', 1.4], ['softcoral', 1.4], ['anemone', 1], ['tubes', 0.8], ['eponge', 0.8], ['seapen', 0.3]],
      front: [['coral', 3], ['softcoral', 1.5], ['fan', 1], ['anemone', 0.7], ['tubes', 0.6]] },
    fauna: [['poissonClown', 'swim', 2.5, 0.8], ['poissonLion', 'swim', 1.5, 0.8], ['hippocampe', 'swim', 1.5, 0.8], ['nudibranche', 'floor', 2, 0.8],
      ['crevette', 'floor', 2, 0.8], ['combattant', 'swim', 1.2, 0.8], ['crevetteMante', 'floor', 1, 0.8], ['etoile', 'floor', 1, 0.8],
      ['koi', 'swim', 1, 0.8], ['verPlat', 'floor', 1, 0.8]],
    pop: 30,
    schools: [
      { body: { h: 50, s: 90, l: 58 }, belly: { h: 210, s: 70, l: 60 }, n: 45, size: 1 },
      { body: { h: 195, s: 80, l: 55 }, belly: { h: 190, s: 50, l: 85 }, n: 35, size: 0.8 }
    ],
    // the turtle passes over the reef, huge
    visitors: [['tortue', 200, 900, 2.6]]
  },
  {
    // green and amber
    id: 'foret', name: 'La Forêt', sub: 'cathédrale d’algues', x0: 7000, depth: [90, 200],
    top: { h: 150, s: 50, l: 42 }, deep: { h: 172, s: 62, l: 12 }, sky: { h: 44, s: 85, l: 78 },
    sand: { h: 38, s: 30, l: 48 }, rock: { h: 80, s: 14, l: 30 },
    accents: [{ h: 38, s: 80, l: 52 }, { h: 80, s: 50, l: 38 }, { h: 350, s: 45, l: 50 }],
    blades: [{ h: 44, s: 60, l: 40 }, { h: 62, s: 50, l: 36 }, { h: 90, s: 40, l: 30 }],
    rays: 1.25, caustics: 0.6, plankton: { h: 48, s: 70, l: 80 },
    dark: 0.15, snow: 0.1, encrust: 0.35,
    ground: { hills: 90, bumps: 30, dunes: 2 },
    rocks: { every: 110, r: [18, 46] },
    flora: { every: 22, kinds: [['kelp', 6], ['posidonie', 1.5], ['anemone', 0.6], ['eponge', 0.6], ['seapen', 0.3]], front: [['posidonie', 2], ['anemone', 0.5], ['eponge', 0.4]] },
    fauna: [['dragonFeuillu', 'swim', 1.5, 0.8], ['seiche', 'swim', 2, 0.8], ['homard', 'floor', 1.5, 0.8], ['poulpe', 'floor', 1.5, 0.8],
      ['crabe', 'floor', 1.5, 0.8], ['oursin', 'floor', 1.5, 0.8], ['etoile', 'floor', 1, 0.8], ['plumeau', 'floor', 1, 0.8],
      ['koi', 'swim', 1, 0.8], ['anguille', 'swim', 1, 0.8]],
    pop: 28,
    schools: [
      { body: { h: 45, s: 55, l: 58 }, belly: { h: 50, s: 40, l: 80 }, n: 40, size: 1.2 },
      { body: { h: 205, s: 25, l: 72 }, belly: { h: 205, s: 20, l: 90 }, n: 60, size: 0.9 }
    ],
    // the big one that passes slowly beyond the kelp
    visitors: [['requinBaleine', 520, 1400, 3]]
  },
  {
    // ochre and ink blue, shafts of daylight in the dark (provisional set: a chaos of boulders, sponges, lights)
    id: 'grotte', name: 'La Grotte', sub: 'sous la forêt, les galeries', x0: 10600, depth: [200, 250],
    top: { h: 218, s: 55, l: 22 }, deep: { h: 228, s: 60, l: 5 }, sky: { h: 42, s: 70, l: 78 },
    sand: { h: 34, s: 40, l: 34 }, rock: { h: 30, s: 36, l: 28 },
    accents: [{ h: 36, s: 70, l: 50 }, { h: 18, s: 60, l: 40 }, { h: 215, s: 50, l: 42 }, { h: 180, s: 70, l: 55 }],
    blades: [{ h: 36, s: 40, l: 34 }, { h: 210, s: 30, l: 30 }],
    rays: 0.9, caustics: 0, plankton: { h: 40, s: 50, l: 80 },
    dark: 0.62, snow: 0.3, encrust: 0.25,
    ground: { hills: 120, bumps: 70, dunes: 0 },
    rocks: { every: 70, r: [24, 64] },
    flora: { every: 44, kinds: [['eponge', 3], ['crinoide', 1.5], ['anemone', 1], ['seapen', 0.6]], front: [['eponge', 1], ['anemone', 0.6]] },
    fauna: [['anguille', 'swim', 2, 0.8], ['serpentCilie', 'floor', 2, 0.8], ['ctenophore', 'swim', 1.5, 0.8], ['crevette', 'floor', 1.5, 0.8],
      ['axolotl', 'floor', 1, 0.8], ['ophiure', 'floor', 1, 0.8], ['verPlat', 'floor', 1, 0.8]],
    pop: 18,
    schools: [{ body: { h: 220, s: 30, l: 40 }, belly: { h: 200, s: 30, l: 60 }, n: 16, size: 0.7, glow: true }],
    visitors: []
  },
  {
    // ivory and night blue (provisional set: the whale fall on a plain of sediment)
    id: 'carcasse', name: 'La Carcasse', sub: 'le souvenir d’une baleine', x0: 13600, depth: [250, 280],
    top: { h: 222, s: 50, l: 20 }, deep: { h: 230, s: 60, l: 5 }, sky: { h: 215, s: 40, l: 60 },
    sand: { h: 42, s: 20, l: 50 }, rock: { h: 36, s: 8, l: 30 },
    accents: [{ h: 44, s: 30, l: 84 }, { h: 50, s: 15, l: 90 }, { h: 225, s: 50, l: 45 }],
    blades: [{ h: 45, s: 20, l: 60 }, { h: 225, s: 25, l: 40 }],
    rays: 0, caustics: 0, plankton: { h: 45, s: 30, l: 88 },
    dark: 0.55, snow: 0.8, encrust: 0.1, pale: true,
    ground: { hills: 30, bumps: 12, dunes: 1 },
    rocks: { every: 260, r: [12, 30] },
    flora: { every: 60, kinds: [['anemone', 2], ['seapen', 2], ['eponge', 1], ['crinoide', 1]], front: [['anemone', 1], ['seapen', 0.6]] },
    fauna: [['plumeau', 'floor', 2, 0.8], ['crabe', 'floor', 2, 0.8], ['ophiure', 'floor', 1.5, 0.8], ['verDeFeu', 'floor', 1, 0.8],
      ['anguille', 'swim', 1, 0.8], ['crevette', 'floor', 1, 0.8]],
    pop: 18,
    schools: [{ body: { h: 215, s: 15, l: 62 }, belly: { h: 45, s: 20, l: 85 }, n: 40, size: 0.9 }],
    visitors: []
  },
  {
    // orange and brown: the black smokers
    id: 'sources', name: 'Les Sources', sub: 'fumeurs noirs et braises', x0: 15800, depth: [280, 340],
    top: { h: 24, s: 40, l: 16 }, deep: { h: 18, s: 45, l: 4 }, sky: { h: 28, s: 80, l: 50 },
    sand: { h: 26, s: 30, l: 22 }, rock: { h: 16, s: 18, l: 14 },
    accents: [{ h: 24, s: 90, l: 55 }, { h: 48, s: 40, l: 75 }, { h: 2, s: 80, l: 45 }],
    blades: [{ h: 30, s: 40, l: 50 }, { h: 18, s: 55, l: 42 }],
    rays: 0, caustics: 0, plankton: { h: 32, s: 50, l: 80 },
    dark: 0.72, snow: 0.8, encrust: 0, pale: true,
    ground: { hills: 90, bumps: 40, dunes: 0 },
    rocks: { every: 150, r: [18, 46] },
    flora: { every: 56, kinds: [['eponge', 2], ['anemone', 1.5], ['tubes', 1], ['crinoide', 0.6]], front: [['anemone', 0.6], ['eponge', 0.6]] },
    fauna: [['verDeFeu', 'floor', 2, 0.8], ['crevetteMante', 'floor', 1.5, 0.8], ['homard', 'floor', 1.5, 0.8], ['crevette', 'floor', 2, 0.8],
      ['crabe', 'floor', 1, 0.8], ['tardigrade', 'floor', 1, 0.8], ['serpentCilie', 'swim', 1, 0.8]],
    pop: 22,
    schools: [{ body: { h: 20, s: 25, l: 40 }, belly: { h: 30, s: 30, l: 60 }, n: 24, size: 0.9 }],
    visitors: []
  },
  {
    // glacier blue and pearly white (provisional set: blocks of ice, pale sponges, cold seeps, falling crystals)
    id: 'glacier', name: 'Le Glacier', sub: 'le froid qui descend', x0: 19000, depth: [340, 400],
    top: { h: 196, s: 50, l: 34 }, deep: { h: 212, s: 60, l: 9 }, sky: { h: 190, s: 45, l: 92 },
    sand: { h: 200, s: 22, l: 74 }, rock: { h: 198, s: 40, l: 60 },
    accents: [{ h: 280, s: 18, l: 88 }, { h: 190, s: 60, l: 80 }, { h: 330, s: 25, l: 85 }],
    blades: [{ h: 195, s: 30, l: 80 }, { h: 260, s: 15, l: 85 }],
    rays: 0.5, caustics: 0.15, plankton: { h: 190, s: 30, l: 96 },
    dark: 0.35, snow: 0.9, encrust: 0.2, pale: true,
    ground: { hills: 70, bumps: 45, dunes: 0 },
    rocks: { every: 110, r: [20, 56] },
    flora: { every: 52, kinds: [['eponge', 2], ['crinoide', 1.5], ['seapen', 1], ['anemone', 0.6]], front: [['eponge', 0.8], ['seapen', 0.6]] },
    fauna: [['clione', 'swim', 2.5, 0.8], ['krill', 'swim', 2.5, 0.8], ['chrysaora', 'swim', 2, 0.8], ['meduse', 'swim', 1, 0.7],
      ['ctenophore', 'swim', 1, 0.8], ['ophiure', 'floor', 1, 0.8], ['etoile', 'floor', 1, 0.8], ['oursin', 'floor', 1, 0.8]],
    pop: 22,
    schools: [{ body: { h: 195, s: 15, l: 80 }, belly: { h: 200, s: 10, l: 95 }, n: 60, size: 0.9 }],
    // a giant squid of the cold seas
    visitors: [['calmar', 1500, 1300, 3.5]]
  },
  {
    // violet and pink (provisional set: the floor falls away out of sight, jellyfish everywhere, a giant siphonophore)
    id: 'jardin', name: 'Le Jardin de méduses', sub: 'sans fond, des milliers de lueurs', x0: 22000, depth: [400, 500],
    top: { h: 272, s: 40, l: 20 }, deep: { h: 282, s: 50, l: 5 }, sky: { h: 300, s: 50, l: 60 },
    sand: { h: 270, s: 15, l: 20 }, rock: { h: 275, s: 12, l: 16 },
    accents: [{ h: 325, s: 70, l: 62 }, { h: 275, s: 60, l: 60 }, { h: 300, s: 50, l: 70 }],
    blades: [{ h: 300, s: 30, l: 40 }, { h: 320, s: 40, l: 50 }],
    rays: 0, caustics: 0, plankton: { h: 320, s: 60, l: 85 },
    dark: 0.55, snow: 0.5, encrust: 0, pale: true, lift: 800,
    ground: { hills: 150, bumps: 40, dunes: 0 },
    rocks: { every: 300, r: [16, 40] },
    flora: { every: 90, kinds: [['crinoide', 2], ['seapen', 1]], front: [['seapen', 0.4]] },
    fauna: [['meduse', 'swim', 3, 0.7], ['ctenophore', 'swim', 2, 0.8], ['siphonophore', 'swim', 2, 0.8], ['chrysaora', 'swim', 1.5, 0.8],
      ['meduseBoite', 'swim', 1, 0.8], ['hydre', 'swim', 1, 0.8], ['clione', 'swim', 0.5, 0.8]],
    pop: 30,
    schools: [{ body: { h: 290, s: 25, l: 35 }, belly: { h: 320, s: 30, l: 60 }, n: 30, size: 0.8, glow: true }],
    visitors: [['siphonophore', 2300, 1200, 4]]
  },
  {
    // black and electric blue (provisional set: the Abysses made darker, big silhouettes)
    id: 'fosse', name: 'La Fosse', sub: 'le noir et le silence', x0: 25200, depth: [500, 650],
    top: { h: 228, s: 40, l: 6 }, deep: { h: 232, s: 50, l: 2 }, sky: { h: 210, s: 80, l: 40 },
    sand: { h: 225, s: 10, l: 12 }, rock: { h: 228, s: 10, l: 9 },
    accents: [{ h: 205, s: 100, l: 60 }, { h: 190, s: 100, l: 55 }, { h: 240, s: 80, l: 65 }],
    blades: [{ h: 210, s: 40, l: 40 }, { h: 230, s: 50, l: 50 }],
    rays: 0, caustics: 0, plankton: { h: 200, s: 80, l: 80 },
    dark: 0.93, snow: 1, encrust: 0, pale: true,
    ground: { hills: 60, bumps: 30, dunes: 0 },
    rocks: { every: 200, r: [16, 40] },
    flora: { every: 64, kinds: [['crinoide', 2.5], ['eponge', 1.5], ['anemone', 1], ['seapen', 1]], front: [['crinoide', 0.6], ['anemone', 0.4]] },
    fauna: [['baudroie', 'swim', 2, 0.8], ['dragonAbyssal', 'swim', 1.5, 0.8], ['nautile', 'swim', 1.5, 0.8], ['grandGosier', 'swim', 1.5, 0.8],
      ['meduseBoite', 'swim', 1, 0.8], ['calmar', 'swim', 1, 0.8], ['serpentCilie', 'swim', 1, 0.8], ['hydre', 'swim', 1, 0.8]],
    pop: 20,
    schools: [{ body: { h: 230, s: 20, l: 28 }, belly: { h: 210, s: 30, l: 50 }, n: 24, size: 1, glow: true }],
    visitors: [['dragonAbyssal', 2900, 1300, 3], ['calmar', 2700, 1500, 3.5]]
  },
  {
    // the bottom, where the ascent starts: the light comes back from far above
    id: 'remontee', name: 'La Remontée', sub: 'tout en haut, un puits de lumière', x0: 28400, depth: [650, 680],
    top: { h: 215, s: 40, l: 11 }, deep: { h: 225, s: 50, l: 3 }, sky: { h: 48, s: 70, l: 90 },
    sand: { h: 215, s: 12, l: 20 }, rock: { h: 222, s: 10, l: 12 },
    accents: [{ h: 45, s: 80, l: 65 }, { h: 190, s: 60, l: 70 }, { h: 30, s: 60, l: 55 }],
    blades: [{ h: 45, s: 40, l: 55 }, { h: 200, s: 30, l: 50 }],
    rays: 0, caustics: 0, plankton: { h: 48, s: 70, l: 85 },
    dark: 0.8, snow: 0.6, encrust: 0, pale: true,
    ground: { hills: 40, bumps: 20, dunes: 0 },
    rocks: { every: 220, r: [14, 36] },
    flora: { every: 70, kinds: [['crinoide', 2], ['anemone', 1]], front: [['anemone', 0.4]] },
    fauna: [['tardigrade', 'floor', 1, 0.8], ['ophiure', 'floor', 1, 0.8], ['hydre', 'swim', 1, 0.8], ['baudroie', 'swim', 0.6, 0.8]],
    pop: 8,
    schools: [],
    visitors: []
  }
];

export const X0 = -800, X1 = 30000;
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

/** index of a chapter */
export function chapterIndex(id: ChapterId): number {
  return BIOMES.findIndex((b) => b.id === id);
}

/** where a chapter starts and ends along x */
export function span(id: ChapterId): [number, number] {
  const i = chapterIndex(id);
  return [BIOMES[i].x0, i + 1 < BIOMES.length ? BIOMES[i + 1].x0 : X1];
}

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

/**
 * Depth of the floor along the swimming plane: [x, depth] control points, eased
 * between. A gentle slope down the Nurserie, the Récif and the Forêt; the cliff
 * under the kelp that opens on the Grotte; the plain of the Carcasse; the valley
 * of the Sources; the Glacier sloping down to an edge, where the floor falls
 * away under the Jardin down to the bottom of the Fosse.
 */
const PROFILE: [number, number][] = [
  [X0, 600], [3000, 630], [3900, 690], [6600, 740], [7500, 800], [10200, 980],
  [10900, 1060], [11500, 1360], [13200, 1440], [14000, 1480], [15400, 1500], [16300, 1560], [18500, 1700],
  [19400, 1740], [21600, 1980], [22500, 2900], [23400, 3300], [28200, 3320], [29000, 3400], [X1, 3420]
];
const smooth = (t: number) => t * t * (3 - 2 * t);

function baseDepth(x: number): number {
  let k = 0;
  while (k + 2 < PROFILE.length && x > PROFILE[k + 1][0]) k++;
  const [xa, ya] = PROFILE[k], [xb, yb] = PROFILE[k + 1];
  return lerp(ya, yb, smooth(clamp((x - xa) / (xb - xa), 0, 1)));
}

const HILLS = BIOMES.map((b) => b.ground.hills), BUMPS = BIOMES.map((b) => b.ground.bumps), DUNES = BIOMES.map((b) => b.ground.dunes);
const LIFTS = BIOMES.map((b) => b.lift ?? 0);

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
  return baseDepth(x) + hills + mid + dunes + front - back + ripple + carve(x, z);
}

/** how much higher than usual the swimmers and schools live above the floor at x (open water) */
export function liftAt(x: number): number {
  return blendOf(x, LIFTS);
}

/** where the swimmer arrives in a chapter (the travel of the settings panel, the bench): its middle, at mid water */
export function arrival(i: number): { x: number; y: number } {
  const x = biomeMid(i);
  return { x, y: Math.max(120, floorAt(x, 0) - 260 - liftAt(x)) };
}

/**
 * Metres under the surface, for the depth gauge: 20 px per metre in the
 * shallows, then the scale opens up so that the floor of each chapter reads
 * its depth in docs/chapitres.md (the deep is squeezed into the map).
 */
const METRES: [number, number][] = [
  [0, 0], [600, 30], [640, 40], [740, 90], [980, 200], [1440, 250], [1500, 270], [1700, 340], [1980, 400], [2700, 500], [3300, 650], [3500, 690]
];
export function metres(y: number): number {
  if (y <= 0) return 0;
  let k = 0;
  while (k + 2 < METRES.length && y > METRES[k + 1][0]) k++;
  const [ya, ma] = METRES[k], [yb, mb] = METRES[k + 1];
  return Math.round(ma + ((y - ya) / (yb - ya)) * (mb - ma));
}

// The shape of La Grotte: under the forest the cliff opens on galleries. A
// vault hangs over the swimming plane and comes down at the back to meet the
// floor, pillars join them, wells in the vault let the day fall in shafts, and
// further on the light gives up: the dark, where only a few things glow.
// Pure geometry here (tested); the drawing is in grotte-draw.ts.

import { clamp, lerp, noise1, rng } from '../engine';
import { BIOMES, X1, floorAt } from './biomes';

const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** where the cave runs along x: the Grotte chapter of the map, or (until the map has one) the end of the kelp forest */
export function caveSpan(biomes = BIOMES): [number, number] {
  const i = biomes.findIndex((b) => b.id === 'grotte' || b.name === 'La Grotte');
  if (i < 0) return [4300, 7500];
  const end = i + 1 < biomes.length ? biomes[i + 1].x0 : X1;
  return [biomes[i].x0 + 250, end - 150];
}

export const [CAVE_A, CAVE_B] = caveSpan();
const L = CAVE_B - CAVE_A;
/** the mouth: how long the vault takes to close over the swimmer */
const MOUTH = 520;
/** the lit halls end here, the dark is full from there */
const DIM_FROM = CAVE_A + L * 0.5, DARK_FROM = CAVE_A + L * 0.72;
/** the vault is closed on the floor from this depth on (the back wall) */
export const BACK_Z = 1600;

/** how much of the vault is over x (0 outside, 1 inside) */
export function caveCover(x: number): number {
  return smooth((x - CAVE_A) / MOUTH) * smooth((CAVE_B - x) / MOUTH);
}

/** how dark the cave is at x: the halls are dim, the far galleries black */
export function caveDark(x: number): number {
  // the far end stays black until past the exit: it goes on down, toward the next chapter
  const open = smooth((x - CAVE_A) / MOUTH) * smooth((CAVE_B + MOUTH - x) / MOUTH);
  return open * lerp(0.42, 0.95, smooth((x - DIM_FROM) / (DARK_FROM - DIM_FROM)));
}

/** height of the gallery (floor to vault) along the swimming plane: halls, then the narrow galleries */
function gap(x: number): number {
  const narrow = smooth((x - DIM_FROM) / (L * 0.3));
  return (290 + 150 * noise1(x / 640, 901)) * lerp(1, 0.7, narrow);
}

/** the vault across z: high over the swimmer, coming down to the floor at the back */
const vault = (z: number) => 1 - smooth((z - 380) / (BACK_Z - 380));

/** y of the vault's underside at (x, z) (y down), or -Infinity where there is no cave */
export function ceilAt(x: number, z: number): number {
  const cv = caveCover(x);
  if (cv <= 0) return -Infinity;
  const bumps = (noise1(x / 150 + z / 230, 902) - 0.5) * 60 * vault(z * 0.8);
  return floorAt(x, z) - gap(x) * vault(z) + bumps * cv - (1 - cv) * 1500;
}

/** a push along x that turns a school back at the mouth: the fish do not follow into the cave */
export function caveRepel(x: number): number {
  const cv = caveCover(x);
  return cv > 0 ? cv * 0.35 * (x - CAVE_A < CAVE_B - x ? -1 : 1) : 0;
}

/** the tall plants (kelp, sargassum) cannot grow under the vault */
export function caveKeeps(p: { x: number; kind: string }): boolean {
  return !(p.kind === 'kelp' || p.kind === 'sargasse') || caveCover(p.x) < 0.1;
}

export interface Pillar { x: number; z: number; r: number; seed: number; }
export interface Well { x: number; z: number; w: number; seed: number; }

/** pillars stand in the halls, never in the swimming plane (nothing to swim into) */
export function makePillars(): Pillar[] {
  const R = rng(4404), out: Pillar[] = [];
  for (let x = CAVE_A + MOUTH * 0.7; x < CAVE_B - MOUTH * 0.5; x += 240 + R() * 380) {
    const z = 160 + R() * 1100;
    out.push({ x, z, r: 22 + R() * 38 + (z > 700 ? 20 : 0), seed: Math.floor(R() * 1e6) });
  }
  return out;
}

/** wells in the vault, over the lit halls only */
export function makeWells(): Well[] {
  const R = rng(4405), out: Well[] = [];
  for (let x = CAVE_A + MOUTH * 0.9; x < DIM_FROM; x += 260 + R() * 320) {
    out.push({ x, z: 120 + R() * 760, w: 28 + R() * 40, seed: Math.floor(R() * 1e6) });
  }
  return out;
}

/** spots of glowing life on the rock of the dark galleries: x, y, z, hue, phase */
export function makeGlimmers(): number[] {
  const R = rng(4406), out: number[] = [];
  for (let x = DIM_FROM; x < CAVE_B; x += 14 + R() * 40) {
    if (caveDark(x) < 0.6) continue;
    const z = 250 + R() * 1250, c = ceilAt(x, z), f = floorAt(x, z);
    // on the vault, on the back wall, or low near the floor
    const y = R() < 0.6 ? c + 6 + R() * 30 : lerp(c, f, 0.4 + R() * 0.55);
    out.push(x, y, z, R() < 0.75 ? 180 + R() * 30 : 95 + R() * 30, R() * 6.28);
  }
  return out;
}

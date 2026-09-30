// La Fosse: the total dark. Past the Abysses nothing is lit any more but what
// shines: the swimmer's own light (wider with a lantern), the glowing animals,
// the marine snow where the light catches it, and the huge shapes that pass,
// seen only as darker bodies against a faint far glow. The rules; fosse-draw
// draws.

import { clamp, lerp } from '../engine';
import type { Biome } from './biomes';

export const FOSSE: Biome = {
  id: 'fosse', name: 'La Fosse', sub: 'le noir et le silence', x0: 21800,
  top: { h: 228, s: 45, l: 5 }, deep: { h: 226, s: 60, l: 1.5 }, sky: { h: 205, s: 95, l: 55 },
  sand: { h: 220, s: 10, l: 16 }, rock: { h: 225, s: 12, l: 12 },
  accents: [{ h: 205, s: 95, l: 58 }, { h: 190, s: 80, l: 70 }, { h: 250, s: 60, l: 55 }],
  blades: [{ h: 205, s: 40, l: 40 }, { h: 230, s: 30, l: 35 }],
  rays: 0, caustics: 0, plankton: { h: 205, s: 40, l: 90 },
  dark: 1, snow: 1, encrust: 0,
  rocks: { every: 260, r: [20, 50] },
  flora: { every: 90, kinds: [['crinoide', 2], ['seapen', 2], ['eponge', 1]], front: [['seapen', 0.5]] },
  fauna: [['baudroie', 'swim', 2, 0.8], ['dragonAbyssal', 'swim', 1.5, 0.8], ['nautile', 'swim', 1.5, 0.8], ['ctenophore', 'swim', 1.5, 0.8],
    ['siphonophore', 'swim', 1, 0.8], ['meduseBoite', 'swim', 1, 0.8], ['ophiure', 'floor', 1, 0.8]],
  pop: 18,
  schools: [{ body: { h: 225, s: 20, l: 18 }, belly: { h: 220, s: 20, l: 30 }, n: 30, size: 0.9, glow: true }]
};

/** how far toward the total dark the water is, from the mood's dark (the Abysses, at 0.86, stay as they were) */
export function pitchOf(dark: number): number {
  const u = clamp((dark - 0.88) / 0.12, 0, 1);
  return u * u * (3 - 2 * u);
}

/** the swimmer's own light, in world px: a faint aura, wider with what it carries that glows (see glowOf) */
export function lightReach(glow: number): number {
  return 45 + Math.min(220, 12 * Math.sqrt(Math.max(0, glow)));
}

interface GlowSeg { def: { role: string; color: { glow: string } }; n: number; rad: ArrayLike<number>; }

/** how much a creature shines: its glows as render3 draws them (size × strength), a lantern (role light) counting thrice */
export function glowOf(list: readonly GlowSeg[]): number {
  let sum = 0;
  for (const s of list) {
    const g = s.def.color.glow;
    if (g === 'none') continue;
    if (g === 'tip') sum += (8 + s.rad[s.n] * 8) * 0.85 * (s.def.role === 'light' ? 3 : 1);
    else for (let k = 0, step = Math.max(1, Math.round(s.n / 5)); k <= s.n; k += step) sum += (6 + s.rad[k] * 3) * 0.14;
  }
  return sum;
}

/**
 * The dark around the swimmer as three rings: radii (screen px) and opacities.
 * Pitch 0 is the dark of the Abysses (wide, never quite black); pitch 1 is the
 * Fosse: clear only within the swimmer's light, black beyond.
 */
export function darkStops(dk: number, pitch: number, s: number, reachPx: number, W: number, H: number): { r: number[]; a: number[] } {
  const r0 = 70 * s, r1 = Math.max(W, H) * (0.9 - dk * 0.35);
  const open = { r: [r0, r0 + (r1 - r0) * 0.35, r1], a: [0, dk * 0.55, Math.min(0.97, dk * 1.08)] };
  const shut = { r: [reachPx * 0.35, reachPx, reachPx * 1.4], a: [0, 0.85, 1] };
  return { r: open.r.map((v, i) => lerp(v, shut.r[i], pitch)), a: open.a.map((v, i) => lerp(v, shut.a[i], pitch)) };
}

/** how much a mote of marine snow shows at `d` px from the swimmer: only where its light reaches */
export function snowLit(d: number, reachPx: number): number {
  return clamp(1.25 - d / reachPx, 0, 1);
}

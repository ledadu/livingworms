// La Fosse: the total dark. Past the Abysses nothing is lit any more but what
// shines: the swimmer's own light (wider with a lantern), the glowing animals,
// the marine snow where the light catches it, and the huge shapes that pass,
// seen only as darker bodies against a faint far glow. The rules; fosse-draw
// draws.

import { clamp, lerp } from '../engine';

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

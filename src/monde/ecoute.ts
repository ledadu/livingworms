// The distance of sounds (docs/direction-artistique.md, « Le son »): what the swimmer hears of something that sounds
// somewhere around it. Near, loud and bright; far, quieter, duller and more in the reverb; from the side of the screen
// where it is. Pure and tested; the engines (bruits-son.ts, chant-son.ts) turn it into a gain, a low-pass, a stereo
// pan and a send to the reverb, the cheap nodes of the Web Audio API (no 3D panner).

import { clamp } from '../engine';

/** what is heard of a sound: how loud (0..1), from which side (-1 left .. 1 right), how dull (Hz), how far in the reverb */
export interface Heard {
  g: number; pan: number;
  /** the cut-off of its low-pass (Hz); above CLEAR, no filter is needed */
  cut: number;
  /** what of it goes to the reverb besides what the bus sends there, as a share of what is heard dry */
  wet: number;
}

/** how far a sound carries (px): at this distance it is heard at half its loudness */
export const REACH = { small: 260, mid: 500, big: 1100 } as const;

/** a low-pass above this (Hz) changes nothing to the ear: it is left out */
export const CLEAR = 9000;

/** the sides stay a little in both ears (headphones) */
const SIDE = 0.85;

/**
 * Something `dx`, `dy` px from the swimmer, `dz` behind the swimming plane, carrying `reach` px. `pan`, if known,
 * is where it is on the screen (-1 at the left edge .. 1 at the right edge); otherwise half a screen is taken to be
 * 900 px of the swimming plane, a little less behind it (the perspective).
 */
export function hear(dx: number, dy: number, dz = 0, reach: number = REACH.mid, pan?: number): Heard {
  const d = Math.hypot(dx, dy, dz * 0.6), g = reach / (reach + d);
  const side = pan ?? (dx / 900) * (900 / (900 + Math.max(0, dz)));
  return {
    g,
    pan: clamp(side, -SIDE, SIDE),
    cut: 350 + 11650 * Math.exp(-d / 700),
    // the direct sound falls faster than the room's: far, the share of the reverb grows
    wet: clamp(0.6 * (1 / Math.sqrt(g) - 1), 0, 1.5)
  };
}

/** where a point of the screen is heard: x in css px on a screen W wide, -1 .. 1 */
export const panOnScreen = (x: number, W: number): number => (W > 0 ? (x / W) * 2 - 1 : 0);

// The eggs in the water (docs/mecaniques.md, « La ponte »): a parade no longer throws the brood over the sea. Its
// four eggs are laid where it ended, and the brood opens when we stay by them a moment, as a partner notices us.
// We may swim away, or leave the brood for later: the eggs wait there, and coming back to them opens it again.
// Pure: the game lays and draws them (ponte-jeu.ts).

import { STEP, clamp } from '../engine';

/** closer than this to the eggs, and they begin to hatch (px) */
export const EGG_NEAR = 110;
/** time to stay by them before the brood opens (s) */
export const EGG_HOLD = 1.6;
/** the eggs are laid in the burst of light that ends the parade: nothing hatches before (s) */
export const EGG_DELAY = 1.6;
/** once the brood is left for later, it opens again only after we have gone this far from them (px) */
export const EGG_REARM = EGG_NEAR + 70;
/** how many eggs, as in the brood */
export const EGG_COUNT = 4;

export interface Clutch {
  /** where they were laid */
  x: number; y: number;
  /** time since they were laid (s) */
  age: number;
  /** how long we have stayed by them (s) */
  hold: number;
  /** whether staying by them opens the brood (not right after it was left for later) */
  armed: boolean;
}

export function newClutch(x: number, y: number): Clutch {
  return { x, y, age: 0, hold: 0, armed: true };
}

/** one step with the swimmer at (px, py): true when the brood opens now */
export function stepClutch(c: Clutch, px: number, py: number, dt = STEP): boolean {
  c.age += dt;
  const d = Math.hypot(px - c.x, py - c.y);
  if (d > EGG_REARM) c.armed = true;
  if (!c.armed || c.age < EGG_DELAY || d > EGG_NEAR) { c.hold = Math.max(0, c.hold - dt * 2); return false; }
  c.hold += dt;
  if (c.hold < EGG_HOLD) return false;
  c.hold = 0;
  c.armed = false;
  return true;
}

/** the brood was left for later: the eggs wait until we come back to them */
export function leaveClutch(c: Clutch): void {
  c.hold = 0;
  c.armed = false;
}

/** how near they are to hatching (0..1): they glow and tremble more */
export const hatching = (c: Clutch) => clamp(c.hold / EGG_HOLD, 0, 1);

/** where each egg lies, relative to the middle of the clutch: a small heap, bobbing each its own way */
export function eggAt(i: number, time: number, shake = 0): { x: number; y: number; r: number } {
  const u = (i / EGG_COUNT) * Math.PI * 2 + 0.6, r = 7 + (i % 2) * 1.2;
  const bob = Math.sin(time * 1.3 + i * 1.9) * 3, tremble = shake * Math.sin(time * 38 + i * 2.3) * 2.4;
  return { x: Math.cos(u) * 12 + tremble, y: Math.sin(u) * 8 + bob, r };
}

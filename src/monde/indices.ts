// The hints (docs/mecaniques.md, « Les indices »): once the obstacle of a chapter has held us back, the lineage
// remembers who in the chapter had what it takes (the words « L'indice » of docs/chapitres.md), and a thread of
// golden lights leaves the swimmer, now and then, toward the nearest partner that brings one of its traits, or
// toward eggs of ours that would cross. A partner with the right trait does not always hand it down (a thin body, a
// bell, a shell belong to the trunk, and a child may keep ours): the partners are rated by broods of the parent we
// play. Pure: the game shows them (indices-jeu.ts).

import type { Spec } from '../engine';
import { brood } from '../content/portee';
import type { ChapterId } from './biomes';
import { PARTNERS } from './partenaires';
import { KEYS, crosses } from './obstacles';

export interface Pt { x: number; y: number; }

/** the traits of the body that cross the obstacle of a chapter (the song is not one) */
export function bodyKeys(chapter: ChapterId): string[] {
  return (KEYS[chapter] ?? []).filter((k) => k !== 'chant');
}

/** the partners of a chapter that bring one of the traits crossing its obstacle */
export function rightPartners(chapter: ChapterId, traitsOf: (id: string) => readonly string[]): string[] {
  const keys = bodyKeys(chapter);
  return PARTNERS[chapter].filter((q) => traitsOf(q.id).some((t) => keys.includes(t))).map((q) => q.id);
}

/** the seeds of the broods a partner is rated by */
export const SAMPLE = [11, 23, 37, 51];

/** does a brood of this parent with this partner, from this seed, have a child that crosses the chapter's obstacle */
export function broodCrosses(parent: Spec, partner: Spec, chapter: ChapterId, seed: number): boolean {
  return brood(parent, partner, { quality: 0.5, keys: bodyKeys(chapter), seed }).some((c) => crosses(chapter, c.traits));
}

/** the partners to lead to, from how many sampled broods of each crossed: most of them, else any, else those with the trait */
export function bestPartners(rates: ReadonlyMap<string, number>, byTraits: readonly string[]): string[] {
  const most = [...rates].filter(([, r]) => r >= 0.5).map(([id]) => id);
  if (most.length) return most;
  const any = [...rates].filter(([, r]) => r > 0).map(([id]) => id);
  return any.length ? any : [...byTraits];
}

/** a thread of lights every this often (s), each light lives this long (s) and flies this fast (px per step) */
export const PUFF_EVERY = 3.4, MOTE_LIFE = 2.4, MOTE_SPEED = 2.6;
/** closer than this, the one we are led to shows itself: no more thread (px) */
export const GUIDE_NEAR = 420;
/** the thread looks this far along x for someone to lead us to (px) */
export const GUIDE_FAR = 4200;

export interface Guided extends Pt {
  /** eggs of ours rather than a partner */
  eggs?: boolean;
}

/**
 * Where the thread leads: eggs of ours that would cross, else the nearest right partner, if any is within reach;
 * null when there is no one, or when it is already near enough to be seen.
 */
export function target(swimmer: Pt, partners: readonly Pt[], eggs: Pt | null): Guided | null {
  let best: Guided | null = eggs ? { ...eggs, eggs: true } : null;
  if (!best) {
    let bd = Infinity;
    for (const p of partners) {
      const dx = Math.abs(p.x - swimmer.x);
      if (dx < bd && dx < GUIDE_FAR) { bd = dx; best = { x: p.x, y: p.y }; }
    }
  }
  if (!best || Math.hypot(best.x - swimmer.x, best.y - swimmer.y) < GUIDE_NEAR) return null;
  return best;
}

/** the chapter's hints are awake: its obstacle held us back (or a brood of it could not cross), and we still cannot cross */
export function awake(felt: boolean, canCross: boolean, keys: readonly string[]): boolean {
  return felt && !canCross && keys.length > 0;
}

/** the velocity of a light of the thread, `age` s after it left, flying from `from` toward `to`: it sways as it goes */
export function moteVelocity(from: Pt, to: Pt, age: number, seed: number): Pt {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  const sway = Math.sin(age * 4 + seed) * 0.8, s = MOTE_SPEED * Math.min(1, 0.4 + age * 1.5);
  return { x: ux * s - uy * sway, y: uy * s + ux * sway };
}

// The ancestors in the world (docs/mecaniques.md, « Les ancêtres »): each parent left behind stays where
// it was left, from one visit to the next, and swims there when we come back (stayGoal, adieu.ts). The
// saved game keeps that place counted from the start of its chapter, so that it outlives a change of the
// map. Pure: the map comes in, the homes of the ancestors go out.

import type { Ancestor, Place } from './partie';

export interface Pt { x: number; y: number }

/** a chapter of the map, as the ancestors need it */
export interface Chapter {
  id: string;
  /** where it starts: the places are counted from there */
  x0: number;
  /** where the swimmer can be in it (its span, within the ends of the world) */
  span: [number, number];
  /** where its partners are met, so where a farewell mostly happens */
  meet: [number, number];
}

/** the open water of the map */
export interface Sea {
  /** its top and its bottom at x, where an ancestor may live */
  water(x: number): [number, number];
  /** mid water at x */
  mid(x: number): number;
}

/** where the ancestors saved without a place stand along the meeting stretch of their chapter, one after the other */
const SPREAD = [0.5, 0.72, 0.28, 0.9, 0.1];

/** the place of a parent left at (x, y) in a chapter that starts at x0, as the game saves it */
export function placeOf(x: number, y: number, x0: number): Place {
  return { x: Math.round(x - x0), y: Math.round(y) };
}

const isPlace = (at: unknown): at is Place =>
  typeof at === 'object' && at !== null && Number.isFinite((at as Place).x) && Number.isFinite((at as Place).y);
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/**
 * Where each ancestor of the lineage lives in the world, the oldest first; null when its chapter is no
 * longer on the map. A saved place is kept where the swimmer can go and in the open water; an ancestor
 * saved without one (before the places were kept) is set along the meeting stretch of its chapter.
 */
export function homesOf(lineage: readonly Ancestor[], chapters: readonly Chapter[], sea: Sea): (Pt | null)[] {
  const unplaced = new Map<string, number>();
  return lineage.map((a) => {
    const c = chapters.find((q) => q.id === a.chapter);
    if (!c) return null;
    let x: number, y: number;
    if (isPlace(a.at)) {
      x = clamp(c.x0 + a.at.x, c.span[0], c.span[1]);
      y = a.at.y;
    } else {
      const k = unplaced.get(c.id) || 0;
      unplaced.set(c.id, k + 1);
      x = c.meet[0] + SPREAD[k % SPREAD.length] * (c.meet[1] - c.meet[0]);
      y = sea.mid(x);
    }
    const [top, bottom] = sea.water(x);
    return { x, y: clamp(y, top, bottom) };
  });
}

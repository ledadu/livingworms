// Les traces de la lignée (docs/mecaniques.md, « Les ancêtres »): further down the
// descent, what the past generations left behind. Each ancestor of the saved game
// leaves one trace two chapters below the one where it gave birth: the parent just
// left still swims where we left it, its trace waits further down. The traces take
// turns, eggs that never hatched, a moult, a body become a reef, so that three
// generations show all three. They rest on the floor just behind the swimming plane;
// a chapter without a floor (the Jardin) lets them fall through to the next one.
// The words the lineage says in front of each kind are in docs/chapitres.md.

import { seedOf } from '../engine';
import { BIOMES, X1, type ChapterId } from './biomes';
import { FOSSE_BOTTOM, GATES, SOFT, WORLD_START } from './limites';
import { toLines } from './textes';

export type TraceKind = 'oeufs' | 'mue' | 'recif';
/** in turn, from the first generation: its unhatched eggs, then a moult, then a body become a reef */
export const KINDS: readonly TraceKind[] = ['oeufs', 'mue', 'recif'];
/** how many chapters below its own a trace lies */
export const BELOW = 2;

/** a chapter where traces may lie: the stretch along x one can swim to, and whether it has a floor */
export interface Place { id: ChapterId; x0: number; x1: number; floor: boolean; }

export interface Trace {
  /** the ancestor: its index in the lineage, the oldest first */
  gen: number;
  kind: TraceKind;
  chapter: ChapterId;
  x: number;
  /** behind the swimming plane */
  z: number;
  seed: number;
}

/** where along the stretch of its chapter the k-th trace lies (0..1): spread out, each keeping its place when others come */
const SLOTS = [0.45, 0.72, 0.22, 0.88, 0.6, 0.08, 0.33];
/** kept away from the borders of a chapter, in its own light */
const MARGIN = 500;

export const traceKind = (gen: number): TraceKind => KINDS[gen % KINDS.length];

/** the chapters of the world where traces may lie, down to the Fosse: up to their obstacle, the bottom of the Fosse */
export function worldPlaces(): Place[] {
  const out: Place[] = [];
  BIOMES.forEach((b, i) => {
    if (b.x0 >= FOSSE_BOTTOM) return;
    const next = i + 1 < BIOMES.length ? BIOMES[i + 1].x0 : X1, gate = GATES.find((g) => g.chapter === b.id);
    const x1 = Math.min(next, gate ? gate.x - SOFT : next, FOSSE_BOTTOM - SOFT) - MARGIN;
    out.push({ id: b.id, x0: Math.max(b.x0, WORLD_START) + MARGIN, x1, floor: !b.abyss });
  });
  return out;
}

/** the place where the trace of an ancestor that gave birth in place `from` lies: always below it, on a floor; -1 if none */
export function placeBelow(places: readonly Place[], from: number): number {
  if (from < 0) return -1;
  const i = Math.min(from + BELOW, places.length - 1);
  for (let k = i; k < places.length; k++) if (k > from && places[k].floor) return k;
  // nothing below with a floor: back up toward it, never to its own chapter
  for (let k = i - 1; k > from; k--) if (places[k].floor) return k;
  return -1;
}

/**
 * The traces of a lineage (the chapter where each ancestor gave birth, the oldest
 * first). `free(x, z)` may refuse a spot (a relief stands there): the trace then
 * moves along a little.
 */
export function tracesOf(lineage: readonly { chapter: string }[], places: readonly Place[], free: (x: number, z: number) => boolean = () => true): Trace[] {
  const out: Trace[] = [], inPlace = new Map<number, number>();
  lineage.forEach((a, gen) => {
    const at = placeBelow(places, places.findIndex((p) => p.id === a.chapter));
    if (at < 0) return;
    const p = places[at], k = inPlace.get(at) ?? 0, seed = seedOf(gen + 1, at + 1);
    inPlace.set(at, k + 1);
    const z = 8 + (seed % 3) * 6;
    let x = p.x0 + (p.x1 - p.x0) * SLOTS[k % SLOTS.length] + Math.floor(k / SLOTS.length) * 60;
    for (let n = 1; n <= 16 && !free(x, z); n++) x += (n % 2 ? 1 : -1) * n * 45;
    out.push({ gen, kind: traceKind(gen), chapter: p.id, x: Math.round(x), z, seed });
  });
  return out;
}

// ----- the words (docs/chapitres.md, « Les traces de la lignée ») ----- //

const LABELS: [RegExp, TraceKind][] = [[/^les œufs\b/i, 'oeufs'], [/^la mue\b/i, 'mue'], [/^la carcasse\b/i, 'recif']];

/** what the lineage says in front of each kind of trace, as the lines it is shown in */
export function parseTraceTexts(md: string): Partial<Record<TraceKind, string[]>> {
  const out: Partial<Record<TraceKind, string[]>> = {};
  let inside = false, kind: TraceKind | null = null, quote: string[] = [];
  const flush = () => { if (kind && quote.length && !out[kind]) out[kind] = toLines(quote.join(' ')); quote = []; };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (/^#{1,2}\s/.test(line)) { flush(); kind = null; inside = /^##\s+les traces de la lignée/i.test(line); continue; }
    if (!inside) continue;
    if (line.startsWith('>')) { if (kind) quote.push(line.replace(/^>\s?/, '')); continue; }
    if (quote.length) { flush(); kind = null; }
    const label = LABELS.find(([re]) => re.test(line));
    if (label && /:\s*$/.test(line)) kind = label[1];
  }
  flush();
  return out;
}

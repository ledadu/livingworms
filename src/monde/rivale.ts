// The rival lineage of the Carcasse (docs/chapitres.md, chapter 5): another lineage came down from the same first
// larva as ours, but courted other partners on the way. Where our lineage crossed an obstacle with one trait, it
// crossed with the other. Its generation of our age waits among the bones: a strange creature, a distant cousin,
// that turns to us and swims with us for a while. Pure: its making and its wished velocities.

import { rng, type Spec } from '../engine';
import { SPECIES, firstAncestor } from '../content/species';
import { brood } from '../content/portee';
import { traitsOf } from '../content/traits';
import { BIOMES, chapterIndex, type ChapterId } from './biomes';
import { KEYS, crosses } from './obstacles';
import { GLOW_HUE, PARTNERS } from './partenaires';

export interface Pt { x: number; y: number }

/** the chapters the other lineage went through before the Carcasse, a generation in each */
export const BEFORE: ChapterId[] = BIOMES.slice(0, Math.max(0, chapterIndex('carcasse'))).map((b) => b.id);

export interface RivalStep {
  chapter: ChapterId;
  /** the partner it chose there (a species id) */
  partner: string;
  /** the traits it wanted from that partner: those of the chapter's obstacle ours lacks, else any ours lacks */
  wanted: string[];
  /** the child it went on with */
  name: string;
}

export interface Rival {
  spec: Spec;
  steps: RivalStep[];
  seed: number;
}

/** a number from a text, the same each time (FNV-1a) */
export function hashOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) % 0xfffffff;
}

/**
 * The creature of our lineage that reached the Carcasse: the first ancestor that gave birth there or further down,
 * else the one played. It does not change once the Carcasse is behind us, so neither does the cousin.
 */
export function arrivedAt<C>(lineage: readonly { creature: C; chapter: string }[], played: C | null): C | null {
  const at = chapterIndex('carcasse');
  const idx = (c: string) => BIOMES.findIndex((b) => b.id === c);
  return lineage.find((a) => idx(a.chapter) >= at)?.creature ?? played;
}

/** the partners our lineage had in each chapter before the Carcasse, as the save keeps them (partie.ts, since the lineage tree) */
export function ourPartners(lineage: readonly { chapter: string; partner?: { id: string } }[]): Partial<Record<ChapterId, string[]>> {
  const out: Partial<Record<ChapterId, string[]>> = {};
  for (const a of lineage) {
    const c = a.chapter as ChapterId;
    if (a.partner?.id && BEFORE.includes(c)) (out[c] ??= []).push(a.partner.id);
  }
  return out;
}

/**
 * The partner the other lineage chose in each chapter before the Carcasse. Where there is an obstacle, one that
 * brings a trait crossing it, the traits our body lacks first (it crossed the other way), then the most traits we
 * lack at all; where there is none, more or less anyone. Never ours (`taken`) when there is another one that
 * crosses. `R` breaks the ties.
 */
export function rivalChoices(ours: readonly string[], traits: (id: string) => readonly string[], R: () => number,
  taken: Partial<Record<ChapterId, readonly string[]>> = {}): Omit<RivalStep, 'name'>[] {
  const lacks = (t: string) => !ours.includes(t);
  return BEFORE.map((chapter) => {
    const keys: string[] = (KEYS[chapter] ?? []).filter((k) => k !== 'chant');
    const ids = [...new Set(PARTNERS[chapter].map((q) => q.id))];
    const best = ids.map((id) => {
      const tr = traits(id), keyed = tr.filter((t) => keys.includes(t)), mine = taken[chapter]?.includes(id) ? 20 : 0;
      const score = keys.length
        ? (keyed.length ? 100 : 0) - mine + 4 * keyed.filter(lacks).length + tr.filter(lacks).length + R() * 0.9
        : -mine + 0.5 * tr.filter(lacks).length + R() * 2;
      return { id, tr, keyed, score };
    }).sort((a, b) => b.score - a.score)[0];
    if (!best) return null;
    const other = best.keyed.filter(lacks);
    return { chapter, partner: best.id, wanted: other.length ? other : best.keyed.length ? best.keyed : best.tr.filter(lacks) };
  }).filter((s): s is Omit<RivalStep, 'name'> => !!s);
}

/** how well its parades went: well, it knew what it came for */
const QUALITY = 0.8;

/**
 * The seed of the cousin of a creature of ours: from its body and our partners, not from its name (the lineage tree
 * renames it), so that it stays the same cousin.
 */
export function cousinSeed(sp: Spec, taken: Partial<Record<ChapterId, readonly string[]>> = {}): number {
  const b = sp.body;
  return hashOf(JSON.stringify([traitsOf(sp), b.shape, b.style, b.links, sp.palette.hue, b.attach.map((a) => a.node.name), BEFORE.map((c) => taken[c] ?? [])]));
}

/** the other lineage, from the first larva to the generation at the Carcasse; same traits, partners of ours and seed = same cousin */
export function rivalLineage(ours: readonly string[], seed: number, taken: Partial<Record<ChapterId, readonly string[]>> = {}): Rival {
  const R = rng(seed), traits = new Map<string, readonly string[]>();
  const traitsOfId = (id: string) => traits.get(id) ?? traits.set(id, traitsOf(SPECIES[id]())).get(id)!;
  let cur = firstAncestor();
  const steps: RivalStep[] = [];
  rivalChoices(ours, traitsOfId, R, taken).forEach((c, k) => {
    const kids = brood(cur, SPECIES[c.partner](), { quality: QUALITY, seed: seed + 101 * (k + 1), keys: c.wanted });
    // the child that crosses the chapter's obstacle and carries what it came for, then the furthest from its parent: the strangest
    const pick = kids.map((kid) => ({ kid, n: (crosses(c.chapter, kid.traits) ? 10 : 0) + kid.traits.filter((t) => c.wanted.includes(t)).length }))
      .sort((a, b) => b.n - a.n || b.kid.share - a.kid.share)[0].kid;
    cur = pick.spec;
    steps.push({ ...c, name: cur.name });
  });
  return { spec: cur, steps, seed };
}

/** the cousin notices us within this distance, and swims about this far beside us */
export const NOTICE = 560, KEEP = 120;
/** it swims with us, but not further than this from its home among the bones */
export const LEASH = 760;
/** the words of the lineage come when we are this close, the first time */
export const MEET = 320;

function toward(from: Pt, to: Pt, speed: number, ease = 60): Pt {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, s = speed * Math.min(1, d / ease);
  return { x: (dx / d) * s, y: (dy / d) * s };
}

/**
 * The cousin's wished velocity. Alone, it goes up and down the skeleton, slowly, as if it looked at the bones. When
 * we come near it turns to us and comes to swim beside us, a little above, on the side it came from; it follows us
 * around the Carcasse, never onto us, and goes back to its bones when we swim too far, or when we are busy with
 * another (`aside`: a parade, a farewell).
 */
export function cousinGoal(me: Pt, home: Pt, swimmer: Pt, time: number, seed = 0, reach = 520, aside = false): Pt {
  const dx = swimmer.x - me.x, dy = swimmer.y - me.y, d = Math.hypot(dx, dy);
  const off = Math.hypot(swimmer.x - home.x, swimmer.y - home.y);
  if (d < 90) return toward(me, { x: me.x - dx, y: me.y - dy }, 1.2, 30);
  if (d < NOTICE && off < LEASH && !aside) {
    const side = me.x < swimmer.x ? -1 : 1;
    const spot = { x: swimmer.x + side * KEEP, y: swimmer.y - KEEP * 0.4 + Math.sin(time * 0.8 + seed) * 18 };
    return toward(me, spot, Math.min(2.6, 1.2 + d / 200), 90);
  }
  const drift = { x: home.x + Math.sin(time * 0.045 + seed) * reach, y: home.y + Math.cos(time * 0.11 + seed * 1.3) * 50 };
  return toward(me, drift, 0.7, 90);
}

/**
 * How bright its light is (0..1) at distance d from us, `since` seconds after it first noticed us (negative: not yet):
 * a flare when it notices us, then a slow breath while we are near.
 */
export function cousinLight(d: number, since: number, time: number): number {
  const u = Math.min(1, Math.max(0, (NOTICE - d) / (NOTICE - KEEP)));
  const breath = u * u * (3 - 2 * u) * (0.22 + 0.1 * Math.sin(time * 1.3));
  const flare = since >= 0 && since < FLARE ? (1 - since / FLARE) ** 2 * Math.min(1, since * 4) : 0;
  return Math.min(1, breath + flare);
}
/** how long the flare lasts (s) */
export const FLARE = 2.6;

/** the hue of its light: its own colour, turned away from the gold of the partners if it is too close to it */
export function cousinHue(hue: number): number {
  const off = Math.abs(((hue - GLOW_HUE + 540) % 360) - 180);
  return off < 35 ? (hue + 180) % 360 : hue;
}

// The lights that answer in the Fosse (docs/chapitres.md, chapter 9): in the total dark we sing the notes our lineage
// learned and, one by one, lights answer from far away: the ancestors of other lineages, who learned the same notes on
// their own way down. Each comes to swim around us; once every note has had its answer, their lights open the dark and
// the song has crossed the Fosse. Pure: the other lineages, the order of the answers, where they swim, how they shine.

import { clamp, rng, type Spec } from '../engine';
import { SPECIES, firstAncestor } from '../content/species';
import { brood } from '../content/portee';
import { traitsOf } from '../content/traits';
import type { ChapterId } from './biomes';
import { NOTE_CHAPTERS } from './chant';
import { KEYS, crosses } from './obstacles';
import { PARTNERS } from './partenaires';
import { hashOf } from './rivale';
import { toLines } from './textes';

export interface Pt { x: number; y: number }

/** the chapters of the descent, each with its note of the song (chant.ts); the Remontée has none */
export const DESCENT: readonly ChapterId[] = NOTE_CHAPTERS;

// ----- the other lineages ----- //

/**
 * Another lineage on its way down to the chapter of a note, one birth after another: from a first larva of its own
 * colour, a partner of each chapter on the way (one that crosses its obstacle), and the child that crosses it. Its
 * generation that entered the chapter of the note learned that note: that one answers.
 */
export interface Walk {
  note: ChapterId;
  seed: number;
  /** the generation it has reached */
  spec: Spec;
  /** the partners it chose, chapter after chapter */
  partners: string[];
  /** the next chapter where it gives birth (an index of DESCENT) */
  at: number;
}

const traitCache = new Map<string, readonly string[]>();
const traitsOfId = (id: string) => traitCache.get(id) ?? traitCache.set(id, traitsOf(SPECIES[id]())).get(id)!;

/** how well its parades went */
const QUALITY = 0.8;

export function startWalk(note: ChapterId, seed: number): Walk {
  const R = rng(seed), sp = firstAncestor();
  // another first light: of another colour than ours
  sp.palette.hue = (sp.palette.hue + 60 + Math.floor(R() * 240)) % 360;
  return { note, seed, spec: sp, partners: [], at: 0 };
}

/** whether it has come down to the chapter of its note */
export const walked = (w: Walk) => w.at >= DESCENT.indexOf(w.note);

/** the partner chosen in a chapter: one that brings a trait crossing its obstacle (the song is none), else anyone */
export function partnerIn(chapter: ChapterId, R: () => number): string {
  const keys: string[] = (KEYS[chapter] ?? []).filter((k) => k !== 'chant');
  const ids = [...new Set(PARTNERS[chapter].map((q) => q.id))];
  const crossing = keys.length ? ids.filter((id) => traitsOfId(id).some((t) => keys.includes(t))) : ids;
  const pool = crossing.length ? crossing : ids;
  return pool[Math.floor(R() * pool.length)];
}

/** one birth, in the next chapter on its way (a few milliseconds: the game does one per step) */
export function walkStep(w: Walk): void {
  if (walked(w)) return;
  const chapter = DESCENT[w.at], R = rng(w.seed + 7919 * (w.at + 1)), partner = partnerIn(chapter, R);
  const keys = (KEYS[chapter] ?? []).filter((k) => k !== 'chant');
  const kids = brood(w.spec, SPECIES[partner](), { quality: QUALITY, seed: w.seed + 101 * (w.at + 1), ...(keys.length ? { keys } : {}) });
  // a child that goes on down, any of them
  const on = kids.filter((k) => crosses(chapter, k.traits));
  const pool = on.length ? on : kids;
  w.spec = pool[Math.floor(R() * pool.length)].spec;
  w.partners.push(partner);
  w.at++;
}

/** the ancestor of another lineage that answers a note, all at once (the game spreads the births over its steps) */
export function otherAncestor(note: ChapterId, seed: number): Walk {
  const w = startWalk(note, seed);
  while (!walked(w)) walkStep(w);
  return w;
}

/** the seed of the lineage that answers a note, in a game of this seed: another lineage for each note */
export const seedOf = (note: ChapterId, game: number) => hashOf(`${note}:${game}`);

// ----- the answers ----- //

/** the silence before an answer, the least time between two answers, the flashes of an answer far away (s) */
export const DELAY = 1.1, GAP = 1.8, ECHO = 2.4;
/** how far away an answer comes from, and how far from us it then swims (world px) */
export const FAR = 520, RING = 170;

/** when an answer to a note sung at `now` begins, after the answer before it that began at `last`: one by one */
export const answerAt = (now: number, last: number) => Math.max(now + DELAY, last + GAP);

/**
 * How far an answer comes from along `d`: far, but still on the screen (a phone held upright shows little on the
 * sides). `room`: how far the screen reaches from us that way (world px).
 */
export const farAlong = (room: number) => clamp(0.85 * room, RING + 130, FAR);

/** how far the screen (w × h, css px) reaches from a point on it (sx, sy) along `d`, at `s` css px per world px */
export function roomAlong(sx: number, sy: number, d: Pt, w: number, h: number, s: number): number {
  const tx = d.x > 1e-6 ? (w - sx) / d.x : d.x < -1e-6 ? -sx / d.x : Infinity;
  const ty = d.y > 1e-6 ? (h - sy) / d.y : d.y < -1e-6 ? -sy / d.y : Infinity;
  return Math.max(0, Math.min(tx, ty)) / Math.max(1e-6, s);
}

/** the directions of the answers, in their order: above us and to the sides, never from below (degrees, y down) */
const ANGLES = [-35, -145, -70, -110, 5, 175, -15, -165, -90];

/** the direction the k-th answer comes from, and where it then swims */
export function dirOf(k: number): Pt {
  const a = (ANGLES[k % ANGLES.length] * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** the row of each answer around us, so that neighbours do not hide one another */
const ROWS = [0, 0, 1, 1, 0, 0, 2, 2, 2];
/** how far from us the k-th answer swims */
export const ringOf = (k: number) => RING + ROWS[k % ROWS.length] * 28;

/** where the k-th answer comes to swim, beside us, bobbing a little */
export function spotOf(k: number, swimmer: Pt, time: number): Pt {
  const d = dirOf(k), r = ringOf(k);
  return { x: swimmer.x + d.x * r, y: swimmer.y + d.y * r * 0.8 + Math.sin(time * 0.7 + k * 1.9) * 14 };
}

const flash = (u: number) => (u < 0 ? 0 : Math.exp(-u * 3.2) * Math.min(1, u * 10));

/**
 * How bright an answer shines (0..1+), `s` seconds after it began (negative: not yet): three flashes far away, the
 * answer itself, then a steady breath. `echo`: seconds since a note it knows was sung again; `bloom`: since the song
 * crossed the dark, when all shine at once.
 */
export function answerLight(s: number, time: number, k = 0, echo = -1, bloom = -1): number {
  if (s < 0) return 0;
  const flashes = flash(s) + flash(s - 0.8) + flash(s - 1.6);
  const steady = clamp((s - 1.6) / 1.2, 0, 1) * (0.45 + 0.1 * Math.sin(time * 1.1 + k * 2.3));
  return Math.min(1.4, Math.max(flashes, steady) + (echo >= 0 ? 0.8 * flash(echo) : 0) + (bloom >= 0 ? flash(bloom - 0.15 * k) : 0));
}

function toward(from: Pt, to: Pt, speed: number, ease = 60): Pt {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1, sp = speed * Math.min(1, d / ease);
  return { x: (dx / d) * sp, y: (dy / d) * sp };
}

/**
 * The wished velocity of an answer, `s` seconds after it began: it stays far away while it answers, then comes,
 * unhurried, to its place beside us (`spot`, see spotOf), and keeps it as we swim; never onto us.
 */
export function answerGoal(me: Pt, far: Pt, spot: Pt, swimmer: Pt, s: number): Pt {
  if (s < ECHO) return toward(me, far, 0.4, 40);
  if (Math.hypot(me.x - swimmer.x, me.y - swimmer.y) < 80) return toward(me, { x: 2 * me.x - swimmer.x, y: 2 * me.y - swimmer.y }, 1.2, 30);
  const d = Math.hypot(spot.x - me.x, spot.y - me.y);
  return toward(me, spot, Math.min(2.4, 1.1 + d / 400), 90);
}

/** how much an answer adds to our light, at d px from us: nothing far away, the most once beside us */
export const GLOW_EACH = 45;
export function answerGlow(d: number): number {
  return GLOW_EACH * clamp((FAR - d) / (FAR - RING - 40), 0, 1);
}

/** an answer is at its place once this close to it */
export const SETTLED = 80;

/** the song has crossed the dark: every note learned has had its answer, and each has come to us */
export function answered(learned: readonly string[], settled: ReadonlySet<string>): boolean {
  return learned.length > 0 && learned.every((n) => settled.has(n));
}

// ----- the words ----- //

/** the words of the lineage once every note has had its answer: the quote after « Les lumières qui répondent : » under La Fosse */
export function parseAnswerText(md: string): string[] {
  let inside = false, on = false;
  const quote: string[] = [];
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (/^#{1,2}\s/.test(line)) { if (quote.length) break; inside = /^##\s+\d+\.\s+la fosse/i.test(line); continue; }
    if (!inside) continue;
    if (line.startsWith('>')) { if (on) quote.push(line.replace(/^>\s?/, '')); continue; }
    if (quote.length) break;
    if (line) on = /^les lumières qui répondent\b.*:\s*$/i.test(line);
  }
  return toLines(quote.join(' '));
}

/** the seed of a game, from its lineage as saved: the chapters of its births and its partners, not its names */
export function gameSeed(lineage: readonly { chapter: string; partner?: { id: string } }[]): number {
  return hashOf(lineage.map((a) => `${a.chapter}/${a.partner?.id ?? ''}`).join());
}

// The song (docs/mecaniques.md, « Le chant »): one note per chapter of the descent, nine in all. Each generation
// learns the note of the chapter it swims into; the song is traced with a finger on a circle of the notes learned,
// then sung into the sea, where some animals answer: those of the chapter whose note is sung, and whatever shines.
// The rules; chant-jeu.ts plays them, chant-son.ts sounds them, chant-cercle.ts draws the circle.

import chapitres from '../../docs/chapitres.md?raw';
import type { ChapterId } from './biomes';
import type { LearnedNote } from './partie';

export interface Note {
  chapter: ChapterId;
  /** its name in the game, read in docs/chapitres.md (« l’éclat ») */
  name: string;
  /** its colour */
  hue: number; sat: number; light: number;
  /** its pitch (Hz): the deeper the chapter, the lower the note, on one pentatonic scale so that any song sounds */
  freq: number;
  /** its shape on the circle and in the sea: an SVG path in a 24 × 24 box, drawn with a stroke */
  glyph: string;
}

/** the chapters of the descent, each with its note, in the order of the story (the Remontée sings them all) */
export const NOTE_CHAPTERS: ChapterId[] = ['nurserie', 'recif', 'foret', 'grotte', 'carcasse', 'sources', 'glacier', 'jardin', 'fosse'];

/** the note names of docs/chapitres.md, by the number of their chapter: « - **Note** : « le battement ». » */
export function parseNoteNames(md: string): Map<number, string> {
  const out = new Map<number, string>();
  let num = 0;
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const h = /^##\s+(\d+)\.\s/.exec(line);
    if (h) { num = +h[1]; continue; }
    if (/^#{1,2}\s/.test(line)) { num = 0; continue; }
    const n = /^-\s+\*\*Note[^*]*\*\*\s*:\s*«\s*([^»]+?)\s*»/.exec(line);
    if (num && n && !out.has(num)) out.set(num, n[1].replace(/'/g, '’'));
  }
  return out;
}

const NAMES = parseNoteNames(chapitres);

// the colours of the chapters' palettes (docs/direction-artistique.md), the notes of D major pentatonic from A5 down
const LOOK: Record<string, [number, number, number, number, string]> = {
  nurserie: [48, 95, 72, 880, 'M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2'],
  recif: [10, 85, 68, 739.99, 'M2 12h5l2-5 3 10 3-10 2 5h5'],
  foret: [96, 55, 62, 659.26, 'M3 15c3-7 6-7 9 0s6 7 9 0'],
  grotte: [34, 72, 60, 587.33, 'M5 12h.01M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17'],
  carcasse: [44, 48, 84, 493.88, 'M11.5 12a1 1 0 0 1 2 0a2 2 0 0 1-4 0a3 3 0 0 1 6 0a4 4 0 0 1-8 0a5 5 0 0 1 10 0'],
  sources: [22, 95, 60, 440, 'M12 21a5 5 0 0 1-5-5c0-3 2-4.5 3-7 1.5 1.5 2 3 2 4.5 1-1 1.5-2.5 1.2-4.8C16 10.5 17 13 17 16a5 5 0 0 1-5 5z'],
  glacier: [196, 80, 80, 369.99, 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M12 6.5l-2-2M12 6.5l2-2M12 17.5l-2 2M12 17.5l2 2'],
  jardin: [300, 70, 74, 329.63, 'M5 12a7 7 0 0 1 14 0zM8 12c0 3-1 5-2 7M12 12v8M16 12c0 3 1 5 2 7'],
  fosse: [214, 100, 66, 293.66, 'M12 12h.01M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16']
};

export const NOTES: Note[] = NOTE_CHAPTERS.map((chapter, i) => {
  const [hue, sat, light, freq, glyph] = LOOK[chapter];
  return { chapter, name: NAMES.get(i + 1) ?? 'une note', hue, sat, light, freq, glyph };
});

/** the note of a chapter (the Remontée has none) */
export function noteOf(chapter: string): Note | undefined {
  return NOTES.find((n) => n.chapter === chapter);
}

/** a note's colour, as CSS, with this opacity */
export function noteColour(n: Note, a = 1): string {
  return `hsla(${n.hue} ${n.sat}% ${n.light}% / ${a})`;
}

// ----- learning ----- //

/**
 * The chapters whose note is known, in the order of the descent: those learned (saved with the game), and every
 * chapter before the one the game is in (a game saved before the song went through them without learning them).
 */
export function learnedNotes(p: { chapter: string; notes?: readonly LearnedNote[] }, order: readonly string[]): ChapterId[] {
  const at = order.indexOf(p.chapter);
  return NOTE_CHAPTERS.filter((c) => p.notes?.some((n) => n.chapter === c) || order.indexOf(c) < at);
}

/** the names of the notes learned by the generation of this rank (1: the first), in the order it learned them */
export function notesOfGeneration(p: { notes?: readonly LearnedNote[] }, rank: number): string[] {
  return (p.notes ?? []).filter((n) => n.gen === rank).map((n) => noteOf(n.chapter)?.name).filter((s): s is string => !!s);
}

/** « l’éclat », « l’éclat et le battement », « l’éclat, le battement et l’écho » */
export function wordsOf(names: string[]): string {
  return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' et ' + names[names.length - 1];
}

// ----- the circle ----- //

/** the time between two notes of a song (s) */
export const GAP = 0.5;
/** the longest song */
export const MAX_NOTES = 12;

export interface Spot { x: number; y: number }

/** the places of the nine notes on a circle, from the top and clockwise, in the order of the descent */
export function ringSpots(cx: number, cy: number, r: number, n = NOTES.length): Spot[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

/**
 * The notes a finger touches going from a to b, in the order it meets them: those whose spot is within `reach` of
 * the segment (a fast finger does not skip a note between two of its moves).
 */
export function spotsAlong(spots: readonly Spot[], ax: number, ay: number, bx: number, by: number, reach: number): number[] {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const hit: [number, number][] = [];
  spots.forEach((s, i) => {
    const u = l2 ? Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y - ay) * dy) / l2)) : 0;
    if (Math.hypot(ax + dx * u - s.x, ay + dy * u - s.y) <= reach) hit.push([u, i]);
  });
  return hit.sort((p, q) => p[0] - q[0]).map((h) => h[1]);
}

/** the song goes on with note i: one learned, not the one just sung, and no longer than MAX_NOTES */
export function extend(song: number[], i: number, known: (i: number) => boolean): boolean {
  if (!known(i) || song[song.length - 1] === i || song.length >= MAX_NOTES) return false;
  song.push(i);
  return true;
}

// ----- the answers ----- //

/** an animal that may hear the song */
export interface Listener {
  x: number; y: number; z: number;
  /** the chapter it lives in (its index in the map) */
  chapter: number;
  /** it carries a light of its own */
  glows: boolean;
}

export interface Answer {
  /** the listener that answers */
  who: number;
  /** the note of the song it answers (its rank in the song) */
  k: number;
  /** when, after the song starts (s) */
  at: number;
}

/** how far the song carries (world px), how many answer at most, how fast the answer comes back (px/s) */
export const HEARD = 760, ANSWERS = 8, ECHO_SPEED = 1100;

/**
 * Who answers a song (the chapter indices of its notes): an animal hears the note of its own chapter and answers it;
 * one that shines answers any song, from its first note. The nearest answer, each once, after its note has reached it.
 */
export function answersTo(song: readonly number[], singer: { x: number; y: number }, ls: readonly Listener[], heard = HEARD, max = ANSWERS): Answer[] {
  const all: (Answer & { d: number })[] = [];
  ls.forEach((l, who) => {
    const d = Math.hypot(l.x - singer.x, l.y - singer.y, l.z);
    if (d > heard) return;
    let k = song.indexOf(l.chapter);
    if (k < 0 && l.glows) k = 0;
    if (k < 0) return;
    all.push({ who, k, d, at: k * GAP + 0.6 + d / ECHO_SPEED });
  });
  return all.sort((a, b) => a.d - b.d).slice(0, max).sort((a, b) => a.at - b.at).map(({ who, k, at }) => ({ who, k, at }));
}

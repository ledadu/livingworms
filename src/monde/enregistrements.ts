// The recordings of the ambience (docs/direction-artistique.md, « Le son »; docs/decisions.md, « Technique »): a few
// short MP3 files taken from Freesound (src/monde/sons/, their credits beside them), played by bruits-son.ts where a
// sound made in the code sounded too electronic. What each file is for, how a loop is made seamless, where the noises
// lie in a file of several, and the credits. Pure and tested; enregistrements-son.ts loads and decodes them.

import { clamp } from '../engine';

/** the recordings, by the name of their file in src/monde/sons/ */
export type RecName = 'eau' | 'ressac' | 'bulles' | 'glace' | 'baleines';

/** how a recording is found in its file: one loop, or several noises one after the other (cues) */
export interface RecKind {
  /** a loop, its end faded into its start over this many seconds */
  loop?: number;
  /** several noises: how far above the quiet of the file one rises (dB), the shortest and the longest kept (s) */
  cues?: { rise: number; min: number; max: number };
}

export const RECS: Record<RecName, RecKind> = {
  // the water all around and the waves overhead: beds, all along
  eau: { loop: 1.5 },
  ressac: { loop: 1.5 },
  // puffs of bubbles out of silence
  bulles: { cues: { rise: 14, min: 0.05, max: 1.6 } },
  // the ice that cracks, rings and settles
  glace: { cues: { rise: 14, min: 0.05, max: 4 } },
  // the calls of the whales over the sea's own noise (its short clicks are not calls)
  baleines: { cues: { rise: 6, min: 0.8, max: 4.5 } }
};

/** the order they are loaded in, once the page may sound: the beds first, the rarest last */
export const LOAD_ORDER: RecName[] = ['eau', 'ressac', 'bulles', 'baleines', 'glace'];

/**
 * A recording made into a loop: the silence a decoder adds at its ends cut off, then its last `fade` seconds faded
 * into its first ones (at equal power: the recordings are noise, their two ends unrelated) so that it loops without
 * a click or a dip. The loop is that much shorter.
 */
export function loopable(d: Float32Array, rate: number, fade: number): Float32Array {
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const quiet = peak * 0.003;
  let a = 0, b = d.length;
  while (a < b && Math.abs(d[a]) <= quiet) a++;
  while (b > a && Math.abs(d[b - 1]) <= quiet) b--;
  const s = d.subarray(a, b), m = Math.min(Math.floor(rate * fade), Math.floor(s.length / 3));
  const out = s.slice(0, s.length - m);
  for (let i = 0; i < m; i++) {
    const u = (i + 0.5) / m;
    out[i] = s[i] * Math.sin((u * Math.PI) / 2) + s[s.length - m + i] * Math.cos((u * Math.PI) / 2);
  }
  return out;
}

/** a noise in a file of several: where it starts and how long it is (s), how loud its peak is (0..1) */
export interface Cue { at: number; len: number; peak: number; }

/**
 * Where the noises lie in a recording of several (bubbles, cracks of ice, calls): a noise starts where the loudness
 * (by 10 ms) rises `rise` dB above the quiet of the file (its quietest fifth), and ends once it has fallen back to
 * half that rise for 0.12 s; a little before and after are kept, none shorter than `min` nor longer than `max` seconds.
 */
export function cues(d: Float32Array, rate: number, rise: number, max = 4, min = 0.05): Cue[] {
  const step = Math.max(1, Math.round(rate * 0.01)), n = Math.floor(d.length / step), db = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * step; i < (f + 1) * step; i++) s += d[i] * d[i];
    db[f] = 10 * Math.log10(s / step + 1e-12);
  }
  if (!n) return [];
  const sorted = Array.from(db).sort((x, y) => x - y), floor = sorted[Math.floor(n * 0.2)], top = sorted[n - 1];
  const on = Math.max(floor + rise, top - 45), off = floor + rise / 2, hold = 12, pre = 0.02, post = 0.12;
  const out: Cue[] = [];
  let start = -1, last = -1;
  const close = (end: number) => {
    const at = Math.max(0, start * step / rate - pre), stop = Math.min(d.length / rate, (end + 1) * step / rate + post);
    const len = Math.min(max, stop - at);
    let peak = 0;
    for (let i = Math.floor(at * rate); i < Math.min(d.length, Math.floor((at + len) * rate)); i++) peak = Math.max(peak, Math.abs(d[i]));
    if (len >= min) out.push({ at, len, peak });
    start = -1;
  };
  for (let f = 0; f < n; f++) {
    if (start < 0) {
      if (db[f] >= on) { start = f; last = f; }
      continue;
    }
    if (db[f] >= off) last = f;
    else if (f - last >= hold) close(last);
  }
  if (start >= 0) close(last);
  return out;
}

/** the gain that brings a cue's peak to `to`, by halves (a quiet one stays a little quieter), at most 4 */
export function cueGain(c: Cue, to = 0.5): number {
  return clamp(Math.sqrt(to / Math.max(c.peak, 1e-4)), 0.25, 4);
}

/** the bytes of a file inlined in the page (a data: URL in base64), without a fetch */
export function dataBytes(url: string): ArrayBuffer | null {
  const m = /^data:[^,]*;base64,(.*)$/s.exec(url);
  if (!m) return null;
  const s = atob(m[1]), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b.buffer;
}

// ----- the credits ----- //

/** a line of the credits: a file, its title, its author, its licence, where it comes from */
export interface Credit {
  file: string; title: string; author: string; license: string; licenseUrl: string; url: string;
  /** what was kept of it, and what it does in the game */
  excerpt: string; use: string;
}

const FIELDS = ['file', 'title', 'author', 'license', 'licenseUrl', 'url', 'excerpt', 'use'] as const;
/** the licences a recording of the game may have: the public domain, or credit given */
export const LICENSES = /^(CC0 1\.0|CC BY [34]\.0)$/;

/** the lines of the credits file (sons/credits.json), each checked: every field there, a known licence, links */
export function parseCredits(o: unknown): Credit[] {
  const list = (o as { sounds?: unknown })?.sounds;
  if (!Array.isArray(list)) throw new Error('credits: no « sounds » list');
  return list.map((x, i) => {
    for (const k of FIELDS) if (typeof x?.[k] !== 'string' || !x[k].trim()) throw new Error(`credits: line ${i} has no ${k}`);
    if (!LICENSES.test(x.license)) throw new Error(`credits: ${x.file}: licence « ${x.license} » not allowed`);
    for (const k of ['url', 'licenseUrl'] as const) if (!/^https:\/\//.test(x[k])) throw new Error(`credits: ${x.file}: ${k} is not a link`);
    return Object.fromEntries(FIELDS.map((k) => [k, x[k]])) as unknown as Credit;
  });
}

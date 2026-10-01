// The music of the sea (docs/direction-artistique.md, « Le son »): one ambience per chapter, made in the code. Each
// has a drone that breathes, chords that swell and fade one after the other (the pads), the harmonics of its root
// shimmering above them, and a few notes here and there. All in D major, the key of the song, whose notes keep to
// its pentatonic: whatever is sung sits in the music. The ambiences blend at the borders like the light.
// The score, pure and tested; musique-son.ts plays it with the Web Audio API.

import { clamp } from '../engine';
import { BIOMES, presence, type ChapterId } from './biomes';

/** the pitch of a MIDI note (A4 = 69 = 440 Hz) */
export const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** the pitch classes of D major (C = 0), and of its pentatonic, the scale of the song */
export const KEY = [2, 4, 6, 7, 9, 11, 1];
export const PENTA = [2, 4, 6, 9, 11];
const pc = (m: number) => ((m % 12) + 12) % 12;
export const inKey = (m: number): boolean => KEY.includes(pc(m));
export const inPenta = (m: number): boolean => PENTA.includes(pc(m));

/** the notes of the song as MIDI, one per chapter of the descent, from the éclat (A5) down to the silence (D4) */
export const SONG = [81, 78, 76, 74, 71, 69, 66, 64, 62];

/** the harmonics of a periodic wave, by rank (1: the fundamental) */
export const WAVES = {
  /** almost a sine */
  soft: [0, 1, 0.16, 0.05],
  /** round and warm, like a triangle */
  warm: [0, 1, 0.42, 0.18, 0.08, 0.04],
  /** the odd harmonics: a flute of an organ, a bottle blown into */
  hollow: [0, 1, 0.04, 0.36, 0.02, 0.16, 0, 0.07],
  /** full, filtered down afterwards */
  bright: [0, 1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12, 0.1, 0.09],
  /** octaves above the note: a sheen of glass */
  glass: [0, 1, 0.18, 0, 0.3, 0, 0, 0, 0.14]
};
export type Wave = keyof typeof WAVES;

/** the short notes: a bell of light, a soft mallet, a pluck, glass, a drop, a slow swell */
export type Tone = 'bell' | 'mallet' | 'pluck' | 'glass' | 'drop' | 'swell';

export interface Ambience {
  chapter: ChapterId;
  /** how loud the whole chapter plays */
  level: number;
  /** the low notes held all along (MIDI), breathing this many times a second */
  drone: { notes: number[]; wave: Wave; gain: number; breathe: number; lp: number };
  /**
   * The chords (MIDI), one after the other, each held `len` s (a range), swelling in `attack` s and fading in
   * `release` s under the next; each note doubled `detune` cents apart; through a low-pass at `lp` Hz that sweeps
   * [times a second, by this share of lp].
   */
  pad: { chords: number[][]; len: [number, number]; attack: number; release: number; wave: Wave; detune: number; gain: number; lp: number; sweep: [number, number] };
  /** the harmonics of `root` (their ranks), each coming and going every `every` s or so */
  harm: { root: number; partials: number[]; gain: number; every: number };
  /**
   * A few notes here and there: a phrase of `notes` (a range) every `every` s (a range), `step` s apart, in
   * [lo, hi]; taken from the pentatonic, from the chord playing, or along a sequence of their own. An echo: [s, feedback].
   */
  motif: { tone: Tone; lo: number; hi: number; every: [number, number]; notes: [number, number]; step: number; gain: number; from: 'penta' | 'chord' | number[]; echo?: [number, number] };
  /** how much of the music goes to the reverb, and of the song sung here */
  space: number; voiceSpace: number;
}

export const AMBIENCES: Record<ChapterId, Ambience> = {
  // the light: high, open, bells glinting above the swimmer
  nurserie: {
    chapter: 'nurserie', level: 1,
    drone: { notes: [50, 57], wave: 'soft', gain: 0.1, breathe: 0.07, lp: 1400 },
    pad: {
      chords: [[62, 66, 69, 76], [55, 62, 66, 69, 71], [59, 66, 69, 74], [57, 64, 66, 71]],
      len: [11, 16], attack: 4, release: 7, wave: 'soft', detune: 5, gain: 0.1, lp: 4200, sweep: [0.06, 0.35]
    },
    harm: { root: 50, partials: [2, 3, 4, 5, 6, 8], gain: 0.04, every: 3.5 },
    motif: { tone: 'bell', lo: 81, hi: 93, every: [5, 11], notes: [1, 3], step: 0.36, gain: 0.07, from: 'penta' },
    space: 0.35, voiceSpace: 0.3
  },
  // the city of coral: warmer, brighter chords, and little figures beating like fins
  recif: {
    chapter: 'recif', level: 0.95,
    drone: { notes: [43, 50], wave: 'warm', gain: 0.09, breathe: 0.09, lp: 700 },
    pad: {
      chords: [[55, 59, 66, 69, 74], [57, 61, 66, 71, 76], [54, 61, 64, 69], [59, 62, 66, 69, 73]],
      len: [8, 12], attack: 2.5, release: 5, wave: 'warm', detune: 7, gain: 0.085, lp: 2600, sweep: [0.11, 0.4]
    },
    harm: { root: 43, partials: [3, 4, 5, 6, 8], gain: 0.03, every: 3 },
    motif: { tone: 'pluck', lo: 62, hi: 81, every: [4, 8], notes: [3, 6], step: 0.24, gain: 0.055, from: 'chord' },
    space: 0.28, voiceSpace: 0.25
  },
  // the cathedral of kelp: slow organ chords in E dorian, the light breathing through the fronds
  foret: {
    chapter: 'foret', level: 0.9,
    drone: { notes: [40, 47], wave: 'hollow', gain: 0.1, breathe: 0.05, lp: 520 },
    pad: {
      chords: [[52, 55, 62, 66], [52, 57, 59, 64], [52, 57, 61, 64], [52, 55, 62, 66], [47, 55, 62, 66], [47, 54, 57, 64]],
      len: [12, 18], attack: 5, release: 8, wave: 'hollow', detune: 4, gain: 0.1, lp: 1500, sweep: [0.04, 0.5]
    },
    harm: { root: 40, partials: [3, 4, 6, 8], gain: 0.026, every: 5 },
    motif: { tone: 'mallet', lo: 52, hi: 71, every: [7, 14], notes: [2, 4], step: 0.6, gain: 0.06, from: 'penta' },
    space: 0.5, voiceSpace: 0.45
  },
  // the galleries: thin dark chords far apart, drops of notes that come back from the walls
  grotte: {
    chapter: 'grotte', level: 1.1,
    drone: { notes: [35, 42], wave: 'hollow', gain: 0.11, breathe: 0.04, lp: 380 },
    pad: {
      chords: [[47, 54, 62, 64], [43, 50, 54, 62], [47, 55, 62, 64], [42, 49, 57, 59]],
      len: [16, 24], attack: 6, release: 9, wave: 'hollow', detune: 3, gain: 0.065, lp: 900, sweep: [0.03, 0.4]
    },
    harm: { root: 35, partials: [4, 6], gain: 0.013, every: 6 },
    motif: { tone: 'drop', lo: 74, hi: 86, every: [4, 9], notes: [1, 2], step: 0.8, gain: 0.07, from: 'penta', echo: [0.42, 0.5] },
    space: 0.8, voiceSpace: 0.75
  },
  // the whale fall: tender, two voices close together, and the first notes of the song remembered an octave down
  carcasse: {
    chapter: 'carcasse', level: 0.95,
    drone: { notes: [43, 50], wave: 'warm', gain: 0.1, breathe: 0.06, lp: 620 },
    pad: {
      chords: [[55, 59, 62, 66], [54, 57, 62, 66, 69], [52, 55, 59, 62, 66], [45, 57, 62, 64], [47, 54, 57, 62, 64]],
      len: [12, 17], attack: 4, release: 8, wave: 'warm', detune: 8, gain: 0.095, lp: 1300, sweep: [0.05, 0.3]
    },
    harm: { root: 43, partials: [2, 3, 4, 5], gain: 0.028, every: 4 },
    motif: { tone: 'bell', lo: 62, hi: 81, every: [9, 16], notes: [3, 4], step: 0.55, gain: 0.05, from: [69, 66, 64, 62] },
    space: 0.4, voiceSpace: 0.35
  },
  // the chimneys: a low burning drone over D, chords that shimmer like hot water, embers of low notes
  sources: {
    chapter: 'sources', level: 1.25,
    drone: { notes: [38, 45], wave: 'bright', gain: 0.08, breathe: 0.08, lp: 420 },
    pad: {
      chords: [[50, 57, 62, 64], [50, 55, 59, 64], [50, 54, 59, 66], [50, 57, 61, 64]],
      len: [10, 15], attack: 3.5, release: 6, wave: 'bright', detune: 9, gain: 0.07, lp: 900, sweep: [0.07, 0.45]
    },
    harm: { root: 38, partials: [3, 5, 6, 9], gain: 0.024, every: 2.5 },
    motif: { tone: 'mallet', lo: 45, hi: 64, every: [6, 12], notes: [1, 3], step: 0.5, gain: 0.065, from: 'penta' },
    space: 0.3, voiceSpace: 0.3
  },
  // the ice: open fourths and fifths, thin and still, and crystals tinkling high above
  glacier: {
    chapter: 'glacier', level: 1.15,
    drone: { notes: [35, 54], wave: 'soft', gain: 0.07, breathe: 0.03, lp: 900 },
    pad: {
      chords: [[59, 66, 71, 73], [54, 61, 66, 71], [62, 66, 69, 73, 76], [64, 66, 71, 76]],
      len: [14, 20], attack: 6, release: 9, wave: 'glass', detune: 2, gain: 0.065, lp: 7000, sweep: [0.02, 0.2]
    },
    harm: { root: 35, partials: [8, 12, 16], gain: 0.018, every: 6 },
    motif: { tone: 'glass', lo: 78, hi: 90, every: [3, 7], notes: [2, 5], step: 0.16, gain: 0.04, from: 'penta' },
    space: 0.55, voiceSpace: 0.5
  },
  // the jellyfish: lush floating chords, the whole garden pulsing slowly
  jardin: {
    chapter: 'jardin', level: 0.9,
    drone: { notes: [45, 52], wave: 'soft', gain: 0.09, breathe: 0.33, lp: 800 },
    pad: {
      chords: [[57, 64, 66, 71, 73], [55, 62, 66, 69, 73], [47, 57, 62, 66, 73], [57, 62, 66, 73, 76]],
      len: [12, 18], attack: 5, release: 8, wave: 'soft', detune: 10, gain: 0.095, lp: 2400, sweep: [0.12, 0.3]
    },
    harm: { root: 45, partials: [2, 3, 4, 5, 6], gain: 0.028, every: 3 },
    motif: { tone: 'swell', lo: 64, hi: 76, every: [6, 12], notes: [1, 2], step: 1.4, gain: 0.06, from: 'penta' },
    space: 0.5, voiceSpace: 0.5
  },
  // the dark and the silence: a deep breath, a chord now and then, a far blue note that echoes
  fosse: {
    chapter: 'fosse', level: 0.8,
    drone: { notes: [38, 45], wave: 'soft', gain: 0.08, breathe: 0.025, lp: 300 },
    pad: {
      chords: [[50, 57, 64, 69], [47, 54, 61, 66], [45, 52, 57, 64]],
      len: [22, 34], attack: 8, release: 12, wave: 'soft', detune: 3, gain: 0.045, lp: 700, sweep: [0.02, 0.3]
    },
    harm: { root: 38, partials: [3, 4, 6], gain: 0.02, every: 7 },
    motif: { tone: 'swell', lo: 81, hi: 88, every: [14, 30], notes: [1, 1], step: 1, gain: 0.035, from: 'penta', echo: [0.6, 0.45] },
    space: 0.65, voiceSpace: 0.7
  },
  // everything lights up: the chords rise, every harmonic shines, and the song goes up again, note after note
  remontee: {
    chapter: 'remontee', level: 1.25,
    drone: { notes: [38, 45, 50], wave: 'warm', gain: 0.085, breathe: 0.06, lp: 900 },
    pad: {
      chords: [[50, 57, 62, 64, 66], [49, 57, 64, 69, 73], [47, 57, 62, 66, 74], [43, 59, 62, 66, 69]],
      len: [8, 11], attack: 3, release: 6, wave: 'bright', detune: 6, gain: 0.075, lp: 3600, sweep: [0.05, 0.35]
    },
    harm: { root: 38, partials: [2, 3, 4, 5, 6, 8], gain: 0.034, every: 2.5 },
    motif: { tone: 'bell', lo: 62, hi: 81, every: [6, 10], notes: [3, 5], step: 0.5, gain: 0.055, from: [...SONG].reverse() },
    space: 0.45, voiceSpace: 0.4
  }
};

/** the ambience of each chapter, in the order of the map */
export const BY_INDEX: Ambience[] = BIOMES.map((b) => AMBIENCES[b.id]);

// ----- the moments ----- //

/** the moments of the story the music answers: the farewell to a parent, the dance of a parade */
export type Moment = 'adieu' | 'parade' | null;

/** how loud the music plays in a moment, and how often its notes here and there come (× as often; 0: none) */
export const MOMENTS: Record<'adieu' | 'parade', { level: number; notes: number }> = {
  // the words of the farewell: the music steps back and only holds its chords
  adieu: { level: 0.6, notes: 0 },
  // the dance: the notes come twice as often
  parade: { level: 1, notes: 2 }
};

/** the time until the next phrase of a motif (s), in a moment; Infinity when the moment holds them back */
export function motifGap(every: [number, number], r: () => number, moment: Moment = null): number {
  const k = moment ? MOMENTS[moment].notes : 1;
  return k > 0 ? lengthIn(r, every) / k : Infinity;
}

// ----- where ----- //

/**
 * The chapters heard at x and how loud: the same blend as the light at the borders (biomes.presence), with an
 * equal-power curve so that the music neither dips nor swells across it.
 */
export function mixAt(x: number): { i: number; g: number }[] {
  const out: { i: number; g: number }[] = [];
  BIOMES.forEach((_, i) => {
    const p = presence(x, i);
    if (p > 0.001) out.push({ i, g: Math.sin((Math.min(1, p) * Math.PI) / 2) });
  });
  return out;
}

/** where the low-pass of a chapter's chords is at t (s): it sweeps slowly around its cut-off, from this phase */
export function sweepAt(pad: Ambience['pad'], t: number, phase = 0): number {
  return pad.lp * (1 + pad.sweep[1] * Math.sin(2 * Math.PI * pad.sweep[0] * t + phase));
}

/** the water muffles the music a little as it deepens: the cut-off (Hz) of its low-pass at these metres */
export function muffle(metres: number): number {
  return 5000 + 11000 * Math.exp(-Math.max(0, metres) / 200);
}

/** a volume of the settings (0..1, `def` its default) as a gain: 1 at the default, a curve the ear hears as even */
export function volumeGain(v: number, def: number): number {
  return Math.pow(clamp(v, 0, 1) / def, 2);
}

// ----- chance ----- //

/** a whole number in [a, b] */
const between = (r: () => number, [a, b]: [number, number]) => a + Math.floor(r() * (b - a + 1));
/** a length of time in [a, b] */
export const lengthIn = (r: () => number, [a, b]: [number, number]): number => a + r() * (b - a);

/** the chord after `prev` (its rank): the next one mostly, now and then another, never the same */
export function nextChord(n: number, prev: number, r: () => number): number {
  if (n < 2) return 0;
  if (prev < 0) return Math.floor(r() * n);
  if (n < 3 || r() < 0.78) return (prev + 1) % n;
  const k = Math.floor(r() * (n - 2));
  return (prev + 2 + k) % n;
}

/** the notes of the pentatonic in [lo, hi] */
export function pentaIn(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (inPenta(m)) out.push(m);
  return out;
}

/** the notes of a chord that are in the pentatonic, brought by octaves into [lo, hi] */
export function chordIn(chord: readonly number[], lo: number, hi: number): number[] {
  const out = new Set<number>();
  for (const m of chord) if (inPenta(m)) for (let o = m - 48; o <= hi; o += 12) if (o >= lo) out.add(o);
  return [...out].sort((a, b) => a - b);
}

export interface Played { at: number; midi: number }

/**
 * A phrase of the motif over this chord: `at` s from its start. From the pentatonic, a walk of small steps; from the
 * chord, an arpeggio up or down; from a sequence, a few of its notes in a row.
 */
export function phrase(m: Ambience['motif'], chord: readonly number[], r: () => number): Played[] {
  const n = between(r, m.notes);
  let notes: number[];
  if (Array.isArray(m.from)) {
    const seq = m.from, k = Math.floor(r() * Math.max(1, seq.length - n + 1));
    notes = seq.slice(k, k + n);
  } else {
    const pool = m.from === 'chord' ? chordIn(chord, m.lo, m.hi) : pentaIn(m.lo, m.hi);
    if (!pool.length) return [];
    notes = [];
    if (m.from === 'chord') {
      // up or down the chord, turning back at its ends
      let k = Math.floor(r() * pool.length), dir = r() < 0.6 ? 1 : -1;
      for (let q = 0; q < n; q++) {
        notes.push(pool[k]);
        if (pool.length < 2) continue;
        if (k + dir < 0 || k + dir >= pool.length) dir = -dir;
        k += dir;
      }
    } else {
      let k = Math.floor(r() * pool.length);
      for (let q = 0; q < n; q++) {
        notes.push(pool[k]);
        const s = (r() < 0.7 ? 1 : 2) * (r() < 0.5 ? -1 : 1);
        k = k + s < 0 || k + s >= pool.length ? k - s : k + s;
        k = clamp(k, 0, pool.length - 1);
      }
    }
  }
  let t = 0;
  return notes.map((midi, q) => {
    if (q) t += m.step * (1 + 0.25 * r());
    return { at: t, midi };
  });
}

/** how loud each harmonic is for the next while: some near silent, some full, never all quiet */
export function harmLevels(n: number, r: () => number): number[] {
  const out = Array.from({ length: n }, () => (r() < 0.3 ? 0.05 * r() : 0.25 + 0.75 * r()));
  if (n && Math.max(...out) < 0.5) out[Math.floor(r() * n)] = 1;
  return out;
}

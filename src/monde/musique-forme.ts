// The form of the music (docs/direction-artistique.md, « Le son »): an ambience does not stay the same while the
// swimmer stays. It goes by in sections, a few chords each: bare, calm, singing, full. Each section leans on the
// voices its own way (the drone, the chords, the harmonics, how often the notes come, how bright the chords), voices
// its chords its own way, takes its notes higher or lower, and follows its chords its own way. Within a section, the
// phrase of the notes comes back changed each time: moved along the scale, turned around, another rhythm, longer or
// shorter. Every chord voiced here keeps the notes of its chapter, in D major; the phrases keep to the pentatonic.
// Pure and tested; musique-son.ts plays it.

import type { ChapterId } from './biomes';
import { chordIn, pentaIn, phrase, type Ambience, type Played } from './musique';

/** the kinds of section, from the quietest to the fullest */
export type SectionKind = 'nu' | 'calme' | 'chant' | 'plein';
export const RANKS: SectionKind[] = ['nu', 'calme', 'chant', 'plein'];

/** how a section voices its chords: as written, thinner, the low note up, spread, or fuller */
export type Voicing = 'tel' | 'mince' | 'haut' | 'ouvert' | 'plein';
/** how a section goes from chord to chord: on along the chapter's, rocking between two, or anywhere */
export type Path = 'suite' | 'balance' | 'libre';

export interface Kind {
  /** the voices, × the ambience's: the drone, the chords, the harmonics */
  drone: number; pad: number; harm: number;
  /** × as often the notes here and there come */
  notes: number;
  /** × the cut-off of the chords' low-pass */
  bright: number;
  voicings: Voicing[]; paths: Path[];
  /** the octaves its notes lean to (−1, 0, 1), when the chapter allows them */
  lean: number[];
}

export const KINDS: Record<SectionKind, Kind> = {
  // bare: the drone and the harmonics come forward, thin chords rocking, a note now and then
  nu: { drone: 1.15, pad: 0.6, harm: 1.3, notes: 0.35, bright: 0.72, voicings: ['mince'], paths: ['balance'], lean: [0, -1] },
  // calm: soft chords, few notes, lower
  calme: { drone: 1, pad: 0.88, harm: 0.95, notes: 0.65, bright: 0.86, voicings: ['mince', 'tel', 'haut'], paths: ['suite', 'balance'], lean: [0, 0, -1] },
  // singing: the notes come forward over the chords, higher
  chant: { drone: 0.92, pad: 0.95, harm: 0.8, notes: 1.5, bright: 1, voicings: ['tel', 'haut', 'ouvert'], paths: ['suite', 'libre'], lean: [0, 0, 1] },
  // full: every voice, the chords wide and bright
  plein: { drone: 1.08, pad: 1.22, harm: 1.2, notes: 1.15, bright: 1.28, voicings: ['plein', 'ouvert'], paths: ['suite', 'libre'], lean: [0] }
};

export interface Form {
  /** how far its sections depart from the ambience as made (0: not at all, 1: as far as the kinds go) */
  swing: number;
  /** how many chords a section lasts */
  chords: [number, number];
  /** the octaves its notes may move to (0 always among them): its character stays where it is */
  octaves: number[];
}

export const FORMS: Record<ChapterId, Form> = {
  nurserie: { swing: 0.9, chords: [3, 5], octaves: [0, -1] },
  recif: { swing: 1, chords: [3, 6], octaves: [0, -1, 1] },
  foret: { swing: 0.8, chords: [2, 4], octaves: [0, -1, 1] },
  grotte: { swing: 0.7, chords: [2, 3], octaves: [0, -1] },
  carcasse: { swing: 0.8, chords: [3, 4], octaves: [0, 1] },
  sources: { swing: 0.85, chords: [3, 5], octaves: [0, 1] },
  // the ice stays still, its crystals high
  glacier: { swing: 0.55, chords: [2, 4], octaves: [0] },
  jardin: { swing: 0.8, chords: [3, 4], octaves: [0, -1, 1] },
  // almost nothing, and so almost nothing changes
  fosse: { swing: 0.45, chords: [2, 3], octaves: [0, -1] },
  remontee: { swing: 1, chords: [4, 6], octaves: [0, 1] }
};

export interface Section {
  kind: SectionKind;
  /** how many chords it lasts */
  chords: number;
  drone: number; pad: number; harm: number; notes: number; bright: number;
  voicing: Voicing; path: Path;
  /** how many octaves its notes move */
  octave: number;
}

const pick = <T>(xs: readonly T[], r: () => number): T => xs[Math.floor(r() * xs.length)];

/**
 * The kind of the section after `prev`: mostly one step quieter or fuller, now and then a leap (a full section that
 * suddenly clears, a bare one that bursts into song), never the same twice. A chapter begins calm or singing.
 */
export function nextKind(prev: SectionKind | null, r: () => number): SectionKind {
  if (!prev) return r() < 0.5 ? 'calme' : 'chant';
  const k = RANKS.indexOf(prev);
  if (r() < 0.2) {
    const far = RANKS.filter((_, q) => Math.abs(q - k) >= 2);
    return pick(far, r);
  }
  const near = [k - 1, k + 1].filter((q) => q >= 0 && q < RANKS.length);
  return RANKS[pick(near, r)];
}

/** the next section of a chapter, after one of kind `prev` */
export function nextSection(chapter: ChapterId, prev: SectionKind | null, r: () => number): Section {
  const f = FORMS[chapter], kind = nextKind(prev, r), K = KINDS[kind], s = (v: number) => 1 + (v - 1) * f.swing;
  const leans = K.lean.filter((o) => f.octaves.includes(o));
  return {
    kind, chords: f.chords[0] + Math.floor(r() * (f.chords[1] - f.chords[0] + 1)),
    drone: s(K.drone), pad: s(K.pad), harm: s(K.harm), notes: s(K.notes), bright: s(K.bright),
    voicing: pick(K.voicings, r), path: pick(K.paths, r), octave: leans.length ? pick(leans, r) : 0
  };
}

// ----- the chords ----- //

/** the chord after `prev` along a path; `before` the one before it (to rock between the two) */
export function pathChord(path: Path, n: number, prev: number, before: number, r: () => number): number {
  if (n < 2) return 0;
  if (prev < 0) return Math.floor(r() * n);
  if (path === 'balance' && before >= 0 && before !== prev && before < n) return before;
  if (path === 'libre' || (path === 'balance' && n > 2)) return (prev + 1 + Math.floor(r() * (n - 1))) % n;
  return n < 3 || r() < 0.85 ? (prev + 1) % n : (prev + 2) % n;
}

/** the highest a voiced chord reaches (MIDI) */
const TOP = 86;
const pcOf = (m: number) => ((m % 12) + 12) % 12;
/** a pitch class a semitone (or a major seventh) from one of these: it would rub */
const rubs = (p: number, pcs: number[]) => pcs.some((q) => { const d = Math.abs(p - q) % 12; return d === 1 || d === 11; });
/** a note too close to the others of the chord (a semitone or less) */
const crowds = (m: number, chord: number[]) => chord.some((n) => Math.abs(n - m) <= 1);

/** the pitch classes of a chapter's chords: what its harmony is made of */
export function palette(a: Ambience): number[] {
  return [...new Set(a.pad.chords.flat().map(pcOf))].sort((x, y) => x - y);
}

/**
 * A chord voiced for a section: as written; thin (its low, middle and high notes); its low note up an octave; its
 * second note up an octave (spread); or fuller, its low note again above the top and a note of the chapter's own
 * palette added in the middle, one that rubs with none. Only the chapter's own notes, in its own register.
 */
export function voice(chord: readonly number[], v: Voicing, pal: number[] = []): number[] {
  const c = [...chord].sort((x, y) => x - y), n = c.length, top = c[n - 1];
  const raise = (q: number): number[] => {
    const m = c[q] + 12, rest = c.filter((_, k) => k !== q);
    return m > TOP || crowds(m, rest) ? c : [...rest, m].sort((x, y) => x - y);
  };
  switch (v) {
    case 'mince': return n <= 3 ? c : [c[0], c[Math.floor(n / 2)], c[n - 1]];
    case 'haut': return n < 3 ? c : raise(0);
    case 'ouvert': return n < 3 ? c : raise(1);
    case 'plein': {
      const out = [...c];
      let o = c[0];
      while (o <= top) o += 12;
      if (o <= TOP && !crowds(o, out)) out.push(o);
      const pcs = c.map(pcOf), add = pal.filter((p) => !pcs.includes(p) && !rubs(p, pcs));
      // in the middle of the chord, the lowest place it fits
      for (const p of add) {
        let m = c[1] ?? c[0];
        while (pcOf(m) !== p) m++;
        if (m < top && !crowds(m, out)) { out.push(m); break; }
      }
      return out.sort((x, y) => x - y);
    }
    default: return c;
  }
}

// ----- the notes ----- //

type Motif = Ambience['motif'];

/** the motif of an ambience moved by octaves: its range, and its own sequence if it has one */
export function shifted(m: Motif, octave: number): Motif {
  if (!octave) return m;
  const d = 12 * octave;
  return { ...m, lo: m.lo + d, hi: m.hi + d, from: Array.isArray(m.from) ? m.from.map((x) => x + d) : m.from };
}

const same = (a: Played[], b: Played[]) => a.length === b.length && a.every((n, q) => n.midi === b[q].midi && Math.abs(n.at - b[q].at) < 1e-9);
/** the place in a pool nearest to a note */
const nearest = (pool: number[], m: number) => pool.reduce((best, x, q) => (Math.abs(x - m) < Math.abs(pool[best] - m) ? q : best), 0);

/** a phrase from its notes and its gaps (each at least the motif's step) */
const timed = (notes: number[], gaps: number[]): Played[] => {
  let t = 0;
  return notes.map((midi, q) => { if (q) t += gaps[q - 1]; return { at: t, midi }; });
};

/** the ways a phrase comes back changed: moved along its scale, backwards, upside down, another rhythm, longer or shorter */
export type Change = 'transpose' | 'renverse' | 'miroir' | 'rythme' | 'longueur';

/**
 * The phrase after `prev` in a section: the same idea, changed by one or two of the ways, never played back the
 * same. Over a chord, its notes move to the nearest of the chord; a sequence of its own (the song) is only moved along
 * itself, shortened or lengthened, and its rhythm changed: it stays recognisable, and keeps its direction.
 */
export function vary(prev: Played[], m: Motif, chord: readonly number[], r: () => number): Played[] {
  if (!prev.length) return phrase(m, chord, r);
  const seq = Array.isArray(m.from) ? m.from : null;
  const pool = seq ?? (m.from === 'chord' ? chordIn(chord, m.lo, m.hi) : pentaIn(m.lo, m.hi));
  if (!pool.length) return [];
  const [n0, n1] = [m.notes[0], Math.min(m.notes[1], seq ? seq.length : Infinity)];
  let at = prev.map((p) => nearest(pool, p.midi));
  let gaps = prev.slice(1).map((p, q) => Math.max(m.step, p.at - prev[q].at));
  const ways: Change[] = seq ? ['transpose', 'rythme', 'longueur'] : at.length > 1 ? ['transpose', 'renverse', 'miroir', 'rythme', 'longueur'] : ['transpose', 'rythme', 'longueur'];
  const move = (k: number) => {
    // a sequence moves as one slice along itself
    const lo = Math.min(...at), hi = Math.max(...at);
    const d = lo + k < 0 || hi + k >= pool.length ? -k : k;
    if (lo + d >= 0 && hi + d < pool.length) at = at.map((q) => q + d);
  };
  const change = (w: Change) => {
    if (w === 'transpose') move(seq ? (r() < 0.5 ? -1 : 1) : pick([-2, -1, 1, 2], r));
    else if (w === 'renverse') { at.reverse(); gaps.reverse(); }
    else if (w === 'miroir') { const a0 = at[0]; at = at.map((q) => Math.max(0, Math.min(pool.length - 1, 2 * a0 - q))); }
    else if (w === 'rythme') gaps = gaps.map(() => m.step * pick([1, 1, 1.25, 1.5, 2], r));
    else {
      const longer = at.length < n1 && (at.length <= n0 || r() < 0.5);
      if (longer) {
        // on in the direction it was going (a sequence: on along itself)
        const last = at[at.length - 1], dir = seq ? 1 : at.length > 1 ? Math.sign(last - at[at.length - 2]) || 1 : r() < 0.5 ? -1 : 1;
        const nx = last + dir >= 0 && last + dir < pool.length ? last + dir : last - dir;
        if (nx >= 0 && nx < pool.length && (!seq || nx === last + 1)) { at.push(nx); gaps.push(gaps[gaps.length - 1] ?? m.step); }
      } else if (at.length > Math.max(1, n0)) { at.pop(); gaps.pop(); }
    }
  };
  change(pick(ways, r));
  if (r() < 0.45) change(pick(ways, r));
  let out = timed(at.map((q) => pool[q]), gaps);
  // never the same twice: a step along the scale (or along the sequence) if nothing changed
  if (same(out, prev)) { move(1); out = timed(at.map((q) => pool[q]), gaps); }
  if (same(out, prev)) { gaps = gaps.map((g) => g + m.step * 0.5); out = timed(at.map((q) => pool[q]), gaps); }
  return out;
}

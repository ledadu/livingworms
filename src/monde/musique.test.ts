import { describe, expect, it } from 'vitest';
import { rng } from '../engine';
import { BIOMES, X0, X1, biomeMid, span } from './biomes';
import { NOTES } from './chant';
import {
  AMBIENCES, BY_INDEX, KEY, MOMENTS, SONG, WAVES, chordIn, harmLevels, hz, inKey, inPenta, lengthIn, mixAt, motifGap, muffle, nextChord, pentaIn,
  phrase, sweepAt, volumeGain, type Ambience
} from './musique';

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
const chordNotes = (a: Ambience) => a.pad.chords.flat();

describe('the ambience of each chapter', () => {
  it('has one for every chapter, in the order of the map, each its own', () => {
    expect(BY_INDEX.map((a) => a.chapter)).toEqual(BIOMES.map((b) => b.id));
    const looks = new Set(BY_INDEX.map((a) => JSON.stringify(a.pad.chords)));
    expect(looks.size).toBe(BIOMES.length);
    for (const a of BY_INDEX) {
      expect(a.pad.chords.length).toBeGreaterThanOrEqual(3);
      expect(WAVES[a.pad.wave]).toBeDefined();
      expect(WAVES[a.drone.wave]).toBeDefined();
      expect(a.pad.len[0]).toBeGreaterThan(a.pad.attack);
    }
  });

  it('plays in D major, the key of the song, whose notes keep to its pentatonic', () => {
    expect(KEY).toHaveLength(7);
    for (const a of BY_INDEX) {
      for (const m of [...chordNotes(a), ...a.drone.notes, a.harm.root]) expect(inKey(m), `${a.chapter} ${m}`).toBe(true);
      // the harmonics of the root: none of the 7th, 11th, 13th, 14th, out of tune with the key
      for (const k of a.harm.partials) expect(inKey(a.harm.root + Math.round(12 * Math.log2(k))), `${a.chapter} ×${k}`).toBe(true);
      if (Array.isArray(a.motif.from)) for (const m of a.motif.from) expect(inPenta(m)).toBe(true);
    }
    for (const m of SONG) expect(inPenta(m)).toBe(true);
  });

  it('knows the notes of the song, the pitches of chant.ts', () => {
    expect(SONG).toHaveLength(NOTES.length);
    SONG.forEach((m, i) => expect(hz(m)).toBeCloseTo(NOTES[i].freq, 1));
    expect(hz(69)).toBe(440);
  });

  it('sounds high and light near the surface, low in the dark, quietest in the Fosse', () => {
    const height = (id: keyof typeof AMBIENCES) => mean(chordNotes(AMBIENCES[id]));
    for (const deep of ['foret', 'grotte', 'carcasse', 'sources', 'fosse'] as const) {
      expect(height('nurserie')).toBeGreaterThan(height(deep));
      expect(height('recif')).toBeGreaterThan(height(deep));
    }
    const descent = BY_INDEX.slice(0, 9), low = descent.map((a) => a.chapter).sort((a, b) => height(a) - height(b));
    expect(low.slice(0, 2).sort()).toEqual(['fosse', 'grotte']);
    expect(Math.min(...descent.map((a) => a.level))).toBe(AMBIENCES.fosse.level);
    expect(AMBIENCES.nurserie.drone.notes[0]).toBeGreaterThan(AMBIENCES.fosse.drone.notes[0]);
    // the Grotte rings the longest, its notes come back from the walls
    expect(Math.max(...BY_INDEX.map((a) => a.space))).toBe(AMBIENCES.grotte.space);
    expect(AMBIENCES.grotte.motif.echo).toBeDefined();
  });

  it('remembers the first notes of the song at the Carcasse, and sings it going up in the Remontée', () => {
    expect(AMBIENCES.carcasse.motif.from).toEqual(SONG.slice(0, 4).map((m) => m - 12));
    expect(AMBIENCES.remontee.motif.from).toEqual([...SONG].reverse());
  });
});

describe('the chapters blended at their borders', () => {
  it('plays one chapter alone in its middle', () => {
    BIOMES.forEach((_, i) => expect(mixAt(biomeMid(i))).toEqual([{ i, g: 1 }]));
  });

  it('shares the border between two chapters, at the same power everywhere', () => {
    const [, b] = span('recif');
    const at = mixAt(b);
    expect(at.map((m) => m.i)).toEqual([1, 2]);
    expect(at[0].g).toBeCloseTo(Math.SQRT1_2, 3);
    for (let x = X0; x <= X1; x += 50) {
      const mix = mixAt(x);
      expect(mix.length).toBeGreaterThanOrEqual(1);
      expect(mix.length).toBeLessThanOrEqual(2);
      expect(mix.reduce((s, m) => s + m.g * m.g, 0)).toBeCloseTo(1, 2);
    }
  });
});

describe('the moments of the story', () => {
  it('holds the notes back for a farewell, softer, and brings them twice as often for a dance', () => {
    expect(MOMENTS.adieu.level).toBeLessThan(1);
    expect(motifGap([4, 8], rng(1), 'adieu')).toBe(Infinity);
    const mean = (moment: 'parade' | null) => { const r = rng(2); let s = 0; for (let q = 0; q < 400; q++) s += motifGap([4, 8], r, moment); return s / 400; };
    expect(mean(null)).toBeGreaterThan(5.5);
    expect(mean(null)).toBeLessThan(6.5);
    expect(mean('parade')).toBeCloseTo(mean(null) / 2, 0);
  });
});

describe('the water and the settings', () => {
  it('sweeps the low-pass of the chords slowly around its cut-off', () => {
    const pad = AMBIENCES.foret.pad, [rate, depth] = pad.sweep;
    expect(sweepAt(pad, 0)).toBe(pad.lp);
    expect(sweepAt(pad, 1 / (4 * rate))).toBeCloseTo(pad.lp * (1 + depth));
    expect(sweepAt(pad, 3 / (4 * rate))).toBeCloseTo(pad.lp * (1 - depth));
    for (const a of BY_INDEX) expect(a.pad.sweep[1]).toBeLessThan(1);
  });

  it('muffles the music a little more the deeper it is', () => {
    expect(muffle(0)).toBe(16000);
    expect(muffle(-5)).toBe(16000);
    for (let m = 0; m < 700; m += 50) expect(muffle(m + 50)).toBeLessThan(muffle(m));
    expect(muffle(650)).toBeGreaterThan(5000);
  });

  it('makes a volume a gain: silent at 0, as made at the default, louder above', () => {
    expect(volumeGain(0, 0.7)).toBe(0);
    expect(volumeGain(0.7, 0.7)).toBe(1);
    expect(volumeGain(1, 0.7)).toBeGreaterThan(1);
    expect(volumeGain(2, 0.7)).toBe(volumeGain(1, 0.7));
    expect(volumeGain(0.35, 0.7)).toBeLessThan(0.5);
  });
});

describe('the chance of the music', () => {
  it('goes from chord to chord, never twice the same in a row, through all of them', () => {
    const r = rng(3);
    let k = -1;
    const seen = new Set<number>();
    for (let q = 0; q < 200; q++) {
      const n = nextChord(5, k, r);
      expect(n).not.toBe(k);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
      seen.add((k = n));
    }
    expect(seen.size).toBe(5);
    expect(nextChord(1, 0, r)).toBe(0);
    expect(nextChord(2, 0, r)).toBe(1);
  });

  it('plays the same for the same seed', () => {
    const a = AMBIENCES.nurserie;
    expect(phrase(a.motif, a.pad.chords[0], rng(9))).toEqual(phrase(a.motif, a.pad.chords[0], rng(9)));
    expect(lengthIn(rng(9), [2, 4])).toBe(lengthIn(rng(9), [2, 4]));
  });

  it('keeps the phrases in their range and on the pentatonic, their notes apart', () => {
    for (const a of BY_INDEX) {
      const r = rng(a.chapter.length * 31);
      for (let q = 0; q < 40; q++) {
        const chord = a.pad.chords[q % a.pad.chords.length], p = phrase(a.motif, chord, r);
        expect(p.length).toBeGreaterThanOrEqual(Array.isArray(a.motif.from) ? 1 : a.motif.notes[0]);
        expect(p.length).toBeLessThanOrEqual(a.motif.notes[1]);
        for (const n of p) {
          expect(inPenta(n.midi), `${a.chapter} ${n.midi}`).toBe(true);
          if (!Array.isArray(a.motif.from)) {
            expect(n.midi).toBeGreaterThanOrEqual(a.motif.lo);
            expect(n.midi).toBeLessThanOrEqual(a.motif.hi);
          }
        }
        for (let k = 1; k < p.length; k++) expect(p[k].at - p[k - 1].at).toBeGreaterThanOrEqual(a.motif.step - 1e-9);
        if (a.motif.from === 'chord') for (const n of p) expect(chord.map((m) => m % 12)).toContain(n.midi % 12);
        if (Array.isArray(a.motif.from)) {
          const seq = a.motif.from, k0 = seq.indexOf(p[0].midi);
          expect(p.map((n) => n.midi)).toEqual(seq.slice(k0, k0 + p.length));
        }
      }
    }
  });

  it('finds the notes of a scale and of a chord in a range', () => {
    expect(pentaIn(62, 74)).toEqual([62, 64, 66, 69, 71, 74]);
    expect(chordIn([55, 59, 62, 66], 60, 75)).toEqual([62, 66, 71, 74]);
  });

  it('lets the harmonics come and go, never all quiet', () => {
    const r = rng(5);
    for (let q = 0; q < 100; q++) {
      const lv = harmLevels(4, r);
      expect(lv).toHaveLength(4);
      for (const v of lv) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      expect(Math.max(...lv)).toBeGreaterThanOrEqual(0.25);
    }
    expect(harmLevels(0, r)).toEqual([]);
  });
});

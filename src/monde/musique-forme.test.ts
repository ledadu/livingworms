import { describe, expect, it } from 'vitest';
import { rng } from '../engine';
import { BIOMES } from './biomes';
import { AMBIENCES, BY_INDEX, inKey, inPenta, phrase, type Played } from './musique';
import { FORMS, KINDS, RANKS, nextKind, nextSection, palette, pathChord, shifted, vary, voice, type SectionKind, type Voicing } from './musique-forme';

const VOICINGS: Voicing[] = ['tel', 'mince', 'haut', 'ouvert', 'plein'];
const pcs = (xs: number[]) => new Set(xs.map((m) => ((m % 12) + 12) % 12));

describe('the sections of an ambience', () => {
  it('has a form for every chapter, whose notes stay where its character is', () => {
    for (const b of BIOMES) {
      const f = FORMS[b.id];
      expect(f, b.id).toBeDefined();
      expect(f.octaves).toContain(0);
      expect(f.swing).toBeGreaterThan(0);
      expect(f.swing).toBeLessThanOrEqual(1);
      expect(f.chords[0]).toBeGreaterThanOrEqual(2);
    }
    // the ice stays still and high, the Fosse almost does not change
    expect(FORMS.glacier.octaves).toEqual([0]);
    expect(FORMS.fosse.swing).toBe(Math.min(...BIOMES.map((b) => FORMS[b.id].swing)));
  });

  it('goes from section to section, mostly a step quieter or fuller, never twice the same, through all of them', () => {
    const r = rng(4);
    let k: SectionKind | null = null, steps = 0;
    const seen = new Map<SectionKind, number>();
    for (let q = 0; q < 2000; q++) {
      const n = nextKind(k, r);
      if (k === null) expect(['calme', 'chant']).toContain(n);
      else {
        expect(n).not.toBe(k);
        if (Math.abs(RANKS.indexOf(n) - RANKS.indexOf(k)) === 1) steps++;
      }
      seen.set(n, (seen.get(n) ?? 0) + 1);
      k = n;
    }
    expect(steps / 2000).toBeGreaterThan(0.7);
    for (const kind of RANKS) expect(seen.get(kind)!, kind).toBeGreaterThan(250);
  });

  it('has calmer and fuller moments that stay near the ambience as made, on the whole', () => {
    expect(KINDS.nu.pad).toBeLessThan(KINDS.calme.pad);
    expect(KINDS.calme.pad).toBeLessThan(KINDS.plein.pad);
    expect(KINDS.nu.notes).toBeLessThan(KINDS.chant.notes);
    expect(KINDS.plein.bright).toBeGreaterThan(KINDS.nu.bright);
    for (const b of BIOMES) {
      const r = rng(b.id.length);
      let prev: SectionKind | null = null, pad = 0, notes = 0, n = 0;
      for (let q = 0; q < 600; q++) {
        const s = nextSection(b.id, prev, r);
        prev = s.kind;
        // weighed by how long it lasts
        pad += s.pad * s.chords; notes += s.notes * s.chords; n += s.chords;
        expect(FORMS[b.id].octaves).toContain(s.octave);
        expect(s.chords).toBeGreaterThanOrEqual(FORMS[b.id].chords[0]);
        expect(s.chords).toBeLessThanOrEqual(FORMS[b.id].chords[1]);
      }
      // the levels of the doc hold: the chords about as loud, the notes about as often
      expect(pad / n, b.id).toBeGreaterThan(0.88);
      expect(pad / n, b.id).toBeLessThan(1.05);
      expect(notes / n, b.id).toBeGreaterThan(0.8);
      expect(notes / n, b.id).toBeLessThan(1.25);
    }
  });

  it('departs less from the ambience in a chapter that changes little', () => {
    const spread = (id: 'fosse' | 'recif') => {
      const s = RANKS.map((k) => nextSection(id, k === 'nu' ? 'calme' : 'nu', () => 0.3));
      return Math.max(...s.map((x) => x.pad)) - Math.min(...s.map((x) => x.pad));
    };
    expect(spread('fosse')).toBeLessThan(spread('recif'));
  });
});

describe('the chords of a section', () => {
  it('keeps the notes of the chapter, in D major, in its register, none rubbing', () => {
    for (const a of BY_INDEX) {
      const pal = palette(a), lo = Math.min(...a.pad.chords.flat());
      for (const ch of a.pad.chords) for (const v of VOICINGS) {
        const out = voice(ch, v, pal);
        expect(out.length, `${a.chapter} ${v}`).toBeGreaterThanOrEqual(Math.min(3, ch.length));
        for (const m of out) {
          expect(inKey(m)).toBe(true);
          expect(pal).toContain(((m % 12) + 12) % 12);
          expect(m).toBeGreaterThanOrEqual(lo);
          expect(m).toBeLessThanOrEqual(Math.max(86, ...ch));
        }
        for (let k = 1; k < out.length; k++) expect(out[k] - out[k - 1], `${a.chapter} ${v} ${out}`).toBeGreaterThanOrEqual(2);
        if (v === 'tel' || v === 'haut' || v === 'ouvert') expect(pcs(out)).toEqual(pcs(ch));
      }
    }
  });

  it('voices a chord thinner, higher, spread or fuller', () => {
    const ch = [62, 66, 69, 76];
    expect(voice(ch, 'tel')).toEqual(ch);
    expect(voice(ch, 'mince')).toEqual([62, 69, 76]);
    expect(voice(ch, 'haut')).toEqual([66, 69, 74, 76]);
    expect(voice(ch, 'ouvert')).toEqual([62, 69, 76, 78]);
    const full = voice(ch, 'plein', palette(AMBIENCES.nurserie));
    expect(full.length).toBeGreaterThan(ch.length);
    expect(full).toContain(86);
    // the Glacier's voicings keep its own notes, the Fosse's too
    for (const id of ['glacier', 'fosse'] as const) for (const c of AMBIENCES[id].pad.chords) {
      for (const m of voice(c, 'plein', palette(AMBIENCES[id]))) expect(palette(AMBIENCES[id])).toContain(m % 12);
    }
  });

  it('follows its chords along, rocks between two, or goes anywhere, never twice the same', () => {
    const r = rng(8);
    for (const path of ['suite', 'balance', 'libre'] as const) for (const n of [2, 3, 4, 6]) {
      let prev = -1, before = -1;
      const seen = new Set<number>();
      for (let q = 0; q < 60; q++) {
        const k = pathChord(path, n, prev, before, r);
        expect(k).not.toBe(prev);
        expect(k).toBeGreaterThanOrEqual(0);
        expect(k).toBeLessThan(n);
        if (path === 'balance' && q >= 2) expect(k).toBe(before);
        seen.add(k);
        before = prev; prev = k;
      }
      expect(seen.size).toBe(path === 'balance' ? 2 : n);
    }
    expect(pathChord('libre', 1, 0, -1, r)).toBe(0);
  });
});

describe('the phrases of a section', () => {
  const play = (a: (typeof BY_INDEX)[number], octave: number, seed: number, n: number) => {
    const m = shifted(a.motif, octave), r = rng(seed);
    let last: Played[] = [];
    const out: Played[][] = [];
    for (let q = 0; q < n; q++) out.push((last = vary(last, m, a.pad.chords[q % a.pad.chords.length], r)));
    return { m, out };
  };

  it('begins with a phrase of the motif', () => {
    const a = AMBIENCES.nurserie;
    expect(vary([], a.motif, a.pad.chords[0], rng(9))).toEqual(phrase(a.motif, a.pad.chords[0], rng(9)));
  });

  it('never plays the same phrase twice in a row, in its range, on the pentatonic, its notes apart', () => {
    for (const a of BY_INDEX) for (const octave of FORMS[a.chapter].octaves) {
      const { m, out } = play(a, octave, a.chapter.length * 13 + octave, 120);
      const seq = Array.isArray(m.from) ? m.from : null;
      out.forEach((p, q) => {
        expect(p.length).toBeGreaterThanOrEqual(1);
        expect(p.length).toBeLessThanOrEqual(m.notes[1]);
        for (const n of p) {
          expect(inPenta(n.midi), `${a.chapter} ${n.midi}`).toBe(true);
          if (!seq) { expect(n.midi).toBeGreaterThanOrEqual(m.lo); expect(n.midi).toBeLessThanOrEqual(m.hi); }
        }
        for (let k = 1; k < p.length; k++) expect(p[k].at - p[k - 1].at).toBeGreaterThanOrEqual(m.step - 1e-9);
        // a sequence of its own (the song) stays a piece of itself, in its direction
        if (seq) { const k0 = seq.indexOf(p[0].midi); expect(p.map((n) => n.midi)).toEqual(seq.slice(k0, k0 + p.length)); }
        if (q) expect(p, `${a.chapter} ${q}`).not.toEqual(out[q - 1]);
      });
      // and many different ones come (a single note: each of its few)
      expect(new Set(out.map((p) => JSON.stringify(p))).size, a.chapter).toBeGreaterThan(m.notes[1] === 1 ? 2 : seq ? 6 : 20);
    }
  });

  it('comes back as the same idea: mostly near the phrase before', () => {
    const a = AMBIENCES.recif, { out } = play(a, 0, 3, 200);
    let near = 0;
    for (let q = 1; q < out.length; q++) {
      const d = Math.abs(out[q][0].midi - out[q - 1][0].midi);
      if (d <= 7 && Math.abs(out[q].length - out[q - 1].length) <= 1) near++;
    }
    expect(near / (out.length - 1)).toBeGreaterThan(0.7);
  });

  it('moves the notes by octaves with the section', () => {
    const m = shifted(AMBIENCES.carcasse.motif, 1);
    expect(m.lo).toBe(AMBIENCES.carcasse.motif.lo + 12);
    expect(m.from).toEqual((AMBIENCES.carcasse.motif.from as number[]).map((x) => x + 12));
    expect(shifted(AMBIENCES.carcasse.motif, 0)).toBe(AMBIENCES.carcasse.motif);
  });
});

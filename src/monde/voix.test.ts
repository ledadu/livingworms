import { describe, expect, it } from 'vitest';
import { STRAIN_HOLD, Strain, harmonicsOf, loudness, toSteal, type Ringing } from './voix';

const note = (t0: number, peak = 0.3, attack = 0.01, fade = 0.5, len = 4): Ringing => ({ t0, end: t0 + len, peak, attack, fade });

describe('the notes that ring at once', () => {
  it('a note rises to its peak, then fades, and is silent once it has rung out', () => {
    const n = note(1, 0.3, 0.2, 0.5);
    expect(loudness(n, 1.1)).toBeCloseTo(0.15, 6);
    expect(loudness(n, 1.2)).toBeCloseTo(0.3, 6);
    expect(loudness(n, 1.7)).toBeLessThan(loudness(n, 1.4));
    expect(loudness(n, 5)).toBe(0);
  });

  it('under the cap, none is let go; those rung out do not count', () => {
    const live = [note(0), note(1), note(2)];
    expect(toSteal(live, 2.5, 4)).toEqual([]);
    expect(toSteal([note(-10), note(-9), ...live], 2.5, 4)).toEqual([]);
  });

  it('over the cap, the faintest now are let go, as many as needed for one more', () => {
    const live = Array.from({ length: 6 }, (_, i) => note(i * 0.3));
    const out = toSteal(live, 1.8, 4);
    expect(out).toHaveLength(3);
    expect(out).toEqual(live.slice(0, 3));
  });

  it('a quiet answer far away goes before a loud note of ours that is older', () => {
    const ours = note(0, 0.3), answer = note(0.5, 0.02), fresh = note(1, 0.3);
    expect(toSteal([ours, answer, fresh], 1.2, 3)).toEqual([answer]);
  });

  it('a note still rising is kept', () => {
    const swell = note(1, 0.3, 1.5), old = note(0, 0.3);
    expect(toSteal([swell, old], 1.1, 2)).toEqual([old]);
  });
});

describe('a device that struggles', () => {
  it('is light from its first underrun, for a while after the last', () => {
    const s = new Strain();
    s.feel(3, 0);
    expect(s.on(0)).toBe(false);
    s.feel(3, 10);
    expect(s.on(10)).toBe(false);
    s.feel(4, 20);
    expect(s.on(20)).toBe(true);
    expect(s.on(20 + STRAIN_HOLD - 1)).toBe(true);
    expect(s.on(20 + STRAIN_HOLD + 1)).toBe(false);
  });
});

describe('partials rung by one oscillator', () => {
  it('whole multiples of the lowest: one wave, each harmonic as loud as its partial', () => {
    expect(harmonicsOf([[1, 1], [2, 0.22], [3, 0.08]])).toEqual({ base: 1, amps: [0, 1, 0.22, 0.08] });
    expect(harmonicsOf([[1, 1], [3, 0.1]])).toEqual({ base: 1, amps: [0, 1, 0, 0.1] });
    expect(harmonicsOf([[1, 0.55], [0.5, 0.3], [1.5, 0.06]])).toEqual({ base: 0.5, amps: [0, 0.3, 0.55, 0.06] });
  });

  it('a bell or glass (partials between the harmonics), or nothing: none', () => {
    expect(harmonicsOf([[1, 1], [2.76, 0.32]])).toBeNull();
    expect(harmonicsOf([[1, 1], [1.004, 0.8]])).toBeNull();
    expect(harmonicsOf([])).toBeNull();
  });
});

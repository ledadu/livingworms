import { describe, expect, it } from 'vitest';
import { VOLUMES, impulse, parseVolumes } from './son';

describe('the volumes of the settings', () => {
  it('reads what was kept, each in 0..1, the defaults for the rest', () => {
    expect(parseVolumes(null)).toEqual(VOLUMES);
    expect(parseVolumes('not json')).toEqual(VOLUMES);
    expect(parseVolumes('[]')).toEqual(VOLUMES);
    expect(parseVolumes('{"musique":0.2}')).toEqual({ ...VOLUMES, musique: 0.2 });
    expect(parseVolumes('{"musique":0,"chant":1}')).toEqual({ ...VOLUMES, musique: 0, chant: 1 });
    expect(parseVolumes('{"musique":3,"chant":-1,"bruits":0}')).toEqual({ musique: 1, chant: 0, bruits: 0 });
    expect(parseVolumes('{"musique":"fort","chant":null,"autre":0.5}')).toEqual(VOLUMES);
  });
});

describe('the reverb made in the code', () => {
  const rate = 8000, d = impulse(rate, 3);
  const energy = (a: number, b: number) => {
    let s = 0;
    for (let i = Math.floor(a * d.length); i < Math.floor(b * d.length); i++) s += d[i] * d[i];
    return s;
  };

  it('is as long as asked, every sample a number', () => {
    expect(d.length).toBe(rate * 3);
    for (const v of d) expect(Number.isFinite(v)).toBe(true);
  });

  it('starts after a breath and fades away', () => {
    expect(d[0]).toBe(0);
    expect(d[Math.floor(rate * 0.011)]).toBe(0);
    expect(energy(0.9, 1)).toBeLessThan(energy(0, 0.1) * 0.001);
    expect(energy(0.4, 0.5)).toBeLessThan(energy(0.1, 0.2));
  });

  it('is the same for the same seed, another for another', () => {
    expect(impulse(rate, 0.5, 3)).toEqual(impulse(rate, 0.5, 3));
    expect(impulse(rate, 0.5, 3)).not.toEqual(impulse(rate, 0.5, 4));
  });
});

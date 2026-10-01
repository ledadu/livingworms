import { describe, expect, it } from 'vitest';
import { rng } from '../engine';
import { LOAD_ORDER, RECS, SOUND_CREDITS, creditWords, cueGain, cues, dataBytes, loopable, parseCredits } from './enregistrements';

import CREDITS from './sons/credits.json';

const credits = () => parseCredits(CREDITS);
/** the audio files of src/monde/sons/, as the page inlines them (data: URLs) */
const INLINED = import.meta.glob('./sons/*.{mp3,ogg,opus,m4a,aac,wav,webm,flac}', { eager: true, query: '?inline', import: 'default' }) as Record<string, string>;

describe('a recording made into a loop', () => {
  const rate = 1000, r = rng(3);
  // a decoder's silence at both ends, noise between
  const d = new Float32Array(5000);
  for (let i = 40; i < 4970; i++) d[i] = r() * 2 - 1;

  it('loses the silence at its ends and its faded tail', () => {
    const l = loopable(d, rate, 0.5);
    expect(l.length).toBe(4930 - 500);
    expect(Math.abs(l[l.length - 1])).toBeGreaterThan(0);
  });

  it('runs on from its end into its start: its first sample is the one that followed its last', () => {
    const l = loopable(d, rate, 0.5), s = d.subarray(40, 4970);
    expect(l[0]).toBeCloseTo(s[l.length], 2);
    expect(l[l.length - 1]).toBe(s[l.length - 1]);
  });

  it('keeps its loudness through the fade (equal power for noise)', () => {
    const l = loopable(d, rate, 0.5), rms = (a: Float32Array) => Math.sqrt(a.reduce((x, v) => x + v * v, 0) / a.length);
    expect(rms(l.subarray(0, 500)) / rms(l.subarray(1000, 4000))).toBeGreaterThan(0.85);
    expect(rms(l.subarray(0, 500)) / rms(l.subarray(1000, 4000))).toBeLessThan(1.15);
  });

  it('never fades more than a third of it', () => {
    expect(loopable(d, rate, 100).length).toBe(4930 - Math.floor(4930 / 3));
  });
});

describe('the noises in a recording of several', () => {
  const rate = 8000, r = rng(5), d = new Float32Array(rate * 6);
  for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * 0.002;
  // three bursts: at 1 s (0.3 s), 2.5 s (0.5 s), 4 s (1.5 s)
  for (const [at, len] of [[1, 0.3], [2.5, 0.5], [4, 1.5]]) for (let i = at * rate; i < (at + len) * rate; i++) d[i] = (r() * 2 - 1) * 0.5;

  it('are found where they are, a little before and after kept', () => {
    const c = cues(d, rate, 14);
    expect(c).toHaveLength(3);
    expect(c.map((q) => +q.at.toFixed(2))).toEqual([0.98, 2.48, 3.98]);
    expect(c[0].len).toBeGreaterThan(0.3);
    expect(c[0].len).toBeLessThan(0.3 + 0.3);
    for (const q of c) expect(q.peak).toBeGreaterThan(0.4);
  });

  it('are no longer than `max`, no shorter than `min`', () => {
    expect(cues(d, rate, 14, 1).map((q) => q.len)).toEqual([expect.any(Number), expect.any(Number), 1]);
    expect(cues(d, rate, 14, 4, 0.6).map((q) => +q.at.toFixed(2))).toEqual([2.48, 3.98]);
  });

  it('a short dip does not cut a noise in two', () => {
    const e = d.slice();
    for (let i = 4.5 * rate; i < 4.55 * rate; i++) e[i] = 0;
    expect(cues(e, rate, 14)).toHaveLength(3);
  });

  it('none in silence, none in nothing', () => {
    expect(cues(new Float32Array(rate), rate, 14)).toEqual([]);
    expect(cues(new Float32Array(0), rate, 14)).toEqual([]);
  });

  it('a quiet one is brought up, but less than the loud ones', () => {
    expect(cueGain({ at: 0, len: 1, peak: 0.5 })).toBeCloseTo(1);
    expect(cueGain({ at: 0, len: 1, peak: 0.125 })).toBeCloseTo(2);
    expect(cueGain({ at: 0, len: 1, peak: 0 })).toBe(4);
  });
});

describe('a file inlined in the page', () => {
  it('is read back byte for byte', () => {
    const bytes = [0, 1, 2, 250, 255, 128];
    const url = 'data:audio/mpeg;base64,' + btoa(String.fromCharCode(...bytes));
    expect(Array.from(new Uint8Array(dataBytes(url)!))).toEqual(bytes);
  });
  it('a file served beside the page is not', () => expect(dataBytes('/src/monde/sons/eau.mp3')).toBeNull());
});

describe('the recordings of the game and their credits', () => {
  const files = Object.keys(INLINED).map((p) => p.replace(/^.*\//, ''));

  it('every audio file has its line in the credits the game shows, and every line its file', () => {
    expect(SOUND_CREDITS).toEqual(credits());
    const lines = SOUND_CREDITS.map((c) => c.file);
    expect(new Set(lines).size).toBe(lines.length);
    expect([...lines].sort()).toEqual([...files].sort());
  });

  it('each line names a title, an author, a free licence and its source', () => {
    for (const c of credits()) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.author.length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https:\/\//);
    }
  });

  it('a line with something missing or another licence is refused', () => {
    const one = { file: 'x.mp3', title: 't', author: 'a', license: 'CC0 1.0', licenseUrl: 'https://l', url: 'https://u', excerpt: 'e', use: 'u' };
    expect(parseCredits({ sounds: [one] })).toHaveLength(1);
    expect(() => parseCredits({ sounds: [{ ...one, author: '' }] })).toThrow(/author/);
    expect(() => parseCredits({ sounds: [{ ...one, license: 'CC BY-NC 4.0' }] })).toThrow(/licence/);
    expect(() => parseCredits({ sounds: [{ ...one, url: 'freesound.org' }] })).toThrow(/link/);
    expect(() => parseCredits({})).toThrow();
  });

  it('every recording the game plays has its file, loaded once', () => {
    for (const name of Object.keys(RECS)) expect(files).toContain(`${name}.mp3`);
    expect([...LOAD_ORDER].sort()).toEqual(Object.keys(RECS).sort());
  });

  it('they stay within the budget of the page (400 KB once inlined)', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const url of Object.values(INLINED)) expect(url).toMatch(/^data:audio\/[a-z0-9]+;base64,/);
    expect(Object.values(INLINED).reduce((s, url) => s + url.length, 0)).toBeLessThanOrEqual(400 * 1024);
  });
});

describe('a line of the credits, as the players read it', () => {
  const one = { file: 'x.mp3', title: 'Diving with whales.wav', author: 'KEVOY', license: 'CC0 1.0', licenseUrl: 'https://l', url: 'https://u', excerpt: '', use: '' };
  it('its title without the extension of its file', () => {
    expect(creditWords(one).title).toBe('Diving with whales');
    expect(creditWords({ ...one, title: 'Ice - Lake fractures' }).title).toBe('Ice - Lake fractures');
  });
  it('who, and under what licence', () => {
    expect(creditWords(one)).toMatchObject({ by: 'KEVOY', license: 'domaine public (CC0 1.0)' });
    expect(creditWords({ ...one, license: 'CC BY 4.0' }).license).toBe('licence CC BY 4.0');
  });
});

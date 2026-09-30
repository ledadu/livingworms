import { describe, expect, it } from 'vitest';
import { BIOMES, biomeIndex, floorAt, moodAt, X1 } from './biomes';
import { FOSSE, darkStops, glowOf, lightReach, pitchOf, snowLit } from './fosse';

describe('La Fosse', () => {
  it('is the last biome, deeper than the Abysses, and pitch dark', () => {
    expect(BIOMES[BIOMES.length - 1]).toBe(FOSSE);
    expect(biomeIndex(23500)).toBe(BIOMES.length - 1);
    expect(floorAt(24000, 0)).toBeGreaterThan(floorAt(20000, 0) + 300);
    expect(Number.isFinite(floorAt(X1 - 10, 500))).toBe(true);
    expect(pitchOf(moodAt(24000).dark)).toBe(1);
  });

  it('leaves the Abysses as they were and closes in across the border', () => {
    expect(pitchOf(moodAt(20000).dark)).toBe(0);
    const mid = pitchOf(moodAt(FOSSE.x0 + 100).dark);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it('gives a wider light to a swimmer that glows', () => {
    expect(lightReach(0)).toBeGreaterThan(30);
    expect(lightReach(30)).toBeGreaterThan(lightReach(0));
    expect(lightReach(1e6)).toBe(lightReach(1e7));
  });

  it('keeps the dark of the Abysses at pitch 0 and shuts all but the light at pitch 1', () => {
    const open = darkStops(0.86, 0, 1, 100, 800, 600);
    expect(open.r[0]).toBeCloseTo(70);
    expect(open.a[2]).toBeCloseTo(Math.min(0.97, 0.86 * 1.08));
    const shut = darkStops(0.86, 1, 1, 100, 800, 600);
    expect(shut.a[2]).toBe(1);
    expect(shut.r[2]).toBeLessThan(800);
    for (const s of [open, shut]) expect(s.r[0]).toBeLessThan(s.r[1]), expect(s.r[1]).toBeLessThan(s.r[2]);
  });

  it('shows the snow only where the light reaches', () => {
    expect(snowLit(0, 100)).toBe(1);
    expect(snowLit(200, 100)).toBe(0);
  });
});

describe('the light of the swimmer', () => {
  const seg = (glow: string, role = 'body', n = 4, r = 1) => ({ def: { role, color: { glow } }, n, rad: new Array(n + 1).fill(r) });
  it('counts its glows, a lantern more than any other tip', () => {
    expect(glowOf([seg('none')])).toBe(0);
    expect(glowOf([seg('tip', 'light')])).toBeCloseTo(3 * glowOf([seg('tip')]));
    expect(glowOf([seg('body')])).toBeGreaterThan(0);
  });
});

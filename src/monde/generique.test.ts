import { describe, expect, it } from 'vitest';
import { BIOMES } from './biomes';
import { GEN, HEAD, JOIN, MATE, SOUVENIR_MAX_H, SOUVENIR_W, bandColour, downloadsBlocked, rollMs, souvenirFileName, souvenirLayout, type Where } from './generique';

const moon = { id: 'meduse', name: 'Méduse lune' };

describe('the keepsake image', () => {
  it('is the title and the larva alone at the start', () => {
    const l = souvenirLayout([{ partner: null }], 2);
    expect(l.gens).toEqual([HEAD + GEN / 2]);
    expect(l.mates).toEqual([]);
    expect(l.w).toBe(SOUVENIR_W);
    expect(l.scale).toBe(1);
    expect(l.h).toBe(l.full);
  });

  it('puts each partner between the parent and the child, and the thread goes on without one', () => {
    const l = souvenirLayout([{ partner: moon }, { partner: null }, { partner: null }], 3);
    expect(l.mates).toEqual([HEAD + GEN + MATE / 2, null]);
    expect(l.gens).toEqual([HEAD + GEN / 2, HEAD + GEN + MATE + GEN / 2, HEAD + 2 * GEN + MATE + JOIN + GEN / 2]);
    expect(l.foot).toBeGreaterThan(l.gens[2] + GEN / 2);
    expect(l.full).toBeGreaterThan(l.foot);
  });

  it('keeps every portrait inside, going down', () => {
    const gens = Array.from({ length: 10 }, (_, i) => ({ partner: i < 9 ? moon : null }));
    const l = souvenirLayout(gens, 3);
    for (let i = 1; i < l.gens.length; i++) expect(l.gens[i]).toBeGreaterThan(l.gens[i - 1] + GEN / 2);
    expect(l.mates.every((m, i) => m !== null && m > l.gens[i] && m < l.gens[i + 1])).toBe(true);
    expect(l.h).toBeLessThanOrEqual(SOUVENIR_MAX_H);
  });

  it('shrinks a very long lineage to what a phone can keep', () => {
    const l = souvenirLayout(Array.from({ length: 80 }, () => ({ partner: moon })), 3);
    expect(l.scale).toBeLessThan(1);
    expect(l.h).toBeLessThanOrEqual(SOUVENIR_MAX_H);
    expect(l.w * l.h).toBeLessThan(16_777_216);
    expect(l.w).toBe(Math.round(SOUVENIR_W * l.scale));
  });

  it('paints each chapter dark enough for the pale letters', () => {
    for (const b of BIOMES) {
      const c = bandColour(b);
      expect(c.l).toBeLessThanOrEqual(26);
      expect(c.l).toBeGreaterThanOrEqual(6);
    }
    // the Nurserie stays lighter than the Fosse
    expect(bandColour(BIOMES[0]).l).toBeGreaterThan(bandColour(BIOMES.find((b) => b.id === 'fosse')!).l);
  });

  it('is kept under the name of the last generation', () => {
    expect(souvenirFileName('Première')).toBe('la-lignee-premiere.jpg');
    expect(souvenirFileName('  Méduse  lune!  ')).toBe('la-lignee-meduse-lune.jpg');
    expect(souvenirFileName('???')).toBe('la-lignee.jpg');
    expect(souvenirFileName('a'.repeat(60))).toBe(`la-lignee-${'a'.repeat(32)}.jpg`);
  });
});

describe('the credits', () => {
  it('go up slowly, from below the screen until they have left it', () => {
    expect(rollMs(2600, 800)).toBe(Math.round((3400 / 52) * 1000));
  });

  it('never last more than about two minutes, nor less than a few seconds', () => {
    expect(rollMs(40_000, 800)).toBeLessThanOrEqual(130_000);
    expect(rollMs(0, 0)).toBe(8000);
  });
});

describe('keeping the image', () => {
  const page: Where = { hostname: 'localhost', search: '', framed: false, ancestors: [], referrer: '' };

  it('is possible in the page itself, opened from a server or a file', () => {
    expect(downloadsBlocked(page)).toBe(false);
    expect(downloadsBlocked({ ...page, hostname: '' })).toBe(false);
    expect(downloadsBlocked({ ...page, framed: true, ancestors: ['https://itch.io'] })).toBe(false);
  });

  it('is not offered in the Artifact link of claude.ai', () => {
    expect(downloadsBlocked({ ...page, hostname: 'abc123.claudeusercontent.com' })).toBe(true);
    expect(downloadsBlocked({ ...page, framed: true, ancestors: ['https://claude.ai'] })).toBe(true);
    expect(downloadsBlocked({ ...page, framed: true, referrer: 'https://claude.site/artifacts/xyz' })).toBe(true);
    expect(downloadsBlocked({ ...page, framed: true, hostname: 'null', referrer: 'not a url' })).toBe(false);
  });

  it('is not offered with ?artifact either, for the tests', () => {
    expect(downloadsBlocked({ ...page, search: '?dev&artifact' })).toBe(true);
  });
});

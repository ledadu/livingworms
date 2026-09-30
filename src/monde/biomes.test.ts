import { describe, expect, it } from 'vitest';
import { SPECIES } from '../content';
import { BIOMES, X0, X1, arrival, biomeIndex, chapterIndex, floorAt, liftAt, metres, span, type ChapterId } from './biomes';

/** the partners of each chapter, from docs/chapitres.md */
const PARTNERS: Record<ChapterId, string[]> = {
  nurserie: ['copepode', 'larve'],
  recif: ['poissonClown', 'poissonLion', 'hippocampe'],
  foret: ['dragonFeuillu', 'seiche', 'homard'],
  grotte: ['anguille', 'serpentCilie', 'ctenophore'],
  carcasse: ['plumeau', 'crabe'],
  sources: ['verDeFeu', 'crevetteMante', 'homard'],
  glacier: ['clione', 'krill', 'chrysaora'],
  jardin: ['meduse', 'ctenophore', 'siphonophore'],
  fosse: ['baudroie', 'dragonAbyssal', 'nautile'],
  remontee: []
};

const PLANTS = new Set(['posidonie', 'kelp', 'coral', 'fan', 'softcoral', 'anemone', 'tubes', 'eponge', 'seapen', 'crinoide']);

describe('the map of the world', () => {
  it('lays the ten chapters out in the order of the story', () => {
    expect(BIOMES.map((b) => b.id)).toEqual(['nurserie', 'recif', 'foret', 'grotte', 'carcasse', 'sources', 'glacier', 'jardin', 'fosse', 'remontee']);
    expect(BIOMES.map((b) => b.name)).toEqual(['La Nurserie', 'Le Récif', 'La Forêt', 'La Grotte', 'La Carcasse', 'Les Sources', 'Le Glacier',
      'Le Jardin de méduses', 'La Fosse', 'La Remontée']);
    expect(BIOMES[0].x0).toBe(X0);
    for (let i = 1; i < BIOMES.length; i++) expect(BIOMES[i].x0 - BIOMES[i - 1].x0).toBeGreaterThanOrEqual(1500);
    expect(X1 - BIOMES[BIOMES.length - 1].x0).toBeGreaterThanOrEqual(1500);
  });

  it('finds a chapter by its id and by x', () => {
    for (const [i, b] of BIOMES.entries()) {
      expect(chapterIndex(b.id)).toBe(i);
      const [a, e] = span(b.id);
      expect(biomeIndex((a + e) / 2)).toBe(i);
      expect(biomeIndex(arrival(i).x)).toBe(i);
    }
  });

  it('goes down chapter after chapter, and the depth gauge reads each chapter where its life is', () => {
    let prev = 0;
    for (const b of BIOMES) {
      const [a, e] = span(b.id), [m0, m1] = b.depth;
      expect(m0).toBeGreaterThanOrEqual(prev);
      prev = m0;
      // at the heart of the chapter, in the swimming plane: its floor, or the open water above a floor out of sight
      const mid = Math.max(a, X0 + 400) + (e - Math.max(a, X0 + 400)) / 2;
      const m = metres(floorAt(mid, 0) - liftAt(mid));
      expect(m, b.id).toBeGreaterThanOrEqual(m0 - 25);
      expect(m, b.id).toBeLessThanOrEqual(m1 + 25);
    }
  });

  it('has a floor without steps', () => {
    let last = floorAt(X0, 0);
    for (let x = X0; x <= X1; x += 10) {
      const y = floorAt(x, 0);
      expect(Math.abs(y - last)).toBeLessThan(30);
      last = y;
    }
  });

  it('keeps the arrival of every chapter in the water, above its floor', () => {
    for (const [i] of BIOMES.entries()) {
      const { x, y } = arrival(i);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(floorAt(x, 0) - 100);
    }
    // in the Jardin the floor is out of sight: the life stays up in the open water
    const [a, e] = span('jardin');
    expect(liftAt((a + e) / 2)).toBeGreaterThan(500);
    expect(liftAt(span('recif')[0] + 1000)).toBe(0);
  });

  it('fades the floor from sand to rock without passing through an unrelated hue', () => {
    // drawRow mixes the two hue by hue: ivory to night blue would go through green
    for (const b of BIOMES) {
      const d = Math.abs(b.sand.h - b.rock.h);
      expect(Math.min(d, 360 - d), b.id).toBeLessThanOrEqual(60);
    }
  });

  it('puts the partners of each chapter in its fauna, first', () => {
    for (const b of BIOMES) {
      const ids = b.fauna.map((f) => f[0]);
      for (const p of PARTNERS[b.id]) expect(ids.indexOf(p), `${p} in ${b.id}`).toBeGreaterThanOrEqual(0);
      expect(b.pop, b.id).toBeGreaterThanOrEqual(b.fauna.length);
    }
  });

  it('only names species and plants that exist', () => {
    for (const b of BIOMES) {
      for (const [id] of b.fauna) expect(SPECIES[id], `${id} in ${b.id}`).toBeTypeOf('function');
      for (const [id] of b.visitors) expect(SPECIES[id], `${id} in ${b.id}`).toBeTypeOf('function');
      for (const [k] of [...b.flora.kinds, ...b.flora.front]) expect(PLANTS.has(k), `${k} in ${b.id}`).toBe(true);
    }
  });

  it('gives every species of the catalogue a home', () => {
    const seen = new Set(BIOMES.flatMap((b) => [...b.fauna.map((f) => f[0]), ...b.visitors.map((v) => v[0])]));
    // the anemone grows as a plant
    const missing = Object.keys(SPECIES).filter((id) => id !== 'anemone' && !seen.has(id));
    expect(missing).toEqual([]);
  });
});

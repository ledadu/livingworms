import { describe, expect, it } from 'vitest';
import { firstAncestor } from '../content';
import { homesOf, placeOf, type Chapter, type Sea } from './ancetres';
import { CHAPTERS, SEA, ancestorsIn } from './ancetres-jeu';
import { BIOMES, biomeIndex } from './biomes';
import { birth, newPartie, parsePartie, reachChapter, type Ancestor } from './partie';

const MAP: Chapter[] = [
  { id: 'nurserie', x0: -800, span: [-600, 3400], meet: [-450, 2900] },
  { id: 'recif', x0: 3400, span: [3400, 7000], meet: [3550, 6500] }
];
const FLAT: Sea = { water: () => [40, 900], mid: () => 400 };
const larva = { name: 'Larve' }, fish = { name: 'Poisson' };
const left = (chapter: string, x: number, y: number, x0: number): Ancestor => ({ creature: larva, chapter, at: placeOf(x, y, x0) });

describe('les ancêtres restent dans le monde', () => {
  it('finds each parent where it was left', () => {
    const lineage = [left('nurserie', 1200, 300, -800), left('recif', 5000, 620, 3400)];
    expect(homesOf(lineage, MAP, FLAT)).toEqual([{ x: 1200, y: 300 }, { x: 5000, y: 620 }]);
  });

  it('keeps the place in its chapter when the map moves', () => {
    const moved = MAP.map((c) => c.id === 'recif' ? { ...c, x0: 3900, span: [3900, 7500] as [number, number] } : c);
    expect(homesOf([left('recif', 5000, 620, 3400)], moved, FLAT)[0]).toEqual({ x: 5500, y: 620 });
  });

  it('keeps it where the swimmer can go, in the open water', () => {
    const lineage = [left('nurserie', -790, -30, -800), left('recif', 9000, 2000, 3400)];
    expect(homesOf(lineage, MAP, FLAT)).toEqual([{ x: -600, y: 40 }, { x: 7000, y: 900 }]);
  });

  it('sets the ancestors saved without a place along their chapter, each somewhere else, at mid water', () => {
    const lineage: Ancestor[] = [{ creature: larva, chapter: 'recif' }, { creature: fish, chapter: 'recif' }, { creature: fish, chapter: 'recif', at: { x: 'a', y: null } as never }];
    const homes = homesOf(lineage, MAP, FLAT);
    for (const h of homes) {
      expect(h!.x).toBeGreaterThanOrEqual(3550);
      expect(h!.x).toBeLessThanOrEqual(6500);
      expect(h!.y).toBe(400);
    }
    expect(new Set(homes.map((h) => h!.x)).size).toBe(3);
  });

  it('leaves out an ancestor whose chapter is no longer on the map', () => {
    expect(homesOf([{ creature: larva, chapter: 'atlantide', at: { x: 10, y: 10 } }], MAP, FLAT)).toEqual([null]);
  });

  it('does not bring the saved game back when we swim back to them', () => {
    const order = ['nurserie', 'recif', 'foret'], p = newPartie('recif');
    expect(reachChapter(p, 'nurserie', order)).toBe(false);
    expect(p.chapter).toBe('recif');
    expect(reachChapter(p, 'foret', order)).toBe(true);
    expect(p.chapter).toBe('foret');
  });

  it('saves the place at the birth, and reads it back', () => {
    const p = birth({ ...newPartie('recif'), creature: larva }, fish, 'recif', { x: 1600, y: 620 });
    expect(p.lineage).toEqual([{ creature: larva, chapter: 'recif', at: { x: 1600, y: 620 } }]);
    expect(parsePartie(JSON.stringify(p), ['nurserie', 'recif'])?.lineage).toEqual(p.lineage);
    // a birth without a place, as before
    expect(birth({ ...newPartie('recif'), creature: larva }, fish, 'recif').lineage).toEqual([{ creature: larva, chapter: 'recif' }]);
  });
});

describe('les ancêtres sur la carte du jeu', () => {
  const larva = JSON.parse(JSON.stringify(firstAncestor())) as Record<string, unknown>;

  it('brings back, in every chapter, a parent left where partners are met', () => {
    for (const c of CHAPTERS.filter((q) => q.id !== 'remontee')) {
      const x = (c.meet[0] + c.meet[1]) / 2, [top, bottom] = SEA.water(x), y = Math.round((top + bottom) / 2);
      const b = BIOMES[biomeIndex(x)];
      expect(b.id).toBe(c.id);
      const [a] = ancestorsIn([{ creature: larva, chapter: b.id, at: placeOf(x, y, b.x0) }]);
      expect(a.home).toEqual({ x: Math.round(x), y });
      expect(a.k).toBe(0);
    }
  });

  it('sets an ancestor of an older save in the open water of its chapter', () => {
    for (const c of CHAPTERS.filter((q) => q.id !== 'remontee')) {
      const [a] = ancestorsIn([{ creature: larva, chapter: c.id }]), [top, bottom] = SEA.water(a.home.x);
      expect(BIOMES[biomeIndex(a.home.x)].id).toBe(c.id);
      expect(a.home.y).toBeGreaterThanOrEqual(top);
      expect(a.home.y).toBeLessThanOrEqual(bottom);
    }
  });

  it('skips a creature that no longer reads, and keeps the rank of the others', () => {
    const got = ancestorsIn([{ creature: { body: { attach: 5 } }, chapter: 'recif' }, { creature: larva, chapter: 'atlantide' }, { creature: larva, chapter: 'recif' }]);
    expect(got.map((a) => a.k)).toEqual([2]);
  });
});

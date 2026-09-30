import { describe, expect, it } from 'vitest';
import { LEGACY_PLAYER_KEY, PARTIE_KEY, type Partie, birth, clearPartie, loadPartie, newPartie, parsePartie, reachChapter, replaceCreature, savePartie } from './partie';

const CHAPTERS = ['nurserie', 'recif', 'foret'];
const larva = { name: 'Larve' }, fish = { name: 'Poisson' }, crab = { name: 'Crabe' };

function fakeStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key)
  };
}

describe('the saved game', () => {
  it('starts at the first chapter, with no creature and no lineage', () => {
    expect(loadPartie(fakeStore(), CHAPTERS)).toEqual(newPartie('nurserie'));
    expect(loadPartie(null, CHAPTERS).chapter).toBe('nurserie');
  });

  it('comes back as it was saved', () => {
    const store = fakeStore();
    const p = { ...newPartie('nurserie'), creature: fish };
    reachChapter(p, 'foret');
    savePartie(store, p, 1234);
    expect(loadPartie(store, CHAPTERS)).toEqual({ v: 1, chapter: 'foret', creature: fish, lineage: [], savedAt: 1234 });
  });

  it('keeps the creature of an older version, at the first chapter', () => {
    const store = fakeStore({ [LEGACY_PLAYER_KEY]: JSON.stringify(crab) });
    expect(loadPartie(store, CHAPTERS)).toMatchObject({ chapter: 'nurserie', creature: crab });
  });

  it('prefers the saved game to the creature kept alone', () => {
    const store = fakeStore({ [LEGACY_PLAYER_KEY]: JSON.stringify(crab), [PARTIE_KEY]: JSON.stringify({ v: 1, chapter: 'recif', creature: fish }) });
    expect(loadPartie(store, CHAPTERS)).toMatchObject({ chapter: 'recif', creature: fish });
  });

  it('falls back on the first chapter when the saved one no longer exists', () => {
    expect(parsePartie(JSON.stringify({ v: 1, chapter: 'atlantide', creature: fish }), CHAPTERS)?.chapter).toBe('nurserie');
  });

  it('ignores what it cannot read', () => {
    for (const bad of ['{', 'null', '[]', '{"v":2,"chapter":"recif"}', '"recif"']) expect(parsePartie(bad, CHAPTERS)).toBeNull();
    expect(loadPartie(fakeStore({ [PARTIE_KEY]: '{', [LEGACY_PLAYER_KEY]: '{' }), CHAPTERS)).toEqual(newPartie('nurserie'));
    const p = parsePartie(JSON.stringify({ v: 1, chapter: 'recif', creature: 3, lineage: [{ creature: fish, chapter: 'recif' }, 7, { chapter: 'foret' }] }), CHAPTERS);
    expect(p).toEqual({ v: 1, chapter: 'recif', creature: null, lineage: [{ creature: fish, chapter: 'recif' }], savedAt: 0 });
  });

  it('goes on unsaved when the storage refuses', () => {
    const store = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadPartie(store, CHAPTERS)).toEqual(newPartie('nurserie'));
    expect(() => savePartie(store, newPartie('nurserie'))).not.toThrow();
    expect(() => clearPartie(store)).not.toThrow();
  });

  it('forgets everything when a new game begins', () => {
    const store = fakeStore({ [LEGACY_PLAYER_KEY]: '{}', [PARTIE_KEY]: '{}', 'lignee.monde': '{}' });
    clearPartie(store);
    expect([...store.map.keys()]).toEqual(['lignee.monde']);
  });
});

describe('births and chapters', () => {
  it('puts the parent into the lineage where it gave birth, and plays the child', () => {
    let p: Partie = { ...newPartie('nurserie'), creature: larva };
    p = birth(p, fish, 'recif');
    p = birth(p, crab, 'foret');
    expect(p.creature).toEqual(crab);
    expect(p.chapter).toBe('foret');
    expect(p.lineage).toEqual([{ creature: larva, chapter: 'recif' }, { creature: fish, chapter: 'foret' }]);
  });

  it('does not count a creature changed in the Atelier as a birth', () => {
    const p = replaceCreature(birth({ ...newPartie('nurserie'), creature: larva }, fish, 'recif'), crab);
    expect(p.creature).toEqual(crab);
    expect(p.lineage).toHaveLength(1);
  });

  it('says when a new chapter is reached', () => {
    const p = newPartie('nurserie');
    expect(reachChapter(p, 'nurserie')).toBe(false);
    expect(reachChapter(p, 'recif')).toBe(true);
    expect(p.chapter).toBe('recif');
  });
});

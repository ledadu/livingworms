import { describe, expect, it } from 'vitest';
import { FIRST, finishedBefore, openBalade, playIn, playedOf, resumeOf, wander } from './balade';
import { PARTIE_KEY, birth, loadPartie, newPartie, savePartie, type Partie } from './partie';

const CHAPTERS = ['nurserie', 'recif', 'remontee'];
const larva = { name: 'Larve' }, fish = { name: 'Poisson' }, last = { name: 'Aube' }, odd = { name: 'Chimère' };

/** a story told to its end: two generations, the last one played */
function ended(): Partie {
  let p: Partie = { ...newPartie('nurserie'), creature: larva };
  p = birth(p, fish, 'nurserie');
  p = birth(p, last, 'recif');
  return { ...p, chapter: 'remontee' };
}

function fakeStore() {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
}

describe('the Balade libre', () => {
  it('opens under the surface of the Nurserie, with the creature the story ended with', () => {
    const p = openBalade(ended());
    expect(p.balade).toEqual({ chapter: FIRST, creature: null });
    expect(playedOf(p)).toBe(last);
    expect(resumeOf(p)).toBe('nurserie');
    // once: an open Balade stays as it is
    const q = { ...p, balade: { chapter: 'recif', creature: odd } };
    expect(openBalade(q)).toBe(q);
  });

  it('plays another creature without touching the lineage nor the story’s last one', () => {
    const p = openBalade(ended()), q = playIn(p, odd);
    expect(playedOf(q)).toBe(odd);
    expect(q.creature).toBe(last);
    expect(q.lineage).toEqual(p.lineage);
    expect(p.balade?.creature).toBeNull();
    // the story goes on as before
    const story = ended();
    expect(playIn(story, odd)).toBe(story);
  });

  it('goes back up as well as down, and the story’s chapter does not move', () => {
    const p = openBalade(ended()), q = wander(p, 'recif')!;
    expect(resumeOf(q)).toBe('recif');
    expect(q.chapter).toBe('remontee');
    expect(wander(q, 'recif')).toBeNull();
    expect(resumeOf(wander(q, 'nurserie')!)).toBe('nurserie');
    expect(wander(ended(), 'recif')).toBeNull();
    expect(resumeOf(ended())).toBe('remontee');
  });

  it('comes back with the saved game', () => {
    const store = fakeStore();
    savePartie(store, wander(playIn(openBalade(ended()), odd), 'recif')!, 1);
    const p = loadPartie(store, CHAPTERS);
    expect(p.balade).toEqual({ chapter: 'recif', creature: odd });
    expect(p.creature).toEqual(last);
    expect(p.lineage).toHaveLength(2);
    // what it cannot read: the first chapter, the story's creature
    store.setItem(PARTIE_KEY, JSON.stringify({ ...ended(), balade: { chapter: 'atlantide', creature: 3 } }));
    expect(loadPartie(store, CHAPTERS).balade).toEqual({ chapter: 'nurserie', creature: null });
    store.setItem(PARTIE_KEY, JSON.stringify({ ...ended(), balade: 'oui' }));
    expect(loadPartie(store, CHAPTERS).balade).toBeUndefined();
  });

  it('reads a story finished before it was saved, by the flag the browser kept', () => {
    expect(finishedBefore(ended(), true, 'remontee')).toBe(true);
    expect(finishedBefore(ended(), false, 'remontee')).toBe(false);
    // begun again since: a story like any other
    expect(finishedBefore({ ...ended(), chapter: 'recif' }, true, 'remontee')).toBe(false);
    expect(finishedBefore(openBalade(ended()), true, 'remontee')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { backWords, generations, originWords } from './arbre';
import { souvenirLayout } from './generique';
import { birth, newPartie, parsePartie, type Partie } from './partie';
import { FLOW, GROW, SMALL, backOf, motesAt, returnTo, sizeAt } from './retour';

const larva = { name: 'Première' }, fish = { name: 'Prelune' }, crab = { name: 'Prabe' };
/** three generations, the third played in the Récif */
const three = (): Partie => birth(birth({ ...newPartie('nurserie'), creature: larva }, fish, 'nurserie'), crab, 'recif');

describe('going back to an earlier form', () => {
  it('plays a copy of the ancestor, where we are, and keeps the one we were in the lineage', () => {
    const p = three(), q = returnTo(p, 0, 'recif', { x: 120, y: 300 });
    expect(q.creature).toEqual(larva);
    expect(q.creature).not.toBe(larva);
    expect(q.chapter).toBe('recif');
    expect(q.lineage).toHaveLength(3);
    expect(q.lineage[2]).toEqual({ creature: crab, chapter: 'recif', back: 0, at: { x: 120, y: 300 } });
    // nothing before is touched
    expect(q.lineage.slice(0, 2)).toEqual(p.lineage);
  });

  it('does nothing without such an ancestor, or without a creature', () => {
    const p = three();
    expect(returnTo(p, 5, 'recif')).toBe(p);
    expect(returnTo(p, -1, 'recif')).toBe(p);
    const empty = newPartie('nurserie');
    expect(returnTo(empty, 0, 'nurserie')).toBe(empty);
  });

  it('can go back again, even to the one it has just left: nothing is ever lost', () => {
    const q = returnTo(returnTo(three(), 0, 'recif'), 2, 'recif');
    expect(q.creature).toEqual(crab);
    expect(q.lineage.map((a) => a.back ?? null)).toEqual([null, null, 0, 2]);
  });

  it('is saved and read back', () => {
    const q = returnTo(three(), 1, 'recif', { x: 1, y: 2 });
    const r = parsePartie(JSON.stringify(q), ['nurserie', 'recif']);
    expect(r?.lineage[2].back).toBe(1);
    expect(backOf(r!.lineage, 2)).toBe(1);
  });

  it('reads only a link to an earlier generation', () => {
    const l = three().lineage;
    for (const bad of [undefined, -1, 2, 3, 0.5, '0', null]) expect(backOf([...l, { creature: crab, chapter: 'recif', back: bad as never }], 2)).toBeNull();
    expect(backOf([...l, { creature: crab, chapter: 'recif', back: 0 }], 2)).toBe(0);
  });
});

describe('in the tree and the credits', () => {
  it('says « retour à » after the one we were, and « reprise » for the form taken again', () => {
    const q = returnTo(three(), 0, 'recif');
    const g = generations(q.lineage, q.creature!, 'nurserie');
    expect(g.map((x) => [x.rank, x.name, x.back?.name ?? null, x.again, x.current])).toEqual([
      [1, 'Première', null, false, false],
      [2, 'Prelune', null, false, false],
      [3, 'Prabe', 'Première', false, false],
      [4, 'Première', null, true, true]
    ]);
    expect(g[2].partner).toBeNull();
    expect(backWords(g[2].back!)).toBe('retour à Première');
    expect(originWords(g[3], 'Le Récif')).toBe('reprise au Récif');
    expect(originWords(g[2], 'Le Récif')).toBe('née au Récif');
  });

  it('keeps room on the image for the words of a return, as for a partner', () => {
    const L = souvenirLayout([{ partner: null, back: { name: 'x' } }, { partner: null }], 0);
    expect(L.mates[0]).not.toBeNull();
  });
});

describe('the scene', () => {
  it('grows the new body from small to its size', () => {
    expect(sizeAt(0)).toBeCloseTo(SMALL);
    expect(sizeAt(GROW)).toBe(1);
    expect(sizeAt(GROW / 2)).toBeGreaterThan(sizeAt(GROW / 4));
  });

  it('sends its lights from the one we were to the new body, and stops', () => {
    const from = { x: 0, y: 0 }, to = { x: 100, y: 0 };
    expect(motesAt(0, from, to)).toEqual([]);
    const mid = motesAt(FLOW / 2, from, to);
    expect(mid.length).toBeGreaterThan(0);
    for (let i = 0; i < mid.length; i += 4) {
      expect(mid[i]).toBeGreaterThanOrEqual(0);
      expect(mid[i]).toBeLessThanOrEqual(100);
    }
    expect(motesAt(FLOW + 0.01, from, to)).toEqual([]);
  });
});

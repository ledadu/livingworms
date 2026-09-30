import { describe, expect, it } from 'vitest';
import { SPECIES } from '../content/species';
import { BIOMES } from './biomes';
import { bornWords, cleanName, generationLabel, generations, mateFor, mateOf, NAME_MAX } from './arbre';

const larva = { name: 'Première' }, fish = { name: 'Prelune' }, crab = { name: 'Prabe' };
const moon = { id: 'meduse', name: 'Méduse lune' };

describe('the generations', () => {
  it('is only the one played at the start, born in the first chapter', () => {
    expect(generations([], larva, 'nurserie')).toEqual([{ rank: 1, creature: larva, name: 'Première', bornIn: 'nurserie', partner: null, current: true }]);
  });

  it('gives each one the place where the one before gave birth, and its partner', () => {
    const g = generations([{ creature: larva, chapter: 'nurserie', partner: moon }, { creature: fish, chapter: 'recif' }], crab, 'nurserie');
    expect(g.map((x) => [x.rank, x.name, x.bornIn, x.partner?.name ?? null, x.current])).toEqual([
      [1, 'Première', 'nurserie', 'Méduse lune', false],
      [2, 'Prelune', 'nurserie', null, false],
      [3, 'Prabe', 'recif', null, true]
    ]);
  });

  it('names a creature that has lost its name', () => {
    expect(generations([], {}, 'nurserie')[0].name).toBe('Sans nom');
  });

  it('keeps a partner of the bestiary by its species, for its portrait', () => {
    expect(mateFor(SPECIES.crabe())).toEqual({ id: 'crabe', name: SPECIES.crabe().name });
    expect(mateFor({ name: 'Chimère' })).toEqual({ id: '', name: 'Chimère' });
  });

  it('reads a partner only when it has a name', () => {
    expect(mateOf({ partner: moon })).toEqual(moon);
    expect(mateOf({ partner: { name: 'Crabe' } as never })).toEqual({ id: '', name: 'Crabe' });
    for (const bad of [undefined, null, 3, {}, { id: 'crabe', name: '' }]) expect(mateOf({ partner: bad as never })).toBeNull();
  });
});

describe('the words of the tree', () => {
  it('counts the generations in words', () => {
    expect(generationLabel(1)).toBe('Première génération');
    expect(generationLabel(10)).toBe('Dixième génération');
    expect(generationLabel(17)).toBe('Dix-septième génération');
    expect(generationLabel(21)).toBe('21e génération');
  });

  it('says where each chapter is', () => {
    expect(BIOMES.map((b) => bornWords(b.name))).toEqual([
      'née à la Nurserie', 'née au Récif', 'née dans la Forêt', 'née dans la Grotte', 'née à la Carcasse', 'née aux Sources',
      'née au Glacier', 'née au Jardin de méduses', 'née dans la Fosse', 'née à la Remontée'
    ]);
    expect(bornWords('L’Abîme')).toBe('née à l’Abîme');
    expect(bornWords('Atlantide')).toBe('née à Atlantide');
  });

  it('tidies a typed name', () => {
    expect(cleanName('  Aube   des  mers ')).toBe('Aube des mers');
    expect(cleanName(' \n ')).toBeNull();
    expect(cleanName('x'.repeat(40))).toHaveLength(NAME_MAX);
  });
});

import { describe, expect, it } from 'vitest';
import { SPECIES, firstAncestor } from '../content/species';
import { brood, type Child } from '../content/portee';
import { inherited } from './portee-ecran';

describe('inherited', () => {
  it('names the body on the side it comes from, then the parts', () => {
    const c = { spec: { body: { name: 'Ombrelle' } }, body: 'partner', fromParent: ['Cil', 'Queue'], fromPartner: ['Filament'] } as unknown as Child;
    expect(inherited(c, 'Première', 'Méduse')).toEqual([
      { from: 'Première', parts: ['Cil', 'Queue'] },
      { from: 'Méduse', parts: ['Ombrelle', 'Filament'] }
    ]);
  });

  it('leaves out a side that gave nothing', () => {
    const c = { spec: { body: { name: 'Corps' } }, body: 'parent', fromParent: ['Cil'], fromPartner: [] } as unknown as Child;
    expect(inherited(c, 'Première', 'Crabe')).toEqual([{ from: 'Première', parts: ['Corps', 'Cil'] }]);
  });

  it('always shows something from the parent for a real brood', () => {
    for (const c of brood(firstAncestor(), SPECIES.crabe(), { seed: 2 })) expect(inherited(c, 'Première', 'Crabe')[0].from).toBe('Première');
  });
});

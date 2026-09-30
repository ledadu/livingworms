import { describe, expect, it } from 'vitest';
import { spec } from '../engine';
import { fuse, generate } from './generate';
import { part } from './parts';
import { SPECIES, firstAncestor } from './species';
import { TRAITS, TRAIT_LABELS, bodyMeasures, hasTrait, traitsOf, type Trait } from './traits';

const of = (id: string) => traitsOf(SPECIES[id]());

describe('traitsOf', () => {
  it('reads each trait of the table on the animals it comes from', () => {
    expect(of('poissonClown')).toContain('nageoires');
    expect(of('manta')).toContain('nageoires');
    expect(of('baudroie')).toContain('lanterne');
    expect(of('ctenophore')).toContain('lanterne');
    expect(of('crabe')).toContain('pinces');
    expect(of('homard')).toContain('pinces');
    expect(of('anguille')).toContain('corpsFin');
    expect(of('verDeFeu')).toContain('corpsFin');
    expect(of('crevette')).toContain('carapace');
    expect(of('nautile')).toContain('carapace');
    expect(of('meduse')).toContain('pulsation');
    expect(of('chrysaora')).toContain('pulsation');
    expect(of('meduse')).toContain('filaments');
    expect(of('siphonophore')).toContain('filaments');
    expect(of('ctenophore')).toContain('cils');
    expect(of('serpentCilie')).toContain('cils');
  });

  it('gives the whole set of a few species, in the order of TRAITS', () => {
    expect(of('anguille')).toEqual(['nageoires', 'corpsFin', 'filaments']);
    expect(of('meduse')).toEqual(['lanterne', 'pulsation', 'filaments']);
    expect(of('homard')).toEqual(['nageoires', 'pinces', 'carapace']);
    expect(of('poissonClown')).toEqual(['nageoires']);
    // the first larva's tail, light and cilia are only buds (chapitres.md: génération 1, sans trait)
    expect(traitsOf(firstAncestor())).toEqual([]);
  });

  it('draws the lines of the thresholds where the bestiary expects them', () => {
    // corps fin: the long worms and eels, not the axolotl nor the larva
    expect(of('axolotl')).not.toContain('corpsFin');
    expect(of('larve')).not.toContain('corpsFin');
    expect(of('requinBaleine')).not.toContain('corpsFin');
    // carapace: a crab is plated by its legs and claws, a leafy sea dragon is mostly leaves
    expect(of('crabe')).toContain('carapace');
    expect(of('dragonFeuillu')).not.toContain('carapace');
    // pulsation: the squid mantle beats too softly, the siphonophore swims as a bell
    expect(of('calmar')).not.toContain('pulsation');
    expect(of('siphonophore')).toContain('pulsation');
  });

  it('looks at role and style, not at the names the species give their parts', () => {
    // the turtle's head is a jaw, but not a hard claw
    expect(of('tortue')).not.toContain('pinces');
    // the sea angel's wings are fins renamed « Aile »
    expect(of('clione')).toContain('nageoires');
    // the oursin's spines are stiff, not strands
    expect(of('oursin')).not.toContain('filaments');
  });

  it('follows the parts: adding one brings its trait', () => {
    const bare = () => spec({ body: { links: 8, len: 5, width: 5, shape: 'spindle' } });
    expect(traitsOf(bare())).toEqual([]);
    const cases: [string, Trait][] = [['nageoire', 'nageoires'], ['lanterne', 'lanterne'], ['pince', 'pinces'], ['filament', 'filaments'], ['cils', 'cils']];
    for (const [id, t] of cases) {
      const s = bare();
      s.body.attach.push(part(id));
      expect(traitsOf(s)).toContain(t);
    }
  });

  it('gives no trait for a bud, but keeps what grows on it', () => {
    const s = spec({ body: { links: 8, len: 5, width: 5, shape: 'spindle', attach: [part('nageoire', { bud: true })] } });
    expect(traitsOf(s)).toEqual([]);
    s.body.attach[0].node.attach.push(part('cils'));
    expect(traitsOf(s)).toEqual(['cils']);
  });

  it('keeps the buds of the larva in its children, which gain their traits from the partner', () => {
    const child = fuse(firstAncestor(), SPECIES.copepode(), { seed: 3 });
    for (const t of traitsOf(child)) expect(traitsOf(SPECIES.copepode()).concat('corpsFin', 'carapace', 'pulsation')).toContain(t);
  });

  it('reads the body as a whole for corps fin, carapace and pulsation', () => {
    expect(traitsOf(spec({ body: { links: 20, len: 5, width: 5, shape: 'worm' } }))).toEqual(['corpsFin']);
    expect(traitsOf(spec({ body: { links: 8, len: 5, width: 5, style: 'plates' } }))).toEqual(['carapace']);
    expect(traitsOf(spec({ body: { links: 4, len: 4, width: 12, shape: 'bell', motion: { type: 'pulse', amp: 0.2 } } }))).toEqual(['pulsation']);
    expect(traitsOf(spec({ swim: { mode: 'bell' }, body: { links: 4, len: 4, width: 12 } }))).toEqual(['pulsation']);
  });

  it('works on generated and fused species, and is pure', () => {
    const a = SPECIES.anguille(), b = SPECIES.homard();
    const child = fuse(a, b, { seed: 7 });
    expect(traitsOf(child)).toEqual(traitsOf(child));
    for (let seed = 1; seed <= 30; seed++) {
      const t = traitsOf(generate({ seed }));
      expect(t.every((x) => TRAITS.includes(x))).toBe(true);
      expect(new Set(t).size).toBe(t.length);
    }
    const before = JSON.stringify(a);
    traitsOf(a);
    expect(JSON.stringify(a)).toBe(before);
  });

  it('has a label for every trait', () => {
    for (const t of TRAITS) expect(TRAIT_LABELS[t]).toBeTruthy();
    expect(hasTrait(SPECIES.crabe(), 'pinces')).toBe(true);
  });
});

describe('bodyMeasures', () => {
  it('measures the trunk as the engine lays it out', () => {
    // 10 links of 3, constant radius 2
    const m = bodyMeasures(spec({ body: { links: 10, len: 3, width: 2, shape: 'constant' } }));
    expect(m.slender).toBeCloseTo(15);
    expect(m.plated).toBe(0);
    expect(m.pulse).toBe(0);
  });

  it('weighs the plates by surface, every copy counted', () => {
    const half = spec({
      body: { links: 2, len: 2, width: 1, shape: 'constant', style: 'ribbon',
        attach: [{ pattern: 'pair', node: { links: 2, len: 1, width: 1, shape: 'constant', style: 'plates' } }] }
    });
    expect(bodyMeasures(half).plated).toBeCloseTo(0.5);
  });
});

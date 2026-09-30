import { describe, expect, it } from 'vitest';
import { stats } from '../engine';
import { SPECIES, firstAncestor } from './species';
import { BROOD, brood, carriers, childNames, limbTraits } from './portee';

const larva = firstAncestor();
const PAIRS: [string, string][] = [['larve', 'meduse'], ['poissonClown', 'crabe'], ['anguille', 'ctenophore'], ['homard', 'baudroie'], ['seiche', 'siphonophore']];

describe('brood', () => {
  it('has four children, the same for the same seed', () => {
    const a = brood(larva, SPECIES.meduse(), { seed: 7 }), b = brood(larva, SPECIES.meduse(), { seed: 7 });
    expect(a).toHaveLength(BROOD);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(brood(larva, SPECIES.meduse(), { seed: 8 }))).not.toBe(JSON.stringify(a));
  });

  it('takes about 40 % from the partner', () => {
    const shares = brood(larva, SPECIES.crabe(), { seed: 1 }).map((c) => c.share);
    expect(shares.reduce((s, x) => s + x, 0) / BROOD).toBeCloseTo(0.4, 1);
    // over many broods, the parent gives more parts than the partner
    let p = 0, q = 0;
    for (let s = 0; s < 40; s++) for (const [x, y] of PAIRS) for (const c of brood(SPECIES[x](), SPECIES[y](), { seed: s, wanted: () => false })) {
      p += c.fromParent.length; q += c.fromPartner.length;
    }
    expect(p / (p + q)).toBeGreaterThan(0.5);
    expect(p / (p + q)).toBeLessThan(0.75);
  });

  it('names the body after the one it comes from', () => {
    const jelly = SPECIES.meduse();
    for (const c of brood(larva, jelly, { seed: 7 })) expect(c.spec.body.name).toBe(c.body === 'parent' ? larva.body.name : jelly.body.name);
  });

  it('takes something from each side, and says where every part came from', () => {
    for (let s = 0; s < 10; s++) for (const [x, y] of PAIRS) for (const c of brood(SPECIES[x](), SPECIES[y](), { seed: s })) {
      // (the larva has no limb to give)
      if (c.body === 'parent' || SPECIES[x]().body.attach.length) expect(c.body === 'parent' ? c.fromPartner.length : c.fromParent.length).toBeGreaterThan(0);
      expect(c.spec.name).toBeTruthy();
    }
  });

  it('hands the wanted parts to more children after a better parade, never to none', () => {
    const count = (quality: number, seed: number) => brood(larva, SPECIES.crabe(), { seed, quality, wanted: (l) => l.node.name === 'Bras de pince' })
      .filter((c) => c.fromPartner.includes('Bras de pince')).length;
    for (let s = 0; s < 20; s++) {
      expect(count(0, s)).toBeGreaterThanOrEqual(1);
      expect(count(1, s)).toBeGreaterThanOrEqual(3);
      expect(count(1, s)).toBeGreaterThanOrEqual(count(0, s));
    }
    expect(carriers(0)).toBe(1);
    expect(carriers(0.5)).toBe(2);
    expect(carriers(1)).toBe(3);
  });

  it('stays light enough for a phone', () => {
    for (const [x, y] of PAIRS) for (const c of brood(SPECIES[x](), SPECIES[y](), { seed: 5, quality: 1, wanted: () => true })) {
      expect(stats(c.spec).chains).toBeLessThanOrEqual(170);
    }
  });
});

describe('childNames', () => {
  it('gives four different names', () => {
    for (const [a, b] of [['Première', 'Méduse'], ['Poisson-clown', 'Homard'], ['Ver', 'Crabe'], ['Anguille', 'Clione'], ['Ao', 'Io']]) {
      const names = childNames(a, b);
      expect(new Set(names).size).toBe(4);
      expect(names).toHaveLength(BROOD);
    }
  });
});

describe('traits', () => {
  it('knows what a limb brings', () => {
    const crab = SPECIES.crabe(), claw = crab.body.attach.find((l) => l.node.role === 'jaw')!;
    expect(limbTraits(crab, claw)).toContain('pinces');
  });

  it('hands the limbs that bring the wanted traits, and says the traits of each child', () => {
    for (let s = 0; s < 10; s++) {
      const kids = brood(larva, SPECIES.crabe(), { seed: s, quality: 1, keys: ['pinces'] });
      expect(kids.filter((c) => c.traits.includes('pinces')).length).toBeGreaterThanOrEqual(3);
      const poor = brood(larva, SPECIES.crabe(), { seed: s, quality: 0, keys: ['pinces'] });
      expect(poor.filter((c) => c.traits.includes('pinces')).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('wants by default the partner traits the parent lacks', () => {
    const kids = brood(larva, SPECIES.meduse(), { seed: 4, quality: 1 });
    expect(kids.filter((c) => c.traits.includes('filaments')).length).toBeGreaterThanOrEqual(3);
  });
});

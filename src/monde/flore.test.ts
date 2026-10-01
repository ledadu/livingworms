import { describe, expect, it } from 'vitest';
import { rng } from '../engine';
import { Creature3, settle3 } from '../engine3/creature3';
import { BIOMES, X0, X1, biomeIndex } from './biomes';
import { FLORE, FLORE_OF, SHY, floreSpec, placeFlore, shyStep, type Shyness } from './flore';

const grow = (kind: string, seed: number) => {
  const sp = floreSpec(kind, rng(seed), false)!;
  const cr = new Creature3(sp, 0, 0, 0, { anchor: { dir: { x: 0, y: -1, z: 0 }, plane: 0 }, phase: 0, scale: 1 });
  settle3(cr, 40);
  return cr;
};

describe('the new flora', () => {
  it('grows every kind into a whole creature, of a size that shows beside the plants', () => {
    for (const kind of Object.keys(FLORE)) {
      for (const seed of [1, 2, 3]) {
        const cr = grow(kind, seed), b = cr.box, w = b[3] - b[0], h = b[4] - b[1];
        expect(cr.list.length, kind).toBeGreaterThanOrEqual(1);
        for (const v of b) expect(Number.isFinite(v), kind).toBe(true);
        // neither a speck nor a tree: between about a swimmer's size and a big coral's
        expect(Math.max(w, h), kind).toBeGreaterThan(8);
        expect(Math.max(w, h), kind).toBeLessThan(90);
      }
    }
  });

  it('is the same every time a seed grows back', () => {
    for (const kind of Object.keys(FLORE)) expect(floreSpec(kind, rng(7), false)).toEqual(floreSpec(kind, rng(7), false));
    expect(floreSpec('kelp', rng(7), false)).toBeNull();
  });

  it('only names kinds it knows, and uses every one of them somewhere', () => {
    const used = new Set<string>();
    for (const f of Object.values(FLORE_OF)) for (const [k] of f!.kinds) { expect(FLORE[k], k).toBeDefined(); used.add(k); }
    expect([...used].sort()).toEqual(Object.keys(FLORE).sort());
  });

  it('adds to every chapter with a floor, in patches, the same world every time', () => {
    const l = placeFlore();
    expect(placeFlore()).toEqual(l);
    for (const [, x] of l) { expect(x).toBeGreaterThan(X0 - 100); expect(x).toBeLessThan(X1 + 100); }
    for (const b of BIOMES) {
      const here = l.filter(([, x]) => BIOMES[biomeIndex(x)].id === b.id);
      if (b.abyss) expect(here.length, b.id).toBe(0);
      else expect(here.length, b.id).toBeGreaterThan(5);
    }
  });

  it('grows each kind where its chapter (or the next one, near the border) wants it', () => {
    for (const [kind, x] of placeFlore()) {
      const i = biomeIndex(x), ids = [i - 1, i, i + 1].filter((j) => j >= 0 && j < BIOMES.length).map((j) => BIOMES[j].id);
      expect(ids.some((id) => FLORE_OF[id]?.kinds.some(([k]) => k === kind)), `${kind} at ${x}`).toBe(true);
    }
  });

  it('keeps the lights of the deep ones for the dark chapters', () => {
    for (const [id, f] of Object.entries(FLORE_OF)) {
      const b = BIOMES.find((c) => c.id === id)!;
      for (const [k] of f!.kinds) if (FLORE[k].glow) expect(b.dark, `${k} in ${id}`).toBeGreaterThanOrEqual(0.3);
    }
  });
});

describe('the shy ones', () => {
  const run = (s: Shyness, near: boolean, secs: number) => { for (let t = 0; t < secs; t += 1 / 60) shyStep(s, near, 1 / 60); };

  it('draw back at once when the swimmer comes near', () => {
    const s = { out: 1, calm: 10 };
    run(s, true, SHY.hide + 0.05);
    expect(s.out).toBe(0);
  });

  it('stay hidden while it is not calm, then come out slowly', () => {
    const s = { out: 0, calm: 0 };
    run(s, false, SHY.wait - 0.1);
    expect(s.out).toBe(0);
    run(s, false, SHY.open * 0.5 + 0.1);
    expect(s.out).toBeGreaterThan(0.2);
    expect(s.out).toBeLessThan(0.8);
    run(s, false, SHY.open);
    expect(s.out).toBe(1);
  });

  it('start the wait over whenever the swimmer comes back', () => {
    const s = { out: 0, calm: 0 };
    run(s, false, SHY.wait - 0.2);
    run(s, true, 0.1);
    run(s, false, SHY.wait - 0.2);
    expect(s.out).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { rng } from '../engine';
import { SPECIES, firstAncestor } from '../content/species';
import { BURSTS, CELL, CELL_CAP, MAX_MOTES, Motes, PEAK_MAX, WAKES, burst, genesOf, lueurOf, wake, type Burst, type Lueur, type Wake } from './lueur';

const genes = (id: string) => genesOf(SPECIES[id]());
const near = (a: number, b: number, d: number) => Math.abs(((a - b + 540) % 360) - 180) <= d;

/** what the lights show now: each light, and the alpha summed in each cell */
function shown(m: Motes, gain = 1) {
  const lights: { x: number; y: number; size: number; hue: number; al: number }[] = [];
  const cells = new Map<string, number>();
  m.each((x, y, size, hue, al) => {
    lights.push({ x, y, size, hue, al });
    const k = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    cells.set(k, (cells.get(k) || 0) + al);
  }, gain);
  return { lights, cells: [...cells.values()] };
}

describe('the genes of a dancer', () => {
  it('reads its colours, its traits and the way it swims', () => {
    const g = genes('meduse');
    expect(g.hues[0]).toBe(SPECIES.meduse().palette.hue);
    expect(g.genes).toEqual(expect.arrayContaining(['pulsation', 'bell']));
    expect(genes('crabe').genes).toEqual(expect.arrayContaining(['carapace', 'pinces', 'crawl']));
  });

  it('puts the colours of what glows first', () => {
    const parts = [{ def: { color: { glow: 'none' } }, hue: 10 }, { def: { color: { glow: 'tip' } }, hue: 200 }];
    const g = genesOf(firstAncestor(), parts);
    expect(g.hues[0]).toBe(200);
    expect(g.genes).toContain('lueur');
    expect(genesOf(firstAncestor()).genes).not.toContain('lueur');
  });

  it('knows the arms of a star and the tentacles of a bell, and none in a crab', () => {
    expect(genes('etoile').sym).toBe(5);
    expect(genes('meduse').sym).toBe(6);
    expect(genes('crabe').sym).toBe(0);
    for (const id of Object.keys(SPECIES)) {
      const s = genes(id).sym;
      expect(s === 0 || (s >= 3 && s <= 8)).toBe(true);
    }
  });
});

describe('the light of a parade', () => {
  it('is the same for the same chance, in the colours of both dancers', () => {
    const a = lueurOf(genes('hippocampe'), genes('larve'), rng(7)), b = lueurOf(genes('hippocampe'), genes('larve'), rng(7));
    expect(a).toEqual(b);
    expect(near(a.hues[0], genes('hippocampe').hues[0], 8)).toBe(true);
    expect(a.hues.some((h) => near(h, genes('larve').hues[0], 8))).toBe(true);
  });

  it('is rarely the same twice: every wake and every figure comes, in many ways', () => {
    const w = new Set<Wake>(), b = new Set<Burst>(), looks = new Set<string>();
    let last: Lueur | null = null, again = 0;
    for (let s = 1; s <= 300; s++) {
      const l: Lueur = lueurOf(genes('poissonClown'), genes('larve'), rng(s), last);
      w.add(l.wake); b.add(l.burst); looks.add(`${l.wake} ${l.burst} ${l.echo} ${l.arms}`);
      if (last && l.burst === last.burst) again++;
      last = l;
    }
    expect(w.size).toBe(Object.keys(WAKES).length);
    expect(b.size).toBe(Object.keys(BURSTS).length);
    expect(looks.size).toBeGreaterThan(80);
    // the figure of the parade before comes back rarely
    expect(again / 300).toBeLessThan(0.08);
  });

  it('follows the genes: bells beat rings, crabs make fountains and sparks', () => {
    const count = (theirs: string, ours: string, f: (l: Lueur) => boolean) => {
      let n = 0;
      for (let s = 1; s <= 400; s++) if (f(lueurOf(genes(theirs), genes(ours), rng(s)))) n++;
      return n;
    };
    const rings = (l: Lueur) => l.burst === 'anneaux' || l.wake === 'pouls';
    const hard = (l: Lueur) => l.burst === 'fontaine' || l.wake === 'etincelles';
    expect(count('meduse', 'chrysaora', rings)).toBeGreaterThan(2 * count('crabe', 'homard', rings));
    expect(count('crabe', 'homard', hard)).toBeGreaterThan(2 * count('meduse', 'chrysaora', hard));
    // the lantern of the anglerfish calls fireflies
    expect(count('baudroie', 'larve', (l) => l.burst === 'lucioles')).toBeGreaterThan(count('koi', 'larve', (l) => l.burst === 'lucioles'));
  });

  it('takes its symmetry from the partner, else from us, else from chance', () => {
    expect(lueurOf(genes('etoile'), genes('larve'), rng(1)).arms).toBe(5);
    expect(lueurOf(genes('larve'), genes('poulpe'), rng(1)).arms).toBe(8);
    const arms = new Set<number>();
    for (let s = 1; s <= 60; s++) arms.add(lueurOf(genes('larve'), genes('larve'), rng(s)).arms);
    expect(Math.min(...arms)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...arms)).toBeLessThanOrEqual(8);
    expect(arms.size).toBeGreaterThan(3);
  });
});

describe('the lights', () => {
  const base = lueurOf(genes('hippocampe'), genes('larve'), rng(3));

  it('wait for their turn unseen, then fade out and go', () => {
    const m = new Motes();
    m.add({ x: 0, y: 0, delay: 0.5, life: 1, hue: 40, size: 5 });
    expect(shown(m).lights).toHaveLength(0);
    for (let i = 0; i < 40; i++) m.step();
    expect(shown(m).lights).toHaveLength(1);
    for (let i = 0; i < 80; i++) m.step();
    expect(m.count).toBe(0);
  });

  it('are never more than MAX_MOTES', () => {
    const m = new Motes();
    for (let i = 0; i < MAX_MOTES + 50; i++) m.add({ x: i, y: 0, life: 5, hue: 40, size: 5 });
    expect(m.count).toBe(MAX_MOTES);
  });

  it('never burn to white: every figure, as rich as can be, shares its strength where the lights gather', () => {
    for (const f of Object.keys(BURSTS) as Burst[]) for (const echo of [null, ...Object.keys(BURSTS)] as (Burst | null)[]) {
      const m = new Motes(), r = rng(5);
      burst(m, { ...base, burst: f, echo }, { x: 0, y: 0 }, 1, r);
      let seen = 0;
      for (let i = 0; i < 180; i++) {
        m.step();
        if (i % 6) continue;
        // in clear water too, where they are made stronger
        for (const gain of [1, 1.5, 3]) {
          const { lights, cells } = shown(m, gain);
          seen = Math.max(seen, lights.length);
          for (const c of cells) expect(c).toBeLessThanOrEqual(CELL_CAP + 1e-9);
          for (const l of lights) expect(l.al).toBeLessThanOrEqual(PEAK_MAX + 1e-9);
        }
      }
      expect(seen).toBeGreaterThan(10);
    }
  });

  it('draw a richer figure after a better parade, and a wide one', () => {
    for (const f of Object.keys(BURSTS) as Burst[]) {
      const rich = (q: number) => { const m = new Motes(); burst(m, { ...base, burst: f, echo: null }, { x: 0, y: 0 }, q, rng(9)); return m.count; };
      expect(rich(1)).toBeGreaterThan(rich(0));
      const m = new Motes();
      burst(m, { ...base, burst: f, echo: null }, { x: 0, y: 0 }, 1, rng(9));
      let far = 0;
      for (let i = 0; i < 90; i++) { m.step(); m.each((x, y) => { far = Math.max(far, Math.hypot(x, y)); }); }
      expect(far).toBeGreaterThan(70);
    }
  });

  it('light our wake only when we dance in time', () => {
    for (const w of Object.keys(WAKES) as Wake[]) {
      const at = (sync: number) => {
        const m = new Motes(), r = rng(2), l = { ...base, wake: w };
        let ours = 0;
        for (let t = 0; t < 240; t++) {
          const before = m.count;
          wake(m, l, t, { x: 0, y: 0 }, { x: 5000, y: 0 }, sync, r);
          if (m.count > before) m.each((x) => { if (x > 4000) ours++; });
          m.step();
        }
        return { theirs: m.count, ours };
      };
      expect(at(0).theirs).toBeGreaterThan(0);
      expect(at(0).ours).toBe(0);
      expect(at(0.9).ours).toBeGreaterThan(0);
    }
  });
});

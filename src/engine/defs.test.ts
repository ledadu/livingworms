import { describe, expect, it } from 'vitest';
import { att, expand, node, onRim, rimOf, thinnedOut } from './defs';

const fan = (count: number, more = {}) => att({ pattern: 'fan', at: 1, count, spread: 1.2, edge: 0.95, angle: 0, ...more });
const kept = (a: ReturnType<typeof att>) => Array.from({ length: a.count }, (_, k) => k).filter((k) => !thinnedOut(a, k));

describe('a centered fan', () => {
  it('varies by mirror pairs: its copies are symmetric about its middle', () => {
    for (const c of [6, 7, 12]) {
      const s = expand(fan(c, { jitter: 0.6 }), 4);
      for (let k = 0; k < c; k++) {
        const m = s[c - 1 - k];
        expect(s[k].angle).toBeCloseTo(-m.angle, 6);
        expect(s[k].scale).toBeCloseTo(m.scale, 6);
        expect(s[k].edge).toBeCloseTo(-m.edge, 6);
      }
    }
  });

  it('thinned out, keeps both ends and stays symmetric', () => {
    for (const c of [6, 7, 12, 16]) {
      const k = kept(fan(c));
      expect(k).toContain(0);
      expect(k).toContain(c - 1);
      expect(k.map((i) => c - 1 - i).sort((a, b) => a - b)).toEqual(k);
      expect(k.length).toBeLessThan(c);
    }
  });

  it('hangs all round the rim of a bell, symmetric, in front and behind', () => {
    const bell = node({ shape: 'bell' }), a = fan(12);
    expect(onRim(bell, a)).toBe(true);
    const r = Array.from({ length: 12 }, (_, k) => rimOf(a, k));
    for (let k = 0; k < 12; k++) {
      expect(r[k].u).toBeCloseTo(-r[11 - k].u, 6);
      expect(r[k].back).toBe(r[11 - k].back);
      expect(r[k].open).toBeCloseTo(0.6, 6);
    }
    // seen from the side: as wide as the fan, evenly spread
    expect(r[0].u).toBe(-1);
    expect(r[11].u).toBe(1);
    // both in front and behind, also among those kept when thinned out
    const backs = (ks: number[]) => new Set(ks.filter((k) => Math.abs(r[k].u) < 1).map((k) => r[k].back));
    expect(backs(r.map((_, k) => k))).toEqual(new Set([1, -1]));
    expect(backs(kept(a))).toEqual(new Set([1, -1]));
  });

  it('stays a fan away from a bell, or when it leans to the sides', () => {
    expect(onRim(node({ shape: 'spindle' }), fan(8))).toBe(false);
    expect(onRim(node({ shape: 'bell' }), fan(8, { angle: 1.2 }))).toBe(false);
    expect(onRim(node({ shape: 'bell' }), att({ pattern: 'series', count: 8 }))).toBe(false);
  });
});

describe('an alternate row', () => {
  it('thinned out, keeps copies on both sides', () => {
    const a = att({ pattern: 'series', count: 10, alternate: true });
    const sides = new Set(kept(a).map((k) => expand(a, 8)[k].side));
    expect(sides).toEqual(new Set([1, -1]));
  });
});

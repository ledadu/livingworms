import { describe, expect, it } from 'vitest';
import { RISE, figuresOf, newDanse, over, pose, styleOf, wished, type Pt, type Style } from './danse';
import { STEP } from '../engine';

/** a seeded chance (mulberry32) */
const seeded = (n: number) => () => {
  n = (n + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const PAIRS: [Style, Style][] = [['swim', 'swim'], ['swim', 'walk'], ['walk', 'swim'], ['walk', 'walk'], ['drift', 'swim'], ['drift', 'drift']];
const at = (i: number) => ({ a: { x: 1000 + 60 * (i % 3), y: 400 }, b: { x: 900, y: 420 } });

describe('the dance for two', () => {
  it('lasts a few seconds, opens turning around each other and ends face to face', () => {
    for (const styles of PAIRS) for (let k = 1; k < 20; k++) {
      const { a, b } = at(k), d = newDanse(a, b, styles, 50, seeded(k * 7919));
      const f = figuresOf(d);
      expect(d.time).toBeGreaterThan(4);
      expect(d.time).toBeLessThan(12);
      expect(f[0]).toBe(styles.filter((s) => s === 'walk').length === 1 ? 'halo' : 'tour');
      expect(f[f.length - 1]).toBe('face');
      expect(new Set(f).size).toBe(f.length);
      expect(over(d, d.time)).toBe(true);
      expect(over(d, d.time - 0.1)).toBe(false);
    }
  });

  it('is not the same from one dance to the next, nor for a walker and a swimmer', () => {
    const seqs = (styles: [Style, Style]) => new Set(Array.from({ length: 30 }, (_, k) => figuresOf(newDanse(at(k).a, at(k).b, styles, 50, seeded(k * 31 + 5))).join()));
    expect(seqs(['swim', 'swim']).size).toBeGreaterThanOrEqual(4);
    expect(seqs(['walk', 'walk']).size).toBeGreaterThanOrEqual(3);
    const swim = [...seqs(['swim', 'swim'])], mixed = [...seqs(['swim', 'walk'])];
    expect(swim.some((s) => s.includes('spirale'))).toBe(true);
    expect(mixed.some((s) => s.includes('spirale'))).toBe(false);
    expect(mixed.every((s) => s.startsWith('halo'))).toBe(true);
  });

  it('starts where the two are, and never jumps', () => {
    for (const styles of PAIRS) {
      const { a, b } = at(1), d = newDanse(a, b, styles, 60, seeded(styles.length * 13 + styles[0].length));
      const p0 = pose(d, 0);
      expect(Math.hypot(p0.a.x - a.x, p0.a.y - a.y) + Math.hypot(p0.b.x - b.x, p0.b.y - b.y)).toBeLessThan(styles.includes('walk') ? 80 : 1e-6);
      let prev = p0, most = 0;
      for (let s = STEP; s <= d.time; s += STEP) {
        const q = pose(d, s);
        most = Math.max(most, Math.hypot(q.a.x - prev.a.x, q.a.y - prev.a.y), Math.hypot(q.b.x - prev.b.x, q.b.y - prev.b.y));
        prev = q;
      }
      expect(most).toBeLessThan(5);
    }
  });

  it('keeps a walker on the floor where it began, the swimmer above it; two swimmers may rise', () => {
    const d = newDanse({ x: 0, y: 600 }, { x: 80, y: 500 }, ['walk', 'swim'], 50, seeded(3));
    for (let s = 0; s <= d.time; s += 0.25) {
      const q = pose(d, s);
      if (s > 1) expect(q.a.y).toBe(600);
      if (s > 1) expect(q.b.y).toBeLessThan(600 - 20);
    }
    let rose = 0;
    for (let k = 1; k < 30; k++) {
      const e = newDanse({ x: 0, y: 600 }, { x: 80, y: 600 }, ['swim', 'swim'], 50, seeded(k * 101));
      rose = Math.max(rose, 600 - pose(e, e.time).c.y);
    }
    expect(rose).toBeGreaterThan(RISE * 0.5);
    expect(rose).toBeLessThanOrEqual(RISE * 2);
  });

  it('ends with the two close, face to face, the eggs between them', () => {
    for (const styles of PAIRS) {
      const d = newDanse({ x: 0, y: 500 }, { x: 150, y: 520 }, styles, 50, seeded(77));
      const q = pose(d, d.time), gap = Math.abs(q.a.x - q.b.x);
      expect(gap).toBeLessThan(d.r * 0.8);
      expect(gap).toBeGreaterThan(d.r * 0.4);
    }
  });

  it('leads two bodies that steer with lag close to their places', () => {
    for (const styles of PAIRS) {
      const d = newDanse({ x: 0, y: 500 }, { x: 140, y: 500 }, styles, 50, seeded(9));
      const a = { x: 0, y: 500, vx: 0, vy: 0 }, b = { x: 140, y: 500, vx: 0, vy: 0 };
      let worst = 0;
      for (let s = 0; s < d.time; s += STEP) {
        const v = wished(d, s, a, b);
        for (const [m, w] of [[a, v.a], [b, v.b]] as [typeof a, Pt][]) {
          m.vx += (w.x - m.vx) * 0.06; m.vy += (w.y - m.vy) * 0.06; m.x += m.vx; m.y += m.vy;
        }
        const q = pose(d, s + STEP);
        if (s > 1.5) worst = Math.max(worst, Math.hypot(a.x - q.a.x, a.y - q.a.y), Math.hypot(b.x - q.b.x, b.y - q.b.y));
      }
      expect(worst).toBeLessThan(d.r * 0.6);
    }
  });

  it('knows a walker, a swimmer and a bell', () => {
    expect(styleOf('crawl', false)).toBe('walk');
    expect(styleOf('steady', true)).toBe('walk');
    expect(styleOf('bell', false)).toBe('drift');
    expect(styleOf('pulse', false)).toBe('drift');
    expect(styleOf('dart', false)).toBe('swim');
  });
});

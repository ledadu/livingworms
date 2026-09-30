import { describe, expect, it } from 'vitest';
import { floorAt } from './biomes';
import { glacierDecor, glacierSpan, makeTongue } from './glacier';

const span: [number, number] = [11400, 14600];

describe('the Glacier', () => {
  it('has no decor while the map has no glacier biome', () => {
    if (glacierSpan()) return;
    expect(glacierDecor()).toEqual([]);
  });

  it('dives: the tongue falls from high in the water, then runs on the floor down the slope', () => {
    const tg = makeTongue(span);
    const above = (i: number) => floorAt(tg.x[i], tg.z[i]) - tg.y[i];
    expect(above(0)).toBeGreaterThan(400);
    for (let i = 0; i < tg.n; i++) expect(above(i)).toBeGreaterThanOrEqual(9);
    for (let i = Math.ceil(tg.n * 0.35); i < tg.n; i++) expect(above(i)).toBeLessThan(12);
    for (let i = 1; i < tg.n; i++) expect(tg.x[i]).toBeGreaterThan(tg.x[i - 1]);
    expect(tg.x[0]).toBeGreaterThan(span[0]);
    expect(tg.x[tg.n - 1]).toBeLessThan(span[1]);
  });

  it('puts walls of ice at the back and frost needles in the glacier, none between the eye and the swimmer', () => {
    const d = glacierDecor(span);
    const ice = d.filter((q) => q.kind === 'ice'), frost = d.filter((q) => q.kind === 'frost');
    expect(ice.length).toBeGreaterThan(8);
    expect(frost.length).toBeGreaterThan(30);
    for (const q of ice) expect(q.z).toBeGreaterThanOrEqual(200);
    for (const q of frost) expect(q.z).toBeGreaterThanOrEqual(40);
    for (const q of d) { expect(q.x).toBeGreaterThan(span[0] - 200); expect(q.x).toBeLessThan(span[1] + 200); }
    expect(glacierDecor(span)).toEqual(d);
  });
});

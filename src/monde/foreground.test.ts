import { describe, expect, it } from 'vitest';
import { View } from '../engine3/view';
import { BIOMES, X0, X1, biomeMid, floorAt } from './biomes';
import { FRONT_Z, clearance, drawFront, footY, frontColour, makeFront, shapeOf, type FrontFrame, type FrontPiece } from './foreground';

const inBiome = (l: FrontPiece[], id: string) => {
  const i = BIOMES.findIndex((b) => b.id === id), a = BIOMES[i].x0 + 700, b = (BIOMES[i + 1]?.x0 ?? X1) - 700;
  return l.filter((p) => p.x > a && p.x < b);
};

describe('the dark foreground', () => {
  it('stands between the eye and the swimming plane, all along the world', () => {
    const l = makeFront();
    expect(l.length).toBeGreaterThan(40);
    for (const p of l) {
      expect(p.x).toBeGreaterThanOrEqual(X0);
      expect(p.x).toBeLessThanOrEqual(X1);
      expect(p.z).toBeGreaterThanOrEqual(FRONT_Z[0]);
      expect(p.z).toBeLessThanOrEqual(FRONT_Z[1]);
    }
    // painter's order: far first
    for (let i = 1; i < l.length; i++) expect(l[i].z).toBeLessThanOrEqual(l[i - 1].z);
  });

  it('is the same world every time', () => {
    expect(makeFront().map((p) => [p.x, p.shape])).toEqual(makeFront().map((p) => [p.x, p.shape]));
  });

  it('takes the shapes of what grows in each biome', () => {
    const l = makeFront();
    expect(inBiome(l, 'foret').some((p) => p.shape === 'kelp')).toBe(true);
    expect(inBiome(l, 'recif').some((p) => p.shape === 'coral')).toBe(true);
    expect(inBiome(l, 'nurserie').some((p) => p.shape === 'grass')).toBe(true);
    expect(shapeOf('something new')).toBe('rock');
  });

  it('thins out where the dark closes in', () => {
    const l = makeFront(), per = (id: string) => {
      const i = BIOMES.findIndex((b) => b.id === id);
      return inBiome(l, id).length / ((BIOMES[i + 1]?.x0 ?? X1) - BIOMES[i].x0 - 1400);
    };
    expect(per('fosse')).toBeLessThan(per('recif'));
    // and none where the floor has fallen out of sight
    expect(inBiome(l, 'jardin')).toEqual([]);
  });

  it('passes faster than the swimming plane', () => {
    const v = new View(), P = { x: 0, y: 0, s: 1, d: 1 };
    v.resize(1280, 800, 44);
    const shift = (z: number) => {
      v.aim(1000, 300, 900, 0.12); const a = v.project(1100, 300, z, P).x;
      v.aim(1100, 300, 900, 0.12); return v.project(1100, 300, z, P).x - a;
    };
    const z = (FRONT_Z[0] + FRONT_Z[1]) / 2;
    expect(Math.abs(shift(z))).toBeGreaterThan(Math.abs(shift(0)) * 1.8);
  });

  it('stands on its floor, or rises from under the bottom edge', () => {
    expect(footY(500, 800)).toBe(500);
    expect(footY(3000, 800)).toBeCloseTo(832);
  });

  it('keeps clear around the swimmer', () => {
    const r = 150;
    expect(clearance(0, 0, 100, 100, 50, 50, r)).toBeCloseTo(0.08);
    expect(clearance(0, 0, 100, 100, 600, 50, r)).toBe(1);
    let last = 0;
    for (let d = 0; d < 400; d += 20) { const c = clearance(0, 0, 100, 100, 100 + d, 50, r); expect(c).toBeGreaterThanOrEqual(last); last = c; }
  });

  it('is darker than the water around it', () => {
    const w = { h: 190, s: 70, l: 45 }, c = frontColour(w);
    expect(c.l).toBeLessThan(w.l / 2);
    expect(c.h).toBe(w.h);
  });

  it('draws what is in view, faded near the swimmer', () => {
    const v = new View(), P = { x: 0, y: 0, s: 1, d: 1 };
    v.resize(1280, 800, 44);
    const x = biomeMid(2), y = floorAt(x, 0) - 150;
    v.aim(x, y, 900, 0.12);
    const pieces = makeFront().filter((p) => Math.abs(p.x - x) < 3000);
    const img = { width: 10, height: 10 } as HTMLCanvasElement;
    for (const p of pieces) p.img = img;
    const frame = (px: number, alpha = 1, py = 700): FrontFrame => ({
      project: (a, b, c) => v.project(a, b, c, P), xRange: (z, m) => v.xRange(z, m), floorAt,
      W: 1280, H: 800, px, py, clear: 190, t: 0, alpha, colour: () => '#000'
    });
    const drawn: number[][] = [];
    drawFront(pieces, frame(-9999), { image: (_i, _a, _b, _c, _d, e, f, al) => drawn.push([e, f, al]) });
    expect(drawn.length).toBeGreaterThan(0);
    for (const [e, , al] of drawn) { expect(e).toBeGreaterThan(-400); expect(e).toBeLessThan(1680); expect(al).toBeCloseTo(1); }
    // the swimmer over the first piece drawn: that one fades
    const near: number[] = [];
    drawFront(pieces, frame(drawn[0][0], 1, drawn[0][1] - 5), { image: (_i, _a, _b, _c, _d, e, _f, al) => { if (e === drawn[0][0]) near.push(al); } });
    expect(near[0]).toBeLessThan(0.3);
    let n = 0;
    drawFront(pieces, frame(-9999, 0), { image: () => n++ });
    expect(n).toBe(0);
  });
});

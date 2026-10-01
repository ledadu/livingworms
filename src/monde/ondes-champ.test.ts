import { describe, expect, it } from 'vitest';
import { Champ, type Span } from './ondes-champ';

/** open water everywhere, between the surface and a floor far down */
const open: Span = () => [-1e9, 1e9];
const energy = (c: Champ) => { let e = 0; for (let k = 0; k < c.h.length; k++) e += c.h[k] * c.h[k] + (c.h[k] - c.old[k]) ** 2; return e; };

describe('the field of waves', () => {
  it('spreads a push into a ring, as fast every way', () => {
    const c = new Champ(128, 128, 10);
    c.follow(0, 0, open);
    c.push(0, 0, 30, 1);
    expect(c.at(0, 0)).toBeLessThan(-0.5);
    for (let k = 0; k < 60; k++) c.step(0.3, 1);
    // about sqrt(0.3) cell a step: some 33 cells out, along the axes as along the diagonals (cell 33 mirrors cell -34)
    const r = 335, along = Math.abs(c.at(r, 0)) + Math.abs(c.at(0, r)), diag = Math.abs(c.at(r * Math.SQRT1_2, r * Math.SQRT1_2));
    expect(along).toBeGreaterThan(0.002);
    expect(diag / (along / 2)).toBeGreaterThan(0.5);
    expect(diag / (along / 2)).toBeLessThan(2);
    // the same on both sides
    expect(c.at(r, 0)).toBeCloseTo(c.at(-r, 0), 5);
    expect(c.at(0, r)).toBeCloseTo(c.at(0, -r), 5);
    // nothing yet far beyond the front
    expect(Math.abs(c.at(560, 0))).toBeLessThan(1e-4);
  });

  it('dies down, and swallows what reaches the borders of its window', () => {
    const c = new Champ(96, 96, 10);
    c.follow(0, 0, open);
    c.push(0, 0, 30, 1);
    for (let k = 0; k < 20; k++) c.step();
    const e0 = energy(c);
    for (let k = 0; k < 400; k++) c.step();
    expect(energy(c)).toBeLessThan(e0 * 0.05);
    // a wave that reaches the right border hardly comes back by the left one (the window wraps around)
    const d = new Champ(96, 96, 10), col = (cx: number) => { let m = 0; for (let y = -200; y <= 200; y += 10) m = Math.max(m, Math.abs(d.at(cx * 10 + 5, y))); return m; };
    d.follow(0, 0, open);
    d.push(405, 0, 30, 1);
    for (let k = 0; k < 30; k++) d.step(0.3, 1);
    // 16 cells or so each way from cell 40: inward at 24, outward past 47, back in by the left at -40
    const inward = Math.max(col(23), col(24), col(25)), back = Math.max(col(-41), col(-40), col(-39));
    expect(inward).toBeGreaterThan(0.01);
    expect(back).toBeLessThan(inward * 0.25);
  });

  it('stays flat in the rock and the air', () => {
    const c = new Champ(64, 64, 10);
    // water from y = 0 down to a floor at y = 100
    c.follow(0, 40, () => [0, 100]);
    c.push(0, 50, 60, 1);
    for (let k = 0; k < 80; k++) c.step(0.3, 1);
    for (const y of [-50, -15, 115, 200]) for (const x of [-100, 0, 100]) expect(c.at(x, y)).toBe(0);
    expect(Math.abs(c.at(60, 50))).toBeGreaterThan(0);
  });

  it('is anchored in the world: the camera moves, the waves stay where they were', () => {
    const c = new Champ(64, 64, 10);
    c.follow(0, 0, open);
    c.push(30, 20, 40, 1);
    for (let k = 0; k < 10; k++) c.step();
    const here = [c.at(30, 20), c.at(80, 20), c.at(30, -40)];
    c.follow(55, -32, open);
    expect([c.at(30, 20), c.at(80, 20), c.at(30, -40)]).toEqual(here);
    // the cells that came in are clear
    expect(c.at(55 + 300, 0)).toBe(0);
    // far away: all anew
    c.follow(5000, 0, open);
    expect(c.peak).toBe(0);
    c.pack();
    expect(c.peak).toBe(0);
  });

  it('packs flat water as flat, and the slope of a dip', () => {
    const c = new Champ(32, 32, 10);
    c.follow(0, 0, open);
    c.pack();
    expect(c.data.every((v, i) => v === (i % 4 === 3 ? 255 : 128))).toBe(true);
    c.push(0, 0, 60, 0.2);
    c.pack();
    // index of the cell at world (x, y)
    const at = (x: number, y: number) => ((((Math.floor(x / 10)) % 32) + 32) % 32 + ((((Math.floor(y / 10)) % 32) + 32) % 32) * 32) * 4;
    // right of the dip the water rises to the right (slope > 0), left of it the other way
    expect(c.data[at(30, 0)]).toBeGreaterThan(128);
    expect(c.data[at(-30, 0)]).toBeLessThan(128);
    // the bottom of the dip is hollow: it curves up
    expect(c.data[at(0, 0) + 2]).toBeGreaterThan(128);
    expect(c.peak).toBeGreaterThan(0.1);
  });
});

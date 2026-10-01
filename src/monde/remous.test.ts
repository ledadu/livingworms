import { describe, expect, it } from 'vitest';
import { rng } from '../engine';
import type { Burst, Lueur } from './lueur';
import { beat, newBeat, paradeFigure, waterFigure, type Beater, type Gust } from './remous';

const BURSTS: Burst[] = ['corolle', 'spirale', 'pluie', 'lucioles', 'anneaux', 'helice', 'fontaine'];
const light = (burst: Burst, o: Partial<Lueur> = {}): Lueur => ({ hues: [330, 190], wake: 'poussiere', burst, echo: null, arms: 5, spin: 1, size: 2, pace: 1, ...o });
const inkOf = (g: Gust[]) => g.reduce((s, x) => s + (x.a ?? 0) + (x.b ?? 0), 0);
const pushOf = (g: Gust[]) => Math.max(...g.map((x) => Math.hypot(x.vx ?? 0, x.vy ?? 0)));

describe('the figure of the parade in the water', () => {
  it('stays around the dancers and within its time, in the colours of both', () => {
    for (const b of BURSTS) {
      const f = paradeFigure(light(b, { echo: 'spirale' }), 1, rng(3));
      expect(f.gusts.length).toBeGreaterThan(10);
      for (const g of f.gusts) {
        expect(Math.hypot(g.x, g.y)).toBeLessThan(260);
        expect(g.t).toBeGreaterThanOrEqual(0);
        expect(g.t).toBeLessThan(f.lasts);
      }
      expect(f.gusts.some((g) => g.a)).toBe(true);
      expect(f.gusts.some((g) => g.b)).toBe(true);
    }
  });

  it('is richer after a fine parade, never stronger', () => {
    for (const b of BURSTS) {
      const poor = waterFigure(b, light(b), 0.5, rng(5)), fine = waterFigure(b, light(b), 1.5, rng(5));
      expect(inkOf(fine.gusts)).toBeGreaterThan(inkOf(poor.gusts));
      expect(pushOf(fine.gusts)).toBeLessThanOrEqual(pushOf(poor.gusts) + 1e-9);
    }
  });

  it('turns its eddy the way the light turns', () => {
    // the sum of the turning pushes around the middle: its sign is the way the water turns
    const turn = (spin: 1 | -1) => waterFigure('spirale', light('spirale', { spin }), 1, rng(1)).gusts
      .reduce((s, g) => s + (g.x * (g.vy ?? 0) - g.y * (g.vx ?? 0)), 0);
    expect(Math.sign(turn(1))).toBe(1);
    expect(Math.sign(turn(-1))).toBe(-1);
  });

  it('sinks the light of a fountain, and the others keep it where the water takes it', () => {
    expect(waterFigure('fontaine', light('fontaine'), 1).lift).toBeLessThan(0);
    for (const b of BURSTS.filter((x) => x !== 'fontaine')) expect(waterFigure(b, light(b), 1).lift).toBe(0);
  });
});

describe('the beats of the dancers', () => {
  /** a fish swimming right, its tail sweeping up and down twice a second */
  const fish = (step: number): Beater => {
    const t = step / 60, sway = Math.sin(t * Math.PI * 4) * 8, was = Math.sin((t - 1 / 60) * Math.PI * 4) * 8;
    return { mode: 'steady', x: 100 + step, y: 0, vx: 1, vy: 0, tx: 70 + step, ty: sway, tvx: 1, tvy: sway - was, stroke: 0, size: 40 };
  };

  it('a tail sheds a puff at the end of each sweep, to each side in turn, behind the fish', () => {
    const st = newBeat(), puffs = [];
    for (let s = 0; s < 120; s++) { const g = beat(fish(s), st); if (g) puffs.push(g); }
    expect(puffs.length).toBeGreaterThanOrEqual(6);
    expect(puffs.length).toBeLessThanOrEqual(9);
    for (const g of puffs) { expect(g.vx!).toBeLessThan(0); expect(g.light).toBeGreaterThan(0); }
    const sides = puffs.map((g) => Math.sign(g.vy!));
    for (let i = 1; i < sides.length; i++) expect(sides[i]).toBe(-sides[i - 1]);
  });

  it('a bell pushes a jet behind it once a beat, and a walker at rest stirs nothing', () => {
    const st = newBeat(), jets = [];
    for (let s = 0; s < 180; s++) {
      const stroke = Math.max(0, Math.sin((s / 60) * Math.PI * 2));
      const g = beat({ mode: 'bell', x: 0, y: -s * 0.5, vx: 0, vy: -0.5, tx: 0, ty: 30 - s * 0.5, tvx: 0, tvy: -0.5, stroke, size: 50 }, st);
      if (g) jets.push(g);
    }
    expect(jets.length).toBe(3);
    // it goes up: the jet goes down, out of the bell
    for (const g of jets) expect(g.vy!).toBeGreaterThan(0);
    const still = newBeat();
    for (let s = 0; s < 120; s++) expect(beat({ mode: 'crawl', x: 0, y: 0, vx: 0, vy: 0, tx: -20, ty: 0, tvx: 0, tvy: 0, stroke: 0, size: 40 }, still)).toBeNull();
  });
});

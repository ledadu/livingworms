import { beforeAll, describe, expect, it } from 'vitest';
import { BIOMES, X1, biomeIndex, chapterIndex, floorAt, liftAt, moodAt, openFloor, span } from './biomes';
import { ceilAt } from './grotte';
import { initReliefs, solidAt } from './relief';
import { WORLD_END } from './limites';
import {
  END, NOTES, T, WELL_X, ascentPath, callTimes, carrySpeed, crown, gapFor, litAt, litMood, reached, slot, wellLight, type AscentPath
} from './remontee';

let path: AscentPath;
beforeAll(() => {
  initReliefs(BIOMES, X1, floorAt);
  path = ascentPath({ floor: floorAt, open: openFloor, lift: liftAt, ceil: ceilAt, solid: solidAt });
});

describe('the well of light', () => {
  it('stands at the bottom of the Remontée, within the world, and lights the dark around it only', () => {
    expect(biomeIndex(WELL_X)).toBe(chapterIndex('remontee'));
    expect(WELL_X).toBeLessThan(WORLD_END);
    expect(wellLight(WELL_X)).toBe(1);
    expect(wellLight(WELL_X - 700)).toBeGreaterThan(0.3);
    expect(wellLight(span('fosse')[0] + 500)).toBe(0);
  });
});

describe('the song', () => {
  it('has a note per chapter of the descent, and calls each ancestor with the note of the chapter where it gave birth', () => {
    expect(NOTES).toBe(9);
    const times = callTimes(['nurserie', 'recif', 'recif', 'fosse']);
    expect(times[0]).toBe(T.song);
    expect(times[1]).toBe(T.song + T.note);
    // the second with the same note comes a moment after the first
    expect(times[2]).toBeGreaterThan(times[1]);
    expect(times[2]).toBeLessThan(T.song + 2 * T.note);
    expect(times[3]).toBe(T.song + 8 * T.note);
    // everyone has come before the current sets off
    expect(Math.max(...callTimes(['fosse', 'fosse', 'fosse', 'remontee', 'ailleurs']))).toBeLessThan(T.rise);
  });
});

describe('the formation', () => {
  const left = { x: -1, y: 0 }, up = { x: 0, y: -1 };
  it('is a V behind the leader, one arm on each side, the older the further', () => {
    for (let k = 1; k <= 9; k++) {
      const s = slot(k, left);
      expect(s.x, `rank ${k}`).toBeGreaterThan(0);
      expect(Math.sign(s.y)).toBe(k % 2 ? -1 : 1);
    }
    expect(slot(3, left).x).toBeGreaterThan(slot(1, left).x);
    expect(Math.abs(slot(4, left).y)).toBeGreaterThan(Math.abs(slot(2, left).y));
    // going up the well, the V opens downward
    expect(slot(1, up).y).toBeGreaterThan(0);
    expect(slot(2, up).x * slot(1, up).x).toBeLessThan(0);
  });

  it('comes first as a crown around the swimmer singing in the well, the first ones above', () => {
    for (const n of [1, 2, 5, 9, 14]) {
      const pts = Array.from({ length: n }, (_, i) => crown(i + 1, n));
      if (n > 2) expect(pts[0].y, `${n}`).toBeLessThan(0);
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) expect(Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y), `${n}: ${a} ${b}`).toBeGreaterThan(50);
      for (const p of pts) expect(Math.hypot(p.x, p.y)).toBeGreaterThan(100);
    }
    expect(crown(9, 9).y).toBeGreaterThan(0);
  });

  it('keeps apart ancestors of any size', () => {
    expect(gapFor(20)).toBeGreaterThanOrEqual(58);
    expect(gapFor(400)).toBeLessThanOrEqual(120);
    for (let k = 1; k < 10; k++) for (let j = k + 1; j <= 10; j++) {
      const a = slot(k, left), b = slot(j, left);
      expect(Math.hypot(a.x - b.x, a.y - b.y), `${k} ${j}`).toBeGreaterThan(50);
    }
  });
});

describe('the way up', () => {
  it('rises from the bottom of the well to under the surface, where the first larva was born', () => {
    const n = path.x.length;
    expect(path.x[0]).toBe(WELL_X);
    expect(floorAt(WELL_X, 0) - path.y[0]).toBeLessThan(400);
    // straight up the well first
    expect(path.x[10]).toBe(WELL_X);
    expect(path.y[10]).toBeLessThan(path.y[0] - 150);
    expect(path.x[n - 1]).toBeCloseTo(END.x, -2);
    expect(path.y[n - 1]).toBeLessThan(60);
  });

  it('crosses every chapter, going up', () => {
    const at = (id: Parameters<typeof span>[0]) => { const [a, b] = span(id); const i = path.nearest({ x: (a + b) / 2, y: 0 }, 0); return path.y[i]; };
    const seen = new Set<number>();
    for (let i = 0; i < path.x.length; i++) seen.add(biomeIndex(path.x[i]));
    expect(seen.size).toBe(BIOMES.length);
    const ids = ['fosse', 'jardin', 'glacier', 'sources', 'carcasse', 'foret', 'recif', 'nurserie'] as const;
    for (let k = 1; k < ids.length; k++) expect(at(ids[k]), ids[k]).toBeLessThan(at(ids[k - 1]));
  });

  it('stays in the water: over the floor, under the vault of the Grotte, out of the reliefs', () => {
    for (let i = 0; i < path.x.length; i++) {
      const x = path.x[i], y = path.y[i];
      expect(floorAt(x, 0) - y, `floor at ${x}`).toBeGreaterThan(60);
      expect(y - ceilAt(x, 0), `vault at ${x}`).toBeGreaterThan(60);
      expect(solidAt(x, y, 0), `relief at ${x}`).toBe(false);
      expect(y).toBeGreaterThan(20);
    }
  });

  it('turns gently, with no step', () => {
    for (let i = 1; i < path.x.length; i++) expect(Math.hypot(path.x[i] - path.x[i - 1], path.y[i] - path.y[i - 1])).toBeLessThan(60);
    for (let i = 10; i < path.x.length - 10; i += 5) {
      const a = path.dir(i - 8), b = path.dir(i + 8);
      expect(a.x * b.x + a.y * b.y, `at ${path.x[i]}`).toBeGreaterThan(0.3);
    }
  });

  it('finds where a swimmer is along it, and looks ahead', () => {
    const i = path.nearest({ x: 12000, y: path.y[path.nearest({ x: 12000, y: 1200 }, 0)] + 40 }, 0);
    expect(Math.abs(path.x[i] - 12000)).toBeLessThan(40);
    expect(path.ahead(i, 400).x).toBeLessThan(path.x[i] - 250);
    // the way goes left, toward the surface
    expect(path.dir(i).x).toBeLessThan(-0.5);
    expect(path.dir(5).y).toBeLessThan(-0.9);
  });
});

describe('the current', () => {
  it('picks up, carries fast, and slows down as the surface nears', () => {
    expect(carrySpeed(0, 30000, 0)).toBe(0);
    expect(carrySpeed(3000, 30000, 1)).toBeLessThan(carrySpeed(3000, 30000, 8));
    expect(carrySpeed(15000, 30000, 30)).toBeGreaterThan(5);
    expect(carrySpeed(29990, 30000, 90)).toBeLessThan(1.5);
    expect(carrySpeed(29990, 30000, 90)).toBeGreaterThan(0.5);
  });

  it('takes about a minute and a half from the bottom to the surface', () => {
    let s = 0, t = 0;
    while (s < path.length && t < 400) { s += carrySpeed(s, path.length, t); t += 1 / 60; }
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
  });
});

describe('the chapters light up', () => {
  it('as the leader comes into each one, going up', () => {
    const fosse = chapterIndex('fosse'), recif = chapterIndex('recif');
    expect(reached(chapterIndex('remontee'), WELL_X)).toBe(true);
    expect(reached(fosse, WELL_X)).toBe(false);
    expect(reached(fosse, span('fosse')[1] + 200)).toBe(true);
    expect(reached(recif, WELL_X)).toBe(false);
    expect(reached(recif, span('recif')[1] - 10)).toBe(true);
  });

  it('with the blend of the light of the chapters', () => {
    const lit = new Float32Array(BIOMES.length);
    lit[chapterIndex('fosse')] = 1;
    expect(litAt(lit, (span('fosse')[0] + span('fosse')[1]) / 2)).toBe(1);
    const border = span('fosse')[0];
    expect(litAt(lit, border)).toBeGreaterThan(0.3);
    expect(litAt(lit, border)).toBeLessThan(0.7);
    expect(litAt(lit, span('glacier')[0] + 500)).toBe(0);
  });

  it('lifts the dark, lightens the water and brings a golden light from above', () => {
    const m = moodAt((span('fosse')[0] + span('fosse')[1]) / 2);
    expect(litMood(m, 0)).toBe(m);
    const l = litMood(m, 1);
    expect(l.dark).toBeLessThan(0.15);
    expect(l.deep.l).toBeGreaterThan(m.deep.l + 10);
    expect(l.top.l).toBeGreaterThan(m.top.l + 15);
    expect(l.rays).toBeGreaterThan(1);
    expect(Math.abs(l.sky.h - 46)).toBeLessThan(1);
    // the bright chapters stay as bright as they were
    const n = moodAt(1000), ln = litMood(n, 1);
    expect(ln.top.l).toBeGreaterThanOrEqual(n.top.l);
  });
});

import { describe, expect, it } from 'vitest';
import doc from '../../docs/chapitres.md?raw';
import { BIOMES } from './biomes';
import { APART, Farewell, GONE, ROOM, T, stayGoal, watchGoal, type Pt, type Shot } from './adieu';
import { parseChapterTexts, textsOf } from './textes';

const STEP = 1 / 60;
/** plays the scene with bodies that go where they wish (a velocity is in px per step, as in the engine) */
function play(parent: Pt, child: Pt, floor = Infinity) {
  const f = new Farewell(parent, 1, floor), shots: { s: number; shot: Shot; parent: Pt; child: Pt }[] = [];
  const p = { ...parent }, c = { ...child };
  for (let s = 0; s < 30; s += STEP) {
    const shot = f.at(s, p, c);
    if (!shot) break;
    shots.push({ s, shot, parent: { ...p }, child: { ...c } });
    p.x += shot.parent.x; p.y += shot.parent.y;
    c.x += shot.child.x; c.y += shot.child.y;
  }
  return { f, shots, parent: p, child: c };
}
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

describe("l'adieu au parent", () => {
  const run = play({ x: 1000, y: 300 }, { x: 940, y: 340 });

  it('keeps the child by the parent until it sets off', () => {
    const together = run.shots.filter((k) => k.s < T.leave);
    expect(together.length).toBeGreaterThan(100);
    for (const k of together) expect(dist(k.parent, k.child)).toBeLessThan(140);
  });

  it('then the child moves a little way off, unhurried, and the swimmer is ours again soon', () => {
    const last = run.shots[run.shots.length - 1];
    expect(last.s).toBeLessThan(T.end);
    expect(last.s).toBeLessThan(8);
    expect(dist(run.parent, run.child)).toBeGreaterThan(APART - 10);
    expect(dist(run.parent, run.child)).toBeLessThan(260);
    expect(run.child.x).toBeGreaterThan(run.parent.x + 60);
    for (const k of run.shots) expect(Math.hypot(k.shot.child.x, k.shot.child.y)).toBeLessThan(1.4);
    for (const k of run.shots.filter((k) => k.s > T.leave)) expect(Math.hypot(k.shot.child.x, k.shot.child.y)).toBeLessThanOrEqual(1);
  });

  it('the parent leans after it a little, then stays and watches it', () => {
    expect(dist(run.parent, run.f.home)).toBeLessThan(60);
    const still = run.shots.filter((k) => k.s > T.stop);
    expect(still.length).toBeGreaterThan(30);
    for (const k of still) expect(Math.hypot(k.shot.parent.x, k.shot.parent.y)).toBeLessThan(0.4);
    // but it keeps facing the child
    for (const k of still) expect(k.shot.parent.x).toBeGreaterThan(0);
  });

  it('the camera comes close on the two, then gives the view back with the child', () => {
    const first = run.shots[0], last = run.shots[run.shots.length - 1];
    const together = run.shots.find((k) => k.s > 2.2)!;
    expect(together.shot.close).toBeGreaterThan(0.95);
    expect(together.shot.span).toBeLessThan(420);
    expect(first.shot.close).toBeLessThan(0.05);
    expect(first.shot.focus.x).toBeCloseTo((first.parent.x + first.child.x) / 2, 0);
    expect(dist(last.shot.focus, last.child)).toBeLessThan(dist(last.shot.focus, last.parent));
    // the parent still in the frame when the view is given back
    expect(last.shot.span).toBeGreaterThan(dist(last.parent, last.child) + 100);
    expect(last.shot.close).toBeLessThan(0.3);
  });

  it('ends in time even when the child cannot go far (a bound)', () => {
    const f = new Farewell({ x: 0, y: 300 }, 1);
    expect(f.at(T.end - 0.1, { x: 0, y: 300 }, { x: 50, y: 300 })).not.toBeNull();
    expect(f.at(T.end, { x: 0, y: 300 }, { x: 50, y: 300 })).toBeNull();
  });

  it('never sends the child into the floor', () => {
    const f = new Farewell({ x: 0, y: 500 }, 1, 560);
    expect(f.away.y).toBeLessThanOrEqual(470);
  });
});

describe('le parent qui reste', () => {
  const home = { x: 0, y: 300 };

  it('just left, it watches its child without coming after it', () => {
    const v = watchGoal(home, { x: 300, y: 320 });
    expect(v.x).toBeGreaterThan(0);
    expect(Math.hypot(v.x, v.y)).toBeLessThan(0.4);
    expect(GONE).toBeGreaterThan(APART * 2);
  });

  it('turns to us when we come back, and comes to meet us without touching', () => {
    const v = stayGoal(home, home, { x: 400, y: 300 }, 0);
    expect(v.x).toBeGreaterThan(0.5);
    const close = stayGoal(home, home, { x: 100, y: 300 }, 0);
    expect(close.x).toBeGreaterThan(0);
    expect(Math.hypot(close.x, close.y)).toBeLessThan(0.4);
  });

  it('stops a little way from us when we stay still', () => {
    let p = { ...home }, near = Infinity;
    const us = { x: home.x + 300, y: home.y + 20 };
    for (let s = 0; s < 30; s += STEP) {
      const v = stayGoal(p, home, us, s);
      p = { x: p.x + v.x, y: p.y + v.y };
      near = Math.min(near, dist(p, us));
    }
    expect(near).toBeGreaterThanOrEqual(ROOM - 1);
    expect(dist(p, us)).toBeLessThan(160);
  });

  it('does not follow us far from where it was left', () => {
    const v = stayGoal({ x: 300, y: 300 }, home, { x: 700, y: 300 }, 0);
    expect(v.x).toBeLessThan(0);
  });

  it('drifts slowly around its place when we are away', () => {
    let p = { ...home };
    for (let s = 0; s < 120; s += STEP) {
      const v = stayGoal(p, home, { x: 5000, y: 300 }, s);
      p = { x: p.x + v.x, y: p.y + v.y };
      expect(dist(p, home)).toBeLessThan(160);
    }
  });
});

describe("les textes d'adieu", () => {
  const all = parseChapterTexts(doc);
  it('every chapter of the descent has its farewell, the Remontée none', () => {
    BIOMES.forEach((b, i) => {
      const f = textsOf(all, b.name, i)?.farewell;
      if (b.id === 'remontee') expect(f, b.name).toBeUndefined();
      else expect(f?.length, b.name).toBeGreaterThanOrEqual(2);
    });
  });
});

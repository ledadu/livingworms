import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPECIES } from '../content/species';
import { STEP, TAU, wrapAngle } from '../engine/util';
import { AFLOAT, Creature3, HALF_TURN, PITCH_MAX, crawlPitch, crawlRise, turnError, type Seg3 } from './creature3';

/** swims right until it faces right, then is told left: the z of its heading (sin of the yaw) at each step of the turn */
function turnLeft(id: string, steps = 180): { cr: Creature3; zs: number[]; jump: number } {
  const cr = new Creature3(SPECIES[id](), 0, 0, 0, { dir: { x: 1, y: 0, z: 0 } });
  for (let i = 0; i < 120; i++) cr.steer(i * STEP, 1, 0, 0, 0.1);
  const zs: number[] = [];
  let jump = 0, last = cr.yaw;
  for (let i = 0; i < steps; i++) {
    cr.steer((120 + i) * STEP, -1, 0, 0, 0.1);
    zs.push(Math.sin(cr.yaw));
    jump = Math.max(jump, Math.abs(wrapAngle(cr.yaw - last)));
    last = cr.yaw;
  }
  return { cr, zs, jump };
}

/** the side the head went through: +1 away from the eye (its back to us), -1 toward it (its face) */
const sideOf = (zs: number[]): number => Math.sign(zs.reduce((a, z) => (Math.abs(z) > Math.abs(a) ? z : a), 0));

describe('turnError', () => {
  it('is the shortest way when no half turn is under way', () => {
    expect(turnError(0.2, 0.5, 0)).toBeCloseTo(0.3);
    expect(turnError(-3, 3, 0)).toBeCloseTo(6 - TAU);
  });

  it('keeps to the way round of a half turn', () => {
    expect(turnError(0, Math.PI, 1)).toBeCloseTo(Math.PI);
    expect(turnError(0, Math.PI, -1)).toBeCloseTo(-Math.PI);
    // a jet rests in 3/4 (0.3): through its face, the half turn is the longer one
    expect(turnError(0.3, Math.PI - 0.3, 1)).toBeCloseTo(Math.PI - 0.6);
    expect(turnError(0.3, Math.PI - 0.3, -1)).toBeCloseTo(-Math.PI - 0.6);
    expect(Math.abs(turnError(0, Math.PI, -1))).toBeGreaterThan(HALF_TURN);
  });
});

describe('a half turn', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  // a fish (glide), a squid (jet), a crab (crawl)
  for (const id of ['poissonClown', 'calmar', 'crabe']) {
    it(`goes through the back or the face of ${id}, as drawn, smoothly, to face the other way`, () => {
      const sides: number[] = [];
      for (const r of [0.25, 0.75]) {
        vi.spyOn(Math, 'random').mockReturnValue(r);
        const { cr, zs, jump } = turnLeft(id);
        sides.push(sideOf(zs));
        expect(Math.max(...zs.map(Math.abs))).toBeGreaterThan(0.9);
        expect(Math.cos(cr.yaw)).toBeLessThan(-0.8);
        expect(jump).toBeLessThan(0.35);
        vi.restoreAllMocks();
      }
      expect(sides.sort()).toEqual([-1, 1]);
    });
  }

  it('goes either way, at random', () => {
    const sides = new Set<number>();
    for (let i = 0; i < 30; i++) sides.add(sideOf(turnLeft('poissonClown', 60).zs));
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it('told back early in the turn, turns back the way it came', () => {
    for (const r of [0.25, 0.75]) {
      vi.spyOn(Math, 'random').mockReturnValue(r);
      const { cr } = turnLeft('poissonClown', 3);
      const side = Math.sign(Math.sin(cr.yaw));
      let turned = 0, last = cr.yaw;
      for (let i = 0; i < 180; i++) {
        cr.steer((200 + i) * STEP, 1, 0, 0, 0.1);
        expect(Math.sign(Math.sin(cr.yaw)) || side).toBe(side);
        turned += Math.abs(wrapAngle(cr.yaw - last));
        last = cr.yaw;
      }
      expect(Math.cos(cr.yaw)).toBeGreaterThan(0.95);
      expect(turned).toBeLessThan(Math.PI);
      vi.restoreAllMocks();
    }
  });
});

/** the filaments of a jellyfish, where they leave the bell, across its axis as the eye sees it (x, y) */
function across(cr: Creature3, name: string): number[] {
  const r = cr.root, n = r.n;
  const ax = r.x[n] - r.x[0], ay = r.y[n] - r.y[0], l = Math.hypot(ax, ay) || 1;
  return r.children.filter((c: Seg3) => c.def.name === name)
    .map((c) => ((c.x[0] - r.x[n]) * -ay + (c.y[0] - r.y[n]) * ax) / l / r.rad[n]);
}

describe('the filaments of a jellyfish', () => {
  // up, right, still, then off its plane in depth and back up: every way the bell leans or last swam
  const moves: [string, number, number, number][] = [['up', 0, -0.5, 0], ['right', 1, 0, 0], ['still', 0, 0, 0], ['depth', 0.05, 0, 1], ['up again', 0, -0.5, 0], ['left', -1, 0.3, -0.5]];
  for (const id of ['meduse', 'chrysaora']) {
    it(`hang on both sides of the bell of ${id}, symmetric, whatever it did`, () => {
      const cr = new Creature3(SPECIES[id](), 0, 0, 0, { dir: { x: 1, y: 0, z: 0 } });
      let t = 0;
      for (const [, dx, dy, dz] of moves) {
        for (let i = 0; i < 200; i++) cr.steer((t++) * STEP, dx, dy, dz, 0.1);
        const u = across(cr, 'Filament').sort((a, b) => a - b), c = u.length;
        // as many on each side, mirror images of each other, as wide as the rim, none hidden behind another
        for (let k = 0; k < c; k++) expect(u[k] + u[c - 1 - k]).toBeCloseTo(0, 1);
        expect(u[c - 1]).toBeGreaterThan(0.85);
        for (let k = 1; k < c; k++) expect(u[k] - u[k - 1]).toBeGreaterThan(0.08);
      }
    });
  }
});

/** swims right a moment, then is told (dvx, dvy) for `steps` steps; `floor`: a walker stands on a floor at that height */
function swim(id: string, dvx: number, dvy: number, steps = 150, floor?: number): Creature3 {
  const cr = new Creature3(SPECIES[id](), 0, floor === undefined ? 0 : floor - 30, 0, { dir: { x: 1, y: 0, z: 0 }, phase: 0 });
  const step = (t: number, x: number, y: number) => {
    cr.steer(t * STEP, x, y, 0, 0.08);
    if (floor !== undefined) { cr.stand(floor); if (cr.root.y[0] > floor - 3) cr.root.y[0] = floor - 3; }
  };
  for (let t = 0; t < 60; t++) step(t, 1.3, floor === undefined ? 0 : 0.5);
  for (let t = 60; t < 60 + steps; t++) step(t, dvx, dvy);
  return cr;
}

describe('swimming up and down', () => {
  const head = { x: 0, y: 0, z: 0 };

  it('every animal told to go straight up or down points its head nearly that way', () => {
    for (const id of Object.keys(SPECIES)) {
      const mode = SPECIES[id]().swim.mode;
      // a bell is always upright
      if (mode === 'bell') continue;
      expect(swim(id, 0.02, -2.6).heading(head).y, `${id} up`).toBeLessThan(-0.95);
      // the octopus falls arms first (parachute), the seahorse keeps its head up
      if (id === 'poulpe' || id === 'nautile' || id === 'calmar' || id === 'seiche' || id === 'hippocampe') continue;
      expect(swim(id, 0.02, 2.6).heading(head).y, `${id} down`).toBeGreaterThan(0.95);
    }
  });

  it('a level swimmer keeps the world down as its own', () => {
    const cr = swim('poissonClown', 1.3, 0);
    expect(cr.down.y).toBeGreaterThan(0.999);
  });

  it('turns its fins with it, without a jump, all the way to the vertical', () => {
    for (const id of ['calmar', 'poissonClown', 'crevette']) {
      const cr = swim(id, 1.3, 0, 30);
      // the base of a fin, from the node it is set on: a roll of the body would move it round
      const fin = cr.list.find((s) => s.def.role === 'fin')!, p = fin.parent!, k = fin.at;
      const rel = () => [fin.x[0] - p.x[k], fin.y[0] - p.y[k], fin.z[0] - p.z[k]];
      let last = rel(), jump = 0;
      for (let t = 0; t < 150; t++) {
        cr.steer((90 + t) * STEP, 0.02, -2.6, 0, 0.08);
        const r = rel();
        jump = Math.max(jump, Math.hypot(r[0] - last[0], r[1] - last[1], r[2] - last[2]));
        last = r;
      }
      expect(cr.heading(head).y, id).toBeLessThan(-0.95);
      expect(jump, id).toBeLessThan(p.rad[k] * 0.3);
    }
  });

  it('a walker told to go up leaves the floor and swims head up, then sinks back level onto its legs', () => {
    const floor = 300;
    const cr = swim('crevette', 0.02, -2.6, 90, floor);
    expect(cr.gap).toBeGreaterThan(100);
    expect(cr.pitch).toBeLessThan(-1.3);
    for (let t = 0; t < 1200; t++) { cr.steer((200 + t) * STEP, 0, 0, 0, 0.03); cr.stand(floor); }
    expect(cr.gap).toBeLessThan(AFLOAT);
    expect(Math.abs(cr.pitch)).toBeLessThan(0.05);
  });

  it('a walker on the floor still walks level', () => {
    const cr = swim('crabe', 1.3, 0.5, 120, 300);
    expect(cr.gap).toBeLessThan(AFLOAT);
    expect(Math.abs(cr.pitch)).toBeLessThan(0.02);
  });
});

describe('crawlRise and crawlPitch', () => {
  const crawl = SPECIES.crevette().swim, octopus = SPECIES.poulpe().swim;

  it('rises when told up, dives only in open water, and otherwise sinks slowly', () => {
    expect(crawlRise(-2, 0)).toBe(-2);
    expect(crawlRise(2, 0)).toBe(0.5);
    expect(crawlRise(0, 200)).toBe(0.5);
    expect(crawlRise(2, 200)).toBe(2);
  });

  it('points the head where it swims, up to nearly straight up or down', () => {
    expect(crawlPitch(0, -2.6, 0, crawl)).toBeCloseTo(-PITCH_MAX);
    expect(crawlPitch(2, -2, 0, crawl)).toBeCloseTo(-Math.PI / 4);
    expect(crawlPitch(0, 2.6, 500, crawl)).toBeCloseTo(PITCH_MAX);
  });

  it('keeps its posture on the floor and while it sinks back, and levels out before it lands', () => {
    expect(crawlPitch(2, 0.5, 0, crawl)).toBe(0);
    expect(crawlPitch(0, 0, 300, crawl)).toBe(0);
    expect(crawlPitch(0, 2.6, AFLOAT + 60, crawl)).toBeCloseTo(PITCH_MAX / 2);
    expect(crawlPitch(0, 2.6, AFLOAT, crawl)).toBe(0);
  });

  it('leaves an animal that swims its own way (an octopus jets) with its posture', () => {
    expect(crawlPitch(0, -2.6, 0, octopus)).toBe(-0.9);
  });
});

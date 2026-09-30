import { afterEach, describe, expect, it, vi } from 'vitest';
import { SPECIES } from '../content/species';
import { STEP, TAU, wrapAngle } from '../engine/util';
import { Creature3, HALF_TURN, turnError } from './creature3';

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

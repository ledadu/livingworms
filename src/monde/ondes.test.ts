import { describe, expect, it } from 'vitest';
import { OBSTACLE } from './obstacles';
import { HAZE, RINGS, callGap, flowBox, haze, liveRings, plume, pruneRings, regions, rippleBox, ringAt, surface, type Flow, type Ring, type RingKind } from './ondes';

/** how strong a flow is at (x, y), as its fields say (Flow): along and across its band */
function strength(f: Flow, x: number, y: number): number {
  const qx = x - f.x, qy = y - f.y, a = (qx * f.ux + qy * f.uy) / f.len, b = qx * -f.uy + qy * f.ux;
  if (a < 0 || a > 1) return 0;
  const b01 = b / (f.hw * (1 + (f.widen - 1) * a)) / 2 + 0.5;
  if (b01 < 0 || b01 > 1) return 0;
  return (1 - f.fade * a) * (1 - Math.abs(f.ramp) * (1 - (f.ramp >= 0 ? b01 : 1 - b01)));
}

const ring = (kind: RingKind, t0 = 0): Ring => ({ kind, x: 0, y: 0, z: 0, t0, size: RINGS[kind].size, rgb: [1, 1, 1] });

describe('the rings of the water', () => {
  it('spread fast then slower, wider, and fade out', () => {
    for (const kind of Object.keys(RINGS) as RingKind[]) {
      const look = RINGS[kind];
      expect(ringAt(look, -0.01)).toBeNull();
      expect(ringAt(look, look.dur)).toBeNull();
      let last = ringAt(look, 0)!;
      expect(last.k).toBe(0);
      for (let k = 1; k < 20; k++) {
        const a = ringAt(look, (k / 20) * look.dur)!;
        expect(a.r).toBeGreaterThan(last.r);
        expect(a.w).toBeGreaterThan(last.w);
        if (k > 3) expect(a.r - last.r).toBeLessThan(ringAt(look, (3 / 20) * look.dur)!.r - ringAt(look, (2 / 20) * look.dur)!.r);
        last = a;
      }
      expect(last.r).toBeLessThanOrEqual(look.size);
      expect(last.r).toBeGreaterThan(look.size * 0.98);
      expect(last.k).toBeLessThan(0.02);
      // strongest early
      expect(ringAt(look, look.dur * 0.08)!.k).toBeGreaterThan(0.8);
    }
  });

  it('leave with the ring of light of a note and go further (chant-jeu.ts: 250 px in 2.4 s)', () => {
    expect(RINGS.song.size).toBeGreaterThan(250);
    expect(RINGS.song.dur).toBeGreaterThanOrEqual(2.4);
    expect(RINGS.call.size).toBeGreaterThan(RINGS.song.size * 3);
  });

  it('keeps the strongest when there are too many, and forgets those gone', () => {
    const rs = [ring('call', 0), ring('song', 0), ring('answer', 9), ring('song', 9.1), ring('light', 20)];
    const on = liveRings(rs, 9.2, 2);
    // the call has 8 s; the first song was gone long ago
    expect(rs.map((r) => r.kind)).toEqual(['answer', 'song', 'light']);
    expect(on.map((r) => r.kind).sort()).toEqual(['answer', 'song']);
    // not started yet: kept in the list, not bent
    const light = rs[2];
    expect(liveRings(rs, 9.2, 5)).not.toContain(light);
    // the answer has just risen to its full strength, the song is still rising
    expect(liveRings(rs, 9.2, 1).map((r) => r.kind)).toEqual(['answer']);
    pruneRings(rs, 30);
    expect(rs).toEqual([]);
  });
});

describe('the regions bent', () => {
  it('are clipped to the screen and the empty ones dropped', () => {
    expect(regions([{ x0: -50, y0: -10, x1: 30, y1: 40 }], 100, 80)).toEqual([{ x0: 0, y0: 0, x1: 30, y1: 40 }]);
    expect(regions([{ x0: 120, y0: 0, x1: 150, y1: 10 }, { x0: 10, y0: 10, x1: 10.2, y1: 10.2 }], 100, 80)).toEqual([{ x0: 10, y0: 10, x1: 11, y1: 11 }]);
    expect(regions([{ x0: 200, y0: 0, x1: 300, y1: 10 }], 100, 80)).toEqual([]);
  });

  it('are in device pixels, on whole pixels', () => {
    expect(regions([{ x0: 10.4, y0: 5.5, x1: 20.2, y1: 9.9 }], 400, 400, 2)).toEqual([{ x0: 20, y0: 11, x1: 41, y1: 20 }]);
  });

  it('merge until none touch, each effect lying whole in one', () => {
    const a = { x0: 0, y0: 0, x1: 10, y1: 10 }, b = { x0: 30, y0: 0, x1: 40, y1: 10 }, c = { x0: 8, y0: 5, x1: 32, y1: 8 }, far = { x0: 60, y0: 60, x1: 70, y1: 70 };
    const out = regions([a, b, far, c], 1000, 1000);
    expect(out).toHaveLength(2);
    expect(out).toContainEqual({ x0: 0, y0: 0, x1: 40, y1: 10 });
    expect(out).toContainEqual(far);
    // a merge that grows into one already passed
    const d = { x0: 0, y0: 50, x1: 5, y1: 55 }, e = { x0: 100, y0: 0, x1: 110, y1: 10 }, f = { x0: 4, y0: 0, x1: 101, y1: 51 };
    expect(regions([d, e, f], 1000, 1000)).toEqual([{ x0: 0, y0: 0, x1: 110, y1: 55 }]);
  });

  it('become the whole screen past a share of it', () => {
    expect(regions([{ x0: 0, y0: 0, x1: 80, y1: 80 }], 100, 100)).toEqual([{ x0: 0, y0: 0, x1: 100, y1: 100 }]);
    expect(regions([{ x0: 0, y0: 0, x1: 50, y1: 50 }], 100, 100)).toEqual([{ x0: 0, y0: 0, x1: 50, y1: 50 }]);
  });

  it('hold what a ripple or a flow moves', () => {
    const p = { x: 100, y: 50, r: 40, w: 10, amp: 6, crests: 2, glint: 0, shade: 0, rgb: [1, 1, 1] }, b = rippleBox(p);
    expect(b.x0).toBeLessThanOrEqual(100 - 40 - 2.4 * 10 - 6);
    expect(b.y1).toBeGreaterThanOrEqual(50 + 40 + 2.4 * 10 + 6);
    const f = plume(200, 300, 1, 0), fb = flowBox(f);
    expect(fb.y1).toBeGreaterThanOrEqual(300 + 10);
    expect(fb.y0).toBeLessThanOrEqual(300 + 10 - f.len);
    expect(fb.x1 - fb.x0).toBeGreaterThanOrEqual(2 * f.hw * f.widen);
  });
});

describe('what shimmers', () => {
  it('the hot water rises over a chimney, wider and fainter as it goes', () => {
    const f = plume(200, 300, 1, 0);
    expect(f.uy).toBe(-1);
    expect(f.widen).toBeGreaterThan(1);
    expect(strength(f, 200, 300)).toBeGreaterThan(strength(f, 200, 300 - f.len * 0.8));
    expect(strength(f, 200, 320)).toBe(0);
    // farther, smaller on the screen
    const far = plume(200, 300, 0.5, 0);
    expect(far.amp).toBeCloseTo(f.amp / 2);
    expect(far.len).toBeCloseTo(f.len / 2);
  });

  it('the obstacles bend strongest at their gate, the way their water goes', () => {
    const x0 = 100, x1 = 900, h = 600, at = (f: Flow, x: number) => strength(f, x, h / 2);
    const heat = haze('heat', x0, x1, h, 1, 1), cold = haze('cold', x0, x1, h, 1, 1), cur = haze('current', x0, x1, h, 1, 1);
    expect(heat.uy).toBeLessThan(0);
    expect(cold.uy).toBeGreaterThan(0);
    expect(cur.ux).toBeLessThan(0);
    for (const f of [heat, cold, cur]) {
      expect(at(f, 850)).toBeGreaterThan(at(f, 200));
      expect(at(f, 1000)).toBe(0);
      // the whole height of the screen
      expect(strength(f, 850, 5)).toBeGreaterThan(0);
      expect(strength(f, 850, h - 5)).toBeGreaterThan(0);
    }
    // the burning water shimmers faster and finer than the freezing water
    expect(heat.speed).toBeGreaterThan(cold.speed);
    expect(heat.lambda).toBeLessThan(cold.lambda);
    expect(haze('heat', x0, x1, h, 1, 0.5).amp).toBeCloseTo(heat.amp / 2);
  });

  it('only obstacles that push or slow have water that bends', () => {
    for (const c of Object.keys(HAZE)) expect(OBSTACLE[c as keyof typeof OBSTACLE]?.hold).not.toBe('hide');
  });

  it('the surface overhead, across the screen, strongest at the top', () => {
    const f = surface(200, 800);
    expect(strength(f, 400, 0)).toBeGreaterThan(strength(f, 400, 180));
    expect(strength(f, 1, 50)).toBeGreaterThan(0);
    expect(strength(f, 799, 50)).toBeGreaterThan(0);
    expect(strength(f, 400, 230)).toBe(0);
  });
});

describe('the cries far away', () => {
  it('come now and then, at a pace of their own', () => {
    const gaps = Array.from({ length: 20 }, (_, k) => callGap(3, k));
    for (const g of gaps) { expect(g).toBeGreaterThanOrEqual(30); expect(g).toBeLessThan(75); }
    expect(new Set(gaps.map((g) => Math.round(g))).size).toBeGreaterThan(10);
    expect(callGap(3, 4)).toBe(gaps[4]);
    expect(callGap(4, 4)).not.toBe(gaps[4]);
  });
});

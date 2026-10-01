import { describe, expect, it } from 'vitest';
import { CELL, Fluid, INK_MAX, INK_PEAK, NX, NY, inkPixels } from './fluide';

const patch = () => { const f = new Fluid(); f.place(0, 0); return f; };
const steps = (f: Fluid, n: number) => { for (let i = 0; i < n; i++) f.step(); };
/** the largest divergence and the largest speed over the patch (cells per step) */
function measure(f: Fluid) {
  let div = 0, speed = 0;
  for (let j = 2; j < f.ny; j++) for (let i = 2; i < f.nx; i++) {
    div = Math.max(div, Math.abs(f.divergence(i, j)));
    const k = i + (f.nx + 2) * j;
    speed = Math.max(speed, Math.hypot(f.u[k], f.v[k]));
  }
  return { div, speed };
}
/** where the ink is, on average (world) */
function centroid(f: Fluid) {
  let x = 0, y = 0, m = 0;
  for (let j = 1; j <= f.ny; j++) for (let i = 1; i <= f.nx; i++) {
    const k = i + (f.nx + 2) * j, q = f.a[k] + f.b[k];
    x += q * (f.x0 + (i - 0.5) * f.h); y += q * (f.y0 + (j - 0.5) * f.h); m += q;
  }
  return { x: x / m, y: y / m, m };
}

describe('the water of the parade', () => {
  it('is a patch of about 700 × 440 around where it is placed, asleep and dark', () => {
    const f = patch();
    expect(f.width).toBe(NX * CELL);
    expect(f.height).toBe(NY * CELL);
    expect(f.centre).toEqual({ x: 0, y: 0 });
    expect(f.awake).toBe(false);
    expect(f.flow(0, 0)).toEqual({ x: 0, y: 0 });
    f.step();
    expect(f.awake).toBe(false);
  });

  it('goes the way it is pushed, and nowhere outside the patch', () => {
    const f = patch();
    f.push(0, 0, 3, 0, 30);
    f.step();
    const v = f.flow(0, 0);
    expect(v.x).toBeGreaterThan(0.5);
    expect(Math.abs(v.y)).toBeLessThan(v.x * 0.3);
    expect(f.flow(f.x0 - 10, 0)).toEqual({ x: 0, y: 0 });
  });

  it('neither piles up nor empties: what is pushed swirls back around', () => {
    const f = patch();
    f.push(0, 0, 4, 0, 25);
    const before = measure(f);
    steps(f, 3);
    const after = measure(f);
    expect(after.div).toBeLessThan(before.div * 0.2);
    // a jet makes two eddies that turn opposite ways, one on each side
    steps(f, 30);
    let above = 0, below = 0;
    for (let i = 1; i <= f.nx; i++) for (let j = 1; j <= f.ny; j++) {
      const s = f.spin(i, j), y = f.y0 + (j - 0.5) * f.h;
      if (y < -8) above += s; else if (y > 8) below += s;
    }
    expect(Math.sign(above)).toBe(-Math.sign(below));
    expect(Math.abs(above)).toBeGreaterThan(0.01);
  });

  it('carries its ink along, and the ink fades and the water falls asleep', () => {
    const f = patch();
    f.ink(-100, 0, 1, 0, 20);
    const c0 = centroid(f);
    // a stream along the middle of the patch, as a swimmer's wake
    for (let i = 0; i < 40; i++) { for (let x = -180; x <= 60; x += 30) f.push(x, 0, 2.5, 0, 24); f.step(); }
    const c1 = centroid(f);
    expect(c1.x).toBeGreaterThan(c0.x + 40);
    expect(Math.abs(c1.y - c0.y)).toBeLessThan(20);
    steps(f, 300);
    expect(centroid(f).m).toBeLessThan(c0.m * 0.5);
    steps(f, 1500);
    expect(f.awake).toBe(false);
    expect(f.inkAt(c1.x, c1.y)).toEqual({ a: 0, b: 0 });
  });

  it('a body draws the water to its own speed, never faster', () => {
    const f = patch();
    for (let i = 0; i < 30; i++) f.stir(0, 0, 2, 0, 12, 0.5);
    expect(f.flow(0, 0).x).toBeLessThanOrEqual(2.0001);
    expect(f.flow(0, 0).x).toBeGreaterThan(1.5);
    // the stir it takes to change a still water, and none once the water goes its way
    const g = patch();
    expect(g.stir(0, 0, 3, 0, 12, 0.5)).toBeGreaterThan(0.3);
    const again = g.stir(0, 0, 3, 0, 12, 1);
    for (let i = 0; i < 5; i++) g.stir(0, 0, 3, 0, 12, 1);
    expect(g.stir(0, 0, 3, 0, 12, 1)).toBeLessThan(again * 0.05 + 1e-6);
  });

  it('light rises when it is told to, and sinks the other way', () => {
    for (const lift of [0.004, -0.004]) {
      const f = patch();
      f.lift = lift;
      f.ink(0, 0, 1, 1, 20);
      const c0 = centroid(f);
      steps(f, 60);
      expect((c0.y - centroid(f).y) * Math.sign(lift)).toBeGreaterThan(10);
    }
    // placing it again calms it all, the lift too
    const g = patch();
    g.lift = 0.004;
    g.place(0, 0);
    expect(g.lift).toBe(0);
  });

  it('never runs wild, however hard it is stirred', () => {
    const f = patch();
    let s = 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 400; i++) {
      f.push((rnd() - 0.5) * 600, (rnd() - 0.5) * 360, (rnd() - 0.5) * 12, (rnd() - 0.5) * 12, 10 + rnd() * 40);
      f.ink((rnd() - 0.5) * 600, (rnd() - 0.5) * 360, rnd() * 3, rnd() * 3, 20);
      f.step();
    }
    const { speed } = measure(f);
    expect(Number.isFinite(speed)).toBe(true);
    expect(speed).toBeLessThan(6);
    for (let k = 0; k < f.a.length; k++) {
      expect(f.a[k]).toBeLessThanOrEqual(INK_MAX + 1e-6);
      expect(f.b[k]).toBeLessThanOrEqual(INK_MAX + 1e-6);
    }
  });
});

describe('the inks as they show', () => {
  it('mix their colours where they meet, never beyond INK_PEAK, and fade to nothing at the edge', () => {
    for (const up of [1, 2]) {
      const f = patch();
      f.ink(-60, 0, 1.5, 0, 40);
      f.ink(60, 0, 0, 1.5, 40);
      f.ink(0, 0, 1.5, 1.5, 30);
      for (let i = 0; i < 30; i++) f.ink(f.x0 + 2, 0, 1.5, 1.5, 30);
      const W = f.nx * up, H = f.ny * up, px = new Uint8ClampedArray(W * H * 4);
      const top = inkPixels(f, [1, 0, 0], [0, 0, 1], 3, px, up);
      expect(top).toBeLessThanOrEqual(INK_PEAK + 1e-6);
      expect(top).toBeGreaterThan(INK_PEAK * 0.8);
      let max = 0;
      for (let k = 3; k < px.length; k += 4) max = Math.max(max, px[k]);
      expect(max).toBeLessThanOrEqual(Math.ceil(INK_PEAK * 255));
      const pixel = (x: number, y: number) => {
        const i = Math.floor(((x - f.x0) / f.h) * up), j = Math.floor(((y - f.y0) / f.h) * up), o = (j * W + i) * 4;
        return [px[o], px[o + 1], px[o + 2], px[o + 3]];
      };
      const [r1, , b1] = pixel(-60, 0), [r2, , b2] = pixel(60, 0), [r3, , b3] = pixel(0, 0);
      expect(r1).toBeGreaterThan(b1);
      expect(b2).toBeGreaterThan(r2);
      expect(Math.abs(r3 - b3)).toBeLessThan(60);
      // the outermost pixels never show, the ink poured there is only a glimmer further in
      for (let j = 0; j < H; j++) expect(px[(j * W) * 4 + 3]).toBe(0);
    }
    // no ink, nothing
    const g = patch(), empty = new Uint8ClampedArray(g.nx * g.ny * 16);
    expect(inkPixels(g, [1, 1, 1], [1, 1, 1], 1, empty, 2)).toBe(0);
  });
});

describe('the water at half pace', () => {
  it('goes as far in one step of two as in two steps of one', () => {
    const one = patch(), two = patch();
    for (const f of [one, two]) { f.ink(-100, 0, 1, 0, 16); }
    // a stream a moment, then the water coasts
    for (let i = 0; i < 60; i++) {
      if (i < 16) for (const f of [one, two]) for (let x = -180; x <= 60; x += 30) f.push(x, 0, 0.5, 0, 24);
      one.step();
      if (i % 2) two.step(2);
    }
    const a = centroid(one), b = centroid(two);
    expect(Math.abs(a.x - b.x)).toBeLessThan(12);
    expect(b.m / a.m).toBeGreaterThan(0.8);
    expect(b.m / a.m).toBeLessThan(1.25);
  });
});

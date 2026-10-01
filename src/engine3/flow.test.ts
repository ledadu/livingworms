import { describe, expect, it } from 'vitest';
import { SPECIES } from '../content/species';
import { STEP, rng } from '../engine/util';
import { Creature3 } from './creature3';
import { Flow, type FlowOptions } from './flow';

/** the water as it was first written (a map of cells, every node of every body looked at): what Flow must still do */
class Reference {
  private cells = new Map<number, { x: number; y: number; vx: number; vy: number; r: number; owner: Creature3 | null }[]>();
  constructor(private cell = 32) {}
  private key(cx: number, cy: number): number { return cx * 100003 + cy; }
  add(cr: Creature3): void {
    for (const s of cr.list) {
      if (s.cut) continue;
      const step = s.n > 12 ? 2 : 1;
      for (let i = 0; i <= s.n; i += step) {
        const e = { x: s.x[i], y: s.y[i], vx: s.x[i] - s.ox[i], vy: s.y[i] - s.oy[i], r: s.rad[i] * (1 + s.pulse) + (step > 1 ? s.len * 0.5 : 0), owner: cr };
        const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
        const b = this.cells.get(k);
        if (b) b.push(e); else this.cells.set(k, [e]);
      }
    }
  }
  apply(cr: Creature3, o: FlowOptions): void {
    const c = this.cell, body = o.body || 0, reachW = o.reach || 14;
    for (const s of cr.list) {
      if (s.cut) continue;
      for (let i = 1; i <= s.n; i++) {
        const x = s.x[i], y = s.y[i], r = s.rad[i], cx = Math.floor(x / c), cy = Math.floor(y / c);
        let W = 0, wvx = 0, wvy = 0, px = 0, py = 0;
        for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
          for (const e of this.cells.get(this.key(gx, gy)) ?? []) {
            if (e.owner === cr) continue;
            const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy, reach = e.r + r + reachW;
            if (d2 > reach * reach) continue;
            const d = Math.sqrt(d2) || 0.001, f = 1 - d / reach;
            W += f; wvx += e.vx * f; wvy += e.vy * f;
            const over = e.r + r - d;
            if (over > 0) { px += (dx / d) * over; py += (dy / d) * over; }
          }
        }
        if (!W) continue;
        const vx = x - s.ox[i], vy = y - s.oy[i], k = o.wake * Math.min(1, W);
        let mx = (wvx / W - vx) * k, my = (wvy / W - vy) * k;
        const pm = Math.sqrt(px * px + py * py), cap = r + 2;
        if (pm > cap) { px *= cap / pm; py *= cap / pm; }
        mx += px * o.push; my += py * o.push;
        if (body && s.depth === 0 && pm) { cr.vx += px * body; cr.vy += py * body; }
        s.x[i] = x + mx; s.y[i] = y + my;
      }
    }
  }
}

/** a little crowd: some bodies tangled together, some alone, some far away (beyond the wrap of the grid) */
function crowd(): Creature3[] {
  const R = rng(7), ids = ['crevette', 'meduse', 'poulpe', 'crabe', 'anguille'];
  const at = [[0, 0], [30, 10], [55, -20], [400, 0], [800, 300], [4096 + 20, 10], [-4096 - 10, 0], [20, 4096 + 15]];
  const crs = at.map(([x, y], k) => new Creature3(SPECIES[ids[k % ids.length]](), x, y, 0, { dir: { x: 1, y: 0, z: 0 }, phase: k, scale: 1 }));
  for (let i = 0; i < 40; i++) crs.forEach((c, k) => c.steer(i * STEP, Math.sin(k + i * 0.1) * 1.5 + (R() - 0.5), Math.cos(k) * 0.8, 0, 0.1));
  return crs;
}

type Snap = { xs: Float64Array[]; v: number[] };
const snap = (crs: Creature3[]): Snap => ({
  xs: crs.flatMap((c) => c.list.flatMap((s) => [Float64Array.from(s.x), Float64Array.from(s.y), Float64Array.from(s.ox), Float64Array.from(s.oy)])),
  v: crs.flatMap((c) => [c.vx, c.vy])
});
function restore(crs: Creature3[], sn: Snap): void {
  let k = 0;
  for (const c of crs) for (const s of c.list) { s.x.set(sn.xs[k++]); s.y.set(sn.xs[k++]); s.ox.set(sn.xs[k++]); s.oy.set(sn.xs[k++]); }
  crs.forEach((c, i) => { c.vx = sn.v[i * 2]; c.vy = sn.v[i * 2 + 1]; });
}

describe('the water between the bodies', () => {
  it('pushes and drags every node as the first map of cells did', () => {
    const crs = crowd(), before = snap(crs), o = { push: 0.3, wake: 0.02, body: 0.01 };
    const ref = new Reference(32);
    for (const c of crs) ref.add(c);
    for (const c of crs) ref.apply(c, o);
    const want = snap(crs);
    restore(crs, before);
    const flow = new Flow(32);
    // twice: the second time reuses the grid of the first
    for (let pass = 0; pass < 2; pass++) {
      restore(crs, before);
      flow.clear();
      for (const c of crs) flow.add(c);
      for (const c of crs) flow.apply(c, o);
    }
    const got = snap(crs);
    let moved = 0;
    want.xs.forEach((a, k) => a.forEach((v, i) => { if (v !== before.xs[k][i]) moved++; }));
    expect(moved).toBeGreaterThan(0);
    for (let k = 0; k < want.xs.length; k++) expect(Array.from(got.xs[k])).toEqual(Array.from(want.xs[k]));
    expect(got.v).toEqual(want.v);
  });

  it('leaves a body alone when nothing is within reach', () => {
    const [a] = crowd(), flow = new Flow(32), x = Float64Array.from(a.root.x);
    flow.add(a);
    flow.addPoint(a.box[3] + 400, a.root.y[0], 3, 0, 5);
    flow.apply(a, { push: 0.3, wake: 0.5 });
    expect(Array.from(a.root.x)).toEqual(Array.from(x));
    flow.addPoint(a.root.x[3], a.root.y[3], 3, 0, 5);
    flow.apply(a, { push: 0.3, wake: 0.5 });
    expect(Array.from(a.root.x)).not.toEqual(Array.from(x));
  });
});

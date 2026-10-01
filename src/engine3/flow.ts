// Water: bodies push the water and each other.
// Every moving node leaves a wake (nearby nodes are dragged along with its
// speed) and pushes away what it touches. Nodes are sorted in a grid so only
// neighbours are compared.
//
// The grid is flat (typed arrays, sorted by cell once after the nodes are
// added): no allocation and no hashing per frame. It wraps every SIDE cells,
// so cells that far apart share a bucket; their nodes are out of reach of each
// other and are skipped by the distance test, as the nodes of the other
// neighbouring cells are. Each body (or point) added keeps its bounding box:
// a body out of reach of every other one is left alone at once, and within one
// only its nodes that may touch another are looked at.

import { len2 } from '../engine/util';
import type { Creature3 } from './creature3';

export interface FlowOptions {
  /** contact strength */
  push: number;
  /** how much the water drags along */
  wake: number;
  /** how much contacts on the trunk move the whole creature */
  body?: number;
  /** wake range beyond contact */
  reach?: number;
}

/** buckets along each axis (a power of two): the grid repeats every SIDE × cell px */
const BITS = 7, SIDE = 1 << BITS, MASK = SIDE - 1;

export class Flow {
  cell: number;
  private n = 0;
  private ex = new Float64Array(256); private ey = new Float64Array(256);
  private evx = new Float64Array(256); private evy = new Float64Array(256);
  private er = new Float64Array(256);
  private bucket = new Int32Array(256);
  private owner: (Creature3 | null)[] = [];
  /** the entries sorted by bucket (in the order they were added within one), and where each bucket starts */
  private order = new Int32Array(256);
  private start = new Int32Array(SIDE * SIDE + 1);
  private sorted = true;
  /** per body (or point) added: its owner, and the box of its entries widened by their largest radius (x0 y0 x1 y1) */
  private bodies: (Creature3 | null)[] = [];
  private boxes = new Float64Array(64);
  private nb = 0;
  /** the boxes of the bodies within reach of the one being applied, widened by its reach */
  private near = new Float64Array(64);

  constructor(cell = 32) { this.cell = cell; }

  clear(): void {
    this.n = 0;
    this.nb = 0;
    this.sorted = false;
  }

  private entry(x: number, y: number, vx: number, vy: number, r: number, owner: Creature3 | null): void {
    if (this.n === this.ex.length) this.grow();
    const i = this.n++;
    this.ex[i] = x; this.ey[i] = y; this.evx[i] = vx; this.evy[i] = vy; this.er[i] = r; this.owner[i] = owner;
    this.bucket[i] = (Math.floor(x / this.cell) & MASK) | ((Math.floor(y / this.cell) & MASK) << BITS);
    this.sorted = false;
  }

  private grow(): void {
    const m = this.ex.length * 2;
    const f = (a: Float64Array) => { const b = new Float64Array(m); b.set(a); return b; };
    this.ex = f(this.ex); this.ey = f(this.ey); this.evx = f(this.evx); this.evy = f(this.evy); this.er = f(this.er);
    const b = new Int32Array(m); b.set(this.bucket); this.bucket = b;
    this.order = new Int32Array(m);
  }

  /** counting sort of the entries by bucket (stable) */
  private sort(): void {
    const st = this.start, bk = this.bucket, ord = this.order, n = this.n;
    st.fill(0);
    for (let i = 0; i < n; i++) st[bk[i] + 1]++;
    for (let b = 0; b < SIDE * SIDE; b++) st[b + 1] += st[b];
    // st[b] is where bucket b starts: used as a cursor while filling, then shifted back
    for (let i = 0; i < n; i++) ord[st[bk[i]]++] = i;
    for (let b = SIDE * SIDE; b > 0; b--) st[b] = st[b - 1];
    st[0] = 0;
    this.sorted = true;
  }

  /** the box of the entries from `from` on, as one more body */
  private body(owner: Creature3 | null, from: number): void {
    if (from === this.n) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, rm = 0;
    for (let i = from; i < this.n; i++) {
      const x = this.ex[i], y = this.ey[i];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (this.er[i] > rm) rm = this.er[i];
    }
    if (this.nb * 4 === this.boxes.length) { const b = new Float64Array(this.boxes.length * 2); b.set(this.boxes); this.boxes = b; }
    const k = this.nb * 4;
    this.boxes[k] = x0 - rm; this.boxes[k + 1] = y0 - rm; this.boxes[k + 2] = x1 + rm; this.boxes[k + 3] = y1 + rm;
    this.bodies[this.nb++] = owner;
  }

  add(cr: Creature3): void {
    const from = this.n;
    for (const s of cr.list) {
      if (s.cut) continue;
      const step = s.n > 12 ? 2 : 1;
      for (let i = 0; i <= s.n; i += step) {
        this.entry(s.x[i], s.y[i], s.x[i] - s.ox[i], s.y[i] - s.oy[i], s.rad[i] * (1 + s.pulse) + (step > 1 ? s.len * 0.5 : 0), cr);
      }
    }
    this.body(cr, from);
  }

  /** a moving point that is not a creature (ambient fish, a hand…) */
  addPoint(x: number, y: number, vx: number, vy: number, r: number): void {
    const from = this.n;
    this.entry(x, y, vx, vy, r, null);
    this.body(null, from);
  }

  /**
   * The boxes of the other bodies that some node of cr may reach (each widened
   * by cr's largest radius and the reach of the wake), into `near`; their count.
   */
  private reachable(cr: Creature3, reachW: number): number {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, rm = 0;
    for (const s of cr.list) {
      if (s.cut) continue;
      for (let i = 1; i <= s.n; i++) {
        const x = s.x[i], y = s.y[i];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (s.rad[i] > rm) rm = s.rad[i];
      }
    }
    const pad = rm + reachW, bx = this.boxes;
    let k = 0;
    for (let b = 0; b < this.nb; b++) {
      if (this.bodies[b] === cr) continue;
      const q = b * 4, a0 = bx[q] - pad, b0 = bx[q + 1] - pad, a1 = bx[q + 2] + pad, b1 = bx[q + 3] + pad;
      if (a0 > x1 || a1 < x0 || b0 > y1 || b1 < y0) continue;
      if (k * 4 === this.near.length) { const nn = new Float64Array(this.near.length * 2); nn.set(this.near); this.near = nn; }
      this.near[k * 4] = a0; this.near[k * 4 + 1] = b0; this.near[k * 4 + 2] = a1; this.near[k * 4 + 3] = b1;
      k++;
    }
    return k;
  }

  /**
   * The wake is a weighted average of the neighbours' speeds (never a sum, or
   * a school crossing kelp would add up dozens of pushes), and the contact
   * correction is capped: nothing can gain energy from the water.
   */
  apply(cr: Creature3, o: FlowOptions): void {
    if (!this.n) return;
    const c = this.cell, push = o.push, wake = o.wake, body = o.body || 0, reachW = o.reach || 14;
    // nothing within reach: the water leaves it alone (the test below would find nothing either)
    const nk = this.reachable(cr, reachW);
    if (!nk) return;
    if (!this.sorted) this.sort();
    const ex = this.ex, ey = this.ey, evx = this.evx, evy = this.evy, er = this.er, owner = this.owner, ord = this.order, st = this.start, nr = this.near;
    for (const s of cr.list) {
      if (s.cut) continue;
      for (let i = 1; i <= s.n; i++) {
        const x = s.x[i], y = s.y[i], r = s.rad[i];
        let close = false;
        for (let q = 0; q < nk * 4 && !close; q += 4) close = x >= nr[q] && x <= nr[q + 2] && y >= nr[q + 1] && y <= nr[q + 3];
        if (!close) continue;
        const cx = Math.floor(x / c), cy = Math.floor(y / c);
        let W = 0, wvx = 0, wvy = 0, px = 0, py = 0;
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          const bx = gx & MASK;
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            const b = bx | ((gy & MASK) << BITS);
            for (let q = st[b], qe = st[b + 1]; q < qe; q++) {
              const e = ord[q];
              if (owner[e] === cr) continue;
              const dx = x - ex[e], dy = y - ey[e], d2 = dx * dx + dy * dy, reach = er[e] + r + reachW;
              if (d2 > reach * reach) continue;
              const d = Math.sqrt(d2) || 0.001, f = 1 - d / reach;
              W += f; wvx += evx[e] * f; wvy += evy[e] * f;
              const over = er[e] + r - d;
              if (over > 0) { px += (dx / d) * over; py += (dy / d) * over; }
            }
          }
        }
        if (!W) continue;
        const vx = x - s.ox[i], vy = y - s.oy[i], k = wake * Math.min(1, W);
        let mx = (wvx / W - vx) * k, my = (wvy / W - vy) * k;
        const pm = len2(px, py), cap = r + 2;
        if (pm > cap) { px *= cap / pm; py *= cap / pm; }
        mx += px * push; my += py * push;
        if (body && s.depth === 0 && pm) { cr.vx += px * body; cr.vy += py * body; }
        s.x[i] = x + mx; s.y[i] = y + my;
      }
    }
  }
}

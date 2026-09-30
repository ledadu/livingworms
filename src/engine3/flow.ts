// Water: bodies push the water and each other.
// Every moving node leaves a wake (nearby nodes are dragged along with its
// speed) and pushes away what it touches. Nodes are sorted in a grid so only
// neighbours are compared.

import type { Creature3 } from './creature3';

interface Entry { x: number; y: number; vx: number; vy: number; r: number; owner: Creature3 | null; }

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

export class Flow {
  cell: number;
  private cells = new Map<number, Entry[]>();
  private pool: Entry[] = [];
  private used = 0;

  constructor(cell = 32) { this.cell = cell; }

  clear(): void {
    this.cells.clear();
    this.used = 0;
  }

  private key(cx: number, cy: number): number { return (cx * 73856093) ^ (cy * 19349663); }

  private entry(): Entry {
    let e = this.pool[this.used];
    if (!e) { e = { x: 0, y: 0, vx: 0, vy: 0, r: 0, owner: null }; this.pool[this.used] = e; }
    this.used++;
    return e;
  }

  private insert(e: Entry): void {
    const k = this.key(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell));
    let b = this.cells.get(k);
    if (!b) { b = []; this.cells.set(k, b); }
    b.push(e);
  }

  add(cr: Creature3): void {
    for (const s of cr.list) {
      if (s.cut) continue;
      const step = s.n > 12 ? 2 : 1;
      for (let i = 0; i <= s.n; i += step) {
        const e = this.entry();
        e.x = s.x[i]; e.y = s.y[i];
        e.vx = s.x[i] - s.ox[i]; e.vy = s.y[i] - s.oy[i];
        e.r = s.rad[i] * (1 + s.pulse) + (step > 1 ? s.len * 0.5 : 0);
        e.owner = cr;
        this.insert(e);
      }
    }
  }

  /** a moving point that is not a creature (ambient fish, a hand…) */
  addPoint(x: number, y: number, vx: number, vy: number, r: number): void {
    const e = this.entry();
    e.x = x; e.y = y; e.vx = vx; e.vy = vy; e.r = r; e.owner = null;
    this.insert(e);
  }

  /**
   * The wake is a weighted average of the neighbours' speeds (never a sum, or
   * a school crossing kelp would add up dozens of pushes), and the contact
   * correction is capped: nothing can gain energy from the water.
   */
  apply(cr: Creature3, o: FlowOptions): void {
    const c = this.cell, push = o.push, wake = o.wake, body = o.body || 0, reachW = o.reach || 14;
    for (const s of cr.list) {
      if (s.cut) continue;
      for (let i = 1; i <= s.n; i++) {
        const x = s.x[i], y = s.y[i], r = s.rad[i];
        const cx = Math.floor(x / c), cy = Math.floor(y / c);
        let W = 0, wvx = 0, wvy = 0, px = 0, py = 0;
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            const b = this.cells.get(this.key(gx, gy));
            if (!b) continue;
            for (const e of b) {
              if (e.owner === cr) continue;
              const dx = x - e.x, dy = y - e.y, d2 = dx * dx + dy * dy, reach = e.r + r + reachW;
              if (d2 > reach * reach) continue;
              const d = Math.sqrt(d2) || 0.001, f = 1 - d / reach;
              W += f; wvx += e.vx * f; wvy += e.vy * f;
              const over = e.r + r - d;
              if (over > 0) { px += (dx / d) * over; py += (dy / d) * over; }
            }
          }
        }
        if (!W) continue;
        const vx = x - s.ox[i], vy = y - s.oy[i], k = wake * Math.min(1, W);
        let mx = (wvx / W - vx) * k, my = (wvy / W - vy) * k;
        const pm = Math.hypot(px, py), cap = r + 2;
        if (pm > cap) { px *= cap / pm; py *= cap / pm; }
        mx += px * push; my += py * push;
        if (body && s.depth === 0 && pm) { cr.vx += px * body; cr.vy += py * body; }
        s.x[i] = x + mx; s.y[i] = y + my;
      }
    }
  }
}

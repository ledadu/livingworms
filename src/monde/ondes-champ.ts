// The field of waves (an experiment: ?ondes=champ, or the panel with ?dev): the wave equation on a grid laid on the
// swimming plane around the swimmer. The animals swimming in the plane stir it, the song drops a wave into it; the
// waves cross, add up, die down, and bounce off the floor and the surface. The grid is anchored in the world (a wave
// stays where it was made when the camera moves) and wraps around: a column that leaves the window on one side comes
// back, cleared, on the other. The lens (ondes-gl.ts) reads its slope and its curvature, packed in bytes.

const mod = (v: number, n: number) => ((v % n) + n) % n;

/** the open water of a column at x: from its top (surface, or a vault) to its floor (world px) */
export type Span = (x: number) => [number, number];

export class Champ {
  readonly nx: number; readonly ny: number; readonly cell: number;
  /** the height of the water now and a step before, by cell (index: column mod nx, row mod ny) */
  h: Float32Array; old: Float32Array;
  /** cells of rock or of air: the water there stays flat, the waves bounce off */
  wall: Uint8Array;
  /** the first cell of the window (world cells) */
  ox = 0; oy = 0;
  /** packed for the lens: r, g the slope, b the curvature, 128 flat */
  data: Uint8Array;
  /** the highest wave at the last pack */
  peak = 0;
  /** how much the borders of the window damp, by column and by row */
  private bx: Float32Array; private by: Float32Array;
  /** the open water of each column, as it entered the window (world px) */
  private top: Float32Array; private bot: Float32Array;
  private started = false;

  constructor(nx = 320, ny = 200, cell = 8) {
    this.nx = nx; this.ny = ny; this.cell = cell;
    const n = nx * ny;
    this.h = new Float32Array(n); this.old = new Float32Array(n); this.wall = new Uint8Array(n); this.data = new Uint8Array(n * 4);
    this.bx = new Float32Array(nx); this.by = new Float32Array(ny); this.top = new Float32Array(nx); this.bot = new Float32Array(nx);
  }

  private index(cx: number, cy: number): number { return mod(cx, this.nx) + mod(cy, this.ny) * this.nx; }

  /** a column of the world enters the window: cleared, its walls from its open water */
  private column(cx: number, span: Span): void {
    const i = mod(cx, this.nx), [t, b] = span((cx + 0.5) * this.cell);
    this.top[i] = t; this.bot[i] = b;
    for (let cy = this.oy; cy < this.oy + this.ny; cy++) this.cellIn(i, cx, cy);
  }
  private row(cy: number): void {
    for (let cx = this.ox; cx < this.ox + this.nx; cx++) this.cellIn(mod(cx, this.nx), cx, cy);
  }
  private cellIn(i: number, _cx: number, cy: number): void {
    const k = i + mod(cy, this.ny) * this.nx, y = (cy + 0.5) * this.cell;
    this.h[k] = this.old[k] = 0;
    this.wall[k] = y < this.top[i] || y > this.bot[i] ? 1 : 0;
  }

  /** the borders of the window swallow the waves that reach them (they would come back on the other side) */
  private borders(): void {
    const B = 12, damp = (e: number) => (e >= B ? 1 : 1 - 0.14 * (1 - e / B) ** 2);
    for (let i = 0; i < this.nx; i++) { const w = mod(i - this.ox, this.nx); this.bx[i] = damp(Math.min(w, this.nx - 1 - w)); }
    for (let j = 0; j < this.ny; j++) { const w = mod(j - this.oy, this.ny); this.by[j] = damp(Math.min(w, this.ny - 1 - w)); }
  }

  /** keeps the window centred on (x, y) (world px); the cells that enter it are cleared */
  follow(x: number, y: number, span: Span): void {
    const ox = Math.round(x / this.cell) - (this.nx >> 1), oy = Math.round(y / this.cell) - (this.ny >> 1);
    if (!this.started || Math.abs(ox - this.ox) >= this.nx >> 1 || Math.abs(oy - this.oy) >= this.ny >> 1) {
      this.started = true;
      this.ox = ox; this.oy = oy;
      for (let cx = ox; cx < ox + this.nx; cx++) this.column(cx, span);
      this.borders();
      return;
    }
    if (ox === this.ox && oy === this.oy) return;
    while (this.ox < ox) { this.ox++; this.column(this.ox + this.nx - 1, span); }
    while (this.ox > ox) { this.ox--; this.column(this.ox, span); }
    while (this.oy < oy) { this.oy++; this.row(this.oy + this.ny - 1); }
    while (this.oy > oy) { this.oy--; this.row(this.oy); }
    this.borders();
  }

  /** the water pushed down at (x, y) (world px): a dip `depth` deep, `r` px wide */
  push(x: number, y: number, r: number, depth: number): void {
    const R = Math.max(1, r / this.cell), cx = x / this.cell, cy = y / this.cell;
    for (let j = Math.floor(cy - R); j <= Math.ceil(cy + R); j++) {
      if (j < this.oy || j >= this.oy + this.ny) continue;
      for (let i = Math.floor(cx - R); i <= Math.ceil(cx + R); i++) {
        if (i < this.ox || i >= this.ox + this.nx) continue;
        const q = 1 - ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2) / (R * R), k = this.index(i, j);
        if (q > 0 && !this.wall[k]) this.h[k] -= depth * q * q;
      }
    }
  }

  /**
   * One step of the waves: they go sqrt(speed) cells per step (stable below 0.75), the same way in every direction
   * (the nine cells around, not four: the rings stay round), `damp` of them kept.
   */
  step(speed = 0.3, damp = 0.986): void {
    const { nx, ny, h, old, wall, bx, by } = this, k6 = speed / 6;
    for (let j = 0; j < ny; j++) {
      const row = j * nx, up = (j === 0 ? ny - 1 : j - 1) * nx, dn = (j === ny - 1 ? 0 : j + 1) * nx, dj = by[j] * damp;
      for (let i = 0; i < nx; i++) {
        const k = row + i;
        if (wall[k]) { old[k] = 0; continue; }
        const il = i === 0 ? nx - 1 : i - 1, ir = i === nx - 1 ? 0 : i + 1, c = h[k];
        const s4 = h[row + il] + h[row + ir] + h[up + i] + h[dn + i], sd = h[up + il] + h[up + ir] + h[dn + il] + h[dn + ir];
        old[k] = (2 * c - old[k] + k6 * (4 * s4 + sd - 20 * c)) * dj * bx[i];
      }
    }
    this.old = h; this.h = old;
  }

  /** packs the slope and the curvature for the lens (`slope` and `bend` scale them into the bytes) */
  pack(slope = 2.5, bend = 2): void {
    const { nx, ny, h, data } = this;
    let peak = 0;
    for (let j = 0; j < ny; j++) {
      const row = j * nx, up = (j === 0 ? ny - 1 : j - 1) * nx, dn = (j === ny - 1 ? 0 : j + 1) * nx;
      for (let i = 0; i < nx; i++) {
        const il = i === 0 ? nx - 1 : i - 1, ir = i === nx - 1 ? 0 : i + 1, k = row + i, c = h[k], o = k * 4;
        // the slopes and the curvature over the nine cells around (smoother than over four)
        const ul = h[up + il], ur = h[up + ir], dl = h[dn + il], dr = h[dn + ir], l = h[row + il], r = h[row + ir], u = h[up + i], d = h[dn + i];
        const gx = (2 * (r - l) + ur - ul + dr - dl) / 8, gy = (2 * (d - u) + dl - ul + dr - ur) / 8;
        const lap = (4 * (l + r + u + d) + ul + ur + dl + dr - 20 * c) / 6;
        data[o] = 128 + Math.max(-127, Math.min(127, gx * slope * 127));
        data[o + 1] = 128 + Math.max(-127, Math.min(127, gy * slope * 127));
        data[o + 2] = 128 + Math.max(-127, Math.min(127, lap * bend * 127));
        data[o + 3] = 255;
        if (c > peak) peak = c; else if (-c > peak) peak = -c;
      }
    }
    this.peak = peak;
  }

  /** the height of the water at (x, y) (world px), 0 outside the window */
  at(x: number, y: number): number {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    if (cx < this.ox || cx >= this.ox + this.nx || cy < this.oy || cy >= this.oy + this.ny) return 0;
    return this.h[this.index(cx, cy)];
  }
}

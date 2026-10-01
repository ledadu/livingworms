// The water of the parade (docs/mecaniques.md, « L'eau de la parade »): a patch of sea that the dancers stir, and
// that carries their light. The simplest fluid there is, Jos Stam's « stable fluids » (Real-Time Fluid Dynamics for
// Games, 2003): the velocity of the water on a coarse grid, carried along by itself and kept free of divergence (the
// water neither piles up nor empties, so what is pushed swirls back around: a push becomes two eddies, a jet a
// mushroom). Two inks ride on it, the partner's light and ours, carried the sharp way (MacCormack) so that their
// curls stay thin. Where the bodies push the water it lights up, like the plankton of a summer night.
// Pure: parade-eau.ts stirs it with the bodies, gives it the figures of the parade and draws its inks.

/** cells across and down, and the size of a cell (world px): a patch of 640 × 400 around the dance */
export const NX = 80, NY = 50, CELL = 8;
/** no cell holds more ink than this (each ink) */
export const INK_MAX = 1.5;
/** the inks as they show: never more opaque than this, however much gathers */
export const INK_PEAK = 0.34;
/** sweeps of the pressure each step (over-relaxed Gauss–Seidel, warm-started from the step before) */
const SWEEPS = 10, SOR = 1.6;
/** the edge of the patch: its last cells calm the water and fade the ink, so that nothing shows its border */
const EDGE = 4;
/** below these the patch sleeps (cells per step, ink) */
const STILL_V = 0.004, STILL_INK = 0.004;

export interface Pt { x: number; y: number; }

/**
 * Carries two fields along the water (u, v, cells per step): each cell fetches its value from where the water brings
 * it from, a step upstream (`way` 1), or downstream (-1); bilinear, never unstable.
 */
function carry2(qa: Float32Array, qb: Float32Array, sa: Float32Array, sb: Float32Array, u: Float32Array, v: Float32Array, nx: number, ny: number, way: number): void {
  const w = nx + 2, xmax = nx + 0.5, ymax = ny + 0.5;
  for (let j = 1; j <= ny; j++) {
    let k = 1 + w * j;
    for (let i = 1; i <= nx; i++, k++) {
      let x = i - way * u[k], y = j - way * v[k];
      if (x < 0.5) x = 0.5; else if (x > xmax) x = xmax;
      if (y < 0.5) y = 0.5; else if (y > ymax) y = ymax;
      const i0 = x | 0, j0 = y | 0, s = x - i0, t = y - j0, c = i0 + w * j0;
      const c00 = (1 - s) * (1 - t), c10 = s * (1 - t), c01 = (1 - s) * t, c11 = s * t;
      qa[k] = c00 * sa[c] + c10 * sa[c + 1] + c01 * sa[c + w] + c11 * sa[c + w + 1];
      qb[k] = c00 * sb[c] + c10 * sb[c + 1] + c01 * sb[c + w] + c11 * sb[c + w + 1];
    }
  }
}

export class Fluid {
  readonly nx: number; readonly ny: number; readonly h: number;
  /** world position of the patch's top left corner */
  x0 = 0; y0 = 0;
  /** velocity of the water (cells per step) and the two inks: (nx + 2) × (ny + 2), with a border of one cell */
  readonly u: Float32Array; readonly v: Float32Array;
  readonly a: Float32Array; readonly b: Float32Array;
  private u0: Float32Array; private v0: Float32Array; private a0: Float32Array; private b0: Float32Array;
  private ta: Float32Array; private tb: Float32Array;
  private p: Float32Array; private div: Float32Array;
  /** the sources of the next step, and all they bring (taken back evenly over the patch, which a closed sea needs) */
  private src: Float32Array; private srcSum = 0;
  /** how much of its speed the water keeps each step, and of their light the inks */
  drag = 0.99; fade = 0.993;
  /** light rises: the pull up of a unit of ink (cells per step²); below 0 it sinks */
  lift = 0;
  /** the inks carried the sharp way (MacCormack): thin curls; false, softer and cheaper */
  sharp = true;
  /** anything moving or shining: a sleeping patch costs nothing */
  awake = false;
  /** steps since it woke */
  age = 0;

  constructor(nx = NX, ny = NY, h = CELL) {
    this.nx = nx; this.ny = ny; this.h = h;
    const n = (nx + 2) * (ny + 2), f = () => new Float32Array(n);
    this.u = f(); this.v = f(); this.a = f(); this.b = f();
    this.u0 = f(); this.v0 = f(); this.a0 = f(); this.b0 = f(); this.ta = f(); this.tb = f();
    this.p = f(); this.div = f(); this.src = f();
  }

  get width(): number { return this.nx * this.h; }
  get height(): number { return this.ny * this.h; }
  /** the middle of the patch */
  get centre(): Pt { return { x: this.x0 + this.width / 2, y: this.y0 + this.height / 2 }; }

  /** the patch, calm and dark, centred on (x, y) */
  place(x: number, y: number): void {
    this.x0 = x - this.width / 2; this.y0 = y - this.height / 2;
    for (const q of [this.u, this.v, this.a, this.b, this.p, this.src]) q.fill(0);
    this.srcSum = 0; this.lift = 0;
    this.awake = false; this.age = 0;
  }

  /** is (x, y) on the patch, `margin` px inside its border */
  inside(x: number, y: number, margin = 0): boolean {
    return x >= this.x0 + margin && x <= this.x0 + this.width - margin && y >= this.y0 + margin && y <= this.y0 + this.height - margin;
  }

  /**
   * Each cell within `r` px of (x, y), with its weight (a soft disc, 1 in the middle): the grid position of a world
   * point is (x - x0) / h + 0.5, cell i being centred on i.
   */
  private around(x: number, y: number, r: number, fn: (k: number, w: number) => void): void {
    const gx = (x - this.x0) / this.h + 0.5, gy = (y - this.y0) / this.h + 0.5, rg = Math.max(0.75, r / this.h);
    const i0 = Math.max(1, Math.floor(gx - rg - 1)), i1 = Math.min(this.nx, Math.ceil(gx + rg + 1));
    const j0 = Math.max(1, Math.floor(gy - rg - 1)), j1 = Math.min(this.ny, Math.ceil(gy + rg + 1));
    const s2 = rg * rg, w = this.nx + 2;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const d2 = (i - gx) * (i - gx) + (j - gy) * (j - gy);
      if (d2 > s2 * 2.5) continue;
      fn(i + w * j, Math.exp(-d2 / s2));
    }
  }

  /** a push: adds this velocity (px per step) to the water within `r` px of (x, y) */
  push(x: number, y: number, vx: number, vy: number, r = this.h): void {
    const ux = vx / this.h, uy = vy / this.h;
    this.around(x, y, r, (k, w) => { this.u[k] += ux * w; this.v[k] += uy * w; });
    this.awake = true;
  }

  /**
   * A body moving through the water: the water within `r` px is drawn toward its speed (px per step) by `k` (0..1),
   * never faster than the body. Returns how much it had to change (px per step), the stir that lights the water.
   */
  stir(x: number, y: number, vx: number, vy: number, r: number, k: number): number {
    const ux = vx / this.h, uy = vy / this.h;
    let sum = 0, wsum = 0;
    this.around(x, y, r, (c, w) => {
      const du = (ux - this.u[c]) * w * k, dv = (uy - this.v[c]) * w * k;
      this.u[c] += du; this.v[c] += dv;
      sum += Math.hypot(du, dv) * w; wsum += w;
    });
    const st = wsum ? (sum / wsum) * this.h : 0;
    // a body at rest in still water changes nothing
    if (st > 1e-3) this.awake = true;
    return st;
  }

  /**
   * Water welling out within `r` px of (x, y) during the next step (< 0 draws it in): the only way to push the water
   * away all around a point, which a sea that neither piles up nor empties would otherwise take back at once.
   * `rate`: the area of water it brings, in cells per step.
   */
  source(x: number, y: number, rate: number, r = this.h): void {
    let sum = 0;
    this.around(x, y, r, (_, w) => { sum += w; });
    if (!sum) return;
    this.around(x, y, r, (k, w) => { this.src[k] += (rate * w) / sum; });
    this.srcSum += rate;
    this.awake = true;
  }

  /** light poured into the water within `r` px of (x, y): `a` of the partner's ink, `b` of ours */
  ink(x: number, y: number, a: number, b: number, r = this.h): void {
    this.around(x, y, r, (k, w) => {
      if (a) this.a[k] = Math.min(INK_MAX, this.a[k] + a * w);
      if (b) this.b[k] = Math.min(INK_MAX, this.b[k] + b * w);
    });
    this.awake = true;
  }

  /** the value of a field at a grid position (bilinear) */
  private at(q: Float32Array, gx: number, gy: number): number {
    const x = Math.min(this.nx + 0.5, Math.max(0.5, gx)), y = Math.min(this.ny + 0.5, Math.max(0.5, gy));
    const i = Math.floor(x), j = Math.floor(y), s = x - i, t = y - j, w = this.nx + 2, k = i + w * j;
    return (1 - s) * ((1 - t) * q[k] + t * q[k + w]) + s * ((1 - t) * q[k + 1] + t * q[k + 1 + w]);
  }

  /** the water's velocity at (x, y), px per step; still outside the patch */
  flow(x: number, y: number, out: Pt = { x: 0, y: 0 }): Pt {
    out.x = 0; out.y = 0;
    if (!this.awake || !this.inside(x, y)) return out;
    const gx = (x - this.x0) / this.h + 0.5, gy = (y - this.y0) / this.h + 0.5;
    out.x = this.at(this.u, gx, gy) * this.h; out.y = this.at(this.v, gx, gy) * this.h;
    return out;
  }

  /** the inks at (x, y) */
  inkAt(x: number, y: number): { a: number; b: number } {
    if (!this.inside(x, y)) return { a: 0, b: 0 };
    const gx = (x - this.x0) / this.h + 0.5, gy = (y - this.y0) / this.h + 0.5;
    return { a: this.at(this.a, gx, gy), b: this.at(this.b, gx, gy) };
  }

  /** the divergence of the water in a cell (cells per step per cell): 0 where it neither piles up nor empties */
  divergence(i: number, j: number): number {
    const u = this.u, v = this.v, w = this.nx + 2, k = i + w * j;
    return 0.5 * (u[k + 1] - u[k - 1] + v[k + w] - v[k - w]);
  }

  /** its spin in a cell (radians per step, > 0 turns clockwise on the screen, y being down) */
  spin(i: number, j: number): number {
    const u = this.u, v = this.v, w = this.nx + 2, k = i + w * j;
    return 0.5 * (v[k + 1] - v[k - 1] - (u[k + w] - u[k - w]));
  }

  /**
   * One step of the water: carried by itself, kept from piling up, then the inks ride on it. `dt`: how many steps of
   * the game it stands for (the game may run the water at half its pace).
   */
  step(dt = 1): void {
    if (!this.awake) return;
    this.age += dt;
    const { nx, ny, u, v, a, b } = this;
    if (this.lift) for (let k = 0; k < v.length; k++) v[k] -= this.lift * dt * (a[k] + b[k]);
    this.u0.set(u); this.v0.set(v);
    carry2(u, v, this.u0, this.v0, this.u0, this.v0, nx, ny, dt);
    this.bound(1, u); this.bound(2, v);
    this.project();
    this.inks(dt);
    this.settle(dt);
  }

  /** the border cells mirror the first ones: the water slides along the edge of the patch, never through it */
  private bound(kind: 0 | 1 | 2, q: Float32Array): void {
    const nx = this.nx, ny = this.ny, w = nx + 2;
    for (let i = 1; i <= nx; i++) {
      q[i] = kind === 2 ? -q[i + w] : q[i + w];
      q[i + w * (ny + 1)] = kind === 2 ? -q[i + w * ny] : q[i + w * ny];
    }
    for (let j = 1; j <= ny; j++) {
      q[w * j] = kind === 1 ? -q[1 + w * j] : q[1 + w * j];
      q[nx + 1 + w * j] = kind === 1 ? -q[nx + w * j] : q[nx + w * j];
    }
    q[0] = 0.5 * (q[1] + q[w]);
    q[nx + 1] = 0.5 * (q[nx] + q[nx + 1 + w]);
    q[w * (ny + 1)] = 0.5 * (q[1 + w * (ny + 1)] + q[w * ny]);
    q[nx + 1 + w * (ny + 1)] = 0.5 * (q[nx + w * (ny + 1)] + q[nx + 1 + w * ny]);
  }

  /** takes the divergence out of the water (but the sources'): what is pushed goes around, as in an incompressible sea */
  private project(): void {
    const nx = this.nx, ny = this.ny, w = nx + 2, u = this.u, v = this.v, p = this.p, div = this.div, src = this.src;
    const well = this.srcSum !== 0, back = this.srcSum / (nx * ny);
    for (let j = 1; j <= ny; j++) {
      let k = 1 + w * j;
      for (let i = 1; i <= nx; i++, k++) div[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + w] - v[k - w]) + (well ? src[k] - back : 0);
    }
    if (well) { src.fill(0); this.srcSum = 0; }
    this.bound(0, div);
    this.bound(0, p);
    for (let s = 0; s < SWEEPS; s++) {
      for (let j = 1; j <= ny; j++) {
        let k = 1 + w * j;
        for (let i = 1; i <= nx; i++, k++) p[k] += SOR * ((div[k] + p[k - 1] + p[k + 1] + p[k - w] + p[k + w]) * 0.25 - p[k]);
      }
      this.bound(0, p);
    }
    for (let j = 1; j <= ny; j++) {
      let k = 1 + w * j;
      for (let i = 1; i <= nx; i++, k++) {
        u[k] -= 0.5 * (p[k + 1] - p[k - 1]);
        v[k] -= 0.5 * (p[k + w] - p[k - w]);
      }
    }
    this.bound(1, u);
    this.bound(2, v);
  }

  /**
   * The inks ride on the water. The sharp way (MacCormack): fetched upstream, then corrected by how far fetching them
   * back downstream misses, never beyond what was upstream (no ripples of light out of nothing).
   */
  private inks(dt: number): void {
    const { nx, ny, u, v, a, b, a0, b0 } = this, w = nx + 2;
    a0.set(a); b0.set(b);
    carry2(a, b, a0, b0, u, v, nx, ny, dt);
    if (this.sharp) {
      const ta = this.ta, tb = this.tb, xmax = nx + 0.5, ymax = ny + 0.5;
      carry2(ta, tb, a, b, u, v, nx, ny, -dt);
      for (let j = 1; j <= ny; j++) {
        let k = 1 + w * j;
        for (let i = 1; i <= nx; i++, k++) {
          let x = i - dt * u[k], y = j - dt * v[k];
          if (x < 0.5) x = 0.5; else if (x > xmax) x = xmax;
          if (y < 0.5) y = 0.5; else if (y > ymax) y = ymax;
          const c = (x | 0) + w * (y | 0);
          let r = a[k] + 0.5 * (a0[k] - ta[k]);
          let lo = Math.min(a0[c], a0[c + 1], a0[c + w], a0[c + w + 1]), hi = Math.max(a0[c], a0[c + 1], a0[c + w], a0[c + w + 1]);
          a[k] = r < lo ? lo : r > hi ? hi : r;
          r = b[k] + 0.5 * (b0[k] - tb[k]);
          lo = Math.min(b0[c], b0[c + 1], b0[c + w], b0[c + w + 1]); hi = Math.max(b0[c], b0[c + 1], b0[c + w], b0[c + w + 1]);
          b[k] = r < lo ? lo : r > hi ? hi : r;
        }
      }
    }
    this.bound(0, a); this.bound(0, b);
  }

  /** the water slows, the inks fade, the edge calms everything; asleep once nothing moves or shines */
  private settle(dt: number): void {
    const nx = this.nx, ny = this.ny, w = nx + 2, { u, v, a, b } = this, drag = this.drag ** dt, fade = this.fade ** dt;
    let vmax = 0, imax = 0;
    for (let j = 1; j <= ny; j++) {
      const ej = Math.min(j - 1, ny - j);
      let k = 1 + w * j;
      for (let i = 1; i <= nx; i++, k++) {
        const e = Math.min(ej, i - 1, nx - i);
        // in the last cells the sea around takes over
        const edge = e >= EDGE ? 1 : (0.55 + 0.45 * (e / EDGE)) ** dt;
        u[k] *= drag * edge; v[k] *= drag * edge;
        a[k] *= fade * edge; b[k] *= fade * edge;
        const s = Math.abs(u[k]) + Math.abs(v[k]);
        if (s > vmax) vmax = s;
        if (a[k] + b[k] > imax) imax = a[k] + b[k];
      }
    }
    if (vmax < STILL_V && imax < STILL_INK) {
      for (const q of [u, v, a, b, this.p]) q.fill(0);
      this.awake = false; this.age = 0;
    }
  }
}

/** a colour, 0..1 */
export type Rgb = readonly [number, number, number];

let softA = new Float32Array(0), softB = new Float32Array(0), tmp = new Float32Array(0);
/** the inks softened by a small blur ([1 2 1] each way), so that the grid never shows */
function soften(f: Fluid): void {
  const n = f.a.length, w = f.nx + 2, nx = f.nx, ny = f.ny;
  if (softA.length !== n) { softA = new Float32Array(n); softB = new Float32Array(n); tmp = new Float32Array(n); }
  for (const [src, dst] of [[f.a, softA], [f.b, softB]] as const) {
    tmp.fill(0);
    for (let j = 1; j <= ny; j++) {
      let k = 1 + w * j;
      for (let i = 1; i <= nx; i++, k++) tmp[k] = 0.25 * src[k - 1] + 0.5 * src[k] + 0.25 * src[k + 1];
    }
    dst.fill(0);
    for (let j = 1; j <= ny; j++) {
      let k = 1 + w * j;
      for (let i = 1; i <= nx; i++, k++) dst[k] = 0.25 * tmp[k - w] + 0.5 * tmp[k] + 0.25 * tmp[k + w];
    }
  }
}

/**
 * The inks as pixels, `up` pixels a cell each way (RGBA, nx·up × ny·up, row by row), softened: each ink in its colour,
 * the colours mixing where they meet as paints do; the more ink, the more opaque, never beyond INK_PEAK (so that they
 * never burn to white where they gather), and softly transparent toward the edge. `gain`: stronger. Returns the
 * highest alpha drawn (0..1).
 */
export function inkPixels(f: Fluid, ca: Rgb, cb: Rgb, gain: number, out: Uint8ClampedArray, up = 1): number {
  soften(f);
  const nx = f.nx, ny = f.ny, w = nx + 2, W = nx * up, H = ny * up;
  let top = 0;
  for (let y = 0; y < H; y++) {
    // the grid position of the pixel's middle (cell i centred on i)
    const gy = Math.min(ny, Math.max(1, (y + 0.5) / up + 0.5)), j = Math.min(ny - 1, gy | 0), t = gy - j;
    const ey = Math.min(gy - 1, ny - gy);
    for (let x = 0; x < W; x++) {
      const gx = Math.min(nx, Math.max(1, (x + 0.5) / up + 0.5)), i = Math.min(nx - 1, gx | 0), s = gx - i, k = i + w * j;
      const c00 = (1 - s) * (1 - t), c10 = s * (1 - t), c01 = (1 - s) * t, c11 = s * t;
      const A = c00 * softA[k] + c10 * softA[k + 1] + c01 * softA[k + w] + c11 * softA[k + w + 1];
      const B = c00 * softB[k] + c10 * softB[k + 1] + c01 * softB[k + w] + c11 * softB[k + w + 1];
      const S = A + B, o = (y * W + x) * 4;
      if (S < 0.002) { out[o + 3] = 0; continue; }
      const e = Math.min(ey, gx - 1, nx - gx), soft = e >= EDGE ? 1 : Math.max(0, e / EDGE);
      // a thin veil barely shows, a thick one shines: the light grows with the ink, then saturates
      const al = INK_PEAK * (1 - Math.exp(-S * gain * 1.6)) * soft;
      out[o] = ((A * ca[0] + B * cb[0]) / S) * 255;
      out[o + 1] = ((A * ca[1] + B * cb[1]) / S) * 255;
      out[o + 2] = ((A * ca[2] + B * cb[2]) / S) * 255;
      out[o + 3] = al * 255;
      if (al > top) top = al;
    }
  }
  return top;
}

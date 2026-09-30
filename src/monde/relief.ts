// Composed reliefs: the shapes of the terrain that a floor line cannot make.
// Pillars, arches and overhangs are meshes of quads in world space (a ring
// swept along a curve, or an outline pushed along z), drawn face by face in
// perspective (relief-draw.ts); they stand in front of the swimming plane,
// across it and behind it. A swimmer bumps into the cut of a relief by its own
// plane z. Faults are carved in the floor itself (floorAt adds `carve`).
// Each chapter has its own (PLANS, by biome id). No DOM here: the tests run it.

import { TAU, clamp, lerp, noise1, rng, seedOf } from '../engine';

type R01 = () => number;
/** depth of the floor (y down) at x, z */
export type Floor = (x: number, z: number) => number;

export type ReliefKind = 'pilier' | 'arche' | 'surplomb';

export interface Relief {
  kind: ReliefKind;
  /** where it stands (the middle of its foot or of its span) */
  x: number; z: number;
  /** its box */
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  /** vertices: x, y, z, in rings of nu points */
  p: Float32Array; nu: number;
  /** quads of vertex indices (a, b, c, d), turned so that their normal points out */
  quads: Uint32Array;
  /** outward unit normal of each quad */
  n: Float32Array;
  /** an outline pushed along z shows its front face: its triangles, and its outline (vertex indices) */
  cap: Uint32Array | null;
  rim: Uint32Array | null;
  /** lines drawn on the front face (strata): segments x1, y1, x2, y2 at z0 */
  marks: Float32Array | null;
  /** how much life covers its top (0..1), from the biome */
  encrust: number;
  seed: number;
  /** cuts by a plane z (segments x1, y1, x2, y2), cached by 8 units of z */
  cuts: Map<number, Float32Array>;
}

/** a fault: a trench across the floor, from the front to far back */
export interface Fault { x: number; w: number; d: number; seed: number; }

const smooth = (t: number) => t * t * (3 - 2 * t);

// ----- the meshes ----- //

/** a mesh from rings of nu points (x, y, z), with quads between consecutive rings, closed around each ring */
function mesh(kind: ReliefKind, x: number, z: number, rings: number[][], nu: number, encrust: number, seed: number, cap = false): Relief {
  const nv = rings.length, p = new Float32Array(nu * nv * 3);
  rings.forEach((r, j) => p.set(r, j * nu * 3));
  const quads = new Uint32Array((nv - 1) * nu * 4), n = new Float32Array((nv - 1) * nu * 3);
  let q = 0;
  for (let j = 0; j + 1 < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = (i + 1) % nu;
      quads[q++] = j * nu + i; quads[q++] = j * nu + i1; quads[q++] = (j + 1) * nu + i1; quads[q++] = (j + 1) * nu + i;
    }
  }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, mx = 0, my = 0, mz = 0;
  for (let i = 0; i < p.length; i += 3) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
    z0 = Math.min(z0, p[i + 2]); z1 = Math.max(z1, p[i + 2]);
    mx += p[i]; my += p[i + 1]; mz += p[i + 2];
  }
  const nvx = p.length / 3;
  mx /= nvx; my /= nvx; mz /= nvx;
  // normals from the diagonals; the flux of (point - middle) through the surface tells out from in
  let flux = 0;
  for (let f = 0; f < quads.length / 4; f++) {
    const a = quads[f * 4] * 3, b = quads[f * 4 + 1] * 3, c = quads[f * 4 + 2] * 3, d = quads[f * 4 + 3] * 3;
    const ux = p[c] - p[a], uy = p[c + 1] - p[a + 1], uz = p[c + 2] - p[a + 2];
    const vx = p[d] - p[b], vy = p[d + 1] - p[b + 1], vz = p[d + 2] - p[b + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    n[f * 3] = nx; n[f * 3 + 1] = ny; n[f * 3 + 2] = nz;
    const cx = (p[a] + p[b] + p[c] + p[d]) / 4 - mx, cy = (p[a + 1] + p[b + 1] + p[c + 1] + p[d + 1]) / 4 - my, cz = (p[a + 2] + p[b + 2] + p[c + 2] + p[d + 2]) / 4 - mz;
    flux += cx * nx + cy * ny + cz * nz;
  }
  const flip = flux < 0 ? -1 : 1;
  for (let f = 0; f < quads.length / 4; f++) {
    if (flip < 0) { const b = quads[f * 4 + 1]; quads[f * 4 + 1] = quads[f * 4 + 3]; quads[f * 4 + 3] = b; }
    const l = Math.hypot(n[f * 3], n[f * 3 + 1], n[f * 3 + 2]) || 1;
    n[f * 3] *= flip / l; n[f * 3 + 1] *= flip / l; n[f * 3 + 2] *= flip / l;
  }
  let capT: Uint32Array | null = null, rim: Uint32Array | null = null;
  if (cap) {
    const xy = new Float32Array(nu * 2);
    for (let i = 0; i < nu; i++) { xy[i * 2] = p[i * 3]; xy[i * 2 + 1] = p[i * 3 + 1]; }
    capT = new Uint32Array(triangulate(xy, nu));
    rim = Uint32Array.from({ length: nu }, (_, i) => i);
  }
  return { kind, x, z, x0, x1, y0, y1, z0, z1, p, nu, quads, n, cap: capT, rim, marks: null, encrust, seed, cuts: new Map() };
}

/** triangles of a simple polygon (x, y pairs), by clipping its ears: indices of its points */
export function triangulate(xy: ArrayLike<number>, n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i), out: number[] = [];
  let area = 0;
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += xy[i * 2] * xy[j * 2 + 1] - xy[j * 2] * xy[i * 2 + 1]; }
  const s = area > 0 ? 1 : -1;
  const cross = (a: number, b: number, c: number) =>
    ((xy[b * 2] - xy[a * 2]) * (xy[c * 2 + 1] - xy[b * 2 + 1]) - (xy[b * 2 + 1] - xy[a * 2 + 1]) * (xy[c * 2] - xy[b * 2])) * s;
  while (idx.length > 3) {
    let cut = -1;
    for (let k = 0; k < idx.length && cut < 0; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      if (cross(a, b, c) <= 0) continue;
      let free = true;
      for (const m of idx) {
        if (m === a || m === b || m === c) continue;
        if (cross(a, b, m) >= 0 && cross(b, c, m) >= 0 && cross(c, a, m) >= 0) { free = false; break; }
      }
      if (free) cut = k;
    }
    // a polygon that folds on itself has no ear left: cut anywhere rather than loop
    if (cut < 0) cut = 0;
    const k = cut;
    out.push(idx[(k + idx.length - 1) % idx.length], idx[k], idx[(k + 1) % idx.length]);
    idx.splice(k, 1);
  }
  out.push(idx[0], idx[1], idx[2]);
  return out;
}

/** feet sit on the floor, a few units in (the floor line is drawn straight between its points) */
const SINK = 4;

/** a column of stacked rock standing on the floor, rounded on top */
export function pillar(x: number, z: number, h: number, rad: number, floor: Floor, encrust: number, seed: number): Relief {
  const R = rng(seed), nu = 9;
  const ex = 0.75 + R() * 0.5, lean = (R() - 0.5) * 0.2, ph = R() * TAU;
  let hi = Infinity;
  for (let k = 0; k < 8; k++) hi = Math.min(hi, floor(x + Math.cos((k / 8) * TAU) * rad * ex, z + Math.sin((k / 8) * TAU) * rad / ex));
  const top = hi - h, rings: number[][] = [];
  // the first ring follows the floor, the others are flat, from the highest point of the floor under it
  const ring = (y: number, r: number, j: number) => {
    const out: number[] = [], cx = x + lean * (hi - y);
    for (let i = 0; i < nu; i++) {
      const a = (i / nu) * TAU, rr = r * (1 + (noise1(i * 1.1 + j * 0.63, seed) - 0.5) * 0.34);
      const px = cx + Math.cos(a) * rr * ex, pz = z + Math.sin(a) * rr / ex;
      out.push(px, j === 0 ? floor(px, pz) + SINK : y, pz);
    }
    rings.push(out);
  };
  const N = Math.max(4, Math.round(h / 60));
  for (let j = 0; j <= N; j++) {
    const t = j / N;
    ring(lerp(hi, top, t), rad * (1.18 - 0.3 * t) * (1 + 0.13 * Math.sin(t * 10 + ph)), j);
  }
  ring(top - rad * 0.28, rad * 0.62, N + 1);
  ring(top - rad * 0.36, rad * 0.08, N + 2);
  return mesh('pilier', x, z, rings, nu, encrust, seed);
}

/**
 * An arch from the foot A to the foot B: its span can lie in a plane z (seen
 * face on) or cross the swimming plane (a vault overhead, one leg in front and
 * one behind). `rn` is its thickness in its plane, `rs` across it.
 */
export function arch(xa: number, za: number, xb: number, zb: number, H: number, rn: number, rs: number, floor: Floor, encrust: number, seed: number): Relief {
  const nu = 7, nv = 22, M = 200, R = rng(seed);
  const ga = floor(xa, za), gb = floor(xb, zb), skew = 0.8 + R() * 0.4;
  const sx = -(zb - za), sz = xb - xa, sl = Math.hypot(sx, sz) || 1, Sx = sx / sl, Sz = sz / sl;
  // the crown a little off the middle, the curve wavering across and up
  const at = (u: number): [number, number, number] => {
    u = clamp(u, 0, 1);
    const s = Math.pow(Math.sin(Math.PI * Math.pow(u, skew)), 0.6), wob = (noise1(u * 3.2, seed + 7) - 0.5) * s * rs * 0.9;
    return [lerp(xa, xb, u) + Sx * wob, lerp(ga, gb, u) + SINK * (1 - s) - H * s + (noise1(u * 4.1, seed + 9) - 0.5) * rn * 0.8 * s, lerp(za, zb, u) + Sz * wob];
  };
  // even steps along the curve (the legs rise fast)
  const L = [0];
  let prev = at(0);
  for (let i = 1; i <= M; i++) { const c = at(i / M); L.push(L[i - 1] + Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2])); prev = c; }
  const rings: number[][] = [];
  for (let j = 0, k = 0; j < nv; j++) {
    const want = (L[M] * j) / (nv - 1);
    while (k < M - 1 && L[k + 1] < want) k++;
    const u = (k + clamp((want - L[k]) / (L[k + 1] - L[k] || 1), 0, 1)) / M;
    const c = at(u), c0 = at(u - 0.004), c1 = at(u + 0.004);
    let tx = c1[0] - c0[0], ty = c1[1] - c0[1], tz = c1[2] - c0[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    // N = S × T: in the plane of the arch, square to the curve
    let nx = -Sz * ty, ny = Sz * tx - Sx * tz, nz = Sx * ty;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const s = Math.pow(Math.sin(Math.PI * Math.pow(u, skew)), 0.6), bump = 1 + (noise1(j * 0.7, seed) - 0.5) * 0.45 + (noise1(j * 1.9, seed + 2) - 0.5) * 0.2;
    const a1 = rn * (0.85 + 0.8 * (1 - s)) * bump, a2 = rs * (0.95 + 0.35 * (1 - s)) * bump;
    const out: number[] = [], foot = j === 0 || j === nv - 1;
    for (let i = 0; i < nu; i++) {
      const a = (i / nu) * TAU, k2 = 1 + (noise1(i * 1.3 + j * 0.45, seed + 1) - 0.5) * 0.42;
      const cn = Math.cos(a) * a1 * k2, cs = Math.sin(a) * a2 * k2;
      const px = c[0] + nx * cn + Sx * cs, pz = c[2] + nz * cn + Sz * cs;
      out.push(px, foot ? floor(px, pz) + SINK : c[1] + ny * cn, pz);
    }
    rings.push(out);
  }
  return mesh('arche', (xa + xb) / 2, (za + zb) / 2, rings, nu, encrust, seed);
}

/**
 * A rock that juts out over the floor, `dir` 1 to the right: a wall, a flat
 * top, and a shelf of thickness T with a sheltered hollow under it. Its
 * outline is pushed from zf to zb, a little different at each step.
 */
export function overhang(x: number, zf: number, zb: number, H: number, W: number, reach: number, T: number, dir: number, floor: Floor, encrust: number, seed: number): Relief {
  const O: [number, number][] = [
    [W + 8, -1], [W - 6, H * 0.35], [W + 10, H - T - 26], [W + reach * 0.45, H - T - 10], [W + reach - 14, H - T],
    [W + reach, H - T * 0.35], [W + reach * 0.55, H - 4], [W * 0.75, H + 4], [W * 0.25, H + 8], [-6, H * 0.75], [-10, H * 0.3], [0, -1]
  ];
  // more points along the outline, pushed in and out by the noise
  const pts: [number, number, boolean][] = [];
  for (let k = 0; k < O.length; k++) {
    const [ax, ah] = O[k], [bx, bh] = O[(k + 1) % O.length], len = Math.hypot(bx - ax, bh - ah);
    const base = ah < 0 && bh < 0, steps = base ? 1 : Math.max(1, Math.round(len / 34));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, px = lerp(ax, bx, t), ph = lerp(ah, bh, t);
      const j = base || ph < 0 ? 0 : (noise1(pts.length * 0.9, seed) - 0.5) * 18 + (noise1(pts.length * 0.23, seed + 3) - 0.5) * 30;
      pts.push([px + (-(bh - ah) / (len || 1)) * j, ph + ((bx - ax) / (len || 1)) * j, s === 0 && ah < 0]);
    }
  }
  const X = (u: number) => x + dir * (u - W / 2), n = pts.length;
  let gRoot = Infinity;
  for (let u = 0; u <= W; u += W / 4) gRoot = Math.min(gRoot, floor(X(u), zf));
  // the front face is a little smaller than the rock behind it: a bevel that catches the light all around
  const B = 10, zs = [zf, zf + 16, lerp(zf, zb, 0.3), lerp(zf, zb, 0.55), lerp(zf, zb, 0.8), zb];
  const rings = zs.map((z, j) => {
    // each step back a little different: the lip comes and goes, the rock swells and shrinks
    const lip = 1 + (noise1(j * 0.8 + 2, seed) - 0.5) * 0.4, sink = 1 - (j / (zs.length - 1)) * 0.15, out: number[] = [];
    pts.forEach(([u, h, buried], i) => {
      if (j === 0 && !buried) {
        // inward (the outline turns counterclockwise, h up)
        const [pu, ph] = pts[(i + n - 1) % n], [qu, qh] = pts[(i + 1) % n], tl = Math.hypot(qu - pu, qh - ph) || 1;
        u += (-(qh - ph) / tl) * B; h += ((qu - pu) / tl) * B;
      }
      const uu = (u > W ? W + (u - W) * lip : u) + (j > 1 && !buried ? (noise1(i * 0.4 + j * 1.3, seed + 6) - 0.5) * 26 : 0);
      const hh = h * sink + (j > 1 && h > 0 ? (noise1(i * 0.5 + j * 1.1, seed + 7) - 0.5) * 22 : 0);
      out.push(X(uu), buried ? floor(X(uu), z) + SINK : gRoot - hh, z);
    });
    return out;
  });
  const r = mesh('surplomb', x, zf, rings, n, encrust, seed, true);
  r.marks = strata(r.p, n, r.y0, seed);
  return r;
}

/** strata on a front face (the outline of n points first in p): wavering lines across it, a few tens of units apart */
function strata(p: Float32Array, n: number, top: number, seed: number): Float32Array {
  const out: number[] = [], xs: number[] = [];
  let bottom = -Infinity;
  for (let i = 0; i < n; i++) bottom = Math.max(bottom, p[i * 3 + 1]);
  for (let y = top + 18 + noise1(1, seed) * 14, k = 0; y < bottom - 12; y += 22 + noise1(k * 1.7, seed + 4) * 24, k++) {
    xs.length = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, ya = p[i * 3 + 1], yb = p[j * 3 + 1];
      if ((ya > y) !== (yb > y)) xs.push(p[i * 3] + ((p[j * 3] - p[i * 3]) * (y - ya)) / (yb - ya));
    }
    xs.sort((a, b) => a - b);
    for (let m = 0; m + 1 < xs.length; m += 2) {
      // broken in pieces, each a little tilted
      const a = xs[m] + 6, b = xs[m + 1] - 6;
      for (let x = a; x < b; x += 26) {
        const e = Math.min(b, x + 22 + noise1(x / 40, seed + k) * 8), dy = (noise1(x / 60, seed + 8) - 0.5) * 5;
        if (noise1(x / 33 + k, seed + 5) < 0.3) continue;
        out.push(x, y + dy, e, y + dy + (noise1(e / 60, seed + 8) - 0.5) * 5);
      }
    }
  }
  return new Float32Array(out);
}

// ----- the world's reliefs ----- //

/** every relief of the world, along x */
export const reliefs: Relief[] = [];
let faults: Fault[] = [];
let widest = 0;

/** how much deeper the floor is at (x, z): the faults, deep trenches with steep walls, that close far back */
export function carve(x: number, z: number): number {
  let d = 0;
  for (const f of faults) {
    if (x < f.x - f.w || x > f.x + f.w) continue;
    const xc = f.x + (noise1(z / 300 + 5, f.seed) - 0.5) * f.w * 0.35;
    const u = Math.abs(x - xc) / (f.w * 0.5);
    if (u >= 1) continue;
    const back = 1 - smooth(clamp((z - 1000) / 800, 0, 1));
    const k = (1 - smooth(clamp((u - 0.35) / 0.65, 0, 1))) * f.d * back * (0.85 + 0.3 * noise1(z / 140, f.seed + 3));
    if (k > d) d = k;
  }
  return d;
}

/** the faults of the world */
export function faultList(): readonly Fault[] { return faults; }

/** the reliefs whose box may overlap [x0, x1] along x */
function* near(x0: number, x1: number): Generator<Relief> {
  let lo = 0, hi = reliefs.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (reliefs[m].x0 < x0 - widest) lo = m + 1; else hi = m; }
  for (let i = lo; i < reliefs.length && reliefs[i].x0 <= x1; i++) if (reliefs[i].x1 >= x0) yield reliefs[i];
}

/** the reliefs to draw between x0 and x1 */
export function reliefsIn(x0: number, x1: number): Relief[] { return [...near(x0, x1)]; }

/** the cut of a relief by the plane z: segments x1, y1, x2, y2 */
export function cutAt(r: Relief, z: number): Float32Array {
  const key = Math.round(z / 8);
  let c = r.cuts.get(key);
  if (c) return c;
  const zz = key * 8 + 0.01, p = r.p, q = r.quads, out: number[] = [], pts: number[] = [];
  for (let f = 0; f < q.length; f += 4) {
    pts.length = 0;
    for (let e = 0; e < 4; e++) {
      const a = q[f + e] * 3, b = q[f + ((e + 1) & 3)] * 3, za = p[a + 2] - zz, zb = p[b + 2] - zz;
      if ((za < 0) === (zb < 0)) continue;
      const t = za / (za - zb);
      pts.push(p[a] + (p[b] - p[a]) * t, p[a + 1] + (p[b + 1] - p[a + 1]) * t);
    }
    if (pts.length >= 4) out.push(pts[0], pts[1], pts[2], pts[3]);
  }
  c = new Float32Array(out);
  r.cuts.set(key, c);
  return c;
}

/** inside a cut: a ray toward +x crosses it an odd number of times */
function inside(c: Float32Array, x: number, y: number): boolean {
  let n = 0;
  for (let i = 0; i < c.length; i += 4) {
    const y1 = c[i + 1], y2 = c[i + 3];
    if ((y1 > y) === (y2 > y)) continue;
    if (c[i] + ((c[i + 2] - c[i]) * (y - y1)) / (y2 - y1) > x) n++;
  }
  return (n & 1) === 1;
}

/** is (x, y) inside the relief r, in the plane z */
export function within(r: Relief, x: number, y: number, z: number): boolean {
  return z >= r.z0 && z <= r.z1 && y >= r.y0 && y <= r.y1 && x >= r.x0 && x <= r.x1 && inside(cutAt(r, z), x, y);
}

/** is (x, y) inside a relief of the world, in the plane z */
export function solidAt(x: number, y: number, z: number): boolean {
  for (const r of near(x, x)) if (within(r, x, y, z)) return true;
  return false;
}

/** the ground at (x, z) for what grows there: the floor `fy`, or the top of the relief standing on it */
export function groundAt(x: number, z: number, fy: number): number {
  let y = fy;
  for (const r of near(x, x)) {
    if (z < r.z0 || z > r.z1) continue;
    const c = cutAt(r, z);
    if (!inside(c, x, y - 4)) continue;
    // up to the first edge above the floor
    let top = r.y0;
    for (let i = 0; i < c.length; i += 4) {
      const x1 = c[i], x2 = c[i + 2];
      if ((x1 > x) === (x2 > x)) continue;
      const yi = c[i + 1] + ((c[i + 3] - c[i + 1]) * (x - x1)) / (x2 - x1);
      if (yi < y - 4 && yi > top) top = yi;
    }
    y = top;
  }
  return y;
}

export interface Push { x: number; y: number; nx: number; ny: number; }

/** a disc of radius rad at (x, y) in the plane z, kept out of the reliefs: where it ends up and the normal it met, or null */
export function pushOut(x: number, y: number, z: number, rad: number): Push | null {
  let hit: Push | null = null;
  for (const r of near(x - rad, x + rad)) {
    if (z < r.z0 || z > r.z1 || y < r.y0 - rad || y > r.y1 + rad) continue;
    const c = cutAt(r, z);
    let best = Infinity, qx = 0, qy = 0;
    for (let i = 0; i < c.length; i += 4) {
      const ax = c[i], ay = c[i + 1], dx = c[i + 2] - ax, dy = c[i + 3] - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0;
      const px = ax + dx * t, py = ay + dy * t, d2 = (x - px) * (x - px) + (y - py) * (y - py);
      if (d2 < best) { best = d2; qx = px; qy = py; }
    }
    if (best === Infinity) continue;
    const inn = inside(c, x, y), d = Math.sqrt(best);
    if (!inn && d >= rad) continue;
    let nx = 0, ny = -1;
    if (d > 1e-4) { nx = (x - qx) / d; ny = (y - qy) / d; if (inn) { nx = -nx; ny = -ny; } }
    x = qx + nx * rad; y = qy + ny * rad;
    hit = { x, y, nx, ny };
  }
  return hit;
}

/** what bumps into the reliefs: the root of a creature, and its speed */
interface Body { root: { x: Float32Array; y: Float32Array; z: Float32Array; rad: Float32Array }; vx: number; vy: number; }

/** keep a creature out of the reliefs, in its own plane: it slides along them, and loses the speed that went into them */
export function bump(cr: Body): void {
  const r = cr.root, hit = pushOut(r.x[0], r.y[0], r.z[0], r.rad[0] + 3);
  if (!hit) return;
  r.x[0] = hit.x; r.y[0] = hit.y;
  const vn = cr.vx * hit.nx + cr.vy * hit.ny;
  if (vn < 0) { cr.vx -= vn * hit.nx * 1.3; cr.vy -= vn * hit.ny * 1.3; }
}

// ----- where they stand, chapter by chapter ----- //

type Slot = 'lane' | 'front' | 'back';
/** a kind of relief in a chapter: its mean spacing along x, and how often it stands in the swimming plane, in front of it, behind it */
interface Plan { kind: ReliefKind | 'faille'; every: number; lane: number; front: number; back: number; }

/** what sets each chapter apart, by biome id */
const PLANS: Record<string, Plan[]> = {
  // the nursery stays open: a few low arches far away
  nurserie: [{ kind: 'arche', every: 1500, lane: 0, front: 0, back: 1 }],
  // the kelp forest: columns of rock among the kelp, like a cathedral
  kelp: [{ kind: 'pilier', every: 300, lane: 0.25, front: 0.2, back: 0.55 }],
  // the reef: arches to swim through, grown over with coral
  recif: [{ kind: 'arche', every: 480, lane: 0.4, front: 0.15, back: 0.45 }],
  // the drop-off: ledges and overhangs to shelter under
  tombant: [{ kind: 'surplomb', every: 560, lane: 0.55, front: 0, back: 0.45 }],
  // the twilight: the floor cracks open
  crepuscule: [{ kind: 'faille', every: 1300, lane: 1, front: 0, back: 0 }, { kind: 'pilier', every: 1300, lane: 0, front: 0, back: 1 }],
  // the abyss: basalt columns far away, among the chimneys
  abysses: [{ kind: 'pilier', every: 1100, lane: 0, front: 0.1, back: 0.9 }],
  // the chapters of docs/chapitres.md, when their biome exists (the Grotte has its own vault, the Jardin no floor)
  foret: [{ kind: 'pilier', every: 300, lane: 0.25, front: 0.2, back: 0.55 }],
  carcasse: [{ kind: 'surplomb', every: 700, lane: 0.4, front: 0, back: 0.6 }],
  sources: [{ kind: 'pilier', every: 1000, lane: 0, front: 0.1, back: 0.9 }],
  // crevasses and ledges of ice
  glacier: [{ kind: 'faille', every: 1100, lane: 1, front: 0, back: 0 }, { kind: 'surplomb', every: 800, lane: 0.4, front: 0, back: 0.6 }],
  fosse: [{ kind: 'faille', every: 1000, lane: 1, front: 0, back: 0 }]
};

function slotOf(R: R01, p: Plan): Slot {
  const u = R() * (p.lane + p.front + p.back);
  return u < p.lane ? 'lane' : u < p.lane + p.front ? 'front' : 'back';
}

/** one relief of a kind at x in a slot, or null when it does not fit there */
function build(kind: ReliefKind, slot: Slot, x: number, R: R01, floor: Floor, encrust: number): Relief | null {
  const seed = seedOf(Math.round(x), kind.length * 31 + slot.length);
  const r = (a: number, b: number) => a + R() * (b - a);
  const fy = floor(x, 0);
  if (kind === 'pilier') {
    if (slot === 'lane') {
      // low enough to swim over
      const h = Math.min(r(150, 360), fy - 240);
      return h < 90 ? null : pillar(x, r(-10, 20), h, r(34, 56), floor, encrust, seed);
    }
    const z = slot === 'front' ? r(-250, -170) : r(220, 1300), rad = slot === 'front' ? r(28, 50) : r(40, 110);
    const h = Math.min(r(260, 760), floor(x, z) - 20);
    return h < 120 ? null : pillar(x, z, h, rad, floor, encrust, seed);
  }
  if (kind === 'arche') {
    if (slot === 'lane') {
      // one leg in front, one behind, the vault overhead: high enough to pass under, low enough to pass over
      const a = r(90, 140) * (R() < 0.5 ? -1 : 1), H = Math.min(r(250, 340), fy - 120), rn = r(24, 32);
      return H < 230 ? null : arch(x - a, r(-190, -150), x + a, r(170, 230), H, rn, r(30, 42), floor, encrust, seed);
    }
    const z = slot === 'front' ? r(-300, -220) : r(240, 1200), span = slot === 'front' ? r(300, 460) : r(320, 720);
    const H = Math.min(span * r(0.6, 0.95), floor(x, z) - 60), rn = r(24, 40) * (slot === 'back' ? 1.4 : 1);
    return H < 160 ? null : arch(x - span / 2, z, x + span / 2, z, H, rn, r(30, 60), floor, encrust, seed);
  }
  // an overhang
  const dir = R() < 0.5 ? -1 : 1;
  if (slot === 'lane') {
    const T = r(60, 90), W = r(110, 190), reach = r(140, 230), lip = floor(x + dir * (W / 2 + reach * 0.7), 0);
    const H = Math.max(r(230, 330), T + 140 + Math.max(0, fy - lip));
    if (fy - H < 60) return null;
    return overhang(x, -60, r(220, 420), H, W, reach, T, dir, floor, encrust, seed);
  }
  const zf = r(400, 1200), s = r(1.1, 1.6);
  const H = Math.min(r(240, 340) * s, floor(x, zf) - 40);
  return H < 200 ? null : overhang(x, zf, zf + r(200, 420), H, r(110, 190) * s, r(140, 230) * s, r(60, 90) * s, dir, floor, encrust, seed);
}

/**
 * Lay out the reliefs of every chapter (biomes along x, the world ending at
 * xEnd), away from the set pieces at `avoid` (x), the faults away from the
 * `big` ones only. The faults come first: the other reliefs stand on the
 * carved floor.
 */
export function initReliefs(biomes: readonly { id: string; x0: number; encrust: number }[], xEnd: number, floor: Floor, avoid: number[] = [], big: number[] = avoid): void {
  faults = [];
  reliefs.length = 0;
  const R = rng(8123), span = (i: number): [number, number] => [biomes[i].x0, i + 1 < biomes.length ? biomes[i + 1].x0 : xEnd];
  const clear = (x: number, m: number, l = avoid) => l.every((a) => Math.abs(a - x) > m);
  biomes.forEach((b, i) => {
    const [a, e] = span(i);
    for (const p of PLANS[b.id] || []) {
      if (p.kind !== 'faille') continue;
      for (let x = a + 400 + R() * p.every * 0.5; x < e - 400; x += p.every * (0.6 + 0.8 * R())) {
        if (clear(x, 450, big)) faults.push({ x, w: 280 + R() * 160, d: 380 + R() * 320, seed: seedOf(Math.round(x), 17) });
      }
    }
  });
  const inFault = (x: number) => faults.some((f) => Math.abs(f.x - x) < f.w + 160);
  biomes.forEach((b, i) => {
    const [a, e] = span(i);
    for (const p of PLANS[b.id] || []) {
      if (p.kind === 'faille') continue;
      let lastLane = -Infinity;
      for (let x = a + 300 + R() * p.every * 0.5; x < e - 300; x += p.every * (0.6 + 0.8 * R())) {
        let slot = slotOf(R, p);
        // nothing in the way of the swimmer on a steep slope or next to another one
        if (slot === 'lane' && (Math.abs(floor(x - 180, 0) - floor(x + 180, 0)) > 120 || x - lastLane < 480)) slot = p.back > 0 ? 'back' : 'front';
        if (slot !== 'back' && (!clear(x, 320) || inFault(x))) continue;
        if (slot === 'front' && p.front === 0) continue;
        const r = build(p.kind, slot, x, R, floor, b.encrust);
        if (!r) continue;
        reliefs.push(r);
        if (slot === 'lane') lastLane = x;
      }
    }
  });
  reliefs.sort((p, q) => p.x0 - q.x0);
  widest = reliefs.reduce((w, r) => Math.max(w, r.x1 - r.x0), 0);
}

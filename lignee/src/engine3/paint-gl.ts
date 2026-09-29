// The creatures on WebGL: the same drawing as render.ts / render3.ts (ribbons,
// plates, lines, beads, motifs, membranes, eyes, ink, light from above, the
// same levels of detail), turned into triangles for Gfx. The curves go through
// the same points as the canvas paths (the quadratic pieces through the hull,
// sampled), the caps are the same half discs, the gradients run along the same
// axes.

import type { Seg } from '../engine/creature';
import { EXTRA_MIN, INK_MIN, detail, hullOf, sheenSide } from '../engine/render';
import { hash } from '../engine/util';
import type { Creature3 } from './creature3';
import { EPS, eyeDiscs3, outside, prepare3, shimOf, type Shim } from './render3';
import type { Projector } from './view';
import type { Gfx } from './gfx';

export interface PaintOptions {
  ink?: boolean;
  shade?: boolean;
  /** 0 = deep dark water, 1 = bright shallow water: light-emitting parts are added in the dark, laid over in the light */
  water?: number;
  /** level of detail 0..2 (see render3) */
  lod?: number;
  /** screen rectangle (css px): parts entirely outside are skipped */
  clip?: [number, number, number, number];
  /** multiplies the alpha of every part */
  alpha?: number;
}

const TAU = Math.PI * 2;

// ----- scratch buffers ----- //

const N = 1024;
const SLx = new Float32Array(N), SLy = new Float32Array(N), SRx = new Float32Array(N), SRy = new Float32Array(N);
const OX = new Float32Array(N * 2), OY = new Float32Array(N * 2);
const IDX = new Uint32Array(N * 2);

let g: Gfx;
let lod = 0;
let ink = false;
let shade = true;
/** device px per css px: the thinnest line is about one device pixel */
let mw = 1;

// ----- small geometry ----- //

/** segments of a half disc or a full circle of radius r (css px) */
const segs = (r: number, full: boolean) => { const k = Math.ceil(Math.sqrt(Math.max(0, r * g.scale)) * (full ? 3 : 1.6)); return Math.max(full ? 6 : 3, Math.min(full ? 40 : 20, k)); };

/**
 * One side of a ribbon path as the canvas draws it: moveTo P0, then quadratic
 * pieces through P1..Pn-1 ending at the midpoints, lineTo Pn; sampled (1 or 3
 * points per piece). Writes into ox, oy; returns the count.
 */
function side(px: Float32Array, py: Float32Array, n: number, ox: Float32Array, oy: Float32Array, fine: Uint8Array): number {
  let m = 0;
  ox[m] = px[0]; oy[m++] = py[0];
  let sx = px[0], sy = py[0];
  for (let i = 1; i < n; i++) {
    const cx = px[i], cy = py[i], ex = (px[i] + px[i + 1]) / 2, ey = (py[i] + py[i + 1]) / 2;
    if (fine[i]) {
      for (let k = 1; k <= 3; k++) {
        const t = k / 4, u = 1 - t;
        ox[m] = u * u * sx + 2 * u * t * cx + t * t * ex; oy[m++] = u * u * sy + 2 * u * t * cy + t * t * ey;
      }
    } else { ox[m] = 0.25 * sx + 0.5 * cx + 0.25 * ex; oy[m++] = 0.25 * sy + 0.5 * cy + 0.25 * ey; }
    ox[m] = ex; oy[m++] = ey;
    sx = ex; sy = ey;
  }
  ox[m] = px[n]; oy[m++] = py[n];
  return m;
}
const FINE = new Uint8Array(N);

/** colour along a gradient axis: stops at 0, 0.5, 1 (or 0, 1 when c1 is null) */
let GX0 = 0, GY0 = 0, GDX = 0, GDY = 0, GL2 = 1;
let GC0: Float32Array, GC1: Float32Array | null, GC2: Float32Array;
function gradAxis(x0: number, y0: number, x1: number, y1: number, c0: Float32Array, c1: Float32Array | null, c2: Float32Array): void {
  GX0 = x0; GY0 = y0; GDX = x1 - x0; GDY = y1 - y0; GL2 = GDX * GDX + GDY * GDY || 1;
  GC0 = c0; GC1 = c1; GC2 = c2;
}
function gradAt(x: number, y: number): number {
  let t = ((x - GX0) * GDX + (y - GY0) * GDY) / GL2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  let a: Float32Array, b: Float32Array, u: number;
  if (GC1) { if (t < 0.5) { a = GC0; b = GC1; u = t * 2; } else { a = GC1; b = GC2; u = t * 2 - 1; } }
  else { a = GC0; b = GC2; u = t; }
  return g.pack(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u);
}

type ColFn = (x: number, y: number) => number;
let flatCol = 0;
const flat: ColFn = () => flatCol;
let mode = 0, mu = 0, mv = 0;

function vert(x: number, y: number, col: ColFn): number { return g.v(x, y, col(x, y), mu, mv, mode); }

/**
 * A ribbon as the canvas fills it: the strip between its two smoothed sides,
 * a half disc at the head and one at the tail (unless flat). Also leaves its
 * closed outline in OX, OY (returned count) for the ink.
 */
function ribbon(s: Seg, k: number, off: number, flatTail: boolean, col: ColFn, keepOutline: boolean): number {
  const n = s.n, H = hullOf(s, k, off), L = H.L, R = H.R, C = H.C;
  // finer pieces where the ribbon is large on screen
  for (let i = 1; i < n; i++) FINE[i] = lod === 0 && s.lens[i] * g.scale > 14 ? 1 : 0;
  const m = side(L.x, L.y, n, SLx, SLy, FINE);
  side(R.x, R.y, n, SRx, SRy, FINE);
  const kt = flatTail ? 0 : segs(C.r[n], false), kh = segs(C.r[0], false);
  g.reserve(m * 2 + kt + kh + 4, m * 6 + (kt + kh) * 3 + 6);
  g.shape();
  let pl = vert(SLx[0], SLy[0], col), pr = vert(SRx[0], SRy[0], col);
  const l0 = pl, r0 = pr;
  for (let j = 1; j < m; j++) {
    const a = vert(SLx[j], SLy[j], col), b = vert(SRx[j], SRy[j], col);
    g.tri(pl, pr, a); g.tri(a, pr, b);
    pl = a; pr = b;
  }
  // tail: from L[n] round the tip to R[n]
  let o = 0;
  if (keepOutline) for (let j = 0; j < m; j++) { OX[o] = SLx[j]; OY[o++] = SLy[j]; }
  if (kt) {
    const c = vert(C.x[n], C.y[n], col), a0 = C.a[n] + Math.PI / 2;
    let prev = pl;
    for (let j = 1; j < kt; j++) {
      const a = a0 - (Math.PI * j) / kt, x = C.x[n] + Math.cos(a) * C.r[n], y = C.y[n] + Math.sin(a) * C.r[n];
      const v = vert(x, y, col);
      g.tri(c, prev, v); prev = v;
      if (keepOutline) { OX[o] = x; OY[o++] = y; }
    }
    g.tri(c, prev, pr);
  }
  if (keepOutline) for (let j = m - 1; j >= 0; j--) { OX[o] = SRx[j]; OY[o++] = SRy[j]; }
  // head: from R[0] round the back to L[0]
  {
    const c = vert(C.x[0], C.y[0], col), a0 = C.a[0] - Math.PI / 2;
    let prev = r0;
    for (let j = 1; j < kh; j++) {
      const a = a0 - (Math.PI * j) / kh, x = C.x[0] + Math.cos(a) * C.r[0], y = C.y[0] + Math.sin(a) * C.r[0];
      const v = vert(x, y, col);
      g.tri(c, prev, v); prev = v;
      if (keepOutline) { OX[o] = x; OY[o++] = y; }
    }
    g.tri(c, prev, l0);
  }
  return o;
}

/**
 * A stroke along a polyline (OX, OY or any buffers), width w (css px): mitred
 * joins (limited), round caps when open. One shape.
 */
function stroke(xs: Float32Array, ys: Float32Array, n: number, closed: boolean, w: number, col: ColFn, caps = !closed): void {
  if (n < 2) return;
  const h = w / 2;
  const kc = caps ? segs(h, false) : 0;
  g.reserve(n * 2 + 2 + kc * 2 + 4, n * 6 + 6 + kc * 6);
  g.shape();
  let first = -1, pa = -1, pb = -1, fa = -1, fb = -1;
  // last direction, reused over repeated points
  let lnx = 0, lny = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    const ip = i > 0 ? i - 1 : closed ? n - 1 : -1, inx = i < n - 1 ? i + 1 : closed ? 0 : -1;
    let n0x = 0, n0y = 0, n1x = 0, n1y = 0;
    if (ip >= 0) { const dx = x - xs[ip], dy = y - ys[ip], l = Math.hypot(dx, dy); if (l > 1e-4) { n0x = -dy / l; n0y = dx / l; } }
    if (inx >= 0) { const dx = xs[inx] - x, dy = ys[inx] - y, l = Math.hypot(dx, dy); if (l > 1e-4) { n1x = -dy / l; n1y = dx / l; } }
    if (!n0x && !n0y) { n0x = n1x; n0y = n1y; }
    if (!n1x && !n1y) { n1x = n0x; n1y = n0y; }
    if (!n0x && !n0y) { n0x = n1x = lnx; n0y = n1y = lny; }
    lnx = n1x; lny = n1y;
    let mx = n0x + n1x, my = n0y + n1y;
    const ml = Math.hypot(mx, my);
    let k = h;
    if (ml > 1e-3) { mx /= ml; my /= ml; const c = mx * n1x + my * n1y; k = h / Math.max(0.5, c); } else { mx = n1x; my = n1y; }
    const a = vert(x + mx * k, y + my * k, col), b = vert(x - mx * k, y - my * k, col);
    if (pa >= 0) { g.tri(pa, pb, a); g.tri(a, pb, b); } else { fa = a; fb = b; first = i; }
    pa = a; pb = b;
  }
  if (closed) { g.tri(pa, pb, fa); g.tri(fa, pb, fb); }
  else if (caps) {
    capAt(xs[0], ys[0], xs[0] - xs[1], ys[0] - ys[1], h, kc, col);
    capAt(xs[n - 1], ys[n - 1], xs[n - 1] - xs[n - 2], ys[n - 1] - ys[n - 2], h, kc, col);
  }
  void first;
}

/** a round cap: half disc of radius h at (x, y) facing (dx, dy) */
function capAt(x: number, y: number, dx: number, dy: number, h: number, k: number, col: ColFn): void {
  const a0 = Math.atan2(dy, dx) - Math.PI / 2;
  const c = vert(x, y, col);
  let prev = vert(x + Math.cos(a0) * h, y + Math.sin(a0) * h, col);
  for (let j = 1; j <= k; j++) {
    const a = a0 + (Math.PI * j) / k, v = vert(x + Math.cos(a) * h, y + Math.sin(a) * h, col);
    g.tri(c, prev, v); prev = v;
  }
}

/** points of an ellipse into OX, OY (the canvas ellipse: centre, radii, rotation) */
function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot: number): number {
  const k = segs(Math.max(rx, ry), true), cr = Math.cos(rot), sr = Math.sin(rot);
  for (let j = 0; j < k; j++) {
    const a = (TAU * j) / k, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    OX[j] = cx + ex * cr - ey * sr; OY[j] = cy + ex * sr + ey * cr;
  }
  return k;
}

/** a filled convex polygon from OX, OY (a fan) as one shape */
function fillFan(n: number, cx: number, cy: number, col: ColFn): void {
  g.reserve(n + 1, n * 3);
  g.shape();
  const c = vert(cx, cy, col);
  for (let j = 0; j < n; j++) IDX[j] = vert(OX[j], OY[j], col);
  for (let j = 0; j < n; j++) g.tri(c, IDX[j], IDX[(j + 1) % n]);
}

export function disc(gx: Gfx, x: number, y: number, r: number, col: number): void {
  g = gx;
  flatCol = col; mode = 0;
  const k = ellipsePts(x, y, r, r, 0);
  fillFan(k, x, y, flat);
}

// ----- the parts, as render.ts draws them ----- //

function drawRibbon(s: Seg): void {
  const n = s.n, isFlat = s.def.shape === 'bell';
  const full = !s.parent || s.maxRad >= EXTRA_MIN[lod];
  const withInk = ink && !s.def.color.add && s.maxRad >= Math.max(detail.ink, s.parent ? INK_MIN[lod] : 0);
  let col: ColFn;
  if (n > 1) { gradAxis(s.x[0], s.y[0], s.x[n], s.y[n], g.css(s.cols[0]), g.css(s.cols[n >> 1]), g.css(s.cols[n])); col = gradAt; }
  else { flatCol = g.packCss(s.cols[0]); col = flat; }
  const no = ribbon(s, 1, 0, isFlat, col, withInk || (s.maxRad > 1.2 && lod < 2 && !ink && full));
  if (withInk) {
    flatCol = g.packCss(s.edgeCol);
    stroke(OX, OY, no, true, Math.max(mw * 1.3, Math.min(1.6, 0.35 + s.maxRad * 0.13)), flat);
  }
  if (s.maxRad > 1.2 && lod < 2) {
    if (!ink && full) { flatCol = g.packCss(s.edgeCol); stroke(OX, OY, no, true, Math.max(0.3, s.maxRad * 0.07), flat); }
    if (s.maxRad > detail.motif && full) drawMotif(s, isFlat);
    shadeBody(s, isFlat);
    if (s.maxRad > detail.sheen && full) { flatCol = g.packCss(s.shineCol); ribbon(s, 0.36, sheenSide(s, 0.34), isFlat, flat, false); }
  }
}

/** light from above: the outline filled with the vertical gradient of the shader (mode 2) */
function shadeBody(s: Seg, isFlat: boolean): void {
  if (!shade || s.maxRad < detail.shade || s.def.color.add) return;
  const b = s.box;
  if (b[3] - b[1] < 3) return;
  mode = 2; mu = g.d * b[1] + g.f; mv = g.d * b[3] + g.f;
  flatCol = g.pack(1, 1, 1, 1);
  ribbon(s, 1, 0, isFlat, flat, false);
  mode = 0; mu = mv = 0;
}

function drawPlates(s: Seg): void {
  if (lod >= 2) { drawRibbon(s); return; }
  const n = s.n, x = s.x, y = s.y, rad = s.rad, pl = s.pulse;
  const lw = ink ? Math.max(mw * 1.3, Math.min(1.5, 0.3 + s.maxRad * 0.12)) : Math.max(0.3, s.maxRad * 0.08);
  const edge = g.packCss(s.edgeCol), withStroke = s.maxRad >= Math.max(detail.ink, s.parent ? INK_MIN[lod] : 0);
  for (let i = n; i >= 1; i--) {
    const r = Math.max(rad[i - 1], rad[i]) * (1 + pl * (s.pulseU ? 1 : i / n));
    const cx = (x[i - 1] + x[i]) / 2, cy = (y[i - 1] + y[i]) / 2;
    const k = ellipsePts(cx, cy, s.lens[i] * 0.62 + r * 0.2, r, s.ang[i]);
    flatCol = g.packCss(s.cols[i]);
    fillFan(k, cx, cy, flat);
    if (withStroke) { flatCol = edge; stroke(OX, OY, k, true, lw, flat); }
  }
  if (lod >= 1 && s.parent && s.maxRad < EXTRA_MIN[lod]) return;
  if (s.def.color.pattern !== 'bands' && s.maxRad > detail.motif) drawMotif(s, false);
  if (s.maxRad > Math.max(1.5, detail.sheen)) {
    shadeBody(s, false);
    flatCol = g.packCss(s.shineCol);
    ribbon(s, 0.3, sheenSide(s, 0.38), false, flat, false);
  }
}

const LX = new Float32Array(N), LY = new Float32Array(N);

function drawLine(s: Seg, thin = 0): void {
  const n = s.n, x = s.x, y = s.y, rad = s.rad, c = s.def.color;
  if (c.alpha < 1 || c.add || c.fade > 0) {
    // translucent: one stroke along the smoothed chain, a gradient from the first colour to the last
    for (let i = 1; i < n; i++) FINE[i] = 0;
    const m = side(x, y, n, LX, LY, FINE);
    gradAxis(x[0], y[0], x[n], y[n], g.css(s.cols[0]), null, g.css(s.cols[n]));
    stroke(LX, LY, m, false, Math.max(mw, thin || s.maxRad * 1.5), gradAt);
    return;
  }
  if (lod === 1 && c.pattern === 'bands') {
    for (let i = 1; i <= n;) {
      let j = i;
      while (j < n && s.cols[j + 1] === s.cols[i]) j++;
      let q = 0;
      for (let k = i - 1; k <= j; k++) { LX[q] = x[k]; LY[q++] = y[k]; }
      flatCol = g.packCss(s.cols[i]);
      stroke(LX, LY, q, false, Math.max(mw, rad[i - 1] + rad[j]), flat);
      i = j + 1;
    }
    return;
  }
  if (lod >= 1) {
    for (let i = 0; i <= n; i++) { LX[i] = x[i]; LY[i] = y[i]; }
    if (lod >= 2 || n < 2) { flatCol = g.packCss(s.cols[n >> 1]); stroke(LX, LY, n + 1, false, Math.max(mw, thin || rad[0] + rad[n >> 1]), flat); }
    else { gradAxis(x[0], y[0], x[n], y[n], g.css(s.cols[0]), null, g.css(s.cols[n])); stroke(LX, LY, n + 1, false, Math.max(mw, thin || rad[0] + rad[n >> 1]), gradAt); }
    return;
  }
  for (let i = 1; i <= n; i++) {
    LX[0] = x[i - 1]; LY[0] = y[i - 1]; LX[1] = x[i]; LY[1] = y[i];
    flatCol = g.packCss(s.cols[i]);
    stroke(LX, LY, 2, false, Math.max(mw, thin || rad[i - 1] + rad[i]), flat);
  }
}

function drawDiscs(s: Seg): void {
  for (let i = s.n; i >= 0; i--) {
    const r = s.rad[i] * (1 + s.pulse * (s.pulseU ? 1 : i / s.n));
    flatCol = g.packCss(s.cols[i]);
    const k = ellipsePts(s.x[i], s.y[i], r, r, 0);
    fillFan(k, s.x[i], s.y[i], flat);
  }
}

const hx = (side: { x: Float32Array }, u: number) => { const i = Math.floor(u), f = u - i; return f ? side.x[i] + (side.x[i + 1] - side.x[i]) * f : side.x[i]; };
const hy = (side: { y: Float32Array }, u: number) => { const i = Math.floor(u), f = u - i; return f ? side.y[i] + (side.y[i + 1] - side.y[i]) * f : side.y[i]; };

function drawMotif(s: Seg, isFlat: boolean): void {
  const c = s.def.color, p = c.pattern, n = s.n;
  if (!p || p === 'none' || s.maxRad < 1) return;
  const H = hullOf(s, 1, 0), L = H.L, R = H.R, C = H.C;
  flatCol = g.packCss(s.patCol);
  if (p === 'bands') {
    const nb = Math.max(1, Math.round(c.pdensity));
    g.shape();
    for (let q = 0; q < nb; q++) {
      const u0 = ((2 * q + 1) / (2 * nb)) * n, u1 = ((2 * q + 2) / (2 * nb)) * n;
      // the band between u0 and u1: a strip between the two sides
      let m = 0;
      LX[m] = hx(L, u0); LY[m] = hy(L, u0); SRx[m] = hx(R, u0); SRy[m++] = hy(R, u0);
      for (let u = Math.floor(u0) + 1; u < u1; u++) { LX[m] = L.x[u]; LY[m] = L.y[u]; SRx[m] = R.x[u]; SRy[m++] = R.y[u]; }
      LX[m] = hx(L, u1); LY[m] = hy(L, u1); SRx[m] = hx(R, u1); SRy[m++] = hy(R, u1);
      g.reserve(m * 2, m * 6);
      let pa = g.v(LX[0], LY[0], flatCol), pb = g.v(SRx[0], SRy[0], flatCol);
      for (let j = 1; j < m; j++) { const a = g.v(LX[j], LY[j], flatCol), b = g.v(SRx[j], SRy[j], flatCol); g.tri(pa, pb, a); g.tri(a, pb, b); pa = a; pb = b; }
    }
  } else if (p === 'spots') {
    for (let i = 0; i <= n; i++) {
      for (let q = 0; q < 3; q++) {
        const id = i * 3 + q;
        if (hash(id, 7) * 12 > c.pdensity) continue;
        const u = (hash(id, 9) * 2 - 1) * 0.62, r = C.r[i] * (0.13 + 0.14 * hash(id, 11)) * c.pscale;
        if (r < 0.2) continue;
        const cx = C.x[i] + (L.x[i] - C.x[i]) * u, cy = C.y[i] + (L.y[i] - C.y[i]) * u;
        fillFan(ellipsePts(cx, cy, r, r, 0), cx, cy, flat);
      }
    }
  } else if (p === 'stripe') {
    ribbon(s, 0.2 * c.pscale, 0, isFlat, flat, false);
  } else if (p === 'ocelli') {
    const no = Math.max(1, Math.round(c.pdensity / 2)), edge = g.packCss(s.edgeCol), pat = flatCol;
    for (let q = 0; q < no; q++) {
      const i = Math.max(1, Math.min(Math.max(1, n - 1), Math.round(((q + 0.5) / no) * n)));
      const rr = C.r[i] * 0.3 * c.pscale;
      for (let sd = -1; sd <= 1; sd += 2) {
        const ex = C.x[i] + (L.x[i] - C.x[i]) * 0.5 * sd, ey = C.y[i] + (L.y[i] - C.y[i]) * 0.5 * sd;
        flatCol = edge; fillFan(ellipsePts(ex, ey, rr, rr, 0), ex, ey, flat);
        flatCol = pat; fillFan(ellipsePts(ex, ey, rr * 0.68, rr * 0.68, 0), ex, ey, flat);
        flatCol = edge; fillFan(ellipsePts(ex, ey, rr * 0.26, rr * 0.26, 0), ex, ey, flat);
      }
    }
  } else if (p === 'edge') {
    const no = ribbon(s, 1, 0, isFlat, () => 0, true);
    flatCol = g.packCss(s.patCol);
    stroke(OX, OY, no, true, s.maxRad * 0.2 * c.pscale, flat);
  }
}

/** membrane between two neighbour copies: a strip between their chains, the trailing edge scalloped toward the base */
function webPair(A: Seg, B: Seg, f: number): void {
  const ma = Math.max(1, Math.round(A.n * f)), mb = Math.max(1, Math.round(B.n * f));
  const mx = (A.x[ma] + B.x[mb]) / 2, my = (A.y[ma] + B.y[mb]) / 2;
  const bx = (A.x[0] + B.x[0]) / 2, by = (A.y[0] + B.y[0]) / 2;
  const cx = mx + (bx - mx) * 0.3, cy = my + (by - my) * 0.3;
  // the scallop at its middle (the canvas quadratic from A[ma] to B[mb])
  const qx = 0.25 * A.x[ma] + 0.5 * cx + 0.25 * B.x[mb], qy = 0.25 * A.y[ma] + 0.5 * cy + 0.25 * B.y[mb];
  const m = Math.max(ma, mb);
  flatCol = g.packCss(A.webCol);
  g.reserve(m * 2 + 4, m * 6 + 6);
  g.shape();
  const at = (S: Seg, ms: number, j: number, out: 0 | 1) => { const u = (j / m) * ms, i = Math.floor(u), t = u - i, i1 = Math.min(ms, i + 1); return out ? S.y[i] + (S.y[i1] - S.y[i]) * t : S.x[i] + (S.x[i1] - S.x[i]) * t; };
  let pa = g.v(at(A, ma, 0, 0), at(A, ma, 0, 1), flatCol), pb = g.v(at(B, mb, 0, 0), at(B, mb, 0, 1), flatCol);
  for (let j = 1; j < m; j++) {
    const a = g.v(at(A, ma, j, 0), at(A, ma, j, 1), flatCol), b = g.v(at(B, mb, j, 0), at(B, mb, j, 1), flatCol);
    g.tri(pa, pb, a); g.tri(a, pb, b); pa = a; pb = b;
  }
  // last piece: to the tips, pulled in at the middle
  const ta = g.v(A.x[ma], A.y[ma], flatCol), tb = g.v(B.x[mb], B.y[mb], flatCol), q = g.v(qx, qy, flatCol);
  g.tri(pa, ta, q); g.tri(pa, q, pb); g.tri(pb, q, tb);
}

function drawWebs(s: Shim, front: boolean, base: number): void {
  const ch = s.children;
  for (const a of s.def.attach) {
    if (!(a.web > 0) || !!a.front !== front) continue;
    const pos: Shim[] = [], neg: Shim[] = [];
    for (const c of ch) if (c.att === a) (c.side < 0 ? neg : pos).push(c);
    // (as the canvas: a glowing membrane is always added, whatever the water)
    g.alpha = base;
    g.setBlend(a.node.color.add ? 'add' : 'over');
    for (const gr of [pos, neg]) {
      gr.sort((p, q) => p.k - q.k);
      const ring = a.pattern === 'ring' && gr.length > 2;
      for (let j = 0; j < gr.length - (ring ? 0 : 1); j++) {
        const A = gr[j], B = gr[(j + 1) % gr.length];
        if (B.k - A.k === 1 || (ring && A.k === a.count - 1 && B.k === 0)) webPair(A as unknown as Seg, B as unknown as Seg, a.web);
      }
    }
  }
}

function drawEye(s: Seg): void {
  const n = s.n, er = s.def.width * s.scale;
  drawLine(s, Math.max(0.35, er * 0.45));
  const ex = s.x[n], ey = s.y[n];
  flatCol = g.packCss('#05060c');
  fillFan(ellipsePts(ex, ey, er, er, 0), ex, ey, flat);
  flatCol = g.packCss(s.cols[n]);
  stroke(OX, OY, ellipsePts(ex, ey, er * 0.78, er * 0.78, 0), true, er * 0.3, flat);
  const hx2 = ex - er * 0.3, hy2 = ey - er * 0.3;
  flatCol = g.packCss('rgba(255,255,255,0.9)');
  fillFan(ellipsePts(hx2, hy2, er * 0.26, er * 0.26, 0), hx2, hy2, flat);
}

function drawSelf(s: Shim, base: number, addScale: number, addOver: boolean): void {
  const d = s.def, me = s as unknown as Seg;
  g.alpha = base * (d.color.add ? addScale : 1);
  g.setBlend(d.color.add && !addOver ? 'add' : 'over');
  switch (d.style) {
    case 'ribbon': drawRibbon(me); break;
    case 'plates': drawPlates(me); break;
    case 'line': drawLine(me); break;
    case 'eye': drawEye(me); break;
    default: drawDiscs(me);
  }
}

/** at level 2, long rows of copies keep one in two (as render3) */
const thinnedGL = (c: Shim) => lod >= 2 && !!c.att && c.att.count >= 6 && !(c.att.web > 0) && (c.k & 1) === 1;

function tree(sh: Shim, base: number, addScale: number, addOver: boolean, clip?: [number, number, number, number]): void {
  const ch = sh.children;
  drawWebs(sh, false, base);
  for (const c of ch) if ((c.key > sh.key + EPS || (Math.abs(c.key - sh.key) <= EPS && !c.att?.front)) && !thinnedGL(c)) tree(c, base, addScale, addOver, clip);
  if (!outside(sh.box, clip)) drawSelf(sh, base, addScale, addOver);
  drawWebs(sh, true, base);
  for (const c of ch) if (!(c.key > sh.key + EPS || (Math.abs(c.key - sh.key) <= EPS && !c.att?.front)) && !thinnedGL(c)) tree(c, base, addScale, addOver, clip);
}

/** the eyes on the head (render3's), as ellipses leaning toward their side */
function eyes(cr: Creature3, view: Projector, simple: boolean, base: number): void {
  g.setBlend('over');
  eyeDiscs3(cr, view, (px, py, rr, lean, vf, fx, fy, look) => {
    g.alpha = base * vf;
    const white = g.packCss('#fbf6ec'), dark = g.packCss('#05080f');
    if (simple) {
      flatCol = white; fillFan(ellipsePts(px, py, rr, rr, 0), px, py, flat);
      flatCol = dark; fillFan(ellipsePts(px, py, rr * 0.56, rr * 0.56, 0), px, py, flat);
      return;
    }
    // the canvas transform: translate, rotate(lean), scale(sx, 1), rotate(-lean)
    const sx = 0.28 + 0.72 * vf, cl = Math.cos(lean), sl = Math.sin(lean);
    const m00 = cl * cl * sx + sl * sl, m01 = cl * sl * sx - sl * cl, m11 = sl * sl * sx + cl * cl;
    const disc2 = (ox: number, oy: number, r: number) => {
      const k = segs(r, true);
      for (let j = 0; j < k; j++) {
        const a = (TAU * j) / k, x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
        OX[j] = px + m00 * x + m01 * y; OY[j] = py + m01 * x + m11 * y;
      }
      return k;
    };
    let k = disc2(0, 0, rr);
    flatCol = white; fillFan(k, px, py, flat);
    flatCol = g.packCss('rgba(10,14,24,0.55)');
    stroke(OX, OY, k, true, Math.max(0.6, rr * 0.16) * (0.5 + 0.5 * sx), flat);
    const pxo = fx * rr * 0.34 * look, pyo = fy * rr * 0.34 * look;
    k = disc2(pxo, pyo, rr * 0.56);
    flatCol = dark; fillFan(k, px + m00 * pxo + m01 * pyo, py + m01 * pxo + m11 * pyo, flat);
    const hxo = fx * rr * 0.1 - rr * 0.18, hyo = fy * rr * 0.1 - rr * 0.22;
    k = disc2(hxo, hyo, rr * 0.2);
    flatCol = g.packCss('rgba(255,255,255,0.95)'); fillFan(k, px + m00 * hxo + m01 * hyo, py + m01 * hxo + m11 * hyo, flat);
  });
}

/**
 * Draw an animal (or a live plant) with Gfx. Call prepare3 first to choose its
 * level (or pass `project` to project it here). The transform of `gx` must map
 * css px to the screen.
 */
export function paint3(gx: Gfx, cr: Creature3, view: Projector, o: PaintOptions = {}, project = false): void {
  g = gx;
  if (project) prepare3(cr, view);
  const root = shimOf(cr);
  if (!root) return;
  lod = o.lod || 0;
  ink = !!o.ink;
  shade = o.shade !== false;
  mw = 1.1 / Math.max(0.01, g.scale);
  mode = 0; mu = mv = 0;
  const w = o.water === undefined ? 0 : o.water, base = o.alpha === undefined ? 1 : o.alpha;
  // in bright water, light-emitting parts would burn to white: laid over as plain translucent colour
  const addOver = w > 0.3, addScale = w > 0.3 ? 0.9 : 0.55;
  tree(root, base, addScale, addOver, o.clip);
  eyes(cr, view, lod >= 2, base);
  g.alpha = 1;
  g.setBlend('over');
}

/** a polyline stroke of one colour (the scenery: surface waves, rims of the floor) */
export function strokeLine(gx: Gfx, xs: Float32Array, ys: Float32Array, n: number, closed: boolean, w: number, col: number): void {
  g = gx;
  flatCol = col; mode = 0;
  stroke(xs, ys, n, closed, w, flat);
}

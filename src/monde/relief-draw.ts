// Drawing the composed reliefs (relief.ts). Each is projected vertex by
// vertex; its faces turned away from the eye are dropped and the others are
// painted from far to near, lit from above and washed by the water like the
// rest. A relief is cut in slices along z, each sorted with the rest of the
// scene: the swimmer passes behind the front leg of an arch, under its vault,
// in front of its other leg.

import { clamp, lerp, lerpHue, noise1, rng } from '../engine';
import { hsl01, type Gfx } from '../engine3/gfx';
import type { Proj, View } from '../engine3/view';
import { moodAt } from './biomes';
import { waterAt, type HSL } from './palette';
import { reliefsIn, type Relief } from './relief';
import { fogOf } from './sprites';

export interface ReliefScene { view: View; gx: Gfx | null; ctx: CanvasRenderingContext2D; dpr: number; plane: number; }
type Item = { d: number; fn: () => void; k?: string };

/** faces of a relief grouped by depth: each group is one item of the scene */
interface Slice { faces: number[]; cap: boolean; z0: number; z1: number; y0: number; y1: number; front: boolean; }

interface Look {
  /** lit colour of each quad and of the front face (r, g, b in 0..1) */
  col: Float32Array; capTop: number[]; capBot: number[];
  ink: HSL;
  /** middle of each quad */
  mid: Float32Array;
  /** polyps on the faces covered with life: x, y, z, radius, colour index (DOTS per polyp), those of face f from dot0[f] to dot0[f + 1] */
  dots: Float32Array; dot0: Uint32Array;
  /** colours of the polyps (r, g, b), and as css */
  dotCol: number[][];
  slices: Slice[];
  /** projected vertices (css px) */
  sx: Float32Array; sy: Float32Array;
  /** faces seen this frame, and their depth */
  seen: Uint8Array; depth: Float32Array;
}
const looks = new WeakMap<Relief, Look>();

/** toward the light: from above, a little from the front and the left */
const LX = -0.3, LY = -1, LZ = -0.5, LL = Math.hypot(LX, LY, LZ);
/** slices of a relief along z (the swimming plane is always a border) */
const SLICE = 150;
const DOTS = 5;

function lookOf(r: Relief): Look {
  let lk = looks.get(r);
  if (lk) return lk;
  const m = moodAt(r.x), R = rng(r.seed), nf = r.quads.length / 4, p = r.p, q = r.quads;
  const col = new Float32Array(nf * 3), mid = new Float32Array(nf * 3), dots: number[] = [], dot0 = new Uint32Array(nf + 1);
  const bins = new Map<number, Slice>();
  for (let f = 0; f < nf; f++) {
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < 4; k++) { const v = q[f * 4 + k] * 3; cx += p[v] / 4; cy += p[v + 1] / 4; cz += p[v + 2] / 4; }
    mid[f * 3] = cx; mid[f * 3 + 1] = cy; mid[f * 3 + 2] = cz;
    const nx = r.n[f * 3], ny = r.n[f * 3 + 1], nz = r.n[f * 3 + 2];
    const lit = Math.max(0, (nx * LX + ny * LY + nz * LZ) / LL);
    // darker down by the floor, bands of strata along a pillar
    const low = clamp((r.y1 - cy) / 160, 0, 1), band = r.kind === 'pilier' ? (Math.floor(f / r.nu) % 2 ? 2.5 : -2.5) : 0;
    let c: HSL = m.rock, l = m.rock.l - 12 + lit * 26 + (R() - 0.5) * 6 + band - (1 - low) * 7;
    // life on what faces up, in patches over a few faces: the rock takes a little of its colour, polyps dot it
    dot0[f] = dots.length / DOTS;
    if (ny < -0.35 && noise1(cx / 70 + cz / 90, r.seed) < r.encrust * 0.75) {
      const ai = Math.floor(noise1(cx / 160 + cz / 140 + 9, r.seed) * m.accents.length * 0.999), a = m.accents[ai], k = 0.1 + 0.18 * noise1(cx / 40, r.seed + 1);
      c = { h: lerpHue(m.rock.h, a.h, k), s: lerp(m.rock.s, a.s, k), l: 0 };
      l = lerp(l, a.l - 8 + lit * 10, k);
      const o = f * 4, v0 = q[o] * 3, v1 = q[o + 1] * 3, v2 = q[o + 2] * 3, v3 = q[o + 3] * 3;
      const area = Math.hypot((p[v2 + 1] - p[v0 + 1]) * (p[v3 + 2] - p[v1 + 2]) - (p[v2 + 2] - p[v0 + 2]) * (p[v3 + 1] - p[v1 + 1]),
        (p[v2 + 2] - p[v0 + 2]) * (p[v3] - p[v1]) - (p[v2] - p[v0]) * (p[v3 + 2] - p[v1 + 2]), (p[v2] - p[v0]) * (p[v3 + 1] - p[v1 + 1]) - (p[v2 + 1] - p[v0 + 1]) * (p[v3] - p[v1])) / 2;
      for (let k2 = Math.min(6, Math.round((area / 420) * r.encrust)); k2 > 0; k2--) {
        const u = 0.12 + R() * 0.76, w = 0.12 + R() * 0.76;
        for (let e = 0; e < 3; e++) {
          const b0 = p[v0 + e] + (p[v1 + e] - p[v0 + e]) * u, b1 = p[v3 + e] + (p[v2 + e] - p[v3 + e]) * u;
          dots.push(b0 + (b1 - b0) * w + r.n[f * 3 + e] * 1.5);
        }
        dots.push(1.2 + R() * 2, R() < 0.7 ? ai : Math.floor(R() * m.accents.length));
      }
    }
    const [cr, cg, cb] = hsl01(c.h, c.s, l);
    col[f * 3] = cr; col[f * 3 + 1] = cg; col[f * 3 + 2] = cb;
    const key = cz < 0 ? -1 - Math.floor(-cz / SLICE) : Math.floor(cz / SLICE);
    let s = bins.get(key);
    if (!s) { s = { faces: [], cap: false, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity, front: cz < 0 }; bins.set(key, s); }
    s.faces.push(f);
    for (let k = 0; k < 4; k++) {
      const v = q[f * 4 + k] * 3;
      s.z0 = Math.min(s.z0, p[v + 2]); s.z1 = Math.max(s.z1, p[v + 2]); s.y0 = Math.min(s.y0, p[v + 1]); s.y1 = Math.max(s.y1, p[v + 1]);
    }
  }
  dot0[nf] = dots.length / DOTS;
  const slices = [...bins.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  // the front face belongs to the nearest slice
  if (r.cap && slices.length) slices[0].cap = true;
  lk = {
    col, mid, slices, ink: { h: m.rock.h, s: m.rock.s, l: 9 },
    dots: new Float32Array(dots), dot0, dotCol: m.accents.map((a) => hsl01(lerpHue(a.h, m.rock.h, 0.15), a.s * 0.8, a.l)),
    capTop: hsl01(m.rock.h, m.rock.s, m.rock.l + 4), capBot: hsl01(m.rock.h, m.rock.s, m.rock.l - 12),
    sx: new Float32Array(p.length / 3), sy: new Float32Array(p.length / 3), seen: new Uint8Array(nf), depth: new Float32Array(nf)
  };
  looks.set(r, lk);
  return lk;
}

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };

/** project a relief and find the faces that look at the eye */
function project(r: Relief, lk: Look, v: View): void {
  const p = r.p;
  for (let i = 0, k = 0; i < p.length; i += 3, k++) { v.project(p[i], p[i + 1], p[i + 2], P); lk.sx[k] = P.x; lk.sy[k] = P.y; }
  const mid = lk.mid, n = r.n;
  for (let f = 0; f < lk.seen.length; f++) {
    const x = mid[f * 3], y = mid[f * 3 + 1], z = mid[f * 3 + 2];
    lk.seen[f] = n[f * 3] * (v.cx - x) + n[f * 3 + 1] * (v.cy - y) + n[f * 3 + 2] * (v.cz - z) > 0 ? 1 : 0;
    lk.depth[f] = v.depth(y, z);
  }
}

/**
 * The slices of the reliefs in view, as items of the scene. A slice touching
 * the swimming plane is drawn behind (or in front of) everything that swims
 * in it near the eye; the others sort by their nearest point.
 */
export function pushReliefs(items: Item[], sc: ReliefScene, camX: number, camY: number): void {
  const v = sc.view;
  for (const r of reliefsIn(camX - 2800, camX + 2800)) {
    const [a, b] = v.xRange(r.z1, 80);
    if (r.x1 < a || r.x0 > b || r.z1 < v.cz + 60) continue;
    const lk = lookOf(r);
    project(r, lk, v);
    for (const s of lk.slices) {
      const lane = s.z0 < 60 && s.z1 > -60;
      const d = s.front
        ? v.depth(lane ? Math.min(s.y0, camY - 250) : s.y0, Math.min(s.z1, 0))
        : v.depth(lane ? Math.max(s.y1, camY + 250) : s.y1, Math.max(s.z0, 0));
      items.push({ d, fn: () => drawSlice(r, lk, s, sc), k: 'relief' });
    }
  }
}

const order: number[] = [], edges: number[] = [], RGB = new Float32Array(3);
const q6 = (c: number) => Math.round(c * 42.5) * 6;

function drawSlice(r: Relief, lk: Look, s: Slice, sc: ReliefScene): void {
  const v = sc.view, g = sc.gx, ctx = sc.ctx, q = r.quads, X = lk.sx, Y = lk.sy;
  const ym = (s.y0 + s.y1) / 2, zm = (s.z0 + s.z1) / 2, dm = v.depth(ym, zm);
  const fog = fogOf(dm, sc.plane), [wr, wg, wb] = (() => { const w = waterAt(moodAt(r.x), ym * 0.5 + zm * 0.3); return hsl01(w.h, w.s, w.l); })();
  // what comes too near the eye fades away
  let near = Infinity;
  for (const f of s.faces) near = Math.min(near, lk.depth[f]);
  const alpha = clamp((near - 140) / 220, 0, 1);
  if (alpha <= 0.01) return;
  order.length = 0;
  for (const f of s.faces) if (lk.seen[f]) order.push(f);
  order.sort((a, b) => lk.depth[b] - lk.depth[a]);
  const mix = (c: ArrayLike<number>, o: number): Float32Array => {
    RGB[0] = c[o] + (wr - c[o]) * fog; RGB[1] = c[o + 1] + (wg - c[o + 1]) * fog; RGB[2] = c[o + 2] + (wb - c[o + 2]) * fog;
    return RGB;
  };
  const inkA = 0.55 * (1 - fog) * alpha, [ir, ig, ib] = hsl01(lk.ink.h, lk.ink.s, lk.ink.l);
  if (g) {
    g.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
    for (const f of order) {
      const k3 = mix(lk.col, f * 3), c = g.pack(k3[0], k3[1], k3[2], alpha);
      g.reserve(4, 6);
      g.shape();
      const o = f * 4, i0 = g.v(X[q[o]], Y[q[o]], c), i1 = g.v(X[q[o + 1]], Y[q[o + 1]], c), i2 = g.v(X[q[o + 2]], Y[q[o + 2]], c), i3 = g.v(X[q[o + 3]], Y[q[o + 3]], c);
      g.tri(i0, i1, i2); g.tri(i0, i2, i3);
      if (lk.dot0[f + 1] > lk.dot0[f]) dotsGL(g, lk, f, v, mix, alpha);
    }
    if (s.cap && r.cap) {
      const rim = r.rim!, top = [...mix(lk.capTop, 0)], bot = [...mix(lk.capBot, 0)], span = r.y1 - r.y0 || 1;
      g.reserve(rim.length, r.cap.length);
      g.shape();
      let first = -1;
      for (const i of rim) {
        const u = clamp((r.p[i * 3 + 1] - r.y0) / span, 0, 1);
        const k = g.v(X[i], Y[i], g.pack(top[0] + (bot[0] - top[0]) * u, top[1] + (bot[1] - top[1]) * u, top[2] + (bot[2] - top[2]) * u, alpha));
        if (first < 0) first = k;
      }
      for (let k = 0; k < r.cap.length; k += 3) g.tri(first + r.cap[k], first + r.cap[k + 1], first + r.cap[k + 2]);
    }
    if (inkA > 0.02) {
      if (s.cap && r.marks) { marks(r, v); linesGL(g, MX, MY, MX.length, 0.5, g.pack(ir, ig, ib, inkA * 0.45)); }
      edges.length = 0;
      eachInk(r, lk, s, (a, b) => { edges.push(X[a], Y[a], X[b], Y[b]); });
      EX.length = EY.length = 0;
      for (let k = 0; k < edges.length; k += 4) EX.push(edges[k], edges[k + 2]), EY.push(edges[k + 1], edges[k + 3]);
      linesGL(g, EX, EY, EX.length, 0.65, g.pack(ir, ig, ib, inkA));
    }
    return;
  }
  ctx.setTransform(sc.dpr, 0, 0, sc.dpr, 0, 0);
  ctx.globalAlpha = alpha;
  // faces of one colour in one path (a path has a fixed price on the canvas)
  let cur = '';
  for (const f of order) {
    // rounded, so that more neighbours share a colour
    const k3 = mix(lk.col, f * 3), css = `rgb(${q6(k3[0])},${q6(k3[1])},${q6(k3[2])})`;
    if (css !== cur) { if (cur) ctx.fill(); ctx.fillStyle = cur = css; ctx.beginPath(); }
    const o = f * 4;
    ctx.moveTo(X[q[o]], Y[q[o]]); ctx.lineTo(X[q[o + 1]], Y[q[o + 1]]); ctx.lineTo(X[q[o + 2]], Y[q[o + 2]]); ctx.lineTo(X[q[o + 3]], Y[q[o + 3]]); ctx.closePath();
  }
  if (cur) ctx.fill();
  dotsCanvas(ctx, lk, v, mix);
  if (s.cap && r.cap) {
    const rim = r.rim!, top = [...mix(lk.capTop, 0)], bot = [...mix(lk.capBot, 0)];
    v.project(r.x, r.y0, r.z0, P);
    const ya = P.y;
    v.project(r.x, r.y1, r.z0, P);
    const gr = ctx.createLinearGradient(0, ya, 0, Math.max(ya + 1, P.y));
    gr.addColorStop(0, `rgb(${(top[0] * 255) | 0},${(top[1] * 255) | 0},${(top[2] * 255) | 0})`);
    gr.addColorStop(1, `rgb(${(bot[0] * 255) | 0},${(bot[1] * 255) | 0},${(bot[2] * 255) | 0})`);
    ctx.fillStyle = gr;
    ctx.beginPath();
    rim.forEach((i, k) => (k ? ctx.lineTo(X[i], Y[i]) : ctx.moveTo(X[i], Y[i])));
    ctx.closePath();
    ctx.fill();
  }
  if (inkA > 0.02) {
    ctx.strokeStyle = `rgb(${(ir * 255) | 0},${(ig * 255) | 0},${(ib * 255) | 0})`;
    ctx.lineJoin = 'round';
    if (s.cap && r.marks) {
      marks(r, v);
      ctx.globalAlpha = inkA * alpha * 0.45;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < MX.length; k += 2) { ctx.moveTo(MX[k], MY[k]); ctx.lineTo(MX[k + 1], MY[k + 1]); }
      ctx.stroke();
    }
    ctx.globalAlpha = inkA * alpha;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    eachInk(r, lk, s, (a, b) => { ctx.moveTo(X[a], Y[a]); ctx.lineTo(X[b], Y[b]); });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

const MX: number[] = [], MY: number[] = [], EX: number[] = [], EY: number[] = [];

/** the polyps of face f, small hexagons in one shape */
function dotsGL(g: Gfx, lk: Look, f: number, v: View, mix: (c: ArrayLike<number>, o: number) => Float32Array, alpha: number): void {
  const d = lk.dots, a = lk.dot0[f], b = lk.dot0[f + 1];
  g.reserve((b - a) * 7, (b - a) * 18);
  g.shape();
  for (let i = a; i < b; i++) {
    const o = i * DOTS;
    v.project(d[o], d[o + 1], d[o + 2], P);
    const rad = d[o + 3] * P.s;
    if (rad < 0.4) continue;
    const k3 = mix(lk.dotCol[d[o + 4]], 0), c = g.pack(k3[0], k3[1], k3[2], alpha), ctr = g.v(P.x, P.y, c);
    for (let k = 0; k < 6; k++) g.v(P.x + HEX[k * 2] * rad, P.y + HEX[k * 2 + 1] * rad, c);
    for (let k = 0; k < 6; k++) g.tri(ctr, ctr + 1 + k, ctr + 1 + ((k + 1) % 6));
  }
}
const HEX = Array.from({ length: 12 }, (_, k) => (k & 1 ? Math.sin : Math.cos)(((k >> 1) / 6) * Math.PI * 2));

/** the polyps of the faces seen, one path per colour */
function dotsCanvas(ctx: CanvasRenderingContext2D, lk: Look, v: View, mix: (c: ArrayLike<number>, o: number) => Float32Array): void {
  if (!lk.dots.length) return;
  const d = lk.dots;
  for (let ci = 0; ci < lk.dotCol.length; ci++) {
    let open = false;
    for (const f of order) {
      for (let i = lk.dot0[f]; i < lk.dot0[f + 1]; i++) {
        const o = i * DOTS;
        if (d[o + 4] !== ci) continue;
        v.project(d[o], d[o + 1], d[o + 2], P);
        const rad = d[o + 3] * P.s;
        if (rad < 0.4) continue;
        if (!open) { const k3 = mix(lk.dotCol[ci], 0); ctx.fillStyle = `rgb(${(k3[0] * 255) | 0},${(k3[1] * 255) | 0},${(k3[2] * 255) | 0})`; ctx.beginPath(); open = true; }
        ctx.moveTo(P.x + rad, P.y); ctx.arc(P.x, P.y, rad, 0, Math.PI * 2);
      }
    }
    if (open) ctx.fill();
  }
}

/** the strata of the front face, projected (pairs of points) */
function marks(r: Relief, v: View): void {
  const m = r.marks!;
  MX.length = MY.length = 0;
  for (let k = 0; k < m.length; k += 2) { v.project(m[k], m[k + 1], r.z0 - 0.5, P); MX.push(P.x); MY.push(P.y); }
}

/** segments (pairs of points) as thin quads, in one shape: one coverage per pixel where they cross */
function linesGL(g: Gfx, X: number[], Y: number[], n: number, w: number, c: number): void {
  if (n < 2) return;
  g.reserve(n * 2, n * 3);
  g.shape();
  for (let k = 0; k + 1 < n; k += 2) {
    const ax = X[k], ay = Y[k], bx = X[k + 1], by = Y[k + 1], l = Math.hypot(bx - ax, by - ay) || 1;
    const ox = ((ay - by) / l) * w, oy = ((bx - ax) / l) * w, ex = ((bx - ax) / l) * w, ey = ((by - ay) / l) * w;
    const i0 = g.v(ax + ox - ex, ay + oy - ey, c), i1 = g.v(bx + ox + ex, by + oy + ey, c), i2 = g.v(bx - ox + ex, by - oy + ey, c), i3 = g.v(ax - ox - ex, ay - oy - ey, c);
    g.tri(i0, i1, i2); g.tri(i0, i2, i3);
  }
}

/**
 * The outline of a slice: the edges between a face seen and a face turned
 * away, and the outline of the front face but its foot. Open ends (the feet
 * on the floor, the tip of a pillar) are not outlined.
 */
function eachInk(r: Relief, lk: Look, s: Slice, edge: (a: number, b: number) => void): void {
  const nu = r.nu, rows = r.quads.length / 4 / nu, q = r.quads;
  for (const f of s.faces) {
    if (!lk.seen[f]) continue;
    const i = f % nu, j = (f - i) / nu;
    // the four neighbours, with the edge shared with each (a quad is a, b, c, d or a, d, c, b when turned)
    const around = [j > 0 ? f - nu : -1, (j * nu) + ((i + 1) % nu), j + 1 < rows ? f + nu : -1, (j * nu) + ((i + nu - 1) % nu)];
    for (const g of around) {
      if (g < 0 || lk.seen[g]) continue;
      // the two vertices both faces share
      let a = -1, b = -1;
      for (let k = 0; k < 4; k++) {
        const v = q[f * 4 + k];
        if (q[g * 4] === v || q[g * 4 + 1] === v || q[g * 4 + 2] === v || q[g * 4 + 3] === v) { if (a < 0) a = v; else b = v; }
      }
      if (b >= 0) edge(a, b);
    }
  }
  // the last edge of the outline is its foot, on the floor
  if (s.cap && r.rim) for (let k = 0; k + 1 < r.rim.length; k++) edge(r.rim[k], r.rim[k + 1]);
}

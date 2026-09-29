// Scenery primitives of the big world on WebGL (Gfx): the canvas gradients
// as vertex colours (exact for linear stops), radial gradients as rings, the
// small sprites gathered in atlases so that a school of fish or the glows of a
// frame are one draw call.

import { Gfx, hsl01 } from '../engine3/gfx';
import { glowSprite, makeCanvas } from '../game/bake';
import type { HSL, Mood } from '../game/palette';
import type { Proj, View } from '../engine3/view';
import { strokeLine } from '../engine3/paint-gl';

/** a colour of the palette, as css(c, a, dl) would give it, packed for Gfx */
export function hcol(g: Gfx, c: HSL, a = 1, dl = 0): number {
  const [r, gg, b] = hsl01(c.h, c.s, c.l + dl);
  return g.pack(r, gg, b, a);
}

/** a rectangle filled with a vertical gradient: stops at y (css px), colours packed */
export function vGradRect(g: Gfx, x0: number, x1: number, ys: number[], cols: number[]): void {
  const n = ys.length;
  g.reserve(n * 2, (n - 1) * 6);
  g.shape();
  let pa = g.v(x0, ys[0], cols[0]), pb = g.v(x1, ys[0], cols[0]);
  for (let i = 1; i < n; i++) {
    const a = g.v(x0, ys[i], cols[i]), b = g.v(x1, ys[i], cols[i]);
    g.tri(pa, pb, a); g.tri(a, pb, b);
    pa = a; pb = b;
  }
}

/**
 * A radial gradient as rings around (cx, cy): radii and packed colours per
 * stop (a first radius of 0 is the centre); the last colour is carried out to
 * `outer` when given (to cover the screen). Inside a first radius > 0 nothing
 * is drawn (the stops used here are transparent there).
 */
export function rings(g: Gfx, cx: number, cy: number, radii: number[], cols: number[], outer = 0, seg = 48): void {
  const rad = outer ? [...radii, outer] : radii, cs = outer ? [...cols, cols[cols.length - 1]] : cols;
  g.reserve(rad.length * seg + 1, rad.length * seg * 6);
  g.shape();
  let centre = -1, prev = -1;
  for (let k = 0; k < rad.length; k++) {
    if (k === 0 && rad[0] <= 0.01) { centre = g.v(cx, cy, cs[0]); continue; }
    const start = g.v(cx + rad[k], cy, cs[k]);
    for (let j = 1; j < seg; j++) { const a = (Math.PI * 2 * j) / seg; g.v(cx + Math.cos(a) * rad[k], cy + Math.sin(a) * rad[k], cs[k]); }
    for (let j = 0; j < seg; j++) {
      const b0 = start + j, b1 = start + ((j + 1) % seg);
      if (prev >= 0) { const a0 = prev + j, a1 = prev + ((j + 1) % seg); g.tri(a0, a1, b0); g.tri(b0, a1, b1); }
      else if (centre >= 0) g.tri(centre, b0, b1);
    }
    prev = start;
  }
}

/** a filled polygon between a top line and a bottom line (same x count), colour by y */
export function band(g: Gfx, tx: ArrayLike<number>, ty: ArrayLike<number>, bx: ArrayLike<number>, by: ArrayLike<number>, n: number, col: (y: number) => number): void {
  g.reserve(n * 2, (n - 1) * 6);
  g.shape();
  let pa = g.v(tx[0], ty[0], col(ty[0])), pb = g.v(bx[0], by[0], col(by[0]));
  for (let i = 1; i < n; i++) {
    const a = g.v(tx[i], ty[i], col(ty[i])), b = g.v(bx[i], by[i], col(by[i]));
    g.tri(pa, pb, a); g.tri(a, pb, b);
    pa = a; pb = b;
  }
}

// ----- atlases ----- //

/** all the glow sprites (one per 15° of hue) side by side */
let glowAtlas: HTMLCanvasElement | null = null;
export function glows(): HTMLCanvasElement {
  if (glowAtlas) return glowAtlas;
  const c = makeCanvas(64 * 24, 64), x = c.getContext('2d')!;
  for (let k = 0; k < 24; k++) x.drawImage(glowSprite(k * 15), k * 64, 0);
  glowAtlas = c;
  return c;
}
export const glowTile = (hue: number) => Math.round((((hue % 360) + 360) % 360) / 15) % 24;

/** the frames of a school's fish side by side */
const fishAtlases = new WeakMap<HTMLCanvasElement[], HTMLCanvasElement>();
export function fishAtlas(frames: HTMLCanvasElement[]): HTMLCanvasElement {
  let c = fishAtlases.get(frames);
  if (c) return c;
  const w = frames[0].width, h = frames[0].height;
  c = makeCanvas(w * frames.length, h);
  const x = c.getContext('2d')!;
  frames.forEach((f, i) => x.drawImage(f, i * w, 0));
  fishAtlases.set(frames, c);
  return c;
}

// ----- the pieces of a 2.5D scene (shared by the big world and the prototype) ----- //


type WaterAt = (m: Mood, y: number) => HSL;
const X2 = new Float32Array(64), Y2 = new Float32Array(64), X3 = new Float32Array(64), Y3 = new Float32Array(64);
const P: Proj = { x: 0, y: 0, s: 1, d: 1 }, Q: Proj = { x: 0, y: 0, s: 1, d: 1 };
const cl = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** the water behind everything: five stops down the screen */
export function waterGL(g: Gfx, m: Mood, waterAt: WaterAt, camY: number, W: number, H: number): void {
  const ys: number[] = [], cs: number[] = [];
  for (let i = 0; i <= 4; i++) { ys.push((H * i) / 4); cs.push(hcol(g, waterAt(m, camY * 0.7 + (i / 4 - 0.4) * 500))); }
  vGradRect(g, 0, W, ys, cs);
}

/** the surface seen from below and the wave lines on its underside; `top` is its colour near the eye */
export function surfaceGL(g: Gfx, view: View, m: Mood, waterAt: WaterAt, top: HSL, camX: number, t: number, W: number, fogAt: (z: number) => number): void {
  view.project(camX, 0, -120, P);
  view.project(camX, 0, 3200, Q);
  if (!(P.y > -40 || Q.y > 0)) return;
  const y0 = Math.min(P.y, 0), yFar = Q.y, w60 = waterAt(m, 60);
  if (yFar > 0) vGradRect(g, 0, W, [y0, y0 + (yFar - y0) * 0.7, yFar], [hcol(g, top), hcol(g, w60, 0.85), hcol(g, w60, 0)]);
  g.setBlend('add');
  for (const z of [1600, 700, 260, 40]) {
    const [x0, x1] = view.xRange(z, 40);
    for (let i = 0; i <= 40; i++) {
      const x = x0 + ((x1 - x0) * i) / 40, y = Math.sin(x * 0.012 + t * 1.1 + z) * 3 + Math.sin(x * 0.031 - t * 1.6) * 1.5 + Math.sin(x * 0.004 + z * 0.01) * 14;
      view.project(x, y, z, P);
      X2[i] = P.x; Y2[i] = P.y;
    }
    strokeLine(g, X2, Y2, 41, false, 1.2, hcol(g, m.sky, cl(0.22 - fogAt(z) * 0.22, 0, 0.22)));
  }
  g.setBlend('over');
}

/** a band of floor from its line (pf) to the next row's (nf, or the bottom of the screen), its gradient, its lit rim */
export function rowGL(g: Gfx, pf: Float32Array, nf: Float32Array | null, n: number, col: HSL, z: number, H: number): void {
  let top = Infinity, bot = -Infinity;
  for (let i = 0; i <= n; i++) {
    X2[i] = pf[i * 2]; Y2[i] = pf[i * 2 + 1];
    if (Y2[i] < top) top = Y2[i];
    if (nf) { X3[i] = nf[i * 2]; Y3[i] = Math.max(nf[i * 2 + 1], pf[i * 2 + 1]) + 2.5; }
    else { X3[i] = pf[i * 2] + (i === 0 ? -20 : i === n ? 20 : 0); Y3[i] = H + 4; }
    if (Y3[i] > bot) bot = Y3[i];
  }
  if (top > H || bot < 0) return;
  const y1 = Math.max(top + 30, bot), [r0, g0, b0] = hsl01(col.h, col.s, col.l + 2), [r1, g1, b1] = hsl01(col.h, col.s, col.l - 4);
  band(g, X2, Y2, X3, Y3, n + 1, (y) => { const u = cl((y - top) / (y1 - top), 0, 1); return g.pack(r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u, 1); });
  strokeLine(g, X2, Y2, n + 1, false, 1.6, hcol(g, col, z > 600 ? 0.5 : 0.18, 12));
}

/**
 * Caustics: the tile repeated over the floor below the line pf, as the canvas
 * pattern with the transform [s·0.75, 0, s·0.2, s·0.3, ox, oy] (tile of 256).
 */
export function causticsGL(g: Gfx, tile: HTMLCanvasElement, pf: Float32Array, n: number, H: number, s: number, ox: number, oy: number, alpha: number): void {
  const ma = s * 0.75, mc = s * 0.2, md = s * 0.3;
  const uvx = (x: number, y: number) => ((x - ox) - (mc / md) * (y - oy)) / ma / 256, uvy = (y: number) => (y - oy) / md / 256;
  g.setBlend('add');
  g.alpha = alpha;
  g.useTexture(tile, true);
  const col = g.pack(1, 1, 1, 1);
  g.reserve((n + 1) * 2, n * 6);
  g.shape();
  let pa = -1, pb = -1;
  for (let i = 0; i <= n; i++) {
    const x = pf[i * 2] + (i === 0 ? -20 : i === n ? 20 : 0), y = pf[i * 2 + 1];
    const a = g.v(x, y, col, uvx(x, y), uvy(y), 1), b = g.v(x, H + 4, col, uvx(x, H + 4), uvy(H + 4), 1);
    if (pa >= 0) { g.tri(pa, pb, a); g.tri(a, pb, b); }
    pa = a; pb = b;
  }
  g.alpha = 1;
  g.setBlend('over');
}

/** the soft shadow under an animal: a radial gradient squeezed on the floor */
export function shadowGL(g: Gfx, dpr: number, pitch: number, x: number, y: number, rx: number, al: number): void {
  g.setTransform(dpr, 0, 0, dpr * Math.max(0.12, 0.3 * Math.cos(pitch)), dpr * x, dpr * y);
  const r = 6 / 255, gg = 20 / 255, b = 30 / 255;
  rings(g, 0, 0, [0, rx], [g.pack(r, gg, b, al), g.pack(r, gg, b, 0)], 0, 32);
}

/** light shafts from the surface */
export function raysGL(g: Gfx, view: View, m: Mood, camX: number, t: number): void {
  const sp = 380;
  g.setBlend('add');
  for (let k = Math.floor((camX - 1200) / sp); k <= Math.floor((camX + 1200) / sp); k++) {
    const h1 = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1, h2 = Math.abs(Math.sin(k * 78.233) * 12345.678) % 1;
    if (h1 < 0.45) continue;
    const x = k * sp + h2 * 200, z = 150 + h1 * 900, w = 26 + h2 * 60, L = 560;
    const al = m.rays * 0.12 * (0.5 + 0.5 * Math.sin(t * 0.25 + k * 1.7));
    view.project(x, 0, z, P); const ax = P.x, ay = P.y, aw = w * P.s;
    view.project(x + L * 0.3, L, z, Q); const bx = Q.x, by = Q.y, bw = w * 1.6 * Q.s;
    const c0 = hcol(g, m.sky, al), c1 = hcol(g, m.sky, 0);
    g.reserve(4, 6); g.shape();
    const i0 = g.v(ax - aw / 2, ay, c0), i1 = g.v(ax + aw / 2, ay, c0), i2 = g.v(bx + bw / 2, by, c1), i3 = g.v(bx - bw / 2, by, c1);
    g.tri(i0, i1, i2); g.tri(i0, i2, i3);
  }
  g.setBlend('over');
}

/** a baked sprite placed in the scene (flattened by the pitch like the canvas one) */
export function spriteGL(g: Gfx, view: View, dpr: number, sp: { canvas: HTMLCanvasElement; ax: number; ay: number; res: number; w?: number; h?: number }, x: number, y: number, z: number, stamp = 0): void {
  view.project(x, y, z, P);
  const k = P.s / sp.res, kv = Math.cos(view.pitch);
  g.setTransform(dpr * k, 0, 0, dpr * k * kv, dpr * P.x, dpr * P.y);
  const w = sp.w || sp.canvas.width, h = sp.h || sp.canvas.height;
  g.image(sp.canvas, 0, 0, w, h, -sp.ax * sp.res, -sp.ay * sp.res, w, h, stamp);
}

/** one fish of a school from its atlas (3 frames), turned the way it swims, upright */
export function fishGL(g: Gfx, atlas: HTMLCanvasElement, frame: number, sw: number, sh: number, x: number, y: number, vx: number, vy: number, s: number, dpr: number): void {
  const ang = Math.atan2(vy, vx), flip = Math.cos(ang) < 0 ? -1 : 1, co = Math.cos(ang), si = Math.sin(ang), a = s * dpr * 0.5;
  g.setTransform(a * co, a * si, -a * si * flip, a * co * flip, x * dpr, y * dpr);
  g.image(atlas, frame * sw * 2, 0, sw * 2, sh * 2, -sw, -sh, sw * 2, sh * 2);
}

/** the glows of the creatures and lights: pts = x, y, size, hue, alpha (screen css px), additive, from the glow atlas */
export function glowsGL(g: Gfx, pts: number[], alpha: (i: number) => number, sizeK = 1): void {
  const atlas = glows();
  g.setBlend('add');
  for (let i = 0; i < pts.length; i += 5) {
    const size = pts[i + 2] * sizeK;
    g.alpha = alpha(i);
    g.image(atlas, glowTile(pts[i + 3]) * 64, 0, 64, 64, pts[i] - size, pts[i + 1] - size, size * 2, size * 2);
  }
  g.alpha = 1;
  g.setBlend('over');
}

/**
 * The screen canvas with WebGL2 (unless ?gl=0 or it is missing, then the 2D
 * canvas draws the same scene path by path). A canvas keeps the first kind of
 * context it gives, so WebGL is tried on a new one that replaces the page's.
 */
export function screenGfx(id: string): { canvas: HTMLCanvasElement; gx: Gfx | null } {
  const old = document.getElementById(id) as HTMLCanvasElement;
  if (new URLSearchParams(location.search).get('gl') === '0') return { canvas: old, gx: null };
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return { canvas: old, gx: null };
  try {
    const gx = new Gfx(gl);
    c.id = old.id;
    old.replaceWith(c);
    return { canvas: c, gx };
  } catch (e) { console.warn('WebGL2 unavailable, 2D canvas', e); return { canvas: old, gx: null }; }
}

// Drawing La Grotte (shape in grotte.ts): the vault in rows like the floor,
// stalactites and stalagmites, pillars, the shafts of day under the wells,
// and the glowing life of the dark galleries (as lights, after the dark).
// Same painter as the rest of the scene: items sorted by depth, on WebGL (Gfx)
// or on the 2D canvas.

import { clamp } from '../engine';
import type { Gfx } from '../engine3/gfx';
import { hsl01 } from '../engine3/gfx';
import type { Proj, View } from '../engine3/view';
import { floorAt } from './biomes';
import { BACK_Z, CAVE_A, CAVE_B, caveCover, caveDark, ceilAt, makeGlimmers, makePillars, makeWells, type Pillar, type Well } from './grotte';
import { css, mixRgb, waterAt, type HSL, type Mood } from './palette';
import { band, hcol, rings } from './scene-gl';
import { fogOf } from './sprites';

export interface CaveScene {
  view: View; ctx: CanvasRenderingContext2D; gx: Gfx | null;
  dpr: number; W: number; H: number; t: number;
  /** lights drawn after the dark: x, y (screen), size, hue, alpha */
  lights: number[];
  /** the swimmer, in the world */
  px: number; py: number;
  /** how much of the cave's dark stays (1: all; the lineage going up lights it, remontee.ts) */
  open?: number;
}
interface Item { d: number; fn: () => void; k?: string; }

const pillars = makePillars(), wells = makeWells(), glimmers = makeGlimmers();
/** rows of the vault, far to near (the first one is the back wall) */
const ROWS = [BACK_Z, 1350, 1120, 920, 740, 580, 440, 320, 210, 110, 20, -70];
/** rows where stalagmites stand on the floor */
const MITES = [1180, 860, 620, 420, 250];
const N = 48;
/** the dark of the cave is painted over the whole scene, the shafts of day over it */
const DARK = -1e6, SHAFTS = -1e6 - 1;
/** behind this depth the cave sinks into a veil of dark water */
const VEIL_Z = 520;
const INK: HSL = { h: 222, s: 40, l: 4 };
const OCHRE: HSL = { h: 30, s: 34, l: 30 };
const P: Proj = { x: 0, y: 0, s: 1, d: 1 }, Q: Proj = { x: 0, y: 0, s: 1, d: 1 };
const PX = new Float32Array(N + 1), PY = new Float32Array(N + 1), TX = new Float32Array(N + 1), TY = new Float32Array(N + 1);
const hash = (k: number, s: number) => { const v = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };

/** the stone of the cave in this light: the biome's rock pulled toward ochre */
const stone = (m: Mood): HSL => mixRgb(m.rock, OCHRE, 0.55);

/** c seen through the water of the cave: far stone sinks into the dark, not into the blue */
const murky = (m: Mood, c: HSL, y: number, fog: number): HSL => mixRgb(c, mixRgb(waterAt(m, y), INK, 0.6), clamp(fog * 1.1, 0, 1));

/** is any of the cave within [x0, x1]? */
const seen = (x0: number, x1: number) => x1 > CAVE_A && x0 < CAVE_B;

/** everything of the cave near the camera, as items for the painter; lights go to s.lights */
export function pushCave(items: Item[], s: CaveScene, m: Mood, camX: number, plane: number): void {
  const { view } = s;
  if (camX < CAVE_A - 2600 || camX > CAVE_B + 2600) return;
  const rock = stone(m);
  ROWS.forEach((z, r) => {
    const [x0, x1] = view.xRange(z, 80);
    if (!seen(x0, x1)) return;
    const cy = Math.max(ceilAt(clamp(camX, CAVE_A, CAVE_B), z), floorAt(camX, z) - 700);
    items.push({ d: view.depth(cy, z) + 0.45, fn: () => drawVault(s, m, rock, z, r, x0, x1, plane), k: 'cave' });
  });
  for (const z of MITES) {
    const [x0, x1] = view.xRange(z, 80);
    if (!seen(x0, x1)) continue;
    items.push({ d: view.depth(floorAt(camX, z), z) + 0.45, fn: () => drawMites(s, m, rock, z, x0, x1, plane), k: 'cave' });
  }
  for (const p of pillars) {
    const [x0, x1] = view.xRange(p.z, p.r * 2);
    if (p.x < x0 || p.x > x1) continue;
    items.push({ d: view.depth(floorAt(p.x, p.z) - 150, p.z), fn: () => drawPillar(s, m, rock, p, plane), k: 'cave' });
  }
  for (const w of wells) {
    const [x0, x1] = view.xRange(w.z, 300);
    if (w.x < x0 || w.x > x1) continue;
    items.push({ d: SHAFTS, fn: () => drawShaft(s, m, w), k: 'cave' });
  }
  items.push({ d: view.depth(floorAt(camX, VEIL_Z), VEIL_Z) + 0.4, fn: () => drawVeil(s), k: 'cave' });
  const dk = caveDark(camX) * (s.open ?? 1);
  if (dk > 0.02) items.push({ d: DARK, fn: () => drawDark(s, dk), k: 'cave' });
  // the glowing life of the dark: small lights that breathe
  for (let i = 0; i < glimmers.length; i += 5) {
    const x = glimmers[i], y = glimmers[i + 1], z = glimmers[i + 2];
    if (Math.abs(x - camX) > 1600) continue;
    view.project(x, y, z, P);
    if (P.x < -20 || P.x > s.W + 20 || P.y < -20 || P.y > s.H + 20) continue;
    const al = 0.35 + 0.3 * Math.sin(s.t * 1.2 + glimmers[i + 4]);
    s.lights.push(P.x, P.y, 5 * P.s + 2, glimmers[i + 3], al * (1 - fogOf(P.d, plane) * 0.6));
  }
}

/** a row of the vault: from its underside up to the top of the screen, with stalactites hanging from it */
function drawVault(s: CaveScene, m: Mood, rock: HSL, z: number, r: number, x0: number, x1: number, plane: number): void {
  const { view, gx, ctx, dpr } = s;
  let top = Infinity, bot = -Infinity, any = false;
  for (let i = 0; i <= N; i++) {
    const x = x0 + ((x1 - x0) * i) / N, c = ceilAt(x, z);
    view.project(x, Number.isFinite(c) ? c : -4000, z, P);
    PX[i] = P.x; PY[i] = Math.max(-30, P.y);
    if (PY[i] > -30) any = true;
    TX[i] = P.x; TY[i] = -30;
    top = Math.min(top, PY[i]); bot = Math.max(bot, PY[i]);
  }
  if (!any) return;
  const cy = floorAt((x0 + x1) / 2, z) - 300, fog = fogOf(view.depth(cy, z), plane);
  // the underside catches a little light, the stone above it is dark
  const back = z >= BACK_Z;
  const col = murky(m, { h: rock.h, s: rock.s, l: rock.l - (back ? 10 : 4) - clamp(z / 400, 0, 3) }, cy * 0.6 + z * 0.3, fog);
  const rim = murky(m, { h: rock.h, s: rock.s * 0.8, l: rock.l + 14 }, cy * 0.6 + z * 0.3, fog);
  if (gx) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [ra, ga, ba] = hsl01(col.h, col.s, col.l - 6), [rb, gb, bb] = hsl01(col.h, col.s, col.l + 3);
    const span = Math.max(40, bot + 30);
    band(gx, PX, PY, TX, TY, N + 1, (y) => { const u = clamp((y + 30) / span, 0, 1); return gx.pack(ra + (rb - ra) * u, ga + (gb - ga) * u, ba + (bb - ba) * u, 1); });
  } else {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    for (let i = 0; i <= N; i++) if (i) ctx.lineTo(PX[i], PY[i]); else ctx.moveTo(PX[i], PY[i]);
    ctx.lineTo(PX[N] + 20, -30); ctx.lineTo(PX[0] - 20, -30);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -30, 0, Math.max(10, bot));
    g.addColorStop(0, css(col, 1, -6)); g.addColorStop(1, css(col, 1, 3));
    ctx.fillStyle = g;
    ctx.fill();
  }
  if (!back) spikes(s, z, r, x0, x1, col, rim, -1);
}

/** stalagmites standing on the floor at z */
function drawMites(s: CaveScene, m: Mood, rock: HSL, z: number, x0: number, x1: number, plane: number): void {
  const fy = floorAt((x0 + x1) / 2, z), fog = fogOf(s.view.depth(fy, z), plane);
  const col = murky(m, { h: rock.h, s: rock.s, l: rock.l - 2 }, fy * 0.6 + z * 0.3, fog);
  const rim = murky(m, { h: rock.h, s: rock.s * 0.8, l: rock.l + 12 }, fy * 0.6 + z * 0.3, fog);
  spikes(s, z, z * 0.01, x0, x1, col, rim, 1);
}

/**
 * Cones of calcite along a row: hanging from the vault (dir -1) or standing on
 * the floor (dir 1). Each is a dark side and a lit side, so it reads as round.
 */
function spikes(s: CaveScene, z: number, seed: number, x0: number, x1: number, col: HSL, lit: HSL, dir: number): void {
  const { view, gx, ctx, dpr } = s;
  const step = 34, k0 = Math.floor(x0 / step), k1 = Math.ceil(x1 / step);
  const up = dir > 0;
  if (gx) { gx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  else { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  const cDark = gx ? hcol(gx, col, 1, -3) : 0, cLit = gx ? hcol(gx, lit, 1) : 0;
  // on the canvas: all the lit sides in one path, all the dark sides in another (a path costs the same whatever its size)
  const litPath = gx ? null : new Path2D(), darkPath = gx ? null : new Path2D();
  for (let k = k0; k <= k1; k++) {
    const h = hash(k, seed + (up ? 17 : 3));
    if (h < (up ? 0.72 : 0.42)) continue;
    const x = k * step + hash(k, seed + 5) * step * 0.8, cv = caveCover(x);
    if (cv < 0.5) continue;
    const base = up ? floorAt(x, z) + 4 : ceilAt(x, z) - 4;
    const len = (up ? 16 + h * 55 : 12 + h * h * 110) * cv, w = (up ? 7 + h * 9 : 4 + h * 8);
    view.project(x - w, base, z, P); const ax = P.x, ay = P.y;
    view.project(x + w, base, z, P); const bx = P.x, by = P.y;
    view.project(x + (hash(k, seed + 9) - 0.5) * w * 0.6, base + (up ? -len : len), z, Q);
    const mx = (ax + bx) / 2 + (bx - ax) * 0.12, my = (ay + by) / 2;
    if (Math.max(ay, Q.y) < -20 || Math.min(ay, Q.y) > s.H + 20 || bx < -20 || ax > s.W + 20) continue;
    if (gx) {
      gx.reserve(4, 6); gx.shape();
      const a = gx.v(ax, ay, cLit), mm = gx.v(mx, my, cLit), b = gx.v(bx, by, cDark), tip = gx.v(Q.x, Q.y, cDark);
      gx.tri(a, mm, tip); gx.tri(mm, b, tip);
    } else {
      litPath!.moveTo(ax, ay); litPath!.lineTo(mx, my); litPath!.lineTo(Q.x, Q.y); litPath!.closePath();
      darkPath!.moveTo(mx, my); darkPath!.lineTo(bx, by); darkPath!.lineTo(Q.x, Q.y); darkPath!.closePath();
    }
  }
  if (litPath && darkPath) {
    ctx.fillStyle = css(lit, 1); ctx.fill(litPath);
    ctx.fillStyle = css(col, 1, -3); ctx.fill(darkPath);
  }
}

/** a pillar where a stalactite met a stalagmite: wide at both ends, a waist in the middle */
function drawPillar(s: CaveScene, m: Mood, rock: HSL, p: Pillar, plane: number): void {
  const { view, gx, ctx, dpr } = s;
  const fy = floorAt(p.x, p.z) + 6, cy = ceilAt(p.x, p.z) - 6;
  if (!(cy < fy - 20)) return;
  const fog = fogOf(view.depth((fy + cy) / 2, p.z), plane);
  const col = murky(m, rock, fy * 0.6 + p.z * 0.3, fog);
  const n = 12, cols = [4, 1, -8], xs = [-1, -0.25, 1];
  // three strips across: the lit side, the face, the shadow
  const G: number[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, y = cy + (fy - cy) * u;
    const e = 2 * u - 1, half = p.r * (0.5 + 0.7 * e * e * e * e + 0.08 * Math.sin(u * 17 + p.seed));
    for (const f of xs) { view.project(p.x + half * f, y, p.z, P); G.push(P.x, P.y); }
  }
  if (gx) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.reserve((n + 1) * 3, n * 12); gx.shape();
    const c = cols.map((dl) => hcol(gx, col, 1, dl));
    const i0 = gx.v(G[0], G[1], c[0]);
    gx.v(G[2], G[3], c[1]); gx.v(G[4], G[5], c[2]);
    for (let i = 1; i <= n; i++) {
      const o = i * 6;
      gx.v(G[o], G[o + 1], c[0]); gx.v(G[o + 2], G[o + 3], c[1]); gx.v(G[o + 4], G[o + 5], c[2]);
      const a = i0 + (i - 1) * 3, b = i0 + i * 3;
      gx.tri(a, a + 1, b); gx.tri(b, a + 1, b + 1);
      gx.tri(a + 1, a + 2, b + 1); gx.tri(b + 1, a + 2, b + 2);
    }
  } else {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) if (i) ctx.lineTo(G[i * 6], G[i * 6 + 1]); else ctx.moveTo(G[0], G[1]);
    for (let i = n; i >= 0; i--) ctx.lineTo(G[i * 6 + 4], G[i * 6 + 5]);
    ctx.closePath();
    const mid = n >> 1, g = ctx.createLinearGradient(G[mid * 6], 0, G[mid * 6 + 4], 0);
    g.addColorStop(0, css(col, 1, cols[0])); g.addColorStop(0.35, css(col, 1, cols[1])); g.addColorStop(1, css(col, 1, cols[2]));
    ctx.fillStyle = g;
    ctx.fill();
  }
}

/** the back of the cave in the dark: a veil over everything drawn so far, fading out at the mouths */
function drawVeil(s: CaveScene): void {
  const { view, gx, ctx, dpr, H } = s;
  const xs = [CAVE_A, CAVE_A + 700, CAVE_B - 700, CAVE_B].map((x) => view.project(x, 0, VEIL_Z, P).x);
  const a = 0.5 * (s.open ?? 1);
  if (gx) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c0 = hcol(gx, INK, 0), c1 = hcol(gx, INK, a), cs = [c0, c1, c1, c0];
    gx.reserve(8, 18); gx.shape();
    const i0 = gx.v(xs[0], 0, cs[0]);
    gx.v(xs[0], H, cs[0]);
    for (let k = 1; k < 4; k++) {
      gx.v(xs[k], 0, cs[k]); gx.v(xs[k], H, cs[k]);
      const a0 = i0 + (k - 1) * 2, b0 = i0 + k * 2;
      gx.tri(a0, a0 + 1, b0); gx.tri(b0, a0 + 1, b0 + 1);
    }
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = Math.max(1, xs[3] - xs[0]), g = ctx.createLinearGradient(xs[0], 0, xs[3], 0);
  g.addColorStop(0, css(INK, 0)); g.addColorStop(clamp((xs[1] - xs[0]) / w, 0, 1), css(INK, a));
  g.addColorStop(clamp((xs[2] - xs[0]) / w, 0, 1), css(INK, a)); g.addColorStop(1, css(INK, 0));
  ctx.fillStyle = g;
  ctx.fillRect(Math.max(0, xs[0]), 0, Math.min(s.W, xs[3]) - Math.max(0, xs[0]), H);
}

/**
 * The dark closing in around the swimmer, tighter than the deep's: wide and
 * dim in the halls, a small halo in the far galleries (what glows is drawn
 * after, over it).
 */
function drawDark(s: CaveScene, dk: number): void {
  const { view, gx, ctx, dpr, W, H } = s;
  view.project(s.px, s.py, 0, P);
  const u = clamp((dk - 0.42) / 0.53, 0, 1), r0 = (90 - 30 * u) * P.s, r1 = (1100 - 780 * u) * P.s, a = dk;
  if (gx) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rings(gx, P.x, P.y, [r0, r0 + (r1 - r0) * 0.4, r1], [hcol(gx, INK, 0), hcol(gx, INK, a * 0.6), hcol(gx, INK, a)], Math.hypot(W, H) * 1.5, 64);
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createRadialGradient(P.x, P.y, r0, P.x, P.y, r1);
  g.addColorStop(0, css(INK, 0)); g.addColorStop(0.4, css(INK, a * 0.6)); g.addColorStop(1, css(INK, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** day falling through a well in the vault: a shaft of light, the hole bright above, a pool on the floor */
function drawShaft(s: CaveScene, m: Mood, w: Well): void {
  const { view, gx, ctx, dpr, t } = s;
  const cv = caveCover(w.x);
  if (cv < 0.3) return;
  const top = ceilAt(w.x, w.z), bot = floorAt(w.x + 40, w.z);
  const al = 0.26 * cv * (0.8 + 0.2 * Math.sin(t * 0.3 + w.seed));
  const sun: HSL = { h: m.sky.h, s: Math.min(70, m.sky.s), l: Math.max(78, m.sky.l) };
  view.project(w.x, top, w.z, P); const ax = P.x, ay = P.y, aw = w.w * P.s * 0.5;
  view.project(w.x + 40, bot, w.z, Q); const bx = Q.x, by = Q.y, bw = w.w * 1.9 * Q.s * 0.5;
  if (gx) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.setBlend('add');
    const c0 = hcol(gx, sun, al), c1 = hcol(gx, sun, al * 0.25);
    gx.reserve(4, 6); gx.shape();
    const i0 = gx.v(ax - aw, ay, c0), i1 = gx.v(ax + aw, ay, c0), i2 = gx.v(bx + bw, by, c1), i3 = gx.v(bx - bw, by, c1);
    gx.tri(i0, i1, i2); gx.tri(i0, i2, i3);
    gx.setBlend('over');
  } else {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, ay, 0, by);
    g.addColorStop(0, css(sun, al)); g.addColorStop(1, css(sun, al * 0.25));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(ax - aw, ay); ctx.lineTo(ax + aw, ay); ctx.lineTo(bx + bw, by); ctx.lineTo(bx - bw, by); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // the hole and the pool shine through the dark
  s.lights.push(ax, ay, aw * 2.2 + 4, sun.h, 0.8 * cv);
  s.lights.push(bx, by, bw * 1.8 + 4, sun.h, 0.35 * cv);
}

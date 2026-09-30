// What the traces of the lineage look like (traces.ts), each baked once from the
// ancestor's own body so that we know it again: its eggs that never hatched, a
// heap of clear eggs with its small shape curled inside each; its moult, its exact
// form pale and empty, split along the back; its body lying on its side, bleached,
// covered with the life of a reef and half buried in the sand.

import { STEP, TAU, clamp, palette, rng, type Spec } from '../engine';
import { Creature3 } from '../engine3/creature3';
import { BIOMES } from './biomes';
import { css, type HSL, type Mood } from './palette';
import { bakeCreature, makeCanvas, type Sprite } from './sprites';
import type { Trace, TraceKind } from './traces';
import { tint } from './world';

type Ctx = CanvasRenderingContext2D;
type R01 = () => number;

/** the colours of the Récif, the first home the lineage passed: a reef always has some */
const REEF: HSL[] = BIOMES.find((b) => b.id === 'recif')?.accents ?? [{ h: 340, s: 70, l: 62 }];
const BONE = [228, 218, 194], SKIN = [236, 240, 234];
/** a moult and a reef are a little bigger than the lineage swims, never small: they are found from afar */
const MUE = 1.3, RECIF = 1.5, MUE_MIN = 80, RECIF_MIN = 110;

/** the body as it rests, `k` times the size the lineage swims at: it trailed a moment, slowly, as when it swam */
function pose(sp: Spec, k: number): Creature3 {
  const cr = new Creature3(sp, 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 0.8 * k, phase: 0 });
  for (let i = 0; i < 70; i++) cr.steer(i * STEP, 0.6, 0, 0, 0.2);
  return cr;
}

/** a canvas kept in memory, whose pixels are read back cheaply */
function cpuCanvas(w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

/** the body drawn flat at `res` px per unit, `k` times its size and at least `min` long, laid the long way along the floor (a jellyfish lies on its side) */
function lying(sp: Spec, res: number, k = 1, min = 0): HTMLCanvasElement {
  let cr = pose(sp, k);
  const long = Math.max(cr.box[3] - cr.box[0], cr.box[4] - cr.box[1]);
  if (long < min) cr = pose(sp, (k * min) / Math.max(1, long));
  // a very big body is baked coarser than asked: stretched back to `res`
  const s = bakeCreature(cr, 0, { h: 0, s: 0, l: 0 }, res, cpuCanvas(1, 1)), f = res / s.res, w = Math.ceil(s.w! * f), h = Math.ceil(s.h! * f);
  const side = sp.swim.mode === 'bell' && h > w, c = side ? cpuCanvas(h, w) : cpuCanvas(w, h), ctx = c.getContext('2d')!;
  if (side) { ctx.translate(0, w); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(s.canvas, 0, 0, s.w!, s.h!, 0, 0, w, h);
  return c;
}

/** the first opaque row of each column, or -1 */
function tops(d: ImageData): Int32Array {
  const { width: w, height: h, data } = d, top = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (data[(y * w + x) * 4 + 3] > 100) { top[x] = y; break; }
  return top;
}

/** each pixel of the body turned toward `to` (rgb), dark lines kept darker, its alpha scaled by `alpha(a, edge, ink, lum)` */
function recolour(d: ImageData, to: number[], keep: number, alpha: (a: number, edge: boolean, ink: boolean, lum: number) => number): void {
  const { width: w, height: h, data } = d, src = new Uint8ClampedArray(data);
  const clear = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || src[(y * w + x) * 4 + 3] < 40;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * 4, a = src[k + 3];
    if (!a) continue;
    const lum = 0.3 * src[k] + 0.59 * src[k + 1] + 0.11 * src[k + 2], ink = lum < 60;
    const edge = clear(x - 2, y) || clear(x + 2, y) || clear(x, y - 2) || clear(x, y + 2);
    const shade = ink ? 0.45 : 0.82 + 0.25 * (lum / 255);
    for (let c = 0; c < 3; c++) data[k + c] = clamp((src[k + c] * keep + to[c] * (1 - keep)) * shade, 0, 255);
    data[k + 3] = clamp(alpha(a, edge, ink, lum), 0, 255);
  }
}

// ----- the moult ----- //

function bakeMue(sp: Spec, R: R01, res: number): { c: HTMLCanvasElement; foot: number } {
  const body = lying(sp, res, MUE, MUE_MIN), w = body.width, h = body.height, pad = Math.ceil(3 * res);
  const c = makeCanvas(w + pad * 2, h + pad * 2), ctx = c.getContext('2d')!;
  const d = body.getContext('2d')!.getImageData(0, 0, w, h), top = tops(d);
  // pale and clear: the outline and the seams of the parts hold, the rest lets the water through
  recolour(d, SKIN, 0.15, (a, edge, ink, lum) => a * (edge ? 0.95 : ink ? 0.6 : 0.32 + 0.3 * (lum / 255)));
  ctx.putImageData(d, pad, pad);
  // a sheen from above
  const g = ctx.createLinearGradient(0, pad, 0, pad + h);
  g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  // split along the back, where it came out
  const x0 = Math.floor(w * 0.3), x1 = Math.floor(w * 0.68), crack = new Path2D();
  let started = false;
  for (let x = x0; x <= x1; x += Math.max(1, Math.round(res * 2))) {
    if (top[x] < 0) continue;
    const y = pad + top[x] + 2.5 * res + (R() - 0.5) * 1.2 * res;
    if (started) crack.lineTo(pad + x, y); else { crack.moveTo(pad + x, y); started = true; }
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 1.6 * res; ctx.stroke(crack);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(250,252,248,0.7)'; ctx.lineWidth = 0.7 * res;
  ctx.translate(0, -1.3 * res); ctx.stroke(crack);
  return { c, foot: pad + h - 1.5 * res };
}

// ----- the reef ----- //

/** a branching coral from (x, y) upward */
function coral(ctx: Ctx, R: R01, x: number, y: number, a: number, len: number, w: number, depth: number, col: HSL): void {
  const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
  ctx.strokeStyle = css(col, 0.95, -depth * 4); ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  if (depth <= 0 || len < 2) {
    ctx.fillStyle = css(col, 1, 16);
    ctx.beginPath(); ctx.arc(x2, y2, w * 0.7, 0, TAU); ctx.fill();
    return;
  }
  for (const s of [-1, 1]) coral(ctx, R, x2, y2, a + s * (0.35 + R() * 0.35), len * (0.6 + R() * 0.2), w * 0.72, depth - 1, col);
}

/** an anemone: a short foot, a crown of tentacles bending out */
function anemone(ctx: Ctx, R: R01, x: number, y: number, s: number, col: HSL): void {
  ctx.fillStyle = css(col, 0.95, -14);
  ctx.beginPath(); ctx.roundRect(x - s * 0.28, y - s * 0.7, s * 0.56, s * 0.72, s * 0.2); ctx.fill();
  ctx.strokeStyle = css(col, 0.9, 10); ctx.lineWidth = Math.max(0.5, s * 0.1);
  for (let k = 0; k < 9; k++) {
    const u = k / 8 - 0.5, ex = x + u * s * 1.9, ey = y - s * (1.25 + (0.5 - Math.abs(u)) * 0.5 + R() * 0.2);
    ctx.beginPath(); ctx.moveTo(x + u * s * 0.4, y - s * 0.7); ctx.quadraticCurveTo(x + u * s * 0.6, ey + s * 0.1, ex, ey); ctx.stroke();
  }
}

/** a sponge: a tube with its dark mouth */
function sponge(ctx: Ctx, x: number, y: number, s: number, col: HSL): void {
  ctx.fillStyle = css(col, 0.95, -6);
  ctx.beginPath(); ctx.roundRect(x - s * 0.3, y - s * 1.3, s * 0.6, s * 1.32, [s * 0.3, s * 0.3, 1, 1]); ctx.fill();
  ctx.fillStyle = css(col, 0.9, -30);
  ctx.beginPath(); ctx.ellipse(x, y - s * 1.2, s * 0.2, s * 0.08, 0, 0, TAU); ctx.fill();
}

function bakeRecif(sp: Spec, R: R01, m: Mood, res: number): { c: HTMLCanvasElement; foot: number } {
  const body = lying(sp, res, RECIF, RECIF_MIN), w = body.width, h = body.height;
  const G = Math.ceil(30 * res), padX = Math.ceil(14 * res), c = makeCanvas(w + padX * 2, h + G + 4 * res), ctx = c.getContext('2d')!;
  const d = body.getContext('2d')!.getImageData(0, 0, w, h), top = tops(d);
  // bleached like the bones of the whale
  recolour(d, BONE, 0.2, (a) => a);
  ctx.putImageData(d, padX, G);
  const cols = [...REEF, ...m.accents], pick = () => cols[Math.floor(R() * cols.length)];
  ctx.scale(res, res);
  const W = w / res, H = h / res, ox = padX / res, oy = G / res;
  const topAt = (u: number) => { const x = clamp(Math.round(u * res), 0, w - 1); return top[x] < 0 ? -1 : oy + top[x] / res; };
  const solid = (u: number, v: number) => { const x = Math.round(u * res), y = Math.round(v * res); return x >= 0 && y >= 0 && x < w && y < h && d.data[(y * w + x) * 4 + 3] > 100; };
  /** the body is thick under this point of its back: no coral on an antenna or a thin fin */
  const thick = (u: number, t: number) => solid(u, t - oy + 3.5) && solid(u - 2, t - oy + 3.5) && solid(u + 2, t - oy + 3.5);
  // crusts and polyps over the body (on it only), white ones and some in colour
  ctx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < W * 0.8; i++) {
    const u = R() * W, t = topAt(u);
    if (t < 0) continue;
    const y = t + R() * (oy + H - t) * 0.8, col = R() < 0.4 ? { h: 44, s: 20, l: 94 } : pick();
    ctx.fillStyle = css(col, 0.3 + R() * 0.25, R() * 10);
    ctx.beginPath(); ctx.ellipse(ox + u, y, 2 + R() * 4, 1.5 + R() * 2.5, R() * TAU, 0, TAU); ctx.fill();
    ctx.fillStyle = css(col, 0.9, 14);
    ctx.beginPath(); ctx.arc(ox + u + (R() - 0.5) * 3, y + (R() - 0.5) * 2, 0.6 + R() * 0.7, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // what grows on its back
  ctx.lineCap = 'round';
  for (let u = 2 + R() * 3; u < W - 2; u += 3 + R() * 5) {
    const t = topAt(u);
    if (t < 0 || !thick(u, t)) continue;
    const x = ox + u, y = t + 1.5, col = pick(), q = R(), s = 6 + R() * 10;
    if (q < 0.45) coral(ctx, R, x, y, -Math.PI / 2 + (R() - 0.5) * 0.7, s * 0.6, 2, 2 + (R() < 0.4 ? 1 : 0), col);
    else if (q < 0.65) anemone(ctx, R, x, y, s * 0.6, col);
    else if (q < 0.8) sponge(ctx, x, y, s * 0.55, col);
    else { ctx.fillStyle = css(col, 1, R() * 8); ctx.beginPath(); ctx.ellipse(x, y, s * 0.4, s * 0.28, 0, Math.PI, TAU); ctx.fill(); }
  }
  // half buried: the sand has drifted along its belly
  const by = oy + H, rx = W * 0.62 + 8;
  ctx.save();
  ctx.translate(ox + W / 2, by + 1); ctx.scale(1, (H * 0.34 + 3) / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, css(m.sand, 1, -4)); g.addColorStop(0.55, css(m.sand, 0.85)); g.addColorStop(1, css(m.sand, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, Math.PI, TAU); ctx.fill();
  ctx.restore();
  return { c, foot: G + h * 0.9 };
}

// ----- the eggs ----- //

function bakeOeufs(sp: Spec, R: R01, res: number): { c: HTMLCanvasElement; foot: number } {
  const body = lying(sp, res), col = palette(sp.palette)[0];
  // eggs a little bigger for a bigger animal
  const r = clamp((body.width / res) * 0.1, 7, 12), W = r * 22, H = r * 9, ground = H - r * 0.3;
  const c = makeCanvas(W * res, H * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  // a clutch: each row rests in the hollows of the one under it, shorter and shifted at random; two rolled away
  const eggs: [number, number, number][] = [];
  let row: number[] = [], n = 5 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) row.push(W / 2 + (i - (n - 1) / 2) * r * 2);
  for (let k = 0; row.length; k++) {
    for (const x of row) { const rr = r * (0.9 + R() * 0.15); eggs.push([x + (R() - 0.5) * r * 0.2, ground - r - k * r * 1.72 + (r - rr), rr]); }
    const m = row.length - 1 - (R() < 0.45 ? 1 : 0), s0 = Math.floor(R() * (row.length - m));
    row = m > 0 && k < 3 ? Array.from({ length: m }, (_, i) => row[s0 + i] + r) : [];
  }
  for (const side of [-1, 1]) { const rr = r * 0.95; eggs.push([W / 2 + side * r * (7 + R() * 3), ground - rr, rr]); }
  // the jelly that holds them together
  ctx.fillStyle = css({ h: col.h, s: 25, l: 84 }, 0.16);
  for (const [x, y, rr] of eggs.slice(0, -2)) { ctx.beginPath(); ctx.arc(x, y, rr * 1.25, 0, TAU); ctx.fill(); }
  // the small one inside: its longest side 1.5 radius long
  const f = (r * 1.5) / Math.max(body.width, body.height), bw = body.width * f, bh = body.height * f;
  eggs.forEach(([x, y, rr], i) => {
    const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr);
    g.addColorStop(0, css({ h: col.h, s: 30, l: 90 }, 0.3)); g.addColorStop(1, css({ h: col.h, s: 35, l: 68 }, 0.7));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    // curled, it never came out
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, rr * 0.9, 0, TAU); ctx.clip();
    ctx.translate(x, y); ctx.rotate(-0.7 + (R() - 0.5) * 1.2 + (i % 2) * Math.PI);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();
    // some went cloudy
    if (R() < 0.3) { ctx.fillStyle = css({ h: col.h, s: 10, l: 88 }, 0.45); ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = css({ h: col.h, s: 30, l: 22 }, 0.55); ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(x - rr * 0.38, y - rr * 0.42, rr * 0.22, rr * 0.13, -0.6, 0, TAU); ctx.fill();
  });
  return { c, foot: ground * res };
}

// ----- the trace ----- //

/** the trace of an ancestor (its species), baked at `res` px per unit, as it is before the water washes it */
export function bakeTrace(t: Trace, sp: Spec, m: Mood, res: number): Sprite {
  const R = rng(t.seed);
  const { c, foot } = t.kind === 'oeufs' ? bakeOeufs(sp, R, res) : t.kind === 'mue' ? bakeMue(sp, R, res) : bakeRecif(sp, R, m, res);
  return { canvas: c, ax: c.width / res / 2, ay: foot / res, res };
}

/** a baked trace washed by the water: a new image, cheap to make */
export function washed(base: Sprite, fog: number, fogCol: HSL): Sprite {
  const c = makeCanvas(base.canvas.width, base.canvas.height), ctx = c.getContext('2d')!;
  ctx.drawImage(base.canvas, 0, 0);
  tint(ctx, c, clamp(fog, 0, 0.9), fogCol);
  return { ...base, canvas: c };
}

/** its faint light, seen in the dark: [height above the foot, radius, hue, alpha] */
export function traceLight(kind: TraceKind, sp: Spec): [number, number, number, number] {
  if (kind === 'oeufs') return [10, 45, palette(sp.palette)[0].h, 0.2];
  if (kind === 'mue') return [14, 60, 190, 0.14];
  return [18, 80, 45, 0.16];
}

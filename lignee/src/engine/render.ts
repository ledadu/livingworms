// Drawing a creature: ribbons (smoothed hull), plates, lines, beads, eyes,
// body motifs and membranes between copies.

import type { Box } from './types';
import { Creature, Seg } from './creature';
import { TAU, clamp, hash, wrapAngle } from './util';

type Ctx = CanvasRenderingContext2D;

export interface DrawOptions {
  view?: Box;
  alpha?: number;
  bright?: boolean;
  /** only what makes its own light (translucent additive parts, glowing parts) */
  lit?: boolean;
  /** cartoon look: a darker, thicker outline */
  ink?: boolean;
  /** light from above: top-to-bottom shading on bodies, the sheen kept on top */
  shade?: boolean;
  /** how parts that make their own light are composited (default 'lighter'), and how strongly */
  addOp?: GlobalCompositeOperation;
  addScale?: number;
  /**
   * Level of detail of the whole animal (see render3): 0 everything; 1 no
   * outline under 1.2 px nor extras under 3 px on the parts, lines in one path
   * each; 2 no extras, outlines from 2.5 px, plates in one path too.
   */
  lod?: number;
}

let ink = false;
let shade = false;

/**
 * Level of detail, in screen pixels of a part's widest radius: below these the
 * extras are left out (they would hardly show, and every path costs on an
 * accelerated canvas). The defaults draw everything as before.
 */
export const detail = { sheen: 1.2, shade: 2.4, motif: 1, ink: 0 };
/** level of the animal being drawn (set by drawSelf) */
let lod = 0;
/** by level: the width on screen (px) under which a part has no outline, and no motif, sheen or thin edge */
export const INK_MIN = [0, 1.2, 2.5];
export const EXTRA_MIN = [0, 3, Infinity];
export function setInk(v: boolean): void { ink = v; }
export function setShade(v: boolean): void { shade = v; }

/** soft light from above over a body: pale on top, deeper below */
function shadeBody(ctx: Ctx, s: Seg, flat: boolean): void {
  if (!shade || s.maxRad < detail.shade || s.def.color.add) return;
  const b = s.box, h = b[3] - b[1];
  if (h < 3) return;
  // the outline filled with the gradient: the same look as clipping to it and filling its box, without a
  // clip (a clip to a curved path is one more mask for an accelerated canvas)
  ribbonPath(ctx, s, 1, 0, flat);
  const g = ctx.createLinearGradient(0, b[1], 0, b[3]);
  g.addColorStop(0, 'rgba(255,255,255,0.34)');
  g.addColorStop(0.42, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(6,18,40,0.36)');
  ctx.fillStyle = g;
  ctx.fill();
}

/** which side of a ribbon faces the light (the top of the screen) */
export function sheenSide(s: Seg, off: number): number {
  if (!shade) return off;
  let cs = 0;
  for (let i = 1; i <= s.n; i++) cs += Math.cos(s.ang[i]);
  return cs > 0 ? -off : off;
}

// scratch outline buffers, shared by every draw call
const L = { x: new Float32Array(64), y: new Float32Array(64) };
const R = { x: new Float32Array(64), y: new Float32Array(64) };
const C = { x: new Float32Array(64), y: new Float32Array(64), r: new Float32Array(64), a: new Float32Array(64) };
const HULL = { L, R, C };

/** the outline of a ribbon: its two sides and its centre line, in shared buffers (also used by the WebGL painter) */
export function hullOf(s: Seg, k: number, off: number): { L: typeof L; R: typeof R; C: typeof C } { hull(s, k, off); return HULL; }

function hull(s: Seg, k: number, off: number): void {
  const n = s.n, x = s.x, y = s.y, ang = s.ang, rad = s.rad, pl = s.pulse;
  for (let i = 0; i <= n; i++) {
    const a = i === 0 ? ang[1] : i === n ? ang[n] : ang[i] + wrapAngle(ang[i + 1] - ang[i]) * 0.5;
    const nx = -Math.sin(a), ny = Math.cos(a), r0 = rad[i] * (1 + pl * (s.pulseU ? 1 : i / n)), r = r0 * k;
    const cx = x[i] + nx * r0 * off, cy = y[i] + ny * r0 * off;
    C.x[i] = cx; C.y[i] = cy; C.r[i] = r; C.a[i] = a;
    L.x[i] = cx + nx * r; L.y[i] = cy + ny * r;
    R.x[i] = cx - nx * r; R.y[i] = cy - ny * r;
  }
}

function ribbonPath(ctx: Ctx, s: Seg, k: number, off: number, flatTail: boolean): void {
  const n = s.n;
  hull(s, k, off);
  ctx.beginPath();
  ctx.moveTo(L.x[0], L.y[0]);
  for (let i = 1; i < n; i++) ctx.quadraticCurveTo(L.x[i], L.y[i], (L.x[i] + L.x[i + 1]) / 2, (L.y[i] + L.y[i + 1]) / 2);
  ctx.lineTo(L.x[n], L.y[n]);
  if (flatTail) ctx.lineTo(R.x[n], R.y[n]);
  else ctx.arc(C.x[n], C.y[n], C.r[n], C.a[n] + Math.PI / 2, C.a[n] - Math.PI / 2, true);
  for (let i = n - 1; i > 0; i--) ctx.quadraticCurveTo(R.x[i], R.y[i], (R.x[i] + R.x[i - 1]) / 2, (R.y[i] + R.y[i - 1]) / 2);
  ctx.lineTo(R.x[0], R.y[0]);
  ctx.arc(C.x[0], C.y[0], C.r[0], C.a[0] - Math.PI / 2, C.a[0] + Math.PI / 2, true);
  ctx.closePath();
}

function drawRibbon(ctx: Ctx, s: Seg): void {
  const n = s.n, flat = s.def.shape === 'bell';
  ribbonPath(ctx, s, 1, 0, flat);
  if (n > 1) {
    const g = ctx.createLinearGradient(s.x[0], s.y[0], s.x[n], s.y[n]);
    g.addColorStop(0, s.cols[0]);
    g.addColorStop(0.5, s.cols[n >> 1]);
    g.addColorStop(1, s.cols[n]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = s.cols[0];
  }
  ctx.fill();
  // from level 1 the thin parts go without extras (by their width on screen, so a plant keeps the outline of its leaves)
  const full = !s.parent || s.maxRad >= EXTRA_MIN[lod];
  if (ink && !s.def.color.add && s.maxRad >= Math.max(detail.ink, s.parent ? INK_MIN[lod] : 0)) {
    ctx.lineWidth = Math.max(minWidth(ctx) * 1.3, Math.min(1.6, 0.35 + s.maxRad * 0.13));
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.edgeCol;
    ctx.stroke();
  }
  if (s.maxRad > 1.2 && lod < 2) {
    if (!ink && full) {
      ctx.lineWidth = Math.max(0.3, s.maxRad * 0.07);
      ctx.strokeStyle = s.edgeCol;
      ctx.stroke();
    }
    if (s.maxRad > detail.motif && full) drawMotif(ctx, s, flat);
    shadeBody(ctx, s, flat);
    if (s.maxRad > detail.sheen && full) {
      ribbonPath(ctx, s, 0.36, sheenSide(s, 0.34), flat);
      ctx.fillStyle = s.shineCol;
      ctx.fill();
    }
  }
}

function drawPlates(ctx: Ctx, s: Seg): void {
  // small: one ribbon instead of a path per plate
  if (lod >= 2) { drawRibbon(ctx, s); return; }
  const n = s.n, x = s.x, y = s.y, rad = s.rad, pl = s.pulse;
  ctx.lineWidth = ink ? Math.max(minWidth(ctx) * 1.3, Math.min(1.5, 0.3 + s.maxRad * 0.12)) : Math.max(0.3, s.maxRad * 0.08);
  ctx.strokeStyle = s.edgeCol;
  for (let i = n; i >= 1; i--) {
    const r = Math.max(rad[i - 1], rad[i]) * (1 + pl * (s.pulseU ? 1 : i / n));
    ctx.beginPath();
    ctx.ellipse((x[i - 1] + x[i]) / 2, (y[i - 1] + y[i]) / 2, s.lens[i] * 0.62 + r * 0.2, r, s.ang[i], 0, TAU);
    ctx.fillStyle = s.cols[i];
    ctx.fill();
    if (s.maxRad >= Math.max(detail.ink, s.parent ? INK_MIN[lod] : 0)) ctx.stroke();
  }
  if (lod >= 1 && s.parent && s.maxRad < EXTRA_MIN[lod]) return;
  if (s.def.color.pattern !== 'bands' && s.maxRad > detail.motif) drawMotif(ctx, s, false);
  if (s.maxRad > Math.max(1.5, detail.sheen)) {
    shadeBody(ctx, s, false);
    ribbonPath(ctx, s, 0.3, sheenSide(s, 0.38), false);
    ctx.fillStyle = s.shineCol;
    ctx.fill();
  }
}

/** at least ~1 device pixel, so thin filaments stay visible when zoomed out */
function minWidth(ctx: Ctx): number {
  const m = ctx.getTransform();
  return 1.1 / Math.max(0.01, Math.abs(m.a));
}

function drawLine(ctx: Ctx, s: Seg, thin = 0): void {
  const n = s.n, x = s.x, y = s.y, rad = s.rad, c = s.def.color, mw = minWidth(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (c.alpha < 1 || c.add || c.fade > 0) {
    // translucent: one stroke, otherwise every joint shows as a dot
    ctx.lineWidth = Math.max(mw, thin || s.maxRad * 1.5);
    const g = ctx.createLinearGradient(x[0], y[0], x[n], y[n]);
    g.addColorStop(0, s.cols[0]);
    g.addColorStop(1, s.cols[n]);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.moveTo(x[0], y[0]);
    for (let i = 1; i < n; i++) ctx.quadraticCurveTo(x[i], y[i], (x[i] + x[i + 1]) / 2, (y[i] + y[i + 1]) / 2);
    ctx.lineTo(x[n], y[n]);
    ctx.stroke();
    return;
  }
  if (lod === 1 && c.pattern === 'bands') {
    // a banded part: its stripes are its colours, so one stroke per band (a run of links of one colour)
    for (let i = 1; i <= n;) {
      let j = i;
      while (j < n && s.cols[j + 1] === s.cols[i]) j++;
      ctx.lineWidth = Math.max(mw, rad[i - 1] + rad[j]);
      ctx.strokeStyle = s.cols[i];
      ctx.beginPath();
      ctx.moveTo(x[i - 1], y[i - 1]);
      for (let k = i; k <= j; k++) ctx.lineTo(x[k], y[k]);
      ctx.stroke();
      i = j + 1;
    }
    return;
  }
  if (lod >= 1) {
    // smaller: one stroke instead of one per link (the colours along it kept by a gradient, a flat colour
    // when small), as wide as between its base and its middle; on a thin part the taper does not show
    ctx.lineWidth = Math.max(mw, thin || rad[0] + rad[n >> 1]);
    if (lod >= 2 || n < 2) ctx.strokeStyle = s.cols[n >> 1];
    else {
      const g = ctx.createLinearGradient(x[0], y[0], x[n], y[n]);
      g.addColorStop(0, s.cols[0]);
      g.addColorStop(1, s.cols[n]);
      ctx.strokeStyle = g;
    }
    ctx.beginPath();
    ctx.moveTo(x[0], y[0]);
    for (let i = 1; i <= n; i++) ctx.lineTo(x[i], y[i]);
    ctx.stroke();
    return;
  }
  for (let i = 1; i <= n; i++) {
    ctx.lineWidth = Math.max(mw, thin || rad[i - 1] + rad[i]);
    ctx.strokeStyle = s.cols[i];
    ctx.beginPath();
    ctx.moveTo(x[i - 1], y[i - 1]);
    ctx.lineTo(x[i], y[i]);
    ctx.stroke();
  }
}

function drawDiscs(ctx: Ctx, s: Seg): void {
  for (let i = s.n; i >= 0; i--) {
    ctx.fillStyle = s.cols[i];
    ctx.beginPath();
    ctx.arc(s.x[i], s.y[i], s.rad[i] * (1 + s.pulse * (s.pulseU ? 1 : i / s.n)), 0, TAU);
    ctx.fill();
  }
}

// point of an outline at a fractional node index
const hx = (side: { x: Float32Array }, u: number) => { const i = Math.floor(u), f = u - i; return f ? side.x[i] + (side.x[i + 1] - side.x[i]) * f : side.x[i]; };
const hy = (side: { y: Float32Array }, u: number) => { const i = Math.floor(u), f = u - i; return f ? side.y[i] + (side.y[i + 1] - side.y[i]) * f : side.y[i]; };

/** body patterns drawn over a ribbon or plates */
function drawMotif(ctx: Ctx, s: Seg, flat: boolean): void {
  const c = s.def.color, p = c.pattern, n = s.n;
  if (!p || p === 'none' || s.maxRad < 1) return;
  hull(s, 1, 0);
  ctx.fillStyle = s.patCol;
  if (p === 'bands') {
    // band q covers t in [(2q+1)/2nb, (2q+2)/2nb], cut along the outline
    const nb = Math.max(1, Math.round(c.pdensity));
    ctx.beginPath();
    for (let q = 0; q < nb; q++) {
      const u0 = ((2 * q + 1) / (2 * nb)) * n, u1 = ((2 * q + 2) / (2 * nb)) * n;
      ctx.moveTo(hx(L, u0), hy(L, u0));
      for (let u = Math.floor(u0) + 1; u < u1; u++) ctx.lineTo(L.x[u], L.y[u]);
      ctx.lineTo(hx(L, u1), hy(L, u1));
      ctx.lineTo(hx(R, u1), hy(R, u1));
      for (let u = Math.ceil(u1) - 1; u > u0; u--) ctx.lineTo(R.x[u], R.y[u]);
      ctx.lineTo(hx(R, u0), hy(R, u0));
      ctx.closePath();
    }
    ctx.fill();
  } else if (p === 'spots') {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      for (let q = 0; q < 3; q++) {
        const id = i * 3 + q;
        if (hash(id, 7) * 12 > c.pdensity) continue;
        const u = (hash(id, 9) * 2 - 1) * 0.62, r = C.r[i] * (0.13 + 0.14 * hash(id, 11)) * c.pscale;
        if (r < 0.2) continue;
        const cx = C.x[i] + (L.x[i] - C.x[i]) * u, cy = C.y[i] + (L.y[i] - C.y[i]) * u;
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, TAU);
      }
    }
    ctx.fill();
  } else if (p === 'stripe') {
    ribbonPath(ctx, s, 0.2 * c.pscale, 0, flat);
    ctx.fill();
  } else if (p === 'ocelli') {
    const no = Math.max(1, Math.round(c.pdensity / 2));
    for (let q = 0; q < no; q++) {
      const i = clamp(Math.round(((q + 0.5) / no) * n), 1, Math.max(1, n - 1));
      const rr = C.r[i] * 0.3 * c.pscale;
      for (let sd = -1; sd <= 1; sd += 2) {
        const ex = C.x[i] + (L.x[i] - C.x[i]) * 0.5 * sd, ey = C.y[i] + (L.y[i] - C.y[i]) * 0.5 * sd;
        ctx.fillStyle = s.edgeCol;
        ctx.beginPath(); ctx.arc(ex, ey, rr, 0, TAU); ctx.fill();
        ctx.fillStyle = s.patCol;
        ctx.beginPath(); ctx.arc(ex, ey, rr * 0.68, 0, TAU); ctx.fill();
        ctx.fillStyle = s.edgeCol;
        ctx.beginPath(); ctx.arc(ex, ey, rr * 0.26, 0, TAU); ctx.fill();
      }
    }
  } else if (p === 'edge') {
    ribbonPath(ctx, s, 1, 0, flat);
    ctx.lineWidth = s.maxRad * 0.2 * c.pscale;
    ctx.strokeStyle = s.patCol;
    ctx.stroke();
  }
}

/** membrane between two neighbour copies (fins with rays, webbed arms) */
function webPair(ctx: Ctx, A: Seg, B: Seg, f: number): void {
  const ma = Math.max(1, Math.round(A.n * f)), mb = Math.max(1, Math.round(B.n * f));
  ctx.beginPath();
  ctx.moveTo(A.x[0], A.y[0]);
  for (let i = 1; i <= ma; i++) ctx.lineTo(A.x[i], A.y[i]);
  // scalloped trailing edge, pulled toward the base
  const mx = (A.x[ma] + B.x[mb]) / 2, my = (A.y[ma] + B.y[mb]) / 2;
  const bx = (A.x[0] + B.x[0]) / 2, by = (A.y[0] + B.y[0]) / 2;
  ctx.quadraticCurveTo(mx + (bx - mx) * 0.3, my + (by - my) * 0.3, B.x[mb], B.y[mb]);
  for (let i = mb - 1; i >= 0; i--) ctx.lineTo(B.x[i], B.y[i]);
  ctx.closePath();
  ctx.fillStyle = A.webCol;
  ctx.fill();
}

export function drawWebs(ctx: Ctx, s: Seg, front: boolean, o: DrawOptions): void {
  const ch = s.children;
  for (const a of s.def.attach) {
    if (!(a.web > 0) || !!a.front !== front || (o.lit && !a.node.color.add)) continue;
    const pos: Seg[] = [], neg: Seg[] = [];
    for (const c of ch) if (c.att === a) (c.side < 0 ? neg : pos).push(c);
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    ctx.globalCompositeOperation = a.node.color.add ? 'lighter' : 'source-over';
    for (const g of [pos, neg]) {
      g.sort((p, q) => p.k - q.k);
      const ring = a.pattern === 'ring' && g.length > 2;
      for (let j = 0; j < g.length - (ring ? 0 : 1); j++) {
        const A = g[j], B = g[(j + 1) % g.length];
        // a torn membrane stays torn
        if (B.k - A.k === 1 || (ring && A.k === a.count - 1 && B.k === 0)) webPair(ctx, A, B, a.web);
      }
    }
  }
}

function drawEye(ctx: Ctx, s: Seg): void {
  const n = s.n, er = s.def.width * s.scale;
  drawLine(ctx, s, Math.max(0.35, er * 0.45));
  const ex = s.x[n], ey = s.y[n];
  ctx.fillStyle = '#05060c';
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
  ctx.lineWidth = er * 0.3;
  ctx.strokeStyle = s.cols[n];
  ctx.beginPath(); ctx.arc(ex, ey, er * 0.78, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(ex - er * 0.3, ey - er * 0.3, er * 0.26, 0, TAU); ctx.fill();
}

export function inView(b: Box, v?: Box): boolean {
  return !v || !(b[2] < v[0] || b[0] > v[2] || b[3] < v[1] || b[1] > v[3]);
}

export function drawSelf(ctx: Ctx, s: Seg, o: DrawOptions): void {
  const d = s.def;
  if (o.lit && !(d.color.add || d.color.glow !== 'none')) return;
  ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * (d.color.add ? (o.addScale === undefined ? 1 : o.addScale) : 1);
  ctx.globalCompositeOperation = d.color.add ? (o.addOp || 'lighter') : 'source-over';
  lod = o.lod || 0;
  switch (d.style) {
    case 'ribbon': drawRibbon(ctx, s); break;
    case 'plates': drawPlates(ctx, s); break;
    case 'line': drawLine(ctx, s); break;
    case 'eye': drawEye(ctx, s); break;
    default: drawDiscs(ctx, s);
  }
}

/** parts attached "behind" are drawn before their parent, the others after */
export function drawSeg(ctx: Ctx, s: Seg, o: DrawOptions = {}): void {
  const ch = s.children;
  if (!s.parent) ink = !!o.ink;
  drawWebs(ctx, s, false, o);
  // far copies (profile view) first, so the near ones and the body cover them
  for (const c of ch) if (c.far && !c.att?.front) drawSeg(ctx, c, o);
  for (const c of ch) if (!c.far && !c.att?.front) drawSeg(ctx, c, o);
  if (inView(s.box, o.view)) drawSelf(ctx, s, o);
  drawWebs(ctx, s, true, o);
  for (const c of ch) if (c.att?.front) drawSeg(ctx, c, o);
  if (!s.parent) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawEyes(ctx: Ctx, cr: Creature, bright?: boolean): void {
  const e = cr.spec.eyes;
  if (!e.on) return;
  const r = cr.root, h = cr.heading(), rad = r.rad[0];
  if (cr.profile) {
    // one eye, a little toward the back, looking ahead
    const fx = Math.cos(h), fy = Math.sin(h), side = cr.facing >= 0 ? 1 : -1;
    // the back is opposite the belly: belly normal = side * (-sin pa, cos pa), pa = h - PI
    const bx = -side * Math.sin(h), by = side * Math.cos(h);
    const er = Math.max(1, rad * 0.36 * e.size);
    const ex = r.x[0] + fx * rad * (e.fwd + 0.1) + bx * rad * 0.22, ey = r.y[0] + fy * rad * (e.fwd + 0.1) + by * rad * 0.22;
    ctx.fillStyle = bright ? '#f4fffd' : '#fbf6ec';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(minWidth(ctx), er * 0.16);
    ctx.strokeStyle = 'rgba(10,14,24,0.55)';
    ctx.stroke();
    ctx.fillStyle = '#05080f';
    ctx.beginPath(); ctx.arc(ex + fx * er * 0.32, ey + fy * er * 0.32, er * 0.56, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(ex + fx * er * 0.12 - er * 0.18, ey + fy * er * 0.12 - er * 0.22, er * 0.2, 0, TAU); ctx.fill();
    return;
  }
  const fx = Math.cos(h), fy = Math.sin(h), px = -fy, py = fx, er = Math.max(0.8, rad * 0.27 * e.size);
  for (let sd = -1; sd <= 1; sd += 2) {
    const ex = r.x[0] + fx * rad * e.fwd + px * rad * e.spread * sd;
    const ey = r.y[0] + fy * rad * e.fwd + py * rad * e.spread * sd;
    ctx.fillStyle = bright ? '#eafffb' : 'rgba(255,244,228,0.9)';
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = '#02060c';
    ctx.beginPath(); ctx.arc(ex + fx * er * 0.3, ey + fy * er * 0.3, er * 0.5, 0, TAU); ctx.fill();
  }
}

export function draw(ctx: Ctx, cr: Creature, o: DrawOptions = {}): void {
  drawSeg(ctx, cr.root, o);
  if (o.lit) return;
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  drawEyes(ctx, cr, o.bright);
  ctx.globalAlpha = 1;
}

/** calls fn(x, y, size, hue, alpha) for every glowing point */
export function eachGlow(list: Seg[], fn: (x: number, y: number, size: number, hue: number, a: number) => void, view?: Box): void {
  for (const s of list) {
    const g = s.def.color.glow;
    if (g === 'none' || !inView(s.box, view)) continue;
    if (g === 'tip') fn(s.x[s.n], s.y[s.n], 8 + s.rad[s.n] * 8, s.hue, 0.85);
    else {
      const step = Math.max(1, Math.round(s.n / 5));
      for (let k = 0; k <= s.n; k += step) fn(s.x[k], s.y[k], 6 + s.rad[k] * 3, s.hue, 0.14);
    }
  }
}

/** static portrait: swims a moment so that parts trail, then fits the canvas */
export function snapshot(sp: Creature['spec'], canvas: HTMLCanvasElement, o: { pad?: number; max?: number; w?: number; h?: number } = {}): void {
  const cr = new Creature(sp, 0, 0, { dir: 0, phase: 0 });
  for (let t = 0; t < 80; t++) cr.update(t / 60, -1.3, 0, 0.25);
  const b = cr.box, dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || o.w || 120, h = canvas.clientHeight || o.h || 80;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!, pad = o.pad === undefined ? 6 : o.pad;
  const k = Math.min((w - pad * 2) / (b[2] - b[0] || 1), (h - pad * 2) / (b[3] - b[1] || 1), o.max || 4);
  ctx.setTransform(k * dpr, 0, 0, k * dpr, dpr * (w / 2 - ((b[0] + b[2]) / 2) * k), dpr * (h / 2 - ((b[1] + b[3]) / 2) * k));
  draw(ctx, cr);
}

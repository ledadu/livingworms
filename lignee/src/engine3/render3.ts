// Flat rendering of the 3D whips. Every chain is projected by the camera; the
// width of each ribbon on screen is the half-extent of its real cross-section
// (an ellipse in space) seen from the eye, so a body that turns away narrows by
// itself. The projected chains are then drawn by the 2D ribbon renderer:
// gradients, motifs, ink, all flat. Parts are ordered by depth.

import type { Seg } from '../engine/creature';
import { TAU, wrapAngle } from '../engine/util';
import { drawSelf, drawWebs, setInk, type DrawOptions } from '../engine/render';
import type { Creature3, Seg3 } from './creature3';
import type { Proj, Projector } from './view';

type Ctx = CanvasRenderingContext2D;

/** what the 2D renderer reads of a Seg, filled with projected data */
interface Shim {
  seg: Seg3;
  def: Seg3['def']; att: Seg3['att']; n: number; k: number; side: number; hue: number;
  parent: Shim | null; children: Shim[];
  x: Float32Array; y: Float32Array; ang: Float32Array; rad: Float32Array; lens: Float32Array;
  cols: string[]; edgeCol: string; shineCol: string; patCol: string; webCol: string;
  maxRad: number; pulse: number; pulseU: boolean; scale: number; box: [number, number, number, number]; cut: boolean; far: boolean;
  /** ordering key: mean world z (larger = further from the eye) */
  key: number;
  /** per-node perspective scale */
  sc: Float32Array;
}

const shims = new WeakMap<Creature3, Shim>();

function build(seg: Seg3, parent: Shim | null): Shim {
  const N = seg.n + 1;
  const sh: Shim = {
    seg, def: seg.def, att: seg.att, n: seg.n, k: seg.k, side: seg.side, hue: seg.hue, parent, children: [],
    x: new Float32Array(N), y: new Float32Array(N), ang: new Float32Array(N), rad: new Float32Array(N), lens: new Float32Array(N),
    cols: seg.cols, edgeCol: seg.edgeCol, shineCol: seg.shineCol, patCol: seg.patCol, webCol: seg.webCol,
    maxRad: 0, pulse: 0, pulseU: seg.pulseU, scale: seg.scale, box: [0, 0, 0, 0], cut: false, far: false, key: 0, sc: new Float32Array(N)
  };
  for (const c of seg.children) sh.children.push(build(c, sh));
  return sh;
}

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };
const A = { x: 0, y: 0 }, B = { x: 0, y: 0 };
const tan = { x: 0, y: 0, z: 0 }, bel = { x: 0, y: 0, z: 0 }, lat = { x: 0, y: 0, z: 0 }, wid = { x: 0, y: 0, z: 0 };

/** unit belly axis perpendicular to t (world down, made perpendicular) */
function bellyOf(t: { x: number; y: number; z: number }, side: { x: number; y: number; z: number }, out: { x: number; y: number; z: number }): void {
  const d = t.y;
  out.x = -t.x * d; out.y = 1 - t.y * d; out.z = -t.z * d;
  let l = Math.hypot(out.x, out.y, out.z);
  if (l < 0.2) {
    const fd = side.x * t.x + side.y * t.y + side.z * t.z;
    out.x = side.x - t.x * fd; out.y = side.y - t.y * fd; out.z = side.z - t.z * fd;
    l = Math.hypot(out.x, out.y, out.z);
  }
  out.x /= l; out.y /= l; out.z /= l;
}

function projectSeg(sh: Shim, cr: Creature3, view: Projector): void {
  const s = sh.seg, n = s.n, kind = s.kind;
  let zsum = 0, mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity, ssum = 0;
  for (let i = 0; i <= n; i++) {
    view.project(s.x[i], s.y[i], s.z[i], P);
    sh.x[i] = P.x; sh.y[i] = P.y; sh.sc[i] = P.s;
    zsum += s.z[i]; ssum += P.s;
  }
  sh.key = zsum / (n + 1);
  for (let i = 1; i <= n; i++) sh.ang[i] = Math.atan2(sh.y[i] - sh.y[i - 1], sh.x[i] - sh.x[i - 1]);
  sh.ang[0] = sh.ang[1];
  for (let i = 1; i <= n; i++) sh.lens[i] = Math.hypot(sh.x[i] - sh.x[i - 1], sh.y[i] - sh.y[i - 1]);
  sh.pulse = s.pulse;
  let maxE = 0;
  for (let i = 0; i <= n; i++) {
    const r = s.rad[i], sc = sh.sc[i];
    let e: number;
    if (kind === 'round') e = r * sc;
    else {
      // tangent of the chain at this node (world)
      const i0 = Math.max(1, i), i1 = Math.min(n, i + 1);
      tan.x = s.dx[i0] + s.dx[i1]; tan.y = s.dy[i0] + s.dy[i1]; tan.z = s.dz[i0] + s.dz[i1];
      const tl = Math.hypot(tan.x, tan.y, tan.z) || 1; tan.x /= tl; tan.y /= tl; tan.z /= tl;
      let ax: number, ay: number, az: number, bx: number, by: number, bz: number, rb: number;
      if (kind === 'body') {
        // height along the belly axis, thickness across
        bellyOf(tan, cr.side, bel);
        lat.x = tan.y * bel.z - tan.z * bel.y; lat.y = tan.z * bel.x - tan.x * bel.z; lat.z = tan.x * bel.y - tan.y * bel.x;
        ax = bel.x; ay = bel.y; az = bel.z; bx = lat.x; by = lat.y; bz = lat.z; rb = r * s.thick;
      } else {
        // a blade: wide in its bend plane, thin along the bend axis
        wid.x = s.nb.y * tan.z - s.nb.z * tan.y; wid.y = s.nb.z * tan.x - s.nb.x * tan.z; wid.z = s.nb.x * tan.y - s.nb.y * tan.x;
        const wl = Math.hypot(wid.x, wid.y, wid.z) || 1;
        ax = wid.x / wl; ay = wid.y / wl; az = wid.z / wl; bx = s.nb.x; by = s.nb.y; bz = s.nb.z; rb = r * s.thick;
      }
      view.axis(ax * r, ay * r, az * r, sc, A);
      view.axis(bx * rb, by * rb, bz * rb, sc, B);
      // screen normal of the chain here
      const i2 = Math.min(n, i + 1), i3 = Math.max(0, i - 1);
      const ta = Math.atan2(sh.y[i2] - sh.y[i3], sh.x[i2] - sh.x[i3]), nx = -Math.sin(ta), ny = Math.cos(ta);
      const pa = A.x * nx + A.y * ny, pb = B.x * nx + B.y * ny;
      e = Math.sqrt(pa * pa + pb * pb);
    }
    sh.rad[i] = Math.max(0.2, e);
    if (e > maxE) maxE = e;
    if (sh.x[i] - e < mnx) mnx = sh.x[i] - e; if (sh.x[i] + e > mxx) mxx = sh.x[i] + e;
    if (sh.y[i] - e < mny) mny = sh.y[i] - e; if (sh.y[i] + e > mxy) mxy = sh.y[i] + e;
  }
  sh.maxRad = maxE;
  sh.box[0] = mnx; sh.box[1] = mny; sh.box[2] = mxx; sh.box[3] = mxy;
  sh.scale = s.scale * (ssum / (n + 1));
  for (const c of sh.children) projectSeg(c, cr, view);
}

const EPS = 0.6;

function drawTree(ctx: Ctx, sh: Shim, o: DrawOptions): void {
  const ch = sh.children, me = sh as unknown as Seg;
  drawWebs(ctx, me, false, o);
  // parts further from the eye than this one first, nearer ones after it
  for (const c of ch) if (c.key > sh.key + EPS || (Math.abs(c.key - sh.key) <= EPS && !c.att?.front)) drawTree(ctx, c, o);
  drawSelf(ctx, me, o);
  drawWebs(ctx, me, true, o);
  for (const c of ch) if (!(c.key > sh.key + EPS || (Math.abs(c.key - sh.key) <= EPS && !c.att?.front))) drawTree(ctx, c, o);
  if (!sh.parent) { ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
}

const H = { x: 0, y: 0, z: 0 }, F = { x: 0, y: 0, z: 0 }, E = { x: 0, y: 0, z: 0 }, T = { x: 0, y: 0, z: 0 };

/** the eyes: placed in space on the head, drawn only if their side faces the eye */
function drawEyes3(ctx: Ctx, cr: Creature3, view: Projector, bright?: boolean): void {
  const e = cr.spec.eyes;
  if (!e.on) return;
  const r = cr.root, rad = r.rad[0];
  F.x = -r.dx[1]; F.y = -r.dy[1]; F.z = -r.dz[1];
  bellyOf(F, cr.side, bel);
  lat.x = F.y * bel.z - F.z * bel.y; lat.y = F.z * bel.x - F.x * bel.z; lat.z = F.x * bel.y - F.y * bel.x;
  const er = Math.max(0.8, rad * 0.3 * e.size);
  // draw the far eye first so the near one covers it
  const eyes: { sd: number; k: number }[] = [];
  for (const sd of [-1, 1]) {
    H.x = r.x[0] + F.x * rad * e.fwd - bel.x * rad * 0.3 + lat.x * sd * rad * e.spread * 0.85;
    H.y = r.y[0] + F.y * rad * e.fwd - bel.y * rad * 0.3 + lat.y * sd * rad * e.spread * 0.85;
    H.z = r.z[0] + F.z * rad * e.fwd - bel.z * rad * 0.3 + lat.z * sd * rad * e.spread * 0.85;
    view.toward(H.x, H.y, H.z, T);
    const vis = (lat.x * sd * T.x + lat.y * sd * T.y + lat.z * sd * T.z);
    if (vis > -0.12) eyes.push({ sd, k: vis });
  }
  eyes.sort((a, b) => a.k - b.k);
  for (const { sd } of eyes) {
    H.x = r.x[0] + F.x * rad * e.fwd - bel.x * rad * 0.3 + lat.x * sd * rad * e.spread * 0.85;
    H.y = r.y[0] + F.y * rad * e.fwd - bel.y * rad * 0.3 + lat.y * sd * rad * e.spread * 0.85;
    H.z = r.z[0] + F.z * rad * e.fwd - bel.z * rad * 0.3 + lat.z * sd * rad * e.spread * 0.85;
    view.project(H.x, H.y, H.z, P);
    const px = P.x, py = P.y, s = P.s, rr = er * s;
    E.x = H.x + F.x * er; E.y = H.y + F.y * er; E.z = H.z + F.z * er;
    view.project(E.x, E.y, E.z, P);
    let fx = P.x - px, fy = P.y - py; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
    const look = Math.min(1, fl / (rr || 1));
    ctx.fillStyle = bright ? '#f4fffd' : '#fbf6ec';
    ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(0.6, rr * 0.16);
    ctx.strokeStyle = 'rgba(10,14,24,0.55)';
    ctx.stroke();
    ctx.fillStyle = '#05080f';
    ctx.beginPath(); ctx.arc(px + fx * rr * 0.34 * look, py + fy * rr * 0.34 * look, rr * 0.56, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(px + fx * rr * 0.1 - rr * 0.18, py + fy * rr * 0.1 - rr * 0.22, rr * 0.2, 0, TAU); ctx.fill();
  }
}

export interface Draw3Options { alpha?: number; bright?: boolean; ink?: boolean; lit?: boolean; }

/** draw a creature; the context must be scaled to screen pixels */
export function draw3(ctx: Ctx, cr: Creature3, view: Projector, o: Draw3Options = {}): void {
  let root = shims.get(cr);
  if (!root) { root = build(cr.root, null); shims.set(cr, root); }
  projectSeg(root, cr, view);
  setInk(!!o.ink);
  const opts: DrawOptions = { alpha: o.alpha, bright: o.bright, lit: o.lit, ink: o.ink };
  drawTree(ctx, root, opts);
  if (o.lit) return;
  ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
  drawEyes3(ctx, cr, view, o.bright);
  ctx.globalAlpha = 1;
}

/** screen box of a creature after the last draw3 */
export function screenBox(cr: Creature3): [number, number, number, number] | null {
  const root = shims.get(cr);
  if (!root) return null;
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (s: Shim) => {
    if (s.box[0] < b[0]) b[0] = s.box[0]; if (s.box[1] < b[1]) b[1] = s.box[1];
    if (s.box[2] > b[2]) b[2] = s.box[2]; if (s.box[3] > b[3]) b[3] = s.box[3];
    for (const c of s.children) walk(c);
  };
  walk(root);
  return b;
}

/** glowing points, in screen space: fn(x, y, size, hue, alpha) */
export function eachGlow3(cr: Creature3, view: Projector, fn: (x: number, y: number, size: number, hue: number, a: number) => void): void {
  for (const s of cr.list) {
    const g = s.def.color.glow;
    if (g === 'none') continue;
    const at = (i: number, size: number, a: number) => {
      view.project(s.x[i], s.y[i], s.z[i], P);
      fn(P.x, P.y, size * P.s, s.hue, a);
    };
    if (g === 'tip') at(s.n, 8 + s.rad[s.n] * 8, 0.85);
    else {
      const step = Math.max(1, Math.round(s.n / 5));
      for (let k = 0; k <= s.n; k += step) at(k, 6 + s.rad[k] * 3, 0.14);
    }
  }
}

void wrapAngle;

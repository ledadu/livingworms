// The Glacier: a tongue of freezing brine that dives from a far-off ice shelf
// down to the floor, walls of blue ice behind it, frost needles growing around
// the cold stream, crystals hanging in the water. The walls and the needles are
// set pieces of the world (world.ts bakes them like the other decor); the
// stream and the crystals move, and are drawn here every frame.

import { TAU, clamp, lerp, noise1, rng, seedOf } from '../engine';
import type { Gfx } from '../engine3/gfx';
import type { Proj, View } from '../engine3/view';
import { BIOMES, X1, floorAt, presence, type Biome } from './biomes';
import { css, type HSL, type Mood } from './palette';
import { fogOf, makeCanvas, type Sprite } from './sprites';
import type { Decor } from './world';

/** the biome of the map that gets this decor */
export const GLACIER_ID = 'glacier';

/** the light and the life proposed for the Glacier's entry of the map: glacier blue and pearly white, cold and diffuse */
export const GLACIER_MOOD: Partial<Biome> = {
  top: { h: 194, s: 55, l: 42 }, deep: { h: 214, s: 62, l: 9 }, sky: { h: 188, s: 45, l: 90 },
  sand: { h: 200, s: 16, l: 64 }, rock: { h: 208, s: 24, l: 38 },
  accents: [{ h: 190, s: 55, l: 80 }, { h: 200, s: 25, l: 92 }, { h: 222, s: 35, l: 66 }],
  blades: [{ h: 192, s: 28, l: 72 }, { h: 210, s: 18, l: 82 }],
  rays: 0.25, caustics: 0, plankton: { h: 188, s: 60, l: 94 },
  dark: 0.35, snow: 0.2, encrust: 0,
  rocks: { every: 260, r: [14, 34] },
  flora: { every: 90, kinds: [['eponge', 1], ['crinoide', 1]], front: [['eponge', 0.5]] },
  fauna: [['clione', 'swim', 3, 0.8], ['krill', 'swim', 3, 0.8], ['chrysaora', 'swim', 1.5, 0.8]],
  pop: 22
};

/** ?glacier=<biome id> shows the Glacier in another biome (a preview while the map has none) */
const PREVIEW = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('glacier') : null;
if (PREVIEW && !BIOMES.some((b) => b.id === GLACIER_ID)) {
  const b = BIOMES.find((q) => q.id === PREVIEW);
  if (b) Object.assign(b, GLACIER_MOOD, { id: GLACIER_ID });
}

/** where the Glacier lies along x, or null when the map has none */
export function glacierSpan(): [number, number] | null {
  const i = BIOMES.findIndex((b) => b.id === GLACIER_ID);
  if (i < 0) return null;
  return [BIOMES[i].x0, i + 1 < BIOMES.length ? BIOMES[i + 1].x0 : X1];
}

/** how much of the Glacier is at x (0..1) */
export function glacierAt(x: number): number {
  const i = BIOMES.findIndex((b) => b.id === GLACIER_ID);
  return i < 0 ? 0 : presence(x, i);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

// ----- the tongue of cold water ----- //

/** the path of the stream: samples along x, falling steeply first, then hugging the floor down the slope */
export interface Tongue { n: number; x: Float32Array; y: Float32Array; z: Float32Array; len: number; }

export function makeTongue([a, b]: [number, number], n = 96): Tongue {
  const L = b - a, xs = a + 0.12 * L, xe = a + 0.9 * L;
  const x = new Float32Array(n), y = new Float32Array(n), z = new Float32Array(n);
  let len = 0;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    x[i] = lerp(xs, xe, u);
    z[i] = lerp(320, 110, u) + (noise1(u * 4, 911) - 0.5) * 60;
    const fl = floorAt(x[i], z[i]);
    y[i] = Math.max(20, fl - 10 - 900 * (1 - smooth(clamp(u / 0.3, 0, 1))));
    if (i) len += Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1], z[i] - z[i - 1]);
  }
  return { n, x, y, z, len };
}

/** a point of the path at u in 0..1 */
function along(tg: Tongue, u: number, out: { x: number; y: number; z: number }): void {
  const f = clamp(u, 0, 1) * (tg.n - 1), i = Math.min(tg.n - 2, Math.floor(f)), k = f - i;
  out.x = lerp(tg.x[i], tg.x[i + 1], k); out.y = lerp(tg.y[i], tg.y[i + 1], k); out.z = lerp(tg.z[i], tg.z[i + 1], k);
}

// ----- set pieces: walls of ice and frost needles ----- //

/** the walls and the needles of the Glacier, as decor of the world */
export function glacierDecor(span: [number, number] | null = glacierSpan()): Decor[] {
  if (!span) return [];
  const [a, b] = span, R = rng(4471), out: Decor[] = [];
  const add = (kind: Decor['kind'], x: number, z: number, h: number) =>
    out.push({ kind, x, z, seed: seedOf(Math.round(x), Math.round(z)), h, sprite: null, spriteD: 0 });
  // cliffs of blue ice at the back, a lower row in the middle distance
  for (let x = a - 150; x < b + 150; x += 220 + R() * 220) add('ice', x, 520 + R() * 1000, 300 + R() * 460);
  for (let x = a + 200; x < b - 200; x += 500 + R() * 500) add('ice', x, 220 + R() * 200, 130 + R() * 140);
  // frost grows on both banks of the stream, thicker where it lands
  const tg = makeTongue(span), p = { x: 0, y: 0, z: 0 };
  for (let u = 0.26; u < 0.97; u += 0.03 + R() * 0.03) {
    along(tg, u, p);
    const big = u < 0.45 ? 1.4 : 1;
    for (const side of [-1, 1]) if (R() < 0.8) add('frost', p.x + (R() - 0.5) * 40, Math.max(40, p.z + side * (45 + R() * 70)), (28 + R() * 44) * big);
  }
  // and a few tufts here and there
  for (let x = a; x < b; x += 120 + R() * 200) add('frost', x, 40 + R() * 700, 18 + R() * 30);
  return out;
}

/** pull a baked image toward the water colour */
function wash(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, fog: number, col: HSL): void {
  if (fog <= 0.01) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = css(col, fog);
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
}

const ICE: HSL = { h: 197, s: 62, l: 50 };

/** a cliff of glacier ice: jagged top lit from above, facets, flutes, cracks, a cold glow inside, icicles under its ledges */
function bakeWall(d: Decor, fog: number, fogCol: HSL, res: number): Sprite {
  const R = rng(d.seed), H = d.h, W = H * (0.55 + R() * 0.45);
  const w = W + 40, h = H + 30, c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const x0 = 20, by = h - 6, ice = { h: ICE.h + (R() - 0.5) * 14, s: ICE.s, l: ICE.l };
  // the silhouette: sloping sides, a jagged crest
  // a peak, or a flat-topped slab broken off the shelf
  const top: [number, number][] = [], N = 5 + Math.floor(R() * 4), slab = R() < 0.4;
  for (let i = 0; i <= N; i++) {
    const u = i / N, edge = slab ? Math.min(1, Math.sin(u * Math.PI) * 3) : Math.sin(u * Math.PI);
    top.push([x0 + W * (0.08 + u * 0.84) + (R() - 0.5) * (W / N) * 0.5, by - H * (0.35 + 0.65 * edge) * (0.75 + R() * 0.25)]);
  }
  const path = new Path2D();
  path.moveTo(x0, by + 4);
  for (const [x, y] of top) path.lineTo(x, y);
  path.lineTo(x0 + W, by + 4);
  path.closePath();
  const g = ctx.createLinearGradient(0, by - H, 0, by);
  g.addColorStop(0, css(ice, 0.95, 32)); g.addColorStop(0.4, css(ice, 0.92, 8)); g.addColorStop(1, css(ice, 0.9, -18));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  // lit from the left, in shadow on the right
  const side = ctx.createLinearGradient(x0, 0, x0 + W, 0);
  side.addColorStop(0, 'rgba(235,250,255,0.28)'); side.addColorStop(0.5, 'rgba(235,250,255,0)'); side.addColorStop(1, 'rgba(10,30,70,0.3)');
  ctx.fillStyle = side;
  ctx.fillRect(x0, by - H, W, H + 4);
  // facets
  for (let i = 0; i < 18; i++) {
    const cx = x0 + R() * W, cy = by - R() * H, s = 12 + R() * H * 0.22;
    ctx.fillStyle = R() < 0.5 ? css(ice, 0.2, 26) : css(ice, 0.2, -16);
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * (0.4 + R() * 0.5), cy + (R() - 0.3) * s);
    ctx.lineTo(cx - s * (0.2 + R() * 0.5), cy + s * (0.4 + R() * 0.6));
    ctx.closePath();
    ctx.fill();
  }
  // flutes: long vertical grooves carved by the cold stream
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = x0 + (0.1 + R() * 0.8) * W, y = by - H * (0.3 + R() * 0.6);
    ctx.strokeStyle = css(ice, 0.35, 30); ctx.lineWidth = 1.5 + R() * 2.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (R() - 0.5) * 20, (y + by) / 2, x + (R() - 0.5) * 16, by); ctx.stroke();
    ctx.strokeStyle = css(ice, 0.25, -22); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + 3, y + 6); ctx.lineTo(x + 5, by); ctx.stroke();
  }
  // a cold light deep inside the ice
  const gl = ctx.createRadialGradient(x0 + W * 0.45, by - H * 0.4, 0, x0 + W * 0.45, by - H * 0.4, H * 0.55);
  gl.addColorStop(0, 'rgba(170,240,255,0.35)'); gl.addColorStop(1, 'rgba(170,240,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x0, by - H, W, H);
  // cracks
  ctx.strokeStyle = 'rgba(240,252,255,0.55)'; ctx.lineWidth = 0.8;
  for (let k = 0; k < 5; k++) {
    let x = x0 + R() * W, y = by - R() * H * 0.8;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (R() - 0.5) * 18; y += 4 + R() * 12; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  // rim light along the crest, a dark line on the shadowed edge
  ctx.strokeStyle = 'rgba(245,253,255,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  ctx.strokeStyle = css(ice, 0.5, -30); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(top[N][0], top[N][1]); ctx.lineTo(x0 + W, by + 4); ctx.stroke();
  // ledges with icicles under them
  for (let k = 0, n = 1 + Math.floor(R() * 3); k < n; k++) {
    const lx = x0 + W * (0.15 + R() * 0.5), lw = W * (0.2 + R() * 0.25), ly = by - H * (0.25 + R() * 0.4);
    ctx.fillStyle = css(ice, 0.9, 30);
    ctx.beginPath(); ctx.ellipse(lx + lw / 2, ly, lw / 2, 3.5, 0, 0, TAU); ctx.fill();
    for (let x = lx + 3; x < lx + lw - 3; x += 3 + R() * 6) {
      const len = 6 + R() * 26;
      const ig = ctx.createLinearGradient(0, ly, 0, ly + len);
      ig.addColorStop(0, 'rgba(235,250,255,0.9)'); ig.addColorStop(1, 'rgba(160,225,255,0.2)');
      ctx.fillStyle = ig;
      ctx.beginPath(); ctx.moveTo(x - 1.6, ly); ctx.lineTo(x + 1.6, ly); ctx.lineTo(x + (R() - 0.5), ly + len); ctx.closePath(); ctx.fill();
    }
  }
  // frost at the foot
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = `rgba(235,250,255,${(0.3 + R() * 0.4).toFixed(2)})`;
    ctx.beginPath(); ctx.ellipse(x0 + R() * W, by - R() * 6, 3 + R() * 10, 1.5 + R() * 3, 0, 0, TAU); ctx.fill();
  }
  wash(ctx, c, fog, fogCol);
  return { canvas: c, ax: x0 + W / 2, ay: by, res };
}

/** a tuft of frost needles: thin spikes fanning out from the floor, with barbs like frost ferns and a glint at the tip */
function bakeFrost(d: Decor, fog: number, fogCol: HSL, res: number): Sprite {
  const R = rng(d.seed), L = d.h, w = L * 2 + 16, h = L + 14;
  const c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const cx = w / 2, by = h - 4, n = 7 + Math.floor(R() * 10);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (R() - 0.5) * 2.2, len = L * (0.35 + R() * 0.65), dx = Math.cos(a), dy = Math.sin(a);
    const bx = cx + (R() - 0.5) * 8, tx = bx + dx * len, ty = by + dy * len, wd = 1.2 + R() * 1.6;
    const g = ctx.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, 'rgba(150,215,245,0.75)'); g.addColorStop(1, 'rgba(245,253,255,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(bx - dy * wd, by + dx * wd); ctx.lineTo(bx + dy * wd, by - dx * wd); ctx.lineTo(tx, ty); ctx.closePath(); ctx.fill();
    // barbs at 60°, shorter toward the tip
    ctx.strokeStyle = 'rgba(225,248,255,0.6)'; ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let s = 0.25; s < 0.9; s += 0.14) {
      const px = bx + dx * len * s, py = by + dy * len * s, bl = len * 0.22 * (1 - s);
      for (const sg of [-1, 1]) {
        const ba = a + sg * 1.05;
        ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ba) * bl, py + Math.sin(ba) * bl);
      }
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(tx, ty, 1, 0, TAU); ctx.fill();
  }
  // the crust of rime they grow from
  ctx.fillStyle = 'rgba(225,245,255,0.7)';
  ctx.beginPath(); ctx.ellipse(cx, by, 8 + L * 0.15, 3, 0, 0, TAU); ctx.fill();
  wash(ctx, c, fog, fogCol);
  return { canvas: c, ax: cx, ay: by, res };
}

export function bakeIce(d: Decor, _m: Mood, fog: number, fogCol: HSL, res: number): Sprite | null {
  if (d.kind === 'ice') return bakeWall(d, fog, fogCol, Math.min(res, 1.5));
  if (d.kind === 'frost') return bakeFrost(d, fog, fogCol, res);
  return null;
}

// ----- drawn every frame: the stream and the crystals ----- //

/** what the frame gives to draw with (set by main.ts before drawing) */
export interface GlacierScene { view: View; ctx: CanvasRenderingContext2D; gx: Gfx | null; dpr: number; t: number; plane: number; }

const P: Proj = { x: 0, y: 0, s: 1, d: 1 }, Q: Proj = { x: 0, y: 0, s: 1, d: 1 };
const A = { x: 0, y: 0, z: 0 }, B = { x: 0, y: 0, z: 0 };

/** a soft elongated wisp of cold water, and the star of a crystal */
let wispSpr: HTMLCanvasElement | null = null, starSpr: HTMLCanvasElement | null = null;
function wisp(): HTMLCanvasElement {
  if (wispSpr) return wispSpr;
  const c = makeCanvas(64, 64), ctx = c.getContext('2d')!, g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(225,248,255,0.9)'); g.addColorStop(0.5, 'rgba(190,235,255,0.35)'); g.addColorStop(1, 'rgba(190,235,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return (wispSpr = c);
}
function star(): HTMLCanvasElement {
  if (starSpr) return starSpr;
  const c = makeCanvas(32, 32), ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 7);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(180,235,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  // six rays: a snow crystal catching the light
  ctx.strokeStyle = 'rgba(225,248,255,0.85)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 3; k++) { const a = (k * Math.PI) / 3 + Math.PI / 2, dx = Math.cos(a) * 14, dy = Math.sin(a) * 14; ctx.moveTo(16 - dx, 16 - dy); ctx.lineTo(16 + dx, 16 + dy); }
  ctx.stroke();
  return (starSpr = c);
}

/** draw a sprite centred on screen (css px), turned by ang and scaled to sx × sy */
function put(s: GlacierScene, spr: HTMLCanvasElement, x: number, y: number, ang: number, sx: number, sy: number, al: number): void {
  const co = Math.cos(ang), si = Math.sin(ang), hw = spr.width / 2, hh = spr.height / 2, k = s.dpr;
  const a = (co * sx * k) / hw, b = (si * sx * k) / hw, c = (-si * sy * k) / hh, d = (co * sy * k) / hh;
  if (s.gx) { s.gx.setTransform(a, b, c, d, x * k, y * k); s.gx.alpha = al; s.gx.image(spr, 0, 0, spr.width, spr.height, -hw, -hh, spr.width, spr.height); return; }
  s.ctx.setTransform(a, b, c, d, x * k, y * k); s.ctx.globalAlpha = al; s.ctx.drawImage(spr, -hw, -hh);
}

const SEGS = 8, FLOW = 70;
/** wisps of the stream: u0, offset across, offset in z, size; every third is a wide haze, every fifth a bright thread */
const wisps = (() => { const R = rng(3301), out: number[][] = []; for (let i = 0; i < 420; i++) out.push([R(), R() * 2 - 1, (R() - 0.5) * 70, R()]); return out; })();

let tongue: Tongue | null | undefined;
function theTongue(): Tongue | null {
  if (tongue === undefined) { const sp = glacierSpan(); tongue = sp ? makeTongue(sp) : null; }
  return tongue;
}

/** the stream as depth-sorted pieces, near the camera: push(depth, draw) */
export function glacierItems(s: GlacierScene, camX: number, push: (d: number, fn: () => void) => void): void {
  const tg = theTongue();
  if (!tg || camX < tg.x[0] - 2400 || camX > tg.x[tg.n - 1] + 2400) return;
  for (let k = 0; k < SEGS; k++) {
    along(tg, (k + 0.5) / SEGS, A);
    if (Math.abs(A.x - camX) > 2600) continue;
    push(s.view.depth(A.y, A.z), () => drawSegment(s, tg, k));
  }
}

function drawSegment(s: GlacierScene, tg: Tongue, k: number): void {
  const { view, t } = s, du = (t * FLOW) / tg.len;
  if (s.gx) s.gx.setBlend('over');
  for (let i = 0; i < wisps.length; i++) {
    const [u0, off, zo, sz] = wisps[i];
    const u = (u0 + du * (0.8 + sz * 0.4)) % 1;
    if (Math.floor(u * SEGS) !== k) continue;
    along(tg, u, A); along(tg, u + 0.004, B);
    const wide = (26 + 34 * u) * off, haze = i % 3 === 0, thread = !haze && i % 5 === 0;
    view.project(A.x, A.y + wide, A.z + zo, P);
    view.project(B.x, B.y + wide, B.z + zo, Q);
    if (P.d < 20) continue;
    const fade = smooth(clamp(u / 0.08, 0, 1)) * smooth(clamp((1 - u) / 0.1, 0, 1)) * (1 - fogOf(P.d, s.plane));
    const ang = Math.atan2(Q.y - P.y, Q.x - P.x);
    if (haze) { put(s, wisp(), P.x, P.y, ang, 130 * P.s, (40 + 30 * sz) * P.s, 0.16 * fade); continue; }
    if (thread) {
      if (s.gx) s.gx.setBlend('add'); else s.ctx.globalCompositeOperation = 'lighter';
      put(s, wisp(), P.x, P.y, ang, (70 + 50 * sz) * P.s, 2.5 * P.s, 0.5 * fade);
      if (s.gx) s.gx.setBlend('over'); else s.ctx.globalCompositeOperation = 'source-over';
      continue;
    }
    put(s, wisp(), P.x, P.y, ang, (30 + 40 * sz) * P.s, (5 + 5 * sz) * P.s, (0.3 + 0.3 * sz) * fade);
  }
  if (s.gx) s.gx.alpha = 1;
  s.ctx.globalAlpha = 1;
}

/** crystals hanging in the water around the camera: x, y, z, phase, size */
const crystals = (() => { const R = rng(5519), out: number[][] = []; for (let i = 0; i < 140; i++) out.push([R() * 1400, R() * 1000, -120 + R() * 1000, R() * TAU, R()]); return out; })();

/** the crystals twinkle over everything, like the plankton */
export function drawCrystals(s: GlacierScene, camX: number, camY: number): void {
  const here = glacierAt(camX);
  if (here < 0.02) return;
  const { view, t } = s;
  if (s.gx) s.gx.setBlend('add'); else s.ctx.globalCompositeOperation = 'lighter';
  for (const c of crystals) {
    // they sink slowly and drift with the cold stream
    const x = camX + ((((c[0] + t * 6) % 1400) + 2100) % 1400) - 700;
    const y = camY + ((((c[1] + t * 4 * (0.5 + c[4]) + 500) % 1000) + 1000) % 1000) - 500;
    if (y < 10) continue;
    view.project(x, y, c[2], P);
    if (P.d < 20) continue;
    const tw = Math.pow(Math.max(0, Math.sin(t * (0.8 + c[4]) + c[3])), 6);
    const size = (1.2 + c[4] * 2.2) * P.s * (1 + tw * 1.6);
    const al = here * (0.25 + 0.75 * tw) * (1 - fogOf(P.d, s.plane) * 0.8);
    if (al < 0.02 || size < 0.3) continue;
    put(s, star(), P.x, P.y, c[3] + t * 0.2, size * 2, size * 2, al);
  }
  if (s.gx) { s.gx.alpha = 1; s.gx.setBlend('over'); }
  s.ctx.globalAlpha = 1; s.ctx.globalCompositeOperation = 'source-over';
}

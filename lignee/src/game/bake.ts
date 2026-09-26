// Everything that is drawn once and reused: terrain tiles, distant planes,
// foreground silhouettes, caustics, glow sprites.

import { TAU, clamp, noise1, rng, seedOf } from '../engine';
import { css, fogged, moodAt, waterAt, type HSL, type Mood } from './palette';
import { CW, SEED, featuresOf, floorY, polyTop, reefness, type Feature } from './terrain';

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const hasFilter = (() => {
  try { const c = makeCanvas(1, 1).getContext('2d')!; c.filter = 'blur(1px)'; return c.filter === 'blur(1px)'; } catch { return false; }
})();

function polyPath(poly: number[], dx = 0, dy = 0): Path2D {
  const p = new Path2D();
  p.moveTo(poly[0] + dx, poly[1] + dy);
  for (let i = 2; i < poly.length; i += 2) p.lineTo(poly[i] + dx, poly[i + 1] + dy);
  p.closePath();
  return p;
}

// ----- caustics: a tileable Voronoi edge texture ----- //

export function causticTile(size = 256, cells = 9, seed = 5): HTMLCanvasElement {
  const c = makeCanvas(size, size), ctx = c.getContext('2d')!;
  const R = rng(seed), pts: number[] = [];
  for (let i = 0; i < cells * cells; i++) pts.push(((i % cells) + 0.15 + R() * 0.7) / cells, (Math.floor(i / cells) + 0.15 + R() * 0.7) / cells);
  const img = ctx.createImageData(size, size), d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      let f1 = 9, f2 = 9;
      for (let i = 0; i < pts.length; i += 2) {
        for (let ox = -1; ox <= 1; ox++) {
          const dx = pts[i] + ox - u;
          if (dx > 0.35 || dx < -0.35) continue;
          for (let oy = -1; oy <= 1; oy++) {
            const dy = pts[i + 1] + oy - v, dd = dx * dx + dy * dy;
            if (dd < f1) { f2 = f1; f1 = dd; } else if (dd < f2) f2 = dd;
          }
        }
      }
      const e = Math.sqrt(f2) - Math.sqrt(f1);
      const a = Math.pow(clamp(1 - e / 0.04, 0, 1), 2.2);
      const k = (y * size + x) * 4;
      d[k] = 255; d[k + 1] = 255; d[k + 2] = 235; d[k + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ----- glow sprites, one per hue bucket ----- //

const glowCache = new Map<number, HTMLCanvasElement>();
export function glowSprite(hue: number): HTMLCanvasElement {
  const k = Math.round((((hue % 360) + 360) % 360) / 15) * 15;
  let c = glowCache.get(k);
  if (c) return c;
  c = makeCanvas(64, 64);
  const ctx = c.getContext('2d')!, g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `hsla(${k},100%,88%,1)`);
  g.addColorStop(0.25, `hsla(${k},100%,65%,0.45)`);
  g.addColorStop(1, `hsla(${k},100%,50%,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowCache.set(k, c);
  return c;
}

// ----- small school fish: 3 frames of tail beat ----- //

export function fishSprites(body: HSL, belly: HSL, len = 14): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = [];
  for (let f = 0; f < 3; f++) {
    const w = len * 2, h = len, c = makeCanvas(w * 2, h * 2), ctx = c.getContext('2d')!;
    ctx.scale(2, 2);
    ctx.translate(w / 2, h / 2);
    const bend = (f - 1) * 0.35, L = len * 0.5, H = len * 0.2;
    // tail
    ctx.fillStyle = css(body, 0.95, -6);
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.25, -H * 1.1 + bend * H * 2);
    ctx.lineTo(-L * 1.12, bend * H);
    ctx.lineTo(-L * 1.25, H * 1.1 + bend * H * 2);
    ctx.closePath();
    ctx.fill();
    // body
    const g = ctx.createLinearGradient(0, -H, 0, H);
    g.addColorStop(0, css(body, 1, -8));
    g.addColorStop(0.55, css(body, 1, 6));
    g.addColorStop(1, css(belly, 1, 10));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L, 0);
    ctx.quadraticCurveTo(L * 0.4, -H * 1.2, -L * 0.2, -H * 0.9);
    ctx.quadraticCurveTo(-L * 0.8, -H * 0.4 + bend * H, -L * 0.85, bend * H * 0.6);
    ctx.quadraticCurveTo(-L * 0.8, H * 0.4 + bend * H, -L * 0.2, H * 0.9);
    ctx.quadraticCurveTo(L * 0.4, H * 1.2, L, 0);
    ctx.fill();
    // stripe and eye
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(L * 0.6, -H * 0.1); ctx.lineTo(-L * 0.6, -H * 0.05); ctx.stroke();
    ctx.fillStyle = '#081018';
    ctx.beginPath(); ctx.arc(L * 0.62, -H * 0.18, H * 0.22, 0, TAU); ctx.fill();
    out.push(c);
  }
  return out;
}

// ----- terrain painting ----- //

type R01 = () => number;

function paintRock(ctx: Ctx2D, ft: Feature, m: Mood, R: R01, reef: number): void {
  const poly = ft.poly, b = ft.box, path = polyPath(poly);
  const rock = m.rock;
  // lit rim: the shape in a light tone, then the body shifted down over it
  ctx.fillStyle = css(rock, 1, 24);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(0, b[1], 0, b[3]);
  g.addColorStop(0, css(rock, 1, 8));
  g.addColorStop(0.5, css(rock, 1, -4));
  g.addColorStop(1, css(rock, 1, -20));
  ctx.fillStyle = g;
  ctx.fill(polyPath(poly, 0, 5));
  // side light from the upper left
  const gs = ctx.createLinearGradient(b[0], 0, b[2], 0);
  gs.addColorStop(0, 'rgba(255,255,255,0.07)');
  gs.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = gs;
  ctx.fillRect(b[0], b[1], b[2] - b[0], b[3] - b[1]);
  // speckles
  const area = (b[2] - b[0]) * (b[3] - b[1]), n = Math.min(900, area / 45);
  for (let i = 0; i < n; i++) {
    const x = b[0] + R() * (b[2] - b[0]), y = b[1] + R() * (b[3] - b[1]);
    ctx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    const s = 0.6 + R() * 1.8;
    ctx.fillRect(x, y, s, s);
  }
  // cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.1;
  for (let i = 0, nc = 2 + Math.floor(R() * 4); i < nc; i++) {
    let x = b[0] + R() * (b[2] - b[0]), y = b[1] + R() * (b[3] - b[1]), a = R() * TAU;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * 7; y += Math.sin(a) * 7; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // holes
  for (let i = 0, nh = Math.floor(area / 9000); i < nh; i++) {
    const x = b[0] + R() * (b[2] - b[0]), y = b[1] + (0.3 + R() * 0.6) * (b[3] - b[1]), rx = 3 + R() * 7, ry = rx * (0.5 + R() * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.ellipse(x, y + ry * 0.7, rx * 0.8, ry * 0.35, 0, 0, Math.PI); ctx.fill();
  }
  ctx.restore();
  encrust(ctx, ft, m, R, reef);
}

/** life growing on the top of the rocks */
function encrust(ctx: Ctx2D, ft: Feature, m: Mood, R: R01, reef: number): void {
  const b = ft.box, acc = m.accents, poly = ft.poly;
  const tops: [number, number][] = [];
  for (let x = b[0] + 3; x < b[2] - 3; x += 4) {
    const y = polyTop(poly, x);
    if (Number.isFinite(y) && y < floorY(x) - 4) tops.push([x, y]);
  }
  if (!tops.length) return;
  if (reef < 0.4) {
    // Nurserie: green fuzz, a dusting of sand, barnacles
    ctx.lineWidth = 1;
    for (const [x, y] of tops) {
      for (let k = 0; k < 3; k++) {
        const h = 2 + R() * 6, a = -Math.PI / 2 + (R() - 0.5) * 1.2;
        ctx.strokeStyle = css(acc[0], 0.8, (R() - 0.5) * 16);
        ctx.beginPath(); ctx.moveTo(x + R() * 4, y + 2); ctx.lineTo(x + Math.cos(a) * h, y + 2 + Math.sin(a) * h); ctx.stroke();
      }
      if (R() < 0.08) {
        ctx.strokeStyle = 'rgba(240,236,220,0.8)';
        ctx.beginPath(); ctx.arc(x, y + 6 + R() * 12, 1.4 + R() * 1.4, 0, TAU); ctx.stroke();
      }
    }
    ctx.strokeStyle = css(m.sand, 0.55, 8);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    tops.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1.5) : ctx.moveTo(x, y + 1.5)));
    ctx.stroke();
    return;
  }
  // Reef: pink coralline rim
  ctx.strokeStyle = css(acc[0], 0.85, -6);
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let prev = -99;
  for (const [x, y] of tops) {
    if (x - prev > 6) ctx.moveTo(x, y + 2); else ctx.lineTo(x, y + 2);
    prev = x;
  }
  ctx.stroke();
  // what grows along the top
  let next = tops[0][0] + R() * 20;
  for (const [x, y] of tops) {
    if (x < next) continue;
    const k = R(), c = acc[Math.floor(R() * acc.length)];
    if (k < 0.3) brainCoral(ctx, x, y + 3, 8 + R() * 14, c, R);
    else if (k < 0.5) tubeSponge(ctx, x, y + 3, c, R);
    else if (k < 0.65) plateCoral(ctx, x, y + 6, c, R);
    else encrustBlobs(ctx, x, y + 2, c, R);
    next = x + 14 + R() * 30;
  }
  // polyps
  for (const [x, y] of tops) {
    if (R() < 0.25) {
      ctx.fillStyle = css(acc[Math.floor(R() * acc.length)], 0.9, 18);
      ctx.beginPath(); ctx.arc(x, y + 2 + R() * 10, 0.8 + R() * 1.2, 0, TAU); ctx.fill();
    }
  }
}

function brainCoral(ctx: Ctx2D, x: number, y: number, r: number, c: HSL, R: R01): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.5, 1, x, y, r * 1.1);
  g.addColorStop(0, css(c, 1, 16));
  g.addColorStop(1, css(c, 1, -14));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.72, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = css(c, 0.55, -24);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    const rr = r * (0.25 + i * 0.15);
    ctx.beginPath();
    for (let a = Math.PI; a <= TAU + 0.01; a += 0.2) {
      const w = rr + Math.sin(a * 9 + i * 2 + R()) * 1.1;
      const px = x + Math.cos(a) * w, py = y + Math.sin(a) * w * 0.72;
      if (a === Math.PI) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function tubeSponge(ctx: Ctx2D, x: number, y: number, c: HSL, R: R01): void {
  const n = 1 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const w = 4 + R() * 4, h = 10 + R() * 20, px = x + (i - n / 2) * w * 1.1, lean = (R() - 0.5) * 6;
    const g = ctx.createLinearGradient(px - w / 2, 0, px + w / 2, 0);
    g.addColorStop(0, css(c, 1, 10));
    g.addColorStop(1, css(c, 1, -16));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(px - w / 2, y);
    ctx.lineTo(px - w / 2 + lean, y - h);
    ctx.lineTo(px + w / 2 + lean, y - h);
    ctx.lineTo(px + w / 2, y);
    ctx.fill();
    ctx.fillStyle = css(c, 1, -30);
    ctx.beginPath(); ctx.ellipse(px + lean, y - h, w / 2, w / 5, 0, 0, TAU); ctx.fill();
  }
}

function plateCoral(ctx: Ctx2D, x: number, y: number, c: HSL, R: R01): void {
  for (let i = 0; i < 3; i++) {
    const rx = 10 + R() * 14, py = y - i * 5, px = x + (R() - 0.5) * 8;
    ctx.fillStyle = css(c, 1, -10 + i * 6);
    ctx.beginPath(); ctx.ellipse(px, py, rx, 3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = css(c, 0.8, 22);
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(px, py - 0.8, rx * 0.95, 2, 0, Math.PI, TAU); ctx.stroke();
  }
}

function encrustBlobs(ctx: Ctx2D, x: number, y: number, c: HSL, R: R01): void {
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = css(c, 0.9, (R() - 0.5) * 20);
    ctx.beginPath(); ctx.ellipse(x + (R() - 0.5) * 14, y + R() * 5, 2 + R() * 5, 1.5 + R() * 3, 0, 0, TAU); ctx.fill();
  }
}

function paintFloor(ctx: Ctx2D, x0: number, x1: number, bottom: number, m: Mood, R: R01, reef: number): Path2D {
  const top: number[] = [];
  for (let x = x0; x <= x1 + 0.1; x += 8) top.push(x, floorY(x));
  const path = new Path2D();
  path.moveTo(top[0], top[1]);
  for (let i = 2; i < top.length; i += 2) path.lineTo(top[i], top[i + 1]);
  path.lineTo(x1, bottom); path.lineTo(x0, bottom); path.closePath();
  const shifted = new Path2D();
  shifted.moveTo(top[0], top[1] + 4);
  for (let i = 2; i < top.length; i += 2) shifted.lineTo(top[i], top[i + 1] + 4);
  shifted.lineTo(x1, bottom); shifted.lineTo(x0, bottom); shifted.closePath();

  let ymin = Infinity;
  for (let i = 1; i < top.length; i += 2) ymin = Math.min(ymin, top[i]);
  // every gradient is anchored in world space so neighbouring chunks meet without a seam
  const g = ctx.createLinearGradient(0, 200, 0, 1700);
  g.addColorStop(0, css(m.rock, 1, 0));
  g.addColorStop(1, css(m.rock, 1, -30));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const contour = new Path2D();
  contour.moveTo(top[0] - 8, top[1]);
  for (let i = 0; i < top.length; i += 2) contour.lineTo(top[i], top[i + 1]);
  contour.lineTo(top[top.length - 2] + 8, top[top.length - 1]);
  ctx.lineJoin = 'round';
  // sand: layered strokes along the surface, darker with depth
  const layers: [number, number][] = [[150, -18], [110, -12], [70, -6], [38, 0], [12, 10]];
  for (const [w, dl] of layers) { ctx.strokeStyle = css(m.sand, 1, dl); ctx.lineWidth = w; ctx.stroke(contour); }
  // strata, continuous across chunks
  for (let k = 0; k < 7; k++) {
    const off = 90 + k * 58;
    ctx.strokeStyle = k % 2 ? 'rgba(0,0,0,0.14)' : 'rgba(255,240,220,0.06)';
    ctx.lineWidth = 2 + (k % 3);
    ctx.beginPath();
    for (let i = 0; i < top.length; i += 2) {
      const x = top[i], y = top[i + 1] * 0.7 + (500 + off) * 0.3 + off * 0.7 + Math.sin(x * 0.011 + k * 2) * 7;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // sand ripples following the surface
  ctx.lineWidth = 1.2;
  for (let i = 0; i < top.length; i += 2) {
    const x = top[i], y = top[i + 1];
    for (let k = 0; k < 3; k++) {
      const yy = y + 8 + k * 9 + R() * 4, w = 5 + R() * 6;
      ctx.strokeStyle = k % 2 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,240,0.14)';
      ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.quadraticCurveTo(x, yy - 2.5, x + w, yy); ctx.stroke();
    }
  }
  for (let i = 0, ns = (x1 - x0) / 25; i < ns; i++) {
    const x = x0 + R() * (x1 - x0), y = floorY(x) + 50 + R() * (bottom - ymin - 60), r = 3 + R() * 12;
    ctx.fillStyle = css(m.rock, 0.5, -14 + R() * 10);
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, R(), 0, TAU); ctx.fill();
  }
  // grain
  const n = ((x1 - x0) * (bottom - ymin)) / 70;
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = ymin + R() * (bottom - ymin);
    ctx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  // pebbles, shells, coral rubble along the surface
  for (let i = 0; i < top.length; i += 2) {
    if (R() > 0.35) continue;
    const x = top[i] + R() * 8, y = top[i + 1] + 3 + R() * 14;
    const k = R();
    if (reef > 0.5 && k < 0.5) {
      ctx.strokeStyle = css(m.accents[0], 0.7, 25);
      ctx.lineWidth = 1.6;
      const a = R() * Math.PI;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 2); ctx.stroke();
    } else if (k < 0.8) {
      ctx.fillStyle = css(m.rock, 0.85, (R() - 0.3) * 20);
      ctx.beginPath(); ctx.ellipse(x, y, 1.5 + R() * 3, 1 + R() * 1.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(x - 0.5, y - 0.6, 1, 0.5, 0, 0, TAU); ctx.fill();
    } else {
      // a small shell
      ctx.fillStyle = 'rgba(250,236,215,0.85)';
      ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.arc(x, y + 2, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(160,120,90,0.5)'; ctx.lineWidth = 0.5;
      for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + j * 2.2, y - 0.6); ctx.stroke(); }
    }
  }
  ctx.restore();
  return path;
}

/** soft shadow where a rock meets the sand */
function contactShadow(ctx: Ctx2D, ft: Feature, floor: Path2D): void {
  ctx.save();
  ctx.clip(floor);
  for (const fx of ft.feet) {
    const y = floorY(fx), w = (ft.box[2] - ft.box[0]) * 0.45;
    const g = ctx.createRadialGradient(fx, y, 0, fx, y, w);
    g.addColorStop(0, 'rgba(0,10,20,0.35)');
    g.addColorStop(1, 'rgba(0,10,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx - w, y - w, w * 2, w * 2);
  }
  ctx.restore();
}

// ----- terrain chunk ----- //

export interface Tile {
  canvas: HTMLCanvasElement;
  x: number; y: number; w: number; h: number; scale: number;
  bottom: string;
}

export interface ChunkBake extends Tile {
  /** where caustics may play (floor band + rocks), world coordinates */
  lit: Path2D;
  litAlpha: number;
}

export const BAKE_DEPTH = 520;

export function bakeChunk(ci: number): ChunkBake {
  const x0 = ci * CW, x1 = x0 + CW, fts = featuresOf(ci);
  let bx0 = x0, bx1 = x1, by0 = Infinity, by1 = -Infinity;
  for (let x = x0; x <= x1; x += 16) { const f = floorY(x); by0 = Math.min(by0, f); by1 = Math.max(by1, f); }
  for (const f of fts) { bx0 = Math.min(bx0, f.box[0] - 4); bx1 = Math.max(bx1, f.box[2] + 4); by0 = Math.min(by0, f.box[1]); }
  by0 -= 40;
  by1 += BAKE_DEPTH;
  const m = moodAt(x0 + CW / 2), reef = reefness(x0 + CW / 2);
  const canvas = makeCanvas(bx1 - bx0, by1 - by0), ctx = canvas.getContext('2d')!;
  ctx.translate(-bx0, -by0);
  const R = rng(seedOf(ci, SEED + 7));
  for (const f of fts) paintRock(ctx, f, m, R, reef);
  const floor = paintFloor(ctx, x0, x1, by1, m, R, reef);
  for (const f of fts) contactShadow(ctx, f, floor);
  // the deeper, the more it melts into the water
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, 0, 1800);
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const y = (1800 * i) / steps;
    g.addColorStop(i / steps, css(waterAt(m, y), clamp(0.03 + y / 2600, 0, 0.5)));
  }
  ctx.fillStyle = g;
  ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  ctx.globalCompositeOperation = 'source-over';

  const lit = new Path2D();
  lit.moveTo(x0, floorY(x0));
  for (let x = x0 + 8; x <= x1; x += 8) lit.lineTo(x, floorY(x));
  for (let x = x1; x >= x0; x -= 8) lit.lineTo(x, floorY(x) + 70);
  lit.closePath();
  for (const f of fts) lit.addPath(polyPath(f.poly));
  const bottomCol = css(fogged(m, { ...m.rock, l: m.rock.l - 26 }, by1, clamp(0.03 + by1 / 2600, 0, 0.5)));
  return { canvas, x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, scale: 1, bottom: bottomCol, lit, litAlpha: 1 };
}

// ----- distant planes ----- //

export interface LayerDef { p: number; res: number; fog: number; blur: number; }
export const FAR: LayerDef = { p: 0.3, res: 0.45, fog: 0.84, blur: 2.5 };
export const MID: LayerDef = { p: 0.6, res: 0.7, fog: 0.66, blur: 1 };
export const TILE_W = 1024;

/** floor line of a distant plane, in that plane's coordinates */
export function layerFloor(L: LayerDef, lx: number): number {
  const wx = lx / L.p;
  return L.p * floorY(wx) - (1 - L.p) * 60 + (noise1(lx / 260, SEED + Math.round(L.p * 100)) - 0.5) * 70 * L.p;
}

export function bakeLayerTile(L: LayerDef, ti: number): Tile {
  const lx0 = ti * TILE_W, lx1 = lx0 + TILE_W, top = L.p * 20, bottom = L.p * 1050 + 220;
  const wx = (lx0 + TILE_W / 2) / L.p, m = moodAt(wx);
  const s = L.res, canvas = makeCanvas(TILE_W * s, (bottom - top) * s), ctx = canvas.getContext('2d')!;
  ctx.scale(s, s);
  ctx.translate(-lx0, -top);
  if (hasFilter && L.blur) ctx.filter = `blur(${L.blur * s}px)`;
  const R = rng(seedOf(ti, SEED + Math.round(L.p * 1000)));
  const col = (y: number, dl = 0, x = lx0 + TILE_W / 2) => {
    const mm = moodAt(x / L.p);
    return css(fogged(mm, { ...mm.rock, l: mm.rock.l + dl - 18 }, y / L.p, L.fog));
  };

  // plants and rocks standing on the plane, drawn before the ground so it hides their feet
  const items = Math.round(TILE_W / (reefness(wx) > 0.5 ? 70 : 110));
  for (let i = 0; i < items; i++) {
    // stay clear of the tile edges so nothing is cut
    const mg = 190 * L.p + 20, x = lx0 + mg + R() * (TILE_W - 2 * mg), fy = layerFloor(L, x), reef = reefness(x / L.p);
    const k = R();
    if (reef < 0.5 && k < 0.45) {
      // kelp silhouette
      const h = (200 + R() * 450) * L.p * 1.4, sway = (R() - 0.5) * 40 * L.p;
      ctx.strokeStyle = col(fy - h / 2, -6, x);
      ctx.lineWidth = 2.2 * L.p * 2;
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.quadraticCurveTo(x + sway, fy - h * 0.5, x + sway * 0.5, fy - h);
      ctx.stroke();
      ctx.fillStyle = col(fy - h / 2, -4, x);
      for (let j = 0; j < 12; j++) {
        const u = 0.15 + (j / 12) * 0.85, px = x + sway * Math.sin(u * Math.PI) * 0.9, py = fy - h * u, sd = j % 2 ? 1 : -1;
        ctx.beginPath(); ctx.ellipse(px + sd * 6 * L.p * 1.6, py, 7 * L.p * 1.6, 2.5 * L.p * 1.6, sd * 0.6, 0, TAU); ctx.fill();
      }
    } else if (k < 0.75) {
      // rock or coral head
      const r = (30 + R() * (reef > 0.5 ? 90 : 50)) * L.p * 1.6;
      ctx.fillStyle = col(fy - r, -2, x);
      ctx.beginPath();
      for (let a = 0; a <= 24; a++) {
        const an = Math.PI + (a / 24) * Math.PI, rr = r * (1 + (noise1(a * 0.6 + i * 7, SEED) - 0.5) * 0.4);
        const px = x + Math.cos(an) * rr, py = fy + Math.sin(an) * rr * 0.8 + 6;
        if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.fill();
      if (reef > 0.5 && R() < 0.5) {
        // table coral on top
        const tw = r * (0.8 + R() * 0.7), ty = fy - r * 0.8 - 8 * L.p;
        ctx.fillRect(x - 2 * L.p, ty, 4 * L.p, r * 0.3);
        ctx.beginPath(); ctx.ellipse(x, ty, tw, 5 * L.p * 1.5, 0, 0, TAU); ctx.fill();
      }
    } else if (reef > 0.5) {
      // sea fan
      const h = (60 + R() * 90) * L.p * 1.6;
      ctx.strokeStyle = col(fy - h, -6, x);
      ctx.lineWidth = 1.2 * L.p * 2;
      for (let j = 0; j < 7; j++) {
        const a = -Math.PI / 2 + (j - 3) * 0.22;
        ctx.beginPath(); ctx.moveTo(x, fy);
        ctx.quadraticCurveTo(x + Math.cos(a) * h * 0.5, fy + Math.sin(a) * h * 0.5, x + Math.cos(a) * h, fy + Math.sin(a) * h);
        ctx.stroke();
      }
    } else {
      // tuft of sea grass
      ctx.strokeStyle = col(fy, -4, x);
      ctx.lineWidth = 1.4 * L.p * 2;
      for (let j = 0; j < 6; j++) {
        const h = (20 + R() * 30) * L.p * 1.5, dx = (R() - 0.5) * 20 * L.p;
        ctx.beginPath(); ctx.moveTo(x + j * 3 * L.p, fy); ctx.quadraticCurveTo(x + dx * 0.3 + j * 3 * L.p, fy - h * 0.6, x + dx + j * 3 * L.p, fy - h); ctx.stroke();
      }
    }
  }
  // the ground
  ctx.beginPath();
  ctx.moveTo(lx0 - 20, bottom + 40);
  for (let x = lx0 - 20; x <= lx1 + 20; x += 10) ctx.lineTo(x, layerFloor(L, x));
  ctx.lineTo(lx1 + 20, bottom + 40);
  ctx.closePath();
  const gg = ctx.createLinearGradient(lx0, 0, lx1, 0);
  for (let i = 0; i <= 4; i++) { const x = lx0 + (TILE_W * i) / 4; gg.addColorStop(i / 4, col(layerFloor(L, x), 0, x)); }
  ctx.fillStyle = gg;
  ctx.fill();
  // the ground melts into the haze, following its own relief
  ctx.globalCompositeOperation = 'destination-out';
  const fade = 240 * L.p + 60, steps = 10;
  for (let i = 1; i <= steps + 1; i++) {
    const d = (fade * i) / steps;
    ctx.fillStyle = i > steps ? 'rgba(0,0,0,1)' : 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(lx0 - 20, bottom + 40);
    for (let x = lx0 - 20; x <= lx1 + 20; x += 10) ctx.lineTo(x, layerFloor(L, x) + d);
    ctx.lineTo(lx1 + 20, bottom + 40);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // a faint light on the tops
  ctx.filter = 'none';
  ctx.strokeStyle = css(m.sky, 0.08 * (1 - L.fog * 0.6));
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = lx0; x <= lx1; x += 10) { const y = layerFloor(L, x) + 2; if (x === lx0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  return { canvas, x: lx0, y: top, w: TILE_W, h: bottom - top, scale: s, bottom: '' };
}

// ----- foreground: dark, blurred shapes very close to the eye ----- //

export interface FgSprite { canvas: HTMLCanvasElement; w: number; h: number; ax: number; ay: number; }

export function foregroundSprite(kind: number, seed: number, m: Mood): FgSprite {
  const R = rng(seed), w = 420, h = 520, s = 0.5;
  const canvas = makeCanvas(w * s, h * s), ctx = canvas.getContext('2d')!;
  ctx.scale(s, s);
  if (hasFilter) ctx.filter = 'blur(5px)';
  const col = css({ h: m.deep.h, s: m.deep.s * 0.7, l: 5 }, 0.94);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  const bx = w / 2, by = h - 20;
  if (kind === 0) {
    // kelp clump
    for (let i = 0; i < 4; i++) {
      const x = bx + (R() - 0.5) * 120, hh = 260 + R() * 220, sw = (R() - 0.5) * 90;
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + sw, by - hh * 0.5, x + sw * 0.6, by - hh); ctx.stroke();
      for (let j = 0; j < 9; j++) {
        const u = 0.2 + (j / 9) * 0.8, px = x + sw * Math.sin(u * Math.PI) * 0.8, py = by - hh * u, sd = j % 2 ? 1 : -1;
        ctx.beginPath(); ctx.ellipse(px + sd * 16, py, 24, 8, sd * 0.6, 0, TAU); ctx.fill();
      }
    }
  } else if (kind === 1) {
    // rock with a coral head
    ctx.beginPath();
    for (let a = 0; a <= 30; a++) {
      const an = Math.PI + (a / 30) * Math.PI, rr = 150 * (1 + (R() - 0.5) * 0.25);
      const px = bx + Math.cos(an) * rr * 1.2, py = by + Math.sin(an) * rr * 0.9;
      if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.3;
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(bx, by - 120); ctx.lineTo(bx + Math.cos(a) * 220, by - 120 + Math.sin(a) * 180); ctx.stroke();
    }
  } else {
    // sea grass / soft coral bush
    ctx.lineWidth = 5;
    for (let i = 0; i < 26; i++) {
      const x = bx + (R() - 0.5) * 200, hh = 120 + R() * 200, sw = (R() - 0.5) * 120;
      ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + sw * 0.3, by - hh * 0.6, x + sw, by - hh); ctx.stroke();
    }
  }
  return { canvas, w, h, ax: bx, ay: by };
}

// Everything drawn once and reused: sprites of rocks and of far animals and
// plants (with their fog), caustics, glow sprites, the fish of the schools.

import { TAU, clamp, noise1, rng } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import { draw3 } from '../engine3/render3';
import { Ortho } from '../engine3/view';
import { css, type HSL, type Mood } from './palette';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
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
  g.addColorStop(0, `hsla(${k},100%,80%,0.9)`);
  g.addColorStop(0.25, `hsla(${k},100%,62%,0.4)`);
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
/** shared drawing environment: 0 = deep dark water, 1 = bright shallow water */
export const env = { water: 0 };

/** how much the water hides something at view depth d (the swimming plane is at `plane`) */
export function fogOf(d: number, plane: number): number {
  return clamp(1 - Math.exp(-Math.max(0, d - plane * 0.9) / 1700), 0, 0.88);
}

// ----- baked sprites ----- //

export interface Sprite { canvas: HTMLCanvasElement; ax: number; ay: number; res: number; /** pixels in use (a reused buffer can be larger) */ w?: number; h?: number; }

/** a lumpy rock with a lit rim, speckles, and life on top */
export function bakeRock(r: number, seed: number, m: Mood, reef: number, fog: number, fogCol: HSL, res: number): Sprite {
  const R = rng(seed), w = r * 2.4, h = r * 1.6;
  const c = makeCanvas(w * res, h * res), ctx = c.getContext('2d')!;
  ctx.scale(res, res);
  const cx = w / 2, by = h - 4;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 36; i++) {
    const a = Math.PI + (i / 36) * Math.PI, k = 1 + (noise1(i * 0.45 + seed, 9) - 0.5) * 0.35;
    pts.push([cx + Math.cos(a) * r * 1.1 * k, by + Math.sin(a) * r * 1.2 * k]);
  }
  const path = new Path2D();
  path.moveTo(pts[0][0], by + 3);
  for (const [x, y] of pts) path.lineTo(x, y);
  path.lineTo(pts[pts.length - 1][0], by + 3);
  path.closePath();
  ctx.fillStyle = css(m.rock, 1, 24);
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.translate(0, 4);
  const g = ctx.createLinearGradient(0, by - r * 1.2, 0, by);
  g.addColorStop(0, css(m.rock, 1, 14));
  g.addColorStop(1, css(m.rock, 1, -10));
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.translate(0, -4);
  for (let i = 0; i < r * 3; i++) {
    ctx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(cx + (R() - 0.5) * r * 2.2, by - R() * r * 1.2, 1.3, 1.3);
  }
  ctx.restore();
  // ink
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = css({ h: m.rock.h, s: m.rock.s, l: 14 }, 0.8);
  ctx.stroke(path);
  // what grows on top
  const top = pts.filter(([, y]) => y < by - r * 0.55);
  if (reef > 0.5) {
    ctx.strokeStyle = css(m.accents[0], 0.9, -4);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1.5) : ctx.moveTo(x, y + 1.5)));
    ctx.stroke();
    for (const [x, y] of top) {
      if (R() > 0.35) continue;
      const col = m.accents[Math.floor(R() * m.accents.length)], s = 3 + R() * 6;
      ctx.fillStyle = css(col, 1, R() * 10);
      ctx.beginPath(); ctx.ellipse(x, y + 1, s, s * 0.65, 0, Math.PI, TAU); ctx.fill();
      ctx.strokeStyle = css(col, 0.6, -25); ctx.lineWidth = 0.6; ctx.stroke();
    }
  } else {
    ctx.strokeStyle = css(m.accents[0], 0.85);
    ctx.lineWidth = 0.9;
    for (const [x, y] of top) for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 1.2, l = 2 + R() * 5;
      ctx.beginPath(); ctx.moveTo(x + R() * 3, y + 1.5); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
  }
  tint(ctx, c, fog, fogCol);
  return { canvas: c, ax: cx, ay: by, res };
}

/** pull a baked image toward the water colour */
function tint(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, fog: number, col: HSL): void {
  if (fog <= 0.01) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = css(col, fog);
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-over';
}

/** a 3D creature drawn flat into a small image at `res` px per unit (no perspective), at a level of detail (render3) */
export function bakeCreature(cr: Creature3, fog: number, fogCol: HSL, res: number, into?: HTMLCanvasElement, lod = 0): Sprite {
  const b = cr.box, pad = 5;
  const w = b[3] - b[0] + pad * 2, h = b[4] - b[1] + pad * 2;
  res = Math.min(res, 900 / Math.max(w, h));
  const pw = Math.max(1, Math.ceil(w * res)), ph = Math.max(1, Math.ceil(h * res));
  const c = into || makeCanvas(pw, ph);
  // a reused buffer only grows (and shrinks when it is far too big), so its memory is not reallocated every frame
  if (into && (into.width < pw || into.height < ph || into.width > pw * 2.2 + 16 || into.height > ph * 2.2 + 16)) {
    into.width = Math.ceil(pw * 1.25) + 4; into.height = Math.ceil(ph * 1.25) + 4;
  }
  const ctx = c.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, pw + 2, ph + 2);
  draw3(ctx, cr, new Ortho(res, (-b[0] + pad) * res, (-b[1] + pad) * res), { ink: true, water: env.water, lod });
  // wash only what was drawn
  if (fog > 0.01) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = css(fogCol, fog);
    ctx.fillRect(0, 0, pw + 2, ph + 2);
    ctx.globalCompositeOperation = 'source-over';
  }
  return { canvas: c, ax: cr.root.x[0] - b[0] + pad, ay: cr.root.y[0] - b[1] + pad, res, w: pw, h: ph };
}

// ----- what stands where ----- //
export interface Rock { x: number; z: number; r: number; seed: number; sprite: Sprite | null; spriteD: number; }
export interface Plant { x: number; z: number; kind: string; seed: number; cr: Creature3 | null; sprite: Sprite | null; spriteD: number; live: boolean; }

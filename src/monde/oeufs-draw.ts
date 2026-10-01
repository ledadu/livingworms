// What the eggs look like (oeufs.ts): each a soft ball of pale gold, clear enough to show the child curled inside,
// baked once from the child's own body, as the traces of the lineage are, so that we know it. Drawn turned the way
// it goes and stretched along it, and, once it has split, as two halves of shell that drift apart and fade.

import { STEP, TAU, type Spec } from '../engine';
import { Creature3 } from '../engine3/creature3';
import type { Gfx } from '../engine3/gfx';
import type { Proj, View } from '../engine3/view';
import { bakeCreature, makeCanvas, type Sprite } from './sprites';
import { SHELL, type Egg } from './oeufs';

/** px of the egg image per world unit */
const RES = 3;
const P: Proj = { x: 0, y: 0, s: 1, d: 1 };

/** the child's body, baked flat as it swims, at `res` px per unit */
function body(sp: Spec, res: number): HTMLCanvasElement {
  const cr = new Creature3(sp, 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, scale: 0.8, phase: 0 });
  for (let i = 0; i < 70; i++) cr.steer(i * STEP, 0.6, 0, 0, 0.2);
  return bakeCreature(cr, 0, { h: 0, s: 0, l: 0 }, res).canvas;
}

/**
 * An egg of radius r (world px), lying the long way along x (its way), with its child curled inside, or a plain curl
 * without one. Clear gold, a highlight, a thin rim.
 */
export function bakeEgg(r: number, child: Spec | null): Sprite {
  const w = r * 2.6, h = r * 2.3, c = makeCanvas(w * RES, h * RES), ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  const cx = w / 2, cy = h / 2, rx = r * 1.1, ry = r * 0.95;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx, cy, r * 1.15);
  g.addColorStop(0, 'rgba(255,250,235,0.92)');
  g.addColorStop(0.5, 'rgba(246,217,138,0.5)');
  g.addColorStop(1, 'rgba(246,217,138,0.16)');
  ctx.fillStyle = g;
  ctx.fill();
  // the child inside, curled, its longest side 1.5 radius long
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.92, ry * 0.9, 0, 0, TAU);
  ctx.clip();
  if (child) {
    const b = body(child, RES), uw = b.width / RES, uh = b.height / RES, f = (r * 1.5) / Math.max(uw, uh, 1);
    ctx.translate(cx + r * 0.05, cy + r * 0.08);
    ctx.rotate(-0.55);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(b, (-uw * f) / 2, (-uh * f) / 2, uw * f, uh * f);
  } else {
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 1, r * 0.4, -0.4, Math.PI * 1.35);
    ctx.strokeStyle = 'rgba(150,110,50,0.45)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.42, cy - r * 0.4, r * 0.26, r * 0.14, -0.5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,244,214,0.55)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  return { canvas: c, ax: cx, ay: cy, res: RES, w: w * RES, h: h * RES };
}

export interface EggView { view: View; gx: Gfx | null; ctx: CanvasRenderingContext2D; dpr: number; }

/**
 * Draws an egg: turned its way and stretched along it (its squash); `scale`: its size against the image's. Once
 * it has split, its two halves drift apart along its way, a little up and down, and fade with the shell.
 */
export function drawEgg(s: EggView, sp: Sprite, e: Egg, scale = 1): void {
  s.view.project(e.x, e.y, 0, P);
  const k = (P.s / sp.res) * scale, kv = Math.cos(s.view.pitch), q = e.squash, c = Math.cos(e.ang), n = Math.sin(e.ang);
  // screen = translate · scale(k, k·kv) · rotate(ang) · scale(q, 1/q), in the pixels of the image
  const a = k * c * q, b = k * kv * n * q, cc = (-k * n) / q, d = (k * kv * c) / q, dpr = s.dpr;
  const w = sp.w!, h = sp.h!, ox = -sp.ax * sp.res, oy = -sp.ay * sp.res;
  const open = Math.min(1, e.open / SHELL), al = 1 - open * open, apart = open * w * 0.45, lift = open * h * 0.12;
  // the whole egg, or its two halves
  const parts: [number, number, number, number][] = e.open > 0
    ? [[0, w / 2, -apart, -lift], [w / 2, w / 2, apart, lift]]
    : [[0, w, 0, 0]];
  if (s.gx) {
    s.gx.setTransform(dpr * a, dpr * b, dpr * cc, dpr * d, dpr * P.x, dpr * P.y);
    s.gx.alpha = al;
    for (const [sx, sw, dx, dy] of parts) s.gx.image(sp.canvas, sx, 0, sw, h, ox + sx + dx, oy + dy, sw, h);
    s.gx.alpha = 1;
    return;
  }
  const ctx = s.ctx;
  ctx.setTransform(dpr * a, dpr * b, dpr * cc, dpr * d, dpr * P.x, dpr * P.y);
  ctx.globalAlpha = al;
  for (const [sx, sw, dx, dy] of parts) ctx.drawImage(sp.canvas, sx, 0, sw, h, ox + sx + dx, oy + dy, sw, h);
  ctx.globalAlpha = 1;
}

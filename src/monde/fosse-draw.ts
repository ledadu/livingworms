// La Fosse: what is drawn over the total dark (see fosse.ts).

import type { Creature3 } from '../engine3/creature3';
import type { Gfx } from '../engine3/gfx';
import { paint3 } from '../engine3/paint-gl';
import { eachGlow3, prepare3 } from '../engine3/render3';
import type { View } from '../engine3/view';
import { glowsGL } from './scene-gl';
import { bakeCreature, glowSprite } from './sprites';

export interface Shape { cr: Creature3; buf: HTMLCanvasElement; }
const P = { x: 0, y: 0, s: 1, d: 0 };
const pts: number[] = [];
const BLACK = { h: 226, s: 60, l: 2 };

/**
 * A huge animal passing in the dark, drawn after the dark: a faint electric
 * glow far behind it, its body as a black shape across that glow, then its
 * own lights.
 */
export function drawShape(gx: Gfx | null, ctx: CanvasRenderingContext2D, view: View, dpr: number, v: Shape, pitch: number, t: number): void {
  const cr = v.cr, b = cr.box, rz = cr.root.z[0];
  view.project((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, rz, P);
  const len = (b[3] - b[0]) * P.s, halo = 0.22 * pitch * (0.8 + 0.2 * Math.sin(t * 0.4 + rz));
  pts.length = 0;
  pts.push(P.x, P.y, len * 0.8, 205, halo);
  if (gx) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    glowsGL(gx, pts, (i) => pts[i + 4]);
    gx.tintR = 0; gx.tintG = 0.005; gx.tintB = 0.02; gx.tintAmt = 1;
    prepare3(cr, view);
    paint3(gx, cr, view, { ink: false, shade: false, lod: 2, alpha: 0.95 * pitch });
    gx.tintAmt = 0;
  } else {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = halo;
    ctx.drawImage(glowSprite(205), P.x - len * 0.8, P.y - len * 0.8, len * 1.6, len * 1.6);
    ctx.globalCompositeOperation = 'source-over';
    view.project(cr.root.x[0], cr.root.y[0], rz, P);
    const sp = bakeCreature(cr, 1, BLACK, 0.5, v.buf, 2), k = P.s / sp.res, kv = Math.cos(view.pitch);
    ctx.globalAlpha = 0.95 * pitch;
    ctx.drawImage(sp.canvas, 0, 0, sp.w!, sp.h!, P.x - sp.ax * sp.res * k, P.y - sp.ay * sp.res * k * kv, sp.w! * k, sp.h! * k * kv);
  }
  // its own lights
  pts.length = 0;
  eachGlow3(cr, view, (x, y, size, hue, a) => { pts.push(x, y, size, hue, a * pitch * 0.4); });
  if (gx) glowsGL(gx, pts, (i) => pts[i + 4]);
  else {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < pts.length; i += 5) {
      ctx.globalAlpha = pts[i + 4];
      ctx.drawImage(glowSprite(pts[i + 3]), pts[i] - pts[i + 2], pts[i + 1] - pts[i + 2], pts[i + 2] * 2, pts[i + 2] * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

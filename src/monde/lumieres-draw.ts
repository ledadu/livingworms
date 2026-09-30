// The lights that answer in the Fosse: an ancestor of another lineage drawn after the dark, lit by its own light (see
// lumieres.ts), so that it shows far away in the black water.

import { clamp } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import { hsl01, type Gfx } from '../engine3/gfx';
import { paint3 } from '../engine3/paint-gl';
import { prepare3 } from '../engine3/render3';
import type { View } from '../engine3/view';
import { bakeCreature, makeCanvas } from './sprites';

const P = { x: 0, y: 0, s: 1, d: 0 };
/** how much its colours take the hue of its light */
const TINT = 0.35;

/** its body, washed with the colour of its light, at this opacity; returns the canvas it was baked in (2D only) */
export function drawAnswer(gx: Gfx | null, ctx: CanvasRenderingContext2D, view: View, dpr: number, cr: Creature3, hue: number, alpha: number, buf: HTMLCanvasElement | null): HTMLCanvasElement | null {
  if (alpha < 0.02) return buf;
  if (gx) {
    const [r, g, b] = hsl01(hue, 70, 74);
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.tintR = r; gx.tintG = g; gx.tintB = b; gx.tintAmt = TINT;
    const lv = Math.min(2, prepare3(cr, view));
    paint3(gx, cr, view, { ink: false, shade: true, lod: lv, alpha });
    gx.tintAmt = 0;
    return buf;
  }
  const root = cr.root;
  view.project(root.x[0], root.y[0], root.z[0], P);
  buf ??= makeCanvas(8, 8);
  const sp = bakeCreature(cr, TINT, { h: hue, s: 70, l: 74 }, clamp(P.s * dpr, 0.3, 2), buf, 1), k = P.s / sp.res, kv = Math.cos(view.pitch);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sp.canvas, 0, 0, sp.w!, sp.h!, P.x - sp.ax * sp.res * k, P.y - sp.ay * sp.res * k * kv, sp.w! * k, sp.h! * k * kv);
  ctx.globalAlpha = 1;
  return buf;
}

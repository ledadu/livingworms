// A still portrait of a species, drawn by the same 3D ribbons as the game:
// it swims a moment so that the parts trail, then is fitted to the canvas.

import { STEP } from '../engine/util';
import type { Spec } from '../engine/types';
import { Creature3 } from './creature3';
import { draw3, screenBox } from './render3';
import { Ortho } from './view';

export function snapshot3(sp: Spec, canvas: HTMLCanvasElement, o: { pad?: number; max?: number; w?: number; h?: number } = {}): void {
  const cr = new Creature3(sp, 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, phase: 0 });
  for (let t = 0; t < 90; t++) cr.steer(t * STEP, 1.3, 0, 0, 0.25);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || o.w || 120, h = canvas.clientHeight || o.h || 80;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d')!, pad = o.pad === undefined ? 6 : o.pad;
  // measure at unit scale, then fit
  draw3(ctx, cr, new Ortho(1), { ink: true, water: 0.5 });
  const b = screenBox(cr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!b) return;
  const bw = b[2] - b[0] || 1, bh = b[3] - b[1] || 1;
  const k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, o.max || 4);
  const ox = w / 2 - ((b[0] + b[2]) / 2) * k, oy = h / 2 - ((b[1] + b[3]) / 2) * k;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw3(ctx, cr, new Ortho(k, ox, oy), { ink: true, water: 0.5 });
}

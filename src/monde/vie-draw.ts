// What the life of the animals leaves in the water (vie.ts, vie-jeu.ts): puffs of sand where a mouth digs or a file
// of walkers passes, flakes of food that sink, specks of plankton snapped at. Drawn with the scene, at their depth,
// washed by the water like the rest.

import { TAU } from '../engine';
import type { Gfx } from '../engine3/gfx';
import { disc } from '../engine3/paint-gl';
import type { Proj, View } from '../engine3/view';
import type { HSL } from './palette';
import { fogOf, makeCanvas } from './sprites';
import type { Flake } from './vie';

export interface VieScene { view: View; ctx: CanvasRenderingContext2D; gx: Gfx | null; dpr: number; plane: number }

/** puffs of sand: they rise a little, spread, slow down and settle */
export class Dust {
  n: number; x: Float32Array; y: Float32Array; z: Float32Array; vx: Float32Array; vy: Float32Array; r: Float32Array; life: Float32Array;
  spr: HTMLCanvasElement[];
  private k = 0;
  constructor(n: number) {
    this.n = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.r = new Float32Array(n); this.life = new Float32Array(n);
    this.spr = new Array(n);
  }
  /** a puff of a few clouds at x, y (the floor), in the colour of the sand */
  emit(x: number, y: number, z: number, sand: HSL, n = 3, R = Math.random): void {
    const spr = puffSprite(sand);
    for (let j = 0; j < n; j++) {
      const i = this.k++ % this.n;
      this.x[i] = x + (R() - 0.5) * 10; this.y[i] = y - 2 - R() * 4; this.z[i] = z + (R() - 0.5) * 8;
      this.vx[i] = (R() - 0.5) * 1.1; this.vy[i] = -0.35 - R() * 0.6; this.r[i] = 6 + R() * 5; this.life[i] = 1;
      this.spr[i] = spr;
    }
  }
  step(): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= 1 / 140;
      this.x[i] += this.vx[i]; this.y[i] += this.vy[i];
      this.vx[i] *= 0.95; this.vy[i] = this.vy[i] * 0.94 + 0.004;
      this.r[i] += 0.18;
    }
  }
}

/** a soft cloud of silt, the sand it comes from much paler: it scatters the light (one image per shade) */
const puffs = new Map<string, HTMLCanvasElement>();
function puffSprite(c: HSL): HTMLCanvasElement {
  const h = Math.round(c.h / 8) * 8, s = Math.round(c.s * 0.05) * 10, l = Math.min(94, Math.round(c.l / 5) * 5 + 22), key = `${h},${s},${l}`;
  let cv = puffs.get(key);
  if (cv) return cv;
  cv = makeCanvas(32, 32);
  const g = cv.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, `hsla(${h},${s}%,${l}%,0.9)`);
  gr.addColorStop(0.5, `hsla(${h},${s}%,${l}%,0.5)`);
  gr.addColorStop(1, `hsla(${h},${s}%,${l}%,0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  puffs.set(key, cv);
  return cv;
}

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };

/** one puff of the dust, flattened a little like a cloud lying on the floor */
export function drawPuff(s: VieScene, d: Dust, i: number): void {
  const life = d.life[i];
  if (life <= 0) return;
  s.view.project(d.x[i], d.y[i], d.z[i], P);
  const r = d.r[i] * P.s, al = 0.7 * Math.pow(life, 1.2) * (1 - 0.8 * fogOf(P.d, s.plane));
  if (r < 0.4 || al < 0.01) return;
  const spr = d.spr[i], k = r / 16;
  if (s.gx) {
    s.gx.setTransform(s.dpr * k, 0, 0, s.dpr * k * 0.7, s.dpr * P.x, s.dpr * P.y);
    s.gx.alpha = al;
    s.gx.image(spr, 0, 0, 32, 32, -16, -16, 32, 32);
    s.gx.alpha = 1;
    return;
  }
  s.ctx.setTransform(s.dpr * k, 0, 0, s.dpr * k * 0.7, s.dpr * P.x, s.dpr * P.y);
  s.ctx.globalAlpha = al;
  s.ctx.drawImage(spr, -16, -16);
  s.ctx.globalAlpha = 1;
}

/** the food of a scene: pale flakes, or specks of plankton that fade */
export function drawFood(s: VieScene, food: readonly Flake[]): void {
  const { view, gx, ctx, dpr } = s;
  if (gx) gx.setTransform(dpr, 0, 0, dpr, 0, 0);
  else { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.beginPath(); }
  let al = 0;
  for (const f of food) {
    if (f.eaten) continue;
    view.project(f.x, f.y, f.z, P);
    const r = Math.max(0.7, f.r * P.s), a = 0.85 * Math.min(1, f.life * 3) * (1 - 0.8 * fogOf(P.d, s.plane));
    if (gx) { disc(gx, P.x, P.y, r, gx.packCss('hsla(48,45%,88%,1)', a)); continue; }
    al = Math.max(al, a);
    ctx.moveTo(P.x + r, P.y);
    ctx.arc(P.x, P.y, r, 0, TAU);
  }
  if (gx || al <= 0) return;
  ctx.fillStyle = `hsla(48,45%,88%,${al.toFixed(3)})`;
  ctx.fill();
}

// What the Remontée looks like (remontee.ts): the well of light falling from the surface far above to the bottom
// of the world, motes rising in it, and, while the lineage goes up, golden shafts of light around it in every
// chapter. Added light, on WebGL and on the canvas; the rings of the song and the halos are lights of main.ts.

import { TAU, clamp } from '../engine';
import type { Proj } from '../engine3/view';
import { disc } from '../engine3/paint-gl';
import { floorAt } from './biomes';
import type { GlacierScene } from './glacier';
import type { HSL } from './palette';
import { hcol } from './scene-gl';
import { WELL_R, WELL_X, WELL_Z } from './remontee';

type Scene = GlacierScene;

const P: Proj = { x: 0, y: 0, s: 1, d: 1 }, Q: Proj = { x: 0, y: 0, s: 1, d: 1 };
const GOLD: HSL = { h: 46, s: 95, l: 76 };
const hash = (k: number, salt: number) => Math.abs(Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453) % 1;

/** across the well: edge, core, edge (x as a share of its half width, and the strength) */
const ACROSS = [[-1, 0], [-0.5, 0.55], [0, 1], [0.5, 0.55], [1, 0]];
/** how many slices from the top of the view down to the floor */
const SLICES = 12;

/** a band of light between two lines: xs across at the top (screen), the same at the bottom, strengths by column and row */
function bandGL(s: Scene, top: number[], ty: number, bot: number[], by: number, alpha: (col: number) => number, a0: number, a1: number): void {
  const g = s.gx!;
  g.reserve(top.length * 2, (top.length - 1) * 6);
  g.shape();
  let pa = -1, pb = -1;
  for (let c = 0; c < top.length; c++) {
    const a = g.v(top[c], ty, hcol(g, GOLD, alpha(c) * a0)), b = g.v(bot[c], by, hcol(g, GOLD, alpha(c) * a1));
    if (pa >= 0) { g.tri(pa, a, pb); g.tri(a, b, pb); }
    pa = a; pb = b;
  }
}
function band2D(s: Scene, top: number[], ty: number, bot: number[], by: number, alpha: (col: number) => number, a0: number, a1: number): void {
  const c = s.ctx, n = top.length;
  // a gradient across, the strength of the row as the alpha of the whole slice (its mean: the rows are short)
  const gr = c.createLinearGradient((top[0] + bot[0]) / 2, 0, (top[n - 1] + bot[n - 1]) / 2, 0);
  for (let k = 0; k < n; k++) gr.addColorStop(k / (n - 1), `hsla(${GOLD.h},${GOLD.s}%,${GOLD.l}%,${alpha(k).toFixed(3)})`);
  c.globalAlpha = clamp((a0 + a1) / 2, 0, 1);
  c.fillStyle = gr;
  c.beginPath();
  c.moveTo(top[0], ty); c.lineTo(top[n - 1], ty); c.lineTo(bot[n - 1], by); c.lineTo(bot[0], by);
  c.fill();
}

/** the well of light: from above the view down to the floor, brightest in its middle and toward the surface */
function drawWell(s: Scene, camY: number, strength: number): void {
  const fy = floorAt(WELL_X, WELL_Z), top = Math.min(fy - 200, camY - 1500), t = s.t;
  const band = s.gx ? bandGL : band2D;
  if (s.gx) { s.gx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0); s.gx.setBlend('add'); }
  else { s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0); s.ctx.globalCompositeOperation = 'lighter'; }
  const row = (k: number) => {
    const y = top + ((fy - top) * k) / SLICES, u = k / SLICES;
    // wider toward the floor, where it spreads; a slow shimmer runs down it
    const w = WELL_R * (0.8 + 0.3 * u), shimmer = 0.82 + 0.18 * Math.sin(t * 0.8 - y * 0.004);
    const xs = ACROSS.map(([f]) => { view(s, WELL_X + f * w, y, WELL_Z); return P.x; });
    return { xs, y: (view(s, WELL_X, y, WELL_Z), P.y), a: strength * shimmer * (0.26 + 0.14 * (1 - u) + 0.16 * Math.max(0, (u - 0.85) / 0.15)) };
  };
  let prev = row(0);
  for (let k = 1; k <= SLICES; k++) {
    const next = row(k);
    band(s, prev.xs, prev.y, next.xs, next.y, (c) => ACROSS[c][1], prev.a, next.a);
    prev = next;
  }
  // motes going up in the light
  const H = 1500;
  for (let i = 0; i < 46; i++) {
    const h = hash(i, 3), x = WELL_X + (hash(i, 1) - 0.5) * WELL_R * 1.5, z = WELL_Z + (hash(i, 2) - 0.5) * 160;
    const y = fy - 20 - (((t * (22 + h * 30) + hash(i, 4) * H) % H));
    view(s, x, y, z);
    const r = (1.2 + h * 1.8) * P.s, a = strength * (0.35 + 0.35 * Math.sin(t * 2 + i)) * clamp((fy - y) / 200, 0, 1);
    if (a < 0.02) continue;
    if (s.gx) disc(s.gx, P.x, P.y, r, hcol(s.gx, GOLD, a));
    else { s.ctx.globalAlpha = a; s.ctx.fillStyle = `hsl(${GOLD.h},${GOLD.s}%,${GOLD.l}%)`; s.ctx.beginPath(); s.ctx.arc(P.x, P.y, r, 0, TAU); s.ctx.fill(); }
  }
  if (s.gx) s.gx.setBlend('over');
  else { s.ctx.globalAlpha = 1; s.ctx.globalCompositeOperation = 'source-over'; }
}

/** golden shafts of light from above, all around the view, while the lineage goes up */
function drawShafts(s: Scene, camX: number, camY: number, L: number): void {
  const sp = 430, t = s.t;
  if (s.gx) { s.gx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0); s.gx.setBlend('add'); }
  else { s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0); s.ctx.globalCompositeOperation = 'lighter'; }
  for (let k = Math.floor((camX - 1900) / sp); k <= Math.floor((camX + 1900) / sp); k++) {
    const h1 = hash(k, 5), h2 = hash(k, 6);
    if (h1 < 0.35) continue;
    const x = k * sp + h2 * 220, z = 160 + h1 * 1000, w = 34 + h2 * 70, y0 = camY - 1200, y1 = camY + 650;
    const al = L * 0.15 * (0.45 + 0.55 * Math.sin(t * 0.3 + k * 1.9));
    if (al < 0.01) continue;
    view(s, x, y0, z); const ax = P.x, ay = P.y, aw = w * P.s;
    s.view.project(x + (y1 - y0) * 0.22, y1, z, Q); const bx = Q.x, by = Q.y, bw = w * 1.7 * Q.s;
    const across = [0, 1, 0];
    if (s.gx) bandGL(s, [ax - aw / 2, ax, ax + aw / 2], ay, [bx - bw / 2, bx, bx + bw / 2], by, (c) => across[c], al, 0);
    else {
      const g = s.ctx.createLinearGradient(0, ay, 0, by);
      g.addColorStop(0, `hsla(${GOLD.h},${GOLD.s}%,${GOLD.l}%,${al.toFixed(3)})`);
      g.addColorStop(1, `hsla(${GOLD.h},${GOLD.s}%,${GOLD.l}%,0)`);
      s.ctx.fillStyle = g;
      s.ctx.beginPath();
      s.ctx.moveTo(ax - aw / 2, ay); s.ctx.lineTo(ax + aw / 2, ay); s.ctx.lineTo(bx + bw / 2, by); s.ctx.lineTo(bx - bw / 2, by);
      s.ctx.fill();
    }
  }
  if (s.gx) s.gx.setBlend('over');
  else s.ctx.globalCompositeOperation = 'source-over';
}

const view = (s: Scene, x: number, y: number, z: number) => s.view.project(x, y, z, P);

/**
 * The pieces of the Remontée in the scene, sorted with the rest: the well when it is in view (`well`: how strongly
 * it shines), the shafts while the water is lit (`lit`, 0..1).
 */
export function remonteeItems(s: Scene, camX: number, camY: number, well: number, lit: number, push: (d: number, fn: () => void) => void): void {
  if (well > 0.01) {
    const [x0, x1] = s.view.xRange(WELL_Z, WELL_R * 1.5);
    if (WELL_X > x0 && WELL_X < x1) push(s.view.depth(floorAt(WELL_X, WELL_Z), WELL_Z) + 0.2, () => drawWell(s, camY, well));
  }
  if (lit > 0.02) push(s.view.depth(camY, 700), () => drawShafts(s, camX, camY, lit));
}

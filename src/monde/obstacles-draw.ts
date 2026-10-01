// What the key obstacles look like (obstacles.ts): the current of the pass
// streaming back toward the reef, the wall of kelp, the burning water of the
// Sources shimmering up, the freezing haze of the Glacier, the rising threads
// of the void under the Jardin. The dark of the Grotte and the Fosse is the
// dark of the scene itself, deepened (obstacles-jeu.ts, dark).

import { TAU, clamp, rng } from '../engine';
import type { Proj } from '../engine3/view';
import { ceilAt } from './grotte';
import { floorAt, type ChapterId } from './biomes';
import type { GlacierScene } from './glacier';
import { GATES } from './limites';
import { OBSTACLE } from './obstacles';
import { fogOf, makeCanvas } from './sprites';

type Scene = GlacierScene;
type Look = 'current' | 'kelp' | 'heat' | 'cold' | 'void';

const LOOK: Partial<Record<ChapterId, Look>> = { recif: 'current', foret: 'kelp', sources: 'heat', glacier: 'cold', jardin: 'void' };
/** the layers along z the pieces of an obstacle are sorted in */
const LAYERS = [-60, 40, 160, 320, 520];

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };
const smooth = (t: number) => t * t * (3 - 2 * t);
const wrap = (v: number, n: number) => ((v % n) + n) % n;

// ----- sprites ----- //

// The sprites of a look share one sheet, a cell each with a clear gutter between
// them: the pieces of a layer, of mixed colours, are drawn from one texture
// (one draw call on the GPU, where a sheet per colour cost one per piece).

/** a cell of a sheet: its image, where it starts along x, its size */
interface Cell { sheet: HTMLCanvasElement; sx: number; w: number; h: number; }
const GUTTER = 4;
function sheet(w: number, h: number, n: number, draw: (g: CanvasRenderingContext2D, k: number) => void): Cell[] {
  const c = makeCanvas(n * (w + GUTTER), h), g = c.getContext('2d')!, out: Cell[] = [];
  for (let k = 0; k < n; k++) {
    const sx = k * (w + GUTTER);
    g.save();
    g.beginPath(); g.rect(sx, 0, w, h); g.clip();
    g.translate(sx, 0);
    draw(g, k);
    g.restore();
    out.push({ sheet: c, sx, w, h });
  }
  return out;
}

/** the colours of the soft blobs of light, a cell each */
const BLOBS = ['235,252,255', '210,240,250', '255,190,110', '255,140,80', '240,252,255', '215,240,255', '190,200,255'];
let blobs: Cell[] | null = null;
function blob(rgb: string): Cell {
  blobs ??= sheet(64, 64, BLOBS.length, (g, k) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${BLOBS[k]},0.9)`); gr.addColorStop(0.5, `rgba(${BLOBS[k]},0.35)`); gr.addColorStop(1, `rgba(${BLOBS[k]},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return blobs[Math.max(0, BLOBS.indexOf(rgb))];
}
const STRANDS = 12;
let strands: Cell[] | null = null;
function strand(k: number): Cell {
  strands ??= sheet(64, 512, STRANDS, drawStrand);
  return strands[k % STRANDS];
}
/** a kelp strand, base at the bottom middle: a stipe with fronds on alternate sides */
function drawStrand(g: CanvasRenderingContext2D, k: number): void {
  const R = rng(700 + k), W = 64, H = 512;
  const hue = 70 + R() * 30, lit = 16 + R() * 8;
  g.lineCap = 'round';
  g.strokeStyle = `hsl(${hue},45%,${lit - 6}%)`; g.lineWidth = 3;
  g.beginPath(); g.moveTo(W / 2, H);
  for (let y = H; y > 8; y -= 16) g.lineTo(W / 2 + Math.sin(y * 0.02 + k) * 5, y);
  g.stroke();
  for (let y = H - 30, s = 1; y > 20; y -= 18 + R() * 16, s = -s) {
    const x = W / 2 + Math.sin(y * 0.02 + k) * 5, L = 16 + R() * 14;
    g.fillStyle = `hsla(${hue + R() * 12},${36 + R() * 12}%,${lit + R() * 8}%,0.92)`;
    g.beginPath();
    g.ellipse(x + s * L * 0.55, y - 6, L * 0.6, 5 + R() * 3, s * -0.55, 0, TAU);
    g.fill();
  }
}

/** draw a sprite (css px) turned by ang, scaled to sx × sy, with its point (ax, ay in 0..1) at x, y */
function put(s: Scene, spr: Cell, x: number, y: number, ang: number, sx: number, sy: number, al: number, ax = 0.5, ay = 0.5): void {
  const co = Math.cos(ang), si = Math.sin(ang), w = spr.w, h = spr.h, k = s.dpr;
  const a = (co * sx * k) / w, b = (si * sx * k) / w, c = (-si * sy * k) / h, d = (co * sy * k) / h;
  if (s.gx) { s.gx.setTransform(a, b, c, d, x * k, y * k); s.gx.alpha = al; s.gx.image(spr.sheet, spr.sx, 0, w, h, -ax * w, -ay * h, w, h); return; }
  s.ctx.setTransform(a, b, c, d, x * k, y * k); s.ctx.globalAlpha = al; s.ctx.drawImage(spr.sheet, spr.sx, 0, w, h, -ax * w, -ay * h, w, h);
}
function blend(s: Scene, add: boolean): void {
  if (s.gx) s.gx.setBlend(add ? 'add' : 'over'); else s.ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
}

// ----- the pieces ----- //

/** pieces of every obstacle: along x (0..1 of its reach), across y (0..1), layer, size, phase */
const pieces = (() => { const R = rng(8123), out: number[][] = []; for (let i = 0; i < 260; i++) out.push([R(), R(), Math.floor(R() * LAYERS.length), R(), R() * TAU]); return out; })();

/** the top and bottom of the water at x, z */
function column(x: number, z: number): [number, number] {
  const fl = floorAt(x, z), ce = ceilAt(x, z);
  return [Math.max(24, Number.isFinite(ce) ? ce + 10 : 24), fl - 12];
}

function drawLayer(s: Scene, look: Look, gate: number, soft: number, layer: number, camY: number): void {
  const { view, t } = s, z = LAYERS[layer], span = soft + 160, x0 = gate - soft;
  for (const [u0, v, l, sz, ph] of pieces) {
    if (l !== layer) continue;
    let x: number, y: number;
    if (look === 'current') x = x0 + wrap(u0 * span - t * (140 + 90 * sz), span);
    else if (look === 'heat') x = x0 + wrap(u0 * span - t * 25, span);
    else x = x0 + u0 * span;
    const [top, bot] = look === 'void' ? [camY - 600, camY + 600] : column(x, z);
    if (bot - top < 20) continue;
    if (look === 'heat' || look === 'void') y = bot - wrap((1 - v) * (bot - top) + t * (look === 'void' ? 70 + 50 * sz : 30 + 20 * sz), bot - top);
    else if (look === 'kelp') y = bot;
    else y = top + v * (bot - top) + Math.sin(t * 0.3 + ph) * 12;
    view.project(x, y, z, P);
    if (P.d < 20) continue;
    // strongest at the obstacle, fading at both ends of its reach
    const u = (x - x0) / soft, w = smooth(clamp(u, 0, 1)) * smooth(clamp((gate + 160 - x) / 160, 0, 1));
    const al = w * (1 - fogOf(P.d, s.plane));
    if (al < 0.02) continue;
    if (look === 'current') {
      blend(s, sz > 0.7);
      put(s, blob(sz > 0.7 ? '235,252,255' : '210,240,250'), P.x, P.y, Math.sin(t + ph) * 0.05, (80 + 120 * sz) * P.s, (sz > 0.7 ? 3 : 12 + 16 * sz) * P.s, al * (sz > 0.7 ? 0.8 : 0.4));
    } else if (look === 'heat') {
      blend(s, sz > 0.8);
      put(s, blob(sz > 0.8 ? '255,190,110' : '255,140,80'), P.x + Math.sin(t * 2 + ph) * 6 * P.s, P.y, Math.PI / 2 + Math.sin(t * 1.5 + ph) * 0.2, (40 + 60 * sz) * P.s, (sz > 0.8 ? 3 : 18 + 20 * sz) * P.s, al * (sz > 0.8 ? 0.8 : 0.32));
    } else if (look === 'cold') {
      blend(s, sz > 0.85);
      put(s, blob(sz > 0.85 ? '240,252,255' : '215,240,255'), P.x, P.y, ph, (50 + 110 * sz) * P.s, (30 + 60 * sz) * P.s, al * (sz > 0.85 ? 0.6 : 0.4));
    } else if (look === 'void') {
      blend(s, true);
      put(s, blob('190,200,255'), P.x, P.y, Math.PI / 2, (60 + 80 * sz) * P.s, 1.6 * P.s, al * 0.4);
    } else {
      // kelp: dense in the last stretch before the gate, swaying slowly
      if (u < 0.45 || layer === 0) continue;
      blend(s, false);
      const h = Math.min(bot - top, 700 + 500 * sz) * P.s;
      put(s, strand((l * 7 + Math.floor(ph * 10)) % 12), P.x, P.y, Math.sin(t * 0.5 + ph) * 0.06, 34 * P.s * (1 + sz), h, al * 0.9 * (1 - fogOf(P.d, s.plane)), 0.5, 1);
    }
  }
  blend(s, false);
  if (s.gx) s.gx.alpha = 1;
  s.ctx.globalAlpha = 1;
}

/** the obstacles near the camera as depth-sorted pieces: push(depth, draw) */
export function obstacleItems(s: Scene, camX: number, camY: number, push: (d: number, fn: () => void) => void): void {
  for (const g of GATES) {
    const o = OBSTACLE[g.chapter], look = LOOK[g.chapter];
    if (!o || !look || camX < g.x - o.soft - 2400 || camX > g.x + 2400) continue;
    for (let l = 0; l < LAYERS.length; l++) push(s.view.depth(camY, LAYERS[l]), () => drawLayer(s, look, g.x, o.soft, l, camY));
  }
}

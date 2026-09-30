// Le Jardin de méduses: thousands of far jellyfish around the swimmer, and
// giant siphonophores far behind. Far things are cheap: every jelly is one
// image from a small atlas (a few frames of its pulse), or a glowing dot when
// it is tiny; the field is cut into slabs of depth so that the painter slips
// the near, simulated animals (the biome's fauna) between them. The field
// wraps around the camera: there is no end to it, up, down or sideways.
// Its density follows the biomes' `jellies`, so it thins out at the borders.

import { TAU, clamp, rng } from '../engine';
import type { Gfx } from '../engine3/gfx';
import { strokeLine } from '../engine3/paint-gl';
import type { Proj, View } from '../engine3/view';
import { BIOMES, blendOf } from './biomes';
import { fogOf, makeCanvas } from './sprites';

/** depth planes of the field (z), from near to far; the swimming plane is kept clear */
export const SLABS = [260, 380, 540, 740, 1000, 1320, 1720, 2200, 2800];

/** wrap v into [c - p/2, c + p/2): a field that repeats every p around c */
export function wrap(v: number, c: number, p: number): number {
  return c + ((((v - c + p / 2) % p) + p) % p) - p / 2;
}

/** repeat of the field along x and y at depth z: wider than what the widest view sees there */
export const periodX = (z: number) => 1.9 * (z + 2100) + 400;
export const periodY = (z: number) => 1.1 * (z + 2100) + 300;

/**
 * The pulse of a jelly: c counts its beats (t × frequency + phase). The bell
 * contracts at the start of each beat and relaxes slowly. Returns the atlas
 * frame (0 relaxed, 1 closing, 2 closed, 3 opening) and how much it has
 * risen, in beats (each beat is a small jet up, eased).
 */
export function pulse(c: number): { frame: number; lift: number } {
  const n = Math.floor(c), q = c - n;
  const frame = q < 0.12 ? 1 : q < 0.28 ? 2 : q < 0.45 ? 3 : 0;
  const u = Math.min(1, q / 0.4);
  return { frame, lift: n + u * u * (3 - 2 * u) };
}

/** a wave of light that spreads through the field from where it starts */
export interface Wave { x: number; y: number; z: number; t0: number; }
export const WAVE_SPEED = 380, WAVE_WIDTH = 300, WAVE_LIFE = 8;

/** how lit a jelly at distance dist from the start of a wave is, age seconds after it */
export function flash(dist: number, age: number): number {
  if (age < 0 || age > WAVE_LIFE) return 0;
  const k = (dist - age * WAVE_SPEED) / WAVE_WIDTH;
  return Math.exp(-k * k) * (1 - age / WAVE_LIFE);
}

const HUES = [292, 328, 196];
const CELL_W = 96, CELL_H = 128, BELL = 32, BELL_Y = 36, DOT = 4;

/** the atlas: a row per hue, four frames of the pulse then a soft dot */
function bakeAtlas(): HTMLCanvasElement {
  const c = makeCanvas(CELL_W * 5, CELL_H * HUES.length), g = c.getContext('2d')!;
  HUES.forEach((h, row) => {
    for (let f = 0; f < 5; f++) {
      g.setTransform(1, 0, 0, 1, f * CELL_W + CELL_W / 2, row * CELL_H + BELL_Y);
      if (f === DOT) {
        const r = CELL_W / 2, gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, `hsla(${h},100%,86%,1)`); gr.addColorStop(0.3, `hsla(${h},100%,66%,0.45)`); gr.addColorStop(1, `hsla(${h},100%,50%,0)`);
        g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
        continue;
      }
      const k = [0, 0.6, 1, 0.45][f], rx = BELL * (1 - 0.24 * k), ry = BELL * 0.66 * (1 + 0.28 * k);
      // tentacles, waving with the pulse
      g.lineWidth = 1.4;
      for (let i = 0; i < 7; i++) {
        const x0 = (i / 6 - 0.5) * rx * 1.7;
        g.strokeStyle = `hsla(${h},90%,72%,0.32)`;
        g.beginPath(); g.moveTo(x0, ry * 0.12);
        for (let s = 1; s <= 8; s++) g.lineTo(x0 * (1 - s * 0.04) + Math.sin(s * 0.9 + f * 1.4 + i) * (2 + s * 0.8), ry * 0.12 + s * (8 + k * 1.5));
        g.stroke();
      }
      // oral arms
      g.lineWidth = 3.2; g.strokeStyle = `hsla(${h + 18},90%,76%,0.3)`;
      for (const sx of [-1, 1]) {
        g.beginPath(); g.moveTo(sx * 3, 0);
        for (let s = 1; s <= 5; s++) g.lineTo(sx * (3 + Math.sin(s * 1.1 + f) * 4), s * 8);
        g.stroke();
      }
      // the bell: a dome, bright inside and at the rim
      const gr = g.createRadialGradient(0, -ry * 0.35, 0, 0, -ry * 0.2, rx);
      gr.addColorStop(0, `hsla(${h},90%,82%,0.62)`); gr.addColorStop(0.6, `hsla(${h},85%,62%,0.3)`); gr.addColorStop(1, `hsla(${h},80%,55%,0.12)`);
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, Math.PI, TAU); g.quadraticCurveTo(0, ry * 0.3, -rx, 0); g.fill();
      g.strokeStyle = `hsla(${h},100%,84%,0.75)`; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, Math.PI, TAU); g.stroke();
      // four gonads in a cross (the moon jelly's clover)
      g.fillStyle = `hsla(${h + 25},95%,82%,0.5)`;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse((i - 1.5) * rx * 0.28, -ry * 0.35, rx * 0.11, ry * 0.18, 0, 0, TAU); g.fill(); }
    }
  });
  return c;
}

/** a giant siphonophore: a chain of lights tens of metres long */
interface Siph { u: number; v: number; z: number; len: number; ph: number; hue: number; dir: number; }
const CHAIN = 48;

type Add = (d: number, fn: () => void) => void;

export interface JardinStats { jellies: number; dots: number; siphs: number; }

export class Jardin {
  /** per jelly: home x, home y, depth, radius, phase, beats per second, hue row, rank in its slab (0..1) */
  private hx: Float32Array; private hy: Float32Array; private z: Float32Array; private r: Float32Array;
  private ph: Float32Array; private fr: Float32Array; private hue: Uint8Array; private rank: Float32Array;
  /** jellies of each slab: [from, to) */
  private slab: [number, number][] = [];
  private siphs: Siph[] = [];
  private waves: Wave[] = [];
  private nextWave = 2;
  private atlas: HTMLCanvasElement | null = null;
  private dens: number[];
  private max: number;
  private P: Proj = { x: 0, y: 0, s: 1, d: 1 };
  private XS = new Float32Array(CHAIN); private YS = new Float32Array(CHAIN); private SS = new Float32Array(CHAIN);
  readonly stats: JardinStats = { jellies: 0, dots: 0, siphs: 0 };

  constructor(private view: View, private ctx: CanvasRenderingContext2D, private gx: Gfx | null, seed = 400) {
    this.dens = BIOMES.map((b) => b.jellies ?? 0);
    this.max = Math.max(1, ...this.dens);
    // the canvas pays a price per image: half as many
    const n = Math.round(this.max * (gx ? 1 : 0.5)), per = Math.ceil(n / SLABS.length), R = rng(seed);
    const N = per * SLABS.length;
    this.hx = new Float32Array(N); this.hy = new Float32Array(N); this.z = new Float32Array(N); this.r = new Float32Array(N);
    this.ph = new Float32Array(N); this.fr = new Float32Array(N); this.hue = new Uint8Array(N); this.rank = new Float32Array(N);
    SLABS.forEach((z, s) => {
      const i0 = s * per;
      this.slab.push([i0, i0 + per]);
      for (let k = 0; k < per; k++) {
        const i = i0 + k;
        this.hx[i] = R() * periodX(z); this.hy[i] = R() * periodY(z);
        this.z[i] = z + (R() - 0.5) * z * 0.25;
        this.r[i] = 8 + R() * R() * 22;
        this.ph[i] = R() * 10; this.fr[i] = 0.35 + R() * 0.5;
        const u = R();
        this.hue[i] = u < 0.55 ? 0 : u < 0.88 ? 1 : 2;
        this.rank[i] = k / per;
      }
    });
    for (let k = 0; k < 10; k++) {
      const z = 800 + R() * 1400;
      this.siphs.push({ u: R() * periodX(z), v: R() * periodY(z), z, len: 1400 + R() * 1800, ph: R() * 10, hue: R() < 0.7 ? 1 : 2, dir: R() < 0.5 ? -1 : 1 });
    }
  }

  /** how dense the field is at x, 0..1 */
  density(x: number): number { return blendOf(x, this.dens) / this.max; }

  /** the painter's items: one per slab (and one per siphonophore), when the field is near */
  collect(camX: number, camY: number, t: number, add: Add, draw: { dpr: number; W: number; H: number; plane: number }): void {
    const reach = periodX(SLABS[SLABS.length - 1]) / 2;
    if (this.density(camX) <= 0 && this.density(camX - reach) <= 0 && this.density(camX + reach) <= 0) return;
    this.stats.jellies = 0; this.stats.dots = 0; this.stats.siphs = 0;
    this.stepWaves(camX, camY, t);
    const v = this.view;
    SLABS.forEach((z, s) => add(v.depth(camY, z), () => this.drawSlab(s, camX, camY, t, draw)));
    for (const sp of this.siphs) add(v.depth(camY, sp.z) + 1, () => this.drawSiph(sp, camX, camY, t, draw));
  }

  private stepWaves(camX: number, camY: number, t: number): void {
    for (let i = this.waves.length - 1; i >= 0; i--) if (t - this.waves[i].t0 > WAVE_LIFE) this.waves.splice(i, 1);
    if (t < this.nextWave || this.waves.length >= 3) return;
    this.nextWave = t + 4 + Math.random() * 5;
    const z = 300 + Math.random() * 1600;
    this.waves.push({ x: camX + (Math.random() - 0.5) * 1600, y: camY + (Math.random() - 0.5) * 900, z, t0: t });
  }

  private use(): { atlas: HTMLCanvasElement; g: Gfx | null } {
    if (!this.atlas) this.atlas = bakeAtlas();
    return { atlas: this.atlas, g: this.gx };
  }

  /** one image of the atlas at (x, y) css px, w × h, additive */
  private blit(atlas: HTMLCanvasElement, cell: number, row: number, x: number, y: number, w: number, h: number, al: number): void {
    const g = this.gx;
    if (g) { g.alpha = al; g.image(atlas, cell * CELL_W, row * CELL_H, CELL_W, CELL_H, x, y, w, h); }
    else { this.ctx.globalAlpha = al; this.ctx.drawImage(atlas, cell * CELL_W, row * CELL_H, CELL_W, CELL_H, x, y, w, h); }
  }
  private begin(dpr: number): void {
    if (this.gx) { this.gx.setTransform(dpr, 0, 0, dpr, 0, 0); this.gx.setBlend('add'); }
    else { this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.ctx.globalCompositeOperation = 'lighter'; }
  }
  private end(): void {
    if (this.gx) { this.gx.alpha = 1; this.gx.setBlend('over'); }
    else { this.ctx.globalAlpha = 1; this.ctx.globalCompositeOperation = 'source-over'; }
  }

  private drawSlab(s: number, camX: number, camY: number, t: number, o: { dpr: number; W: number; H: number; plane: number }): void {
    const { atlas } = this.use(), P = this.P, v = this.view, [i0, i1] = this.slab[s], z0 = SLABS[s];
    const px = periodX(z0), py = periodY(z0), waves = this.waves;
    this.begin(o.dpr);
    for (let i = i0; i < i1; i++) {
      const c = t * this.fr[i] + this.ph[i], pu = pulse(c), z = this.z[i];
      const x = wrap(this.hx[i] + Math.sin(t * 0.07 + this.ph[i]) * 30, camX, px);
      if (this.rank[i] >= this.density(x)) continue;
      // each beat lifts it a little, and it sinks slowly between: the whole garden climbs
      const y = wrap(this.hy[i] - pu.lift * 7 + t * 1.2, camY, py);
      v.project(x, y, z, P);
      const rad = this.r[i] * P.s;
      if (P.x < -rad * 3 || P.x > o.W + rad * 3 || P.y < -rad * 4 || P.y > o.H + rad * 3) continue;
      let lit = 0;
      for (const w of waves) {
        const dx = x - w.x, dy = y - w.y, dz = z - w.z;
        lit += flash(Math.sqrt(dx * dx + dy * dy + dz * dz * 0.1), t - w.t0);
      }
      const fog = fogOf(P.d, o.plane), glow = clamp(0.4 + (pu.frame === 2 ? 0.14 : 0) + lit * 1.3, 0, 1.6), al = (1 - fog * 0.85) * glow;
      const row = this.hue[i];
      if (rad < 2.2) {
        // tiny: a dot of light
        const d = Math.max(1.4, rad * 2.2);
        this.blit(atlas, DOT, row, P.x - d, P.y - d, d * 2, d * 2, Math.min(1, al * 0.9));
        this.stats.dots++;
        continue;
      }
      const k = rad / BELL;
      if (lit > 0.1) { const d = rad * 3; this.blit(atlas, DOT, row, P.x - d, P.y - d * 0.8, d * 2, d * 2, Math.min(1, lit * 0.6 * (1 - fog * 0.6))); }
      this.blit(atlas, pu.frame, row, P.x - (CELL_W / 2) * k, P.y - BELL_Y * k, CELL_W * k, CELL_H * k, Math.min(1, al));
      this.stats.jellies++;
    }
    this.end();
  }

  private drawSiph(sp: Siph, camX: number, camY: number, t: number, o: { dpr: number; W: number; H: number; plane: number }): void {
    const hx = wrap(sp.u + t * 6 * sp.dir, camX, periodX(sp.z)), hy = wrap(sp.v, camY, periodY(sp.z));
    if (this.density(hx) < 0.4) return;
    const { atlas } = this.use(), P = this.P, v = this.view, XS = this.XS, YS = this.YS, SS = this.SS, seg = sp.len / CHAIN;
    let on = false;
    for (let i = 0; i < CHAIN; i++) {
      // it hangs down and trails behind its swimming bells, in slow waves
      const u = i / CHAIN, sway = Math.sin(i * 0.2 - t * 0.5 + sp.ph) * 160 * u + Math.sin(u * 3.8 + sp.ph) * sp.len * 0.1;
      v.project(hx - sp.dir * (i * seg * 0.45 + sway), hy + i * seg * 0.85 + sway * 0.3, sp.z, P);
      XS[i] = P.x; YS[i] = P.y; SS[i] = P.s;
      if (P.x > -50 && P.x < o.W + 50 && P.y > -50 && P.y < o.H + 50) on = true;
    }
    if (!on) return;
    this.stats.siphs++;
    const fog = fogOf(P.d, o.plane), fade = (1 - fog * 0.8) * clamp(this.density(hx) * 1.5 - 0.5, 0, 1), h = HUES[sp.hue];
    this.begin(o.dpr);
    const w = Math.max(1, 8 * SS[0]);
    if (this.gx) strokeLine(this.gx, XS, YS, CHAIN, false, w, this.gx.packCss(`hsla(${h},80%,70%,${(0.4 * fade).toFixed(3)})`));
    else {
      const g = this.ctx;
      g.globalAlpha = 1; g.strokeStyle = `hsla(${h},80%,70%,${(0.4 * fade).toFixed(3)})`; g.lineWidth = w;
      g.beginPath(); for (let i = 0; i < CHAIN; i++) if (i) g.lineTo(XS[i], YS[i]); else g.moveTo(XS[i], YS[i]);
      g.stroke();
    }
    // a light runs down the chain, from the bells to the tail
    const run = ((t * 7 + sp.ph * 10) % (CHAIN + 24)) - 12;
    for (let i = 2; i < CHAIN; i += 2) {
      const k = (i - run) / 4, b = 0.35 + 0.9 * Math.exp(-k * k), d = Math.max(1.6, 16 * SS[i]);
      this.blit(atlas, DOT, sp.hue, XS[i] - d, YS[i] - d, d * 2, d * 2, Math.min(1, b * fade));
    }
    // the swimming bells at its head
    for (let j = 0; j < 3; j++) {
      const pu = pulse(t * 0.8 + sp.ph + j * 0.3), r = 40 * SS[0], k = r / BELL;
      this.blit(atlas, pu.frame, sp.hue, XS[0] - (CELL_W / 2) * k + (j - 1) * r * 0.9, YS[0] - BELL_Y * k - j * r * 0.7, CELL_W * k, CELL_H * k, 0.8 * fade);
    }
    this.end();
  }
}

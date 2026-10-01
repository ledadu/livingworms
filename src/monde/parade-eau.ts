// The water of the parade in the world (fluide.ts, remous.ts): a patch of sea placed where a parade begins, that the
// two dancers stir as they swim, whose light shines in their colours, and that the figure closing the dance throws
// into petals, spirals, clouds and mushrooms. The lights of the parade (lueur.ts) and the eggs (ponte-jeu.ts) ride
// on it. Drawn after the dark, as the other lights, never beyond INK_PEAK: in the dark a light added to the water,
// in clear water, where an added light turns white, a cloud of colour, as the spawning of fish clouds the sea.

import { STEP } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import { hsl01, type Gfx } from '../engine3/gfx';
import type { Proj, View } from '../engine3/view';
import { Fluid, inkPixels, type Pt, type Rgb } from './fluide';
import type { Lueur } from './lueur';
import { beat, newBeat, paradeFigure, type Beat, type Gust } from './remous';
import { makeCanvas } from './sprites';

/** the colour of a light in the water, and of its cloud in clear water */
const tone = (hue: number): Rgb => hsl01(hue, 88, 64);
const dye = (hue: number): Rgb => hsl01(hue, 72, 46);
/** the light is drawn this many pixels a cell each way (then smoothed by the screen) */
const UP = 2;
/** at most this many points of a body stir the water (the trunk, then the tips of its limbs) */
const STIRS = 16;
/** how strongly a body drags the water along (0..1), and how much light the water gives where it is stirred */
const DRAG = 0.22, GLOW = 0.9;
const P: Proj = { x: 0, y: 0, s: 1, d: 1 }, Q: Proj = { x: 0, y: 0, s: 1, d: 1 };
interface Image { cv: HTMLCanvasElement; img: ImageData }

export function initEau() {
  const f = new Fluid();
  /** the light (added) and the cloud (laid over) of the water, as images */
  let glow: Image | null = null, cloud: Image | null = null;
  let ca: Rgb = tone(45), cb: Rgb = tone(190), da: Rgb = dye(45), db: Rgb = dye(190);
  /** the gusts to come (world positions), the time, and until when the figure's light rises or sinks */
  const queue: { g: Gust; x: number; y: number; at: number }[] = [];
  let clock = 0, tick = 0, liftUntil = 0, stamp = 0, shown = -1, lit = 0;
  const beats = new WeakMap<Creature3, Beat>();
  const flowed: Pt = { x: 0, y: 0 };

  function give(g: Gust, x: number, y: number): void {
    const gx = x + g.x, gy = y + g.y;
    if (g.rate) f.source(gx, gy, g.rate, g.r);
    if (g.vx || g.vy) f.push(gx, gy, g.vx ?? 0, g.vy ?? 0, g.r);
    if (g.a || g.b) f.ink(gx, gy, g.a ?? 0, g.b ?? 0, g.r);
  }

  const eau = {
    /** the water itself (tests) */
    fluid: f,
    /** the patch, calm and dark, centred here (a parade begins) */
    place(x: number, y: number): void { f.place(x, y); queue.length = 0; liftUntil = 0; },
    /** the colours of the partner's light and of ours */
    colours(hue: number, ours: number): void { ca = tone(hue); cb = tone(ours); da = dye(hue); db = dye(ours); },
    /** is (x, y) on the patch */
    covers(x: number, y: number, margin = 0): boolean { return f.inside(x, y, margin); },
    /** the water's velocity at (x, y) (px per step) */
    flow(x: number, y: number, out: Pt = flowed): Pt { return f.flow(x, y, out); },
    /** a gust now, at (x, y) */
    gust(g: Gust, x: number, y: number): void { if (f.inside(x + g.x, y + g.y)) give(g, x, y); },

    /**
     * Each step, a body in the water: its trunk and the tips of its limbs drag the water along, and its strokes (a
     * tail's sweep, a bell's beat) shed puffs. `light`: how much the stirred water shines (0 for a body only passing
     * through), `mix`: in whose colour, from 0 (the partner's) to 1 (ours).
     */
    dancer(cr: Creature3, light: number, mix: number): void {
      const r = cr.root;
      if (!f.inside(r.x[0], r.y[0], -60)) return;
      let n = 0;
      const touch = (x: Float32Array, y: Float32Array, ox: Float32Array, oy: Float32Array, i: number, rad: number) => {
        if (n++ >= STIRS || !f.inside(x[i], y[i])) return;
        const st = f.stir(x[i], y[i], x[i] - ox[i], y[i] - oy[i], Math.max(5, Math.min(12, rad)), DRAG);
        const e = Math.min(0.2, st * GLOW * light);
        if (e > 0.004) f.ink(x[i], y[i], e * (1 - mix), e * mix, 7);
      };
      for (let i = 0; i <= r.n; i += 2) touch(r.x, r.y, r.ox, r.oy, i, r.rad[i]);
      for (const s of cr.list) if (s.depth === 1 && !s.cut) touch(s.x, s.y, s.ox, s.oy, s.n, s.rad[s.n] * 2);
      let st = beats.get(cr);
      if (!st) { st = newBeat(); beats.set(cr, st); }
      const t = r.n, b = beat({
        mode: cr.mode, x: r.x[0], y: r.y[0], vx: r.x[0] - r.ox[0], vy: r.y[0] - r.oy[0],
        tx: r.x[t], ty: r.y[t], tvx: r.x[t] - r.ox[t], tvy: r.y[t] - r.oy[t],
        stroke: cr.stroke, size: cr.box[3] - cr.box[0]
      }, st);
      if (b) give({ ...b, a: b.light * light * (1 - mix), b: b.light * light * mix }, 0, 0);
    },

    /** the figure that closes the dance, around `at`, as rich as the parade was good (q, 0..1) */
    figure(l: Lueur, at: Pt, q: number): void {
      const fig = paradeFigure(l, q);
      for (const g of fig.gusts) queue.push({ g, x: at.x, y: at.y, at: clock + g.t });
      f.lift = fig.lift;
      liftUntil = clock + fig.lasts;
    },

    /** each step: the gusts whose time has come, then the water, at half the pace of the game */
    step(): void {
      clock += STEP;
      tick++;
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        if (q.at > clock) continue;
        give(q.g, q.x, q.y);
        queue.splice(i, 1);
      }
      if (liftUntil && clock > liftUntil) { f.lift = 0; liftUntil = 0; }
      if (tick % 2 === 0) f.step(2);
    },

    /** is anything to be seen in the water */
    get shining(): boolean { return f.awake && lit > 0.004; },

    /**
     * Draws it over the scene (after the dark). `clear`: how clear and bright the water is (0..1): the light gives way
     * to its cloud of colour there.
     */
    draw(gx: Gfx | null, ctx: CanvasRenderingContext2D, view: View, dpr: number, clear: number): void {
      if (!f.awake) { lit = 0; return; }
      const W = f.nx * UP, H = f.ny * UP;
      const image = () => { const cv = makeCanvas(W, H); return { cv, img: cv.getContext('2d')!.createImageData(W, H) }; };
      glow ??= image(); cloud ??= image();
      const kGlow = 1 - 0.65 * clear, kCloud = 0.9 * clear;
      // its pixels only change when the water has moved
      if (shown !== f.age) {
        shown = f.age;
        lit = inkPixels(f, ca, cb, 1 + 0.5 * clear, glow.img.data, UP);
        if (lit > 0.004) {
          glow.cv.getContext('2d')!.putImageData(glow.img, 0, 0);
          if (kCloud > 0.02) { inkPixels(f, da, db, 1, cloud.img.data, UP); cloud.cv.getContext('2d')!.putImageData(cloud.img, 0, 0); }
          stamp++;
        }
      }
      if (lit <= 0.004) return;
      // the patch lies in the plane of the swimmers: its corners, seen in perspective
      view.project(f.x0, f.y0, 0, P);
      view.project(f.x0 + f.width, f.y0 + f.height, 0, Q);
      const sx = ((Q.x - P.x) / W) * dpr, sy = ((Q.y - P.y) / H) * dpr;
      if (gx) {
        gx.setTransform(sx, 0, 0, sy, P.x * dpr, P.y * dpr);
        if (kCloud > 0.02) { gx.alpha = kCloud; gx.image(cloud.cv, 0, 0, W, H, 0, 0, W, H, stamp); }
        gx.setBlend('add');
        gx.alpha = kGlow;
        gx.image(glow.cv, 0, 0, W, H, 0, 0, W, H, stamp);
        gx.alpha = 1;
        gx.setBlend('over');
        return;
      }
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.setTransform(sx, 0, 0, sy, P.x * dpr, P.y * dpr);
      if (kCloud > 0.02) { ctx.globalAlpha = kCloud; ctx.drawImage(cloud.cv, 0, 0); }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = kGlow;
      ctx.drawImage(glow.cv, 0, 0);
      ctx.restore();
    }
  };
  return eau;
}

export type Eau = ReturnType<typeof initEau>;

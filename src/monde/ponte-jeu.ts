// The eggs in the world (ponte.ts): laid where a parade ended, in its burst of light, pale gold as those of the brood
// screen. Staying by them, they tremble and glow brighter, then the brood opens; left for later, they wait there.
// One clutch at a time: a new parade lays a new one in its place.

import type { Spec } from '../engine';
import type { Child } from '../content/portee';
import type { Proj, View } from '../engine3/view';
import { makeCanvas, type Sprite } from './sprites';
import { EGG_COUNT, eggAt, hatching, leaveClutch, newClutch, stepClutch, type Clutch } from './ponte';

export interface Pt { x: number; y: number; }

interface Deps {
  /** opens the brood of these eggs (portee-ecran.ts) */
  open(partner: Spec, quality: number, seed: number): void;
  /** a place in the water for eggs laid at x, y */
  keep(x: number, y: number): Pt;
  /** while this is true (a parade, a panel, the farewell), the eggs wait */
  busy(): boolean;
  /** would one of these children cross the obstacle where the eggs lie */
  crosses(kids: readonly Child[], x: number): boolean;
}

export interface EggScene {
  view: View;
  /** the scene's own way of drawing a baked image at x, y, z */
  draw: (sp: Sprite, x: number, y: number, z: number) => void;
  /** lights drawn after the dark: x, y (screen), size, hue, alpha */
  lights: number[];
}

/** the gold of the eggs of the brood screen (portee.css) */
const EGG_HUE = 45;
/** px of the egg image per world unit */
const RES = 3;
const P: Proj = { x: 0, y: 0, s: 1, d: 1 };

let eggSprite: Sprite | null = null;
/** a pale glowing egg, with the small curled shape of a child in it */
function bakeEgg(): Sprite {
  const r = 9, w = r * 2.2, h = r * 2.6, c = makeCanvas(w * RES, h * RES), ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.9, r * 1.12, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.45, 0, cx, cy, r * 1.15);
  g.addColorStop(0, 'rgba(255,250,235,0.95)');
  g.addColorStop(0.45, 'rgba(246,217,138,0.55)');
  g.addColorStop(1, 'rgba(246,217,138,0.18)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,244,214,0.5)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // the child inside, curled up
  ctx.beginPath();
  ctx.arc(cx + 0.5, cy + 1, r * 0.38, -0.4, Math.PI * 1.35);
  ctx.strokeStyle = 'rgba(150,110,50,0.45)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();
  return { canvas: c, ax: cx, ay: cy, res: RES };
}

export function initPonte(deps: Deps) {
  let clutch: (Clutch & { partner: Spec; quality: number; seed: number; opened: boolean; crosses: boolean }) | null = null;
  let time = 0;

  const ponte = {
    /** the eggs waiting in the water, if any */
    get clutch() { return clutch; },
    /** eggs of this partner, after a parade of this quality, laid at `at`; `now`: their brood opens at once */
    lay(partner: Spec, quality: number, at: Pt, now = false): void {
      const p = deps.keep(at.x, at.y);
      clutch = { ...newClutch(p.x, p.y), partner, quality, seed: Math.floor(Math.random() * 0xfffffff), opened: false, crosses: false };
      if (now) ponte.open();
    },
    /** opens their brood now */
    open(): void {
      if (!clutch) return;
      clutch.opened = true;
      deps.open(clutch.partner, clutch.quality, clutch.seed);
    },
    /** the brood was left for later: the eggs wait, and we know now whether one of them would cross */
    later(kids: readonly Child[]): void {
      if (!clutch) return;
      leaveClutch(clutch);
      clutch.crosses = deps.crosses(kids, clutch.x);
    },
    /** a child was chosen: the eggs have hatched */
    hatched(): void { clutch = null; },
    /** where the thread of the hints may lead: eggs never opened, or that would cross */
    get calling(): Pt | null { return clutch && (!clutch.opened || clutch.crosses) ? { x: clutch.x, y: clutch.y } : null; },

    /** each step, with the swimmer at (px, py) */
    step(px: number, py: number, dt: number): void {
      time += dt;
      if (!clutch || deps.busy()) return;
      if (stepClutch(clutch, px, py, dt)) ponte.open();
    },

    /** each frame: the eggs as depth-sorted pieces, and their glow */
    items(s: EggScene, camX: number, push: (d: number, fn: () => void) => void): void {
      const c = clutch;
      if (!c || Math.abs(c.x - camX) > 2600) return;
      const [x0, x1] = s.view.xRange(0, 100);
      if (c.x < x0 || c.x > x1) return;
      eggSprite ??= bakeEgg();
      const k = hatching(c), breathe = 0.85 + 0.15 * Math.sin(time * 1.6);
      for (let i = 0; i < EGG_COUNT; i++) {
        const e = eggAt(i, time, k), x = c.x + e.x, y = c.y + e.y;
        push(s.view.depth(y, 0) - 0.25, () => s.draw(eggSprite!, x, y, 0));
        s.view.project(x, y, 0, P);
        s.lights.push(P.x, P.y, (e.r * 2.6 + 10 * k) * P.s * breathe, EGG_HUE, (0.28 + 0.4 * k) * breathe);
      }
    }
  };
  return ponte;
}

export type Ponte = ReturnType<typeof initPonte>;

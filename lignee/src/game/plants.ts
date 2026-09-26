// Vegetation. Two kinds:
// - hero plants: real anchored whips (kelp, corals, fans, sargassum…) that the
//   water moves when something swims by; they have no motion of their own.
// - the carpet: thousands of cheap blades that bend away from the swimmer,
//   computed directly (no chain).

import { Creature, TAU, noise1, rng, seedOf, settle, spec, type Spec } from '../engine';
import { SPECIES } from '../content';
import { css, moodAt, type HSL } from './palette';
import { CW, SEED, floorY, groundAt, reefness } from './terrain';

type R01 = () => number;

export function plantSpec(kind: string, R: R01): Spec {
  const r = (a: number, c: number) => a + R() * (c - a);
  const ri = (a: number, c: number) => Math.floor(r(a, c + 1));
  switch (kind) {
    case 'kelp':
      return spec({ name: 'Kelp', palette: { hue: r(40, 70), harmony: 'analog', sat: r(45, 65), light: r(30, 40) }, eyes: { on: false },
        body: { name: 'Stipe', links: ri(26, 40), len: 12, width: 1.4, shape: 'constant', style: 'ribbon', flex: 0.4, spring: 0.04, drag: 0.7, gravity: -0.07, curl: r(-0.05, 0.05),
          color: { slot: 0, grad: 12 },
          attach: [{ node: { name: 'Fronde', links: 5, len: 6.5, width: 4.2, shape: 'leaf', style: 'ribbon', flex: 0.35, spring: 0.12, curl: 0.6, gravity: -0.03, drag: 0.7, color: { slot: 1, alpha: 0.92, grad: 10 } },
            pattern: 'series', at: 0.12, to: 1, count: ri(9, 14), angle: 0.8, alternate: true, jitter: 0.6, edge: 0.5 }] } });
    case 'posidonie':
      return spec({ name: 'Posidonie', palette: { hue: r(78, 110), harmony: 'analog', sat: r(40, 58), light: r(32, 44) }, eyes: { on: false },
        body: { name: 'Souche', links: 1, len: 1, width: 0.6, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0 },
          attach: [{ node: { name: 'Feuille', links: ri(7, 10), len: 6, width: 1.5, shape: 'constant', style: 'ribbon', flex: 0.45, spring: 0.05, gravity: -0.05, drag: 0.7,
            color: { slot: 1, grad: 14, pattern: 'stripe', pslot: 3, plight: 12, pscale: 0.5 } }, pattern: 'fan', at: 1, count: ri(4, 7), spread: 0.6, angle: 0, jitter: 0.8, phaseStep: 0.8 }] } });
    case 'sargasse':
      return spec({ name: 'Sargasse', palette: { hue: r(34, 46), harmony: 'analog', sat: r(55, 75), light: r(38, 48) }, eyes: { on: false },
        body: { name: 'Stolon', links: ri(7, 11), len: 6, width: 1, shape: 'constant', style: 'ribbon', flex: 0.45, spring: 0.08, drag: 0.72, gravity: 0.03,
          color: { slot: 0, grad: -8 },
          attach: [
            { node: { name: 'Feuille', links: 3, len: 3.4, width: 2.2, shape: 'leaf', style: 'ribbon', flex: 0.3, spring: 0.2, curl: 0.3, color: { slot: 1, grad: 8 } },
              pattern: 'series', at: 0.1, to: 1, count: ri(6, 10), angle: 1.1, alternate: true, jitter: 0.7 },
            { node: { name: 'Flotteur', links: 1, len: 2.4, width: 1.5, shape: 'constant', style: 'disc', flex: 0.2, spring: 0.3, color: { slot: 3, light: 12 } },
              pattern: 'series', at: 0.2, to: 0.9, count: ri(3, 6), angle: 1.6, alternate: true, jitter: 0.5 }
          ] } });
    case 'coral':
      return spec({ name: 'Corail', palette: { hue: pick(R, [8, 18, 330, 345, 40, 280]), harmony: 'analog', sat: r(65, 88), light: r(52, 62) }, eyes: { on: false },
        body: { name: 'Tronc', links: 3, len: 6, width: 3, shape: 'worm', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, grad: 10 },
          attach: [{ node: { name: 'Branche', links: 3, len: 5.5, width: 2.3, shape: 'worm', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0, grad: 15 },
            attach: [{ node: { name: 'Rameau', links: 2, len: 4.5, width: 1.6, shape: 'bulb', style: 'ribbon', flex: 0.03, spring: 0.9, color: { slot: 1, light: 8 } },
              pattern: 'fan', at: 1, count: 2, spread: 0.8, angle: 0, jitter: 0.6 }] },
            pattern: 'fan', at: 1, count: ri(2, 3), spread: 1, angle: 0, jitter: 0.6 }] } });
    case 'fan':
      return spec({ name: 'Gorgone', palette: { hue: pick(R, [285, 300, 340, 20, 45]), harmony: 'analog', sat: r(55, 80), light: r(46, 56) }, eyes: { on: false },
        body: { name: 'Pied', links: 2, len: 6, width: 1.6, shape: 'constant', style: 'ribbon', flex: 0.02, spring: 0.9, color: { slot: 0 } ,
          attach: [{ node: { name: 'Rayon', links: 7, len: 7.5, width: 0.7, shape: 'linear', style: 'line', flex: 0.06, spring: 0.7, curl: 0.3, color: { slot: 0 } },
            pattern: 'fan', at: 1, count: ri(6, 9), spread: 1.6, angle: 0, web: 0.85, jitter: 0.4 }] } });
    case 'softcoral':
      return spec({ name: 'Corail mou', palette: { hue: pick(R, [330, 290, 20, 180]), harmony: 'analog', sat: r(55, 75), light: r(58, 68) }, eyes: { on: false },
        body: { name: 'Tronc', links: 2, len: 5, width: 3.2, shape: 'bell', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 0, alpha: 0.9 },
          attach: [{ node: { name: 'Lobe', links: 4, len: 4, width: 2.4, shape: 'club', style: 'ribbon', flex: 0.3, spring: 0.15, gravity: -0.03, drag: 0.72,
            color: { slot: 1, alpha: 0.85, pattern: 'spots', pslot: 3, plight: 25, pdensity: 7 } },
            pattern: 'fan', at: 1, count: ri(4, 7), spread: 1.3, angle: 0, jitter: 0.7 }] } });
    case 'seapen':
      return spec({ name: 'Plume de mer', palette: { hue: r(20, 45), harmony: 'split', sat: 60, light: 55 }, eyes: { on: false },
        body: { name: 'Tige', links: 8, len: 6.5, width: 1.4, shape: 'constant', style: 'ribbon', flex: 0.35, spring: 0.1, drag: 0.7, gravity: -0.03, color: { slot: 0 },
          attach: [{ node: { name: 'Pinnule', links: 3, len: 4, width: 1.6, shape: 'leaf', style: 'ribbon', flex: 0.2, spring: 0.2, curl: 0.5, color: { slot: 1 } },
            pattern: 'series', at: 0.3, to: 1, count: 8, angle: 1.1, alternate: true, hueStep: 10, phaseStep: 0.4 }] } });
    case 'tubes':
      return spec({ name: 'Vers tubicoles', palette: { hue: pick(R, [350, 20, 200]), harmony: 'mono', sat: 80, light: 52 }, eyes: { on: false },
        body: { name: 'Souche', links: 1, len: 1, width: 0.5, shape: 'constant', style: 'ribbon', flex: 0.1, spring: 0.5, color: { slot: 3, light: 30 },
          attach: [{ node: { name: 'Tube', links: 4, len: 5.5, width: 1.8, shape: 'constant', style: 'plates', flex: 0.05, spring: 0.7, color: { slot: 3, light: 35, grad: -10 },
            attach: [{ node: { name: 'Panache', links: 3, len: 3, width: 0.5, shape: 'linear', style: 'line', flex: 0.3, spring: 0.2, color: { slot: 0 } },
              pattern: 'fan', at: 1, count: 6, spread: 1.6, angle: 0 }] },
            pattern: 'fan', at: 1, count: ri(3, 6), spread: 0.7, angle: 0, jitter: 0.5 }] } });
    default: {
      const a = SPECIES.anemone();
      a.palette.hue = pick(R, [0, 20, 300, 330, 160]);
      return a;
    }
  }
}

function pick<T>(R: R01, l: T[]): T { return l[Math.floor(R() * l.length)]; }

export interface Hero { cr: Creature; kind: string; }

/** what grows in a chunk: a list of (kind, x, y, dir) to build, cheap to compute */
export interface Sprout { kind: string; x: number; y: number; dir: number; seed: number; }

/** meadows of sea grass in the Nurserie */
export function meadow(x: number): number {
  return Math.max(0, (noise1(x / 520, SEED + 11) - 0.32) * 3 + (x > 300 && x < 2600 ? 0.5 : 0));
}

export function sproutsOf(ci: number): Sprout[] {
  const R = rng(seedOf(ci, SEED + 3)), x0 = ci * CW, out: Sprout[] = [];
  const add = (kind: string, x: number, y: number, dir = -Math.PI / 2) => out.push({ kind, x, y, dir, seed: seedOf(Math.round(x), Math.round(y)) });
  for (let x = x0 + R() * 30; x < x0 + CW; x += 26 + R() * 40) {
    const reef = reefness(x), g = groundAt(x), onRock = g.f !== null;
    if (reef < 0.5) {
      const mw = meadow(x);
      if (!onRock && R() < mw * 0.9) add('posidonie', x, g.y + 3);
      else if (R() < 0.05 + (reef > 0.1 ? 0.25 : 0)) add('kelp', x, g.y + 3);
      else if (onRock && R() < 0.2) add('anemone', x, g.y + 3);
    } else {
      const k = R();
      if (k < 0.3) add('coral', x, g.y + 3);
      else if (k < 0.42) add('fan', x, g.y + 3);
      else if (k < 0.55) add('softcoral', x, g.y + 3);
      else if (k < 0.63) add('anemone', x, g.y + 3);
      else if (k < 0.7) add('tubes', x, g.y + 3);
      else if (k < 0.73 && !onRock) add('seapen', x, g.y + 3);
      else if (k < 0.77 && !onRock) add('kelp', x, g.y + 3);
    }
  }
  // sargassum rafts at the surface of the Nurserie
  for (let x = x0 + R() * 60; x < x0 + CW; x += 20 + R() * 30) {
    const raft = noise1(x / 700, SEED + 21) - 0.45 + (x < 1600 ? 0.35 : 0);
    if (reefness(x) < 0.6 && raft > 0 && R() < raft * 2.4) add('sargasse', x, 3 + R() * 4, Math.PI / 2);
  }
  return out;
}

export function growHero(s: Sprout): Hero {
  const R = rng(s.seed), sp = plantSpec(s.kind, R);
  const tilt = s.kind === 'sargasse' ? (R() - 0.5) * 0.5 : s.kind === 'kelp' || s.kind === 'posidonie' || s.kind === 'seapen' ? 0 : (R() - 0.5) * 0.35;
  const scale = s.kind === 'kelp' ? 0.9 + R() * 0.5 : s.kind === 'sargasse' ? 0.8 + R() * 0.5 : 0.8 + R() * 0.45;
  const cr = new Creature(sp, s.x, s.y, { dir: s.dir + tilt, anchor: s.dir + tilt, phase: R() * TAU, scale });
  if (s.kind === 'anemone') for (const sg of cr.list) sg.def.motion.amp *= 0.3;
  settle(cr, s.kind === 'kelp' || s.kind === 'sargasse' ? 420 : 160);
  return { cr, kind: s.kind };
}

// ----- carpet ----- //

export interface Carpet {
  n: number;
  x: Float32Array; y: Float32Array; h: Float32Array; w: Float32Array;
  col: Uint8Array; kind: Uint8Array;
  bend: Float32Array; vel: Float32Array;
  colors: string[]; tips: string[];
  box: [number, number, number, number];
}

export function carpetOf(ci: number): Carpet {
  const R = rng(seedOf(ci, SEED + 5)), x0 = ci * CW, m = moodAt(x0 + CW / 2);
  const xs: number[] = [], ys: number[] = [], hs: number[] = [], ws: number[] = [], cs: number[] = [], ks: number[] = [];
  for (let x = x0; x < x0 + CW; x += 1.2 + R() * 2.2) {
    const reef = reefness(x), g = groundAt(x), mw = meadow(x);
    let dens: number, h: number, kind: number;
    if (reef < 0.5) {
      dens = 0.08 + mw * 0.9 + (g.f ? 0.25 : 0);
      h = g.f ? 4 + R() * 7 : 8 + R() * (10 + mw * 26);
      kind = 0;
    } else {
      dens = g.f ? 0.4 : 0.3;
      kind = R() < 0.55 ? 1 : 0;
      h = kind ? 4 + R() * 7 : 5 + R() * 12;
    }
    if (R() > dens) continue;
    xs.push(x); ys.push(g.y + 2); hs.push(h); ws.push(kind ? 0.9 : 0.7 + R() * 0.8);
    cs.push(Math.floor(R() * m.blades.length)); ks.push(kind);
    // floor under an overhang also gets some
    if (g.f && R() < 0.3) {
      const fy = floorY(x);
      if (fy - g.y > 40) { xs.push(x); ys.push(fy + 2); hs.push(5 + R() * 8); ws.push(0.8); cs.push(Math.floor(R() * m.blades.length)); ks.push(0); }
    }
  }
  const n = xs.length;
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { y0 = Math.min(y0, ys[i] - hs[i]); y1 = Math.max(y1, ys[i]); }
  const blades: HSL[] = m.blades;
  return {
    n, x: Float32Array.from(xs), y: Float32Array.from(ys), h: Float32Array.from(hs), w: Float32Array.from(ws),
    col: Uint8Array.from(cs), kind: Uint8Array.from(ks), bend: new Float32Array(n), vel: new Float32Array(n),
    colors: blades.map((c) => css(c, 0.95)), tips: blades.map((c) => css(c, 1, 22)),
    box: [x0 - 40, y0 - 30, x0 + CW + 40, y1 + 4]
  };
}

export interface Pusher { x: number; y: number; vx: number; vy: number; r: number; }

export function updateCarpet(c: Carpet, pushers: Pusher[], t: number): void {
  const surge = Math.sin(t * 0.55) * 0.5 + Math.sin(t * 0.23 + 1) * 0.5;
  for (let i = 0; i < c.n; i++) {
    const bx = c.x[i], by = c.y[i], h = c.h[i];
    let target = surge * h * 0.06 + Math.sin(bx * 0.05 + t * 0.4) * h * 0.02;
    for (const p of pushers) {
      const dx = bx - p.x, dy = by - h * 0.6 - p.y, R = p.r + h;
      if (dx > R || dx < -R || dy > R || dy < -R) continue;
      const d = Math.hypot(dx, dy);
      if (d >= R) continue;
      const f = (1 - d / R) * (1 - d / R);
      target += (dx >= 0 ? 1 : -1) * f * h * 0.9 + p.vx * f * 5;
    }
    if (target > h * 0.95) target = h * 0.95; else if (target < -h * 0.95) target = -h * 0.95;
    let v = c.vel[i];
    v = (v + (target - c.bend[i]) * 0.1) * 0.84;
    c.vel[i] = v;
    c.bend[i] += v;
  }
}

export function drawCarpet(ctx: CanvasRenderingContext2D, c: Carpet, vx0: number, vx1: number): void {
  const nc = c.colors.length;
  for (let k = 0; k < nc; k++) {
    ctx.fillStyle = c.colors[k];
    ctx.beginPath();
    for (let i = 0; i < c.n; i++) {
      if (c.col[i] !== k) continue;
      const bx = c.x[i];
      if (bx < vx0 || bx > vx1) continue;
      const by = c.y[i], h = c.h[i], b = c.bend[i], w = c.w[i];
      const tx = bx + b, ty = by - Math.sqrt(Math.max(0, h * h - b * b * 0.6));
      const mx = bx + b * 0.25, my = by - h * 0.55;
      ctx.moveTo(bx - w, by);
      ctx.quadraticCurveTo(mx - w * 0.6, my, tx, ty);
      ctx.quadraticCurveTo(mx + w * 0.6, my, bx + w, by);
    }
    ctx.fill();
    // tufts carry a bright polyp at the tip
    ctx.fillStyle = c.tips[k];
    ctx.beginPath();
    for (let i = 0; i < c.n; i++) {
      if (c.col[i] !== k || !c.kind[i]) continue;
      const bx = c.x[i];
      if (bx < vx0 || bx > vx1) continue;
      const by = c.y[i], h = c.h[i], b = c.bend[i];
      const tx = bx + b, ty = by - Math.sqrt(Math.max(0, h * h - b * b * 0.6));
      ctx.moveTo(tx + 1.3, ty);
      ctx.arc(tx, ty, 1.3, 0, TAU);
    }
    ctx.fill();
  }
}

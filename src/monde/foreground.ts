// The dark foreground: silhouettes of kelp, grass, coral and rocks standing
// between the eye and the swimming plane (z < 0). Being nearer the eye they
// pass faster than everything else (the perspective does it), and they are
// baked small and blurred, drawn dark, so they give depth without being read.
// They rise from the bottom of the screen and fade where the swimmer is, so
// the swimming plane stays clear.

import { TAU, clamp, rng } from '../engine';
import type { Gfx } from '../engine3/gfx';
import type { HSL } from './palette';
import { BIOMES, X0, X1, biomeIndex, presence } from './biomes';

export type FrontShape = 'kelp' | 'grass' | 'coral' | 'fan' | 'tubes' | 'stalk' | 'rock';

export interface FrontPiece {
  x: number; z: number; shape: FrontShape;
  /** world size: height and half width */
  h: number; w: number;
  seed: number;
  /** baked silhouette (made when it first comes into view) */
  img: HTMLCanvasElement | null;
}

/** the depths of the foreground (the eye is near z = -900, the swimming plane at 0) */
export const FRONT_Z: [number, number] = [-620, -380];
/** baked pixels per world unit: few, the enlargement blurs them */
const RES = 0.55;

/** the plants of a biome as foreground shapes (what is not known stands as a rock) */
const SHAPE_OF: Record<string, FrontShape> = {
  kelp: 'kelp', posidonie: 'grass', anemone: 'grass', coral: 'coral', softcoral: 'coral', fan: 'fan',
  tubes: 'tubes', eponge: 'tubes', riftia: 'tubes', seapen: 'stalk', crinoide: 'stalk'
};
export function shapeOf(kind: string): FrontShape { return SHAPE_OF[kind] || 'rock'; }

/** size of a shape, world units: [height min, height max, half width / height] */
const SIZE: Record<FrontShape, [number, number, number]> = {
  kelp: [200, 340, 0.22], grass: [70, 140, 0.5], coral: [80, 160, 0.55], fan: [90, 170, 0.55],
  tubes: [60, 120, 0.45], stalk: [110, 190, 0.3], rock: [45, 100, 1.1]
};

/** the foreground of the whole world, sorted from far to near */
export function makeFront(seed = 11): FrontPiece[] {
  const R = rng(seed), out: FrontPiece[] = [];
  let x = X0 + R() * 200;
  while (x < X1) {
    let bi = biomeIndex(x);
    // near a border the neighbour mingles in
    for (const j of [bi - 1, bi + 1]) if (j >= 0 && j < BIOMES.length && R() < presence(x, j) * 0.8) bi = j;
    const b = BIOMES[bi], kinds: [FrontShape, number][] = b.flora.kinds.map(([k, w]) => [shapeOf(k), w]);
    kinds.push(['rock', 1.2]);
    let s = 0;
    for (const [, w] of kinds) s += w;
    let u = R() * s, shape: FrontShape = 'rock';
    for (const [k, w] of kinds) { u -= w; if (u <= 0) { shape = k; break; } }
    const [h0, h1, wk] = SIZE[shape], h = h0 + R() * (h1 - h0);
    const piece: FrontPiece = { x, z: FRONT_Z[0] + R() * (FRONT_Z[1] - FRONT_Z[0]), shape, h, w: h * wk * (0.8 + R() * 0.4), seed: Math.floor(R() * 1e9), img: null };
    // nothing grows up from a floor that has fallen out of sight
    if (!b.abyss) out.push(piece);
    // clumps and clearings; fewer where the dark closes in
    x += (R() < 0.35 ? 40 + R() * 70 : 150 + R() * 330) * (1 + b.dark);
  }
  return out.sort((a, c) => c.z - a.z);
}

/** screen y of the foot of a piece: on its floor when the floor is in view, else just under the bottom edge */
export function footY(floorY: number, H: number): number {
  return Math.min(floorY, H * 1.04);
}

/**
 * How much of a piece is shown (0..1) as it nears the swimmer: its screen box
 * (left, top, right, bottom) against a circle of radius r around the swimmer.
 * Never quite 0, so a piece fades rather than pops.
 */
export function clearance(l: number, tp: number, rt: number, bt: number, px: number, py: number, r: number): number {
  const dx = px < l ? l - px : px > rt ? px - rt : 0, dy = py < tp ? tp - py : py > bt ? py - bt : 0;
  const u = clamp((Math.hypot(dx, dy) - r * 0.35) / (r * 1.1), 0, 1);
  return 0.08 + 0.92 * u * u * (3 - 2 * u);
}

/** the colour of the silhouettes: the water around the eye, much darker */
export function frontColour(water: HSL): HSL {
  return { h: water.h, s: water.s * 0.7, l: Math.min(14, water.l * 0.32) };
}

// ----- baking ----- //

/** a silhouette in one colour on transparent, its foot at the bottom centre of the canvas, blurred */
export function bakeFront(p: FrontPiece, colour: string): HTMLCanvasElement {
  // room for what reaches past the nominal size (fan, branches, blades) and for the blur
  const pad = 6, w = Math.ceil(Math.max(p.w * 1.7, p.h * 0.6) * RES) + pad, h = Math.ceil(p.h * 1.1 * RES) + pad;
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h;
  const g = c.getContext('2d')!, R = rng(p.seed), s = RES;
  g.filter = 'blur(1.2px)';
  g.fillStyle = g.strokeStyle = colour;
  g.lineCap = 'round';
  g.translate(w, h - 1);
  const stroke = (pts: number[], lw: number) => {
    g.lineWidth = lw; g.beginPath();
    for (let i = 0; i < pts.length; i += 2) if (i) g.lineTo(pts[i], pts[i + 1]); else g.moveTo(pts[0], pts[1]);
    g.stroke();
  };
  const H = p.h * s, Wd = p.w * s;
  switch (p.shape) {
    case 'kelp': {
      // one or two stipes with long blades on alternating sides
      for (let k = 0, n = 1 + Math.floor(R() * 2); k < n; k++) {
        const ox = (R() - 0.5) * Wd * 0.6, bend = (R() - 0.5) * Wd * 0.8, top = H * (0.75 + R() * 0.25), pts: number[] = [];
        for (let i = 0; i <= 12; i++) { const v = i / 12; pts.push(ox + bend * v * v, -top * v); }
        stroke(pts, 2.2);
        for (let i = 2; i < 12; i++) {
          const v = i / 12, bx = ox + bend * v * v, by = -top * v, side = i & 1 ? 1 : -1, len = Wd * (0.5 + R() * 0.4);
          g.beginPath(); g.moveTo(bx, by);
          g.quadraticCurveTo(bx + side * len * 0.6, by - len * 0.5, bx + side * len, by - len * 0.2);
          g.quadraticCurveTo(bx + side * len * 0.4, by - len * 0.1, bx, by);
          g.fill();
        }
      }
      break;
    }
    case 'grass': {
      for (let i = 0, n = 9 + Math.floor(R() * 7); i < n; i++) {
        const ox = (R() - 0.5) * Wd * 1.2, lean = (R() - 0.5) * Wd * 1.2, top = H * (0.45 + R() * 0.55);
        g.beginPath(); g.moveTo(ox - 2.2, 0);
        g.quadraticCurveTo(ox + lean * 0.3, -top * 0.6, ox + lean, -top);
        g.quadraticCurveTo(ox + lean * 0.3 + 1.5, -top * 0.6, ox + 2.2, 0);
        g.fill();
      }
      break;
    }
    case 'coral': case 'stalk': {
      // branches forking up (the stalk: one stem and a feathery crown)
      const coral = p.shape === 'coral';
      const branch = (x: number, y: number, a: number, len: number, lw: number, depth: number): void => {
        const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
        stroke([x, y, x1, y1], lw);
        if (depth <= 0) { if (coral) { g.beginPath(); g.arc(x1, y1, lw * 0.9, 0, TAU); g.fill(); } return; }
        const n = coral ? 2 + (R() < 0.3 ? 1 : 0) : 5;
        for (let i = 0; i < n; i++) {
          const da = coral ? (i - (n - 1) / 2) * (0.5 + R() * 0.3) : (i - (n - 1) / 2) * 0.55;
          branch(x1, y1, a + da, len * (coral ? 0.72 : 0.35), lw * 0.7, coral ? depth - 1 : 0);
        }
      };
      if (coral) branch(0, 0, -Math.PI / 2 + (R() - 0.5) * 0.3, H * 0.34, Math.max(2, Wd * 0.18), 3);
      else branch(0, 0, -Math.PI / 2 + (R() - 0.5) * 0.25, H * 0.8, 1.6, 1);
      break;
    }
    case 'fan': {
      // a sea fan: a mesh of branches opening from one foot
      const lean = (R() - 0.5) * 0.4;
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI / 2 + lean + (i / 13 - 0.5) * 1.9, pts: number[] = [0, 0];
        for (let k = 1; k <= 5; k++) { const v = k / 5; pts.push(Math.cos(a) * Wd * 1.6 * v * 0.9, Math.sin(a) * H * v + Math.sin(k * 2 + i) * 1.5); }
        stroke(pts, 1.4);
      }
      g.globalAlpha = 0.5;
      g.beginPath(); g.ellipse(0, -H * 0.55, Wd * 0.85, H * 0.42, lean, 0, TAU); g.fill();
      g.globalAlpha = 1;
      break;
    }
    case 'tubes': {
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) {
        const ox = (i / Math.max(1, n - 1) - 0.5) * Wd * 1.3, top = H * (0.4 + R() * 0.6), r = Wd * (0.14 + R() * 0.1);
        g.beginPath(); g.moveTo(ox - r, 0); g.lineTo(ox - r * 1.1, -top); g.arc(ox, -top, r * 1.1, Math.PI, 0); g.lineTo(ox + r, 0); g.fill();
      }
      break;
    }
    case 'rock': {
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI, k = 0.75 + R() * 0.3;
        g.lineTo(Math.cos(a) * Wd * k, Math.sin(a) * H * k);
      }
      g.closePath(); g.fill();
      break;
    }
  }
  return c;
}

// ----- drawing ----- //

/** where to draw (WebGL or canvas): the image with its foot at the origin of the transform */
export interface FrontPainter {
  image(img: HTMLCanvasElement, a: number, b: number, c: number, d: number, e: number, f: number, alpha: number): void;
}

export interface FrontFrame {
  /** projection of a world point: fills x, y (css px) and s (px per world unit) */
  project(x: number, y: number, z: number): { x: number; y: number; s: number };
  xRange(z: number, margin: number): [number, number];
  floorAt(x: number, z: number): number;
  W: number; H: number;
  /** the swimmer on screen, and its clear radius */
  px: number; py: number; clear: number;
  t: number;
  /** strength of the layer (fades in the dark) */
  alpha: number;
  /** colour of the silhouettes at x */
  colour(x: number): string;
}

/** the painter of the screen: WebGL when there is one, else the 2D canvas */
export function frontPainter(gx: Gfx | null, ctx: CanvasRenderingContext2D, dpr: () => number): FrontPainter {
  return {
    image(img, a, b, c, d, e, f, alpha) {
      const k = dpr(), w = img.width, h = img.height;
      if (gx) {
        gx.setTransform(k * a, k * b, k * c, k * d, k * e, k * f);
        gx.alpha = alpha;
        gx.image(img, 0, 0, w, h, -w / 2, -h, w, h);
        gx.alpha = 1;
        return;
      }
      ctx.setTransform(k * a, k * b, k * c, k * d, k * e, k * f);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, -w / 2, -h);
      ctx.globalAlpha = 1;
    }
  };
}

/** how many pieces were drawn in the last frame (for the tests) */
export const frontCount = { drawn: 0 };

export function drawFront(pieces: FrontPiece[], f: FrontFrame, paint: FrontPainter): void {
  let n = 0;
  if (f.alpha > 0.01) for (const p of pieces) {
    const [x0, x1] = f.xRange(p.z, p.w * 1.5);
    if (p.x < x0 || p.x > x1) { if (p.img && (p.x < x0 - 3000 || p.x > x1 + 3000)) p.img = null; continue; }
    const P = f.project(p.x, f.floorAt(p.x, p.z), p.z), s = P.s, fy = footY(P.y, f.H), top = fy - p.h * s;
    if (top > f.H) continue;
    const al = f.alpha * clearance(P.x - p.w * s, top, P.x + p.w * s, fy, f.px, f.py, f.clear);
    if (al < 0.01) continue;
    if (!p.img) p.img = bakeFront(p, f.colour(p.x));
    // a slow sway from the foot, the tall ones more
    const k = s / RES, sway = Math.sin(f.t * 0.5 + (p.seed % 628) / 100) * (p.shape === 'rock' ? 0 : p.shape === 'kelp' ? 0.12 : 0.05);
    paint.image(p.img, k, 0, sway * k, k, P.x, fy, al);
    n++;
  }
  frontCount.drawn = n;
}

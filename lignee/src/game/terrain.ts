// The shape of the world: a sea floor (a height field) and rock features set
// on it — coral heads, arches, overhangs, boulders. Everything is seeded, so a
// place always looks the same. y grows downward, the surface is y = 0.

import { TAU, clamp, lerp, noise1, rng, seedOf } from '../engine';
import { CHAPTER_X } from './palette';

export const CW = 1024;          // chunk width (world px)
export const SEED = 1789;
export const PX_PER_M = 20;

export type FeatureKind = 'blob' | 'arch' | 'ledge' | 'boulder';

export interface Feature {
  kind: FeatureKind;
  /** closed outline, x0 y0 x1 y1 … */
  poly: number[];
  box: [number, number, number, number];
  /** colliders: x, y, r */
  circles: [number, number, number][];
  /** where it touches the floor (for contact shadows) */
  feet: number[];
  seed: number;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** depth of the floor at x, before rock features */
export function floorY(x: number): number {
  // chapter base depth: the Nurserie is deep open water, the Récif rises
  const t = smooth(clamp((x - (CHAPTER_X[1] - 1200)) / 2400, 0, 1));
  const base = lerp(760, 470, t);
  const hills = (noise1(x / 1300, SEED) - 0.5) * lerp(150, 110, t);
  const mid = (noise1(x / 330, SEED + 1) - 0.5) * lerp(40, 70, t);
  const small = (noise1(x / 70, SEED + 2) - 0.5) * lerp(6, 16, t);
  return base + hills + mid + small;
}

/** 0 in the Nurserie, 1 on the reef */
export function reefness(x: number): number {
  return smooth(clamp((x - (CHAPTER_X[1] - 900)) / 1800, 0, 1));
}

// ----- outlines ----- //

function boxOf(poly: number[]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < poly.length; i += 2) {
    if (poly[i] < b[0]) b[0] = poly[i];
    if (poly[i + 1] < b[1]) b[1] = poly[i + 1];
    if (poly[i] > b[2]) b[2] = poly[i];
    if (poly[i + 1] > b[3]) b[3] = poly[i + 1];
  }
  return b;
}

/** a lumpy rock: a union of circles traced as a star around its centre */
function makeBlob(cx: number, R: number, r: () => number, kind: FeatureKind, seed: number): Feature {
  const base = floorY(cx);
  const cy = base - R * 0.55;
  const circles: [number, number, number][] = [[cx, cy, R]];
  const n = 2 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 2.6, d = R * (0.45 + r() * 0.4), rr = R * (0.4 + r() * 0.35);
    circles.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, rr]);
  }
  const poly: number[] = [], N = 64, ns = seed % 1000;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU, dx = Math.cos(a), dy = Math.sin(a);
    let far = 0;
    for (const [x, y, rad] of circles) {
      // far intersection of the ray from (cx, cy) with this circle
      const ox = cx - x, oy = cy - y, b = ox * dx + oy * dy, c = ox * ox + oy * oy - rad * rad, disc = b * b - c;
      if (disc >= 0) far = Math.max(far, -b + Math.sqrt(disc));
    }
    const bump = 1 + (noise1(i * 0.35 + ns, seed) - 0.5) * 0.16 + (noise1(i * 1.3 + ns, seed + 1) - 0.5) * 0.06;
    // flatten the bottom: it sinks in the sand
    const px = cx + dx * far * bump;
    let py = cy + dy * far * bump;
    if (py > base + 30) py = base + 30;
    poly.push(px, py);
  }
  return { kind, poly, box: boxOf(poly), circles, feet: [cx - R * 0.8, cx + R * 0.8], seed };
}

/** an arch: a thick curved band standing on two feet */
function makeArch(xa: number, span: number, r: () => number, seed: number): Feature {
  const xb = xa + span, H = span * (0.55 + r() * 0.3), T = 26 + r() * 22;
  const fa = floorY(xa), fb = floorY(xb), N = 28, outer: number[] = [], inner: number[] = [], circles: [number, number, number][] = [];
  const lean = (r() - 0.5) * 0.3;
  for (let i = 0; i <= N; i++) {
    const u = i / N, s = Math.pow(Math.sin(Math.PI * u), 0.75);
    const cx = lerp(xa, xb, u) + Math.sin(Math.PI * u) * lean * span * 0.3;
    const cy = lerp(fa, fb, u) + 20 - (H + 20) * s;
    const th = (T / 2) * (1 + 0.8 * (1 - s)) * (1 + (noise1(u * 6, seed) - 0.5) * 0.35);
    // normal of the curve
    const du = 0.01, s2 = Math.pow(Math.sin(Math.PI * Math.min(1, u + du)), 0.75);
    const tx = (xb - xa) * du, ty = (fb - fa) * du - (H + 20) * (s2 - s);
    const tl = Math.hypot(tx, ty) || 1, nx = ty / tl, ny = -tx / tl;
    outer.push(cx + nx * th, cy + ny * th);
    inner.push(cx - nx * th, cy - ny * th);
    if (i % 2 === 0) circles.push([cx, cy, th * 0.95]);
  }
  const poly = outer.slice();
  for (let i = inner.length - 2; i >= 0; i -= 2) poly.push(inner[i], inner[i + 1]);
  return { kind: 'arch', poly, box: boxOf(poly), circles, feet: [xa, xb], seed };
}

/** a rock wall with a shelf sticking out to one side */
function makeLedge(x0: number, r: () => number, seed: number): Feature {
  const dir = r() < 0.5 ? -1 : 1, W = 60 + r() * 50, H = 110 + r() * 110, L = 90 + r() * 90, T = 22 + r() * 16;
  const f = floorY(x0), top = f - H;
  const pts: [number, number][] = [];
  const jag = (k: number) => (noise1(k * 0.9, seed) - 0.5) * 14;
  // back wall, bottom to top
  for (let i = 0; i <= 6; i++) pts.push([x0 - (dir * W) / 2 + jag(i), lerp(f + 30, top + 8, i / 6)]);
  // top of the shelf, out to the tip
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    pts.push([x0 - (dir * W) / 2 + dir * (W + L) * u, top + Math.sin(u * Math.PI) * -8 + u * u * 10 + jag(i + 10) * 0.5]);
  }
  // underside back toward the wall
  for (let i = 8; i >= 0; i--) {
    const u = i / 8;
    pts.push([x0 + (dir * W) / 2 + dir * L * u + jag(i + 20) * 0.3, top + T * (1 - 0.6 * u) + u * u * 10 + 6]);
  }
  // front wall down to the floor
  for (let i = 0; i <= 6; i++) pts.push([x0 + (dir * W) / 2 + jag(i + 30), lerp(top + T + 6, f + 30, i / 6)]);
  const poly: number[] = [];
  for (const [x, y] of pts) poly.push(x, y);
  const circles: [number, number, number][] = [];
  for (let i = 0; i <= 5; i++) circles.push([x0, lerp(f, top + W / 2, i / 5), W / 2]);
  for (let i = 1; i <= 5; i++) circles.push([x0 + dir * (W / 2 + (L * i) / 5 - T / 2), top + T / 2 + 4, T * 0.7]);
  return { kind: 'ledge', poly, box: boxOf(poly), circles, feet: [x0 - W / 2, x0 + W / 2], seed };
}

// ----- features per chunk ----- //

const featureCache = new Map<number, Feature[]>();

export function featuresOf(ci: number): Feature[] {
  let f = featureCache.get(ci);
  if (f) return f;
  f = [];
  const R = rng(seedOf(ci, SEED)), x0 = ci * CW;
  const reef = reefness(x0 + CW / 2);
  const slots = [0.1, 0.3, 0.5, 0.7, 0.9].map((u) => x0 + u * CW + (R() - 0.5) * 120);
  for (const x of slots) {
    const s = seedOf(Math.round(x), 91);
    const k = R();
    if (x < 250) continue;
    if (reef > 0.4) {
      if (k < 0.12) f.push(makeArch(x - 120, 220 + R() * 160, R, s));
      else if (k < 0.22) f.push(makeLedge(x, R, s));
      else if (k < 0.75) f.push(makeBlob(x, 45 + R() * 70, R, 'blob', s));
      else if (k < 0.9) f.push(makeBlob(x, 18 + R() * 20, R, 'boulder', s));
    } else {
      if (k < 0.18) f.push(makeBlob(x, 26 + R() * 34, R, 'boulder', s));
      else if (k < 0.24) f.push(makeBlob(x, 50 + R() * 30, R, 'blob', s));
    }
  }
  featureCache.set(ci, f);
  return f;
}

export function chunkOf(x: number): number { return Math.floor(x / CW); }

/** highest point of a closed outline over x (or +Infinity) */
export function polyTop(poly: number[], x: number): number {
  let best = Infinity;
  const n = poly.length;
  for (let i = 0; i < n; i += 2) {
    const ax = poly[i], ay = poly[i + 1], bx = poly[(i + 2) % n], by = poly[(i + 3) % n];
    if ((ax <= x && bx > x) || (bx <= x && ax > x)) {
      const y = ay + ((x - ax) / (bx - ax)) * (by - ay);
      if (y < best) best = y;
    }
  }
  return best;
}

/** what a plant growing at x would stand on: floor or the top of a rock */
export function groundAt(x: number): { y: number; f: Feature | null } {
  let y = floorY(x), f: Feature | null = null;
  for (let ci = chunkOf(x) - 1; ci <= chunkOf(x) + 1; ci++) {
    for (const ft of featuresOf(ci)) {
      if (x < ft.box[0] || x > ft.box[2]) continue;
      const t = polyTop(ft.poly, x);
      if (t < y) { y = t; f = ft; }
    }
  }
  return { y, f };
}

/** push a point out of the rock; returns the corrected position */
export function collide(x: number, y: number, rad: number, out: { x: number; y: number; hit: boolean }): void {
  out.x = x; out.y = y; out.hit = false;
  const fy = floorY(x) - rad;
  if (out.y > fy) { out.y = fy; out.hit = true; }
  for (let ci = chunkOf(x) - 1; ci <= chunkOf(x) + 1; ci++) {
    for (const ft of featuresOf(ci)) {
      if (x < ft.box[0] - 80 || x > ft.box[2] + 80 || y < ft.box[1] - 80 || y > ft.box[3] + 80) continue;
      for (const [cx, cy, r] of ft.circles) {
        const dx = out.x - cx, dy = out.y - cy, d = Math.hypot(dx, dy), m = r + rad;
        if (d < m && d > 0.001) { out.x = cx + (dx / d) * m; out.y = cy + (dy / d) * m; out.hit = true; }
      }
    }
  }
}

// La Remontée (docs/chapitres.md, chapter 10). At the bottom of the world a well of light falls from the surface
// far above. The swimmer turns round in it and sings the whole song, one note per chapter of the descent; at each
// note the ancestors who learned it come. Then a current carries the lineage back up, in formation, through every
// chapter, each lighting up as it passes, to the surface of the Nurserie, where a larva is born.
// Pure: the well, the way up, the formation, the light and the moments of the scene; the game is remontee-jeu.ts.

import { clamp, lerp, lerpHue } from '../engine';
import { BIOMES, X1, presence, span } from './biomes';
import type { HSL, Mood } from './palette';

export interface Pt { x: number; y: number }

const smooth = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

// ----- the well ----- //

/** the axis of the well of light, in the middle of the Remontée */
export const WELL_X = span('remontee')[0] + 800;
/** half its width at the floor (world px); it stands a little behind the swimming plane */
export const WELL_R = 170;
export const WELL_Z = 90;
/** the scene begins when the swimmer comes this near the axis */
export const WELL_REACH = WELL_R + 150;

/** how much the light of the well opens the dark at x (0..1): full around it, nothing 1 500 px away */
export function wellLight(x: number): number {
  return smooth(1 - Math.abs(x - WELL_X) / 1500);
}

/** where the lineage comes out: under the surface, where the first larva was born */
export const END: Pt = { x: 420, y: 34 };

// ----- the moments of the scene (s) ----- //

export const T = {
  /** in the well: the words of the turning, the swimmer faces up */
  words: 1.4,
  turn: 2.2,
  /** the first note of the song, then one every `note` s; the ancestors come with theirs */
  song: 8.5,
  note: 1.25,
  /** the current starts to carry the lineage up (a moment after the last note) */
  rise: 21.5,
  /** from the surface reached: the light breaks through, an egg of light shows, it hatches, the last words, the end */
  egg: 2.4,
  hatch: 5.6,
  final: 7,
  end: 21
};

/** the notes of the song, one per chapter of the descent (the Remontée has none) */
export const NOTES = BIOMES.length - 1;

/**
 * When each ancestor comes (s from the start of the scene), the oldest first: with the note of the chapter where it
 * gave birth, the one it learned; several with the same note come one after the other. No ancestor saved (a game
 * without a birth): the first larva comes alone, with the first note.
 */
export function callTimes(chapters: readonly string[], ids: readonly string[] = BIOMES.map((b) => b.id)): number[] {
  const seen = new Map<number, number>();
  return chapters.map((c) => {
    const k = ids.indexOf(c), note = clamp(k < 0 ? NOTES - 1 : k, 0, NOTES - 1), n = seen.get(note) ?? 0;
    seen.set(note, n + 1);
    return T.song + note * T.note + n * 0.35;
  });
}

// ----- the formation ----- //

/**
 * Where the k-th ancestor swims (1: the parent of the one played, the oldest last), from the leader going along dir
 * (a unit vector): a V opening behind it, one arm on each side, the ranks `gap` apart; the upper arm a little behind
 * the swimming plane, the lower one a little in front of it, so that they do not hide one another.
 */
export function slot(k: number, dir: Pt, gap = 64): Pt & { z: number } {
  const r = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
  const back = 40 + gap * 1.1 * r, across = gap * 0.9 * r * side;
  // across is along dir turned a quarter (up when going left)
  return { x: -dir.x * back - dir.y * across, y: -dir.y * back + dir.x * across, z: side > 0 ? 14 * r : -7 * r };
}

/**
 * Where the k-th of n ancestors comes around the swimmer while it sings in the well: a crown, the first ones above
 * it, turning both ways down to the last ones below; wide enough for them all.
 */
export function crown(k: number, n: number, gap = 64): Pt & { z: number } {
  const r = Math.max(150, (gap * 1.15 * n) / (2 * Math.PI)), side = k % 2 ? 1 : -1;
  const a = -Math.PI / 2 + side * (Math.ceil(k / 2) - 0.5) * ((2 * Math.PI) / Math.max(2, n));
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.85, z: side > 0 ? 12 : -6 };
}

/** the spacing of the formation for bodies of this mean length (px) */
export function gapFor(meanLength: number): number {
  return clamp(meanLength * 0.75, 58, 120);
}

// ----- the way up ----- //

/** what the way up needs to know of the world (biomes.ts, grotte.ts, relief.ts) */
export interface Ground {
  floor(x: number, z: number): number;
  /** the floor as if nothing fell away, where the open water animals live (biomes.openFloor) */
  open(x: number, z: number): number;
  lift(x: number): number;
  /** the underside of a vault, -Infinity where there is none */
  ceil(x: number, z: number): number;
  /** inside a relief of the swimming plane */
  solid?(x: number, y: number, z: number): boolean;
}

/** height above the floor the lineage keeps on its way, and the room it keeps from the floor, a vault and the surface */
const CRUISE = 330, ROOM = 85, TOP = END.y;
/** how high it rises in the well before it turns toward the chapters, and over how far it comes up to the surface */
const WELL_BOTTOM = 330, WELL_UP = 650, SURFACING = 2600;

/**
 * The way up, as points about every 20 px: straight up the well, then back along the chapters (x going down) at
 * mid water, never down again except under the vault of the Grotte, clear of the reliefs, up to under the surface.
 */
export class AscentPath {
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** the length along the way at each point */
  readonly s: Float32Array;
  readonly length: number;

  constructor(pts: Pt[]) {
    const n = pts.length;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = pts[i].x; this.y[i] = pts[i].y;
      if (i) this.s[i] = this.s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    this.length = this.s[n - 1];
  }

  /** the point of the way nearest p, looked for around `hint` (the last one found) */
  nearest(p: Pt, hint = 0): number {
    const n = this.x.length;
    let best = -1, bd = Infinity;
    for (let i = Math.max(0, hint - 40); i < Math.min(n, hint + 160); i++) {
      const d = (this.x[i] - p.x) ** 2 + (this.y[i] - p.y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if (bd > 600 * 600) for (let i = 0; i < n; i++) { const d = (this.x[i] - p.x) ** 2 + (this.y[i] - p.y) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }

  /** the direction of the way at point i (unit) */
  dir(i: number): Pt {
    const n = this.x.length, a = Math.max(0, Math.min(i, n - 2) - 3), b = Math.min(n - 1, Math.max(i, 1) + 3);
    const dx = this.x[b] - this.x[a], dy = this.y[b] - this.y[a], d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  /** the point `ahead` px further along the way from point i */
  ahead(i: number, ahead: number): Pt {
    const want = this.s[i] + ahead;
    let k = i;
    while (k + 1 < this.x.length && this.s[k + 1] < want) k++;
    return { x: this.x[k], y: this.y[k] };
  }
}

export function ascentPath(g: Ground, from = WELL_X, to = END.x): AscentPath {
  const bottom = g.floor(from, 0) - WELL_BOTTOM, top = bottom - WELL_UP;
  // up the well
  const pts: Pt[] = [];
  for (let y = bottom; y > top; y -= 20) pts.push({ x: from, y });
  // then along the chapters, never lower than where it has been
  let prev = top;
  for (let x = from - 20; x >= to; x -= 20) {
    let y = Math.min(prev, g.open(x, 0) - g.lift(x) - CRUISE);
    y = lerp(y, TOP, smooth(1 - (x - to) / SURFACING));
    pts.push({ x, y });
    prev = y;
  }
  const n = pts.length;
  /** the room there is at a point: the floor and a vault */
  const keep = (p: Pt) => {
    const f = g.floor(p.x, 0) - ROOM, c = g.ceil(p.x, 0) + ROOM;
    p.y = c > f ? (c + f) / 2 : clamp(p.y, Math.max(c, TOP), f);
  };
  const soften = (w: number, passes: number) => {
    for (let q = 0; q < passes; q++) {
      const ox = pts.map((p) => p.x), oy = pts.map((p) => p.y);
      // the first points stay in the well, the last one under the surface
      for (let i = 1; i < n - 1; i++) {
        if (pts[i].x === from && i < n / 4 && oy[i] > top + 120) continue;
        // as many points on each side, so that the ends stay where they are
        const k = Math.min(w, i, n - 1 - i);
        let sx = 0, sy = 0, c = 0;
        for (let j = i - k; j <= i + k; j++) { sx += ox[j]; sy += oy[j]; c++; }
        pts[i].x = sx / c; pts[i].y = sy / c;
      }
    }
  };
  soften(10, 3);
  pts.forEach(keep);
  // out of the reliefs of the swimming plane: the nearest free height, keeping the room
  if (g.solid) {
    const clear = (x: number, y: number) => !g.solid!(x, y, 0) && !g.solid!(x, y - 55, 0) && !g.solid!(x, y + 55, 0);
    for (const p of pts) {
      if (clear(p.x, p.y)) continue;
      for (let d = 20; d <= 480; d += 20) {
        const f = g.floor(p.x, 0) - ROOM, c = Math.max(g.ceil(p.x, 0) + ROOM, TOP);
        if (p.y + d < f && clear(p.x, p.y + d)) { p.y += d; break; }
        if (p.y - d > c && clear(p.x, p.y - d)) { p.y -= d; break; }
      }
    }
    soften(3, 1);
    pts.forEach(keep);
  }
  return new AscentPath(pts);
}

/**
 * How fast the current carries the lineage (px per step) at `along` px of the way, `since` s after it set off:
 * it picks up for a few seconds, then carries fast, and slows down as the surface nears.
 */
export const CARRY = { top: 6.4, end: 1.1, pickUp: 5, slowFor: 1900 };
export function carrySpeed(along: number, length: number, since: number): number {
  const up = smooth(since / CARRY.pickUp), down = smooth((length - along) / CARRY.slowFor);
  return Math.max(0, lerp(CARRY.end, CARRY.top, down) * up);
}

// ----- the chapters light up ----- //

/** the lineage lights a chapter up as soon as the leader, going up, comes into its light (x under its end, plus the blend) */
export function reached(i: number, x: number): boolean {
  const end = i + 1 < BIOMES.length ? BIOMES[i + 1].x0 : X1;
  return x < end + 450;
}

/** how lit the water is at x (0..1), from how lit each chapter is, with the same blend as the light of the chapters */
export function litAt(lit: ArrayLike<number>, x: number): number {
  let s = 0, w = 0;
  for (let i = 0; i < BIOMES.length; i++) {
    const p = presence(x, i);
    if (p <= 0) continue;
    s += p * lit[i]; w += p;
  }
  return w > 0 ? s / w : 0;
}

/** the light of a chapter, lit by `L` (0..1): lighter water, a golden light from above, the dark lifted */
export function litMood<M extends Mood & { dark: number }>(m: M, L: number): M {
  if (L < 0.004) return m;
  // lighter, and a little more of its own colour
  const up = (c: HSL, dl: number, cap: number): HSL => ({ h: c.h, s: lerp(c.s, Math.max(c.s, 56), L), l: Math.max(c.l, Math.min(cap, c.l + dl * L)) });
  return {
    ...m,
    top: up(m.top, 26, 60), deep: up(m.deep, 13, 28),
    sky: { h: lerpHue(m.sky.h, 46, L), s: lerp(m.sky.s, 90, L), l: lerp(m.sky.l, 88, L) },
    plankton: { h: lerpHue(m.plankton.h, 46, L * 0.7), s: m.plankton.s, l: lerp(m.plankton.l, 92, L) },
    rays: Math.max(m.rays, 1.1 * L), dark: m.dark * (1 - 0.9 * L)
  };
}

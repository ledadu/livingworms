// The friends who follow (docs/mecaniques.md, « Les amis qui suivent »). A little swimmer we kept company with (one
// that came to look at us, one we shared a feast with, one that answered our song) becomes the friend of the
// generation: it swims around us from chapter to chapter, sings each note with us, and now and then leads us to
// something (a trace of the lineage not seen yet, or a spot where food falls). When the generation changes it stays
// where it is, like the ancestors, and knows us again when we pass by.
//
// This module is pure: the animals are plain data, chance a function; amis-jeu.ts plays it in the world.

import { toLines } from './textes';

export interface Pt { x: number; y: number }

/** the swimmer, as the friends see it */
export interface Swimmer { x: number; y: number; vx: number; vy: number; len: number }

// ----- the bond ----- //

/** the bond at which an animal follows us */
export const FULL = 8;
/** how slow the swimmer keeps company (px per step; vie.ts looks at a swimmer this calm) */
export const CALM = 1.2;
/** how fast it rushes (px per step; vie.ts RUSH): that frightens the bond away */
export const RUSH = 1.9;
/** an answer to our song ties this much at once */
export const SONG = 3;

/** a moment beside an animal: the scene it plays (vie.ts), how far the swimmer is, how fast it swims */
export interface Moment { act: string | null; d: number; speed: number }

/**
 * The bond after dt seconds of this moment. Staying calm beside an animal that came to look at us ties it fastest
 * (about ten seconds), then sharing a feast with it, then any scene watched from close by; rushing at it unties
 * it, and far away it slowly fades.
 */
export function bondStep(bond: number, m: Moment, dt: number): number {
  if (m.speed > RUSH && m.d < 220) return Math.max(0, bond - 3 * dt);
  if (m.speed <= CALM) {
    if (m.act === 'curieux' && m.d < 320) return bond + dt;
    if (m.act === 'festin' && m.d < 280) return bond + 0.6 * dt;
    if (m.act && m.d < 200) return bond + 0.25 * dt;
  }
  return m.d > 700 ? Math.max(0, bond - 0.2 * dt) : bond;
}

/** an animal that may become a friend: a little swimmer of the open water, quick enough to follow us, not a partner */
export interface Candidate { kind: string; gait: string; len: number; speed: number; partner: boolean }
export const MAX_LEN = 150, MIN_SPEED = 0.6;
export function friendly(c: Candidate): boolean {
  return c.kind === 'swim' && c.gait === 'glide' && !c.partner && c.len <= MAX_LEN && c.speed >= MIN_SPEED;
}

// ----- following ----- //

/** how far it keeps from us: close, and further while a parade or a farewell needs the room */
const RING = 95, ASIDE = 230;
/** it falls this far behind before it hurries, and beyond this it is brought back near us (a journey, a reload) */
export const HURRY = 120, LOST = 1500;

/**
 * Where the friend wants to be now. While we swim it keeps beside us, a little behind, on its own side; while we
 * stay it circles us slowly, in a flattened ring.
 */
export function spotOf(s: Swimmer, t: number, phase: number, aside = false): Pt {
  const r = (aside ? ASIDE : RING) + s.len * 0.5, v = Math.hypot(s.vx, s.vy);
  if (v > 1.2) {
    const ux = s.vx / v, uy = s.vy / v, side = Math.sin(phase) < 0 ? -1 : 1;
    return { x: s.x - ux * r * 0.6 - uy * side * r * 0.7, y: s.y - uy * r * 0.6 + ux * side * r * 0.7 };
  }
  const a = phase + t * 0.35;
  return { x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r * 0.6 };
}

/** its wished velocity toward its spot (px per step): easy near it, quicker than us when it falls behind */
export function followGoal(at: Pt, spot: Pt, s: Pt): Pt {
  const dx = spot.x - at.x, dy = spot.y - at.y, d = Math.hypot(dx, dy) || 1;
  const behind = Math.hypot(s.x - at.x, s.y - at.y);
  const k = Math.min(1, d / 60) * (1.4 + Math.min(2, Math.max(0, behind - HURRY) / 60));
  return { x: (dx / d) * k, y: (dy / d) * k };
}

/** an old friend at home: a slow round about its place */
export function homeGoal(at: Pt, home: Pt, t: number, phase: number): Pt {
  const a = phase + t * 0.2, to = { x: home.x + Math.cos(a) * 70, y: home.y + Math.sin(a) * 35 };
  const dx = to.x - at.x, dy = to.y - at.y, d = Math.hypot(dx, dy) || 1, k = 0.7 * Math.min(1, d / 50);
  return { x: (dx / d) * k, y: (dy / d) * k };
}

/** an old friend greets us when we come this near (px), the first time in a visit, and swims with us this long (s) */
export const GREET_NEAR = 300, GREET_FOR = 14;

// ----- showing ----- //

/** something the friend leads us to: a trace of the lineage not seen yet, or a spot where food will fall */
export interface Show { kind: 'trace' | 'food'; to: Pt; t0: number; done: boolean }

/** the first show comes this long after the friendship (s), the next ones every so often */
export const FIRST_SHOW = 35, SHOW_EVERY: [number, number] = [55, 95];
/** a trace this near along x may be shown; a show is given up after this long (s) */
const TRACE_NEAR = 1600, SHOW_FOR = 30;
/** it leads at most this far ahead of us, and the show is reached when we come this near */
export const AHEAD = 280, THERE = 190;

export const nextShow = (t: number, R: () => number) => t + SHOW_EVERY[0] + R() * (SHOW_EVERY[1] - SHOW_EVERY[0]);

/** what to show now: the nearest trace not seen yet, within reach; else a spot ahead where food will fall */
export function pickShow(s: Swimmer, traces: readonly (Pt & { seen: boolean })[], t: number, R: () => number): Show {
  let best: Pt | null = null;
  for (const q of traces) if (!q.seen && Math.abs(q.x - s.x) < TRACE_NEAR && (!best || Math.abs(q.x - s.x) < Math.abs(best.x - s.x))) best = q;
  if (best) return { kind: 'trace', to: { x: best.x, y: best.y - 70 }, t0: t, done: false };
  const v = Math.hypot(s.vx, s.vy), dir = v > 0.4 ? Math.sign(s.vx) || 1 : R() < 0.5 ? -1 : 1;
  return { kind: 'food', to: { x: s.x + dir * (320 + R() * 140), y: s.y - 30 - R() * 50 }, t0: t, done: false };
}

/** the friend's wished velocity while it shows: toward the spot, but it waits for us when it gets too far ahead */
export function leadGoal(at: Pt, show: Show, s: Pt): Pt {
  const ahead = Math.hypot(at.x - s.x, at.y - s.y), there = Math.hypot(show.to.x - at.x, show.to.y - at.y);
  // it waits, turned back toward us, drifting a little our way
  if (ahead > AHEAD && there > 40) { const dx = s.x - at.x, dy = s.y - at.y, d = ahead || 1; return { x: (dx / d) * 0.25, y: (dy / d) * 0.25 }; }
  // at the spot, it circles it slowly
  const dx = show.to.x - at.x, dy = show.to.y - at.y, d = there || 1, k = 1.7 * Math.min(1, d / 70);
  return { x: (dx / d) * k + (d < 50 ? -dy * 0.01 : 0), y: (dy / d) * k + (d < 50 ? dx * 0.01 : 0) };
}

/** the show is over: we reached the spot (true), or it gave up (also over, not reached) */
export function showOver(show: Show, s: Pt, t: number): { over: boolean; reached: boolean } {
  const reached = Math.hypot(show.to.x - s.x, show.to.y - s.y) < THERE;
  return { over: reached || t - show.t0 > SHOW_FOR, reached };
}

// ----- its light ----- //

/**
 * How bright the friend's light is (0 to 1): three soft flashes when it becomes a friend (or knows us again), then a
 * faint breathing light while it is near us, so that we can tell it among the others; brighter while it shows.
 * `since`: seconds since it became a friend (or greeted us), `d`: its distance to us.
 */
export function friendLight(since: number, d: number, t: number, showing = false): number {
  const flash = since >= 0 && since < 2.4 ? Math.max(0, Math.sin((since / 0.8) * Math.PI)) : 0;
  const near = d < 500 ? 1 - d / 500 : 0, breath = 0.5 + 0.5 * Math.sin(t * 1.3);
  return Math.max(flash, near * (showing ? 0.45 + 0.25 * breath : 0.14 + 0.1 * breath));
}

// ----- the words ----- //

export type FriendText = 'ami' | 'retrouvailles';
const LABELS: [RegExp, FriendText][] = [[/^un ami\b/i, 'ami'], [/^retrouvailles\b/i, 'retrouvailles']];

/** the words of the lineage about its friends: the quotes after « Un ami : » and « Retrouvailles : » in « Les amis qui suivent » */
export function parseFriendTexts(md: string): Partial<Record<FriendText, string[]>> {
  const out: Partial<Record<FriendText, string[]>> = {};
  let inside = false, kind: FriendText | null = null, quote: string[] = [];
  const flush = () => { if (kind && quote.length && !out[kind]) out[kind] = toLines(quote.join(' ')); quote = []; };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (/^#{1,3}\s/.test(line)) { flush(); kind = null; inside = /^#{2,3}\s+les amis qui suivent/i.test(line); continue; }
    if (!inside) continue;
    if (line.startsWith('>')) { if (kind) quote.push(line.replace(/^>\s?/, '')); continue; }
    if (quote.length) { flush(); kind = null; }
    if (!line) continue;
    const l = LABELS.find(([re]) => re.test(line));
    kind = l && /:\s*$/.test(line) ? l[1] : null;
  }
  flush();
  return out;
}

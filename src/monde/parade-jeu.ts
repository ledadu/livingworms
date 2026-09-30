// The parade in the world (parade.ts for its rules): a partner of the chapter notices us when we stay near it, then
// leads the dance; its wake shines, and ours takes its colour when we swim in time with it. At the end a burst of
// light as bright as the parade was good, and the result for the litter (onEnd, last).

import { STEP, rand, type Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import type { Proj, View } from '../engine3/view';
import { SPECIES } from '../content';
import { START_HOLD, START_NEAR, approach, lead, newParade, partsOf, quality, stepParade, type Parade, type Parts, type Pt } from './parade';

/** an animal of the world, as the parade sees it */
export interface Dancer {
  cr: Creature3; kind: string; z: number; hx: number; hy: number;
  /** a compatible species of this chapter index (partenaires.ts): only these dance */
  partner?: number;
}

export interface ParadeResult {
  /** the partner's species id, and its definition (for the fusion) */
  partner: string; spec: Spec;
  chapter: string;
  /** 0..1 */
  quality: number; parts: Parts;
}

interface Deps {
  /** the chapter where the swimmer is */
  chapter(): string;
  /** a point the partner may be led to: in the water, before the obstacles; on the floor for a walker */
  keep(x: number, y: number, floor: boolean): Pt;
  /** while this is true (words on the screen, a panel open), no partner notices us */
  quiet?(): boolean;
}

let ids: Map<string, string> | null = null;
/** the species id of a definition (the actors keep only the definition) */
function idOf(sp: Spec): string {
  if (!ids) { ids = new Map(); for (const id of Object.keys(SPECIES)) ids.set(SPECIES[id]().name, id); }
  return ids.get(sp.name) || '';
}

const hueOf = (sp: Spec) => sp.palette?.hue ?? 45;
/** lights of the wake: x, y, vx, vy, age, life, hue, size */
const MOTE = 8, MAX_MOTES = 220;

export function initParade(deps: Deps) {
  let cur: { a: Dancer; p: Parade; z0: number; id: string; chapter: string; hue: number } | null = null;
  let last: ParadeResult | null = null;
  let hold = 0, noticing: Dancer | null = null, rest = 0, after: Dancer | null = null, tick = 0;
  let goal: Pt = { x: 0, y: 0 };
  const ended: ((r: ParadeResult) => void)[] = [];
  const motes: number[] = [];

  function emit(x: number, y: number, vx: number, vy: number, life: number, hue: number, size: number): void {
    if (motes.length >= MAX_MOTES * MOTE) motes.splice(0, MOTE);
    motes.push(x, y, vx, vy, 0, life, hue, size);
  }

  function start(a: Dancer, player: Creature3): void {
    const r = a.cr.root, pr = player.root, sp = a.cr.spec;
    const pace = Math.min(1.9, Math.max(1.1, sp.swim.speed * 0.9));
    cur = { a, p: newParade({ x: r.x[0], y: r.y[0] }, { x: pr.x[0], y: pr.y[0] }, pace), z0: a.z, id: idOf(sp), chapter: deps.chapter(), hue: hueOf(sp) };
    // it comes into our plane to dance
    a.z = 0;
    hold = 0; noticing = null;
  }

  function finish(): void {
    if (!cur) return;
    const { a, p, z0, id, chapter, hue } = cur, r = a.cr.root, q = quality(p);
    last = { partner: id, spec: a.cr.spec, chapter, quality: q, parts: partsOf(p) };
    // a burst of light, as bright as the parade was good
    for (let i = 0; i < 10 + Math.round(30 * q); i++) {
      const u = rand(0, Math.PI * 2), v = rand(0.4, 1.6);
      emit(r.x[0], r.y[0], Math.cos(u) * v, Math.sin(u) * v - 0.3, rand(1.6, 3), hue, rand(10, 18) * (0.5 + q));
    }
    a.z = z0; a.hx = r.x[0]; a.hy = r.y[0];
    after = a; rest = 8;
    cur = null;
    for (const f of ended) f(last);
  }

  const game = {
    quiet: deps.quiet || (() => false),
    get active() { return !!cur; },
    /** the parade now (tests) */
    get state() { return cur && { partner: cur.id, time: cur.p.time, sync: cur.p.sync, quality: quality(cur.p), parts: partsOf(cur.p) }; },
    /** the last parade danced */
    get last() { return last; },
    /** how far a partner has noticed us (0..1) */
    get noticed() { return Math.min(1, hold / START_HOLD); },
    /** is this animal led by the parade (its goal is `goal`) */
    leads(a: Dancer) { return cur?.a === a; },
    get goal() { return goal; },
    onEnd(f: (r: ParadeResult) => void) { ended.push(f); },
    /** a parade with this animal now (tests) */
    start(a: Dancer, player: Creature3) { if (cur) finish(); start(a, player); },
    /** ends the parade now, as it stands */
    finish,

    /** each step, once the swimmer has moved: the partners notice us, or the parade goes on */
    step(player: Creature3, actors: readonly Dancer[]): void {
      const pr = player.root, px = pr.x[0], py = pr.y[0];
      tick++;
      for (let i = 0; i < motes.length; i += MOTE) {
        motes[i] += motes[i + 2]; motes[i + 1] += motes[i + 3];
        motes[i + 2] *= 0.97; motes[i + 3] = motes[i + 3] * 0.97 - 0.004;
        motes[i + 4] += STEP;
      }
      for (let i = motes.length - MOTE; i >= 0; i -= MOTE) if (motes[i + 4] >= motes[i + 5]) motes.splice(i, MOTE);

      if (cur) {
        const { a, p, hue } = cur, c = a.cr, r = c.root;
        // gone to the other end of the world (the travel of the tests): the parade ends there
        if (Math.abs(r.x[0] - px) > 1500) { finish(); return; }
        const v = stepParade(p, { x: r.x[0], y: r.y[0], vx: c.vx, vy: c.vy }, { x: px, y: py, vx: player.vx, vy: player.vy });
        // lead it only where it may go: the goal is the direction to the kept point
        const g = lead(p), k = deps.keep(g.x, g.y, a.kind === 'floor');
        const dx = k.x - r.x[0], dy = k.y - r.y[0], d = Math.hypot(dx, dy) || 1, s = Math.hypot(v.x, v.y);
        goal = { x: (dx / d) * s, y: (dy / d) * s };
        // its wake shines; ours takes its colour when we dance in time
        if (tick % 3 === 0) emit(r.x[0] + rand(-4, 4), r.y[0] + rand(-4, 4), 0, -0.05, 1.5, hue, 9 + 7 * p.sync);
        if (tick % 3 === 1 && p.sync > 0.35) emit(px + rand(-4, 4), py + rand(-4, 4), 0, -0.05, 1.2 * p.sync, hue, 6 + 8 * p.sync);
        if (p.done) finish();
        return;
      }

      if (rest > 0) rest -= STEP;
      if (after && Math.hypot(after.cr.root.x[0] - px, after.cr.root.y[0] - py) > 500) after = null;
      if (rest > 0 || tick % 6) return;
      if (game.quiet()) { hold = 0; noticing = null; return; }
      // the nearest partner notices us when we stay near it a moment
      let best: Dancer | null = null, bd = Infinity;
      for (const a of actors) {
        if (a.partner === undefined || a === after) continue;
        const r = a.cr.root, dx = r.x[0] - px;
        if (dx > START_NEAR * 2 || dx < -START_NEAR * 2) continue;
        const d = Math.hypot(dx, r.y[0] - py, r.z[0] - pr.z[0]);
        if (d < bd) { bd = d; best = a; }
      }
      if (best !== noticing) { hold = 0; noticing = best; }
      hold = approach(hold, bd, STEP * 6);
      if (noticing && hold > 0 && tick % 12 === 0) {
        const r = noticing.cr.root;
        emit(r.x[0], r.y[0], rand(-0.3, 0.3), rand(-0.5, -0.1), 1.2, hueOf(noticing.cr.spec), 6 + 8 * Math.min(1, hold / START_HOLD));
      }
      if (noticing && hold >= START_HOLD) start(noticing, player);
    },

    /** the lights of the parade, into the lights of the world (x, y on screen, size, hue, alpha) */
    lights(view: View, out: number[], P: Proj): void {
      for (let i = 0; i < motes.length; i += MOTE) {
        const k = motes[i + 4] / motes[i + 5];
        view.project(motes[i], motes[i + 1], 0, P);
        out.push(P.x, P.y, motes[i + 7] * P.s * (1 - 0.4 * k), motes[i + 6], 0.75 * (1 - k) * Math.min(1, motes[i + 4] * 8));
      }
    }
  };
  return game;
}

export type ParadeGame = ReturnType<typeof initParade>;

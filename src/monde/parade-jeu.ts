// The parade in the world (parade.ts for its rules): a partner of the chapter notices us when we stay near it, then
// leads the dance; its wake shines, and ours takes its colours when we swim in time with it. At the end a figure of
// light as rich as the parade was good, and the result for the litter (onEnd, last). The lights of each parade are
// drawn from the genes of the two dancers and a little chance (lueur.ts). The dance happens in a patch of water that
// the dancers stir and that carries their light (parade-eau.ts): the wakes curl, the figure blooms like ink. Swimming
// away from it, we leave the parade: the partner lets us go, and nothing follows.

import { STEP, type Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import type { Proj, View } from '../engine3/view';
import { SPECIES } from '../content';
import { LEAVE_TIME, START_HOLD, START_NEAR, approach, away, lead, newParade, partsOf, quality, stepParade, type Parade, type Parts, type Pt } from './parade';
import { env } from './sprites';
import { Motes, burst, genesOf, lueurOf, notice, wake, type Lueur } from './lueur';
import { initEau } from './parade-eau';
import type { Gfx } from '../engine3/gfx';

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
  /** where its figure of light closed the dance (the eggs are laid there) */
  at: Pt;
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

export function initParade(deps: Deps) {
  let cur: { a: Dancer; p: Parade; z0: number; id: string; chapter: string; light: Lueur; away: number } | null = null;
  /** the light of the last parade (its figures come back rarely), and figures forced for the next one (tests) */
  let light: Lueur | null = null, force: Partial<Lueur> | null = null;
  let last: ParadeResult | null = null;
  let hold = 0, noticing: Dancer | null = null, rest = 0, after: Dancer | null = null, tick = 0;
  let goal: Pt = { x: 0, y: 0 };
  const ended: ((r: ParadeResult) => void)[] = [];
  const motes = new Motes();
  /** the water of the dance: the lights ride on it */
  const eau = initEau();
  const carried = (x: number, y: number) => eau.flow(x, y);
  /** where the swimmer was at the last step */
  let swimmer: Pt | null = null;

  function start(a: Dancer, player: Creature3): void {
    const r = a.cr.root, pr = player.root, sp = a.cr.spec;
    const pace = Math.min(1.9, Math.max(1.1, sp.swim.speed * 0.9));
    light = lueurOf(genesOf(sp, a.cr.list), genesOf(player.spec, player.list), Math.random, light);
    if (force) { light = { ...light, ...force }; force = null; }
    cur = { a, p: newParade({ x: r.x[0], y: r.y[0] }, { x: pr.x[0], y: pr.y[0] }, pace), z0: a.z, id: idOf(sp), chapter: deps.chapter(), light, away: 0 };
    // the water around the figure of eight, calm, and the colours of its light
    eau.place(cur.p.ax, cur.p.ay);
    eau.colours(light.hues[0], light.hues[1] ?? light.hues[0]);
    // it comes into our plane to dance
    a.z = 0;
    hold = 0; noticing = null;
  }

  function finish(): void {
    if (!cur) return;
    const { a, p, z0, id, chapter } = cur, r = a.cr.root, q = quality(p);
    // a figure of light between the two dancers, as rich as the parade was good
    const us = swimmer && Math.hypot(swimmer.x - r.x[0], swimmer.y - r.y[0]) < 300 ? swimmer : { x: r.x[0], y: r.y[0] };
    const at = { x: (r.x[0] + us.x) / 2, y: (r.y[0] + us.y) / 2 };
    last = { partner: id, spec: a.cr.spec, chapter, at, quality: q, parts: partsOf(p) };
    burst(motes, cur.light, at, q);
    eau.figure(cur.light, at, q);
    a.z = z0; a.hx = r.x[0]; a.hy = r.y[0];
    after = a; rest = 8;
    cur = null;
    for (const f of ended) f(last);
  }

  /** we swam away: the partner goes back to its life, with a few lights, and no eggs */
  function leave(): void {
    if (!cur) return;
    const { a, z0, light: l } = cur, r = a.cr.root;
    for (let i = 0; i < 4; i++) notice(motes, { x: r.x[0], y: r.y[0] }, l.hues[0], 0.3);
    a.z = z0; a.hx = r.x[0]; a.hy = r.y[0];
    after = a; rest = 4;
    cur = null;
  }

  const game = {
    quiet: deps.quiet || (() => false),
    get active() { return !!cur; },
    /** the parade now (tests) */
    get state() { return cur && { partner: cur.id, time: cur.p.time, sync: cur.p.sync, quality: quality(cur.p), parts: partsOf(cur.p) }; },
    /** the last parade danced */
    get last() { return last; },
    /** the light of the parade now, or of the last one */
    get light() { return cur?.light ?? light; },
    /** the water of the dance (tests, and the eggs laid in it) */
    water: eau,
    /** figures forced for the next parade (tests, captures): { wake, burst, echo, hues… } */
    forceLight(o: Partial<Lueur> | null) { force = o; },
    /** how far a partner has noticed us (0..1) */
    get noticed() { return Math.min(1, hold / START_HOLD); },
    /** is this animal led by the parade (its goal is `goal`) */
    leads(a: Dancer) { return cur?.a === a; },
    /** is this animal dancing, or has it just danced with us: the lights of the parade speak for it */
    danced(a: Dancer) { return cur?.a === a || after === a; },
    get goal() { return goal; },
    onEnd(f: (r: ParadeResult) => void) { ended.push(f); },
    /** a parade with this animal now (tests) */
    start(a: Dancer, player: Creature3) { if (cur) finish(); start(a, player); },
    /** ends the parade now, as it stands */
    finish,
    /** leaves the parade now, as swimming away does */
    leave,

    /** each step, once the swimmer has moved: the partners notice us, or the parade goes on */
    step(player: Creature3, actors: readonly Dancer[]): void {
      const pr = player.root, px = pr.x[0], py = pr.y[0];
      tick++;
      swimmer = { x: px, y: py };
      motes.step(STEP, carried);

      if (cur) {
        const { a, p } = cur, c = a.cr, r = c.root;
        // gone to the other end of the world (the travel of the tests), or swum away a while: we have left
        cur.away = away(cur.away, Math.hypot(r.x[0] - px, r.y[0] - py));
        if (Math.abs(r.x[0] - px) > 1500 || cur.away >= LEAVE_TIME) { leave(); return; }
        const v = stepParade(p, { x: r.x[0], y: r.y[0], vx: c.vx, vy: c.vy }, { x: px, y: py, vx: player.vx, vy: player.vy });
        // lead it only where it may go: the goal is the direction to the kept point
        const g = lead(p), k = deps.keep(g.x, g.y, a.kind === 'floor');
        const dx = k.x - r.x[0], dy = k.y - r.y[0], d = Math.hypot(dx, dy) || 1, s = Math.hypot(v.x, v.y);
        goal = { x: (dx / d) * s, y: (dy / d) * s };
        // its wake shines; ours takes its colours when we dance in time
        wake(motes, cur.light, tick, { x: r.x[0], y: r.y[0] }, swimmer, p.sync);
        // both stir the water: its light is theirs, and ours joins it in time
        eau.dancer(c, 1, 0);
        eau.dancer(player, 0.3 + 0.7 * p.sync, 1 - 0.5 * p.sync);
        eau.step();
        if (p.done) finish();
        return;
      }
      // after the dance, the two still move the water they swim in, without lighting it
      if (eau.fluid.awake) {
        if (after) eau.dancer(after.cr, 0, 0);
        eau.dancer(player, 0, 1);
      }
      eau.step();

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
        notice(motes, { x: r.x[0], y: r.y[0] }, hueOf(noticing.cr.spec), Math.min(1, hold / START_HOLD));
      }
      if (noticing && hold >= START_HOLD) start(noticing, player);
    },

    /** the light in the water of the dance, drawn after the dark, before the other lights */
    ink(gx: Gfx | null, ctx: CanvasRenderingContext2D, view: View, dpr: number): void {
      eau.draw(gx, ctx, view, dpr, env.water);
    },

    /** the lights of the parade, into the lights of the world (x, y on screen, size, hue, alpha) */
    lights(view: View, out: number[], P: Proj): void {
      // clear bright water swallows an added light: they shine a little more there
      motes.each((x, y, size, hue, al) => {
        view.project(x, y, 0, P);
        out.push(P.x, P.y, size * P.s, hue, al);
      }, 1 + 0.5 * env.water);
    }
  };
  return game;
}

export type ParadeGame = ReturnType<typeof initParade>;

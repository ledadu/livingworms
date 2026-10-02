// The parade in the world (parade.ts for its rules): a partner of the chapter notices us when we stay near it, then
// leads the dance; its wake shines, and ours takes its colours when we swim in time with it. Once we have danced a
// while, « S'accoupler » shows above it (accoupler.ts): when we choose, the two dance on their own for a few seconds
// (danse.ts), its real dances played on both bodies (danse-jeu.ts), then a figure of light as rich as the parade was
// good, and the result for the litter (onEnd, last).
// The lights of each parade are drawn from the genes of the two dancers and a little chance (lueur.ts). The dance
// happens in a patch of water that the dancers stir and that carries their light (parade-eau.ts): the wakes curl,
// the figure blooms like ink. Swimming away before we mate, we leave the parade: the partner lets us go.

import { STEP, type Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import type { Proj, View } from '../engine3/view';
import { SPECIES } from '../content';
import { LEAVE_TIME, READY_NEAR, START_HOLD, START_NEAR, approach, away, lead, newParade, partsOf, quality, ready, stepParade, type Parade, type Parts, type Pt } from './parade';
import { danceAt, facing, figuresOf, newDanse, over, signature, stepAt, styleOf, wished, type Danse } from './danse';
import { faceTo, type DanseGame } from './danse-jeu';
import type { DanceId } from '../engine3/dance';
import { initAccoupler } from './accoupler';
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
  /** the dances, played on the two bodies during the dance for two, on the beat of the chapter */
  danse?: DanseGame;
}

/** the length of a body, for the room of the dance */
const sizeOf = (cr: Creature3) => Math.max(cr.box[3] - cr.box[0], cr.box[4] - cr.box[1]);

let ids: Map<string, string> | null = null;
/** the species id of a definition (the actors keep only the definition) */
function idOf(sp: Spec): string {
  if (!ids) { ids = new Map(); for (const id of Object.keys(SPECIES)) ids.set(SPECIES[id]().name, id); }
  return ids.get(sp.name) || '';
}

const hueOf = (sp: Spec) => sp.palette?.hue ?? 45;

export function initParade(deps: Deps) {
  let cur: {
    a: Dancer; p: Parade; z0: number; id: string; chapter: string; light: Lueur; away: number;
    /** we were ready to mate (its call was given) */
    called: boolean;
    /** the dance for two, once we chose to mate, its time (s), and where the swimmer is led */
    danse: Danse | null; t: number; lead: Pt | null;
    /** the figure whose steps the two are dancing (its start, s) */
    show: number;
  } | null = null;
  /** the dance for two before (never the same twice in a row), and real dances forced for the next one (tests) */
  let lastDanse: string | null = null, forceDances: DanceId[] | null = null;
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
    cur = { a, p: newParade({ x: r.x[0], y: r.y[0] }, { x: pr.x[0], y: pr.y[0] }, pace), z0: a.z, id: idOf(sp), chapter: deps.chapter(), light, away: 0, called: false, danse: null, t: 0, lead: null, show: -1 };
    // the water around the figure of eight, calm, and the colours of its light
    eau.place(cur.p.ax, cur.p.ay);
    eau.colours(light.hues[0], light.hues[1] ?? light.hues[0]);
    // it comes into our plane to dance
    a.z = 0;
    hold = 0; noticing = null;
  }

  /** we may mate now: ready, near it, and nothing else on the screen */
  function canMate(): boolean {
    if (!cur || cur.danse || !swimmer || game.quiet()) return false;
    const r = cur.a.cr.root;
    return ready(cur.p) && Math.hypot(r.x[0] - swimmer.x, r.y[0] - swimmer.y) < READY_NEAR;
  }

  /** the mating: the quality of the parade is fixed, and the two dance on their own */
  function mate(player: Creature3): void {
    if (!cur || cur.danse) return;
    const { a } = cur, r = a.cr.root, pr = player.root;
    cur.p.done = true;
    cur.danse = newDanse({ x: r.x[0], y: r.y[0] }, { x: pr.x[0], y: pr.y[0] },
      [styleOf(a.cr.spec.swim.mode, a.kind === 'floor'), styleOf(player.spec.swim.mode, false)], (sizeOf(a.cr) + sizeOf(player)) / 2,
      Math.random, { beat: deps.danse?.beatAt(r.x[0]), last: lastDanse, dances: forceDances ?? undefined });
    lastDanse = signature(cur.danse);
    forceDances = null;
    cur.t = 0; cur.show = -1;
    button.place(null);
  }

  function finish(): void {
    if (!cur) return;
    const { a, p, z0, id, chapter } = cur, r = a.cr.root, q = quality(p);
    // a figure of light between the two dancers, as rich as the parade was good
    const us = swimmer && Math.hypot(swimmer.x - r.x[0], swimmer.y - r.y[0]) < 300 ? swimmer : { x: r.x[0], y: r.y[0] };
    const at = { x: (r.x[0] + us.x) / 2, y: (r.y[0] + us.y) / 2 };
    button.place(null);
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
    button.place(null);
    a.z = z0; a.hx = r.x[0]; a.hy = r.y[0];
    after = a; rest = 4;
    cur = null;
  }

  let player: Creature3 | null = null;
  /** the camera's distance while it comes close on the dance for two, and back (0: the player's own) */
  let camDist = 0;
  const button = initAccoupler(() => { if (player && canMate()) mate(player); });

  const game = {
    quiet: deps.quiet || (() => false),
    get active() { return !!cur; },
    /** the parade now (tests); dance: the figures of the dance for two once we chose to mate */
    get state() {
      return cur && {
        partner: cur.id, time: cur.p.time, sync: cur.p.sync, quality: quality(cur.p), parts: partsOf(cur.p),
        ready: ready(cur.p), canMate: canMate(), dance: cur.danse && { time: cur.t, length: cur.danse.time, figures: figuresOf(cur.danse), beat: cur.danse.beat, dancing: danceAt(cur.danse, cur.t)?.id ?? null }
      };
    },
    /** we are dancing for two: the swimmer is not ours */
    get dancing() { return !!cur?.danse; },
    /** mates now, as the button does (force: even before we are ready; tests) */
    mate(force = false): boolean {
      if (!player || !cur || cur.danse || (!force && !canMate())) return false;
      mate(player);
      return true;
    },
    /** each step: the swimmer's wished velocity while the dance for two leads it, else null */
    lead(): Pt | null { return cur?.lead ?? null; },
    /** the last parade danced */
    get last() { return last; },
    /** the light of the parade now, or of the last one */
    get light() { return cur?.light ?? light; },
    /** the water of the dance (tests, and the eggs laid in it) */
    water: eau,
    /** figures forced for the next parade (tests, captures): { wake, burst, echo, hues… } */
    forceLight(o: Partial<Lueur> | null) { force = o; },
    /** the real dances of the next dance for two, in order (tests, captures) */
    forceDances(ids: DanceId[] | null) { forceDances = ids; },
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
    /** ends the parade now, as it stands, without the dance for two */
    finish,
    /** leaves the parade now, as swimming away does */
    leave,

    /** each step, once the swimmer has moved: the partners notice us, or the parade goes on */
    step(p0: Creature3, actors: readonly Dancer[]): void {
      const pr = p0.root, px = pr.x[0], py = pr.y[0];
      player = p0;
      tick++;
      swimmer = { x: px, y: py };
      motes.step(STEP, carried);

      if (cur?.danse) {
        // the dance for two: both are led, both trails shine, and the water is lit by both
        const { a, danse } = cur, c = a.cr, r = c.root, floor = a.kind === 'floor', walks = danse.styles[1] === 'walk';
        cur.t += STEP;
        if (over(danse, cur.t)) { cur.lead = null; finish(); return; }
        // a real dance: its steps on both bodies, the partner leading, we answer; face to face, the greeting
        const st = stepAt(danse, cur.t), id = st.dance ?? (st.fig === 'face' ? 'salut' : null);
        if (deps.danse && id && cur.show !== st.t0) {
          cur.show = st.t0;
          deps.danse.play(c, id, { role: 0, beat: danse.beat, ago: cur.t - st.t0, hold: false });
          deps.danse.play(p0, id, { role: 1, beat: danse.beat, ago: cur.t - st.t0, hold: false, sound: false });
        }
        const f = facing(danse, cur.t);
        if (f) { faceTo(c, f.a); faceTo(p0, f.b); }
        // led by where they swim, not by where the steps move them
        const v = wished(danse, cur.t, { x: r.x[0] - c.gx, y: r.y[0] - c.gy }, { x: px - p0.gx, y: py - p0.gy }, (q, who) => deps.keep(q.x, q.y, who ? walks : floor));
        goal = v.a; cur.lead = v.b;
        wake(motes, cur.light, tick, { x: r.x[0], y: r.y[0] }, swimmer, 1);
        eau.dancer(c, 1, 0);
        eau.dancer(p0, 1, 0.5);
        eau.step();
        return;
      }
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
        eau.dancer(p0, 0.3 + 0.7 * p.sync, 1 - 0.5 * p.sync);
        eau.step();
        // ready to mate: it calls once, and the button shows (ui)
        if (!cur.called && ready(p)) {
          cur.called = true;
          for (let i = 0; i < 3; i++) notice(motes, { x: r.x[0], y: r.y[0] }, hueOf(c.spec), 1);
        }
        return;
      }
      // after the dance, the two still move the water they swim in, without lighting it
      if (eau.fluid.awake) {
        if (after) eau.dancer(after.cr, 0, 0);
        eau.dancer(p0, 0, 1);
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
      if (noticing && hold >= START_HOLD) start(noticing, p0);
    },

    /** each frame, during the dance for two and just after: the camera comes closer on the two, then goes back to
     * the player's own distance; else null */
    camera(own: number, W: number, H: number): { focus: Pt | null; dist: number } | null {
      const d = cur?.danse;
      if (!d || !player) {
        if (!camDist || Math.abs(camDist - own) < 2) { camDist = 0; return null; }
        camDist += (own - camDist) * 0.025;
        return { focus: null, dist: camDist };
      }
      if (!camDist) camDist = own;
      const r = cur!.a.cr.root, pr = player.root, gap = Math.hypot(r.x[0] - pr.x[0], r.y[0] - pr.y[0]);
      // the water seen across the narrower side, per unit of distance (as the farewell does)
      const across = (W < H ? 0.975 * W : 0.81 * H) / Math.max(1, H), span = gap + d.r * 2 + 140;
      const close = Math.min(1, cur!.t / 1.2, Math.max(0, (d.time - cur!.t) / 1.2) + 0.4);
      camDist += (own + (Math.min(own, span / across) - own) * close - camDist) * 0.025;
      return { focus: { x: (r.x[0] + pr.x[0]) / 2, y: (r.y[0] + pr.y[0]) / 2 }, dist: camDist };
    },

    /** each frame: « S'accoupler » above the partner while we may mate */
    ui(view: View, P: Proj): void {
      if (!cur || !canMate()) { button.place(null); return; }
      const c = cur.a.cr;
      view.project(c.root.x[0], c.box[1] - 14, c.root.z[0], P);
      button.place({ x: P.x, y: P.y });
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

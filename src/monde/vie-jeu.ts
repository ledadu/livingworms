// The life of the animals in the world (vie.ts for its scenes): around the swimmer, now and then, a free animal
// starts a scene, alone or with others near it, and every so often food falls and gathers whoever is there. A
// scene hooks into the bodies of its animals: the way they steer (main.ts steers them with the goal given here),
// the heading they turn to, the plane they keep in depth, the tempo of their body (each animal keeps its own lag
// on the clock of the sea), their colours (repainted brighter or paler, in a few steps), a walker that swims a
// moment; and it leaves puffs of sand and bits of food in the water (vie-draw.ts).

import { STEP, clamp, rng, type PaletteSlot } from '../engine';
import { swimFactor3, type Creature3 } from '../engine3/creature3';
import type { HSL } from './palette';
import { Dust, drawFood, drawPuff, type VieScene } from './vie-draw';
import { GESTES, choose, newAct, over, steerOf, stepFood, type Act, type Being, type Gait, type GesteId, type Goal, type Swimmer, type World } from './vie';

/** an animal of the world, as the life sees it (main.ts: Actor) */
export interface Animal {
  cr: Creature3; kind: string; z: number; hx: number;
  /** its own lag on the clock of the sea: the tempo of its body (main.ts steers it at t + lag) */
  lag?: number;
}

export interface VieDeps {
  floor(x: number, z: number): number;
  /** an animal taken by something else (the parade leads it): it leaves its scene */
  held(a: Animal): boolean;
  /** the swimmer is in a scene of its own (a parade, a farewell): nobody comes to look at it, no food falls */
  busy(): boolean;
  /** the colour of the sand at x */
  sand(x: number): HSL;
}

/** scenes start this near the swimmer (px along x); one with an animal further than FAR ends (they are not simulated there) */
const NEAR = 1000, FAR = 1300;
/** at most this many scenes at once, and this many animals looking at the swimmer */
const MAX_ACTS = 10, LOOKERS = 2;
/** the chance, each half second, that a free animal starts something */
const START_P = 0.16;
/** a pause between two scenes of an animal (s) */
const REST: [number, number] = [4, 10];
/** food falls this often (s), the first time a little after we arrive */
const FEAST: [number, number] = [40, 70], FIRST_FEAST = 18;

interface Role { act: Act; i: number; z0: number; tempo: number; dress: number; swam: boolean; goal: Goal | null }
interface Scene { act: Act; who: Animal[] }

const gaitOf = (cr: Creature3): Gait => (cr.mode === 'bell' || cr.mode === 'jet' || cr.mode === 'crawl' ? cr.mode : 'glide');

/** the colours a little brighter and richer (k > 0), or paler and duller (k < 0) */
function dressed(pal: PaletteSlot[], k: number): PaletteSlot[] {
  return pal.map((s) => ({ h: s.h, s: clamp(s.s + (k > 0 ? 18 : 24) * k, 0, 100), l: clamp(s.l + (k > 0 ? 6 : 9) * k, 3, 97) }));
}
function repaint(cr: Creature3, k: number): void {
  const pal = k ? dressed(cr.pal, k) : cr.pal;
  for (const s of cr.list) s.paint(pal);
}

export function initVie(d: VieDeps) {
  const R = Math.random;
  const world: World = { floor: d.floor };
  const beings = new WeakMap<Animal, Being>();
  const roles = new Map<Animal, Role>();
  const restUntil = new WeakMap<Animal, number>();
  /** animals out of their scene whose colours come back, step by step */
  const fading = new Map<Animal, number>();
  const scenes: Scene[] = [];
  const dust = new Dust(160);
  const seen: Partial<Record<GesteId, number>> = {};
  let on = true, now = 0, tick = 0, quietUntil = 0, nextFeast = FIRST_FEAST;
  let swimmer: Swimmer | null = null;
  const H = { x: 0, y: 0, z: 0 };

  /** the animal as the scenes see it, refreshed in place */
  function being(a: Animal): Being {
    const cr = a.cr, r = cr.root;
    let b = beings.get(a);
    if (!b) {
      const len = Math.max(cr.box[3] - cr.box[0], cr.box[4] - cr.box[1]);
      b = {
        x: 0, y: 0, z: 0, vx: 0, vy: 0, hx: 1, hy: 0, floor: 0, len: clamp(len, 12, 200), speed: cr.spec.swim.speed, gait: 'glide',
        ai: cr.spec.ai, legs: cr.list.some((s) => s.def.drive === 'walk'), sp: cr.spec.name, home: a.hx, plane: a.z
      };
      beings.set(a, b);
    }
    b.x = r.x[0]; b.y = r.y[0]; b.z = r.z[0]; b.vx = cr.vx; b.vy = cr.vy;
    cr.heading(H);
    const hl = Math.hypot(H.x, H.y);
    if (hl > 0.25) { b.hx = H.x / hl; b.hy = H.y / hl; } else { b.hx = Math.cos(cr.yaw) < 0 ? -1 : 1; b.hy = 0; }
    b.floor = d.floor(b.x, b.z);
    b.gait = gaitOf(cr);
    b.home = a.hx;
    b.plane = roles.get(a)?.z0 ?? a.z;
    return b;
  }

  /** a scene starts: its animals in the order of its roles (act.who) */
  function start(act: Act, of: Map<Being, Animal>): void {
    const who = act.who.map((b) => of.get(b)!);
    scenes.push({ act, who });
    who.forEach((a, i) => { roles.set(a, { act, i, z0: a.z, tempo: 1, dress: fading.get(a) ?? 0, swam: false, goal: null }); fading.delete(a); });
    seen[act.id] = (seen[act.id] || 0) + 1;
  }

  /** the scene ends: its animals get back their plane, their colours and their gait, and rest a while */
  function end(s: Scene): void {
    for (const a of s.who) {
      const ro = roles.get(a);
      if (!ro || ro.act !== s.act) continue;
      a.z = ro.z0;
      if (ro.dress) fading.set(a, ro.dress);
      if (ro.swam) a.cr.mode = a.cr.spec.swim.mode;
      roles.delete(a);
      restUntil.set(a, now + REST[0] + R() * (REST[1] - REST[0]));
    }
    scenes.splice(scenes.indexOf(s), 1);
  }

  /** a third of the way from these colours toward `to` */
  const toward = (k: number, to: number) => clamp(Math.round((k + Math.sign(to - k) / 3) * 3) / 3, -1, 1);

  /** how a goal hooks into the animal: heading, plane, tempo, colours, gait, and the sand it stirs */
  function apply(a: Animal, ro: Role, g: Goal, b: Being): void {
    const cr = a.cr;
    if (g.yaw !== undefined) {
      cr.yawGoal = g.yaw;
      // it stays at its depth while it turns (a walker would turn to its plane otherwise)
      if (g.z === undefined) g.z = b.z;
    }
    a.z = g.z ?? ro.z0;
    ro.tempo += (g.tempo - ro.tempo) * 0.04;
    a.lag = (a.lag ?? 0) + (ro.tempo - 1) * STEP;
    // the colours change in three steps, one every fifth of a second
    if (ro.dress !== g.dress && tick % 12 === 0) repaint(cr, (ro.dress = toward(ro.dress, g.dress)));
    if (g.swim && cr.mode === 'crawl') { cr.mode = 'steady'; ro.swam = true; }
    else if (!g.swim && ro.swam) { cr.mode = cr.spec.swim.mode; ro.swam = false; }
    // the cloud rises a little in front of the mouth (toward the eye), where the body does not hide it
    if (g.puff) dust.emit(b.x + b.hx * 4, d.floor(b.x, b.z), b.z - 14, d.sand(b.x), b.gait === 'crawl' ? 3 : 5);
    // a swimmer keeps the rhythm of its kind (darts, pulses)
    if (b.gait === 'glide') { const f = swimFactor3(cr, now + (a.lag ?? 0)); g.x *= f; g.y *= f; }
    ro.goal = g;
  }

  /** the free animals near the swimmer that may start a scene now */
  function freeNear(near: Animal[]): Animal[] {
    return near.filter((a) => !roles.has(a) && (restUntil.get(a) ?? 0) <= now);
  }

  function startSome(near: Animal[]): void {
    const free = freeNear(near), fb = free.map(being);
    for (let k = free.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [free[k], free[j]] = [free[j], free[k]]; [fb[k], fb[j]] = [fb[j], fb[k]]; }
    const taken = new Set<Being>();
    for (let k = 0; k < free.length && scenes.length < MAX_ACTS; k++) {
      const me = fb[k];
      if (taken.has(me) || R() > START_P || Math.abs(me.x - (swimmer?.x ?? me.x)) > NEAR) continue;
      const look = !d.busy() && scenes.filter((s) => s.act.id === 'curieux').length < LOOKERS;
      const c = choose(me, fb.filter((o) => !taken.has(o)), R, swimmer, look);
      if (!c) continue;
      for (const o of c.who) taken.add(o);
      start(newAct(c.id, c.who, now, R, world, swimmer), new Map(c.who.map((o) => [o, free[fb.indexOf(o)]])));
    }
  }

  /** food falls a little ahead of the swimmer, for those near enough to come (false: not enough of them) */
  function feast(near: Animal[], sw: Swimmer): boolean {
    const side = R() < 0.5 ? -1 : 1, x = sw.x + side * (140 + R() * 160);
    const free = freeNear(near).filter((a) => GESTES.festin.fits(being(a)) && Math.abs(a.cr.root.x[0] - x) < 650 && Math.abs(a.z) <= 160)
      .sort((p, q) => Math.abs(p.cr.root.x[0] - x) - Math.abs(q.cr.root.x[0] - x)).slice(0, GESTES.festin.n[1]);
    if (free.length < GESTES.festin.n[0]) return false;
    const bs = free.map(being);
    start(newAct('festin', bs, now, R, world, sw, { x, y: Math.max(40, sw.y - 260) }), new Map(bs.map((b, i) => [b, free[i]])));
    return true;
  }

  const game = {
    /** the life goes on (false: the animals only wander, as before; to compare) */
    get on() { return on; },
    set on(v: boolean) { on = v; if (!v) while (scenes.length) end(scenes[0]); },
    /** the scenes now (tests): what, who, at which stage */
    get acts() { return scenes.map((s) => ({ id: s.act.id, who: s.who.map((a) => a.cr.spec.name), stage: s.act.stage, left: +(s.act.end - now).toFixed(1) })); },
    /** how many scenes of each kind have started since the page opened */
    get seen() { return { ...seen }; },
    /** how many puffs of sand are in the water (tests) */
    get puffs() { let n = 0; for (let i = 0; i < dust.n; i++) if (dust.life[i] > 0) n++; return n; },
    /** the puffs themselves (tests: one may be emitted by hand) */
    dust,
    /** the scene this animal is in */
    actOf(a: Animal): GesteId | null { return roles.get(a)?.act.id ?? null; },

    /** each step, before the animals are steered */
    step(t: number, player: Creature3, actors: readonly Animal[]): void {
      now = t; tick++;
      const pr = player.root;
      swimmer = { x: pr.x[0], y: pr.y[0], vx: player.vx, vy: player.vy, len: Math.max(20, player.box[3] - player.box[0]) };
      dust.step();
      if (tick % 12 === 0) for (const [a, k] of fading) { const n = toward(k, 0); repaint(a.cr, n); if (n) fading.set(a, n); else fading.delete(a); }
      if (!on) return;
      const near = actors.filter((a) => (a.kind === 'swim' || a.kind === 'floor') && Math.abs(a.cr.root.x[0] - pr.x[0]) < FAR);
      for (let k = scenes.length - 1; k >= 0; k--) {
        const s = scenes[k];
        if (s.who.some((a) => d.held(a) || (a.kind !== 'swim' && a.kind !== 'floor') || Math.abs(a.cr.root.x[0] - pr.x[0]) > FAR)) { end(s); continue; }
        s.who.forEach(being);
        if (over(s.act, t, swimmer)) { end(s); continue; }
        if (s.act.food.length) stepFood(s.act.food, world, t);
        s.who.forEach((a, i) => { const ro = roles.get(a)!; apply(a, ro, steerOf(s.act, i, t, R, world, swimmer), s.act.who[i]); });
      }
      if (t < quietUntil || tick % 30) return;
      startSome(near);
      if (t > nextFeast && !d.busy()) nextFeast = t + (feast(near, swimmer) ? FEAST[0] + R() * (FEAST[1] - FEAST[0]) : 6);
    },

    /** where main.ts steers this animal this step, or null: it wanders as before */
    goal(a: Animal): Goal | null { return (on && roles.get(a)?.goal) || null; },

    /** every scene ends, and none starts for a while: the sea listens (the song) */
    hush(): void { while (scenes.length) end(scenes[0]); quietUntil = now + 10; },

    /** this scene now with these animals, in their roles (tests, captures): false if they cannot */
    start(id: GesteId, who: Animal[]): boolean {
      if (!who.length || who.some((a) => roles.has(a))) return false;
      const bs = who.map(being);
      start(newAct(id, bs, now, rng(Math.floor(now * 1000) + 7), world, swimmer, swimmer && id === 'festin' ? { x: swimmer.x, y: Math.max(40, swimmer.y - 200) } : undefined), new Map(bs.map((b, i) => [b, who[i]])));
      return true;
    },
    /** food falls now near the swimmer, for the animals around (tests, captures) */
    feast(actors: readonly Animal[]): boolean {
      if (!swimmer) return false;
      return feast(actors.filter((a) => a.kind === 'swim' || a.kind === 'floor'), swimmer);
    },

    /** the puffs of sand and the food, into the scene's items at their depth */
    items(s: VieScene, camX: number, push: (d: number, fn: () => void) => void): void {
      for (let i = 0; i < dust.n; i++) {
        if (dust.life[i] <= 0 || Math.abs(dust.x[i] - camX) > 1400) continue;
        push(s.view.depth(dust.y[i], dust.z[i]) - 0.3, () => drawPuff(s, dust, i));
      }
      for (const sc of scenes) {
        const food = sc.act.food;
        let n = 0, y = 0, z = 0;
        for (const f of food) if (!f.eaten) { n++; y += f.y; z += f.z; }
        if (n) push(s.view.depth(y / n, z / n) - 0.25, () => drawFood(s, food));
      }
    }
  };
  return game;
}

export type Vie = ReturnType<typeof initVie>;

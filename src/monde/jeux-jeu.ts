// The little games of the animals in the world (jeux.ts for their rules): now and then, when the swimmer is free,
// an animal near it starts a game with it: a fish plays tag, a shoal takes it in, an octopus hides. The game holds
// its animals (the life of vie-jeu.ts lets them go) and hooks into their bodies like a scene of the life: the way
// they steer, their plane in depth, the tempo of their body, their colours (brighter at play, the colour of the sand
// for a hider). What shows: sparks at a touch, a little ink, the bubbles of a hint, and the gift at the end: a glow
// that stays on us a moment, the food of the hidden corner, a pearl on the sand.

import { STEP, TAU, clamp, type PaletteSlot } from '../engine';
import { swimFactor3, type Creature3 } from '../engine3/creature3';
import { disc } from '../engine3/paint-gl';
import type { Proj } from '../engine3/view';
import { JEUX, PLANE, chooseJeu, goalOf, newJeu, stepJeu, type Gift, type Jeu, type JeuEvent, type JeuId, type JeuWorld } from './jeux';
import type { HSL } from './palette';
import { fogOf } from './sprites';
import type { Being, Gait, Pt, Swimmer } from './vie';
import { Dust, drawFood, drawPuff, type VieScene } from './vie-draw';
import type { Animal } from './vie-jeu';

export interface JeuxDeps extends Omit<JeuWorld, 'floor'> {
  floor(x: number, z: number): number;
  /** an animal free to play: no parade leads it, it is in no scene of the life */
  free(a: Animal): boolean;
  /** the swimmer is taken by something else (a parade, a farewell, a brood, the Remontée): no game */
  busy(): boolean;
  /** a partner of the chapter is noticing the swimmer: no game is offered then (the parade comes first) */
  courting(): boolean;
  /** the colour of the sand at x */
  sand(x: number): HSL;
  /** a few words of the lineage, under this name (false: not now) */
  say(name: string, lines: string[]): boolean;
  sound(k: 'tinkles' | 'bubbles'): void;
}

export interface JeuxScene extends VieScene { lights: number[] }

/** the first game a little after we arrive; then a pause between two games (s) */
const FIRST = 25, GAP: [number, number] = [70, 130];
/** the chance, each second, that the animals near a free swimmer offer a game */
const OFFER_P = 0.35;
/** a glow given stays on the swimmer this long (s); a pearl not taken waits this long on the sand (s) */
const GLOW = 6, PEARL = 90;

/** what the lineage says the first time each game ends with its gift */
const WORDS: Record<JeuId, string[]> = {
  chat: ['Il nous touche, il file, nous le rattrapons.', 'Un jeu, pour rien : il nous laisse un peu de sa lueur.'],
  banc: ['Nous avons nagé à leur rythme : ils nous ont pris parmi eux.', 'Leur coin caché avait de quoi nous nourrir tous.'],
  cache: ['Il avait la couleur du sable.', 'Pour l’avoir trouvé, il nous laisse une perle.']
};

const gaitOf = (cr: Creature3): Gait => (cr.mode === 'bell' || cr.mode === 'jet' || cr.mode === 'crawl' ? cr.mode : 'glide');

/** the colours brighter (k > 0) or paler (k < 0), then toward the sand by c (0 to 1) */
function painted(pal: PaletteSlot[], k: number, c: number, sand: HSL): PaletteSlot[] {
  return pal.map((p) => {
    const s = clamp(p.s + (k > 0 ? 18 : 24) * k, 0, 100), l = clamp(p.l + (k > 0 ? 6 : 9) * k, 3, 97);
    const dh = ((sand.h - p.h + 540) % 360) - 180;
    return { h: (p.h + dh * c + 360) % 360, s: s + (sand.s * 0.7 - s) * c, l: l + (sand.l * 0.9 - l) * c };
  });
}

/** sparks of light in the water: a touch, a catch, a gift */
class Sparks {
  n = 0;
  readonly x: Float32Array; readonly y: Float32Array; readonly z: Float32Array; readonly vx: Float32Array; readonly vy: Float32Array;
  readonly life: Float32Array; readonly hue: Float32Array; readonly size: Float32Array;
  private k = 0;
  constructor(readonly max: number) {
    this.x = new Float32Array(max); this.y = new Float32Array(max); this.z = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max); this.life = new Float32Array(max);
    this.hue = new Float32Array(max); this.size = new Float32Array(max);
  }
  /** n sparks from (x, y, z), out in a ring at `speed`, rising a little (`rise`) */
  burst(x: number, y: number, z: number, n: number, hue: number, speed: number, size = 7, rise = 0.15): void {
    for (let j = 0; j < n; j++) {
      const i = this.k++ % this.max, a = (j / n) * TAU + Math.random() * 0.6, v = speed * (0.6 + Math.random() * 0.6);
      this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = Math.cos(a) * v; this.vy[i] = Math.sin(a) * v * 0.7 - rise;
      this.life[i] = 1; this.hue[i] = hue; this.size[i] = size * (0.7 + Math.random() * 0.6);
      this.n = Math.min(this.max, this.n + 1);
    }
  }
  step(): void {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= STEP / 1.6;
      this.x[i] += this.vx[i]; this.y[i] += this.vy[i];
      this.vx[i] *= 0.95; this.vy[i] = this.vy[i] * 0.95 - 0.006;
    }
  }
}

interface Pearl { x: number; y: number; t0: number; hue: number; name: string; id: JeuId }
interface Paint { k: number; c: number }

export function initJeux(d: JeuxDeps) {
  const R = Math.random;
  const world: JeuWorld = { floor: d.floor, keep: d.keep, nook: d.nook };
  let on = true, now = 0, tick = 0, nextGame = FIRST;
  let cur: { jeu: Jeu; who: Animal[]; z0: number[]; tempo: number[]; paint: Paint[] } | null = null;
  const goals = new WeakMap<Animal, { x: number; y: number; accel: number }>();
  const beings = new WeakMap<Animal, Being>();
  /** animals out of their game whose colours come back, step by step */
  const fading = new Map<Animal, Paint>();
  const sparks = new Sparks(200);
  /** the ink of a hider, the sand it stirs as a hint */
  const clouds = new Dust(60);
  const told = new Set<JeuId>();
  const seen: Partial<Record<JeuId, number>> = {}, gifts: Partial<Record<Gift, number>> = {};
  let glow = { t0: -99, hue: 0 }, pearl: Pearl | null = null;
  let swimmer: Swimmer = { x: 0, y: 0, vx: 0, vy: 0, len: 40 };
  const played: ((cr: Creature3, gift: Gift | null) => void)[] = [];
  const H = { x: 0, y: 0, z: 0 };

  /** the animal as the games see it, refreshed in place */
  function being(a: Animal, z0 = a.z): Being {
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
    b.plane = z0;
    return b;
  }

  function repaint(a: Animal, p: Paint): void {
    const pal = p.k || p.c ? painted(a.cr.pal, p.k, p.c, d.sand(a.cr.root.x[0])) : a.cr.pal;
    for (const s of a.cr.list) s.paint(pal);
  }
  /** a third of the way toward `to` */
  const toward = (k: number, to: number) => clamp(Math.round((k + Math.sign(to - k) / 3) * 3) / 3, -1, 1);

  function begin(id: JeuId, who: Animal[]): void {
    const bs = who.map((a) => being(a));
    cur = { jeu: newJeu(id, bs, now, R, world, swimmer), who, z0: who.map((a) => a.z), tempo: who.map(() => 1), paint: who.map((a) => fading.get(a) ?? { k: 0, c: 0 }) };
    for (const a of who) fading.delete(a);
    seen[id] = (seen[id] || 0) + 1;
  }

  /** the game is over: its animals get back their plane and their colours; the next game waits */
  function finish(): void {
    if (!cur) return;
    const { jeu, who } = cur;
    who.forEach((a, i) => {
      a.z = cur!.z0[i];
      if (cur!.paint[i].k || cur!.paint[i].c) fading.set(a, cur!.paint[i]);
    });
    if (jeu.gift) for (const f of played) f(who[0].cr, jeu.gift);
    cur = null;
    nextGame = now + GAP[0] + R() * (GAP[1] - GAP[0]);
  }

  /** the gift: a glow on us, the food of the corner (in the game), a pearl on the sand; and the lineage's words */
  function give(j: Jeu, e: JeuEvent, a: Animal): void {
    const hue = a.cr.pal[0]?.h ?? 50;
    gifts[j.gift!] = (gifts[j.gift!] || 0) + 1;
    if (j.gift === 'tresor') { pearl = { x: e.x, y: e.y, t0: now, hue, name: a.cr.spec.name, id: j.id }; return; }
    if (j.gift === 'lueur') { glow = { t0: now, hue }; sparks.burst(swimmer.x, swimmer.y, 0, 28, hue, 2.2, 9, 0.3); }
    else sparks.burst(e.x, e.y - 40, 0, 16, 55, 1.2, 8, 0.4);
    d.sound('tinkles');
    tell(j.id, a.cr.spec.name);
  }
  function tell(id: JeuId, name: string): void { if (!told.has(id) && d.say(name, WORDS[id])) told.add(id); }

  /** what the game shows, as it happens */
  function show(e: JeuEvent, j: Jeu, who: Animal[]): void {
    const a = who[0], hue = a.cr.pal[0]?.h ?? 50;
    switch (e.k) {
      case 'touche': sparks.burst(e.x, e.y, e.z, 8, hue, 1.4, 6); break;
      case 'attrape': case 'trouve': sparks.burst(e.x, e.y, e.z, 14, hue, 1.8, 7); d.sound('bubbles'); break;
      case 'accepte': for (const o of who) sparks.burst(o.cr.root.x[0], o.cr.root.y[0], o.cr.root.z[0], 4, hue, 1, 6); d.sound('bubbles'); break;
      case 'encre': clouds.emit(e.x, e.y, e.z, { h: 260, s: 25, l: 12 }, 7); break;
      case 'indice':
        // it stirs: a puff of sand and a few bubbles rise from where it hides
        clouds.emit(e.x, d.floor(e.x, e.z), e.z - 10, d.sand(e.x), 4);
        sparks.burst(e.x, e.y - 10, e.z, 8, 195, 0.5, 7, 1.1);
        d.sound('bubbles');
        break;
      case 'miette': sparks.burst(e.x, e.y, 0, 3, 55, 0.8, 5); break;
      case 'cadeau': give(j, e, a); break;
      case 'arrive': break;
    }
  }

  const game = {
    /** the games go on (false: none, to compare) */
    get on() { return on; },
    set on(v: boolean) { on = v; if (!v && cur) finish(); },
    /** the game now (tests): which, at which stage, rounds, how well the shoal is followed, with whom */
    get now() {
      if (!cur) return null;
      const j = cur.jeu;
      return { id: j.id, stage: j.stage, round: j.round, accord: +j.accord.toFixed(2), gift: j.gift, who: cur.who.map((a) => a.cr.spec.name) };
    },
    /** how many games of each kind have started, and gifts of each kind given, since the page opened */
    get seen() { return { ...seen }; },
    get gifts() { return { ...gifts }; },
    /** the pearl waiting on the sand (tests) */
    get pearl() { return pearl && { x: pearl.x, y: pearl.y }; },
    /** an animal we played with (the friends who follow may take it up): its creature and the gift it gave */
    onPlayed(f: (cr: Creature3, gift: Gift | null) => void): void { played.push(f); },
    /** this animal is in the game */
    holds(a: Animal): boolean { return !!cur && cur.who.includes(a); },

    /** each step, after the life of the animals, before they are steered */
    step(t: number, player: Creature3, actors: readonly Animal[]): void {
      now = t; tick++;
      const pr = player.root;
      swimmer = { x: pr.x[0], y: pr.y[0], vx: player.vx, vy: player.vy, len: Math.max(20, player.box[3] - player.box[0]) };
      sparks.step();
      clouds.step();
      if (tick % 12 === 0) for (const [a, p] of fading) {
        const n = { k: toward(p.k, 0), c: toward(p.c, 0) };
        repaint(a, n);
        if (n.k || n.c) fading.set(a, n); else fading.delete(a);
      }
      // the pearl: taken when we swim to it
      if (pearl) {
        if (now - pearl.t0 > 1 && Math.hypot(pearl.x - swimmer.x, pearl.y - swimmer.y) < 26 + swimmer.len * 0.3) {
          sparks.burst(pearl.x, pearl.y, 0, 30, 45, 2, 9, 0.5);
          glow = { t0: now, hue: 45 };
          d.sound('tinkles');
          tell(pearl.id, pearl.name);
          pearl = null;
        } else if (now - pearl.t0 > PEARL) pearl = null;
        // it twinkles now and then, to be seen from afar
        else if (tick % 70 === 0) sparks.burst(pearl.x, pearl.y - 4, 0, 3, 45, 0.5, 6, 0.4);
      }
      if (cur) {
        const { jeu, who } = cur;
        // something else takes the swimmer or one of the animals, or one is gone: the animals go back to their life
        if (!on || who.some((a) => !actors.includes(a) || (a.kind !== 'swim' && a.kind !== 'floor'))) { finish(); return; }
        if (d.busy() && jeu.stage !== 'part' && jeu.stage !== 'fin') { jeu.stage = 'part'; jeu.ts = t; }
        who.forEach((a, i) => being(a, cur!.z0[i]));
        for (const e of stepJeu(jeu, t, R, world, swimmer)) show(e, jeu, who);
        if (jeu.done) { finish(); return; }
        who.forEach((a, i) => {
          const g = goalOf(jeu, i, t, R, world, swimmer), cr = a.cr, b = jeu.who[i], c = cur!;
          if (g.yaw !== undefined) { cr.yawGoal = g.yaw; if (g.z === undefined) g.z = b.z; }
          a.z = g.z ?? c.z0[i];
          c.tempo[i] += (g.tempo - c.tempo[i]) * 0.04;
          a.lag = (a.lag ?? 0) + (c.tempo[i] - 1) * STEP;
          // the colours change in three steps, one every fifth of a second
          const p = c.paint[i], to = { k: g.hide ? -1 : g.dress, c: g.hide ? 1 : 0 };
          if ((p.k !== to.k || p.c !== to.c) && tick % 12 === 0) repaint(a, (c.paint[i] = { k: toward(p.k, to.k), c: toward(p.c, to.c) }));
          if (b.gait === 'glide') { const f = swimFactor3(cr, now + (a.lag ?? 0)); g.x *= f; g.y *= f; }
          goals.set(a, g);
        });
        return;
      }
      if (!on || t < nextGame || tick % 60 || d.busy() || R() > OFFER_P || d.courting()) return;
      const free = actors.filter((a) => (a.kind === 'swim' || a.kind === 'floor') && Math.abs(a.cr.root.x[0] - swimmer.x) < 900 && Math.abs(a.z) < PLANE && d.free(a));
      const bs = free.map((a) => being(a));
      const c = chooseJeu(swimmer, bs, R);
      if (!c) { nextGame = t + 3; return; }
      begin(c.id, c.who.map((b) => free[bs.indexOf(b)]));
    },

    /** where main.ts steers this animal this step, or null */
    goal(a: Animal): { x: number; y: number; accel: number } | null { return (cur && cur.who.includes(a) && goals.get(a)) || null; },

    /** this game now with these animals, or the nearest that can play it (tests, captures): false if none can */
    start(id: JeuId, who?: Animal[], actors?: readonly Animal[]): boolean {
      if (cur) finish();
      if (!who) {
        const fit = (actors ?? []).filter((a) => (a.kind === 'swim' || a.kind === 'floor') && Math.abs(a.cr.root.x[0] - swimmer.x) < 900 && Math.abs(a.z) < PLANE && d.free(a) && JEUX[id].fits(being(a)))
          .sort((p, q) => Math.abs(p.cr.root.x[0] - swimmer.x) - Math.abs(q.cr.root.x[0] - swimmer.x))
          .sort((p, q) => (id === 'cache' ? +(q.cr.mode === 'jet') - +(p.cr.mode === 'jet') : 0));
        const first = fit[0];
        const near = (a: Animal) => Math.hypot(a.cr.root.x[0] - first.cr.root.x[0], a.cr.root.y[0] - first.cr.root.y[0]) < 360;
        who = first && JEUX[id].kin ? fit.filter((a) => a.cr.spec.name === first.cr.spec.name && near(a)).slice(0, JEUX[id].n[1]) : fit.slice(0, 1);
      }
      if (!who.length || who.length < JEUX[id].n[0]) return false;
      begin(id, who);
      return true;
    },
    /** the game ends now (tests) */
    stop(): void { finish(); },

    /** the sparks, the ink, the food of the corner and the pearl, into the scene's items at their depth; their lights */
    items(s: JeuxScene, camX: number, push: (d: number, fn: () => void) => void): void {
      const { view, lights } = s;
      for (let i = 0; i < clouds.n; i++) {
        if (clouds.life[i] <= 0 || Math.abs(clouds.x[i] - camX) > 1400) continue;
        push(view.depth(clouds.y[i], clouds.z[i]) - 0.3, () => drawPuff(s, clouds, i));
      }
      for (let i = 0; i < sparks.n; i++) {
        const l = sparks.life[i];
        if (l <= 0 || Math.abs(sparks.x[i] - camX) > 1400) continue;
        view.project(sparks.x[i], sparks.y[i], sparks.z[i], P);
        lights.push(P.x, P.y, sparks.size[i] * P.s * (0.6 + 0.4 * l), sparks.hue[i], 0.8 * l * (1 - 0.7 * fogOf(P.d, s.plane)));
      }
      // the glow given stays on the swimmer a moment, breathing
      const g = now - glow.t0;
      if (g < GLOW) {
        view.project(swimmer.x, swimmer.y, 0, P);
        const k = Math.min(1, g * 2) * (1 - g / GLOW);
        lights.push(P.x, P.y, (swimmer.len * 1.4 + 30) * P.s * (0.9 + 0.1 * Math.sin(now * 4)), glow.hue, 0.5 * k);
      }
      if (cur?.jeu.stage === 'coin') {
        const food = cur.jeu.food, at = cur.jeu.to;
        push(view.depth(at.y - 60, 0) - 0.25, () => drawFood(s, food));
        view.project(at.x, at.y - 40, 0, P);
        lights.push(P.x, P.y, 120 * P.s, 55, 0.25 * (0.85 + 0.15 * Math.sin(now * 1.5)));
      }
      if (pearl && Math.abs(pearl.x - camX) < 1400) {
        const p = pearl, fade = Math.min(1, (now - p.t0) * 1.5, (PEARL - (now - p.t0)) / 3);
        push(view.depth(p.y, 0) - 0.3, () => drawPearl(s, p, fade));
        view.project(p.x, p.y, 0, P);
        lights.push(P.x, P.y, (48 + 8 * Math.sin(now * 2.2)) * P.s, 45, 0.6 * fade);
      }
    }
  };
  return game;
}

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };

/** the pearl on the sand, in its open shell: a fan of ribs behind a pale bead with its gleam */
const SHELL = [-2.5, -2.1, -1.57, -1.05, -0.65];
function drawPearl(s: JeuxScene, p: Pt, fade: number): void {
  const { view, gx, ctx, dpr } = s;
  view.project(p.x, p.y, 0, P);
  const r = Math.max(2, 6 * P.s), al = fade * (1 - 0.6 * fogOf(P.d, s.plane));
  const dots: [number, number, number, string][] = SHELL.map((a) => [P.x + Math.cos(a) * r * 1.25, P.y + r * 0.5 + Math.sin(a) * r * 1.1, r * 0.75, 'hsla(20,45%,74%,1)']);
  dots.push([P.x, P.y + r * 0.2, r * 0.9, 'hsla(20,40%,64%,1)'], [P.x, P.y, r, 'hsla(40,40%,92%,1)'], [P.x - r * 0.35, P.y - r * 0.35, r * 0.35, 'hsla(0,0%,100%,1)']);
  if (gx) {
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const [x, y, rr, c] of dots) disc(gx, x, y, rr, gx.packCss(c, al));
    return;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = al;
  for (const [x, y, rr, c] of dots) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
}

export type Jeux = ReturnType<typeof initJeux>;

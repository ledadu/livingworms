// La Remontée in the world (remontee.ts). The swimmer comes into the well of light at the bottom: it is led to the
// middle and turns up, the words of the turning come, it sings the whole song and its ancestors come, each with the
// note it learned. Then a current carries the lineage up, in formation, through every chapter, each lighting up as it
// passes; at the surface of the Nurserie the light breaks through, an egg of light hatches a larva, the last words
// are said, and the swimmer is ours again among its ancestors. main.ts spawns the animals, and asks each step who
// leads and where the current carries, each frame where the camera looks and how lit the water is.

import { STEP, clamp, lerp, spec as makeSpec, type Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import type { Proj, View } from '../engine3/view';
import { firstAncestor } from '../content';
import { BIOMES, chapterIndex, floorAt, liftAt, openFloor, type Biome } from './biomes';
import { ceilAt } from './grotte';
import { solidAt } from './relief';
import { GATES, type Limits } from './limites';
import { stayGoal } from './adieu';
import type { Narrator } from './narration';
import type { GlacierScene } from './glacier';
import {
  END, NOTES, T, WELL_REACH, WELL_X, AscentPath, ascentPath, callTimes, carrySpeed, crown, gapFor, litAt, litMood,
  reached, slot, wellLight, type Pt
} from './remontee';
import { remonteeItems } from './remontee-draw';
import { noteOf } from './chant';
import './remontee.css';

/** an animal of main.ts, as much as the scene needs */
export interface Swimmer { cr: Creature3; kind: string; z: number }

export interface RemonteeWorld {
  narrator: Narrator;
  limits: Limits;
  /** the swimmer now */
  swimmer: () => Creature3;
  /** the lineage before it, the oldest first: each creature as saved and the chapter where it gave birth */
  lineage: () => readonly { creature: Record<string, unknown>; chapter: string }[];
  /** a new animal among the others (main.ts, addActor) */
  spawn: (sp: Spec, x: number, y: number, kind: string, scale: number, z: number) => Swimmer;
  /** the animals of the world: the parents left behind answer the song */
  actors: Swimmer[];
  /** nothing else is going on (a farewell, a brood): the scene may begin */
  free: () => boolean;
  /** the tests: the swimmer moved at once */
  teleport: (x: number, y: number) => void;
}

type Phase = 'idle' | 'well' | 'rise' | 'surface' | 'after';

const REM = chapterIndex('remontee');
const at = (cr: Creature3): Pt => ({ x: cr.root.x[0], y: cr.root.y[0] });
const UP: Pt = { x: 0, y: -1 };
/** the colour of a chapter's note (chant.ts); the Remontée, which has none, is golden */
const hueOf = (c: string) => noteOf(c)?.hue ?? 46;
/** how fast a body swims by itself while the current carries it (px per step) */
const SWIM = 1.3;
/** a ring of light going out: where, when, of which hue, how wide it goes (world px) and for how long */
interface Ring { x: number; y: number; t0: number; hue: number; r: number; dur: number }
interface Member { a: Swimmer; k: number; home: Pt | null; seed: number }

const len = (v: Pt) => Math.hypot(v.x, v.y);
const smooth = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
const cap = (v: Pt, m: number): Pt => { const l = len(v); return l > m ? { x: (v.x / l) * m, y: (v.y / l) * m } : v; };

export function initRemontee(w: RemonteeWorld) {
  let phase: Phase = 'idle', done = false;
  /** the scene's start, when the current set off, when the surface was reached (s, simulation time) */
  let t0 = 0, tRise = 0, tSurf = 0, now = 0;
  /** the way up, where the leader is along it, its direction there and the formation's (slower to turn) */
  let path: AscentPath | null = null, hint = 0, dir: Pt = UP, turn: Pt = UP, carry: Pt = { x: 0, y: 0 }, gap = 64;
  const anchor: Pt = { x: WELL_X, y: 0 };
  /** the ancestors to call: their species, when each comes; and those who came */
  let calls: { sp: Spec; at: number; k: number }[] = [];
  const members: Member[] = [];
  let larva: Swimmer | null = null, egg: Pt | null = null, pulse = 0;
  const lit = new Float32Array(BIOMES.length), litOn = new Uint8Array(BIOMES.length);
  let fade = 1;
  const rings: Ring[] = [], flashes: { x: number; y: number; t0: number; size: number; hue: number }[] = [];
  let sung = 0, told = { turn: false, final: false, broke: false };
  let camDist = 0;
  const notes: ((i: number, chapter: Biome['id']) => void)[] = [], ends: (() => void)[] = [];

  const flash = document.createElement('div');
  flash.id = 'remonteeFlash';
  (document.getElementById('chapter') ?? document.body.lastChild)?.before(flash);

  const ground = () => (path ??= ascentPath({ floor: floorAt, open: openFloor, lift: liftAt, ceil: ceilAt, solid: solidAt }));

  function begin(t: number): void {
    phase = 'well'; t0 = t; sung = 0; told = { turn: false, final: false, broke: false }; dir = turn = UP;
    // (a second time, for the tests: the ancestors of the first stay where they are)
    members.length = 0; rings.length = 0; flashes.length = 0; larva = null; egg = null;
    ground();
    hint = 0;
    anchor.y = path!.y[0];
    document.body.classList.add('remontee');
    // the way up is open all along
    for (const g of GATES) w.limits.crossed.add(g.chapter);
    lit.fill(0); litOn.fill(0); litOn[REM] = 1; fade = 1;
    const lineage = w.lineage();
    const saved = lineage.length ? lineage : [{ creature: null, chapter: BIOMES[0].id }];
    const times = callTimes(saved.map((a) => a.chapter));
    calls = saved.map((a, j) => {
      let sp: Spec;
      try { sp = a.creature ? makeSpec(a.creature as Parameters<typeof makeSpec>[0]) : firstAncestor(); } catch { sp = firstAncestor(); }
      // the oldest the furthest back in the V
      return { sp, at: times[j], k: saved.length - j };
    });
    const cr = w.swimmer();
    gap = gapFor(cr.box[3] - cr.box[0]);
  }

  /** where the k-th ancestor swims from the leader: a crown around it in the well, then the V, the one turning into the other */
  function place(k: number): Pt & { z: number } {
    const c = crown(k, calls.length, gap);
    if (phase === 'well') return c;
    const v = slot(k, turn, gap), u = smooth((now - tRise) / 3.5);
    return { x: lerp(c.x, v.x, u), y: lerp(c.y, v.y, u), z: lerp(c.z, v.z, u) };
  }

  /** a ring of light from (x, y) */
  const ring = (x: number, y: number, hue: number, r = 380, dur = 2.4) => rings.push({ x, y, t0: now, hue, r, dur });

  function sing(s: number, lead: Pt): void {
    while (sung < NOTES && s >= T.song + sung * T.note) {
      const id = BIOMES[sung].id;
      ring(lead.x, lead.y, hueOf(id));
      for (const f of notes) f(sung, id);
      // the song calls the parents left behind: they come with the others
      if (sung === 0) for (let i = w.actors.length - 1; i >= 0; i--) if (w.actors[i].kind === 'parent') w.actors.splice(i, 1);
      sung++;
    }
    for (const c of calls) {
      if (s < c.at || members.some((m) => m.k === c.k)) continue;
      const o = place(c.k), x = lead.x + o.x, y = lead.y + o.y;
      const a = w.spawn(c.sp, x, y, 'ancestor', 0.8, o.z);
      members.push({ a, k: c.k, home: null, seed: c.k * 1.7 });
      flashes.push({ x, y, t0: now, size: 150, hue: 46 });
      ring(x, y, 46, 160, 1.6);
    }
  }

  function light(x: number): void {
    for (let i = 0; i < BIOMES.length; i++) {
      if (!litOn[i] && reached(i, x)) {
        litOn[i] = 1;
        w.narrator.chapter(i);
        const c = at(w.swimmer());
        ring(c.x, c.y, hueOf(BIOMES[i].id), 1100, 3.4);
      }
      if (litOn[i]) lit[i] = Math.min(1, lit[i] + STEP / 2.5);
    }
  }

  function endScene(): void {
    phase = 'after'; done = true;
    document.body.classList.remove('remontee');
    for (const m of members) m.home = at(m.a.cr);
    carry = { x: 0, y: 0 };
    for (const f of ends) f();
  }

  const api = {
    /** the scene is playing: the swimmer is not ours */
    get on() { return phase === 'well' || phase === 'rise' || phase === 'surface'; },
    get phase() { return phase; },
    get done() { return done; },
    get path() { return ground(); },
    lit,
    /** the chapter titles wait: during the scene, and for the Remontée, whose opening is the scene's */
    holds(i: number): boolean { return api.on || (i === REM && !done); },

    /** each step, the swimmer's wished velocity while the scene leads it (it may begin here), else null */
    lead(t: number): Pt | null {
      now = t;
      const cr = w.swimmer(), p = at(cr);
      if (phase === 'idle') {
        if (done || Math.abs(p.x - WELL_X) > WELL_REACH || !w.free()) return null;
        begin(t);
      }
      if (phase === 'after') { fade = Math.max(0, fade - STEP / 4); return null; }
      const s = t - t0;
      if (phase === 'well') {
        dir = UP;
        if (!told.turn && s >= T.words) { told.turn = true; w.narrator.tell(REM, 'opening'); w.narrator.told.add(REM); }
        sing(s, p);
        if (s >= T.rise) { phase = 'rise'; tRise = t; for (let i = 0; i < BIOMES.length; i++) w.narrator.told.add(i); }
        // led to the middle of the well, then facing up, swimming on the spot: the current holds it down
        if (s < T.turn) { carry = { x: 0, y: 0 }; return cap({ x: (anchor.x - p.x) * 0.03, y: (anchor.y - p.y) * 0.03 }, 2.2); }
        carry = { x: 0, y: 0.75 };
        return { x: (anchor.x - p.x) * 0.02, y: -0.75 + (anchor.y - p.y) * 0.02 };
      }
      const pth = path!;
      if (phase === 'rise') {
        hint = pth.nearest(p, hint);
        dir = pth.dir(hint);
        turn = { x: turn.x + (dir.x - turn.x) * 0.03, y: turn.y + (dir.y - turn.y) * 0.03 };
        const tl = len(turn) || 1;
        turn = { x: turn.x / tl, y: turn.y / tl };
        const v = carrySpeed(pth.s[hint], pth.length, t - tRise), own = clamp(v, 0.5, SWIM);
        carry = { x: dir.x * Math.max(0, v - own), y: dir.y * Math.max(0, v - own) };
        light(p.x);
        if (pth.s[hint] > pth.length - 40 || t - tRise > 170) { phase = 'surface'; tSurf = t; carry = { x: 0, y: 0 }; }
        // along the way, drawn back onto it
        const q = pth.ahead(hint, 50);
        return cap({ x: dir.x * own + (q.x - p.x) * 0.03, y: dir.y * own + (q.y - p.y) * 0.03 }, 3);
      }
      // the surface: the light breaks through, an egg of light, a larva, the last words
      const u = t - tSurf;
      light(p.x);
      if (!told.broke) {
        told.broke = true;
        flash.classList.add('on');
        setTimeout(() => flash.classList.remove('on'), 1300);
        for (let k = 0; k < 3; k++) rings.push({ x: p.x, y: END.y, t0: t + k * 0.5, hue: 48, r: 900, dur: 3.6 });
      }
      if (!egg && u >= T.egg) { egg = { x: p.x + 70, y: Math.max(50, p.y + 45) }; pulse = t; }
      // the egg beats, faster and faster, and hatches
      if (egg && !larva && t >= pulse) { ring(egg.x, egg.y, 52, 90, 1.2); pulse = t + lerp(1, 0.35, (u - T.egg) / (T.hatch - T.egg)); }
      if (egg && !larva && u >= T.hatch) {
        larva = w.spawn(firstAncestor(), egg.x, egg.y, 'sib', 0.7, 0);
        flashes.push({ x: egg.x, y: egg.y, t0: t, size: 300, hue: 50 });
        ring(egg.x, egg.y, 50, 300, 2.2);
      }
      if (!told.final && u >= T.final) { told.final = true; w.narrator.tell(REM, 'final'); }
      if (u >= T.end) { endScene(); return null; }
      return cap({ x: (END.x - p.x) * 0.02, y: (END.y + 30 - p.y) * 0.02 }, 1.1);
    },

    /** each step: the current carries the lineage (after its own swimming); an escort (the lights that answered in the
     * Fosse) is also drawn back toward the leader when it falls behind */
    carry(cr: Creature3, escort = false): void {
      if (!api.on || !(carry.x || carry.y)) return;
      cr.translate(carry.x, carry.y, 0);
      if (!escort) return;
      const p = at(cr), l = at(w.swimmer()), d = Math.hypot(l.x - p.x, l.y - p.y);
      if (d > 420) { const k = Math.min(8, (d - 420) * 0.05) / d; cr.translate((l.x - p.x) * k, (l.y - p.y) * k, 0); }
    },

    /** each step: the wished velocity of an ancestor of the formation */
    follow(cr: Creature3, t: number): Pt {
      const m = members.find((q) => q.a.cr === cr);
      if (!m) return { x: 0, y: 0 };
      const p = at(cr), lead = at(w.swimmer());
      if (m.home) return stayGoal(p, m.home, lead, t, m.seed);
      if (phase === 'surface') {
        // spread under the surface on both sides of the swimmer
        const r = Math.ceil(m.k / 2), side = m.k % 2 ? -1 : 1;
        return cap({ x: (lead.x + side * r * gap * 1.2 - p.x) * 0.02, y: (END.y + 40 + (m.k % 3) * 22 - p.y) * 0.02 }, 1.2);
      }
      const o = place(m.k), tx = lead.x + o.x, ty = lead.y + o.y;
      m.a.z = o.z;
      // stuck behind a rock, far behind: it catches up out of sight
      if (Math.hypot(tx - p.x, ty - p.y) > 650) cr.translate(tx - p.x, ty - p.y, 0);
      const own = phase === 'well' ? 0.75 : len(carry) > 0 ? SWIM : 0.5;
      return cap({ x: dir.x * own + (tx - p.x) * 0.05, y: dir.y * own + (ty - p.y) * 0.05 }, 4);
    },

    /** each frame: where the camera looks and from how far (eased from the player's own distance), or null */
    camera(own: number, W: number, H: number): { focus: Pt | null; dist: number } | null {
      if (phase === 'idle' || (phase === 'after' && Math.abs(camDist - own) < 2)) { camDist = 0; return null; }
      if (!camDist) camDist = own;
      const p = at(w.swimmer());
      let want = own, focus: Pt | null = null;
      if (phase === 'well') { want = own * lerp(0.95, 1.3, smooth((now - t0 - T.song) / 4)); focus = { x: WELL_X, y: anchor.y - 20 }; }
      else if (phase === 'rise') {
        // the whole formation in view, across the narrower side of the screen (as adieu-jeu.ts measures it); the camera,
        // a little late behind the current, keeps it in the middle
        const across = (W < H ? 0.975 * W : 0.81 * H) / Math.max(1, H);
        want = Math.max(own * 1.3, 800 / across);
        focus = { x: p.x + dir.x * 40, y: p.y + dir.y * 40 };
      }
      else if (phase === 'surface') {
        // close on the egg while the larva is born, then wide on the whole lineage for the last words
        const u = now - tSurf, e = egg ?? p;
        want = own * (u < T.egg ? 1.2 : u < T.final + 1.5 ? 0.66 : 1.15);
        focus = u >= T.egg && u < T.final + 1.5 ? { x: e.x - 30, y: e.y - 30 } : { x: p.x, y: p.y + 60 };
      }
      camDist += (want - camDist) * 0.02;
      return { focus, dist: camDist };
    },

    /** how lit the water is at x by the lineage going up (0..1) */
    litAt(x: number): number { return phase === 'idle' ? 0 : litAt(lit, x) * fade; },
    /** the light at x: lit by the lineage going up, and by the well near it */
    mood<M extends Parameters<typeof litMood>[0]>(m: M, x: number): M {
      return litMood(m, Math.max(api.litAt(x), wellLight(x) * 0.55));
    },
    /** how much of the dark stays at x (a factor) */
    open(x: number): number { return 1 - 0.85 * Math.max(api.litAt(x), wellLight(x) * 0.9); },

    /** the well and the shafts, sorted with the scene */
    items(s: GlacierScene, camX: number, camY: number, push: (d: number, fn: () => void) => void): void {
      remonteeItems(s, camX, camY, wellLight(camX), api.litAt(camX), push);
    },

    /** lights drawn after the dark (x, y on screen, size, hue, alpha): the pool of the well, the rings of the song, the ancestors' halos, the egg, the sun */
    lights(view: View, out: number[], P: Proj, W: number, H: number): void {
      const t = now;
      const wl = wellLight(at(w.swimmer()).x);
      if (wl > 0.01) {
        view.project(WELL_X, floorAt(WELL_X, 60) - 10, 60, P);
        out.push(P.x, P.y, 300 * P.s + 30, 47, 0.42 * wl);
      }
      const L = api.litAt(at(w.swimmer()).x);
      if (L > 0.01) out.push(W / 2, -0.3 * H, 1.2 * Math.max(W, H), 46, 0.22 * L);
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i], u = (t - g.t0) / g.dur;
        if (u > 1) { rings.splice(i, 1); continue; }
        if (u < 0) continue;
        view.project(g.x, g.y, 0, P);
        const r = g.r * (1 - (1 - u) * (1 - u)) * P.s, al = 0.75 * (1 - u) ** 1.4, n = Math.max(18, Math.min(60, Math.round(r / 9)));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + g.t0;
          out.push(P.x + Math.cos(a) * r, P.y + Math.sin(a) * r * 0.82, 13 * P.s + 8, g.hue, al);
        }
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i], u = (t - f.t0) / 1.4;
        if (u > 1) { flashes.splice(i, 1); continue; }
        view.project(f.x, f.y, 0, P);
        out.push(P.x, P.y, f.size * P.s * (0.6 + 0.6 * u), f.hue, 0.9 * (1 - u) ** 2);
      }
      if (api.on) for (const m of members) {
        const r = m.a.cr.root, k = r.x.length >> 1;
        view.project(r.x[k], r.y[k], r.z[k], P);
        out.push(P.x, P.y, 46 * P.s + 14, 46, 0.2 + 0.08 * Math.sin(t * 1.3 + m.seed));
      }
      // the newborn shines a while, so that the eye finds it
      const born = t - tSurf - T.hatch;
      if (larva && born < 9) {
        const r = larva.cr.root;
        view.project(r.x[0], r.y[0], r.z[0], P);
        out.push(P.x, P.y, 40 * P.s + 12, 50, 0.5 * (1 - born / 9));
      }
      if (egg && !larva) {
        view.project(egg.x, egg.y, 0, P);
        const u = clamp((t - tSurf - T.egg) / (T.hatch - T.egg), 0, 1);
        out.push(P.x, P.y, (30 + 30 * u) * P.s + 12, 50, 0.7 + 0.25 * Math.sin(t * (3 + 6 * u)));
        out.push(P.x, P.y, (9 + 6 * u) * P.s + 4, 56, 0.95);
      }
    },

    /** called at each note of the song (to sound it: the song of step 5) */
    onNote(f: (i: number, chapter: Biome['id']) => void): void { notes.push(f); },
    /** called once the scene is over (the credits, the free swim) */
    onEnd(f: () => void): void { ends.push(f); },

    /** tests: into the well at once, where the scene begins */
    start(): void {
      done = false;
      w.teleport(WELL_X - 60, floorAt(WELL_X, 0) - 220);
    },
    /** tests: the lineage carried at once along the way to x (the chapters on the way are lit) */
    jump(x: number): void {
      if (phase !== 'rise' || !path) return;
      const p = at(w.swimmer()), i = path.nearest({ x, y: path.y[path.nearest({ x, y: 0 }, 0)] }, 0);
      const dx = path.x[i] - p.x, dy = path.y[i] - p.y;
      w.teleport(path.x[i], path.y[i]);
      for (const m of members) m.a.cr.translate(dx, dy, 0);
      hint = i;
      for (let c = 0; c < BIOMES.length; c++) if (reached(c, path.x[i])) { litOn[c] = 1; lit[c] = 1; }
    }
  };
  return api;
}

export type Remontee = ReturnType<typeof initRemontee>;

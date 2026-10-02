// The friends who follow, in the game (amis.ts for the rules). Around the swimmer, the bond with each little swimmer
// it keeps company with grows or fades; once full, the animal becomes the friend of the generation: three flashes of
// its colour, the note of its chapter, the words of the lineage. It swims around us from then on, sings each note of
// our song an octave up, and now and then leads us to a trace of the lineage or to where food falls. When the
// generation changes, it stays where it is, saved with its place, and greets us when we pass by again.
// After a birth, the two parents swim with the child the same way until it leaves their chapter: then the parent
// stays there, among the ancestors, and the partner goes back to its life.

import doc from '../../docs/mecaniques.md?raw';
import type { Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import type { Proj, View } from '../engine3/view';
import { BIOMES, biomeIndex, type ChapterId } from './biomes';
import { homesOf, placeOf } from './ancetres';
import { CHAPTERS, SEA } from './ancetres-jeu';
import type { Friend, Place } from './partie';
import { cousinHue } from './rivale';
import {
  FIRST_SHOW, FULL, GREET_FOR, GREET_NEAR, LOST, SONG, bondStep, followGoal, friendLight, friendly, homeGoal, leadGoal,
  nextShow, parseFriendTexts, pickShow, showOver, spotOf, type Pt, type Show, type Swimmer
} from './amis';

const TEXTS = parseFriendTexts(doc);

/** an animal of the world, as the friends see it (main.ts: Actor) */
export interface Animal { cr: Creature3; kind: string; z: number; hx: number; hy: number; partner?: number }

export interface AmisDeps {
  partie: {
    readonly gen: number; readonly friends: readonly Friend[];
    befriend(id: string): void; friendStays(gen: number, chapter: string, at: Place): void;
  };
  /** the species of the bestiary by id */
  species(id: string): Spec | null;
  /** the bestiary id of a species ('' when it is not one) */
  idOf(sp: Spec): string;
  /** a friend joins the animals of the world at (x, y) (kind 'ami') */
  add(sp: Spec, x: number, y: number): Animal;
  /** the scene an animal plays now (vie-jeu.ts), or null */
  actOf(a: Animal): string | null;
  /** the traces of the lineage, and whether their words were said */
  traces(): readonly (Pt & { seen: boolean })[];
  /** food falls at this spot for the animals around (vie-jeu.ts) */
  feast(at: Pt): boolean;
  /** an animal sings this note, an octave up (chant-jeu.ts) */
  sing(cr: Creature3, chapter: ChapterId): void;
  /** the words of the lineage, under a name (false: not now) */
  say(name: string, lines: string[]): boolean;
  /** a parade or a farewell needs the room around us: the friends keep further */
  aside(): boolean;
  /** a scene of the story is on (a parade, a farewell, the Remontée, a panel): no friend is made, nothing is shown */
  busy(): boolean;
  /** the nearest place in open water */
  keep(p: Pt): Pt;
  /** the parent that swam with its child stays here from now on, the k-th ancestor of the lineage (null: not in it) */
  parentStays(cr: Creature3, home: Pt, k: number | null): void;
}

/** the friend of the generation, an old friend at its place, or a parent swimming with its child */
type Role = 'friend' | 'old' | 'parent';

interface Pal {
  a: Animal;
  role: Role;
  gen: number;
  /** where an old friend stays */
  home: Pt | null;
  phase: number;
  hue: number;
  /** when it became a friend, or greeted us (s, the time of the world) */
  since: number;
  /** an old friend swims with us until then */
  greetUntil: number;
  greeted: boolean;
  show: Show | null;
  next: number;
  /** its kind before (a parent gets it back); a parent: the chapter it swims with us in, its rank in the lineage */
  kind0: string; chapter?: number; k?: number | null;
}

/** the bond is weighed this often (steps) */
const EVERY = 15, DT = EVERY / 60;
/** the friends sing each note this long after us (s) */
const ECHO = 0.35;
/** words that cannot be said at once (other words on the screen) wait this long at most (s), tried once a second */
const WORDS_WAIT = 20;

const at = (cr: Creature3): Pt => ({ x: cr.root.x[0], y: cr.root.y[0] });
const lenOf = (cr: Creature3) => Math.max(cr.box[3] - cr.box[0], cr.box[4] - cr.box[1]);
const chapterAt = (x: number) => BIOMES[biomeIndex(x)];
const gaitOf = (cr: Creature3) => (cr.mode === 'bell' || cr.mode === 'jet' || cr.mode === 'crawl' ? cr.mode : 'glide');
const canBe = (a: Animal) => friendly({ kind: a.kind, gait: gaitOf(a.cr), len: lenOf(a.cr), speed: a.cr.spec.swim.speed, partner: a.partner !== undefined });
/** a partner swims with the child if it can keep up: a swimmer of the open water, quick enough */
const canFollow = (a: Animal) => a.kind === 'swim' && gaitOf(a.cr) === 'glide' && a.cr.spec.swim.speed >= 0.6;

export function initAmis(d: AmisDeps) {
  const R = Math.random;
  const bonds = new Map<Animal, number>();
  const pals: Pal[] = [];
  const echoes: { at: number; chapter: ChapterId }[] = [];
  /** the parents of a birth, waiting for the farewell to end */
  let born: { parent: Animal; partner: Animal | null; chapter: number; k: number | null } | null = null;
  /** the words of the lineage about a friend, waiting for the screen to be free */
  let words: { name: string; lines: string[]; until: number; next: number } | null = null;
  const tell = (name: string, lines: string[] | undefined) => { if (lines) words = { name, lines, until: now + WORDS_WAIT, next: now }; };
  let now = 0, tick = 0, swimmer: Swimmer = { x: 0, y: 0, vx: 0, vy: 0, len: 20 }, loaded = false;

  const friendOf = () => pals.find((p) => p.role === 'friend') ?? null;
  const palOf = (cr: Creature3) => pals.find((p) => p.a.cr === cr);
  /** the generation played has its friend already */
  const hasFriend = () => !!friendOf() || d.partie.friends.some((f) => f.gen === d.partie.gen);

  function join(a: Animal, role: Role, gen: number, home: Pt | null): Pal {
    const p: Pal = { a, role, gen, home, phase: R() * Math.PI * 2, hue: cousinHue(a.cr.spec.palette.hue), since: -99, greetUntil: 0, greeted: false, show: null, next: now + FIRST_SHOW, kind0: a.kind };
    a.kind = 'ami';
    a.z = 0;
    pals.push(p);
    return p;
  }

  /** this animal becomes the friend of the generation played */
  function befriend(a: Animal): boolean {
    if (hasFriend() || a.kind !== 'swim') return false;
    bonds.clear();
    const p = join(a, 'friend', d.partie.gen, null);
    p.since = now;
    d.partie.befriend(d.idOf(a.cr.spec));
    d.sing(a.cr, chapterAt(a.cr.root.x[0]).id);
    tell(a.cr.spec.name, TEXTS.ami);
    return true;
  }

  /** the friends saved: the one of the generation played comes with us, the others where they stayed */
  function load(): void {
    loaded = true;
    const saved = d.partie.friends, placed = saved.filter((f) => f.at && f.chapter);
    const homes = homesOf(placed.map((f) => ({ creature: {}, chapter: f.chapter!, at: f.at })), CHAPTERS, SEA);
    placed.forEach((f, k) => {
      const sp = d.species(f.id), h = homes[k];
      if (sp && h) join(d.add(sp, h.x, h.y), 'old', f.gen, h);
    });
    const mine = saved.find((f) => f.gen === d.partie.gen && !f.at), sp = mine && d.species(mine.id);
    if (sp) join(d.add(sp, swimmer.x - 140, swimmer.y - 60), 'friend', mine!.gen, null).since = now;
  }

  /** a parent goes back to its life: ours stays where it is, among the ancestors; the partner to its home */
  function release(p: Pal): void {
    pals.splice(pals.indexOf(p), 1);
    p.a.kind = p.kind0;
    if (p.kind0 === 'parent') d.parentStays(p.a.cr, at(p.a.cr), p.k ?? null);
  }

  function weigh(actors: readonly Animal[]): void {
    if (hasFriend() || d.busy()) { bonds.clear(); return; }
    const speed = Math.hypot(swimmer.vx, swimmer.vy);
    for (const a of actors) {
      if (Math.abs(a.cr.root.x[0] - swimmer.x) > 900 || !canBe(a)) continue;
      const p = at(a.cr), b = bondStep(bonds.get(a) ?? 0, { act: d.actOf(a), d: Math.hypot(p.x - swimmer.x, p.y - swimmer.y), speed }, DT);
      if (b >= FULL && befriend(a)) return;
      if (b > 0) bonds.set(a, b); else bonds.delete(a);
    }
    for (const a of bonds.keys()) if (!actors.includes(a) || Math.abs(a.cr.root.x[0] - swimmer.x) > 900) bonds.delete(a);
  }

  /** the friend of the generation: it stays when its generation is over, and shows things now and then */
  function stepFriend(f: Pal, t: number): void {
    const p = at(f.a.cr);
    // its generation is over (a birth, an earlier form taken again): it stays where it is
    if (f.gen !== d.partie.gen) {
      const c = chapterAt(p.x);
      f.role = 'old'; f.home = p; f.show = null; f.greeted = true;
      f.a.hx = p.x; f.a.hy = p.y;
      d.partie.friendStays(f.gen, c.id, placeOf(p.x, p.y, c.x0));
      return;
    }
    if (f.show) {
      const o = showOver(f.show, swimmer, t);
      if (o.reached && f.show.kind === 'food') d.feast(f.show.to);
      if (o.over || d.busy()) { f.show = null; f.next = nextShow(t, R); }
    } else if (t > f.next && !d.busy() && Math.hypot(swimmer.vx, swimmer.vy) < 2.2) {
      f.show = pickShow(swimmer, d.traces(), t, R);
      f.since = t;
    }
  }

  const api = {
    /** each step, after the life of the animals */
    step(t: number, player: Creature3, actors: readonly Animal[]): void {
      now = t; tick++;
      const r = player.root;
      swimmer = { x: r.x[0], y: r.y[0], vx: player.vx, vy: player.vy, len: Math.max(20, lenOf(player)) };
      if (!loaded) load();
      for (let k = pals.length - 1; k >= 0; k--) if (!actors.includes(pals[k].a)) pals.splice(k, 1);
      // in the swimming plane (a scene it left may have given it back its own)
      for (const p of pals) p.a.z = 0;
      // the farewell is over: the parents come with the child
      if (born && !d.busy()) {
        const b = born;
        born = null;
        for (const a of [b.parent, b.partner]) if (a && actors.includes(a) && (a.kind === 'parent' || a.kind === 'swim')) {
          const p = join(a, 'parent', d.partie.gen, null);
          p.chapter = b.chapter; p.k = a === b.parent ? b.k : null;
        }
      }
      const here = biomeIndex(swimmer.x);
      for (const p of pals.filter((q) => q.role === 'parent' && q.chapter !== here)) release(p);
      const f = friendOf();
      if (f) stepFriend(f, t);
      // those who swim with us come back near us when left far behind (a journey, the page opened again), out of sight
      for (const p of pals) {
        if (p.role === 'old') continue;
        const q = at(p.a.cr);
        if (Math.hypot(q.x - swimmer.x, q.y - swimmer.y) <= LOST) continue;
        const side = Math.cos(player.yaw) < 0 ? 1 : -1, to = d.keep({ x: swimmer.x + side * 420, y: swimmer.y - 40 });
        p.a.cr.translate(to.x - q.x, to.y - q.y, 0);
      }
      // an old friend knows us again, the first time we pass by in a visit
      for (const p of pals) {
        if (p.role !== 'old' || p.greeted || d.busy()) continue;
        const q = at(p.a.cr);
        if (Math.hypot(q.x - swimmer.x, q.y - swimmer.y) > GREET_NEAR) continue;
        p.greeted = true; p.since = t; p.greetUntil = t + GREET_FOR;
        d.sing(p.a.cr, chapterAt(q.x).id);
        tell(p.a.cr.spec.name, TEXTS.retrouvailles);
      }
      // the notes of our song, sung again a moment after us
      while (echoes.length && echoes[0].at <= t) {
        const e = echoes.shift()!;
        for (const p of pals) if (p.role !== 'old' || p.greetUntil > t) d.sing(p.a.cr, e.chapter);
      }
      if (words && t >= words.next) { words.next = t + 1; if (d.say(words.name, words.lines) || t > words.until) words = null; }
      if (tick % EVERY === 0) weigh(actors);
    },

    /** each step: the wished velocity of a friend */
    goal(cr: Creature3, t: number): Pt {
      const p = palOf(cr);
      if (!p) return { x: 0, y: 0 };
      const me = at(cr);
      if (p.role === 'old' && p.greetUntil <= t) return homeGoal(me, p.home!, t, p.phase);
      if (p.show) return leadGoal(me, p.show, swimmer);
      return followGoal(me, d.keep(spotOf(swimmer, t, p.phase, d.aside())), swimmer);
    },

    /** a child is born (main.ts farewell): once the farewell is over, its parents swim with it while it stays in their
     * chapter. `k`: the parent's rank in the lineage (null: it is not in it, in the Balade) */
    born(parent: Animal, partner: Animal | null, k: number | null): void {
      for (const p of pals.filter((q) => q.role === 'parent')) release(p);
      born = { parent, partner: partner && canFollow(partner) ? partner : null, chapter: biomeIndex(parent.cr.root.x[0]), k };
    },
    /** a note of our song (chant.onNote): the friends sing it after us */
    hear(chapter: ChapterId): void { echoes.push({ at: now + ECHO, chapter }); },
    /** an animal answered our song (chant.onLight): the bond grows at once */
    answered(cr: Creature3, actors: readonly Animal[]): void {
      const a = actors.find((q) => q.cr === cr);
      if (a && canBe(a) && !hasFriend()) bonds.set(a, (bonds.get(a) ?? 0) + SONG);
    },

    /** each frame: the light of each friend near us, in its own colour, around the middle of its body */
    lights(view: View, out: number[], P: Proj, t: number): void {
      for (const p of pals) {
        const r = p.a.cr.root, k = r.x.length >> 1;
        if (Math.abs(r.x[k] - swimmer.x) > 900) continue;
        const l = friendLight(t - p.since, Math.hypot(r.x[k] - swimmer.x, r.y[k] - swimmer.y), t + p.phase, !!p.show);
        if (l < 0.01) continue;
        view.project(r.x[k], r.y[k], r.z[k], P);
        out.push(P.x, P.y, 60 * P.s + 12, p.hue, 0.6 * l);
      }
    },

    /** make this animal the friend now (tests, captures, the little games of the animals): false if it cannot */
    befriend,
    /** the friends in the world: who, its role, of which generation, where an old one stays, what it shows */
    get list() {
      return pals.map((p) => ({ name: p.a.cr.spec.name, role: p.role, gen: p.gen, home: p.home, show: p.show?.kind ?? null, at: at(p.a.cr), cr: p.a.cr }));
    },
    /** the bonds growing now (tests): the species and how far along (FULL: a friend) */
    get bonds() { return [...bonds].map(([a, b]) => ({ name: a.cr.spec.name, bond: +b.toFixed(2) })); },
    /** the friend shows something now (tests, captures) */
    show(): string | null {
      const f = friendOf();
      if (!f) return null;
      f.show = pickShow(swimmer, d.traces(), now, R);
      f.since = now;
      return f.show.kind;
    }
  };
  return api;
}

export type Amis = ReturnType<typeof initAmis>;

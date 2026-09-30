// The hints in the world (indices.ts): the first time the obstacle of a chapter holds us back, the chapter's hints
// wake up. Once we turn back out of the obstacle's reach, the lineage says who had what it takes (« L'indice »),
// and from then on, while we still cannot cross, a thread of golden lights leaves us now and then toward the
// nearest partner that would bring it, or our eggs that would; near it, that partner calls with a few lights of
// the same gold. Which partners would, for the parent we play, is found out by a few broods, one per step.

import { STEP, rand, type Spec } from '../engine';
import type { Proj, View } from '../engine3/view';
import { SPECIES } from '../content';
import { traitsOf } from '../content/traits';
import type { ChapterId } from './biomes';
import { GLOW_HUE } from './partenaires';
import { GUIDE_NEAR, MOTE_LIFE, PUFF_EVERY, SAMPLE, awake, bestPartners, bodyKeys, broodCrosses, moteVelocity, rightPartners, target, type Pt } from './indices';
import { PARTNERS } from './partenaires';
import type { Near } from './obstacles-jeu';

/** an animal of the world, as the hints see it */
interface Animal { cr: { spec: Spec; root: { x: ArrayLike<number>; y: ArrayLike<number> } }; partner?: number; }

interface Deps {
  /** the chapter at x, and its index */
  chapter(x: number): { id: ChapterId; i: number };
  /** the obstacle whose reach the swimmer at x is in (obstacles-jeu.ts) */
  near(x: number): Near | null;
  /** whether the swimmer crosses the obstacle of this chapter (its body, or already crossed) */
  open(c: ChapterId): boolean;
  /** the animals of the world */
  animals(): readonly Animal[];
  /** the creature we play: the parent of the broods to come */
  parent(): Spec;
  /** eggs of ours that call (ponte-jeu.ts) */
  eggs(): Pt | null;
  /** the words of the hint of chapter i, now if nothing else is said (false: not now) */
  say(i: number): boolean;
  /** while this is true (a parade, a panel, the farewell), no thread */
  busy(): boolean;
}

/** a light of the thread: x, y, age, life, target x, target y, seed, delay */
const MOTE = 8;
/** the call of a partner near us: every this often (s) */
const CALL_EVERY = 1.5;

export function initIndices(deps: Deps) {
  const felt = new Set<ChapterId>(), told = new Set<ChapterId>();
  const motes: number[] = [];
  let puff = 0, call = 0;

  /** for a parent, in a chapter: the broods still to try, how many crossed for each partner, and the names to lead to */
  interface Rating { todo: [string, number][]; hits: Map<string, number>; names: Set<string> | null; byTraits: string[]; }
  const ratings = new WeakMap<Spec, Map<ChapterId, Rating>>();
  const nameOf = (id: string) => SPECIES[id]().name;
  /** the names of the species that would bring what the obstacle of chapter c asks, for this parent (tries one brood more) */
  function rightNames(parent: Spec, c: ChapterId): Set<string> {
    let byChapter = ratings.get(parent);
    if (!byChapter) ratings.set(parent, (byChapter = new Map()));
    let r = byChapter.get(c);
    if (!r) {
      const ids = [...new Set(PARTNERS[c].map((q) => q.id))];
      r = { todo: ids.flatMap((id) => SAMPLE.map((s): [string, number] => [id, s])), hits: new Map(ids.map((id) => [id, 0])), names: null, byTraits: rightPartners(c, (id) => traitsOf(SPECIES[id]())) };
      byChapter.set(c, r);
    }
    const next = r.todo.pop();
    if (next) {
      if (broodCrosses(parent, SPECIES[next[0]](), c, next[1])) r.hits.set(next[0], r.hits.get(next[0])! + 1);
      if (!r.todo.length) r.names = new Set(bestPartners(new Map([...r.hits].map(([id, h]) => [id, h / SAMPLE.length])), r.byTraits).map(nameOf));
    }
    return r.names ?? new Set(r.byTraits.map(nameOf));
  }

  const emit = (x: number, y: number, tx: number, ty: number, life: number, delay: number) => motes.push(x, y, -delay, life, tx, ty, rand(0, 6.28), delay);

  const indices = {
    /** the chapters whose hints are awake */
    felt,
    /** the chapters whose hint has been said */
    told,
    /** the hints of chapter c wake up (a brood of it that would not cross) */
    feel(c: ChapterId): void { if (bodyKeys(c).length && !deps.open(c)) felt.add(c); },
    /** where the thread leads now, if anywhere (tests) */
    lead: null as (Pt & { eggs?: boolean }) | null,
    /** the species the thread would lead to in chapter c, for the creature we play (tests) */
    right: (c: ChapterId) => [...rightNames(deps.parent(), c)],

    /** each step, with the swimmer at (px, py) */
    step(px: number, py: number): void {
      for (let i = 0; i < motes.length; i += MOTE) {
        motes[i + 2] += STEP;
        const age = motes[i + 2];
        if (age < 0) continue;
        const v = moteVelocity({ x: motes[i], y: motes[i + 1] }, { x: motes[i + 4], y: motes[i + 5] }, age, motes[i + 6]);
        motes[i] += v.x; motes[i + 1] += v.y;
      }
      for (let i = motes.length - MOTE; i >= 0; i -= MOTE) if (motes[i + 2] >= motes[i + 3]) motes.splice(i, MOTE);

      const { id: c, i: ci } = deps.chapter(px), keys = bodyKeys(c), n = deps.near(px);
      // pressed into the obstacle, as far as its words are said (obstacles-jeu.ts)
      if (n && !n.open && n.chapter === c && px >= n.gate - n.o.soft * 0.45) felt.add(c);
      indices.lead = null;
      if (!awake(felt.has(c), deps.open(c), keys)) return;
      // out of its reach again: the lineage remembers who had what it takes
      if (!told.has(c) && !n && deps.say(ci)) told.add(c);
      if (deps.busy()) return;

      const right = rightNames(deps.parent(), c), here = { x: px, y: py }, partners: Pt[] = [];
      for (const a of deps.animals()) if (a.partner === ci && right.has(a.cr.spec.name)) partners.push({ x: a.cr.root.x[0], y: a.cr.root.y[0] });
      const eggs = deps.eggs(), to = target(here, partners, eggs);
      indices.lead = to;
      puff -= STEP; call -= STEP;
      if (to && puff <= 0) {
        puff = PUFF_EVERY;
        for (let k = 0; k < 8; k++) emit(px + rand(-6, 6), py + rand(-6, 6), to.x, to.y, MOTE_LIFE, k * 0.1);
      }
      // near enough to be seen: the one we would dance with calls, with the same gold
      if (!to && call <= 0 && !eggs) {
        call = CALL_EVERY;
        let best: Pt | null = null, bd = Infinity;
        for (const p of partners) { const d = Math.hypot(p.x - px, p.y - py); if (d < bd) { bd = d; best = p; } }
        if (best && bd > 140 && bd < GUIDE_NEAR) for (let k = 0; k < 2; k++) emit(best.x + rand(-10, 10), best.y + rand(-6, 6), best.x + rand(-30, 30), best.y - 200, 1.6, k * 0.3);
      }
    },

    /** the lights of the thread, into the lights of the world (x, y on screen, size, hue, alpha) */
    lights(view: View, out: number[], P: Proj): void {
      for (let i = 0; i < motes.length; i += MOTE) {
        const age = motes[i + 2];
        if (age < 0) continue;
        const k = age / motes[i + 3], a = Math.min(1, age * 4) * (1 - k * k);
        view.project(motes[i], motes[i + 1], 0, P);
        out.push(P.x, P.y, (17 - 6 * k) * P.s + 4, GLOW_HUE, 0.9 * a);
      }
    }
  };
  return indices;
}

export type Indices = ReturnType<typeof initIndices>;

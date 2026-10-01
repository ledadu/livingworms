// The eggs in the world (ponte.ts for the rules of the wait, oeufs.ts for the eggs themselves, oeufs-draw.ts for
// their look): laid one by one where a parade ended, in the water of its dance (parade-eau.ts), pale gold, each
// with its child curled inside. They drift with the water and keep together in their jelly; staying by them, they
// tremble and glow brighter, then the brood opens. Left for later, they wait. Once the brood is decided they hatch
// where they are, each in its turn: the egg stretches, splits in two, and a child swims out, small, and grows to
// its size. The chosen one is played from then on; the others stay there, by the parent; or all four, if we let
// them hatch without choosing. One clutch waits at a time: a new parade makes the old one hatch.

import type { Spec } from '../engine';
import type { Child } from '../content/portee';
import type { Creature3 } from '../engine3/creature3';
import { growth, rescale } from '../engine3/grow';
import type { Proj } from '../engine3/view';
import type { Sprite } from './sprites';
import { EGG_COUNT, hatching, leaveClutch, newClutch, stepClutch, type Clutch } from './ponte';
import { EGG_R, GROW_TIME, NEWBORN, SHELL, gone, hatchEggs, layEggs, middle, shown, stepEggs, type Eggs, type Pt } from './oeufs';
import { bakeEgg, drawEgg, type EggView } from './oeufs-draw';

interface Deps {
  /** opens the brood of these eggs (portee-ecran.ts) */
  open(partner: Spec, quality: number, seed: number): void;
  /** the four children of these eggs, as their brood would show them (the same seed, the same children) */
  kids(partner: Spec, quality: number, seed: number): Child[];
  /** a place in the water for eggs laid at x, y */
  keep(x: number, y: number): Pt;
  /** while this is true (a parade, a panel, the farewell), the eggs wait */
  busy(): boolean;
  /** would one of these children cross the obstacle where the eggs lie */
  crosses(kids: readonly Child[], x: number): boolean;
  /** the water's velocity at a point (px per step): the water of the parade carries the eggs */
  water(x: number, y: number): Pt;
  /** the chosen child comes out of its egg, this small (× its size), and is played from now on: the creature made, or null if none can be born now */
  born(child: Spec, at: Pt, partner: Spec, size: number): Creature3 | null;
  /** a child that stays: an animal of the world, born this small at (x, y) */
  add(child: Spec, x: number, y: number, size: number): Creature3;
  /** a newborn swimming out stirs and lights the water a little */
  stir?(cr: Creature3): void;
}

export interface EggScene extends EggView {
  /** lights drawn after the dark: x, y (screen), size, hue, alpha */
  lights: number[];
}

/** the gold of the eggs of the brood screen (portee.css) */
const EGG_HUE = 45;
const P: Proj = { x: 0, y: 0, s: 1, d: 1 };

/** eggs laid: the eggs, their children, each one's image (baked when first seen), and whose they are */
interface Laid { eggs: Eggs; kids: Child[]; sprites: (Sprite | null)[]; partner: Spec; }

export function initPonte(deps: Deps) {
  let clutch: (Clutch & Laid & { quality: number; seed: number; opened: boolean; crosses: boolean }) | null = null;
  /** the clutches hatching: their eggs split one by one, and a child comes out of each */
  const hatchings: (Laid & { chosen: number })[] = [];
  /** the newborns growing to their size */
  const nursery: { cr: Creature3; t: number }[] = [];
  let plain: Sprite | null = null;
  let time = 0;

  function begin(l: Laid, chosen: number): void {
    hatchEggs(l.eggs, chosen);
    hatchings.push({ eggs: l.eggs, kids: l.kids, sprites: l.sprites, partner: l.partner, chosen });
  }

  const ponte = {
    /** the eggs waiting in the water, if any */
    get clutch() { return clutch; },
    /** are eggs hatching now */
    get hatching() { return hatchings.length > 0; },
    /** the newborns still growing */
    get newborns() { return nursery.map((n) => n.cr); },
    /** eggs of this partner, after a parade of this quality, laid at `at`; `now`: their brood opens at once */
    lay(partner: Spec, quality: number, at: Pt, now = false): void {
      // the clutch waiting before hatches: a new parade has chosen another partner, its eggs are left to their life
      if (clutch) begin(clutch, -1);
      const seed = Math.floor(Math.random() * 0xfffffff), home = deps.keep(at.x, at.y);
      const kids = deps.kids(partner, quality, seed);
      clutch = {
        ...newClutch(home.x, home.y), eggs: layEggs(at, home, EGG_COUNT), kids, sprites: kids.map(() => null),
        partner, quality, seed, opened: false, crosses: false
      };
      if (now) ponte.open();
    },
    /** opens their brood now */
    open(): void {
      if (!clutch) return;
      clutch.opened = true;
      deps.open(clutch.partner, clutch.quality, clutch.seed);
    },
    /** the brood was left for later: the eggs wait, and we know now whether one of them would cross */
    later(kids: readonly Child[]): void {
      if (!clutch) return;
      leaveClutch(clutch);
      clutch.crosses = deps.crosses(kids, clutch.x);
    },
    /** the brood is decided: the eggs hatch where they are, the chosen child (none: -1) first */
    hatch(chosen = -1): void {
      if (!clutch) return;
      begin(clutch, chosen);
      clutch = null;
    },
    /** where the thread of the hints may lead: eggs never opened, or that would cross */
    get calling(): Pt | null { return clutch && (!clutch.opened || clutch.crosses) ? { x: clutch.x, y: clutch.y } : null; },

    /** each step, with the swimmer at (px, py) */
    step(px: number, py: number, dt: number): void {
      time += dt;
      if (clutch) {
        const quiet = deps.busy();
        stepEggs(clutch.eggs, deps.water, quiet ? 0 : hatching(clutch), dt);
        if (!quiet && stepClutch(clutch, px, py, dt)) ponte.open();
      }
      for (let i = hatchings.length - 1; i >= 0; i--) {
        const h = hatchings[i];
        for (const k of stepEggs(h.eggs, deps.water, 0, dt)) {
          const e = h.eggs.list[k], sp = h.kids[k].spec;
          const cr = (k === h.chosen && deps.born(sp, { x: e.x, y: e.y }, h.partner, NEWBORN)) || deps.add(sp, e.x, e.y, NEWBORN);
          nursery.push({ cr, t: 0 });
        }
        if (gone(h.eggs)) hatchings.splice(i, 1);
      }
      for (let i = nursery.length - 1; i >= 0; i--) {
        const n = nursery[i], was = growth(n.t, NEWBORN, GROW_TIME);
        n.t += dt;
        rescale(n.cr, growth(n.t, NEWBORN, GROW_TIME) / was);
        deps.stir?.(n.cr);
        if (n.t >= GROW_TIME) nursery.splice(i, 1);
      }
    },

    /** each frame: the eggs as depth-sorted pieces, and their glow */
    items(s: EggScene, camX: number, push: (d: number, fn: () => void) => void): void {
      const [x0, x1] = s.view.xRange(0, 100);
      let baked = false;
      for (const l of clutch ? [clutch, ...hatchings] : hatchings) {
        const m = middle(l.eggs);
        if (Math.abs(m.x - camX) > 2600 || m.x < x0 || m.x > x1) continue;
        const k = l === clutch ? hatching(clutch) : 0, breathe = 0.85 + 0.15 * Math.sin(time * 1.6);
        l.eggs.list.forEach((e, i) => {
          if (!shown(e)) return;
          // the child inside each is baked once, one a frame; until then the egg is plain
          if (!l.sprites[i] && !baked) { l.sprites[i] = bakeEgg(EGG_R, l.kids[i].spec); baked = true; }
          const sp = l.sprites[i] ?? (plain ??= bakeEgg(EGG_R, null));
          push(s.view.depth(e.y, 0) - 0.25, () => drawEgg(s, sp, e, e.r / EGG_R));
          s.view.project(e.x, e.y, 0, P);
          const left = e.open > 0 ? 1 - e.open / SHELL : 1;
          s.lights.push(P.x, P.y, (e.r * 2.6 + 10 * k + 8 * e.crack) * P.s * breathe, EGG_HUE, (0.28 + 0.4 * k + 0.3 * e.crack) * breathe * left);
        });
      }
    }
  };
  return ponte;
}

export type Ponte = ReturnType<typeof initPonte>;

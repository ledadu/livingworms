// Taking again an earlier form of the lineage, in the world (retour.ts): chosen in the tree, here, in the chapter
// where we are. The one we were stays there among the animals, as a parent left behind; golden lights flow from it
// and gather into the new body, which comes out of them small and grows to its size, while the lineage says so.

import { STEP, spec as makeSpec, type Spec } from '../engine';
import { Creature3 } from '../engine3/creature3';
import { rescale } from '../engine3/grow';
import type { Proj, View } from '../engine3/view';
import type { Ancestor, Place } from './partie';
import { GLOW_HUE } from './partenaires';
import { FLOW, GROW, SMALL, WORDS, motesAt, sizeAt, type Pt } from './retour';

interface Deps {
  lineage(): readonly Ancestor[];
  /** the creature played, and the one played from now on */
  swimmer(): Creature3;
  play(cr: Creature3): void;
  /** the one we were stays here, among the animals, as a parent left behind */
  leave(cr: Creature3): void;
  /** the chapter at x, and where it starts */
  chapter(x: number): { id: string; x0: number };
  /** the saved game: the k-th ancestor's form taken again in this chapter, the one we were left at this place */
  save(k: number, chapter: string, at: Place): void;
  /** the new body may not cross the obstacle of this chapter: its hints wake up (indices-jeu.ts) */
  feel(chapter: string): void;
  /** the words of the lineage, under this name, now if nothing else is said (false: not now) */
  say(name: string, lines: string[]): boolean;
  /** something else is going on (a farewell, a parade, the Remontée…): not now */
  busy(): boolean;
}

const at = (cr: Creature3): Pt => ({ x: cr.root.x[0], y: cr.root.y[0] });

export function initRetour(d: Deps) {
  let scene: { from: Creature3; to: Creature3; s: number; size: number; told: boolean; name: string } | null = null;

  const retour = {
    /** the scene is playing */
    get on() { return !!scene; },
    /** a form can be taken again now */
    get can() { return !scene && !d.busy() && d.lineage().length > 0; },
    /** the swimmer takes again the form of the k-th ancestor (0: the first larva); false when it cannot now */
    take(k: number): boolean {
      const a = d.lineage()[k];
      if (!a || !retour.can) return false;
      let sp: Spec;
      try { sp = makeSpec(a.creature as Parameters<typeof makeSpec>[0]); } catch { return false; }
      const old = d.swimmer(), { x, y } = at(old), face = Math.cos(old.yaw) < 0 ? -1 : 1, c = d.chapter(x);
      const cr = new Creature3(sp, x + 46 * face, y + 10, 0, { dir: { x: face, y: 0, z: 0 }, scale: 0.8 * SMALL });
      cr.yaw = cr.yawGoal = old.yaw;
      for (let i = 0; i < 60; i++) cr.update(i * STEP, 0, 0, 0, 0.1);
      d.leave(old);
      d.play(cr);
      d.save(k, c.id, { x: Math.round(x - c.x0), y: Math.round(y) });
      d.feel(c.id);
      scene = { from: old, to: cr, s: 0, size: SMALL, told: false, name: sp.name };
      return true;
    },
    /** each step: the new body grows, the lineage speaks */
    step(): void {
      if (!scene) return;
      scene.s += STEP;
      const size = sizeAt(scene.s);
      rescale(scene.to, size / scene.size);
      scene.size = size;
      if (!scene.told && scene.s > 0.7) scene.told = d.say(scene.name, WORDS) || scene.s > 5;
      if (scene.s > Math.max(FLOW, GROW) && scene.told) scene = null;
    },
    /** the lights of the scene: x, y (screen), size, hue, alpha */
    lights(view: View, out: number[], P: Proj): void {
      if (!scene) return;
      const m = motesAt(scene.s, at(scene.from), at(scene.to));
      for (let i = 0; i < m.length; i += 4) {
        view.project(m[i], m[i + 1], 0, P);
        out.push(P.x, P.y, (16 * m[i + 2] + 4) * P.s + 4, GLOW_HUE, 0.9 * m[i + 3]);
      }
      // the new body glows while it grows
      const g = Math.max(0, 1 - scene.s / GROW), to = at(scene.to);
      if (g > 0) { view.project(to.x, to.y, 0, P); out.push(P.x, P.y, 90 * P.s + 20, GLOW_HUE, 0.6 * g * Math.min(1, scene.s * 3)); }
    }
  };
  return retour;
}

export type Retour = ReturnType<typeof initRetour>;

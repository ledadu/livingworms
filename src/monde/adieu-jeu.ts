// The farewell in the world (adieu.ts): who leads the swimmer while the scene plays, what the parents
// left behind do, where the camera looks, and the quiet around the words (adieu.css). The birth itself,
// the new creature and the parent kept among the animals, are done by main.ts (farewell).

import { fuse } from '../content';
import type { Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import { Farewell, T, stayGoal, type Pt, type Shot } from './adieu';
import type { Narrator } from './narration';
import './adieu.css';

const at = (cr: Creature3): Pt => ({ x: cr.root.x[0], y: cr.root.y[0] });

export function initAdieu(narrator: Narrator) {
  let scene: { f: Farewell; t0: number; chapter: number; parent: Creature3; child: Creature3; told: boolean } | null = null;
  let shot: Shot | null = null, dist = 0;
  const homes = new WeakMap<Creature3, { home: Pt; seed: number }>();

  const end = () => { scene = null; shot = null; document.body.classList.remove('adieu'); };

  return {
    /** the scene is playing (the swimmer is not ours) */
    get on() { return !!scene; },
    /** the child is born beside the parent, in chapter i: the scene begins */
    start(parent: Creature3, child: Creature3, time: number, i: number, floor = Infinity): void {
      const f = new Farewell(at(parent), 1, floor, parent.box[3] - parent.box[0]);
      homes.set(parent, { home: f.home, seed: time % 7 });
      scene = { f, t0: time, chapter: i, parent, child, told: false };
      document.body.classList.add('adieu');
    },
    /** each step: the swimmer's wished velocity while the scene leads it, else null */
    lead(time: number): Pt | null {
      if (!scene) return null;
      const s = time - scene.t0;
      if (!scene.told && s >= T.words) { scene.told = true; narrator.tell(scene.chapter, 'farewell'); }
      shot = scene.f.at(s, at(scene.parent), at(scene.child));
      if (!shot) { end(); return null; }
      return shot.child;
    },
    /** a parent left in an earlier visit (ancetres.ts): it stays by its home */
    stay(cr: Creature3, home: Pt): void { homes.set(cr, { home: { ...home }, seed: Math.abs(home.x) % 7 }); },
    /** is this creature a parent left behind */
    isParent: (cr: Creature3) => homes.has(cr),
    /** each step: the wished velocity of a parent left behind */
    parentGoal(cr: Creature3, time: number, swimmer: Pt): Pt {
      if (scene && shot && cr === scene.parent) return shot.parent;
      const h = homes.get(cr);
      return h ? stayGoal(at(cr), h.home, swimmer, time, h.seed) : { x: 0, y: 0 };
    },
    /** each frame: where the camera looks (null: on the swimmer, as always) and from how far, eased from the player's own distance */
    camera(own: number, W: number, H: number): { focus: Pt | null; dist: number } {
      if (!dist || (!shot && Math.abs(dist - own) < 2)) dist = own;
      else {
        // the water seen across the narrower side, per unit of distance (the vertical field of view of main.ts)
        const across = (W < H ? 0.975 * W : 0.81 * H) / Math.max(1, H);
        const want = shot ? own + (Math.min(own, shot.span / across) - own) * shot.close : own;
        dist += (want - dist) * 0.025;
      }
      return { focus: shot ? shot.focus : null, dist };
    }
  };
}

/** a child for trying the scene without a courtship: the parent fused with a partner, a bit more of the parent */
export function testChild(parent: Spec, partner: Spec): Spec {
  return fuse(parent, partner, { share: 0.4 });
}

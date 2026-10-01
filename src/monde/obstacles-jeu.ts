// The key obstacles in the game: the traits of the swimmer's body decide which
// obstacles it crosses (obstacles.ts), the obstacle it swims into holds it back
// its own way, and the first time one bars the way, the lineage says what it
// would take.

import { clamp, type Spec } from '../engine';
import type { ChapterId } from './biomes';
import { GATES, reach, type CanCross, type Limits } from './limites';
import { OBSTACLE, crossWith, feel, type Obstacle, type Trait } from './obstacles';
import { traitsOf } from '../content/traits';

export interface Near { chapter: ChapterId; gate: number; o: Obstacle; open: boolean; }

export function createKeys(limits: Limits, body: () => Spec) {
  let spec: Spec | null = null, traits: Trait[] = [], rule: CanCross = () => true;
  const told = new Set<ChapterId>();
  let forced: Trait[] | null = null;
  const sync = () => {
    const sp = body();
    if (sp !== spec || keys.force !== forced) { spec = sp; forced = keys.force; traits = keys.force ?? traitsOf(sp); rule = crossWith(traits); }
  };

  const keys = {
    /** tests: play as if the body had these traits (null: its own) */
    force: null as Trait[] | null,
    /** the traits of the swimmer's body */
    get traits(): Trait[] { sync(); return traits; },
    /** whether the swimmer crosses the obstacle of this chapter */
    can(c: ChapterId): boolean { sync(); return rule(c); },
    /** how far the swimmer may go along x */
    bounds(): [number, number] { sync(); return reach(limits, rule); },
    /** the obstacle whose reach the swimmer at x is in */
    near(x: number): Near | null {
      for (const g of GATES) {
        const o = OBSTACLE[g.chapter];
        if (!o || x < g.x - o.soft || x > g.x + 60) continue;
        return { chapter: g.chapter, gate: g.x, o, open: limits.beyond || limits.crossed.has(g.chapter) || keys.can(g.chapter) };
      }
      return null;
    },
    /** the swimming of the swimmer at x, held back by the obstacle it is in */
    steer(x: number, dvx: number, dvy: number): [number, number] {
      const n = keys.near(x);
      return n ? feel(n.o, n.gate, x, dvx, dvy, n.open) : [dvx, dvy];
    },
    /** how much the dark closes in before an obstacle that hides the way, still barred (0..1) */
    dark(x: number): number {
      const n = keys.near(x);
      return n && !n.open && n.o.hold === 'hide' ? 0.97 * clamp((x - (n.gate - n.o.soft)) / n.o.soft, 0, 1) : 0;
    },
    /** tells once the words of an obstacle the swimmer presses into (returns false while it cannot) */
    onBarred: (_c: ChapterId): boolean => false,
    /** each step, with the swimmer at x */
    update(x: number): void {
      const n = keys.near(x);
      if (!n || n.open || told.has(n.chapter) || x < n.gate - n.o.soft * 0.45) return;
      if (keys.onBarred(n.chapter)) told.add(n.chapter);
    }
  };
  return keys;
}

export type Keys = ReturnType<typeof createKeys>;

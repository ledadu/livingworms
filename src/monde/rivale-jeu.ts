// The rival lineage in the world (rivale.ts for its rules): its cousin is made the first time we come into the
// Carcasse, from the creature of our lineage that got there, and waits among the bones. It turns to us, swims with us
// for a while, and the first time we meet it the words of the lineage come.

import { spec as makeSpec, type Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import type { Proj, View } from '../engine3/view';
import { traitsOf } from '../content/traits';
import { chapterIndex, floorAt, span } from './biomes';
import { CARCASSE, WHALE_LENGTH } from './carcasse';
import type { Narrator } from './narration';
import { MEET, NOTICE, arrivedAt, cousinGoal, cousinHue, cousinLight, hashOf, rivalLineage, type Pt, type Rival } from './rivale';

interface Deps {
  /** the lineage as saved (partie.ts): the ancestors, each with the chapter where it gave birth */
  lineage(): readonly { creature: object; chapter: string }[];
  /** the creature played now */
  played(): Spec;
  /** the cousin joins the animals of the world at (x, y) */
  add(sp: Spec, x: number, y: number): Creature3;
  narrator: Narrator;
  /** while this is true (other words on the screen, a panel, a farewell), the words of the meeting wait */
  quiet(): boolean;
}

const at = (cr: Creature3): Pt => ({ x: cr.root.x[0], y: cr.root.y[0] });

export function initRivale(deps: Deps) {
  const chapter = chapterIndex('carcasse'), [x0, x1] = span('carcasse');
  /** above the ribs, in the swimming plane */
  const home: Pt = { x: CARCASSE.x, y: floorAt(CARCASSE.x, 0) - 170 };
  let rival: Rival | null = null, cr: Creature3 | null = null, met = false, tried = 0, noticed = -1;

  /** the creature of our lineage that reached the Carcasse */
  function ours(): Spec {
    const saved = arrivedAt(deps.lineage(), null);
    try { return saved ? makeSpec(saved as Parameters<typeof makeSpec>[0]) : deps.played(); } catch { return deps.played(); }
  }

  function make(): void {
    const sp = ours(), traits = traitsOf(sp);
    rival = rivalLineage(traits, hashOf(sp.name + ':' + traits.join(',')));
    cr = deps.add(rival.spec, home.x + WHALE_LENGTH * 0.3, home.y);
  }

  return {
    /** each step: the cousin is made when we first come into the Carcasse; the words the first time we meet it */
    step(swimmer: Pt, time: number): void {
      if (!cr) { if (swimmer.x >= x0 && swimmer.x < x1 + 1500) make(); return; }
      const p = at(cr), d = Math.hypot(p.x - swimmer.x, p.y - swimmer.y);
      if (noticed < 0 && d < NOTICE) noticed = time;
      if (met || time < tried || d > MEET) return;
      tried = time + 1;
      if (!deps.quiet()) met = deps.narrator.tell(chapter, 'meeting');
    },
    /** each step: its wished velocity */
    goal: (c: Creature3, time: number, swimmer: Pt): Pt => cousinGoal(at(c), home, swimmer, time, 3.1, WHALE_LENGTH * 0.4),
    /** each frame: its light, in its own colour, around the middle of its body */
    lights(view: View, out: number[], P: Proj, time: number, swimmer: Pt): void {
      if (!cr || !rival) return;
      const r = cr.root, k = r.x.length >> 1;
      const al = cousinLight(Math.hypot(r.x[k] - swimmer.x, r.y[k] - swimmer.y), noticed < 0 ? -1 : time - noticed, time);
      if (al < 0.01) return;
      view.project(r.x[k], r.y[k], r.z[k], P);
      out.push(P.x, P.y, 70 * P.s + 14, cousinHue(rival.spec.palette.hue), 0.55 * al);
    },
    home,
    /** the other lineage (its cousin's definition and the partners it chose), once made */
    get rival() { return rival; },
    get cr() { return cr; },
    get met() { return met; },
    /** make it now (tests) */
    make: () => { if (!cr) make(); return rival; }
  };
}

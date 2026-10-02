// The dances in the world (engine3/dance.ts for the steps and the dances): a creature dances on the beat of the music
// of its chapter, alone or with another (one leads, the other answers), its steps a few angles laid over its swim, and
// a soft note of D major marks the strong beats (danse-son.ts). The dance for two of a parade plays its real dances
// here (parade-jeu.ts); monde.danse.play(animal, 'twist') to try one, and with ?dev, a list in the ⚙ panel plays each
// on the swimmer.

import type { Creature3 } from '../engine3/creature3';
import { DANCES, DANCE_IDS, accentAt, done, kitOf, perform, type Accent, type Choreo, type DanceId, type Kit } from '../engine3/dance';
import { newGroove, type Groove } from '../engine3/groove';
import { BIOMES, biomeIndex } from './biomes';
import { beatOf } from './danse';
import { initDanseSon } from './danse-son';
import { AMBIENCES } from './musique';

interface Show {
  cr: Creature3; d: Choreo; role: 0 | 1; kit: Kit; g: Groove;
  /** the length of its beat (s), when it began (s), the beat it was at the step before */
  beat: number; t0: number; b: number;
  /** it stays where it is (an animal of the world), its strong beats sound */
  hold: boolean; sound: boolean;
}

/** a creature, or an animal of the world (monde.actors, monde.player, monde.spawn…) */
type Who = Creature3 | { cr: Creature3 };

export interface PlayOptions {
  /** 0: leads (the default), 1: answers (mirrored, in canon…) */
  role?: 0 | 1;
  /** another one dances it with it, answering, the two turned to each other */
  with?: Who;
  /** the length of a beat (s); the default: the chapter's where it is */
  beat?: number;
  /** begun this long ago (s) */
  ago?: number;
  /** it stays where it is while it dances (held by the game); the default: any but the swimmer */
  hold?: boolean;
  /** its strong beats sound (the default: for the one who leads) */
  sound?: boolean;
}

interface Deps {
  /** the swimmer's body: it is never held */
  swimmer?(): Creature3;
  /** where on the screen a point of the world is heard from (-1: left, 1: right) */
  pan?(x: number, y: number): number;
  /** an accent of a strong beat, from a point of the world (the default: danse-son.ts) */
  accent?(kind: Accent, x: number, y: number): void;
}

/** turns a creature to face right (dir > 0) or left, as its own way of swimming would (a bell has no side) */
export function faceTo(cr: Creature3, dir: number): void {
  const right = dir > 0;
  switch (cr.mode) {
    case 'bell': return;
    case 'jet': cr.yawGoal = right ? 0.3 : Math.PI - 0.3; return;
    case 'crawl': cr.yawGoal = Math.atan2(-0.6, right ? 1 : -1) + (cr.spec.swim.rear ? Math.PI : 0); return;
    default: cr.yawGoal = right ? 0 : Math.PI;
  }
}

export function initDanse(deps: Deps = {}) {
  const shows: Show[] = [];
  let now = 0, sound: ReturnType<typeof initDanseSon> | null = null;
  const accent = deps.accent ?? ((k: Accent, x: number, y: number) => (sound ??= initDanseSon()).accent(k, deps.pan?.(x, y) ?? 0));

  /** the beat of the dances where x is: the chapter's music */
  const beatAt = (x: number) => beatOf(AMBIENCES[BIOMES[biomeIndex(x)].id].motif.step);

  function stop(who: Who): void {
    const cr = body(who), i = shows.findIndex((s) => s.cr === cr);
    if (i < 0) return;
    if (cr.groove === shows[i].g) cr.groove = null;
    shows.splice(i, 1);
  }

  const body = (w: Who): Creature3 => ('cr' in w ? w.cr : w);

  /** a dance on a creature, from now (or `ago` s ago); a dance it was dancing stops */
  function play(who: Who, id: DanceId, o: PlayOptions = {}): boolean {
    const d = DANCES[id], cr = body(who);
    if (!d) return false;
    stop(cr);
    const role = o.role ?? 0, beat = o.beat ?? beatAt(cr.root.x[0]), g = newGroove(), hold = o.hold ?? cr !== deps.swimmer?.();
    shows.push({ cr, d, role, kit: kitOf(cr), g, beat, t0: now - (o.ago ?? 0), b: -1, hold, sound: o.sound ?? role === 0 });
    cr.groove = g;
    if (o.with) {
      const other = body(o.with), dx = other.root.x[0] - cr.root.x[0];
      play(other, id, { ...o, with: undefined, role: 1, beat, sound: false, hold: undefined });
      faceTo(cr, dx); faceTo(other, -dx);
    }
    return true;
  }

  return {
    /** the dances one may play, and their names */
    list: DANCE_IDS.map((id) => ({ id, name: DANCES[id].name })),
    beatAt, play, stop,
    /** each step, before the bodies move, at the time of the game t (s): the grooves of the dancers, the accents */
    step(t: number): void {
      now = t;
      for (let i = shows.length - 1; i >= 0; i--) {
        const s = shows[i], b = (t - s.t0) / s.beat;
        // over, or something else took its body
        if (done(s.d, b) || s.cr.groove !== s.g) {
          if (s.cr.groove === s.g) s.cr.groove = null;
          shows.splice(i, 1);
          continue;
        }
        s.kit.face = Math.cos(s.cr.yaw) < 0 ? -1 : 1;
        perform(s.g, s.d, s.role, b, s.kit);
        const a = s.sound ? accentAt(s.d, s.b, b) : null;
        if (a) accent(a, s.cr.root.x[0], s.cr.root.y[0]);
        s.b = b;
      }
    },
    /** this creature dances and stays where it is (the game holds it) */
    holds(cr: Creature3): boolean { return shows.some((s) => s.cr === cr && s.hold); },
    /** the dance this creature dances, or null */
    of(cr: Creature3): DanceId | null { return shows.find((s) => s.cr === cr)?.d.id ?? null; },
    /** the dances playing (tests): which, the role, the beat (s) and where they are in it (beats) */
    get playing() { return shows.map((s) => ({ id: s.d.id, role: s.role, beat: s.beat, at: +s.b.toFixed(2) })); },
    /** with ?dev: a list in the ⚙ panel, after `after`, each dance played on the swimmer (`who`) */
    devList(after: HTMLElement, who: () => Creature3, picked?: () => void): void {
      const h = document.createElement('h2'), box = document.createElement('div');
      h.textContent = 'Danses';
      box.className = 'presets';
      for (const { id, name } of this.list) {
        const btn = document.createElement('button');
        btn.textContent = name.replace(/^(La |Le )/, '');
        btn.title = name;
        btn.addEventListener('click', () => { play(who(), id); picked?.(); });
        box.append(btn);
      }
      after.after(h, box);
    }
  };
}

export type DanseGame = ReturnType<typeof initDanse>;

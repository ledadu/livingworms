// The lights that answer in the Fosse, in the game (lumieres.ts for the rules). Nearing the Fosse, the other lineages
// come down one birth per step. Each note sung in the Fosse brings the ancestor that learned it: far away in the dark it
// flashes its answer, then comes to swim beside us, lit by its own light. Once every note learned has had its answer,
// the song has crossed the dark: the Fosse's obstacle opens, all the lights shine at once, and the lineage speaks.

import doc from '../../docs/chapitres.md?raw';
import { clamp, type Spec } from '../engine';
import type { Creature3 } from '../engine3/creature3';
import type { Gfx } from '../engine3/gfx';
import type { Proj, View } from '../engine3/view';
import { BIOMES, biomeIndex, chapterIndex, span, type ChapterId } from './biomes';
import { cousinHue } from './rivale';
import {
  DESCENT, ECHO, SETTLED, answerAt, answerGlow, answerGoal, answerLight, answered, dirOf, parseAnswerText, seedOf,
  farAlong, spotOf, startWalk, walkStep, walked, type Pt, type Walk
} from './lumieres';
import { drawAnswer } from './lumieres-draw';

const WORDS = parseAnswerText(doc);
const FOSSE = chapterIndex('fosse');
/** the other lineages start down when we are this far before the Fosse */
const EARLY = 2500;

interface Deps {
  /** the notes our lineage has learned, in the order of the descent */
  learned(): readonly ChapterId[];
  /** the seed of this game: the same game, the same lights */
  seed(): number;
  /** the cousin of the rival lineage, if we met it: its generation learned the note of the Carcasse */
  cousin(): Spec | null;
  /** an answer joins the animals of the world at (x, y), at this scale */
  add(sp: Spec, x: number, y: number, scale: number): Creature3;
  /** the nearest place in open water, within reach */
  keep(p: Pt): Pt;
  /** how far the screen reaches from the swimmer along this direction (world px) */
  room(d: Pt): number;
  /** the song crossed the Fosse's obstacle */
  open(): void;
  /** the words of the lineage, under a name (false: not now) */
  say(name: string, lines: string[]): boolean;
}

export interface Answer {
  /** the chapter of the note it answers */
  note: ChapterId;
  /** its rank among the answers */
  k: number;
  /** when it begins to answer (s, the time of the world) */
  start: number;
  /** where it answers from, once it has begun */
  far: Pt | null;
  cr: Creature3 | null;
  hue: number;
  /** it has come to its place beside us */
  settled: boolean;
  /** when a note it knows was last sung again (-1: never) */
  echo: number;
  buf: HTMLCanvasElement | null;
}

/** the scale of the animals of the world */
const SCALE = 0.8;
const mid = (cr: Creature3): Pt => { const r = cr.root, k = r.x.length >> 1; return { x: r.x[k], y: r.y[k] }; };

export function initLumieres(deps: Deps) {
  const [x0] = span('fosse');
  const walks = new Map<ChapterId, Walk>(), answers: Answer[] = [], byCr = new Map<Creature3, Answer>();
  const doneFns: (() => void)[] = [];
  let time = 0, swimmer: Pt = { x: 0, y: 0 }, last = -99, done = false, bloom = -1, told = false, retry = 0;

  const inFosse = (p: Pt) => biomeIndex(p.x) === FOSSE;
  /** within the Fosse and the open water */
  const within = (p: Pt) => deps.keep({ x: Math.max(x0 + 150, p.x), y: p.y });

  function walkOf(note: ChapterId): Walk {
    let w = walks.get(note);
    if (!w) walks.set(note, (w = startWalk(note, seedOf(note, deps.seed()))));
    return w;
  }

  /** its body: the cousin met at the Carcasse answers the note of the Carcasse, another lineage every other note */
  function specOf(note: ChapterId): Spec {
    const c = note === 'carcasse' ? deps.cousin() : null;
    if (c) return c;
    const w = walkOf(note);
    while (!walked(w)) walkStep(w);
    return w.spec;
  }

  /** one birth of the other lineages per step: those of the answers to come first, then those of the notes learned */
  function prepare(): void {
    const next = [...answers.filter((a) => !a.cr).map((a) => a.note), ...deps.learned()]
      .find((n) => !(n === 'carcasse' && deps.cousin()) && !walked(walkOf(n)));
    if (next) walkStep(walkOf(next));
  }

  function begin(a: Answer): void {
    const sp = specOf(a.note), d = dirOf(a.k), far = farAlong(deps.room(d));
    a.far = within({ x: swimmer.x + d.x * far, y: swimmer.y + d.y * far });
    a.hue = cousinHue(sp.palette.hue);
    a.cr = deps.add(sp, a.far.x, a.far.y, SCALE);
    byCr.set(a.cr, a);
  }

  const api = {
    /** a note was sung (the chapter whose note it is): false when no light answers it here */
    hear(note: ChapterId): boolean {
      if (!inFosse(swimmer) || !DESCENT.includes(note)) return false;
      const a = answers.find((q) => q.note === note);
      if (a) { if (time >= a.start) a.echo = time; return true; }
      last = answerAt(time, last);
      answers.push({ note, k: answers.length, start: last, far: null, cr: null, hue: 0, settled: false, echo: -1, buf: null });
      return true;
    },
    /** each step, with the swimmer at p */
    step(p: Pt, t: number): void {
      time = t; swimmer = p;
      if (p.x > x0 - EARLY) prepare();
      for (const a of answers) {
        if (!a.cr) { if (t >= a.start) begin(a); continue; }
        const at = { x: a.cr.root.x[0], y: a.cr.root.y[0] }, spot = within(spotOf(a.k, p, t));
        if (!a.settled && t - a.start > ECHO && Math.hypot(at.x - spot.x, at.y - spot.y) < SETTLED) a.settled = true;
      }
      if (!done && answers.length && answered(deps.learned(), new Set(answers.filter((a) => a.settled).map((a) => a.note)))) {
        done = true; bloom = t;
        deps.open();
        for (const f of doneFns) f();
      }
      if (done && !told && t > bloom + 2 && t >= retry) { retry = t + 1; told = deps.say(BIOMES[FOSSE].name, WORDS); }
    },
    /** each step: the wished velocity of an answer */
    goal(cr: Creature3, t: number, p: Pt): Pt {
      const a = byCr.get(cr);
      if (!a?.far) return { x: 0, y: 0 };
      return answerGoal({ x: cr.root.x[0], y: cr.root.y[0] }, a.far, within(spotOf(a.k, p, t)), p, t - a.start);
    },
    /** how bright an answer shines now */
    light(a: Answer, t: number): number {
      return answerLight(t - a.start, t, a.k, a.echo >= 0 ? t - a.echo : -1, bloom >= 0 ? t - bloom : -1);
    },
    /** each frame: the light of each answer, in its own colour, around the middle of its body */
    lights(view: View, out: number[], P: Proj, t: number): void {
      for (const a of answers) {
        if (!a.cr) continue;
        const l = api.light(a, t), m = mid(a.cr);
        if (l < 0.01) continue;
        view.project(m.x, m.y, a.cr.root.z[a.cr.root.x.length >> 1], P);
        out.push(P.x, P.y, (46 * P.s + 14) * (1 + 0.6 * Math.min(1, l)), a.hue, Math.min(1, 0.62 * l));
      }
    },
    /** how much the answers beside us add to our light (the glow of fosse.ts) */
    glow(p: Pt): number {
      let g = 0;
      for (const a of answers) if (a.cr) { const m = mid(a.cr); g += answerGlow(Math.hypot(m.x - p.x, m.y - p.y)); }
      return g;
    },
    /** each frame, after the dark: their bodies, lit by their own light */
    draw(gx: Gfx | null, ctx: CanvasRenderingContext2D, view: View, dpr: number, t: number): void {
      for (const a of answers) {
        if (!a.cr) continue;
        const [lo, hi] = view.xRange(a.cr.root.z[0], 300), x = a.cr.root.x[0];
        if (x < lo || x > hi) continue;
        a.buf = drawAnswer(gx, ctx, view, dpr, a.cr, a.hue, clamp(0.3 + 0.55 * api.light(a, t), 0, 0.92), a.buf);
      }
    },
    /** called once the song has crossed the dark (the Remontée may start from there) */
    onDone(f: () => void): void { doneFns.push(f); },
    /** the answers so far, in their order */
    answers: answers as readonly Answer[],
    /** the other lineages, by note, as far as they came down */
    walks: walks as ReadonlyMap<ChapterId, Walk>,
    /** every note learned has had its answer: the Fosse is open */
    get done() { return done; },
    get told() { return told; }
  };
  return api;
}

export type Lumieres = ReturnType<typeof initLumieres>;

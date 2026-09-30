// The traces of the lineage in the world (traces.ts): laid out from the saved
// lineage, and again at each birth; drawn with the scene (traces-draw.ts), with a
// faint light that shows in the dark; the first time the swimmer comes near one,
// the lineage says its words under the ancestor's name.

import doc from '../../docs/chapitres.md?raw';
import { spec as makeSpec, type Spec } from '../engine';
import type { Proj, View } from '../engine3/view';
import { floorAt, moodAt } from './biomes';
import { waterAt } from './palette';
import type { Ancestor } from './partie';
import { carve, solidAt } from './relief';
import { fogOf, type Sprite } from './sprites';
import { bakeTrace, traceLight, washed } from './traces-draw';
import { parseTraceTexts, tracesOf, worldPlaces, type Trace } from './traces';

const TEXTS = parseTraceTexts(doc);
/** how near the swimmer comes (along x, and above it) before the lineage speaks */
const NEAR_X = 260, NEAR_Y = 320;
/** a trace is baked once, fine enough for a close look (px per unit); only its wash by the water is made again */
const RES = 2;

export interface PlacedTrace extends Trace {
  /** the floor under it */
  y: number;
  spec: Spec;
  /** the ancestor's name, as the lineage tree may have changed it */
  name: string;
  /** as baked, and as washed by the water at `fog` */
  base: Sprite | null; sprite: Sprite | null; fog: number;
  /** when its words were said (performance.now(), this session), 0 before */
  toldAt: number;
}

export interface TraceScene {
  view: View; dpr: number; plane: number;
  /** the scene's own way of drawing a baked image at x, y, z */
  draw: (sp: Sprite, x: number, y: number, z: number) => void;
  /** lights drawn after the dark: x, y (screen), size, hue, alpha */
  lights: number[];
}

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };
/** a spot clear of the reliefs and of the deep of a fault */
const free = (x: number, z: number) => !solidAt(x, floorAt(x, z) - 10, z) && carve(x, z) < 20;

/** the traces of the lineage the saved game keeps; `say` gives the words to the narrator (false: not now) */
export function initTraces(lineage: () => readonly Ancestor[], say: (name: string, lines: string[]) => boolean) {
  const places = worldPlaces();
  let seen: readonly Ancestor[] | null = null, list: PlacedTrace[] = [];
  let bakes = 0;

  function sync(): PlacedTrace[] {
    const l = lineage();
    if (l === seen) return list;
    seen = l;
    const old = new Map(list.map((p) => [`${p.gen}:${p.chapter}:${p.x}`, p]));
    list = [];
    for (const t of tracesOf(l, places, free)) {
      const kept = old.get(`${t.gen}:${t.chapter}:${t.x}`), name = l[t.gen].creature.name;
      if (kept) { if (typeof name === 'string') kept.name = name; list.push(kept); continue; }
      let sp: Spec;
      try { sp = makeSpec(l[t.gen].creature as Parameters<typeof makeSpec>[0]); } catch { continue; }
      list.push({ ...t, y: floorAt(t.x, t.z), spec: sp, name: sp.name, base: null, sprite: null, fog: -1, toldAt: 0 });
    }
    return list;
  }

  function drawOne(s: TraceScene, p: PlacedTrace): void {
    const m = moodAt(p.x);
    if (!p.base && bakes++ < 1) p.base = bakeTrace(p, p.spec, m, RES);
    if (!p.base) return;
    const fog = fogOf(s.view.depth(p.y, p.z), s.plane);
    if (!p.sprite || Math.abs(fog - p.fog) > 0.04) { p.sprite = washed(p.base, fog, waterAt(m, p.y * 0.5 + p.z * 0.3)); p.fog = fog; }
    s.draw(p.sprite, p.x, p.y, p.z);
  }

  return {
    /** the traces laid out now */
    get list(): readonly PlacedTrace[] { return sync(); },
    /** each step: the words of a trace the swimmer comes near for the first time */
    step(px: number, py: number): void {
      for (const p of sync()) {
        if (p.toldAt || Math.abs(p.x - px) > NEAR_X || p.y - py > NEAR_Y || py > p.y + 60) continue;
        const lines = TEXTS[p.kind];
        if (!lines || say(p.name, lines)) p.toldAt = performance.now();
      }
    },
    /** each frame: the traces near the camera as depth-sorted pieces, and their lights */
    items(s: TraceScene, camX: number, push: (d: number, fn: () => void) => void): void {
      bakes = 0;
      const now = performance.now();
      for (const p of sync()) {
        if (Math.abs(p.x - camX) > 2600) continue;
        const [x0, x1] = s.view.xRange(p.z, 300);
        if (p.x < x0 || p.x > x1) continue;
        push(s.view.depth(p.y, p.z), () => drawOne(s, p));
        // its light blooms while the lineage speaks of it
        const [up, r, hue, al] = traceLight(p.kind, p.spec), since = p.toldAt ? (now - p.toldAt) / 1000 : 99;
        const bloom = since < 8 ? Math.min(1, since / 1.5) * (1 - Math.max(0, since - 2) / 6) : 0;
        s.view.project(p.x, p.y - up, p.z, P);
        s.lights.push(P.x, P.y, r * P.s * (1 + bloom * 0.8), hue, al + bloom * 0.4);
      }
    }
  };
}

// The water that bends, in the game (ondes.ts for its shapes, ondes-gl.ts for the lens, ondes-champ.ts for the field
// of waves): the rings of the song, of the answers and of the cries of the big animals far away, the shimmer of the
// chimneys and of the obstacles, the surface overhead. WebGL only: on the 2D canvas the water stays still.

import type { Creature3 } from '../engine3/creature3';
import { hsl01, type Gfx } from '../engine3/gfx';
import type { Proj, View } from '../engine3/view';
import { noteOf } from './chant';
import { GATES, travelShown } from './limites';
import { OBSTACLE } from './obstacles';
import { HAZE, RINGS, callGap, flowBox, haze, liveRings, plume, pruneRings, regions, rippleBox, ringAt, surface, type Flow, type Rect, type Ring, type RingKind, type Ripple } from './ondes';
import { MAX_FLOWS, MAX_RINGS, createLens, type FieldView, type Scene } from './ondes-gl';
import { Champ } from './ondes-champ';
import type { Mood } from './palette';
import { fogOf } from './sprites';
import { ventMouth, type Decor } from './world';

export type OndesMode = 'anneaux' | 'champ' | 'off';

interface Lit { cr: Creature3 | null; start: number; echo: number; hue: number }

export interface OndesDeps {
  gx: Gfx | null;
  view: View;
  /** the chimneys of the Sources (world.ts) */
  vents: readonly Decor[];
  floorAt(x: number, z: number): number;
  ceilAt(x: number, z: number): number;
  swimmer(): Creature3;
  /** the big animals passing far away (main.ts) */
  visitors: readonly { cr: Creature3 }[];
  /** the lights that answer in the Fosse (lumieres-jeu.ts), and whether they all shine at once now */
  answers(): readonly Lit[];
  bloomed(): boolean;
  /** the animals swimming in the plane near the swimmer: they stir the field of waves */
  stirring(): Iterable<Creature3>;
  /** the layers not drawn (main.ts): 'ondes' stills the water */
  skip: ReadonlySet<string>;
}

/** a note's colour, a little paler: the light its crests catch */
function noteRgb(chapter: string): number[] {
  const n = noteOf(chapter);
  if (!n) return [0.85, 0.95, 1];
  return hsl01(n.hue, n.sat, n.light).map((c) => c * 0.75 + 0.25);
}

/** the rings sung in the swimming plane: in the field of waves, waves of the field */
const SUNG: RingKind[] = ['song', 'answer', 'learn', 'rise'];

export function initOndes(d: OndesDeps) {
  const lens = d.gx ? createLens(d.gx.gl) : null;
  const search = typeof location === 'undefined' ? '' : location.search, q = new URLSearchParams(search).get('ondes');
  let mode: OndesMode = q === '0' ? 'off' : q === 'champ' ? 'champ' : 'anneaux';
  let field: Champ | null = null;
  const rings: Ring[] = [];
  const P: Proj = { x: 0, y: 0, s: 1, d: 1 };
  const calls = d.visitors.map(() => ({ next: -1, k: 0 }));
  const flashes = new Map<Lit, { n: number; echo: number }>();
  let bloom = false, now = 0, glints: Scene | null = null, ambient = true;
  /** stilled by late frames: until when, and for how long the next time */
  let stillUntil = -1, stillFor = 30;
  const stats = { rings: 0, flows: 0, regions: 0, pixels: 0, ms: 0 };
  /** the open water of a column of the swimming plane */
  const span = (x: number): [number, number] => { const c = d.ceilAt(x, 0); return [Number.isFinite(c) ? Math.max(0, c) : 0, d.floorAt(x, 0)]; };

  /** a wave from (x, y, z), from now (or `delay` s later) */
  function ring(kind: RingKind, x: number, y: number, z: number, rgb: readonly number[] = [0.85, 0.95, 1], size = RINGS[kind].size, delay = 0): void {
    if (mode === 'champ' && field && SUNG.includes(kind)) { field.push(x, y, kind === 'answer' ? 24 : 36, kind === 'answer' ? 2.2 : 4); return; }
    rings.push({ kind, x, y, z, t0: now + delay, size, rgb });
  }

  /** a note sung by this creature (the swimmer, or an animal that answers it): its wave leaves with its light */
  function sung(kind: RingKind, cr: Creature3, chapter: string): void {
    const r = cr.root;
    ring(kind, r.x[0], r.y[0], r.z[0], noteRgb(chapter), kind === 'answer' ? RINGS.answer.size + r.rad[0] * 6 : RINGS[kind].size);
  }

  const mid = (cr: Creature3) => cr.root.x.length >> 1;
  function flash(a: Lit): void {
    const r = a.cr!.root, k = mid(a.cr!);
    ring('light', r.x[k], r.y[k], r.z[k], hsl01(a.hue, 90, 72));
  }

  /** each step of the world, the swimmer at (px, py) */
  function step(t: number, px: number, py: number): void {
    now = t;
    pruneRings(rings, t);
    // the water stilled by late frames shimmers again after a while (a slow start, a page left and back)
    if (stillUntil >= 0 && t > stillUntil) { ambient = true; stillUntil = -1; }
    // the big animals cry now and then, when they can be seen
    d.visitors.forEach((v, i) => {
      const r = v.cr.root, c = calls[i];
      d.view.project(r.x[0], r.y[0], r.z[0], P);
      if (P.x < -100 || P.x > d.view.W + 100 || P.y < -100 || P.y > d.view.H + 100) return;
      if (c.next < 0) c.next = t + 4 + callGap(i, -1) * 0.25;
      if (t < c.next) return;
      c.next = t + callGap(i, c.k++);
      ring('call', r.x[0], r.y[0], r.z[0]);
      ring('call', r.x[0], r.y[0], r.z[0], undefined, RINGS.call.size * 0.8, 1.6);
    });
    // the lights that answer in the Fosse: a wave with each of their three flashes, their echoes, their bloom
    const lit = d.answers();
    for (const a of lit) {
      if (!a.cr) continue;
      let f = flashes.get(a);
      if (!f) flashes.set(a, (f = { n: 0, echo: -1 }));
      while (f.n < 3 && t >= a.start + f.n * 0.8) { f.n++; flash(a); }
      if (a.echo >= 0 && a.echo !== f.echo) { f.echo = a.echo; flash(a); }
    }
    if (d.bloomed() && !bloom) for (const a of lit) if (a.cr) flash(a);
    bloom = d.bloomed();
    // the field of waves: it follows the swimmer, the animals in the plane stir it
    if (mode !== 'champ') { field = null; return; }
    field ??= new Champ();
    field.follow(px, py, span);
    for (const cr of d.stirring()) {
      const sp = Math.hypot(cr.vx, cr.vy);
      if (sp > 0.3) field.push(cr.root.x[0], cr.root.y[0], Math.max(10, cr.root.rad[0] * 1.3), Math.min(0.22, sp * 0.035));
    }
    field.step();
  }

  /**
   * In the middle of the frame, once what lies behind the swimming plane is painted: the water bends over it
   * (WebGL); plane: the distance of the swimming plane
   */
  function bend(m: Mood, plane: number, dpr: number, t: number): void {
    stats.rings = stats.flows = stats.regions = stats.pixels = 0;
    glints = null;
    if (!lens?.ok || !d.gx || mode === 'off' || d.skip.has('ondes')) return;
    const t0 = performance.now(), view = d.view, W = view.W, H = view.H;
    const ripples: Ripple[] = [], flows: Flow[] = [], boxes: Rect[] = [];
    for (const r of liveRings(rings, t, MAX_RINGS)) {
      const look = RINGS[r.kind], a = ringAt(look, t - r.t0, r.size);
      if (!a) continue;
      view.project(r.x, r.y, r.z, P);
      if (P.d < 40) continue;
      const s = P.s, clear = 1 - 0.7 * fogOf(P.d, plane);
      const p: Ripple = { x: P.x, y: P.y, r: a.r * s, w: a.w * s, amp: look.amp * a.k * s * clear, crests: look.crests, glint: look.glint * a.k * clear * 0.55, shade: 0.24 * a.k * clear, rgb: r.rgb };
      ripples.push(p); boxes.push(rippleBox(p));
    }
    // the hot water over the chimneys, the four nearest
    const hot: [number, Flow][] = [];
    if (ambient) for (const v of d.vents) {
      const [x0, x1] = view.xRange(v.z, 200);
      if (v.x < x0 || v.x > x1) continue;
      view.project(v.x, d.floorAt(v.x, v.z) + ventMouth(v), v.z, P);
      const f = plume(P.x, P.y, P.s, v.seed % 100);
      f.amp *= 1 - fogOf(P.d, plane);
      if (f.amp > 0.2) hot.push([P.d, f]);
    }
    // the obstacles whose water bends, near their gate
    if (ambient) for (const g of GATES) {
      const look = HAZE[g.chapter], o = OBSTACLE[g.chapter];
      if (!look || !o || view.cx < g.x - o.soft - 1400 || view.cx > g.x + 1400) continue;
      view.project(g.x - o.soft, view.cy, 150, P);
      const a = P.x;
      view.project(g.x + 160, view.cy, 150, P);
      if (P.x > 0 && a < W) flows.push(haze(look, a, P.x, H, P.s, 1));
    }
    // the surface overhead
    view.project(view.cx, 0, 3200, P);
    if (ambient && P.y > 0) flows.push(surface(Math.min(H, P.y + 12), W));
    for (const [, f] of hot.sort((a, b) => a[0] - b[0]).slice(0, 4)) if (flows.length < MAX_FLOWS) flows.push(f);
    for (const f of flows) boxes.push(flowBox(f));
    let fv: FieldView | null = null;
    if (field) {
      field.pack(1.6, 2);
      if (field.peak > 0.004) {
        const sky = hsl01(m.sky.h, m.sky.s, m.sky.l);
        fv = { data: field.data, nx: field.nx, ny: field.ny, cell: field.cell, ox: field.ox, oy: field.oy, amp: 10, glint: 0.16, rgb: sky };
        boxes.push({ x0: 0, y0: 0, x1: W, y1: H });
      }
    }
    const rects = regions(boxes, d.gx.W, d.gx.H, dpr);
    if (!rects.length) return;
    d.gx.flush();
    lens.bend({ rects, ripples, flows, field: fv, cam: view, dpr, t }, d.gx.W, d.gx.H);
    // the light of the rings, at the end of the frame, over their own regions
    if (ripples.length) glints = { rects: regions(ripples.map(rippleBox), d.gx.W, d.gx.H, dpr), ripples, flows: [], field: null, cam: view, dpr, t };
    stats.rings = ripples.length; stats.flows = flows.length; stats.regions = rects.length; stats.pixels = lens.pixels;
    stats.ms = stats.ms * 0.9 + (performance.now() - t0) * 0.1;
  }

  /** at the end of the frame: the light the crests of the rings catch, over everything */
  function shine(): void {
    if (glints && lens && d.gx) lens.shine(glints, d.gx.W, d.gx.H);
    glints = null;
  }

  // ?dev: a few buttons in the panel, to see the water bend at will
  if (travelShown(search) && lens) {
    const panel = document.getElementById('panel'), at = document.getElementById('benchBtn');
    if (panel) {
      const h = document.createElement('h2'), row = document.createElement('div');
      h.textContent = 'Eau';
      row.className = 'presets';
      const btn = (label: string, fn: (b: HTMLButtonElement) => void) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.addEventListener('click', () => fn(b));
        row.append(b);
        return b;
      };
      const colours = ['nurserie', 'recif', 'grotte', 'glacier', 'jardin'];
      btn('Une onde', () => sung('song', d.swimmer(), colours[Math.floor(Math.random() * colours.length)]));
      btn('Un cri au loin', () => {
        const r = d.swimmer().root;
        ring('call', r.x[0] + 500, r.y[0] - 80, 1400);
        ring('call', r.x[0] + 500, r.y[0] - 80, 1400, undefined, RINGS.call.size * 0.8, 1.6);
      });
      const label = () => (mode === 'champ' ? 'Champ de vagues : oui' : 'Champ de vagues : non');
      btn(label(), (b) => { mode = mode === 'champ' ? 'anneaux' : 'champ'; b.textContent = label(); });
      const still = () => (ambient ? 'Eau qui ondule : oui' : 'Eau qui ondule : non');
      btn(still(), (b) => { ambient = !ambient; stillUntil = -1; b.textContent = still(); });
      panel.insertBefore(row, at);
      panel.insertBefore(h, row);
    }
  }

  return {
    ring, sung, step, bend, shine, stats,
    /**
     * The frames are late: the water that shimmers all the time (surface, chimneys, obstacles) stills, the rings
     * stay. It comes back after 30 s, then twice as long each time it has to still again; false when it is still
     * already (or nothing shimmers: the 2D canvas).
     */
    ease(): boolean {
      if (!ambient || mode === 'off' || !lens?.ok) return false;
      ambient = false;
      stillUntil = now + stillFor;
      stillFor = Math.min(600, stillFor * 2);
      return true;
    },
    /** the water that shimmers all the time is on (tests, the panel: then it stays as it is set) */
    get ambient() { return ambient; },
    set ambient(v: boolean) { ambient = v; stillUntil = -1; },
    /** the rings alive (tests) */
    rings: rings as readonly Ring[],
    get field() { return field; },
    /** anneaux: the rings drawn by the shader; champ: the song and the wakes in the field of waves; off: still water */
    get mode() { return mode; },
    set mode(v: OndesMode) { mode = v; },
    /** measures the GPU time of the lens (lens.gpu, ms) */
    get lens() { return lens; }
  };
}

export type Ondes = ReturnType<typeof initOndes>;

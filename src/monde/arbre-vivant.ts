// The living portraits of the lineage tree (arbre-ecran.ts): in its medallion, each generation, and each partner,
// swims on the spot, the portrait following it, and now and then plays a trick (arbre-tours.ts), two at most at
// once. Touched, a portrait giggles. When the tree opens, a light runs down the golden thread, from the first larva
// to the one played, and each hops as it passes; now and then the whole family on screen turns to us for a photo.
// Only the medallions on screen move; a creature is made the first time its medallion shows, and kept from one
// opening to the next. With « reduce motion », the portraits stay still.

import { STEP, wrapAngle, type Spec } from '../engine';
import { Creature3 } from '../engine3/creature3';
import { draw3, screenBox } from '../engine3/render3';
import { Ortho } from '../engine3/view';
import {
  MAX_BUSY, PHOTO_FLASH, REST, TOURS, gaitOf, nextTour, olaAt, olaDuration, photoAfter, photoTour, poseOf, restBetween, rollFit,
  type Gait, type TourId
} from './arbre-tours';

interface Bubble { x: number; y: number; r: number; age: number; wob: number }

interface Item {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  key: object | string;
  make: () => Spec | null;
  mini: boolean;
  cr: Creature3 | null;
  /** the creature cannot be read: the medallion stays empty */
  broken: boolean;
  gait: Gait;
  w: number; h: number; dpr: number;
  /** px per unit, and the size of the creature drawn at rest (css px) */
  k: number; bw: number; bh: number;
  /** the point of the creature the portrait looks at, and how far it is from the middle of its nodes at rest */
  camX: number; camY: number; offX: number; offY: number;
  /** its body's clock, the swim and tempo it eases to */
  t: number; swim: number; tempo: number;
  tour: TourId | null; t0: number; last: TourId | null;
  /** how far its trick was when its bubbles were last looked at */
  pu: number;
  /** when it plays next, and when the light of the thread reaches it (or -1) */
  due: number; ola: number;
  bubbles: Bubble[];
  visible: boolean;
  phase: number;
}

export interface VivantsStats {
  /** portraits that move now */
  readonly live: number;
  /** creatures made */
  readonly made: number;
  /** the tricks played since the page opened */
  readonly played: Partial<Record<TourId, number>>;
  /** what a frame of the portraits costs (ms, smoothed) */
  readonly ms: number;
}

export interface Vivants {
  /** off with « reduce motion »: the tree draws still portraits */
  readonly on: boolean;
  /** a medallion: its canvas, what its creature is kept by, how to make it */
  add(cv: HTMLCanvasElement, key: object | string, make: () => Spec | null, mini: boolean): void;
  /** the tree is built and shown: the portraits on screen come alive (and the light runs down the thread) */
  start(root: HTMLElement, ola: boolean): void;
  /** the tree is closed or built again */
  stop(): void;
  /** play a trick now on the medallion of this index (in the order they were added), for the tests */
  play(i: number, id: TourId): void;
  readonly stats: VivantsStats;
}

/** creatures kept from one opening to the next (a renamed ancestor is a new object: made again), with their clock */
const kept = new WeakMap<object, Creature3>();
const keptMates = new Map<string, Creature3>();
const clocks = new WeakMap<Creature3, number>();
let scratch: CanvasRenderingContext2D | null = null;
const mid = { x: 0, y: 0 };

/** ms of drawing the portraits may take per frame */
const DRAW_BUDGET = 6;

/** the swim of a portrait at rest, per gait (px per step): a walker walks on the spot, so that its tail trails */
const IDLE: Record<Gait, number> = { glide: 0.5, jet: 0.45, bell: 0.3, crawl: 0.4 };

export function initVivants(): Vivants {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let items: Item[] = [];
  let raf = 0, last = 0, ms = 0, made = 0, turn = 0;
  /** what drawing one portrait costs (ms, smoothed) */
  let drawMs = 0.3;
  const shown: Item[] = [];
  let io: IntersectionObserver | null = null;
  let spark: HTMLElement | null = null;
  let screen: HTMLElement | null = null;
  /** when the family poses for the photo next */
  let photoAt = 0;
  const played: Partial<Record<TourId, number>> = {};
  const now = () => performance.now() / 1000;

  function begin(it: Item, id: TourId, at: number): void {
    it.tour = id; it.t0 = at; it.pu = 0;
    played[id] = (played[id] ?? 0) + 1;
  }

  function create(it: Item): void {
    const mate = typeof it.key === 'string';
    let cr = mate ? keptMates.get(it.key as string) : kept.get(it.key as object);
    if (!cr) {
      let sp: Spec | null = null;
      try { sp = it.make(); } catch { /* a creature the engine no longer reads */ }
      if (!sp) { it.broken = true; return; }
      cr = new Creature3(sp, 0, 0, 0, { dir: { x: 1, y: 0, z: 0 }, phase: 0 });
      // as the still portrait (snapshot3): it swims a moment so that its parts trail
      for (let t = 0; t < 90; t++) cr.steer(t * STEP, 1.3, 0, 0, 0.25);
      if (mate) keptMates.set(it.key as string, cr); else kept.set(it.key as object, cr);
      made++;
    }
    it.gait = gaitOf(cr.spec.swim.mode);
    it.t = clocks.get(cr) ?? 90 * STEP;
    it.w = it.cv.clientWidth || (it.mini ? 64 : 116);
    it.h = it.cv.clientHeight || (it.mini ? 46 : 88);
    it.dpr = Math.min(2, window.devicePixelRatio || 1);
    it.cv.width = Math.round(it.w * it.dpr);
    it.cv.height = Math.round(it.h * it.dpr);
    // drawn on the processor: a dozen small canvases redrawn on the graphics card every frame halve the frame rate
    it.ctx ??= it.cv.getContext('2d', { willReadFrequently: true });
    if (!it.ctx) { it.broken = true; return; }
    // fitted as the still portrait, a little smaller to leave room for its tricks (measured on a scratch canvas)
    scratch ??= document.createElement('canvas').getContext('2d');
    if (scratch) draw3(scratch, cr, new Ortho(1), { ink: true, water: 0.5 });
    const b = screenBox(cr);
    if (!b) { it.broken = true; return; }
    const pad = it.mini ? 6 : 8;
    const bw = b[2] - b[0] || 1, bh = b[3] - b[1] || 1;
    it.k = Math.min((it.w - pad * 2) / bw, (it.h - pad * 2) / bh, 3) * 0.88;
    it.bw = bw * it.k; it.bh = bh * it.k;
    it.camX = (b[0] + b[2]) / 2 - cr.root.x[0];
    it.camY = (b[1] + b[3]) / 2 - cr.root.y[0];
    centroid(cr);
    it.offX = it.camX - (mid.x - cr.root.x[0]);
    it.offY = it.camY - (mid.y - cr.root.y[0]);
    recentre(cr);
    it.cr = cr;
  }

  /** the middle of all the nodes of a creature, in mid */
  function centroid(cr: Creature3): void {
    let x = 0, y = 0, n = 0;
    for (const s of cr.list) for (let i = 0; i <= s.n; i++) { x += s.x[i]; y += s.y[i]; n++; }
    mid.x = x / (n || 1); mid.y = y / (n || 1);
  }

  /** it swims on the spot: everything moves back so that its head stays where it was (its trail is kept) */
  function recentre(cr: Creature3): void {
    const r = cr.root;
    if (r.x[0] || r.y[0] || r.z[0]) cr.translate(-r.x[0], -r.y[0], -r.z[0]);
  }

  function step(it: Item, at: number): void {
    const cr = it.cr!;
    const u = it.tour ? (at - it.t0) / TOURS[it.tour].dur : 1;
    const p = it.tour ? poseOf(it.tour, u, it.gait) : REST;
    it.swim += (p.swim - it.swim) * 0.08;
    it.tempo += (p.tempo - it.tempo) * 0.08;
    it.t += STEP * it.tempo;
    clocks.set(cr, it.t);
    const v = IDLE[it.gait] * it.swim, walker = it.gait === 'crawl';
    // a walker's legs walk as on the floor (and its head is held at its height below, as the floor does: stand)
    if (walker) cr.gap = 0;
    if (p.yaw !== undefined) {
      cr.yawGoal = wrapAngle(p.yaw);
      cr.steer(it.t, 0, it.gait === 'bell' ? -v : 0, 0, 0.25);
    } else if (it.gait === 'bell') cr.steer(it.t, 0, -v, 0, 0.25);
    else cr.steer(it.t, v, 0, 0, 0.25);
    const r = cr.root;
    if (walker) r.y[0] = 0;
    // the portrait follows the middle of its nodes (it turns about its head; its outline sways with every tentacle)
    centroid(cr);
    it.camX += (mid.x - r.x[0] + it.offX - it.camX) * 0.08;
    it.camY += (mid.y - r.y[0] + it.offY - it.camY) * 0.08;
    recentre(cr);
  }

  /** the drawing of a portrait: its creature where its trick puts it, then its bubbles */
  function draw(it: Item, at: number): void {
    const cr = it.cr!, ctx = it.ctx!;
    const u = it.tour ? (at - it.t0) / TOURS[it.tour].dur : 1;
    const p = it.tour ? poseOf(it.tour, u, it.gait) : REST;
    const { w, h, dpr } = it;
    // it floats gently, a little up and down
    const bob = 0.025 * Math.sin(at * 0.9 + it.phase);
    const f = p.roll ? rollFit(it.bw, it.bh, w - 8, h - 8, p.roll) : 1;
    const c = Math.cos(p.roll), s = Math.sin(p.roll), cx = w / 2, cy = h / 2;
    const a = p.sx * f * c, cc = -p.sx * f * s, b = p.sy * f * s, d = p.sy * f * c;
    const e = cx + p.dx * w - (a * cx + cc * cy), ff = cy + (p.dy + bob) * h - (b * cx + d * cy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, it.cv.width, it.cv.height);
    ctx.setTransform(a * dpr, b * dpr, cc * dpr, d * dpr, e * dpr, ff * dpr);
    const k = it.k, ox = cx - it.camX * k, oy = cy - it.camY * k;
    draw3(ctx, cr, new Ortho(k, ox, oy), { ink: true, water: 0.5 });
    // its bubbles leave from its mouth (the head: the root of its body)
    if (it.tour) {
      const puffs = TOURS[it.tour].puffs;
      if (puffs) {
        const hx = ox + cr.root.x[0] * k, hy = oy + cr.root.y[0] * k;
        for (const [pu, r] of puffs) if (pu > it.pu && pu <= u && it.bubbles.length < 12) {
          it.bubbles.push({ x: a * hx + cc * hy + e, y: b * hx + d * hy + ff, r: r * (it.h / 88), age: 0, wob: Math.random() * 6 });
        }
      }
      it.pu = u;
    }
    if (!it.bubbles.length) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 0.8;
    for (const bu of it.bubbles) {
      const al = Math.min(1, bu.age * 4) * Math.max(0, 1 - bu.age / 2.6);
      const x = bu.x + Math.sin(bu.age * 5 + bu.wob) * 1.5, r = bu.r * (1 + bu.age * 0.25);
      ctx.globalAlpha = al;
      ctx.fillStyle = 'rgba(200,240,255,0.16)';
      ctx.strokeStyle = 'rgba(225,248,255,0.75)';
      ctx.beginPath(); ctx.arc(x, bu.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(x - r * 0.35, bu.y - r * 0.35, r * 0.28, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function tick(): void {
    raf = requestAnimationFrame(tick);
    const t0 = performance.now(), at = t0 / 1000;
    const dt = Math.min(0.1, at - last);
    last = at;
    let busy = 0;
    for (const it of items) {
      // off screen: no trick, and the light of the thread has passed it by
      if (!it.visible) { it.tour = null; it.bubbles.length = 0; if (it.ola >= 0 && at >= it.ola) it.ola = -1; }
      else if (it.tour) busy++;
    }
    let making = 0;
    shown.length = 0;
    for (const it of items) {
      if (!it.visible || it.broken) continue;
      if (!it.cr) {
        if (making > 6) continue;
        const m0 = performance.now();
        create(it);
        making += performance.now() - m0;
        if (!it.cr) continue;
      }
      if (it.tour && at - it.t0 >= TOURS[it.tour].dur) { it.last = it.tour; it.tour = null; busy--; it.due = at + restBetween(Math.random); }
      if (it.ola >= 0 && at >= it.ola) { it.ola = -1; if (!it.tour) { begin(it, 'vague', at); busy++; } }
      else if (!it.tour && it.ola < 0 && at >= it.due) {
        if (busy < MAX_BUSY) { begin(it, nextTour(it.gait, it.last, Math.random), at); busy++; }
        else it.due = at + 1 + Math.random() * 2;
      }
      const n = Math.max(1, Math.min(4, Math.round(dt / STEP)));
      for (let s = 0; s < n; s++) step(it, at);
      for (const bu of it.bubbles) { bu.age += dt; bu.y -= dt * (12 + bu.r * 3); }
      it.bubbles = it.bubbles.filter((bu) => bu.age < 2.6 && bu.y > -bu.r * 2);
      shown.push(it);
    }
    // they all move every frame, but only as many are drawn as fit in a few milliseconds, in turn: all of them on a
    // computer, a few at a time on a slow phone (each then moves less smoothly, and the page stays fluid)
    const quota = Math.min(shown.length, Math.max(1, Math.floor(DRAW_BUDGET / drawMs)));
    for (let j = 0; j < quota; j++) {
      const d0 = performance.now();
      draw(shown[(turn + j) % shown.length], at);
      drawMs += (performance.now() - d0 - drawMs) * 0.05;
    }
    turn = shown.length ? (turn + quota) % shown.length : 0;
    if (at >= photoAt) photo(at);
    ms += (performance.now() - t0 - ms) * 0.05;
  }

  /** all those on screen turn to us at once, a soft flash, and they go back to their own lives */
  function photo(at: number): void {
    photoAt = at + photoAfter(false, Math.random);
    const who = items.filter((it) => it.visible && it.cr);
    if (who.length < 2 || !screen) return;
    for (const it of who) { begin(it, photoTour(it.gait), at); it.due = at + TOURS.pose.dur + restBetween(Math.random); }
    const flash = document.createElement('div');
    flash.className = 'ar-flash';
    screen.append(flash);
    flash.animate([{ opacity: 0 }, { opacity: 0.14, offset: 0.3 }, { opacity: 0 }], { duration: 700, delay: PHOTO_FLASH * 1000, fill: 'both' }).onfinish = () => flash.remove();
  }

  /** the light runs down the thread, and each medallion hops as it passes */
  function runOla(root: HTMLElement, at: number): void {
    const tree = root.querySelector<HTMLElement>('.ar-tree');
    if (!tree || !items.length) return;
    const top = tree.getBoundingClientRect().top;
    const ys = items.map((it) => {
      const knot = it.mini ? it.cv.parentElement?.querySelector<HTMLElement>('.ar-knot') : null;
      const r = (knot ?? it.cv).getBoundingClientRect();
      return r.top + r.height / 2 - top;
    });
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const dur = olaDuration(items.filter((it) => !it.mini).length), wait = 1.1;
    items.forEach((it, i) => { it.ola = at + wait + olaAt(ys[i], y0, y1, dur); it.due = it.ola + 2 + Math.random() * 6; });
    if (y1 - y0 < 1) return;
    spark = document.createElement('li');
    spark.className = 'ar-spark';
    spark.setAttribute('aria-hidden', 'true');
    spark.style.top = `${y0}px`;
    tree.append(spark);
    const today = root.querySelector<HTMLElement>('.ar-now .ar-portrait');
    const anim = spark.animate([
      { transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.94 },
      { transform: `translateY(${y1 - y0}px)`, opacity: 0 }
    ], { duration: dur * 1000, delay: wait * 1000, easing: 'linear', fill: 'both' });
    const s = spark;
    anim.onfinish = () => {
      s.remove();
      if (spark === s) spark = null;
      // it reaches us: the ring of the one played glows a moment
      today?.animate([{}, { boxShadow: '0 0 0 2px rgba(255,242,200,1), 0 0 44px rgba(246,217,138,0.85)' }, {}], { duration: 1400, easing: 'ease-out' });
    };
  }

  const vivants: Vivants = {
    on: !reduce,
    add(cv, key, make, mini) {
      const it: Item = {
        cv, ctx: null, key, make, mini, cr: null, broken: false, gait: 'glide', w: 0, h: 0, dpr: 1, k: 1, bw: 1, bh: 1, camX: 0, camY: 0, offX: 0, offY: 0,
        t: 0, swim: 1, tempo: 1, tour: null, t0: 0, last: null, pu: 0, due: now() + 2 + Math.random() * 6, ola: -1, bubbles: [], visible: false,
        phase: Math.random() * 6
      };
      cv.addEventListener('pointerdown', () => { if (it.cr) begin(it, 'rire', now()); });
      items.push(it);
    },
    start(root, ola) {
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      if (reduce) return;
      io = new IntersectionObserver((es) => {
        for (const e of es) { const it = items.find((x) => x.cv === e.target); if (it) it.visible = e.isIntersecting; }
      }, { root, rootMargin: '80px 0px' });
      for (const it of items) io.observe(it.cv);
      last = now();
      screen = root;
      photoAt = last + photoAfter(true, Math.random);
      if (ola) runOla(root, last);
      raf = requestAnimationFrame(tick);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      io?.disconnect();
      io = null;
      spark?.remove();
      spark = null;
      screen?.querySelector('.ar-flash')?.remove();
      screen = null;
      for (const it of items) { it.tour = null; it.bubbles = []; it.ola = -1; }
      items = [];
    },
    play(i, id) { const it = items[i]; if (it?.cr) begin(it, id, now()); },
    stats: {
      get live() { return items.filter((it) => it.visible && it.cr).length; },
      get made() { return made; },
      played,
      get ms() { return ms; }
    }
  };
  return vivants;
}

// The game shell: canvas, loop, camera, the world around the player, and the
// drawing of every plane from the far water to the dark foreground.

import { Creature, Flow, STEP, TAU, clamp, draw, eachGlow, hash, inView, rng, seedOf, spec, type Box, type Spec } from '../engine';
import { SPECIES } from '../content';
import {
  FAR, MID, TILE_W, bakeChunk, bakeLayerTile, causticTile, foregroundSprite, glowSprite, makeCanvas,
  type ChunkBake, type FgSprite, type LayerDef, type Tile
} from './bake';
import { Plankton, School, Swarm, Visitor, Wanderer, faunaFor, type Player } from './ambient';
import { Input } from './input';
import { CHAPTER_X, chapterAt, css, fogged, moodAt, waterAt, type Mood } from './palette';
import { carpetOf, drawCarpet, growHero, sproutsOf, updateCarpet, type Carpet, type Hero, type Pusher, type Sprout } from './plants';
import { CW, SEED, chunkOf, collide, floorY } from './terrain';

interface Chunk {
  ci: number;
  bake: ChunkBake | null;
  sprouts: Sprout[];
  heroes: Hero[];
  carpet: Carpet;
  fauna: Wanderer[];
}

/** the first ancestor: a small translucent larva with beating cilia */
export function firstAncestor(): Spec {
  return spec({
    name: 'Première', size: 1, palette: { hue: 28, harmony: 'analog', sat: 80, light: 62 },
    swim: { mode: 'steady', speed: 2 }, ai: 'prey', eyes: { on: true, size: 1.2, spread: 0.5, fwd: 0.3 },
    body: {
      name: 'Corps', links: 9, len: 5, width: 4.6, shape: 'tadpole', style: 'ribbon', flex: 0.4, spring: 0.06, drag: 0.8,
      color: { slot: 0, alpha: 0.88, grad: -16, pattern: 'spots', pslot: 3, plight: 22, pdensity: 5, pscale: 0.7 },
      motion: { type: 'undulate', amp: 0.13, freq: 1.5 },
      attach: [
        { node: { name: 'Cil', role: 'cilia', links: 2, len: 2.4, width: 0.5, shape: 'linear', style: 'line', flex: 0.4, spring: 0.3, color: { slot: 1, alpha: 0.8, light: 18 }, motion: { type: 'row', amp: 0.9, freq: 3 } },
          pattern: 'series', at: 0.1, to: 0.55, count: 5, angle: 1.57, edge: 0.95, phaseStep: 0.5, mirror: true },
        { node: { name: 'Queue', role: 'fin', links: 4, len: 3.2, width: 2.2, shape: 'leaf', style: 'ribbon', flex: 0.5, spring: 0.1, color: { slot: 2, alpha: 0.7, add: true } },
          pattern: 'single', at: 1, angle: 0 },
        { node: { name: 'Lueur', role: 'light', links: 1, len: 1.4, width: 1.1, shape: 'constant', style: 'disc', flex: 0.1, spring: 0.5, color: { slot: 3, light: 25, glow: 'tip' } },
          pattern: 'single', at: 0.45, angle: 0, edge: 0 }
      ]
    }
  });
}

const FG_P = 1.4;
const ACTIVE_MARGIN = 260;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  base = 1;
  input: Input;
  t = 0;
  cam = { x: 0, y: 0 };
  player: Creature;
  flow = new Flow(32);
  chunks = new Map<number, Chunk>();
  tiles = new Map<string, Tile>();
  fgSprites = new Map<string, FgSprite>();
  schools: School[] = [];
  farSchools: School[] = [];
  motesBack = new Plankton(90, 0.55);
  motesFront = new Plankton(40, 1.25);
  swarm: Swarm;
  visitors: { v: Visitor; chapter: number }[] = [];
  caustic: CanvasPattern;
  vignette: HTMLCanvasElement | null = null;
  view: Box = [0, 0, 0, 0];
  active: Box = [0, 0, 0, 0];
  mood: Mood;
  chapter = -1;
  onChapter: ((name: string) => void) | null = null;
  stats = { frame: 0, ms: 0 };
  private hit = { x: 0, y: 0, hit: false };
  private acc = 0;
  /** render resolution, lowered on slow devices */
  quality = 1;
  private slow = { n: 0, sum: 0 };
  private last = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement, startX = 420) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.input = new Input(canvas);
    this.input.zoomMul = 1.25;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.player = new Creature(firstAncestor(), startX, 150, { dir: Math.PI, scale: 0.8 });
    this.cam.x = startX; this.cam.y = 200;
    this.mood = moodAt(startX);
    const ctile = causticTile();
    this.caustic = this.ctx.createPattern(ctile, 'repeat')!;
    this.swarm = new Swarm(70, startX + 200, 120);
    this.spawnSchools();
    this.spawnVisitors();
    // build what is around the start at once
    this.manageChunks(true);
  }

  resize(): void {
    this.dpr = Math.min(1.75, window.devicePixelRatio || 1) * this.quality;
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.base = clamp(Math.max(Math.min(this.W, this.H) / 520, Math.max(this.W, this.H) / 1000), 0.55, 1.6);
    this.vignette = null;
  }

  get zoom(): number { return this.base * this.input.zoomMul; }

  // ----- world ----- //

  private spawnSchools(): void {
    const R = rng(SEED + 99);
    const add = (x: number, band: [number, number], n: number, h: number, size: number, p = 1) => {
      const m = moodAt(x / p);
      const body = p < 1 ? fogged(m, { h, s: 50, l: 45 }, band[1] / p, 0.65) : { h, s: 60 + R() * 25, l: 55 + R() * 10 };
      const belly = p < 1 ? fogged(m, { h, s: 30, l: 60 }, band[1] / p, 0.65) : { h: h + 20, s: 40, l: 82 };
      const s = new School(x, band, n, body, belly, { size, p, seed: Math.floor(R() * 1000), speed: 1.3 + R() * 0.8 });
      (p < 1 ? this.farSchools : this.schools).push(s);
    };
    // Nurserie: silver sardines near the surface, small gold fish in the meadows
    add(1200, [60, 260], 34, 200, 0.9);
    add(3200, [80, 320], 40, 205, 0.8);
    add(5200, [300, 600], 22, 48, 0.7);
    // Récif: bright reef fish
    add(7800, [200, 380], 26, 190, 0.9);
    add(9200, [180, 420], 20, 30, 0.8);
    add(10800, [220, 400], 30, 280, 0.75);
    add(12500, [160, 360], 24, 55, 0.85);
    // distant schools, a mid plane away
    for (let x = 800; x < 14000; x += 2600) add(x * MID.p, [80 * MID.p, 380 * MID.p], 30, 210, 0.9, MID.p);
  }

  private spawnVisitors(): void {
    const turtle = new Visitor(SPECIES.tortue(), 0.35, 0.35 * 300, 0.35 * 6500, 0.35 * 380, 1.6, 0.45);
    const manta = new Visitor(SPECIES.manta(), 0.45, 0.45 * 7000, 0.45 * 13500, 0.45 * 200, 1.3, 0.6);
    this.visitors.push({ v: turtle, chapter: 0 }, { v: manta, chapter: 1 });
  }

  private makeChunk(ci: number): Chunk {
    const R = rng(seedOf(ci, SEED + 13));
    const fauna: Wanderer[] = [];
    const x0 = ci * CW;
    const nf = 1 + Math.floor(R() * 3);
    for (let i = 0; i < nf && x0 > 0; i++) {
      const x = x0 + R() * CW, f = faunaFor(x, R);
      const y = f.benthic ? floorY(x) - 14 : 60 + R() * (floorY(x) - 160);
      fauna.push(new Wanderer(f.sp, x, y, f.benthic, f.scale));
    }
    return { ci, bake: null, sprouts: sproutsOf(ci), heroes: [], carpet: carpetOf(ci), fauna };
  }

  /** chunks around the camera; baking and growing is spread over frames */
  private manageChunks(all = false): void {
    const cc = chunkOf(this.cam.x);
    for (let ci = cc - 2; ci <= cc + 2; ci++) if (ci >= 0 && !this.chunks.has(ci)) this.chunks.set(ci, this.makeChunk(ci));
    for (const k of [...this.chunks.keys()]) if (Math.abs(k - cc) > 3) this.chunks.delete(k);
    let bakes = all ? 99 : 1, grows = all ? 9999 : 6;
    // nearest first
    const order = [...this.chunks.values()].sort((a, b) => Math.abs(a.ci - cc) - Math.abs(b.ci - cc));
    for (const ch of order) {
      if (!ch.bake && bakes > 0) { ch.bake = bakeChunk(ch.ci); bakes--; }
      while (ch.sprouts.length && grows > 0) { ch.heroes.push(growHero(ch.sprouts.pop()!)); grows--; }
    }
    // distant tiles
    for (const L of [FAR, MID]) {
      const sL = this.layerScale(L.p), half = this.W / 2 / sL + 200;
      const lx = this.cam.x * L.p;
      for (let ti = Math.floor((lx - half) / TILE_W); ti <= Math.floor((lx + half) / TILE_W); ti++) {
        const key = L.p + ':' + ti;
        if (!this.tiles.has(key) && (all || bakes-- > 0)) this.tiles.set(key, bakeLayerTile(L, ti));
      }
    }
    if (this.tiles.size > 24) {
      for (const [k, t] of this.tiles) {
        const p = parseFloat(k), lx = this.cam.x * p;
        if (Math.abs(t.x + TILE_W / 2 - lx) > TILE_W * 4) this.tiles.delete(k);
      }
    }
  }

  layerScale(p: number): number { return this.base * Math.pow(this.input.zoomMul, p); }

  // ----- loop ----- //

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = now - this.last;
      this.acc += Math.min(0.1, dt / 1000);
      this.last = now;
      // adaptive resolution: if frames stay slow for two seconds, draw fewer pixels
      const sl = this.slow;
      sl.n++; sl.sum += dt;
      if (sl.n >= 120) {
        const avg = sl.sum / sl.n;
        if (avg > 21 && this.quality > 0.55) { this.quality *= 0.85; this.resize(); }
        else if (avg < 15 && this.quality < 1) { this.quality = Math.min(1, this.quality / 0.9); this.resize(); }
        sl.n = 0; sl.sum = 0;
      }
      let steps = 0;
      while (this.acc >= STEP && steps < 3) { this.update(); this.acc -= STEP; steps++; }
      if (steps === 3) this.acc = 0;
      const t0 = performance.now();
      this.render();
      this.stats.ms = this.stats.ms * 0.95 + (performance.now() - t0) * 0.05;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  stop(): void { this.running = false; }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    const z = this.zoom;
    return { x: this.cam.x + (x - this.W / 2) / z, y: this.cam.y + (y - this.H / 2) / z };
  }

  update(): void {
    const t = (this.t += STEP), p = this.player, r = p.root, inp = this.input;
    this.stats.frame++;
    this.manageChunks();

    // the player swims toward the finger, like "Guider" in the workshop
    const f = inp.follow, kd = inp.keyDir();
    if (f) {
      const w = this.screenToWorld(f.x, f.y);
      const dx = w.x - r.x[0], dy = w.y - r.y[0], d = Math.hypot(dx, dy) || 1;
      const sp = 2.6 * Math.min(1, d / 80);
      p.update(t, (dx / d) * sp, (dy / d) * sp, 0.08);
    } else if (kd) {
      const d = Math.hypot(kd.x, kd.y);
      p.update(t, (kd.x / d) * 2.6, (kd.y / d) * 2.6, 0.08);
    } else {
      p.update(t, 0, 0, 0.03);
    }
    collide(r.x[0], r.y[0], r.rad[0] + 3, this.hit);
    if (this.hit.hit) {
      r.x[0] = this.hit.x; r.y[0] = this.hit.y;
      p.vx *= 0.6; p.vy *= 0.6;
    }
    if (r.y[0] < 10) { r.y[0] = 10; if (p.vy < 0) p.vy *= 0.3; }
    if (r.x[0] < 40) { r.x[0] = 40; p.vx = Math.max(0, p.vx); }

    // camera
    const cam = this.cam, z = this.zoom;
    cam.x += (r.x[0] + p.vx * 22 - cam.x) * 0.06;
    cam.y += (r.y[0] + p.vy * 22 - cam.y) * 0.06;
    // the surface stays near the top edge, the floor low on the screen; when both can't hold, meet halfway
    const yLo = (0.4 * this.H) / z, yHi = floorY(cam.x) - (0.25 * this.H) / z;
    cam.y = yLo <= yHi ? clamp(cam.y, yLo, yHi) : (yLo + yHi) / 2;
    const hw = this.W / 2 / z, hh = this.H / 2 / z;
    this.view = [cam.x - hw - 30, cam.y - hh - 30, cam.x + hw + 30, cam.y + hh + 30];
    this.active = [this.view[0] - ACTIVE_MARGIN, this.view[1] - ACTIVE_MARGIN, this.view[2] + ACTIVE_MARGIN, this.view[3] + ACTIVE_MARGIN];

    const pl: Player = { x: r.x[0], y: r.y[0], vx: p.vx, vy: p.vy };
    // life
    const plants: Creature[] = [], fauna: Creature[] = [];
    const flow = this.flow;
    flow.clear();
    flow.add(p);
    for (const ch of this.chunks.values()) {
      for (const w of ch.fauna) if (inView(w.cr.box, this.active)) { w.update(t, pl); fauna.push(w.cr); flow.add(w.cr); }
      for (const h of ch.heroes) if (inView(h.cr.box, this.active)) { h.cr.update(t, 0, 0, 1); plants.push(h.cr); }
    }
    for (const s of this.schools) {
      const near = Math.abs(s.cx - cam.x) < 2400;
      if (!near) continue;
      s.update(pl, t);
      for (let i = 0; i < s.n; i += 2) if (s.x[i] > this.active[0] && s.x[i] < this.active[2]) flow.addPoint(s.x[i], s.y[i], s.vx[i], s.vy[i], 4 * s.size);
    }
    for (const s of this.farSchools) if (Math.abs(s.cx - cam.x * s.p) < 2000) s.update(null, t);
    for (const c of plants) flow.apply(c, { push: 0.25, wake: 0.04, reach: 18 });
    for (const c of fauna) flow.apply(c, { push: 0.35, wake: 0.02, body: 0.01 });
    flow.apply(p, { push: 0.3, wake: 0.015, body: 0.008 });

    // the carpet bends away from whoever swims close
    const pushers: Pusher[] = [{ x: pl.x, y: pl.y, vx: pl.vx, vy: pl.vy, r: 40 }];
    for (const c of fauna) pushers.push({ x: c.root.x[0], y: c.root.y[0], vx: c.vx, vy: c.vy, r: 24 });
    for (const ch of this.chunks.values()) if (inView(ch.carpet.box, this.view)) updateCarpet(ch.carpet, pushers, t);

    if (this.chapter < 1 || Math.abs(this.swarm.hx - pl.x) < 3000) this.swarm.update(pl, t);
    for (const { v } of this.visitors) if (Math.abs(v.x - cam.x * v.p) < 3000) v.update(t);

    // chapter names as we cross them
    const ci = chapterAt(cam.x);
    const now = ci.t > 0.5 ? ci.i + 1 : ci.i;
    if (now !== this.chapter) {
      this.chapter = now;
      this.onChapter?.(moodAt(cam.x).name);
    }
  }

  // ----- drawing ----- //

  render(): void {
    const ctx = this.ctx, W = this.W, H = this.H, dpr = this.dpr, z = this.zoom, cam = this.cam, t = this.t;
    const m = (this.mood = moodAt(cam.x));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 1. open water, seen far away: the gradient changes slowly with depth
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 4; i++) {
      const sy = (H * i) / 4, wy = cam.y * 0.8 + (sy - H / 2) / z * 0.35;
      g.addColorStop(i / 4, css(waterAt(m, wy)));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 2. far plane, visitors, mid plane
    this.drawLayer(FAR);
    for (const { v, chapter } of this.visitors) {
      if (Math.abs(v.x - cam.x * v.p) > (W / this.layerScale(v.p)) + 600) continue;
      const k = this.layerScale(v.p), sx = W / 2 - cam.x * v.p * k, sy = H / 2 - cam.y * v.p * k;
      const fade = chapter === 0 ? 1 - chapterAt(cam.x).t * (chapterAt(cam.x).i === 0 ? 1 : 0) : 1;
      v.draw(ctx, sx, sy, k, fogged(m, m.deep, v.y / v.p, 0.7), 0.7 * fade);
    }
    this.drawLayer(MID);
    {
      const k = this.layerScale(MID.p);
      for (const s of this.farSchools) {
        if (Math.abs(s.cx - cam.x * s.p) > W / k + 300) continue;
        s.draw(ctx, k * dpr, 0, 0, k * dpr, (W / 2 - cam.x * s.p * k) * dpr, (H / 2 - cam.y * s.p * k) * dpr, 0.6);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.motesBack.draw(ctx, cam.x, cam.y, W, H, z, t, css(m.plankton, 0.35), dpr);

    // 3. play plane
    const a = z * dpr, ex = (W / 2 - cam.x * z) * dpr, ey = (H / 2 - cam.y * z) * dpr;
    ctx.setTransform(a, 0, 0, a, ex, ey);
    const v = this.view;
    const chunks = [...this.chunks.values()];
    for (const ch of chunks) this.drawTerrain(ch);
    this.drawCaustics(chunks, m);
    this.drawRays(m);
    for (const ch of chunks) if (inView(ch.carpet.box, v)) drawCarpet(ctx, ch.carpet, v[0], v[2]);
    for (const ch of chunks) for (const h of ch.heroes) if (h.kind !== 'sargasse' && inView(h.cr.box, v)) draw(ctx, h.cr, { view: v });
    for (const ch of chunks) for (const w of ch.fauna) if (inView(w.cr.box, v)) draw(ctx, w.cr, { view: v });
    for (const s of this.schools) {
      if (s.cx < v[0] - 300 || s.cx > v[2] + 300) continue;
      s.draw(ctx, a, 0, 0, a, ex, ey);
    }
    ctx.setTransform(a, 0, 0, a, ex, ey);
    this.swarm.draw(ctx, t);
    draw(ctx, this.player, { view: v });
    for (const ch of chunks) for (const h of ch.heroes) if (h.kind === 'sargasse' && inView(h.cr.box, v)) draw(ctx, h.cr, { view: v });
    this.drawSurface(m);

    // 4. light: glows
    ctx.globalCompositeOperation = 'lighter';
    let gk = 0.6;
    const glow = (x: number, y: number, size: number, hue: number, al: number) => {
      ctx.globalAlpha = al * gk;
      ctx.drawImage(glowSprite(hue), x - size, y - size, size * 2, size * 2);
    };
    eachGlow(this.player.list, glow, v);
    gk = 0.3;
    for (const ch of chunks) {
      for (const h of ch.heroes) if (inView(h.cr.box, v)) eachGlow(h.cr.list, glow, v);
      for (const w of ch.fauna) if (inView(w.cr.box, v)) eachGlow(w.cr.list, glow, v);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // 5. near motes, foreground, vignette
    this.motesFront.draw(ctx, cam.x, cam.y, W, H, z, t, css(m.plankton, 0.55), dpr);
    this.drawForeground(m);
    this.drawVignette(m);
  }

  private drawLayer(L: LayerDef): void {
    const ctx = this.ctx, dpr = this.dpr, k = this.layerScale(L.p), cam = this.cam;
    const ox = this.W / 2 - cam.x * L.p * k, oy = this.H / 2 - cam.y * L.p * k;
    const lx0 = (0 - ox) / k, lx1 = (this.W - ox) / k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let ti = Math.floor(lx0 / TILE_W); ti <= Math.floor(lx1 / TILE_W); ti++) {
      const tile = this.tiles.get(L.p + ':' + ti);
      if (!tile) continue;
      const sx = ox + tile.x * k, sy = oy + tile.y * k, sw = tile.w * k, sh = tile.h * k;
      ctx.drawImage(tile.canvas, sx, sy, sw + 1, sh);
      if (tile.bottom && sy + sh < this.H) { ctx.fillStyle = tile.bottom; ctx.fillRect(sx, sy + sh - 1, sw + 1, this.H - sy - sh + 1); }
    }
  }

  private drawTerrain(ch: Chunk): void {
    const b = ch.bake, ctx = this.ctx, v = this.view;
    if (!b) {
      // not baked yet: a plain floor
      const x0 = ch.ci * CW;
      if (x0 > v[2] || x0 + CW < v[0]) return;
      ctx.fillStyle = css(this.mood.rock, 1, -20);
      ctx.beginPath();
      ctx.moveTo(x0, v[3]);
      for (let x = x0; x <= x0 + CW; x += 32) ctx.lineTo(x, floorY(x));
      ctx.lineTo(x0 + CW, v[3]);
      ctx.fill();
      return;
    }
    if (b.x > v[2] || b.x + b.w < v[0] || b.y > v[3]) return;
    ctx.drawImage(b.canvas, b.x, b.y, b.w, b.h);
    if (b.y + b.h < v[3]) {
      ctx.fillStyle = b.bottom;
      const x0 = ch.ci * CW;
      ctx.fillRect(x0 - 0.5, b.y + b.h - 1, CW + 1, v[3] - b.y - b.h + 2);
    }
  }

  private drawCaustics(chunks: Chunk[], m: Mood): void {
    const ctx = this.ctx, t = this.t, v = this.view, pat = this.caustic;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pat;
    for (const ch of chunks) {
      const b = ch.bake;
      if (!b || b.x > v[2] || b.x + b.w < v[0] || b.y > v[3]) continue;
      const al = 0.1 * m.caustics * b.litAlpha;
      if (al < 0.01) continue;
      ctx.save();
      ctx.clip(b.lit);
      const x0 = Math.max(b.x, v[0]), x1 = Math.min(b.x + b.w, v[2]), y0 = Math.max(b.y, v[1]), y1 = Math.min(b.y + b.h, v[3]);
      pat.setTransform(new DOMMatrix([0.9, 0, 0.2, 0.55, t * 9, t * 3]));
      ctx.globalAlpha = al;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      pat.setTransform(new DOMMatrix([1.1, 0, -0.2, 0.7, -t * 7, t * 5 + 40]));
      ctx.globalAlpha = al * 0.8;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** shafts of light from the surface, slowly breathing */
  private drawRays(m: Mood): void {
    const ctx = this.ctx, t = this.t, v = this.view, cam = this.cam;
    if (v[1] > 1400) return;
    const sp = 150, shift = cam.x * 0.18, slant = 0.3;
    ctx.globalCompositeOperation = 'lighter';
    const k0 = Math.floor((v[0] - shift - 600) / sp), k1 = Math.floor((v[2] - shift) / sp);
    for (let k = k0; k <= k1; k++) {
      const h1 = hash(k, 1), h2 = hash(k, 2), h3 = hash(k, 3);
      if (h3 < 0.35) continue;
      const x = k * sp + h1 * 120 + shift, w = 14 + h2 * 46, L = 520 + h3 * 520;
      const breathe = 0.5 + 0.5 * Math.sin(t * (0.2 + h2 * 0.25) + k * 1.7);
      const al = m.rays * 0.14 * breathe * (0.4 + h1 * 0.6);
      if (al < 0.01) continue;
      const g = this.ctx.createLinearGradient(0, 0, 0, L);
      g.addColorStop(0, css(m.sky, al));
      g.addColorStop(0.5, css(m.sky, al * 0.35));
      g.addColorStop(1, css(m.sky, 0));
      ctx.fillStyle = g;
      const sw = Math.sin(t * 0.13 + k) * 20;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + sw, 0);
      ctx.lineTo(x + w / 2 + sw, 0);
      ctx.lineTo(x + slant * L + w * 1.3, L);
      ctx.lineTo(x + slant * L - w * 1.3, L);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /** the surface seen from below: a bright, moving ceiling */
  private drawSurface(m: Mood): void {
    const ctx = this.ctx, v = this.view, t = this.t, cam = this.cam;
    if (v[1] > 80) return;
    const wave = (x: number) => Math.sin(x * 0.013 + t * 1.1) * 2.6 + Math.sin(x * 0.031 - t * 1.7) * 1.3 + Math.sin(x * 0.0041 + t * 0.4) * 3;
    const top = Math.min(v[1], -40);
    ctx.beginPath();
    ctx.moveTo(v[0], top);
    for (let x = v[0]; x <= v[2] + 12; x += 12) ctx.lineTo(x, wave(x));
    ctx.lineTo(v[2] + 12, top);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, 4);
    g.addColorStop(0, css({ h: m.top.h + 10, s: 90, l: 80 }));
    g.addColorStop(1, css({ h: m.top.h, s: 85, l: 68 }));
    ctx.fillStyle = g;
    ctx.fill();
    // Snell's window: the sky is brightest right above the eye
    ctx.globalCompositeOperation = 'lighter';
    const rg = ctx.createRadialGradient(cam.x, 0, 0, cam.x, 0, 420);
    rg.addColorStop(0, css(m.sky, 0.3));
    rg.addColorStop(1, css(m.sky, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(cam.x - 420, top, 840, 420 - top);
    // glare just under the surface, and the bright line of the waves
    const gl = ctx.createLinearGradient(0, 0, 0, 90);
    gl.addColorStop(0, css(m.sky, 0.28));
    gl.addColorStop(1, css(m.sky, 0));
    ctx.fillStyle = gl;
    ctx.fillRect(v[0], 0, v[2] - v[0], 90);
    ctx.strokeStyle = css(m.sky, 0.7, 10);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = v[0]; x <= v[2] + 12; x += 12) { const y = wave(x); if (x === v[0]) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    // ripples of light on the underside
    ctx.strokeStyle = css(m.sky, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = Math.floor(v[0] / 40); k <= Math.floor(v[2] / 40); k++) {
      const x = k * 40 + Math.sin(t * 0.8 + k) * 12, y = 5 + hash(k, 5) * 8, w = 8 + hash(k, 6) * 16;
      ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x, y - 3, x + w, y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawForeground(m: Mood): void {
    const ctx = this.ctx, dpr = this.dpr, cam = this.cam, z = this.zoom, p = FG_P, k = z;
    const ox = this.W / 2 - cam.x * p * k, oy = this.H / 2 - cam.y * p * k;
    const lx0 = -ox / k - 400, lx1 = (this.W - ox) / k + 400, seg = 1500;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // shapes very close to the eye stand at the bottom of the screen, and only show near the floor
    const near = clamp(1 - ((floorY(cam.x) - cam.y) * z - this.H * 0.2) / (this.H * 0.5), 0, 1);
    if (near > 0.02) {
      ctx.globalAlpha = near * 0.6;
      for (let s = Math.floor(lx0 / seg); s <= Math.floor(lx1 / seg); s++) {
        const R = rng(seedOf(s, SEED + 404));
        const n = 1 + Math.floor(R() * 2);
        for (let i = 0; i < n; i++) {
          const lx = s * seg + R() * seg, kind = 1 + Math.floor(R() * 2), wx = lx / p;
          const ch = chapterAt(wx).i;
          const key = kind + ':' + ch + ':' + (s % 3);
          let spr = this.fgSprites.get(key);
          if (!spr) { spr = foregroundSprite(kind, seedOf(s % 3, kind), moodAt(CHAPTER_X[ch] + 500)); this.fgSprites.set(key, spr); }
          const sc = (0.3 * this.H) / spr.h * (0.8 + R() * 0.5);
          const sx = ox + lx * k - spr.ax * sc, sy = this.H + 30 * sc - spr.ay * sc + (1 - near) * 120;
          if (sx > this.W || sx + spr.w * sc < 0) continue;
          ctx.drawImage(spr.canvas, sx, sy, spr.w * sc, spr.h * sc);
        }
      }
      ctx.globalAlpha = 1;
    }
    // Nurserie: dark rafts of sargassum right at the surface, close to the eye
    if (m.name === 'La Nurserie' || chapterAt(cam.x).t > 0) {
      const sy = oy - 4 * k;
      if (sy > -60) {
        ctx.fillStyle = css({ h: m.deep.h, s: 40, l: 8 }, 0.85);
        for (let s = Math.floor(lx0 / 700); s <= Math.floor(lx1 / 700); s++) {
          if (hash(s, 41) < 0.55 || s * 700 / p > CHAPTER_X[1]) continue;
          const lx = s * 700 + hash(s, 42) * 400, w = (120 + hash(s, 43) * 200) * k;
          const x = ox + lx * k;
          ctx.beginPath();
          for (let j = 0; j < 9; j++) {
            const px = x + (j / 8) * w, r = (10 + hash(s * 9 + j, 44) * 16) * k;
            ctx.moveTo(px + r, sy);
            ctx.ellipse(px, sy, r, r * 0.55, 0, 0, TAU);
          }
          ctx.fill();
        }
      }
    }
  }

  private drawVignette(m: Mood): void {
    const ctx = this.ctx, W = this.W, H = this.H;
    if (!this.vignette) {
      const c = makeCanvas(256, 256), g = c.getContext('2d')!;
      const rg = g.createRadialGradient(128, 128, 60, 128, 128, 182);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = rg;
      g.fillRect(0, 0, 256, 256);
      this.vignette = c;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(this.vignette, 0, 0, W, H);
    ctx.globalAlpha = 1;
    // deep water closes in
    const d = clamp((this.cam.y - 300) / 900, 0, 1);
    if (d > 0) { ctx.fillStyle = css(m.deep, d * 0.25, -10); ctx.fillRect(0, 0, W, H); }
  }

  /** the swimmer becomes this species, where it is and the way it faces */
  becomes(sp: Spec): void {
    const old = this.player, r = old.root;
    const cr = new Creature(sp, r.x[0], r.y[0], { dir: r.ang[1], scale: 0.8 });
    for (let i = 0; i < 40; i++) cr.update(i * STEP, old.vx, old.vy, 0.2);
    cr.vx = old.vx; cr.vy = old.vy;
    this.player = cr;
    try { localStorage.setItem('lignee.player', JSON.stringify(sp)); } catch { /* private mode */ }
  }

  /** debug / test helpers */
  teleport(x: number, y: number): void {
    const r = this.player.root;
    this.player.translate(x - r.x[0], y - r.y[0]);
    this.cam.x = x; this.cam.y = y;
    this.manageChunks(true);
  }
}


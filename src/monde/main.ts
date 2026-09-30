// Le Grand Monde: a whole world for the 2.5D engine, to see it and to measure
// it. The ten chapters of the story along x (biomes.ts), from the sunny grass
// beds down to the bottom of the Fosse; all the species of the catalogue live
// somewhere in it.
// Same drawing as the 2.5D prototype (our own small 3D, painter from far to
// near, far things baked into small images washed by the water), on WebGL2
// when there is one (engine3/gfx: the canvas pays a fixed price per path, the
// GPU does not), on the 2D canvas otherwise or with ?gl=0.

import { STEP, TAU, clamp, detail, rand, rng, spec as makeSpec, type Spec } from '../engine';
import { Atelier } from '../editor';
import { Creature3, swimFactor3 } from '../engine3/creature3';
import { Flow } from '../engine3/flow';
import { draw3, eachGlow3, lodOf, lodSize, prepare3 } from '../engine3/render3';
import { SPECIES, firstAncestor } from '../content';
import { Input } from './input';
import { css, fogged, waterAt, type HSL, type Mood } from './palette';
import { View, type Proj } from '../engine3/view';
import { hsl01 } from '../engine3/gfx';
import { disc, paint3 } from '../engine3/paint-gl';
import { causticsGL, fishAtlas, fishGL, glowsGL, hcol, raysGL, rings, rowGL, screenGfx, shadowGL, spriteGL, surfaceGL, waterGL } from './scene-gl';
import { bakeCreature, bakeRock, causticTile, env, fishSprites, fogOf, glowSprite, makeCanvas, type Plant, type Sprite } from './sprites';
import { BIOMES, X0, X1, arrival, biomeIndex, biomeMid, floorAt, liftAt, metres, moodAt, openFloor } from './biomes';
import { Jardin } from './jardin';
import { Puffs, bakeDecor, growPlant2, makeDecor, makePlants, makeRocks, ventMouth, type Decor, type RockX } from './world';
import { compareSpecies, runBench } from './bench';
import { darkStops, glowOf, lightReach, pitchOf, snowLit } from './fosse';
import { drawShape } from './fosse-draw';
import { drawCrystals, glacierItems, type GlacierScene } from './glacier';
import { caveCover, caveDark, caveKeeps, caveRepel, ceilAt } from './grotte';
import { pushCave } from './grotte-draw';
import { drawFront, frontColour, frontCount, frontPainter, makeFront } from './foreground';
import { CARCASSE, boneLight, carcasseDwellers, carcasseSchool } from './carcasse';
import './style.css';

type M = ReturnType<typeof moodAt>;

// ----- settings ----- //

const settings = { angle: 7, dist: 900 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('lignee.monde') || '{}')); } catch { /* private mode */ }
const save = () => { try { localStorage.setItem('lignee.monde', JSON.stringify(settings)); } catch { /* ignore */ } };

/** switches for the performance tests (and to compare before / after) */
const opts = {
  /** far animals are re-baked into their image every n frames */
  farEvery: 3,
  /** read one pixel back after drawing, so the time includes the rasterisation */
  flush: false,
  /** how the living things are drawn (to measure what each costs) */
  shade: true, ink: true,
  /** levels of detail by size on screen, impostors for the smallest */
  lod: true
};

// ----- canvas ----- //

const { canvas, gx } = screenGfx('sea');
/** the 2D context of the screen, or a stand-in when WebGL draws (the canvas code paths are then not taken) */
const ctx = (gx ? makeCanvas(1, 1).getContext('2d') : canvas.getContext('2d', { alpha: false }))!;
const renderer = gx ? 'WebGL2' : 'Canvas 2D';
const view = new View();
let dpr = 1, quality = 1, W = 0, H = 0;

/**
 * Frame budget of the living things. Each animal gets a level of detail by its
 * size on screen (render3: lodOf); `bias` > 1 counts every animal smaller than
 * it is, which pushes them toward the coarser levels. On an accelerated canvas
 * every path has a fixed price whatever its size (measured: a lower resolution
 * gained nothing), so when frames are late the bias rises first, and only then
 * the resolution drops.
 */
let bias = 1;
const BIAS_MAX = 3;
function setBias(b: number): void { bias = clamp(b, 1, BIAS_MAX); }
function resize(): void {
  dpr = Math.min(1.5, window.devicePixelRatio || 1) * quality;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  gx?.resize(canvas.width, canvas.height);
  view.resize(W, H, W < H ? 52 : 44);
}
resize();
window.addEventListener('resize', resize);

const input = new Input(canvas, 0.45, 2.6);
input.zoomMul = 900 / settings.dist;

// ----- world ----- //

const decor: Decor[] = makeDecor();
const vents = decor.filter((d) => d.kind === 'vent');
const rocks: RockX[] = makeRocks().sort((a, b) => a.x - b.x);
/** first rock at or after x (the rocks are sorted along x) */
function rockFrom(x: number): number {
  let lo = 0, hi = rocks.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rocks[mid].x < x) lo = mid + 1; else hi = mid; }
  return lo;
}
const plants: Plant[] = makePlants(vents).filter(caveKeeps);
const front = makeFront();
const causticCv = causticTile(256, 7, 5);
const caustic = ctx.createPattern(causticCv, 'repeat')!;

interface Actor {
  cr: Creature3; kind: 'player' | 'swim' | 'floor' | 'surface' | 'sib';
  z: number; hx: number; hy: number; tx: number; ty: number; next: number;
  buf: HTMLCanvasElement | null;
  /** last baked image and the frame it was made (far animals are re-baked only every few frames) */
  spr: Sprite | null; bakedAt: number;
  /** added by a test */
  temp?: boolean;
}
const actors: Actor[] = [];
function addActor(sp: Spec, x: number, y: number, kind: Actor['kind'], scale = 1, z = 0): Actor {
  const cr = new Creature3(sp, x, y, z, { dir: { x: Math.random() < 0.5 ? 1 : -1, y: 0, z: 0 }, scale });
  cr.ground(kind === 'floor');
  for (let i = 0; i < 60; i++) cr.update(i * STEP, 0, 0, 0, 0.1);
  const a: Actor = { cr, kind, z, hx: x, hy: y, tx: x, ty: y, next: 0, buf: null, spr: null, bakedAt: -99 };
  actors.push(a);
  return a;
}

function savedPlayer(): Spec | null {
  try { const j = localStorage.getItem('lignee.player'); return j ? makeSpec(JSON.parse(j)) : null; } catch { return null; }
}
const player = addActor(savedPlayer() || firstAncestor(), 420, 180, 'player', 0.8);

function becomes(sp: Spec): void {
  const old = player.cr, r = old.root;
  const cr = new Creature3(sp, r.x[0], r.y[0], 0, { dir: { x: old.yaw > 1.57 ? -1 : 1, y: 0, z: 0 }, scale: 0.8 });
  cr.yaw = cr.yawGoal = old.yaw;
  for (let i = 0; i < 60; i++) cr.steer(i * STEP, old.vx, old.vy, 0, 0.2);
  player.cr = cr;
  try { localStorage.setItem('lignee.player', JSON.stringify(sp)); } catch { /* private mode */ }
}
let paused = false;
document.getElementById('atBtn')?.addEventListener('click', () => {
  paused = true;
  Atelier.open(player.cr.spec, {
    playLabel: 'Nager',
    onPlay: (sp) => becomes(makeSpec(sp as Parameters<typeof makeSpec>[0])),
    onClose: () => { paused = false; last = performance.now(); }
  });
});

/** where an animal of this kind lives at x, z */
function homeY(kind: Actor['kind'], x: number, z: number, R: () => number): number {
  const fy = kind === 'floor' ? floorAt(x, z) : openFloor(x, z);
  if (kind === 'floor') return fy - 12;
  if (kind === 'surface') return 12 + R() * 16;
  return clamp(fy - liftAt(x) - 90 - R() * 560, 40, fy - 80);
}

// the animals of every biome: each species of its list at least once, then by weight
{
  const R = rng(3);
  for (let i = 0; i < 5; i++) addActor(firstAncestor(), 420 + rand(-200, 200), rand(120, 260), 'sib', 0.45 + R() * 0.15, rand(-40, 60));
  BIOMES.forEach((b, bi) => {
    const x0 = Math.max(X0 + 300, b.x0 + 200), x1 = (bi + 1 < BIOMES.length ? BIOMES[bi + 1].x0 : X1) - 200;
    let total = 0;
    for (const f of b.fauna) total += f[2];
    for (let k = 0; k < b.pop; k++) {
      let f = b.fauna[k];
      if (!f) { let u = R() * total; f = b.fauna.find((g) => (u -= g[2]) <= 0) || b.fauna[0]; }
      const [id, kind, , scale] = f;
      const x = x0 + R() * (x1 - x0), z = [0, 0, 0, 70, 150, 260, 400][Math.floor(R() * 7)];
      addActor(SPECIES[id](), x, homeY(kind, x, z, R), kind, scale, z);
    }
  });
  for (const [id, kind, x, z, scale] of carcasseDwellers()) addActor(SPECIES[id](), x, homeY(kind, x, z, R), kind, scale, z);
}

// big animals passing far away, across their chapter
interface Visitor { cr: Creature3; z: number; x0: number; x1: number; y: number; dir: number; buf: HTMLCanvasElement; }
const visitors: Visitor[] = BIOMES.flatMap((b, bi) => b.visitors.map(([id, y, z, s]) =>
  [id, Math.max(X0 + 300, b.x0 + 300), (bi + 1 < BIOMES.length ? BIOMES[bi + 1].x0 : X1) - 300, y, z, s] as const)).map(([id, x0, x1, y, z, s]) => {
  const cr = new Creature3(SPECIES[id](), (x0 + x1) / 2, y, z, { dir: { x: 1, y: 0, z: 0 }, scale: s });
  for (let i = 0; i < 90; i++) cr.update(i * STEP, 0.5, 0, 0, 0.2);
  return { cr, z, x0, x1, y, dir: 1, buf: makeCanvas(8, 8) };
});

// fish schools, each in its own plane
class Shoal {
  n: number; z: number; home: number; y0: number; y1: number; glow: boolean; seed: number;
  x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; ph: Float32Array;
  spr: HTMLCanvasElement[]; cx = 0; cy = 0; size: number;
  constructor(home: number, z: number, n: number, body: HSL, belly: HSL, size: number, glow: boolean, seed: number) {
    this.n = n; this.z = z; this.home = home; this.glow = glow; this.seed = seed; this.size = size;
    const fy = openFloor(home, z) - liftAt(home);
    this.y0 = Math.max(40, fy - 420); this.y1 = fy - 90;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.ph = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.x[i] = home + rand(-60, 60); this.y[i] = (this.y0 + this.y1) / 2 + rand(-40, 40); this.vx[i] = rand(-1, 1); this.ph[i] = rand(0, TAU); }
    this.spr = fishSprites(body, belly, 14 * size);
  }
  update(t: number, px: number, py: number, near: boolean): void {
    const n = this.n, X = this.x, Y = this.y, VX = this.vx, VY = this.vy;
    let cx = 0, cy = 0, ax = 0, ay = 0;
    for (let i = 0; i < n; i++) { cx += X[i]; cy += Y[i]; ax += VX[i]; ay += VY[i]; }
    cx /= n; cy /= n; ax /= n; ay /= n;
    this.cx = cx; this.cy = cy;
    const gx = this.home + Math.sin(t * 0.05 + this.seed) * 700, gy = (this.y0 + this.y1) / 2 + Math.cos(t * 0.07 + this.seed) * (this.y1 - this.y0) * 0.4;
    const sep = 10 * this.size;
    for (let i = 0; i < n; i++) {
      let fx = (cx - X[i]) * 0.002 + (ax - VX[i]) * 0.05 + (gx - cx) * 0.0004;
      let fy = (cy - Y[i]) * 0.002 + (ay - VY[i]) * 0.05 + (gy - cy) * 0.0004;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const dx = X[i] - X[j], dy = Y[i] - Y[j];
        if (dx > sep || dx < -sep || dy > sep || dy < -sep) continue;
        const d2 = dx * dx + dy * dy + 0.01;
        fx += (dx / d2) * 1.3; fy += (dy / d2) * 1.3;
      }
      if (near) {
        // scatter around the swimmer (they see it through the depth)
        const dx = X[i] - px, dy = Y[i] - py, d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130) { const d = Math.sqrt(d2) + 0.1, k = (1 - d / 130) * 0.9; fx += (dx / d) * k; fy += (dy / d) * k; }
      }
      let vx = VX[i] + fx + caveRepel(X[i]), vy = VY[i] + fy;
      const m = Math.hypot(vx, vy);
      if (m > 2.2) { vx *= 2.2 / m; vy *= 2.2 / m; } else if (m < 0.7) { vx *= 0.7 / (m || 1); vy *= 0.7 / (m || 1); }
      VX[i] = vx; VY[i] = vy * 0.95;
      X[i] += vx; Y[i] = clamp(Y[i] + VY[i], Math.max(30, ceilAt(X[i], this.z) + 30), floorAt(X[i], this.z) - 40);
      this.ph[i] += 0.25 + m * 0.12;
    }
  }
}
const shoals: Shoal[] = [];
{
  const R = rng(9);
  BIOMES.forEach((b, bi) => b.schools.forEach((s, k) => {
    const mid = biomeMid(bi) + (k - (b.schools.length - 1) / 2) * 1400 + (R() - 0.5) * 600;
    shoals.push(new Shoal(mid, 110 + R() * 380, s.n, s.body, s.belly, s.size, !!s.glow, bi * 10 + k));
  }));
  const c = carcasseSchool;
  shoals.push(new Shoal(c.x, c.z, c.n, c.body, c.belly, c.size, false, 250));
}

// smoke and bubbles
const smoke = new Map<Decor, Puffs>(), bubbles = new Map<Decor, Puffs>();
for (const d of decor) {
  if (d.kind === 'vent') { smoke.set(d, new Puffs(70)); bubbles.set(d, new Puffs(24)); }
  if (d.kind === 'seep') bubbles.set(d, new Puffs(40));
}
const smokeSpr = (() => {
  const c = makeCanvas(64, 64), g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  // lit from below by the mouth: a warm grey that reads on the black water
  gr.addColorStop(0, 'rgba(96,82,74,0.85)'); gr.addColorStop(0.6, 'rgba(70,60,56,0.4)'); gr.addColorStop(1, 'rgba(60,52,50,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return c;
})();
const bubbleSpr = (() => {
  const c = makeCanvas(32, 32), g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(230,250,255,0.85)'; g.lineWidth = 2;
  g.beginPath(); g.arc(16, 16, 13, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(11, 11, 3.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(200,240,255,0.12)'; g.beginPath(); g.arc(16, 16, 12, 0, TAU); g.fill();
  return c;
})();

// plankton and marine snow: points around the camera
const MOTES = 220;

// the Jardin de méduses: thousands of far jellies and giant siphonophores
const jardin = new Jardin(view, ctx, gx);
const motes = Array.from({ length: MOTES }, () => [rand(-700, 700), rand(-500, 500), rand(-200, 1600), rand(0.6, 1.6)]);

// ----- simulation ----- //

const flow = new Flow(32);
let t = 0;
const cam = { x: 420, y: 180 };

function steer(a: Actor, dvx: number, dvy: number, accel: number): void {
  const r = a.cr.root;
  a.cr.steer(t, dvx, dvy, clamp((a.z - r.z[0]) * 0.035, -0.5, 0.5), accel);
}

function collide(cr: Creature3): void {
  const r = cr.root, rad = r.rad[0] + 3, z = r.z[0], x = r.x[0];
  for (let q = rockFrom(x - 200); q < rocks.length && rocks[q].x < x + 200; q++) {
    const k = rocks[q];
    if (Math.abs(k.x - x) > k.r * 1.4 + 20) continue;
    const dz = Math.abs(k.z - z);
    if (dz > k.r) continue;
    const cy = floorAt(k.x, k.z) - k.r * 0.5, rs = Math.sqrt(k.r * k.r - dz * dz) * 1.05;
    const dx = r.x[0] - k.x, dy = (r.y[0] - cy) / 0.8, d = Math.hypot(dx, dy), m = rs + rad;
    if (d < m && d > 0.01) { r.x[0] = k.x + (dx / d) * m; r.y[0] = cy + (dy / d) * m * 0.8; }
  }
  const cy = ceilAt(r.x[0], z) + rad;
  if (r.y[0] < cy) { r.y[0] = cy; if (cr.vy < 0) cr.vy *= -0.3; }
  cr.stand(floorAt(r.x[0], z));
  const fy = floorAt(r.x[0], z) - rad;
  if (r.y[0] > fy) { r.y[0] = fy; if (cr.vy > 0) cr.vy *= -0.3; }
  if (r.y[0] < 8) { r.y[0] = 8; if (cr.vy < 0) cr.vy *= -0.3; }
}

const counts = { near: 0, live: 0, plants: 0, items: 0 };

function update(): void {
  t += STEP;
  const p = player.cr, r = p.root, f = input.follow, kd = input.keyDir();
  if (auto.on) {
    // autopilot (tests): swim along a line through the world
    const dx = auto.x - r.x[0], dy = auto.y - r.y[0], d = Math.hypot(dx, dy) || 1, sp = 2.6 * Math.min(1, d / 70);
    steer(player, (dx / d) * sp, (dy / d) * sp, 0.08);
  } else if (f) {
    const w = view.unproject(f.x, f.y, 0);
    if (w) {
      const dx = w.x - r.x[0], dy = w.y - r.y[0], d = Math.hypot(dx, dy) || 1, sp = 2.6 * Math.min(1, d / 70);
      steer(player, (dx / d) * sp, (dy / d) * sp, 0.08);
    } else steer(player, 0, 0, 0.03);
  } else if (kd) {
    const d = Math.hypot(kd.x, kd.y);
    steer(player, (kd.x / d) * 2.6, (kd.y / d) * 2.6, 0.08);
  } else steer(player, 0, 0, 0.03);
  r.x[0] = clamp(r.x[0], X0 + 200, X1 - 200);
  collide(p);
  const px = r.x[0], py = r.y[0];

  flow.clear();
  const near = (x: number) => Math.abs(x - px) < 1100;
  const inPlane = (a: Actor) => Math.abs(a.cr.root.z[0]) < 60;
  let nNear = 0;
  for (const a of actors) if (inPlane(a) && near(a.cr.root.x[0])) flow.add(a.cr);
  for (const a of actors) {
    if (a.kind === 'player' || !near(a.cr.root.x[0])) continue;
    nNear++;
    const c = a.cr, cr = c.root, x = cr.x[0], y = cr.y[0];
    if (a.kind === 'sib') {
      if (t > a.next) { a.next = t + rand(1.5, 4); a.tx = rand(-90, 90); a.ty = rand(-60, 60); }
      const gx = px + a.tx - x, gy = py + a.ty - y, g = Math.hypot(gx, gy) || 1, d = Math.hypot(px - x, py - y);
      const sp = d > 280 ? 1.9 : 0.9 * Math.min(1, g / 60);
      steer(a, (gx / g) * sp, (gy / g) * sp, 0.04);
      collide(c);
      continue;
    }
    if (t > a.next || Math.hypot(a.tx - x, a.ty - y) < 20) {
      a.next = t + rand(3, 8);
      a.tx = a.hx + rand(-260, 260);
      const fy = floorAt(a.tx, a.z);
      a.ty = a.kind === 'floor' ? fy + 4 : a.kind === 'surface' ? 10 + rand(0, 14) : clamp(a.hy + rand(-120, 120), 40, fy - 50);
    }
    let dx = a.tx - x, dy = a.ty - y;
    if (a.kind === 'swim' && Math.abs(a.z) < 60) {
      const qx = x - px, qy = y - py, q = Math.hypot(qx, qy);
      if (q < 70) { dx += (qx / (q + 1)) * 200; dy += (qy / (q + 1)) * 200; }
    }
    const d = Math.hypot(dx, dy) || 1, sp = c.spec.swim.speed * 0.45 * swimFactor3(c, t) * Math.min(1, d / 60);
    steer(a, (dx / d) * sp, (dy / d) * sp, 0.05);
    collide(c);
  }
  counts.near = nNear;
  let live = 0;
  for (const pl of plants) if (pl.live && pl.cr && Math.abs(pl.x - px) < 700) { live++; pl.cr.update(t, 0, 0, 0, 1); flow.apply(pl.cr, { push: 0.25, wake: 0.04, reach: 18 }); }
  counts.live = live;
  for (const a of actors) if (inPlane(a) && near(a.cr.root.x[0])) flow.apply(a.cr, { push: 0.3, wake: 0.02, body: a.kind === 'player' ? 0.008 : 0.01 });

  for (const v of visitors) {
    const cr = v.cr, vx = cr.root.x[0];
    if (Math.abs(vx - px) > 5200) continue;
    if (vx > v.x1) v.dir = -1; else if (vx < v.x0) v.dir = 1;
    cr.steer(t, v.dir * 0.55 * swimFactor3(cr, t), (v.y - cr.root.y[0]) * 0.01, clamp((v.z - cr.root.z[0]) * 0.02, -0.4, 0.4), 0.02);
  }

  for (const s of shoals) if (Math.abs(s.cx - px) < 2600 || Math.abs(s.home - px) < 2600) s.update(t, px, py, Math.abs(s.z) < 400);

  // smoke rises from the chimneys, bubbles from the chimneys and the seeps
  for (const d of decor) {
    if (Math.abs(d.x - px) > 1800) continue;
    const fy = floorAt(d.x, d.z), sm = smoke.get(d), bu = bubbles.get(d);
    if (sm) {
      if (Math.random() < 0.7) sm.emit(d.x + rand(-4, 4), fy + ventMouth(d), rand(-0.15, 0.15), rand(-1.4, -0.9), rand(6, 10));
      sm.step(t, 'smoke', 0.006);
    }
    if (bu) {
      const y0 = d.kind === 'vent' ? fy + ventMouth(d) - 4 : fy - 2;
      if (Math.random() < (d.kind === 'vent' ? 0.12 : 0.22)) bu.emit(d.x + rand(-8, 8), y0, 0, rand(-1.6, -0.9), rand(1.2, 3.2));
      bu.step(t, 'bubble', 0.0016);
    }
  }

  // plants grow when they come near (a few milliseconds of work per frame at most), and are forgotten far behind
  const deadline = performance.now() + 3;
  for (const pl of plants) {
    const dx = Math.abs(pl.x - px);
    if (!pl.cr && dx < 1800) {
      growPlant2(pl);
      if (performance.now() > deadline) break;
    } else if (pl.cr && dx > 3200) { pl.cr = null; pl.sprite = null; }
  }

  // entering a biome
  const bi = biomeIndex(px);
  if (bi !== here.i && Math.abs(px - BIOMES[bi].x0) > 150) { here.i = bi; showChapter(bi); }
}

// ----- drawing ----- //

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };
const Q: Proj = { x: 0, y: 0, s: 1, d: 1 };
const ROWS = [2000, 1700, 1450, 1240, 1060, 910, 780, 670, 570, 480, 400, 330, 265, 205, 150, 100, 55, 12, -35];

type Item = { d: number; fn: () => void; k?: string };
const skip = new Set<string>();
/** tests: when not empty, only these species are drawn live */
const onlySp = new Set<string>();
const items: Item[] = [];

function drawSprite(sp: Sprite, x: number, y: number, z: number): void {
  view.project(x, y, z, P);
  const k = P.s / sp.res, kv = Math.cos(view.pitch);
  if (gx) { spriteGL(gx, view, dpr, sp, x, y, z, spriteStamp.get(sp.canvas) || 0); return; }
  ctx.setTransform(dpr * k, 0, 0, dpr * k * kv, dpr * P.x, dpr * P.y);
  if (sp.w) ctx.drawImage(sp.canvas, 0, 0, sp.w, sp.h!, -sp.ax * sp.res, -sp.ay * sp.res, sp.w, sp.h!);
  else ctx.drawImage(sp.canvas, -sp.ax * sp.res, -sp.ay * sp.res);
}

let bakes = 0, frameNo = 0;
/** when a reused canvas was last redrawn (WebGL re-uploads its texture when this changes) */
const spriteStamp = new WeakMap<HTMLCanvasElement, number>();
const glowPts: number[] = [];
/** lights drawn after the dark closes in: x, y (screen), size, hue, alpha */
const lights: number[] = [];
const glacier: GlacierScene = { view, ctx, gx, dpr, t: 0, plane: 0 };

function render(): void {
  const m = moodAt(cam.x), pr = player.cr.root, plane = settings.dist;
  env.water = clamp((waterAt(m, cam.y).l - 28) / 30, 0, 1);
  lights.length = 0;
  if (gx) {
    const [r, g, b] = hsl01(m.deep.h, m.deep.s, m.deep.l);
    gx.begin(r, g, b);
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    waterGL(gx, m, waterAt, cam.y, W, H);
    surfaceGL(gx, view, m, waterAt, { h: m.top.h + 10, s: 80, l: Math.min(84, m.top.l + 30) }, cam.x, t, W, (z) => fogOf(view.depth(0, z), plane));
  } else {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // water behind everything
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, css(waterAt(m, cam.y * 0.7 + (i / 4 - 0.4) * 500)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  }

  // the surface seen from below
  view.project(cam.x, 0, -120, P);
  view.project(cam.x, 0, 3200, Q);
  if (!gx && (P.y > -40 || Q.y > 0)) {
    const top = Math.min(P.y, 0), yFar = Q.y;
    const sg = ctx.createLinearGradient(0, top, 0, yFar);
    sg.addColorStop(0, css({ h: m.top.h + 10, s: 80, l: Math.min(84, m.top.l + 30) }));
    sg.addColorStop(0.7, css(waterAt(m, 60), 0.85));
    sg.addColorStop(1, css(waterAt(m, 60), 0));
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, Math.max(0, yFar));
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.2;
    for (const z of [1600, 700, 260, 40]) {
      const [x0, x1] = view.xRange(z, 40);
      ctx.strokeStyle = css(m.sky, clamp(0.22 - fogOf(view.depth(0, z), plane) * 0.22, 0, 0.22));
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const x = x0 + ((x1 - x0) * i) / 40, y = Math.sin(x * 0.012 + t * 1.1 + z) * 3 + Math.sin(x * 0.031 - t * 1.6) * 1.5 + Math.sin(x * 0.004 + z * 0.01) * 14;
        view.project(x, y, z, P);
        if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // everything with a depth, sorted from far to near
  items.length = 0;
  computeProfiles();
  ROWS.forEach((z, r) => items.push({ d: view.depth(floorAt(cam.x, z), z) + 0.5, fn: () => drawRow(r, m, plane), k: 'row' }));
  const open = 1 - caveCover(cam.x);
  const causticA = 0.1 * m.caustics * open * clamp(1 - (floorAt(cam.x, 0) - 500) / 700, 0, 1);
  if (causticA > 0.005) items.push({ d: view.depth(floorAt(cam.x, -20), -20) + 0.6, fn: () => drawCaustics(causticA), k: 'caustic' });
  for (let q = rockFrom(cam.x - 2200); q < rocks.length && rocks[q].x < cam.x + 2200; q++) {
    const k = rocks[q];
    const [x0, x1] = view.xRange(k.z, k.r * 2);
    if (k.x < x0 || k.x > x1) continue;
    const y = floorAt(k.x, k.z);
    items.push({ d: view.depth(y, k.z), fn: () => drawRock(k, y, plane), k: 'rock' });
  }
  for (const d of decor) {
    if (Math.abs(d.x - cam.x) > 2600) continue;
    const [x0, x1] = view.xRange(d.z, 400);
    if (d.x < x0 || d.x > x1) continue;
    const y = floorAt(d.x, d.z);
    if (d.kind !== 'seep') items.push({ d: view.depth(y, d.z), fn: () => drawDecor(d, y, plane), k: 'decor' });
    const sm = smoke.get(d), bu = bubbles.get(d);
    if (sm) items.push({ d: view.depth(y - d.h, d.z) - 1, fn: () => drawPuffs(sm, d.z, smokeSpr, 1), k: 'smoke' });
    if (bu) items.push({ d: view.depth(y - 200, d.z) - 1.5, fn: () => drawPuffs(bu, d.z, bubbleSpr, 0), k: 'bubbles' });
    if (d.kind === 'vent') { view.project(d.x, y + ventMouth(d), d.z, P); lights.push(P.x, P.y, 40 * P.s + 10, 25, 0.9); }
    const bl = d.kind === 'bone' && boneLight(d);
    if (bl) { view.project(d.x, y - bl[0], d.z, P); lights.push(P.x, P.y, bl[1] * P.s, bl[2], bl[3]); }
  }
  let np = 0;
  for (const pl of plants) {
    if (!pl.cr) continue;
    const [x0, x1] = view.xRange(pl.z, 240);
    if (pl.x < x0 || pl.x > x1) continue;
    np++;
    items.push({ d: view.depth(pl.cr.root.y[0], pl.z), fn: () => drawPlant(pl, plane), k: 'plant' });
  }
  counts.plants = np;
  for (const a of actors) {
    const [x0, x1] = view.xRange(a.z, 200);
    const x = a.cr.root.x[0];
    if (x < x0 || x > x1) continue;
    const rz = a.cr.root.z[0];
    items.push({ d: view.depth(a.cr.root.y[0], rz) - 0.2, fn: () => drawActor(a, plane), k: 'actor' });
    const fy = floorAt(x, rz), h = fy - a.cr.root.y[0];
    if (h < 260 && h > -8 && rz < 900 && m.dark < 0.6) items.push({ d: view.depth(fy, rz) + 0.3, fn: () => drawShadow(a, fy, h), k: 'shadow' });
  }
  // in the Fosse the big visitors are shapes drawn after the dark (drawShapes)
  fosse.pitch = pitchOf(m.dark) * clamp((cam.y - 250) / 900, 0, 1);
  for (const v of visitors) {
    const [x0, x1] = view.xRange(v.z, 400);
    if (v.cr.root.x[0] < x0 || v.cr.root.x[0] > x1 || fosse.pitch >= 0.02) continue;
    items.push({ d: view.depth(v.y, v.cr.root.z[0]), fn: () => drawVisitor(v, m, plane), k: 'visitor' });
  }
  for (const s of shoals) {
    if (Math.abs(s.cx - cam.x) > 2000) continue;
    items.push({ d: view.depth(s.cy, s.z), fn: () => drawShoal(s), k: 'fish' });
  }
  jardin.collect(cam.x, cam.y, t, (d, fn) => items.push({ d, fn, k: 'jellies' }), { dpr, W, H, plane });
  glacier.dpr = dpr; glacier.t = t; glacier.plane = plane;
  glacierItems(glacier, cam.x, (d, fn) => items.push({ d, fn, k: 'glacier' }));
  if (m.rays * open > 0.02 && cam.y < 1400) items.push({ d: view.depth(300, 700), fn: () => drawRays(open < 1 ? { ...m, rays: m.rays * open } : m), k: 'rays' });
  pushCave(items, { view, ctx, gx, dpr, W, H, t, lights, px: pr.x[0], py: pr.y[0] }, m, cam.x, plane);
  items.sort((a, b) => b.d - a.d);
  counts.items = items.length;
  bakes = 0;
  lodTally.fill(0);
  for (const it of items) if (!it.k || !skip.has(it.k)) it.fn();
  for (let k = 0; k < 4; k++) lodCount[k] = lodTally[k];
  if (!skip.has('front')) drawFrontLayer(m);

  // the deep closes in around the swimmer: the dark is painted over everything, the lights come after
  const dk = Math.max(m.dark * clamp((cam.y - 250) / 900, 0, 1), caveDark(cam.x));
  view.project(pr.x[0], pr.y[0], 0, P);
  // in the Fosse only the swimmer's own light opens the dark
  fosse.glow = glowOf(player.cr.list);
  fosse.reach = lightReach(fosse.glow) * P.s;
  if (gx) { renderGLTop(m, dk); return; }
  if (dk > 0.02 && !skip.has('dark')) {
    const { r, a } = darkStops(dk, fosse.pitch, P.s, fosse.reach, W, H);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dg = ctx.createRadialGradient(P.x, P.y, r[0], P.x, P.y, r[2]);
    const deep = m.deep;
    dg.addColorStop(0, css(deep, a[0]));
    dg.addColorStop((r[1] - r[0]) / (r[2] - r[0]), css(deep, a[1], -2));
    dg.addColorStop(1, css(deep, a[2], -3));
    ctx.fillStyle = dg;
    ctx.fillRect(0, 0, W, H);
  }
  drawShapes();

  // glows of the creatures: many small lights on one animal share their strength, so they never burn to white
  ctx.globalCompositeOperation = 'lighter';
  const lum = 1 + dk * 1.2;
  if (!skip.has('glow')) for (const a of actors) {
    if (Math.abs(a.cr.root.x[0] - cam.x) > 1400) continue;
    glowPts.length = 0;
    eachGlow3(a.cr, view, (x, y, size, hue, al) => { glowPts.push(x, y, size, hue, al); });
    const n = glowPts.length / 5;
    if (!n) continue;
    const share = 1 / Math.sqrt(Math.max(1, n / 2.5)), base = (0.46 - 0.3 * env.water) * lum;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < glowPts.length; i += 5) {
      const size = glowPts[i + 2] * (0.8 + 0.2 * share);
      ctx.globalAlpha = Math.min(1, glowPts[i + 4] * base * share);
      ctx.drawImage(glowSprite(glowPts[i + 3]), glowPts[i] - size, glowPts[i + 1] - size, size * 2, size * 2);
    }
  }
  // lights of the world: vent mouths, lantern fish
  if (!skip.has('glow')) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < lights.length; i += 5) {
      const size = lights[i + 2];
      ctx.globalAlpha = lights[i + 4];
      ctx.drawImage(glowSprite(lights[i + 3]), lights[i] - size, lights[i + 1] - size, size * 2, size * 2);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // plankton, marine snow; in the dark they sparkle where the swimmer stirs the water
  if (!skip.has('motes')) drawMotes(m, dk);
  if (!skip.has('crystals')) drawCrystals(glacier, cam.x, cam.y);

  // the vignette and the deep closing in are CSS layers over the canvas (free of canvas fill-rate)
  const dd = clamp((pr.y[0] - 300) / 900, 0, 1);
  if (deepEl && (frameNo & 7) === 0) deepEl.style.background = css(m.deep, dd * 0.18 * (1 - m.dark), -10);
}

const deepEl = document.getElementById('deep');
/** the total dark of the Fosse (0..1) and the reach of the swimmer's light on screen */
const fosse = { pitch: 0, reach: 0, glow: 0 };

/** the huge animals of the total dark, drawn after it */
function drawShapes(): void {
  if (fosse.pitch < 0.02 || skip.has('visitor')) return;
  for (const v of visitors) {
    const [x0, x1] = view.xRange(v.z, 400);
    if (v.cr.root.x[0] >= x0 && v.cr.root.x[0] <= x1) drawShape(gx, ctx, view, dpr, v, fosse.pitch, t);
  }
}

/** WebGL: what is painted over the scene (the dark, the glows, the lights, the plankton), then the frame is sent */
function renderGLTop(m: M, dk: number): void {
  const g = gx!, pr = player.cr.root;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (dk > 0.02 && !skip.has('dark')) {
    view.project(pr.x[0], pr.y[0], 0, P);
    const { r, a } = darkStops(dk, fosse.pitch, P.s, fosse.reach, W, H), deep = m.deep;
    rings(g, P.x, P.y, r, [hcol(g, deep, a[0]), hcol(g, deep, a[1], -2), hcol(g, deep, a[2], -3)], Math.hypot(W, H) * 1.5, 64);
  }
  drawShapes();
  if (!skip.has('glow')) {
    const lum = 1 + dk * 1.2;
    for (const a of actors) {
      if (Math.abs(a.cr.root.x[0] - cam.x) > 1400) continue;
      glowPts.length = 0;
      eachGlow3(a.cr, view, (x, y, size, hue, al) => { glowPts.push(x, y, size, hue, al); });
      const n = glowPts.length / 5;
      if (!n) continue;
      const share = 1 / Math.sqrt(Math.max(1, n / 2.5)), base = (0.46 - 0.3 * env.water) * lum;
      glowsGL(g, glowPts, (i) => Math.min(1, glowPts[i + 4] * base * share), 0.8 + 0.2 * share);
    }
    glowsGL(g, lights, (i) => lights[i + 4]);
  }
  if (!skip.has('motes')) drawMotes(m, dk);
  if (!skip.has('crystals')) drawCrystals(glacier, cam.x, cam.y);
  const dd = clamp((pr.y[0] - 300) / 900, 0, 1);
  if (deepEl && (frameNo & 7) === 0) deepEl.style.background = css(m.deep, dd * 0.18 * (1 - m.dark), -10);
  g.end();
}

function drawMotes(m: M, dk: number): void {
  const pr = player.cr.root;
  view.project(pr.x[0], pr.y[0], 0, Q);
  const qx = Q.x, qy = Q.y, reach = Math.max(110 * Q.s + 30, fosse.reach * fosse.pitch), lit = 1 - fosse.pitch;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fall = m.snow * 22;
  const near: number[] = [];
  // in the dark the stirred motes sparkle; in the Fosse the snow shows white where the light reaches
  const fp = fosse.pitch, sparkle = `hsla(${185 + 20 * fp},${100 - 40 * fp}%,${72 + 16 * fp}%,${((0.35 + 0.25 * Math.sin(t * 5)) * (1 - fp) + 0.7 * fp).toFixed(3)})`;
  const mcol = gx ? hcol(gx, m.plankton, 0.5 * (1 - dk * 0.6) * lit) : 0;
  ctx.fillStyle = css(m.plankton, 0.5 * (1 - dk * 0.6) * lit);
  ctx.beginPath();
  for (const mo of motes) {
    const x = cam.x + ((((mo[0] + t * 3) % 1400) + 2100) % 1400) - 700;
    const y = cam.y + ((((mo[1] + t * fall * mo[3] + 500) % 1000) + 1000) % 1000) - 500 + Math.sin(t * 0.3 + mo[3] * 9) * 6;
    if (y < 4) continue;
    view.project(x, y, mo[2], P);
    const s = Math.max(0.4, mo[3] * P.s * (1 + m.snow * 0.5));
    if (dk > 0.2 && Math.abs(P.x - qx) < reach && Math.abs(P.y - qy) < reach) { near.push(P.x, P.y, s, 1 - fosse.pitch * (1 - snowLit(Math.hypot(P.x - qx, P.y - qy), fosse.reach))); continue; }
    if (lit < 0.03) continue;
    if (gx) { disc(gx, P.x, P.y, s, mcol); continue; }
    ctx.moveTo(P.x + s, P.y);
    ctx.arc(P.x, P.y, s, 0, TAU);
  }
  if (gx) {
    if (near.length) {
      gx.setBlend('add');
      for (let i = 0; i < near.length; i += 4) disc(gx, near[i], near[i + 1], near[i + 2] * 1.6, gx.packCss(sparkle, near[i + 3]));
      gx.setBlend('over');
    }
    return;
  }
  ctx.fill();
  if (near.length) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sparkle;
    for (let i = 0; i < near.length; i += 4) {
      const s = near[i + 2] * 1.6;
      ctx.globalAlpha = near[i + 3];
      ctx.beginPath(); ctx.arc(near[i], near[i + 1], s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

/** projected profile of every row of floor, computed once per frame */
const ROW_N = 40;
const profiles: Float32Array[] = ROWS.map(() => new Float32Array((ROW_N + 1) * 2));
function computeProfiles(): void {
  ROWS.forEach((z, r) => {
    const [x0, x1] = view.xRange(z, 80), pf = profiles[r];
    for (let i = 0; i <= ROW_N; i++) {
      const x = x0 + ((x1 - x0) * i) / ROW_N;
      view.project(x, floorAt(x, z), z, P);
      pf[i * 2] = P.x; pf[i * 2 + 1] = P.y;
    }
  });
}

function drawRow(r: number, m: M, plane: number): void {
  const z = ROWS[r], pf = profiles[r], nf = r + 1 < ROWS.length ? profiles[r + 1] : null;
  const fy = floorAt(cam.x, z), d = view.depth(fy, z), fog = fogOf(d, plane);
  const back = clamp((z - 300) / 700, 0, 1);
  const base = { h: m.sand.h, s: m.sand.s, l: m.sand.l - 6 - z * 0.004 };
  const col = fogged(m, back > 0 ? { h: base.h + (m.rock.h - base.h) * back, s: base.s + (m.rock.s - base.s) * back, l: base.l + (m.rock.l - base.l) * back } : base, fy * 0.6 + z * 0.3, fog);
  if (gx) { gx.setTransform(dpr, 0, 0, dpr, 0, 0); rowGL(gx, pf, nf, ROW_N, col, z, H); return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let top = Infinity, bot = -Infinity;
  ctx.beginPath();
  for (let i = 0; i <= ROW_N; i++) {
    const x = pf[i * 2], y = pf[i * 2 + 1];
    if (y < top) top = y;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  if (nf) {
    for (let i = ROW_N; i >= 0; i--) {
      const y = Math.max(nf[i * 2 + 1], pf[i * 2 + 1]) + 2.5;
      if (y > bot) bot = y;
      ctx.lineTo(nf[i * 2], y);
    }
  } else { bot = H + 4; ctx.lineTo(pf[ROW_N * 2] + 20, bot); ctx.lineTo(pf[0] - 20, bot); }
  ctx.closePath();
  if (top > H || bot < 0) return;
  const gr = ctx.createLinearGradient(0, top, 0, Math.max(top + 30, bot));
  gr.addColorStop(0, css(col, 1, 2));
  gr.addColorStop(1, css(col, 1, -4));
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i <= ROW_N; i++) if (i) ctx.lineTo(pf[i * 2], pf[i * 2 + 1]); else ctx.moveTo(pf[0], pf[1]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = css(col, z > 600 ? 0.5 : 0.18, 12);
  ctx.stroke();
}

const CAUSTIC_FROM = ROWS.findIndex((z) => z <= 240);
function drawCaustics(alpha: number): void {
  const pf = profiles[CAUSTIC_FROM], z = ROWS[CAUSTIC_FROM];
  view.project(0, 0, z, P);
  const s = P.s;
  if (gx) { gx.setTransform(dpr, 0, 0, dpr, 0, 0); causticsGL(gx, causticCv, pf, ROW_N, H, s, P.x + t * 10 * s, P.y + t * 4 * s, alpha); return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.save();
  ctx.beginPath();
  let top = Infinity;
  for (let i = 0; i <= ROW_N; i++) { if (pf[i * 2 + 1] < top) top = pf[i * 2 + 1]; if (i) ctx.lineTo(pf[i * 2], pf[i * 2 + 1]); else ctx.moveTo(pf[0], pf[1]); }
  ctx.lineTo(pf[ROW_N * 2] + 20, H + 4);
  ctx.lineTo(pf[0] - 20, H + 4);
  ctx.closePath();
  ctx.clip();
  caustic.setTransform(new DOMMatrix([s * 0.75, 0, s * 0.2, s * 0.3, P.x + t * 10 * s, P.y + t * 4 * s]));
  ctx.fillStyle = caustic;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillRect(0, Math.max(0, top), W, H);
  ctx.restore();
}

function drawRock(k: RockX, y: number, plane: number): void {
  const d = view.depth(y, k.z);
  view.project(k.x, y, k.z, P);
  const res = Math.min(3, P.s * dpr);
  if ((!k.sprite || Math.abs(d - k.spriteD) / k.spriteD > 0.3 || k.sprite.res < res * 0.6) && bakes++ < 3) {
    const mm = moodAt(k.x);
    k.sprite = bakeRock(k.r, k.seed, mm, k.encrust, fogOf(d, plane), waterAt(mm, y * 0.5 + k.z * 0.3), res);
    k.spriteD = d;
  }
  if (k.sprite) drawSprite(k.sprite, k.x, y + k.r * 0.2, k.z);
}

function drawDecor(dc: Decor, y: number, plane: number): void {
  const d = view.depth(y, dc.z);
  view.project(dc.x, y, dc.z, P);
  const res = Math.min(2.5, P.s * dpr);
  if ((!dc.sprite || Math.abs(d - dc.spriteD) / dc.spriteD > 0.3 || dc.sprite.res < res * 0.6) && bakes++ < 4) {
    const mm = moodAt(dc.x);
    dc.sprite = bakeDecor(dc, mm, fogOf(d, plane), waterAt(mm, y * 0.5 + dc.z * 0.3), res);
    dc.spriteD = d;
  }
  if (dc.sprite) drawSprite(dc.sprite, dc.x, y, dc.z);
}

function drawPuffs(p: Puffs, z: number, spr: HTMLCanvasElement, smokeK: number): void {
  const half = spr.width / 2;
  for (let i = 0; i < p.n; i++) {
    const life = p.life[i];
    if (life <= 0) continue;
    view.project(p.x[i], p.y[i], z, P);
    const r = p.r[i] * P.s;
    if (r < 0.3) continue;
    const al = smokeK ? Math.min(1, life * 1.4) * 0.55 : Math.min(1, life * 3) * 0.8;
    if (gx) {
      gx.setTransform(dpr * r / half, 0, 0, dpr * r / half, dpr * P.x, dpr * P.y);
      gx.alpha = al;
      gx.image(spr, 0, 0, spr.width, spr.height, -half, -half, spr.width, spr.height);
      continue;
    }
    ctx.setTransform(dpr * r / half, 0, 0, dpr * r / half, dpr * P.x, dpr * P.y);
    ctx.globalAlpha = al;
    ctx.drawImage(spr, -half, -half);
  }
  if (gx) gx.alpha = 1;
  ctx.globalAlpha = 1;
}

function drawPlant(pl: Plant, plane: number): void {
  const cr = pl.cr!;
  if (pl.live && Math.abs(pl.x - cam.x) < 900) { drawLive(cr, pl.z, false); return; }
  const d = view.depth(cr.root.y[0], pl.z);
  view.project(pl.x, cr.root.y[0], pl.z, P);
  const res = Math.min(3, P.s * dpr);
  if ((!pl.sprite || Math.abs(d - pl.spriteD) / pl.spriteD > 0.3) && bakes++ < 4) {
    pl.sprite = bakeCreature(cr, fogOf(d, plane), waterAt(moodAt(pl.x), cr.root.y[0] * 0.5 + pl.z * 0.3), res);
    pl.spriteD = d;
  }
  if (pl.sprite) drawSprite(pl.sprite, cr.root.x[0], cr.root.y[0], pl.z);
}

/** what an animal drawn live keeps between frames: its impostor (the image shown while it is too small to draw) */
interface Impostor { buf: HTMLCanvasElement; spr: Sprite | null; bakedAt: number; }
const impostors = new WeakMap<Creature3, Impostor>();
/** how many living things were drawn at each level in the last frame (0, 1, 2, impostor) */
const lodCount = [0, 0, 0, 0];
const lodTally = [0, 0, 0, 0];
const clipBox: [number, number, number, number] = [0, 0, 0, 0];

/**
 * A living thing near the swimming plane: drawn live in perspective at the
 * level of detail its size calls for, or shown as its impostor when it is
 * tiny (re-baked every 2 to 6 frames, the smaller the rarer). Returns the level.
 */
function drawLive(cr: Creature3, z: number, isPlayer: boolean): number {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  clipBox[0] = -30; clipBox[1] = -30; clipBox[2] = W + 30; clipBox[3] = H + 30;
  if (gx) {
    // WebGL: always live (a tiny animal costs a few triangles, no image to bake)
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let lv = prepare3(cr, view, isPlayer ? 1 : bias);
    if (!opts.lod) lv = 0;
    if (isPlayer) lv = Math.min(lv, 1);
    lodTally[lv]++;
    paint3(gx, cr, view, { ink: opts.ink, shade: opts.shade, water: env.water, lod: Math.min(lv, 2), clip: opts.lod ? clipBox : undefined });
    return lv;
  }
  if (!opts.lod) { draw3(ctx, cr, view, { ink: opts.ink, shade: opts.shade, water: env.water }); lodTally[0]++; return 0; }
  // the swimmer (the one you watch) keeps at least level 1, and is never judged smaller than it is
  let lv = prepare3(cr, view, isPlayer ? 1 : bias);
  if (isPlayer) lv = Math.min(lv, 1);
  lodTally[lv]++;
  if (lv < 3) {
    draw3(ctx, cr, view, { ink: opts.ink, shade: opts.shade, water: env.water, lod: lv, clip: clipBox });
    return lv;
  }
  const r = cr.root, size = lodSize(cr), every = size < 5 ? 6 : size < 8 ? 4 : 2;
  view.project(r.x[0], r.y[0], z, P);
  const res = clamp(P.s * dpr, 0.3, 3);
  let im = impostors.get(cr);
  if (!im) { im = { buf: makeCanvas(8, 8), spr: null, bakedAt: -99 }; impostors.set(cr, im); }
  if (!im.spr || frameNo - im.bakedAt >= every || Math.abs(im.spr.res - res) > res * 0.25) {
    // an impostor is small: baked at the simplest level (a bake costs its paths like a live drawing)
    im.spr = bakeCreature(cr, 0, waterAt(moodAt(r.x[0]), r.y[0]), res, im.buf, 2);
    im.bakedAt = frameNo;
  }
  drawSprite(im.spr, r.x[0], r.y[0], r.z[0]);
  return 3;
}

/** near: drawn live in perspective; far: baked flat (every few frames) and washed with the colour of the water */
function drawActor(a: Actor, plane: number): void {
  const r = a.cr.root, rz = r.z[0], d = view.depth(r.y[0], rz), fog = fogOf(d, plane);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (fog < 0.1) {
    if (!skip.has('near') && !(onlySp.size && !onlySp.has(a.cr.spec.name))) drawLive(a.cr, rz, a === player);
    return;
  }
  if (skip.has('far')) return;
  view.project(r.x[0], r.y[0], rz, P);
  const res = clamp(P.s * dpr, 0.3, 3), size = (a.cr.box[3] - a.cr.box[0]) * P.s;
  if (gx) {
    // WebGL: drawn live every frame, washed with the water by a tint of its colours
    const fc = waterAt(moodAt(r.x[0]), r.y[0] + 140), [fr, fg, fb] = hsl01(fc.h, fc.s, fc.l);
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.tintR = fr; gx.tintG = fg; gx.tintB = fb; gx.tintAmt = fog * 0.85;
    const lv = opts.lod ? Math.min(2, prepare3(a.cr, view, bias)) : (prepare3(a.cr, view), 0);
    paint3(gx, a.cr, view, { ink: opts.ink, shade: opts.shade, water: env.water, lod: lv, clip: opts.lod ? clipBox : undefined });
    gx.tintAmt = 0;
    return;
  }
  // the smaller on screen, the less often it is re-baked
  const every = opts.lod ? Math.max(opts.farEvery, size < 6 ? 6 : size < 12 ? 4 : 0) : opts.farEvery;
  if (!a.buf) a.buf = makeCanvas(8, 8);
  if (!a.spr || frameNo - a.bakedAt >= every || Math.abs(a.spr.res - res) > res * 0.25) {
    // at the level of detail its size calls for (a bake costs its paths like a live drawing)
    a.spr = bakeCreature(a.cr, fog * 0.85, waterAt(moodAt(r.x[0]), r.y[0] + 140), res, a.buf, opts.lod ? Math.min(2, lodOf(size, -1, bias)) : 0);
    a.bakedAt = frameNo;
  }
  // its anchor is the root: between two bakes the image just follows the root
  drawSprite(a.spr, r.x[0], r.y[0], rz);
}

function drawShadow(a: Actor, fy: number, h: number): void {
  const cr = a.cr, r = cr.root, len = (cr.box[3] - cr.box[0]) * 0.55 + 6;
  view.project(r.x[0], fy, r.z[0], P);
  const rx = len * P.s, al = 0.32 * (1 - clamp(h / 260, 0, 1)) * (1 - fogOf(P.d, settings.dist) * 0.8);
  if (al < 0.01 || rx < 2) return;
  if (gx) { shadowGL(gx, dpr, view.pitch, P.x, P.y, rx, al); return; }
  ctx.setTransform(dpr, 0, 0, dpr * Math.max(0.12, 0.3 * Math.cos(view.pitch)), dpr * P.x, dpr * P.y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(6,20,30,${al.toFixed(3)})`);
  g.addColorStop(1, 'rgba(6,20,30,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
}

function drawVisitor(v: Visitor, m: Mood, plane: number): void {
  const cr = v.cr, rz = cr.root.z[0], d = view.depth(v.y, rz);
  view.project(cr.root.x[0], cr.root.y[0], rz, P);
  if (gx) {
    // WebGL: live, washed with the deep water, a little transparent
    const fc = fogged(m, m.deep, 300, 0.4), [fr, fg, fb] = hsl01(fc.h, fc.s, fc.l);
    gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gx.tintR = fr; gx.tintG = fg; gx.tintB = fb; gx.tintAmt = fogOf(d, plane) * 0.9 + 0.1;
    const lv = opts.lod ? Math.min(2, prepare3(cr, view, bias)) : (prepare3(cr, view), 0);
    paint3(gx, cr, view, { ink: opts.ink, shade: opts.shade, water: env.water, lod: lv, alpha: 0.85 });
    gx.tintAmt = 0;
    return;
  }
  // baked at the level of detail of its size on screen
  const sp = bakeCreature(cr, fogOf(d, plane) * 0.9 + 0.1, fogged(m, m.deep, 300, 0.4), 0.6, v.buf, opts.lod ? Math.min(2, lodOf((cr.box[3] - cr.box[0]) * P.s, -1, bias)) : 0);
  const k = P.s / sp.res;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(sp.canvas, 0, 0, sp.w!, sp.h!, P.x - sp.ax * sp.res * k, P.y - sp.ay * sp.res * k * Math.cos(view.pitch), sp.w! * k, sp.h! * k * Math.cos(view.pitch));
  ctx.globalAlpha = 1;
}

function drawShoal(s: Shoal): void {
  const spr = s.spr, sw = spr[0].width / 2, sh = spr[0].height / 2, atlas = gx ? fishAtlas(spr) : null;
  for (let i = 0; i < s.n; i++) {
    view.project(s.x[i], s.y[i], s.z, P);
    if (P.x < -40 || P.x > W + 40 || P.y < -40 || P.y > H + 40) continue;
    const ang = Math.atan2(s.vy[i], s.vx[i]), flip = Math.cos(ang) < 0 ? -1 : 1, co = Math.cos(ang), si = Math.sin(ang), a = P.s * dpr * 0.5;
    if (gx && atlas) fishGL(gx, atlas, Math.floor(s.ph[i]) % 3, sw, sh, P.x, P.y, s.vx[i], s.vy[i], P.s, dpr);
    else {
      ctx.setTransform(a * co, a * si, -a * si * flip, a * co * flip, P.x * dpr, P.y * dpr);
      ctx.drawImage(spr[Math.floor(s.ph[i]) % 3], -sw, -sh);
    }
    // lantern fish: a row of lights on the belly
    if (s.glow && (i & 1) === 0) lights.push(P.x, P.y + 1.5 * P.s, 5 * P.s + 2, 190, 0.5 + 0.3 * Math.sin(t * 3 + i));
  }
}

function drawRays(m: M): void {
  if (gx) { gx.setTransform(dpr, 0, 0, dpr, 0, 0); raysGL(gx, view, m, cam.x, t); return; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  const sp = 380;
  for (let k = Math.floor((cam.x - 1200) / sp); k <= Math.floor((cam.x + 1200) / sp); k++) {
    const h1 = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1, h2 = Math.abs(Math.sin(k * 78.233) * 12345.678) % 1;
    if (h1 < 0.45) continue;
    const x = k * sp + h2 * 200, z = 150 + h1 * 900, w = 26 + h2 * 60, L = 560;
    const al = m.rays * 0.12 * (0.5 + 0.5 * Math.sin(t * 0.25 + k * 1.7));
    view.project(x, 0, z, P); const ax = P.x, ay = P.y, aw = w * P.s;
    view.project(x + L * 0.3, L, z, Q); const bx = Q.x, by = Q.y, bw = w * 1.6 * Q.s;
    const gr = ctx.createLinearGradient(0, ay, 0, by);
    gr.addColorStop(0, css(m.sky, al));
    gr.addColorStop(1, css(m.sky, 0));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(ax - aw / 2, ay); ctx.lineTo(ax + aw / 2, ay); ctx.lineTo(bx + bw / 2, by); ctx.lineTo(bx - bw / 2, by);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** the dark foreground between the eye and the swimmer (foreground.ts) */
const frontPaint = frontPainter(gx, ctx, () => dpr);
function drawFrontLayer(m: M): void {
  const pr = player.cr.root;
  view.project(pr.x[0], pr.y[0], 0, Q);
  drawFront(front, {
    project: (x, y, z) => view.project(x, y, z, P), xRange: (z, mg) => view.xRange(z, mg), floorAt,
    W, H, px: Q.x, py: Q.y, clear: Math.max(110, Math.min(W, H) * 0.24), t, alpha: 0.92 * (1 - m.dark * 0.5),
    colour: (x) => css(frontColour(waterAt(moodAt(x), floorAt(x, 0) * 0.6)))
  }, frontPaint);
}

// ----- chapters and the depth gauge ----- //

const here = { i: 0 };
const chapterEl = document.getElementById('chapter')!, hudEl = document.getElementById('hud')!;
let chapterTimer = 0;
function showChapter(i: number): void {
  const b = BIOMES[i];
  chapterEl.innerHTML = '';
  const h = document.createElement('strong'); h.textContent = b.name;
  const s = document.createElement('span'); s.textContent = b.sub;
  chapterEl.append(h, s);
  chapterEl.classList.remove('show');
  void chapterEl.offsetWidth;
  chapterEl.classList.add('show');
  clearTimeout(chapterTimer);
  chapterTimer = window.setTimeout(() => chapterEl.classList.remove('show'), 4200);
}

// ----- loop ----- //

let last = performance.now(), acc = 0, fn = 0, fsum = 0;
const timeScale = { v: 1 };
const lockQuality = { v: false };
const stats = { fps: 0, render: 0, update: 0, flush: 0 };
/** autopilot for the tests: the swimmer goes to (x, y) */
const auto = { on: false, x: 0, y: 0 };
export interface FrameSample { dt: number; update: number; render: number; flush: number; steps: number; }
let onFrame: ((s: FrameSample) => void) | null = null;

function frame(now: number): void {
  if (paused) { last = now; requestAnimationFrame(frame); return; }
  const dt = now - last;
  last = now;
  frameNo++;
  acc += Math.min(0.1, dt / 1000) * timeScale.v;
  let steps = 0;
  const u0 = performance.now();
  while (acc >= STEP && steps < 3) { update(); acc -= STEP; steps++; }
  const ut = performance.now() - u0;
  stats.update = stats.update * 0.9 + ut * 0.1;
  if (steps === 3) acc = 0;
  const r = player.cr.root, dist = 900 / input.zoomMul, pitch = (settings.angle * Math.PI) / 180;
  cam.x += (r.x[0] + player.cr.vx * 20 - cam.x) * 0.07;
  cam.y += (r.y[0] + player.cr.vy * 20 - cam.y) * 0.07;
  const ty = Math.max(cam.y, 30 + dist * Math.sin(pitch));
  view.aim(cam.x, ty, dist, pitch);
  const r0 = performance.now();
  render();
  const rt = performance.now() - r0;
  let ft = 0;
  if (opts.flush) { const f0 = performance.now(); if (gx) gx.finish(); else ctx.getImageData(0, 0, 1, 1); ft = performance.now() - f0; }
  stats.render = stats.render * 0.9 + rt * 0.1;
  stats.flush = stats.flush * 0.9 + ft * 0.1;
  onFrame?.({ dt, update: ut, render: rt, flush: ft, steps });
  fn++; fsum += dt;
  if (fn >= 60) {
    const avg = fsum / fn;
    stats.fps = 1000 / avg;
    if (!lockQuality.v) {
      if (avg > 21) { if (bias < BIAS_MAX) setBias(bias * 1.3); else if (quality > 0.55) { quality *= 0.85; resize(); } }
      else if (avg < 15) { if (quality < 1) { quality = Math.min(1, quality / 0.9); resize(); } else if (bias > 1) setBias(bias / 1.3); }
    }
    fn = 0; fsum = 0;
    fpsEl.textContent = `${stats.fps.toFixed(0)} img/s · niveaux ${lodCount.join('/')} (biais ${bias.toFixed(2)}) · résolution ${Math.round(quality * 100)} % · simulation ${stats.update.toFixed(1)} ms · dessin ${stats.render.toFixed(1)} ms · ${counts.near} animaux proches · ${counts.plants} plantes`;
  }
  if ((frameNo & 15) === 0) hudEl.textContent = `${BIOMES[biomeIndex(r.x[0])].name} · −${metres(r.y[0])} m`;
  requestAnimationFrame(frame);
}

function teleport(x: number, y: number): void {
  const cr = player.cr;
  cr.translate(x - cr.root.x[0], y - cr.root.y[0], 0);
  cr.vx = cr.vy = 0;
  cam.x = x; cam.y = y;
  // the siblings follow
  for (const a of actors) if (a.kind === 'sib') a.cr.translate(x + rand(-80, 80) - a.cr.root.x[0], y + rand(-50, 50) - a.cr.root.y[0], 0);
}

/** swim into the middle of a biome, at mid water */
function gotoBiome(i: number): void {
  const { x, y } = arrival(i);
  teleport(x, y);
}

/** a crowd of animals around the swimmer, in its plane (for the load test) */
function spawnCrowd(n: number, seed = 1): void {
  const R = rng(seed), ids = Object.keys(SPECIES), px = player.cr.root.x[0], py = player.cr.root.y[0];
  for (let k = 0; k < n; k++) {
    const x = px + (R() - 0.5) * 1100, z = R() < 0.6 ? 0 : 70 + R() * 300;
    const y = clamp(py + (R() - 0.5) * 400, 40, floorAt(x, z) - 60);
    const a = addActor(SPECIES[ids[Math.floor(R() * ids.length)]](), x, y, 'swim', 0.8, z);
    a.temp = true;
  }
}
/** one animal of a species next to the swimmer, in its plane (for the tests) */
function spawn(id: string, kind: Actor['kind'], dx: number, dy: number, scale = 0.8): Actor {
  const r = player.cr.root, x = r.x[0] + dx, y = kind === 'floor' ? floorAt(x, 0) - 12 : r.y[0] + dy;
  const a = addActor(SPECIES[id](), x, y, kind, scale, 0);
  a.temp = true;
  return a;
}
function clearCrowd(): void {
  for (let i = actors.length - 1; i >= 0; i--) if (actors[i].temp) actors.splice(i, 1);
}

export const api = {
  settings, opts, detail, onlySp, player, stats, counts, jardin, actors, plants, rocks, decor, view, input, timeScale, skip, lockQuality, auto, front, frontCount,
  biomes: BIOMES, carcasse: CARCASSE, fosse, teleport, gotoBiome, spawnCrowd, clearCrowd, spawn, floorAt, becomes,
  setQuality: (q: number) => { quality = q; resize(); },
  renderer, gfx: gx, setBias, get bias() { return bias; }, get quality() { return quality; }, lodCount,
  get dpr() { return dpr; },
  get size() { return [W, H, canvas.width, canvas.height]; },
  setFrameHook: (f: typeof onFrame) => { onFrame = f; }
};
(window as unknown as { monde: typeof api }).monde = api;

// ----- settings panel ----- //

const panel = document.getElementById('panel')!, gear = document.getElementById('gear')!;
const angleIn = document.getElementById('angle') as HTMLInputElement, angleOut = document.getElementById('angleVal')!;
const distIn = document.getElementById('dist') as HTMLInputElement, distOut = document.getElementById('distVal')!;
const fpsEl = document.getElementById('fps')!;
angleIn.value = String(settings.angle); distIn.value = String(Math.round(settings.dist));
const showVals = () => { angleOut.textContent = settings.angle + '°'; distOut.textContent = Math.round(900 / input.zoomMul) + ''; };
showVals();
gear.addEventListener('click', () => { panel.hidden = !panel.hidden; });
angleIn.addEventListener('input', () => { settings.angle = +angleIn.value; showVals(); save(); });
distIn.addEventListener('input', () => { input.zoomMul = 900 / +distIn.value; settings.dist = +distIn.value; showVals(); save(); });
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-angle]')) {
  b.addEventListener('click', () => { settings.angle = +b.dataset.angle!; angleIn.value = b.dataset.angle!; showVals(); save(); });
}
setInterval(() => { const d = Math.round(900 / input.zoomMul); if (+distIn.value !== d) { distIn.value = String(d); settings.dist = d; showVals(); save(); } }, 400);
const trip = document.getElementById('trip')!;
BIOMES.forEach((b, i) => {
  const btn = document.createElement('button');
  btn.textContent = b.name.replace(/^(La |Le |Les )/, '');
  btn.addEventListener('click', () => gotoBiome(i));
  trip.append(btn);
});
const benchOut = document.getElementById('benchOut')!;
document.getElementById('benchBtn')!.addEventListener('click', () => { panel.hidden = true; void runBench(api, benchOut); });
for (const el of [panel, gear, benchOut, document.getElementById('atBtn')!]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
const hint = document.getElementById('hint')!;
setTimeout(() => hint.classList.add('gone'), 6000);
document.addEventListener('touchmove', (e) => { if (!(e.target as HTMLElement).closest('#panel, #atelier, #benchOut')) e.preventDefault(); }, { passive: false });

setTimeout(() => showChapter(0), 400);
requestAnimationFrame(frame);
// ?lod=0: without the levels of detail (to compare)
if (new URLSearchParams(location.search).get('lod') === '0') opts.lod = false;
if (new URLSearchParams(location.search).get('bench') === 'compare') setTimeout(() => void compareSpecies(benchOut), 800);
else if (new URLSearchParams(location.search).has('bench')) setTimeout(() => void runBench(api, benchOut), 800);

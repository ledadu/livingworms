// 2.5D prototype: the 2D canvas look and speed, with our own small 3D
// engine. Everything has a depth; the camera projects it and the painter
// draws from far to near. Animals swim in profile in vertical planes and
// turn around about the vertical axis.

import { Creature, Flow, STEP, TAU, clamp, draw, eachGlow, rand, rng, swimFactor, type Spec } from '../engine';
import { SPECIES } from '../content';
import { firstAncestor } from '../game/game';
import { Input } from '../game/input';
import { causticTile, fishSprites, glowSprite, makeCanvas } from '../game/bake';
import { faunaFor } from '../game/ambient';
import { reefness } from '../game/terrain';
import { View, type Proj } from './view';
import {
  X0, X1, bakeCreature, bakeRock, css, floorAt, fogOf, fogged, growPlant, makePlants, makeRocks, moodAt, waterAt,
  type Plant, type Rock
} from './world';
import '../proto3d/style.css';

// ----- settings ----- //

const settings = { angle: 7, dist: 900 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('lignee25b') || '{}')); } catch { /* private mode */ }
const save = () => { try { localStorage.setItem('lignee25b', JSON.stringify(settings)); } catch { /* ignore */ } };

// ----- canvas ----- //

const canvas = document.getElementById('sea') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;
const view = new View();
let dpr = 1, quality = 1, W = 0, H = 0;
function resize(): void {
  dpr = Math.min(2, window.devicePixelRatio || 1) * quality;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  view.resize(W, H, W < H ? 52 : 44);
}
resize();
window.addEventListener('resize', resize);

const input = new Input(canvas, 0.45, 2.6);
input.zoomMul = 900 / settings.dist;

// ----- world ----- //

const rocks: Rock[] = makeRocks();
const plants: Plant[] = makePlants();
const caustic = ctx.createPattern(causticTile(256, 7, 5), 'repeat')!;

interface Actor {
  cr: Creature; kind: 'player' | 'swim' | 'floor' | 'sib';
  z: number; hx: number; hy: number; tx: number; ty: number; next: number;
  /** +1 heading right, -1 left; turning around happens about the vertical axis */
  face: number; yaw: number; turnT: number;
}
const actors: Actor[] = [];
function addActor(sp: Spec, x: number, y: number, kind: Actor['kind'], scale = 1, z = 0): Actor {
  const cr = new Creature(sp, x, y, { dir: Math.random() < 0.5 ? 0 : Math.PI, scale, profile: true });
  for (let i = 0; i < 60; i++) cr.update(i * STEP, 0, 0, 0.1);
  const a: Actor = { cr, kind, z, hx: x, hy: y, tx: x, ty: y, next: 0, face: Math.cos(cr.heading()) >= 0 ? 1 : -1, yaw: 0, turnT: -9 };
  actors.push(a);
  return a;
}

const player = addActor(firstAncestor(), 420, 180, 'player', 0.8);
{
  const R = rng(3);
  for (let i = 0; i < 5; i++) addActor(firstAncestor(), 420 + rand(-200, 200), rand(120, 260), 'sib', 0.45 + R() * 0.15, rand(-40, 60));
  for (let x = 300; x < X1 - 300; x += 280 + R() * 300) {
    const f = faunaFor(x, R), z = [0, 0, 70, 150, 260, 400][Math.floor(R() * 6)];
    const y = f.benthic ? floorAt(x, z) - 12 : 80 + R() * (floorAt(x, z) - 200);
    addActor(f.sp, x, y, f.benthic ? 'floor' : 'swim', f.scale, z);
  }
}

// distant visitors: a turtle over the Nurserie, a manta over the Récif
interface Visitor { cr: Creature; z: number; x0: number; x1: number; y: number; dir: number; sprite: HTMLCanvasElement; }
const visitors: Visitor[] = [
  { cr: new Creature(SPECIES.tortue(), 800, 260, { dir: Math.PI, scale: 2.4, profile: true }), z: 1500, x0: 200, x1: 6000, y: 260, dir: 1, sprite: makeCanvas(256, 256) },
  { cr: new Creature(SPECIES.manta(), 7600, 200, { dir: Math.PI, scale: 2.6, profile: true }), z: 1600, x0: 7200, x1: 12000, y: 200, dir: 1, sprite: makeCanvas(256, 256) }
];

// a school of small fish in a plane behind the swimmer
const FISH = 50, FZ = 180;
const fishSpr = fishSprites({ h: 200, s: 45, l: 70 }, { h: 210, s: 30, l: 88 }, 14);
const fish = { x: new Float32Array(FISH), y: new Float32Array(FISH), vx: new Float32Array(FISH), vy: new Float32Array(FISH), ph: new Float32Array(FISH) };
for (let i = 0; i < FISH; i++) { fish.x[i] = 900 + rand(-60, 60); fish.y[i] = 220 + rand(-40, 40); fish.vx[i] = rand(-1, 1); fish.ph[i] = rand(0, TAU); }

// plankton: points around the camera
const MOTES = 160;
const motes = Array.from({ length: MOTES }, () => [rand(-700, 700), rand(-500, 500), rand(-200, 1600), rand(0.6, 1.6)]);

// ----- simulation ----- //

const flow = new Flow(32);
let t = 0;
const cam = { x: 420, y: 180 };

function steer(a: Actor, dvx: number, dvy: number, accel: number): void {
  // the vertical plane is only for up and down: to go the other way, turn around
  if (dvx * a.face < -0.2 && t - a.turnT > 0.45) {
    a.cr.mirrorX();
    a.face = -a.face;
    a.turnT = t;
    a.yaw = Math.PI;
  }
  a.cr.update(t, dvx, dvy, accel);
}

function collide(cr: Creature, z: number): void {
  const r = cr.root, rad = r.rad[0] + 3;
  for (const k of rocks) {
    const dz = Math.abs(k.z - z);
    if (dz > k.r || Math.abs(k.x - r.x[0]) > k.r * 1.4 + 20) continue;
    const cy = floorAt(k.x, k.z) - k.r * 0.5, rs = Math.sqrt(k.r * k.r - dz * dz) * 1.05;
    const dx = r.x[0] - k.x, dy = (r.y[0] - cy) / 0.8, d = Math.hypot(dx, dy), m = rs + rad;
    if (d < m && d > 0.01) { r.x[0] = k.x + (dx / d) * m; r.y[0] = cy + (dy / d) * m * 0.8; }
  }
  const fy = floorAt(r.x[0], z) - rad;
  if (r.y[0] > fy) { r.y[0] = fy; if (cr.vy > 0) cr.vy *= -0.3; }
  if (r.y[0] < 8) { r.y[0] = 8; if (cr.vy < 0) cr.vy *= -0.3; }
}

function update(): void {
  t += STEP;
  const p = player.cr, r = p.root, f = input.follow, kd = input.keyDir();
  if (f) {
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
  collide(p, 0);
  const px = r.x[0], py = r.y[0];

  flow.clear();
  const near = (x: number) => Math.abs(x - px) < 1100;
  for (const a of actors) if (Math.abs(a.z) < 50 && near(a.cr.root.x[0])) flow.add(a.cr);
  for (const a of actors) {
    if (a.kind === 'player' || !near(a.cr.root.x[0])) continue;
    const c = a.cr, cr = c.root, x = cr.x[0], y = cr.y[0];
    if (a.kind === 'sib') {
      if (t > a.next) { a.next = t + rand(1.5, 4); a.tx = rand(-90, 90); a.ty = rand(-60, 60); }
      const gx = px + a.tx - x, gy = py + a.ty - y, g = Math.hypot(gx, gy) || 1, d = Math.hypot(px - x, py - y);
      const sp = d > 280 ? 1.9 : 0.9 * Math.min(1, g / 60);
      steer(a, (gx / g) * sp, (gy / g) * sp, 0.04);
      collide(c, a.z);
      continue;
    }
    if (t > a.next || Math.hypot(a.tx - x, a.ty - y) < 20) {
      a.next = t + rand(3, 8);
      a.tx = a.hx + rand(-260, 260);
      a.ty = a.kind === 'floor' ? floorAt(a.tx, a.z) - 10 : clamp(a.hy + rand(-120, 120), 40, floorAt(a.tx, a.z) - 50);
    }
    let dx = a.tx - x, dy = a.ty - y;
    if (a.kind === 'swim' && Math.abs(a.z) < 60) {
      const qx = x - px, qy = y - py, q = Math.hypot(qx, qy);
      if (q < 70) { dx += (qx / (q + 1)) * 200; dy += (qy / (q + 1)) * 200; }
    }
    const d = Math.hypot(dx, dy) || 1, sp = c.spec.swim.speed * 0.45 * swimFactor(c, t) * Math.min(1, d / 60);
    steer(a, (dx / d) * sp, (dy / d) * sp, 0.05);
    collide(c, a.z);
  }
  for (const pl of plants) if (pl.live && pl.cr && Math.abs(pl.x - px) < 700) { pl.cr.update(t, 0, 0, 1); flow.apply(pl.cr, { push: 0.25, wake: 0.04, reach: 18 }); }
  for (const a of actors) if (Math.abs(a.z) < 50 && near(a.cr.root.x[0])) flow.apply(a.cr, { push: 0.3, wake: 0.02, body: a.kind === 'player' ? 0.008 : 0.01 });

  for (const v of visitors) {
    const vx = v.cr.root.x[0];
    if (vx > v.x1) v.dir = -1; else if (vx < v.x0) v.dir = 1;
    if (Math.abs(vx - px) < 5000) {
      if (v.dir * Math.cos(v.cr.heading()) < -0.2) v.cr.mirrorX();
      v.cr.update(t, v.dir * 0.55 * swimFactor(v.cr, t), (v.y - v.cr.root.y[0]) * 0.01, 0.02);
    }
  }

  // fish school
  let cx = 0, cy = 0, ax = 0, ay = 0;
  for (let i = 0; i < FISH; i++) { cx += fish.x[i]; cy += fish.y[i]; ax += fish.vx[i]; ay += fish.vy[i]; }
  cx /= FISH; cy /= FISH; ax /= FISH; ay /= FISH;
  const gx = px + Math.sin(t * 0.05) * 900, gy = 200 + Math.cos(t * 0.07) * 80;
  for (let i = 0; i < FISH; i++) {
    let fx = (cx - fish.x[i]) * 0.002 + (ax - fish.vx[i]) * 0.05 + (gx - cx) * 0.0004;
    let fy = (cy - fish.y[i]) * 0.002 + (ay - fish.vy[i]) * 0.05 + (gy - cy) * 0.0004;
    for (let j = 0; j < FISH; j++) {
      if (j === i) continue;
      const dx = fish.x[i] - fish.x[j], dy = fish.y[i] - fish.y[j];
      if (dx > 10 || dx < -10 || dy > 10 || dy < -10) continue;
      const d2 = dx * dx + dy * dy + 0.01;
      fx += (dx / d2) * 1.3; fy += (dy / d2) * 1.3;
    }
    let vx = fish.vx[i] + fx, vy = fish.vy[i] + fy;
    const m = Math.hypot(vx, vy);
    if (m > 2.2) { vx *= 2.2 / m; vy *= 2.2 / m; } else if (m < 0.7) { vx *= 0.7 / (m || 1); vy *= 0.7 / (m || 1); }
    fish.vx[i] = vx; fish.vy[i] = vy * 0.95;
    fish.x[i] += vx; fish.y[i] = clamp(fish.y[i] + fish.vy[i], 30, floorAt(fish.x[i], FZ) - 40);
    fish.ph[i] += 0.25 + m * 0.12;
  }

  // plants grow when they come near, and are forgotten far behind
  let grow = 4;
  for (const pl of plants) {
    const dx = Math.abs(pl.x - px);
    if (!pl.cr && dx < 1800 && grow-- > 0) growPlant(pl);
    else if (pl.cr && dx > 3200) { pl.cr = null; pl.sprite = null; }
  }
}

// ----- drawing ----- //

const P: Proj = { x: 0, y: 0, s: 1, d: 1 };
const Q: Proj = { x: 0, y: 0, s: 1, d: 1 };
const ROWS = [2000, 1700, 1450, 1240, 1060, 910, 780, 670, 570, 480, 400, 330, 265, 205, 150, 100, 55, 12, -35];

type Item = { d: number; fn: () => void };
const items: Item[] = [];

function creatureTransform(cr: Creature, z: number, yaw: number): number {
  const r = cr.root;
  view.project(r.x[0], r.y[0], z, P);
  const k = P.s, kv = Math.cos(view.pitch);
  let sx = Math.cos(yaw);
  if (Math.abs(sx) < 0.12) sx = sx < 0 ? -0.12 : 0.12;
  ctx.setTransform(dpr * k * sx, 0, 0, dpr * k * kv, dpr * (P.x - k * sx * r.x[0]), dpr * (P.y - k * kv * r.y[0]));
  return k;
}

function drawSprite(sp: { canvas: HTMLCanvasElement; ax: number; ay: number; res: number }, x: number, y: number, z: number): void {
  view.project(x, y, z, P);
  const k = P.s / sp.res, kv = Math.cos(view.pitch);
  ctx.setTransform(dpr * k, 0, 0, dpr * k * kv, dpr * P.x, dpr * P.y);
  ctx.drawImage(sp.canvas, -sp.ax * sp.res, -sp.ay * sp.res);
}

let bakes = 0;

function render(): void {
  const m = moodAt(cam.x), pr = player.cr.root, plane = settings.dist;
  const deepC = waterAt(m, cam.y + 200);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // water behind everything
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, css(waterAt(m, cam.y * 0.7 + (i / 4 - 0.4) * 500)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // the surface seen from below: bright near, melting into the water far away
  view.project(cam.x, 0, -120, P);
  view.project(cam.x, 0, 3200, Q);
  if (P.y > -40 || Q.y > 0) {
    const top = Math.min(P.y, 0), yFar = Q.y;
    const sg = ctx.createLinearGradient(0, top, 0, yFar);
    sg.addColorStop(0, css({ h: m.top.h + 10, s: 80, l: 84 }));
    sg.addColorStop(1, css(waterAt(m, 60), 1));
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, Math.max(0, yFar));
    // wave lines on the underside
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
  for (const z of ROWS) items.push({ d: view.depth(floorAt(cam.x, z), z) + 0.5, fn: () => drawRow(z, m, plane) });
  for (const k of rocks) {
    if (Math.abs(k.x - cam.x) > 2200) continue;
    const [x0, x1] = view.xRange(k.z, k.r * 2);
    if (k.x < x0 || k.x > x1) continue;
    const y = floorAt(k.x, k.z);
    items.push({ d: view.depth(y, k.z), fn: () => drawRock(k, y, m, plane) });
  }
  for (const pl of plants) {
    if (!pl.cr) continue;
    const [x0, x1] = view.xRange(pl.z, 240);
    if (pl.x < x0 || pl.x > x1) continue;
    items.push({ d: view.depth(pl.cr.root.y[0], pl.z), fn: () => drawPlant(pl, m, plane) });
  }
  for (const a of actors) {
    const [x0, x1] = view.xRange(a.z, 200);
    const x = a.cr.root.x[0];
    if (x < x0 || x > x1) continue;
    items.push({ d: view.depth(a.cr.root.y[0], a.z) - 0.2, fn: () => { creatureTransform(a.cr, a.z, a.yaw); draw(ctx, a.cr, { ink: true }); } });
  }
  for (const v of visitors) {
    const [x0, x1] = view.xRange(v.z, 400);
    if (v.cr.root.x[0] < x0 || v.cr.root.x[0] > x1) continue;
    items.push({ d: view.depth(v.y, v.z), fn: () => drawVisitor(v, m, plane) });
  }
  items.push({ d: view.depth(200, FZ), fn: drawFish });
  items.push({ d: view.depth(300, 700), fn: () => drawRays(m) });
  items.sort((a, b) => b.d - a.d);
  bakes = 0;
  for (const it of items) it.fn();

  // glows of the creatures
  ctx.globalCompositeOperation = 'lighter';
  for (const a of actors) {
    if (Math.abs(a.cr.root.x[0] - cam.x) > 1400) continue;
    eachGlow(a.cr.list, (x, y, size, hue, al) => {
      view.project(x, y, a.z, P);
      const s = size * P.s;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = al * 0.55;
      ctx.drawImage(glowSprite(hue), P.x - s, P.y - s, s * 2, s * 2);
    });
  }
  ctx.globalAlpha = 1;

  // plankton
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = css(m.plankton, 0.5);
  ctx.beginPath();
  for (const mo of motes) {
    const x = cam.x + ((((mo[0] + t * 3 - cam.x * 0.0) % 1400) + 2100) % 1400) - 700;
    const y = cam.y + mo[1] + Math.sin(t * 0.3 + mo[3] * 9) * 6;
    if (y < 4) continue;
    view.project(x, y, mo[2], P);
    const s = Math.max(0.4, mo[3] * P.s * 1.2);
    ctx.moveTo(P.x + s, P.y);
    ctx.arc(P.x, P.y, s, 0, TAU);
  }
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // vignette, and the deep closing in
  ctx.drawImage(vignette(), 0, 0, W, H);
  const dd = clamp((pr.y[0] - 300) / 900, 0, 1);
  if (dd > 0) { ctx.fillStyle = css(m.deep, dd * 0.22, -10); ctx.fillRect(0, 0, W, H); }
  void deepC;
}

function drawRow(z: number, m: ReturnType<typeof moodAt>, plane: number): void {
  const [x0, x1] = view.xRange(z, 80), n = 44;
  const d = view.depth(floorAt(cam.x, z), z), fog = fogOf(d, plane);
  const back = clamp((z - 300) / 700, 0, 1);
  const base = { h: m.sand.h, s: m.sand.s, l: m.sand.l - 6 - z * 0.004 };
  const col = fogged(m, back > 0 ? { h: base.h + (m.rock.h - base.h) * back, s: base.s + (m.rock.s - base.s) * back, l: base.l + (m.rock.l - base.l) * back } : base, 400 + z * 0.3, fog);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath();
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    view.project(x, floorAt(x, z), z, P);
    pts.push(P.x, P.y);
    if (i) ctx.lineTo(P.x, P.y); else ctx.moveTo(P.x, P.y);
  }
  ctx.lineTo(W + 50, H + 50);
  ctx.lineTo(-50, H + 50);
  ctx.closePath();
  const top = Math.min(...pts.filter((_, i) => i % 2 === 1));
  const gr = ctx.createLinearGradient(0, top, 0, top + 420);
  gr.addColorStop(0, css(col, 1, 2));
  gr.addColorStop(1, css(col, 1, -5));
  ctx.fillStyle = gr;
  ctx.fill();
  // caustics on the nearest rows
  if (z <= 240 && z > -120) {
    ctx.save();
    ctx.clip();
    view.project(0, 0, z, P);
    const s = P.s;
    caustic.setTransform(new DOMMatrix([s * 0.75, 0, s * 0.2, s * 0.3, P.x + t * 10 * s, P.y + t * 4 * s]));
    ctx.fillStyle = caustic;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.1 * m.caustics * (1 - fog);
    ctx.fillRect(0, top, W, H - top);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  // lit rim, and ink
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) if (i) ctx.lineTo(pts[i], pts[i + 1]); else ctx.moveTo(pts[i], pts[i + 1]);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = css(col, z > 600 ? 0.5 : 0.18, 12);
  ctx.stroke();
}

function drawRock(k: Rock, y: number, m: ReturnType<typeof moodAt>, plane: number): void {
  const d = view.depth(y, k.z);
  view.project(k.x, y, k.z, P);
  const res = Math.min(3, P.s * dpr);
  if ((!k.sprite || Math.abs(d - k.spriteD) / k.spriteD > 0.3 || k.sprite.res < res * 0.6) && bakes++ < 3) {
    const mm = moodAt(k.x);
    k.sprite = bakeRock(k.r, k.seed, mm, reefness(k.x), fogOf(d, plane), waterAt(mm, 300 + k.z * 0.3), res);
    k.spriteD = d;
  }
  if (k.sprite) drawSprite(k.sprite, k.x, y + k.r * 0.2, k.z);
  void m;
}

function drawPlant(pl: Plant, m: ReturnType<typeof moodAt>, plane: number): void {
  const cr = pl.cr!;
  if (pl.live && Math.abs(pl.x - cam.x) < 900) {
    // in the swimming plane: drawn live, it moves with the water
    creatureTransform(cr, pl.z, 0);
    draw(ctx, cr, { ink: true });
    return;
  }
  const d = view.depth(cr.root.y[0], pl.z);
  view.project(pl.x, cr.root.y[0], pl.z, P);
  const res = Math.min(3, P.s * dpr);
  if ((!pl.sprite || Math.abs(d - pl.spriteD) / pl.spriteD > 0.3) && bakes++ < 4) {
    pl.sprite = bakeCreature(cr, fogOf(d, plane), waterAt(moodAt(pl.x), 300 + pl.z * 0.3), res);
    pl.spriteD = d;
  }
  if (pl.sprite) drawSprite(pl.sprite, cr.root.x[0], cr.root.y[0], pl.z);
  void m;
}

function drawVisitor(v: Visitor, m: ReturnType<typeof moodAt>, plane: number): void {
  // drawn small into its own buffer, washed with the water colour, then placed
  const cr = v.cr, b = cr.box, w = b[2] - b[0] + 20, h = b[3] - b[1] + 20;
  const s = Math.min(1, 240 / Math.max(w, h));
  const bc = v.sprite.getContext('2d')!;
  bc.setTransform(1, 0, 0, 1, 0, 0);
  bc.clearRect(0, 0, 256, 256);
  bc.setTransform(s, 0, 0, s, (-b[0] + 10) * s, (-b[1] + 10) * s);
  draw(bc, cr);
  bc.setTransform(1, 0, 0, 1, 0, 0);
  bc.globalCompositeOperation = 'source-atop';
  bc.fillStyle = css(fogged(m, m.deep, 300, 0.4), fogOf(view.depth(v.y, v.z), plane) * 0.9 + 0.1);
  bc.fillRect(0, 0, 256, 256);
  bc.globalCompositeOperation = 'source-over';
  view.project(b[0] - 10, b[1] - 10, v.z, P);
  const k = P.s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(v.sprite, 0, 0, Math.ceil(w * s), Math.ceil(h * s), P.x, P.y, w * k, h * k * Math.cos(view.pitch));
  ctx.globalAlpha = 1;
}

function drawFish(): void {
  const spr = fishSpr, sw = spr[0].width / 2, sh = spr[0].height / 2;
  for (let i = 0; i < FISH; i++) {
    view.project(fish.x[i], fish.y[i], FZ, P);
    if (P.x < -40 || P.x > W + 40) continue;
    const ang = Math.atan2(fish.vy[i], fish.vx[i]), flip = Math.cos(ang) < 0 ? -1 : 1, co = Math.cos(ang), si = Math.sin(ang), a = P.s * dpr * 0.5;
    ctx.setTransform(a * co, a * si, -a * si * flip, a * co * flip, P.x * dpr, P.y * dpr);
    ctx.drawImage(spr[Math.floor(fish.ph[i]) % 3], -sw, -sh);
  }
}

function drawRays(m: ReturnType<typeof moodAt>): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  const sp = 260;
  for (let k = Math.floor((cam.x - 1400) / sp); k <= Math.floor((cam.x + 1400) / sp); k++) {
    const h1 = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1, h2 = Math.abs(Math.sin(k * 78.233) * 12345.678) % 1;
    if (h1 < 0.4) continue;
    const x = k * sp + h2 * 200, z = 150 + h1 * 900, w = 20 + h2 * 50, L = 700;
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

let vig: HTMLCanvasElement | null = null;
function vignette(): HTMLCanvasElement {
  if (vig) return vig;
  vig = makeCanvas(256, 256);
  const g = vig.getContext('2d')!, rg = g.createRadialGradient(128, 128, 70, 128, 128, 182);
  rg.addColorStop(0, 'rgba(0,0,0,0)');
  rg.addColorStop(1, 'rgba(0,0,0,0.42)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 256);
  return vig;
}

// ----- loop ----- //

let last = performance.now(), acc = 0, fn = 0, fsum = 0;
const stats = { fps: 0, render: 0 };
function frame(now: number): void {
  const dt = now - last;
  last = now;
  acc += Math.min(0.1, dt / 1000);
  let steps = 0;
  while (acc >= STEP && steps < 3) { update(); acc -= STEP; steps++; }
  if (steps === 3) acc = 0;
  // camera: follows the swimmer, never above the surface
  const r = player.cr.root, dist = 900 / input.zoomMul, pitch = (settings.angle * Math.PI) / 180;
  cam.x += (r.x[0] + player.cr.vx * 20 - cam.x) * 0.07;
  cam.y += (r.y[0] + player.cr.vy * 20 - cam.y) * 0.07;
  const ty = Math.max(cam.y, 30 + dist * Math.sin(pitch));
  view.aim(cam.x, ty, dist, pitch);
  for (const a of actors) { a.yaw *= 0.84; if (Math.abs(a.yaw) < 0.01) a.yaw = 0; }
  const r0 = performance.now();
  render();
  stats.render = stats.render * 0.9 + (performance.now() - r0) * 0.1;
  fn++; fsum += dt;
  if (fn >= 90) {
    const avg = fsum / fn;
    stats.fps = 1000 / avg;
    if (avg > 21 && quality > 0.55) { quality *= 0.85; resize(); } else if (avg < 15 && quality < 1) { quality = Math.min(1, quality / 0.9); resize(); }
    fn = 0; fsum = 0;
    fpsEl.textContent = stats.fps.toFixed(0) + ' img/s';
  }
  requestAnimationFrame(frame);
}

(window as unknown as { lignee25: unknown }).lignee25 = {
  settings, player, stats, actors, view,
  teleport: (x: number, y: number) => { player.cr.translate(x - player.cr.root.x[0], y - player.cr.root.y[0]); cam.x = x; cam.y = y; },
  spawn: (id: string, dx: number, dy: number) => addActor(SPECIES[id](), player.cr.root.x[0] + dx, player.cr.root.y[0] + dy, 'swim', 1, 0)
};

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
for (const el of [panel, gear]) for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
const hint = document.getElementById('hint')!;
setTimeout(() => hint.classList.add('gone'), 6000);
document.addEventListener('touchmove', (e) => { if (!(e.target as HTMLElement).closest('#panel')) e.preventDefault(); }, { passive: false });

requestAnimationFrame(frame);
